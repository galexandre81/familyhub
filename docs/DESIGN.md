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

## Déployer ce lot

Avant la fusion : le job CI `rules-tests` (règles Firestore sur l'émulateur) doit être vert, en plus du job `build`.

Ordre recommandé, une commande après l'autre :

1. `npm run deploy:functions` — les fonctions d'abord ;
2. `npm run deploy:hosting` — le hub et les fichiers de l'iPad ;
3. `npm run deploy:rules` — les règles Firestore en dernier.

Puis **recharger l'iPad une fois à la main** : l'ancien `core.js` ne surveille pas `version.json`, il ne se rechargera donc pas tout seul pour ce déploiement-ci. Les déploiements suivants le rechargeront automatiquement (vérification toutes les 10 minutes).

`npm run deploy` (un seul `firebase deploy`) publie les règles avant l'hébergement. C'est acceptable pour ce lot : un ancien iPad qui tenterait encore d'écrire un thème est simplement refusé par les règles, sans casser l'écran. Mais la séquence ci-dessus reste celle à suivre.
