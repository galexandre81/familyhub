# Phase 4 — UX iPad + tuile Réglages display

**Date** : 2026-05-08
**Branche cible** : `phase-4-ipad-ux` (à créer depuis `phase-3-kitchen-buddy` ou `main` après merge de la phase 3)
**Découpage** : 4.1 → 4.3 (validation utilisateur entre chaque sous-phase)

## Contexte

Le display iPad mini 1 (iOS 9.3.6, Safari 9, ES5) est le mode d'usage principal de Family Hub en cuisine. Il est utilisé essentiellement en **mode paysage** (1024×768). Plusieurs problèmes UX sont remontés par l'utilisateur :

1. **Bug scroll recette** : dans le mode cuisine plein écran d'une recette, le scroll interne se coince parfois en bas (impossible de remonter).
2. **Place perdue en landscape** : la plupart des écrans expand sont conçus pour du portrait — colonne centrée étroite avec beaucoup d'espace blanc à gauche/droite.
3. **Menu de la semaine** force du scroll horizontal et vertical alors que l'iPad landscape a la largeur nécessaire.
4. **Tuile Réglages jamais terminée** : 6 thèmes UI existent côté hub web (`apps/hub/src/lib/themes.ts`) mais ne sont **pas appliqués sur le display iPad**. Aucun contrôle de luminosité.

## Cause racine du bug scroll

Le CSS [apps/display/public/css/styles.css](../../../apps/display/public/css/styles.css) impose sur `.tile-overlay-content` :

```css
max-width: 720px;
padding: 32px 36px;
margin-left: auto;
margin-right: auto;
```

Sur iPad landscape, cela crée une colonne centrale de 720px (au lieu des ~952px utilisables). Pour les expand qui rendent leur propre layout (recipe-today, weekly-menu, livre-recettes), ce padding-margin parasite leur structure flex et la combinaison `min-height:0 / overflow-y:auto / -webkit-overflow-scrolling:touch` se retrouve en compétition avec le padding du parent — conditions connues pour déclencher le bug "stuck at bottom" du momentum scroll iOS 9.

## Objectifs

- **4.1** : éliminer les bugs de scroll iPad (recette, menu semaine, livre-recettes).
- **4.2** : optimiser le layout landscape pour mieux utiliser l'espace (2 colonnes là où c'est utile).
- **4.3** : livrer la tuile Réglages côté display avec sélecteur de thème (sync hub) et contrôle de luminosité local.

Non-objectifs :
- Refondre le hub web (les thèmes y fonctionnent déjà).
- Toucher aux Cloud Functions ou aux types Phase 3 (KB*).
- Ajouter de nouvelles tuiles autres que `settings`.

## Architecture

```
apps/display/public/
├── css/styles.css                        ← + classes .theme-* (6) + .tile-overlay-content--full + .tile-settings*
├── index.html                            ← + <script src="js/brightness.js"> + <script src="js/tiles/settings.js">
├── js/
│   ├── brightness.js                     ← NOUVEAU singleton overlay
│   ├── core.js                           ← apply theme au boot via household snapshot
│   └── tiles/
│       ├── recipe-today.js               ← expand → ajoute classe --full + 2-col landscape
│       ├── weekly-menu.js                ← expand → ajoute classe --full + min-width cellules
│       ├── livreRecettes.js              ← expand → ajoute classe --full
│       └── settings.js                   ← NOUVEAU
apps/hub/src/
├── pages/TileEditor.tsx                  ← + entrée "settings" dans le picker de type
packages/types/src/tile.ts                ← + "settings" dans TileType union
```

## Sous-phase 4.1 — Fix bugs scroll

**Livrable** : 1 commit, débloquer l'usage quotidien.

### 4.1.a — Classe modifier `--full`

Ajouter dans [styles.css](../../../apps/display/public/css/styles.css) après `.tile-overlay-content` :

```css
.tile-overlay-content--full {
  max-width: none;
  padding: 0;
  margin-left: 0;
  margin-right: 0;
}
```

Cette classe **opt-in** est ajoutée par les tuiles qui posent leur propre header/body (recipe-today, weekly-menu, livre-recettes). Les tuiles "texte centré" (radio, weather, timer, calendar) gardent le comportement par défaut (max-width 720px, padding agréable).

### 4.1.b — Adoption par les tuiles concernées

