# Compiler NoteScale pour Android, localement sous Windows

Objectif : produire un APK installable et un AAB destiné à Google Play, tous deux
signés avec la même clé locale. Aucun compte Expo ni compilation EAS nécessaire.
La compilation utilise Expo Prebuild, puis le wrapper Gradle Android.

## État de vérification

Build local réussi le **14 octobre 2026** : version **1.0.0**, `versionCode` **1**,
package `app.notescale.mobile`, Android API 24 minimum / cible 36.

- APK : **101 023 004 octets** (96,3 Mio), quatre architectures Android.
- AAB : **72 069 653 octets** (68,7 Mio).
- Signature APK v2 vérifiée avec `apksigner` ; AAB vérifié avec `jarsigner -strict`.
- Certificats des deux livrables identiques à celui de la clé locale sauvegardée.
- APK non débogable, bundle JavaScript embarqué et 24 échantillons WAV présents.
- Alignement ZIP de l'APK vérifié avec `zipalign -c -P 16 4`.
- `npm test`, `npm run typecheck` et `npm run lint` réussis.
- Contrôle négatif de signature : ajout d'une entrée non signée dans une archive
  de test correctement rejeté par `jarsigner -strict`.

Empreintes des livrables dans `output/android/SHA256SUMS.txt`. Ne pas considérer
des fichiers déjà présents comme une nouvelle compilation après un échec.

Aucun test sur téléphone ou émulateur n'est attesté par cette procédure.
Une compilation réussie ne prouve pas le fonctionnement de l'audio sur appareil.

## Prérequis

- Windows et PowerShell **7 ou supérieur** ; commande `pwsh` disponible.
- Node.js **22.13 ou supérieur** compatible avec Expo SDK 57 ; Node 22.21.1 et
  npm 10.9.4 observés dans cet environnement.
- JDK 17 : `java`, `keytool` et `jarsigner` fournis ensemble.
- Android SDK avec outils en ligne de commande, Platform Tools, plateforme 36,
  Build Tools **36.0.0** et **35.0.0**, NDK **27.1.12297006** et CMake **3.22.1**.
- Licences des composants Android acceptées par leur titulaire.
- Accès réseau lors du premier téléchargement des dépendances npm, Gradle et
  Android. Prévoir espace disque et temps pour les dépendances natives.

Versions du projet : Expo 57.0.12, React Native 0.86.2 et React 19.2.3.
Configuration Android native par défaut : minimum API 24, compilation et cible
API 36 ; wrapper Gradle 9.3.1. CMake 3.22.1 est utilisé par les modules natifs.
Build Tools 35.0.0 est également demandé par certaines dépendances, en plus de
36.0.0 pour l'application.

Les outils peuvent rester portables, hors du dépôt. Emplacements prévus sur
cette machine :

- JDK : `D:\Android\jdk-17.0.20.1+1`.
- SDK : `D:\Android\Sdk`.
- Cache Gradle facultatif : `D:\Android\gradle-cache`.

