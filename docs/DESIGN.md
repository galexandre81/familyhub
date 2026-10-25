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
- pas de polices woff2 (woff ou ttf).

`npm run check:display` vérifie une partie de ces règles.

## Téléphone (application installable)

Le hub s'installe sur l'écran d'accueil du téléphone (manifest + service worker générés par `vite-plugin-pwa`, réglages dans `apps/hub/src/lib/pwaConfig.ts`). Les données Firestore déjà vues restent lisibles hors ligne (cache IndexedDB, `apps/hub/src/lib/firebase.ts`).

- Le service worker ne contrôle jamais `/display`, `/display/…`, `/d/…` (écran de l'iPad) ni `/__/…` (pages de connexion servies par Firebase Hosting). Les pages `/displays` du hub restent disponibles hors ligne.
- Icônes : `node scripts/generate-hub-icons.mjs` régénère `apps/hub/public/icons/` (PNG versionnés).
- Connexion Google (`apps/hub/src/lib/authMode.ts`) : fenêtre surgissante partout, y compris dans Safari sur iPhone. La **redirection pleine page** ne s'active que si l'app est installée sur l'écran d'accueil **et** que `VITE_FIREBASE_AUTH_DOMAIN` est le domaine du site lui-même. Tant que ce réglage vaut `…firebaseapp.com`, rien ne change par rapport à aujourd'hui (mais la connexion depuis l'app installée peut échouer : la fenêtre surgissante n'y marche pas bien). Un échec s'affiche sur l'écran de connexion : « La connexion n'a pas abouti — réessaie. »

**À faire par Alex pour activer la connexion depuis l'app installée** (la redirection s'active alors toute seule, sans changer le code) :

1. Dans `apps/hub/.env.local`, mettre `VITE_FIREBASE_AUTH_DOMAIN` sur le **domaine du site** (par exemple `<PROJECT_ID>.web.app`) au lieu de `…firebaseapp.com`.
2. Dans la console Google Cloud (API et services → Identifiants → client OAuth « Web client » du projet), ajouter l'URI de redirection autorisée `https://<site>/__/auth/handler` (par exemple `https://<PROJECT_ID>.web.app/__/auth/handler`).
3. Dans la console Firebase (Authentication → Paramètres → Domaines autorisés), vérifier que ce domaine figure dans la liste.
4. Rebâtir et redéployer l'hébergement.

Effet de bord sans conséquence : `scripts/copy-display-into-hub-dist.mjs` recopie la même variable dans `dist/display/js/firebase-config.js` (configuration de l'iPad). L'iPad s'authentifie par jeton, pas par Google : changer `authDomain` ne le gêne pas.

## Déployer ce lot

Avant la fusion : le job CI `rules-tests` (règles Firestore sur l'émulateur) doit être vert, en plus du job `build`.

Ordre recommandé, une commande après l'autre :

1. `npm run deploy:functions` — les fonctions d'abord ;
2. `npm run deploy:hosting` — le hub et les fichiers de l'iPad ;
3. `npm run deploy:rules` — les règles Firestore en dernier.

Puis **recharger l'iPad une fois à la main** : l'ancien `core.js` ne surveille pas `version.json`, il ne se rechargera donc pas tout seul pour ce déploiement-ci. Les déploiements suivants le rechargeront automatiquement (vérification toutes les 10 minutes).

`npm run deploy` (un seul `firebase deploy`) publie les règles avant l'hébergement. C'est acceptable pour ce lot : un ancien iPad qui tenterait encore d'écrire un thème est simplement refusé par les règles, sans casser l'écran. Mais la séquence ci-dessus reste celle à suivre.