- **recipe-today.js** ([apps/display/public/js/tiles/recipe-today.js](../../../apps/display/public/js/tiles/recipe-today.js)) : ligne 306, `container.className = 'tile-overlay-content tile-overlay-content--full tile-recipe-today-expand'`.
- **weekly-menu.js** : idem ligne 214 et dans `showBatchView()`.
- **livreRecettes.js** : si elle pose son propre layout, idem.

### 4.1.c — Anti-rubber-band lock

Sur le scroller principal des tuiles (le `body` interne avec `overflow-y:auto`), ajouter un attribut `data-scroll-lock="1"` et un handler global au boot dans `core.js` :

```js
document.addEventListener('touchmove', function (e) {
  var t = e.target;
  while (t && t !== document.body) {
    if (t.getAttribute && t.getAttribute('data-scroll-lock') === '1') {
      var atTop = t.scrollTop <= 0;
      var atBottom = t.scrollTop + t.clientHeight >= t.scrollHeight;
      if (atTop || atBottom) e.preventDefault();
      return;
    }
    t = t.parentNode;
  }
}, false);
```

Rationale : iOS 9 propage le rubber-band au document parent et bloque le scroller interne. Stop-rebond aux bornes restitue le contrôle.

### 4.1.d — Test sur iPad mini 1

Test manuel obligatoire avant merge :
1. Ouvrir une recette longue (>20 ingrédients ou >10 étapes).
2. Scroller jusqu'en bas → remonter → re-descendre. Doit fonctionner sans blocage.
3. Idem sur le menu de la semaine en landscape : pas de scroll horizontal.

## Sous-phase 4.2 — Layout landscape

**Livrable** : 2-3 commits (un par tuile principale).

### 4.2.a — recipe-today expand en 2 colonnes (landscape ≥900px)

