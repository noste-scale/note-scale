# Cahier des charges — Application mobile d’apprentissage des gammes musicales

## 1. Nom provisoire

**Gamme Facile**

## 2. Objectif de l’application

Créer une application mobile simple permettant à un débutant de :

- comprendre comment construire une gamme majeure ;
- mémoriser la formule des tons et demi-tons ;
- apprendre toutes les gammes majeures ;
- s’entraîner avec des notes de départ aléatoires ;
- recevoir une correction claire ;
- suivre sa progression.

L’application doit partir d’un principe simple : l’utilisateur ne doit pas apprendre chaque gamme par cœur séparément. Il doit comprendre la règle permettant de reconstruire n’importe quelle gamme.

## 3. Public cible

L’application est destinée :

- aux débutants en musique ;
- aux personnes apprenant le piano, la guitare ou le chant ;
- aux personnes qui ne maîtrisent pas encore les dièses et les bémols ;
- aux utilisateurs souhaitant s’entraîner quelques minutes par jour.

## 4. Principe pédagogique principal

La règle principale à enseigner est :

**Ton – Ton – Demi-ton – Ton – Ton – Ton – Demi-ton**

Notation courte :

**T – T – ½ – T – T – T – ½**

L’application doit également enseigner les deux règles suivantes :

### Demi-tons naturels

Les notes naturellement séparées par un demi-ton sont :

- Mi → Fa
- Si → Do

Phrase de mémorisation :

**Mi-Fa et Si-Do sont collés.**

### Ordre des notes

Chaque gamme doit utiliser chaque nom de note une seule fois.

Exemple pour Ré :

Ré – Mi – Fa – Sol – La – Si – Do – Ré

Ensuite, l’application ajoute les dièses ou les bémols nécessaires pour respecter la formule.

Résultat :

Ré – Mi – Fa♯ – Sol – La – Si – Do♯ – Ré

## 5. Plateformes

Le produit doit exister sous deux formes :

- une application mobile pour Android et iOS ;
- une application web responsive accessible depuis un navigateur moderne, sur ordinateur et mobile.

### Application mobile

Technologie recommandée :

- React Native ;
- Expo ;
- TypeScript.

### Application web

Technologie obligatoire :

- React ;
- Vite ;
- TypeScript.

L’application web doit être un site statique, sans serveur ni API obligatoire dans le MVP, afin d’être déployable gratuitement sur GitHub Pages. Elle doit fournir les mêmes parcours essentiels que l’application mobile : apprentissage, consultation des gammes, exercices et progression locale.

Les deux applications doivent fonctionner hors ligne après le premier chargement lorsque le navigateur le permet. Aucun compte utilisateur ne doit être obligatoire dans la première version.

## 6. Fonctionnalités principales

### 6.1 Écran d’accueil

L’écran d’accueil doit afficher :

- le nom de l’application ;
- une courte phrase d’introduction ;
- un bouton « Apprendre » ;
- un bouton « Toutes les gammes » ;
- un bouton « Exercices » ;
- un bouton « Ma progression ».

Texte d’introduction proposé :

« Apprends à construire toutes les gammes majeures avec une seule formule. »

### 6.2 Section « Apprendre »

Cette section doit expliquer progressivement les bases.

#### Leçon 1 : les notes

Afficher les sept noms de notes :

Do – Ré – Mi – Fa – Sol – La – Si

Afficher également la notation internationale :

- Do = C
- Ré = D
- Mi = E
- Fa = F
- Sol = G
- La = A
- Si = B

#### Leçon 2 : ton et demi-ton

Expliquer :

- un demi-ton correspond au plus petit déplacement entre deux notes ;
- un ton correspond à deux demi-tons ;
- sur un piano, il faut compter toutes les touches, blanches et noires.

Afficher un petit clavier de piano interactif.

Exemples :

- Mi → Fa = demi-ton ;
- Si → Do = demi-ton ;
- Do → Ré = ton ;
- Ré → Mi = ton.

