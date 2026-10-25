# Refonte Family Hub : iPad de cuisine + version téléphone

Date : 25.10.2026 · Auteur : Claude, d'après la conversation avec le propriétaire du foyer (audit UX du même jour).

## 1. Intention

Family Hub sert surtout **dans la cuisine (iPad mural)** et **sur les téléphones des deux parents**. Le hub PC n'est utilisé que par le propriétaire, pour préparer (plans, recettes, réglages) ; son côté « responsive » n'a pas d'importance.

Aujourd'hui :
- l'iPad affiche une grille de 10 cases réglée à la main, où l'essentiel (« quoi cuisiner ») est à l'étroit, à côté de tuiles peu utilisées ;
- les téléphones reçoivent la même grille en plus petit (2×4), illisible, et sont appairés comme des « écrans » en lecture seule : on ne peut rien cocher, on ne sait pas qui tient le téléphone ;
- la liste de courses ne se coche que dans Google Keep.

But : un iPad qui répond en un coup d'œil à « qu'est-ce qu'on cuisine » et sert de support pendant la cuisine, et un téléphone personnel qui gère les courses de bout en bout (même sans réseau), montre le menu et, plus tard, pilote le wifi du PC des enfants.

Family Hub doit pouvoir évoluer : la structure doit accueillir d'autres fonctions plus tard (le wifi du PC des enfants en premier).

## 2. Ordre des chantiers

1. **Socle commun** : le design system en un fichier partagé, l'ambiance jour/nuit qui remplace les 6 thèmes.
2. **Téléphone** : version téléphone du hub, connectée avec le compte Google de chacun ; Courses, Aujourd'hui, Semaine, Recettes.
3. **iPad** : nouveau tableau de cuisine + nouveau mode recette + minuteur amélioré.
4. **Hub PC** : liste drive Intermarché, tri de la liste ; et en passant les bugs bloquants de l'audit (voir §9).
5. **Plus tard, projet séparé** : wifi du PC des enfants (Linux). Ce document lui réserve seulement sa place.