Pour une autre machine, adapter ces chemins aux installations réelles. Les
versions SDK doivent correspondre au projet, pas seulement aux outils les plus
récents proposés par Android Studio. La [matrice Expo](https://docs.expo.dev/versions/latest/)
et le [guide d'installation Android](https://docs.expo.dev/workflow/android-studio-emulator/)
documentent les prérequis.

## Clé de signature : conserver, ne pas régénérer

Le dossier `signing/android`, à la racine du dépôt, contient :

| Fichier | Rôle |
| --- | --- |
| `notescale-release.keystore` | Clé privée dans un conteneur PKCS12 ; alias `notescale-release`. |
| `release.properties` | Emplacement du keystore, alias et mots de passe nécessaires au build. |
| `signing-certificate.pem` | Certificat public exporté ; ne contient pas la clé privée. |

La clé initiale utilise RSA 3072 bits, un certificat valable 10 000 jours et un
mot de passe aléatoire. Sa génération est volontairement absente du script de
build : une reconstruction doit réutiliser les fichiers sauvegardés.

Empreinte SHA-256 du certificat initial (publique, sans mot de passe) :

```text
95:39:FF:E3:90:75:92:77:21:F6:A4:AA:33:60:7E:32:1F:3B:84:80:DB:12:99:43:50:60:2E:4A:50:69:D2:A3
```

Le fichier de propriétés contient les champs `storeFile`, `storePassword`,
`keyAlias` et `keyPassword`. La valeur de `storeFile` est
`notescale-release.keystore`, relative à ce dossier. **Ne pas afficher son contenu
dans un terminal partagé, une capture, une conversation ou un journal.**

Le dossier est ignoré par Git. Ses permissions locales doivent limiter l'accès
au compte utilisateur propriétaire et à `SYSTEM`. `.gitignore` ne remplace ni
ces permissions ni une sauvegarde.

**Sauvegarder le dossier complet dans une sauvegarde chiffrée distincte de cette
machine.** Conserver le moyen de déchiffrement dans un gestionnaire de mots de
passe ou un autre emplacement sûr. Copier seulement le keystore sans ses mots de
passe ne suffit pas. Ne jamais committer ces fichiers, même temporairement.

Pour reconstruire après un nouveau clone ou sur une autre machine : restaurer
le dossier complet à cet emplacement et réappliquer des permissions adaptées au
nouveau compte. Si la clé ou les mots de passe manquent, arrêter et restaurer la
sauvegarde d'origine. **Ne pas créer une nouvelle clé pour contourner l'erreur.**

La clé reste hors de `apps/mobile/android` : Expo peut régénérer ce dernier sans
effacer la signature. Le script échoue si les fichiers de signature manquent ;
il n'utilise pas la clé de débogage en remplacement.

## Refaire une compilation

Ouvrir PowerShell 7. Depuis la racine du dépôt :

```powershell
Set-Location 'D:\Projets\Perso\NoteScale'
$env:JAVA_HOME = 'D:\Android\jdk-17.0.20.1+1'
$env:ANDROID_HOME = 'D:\Android\Sdk'
# Facultatif : conserver les téléchargements Gradle hors du dépôt.
$env:GRADLE_USER_HOME = 'D:\Android\gradle-cache'

& "$env:JAVA_HOME\bin\java.exe" -version
node --version
npm --version
pwsh --version

npm ci
if ($LASTEXITCODE -ne 0) { throw 'Installation npm échouée.' }
npm run build:android
if ($LASTEXITCODE -ne 0) { throw 'Compilation Android échouée.' }
```

`npm ci` restaure les versions du fichier de verrouillage. Ne pas le remplacer
par une mise à jour générale des dépendances pour reproduire une livraison.
Les variables définies ci-dessus concernent uniquement cette session et ses
processus enfants ; aucune modification globale du système n'est nécessaire.

La commande `npm run build:android` lance `scripts/build-android.ps1`, qui :

1. Vérifie les chemins JDK/SDK et la présence des fichiers de signature.
2. Exécute Expo `prebuild --platform android --no-install` dans `apps/mobile`.
3. Exécute les tâches Gradle `:app:assembleRelease` et `:app:bundleRelease` avec
   `scripts/android-release.gradle` comme script d'initialisation.
4. Injecte la signature locale dans la variante `release`, sans modifier le
   template généré par Expo.
5. Vérifie la signature APK avec `apksigner`, celle de l'AAB avec `jarsigner`,
   puis vérifie que leurs certificats correspondent à celui du keystore.
6. Copie les livrables vérifiés et calcule leurs empreintes SHA-256.

Expo Prebuild gère entièrement `apps/mobile/android` et peut le recréer. Ne pas
y conserver de modifications manuelles. Les commandes `npm run android` et
`npm run ios` utilisent désormais `expo run:android` / `expo run:ios` ;
`npm run start:mobile` reste disponible pour démarrer le serveur Expo.

Le script Gradle place le cache CMake de l'application dans un sous-dossier
court `cxx/<identifiant-du-checkout>` du cache Gradle. Cela contourne l'échec
Windows/Ninja « Filename longer than 260 characters » observé avec le chemin
standard `apps/mobile/android/app/.cxx`. Garder `GRADLE_USER_HOME` court, comme
`D:\Android\gradle-cache`. Aucun changement global du registre Windows requis.

Ne pas lancer simplement `gradlew assembleRelease` sans le script
d'initialisation : le template Expo peut utiliser une clé de débogage pour la
variante `release`. La commande npm évite cette erreur et conserve le contrôle
des signatures. Voir [Expo : compilation locale de production](https://docs.expo.dev/guides/local-app-production/)
et [Android : compilation en ligne de commande](https://developer.android.com/build/building-cmdline).

## Livrables

Après succès complet :

| Chemin depuis la racine | Usage |
| --- | --- |
| `output/android/notescale-release.apk` | Installation directe sur Android. |
| `output/android/notescale-release.aab` | Import dans Google Play Console ; pas une installation directe. |
| `output/android/SHA256SUMS.txt` | Empreintes des deux fichiers pour contrôler une copie ou un archivage. |

Sur cette machine, dossier final :
`D:\Projets\Perso\NoteScale\output\android`.

Les sorties natives intermédiaires restent dans :

- `apps/mobile/android/app/build/outputs/apk/release/app-release.apk`.
- `apps/mobile/android/app/build/outputs/bundle/release/app-release.aab`.

Les noms des sorties finales sont réutilisés à chaque compilation. Archiver les
livraisons utiles séparément avec leur version et leur fichier d'empreintes.
Si une compilation échoue, les anciens fichiers de sortie ne deviennent pas
une nouvelle livraison.

Contrôle manuel des empreintes, sans lire les secrets :

```powershell
Get-FileHash .\output\android\notescale-release.apk, .\output\android\notescale-release.aab -Algorithm SHA256
Get-Content .\output\android\SHA256SUMS.txt
```

## Préparer une version suivante

Dans `apps/mobile/app.json` :

- Conserver `expo.android.package` égal à `app.notescale.mobile`.
- Mettre à jour `expo.version` pour la version visible par l'utilisateur.
- Incrémenter `expo.android.versionCode` pour chaque nouvelle
  publication. Sa valeur initiale est explicitement `1` ;
  utiliser un entier supérieur au dernier déjà publié, pas systématiquement `2`.
- Réutiliser la clé et les mots de passe d'origine.

Relancer ensuite la compilation complète. Expo régénère la configuration native
à partir de `app.json` ; ne pas compter sur une modification manuelle du dossier
Android généré pour conserver le numéro de version.

Avant distribution, exécuter aussi les vérifications du projet :

```powershell
npm test
npm run typecheck
npm run lint
```

## Installer et vérifier sur appareil

Activer le débogage USB sur l'appareil puis autoriser l'ordinateur. Avec un seul
appareil connecté :

```powershell
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices
& "$env:ANDROID_HOME\platform-tools\adb.exe" install -r '.\output\android\notescale-release.apk'
```

En présence de plusieurs appareils, sélectionner explicitement celui voulu avec
`adb -s <identifiant>`. Aucun émulateur n'est requis pour produire les fichiers.

Vérifier : démarrage sans Metro, navigation, exercices, lecture audio, sauvegarde
de progression après redémarrage et fonctionnement hors ligne. Ces contrôles
restent à effectuer sur appareil ; les signatures ne les remplacent pas.

Le manifeste compilé conserve les permissions de la configuration Expo actuelle,
notamment `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`, le service de lecture en
arrière-plan et les permissions de stockage limitées à Android API 32. Cette
compilation ne les modifie pas. Revoir leur nécessité avant publication : la
présence d'une permission déclarée ne prouve pas que l'application l'utilise.

Si Android refuse une mise à jour pour signature incompatible, ne pas désinstaller
l'application automatiquement : une désinstallation supprime ses données
locales. Identifier d'abord la signature de la version installée.

## APK local et Google Play : deux signatures possibles

L'APK local est signé directement avec la clé sauvegardée. L'AAB utilise cette
même clé lors du téléversement. Avec Play App Signing, Google peut ensuite signer
les APK distribués avec une **autre clé de signature d'application**, distincte
de la clé de téléversement.

Dans ce cas, APK local et installation provenant de Google Play ne peuvent pas
se remplacer directement comme mises à jour. Pour utiliser la même signature
entre canaux, choisir cette stratégie lors de la configuration Play App Signing,
avant publication. La clé de téléversement peut faire l'objet d'une procédure de
réinitialisation chez Google ; cela ne change pas la signature des applications
déjà distribuées. Voir [Android : signature et Play App Signing](https://developer.android.com/studio/publish/app-signing).

## Erreurs courantes

- **`pwsh` introuvable** : installer PowerShell 7 ; Windows PowerShell 5.1 ne
  satisfait pas le prérequis du script.
- **`JAVA_HOME` invalide** : pointer vers la racine du JDK 17, pas son dossier
  `bin` et pas un simple JRE.
- **SDK ou Build Tools introuvables** : vérifier `ANDROID_HOME` et la présence de
  `build-tools/36.0.0/apksigner.bat`.
- **Licence ou composant Android manquant** : utiliser le gestionnaire SDK
  Android Studio ou `sdkmanager` de l'installation locale ; installer la version
  demandée et traiter les licences, puis relancer la même commande npm.
- **Signature manquante ou incorrecte** : restaurer la sauvegarde d'origine ; ne
  pas changer de clé et ne pas retirer les vérifications.
- **Échec après une mise à niveau Expo/React Native** : vérifier les nouvelles
  exigences SDK et du template avant de modifier Gradle ou les outils. Le
  template et les scripts doivent rester compatibles.

Cette procédure n'utilise pas `eas build --local` : Expo ne prend pas officiellement
en charge les compilations EAS locales sous Windows. Le couple Prebuild et Gradle
local évite cette limitation. [Limites EAS local](https://docs.expo.dev/build-reference/local-builds/)