#### Leçon 3 : formule de la gamme majeure

Afficher clairement :

**T – T – ½ – T – T – T – ½**

Présenter la formule en deux groupes pour faciliter la mémorisation :

**T – T – ½ | T – T – T – ½**

Phrase de mémorisation :

« Deux tons, un demi-ton, puis trois tons et un demi-ton. »

#### Leçon 4 : exemple avec Do majeur

Afficher :

Do – Ré – Mi – Fa – Sol – La – Si – Do

Détailler les intervalles :

- Do → Ré = ton
- Ré → Mi = ton
- Mi → Fa = demi-ton
- Fa → Sol = ton
- Sol → La = ton
- La → Si = ton
- Si → Do = demi-ton

Préciser que Do majeur ne contient aucun dièse ni bémol.

#### Leçon 5 : exemple avec Ré majeur

Afficher d’abord les noms naturels :

Ré – Mi – Fa – Sol – La – Si – Do – Ré

Puis appliquer les intervalles un par un :

- Ré → Mi = ton
- Mi → Fa naturel = demi-ton, alors qu’il faut un ton
- Fa devient donc Fa♯
- Fa♯ → Sol = demi-ton
- Sol → La = ton
- La → Si = ton
- Si → Do naturel = demi-ton, alors qu’il faut un ton
- Do devient donc Do♯
- Do♯ → Ré = demi-ton

Résultat :

Ré – Mi – Fa♯ – Sol – La – Si – Do♯ – Ré

### 6.3 Section « Toutes les gammes »

Afficher les gammes majeures sous forme de cartes.

Chaque carte doit contenir :

- le nom français ;
- le nom international ;
- les notes de la gamme ;
- le nombre de dièses ou de bémols ;
- la liste des altérations ;
- un bouton pour écouter la gamme ;
- un bouton pour afficher la construction étape par étape.

Gammes à intégrer :

#### Sans altération

- Do majeur : Do – Ré – Mi – Fa – Sol – La – Si – Do

#### Gammes avec des dièses

- Sol majeur : Sol – La – Si – Do – Ré – Mi – Fa♯ – Sol
- Ré majeur : Ré – Mi – Fa♯ – Sol – La – Si – Do♯ – Ré
- La majeur : La – Si – Do♯ – Ré – Mi – Fa♯ – Sol♯ – La
- Mi majeur : Mi – Fa♯ – Sol♯ – La – Si – Do♯ – Ré♯ – Mi
- Si majeur : Si – Do♯ – Ré♯ – Mi – Fa♯ – Sol♯ – La♯ – Si
- Fa♯ majeur : Fa♯ – Sol♯ – La♯ – Si – Do♯ – Ré♯ – Mi♯ – Fa♯
- Do♯ majeur : Do♯ – Ré♯ – Mi♯ – Fa♯ – Sol♯ – La♯ – Si♯ – Do♯

Ordre des dièses à afficher :

**Fa – Do – Sol – Ré – La – Mi – Si**

#### Gammes avec des bémols

- Fa majeur : Fa – Sol – La – Si♭ – Do – Ré – Mi – Fa
- Si♭ majeur : Si♭ – Do – Ré – Mi♭ – Fa – Sol – La – Si♭
- Mi♭ majeur : Mi♭ – Fa – Sol – La♭ – Si♭ – Do – Ré – Mi♭
- La♭ majeur : La♭ – Si♭ – Do – Ré♭ – Mi♭ – Fa – Sol – La♭
- Ré♭ majeur : Ré♭ – Mi♭ – Fa – Sol♭ – La♭ – Si♭ – Do – Ré♭
- Sol♭ majeur : Sol♭ – La♭ – Si♭ – Do♭ – Ré♭ – Mi♭ – Fa – Sol♭
- Do♭ majeur : Do♭ – Ré♭ – Mi♭ – Fa♭ – Sol♭ – La♭ – Si♭ – Do♭

