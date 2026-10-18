# NoteScale — préparation Google Play

État : **préparation de publication, pas une soumission ni une garantie d'acceptation**.
Sources officielles consultées le 18 octobre 2026. Recontrôler les exigences et
les réponses dans Play Console au moment de l'envoi. Aucun compte Play Console
consulté, aucun formulaire envoyé, aucune application publiée sur Google Play.
La publication de la politique sur GitHub Pages a été autorisée par l'utilisateur.

## Décisions encore nécessaires

- Nom public de l'éditeur : **sanrandry** (compte GitHub authentifié, choisi par l'utilisateur).
- Adresse e-mail publique d'assistance/confidentialité : **sinrandry@gmail.com** (fournie par l'utilisateur).
- Type et date de création du compte développeur, vérifications d'identité et
  accès à la production : inconnus.
- Public d'âge réellement visé, pays de distribution et prix : à décider.
  « Débutant » ne définit pas un âge. Ne pas exclure artificiellement les enfants
  pour éviter les règles Familles ; ne pas les sélectionner sans vérifier ces règles.
- Identité du package : `app.notescale.mobile`, à conserver. Dernier
  `versionCode` déjà utilisé dans Play Console : inconnu.
- Choix de la clé Play App Signing : à confirmer avant première publication.
  Conserver la clé locale ; ne jamais la régénérer ou désinstaller l'application
  pour contourner une signature incompatible. Voir
  [procédure de signature locale](D:/Projets/Perso/NoteScale/docs/build-android.md).