Chaque chantier est livrable seul (on peut s'arrêter après n'importe lequel sans casser l'existant).

## 3. Décisions du propriétaire

- Le **design system « Alpage + Veillée »** fait autorité pour l'apparence : couleurs, polices, tailles, composants, les 7 règles « tête légère ». Ses maquettes de mise en page ne sont qu'une proposition ; **les fonctionnalités décidées ici priment**.
- Les ambiances **jour et nuit remplacent complètement les 6 thèmes actuels** (Caractère, Forêt, Marine, Bordeaux, Glacier, Lin), partout : iPad, téléphone, hub.
- **L'autre parent se connecte avec son compte Google** sur son téléphone. Les téléphones ne sont plus des « écrans » appairés.
- iPad : pas d'étape-par-étape dans le mode recette ; **toute la recette d'un coup**, quantités en haut à droite, minuteur à droite, étapes qui défilent facilement.
- iPad : la liste de courses n'y sert jamais ; la radio rarement ; ordre d'usage : prochain repas > recette et minuteur pendant la cuisine > météo > agenda de la semaine > livre de recettes.
- Téléphone : prochain repas en carte **moyenne**, carte « PC des enfants » **de même taille** ; menu de la semaine oui ; **pas d'agenda** ; recettes peu utilisées mais accessibles.
- Courses : les produits de placard **ne sont pas effacés par défaut**, ils sont rangés à part « sûrement dans le placard », à vérifier.
- Drive : **Intermarché**, liste drive **sur le PC seulement**.
- Logiciel de vie scolaire (type Pronote) : pas d'intégration développée. Piste à vérifier sans code : un lien d'export agenda (iCal) depuis le compte de l'enfant, que la tuile agenda sait déjà lire.

## 4. Socle commun (chantier 1)

### Design system
Source : artefact claude.ai « Family Hub · Design system v1 », **uniquement les fichiers `project/Sys-*`** ; `Sys-Fondations.dc.html` est la référence des jetons. Copie locale lue le 25.10 dans le scratchpad de la session ; le builder la relit avec l'outil Artifact (URL : https://claude.ai/artifact/4a44TKC6Uxwpuwv8gz4tZd).

Jetons à extraire dans **un seul fichier source** (ex. `packages/design-tokens/`), d'où sont générés :
- des variables CSS pour le hub (React/Tailwind) ;
- une feuille CSS ES5-compatible pour l'app display (iPad mini 1, iOS 9 : **pas de variables CSS** fiables, pas de `gap` en flex, pas de grid ; donc valeurs écrites en dur par la génération, avec une classe `.amb-jour` / `.amb-nuit` sur `<html>`).

Contenu : couleurs jour (fond #EEF4EA, carte #FFFFFF, texte #1E2B22, texte doux #55665A, action #2D56C8, « maintenant » #F5C242) et nuit (fond #0F1B2D, carte #182841, texte #F2F5F8, texte doux #A8B6C8, action et « maintenant » #FFB547) ; couleurs des personnes (sapin #2B7A4B / #5BC08A la nuit, tôle rouge #C8462B / #F2836A, lilas #8A55D0 / #B994F2) ; polices Bricolage Grotesque (titres) et Atkinson Hyperlegible (texte) ; échelles de tailles (téléphone min 15 px, iPad min 20 px) ; boutons (bord 2 px, ombre décalée), cartes, pastilles, cases à cocher ; cibles 48 px téléphone, 72 px iPad.

Les 7 règles s'appliquent à tous les écrans : une seule chose en jaune par écran (la prochaine) ; le temps se voit (« dans 1 h 30 » + barre) ; ce qui est fait s'efface sans disparaître ; couleur = personne, rien d'autre ; toujours une icône et un mot ; 2 lignes max, le reste replié ; cibles 48/72 px.

**Polices sur iOS 9** : pas de woff2 ni de polices variables → héberger nous-mêmes des fichiers statiques (woff + ttf) aux graisses utilisées (Bricolage 500/700/800, Atkinson 400/700).

**Profils sans couleur dans le design system** (grands-parents, futurs profils) : *décision Claude* — deux teintes supplémentaires distinctes des trois existantes, en suivant la même logique jour/nuit ; la couleur devient un champ du profil, choisi dans une palette fermée.

### Ambiance jour / nuit
- Bascule automatique : *décision Claude* — nuit entre le coucher et le lever du soleil dans la ville du foyer (heures fournies par Open-Meteo, déjà utilisé pour la météo), repli 19:00–07:00 si l'info manque.
- Même règle sur iPad, téléphone et hub. Le réglage de thème (household `parametres.themeId`, tuile Réglages de l'iPad, page Paramètres du hub) est retiré ; les 6 thèmes et leur CSS sont supprimés.
- La luminosité de l'iPad (brightness.js) reste réglable.

## 5. Téléphone (chantier 2)

### Forme
- C'est **le hub (React) en version téléphone**, pas l'app display. Connexion Google personnelle.
- Installable sur l'écran d'accueil (manifeste + service worker) et **utilisable sans réseau** : l'application doit s'ouvrir hors ligne (magasins sans réseau) et Firestore doit garder ses données en local (persistance hors ligne activée), les écritures partent au retour du réseau.
- Quand l'écran est étroit, le hub affiche la navigation téléphone (onglets en bas) au lieu de celle du PC. Les pages PC n'ont pas à devenir responsive : sur téléphone, seuls les écrans décrits ici existent ; le reste du hub (Écrans, Tuiles, Profils, import de plan…) reste réservé au PC.

### Accès de l'autre parent
- L'autre parent devient **membre du foyer** (aujourd'hui seul le propriétaire est dans `membres`). Il faut un moyen simple de l'ajouter : *décision Claude* — invitation par code ou lien généré depuis le hub PC par un membre existant ; l'autre parent se connecte avec Google et rejoint le foyer.
- Les comptes des téléphones appairés comme « écrans » (un par parent) sont retirés une fois les comptes personnels en place.

### Onglets
**Aujourd'hui · Semaine · Courses · Recettes** (+ **Wifi** plus tard, ou intégré à la carte « PC des enfants » — au choix du projet wifi).

**Aujourd'hui**
- Deux cartes de même taille, moyennes :
  - **Prochain repas** : moment et heure, plat principal + accompagnements, pour qui (pastilles de couleur), « dans 1 h 30 » + barre de temps, bouton « Cuisiner » (ouvre le mode recette).
  - **PC des enfants** : réservée aux parents ; tant que le projet wifi n'existe pas, carte présente marquée « bientôt ».
- En dessous : les autres repas du jour (passés effacés), le batch du jour s'il y en a un.
- Pas d'agenda.

**Semaine**
- Rangée de jours en haut (jour courant en jaune), un jour à la fois avec ses 3 repas ; repas passés effacés ; prochain repas en jaune avec « Cuisiner » et « Changer ».
- Notes de Claude repliées derrière « Pourquoi ce menu ? ».
- Navigation vers les semaines précédentes (comme aujourd'hui sur le hub).
- *Décision Claude* : « Changer » ouvre la même action que sur le hub PC (changer de recette pour ce repas) ; s'il est trop lourd pour le téléphone, il peut être absent au premier lot.

**Courses** (le cœur du chantier — voir §6)

**Recettes**
- Recherche dans le livre de recettes, puis la recette ouverte dans le mode recette téléphone.

### Mode recette (téléphone)
- Même contenu que l'iPad, en une colonne : titre, portions (+/−), **quantités en premier**, puis **toutes les étapes** à la suite.
- Bouton « Minuteur » toujours présent en bas d'écran ; les étapes avec une durée ont un bouton « Lancer N min ».
- Les minuteurs sont **partagés** (collection `timers` existante) : lancé sur le téléphone, il sonne aussi sur l'iPad, et inversement.
- L'écran reste allumé pendant le mode recette si le navigateur le permet.

## 6. Liste de courses (téléphone + PC)

### Les trois moments
1. **À la maison, avant de partir (avec réseau) : le tri.** Chaque article est rangé dans **« On l'a déjà »**, **« Drive »** ou **« Magasin »**. Un rayon à part **« Sûrement dans le placard — à vérifier »** est affiché en premier pendant le tri.
2. **Le drive (PC seulement)** : la liste « Drive » sous forme d'une ligne par article ; chaque article ouvre la recherche du site Intermarché ; on coche au fur et à mesure qu'on remplit le panier en ligne. Aucun remplissage automatique du panier (pas d'accès possible pour une application tierce).
3. **En magasin (sans réseau)** : la liste « Magasin », rangée par rayon, grandes cases (60 px de haut) ; on coche hors ligne ; au retour du réseau tout se synchronise et l'autre parent voit ce qui a été pris ; la liste ne montre plus que ce qui reste pour le magasin suivant.

### Règles
- Une case cochée prend **la couleur de la personne** qui l'a cochée, l'article passe barré **en bas de son rayon** (il ne disparaît pas ; on peut décocher).
- Compteur et barre de progression en haut (« 14 / 58 »), pastilles de rayon pour sauter d'un rayon à l'autre.
- Champ « Un oubli ? » en bas pour ajouter un article.
- « Partager la liste » (Web Share → Keep) reste disponible en secours.
- **Produits de placard** : jamais effacés par défaut. *Décision Claude* : une liste « produits de placard » gérée côté application (pré-remplie : sel, poivre, farine, sucre, huile, vinaigre, moutarde, levure, épices…, modifiable dans le hub) ; tout article de la liste qui y correspond (comparaison sans accents ni pluriel) arrive dans le rayon « Sûrement dans le placard ». On ajoute aussi au prompt de génération de plan une consigne demandant à Claude de marquer ces produits, sans les retirer.
- L'iPad n'affiche plus la liste de courses.

### Données
Le modèle actuel (`households/{hid}/shoppingLists/{listId}`, items en tableau avec `checked`, `checkedAt`, `checkedBy`) est à étendre avec la destination de l'article (déjà / drive / magasin / non trié) et le statut placard.
- *Point d'attention* : les items sont dans **un seul tableau**. Deux téléphones qui cochent hors ligne puis resynchronisent risquent d'écraser les coches l'un de l'autre (dernier écrit gagne sur tout le tableau). Le builder doit choisir un format qui fusionne sans perte (ex. un document par article, ou des mises à jour par champ) et migrer les listes existantes.
- `checkedBy` = l'uid de la personne connectée, relié à son profil pour la couleur.

## 7. iPad de cuisine (chantier 3)

Reste l'app display actuelle (JavaScript ES5 sans framework, iPad mini 1 sous iOS 9), appairée comme aujourd'hui. Mise en page : celle des maquettes `Sys-iPad-Jour` et `Sys-iPad-Nuit` (compatibles iOS 9), adaptée aux priorités ci-dessous.

### Tableau principal (une seule page fixe, 1024×768)
- **Grand, au centre-gauche** : le **prochain repas** — moment et heure, « dans 10 min » + barre qui se vide, plat en très grand, accompagnements, pour qui (pastilles), bouton « Commencer » (ouvre le mode recette).
- **À droite** :
  - **Minuteurs** : les minuteurs en cours (temps restant, nom) et des boutons de démarrage rapide (*décision Claude* : 1, 5, 10 min et « Autre ») ;
  - **Le repas suivant** (« Ce soir » le jour, « Demain » le soir).
- **En haut** : heure en grand, date, **météo** (température + ciel ; toucher = détail, comme aujourd'hui).
- **Agenda de la semaine** : visible sur le tableau, plus discret que le repas (*décision Claude* : bandeau ou carte « Cette semaine » listant les prochains événements ; toucher = vue semaine complète).
- **Rangée « plus » en bas** : Recettes (livre), Menu de la semaine, Radio, Réglages (luminosité).
- La liste de courses n'apparaît plus.
- La grille configurable (COL/ROW/W/H) **n'est plus utilisée pour l'iPad** : la disposition est fixe. Les données des tuiles (snapshot généré par les Cloud Functions : weather, calendar, recipe-today, weekly-menu…) restent la source ; le builder décide s'il garde les documents de tuiles comme simple configuration (ville météo, URL agenda, presets radio) ou les simplifie.

### Mode recette (iPad) — utilisé tous les jours
Ouvert depuis le prochain repas, le menu de la semaine ou le livre de recettes : **le même écran partout**.
- **Colonne gauche (≈ 2/3)** : titre, puis **toutes les étapes numérotées** en gros caractères ; si la recette est longue, **seule cette colonne défile**, au doigt, facilement.
- **Colonne droite (≈ 1/3), fixe** :
  - **en haut, les ingrédients et quantités**, ajustées au nombre de portions (+/−) ;
  - **en dessous, le minuteur** : boutons rapides + minuteurs en cours ; une alarme qui sonne s'affiche et s'arrête d'un geste sans quitter la recette.
- Une étape avec une durée garde un bouton « Lancer N min » ; le minuteur prend le nom de l'étape (ex. « Œufs durs »).
- Gros bouton « Fermer » (72 px).
- La maquette `Sys-iPad-Recette` (étape par étape) **n'est pas retenue** pour sa mise en page ; on garde ses couleurs, polices et tailles.

### Minuteur amélioré (constats sur le code actuel)
Aujourd'hui : il faut ouvrir la tuile en plein écran pour lancer un minuteur ; la durée libre se règle avec des « rouleaux » et un champ « Label » qui ouvre le clavier ; les démarrages rapides dépendent de presets réglés dans le hub ; la recette ouverte depuis le livre n'a aucun minuteur.
Cible :
- démarrage en **un toucher** depuis le tableau et depuis le mode recette ;
- **pas de nom à taper** : nom automatique (« 5 min ») ou nom de l'étape ;
- **+1 min** et **Arrêter** sur un minuteur en cours ; pause conservée ;
- minuteur terminé : bandeau bien visible par-dessus n'importe quel écran (tableau, recette, menu), alarme qui sonne jusqu'à « OK » (comportement sonore actuel conservé, il a été mis au point pour iOS 9) ;
- partagé avec les téléphones (collection `timers` existante).

### Jour / nuit
Le tableau passe en ambiance nuit automatiquement (§4) ; le « jaune maintenant » devient la couleur lampe.

## 8. Hub PC (chantier 4)

- **Liste drive Intermarché** et **tri de la liste** (§6), accessibles depuis le Menu.
- Bascule des 6 thèmes vers jour/nuit (§4) et application des jetons du design system.
- Page Profils : couleur de personne par profil (§4).
- Invitation d'un membre (§5).
- Les pages PC n'ont pas besoin d'être adaptées aux téléphones.

## 8 bis. Connexions entre les pièces : ce qui doit changer pour que tout marche

Cartographie faite le 25.10 en lecture seule sur `main` (59968cd), constats vérifiés dans le code. Chaque point ci-dessous est une **exigence**, pas une option.

### Données de l'iPad (bloquant pour le chantier 3)
- Aujourd'hui `rebuildSnapshotForTile` (`functions/src/snapshot/builder.ts:100-102`) n'écrit le snapshot d'un écran **que pour les tuiles présentes dans son `layout`**, et les tâches planifiées partent des documents de tuiles (requêtes par `type`). Une disposition fixe sans `layout` = un iPad qui ne reçoit plus rien. *Décision Claude* : garder les documents de tuiles comme configuration (ville météo, URL agenda, radio, presets) et faire écrire le snapshot pour **tout écran du foyer de type cuisine** (critère d'écriture changé dans `builder.ts`), au lieu du `layout`.
- Fraîcheur : le menu n'est recalculé qu'à 00:05 ou via le bouton « Mettre à jour les écrans ». Exiger un recalcul automatique après import ou modification d'un plan ; le bouton recalcule aussi météo et agenda ; la fraîcheur s'évalue par tuile (le `generatedAt` global est masqué par la météo toutes les 30 min).
- « Le repas suivant » et « dans 1 h 30 » : la recette du jour ne renvoie qu'un créneau, choisi par tranche horaire (`recipeToday.ts:71-75`), et **aucune heure de repas n'existe** dans les données. Il faut des heures de repas (voir §12) et un snapshot qui fournit le prochain repas **et** le suivant, avec leurs recettes complètes (ingrédients + étapes) pour ouvrir le mode recette sans réseau supplémentaire.
- Repas à plusieurs recettes (plat + accompagnements, `MealPlanSlot.recetteIds`) : *décision Claude* — le mode recette affiche **toutes les recettes du repas l'une sous l'autre** (plat principal d'abord) dans la colonne des étapes, et les ingrédients regroupés par recette dans la colonne de droite. Cohérent avec « tout voir d'un coup ».

### Livraison des mises à jour sur l'iPad (bloquant)
- Aujourd'hui l'iPad allumé 24 h/24 ne se recharge **que si son `layout` change** (`core.js:642-702`). Avec une disposition fixe, plus aucun déploiement n'arriverait sur l'iPad. Exiger un champ de version surveillé (ex. `displayVersion` sur le foyer) qui déclenche le rechargement, différé tant qu'une recette est ouverte (le mécanisme de report existe déjà) ; monter le `?v=` de `apps/display/public/index.html` à chaque livraison.
- La CI ne contrôle que le JavaScript ES5 (`scripts/check-display-es5.mjs`). Ajouter un contrôle du CSS de l'iPad (refuser `var(`, `gap`, `display: grid`).
- Un fichier JS manquant sous `/display/` renvoie index.html avec un code 200 (règle de réécriture) : vérifier la présence des fichiers au build.

### Appairage de l'iPad
- Un seul `authToken` par écran : appairer un 2e appareil sur le même écran invalide le 1er, qui reste connecté mais échoue à chaque renouvellement et rappelle la function toutes les 60 s sans fin (c'est le badge « PERMISSION-DENIED » vu dans le Chrome de bureau). L'`authToken` (90 jours) n'est jamais prolongé.
- Exiger : renouveler l'`authToken` à chaque rafraîchissement réussi ; ne pas appeler `refreshDisplayToken` tant que la session Firebase est valide ; arrêter la boucle après échec définitif avec un message clair (« Cet écran a été appairé ailleurs ») ; règle documentée « un appareil = un écran ».
- Action manuelle, sans code : nettoyer l'appairage du Chrome de bureau (bouton « reset » de setup.html), **sans le ré-appairer** sur l'écran Cuisine iPad.
- Retirer les deux anciens écrans « téléphone » appairés avec la suppression du hub (`deleteDisplay`), pas en effaçant le document.

### Accès de l'autre parent et lien compte ↔ personne
- Les règles interdisent à quiconque de modifier `membres` (`firestore.rules:37-39`) et aucune invitation n'existe. L'invitation passe donc par des Cloud Functions (Admin SDK) : création réservée à un membre, acceptation qui ajoute l'uid à `membres` ; collection d'invitations fermée aux clients ; tests de règles dans `firestore-tests/`.
- Empêcher qu'un invité crée son propre foyer avant d'accepter (la règle de création le permet aujourd'hui) : le lien d'invitation doit être traité avant l'écran « Créer mon foyer ».
- Ajouter à chaque profil le compte qui lui correspond (`uid`), pour que « la case prend la couleur de qui a coché » et la carte « PC des enfants » sachent qui est connecté.
- *Décision Claude* : les membres du foyer sont les parents ; un champ de rôle est posé dès maintenant (`parent` par défaut) pour que le projet wifi puisse restreindre l'accès par rôle si un enfant reçoit un jour un compte.

### Courses hors ligne
- Aujourd'hui le hub coche par `runTransaction` (`mutations.ts:737`) : **une transaction échoue sans réseau**. Il lit la liste en `getDocs` (pas de temps réel). Un ré-import du même plan supprime et recrée la liste (coches perdues). L'iPad lit « la liste la plus récemment modifiée », pas forcément celle du plan actif.
- Exiger : un document par article (`shoppingLists/{id}/items/{itemId}`), mises à jour champ par champ sans transaction, lectures en temps réel (`onSnapshot`), **aucune Cloud Function ni transaction dans le parcours des courses** ; règles exigeant `checkedBy == request.auth.uid` ; import qui ne détruit ni coches ni tri (et respecte la limite de 500 écritures par lot) ; migration des listes existantes.
- Nouveau plan : *décision Claude* — une nouvelle liste par plan ; les oublis ajoutés à la main et non cochés de la liste précédente y sont reportés ; le reste de l'ancienne liste est archivé.
- Le tri (déjà / drive / magasin) se fait **sur le téléphone et sur le PC** (*décision Claude* : le tri a lieu à la maison, souvent téléphone en main) ; seule la liste drive Intermarché est réservée au PC. Un article du drive peut être renvoyé vers « Magasin » (produit indisponible).

### Téléphone : installation, connexion, hors ligne
- Le hub n'a aujourd'hui ni persistance Firestore (`lib/firebase.ts:17`), ni manifeste, ni service worker ; ses polices viennent de Google Fonts. Exiger : persistance locale Firestore, manifeste + icônes, service worker qui met en cache l'application (pages chargées à la demande comprises) et les polices hébergées sur le site.
- Le service worker **ne doit pas contrôler `/display/` ni `/d/`** (sinon il intercepterait l'iPad et l'appairage).
- La connexion Google par fenêtre surgissante est réputée fragile dans une application installée sur iPhone, et l'`authDomain` actuel (`*.firebaseapp.com`) diffère du domaine du site : tester tôt sur les vrais téléphones, prévoir la connexion par redirection et un `authDomain` sur le domaine du site.

### Minuteurs
- Aujourd'hui seul l'iPad lit et fait sonner la collection `timers` ; le hub a une fonction de création inutilisée et son mode cuisine utilise des minuteurs locaux non partagés. Chaque appareil connecté passe un minuteur à « terminé » quand il arrive à zéro ; la suppression des minuteurs acquittés dépend d'un `setTimeout` de 2 min sur l'appareil (perdu au rechargement).
- Exiger : le téléphone écoute et sonne ; « +1 min » modifie `endsAt` ; nettoyage côté serveur des minuteurs terminés anciens ; le libellé porte le nom de l'étape. L'heure de fin est calculée sur l'horloge de l'appareil : acceptable, à noter.
- Un téléphone ne sonne que si l'application est ouverte (voir §12).

### Retrait des thèmes
- Points de contact de `parametres.themeId` : `packages/types/src/household.ts`, hub (`lib/themes.ts`, `index.css`, `tailwind.config.ts`, `Layout.tsx`, `ThemeSelector.tsx`, `Parametres.tsx`), iPad (`core.js`, `tiles/settings.js`, `css/styles.css` classes `html.theme-*`), règles (`firestore.rules:41-45`, seule écriture permise à un écran sur le foyer), tests de règles, `docs/THEMES.md`. Champ `theme` distinct sur l'écran (`display.ts`, `DisplayForm.tsx`).
- Ordre imposé : retirer d'abord le code de l'iPad qui écrit le thème, **puis** la règle ; à l'inverse, déployer règles et functions **avant** le code qui en a besoin.
- Lever / coucher du soleil : déjà dans le snapshot météo (l'iPad s'en sert) ; le téléphone et le hub doivent avoir leur propre source (*décision Claude* : appel direct à Open-Meteo, gratuit et sans clé, mis en cache pour la journée).

### Petits défauts relevés au passage
- Changer de ville météo depuis l'iPad échoue en silence : les règles n'accordent aux écrans qu'une lecture des tuiles.
- Le lien long d'appairage `/display/setup?token=…` semble cassé (le QR code, lui, utilise le lien court qui fonctionne) — à vérifier.
- L'icône `icons/icon-180.png` du manifeste de l'iPad n'existe pas.

## 9. Bugs relevés à l'audit, à corriger au passage

- **Recettes plante en accès direct ou au rechargement** (erreur React #310) : `apps/hub/src/pages/LivreRecettes.tsx:220` fait `return null` avant le `useMemo` de la ligne 231.
- **Mode cuisine du hub recouvert par l'en-tête du site** (logo et menu par-dessus le titre).
- Écran de chargement et d'erreur du hub en sombre (`index.html` force `color-scheme: dark`).
- Un téléphone ne doit plus voir le hub PC en version cassée (navigation qui déborde) : réglé par la navigation téléphone (§5).

Le reste de l'audit PC (jargon, doublons de recettes et d'étiquettes, éditeur de disposition, confirm() natifs…) n'est **pas** dans ce périmètre.

## 10. Hors périmètre / à ne pas faire

- Pas de remplissage automatique du panier Intermarché.
- Pas d'intégration Pronote développée.
- Pas de mise en page responsive des pages PC du hub.
- Pas de nettoyage des recettes (doublons, étiquettes) sans validation ligne par ligne du propriétaire.
- Échec même si « ça marche » : un iPad qui ne charge plus (code non ES5, police woff2 seule, `gap`, variables CSS) ; une liste de courses inutilisable sans réseau ; des coches perdues après synchronisation ; l'accès au PC des enfants visible sur l'iPad ou par l'enfant.

## 12. Réponses du propriétaire (25.10)

1. **Heures des repas** : petit-déjeuner 7:00 en semaine, 8:00 le week-end ; déjeuner 12:00–12:30 (*décision Claude* : heure de référence 12:15) ; dîner 19:00. Stockées comme réglage du foyer, modifiables dans le hub PC, avec une valeur semaine et une valeur week-end. *Décision Claude* : « dans 1 h 30 » compte jusqu'à l'heure du repas ; un repas passe au suivant 1 h après son heure.
2. **Minuteur sur le téléphone** : il sonne **seulement quand l'application est ouverte**. Pas de notifications push.
3. Modèles des téléphones : non précisés ; tester sur l'iPhone et/ou l'Android réels des deux parents (connexion Google, hors ligne, installation sur l'écran d'accueil).

## 11. Laissé au builder

- Découpage technique, nommage, emplacement du paquet de jetons, outil de génération du CSS ES5.
- Structure exacte des données de liste (tant que la fusion hors ligne est sans perte) et migration.
- Choix du service worker / stratégie de cache, à condition que l'app s'ouvre hors ligne.
- Détails visuels non couverts par le design system, en respectant ses 7 règles.
- Tests : `npm run build` doit passer ; tests unitaires pour la fusion de la liste, le tri placard et la bascule jour/nuit ; vérification visuelle iPad à 1024×768 et téléphone à 390 px (simulation possible dans Chrome, cf. mémoire de l'audit), et sur l'iPad réel avant de déclarer le chantier 3 terminé.
