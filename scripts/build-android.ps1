#requires -Version 7.0
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$mobileDirectory = Join-Path $projectRoot 'apps/mobile'
$signingDirectory = Join-Path $projectRoot 'signing/android'
$outputDirectory = Join-Path $projectRoot 'output/android'
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME/bin/java.exe")) {
    throw 'Set JAVA_HOME to a JDK 17 installation. See docs/build-android.md.'
}
if (-not $env:ANDROID_HOME -or -not (Test-Path "$env:ANDROID_HOME/build-tools/36.0.0/apksigner.bat")) {
    throw 'Set ANDROID_HOME to an Android SDK with Build Tools 36.0.0. See docs/build-android.md.'
}
if (-not (Test-Path "$signingDirectory/release.properties")) {
    throw 'Restore signing/android from your original backup. Never replace a released signing key.'
}
$signingProperties = Get-Content -Raw "$signingDirectory/release.properties" | ConvertFrom-StringData
foreach ($propertyName in 'storeFile', 'storePassword', 'keyAlias', 'keyPassword') {
    if (-not $signingProperties[$propertyName]) { throw "Missing signing property: $propertyName" }
}
$keystorePath = Join-Path $signingDirectory $signingProperties.storeFile
if (-not (Test-Path -LiteralPath $keystorePath)) { throw 'Release keystore missing.' }

$previousPath = $env:PATH
$previousNodeEnv = $env:NODE_ENV
$previousCI = $env:CI
$previousStorePassword = $env:NOTESCALE_STORE_PASSWORD
Push-Location $mobileDirectory
try {
    $env:PATH = "$env:JAVA_HOME/bin;$env:ANDROID_HOME/platform-tools;$env:PATH"
    $env:NODE_ENV = 'production'
    $env:CI = '1'
    & node "$projectRoot/node_modules/expo/bin/cli" prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed.' }

    Set-Location "$mobileDirectory/android"
    & ./gradlew.bat --no-daemon --console=plain --max-workers=2 -I "$PSScriptRoot/android-release.gradle" :app:assembleRelease :app:bundleRelease
    if ($LASTEXITCODE -ne 0) { throw 'Android release build failed; previous output/android files are not a new release.' }

    $apkPath = "$mobileDirectory/android/app/build/outputs/apk/release/app-release.apk"
    $aabPath = "$mobileDirectory/android/app/build/outputs/bundle/release/app-release.aab"
    $apkVerification = & "$env:ANDROID_HOME/build-tools/36.0.0/apksigner.bat" verify --print-certs $apkPath
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
    $env:NOTESCALE_STORE_PASSWORD = $signingProperties.storePassword
    $aabVerification = & "$env:JAVA_HOME/bin/jarsigner.exe" '-J-Duser.language=en' -verify -strict -keystore $keystorePath -storepass:env NOTESCALE_STORE_PASSWORD $aabPath $signingProperties.keyAlias
    if ($LASTEXITCODE -ne 0 -or "$aabVerification" -notmatch 'jar verified') { throw 'AAB signature verification failed.' }
    $releaseCertificate = & "$env:JAVA_HOME/bin/keytool.exe" '-J-Duser.language=en' -list -v -keystore $keystorePath -alias $signingProperties.keyAlias -storepass:env NOTESCALE_STORE_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect signing certificate.' }
    $aabCertificate = & "$env:JAVA_HOME/bin/keytool.exe" '-J-Duser.language=en' -printcert -jarfile $aabPath
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect AAB certificate.' }
    $releaseFingerprint = [regex]::Match(($releaseCertificate -join "`n"), 'SHA256: ([A-Fa-f0-9:]+)').Groups[1].Value.Replace(':', '').ToLowerInvariant()
    $hasValidReleaseFingerprint = $releaseFingerprint.Length -eq 64
    $apkUsesReleaseCertificate = ($apkVerification -join '').ToLowerInvariant() -match $releaseFingerprint
    $aabUsesReleaseCertificate = ($aabCertificate -join '').Replace(':', '').ToLowerInvariant() -match $releaseFingerprint
    if (-not $hasValidReleaseFingerprint -or -not $apkUsesReleaseCertificate -or -not $aabUsesReleaseCertificate) {
        throw 'APK/AAB certificate differs from the saved release key.'
    }
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
    Copy-Item -LiteralPath $apkPath -Destination "$outputDirectory/notescale-release.apk"
    Copy-Item -LiteralPath $aabPath -Destination "$outputDirectory/notescale-release.aab"
    Get-FileHash "$outputDirectory/notescale-release.apk", "$outputDirectory/notescale-release.aab" -Algorithm SHA256 |
        ForEach-Object { "$($_.Hash.ToLowerInvariant())  $(Split-Path $_.Path -Leaf)" } |
        Set-Content "$outputDirectory/SHA256SUMS.txt" -Encoding utf8
    Write-Output "Verified APK + AAB: $outputDirectory"
    Write-Output "Signing certificate SHA-256: $releaseFingerprint"
} finally {
    Pop-Location
    $env:PATH = $previousPath
    $env:NODE_ENV = $previousNodeEnv
    $env:CI = $previousCI
    $env:NOTESCALE_STORE_PASSWORD = $previousStorePassword
}
