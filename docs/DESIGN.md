# Design : jetons, ambiance jour/nuit, contraintes iPad

Source de vérité : le design system Gates (artefact https://claude.ai/artifact/4a44TKC6Uxwpuwv8gz4tZd, uniquement les fichiers `project/Sys-*`).

## Où vivent les jetons

`packages/design/src/tokens.ts` (couleurs, typographie, rayons, ombres, jour et nuit). Rien d'autre ne définit de couleur de marque.

## CSS du hub (généré)

`npm run build:design` génère `apps/hub/src/styles/ambiance.css` à partir des jetons. Ne jamais éditer ce fichier à la main : un test de fraîcheur échoue s'il diffère de la sortie du générateur. Modifier `tokens.ts`, puis relancer la commande et commiter le CSS.

## Règle jour / nuit

Ambiance de jour entre le lever et le coucher du soleil, de nuit sinon. Repli si les horaires sont inconnus : jour de 07:00 à 19:00.

- Hub : horaires du soleil via Open-Meteo (`apps/hub/src/lib/ambiance.ts`).
- iPad : horaires lus dans le snapshot météo (`apps/display`).

Il n'y a plus de choix de thème (ni `parametres.themeId`, ni champ `theme` sur l'écran).

## Contraintes iPad (iOS 9)

`apps/display` doit rester compatible Safari iOS 9 :

- JavaScript ES5 (pas de `let`/`const`, flèches, template strings, `fetch`) ;
- pas de variables CSS (`var(--x)`), les valeurs sont écrites en dur ;
- pas de `gap` (flexbox) ni de CSS grid ;
- pas de polices woff2 (woff ou ttf).

`npm run check:display` vérifie une partie de ces règles.
