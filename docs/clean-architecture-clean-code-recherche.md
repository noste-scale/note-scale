# Clean Code et Clean Architecture — recherche et synthèse

Recherche en ligne : **31 octobre 2026**. Sources primaires : auteurs, éditeurs et dépôts des projets. Synthèse pratique identifiée comme telle ; aucune analyse du code de NoteScale réalisée.

## 1. Différence essentielle

| Sujet | Question pratique | Échelle principale |
| --- | --- | --- |
| Clean Code | Un autre développeur comprend-il et modifie-t-il ce code facilement ? | Noms, fonctions, modules, tests |
| Clean Architecture | Une modification technique oblige-t-elle à réécrire les règles métier ? | Frontières et dépendances entre composants |

Distinction pédagogique, pas séparation absolue : conception locale et architecture se renforcent. Les livres couvrent respectivement lisibilité, fonctions et nettoyage, puis principes de conception, frontières, règles métier et détails techniques. [Sommaire officiel Clean Code](https://www.pearson.com/en-us/subject-catalog/p/clean-code-a-handbook-of-agile-software-craftsmanship-2nd-edition/P200000013239/9780135398548), [sommaire officiel Clean Architecture](https://www.informit.com/store/clean-architecture-a-craftsmans-guide-to-software-structure-9780134494333).

## 2. Clean Code : intention lisible, complexité maîtrisée

Dans l’extrait officiel de la deuxième édition, Robert C. Martin recommande des éléments petits, correctement nommés, organisés et ordonnés. Une fonction porte un verbe décrivant son action ; la succession des appels doit rendre le traitement compréhensible. Le lecteur cible reste quelqu’un qui ne connaît pas encore le code. **Martin précise que ces principes sont des guides contextuels, pas des lois strictes.** [First Principles, 24 février 2026](https://www.informit.com/articles/article.aspx?p=3222335).

La responsabilité unique concerne les raisons de changement : regrouper les éléments modifiés pour les mêmes raisons, séparer ceux dépendant de préoccupations différentes. Pas une instruction imposant « une méthode par classe ». [Martin — Single Responsibility Principle](https://blog.cleancoder.com/uncle-bob/2014/05/08/SingleReponsibilityPrinciple.html).

**Limite reconnue par l’auteur :** davantage de modules et d’indirections ajoute une charge cognitive. Le bénéfice attendu doit compenser ce coût. Une multiplication de microfonctions n’est donc pas une preuve de qualité. La dernière phrase constitue notre déduction pratique. [Martin — A Final Thought](https://www.informit.com/articles/article.aspx?p=3222335&seqNum=3).

## 3. Clean Architecture : protéger les règles métier

Règle centrale : **les dépendances source pointent vers le métier**. Le cœur ignore les types spécifiques aux technologies externes. [Martin — The Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html).

Les quatre zones illustratives :

| Zone | Contenu |
| --- | --- |
| Entités | Règles générales ; objets ou fonctions |
| Cas d’usage | Actions applicatives et orchestration |
| Adaptateurs | Traduction des formats externes |
| Frameworks et pilotes | Interface, base, intégrations |

Quatre cercles schématiques, pas quatre dossiers obligatoires. Le flux d’exécution peut traverser une frontière dans l’autre sens ; l’inversion de dépendance préserve la règle source. Objectif : tester le métier sans infrastructure. [Article original](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html).

### Parenté avec l’architecture hexagonale

Cockburn place l’application à l’intérieur, les technologies à l’extérieur. Les ports décrivent les interactions utiles ; les adaptateurs traduisent les particularités techniques. Une même application devient pilotable par interface utilisateur, programme ou test automatisé, sans dépendre de leur mécanisme. Clean Architecture reprend cet objectif d’isolation tout en distinguant notamment entités et cas d’usage. [Cockburn — article original Ports and Adapters, 2005](https://alistair.cockburn.us/hexagonal-architecture), [Martin — origines de Clean Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html).

## 4. Ce que ces approches ne justifient pas

- **Abstraction pour un besoin imaginaire :** YAGNI recommande de ne pas construire aujourd’hui une capacité supposée nécessaire demain. Cela n’interdit ni tests ni refactorings : ils rendent les évolutions possibles. [Fowler — Yagni](https://martinfowler.com/bliki/Yagni.html).
- **Framework d’injection imposé :** Fowler distingue la configuration des dépendances de leur utilisation ; le choix d’outil reste secondaire. Pour une petite application, l’assemblage en code peut être plus clair qu’une configuration séparée. **Déduction pratique :** passer une fonction ou un objet en paramètre peut suffire ; ajouter un conteneur seulement si son bénéfice apparaît. [Fowler — Dependency Injection](https://martinfowler.com/articles/injection.html).
- **Microservices obligatoires :** les frontières logiques et le découpage de déploiement répondent à des décisions différentes. Fowler souligne le surcoût des microservices et l’intérêt fréquent d’un départ monolithique, sans présenter cela comme une loi universelle. [Fowler — Monolith First](https://martinfowler.com/bliki/MonolithFirst.html).
- **Interface pour chaque classe, repository pour chaque table, DTO entre toutes les fonctions :** aucune obligation générale retenue ici. Recommandation de synthèse : introduire ces mécanismes à une frontière utile, pas pour reproduire une arborescence modèle.

## 5. Dépôts GitHub : enseignements et précautions

### clean-code-javascript — le dépôt demandé

[ryanmcdermott/clean-code-javascript](https://github.com/ryanmcdermott/clean-code-javascript) adapte Clean Code à JavaScript ; recommandations non universelles, pas norme.

Sa [section Variables](https://github.com/ryanmcdermott/clean-code-javascript#variables) conseille noms explicites, prononçables, recherchables ; vocabulaire stable ; variables intermédiaires utiles ; contexte non répété. Exemple personnel : `durationMs` plutôt que `d`.

Autres thèmes : fonctions ciblées, effets de bord maîtrisés, code mort supprimé, erreurs prises en charge, tests et formatage automatisé. **Lecture critique :** quota de paramètres, suppression de conditions ou de contrôles de types ne sont pas des obligations. Conserver la validation des entrées externes.

### clean-code-typescript — adaptation au typage statique

[labs42io/clean-code-typescript](https://github.com/labs42io/clean-code-typescript), inspiré du précédent, ajoute notamment `readonly`, `ReadonlyArray` et des recommandations de typage. Utile comme catalogue d’exemples, pas comme autorité sur le langage.

**Contre-vérification avec la documentation officielle :** les annotations de types ne valident rien à l’exécution ; la documentation recommande aussi de laisser l’inférence éviter les annotations redondantes. `readonly` ne gèle pas les objets et ne garantit pas leur immutabilité profonde. Une réponse réseau reste à valider avant usage. Cette dernière phrase est notre conséquence pratique. [TypeScript — types effacés et inférence](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#erased-types), [TypeScript — readonly](https://www.typescriptlang.org/docs/handbook/2/objects.html#readonly-properties).

### frontend-clean-architecture — exemple React et TypeScript

[bespoyasov/frontend-clean-architecture](https://github.com/bespoyasov/frontend-clean-architecture) illustre une approche plutôt fonctionnelle. Son README reconnaît deux compromis : accès à l’horloge depuis le domaine et cas d’usage encore dépendant de React. L’auteur décrit comment extraire le cas d’usage du hook et lui passer ses services. Exemple pédagogique à étudier avec ses limites, pas modèle irréprochable à copier.

### CleanArchitecture — exemple côté serveur .NET

[ardalis/CleanArchitecture](https://github.com/ardalis/CleanArchitecture) propose un point de départ ASP.NET Core, avec variantes complète et minimale. Intérêt pédagogique : comparer organisation et frontières. **Notre recommandation :** ne pas importer mécaniquement son outillage ni ses conventions dans un projet JavaScript ou mobile.

### DRY sans abstraction prématurée

Sandi Metz montre comment une extraction initialement utile devient difficile à comprendre lorsque chaque nouveau besoin ajoute paramètres et conditions. Elle conseille de pouvoir revenir à la duplication pour redécouvrir une meilleure séparation. [The Wrong Abstraction](https://sandimetz.com/blog/2016/1/20/the-wrong-abstraction).

**Synthèse :** mutualiser une même règle métier qui doit évoluer ensemble ; ne pas fusionner deux traitements uniquement parce que leur code se ressemble aujourd’hui.

## 6. Application minimale — synthèse pratique

Ordre conseillé, sans migration systématique :

1. Noms métier explicites et déroulement lisible.
2. Règles métier isolées des effets externes quand cela facilite compréhension ou test.
3. Un test reproductible pour chaque logique non triviale.
4. Contrats limités aux dépendances qui ont réellement besoin d’une frontière.
5. Abstractions supplémentaires seulement devant une difficulté observée.

Pour une application d’apprentissage musical, **exemple hypothétique, pas constat sur NoteScale** : calculer les notes d’une gamme relève du métier ; afficher une animation relève de l’interface ; persister une progression relève d’un adaptateur. Un calcul pur ne nécessite pas une classe, une interface et un repository.

**Critère de réussite :** moins de choses à comprendre pour modifier correctement un comportement ; pas davantage de dossiers portant des noms architecturaux.
