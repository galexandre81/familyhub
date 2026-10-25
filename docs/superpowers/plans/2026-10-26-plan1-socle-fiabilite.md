# Plan 1 — Socle jour/nuit, fiabilité de l'iPad, bugs bloquants — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer les 6 thèmes par les ambiances jour/nuit du design system « Alpage + Veillée », fiabiliser la livraison et l'appairage de l'iPad, corriger les bugs bloquants du hub.

**Architecture:** Un nouveau paquet `@family-hub/design` porte les jetons du design system et la règle jour/nuit (TypeScript pur, testé). Un script en génère le CSS du hub. Le hub applique une classe `amb-jour` / `amb-nuit` sur `<html>`. L'iPad, réécrit au plan 4, reçoit d'ici là un équivalent transitoire (jour → classes `theme-lin`, nuit → `theme-marine`) ; il se recharge seul quand une nouvelle version est déployée.

**Tech Stack:** npm workspaces, TypeScript 5, Vitest, React 18 + Tailwind 3 (hub), JavaScript ES5 (iPad, iOS 9), Cloud Functions v2 (Node 22), règles Firestore.

**Spec:** `docs/superpowers/specs/2026-10-25-refonte-ipad-mobile-design.md` (§4, §8 bis « Livraison », « Appairage », « Retrait des thèmes », « Petits défauts », §9).

## Global Constraints

