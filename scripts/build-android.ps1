#requires -Version 7.0
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$mobile = Join-Path $root 'apps/mobile'
$signing = Join-Path $root 'signing/android'
$output = Join-Path $root 'output/android'
if (-not $env:JAVA_HOME -or -not (Test-Path "$env:JAVA_HOME/bin/java.exe")) {
    throw 'Set JAVA_HOME to a JDK 17 installation. See docs/build-android.md.'
}
if (-not $env:ANDROID_HOME -or -not (Test-Path "$env:ANDROID_HOME/build-tools/36.0.0/apksigner.bat")) {
    throw 'Set ANDROID_HOME to an Android SDK with Build Tools 36.0.0. See docs/build-android.md.'
}
if (-not (Test-Path "$signing/release.properties")) {
    throw 'Restore signing/android from your original backup. Never replace a released signing key.'
}
$credentials = Get-Content -Raw "$signing/release.properties" | ConvertFrom-StringData
foreach ($name in 'storeFile', 'storePassword', 'keyAlias', 'keyPassword') {
    if (-not $credentials[$name]) { throw "Missing signing property: $name" }
}
$keystore = Join-Path $signing $credentials.storeFile
if (-not (Test-Path -LiteralPath $keystore)) { throw 'Release keystore missing.' }

$oldPath = $env:PATH
$oldNodeEnv = $env:NODE_ENV
$oldCI = $env:CI
$oldPassword = $env:NOTESCALE_STORE_PASSWORD
Push-Location $mobile
try {
    $env:PATH = "$env:JAVA_HOME/bin;$env:ANDROID_HOME/platform-tools;$env:PATH"
    $env:NODE_ENV = 'production'
    $env:CI = '1'
    & node "$root/node_modules/expo/bin/cli" prebuild --platform android --no-install
    if ($LASTEXITCODE -ne 0) { throw 'Expo prebuild failed.' }

    Set-Location "$mobile/android"
    & ./gradlew.bat --no-daemon --console=plain --max-workers=2 -I "$PSScriptRoot/android-release.gradle" :app:assembleRelease :app:bundleRelease
    if ($LASTEXITCODE -ne 0) { throw 'Android release build failed; previous output/android files are not a new release.' }

    $apk = "$mobile/android/app/build/outputs/apk/release/app-release.apk"
    $aab = "$mobile/android/app/build/outputs/bundle/release/app-release.aab"
    $apkCheck = & "$env:ANDROID_HOME/build-tools/36.0.0/apksigner.bat" verify --print-certs $apk
    if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }
    $env:NOTESCALE_STORE_PASSWORD = $credentials.storePassword
    $aabCheck = & "$env:JAVA_HOME/bin/jarsigner.exe" '-J-Duser.language=en' -verify -strict -keystore $keystore -storepass:env NOTESCALE_STORE_PASSWORD $aab $credentials.keyAlias
    if ($LASTEXITCODE -ne 0 -or "$aabCheck" -notmatch 'jar verified') { throw 'AAB signature verification failed.' }
    $certificate = & "$env:JAVA_HOME/bin/keytool.exe" '-J-Duser.language=en' -list -v -keystore $keystore -alias $credentials.keyAlias -storepass:env NOTESCALE_STORE_PASSWORD
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect signing certificate.' }
    $aabCertificate = & "$env:JAVA_HOME/bin/keytool.exe" '-J-Duser.language=en' -printcert -jarfile $aab
    if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect AAB certificate.' }
    $fingerprint = [regex]::Match(($certificate -join "`n"), 'SHA256: ([A-Fa-f0-9:]+)').Groups[1].Value.Replace(':', '').ToLowerInvariant()
    if ($fingerprint.Length -ne 64 -or ($apkCheck -join '').ToLowerInvariant() -notmatch $fingerprint -or ($aabCertificate -join '').Replace(':', '').ToLowerInvariant() -notmatch $fingerprint) {
        throw 'APK/AAB certificate differs from the saved release key.'
    }
    New-Item -ItemType Directory -Force -Path $output | Out-Null
    Copy-Item -LiteralPath $apk -Destination "$output/notescale-release.apk"
    Copy-Item -LiteralPath $aab -Destination "$output/notescale-release.aab"
    Get-FileHash "$output/notescale-release.apk", "$output/notescale-release.aab" -Algorithm SHA256 |
        ForEach-Object { "$($_.Hash.ToLowerInvariant())  $(Split-Path $_.Path -Leaf)" } |
        Set-Content "$output/SHA256SUMS.txt" -Encoding utf8
    Write-Output "Verified APK + AAB: $output"
    Write-Output "Signing certificate SHA-256: $fingerprint"
} finally {
    Pop-Location
    $env:PATH = $oldPath
    $env:NODE_ENV = $oldNodeEnv
    $env:CI = $oldCI
    $env:NOTESCALE_STORE_PASSWORD = $oldPassword
}