Ordre des bémols à afficher :

**Si – Mi – La – Ré – Sol – Do – Fa**

### 6.4 Fiche détaillée d’une gamme

Lorsqu’une gamme est sélectionnée, afficher :

- son nom ;
- ses notes ;
- son armure ;
- un clavier de piano avec les touches utilisées ;
- la formule des intervalles ;
- la construction étape par étape ;
- un bouton de lecture audio ;
- un bouton « Commencer un exercice sur cette gamme ».

Exemple d’affichage :

Ré → ton → Mi → ton → Fa♯ → demi-ton → Sol → ton → La → ton → Si → ton → Do♯ → demi-ton → Ré

Les tons et demi-tons doivent être visuellement différenciés.

### 6.5 Générateur de gamme

Créer un écran permettant à l’utilisateur de choisir une note de départ.

Exemples :

- Do
- Do♯
- Ré♭
- Ré
- Mi♭
- Mi
- Fa
- Fa♯
- Sol♭
- Sol
- La♭
- La
- Si♭
- Si

Après sélection, l’application doit construire la gamme majeure automatiquement.

L’utilisateur doit pouvoir avancer étape par étape.

À chaque étape, l’application affiche :

- la note actuelle ;
- l’intervalle à appliquer ;
- la prochaine note naturelle attendue ;
- l’altération nécessaire ;
- une explication simple.

### 6.6 Exercices aléatoires

Créer plusieurs types d’exercices.

#### Exercice 1 : compléter une gamme

Exemple :

Complète la gamme de Ré majeur :

Ré – Mi – ___ – Sol – La – Si – ___ – Ré

Réponse attendue :

Fa♯ et Do♯

#### Exercice 2 : construire toute la gamme

Question :

« Construis la gamme majeure de La. »

L’utilisateur sélectionne ou saisit les huit notes.

Réponse :

La – Si – Do♯ – Ré – Mi – Fa♯ – Sol♯ – La

#### Exercice 3 : identifier les altérations

Question :

« Quels sont les dièses de Mi majeur ? »

Réponse :

Fa♯, Do♯, Sol♯ et Ré♯

#### Exercice 4 : reconnaître l’intervalle

Question :

« Quel intervalle se trouve entre Mi et Fa ? »

Réponse :

Un demi-ton

#### Exercice 5 : trouver l’erreur

Afficher une gamme incorrecte :

Sol – La – Si – Do – Ré – Mi – Fa – Sol

Demander à l’utilisateur de trouver l’erreur.

Correction :

Fa doit devenir Fa♯.

### 6.7 Mode entraînement quotidien

Créer une session quotidienne courte contenant :

- un rappel de la formule ;
- une question sur les demi-tons naturels ;
- trois gammes aléatoires ;
- une correction à la fin.

La durée cible doit être comprise entre trois et cinq minutes.

L’application doit éviter de donner immédiatement la réponse.

L’utilisateur doit d’abord valider sa proposition, puis voir :

- la bonne réponse ;
- son erreur ;
- une explication ;
- la règle à retenir.

### 6.8 Progression

Enregistrer localement :

- le nombre d’exercices réalisés ;
- le nombre de bonnes réponses ;
- le pourcentage de réussite ;
- les gammes maîtrisées ;
- les gammes à revoir ;
- le nombre de jours consécutifs d’entraînement.

Une gamme peut être considérée comme maîtrisée après plusieurs réponses correctes, par exemple cinq réussites sur six exercices récents.

### 6.9 Révision intelligente

Les gammes avec lesquelles l’utilisateur fait le plus d’erreurs doivent apparaître plus souvent.

Exemple :

Si l’utilisateur se trompe souvent sur Mi♭ majeur, cette gamme doit revenir plus fréquemment dans les prochains exercices.

Utiliser une logique simple de répétition espacée :