Dans `renderRecette()` ([recipe-today.js](../../../apps/display/public/js/tiles/recipe-today.js#L468)), enrober ingrédients + étapes dans un wrapper :

```js
var twoCol = window.innerWidth >= 900;
var wrapStyle = twoCol
  ? 'display:-webkit-flex; display:flex; gap:32px; padding:20px 24px;'
  : 'padding:16px 20px;';
var ingStyle = twoCol ? 'flex:0 0 320px;' : '';
var etapesStyle = twoCol ? '-webkit-flex:1; flex:1;' : '';
```

`window.innerWidth` lu une fois au render — pas de listener resize (l'iPad ne change pas d'orientation pendant qu'on regarde une recette en pratique). Si l'utilisateur tourne, le layout est réévalué au prochain render (changement de portion, par exemple).

### 4.2.b — weekly-menu : grille fluide

Dans `buildGridUI()` ([weekly-menu.js](../../../apps/display/public/js/tiles/weekly-menu.js#L437)) :
- `gridWrap.style.cssText` : retirer `overflow:auto` (garder `overflow-y:auto` seulement).
- `<table>` : `width:100%`, supprimer `min-width:100px` des `<td>` cellules. Les `<td>` deviennent fluides.
- Augmenter le `font-size` des noms de recettes de 12px à 13px en landscape (lisibilité depuis le plan de travail).

### 4.2.c — Audits ponctuels (best effort)

Passe rapide sur **livreRecettes.js**, **shopping-list.js**, **calendar.js** : repérer les containers à `max-width` ou `min-width` rigides qui gênent en landscape. Patch ciblé seulement si gêne avérée. Ne pas refondre ces tuiles dans cette sous-phase.

### 4.2.d — Tap targets

Tous les boutons interactifs `<button>` (timer, vote, portions, tabs, back) : `min-height:44px` (Apple HIG). Inspection visuelle, ajout du style là où il manque.

## Sous-phase 4.3 — Tuile Réglages display

**Livrable** : 3 commits (a, b, c). Validation utilisateur entre b et c.

### 4.3.a — Thèmes display (CSS + apply au boot)

**Classes CSS** : ajouter dans [styles.css](../../../apps/display/public/css/styles.css) un bloc par thème (sauf "caractere" qui est le défaut) :

```css
html.theme-foret { background:#0E1A16; color:#F0EAD7; }
html.theme-foret body { background:#0E1A16; color:#F0EAD7; }
html.theme-foret .grid-cell { background:#162621; border-color:#2C3E37; }
html.theme-foret .tile-title { color:#D4AF5F; }
html.theme-foret .tile-overlay { background:#0E1A16; }
html.theme-foret .tile-overlay-bar { background:#0F1B17; border-bottom-color:#2C3E37; }
html.theme-foret .tile-overlay-back { color:#D4AF5F; }
/* ... répéter pour marine, bordeaux, glacier, lin */
```

**Pas de variables CSS** (Safari 9 ne supporte pas `--prop`). Duplication brute par thème, ~30 lignes par thème, ~150 lignes total. Acceptable, isolé en fin de fichier sous le commentaire `/* ----- Themes ----- */`.

**Apply au boot** : dans [core.js](../../../apps/display/public/js/core.js), au moment où le snapshot household arrive, appeler :

```js
function applyDisplayTheme(themeId) {
  var html = document.documentElement;
  var classes = html.className.split(/\s+/);
  var kept = [];
  for (var i = 0; i < classes.length; i++) {
    if (classes[i].indexOf('theme-') !== 0) kept.push(classes[i]);
  }
  if (themeId && themeId !== 'caractere') kept.push('theme-' + themeId);
  html.className = kept.join(' ').replace(/\s+/g, ' ').trim();
}
```

Exposer `window.FamilyHubApplyTheme = applyDisplayTheme` pour la tuile settings.

### 4.3.b — Singleton brightness

Nouveau fichier [apps/display/public/js/brightness.js](../../../apps/display/public/js/brightness.js) :

```js
(function (global) {
  'use strict';
  var KEY = 'familyhub.brightness';
  var overlay = null;

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'brightness-overlay';
    overlay.style.cssText =
      'position:fixed; top:0; left:0; right:0; bottom:0; ' +
      'background:#000; pointer-events:none; z-index:1000; opacity:0;';
    document.body.appendChild(overlay);
  }

  function get() {
    var v = parseFloat(localStorage.getItem(KEY) || '0');
    if (isNaN(v) || v < 0) v = 0;
    if (v > 0.6) v = 0.6;
    return v;
  }

  function set(v) {
    if (isNaN(v) || v < 0) v = 0;
    if (v > 0.6) v = 0.6;
    ensureOverlay();
    overlay.style.opacity = String(v);
    try { localStorage.setItem(KEY, String(v)); } catch (e) { /* private mode */ }
  }

  function init() {
    ensureOverlay();
    set(get());
  }

  global.FamilyHubBrightness = { get: get, set: set, init: init };
})(window);
```

Charger dans [index.html](../../../apps/display/public/index.html) après `overlay.js`. Appeler `FamilyHubBrightness.init()` dans `core.js` au boot.

Plage 0..0.6 : au-delà de 0.6 le contenu devient illisible. Limite volontaire.

Stockage **localStorage** (par display) : chaque écran a sa propre lumino — pas de Firestore. Décision motivée par : l'iPad cuisine, le bureau et le mobile ont des conditions d'éclairage différentes.

### 4.3.c — Tuile settings

Nouveau fichier [apps/display/public/js/tiles/settings.js](../../../apps/display/public/js/tiles/settings.js) :

**Compact (`render`)** :
- Titre "Réglages".
- 4 swatches du thème actif (BG, card, accent, text) en mini.
- Barre horizontale représentant le niveau de luminosité (0 à 0.6).
- CTA "Toucher → modifier →".

**Expand (`expand`)** :
- Header `tile-overlay-content--full` (pas de bug scroll).
- Section 1 — **Thème** : grille 3×2 de cards swatches. Au tap : `firestore.update(households/{hid}, {parametres.themeId: id})` + `FamilyHubApplyTheme(id)` immédiat (optimistic). Rollback visuel si échec Firestore.
- Section 2 — **Luminosité** : `<input type="range" min="0" max="60" step="5">` lié à `FamilyHubBrightness.set(value/100)`. Au input : update overlay temps réel.
- Section 3 — **Taille de police** (bonus, si temps) : 3 boutons "Petit / Normal / Grand" qui posent `font-size: 14px / 16px / 18px` sur `<html>`. Stocké en localStorage. NON-OBJECTIF si manque de temps.
- Section 4 — **Infos** : version du display (constante string `DISPLAY_VERSION = '20260508'`), id du display, household id.

**Constantes** : la liste des thèmes est dupliquée dans settings.js (les 6 entrées avec id/nom/preview). On ne charge pas le module hub dans le display (ES5 vs TS). Acceptable : 6 entrées peu volatiles.

### 4.3.d — Hub : type "settings" dans TileEditor

Dans [packages/types/src/tile.ts](../../../packages/types/src/tile.ts), ajouter `'settings'` à l'union `TileType`.

Dans [apps/hub/src/pages/TileEditor.tsx](../../../apps/hub/src/pages/TileEditor.tsx), ajouter une option dans le picker de type avec icône `Settings` (lucide-react). La tuile settings n'a **pas de config spécifique** (juste son placement).

## Data flow

```
Hub web                    Firestore                       Display iPad
─────────                  ─────────                       ────────────
ThemeSelector ───────────► households.parametres.themeId ─► snapshot listener
                                                              ↓
                                                            applyDisplayTheme()
                                                              (CSS class on <html>)

TileEditor ──────────────► tiles[].type = 'settings' ───────► render via settings.js

settings.js (expand)
  └─ tap thème ──────────► households.parametres.themeId
                                                    │
                                                    └──► (autres displays récupèrent au prochain snapshot)

settings.js (slider lumino) ──► localStorage:familyhub.brightness ──► overlay.opacity (local au display)
```

## Tests / vérification

- `npm run build` à la racine doit passer (workspaces : hub, functions, types).
- `npm run typecheck` (si dispo) sur hub + types.
- **Test manuel iPad mini 1** :
  1. Ouvrir recette longue → scroll bas → remonter → re-bas. Pas de blocage.
  2. Menu de la semaine en landscape : 7 jours visibles, pas de scroll horizontal.
  3. Tuile Réglages : changer thème → application immédiate. Slider lumino → overlay s'adapte temps réel.
  4. Recharger le display : thème + lumino persistent.
- **Test cross-device** : changer le thème depuis le hub web → l'iPad bascule au prochain snapshot (~5s via le polling existant).

## Risques & mitigations

| Risque | Probabilité | Mitigation |
|--------|-------------|------------|
| Le `touchmove` global casse le scroll d'autres tuiles | Moyenne | Appliquer le handler **uniquement** aux éléments avec `data-scroll-lock="1"`. Les autres scrollers conservent leur comportement. |
| Les classes `theme-*` cassent le rendu de tuiles existantes | Moyenne | Tester chaque thème sur les 9 tuiles avant merge. Garder le thème "caractere" (vide) comme défaut sûr. |
| iOS 9 ne supporte pas `localStorage` en mode privé | Faible | `try/catch` sur `setItem`, dégradation gracieuse (lumino non persistée mais fonctionne en session). |
| Le 2-col landscape de recipe-today est moche pour des recettes courtes | Faible | `flex:0 0 320px` sur les ingrédients + `flex:1` sur étapes. Recette courte = colonne ingrédients courte mais centrée. À évaluer en test. |
| Le slider HTML5 `<input type=range>` est laid sur Safari 9 | Faible | Safari 9 le supporte (basique). Si moche, fallback boutons +/− (comme le portion picker existant). |

## Découpage commits

- **Commit 4.1** : `fix(display): scroll iPad bloqué — classe --full + anti-rubber-band`
- **Commit 4.2.a** : `feat(display): recipe-today 2-col landscape iPad`
- **Commit 4.2.b** : `feat(display): weekly-menu grille fluide landscape`
- **Commit 4.2.c** : `chore(display): audit landscape autres tuiles`
- **Commit 4.3.a** : `feat(display): 6 thèmes UI sur iPad (sync household)`
- **Commit 4.3.b** : `feat(display): contrôle luminosité (overlay + localStorage)`
- **Commit 4.3.c** : `feat(display): tuile Réglages (thème + lumino)`
- **Commit 4.3.d** : `feat(hub): type tuile "settings" dans TileEditor`

Validation utilisateur attendue après 4.1, après 4.2 (les 3 commits ensemble), après 4.3.b et après 4.3.c.

## Hors scope (à reporter en Phase 5+)

- Variables CSS (Safari 9 ne supporte pas).
- Sync luminosité multi-display (Firestore).
- Thème "auto" jour/nuit basé sur l'heure.
- Personnalisation par display (chaque iPad son thème) — pour l'instant le thème est par household.
- Refonte UX de livre-recettes / shopping-list / calendar (4.2.c reste un audit ponctuel).