- Tout fichier sous `apps/display/public` reste ES5 strict (`npm run check:display`) ; CSS de l'iPad sans `var(`, sans `gap`, sans `display: grid`.
- `npm run build` doit passer à la fin de chaque tâche ; tests : `npm test --workspace=hub`, `npm test --workspace=functions`, `npm test --workspace=@family-hub/design`.
- Valeurs du design system copiées telles quelles de `Sys-Fondations.dc.html` (couleurs listées dans la tâche 1).
- Bascule nuit : entre le coucher et le lever du soleil ; repli 19:00–07:00 si l'info manque.
- Ordre de déploiement (à respecter par le propriétaire / l'exécutant, noté dans le message de commit de la tâche 5) : hébergement (hub + iPad) **avant** les règles Firestore qui retirent l'écriture du thème.
- Textes visibles en français, tutoiement.
- Aucun déploiement dans ce plan : le déploiement est une étape séparée, après accord.

## Review Focus

- Hub ouvert la nuit puis laissé ouvert jusqu'au matin : l'ambiance doit basculer sans rechargement (recalcul chaque minute) — test sur `ambianceAt` aux bornes exactes du lever/coucher.
- Open-Meteo injoignable ou foyer sans coordonnées : le hub doit rester utilisable avec le repli 19:00–07:00 — test `ambianceAt(now, null)`.
- iPad avec une ancienne page en mémoire au moment d'un déploiement, recette ouverte : rechargement différé jusqu'à fermeture, jamais en boucle — la version servie est comparée à la version chargée, pas à l'heure.
- Écran appairé ailleurs (jeton remplacé) : plus aucun appel en boucle, message clair — test du classement des erreurs permanentes.
- Fichier JS référencé par `index.html` de l'iPad mais absent : le build échoue au lieu de servir index.html à la place.

---

### Task 1: Paquet `@family-hub/design` (jetons + règle jour/nuit)

**Files:**
- Create: `packages/design/package.json`, `packages/design/tsconfig.json`, `packages/design/vitest.config.ts`
- Create: `packages/design/src/tokens.ts`, `packages/design/src/ambiance.ts`, `packages/design/src/index.ts`
- Test: `packages/design/src/ambiance.test.ts`, `packages/design/src/tokens.test.ts`
- Modify: `package.json` (racine : script `build:design`, ajouté en tête de `build` après `check:display`)

**Interfaces:**
- Produces:
  - `type Ambiance = "jour" | "nuit"`
  - `const AMBIANCES: Record<Ambiance, { fond: string; carte: string; texte: string; texteDoux: string; action: string; maintenant: string; bordure: string; ligne: string }>` (hex `#RRGGBB`)
  - `const PERSONNES: Record<"sapin" | "toleRouge" | "lilas" | "miel" | "ardoise", { jour: string; nuit: string }>`
  - `const POLICES = { titre: "Bricolage Grotesque", texte: "Atkinson Hyperlegible" }`
  - `function ambianceAt(now: Date, sun?: { sunrise: string; sunset: string } | null): Ambiance` — `sunrise`/`sunset` au format `"HH:MM"` (heure locale), comme le snapshot météo.
  - `function hexToRgbTriplet(hex: string): string` → `"238 244 234"`

Valeurs (verbatim design system) :
- jour : fond `#EEF4EA`, carte `#FFFFFF`, texte `#1E2B22`, texteDoux `#55665A`, action `#2D56C8`, maintenant `#F5C242`, bordure `#1E2B22`, ligne `#C9D6C6`.
- nuit : fond `#0F1B2D`, carte `#182841`, texte `#F2F5F8`, texteDoux `#A8B6C8`, action `#FFB547`, maintenant `#FFB547`, bordure `#2C3F5C`, ligne `#2C3F5C`.
- personnes : sapin `#2B7A4B`/`#5BC08A`, toleRouge `#C8462B`/`#F2836A`, lilas `#8A55D0`/`#B994F2` (les trois personnes déjà colorées dans le design system) ; *décision Claude* pour les deux profils sans couleur (les grands-parents) : miel `#B7791F`/`#F0B95A`, ardoise `#3E6A8A`/`#8DB8D8`.

- [ ] **Step 1: Write the failing tests**

```ts
// ambiance.test.ts
import { describe, expect, it } from "vitest";
import { ambianceAt } from "./ambiance";
const at = (hhmm: string) => new Date(`2026-10-27T${hhmm}:00`);
describe("ambianceAt", () => {
  const sun = { sunrise: "07:58", sunset: "17:52" };
  it("jour entre lever et coucher", () => expect(ambianceAt(at("12:00"), sun)).toBe("jour"));
  it("nuit à l'instant du coucher", () => expect(ambianceAt(at("17:52"), sun)).toBe("nuit"));
  it("jour à l'instant du lever", () => expect(ambianceAt(at("07:58"), sun)).toBe("jour"));
  it("nuit juste avant le lever", () => expect(ambianceAt(at("07:57"), sun)).toBe("nuit"));
  it("repli 07:00–19:00 sans soleil", () => {
    expect(ambianceAt(at("06:59"), null)).toBe("nuit");
    expect(ambianceAt(at("07:00"), null)).toBe("jour");
    expect(ambianceAt(at("19:00"), null)).toBe("nuit");
  });
  it("repli si heures illisibles", () => expect(ambianceAt(at("20:00"), { sunrise: "", sunset: "" })).toBe("nuit"));
});
// tokens.test.ts
import { AMBIANCES, hexToRgbTriplet } from "./tokens";
it("jetons jour verbatim", () => expect(AMBIANCES.jour.action).toBe("#2D56C8"));
it("triplet RGB", () => expect(hexToRgbTriplet("#EEF4EA")).toBe("238 244 234"));
```

- [ ] **Step 2: Run** `npm test --workspace=@family-hub/design` → FAIL (modules absents).
- [ ] **Step 3: Implement** `tokens.ts`, `ambiance.ts`, `index.ts` ; `package.json` du paquet calqué sur `packages/types/package.json` (nom `@family-hub/design`, scripts `build: tsc`, `test: vitest run`) ; `tsconfig.json` calqué sur `packages/types/tsconfig.json` en excluant `*.test.ts`.
- [ ] **Step 4: Run** `npm install` puis `npm test --workspace=@family-hub/design` → PASS ; `npm run build` → OK.
- [ ] **Step 5: Commit** `feat(design): paquet jetons Alpage+Veillée et règle jour/nuit`

### Task 2: CSS du hub généré depuis les jetons + polices locales

**Files:**
- Create: `packages/design/scripts/gen-hub-css.mjs` (lit `packages/design/dist/index.js`, écrit `apps/hub/src/styles/ambiance.css`)
- Create (généré, commité): `apps/hub/src/styles/ambiance.css`
- Test: `packages/design/src/hubCss.test.ts` (vérifie que le fichier commité est identique à la sortie de `renderHubCss()`)
- Modify: `packages/design/src/index.ts` (export `renderHubCss(): string`), racine `package.json` (`build:design` = build + génération)
- Modify: `apps/hub/package.json` (dépendances `@family-hub/design`, `@fontsource/bricolage-grotesque`, `@fontsource/atkinson-hyperlegible`)

**Interfaces:**
- Produces: `renderHubCss(): string` — deux blocs `html.amb-jour { … }` et `html.amb-nuit { … }` définissant, en triplets RGB, les variables **existantes** du hub (pour ne pas réécrire toutes les pages) :
  `--c-ebony`=fond, `--c-ebony-panel`=carte, `--c-ebony-card`=carte, `--c-ebony-ridge`=ligne, `--c-brass`=action, `--c-cream`=texte, `--c-cream-mute`=texteDoux, `--c-wood-dark`=ligne ; plus les nouvelles `--c-maintenant`, `--c-bordure`, et `--c-p-<personne>` pour chaque personne. `:root` reprend les valeurs du jour (avant l'arrivée du JS).

- [ ] **Step 1: Test** `it("ambiance.css à jour", …)` : lit `apps/hub/src/styles/ambiance.css`, compare à `renderHubCss()`. **Step 2:** FAIL.
- [ ] **Step 3: Implement** `renderHubCss` + script ; exécuter le script.
- [ ] **Step 4:** PASS ; `npm run build` OK.
- [ ] **Step 5: Commit** `feat(design): CSS du hub généré (variables jour/nuit)`

### Task 3: Le hub passe en jour/nuit (thèmes retirés)

**Files:**
- Create: `apps/hub/src/lib/ambiance.ts` (hook), test `apps/hub/src/lib/sunTimes.test.ts`
- Create: `apps/hub/src/lib/sunTimes.ts`
- Modify: `apps/hub/src/index.css` (supprimer `:root` + les 5 blocs `html.theme-*` ; `@import "./styles/ambiance.css"` ; retirer dégradés radiaux et grain du `body` ; `::selection` en `rgb(var(--c-maintenant) / 0.4)` + `color: rgb(var(--c-texte))`), `apps/hub/src/main.tsx` (imports `@fontsource/bricolage-grotesque/500.css`, `700.css`, `800.css`, `@fontsource/atkinson-hyperlegible/400.css`, `700.css`)
- Modify: `apps/hub/tailwind.config.ts` (`fontFamily.serif` = `["Bricolage Grotesque", "system-ui", "sans-serif"]`, `fontFamily.sans` = `["Atkinson Hyperlegible", "system-ui", "sans-serif"]` ; couleurs fixes `brass.deep`, `wood.mid`, `wood.light`, `ink.soft`, `terracotta.deep`, `copper`, `sage` remplacées par des variables : `copper` → `rgb(var(--c-p-toleRouge) / <alpha-value>)`, `sage` → `rgb(var(--c-p-sapin) / <alpha-value>)`, les autres → `--c-brass` / `--c-cream-mute`)
- Modify: `apps/hub/index.html` (retirer les liens Google Fonts ; `color-scheme` = `light dark` ; `theme-color` = `#EEF4EA`)
- Modify: `apps/hub/src/components/Layout.tsx` (remplacer `applyTheme(themeId)` par `useAmbiance(household?.parametres?.localisation)` ; hex en dur `#3A2E22` et `rgba(217,160,91,…)` → classes `border-hairline`)
- Delete: `apps/hub/src/lib/themes.ts`, `apps/hub/src/components/ThemeSelector.tsx` ; Modify: `apps/hub/src/pages/Parametres.tsx` (retirer la section « Thème de l'interface »)
- Modify: `apps/hub/src/components/states.tsx` (hex `#C9712E` → `text-copper`)

**Interfaces:**
- Consumes: `ambianceAt` (tâche 1).
- Produces:
  - `parseOpenMeteoSun(json: unknown): { sunrise: string; sunset: string } | null` (dans `sunTimes.ts`, lit `daily.sunrise[0]` / `daily.sunset[0]`, renvoie `"HH:MM"`)
  - `useAmbiance(localisation?: { lat: number; lon: number; timezone: string }): Ambiance` — récupère lever/coucher via `https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&daily=sunrise,sunset&forecast_days=1&timezone=…`, cache `localStorage` clé `fh.sun.<YYYY-MM-DD>` (try/catch), recalcule chaque minute, pose `amb-jour`/`amb-nuit` sur `<html>` et met à jour `<meta name="theme-color">` avec `AMBIANCES[a].fond`.

- [ ] **Step 1: Test** `parseOpenMeteoSun({ daily: { sunrise: ["2026-10-27T07:58"], sunset: ["2026-10-27T17:52"] } })` → `{ sunrise: "07:58", sunset: "17:52" }` ; entrée vide → `null`. **Step 2:** FAIL.
- [ ] **Step 3: Implement** `sunTimes.ts`, `ambiance.ts`, puis toutes les modifications listées.
- [ ] **Step 4:** `npm test --workspace=hub` PASS ; `npm run build` OK ; `grep -rn "themeId\|applyTheme\|THEMES" apps/hub/src` → aucun résultat.
- [ ] **Step 5: Vérification visuelle** `npm run dev:hub` impossible sans config Firebase locale → vérifier par le build et, après déploiement, dans Chrome (jour à midi, nuit en forçant la classe `amb-nuit`).
- [ ] **Step 6: Commit** `feat(hub): ambiances jour/nuit du design system, 6 thèmes retirés`

### Task 4: L'iPad suit le jour/nuit (transitoire) et n'écrit plus de thème

**Files:**
- Modify: `apps/display/public/js/core.js:510-550, 560-566, 613-632` (remplacer `applyDisplayTheme` / l'écoute de `themeId`)
- Modify: `apps/display/public/js/tiles/settings.js` (retirer `THEMES`, l'aperçu de thème en vue compacte, la section de choix et `pickTheme` ; garder la luminosité)

**Interfaces:**
- Produces (ES5, dans `core.js`) : `function ambianceFromSun(now, sunrise, sunset)` → `'jour'|'nuit'` (même règle que `ambianceAt`, repli 07:00–19:00), `function applyAmbiance()` qui lit `sunrise`/`sunset` dans les données de la première tuile `weather` de `state.lastSnapshotTiles` (`data.daily.sunrise`, `"HH:MM"`), pose `theme-lin` (jour) ou `theme-marine` (nuit) sur `<html>` ; appelée au boot, à chaque snapshot et toutes les 60 s. `window.FamilyHubApplyTheme` est supprimé.

- [ ] **Step 1:** Modifier `core.js` et `settings.js` (aucun test automatisé côté iPad ; ES5).
- [ ] **Step 2: Run** `npm run check:display` → `ES5 OK` ; `grep -n "themeId\|pickTheme\|THEMES" apps/display/public/js -r` → aucun résultat.
- [ ] **Step 3: Vérifier dans Chrome** sur `/display/` après déploiement : classe `theme-lin` le jour.
- [ ] **Step 4: Commit** `feat(display): ambiance jour/nuit automatique, choix de thème retiré`

### Task 5: Règles, types et docs sans thème

**Files:**
- Modify: `firestore.rules:34-46` (supprimer la branche `isDisplayOfHousehold(hid) && … hasOnly(['themeId'])`) ; dans `match /tiles/{tileId=**}` ajouter : un écran peut mettre à jour **seulement** `config.selectedLocationId` (+ `updatedAt`) d'une tuile de son foyer (corrige le changement de ville météo).
- Modify: `firestore-tests/rules.test.ts:75, 258-270` (le test « can update household parametres.themeId » devient « CANNOT update household parametres ») ; ajouter « can update tile config.selectedLocationId » et « CANNOT update tile config.url ».
- Modify: `packages/types/src/household.ts` (supprimer `themeId`), `packages/types/src/display.ts` + `apps/hub/src/components/DisplayForm.tsx` (supprimer le champ `theme` de l'écran).
- Delete: `docs/THEMES.md` ; Create: `docs/DESIGN.md` (une page : où vivent les jetons, comment régénérer le CSS, règle jour/nuit, contraintes iOS 9).

- [ ] **Step 1:** Écrire les tests de règles modifiés/ajoutés.
- [ ] **Step 2:** Modifier les règles et types.
- [ ] **Step 3: Run** `npm run build` OK. Les tests de règles demandent l'émulateur (Java absent sur ce PC) : ils tournent dans la CI (`rules-tests`) — vérifier le job sur la PR.
- [ ] **Step 4: Commit** `chore: retrait du thème dans règles/types/docs ; écran peut changer la ville météo` — corps du message : « Déployer l'hébergement AVANT les règles. »

### Task 6: Livraison fiable sur l'iPad (version, CSS, fichiers, icône)

**Files:**
- Modify: `apps/display/public/index.html` (tous les `?v=20260928a` → `?v=__DISPLAY_VERSION__` ; ajouter avant les scripts `js/` : `<script>window.FH_DISPLAY_VERSION = '__DISPLAY_VERSION__';</script>`)
- Modify: `scripts/copy-display-into-hub-dist.mjs` (après copie : version = horodatage `YYYYMMDDHHmm` UTC ; remplace `__DISPLAY_VERSION__` dans `dist/display/index.html` ; écrit `dist/display/version.json` = `{"version":"…"}`)
- Create: `scripts/check-display-assets.mjs` (échoue si un `src=`/`href=` relatif de `apps/display/public/index.html` ou `setup.html`, sans la partie `?v=…`, ne correspond à aucun fichier — sauf `js/firebase-config.js`, généré)
- Create: `scripts/check-display-css.mjs` (échoue sur `var(`, `gap:` hors `column-gap`/`row-gap` aussi interdits, `display: grid`, `display:grid` dans `apps/display/public/css/*.css`)
- Modify: racine `package.json` (`check:display` enchaîne les trois vérifications), `.github/workflows/ci.yml` (libellé de l'étape)
- Modify: `apps/display/public/js/core.js` (surveillance de version)
- Create: `apps/display/public/icons/icon-180.png` (180×180, fond `#EEF4EA`, généré par `scripts/generate-display-icon.mjs` avec `node:zlib`, pas de dépendance)

**Interfaces:**
- Produces (ES5, `core.js`) : `function checkDisplayVersion()` — `fetch('version.json?ts=' + Date.now())`, si `version` ≠ `window.FH_DISPLAY_VERSION` → `reloadDisplay()`. Appelée toutes les 10 min et au `visibilitychange` visible. `reloadForLayoutChange` est renommée `reloadDisplay` (même logique de report si l'overlay est ouvert) et réutilisée par l'écoute de layout.

- [ ] **Step 1:** Écrire les deux scripts de contrôle ; les lancer sur un fichier volontairement fautif (copie temporaire) → échec attendu ; sur l'arbre réel → OK.
- [ ] **Step 2:** Modifier `index.html`, le script de copie, `core.js` ; générer l'icône.
- [ ] **Step 3: Run** `npm run build` → `apps/hub/dist/display/version.json` existe, `dist/display/index.html` ne contient plus `__DISPLAY_VERSION__` ; `npm run check:display` OK.
- [ ] **Step 4: Commit** `feat(display): rechargement automatique à chaque déploiement, contrôles CSS et fichiers`

### Task 7: Appairage de l'iPad sans boucle infinie

**Files:**
- Modify: `functions/src/auth/displayToken.ts:272-314` (`refreshDisplayToken` prolonge `authTokenExpiresAt` à maintenant + 90 jours à chaque succès)
- Create: `functions/src/auth/tokenExpiry.ts` + test `functions/src/auth/tokenExpiry.test.ts`
- Modify: `apps/display/public/js/core.js:13-264` (rafraîchissement)

**Interfaces:**
- Produces: `prochaineExpiration(nowMs: number): number` = `nowMs + 90 * 24 * 3600 * 1000` (functions).
- Produces (ES5) : `function isPermanentAuthError(code)` → `true` pour `'functions/permission-denied'`, `'permission-denied'`, `'functions/deadline-exceeded'`, `'deadline-exceeded'`, `'functions/not-found'`, `'not-found'`.

Comportement client :
- `CUSTOM_TOKEN_REFRESH_MS` = 24 h (sert à prolonger l'expiration) ; `visibilitychange` ne rafraîchit que si `state.auth.currentUser` est nul ; `onAuthStateChanged(null)` inchangé.
- Erreur permanente : plus aucune nouvelle tentative ; badge « Écran appairé ailleurs — à reconfigurer » avec lien `setup.html` ; l'écran garde ses données.
- Erreur temporaire (réseau) : comportement actuel conservé (5 s, 30 s, 2 min puis 60 s).

- [ ] **Step 1: Test** `prochaineExpiration(0) === 7776000000`. **Step 2:** FAIL. **Step 3:** implémenter + mise à jour Firestore dans `refreshDisplayToken`. **Step 4:** `npm test --workspace=functions` PASS.
- [ ] **Step 5:** Modifier `core.js` ; `npm run check:display` OK.
- [ ] **Step 6: Commit** `fix(display): appairage prolongé, plus de boucle quand l'écran est appairé ailleurs`

### Task 8: Bugs bloquants du hub

**Files:**
- Modify: `apps/hub/src/pages/LivreRecettes.tsx:220-240` (déplacer `if (!householdId) return null;` **après** tous les hooks, y compris `useMemo` de `counts`)
- Modify: `apps/hub/src/pages/RecetteCuisine.tsx:314` (`bg-fond-principal text-text-principal` n'existent pas dans Tailwind → `bg-ebony text-cream` ; fond transparent = en-tête visible au travers)
- Test: `apps/hub/src/lib/tailwindClasses.test.ts` — parcourt `src/**/*.tsx` et échoue si une classe `bg-…`/`text-…` utilise un nom de couleur absent de `tailwind.config.ts` (empêche le retour de ce bug).

- [ ] **Step 1: Test** `tailwindClasses.test.ts` → FAIL sur `bg-fond-principal`.
- [ ] **Step 2:** Corriger les deux pages. **Step 3:** `npm test --workspace=hub` PASS ; `npm run build` OK.
- [ ] **Step 4: Vérifier dans Chrome après déploiement** : `/livre-recettes` en accès direct s'affiche ; le mode cuisine couvre l'en-tête.
- [ ] **Step 5: Commit** `fix(hub): Recettes en accès direct, mode cuisine opaque`