- erreur : revoir rapidement ;
- une bonne réponse : revoir plus tard ;
- plusieurs bonnes réponses : espacer davantage la révision.

### 6.10 Audio

Chaque note et chaque gamme doivent pouvoir être écoutées.

Prévoir :

- lecture ascendante ;
- lecture descendante ;
- lecture lente ;
- lecture normale ;
- bouton pause ;
- bouton recommencer.

L’audio peut être produit avec des fichiers de notes de piano ou un moteur audio compatible avec React Native.

## 7. Interface utilisateur

L’interface doit être :

- simple ;
- adaptée aux débutants ;
- lisible ;
- peu chargée ;
- utilisable sur de petits écrans.

Éviter de présenter trop d’informations simultanément.

Utiliser principalement :

- des cartes ;
- des boutons larges ;
- des textes courts ;
- des schémas ;
- un clavier de piano visuel ;
- des animations légères.

Prévoir un mode clair et un mode sombre.

## 8. Navigation

Utiliser une navigation principale avec quatre onglets :

1. Accueil
2. Apprendre
3. Exercices
4. Progression

La liste des gammes peut être accessible depuis l’accueil et la section Apprendre.

## 9. Structure technique recommandée

Utiliser un monorepo TypeScript minimal afin de partager la logique musicale sans dupliquer le code :

- apps/mobile : React Native, Expo et Expo Router ;
- apps/web : React, Vite et React Router ;
- packages/music : types, données des gammes, générateur et tests purs TypeScript.

Utiliser au besoin :

- React Context ou Zustand pour l’état local ;
- AsyncStorage côté mobile et localStorage côté web pour la progression ;
- Web Audio API côté web et une solution audio compatible Expo côté mobile ;
- CSS responsive côté web ;
- une solution de routage compatible GitHub Pages côté web, par exemple HashRouter, pour éviter les erreurs 404 lors d’un rechargement de page.

Structure cible :

```text
apps/
  mobile/
    app/
    components/
  web/
    src/
      pages/
      components/
      styles/
      main.tsx
      App.tsx
packages/
  music/
    src/
      notes.ts
      majorScales.ts
      scaleGenerator.ts
      exerciseGenerator.ts
      musicTheory.ts
      types.ts
    tests/
_bmad-output/
```

La logique musicale doit rester indépendante de React, afin que les applications mobile et web produisent les mêmes réponses pour une même gamme ou un même exercice.

### Déploiement GitHub Pages

L’application web doit :

- utiliser le base Vite correspondant au nom du dépôt GitHub ;
- produire un build statique avec npm run build ;
- être déployée automatiquement depuis la branche main via GitHub Actions ;
- publier le dossier apps/web/dist avec l’action officielle GitHub Pages ;
- ne dépendre d’aucune variable secrète ni service backend pour fonctionner.

## 10. Modèle de données

Créer un type représentant une note :

```typescript
type Accidental = "sharp" | "flat" | "natural";

interface MusicalNote {
  frenchName: string;
  internationalName: string;
  accidental: Accidental;
  displayName: string;
  semitone: number;
}
```

Créer un type représentant une gamme :

```typescript
interface MajorScale {
  id: string;
  frenchName: string;
  internationalName: string;
  tonic: string;
  notes: string[];
  accidentals: string[];
  accidentalType: "sharp" | "flat" | "none";
  keySignatureCount: number;
}
```

Créer un type représentant un exercice :

```typescript
interface Exercise {
  id: string;
  type:
    | "complete-scale"
    | "build-scale"
    | "find-accidentals"
    | "identify-interval"
    | "find-error";
  question: string;
  correctAnswer: string[];
  explanation: string;
  scaleId?: string;
}
```

## 11. Logique de génération d’une gamme

La génération doit utiliser les positions chromatiques suivantes :