La catégorie proposée est **Enseignement**, type **Application**, langue
**français (France)**. Choix éditoriaux à confirmer, non saisis dans Console.
Le contenu éducatif ne dispense pas de répondre au questionnaire de
classification. Une cible enfant impose une vérification spécifique des
[règles Familles](https://support.google.com/googleplay/android-developer/answer/9893335?hl=fr).

## Fiche française proposée

### Nom

```text
NoteScale
```

### Brève description

```text
Comprendre les gammes majeures avec des leçons, un piano et des exercices
```

### Description complète

```text
Pourquoi Ré majeur contient-il un Fa dièse ? NoteScale aide à comprendre la construction des gammes majeures plutôt qu'à mémoriser une liste de notes.

UN PARCOURS POUR DÉBUTER
Découvre les noms des notes, les tons et demi-tons, puis la formule de la gamme majeure. Reprends la dernière leçon ouverte et avance à ton rythme.

CONSTRUIRE ET ÉCOUTER
Explore 15 gammes majeures, leurs notes et leurs altérations. Le générateur détaille les sept étapes de construction. Écoute les notes, utilise le clavier de piano et adapte la vitesse de lecture.

S'ENTRAÎNER
Complète une gamme, construis-la, repère ses altérations, reconnais un intervalle ou trouve une erreur. Chaque correction fournit une explication. Une session quotidienne propose un entraînement court.

SUIVRE SES RÉPONSES
Consulte ta progression et les gammes à réviser. Les résultats, la dernière leçon ouverte et le choix du thème sont enregistrés sur ton appareil.

Les leçons, exercices et sons fonctionnent sans connexion après installation. Aucun compte NoteScale n'est nécessaire. L'application ne propose ni reconnaissance au microphone ni synchronisation de compte ; les mécanismes de sauvegarde et de transfert Android peuvent toutefois s'appliquer selon les réglages du téléphone.

Interface en français, notation française et internationale, thèmes clair et sombre. NoteScale porte sur les gammes majeures ; les gammes mineures et les tonalités nécessitant des doubles altérations ne sont pas incluses.
```

Limites vérifiées : nom ≤30 caractères, description courte ≤80, complète ≤4 000.
L'adresse d'assistance est obligatoire : ne pas soumettre une adresse fictive.
[Configuration officielle de la fiche](https://support.google.com/googleplay/android-developer/answer/9859152?hl=en-EN).

### Notes de première version Play proposées

```text
<fr-FR>
Apprentissage des gammes majeures : leçons guidées, construction étape par étape, écoute et piano, exercices et progression locale.
</fr-FR>
```

À adapter s'il existe déjà une publication Play. Ne pas présenter une ancienne
publication GitHub comme une première publication Play vérifiée. Notes limitées
à 500 caractères par langue selon le
[guide des versions](https://support.google.com/googleplay/android-developer/answer/9859348?hl=fr).

## Visuels

| Élément | État |
| --- | --- |
| Icône Play | Préparée : `D:/Projets/Perso/NoteScale/output/google-play/icon-512.png`, PNG RGBA 512×512, 17 277 octets. Redimensionnement de l'icône existante, sans changement graphique. |
| Image de présentation | **Manquante**. Préparer 1 024×500, JPEG ou PNG sans alpha, fidèle à l'application. |
| Captures téléphone | **À sélectionner/formater après le build final**. Au moins deux vues réelles ; accueil, construction et exercice sont des sujets utiles. |
| Captures tablette | À produire si cette expérience est annoncée ; pas de validation tablette actuellement attestée ici. |
| Vidéo | Facultative ; aucune préparée. |

Les captures doivent représenter le produit, pas Expo Go ni une maquette. Les
captures Pixel 1 008×2 244 ont un rapport supérieur à 2 : ne pas les importer
brutes. Utiliser un format conforme sans étirer l'interface ou inventer de
fonctionnalités. Vérifier absence de notifications privées et texte alternatif.
Exigences : PNG/JPEG sans alpha, côtés entre 320 et 3 840 px, grand côté au plus
deux fois le petit. L'icône Play doit avoir un canal alpha, mesurer 512×512 et
peser au plus 1 024 Ko.
[Exigences officielles des assets](https://support.google.com/googleplay/android-developer/answer/9866151?hl=fr).

## Sécurité des données — réponses de travail, pas certification

### Faits constatés dans le code

- Les résultats d'exercices, le signet de leçon et le thème utilisent AsyncStorage.
  Sources : `apps/mobile/src/progress.tsx` et `apps/mobile/src/theme.tsx`.
- Aucun backend, compte, paiement, publicité ou SDK d'analytics déclaré dans les
  dépendances applicatives directes inspectées. Aucun appel réseau applicatif
  direct trouvé lors de cette inspection ciblée.
- Les 24 échantillons audio sont synthétisés localement par
  `scripts/generate-audio.ts`, sans enregistrement tiers. Lecture uniquement.
- Ce constat ne remplace pas l'examen des dépendances transitives, de leur
  configuration native et du trafic du **build de production final**.

La définition Play couvre aussi les transmissions effectuées par les SDK.
Le traitement strictement sur l'appareil n'est pas une collecte à déclarer.
La déclaration doit couvrir toutes les versions pertinentes distribuées,
pas uniquement le code JavaScript parcouru.
[Guide officiel Sécurité des données](https://support.google.com/googleplay/android-developer/answer/10787469?hl=fr).

| Question | Réponse de travail / action |
| --- | --- |
| Collecte ou partage de données utilisateur par l'application ? | **« Non » envisagé, non attesté définitivement**. Confirmer après vérification SDK, bundle et flux réels. Toute transmission découverte impose de préciser types, finalités et destinataires. |
| Création de compte dans l'application ? | **Non** pour le code actuel. Aucun compte NoteScale à supprimer. |
| Annonces ? | **Non** pour les fonctionnalités et dépendances directes inspectées ; confirmer le binaire final avant déclaration. |
| Identifiant publicitaire ? | Aucun usage applicatif trouvé. Vérifier absence de permission/SDK correspondants dans le manifeste final. |
| Chiffrement en transit ? | Ne pas cocher « Oui » par défaut. Suivre les questions effectivement affichées après déclaration de collecte ; l'absence de flux ne prouve pas un chiffrement. |
| Suppression des données ? | Effacement du stockage de NoteScale dans les réglages Android supprime la copie locale. Ne pas promettre de suppression distante par l'éditeur ou des sauvegardes système. |
| Audit de sécurité indépendant / badge Familles ? | **Non attesté**. Ne pas cocher sur la base des tests du dépôt. |
| Politique de confidentialité ? | URL publique finale à vérifier et à saisir ; texte/lien accessible dans l'app. Identité et contact réels requis. |

### Sauvegarde Android : formulation exacte

Le manifeste natif inspecté autorise `android:allowBackup="true"`. Android peut
donc sauvegarder ou transférer les données de l'application selon la version du
système, le constructeur et les réglages utilisateur. Cela ne constitue pas
un service de synchronisation exploité par NoteScale, ni une preuve de collecte
par l'éditeur. Ne pas écrire « les données ne quittent jamais le téléphone ».
L'effacement local ne garantit pas l'effacement de toutes les copies système ;
une restauration ultérieure peut récupérer une sauvegarde. Vérifier le
manifeste du nouveau build si ce réglage change.
[Documentation Android Auto Backup](https://developer.android.com/identity/data/autobackup).

La politique doit expliquer les pratiques réelles et rester disponible à une
URL publique, active, sans restriction géographique, non modifiable par le
visiteur, hors PDF. Elle doit identifier l'app/l'éditeur, fournir un contact et
expliquer conservation et suppression ; elle reste requise sans collecte.
[Règle officielle Données utilisateur](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en).

Texte intégré hors ligne : `D:/Projets/Perso/NoteScale/apps/mobile/app/privacy.tsx`,
accessible via **Accueil → Confidentialité**. Version HTML identique :
`D:/Projets/Perso/NoteScale/apps/web/public/privacy.html`.
URL prévue après déploiement du site :
`https://noste-scale.github.io/note-scale/privacy.html`.
Le commit `b5d6d961e93d1dc8edeed5a6247e8a77234eafb2` publie uniquement cette page
via le workflow Pages. Ne pas saisir cette URL dans Console avant d'avoir
vérifié la réussite du déploiement et son accessibilité publique.

## Checklist avant tout envoi

- [ ] Identité éditeur, contact public et politique finalisés ; URL vérifiée depuis un navigateur non connecté.
- [ ] Public cible et classification complétés honnêtement, avec revue Familles si enfants visés.
- [ ] Fiche relue, prix/pays choisis, présentation et captures finales prêts.
- [ ] Formulaire Data Safety validé sur SDK et version release, déclarations annonces/accès cohérentes.
- [ ] AAB neuf signé, versionCode inédit, package conservé ; empreinte et signature vérifiées.
- [ ] Manifeste final inspecté ; permissions inutiles retirées, comportement réel conforme aux déclarations.
- [ ] Cible SDK vérifiée contre les [exigences Play courantes](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en).
- [ ] Bibliothèques natives et APK issus du bundle vérifiés pour les [pages mémoire 16 Ko](https://developer.android.com/guide/practices/page-sizes).
- [ ] Alertes de sécurité des dépendances réévaluées ; pas de conclusion basée sur un audit ancien de la version 1.0.1.
- [ ] Tests, typage, lint réussis ; lancement sans Metro, mode hors ligne, audio, navigation, sauvegarde/reprise vérifiés sur le build final.
- [ ] Stratégie Play App Signing confirmée ; sauvegarde chiffrée de la clé locale conservée.
- [ ] Compte vérifié, accès à la production et exigences de test contrôlés dans Console.
- [ ] Avec autorisation de publication distincte : test interne, rapport de pré-lancement, corrections, puis piste adaptée.
- [ ] Avant soumission : vérifier les avertissements Console, ne pas interpréter un import réussi comme une approbation.

Pour les comptes **personnels créés après le 13 novembre 2023**, la règle
consultée exige un test fermé avec au moins **12 testeurs inscrits sans
interruption pendant 14 jours**, puis une demande d'accès à la production.
Le test sur un Pixel et les tests automatisés ne remplacent pas ce parcours.
Applicabilité à ce compte encore inconnue.
[Exigences officielles des nouveaux comptes personnels](https://support.google.com/googleplay/android-developer/answer/14151465?hl=FR).

## Contrôle reproductible des livrables préparés

Depuis `D:/Projets/Perso/NoteScale`, avec le module `sharp` déjà fourni par le
runtime local (aucune dépendance ajoutée au projet) :

```powershell
@'
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const sharp = require('C:/Users/Best/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
(async () => {
  const file = 'output/google-play/icon-512.png';
  const meta = await sharp(file).metadata();
  assert.equal(meta.format, 'png');
  assert.equal(meta.width, 512); assert.equal(meta.height, 512);
  assert.equal(meta.channels, 4); assert.equal(meta.depth, 'uchar');
  assert.equal(meta.hasAlpha, true);
  assert.ok((await fs.stat(file)).size <= 1024 * 1024);
  const doc = (await fs.readFile('docs/google-play.md', 'utf8')).replace(/\r\n/g, '\n');
  for (const [heading, maximum] of [['Nom', 30], ['Brève description', 80], ['Description complète', 4000]]) {
    const text = doc.split('### ' + heading + '\n')[1].split('```text\n')[1].split('\n```')[0];
    assert.ok([...text].length <= maximum, heading);
    console.log(heading + ': ' + [...text].length + '/' + maximum);
  }
  console.log('Icône et longueurs de fiche conformes aux contrôles locaux.');
})();
'@ | node
```

Ce contrôle ne certifie ni les droits de marque, ni les déclarations de données,
ni l'acceptation par Google Play.
