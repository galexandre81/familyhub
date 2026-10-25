# Design : jetons, ambiance jour/nuit, contraintes iPad

Source de vérité : le design system Gates (artefact https://claude.ai/artifact/4a44TKC6Uxwpuwv8gz4tZd, uniquement les fichiers `project/Sys-*`).

## Où vivent les jetons

`packages/design/src/tokens.ts` (couleurs, typographie, rayons, ombres, jour et nuit). Rien d'autre ne définit de couleur de marque.

## CSS du hub (généré)

`npm run build:design` génère `apps/hub/src/styles/ambiance.css` à partir des jetons. Ne jamais éditer ce fichier à la main : un test de fraîcheur échoue s'il diffère de la sortie du générateur. Modifier `tokens.ts`, puis relancer la commande et commiter le CSS.

`npm run dev:hub` ne construit pas les paquets partagés : sur un clone neuf (ou après une modification de `packages/design` ou `packages/types`), lancer d'abord `npm run build:design` puis `npm run build:types`, sinon Vite ne trouve pas `@family-hub/design` ni `@family-hub/types`.

## Règle jour / nuit

Ambiance de jour entre le lever et le coucher du soleil, de nuit sinon. Repli si les horaires sont inconnus : jour de 07:00 à 19:00.

- Hub : horaires du soleil via Open-Meteo (`apps/hub/src/lib/ambiance.ts`).
- iPad : horaires lus dans le snapshot de la tuile météo, pour la localisation choisie dans sa config (`selectedLocationId`), sinon la première (`apps/display/public/js/ambiance.js`, testé par `packages/design/src/displayAmbiance.test.ts`).

Il n'y a plus de choix de thème (ni `parametres.themeId`, ni champ `theme` sur l'écran).

## Contraintes iPad (iOS 9)

`apps/display` doit rester compatible Safari iOS 9 :