```text
Do = 0
Do♯ / Ré♭ = 1
Ré = 2
Ré♯ / Mi♭ = 3
Mi = 4
Fa = 5
Fa♯ / Sol♭ = 6
Sol = 7
Sol♯ / La♭ = 8
La = 9
La♯ / Si♭ = 10
Si = 11
```

La formule en demi-tons est :

```text
2 – 2 – 1 – 2 – 2 – 2 – 1
```

Cependant, l’algorithme ne doit pas seulement trouver les bonnes hauteurs. Il doit aussi respecter l’écriture musicale.

Par exemple, dans Fa♯ majeur, utiliser Mi♯ et non Fa naturel, car chaque nom de note doit apparaître une seule fois.

## 12. Contenu du MVP

La première version doit obligatoirement contenir :

- les leçons de base ;
- les gammes majeures ;
- la formule T – T – ½ – T – T – T – ½ ;
- les exemples de Do majeur et Ré majeur ;
- le clavier de piano visuel ;
- la fiche détaillée de chaque gamme ;
- les exercices aléatoires ;
- la correction expliquée ;
- le suivi local de progression ;
- le fonctionnement hors ligne ;
- l’application web React déployable sur GitHub Pages ;
- une progression web enregistrée localement.

## 13. Fonctionnalités futures

Prévoir une architecture permettant d’ajouter plus tard :

- les gammes mineures naturelles ;
- les gammes mineures harmoniques ;
- les gammes mineures mélodiques ;
- les modes musicaux ;
- les accords construits sur chaque degré ;
- les exercices d’oreille ;
- la reconnaissance de notes au microphone ;
- les notifications quotidiennes ;
- la synchronisation avec un compte utilisateur ;
- plusieurs langues ;
- un mode guitare ;
- un mode solfège sur portée.

## 14. Critères d’acceptation

L’application sera considérée comme fonctionnelle si :

- elle démarre correctement sur Android et iOS ;
- l’application React démarre et fonctionne dans un navigateur moderne ;
- l’utilisateur peut consulter toutes les gammes majeures ;
- chaque gamme affichée contient les bonnes notes ;
- l’utilisateur peut écouter une gamme ;
- l’utilisateur peut faire des exercices aléatoires ;
- les corrections expliquent les erreurs ;
- la progression est conservée après fermeture de l’application ;
- l’application fonctionne sans connexion Internet ;
- la version web peut être construite avec npm run build sans erreur ;
- la version web est accessible sur GitHub Pages, y compris après rechargement d’une route ;
- les dièses et les bémols sont correctement affichés ;
- le générateur respecte les noms de notes et les règles d’écriture musicale.

## 15. Instructions de réalisation pour Codex

Créer un monorepo TypeScript avec une application Expo React Native dans apps/mobile, une application React Vite dans apps/web et une logique musicale partagée dans packages/music.

Travailler par étapes :

1. créer le monorepo et l’architecture partagée ;
2. créer les types TypeScript et la base de données locale des gammes majeures ;
3. créer et tester le moteur commun de génération des gammes ;
4. créer l’application web React responsive ;
5. créer l’application mobile Expo ;
6. créer les écrans d’accueil et d’apprentissage ;
7. créer la liste et les fiches des gammes ;
8. créer le clavier de piano ;
9. créer le générateur d’exercices et le système de correction ;
10. créer le suivi local de progression pour le web et le mobile ;
11. ajouter l’audio adapté à chaque plateforme ;
12. configurer le build Vite et le déploiement GitHub Pages ;
13. vérifier l’accessibilité, l’affichage mobile et le rechargement des routes GitHub Pages.

Pour chaque étape :

- produire du code propre et typé ;
- éviter la duplication ;
- séparer la logique musicale de l’interface ;
- partager les tests de la logique musicale entre les deux applications ;
- ne pas ajouter de backend, authentification ou dépendance complexe sans besoin explicite.

Fournir les commandes nécessaires pour installer les dépendances, lancer les applications mobile et web, exécuter les tests, construire la version web et déployer GitHub Pages.