- JavaScript ES5 (pas de `let`/`const`, flèches, template strings, `fetch`) ;
- pas de variables CSS (`var(--x)`), les valeurs sont écrites en dur ;
- pas de `gap` (flexbox) ni de CSS grid ;
- iOS 9 : jamais de flex sur un `<button>`, utiliser un `<span>` intérieur (flexbugs #9). Toute classe posée sur un bouton contient « btn », ce qui permet au contrôle CSS de le vérifier ;
- pas de polices woff2 (woff ou ttf).

`npm run check:display` vérifie une partie de ces règles.

## Téléphone (application installable)

Le hub s'installe sur l'écran d'accueil du téléphone (manifest + service worker générés par `vite-plugin-pwa`, réglages dans `apps/hub/src/lib/pwaConfig.ts`). Les données Firestore déjà vues restent lisibles hors ligne (cache IndexedDB, `apps/hub/src/lib/firebase.ts`).

- Le service worker ne contrôle jamais `/display`, `/display/…`, `/d/…` (écran de l'iPad) ni `/__/…` (pages de connexion servies par Firebase Hosting). Les pages `/displays` du hub restent disponibles hors ligne.
- Icônes : `node scripts/generate-hub-icons.mjs` régénère `apps/hub/public/icons/` (PNG versionnés).
- Connexion Google (`apps/hub/src/lib/authMode.ts`) : fenêtre surgissante partout, y compris dans Safari sur iPhone. La **redirection pleine page** ne s'active que si l'app est installée sur l'écran d'accueil **et** que `VITE_FIREBASE_AUTH_DOMAIN` est le domaine du site lui-même. Tant que ce réglage vaut `…firebaseapp.com`, rien ne change par rapport à aujourd'hui (mais la connexion depuis l'app installée peut échouer : la fenêtre surgissante n'y marche pas bien). Un échec s'affiche sur l'écran de connexion : « La connexion n'a pas abouti — réessaie. »

**À faire par le propriétaire pour activer la connexion depuis l'app installée** (la redirection s'active alors toute seule, sans changer le code) :

1. Dans `apps/hub/.env.local`, mettre `VITE_FIREBASE_AUTH_DOMAIN` sur le **domaine du site** (par exemple `<PROJECT_ID>.web.app`) au lieu de `…firebaseapp.com`.
2. Dans la console Google Cloud (API et services → Identifiants → client OAuth « Web client » du projet), ajouter l'URI de redirection autorisée `https://<site>/__/auth/handler` (par exemple `https://<PROJECT_ID>.web.app/__/auth/handler`).
3. Dans la console Firebase (Authentication → Paramètres → Domaines autorisés), vérifier que ce domaine figure dans la liste.
4. Rebâtir et redéployer l'hébergement.

Effet de bord sans conséquence : `scripts/copy-display-into-hub-dist.mjs` recopie la même variable dans `dist/display/js/firebase-config.js` (configuration de l'iPad). L'iPad s'authentifie par jeton, pas par Google : changer `authDomain` ne le gêne pas.

## Déployer ce lot

Avant la fusion : le job CI `rules-tests` (règles Firestore sur l'émulateur) doit être vert, en plus du job `build`.

Ordre obligatoire, une commande après l'autre — **règles et fonctions avant l'hébergement** :

1. `npm run deploy:functions` — les fonctions d'abord (`acceptInvitation` et `createInvitation` lisent et écrivent la carte `roles`, et `createInvitation` est réservée aux parents) ;
2. `npm run deploy:rules` — les règles Firestore ensuite ;
3. `npm run deploy:hosting` — le hub et les fichiers de l'iPad en dernier.

Pourquoi : sur cette branche, le hub écrit `roles: { [uid]: "parent" }` en créant un foyer. Les anciennes règles n'acceptent pas ce champ : si le nouveau hub était publié avant les règles, la création d'un foyer serait refusée. Les nouvelles règles, elles, acceptent aussi l'ancien hub (le champ `roles` y est facultatif) : les publier avant ne casse rien. Même raisonnement pour les fonctions : le nouveau hub appelle les nouvelles fonctions, l'ancien hub fonctionne avec elles.

Puis **recharger l'iPad une fois à la main** : l'ancien `core.js` ne surveille pas `version.json`, il ne se rechargera donc pas tout seul pour ce déploiement-ci. Les déploiements suivants le rechargeront automatiquement (vérification toutes les 10 minutes).

`npm run deploy` (un seul `firebase deploy`) publie aussi les règles avant l'hébergement ; il convient donc, mais la séquence ci-dessus (fonctions → règles → hébergement) reste celle à suivre. Entre l'étape 2 et l'étape 3, un ancien iPad qui tenterait encore d'écrire un thème est simplement refusé par les règles, sans casser l'écran.

**Liste de courses (Plan 3) — après le déploiement, avant d'aller faire les courses :**

- [ ] Sur **chaque téléphone**, ouvrir une fois l'onglet Courses **avec du réseau** (ou ré-importer le plan en cours). Une liste créée avant ce lot est à l'ancien format : tant qu'elle n'a pas été ouverte en ligne, elle ne peut pas être cochée hors ligne (bandeau « Cette liste doit être ouverte une fois avec du réseau avant de pouvoir être cochée. »).
- [ ] Déployer **en même temps** le Plan 4 (tuile courses de l'iPad) : l'iPad lit le nouveau format de liste.

**Vérifications à la main (courses) :**

- [ ] Ré-import d'une liste à l'ancien format : les articles, le tri et les coches sont repris, la liste passe au nouveau format.
- [ ] Deux téléphones en mode avion cochent chacun des articles, puis se reconnectent : toutes les coches arrivent, aucune n'est écrasée.
- [ ] Un oubli ajouté à la main et non acheté est reporté dans la liste du plan suivant.
- [ ] Plan 4 déployé avec ce lot : la tuile courses de l'iPad affiche la liste.

**Écran de cuisine de l'iPad (Plan 4) — même ordre, fonctions → règles → hébergement :**

Les **fonctions d'abord** : c'est le serveur qui écrit dans l'instantané de l'iPad l'indication des repas annulés. Si le nouvel iPad (hébergement) arrivait avant les nouvelles fonctions, il lirait un instantané sans cette indication et pourrait afficher un repas annulé comme prochain repas. Puis les règles, puis l'hébergement ; recharger l'iPad une fois à la main.

Après le déploiement, **une fois dans le hub** : iPad de cuisine → « Préparer l'écran de cuisine » (ajoute les tuiles qui manquent au tableau).

**Vérifications sur l'iPad (iPad mini, iOS 9) :**

- [ ] « Préparer l'écran de cuisine » fait une fois dans le hub : le tableau n'affiche plus « À configurer dans le hub » pour la météo, l'agenda ni le menu.
- [ ] Tableau de jour, puis de nuit (couleurs jour / nuit lisibles partout, y compris les recettes d'un batch dans le menu de la semaine).
- [ ] Jour → nuit → jour **sans recharger la page** : l'ambiance change à chaque fois (elle ne reste pas bloquée en nuit).
- [ ] Carte des minuteurs du tableau avec **0**, **1** et **3** minuteurs (la liste défile seule, rien ne déborde).
- [ ] Prochain repas avec un **nom de plat court** puis un **nom long** (pas de débordement, « Commencer » reste visible).
- [ ] Mode recette ouvert sur un repas à **2 recettes**, avec **2 minuteurs** lancés : étapes des deux recettes, ingrédients encore visibles sous le panneau des minuteurs ; « Lancer N min » répond sur tout le bouton.
- [ ] Mode recette en mode avion, recette jamais ouverte : « Recette indisponible sans réseau » après quelques secondes, les minuteurs restent utilisables.
- [ ] Alarme d'un minuteur **par-dessus le mode recette**, puis **par-dessus le menu de la semaine** : bandeau visible, « OK » arrête la sonnerie.
- [ ] Carte **batch cooking** du tableau la veille puis le jour même ; toucher → mode recette de toutes les recettes du batch, chacune à ses propres quantités (pas de −/+).
- [ ] Écrans plein écran au nouveau design, **de jour puis de nuit** : agenda (passer d'une semaine à l'autre au doigt), menu de la semaine (s'ouvre sur aujourd'hui, plats longs coupés à 2 lignes avec « … »), vue batch, livre de recettes (étapes 1 et 2, fiche) ; « Fermer » toujours en haut à gauche, rien ne déborde, le défilement au doigt ne fait pas bouger toute la page.
- [ ] Un téléphone qui ouvre l'ancienne adresse de l'écran de cuisine arrive sur la version téléphone.
