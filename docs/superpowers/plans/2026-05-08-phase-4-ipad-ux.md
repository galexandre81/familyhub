# Phase 4 — UX iPad + tuile Réglages : Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fixer les bugs de scroll iPad sur les tuiles expand, optimiser le layout pour iPad landscape, livrer une tuile « Réglages » sur le display avec sélecteur de thème et contrôle de luminosité.

**Architecture:** Class modifier CSS `.tile-overlay-content--full` (opt-in) pour les tuiles qui posent leur propre layout, anti-rubber-band global sur les scrollers marqués `data-scroll-lock`, 6 thèmes CSS dupliqués depuis le hub vers le display (Safari 9 = pas de variables CSS), singleton brightness via overlay `<div>` + `localStorage` par display, tuile `settings` ES5 vanilla qui sync `parametres.themeId` du household.

**Tech Stack:**
- Display : vanilla ES5 + Firebase v8 compat (iPad mini 1, iOS 9.3.6, Safari 9). Pas de variables CSS, pas de calc(), pas d'arrow functions, pas de `let`/`const`.
- Hub : React 18 + TS + Vite + Tailwind + shadcn/ui.
- Types partagés : `packages/types/`.
- Build : `npm run build` à la racine (workspaces).
- Pas d'infra de test automatisée — vérification = build OK + manual check en navigateur (User Agent Safari 9 simulé) + test sur l'iPad réel pour le merge.

**Spec source:** [docs/superpowers/specs/2026-05-08-phase-4-ipad-ux-design.md](../specs/2026-05-08-phase-4-ipad-ux-design.md)

---

## Préalables

### Setup d'environnement de vérification

Avant de commencer, ouvrir un navigateur Chrome avec :
- **DevTools → Toggle device toolbar → "iPad Mini" preset** (mais en landscape : 1024×768).
- **Network throttling : aucun** (pour ne pas masquer les bugs de timing).
- Tu lanceras `npm run dev:hub` qui sert à la fois le hub web (`localhost:5173`) ET le display (`localhost:5173/display/`) via le script `copy-display-into-hub-dist.mjs`.
- **ATTENTION** : `dev:hub` ne lance pas la copie display. Pour tester le display en dev, ouvre directement `apps/display/public/index.html` dans Chrome (pas de transpile, c'est du vanilla statique). Auth Firebase se fera contre la prod si les tokens locaux sont valides.

### Branche

Créer la branche depuis l'état actuel :

```bash
cd "/c/Users/guill/Desktop/family hub"
git checkout -b phase-4-ipad-ux
```

(Si l'utilisateur a déjà décidé une autre branche en pré-discussion, suivre sa décision.)

---

## File Structure

| Fichier | Rôle | Tasks |
|---------|------|-------|
| `apps/display/public/css/styles.css` | Classe `--full`, anti-rubber-band CSS, 6 thèmes | T1, T6, T7 |
| `apps/display/public/js/core.js` | Apply theme + init brightness + anti-rubber-band JS | T3, T8, T9 |
| `apps/display/public/js/brightness.js` | NEW : singleton overlay + localStorage | T9 |
| `apps/display/public/js/tiles/recipe-today.js` | `--full` + 2-col landscape | T2, T4 |
| `apps/display/public/js/tiles/weekly-menu.js` | `--full` + grille fluide | T2, T5 |
| `apps/display/public/js/tiles/livreRecettes.js` | `--full` (audit ponctuel) | T2 |
| `apps/display/public/js/tiles/settings.js` | NEW : tuile Réglages (compact + expand) | T10 |
| `apps/display/public/index.html` | Tags `<script>` brightness.js + settings.js | T9, T10 |
| `packages/types/src/tile.ts` | `'settings'` dans union TileType | T11 |
| `apps/hub/src/pages/TileEditor.tsx` | Entrée settings dans le picker | T12 |

---

## Sous-phase 4.1 — Fix bugs scroll

### Task 1 : Ajouter la classe CSS `.tile-overlay-content--full`

**Files:**
- Modify: `apps/display/public/css/styles.css` (insertion juste après le bloc `.tile-overlay-content`, vers la ligne 530)

- [ ] **Step 1 : Lire le bloc existant**

```bash
# Lire les lignes 517 à 530 de styles.css pour bien situer l'insertion
```

Le bloc actuel :

```css
.tile-overlay-content {
  -webkit-flex: 1;
  flex: 1;
  overflow: auto;
  padding: 32px 36px;
  display: -webkit-flex;
  display: flex;
  -webkit-flex-direction: column;
  flex-direction: column;
  max-width: 720px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
}
```

- [ ] **Step 2 : Ajouter le modifier juste après**

Insérer avant `.tile-overlay-h1` (ligne ~531) :

```css
/* Modifier opt-in : pour les expand qui posent leur propre layout
   (recipe-today, weekly-menu, livre-recettes). Retire le max-width
   et le padding du container parent — le module gère son propre header
   et son propre body scrollable interne. */
.tile-overlay-content--full {
  max-width: none;
  padding: 0;
  margin-left: 0;
  margin-right: 0;
}
```

- [ ] **Step 3 : Vérifier visuellement que rien d'autre n'est cassé**

Ouvrir `apps/display/public/index.html` dans Chrome iPad simulé. Le display devrait rendre la grille normalement (la classe n'est pas encore appliquée par les tuiles). Aucun changement visuel attendu à cette étape.

- [ ] **Step 4 : Commit**

```bash
git add apps/display/public/css/styles.css
git commit -m "$(cat <<'EOF'
feat(display): classe CSS .tile-overlay-content--full pour expand fullbleed

Modifier opt-in qui retire max-width:720px et padding du container overlay,
pour les tuiles qui posent leur propre layout (recipe-today, weekly-menu,
livre-recettes). Cause racine du bug scroll bloqué sur iPad : le padding
du parent gênait le min-height:0 / overflow:auto / -webkit-overflow-scrolling
des scrollers internes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2 : Appliquer `--full` dans recipe-today, weekly-menu, livreRecettes

**Files:**
- Modify: `apps/display/public/js/tiles/recipe-today.js:306`
- Modify: `apps/display/public/js/tiles/weekly-menu.js:214`
- Modify: `apps/display/public/js/tiles/weekly-menu.js` (showBatchView, ligne ~259, et showRecetteForSlot quand il appelle recipe-today.expand)
- Modify: `apps/display/public/js/tiles/livreRecettes.js` (vérifier où l'expand pose son className)

- [ ] **Step 1 : recipe-today.js — modifier le className de l'expand**

Ligne 306 :

```js
// AVANT
container.className = 'tile-overlay-content tile-recipe-today-expand';

// APRÈS
container.className = 'tile-overlay-content tile-overlay-content--full tile-recipe-today-expand';
```

- [ ] **Step 2 : weekly-menu.js — modifier dans expand() et dans showBatchView()**

Ligne 214 (`expand()`) :

```js
container.className = 'tile-overlay-content tile-overlay-content--full tile-weekly-menu-expand';
```

Dans `showBatchView()` (autour de la ligne 259, où le container est reset), s'assurer que le className inclut `--full`. Comme `showBatchView()` ne touche pas explicitement à `container.className` (il utilise juste `container.style.cssText = ...`), la classe posée par `expand()` reste — vérifier visuellement quand même au step 5.

Pour `showRecetteForSlot()` (ligne ~354) : il appelle `global.Tiles['recipe-today'].expand(container, ...)` qui re-set le className → `--full` est conservé via le fix recipe-today. OK.

- [ ] **Step 3 : livreRecettes.js — chercher l'expand**

```bash
# Vérifier où le className est posé
grep -n "tile-overlay-content" apps/display/public/js/tiles/livreRecettes.js
grep -n "container.className" apps/display/public/js/tiles/livreRecettes.js
```

Si la fonction `expand()` pose `container.className = 'tile-overlay-content tile-livre-...'`, ajouter `tile-overlay-content--full` au milieu. Si livreRecettes n'a pas d'expand custom (juste un overlay générique avec contenu fluide), laisser tel quel et noter pour Task 6.

- [ ] **Step 4 : Vérifier le build**

```bash
cd "/c/Users/guill/Desktop/family hub"
npm run build
```

Expected : build passe sans erreur. Le display est statique, mais le hub copie le contenu de `apps/display/public/` via `scripts/copy-display-into-hub-dist.mjs`.

- [ ] **Step 5 : Vérification visuelle (Chrome iPad simulé landscape)**

1. Ouvrir le display en local (auth Firebase existante).
2. Ouvrir une recette du jour (recipe-today expand) → le contenu doit s'étaler **pleine largeur** (≥900px utilisables sur iPad landscape), plus de bordures vides à gauche/droite.
3. Ouvrir le menu de la semaine expand → grille pleine largeur.
4. Ouvrir le livre de recettes expand → vérifier que le rendu reste correct (ne pas casser l'existant).

Si le rendu de livre-recettes est dégradé après l'ajout de `--full`, retirer la classe pour livreRecettes.js et noter pour Task 6 (audit).

- [ ] **Step 6 : Commit**

```bash
git add apps/display/public/js/tiles/recipe-today.js apps/display/public/js/tiles/weekly-menu.js apps/display/public/js/tiles/livreRecettes.js
git commit -m "$(cat <<'EOF'
feat(display): adopter .tile-overlay-content--full sur recipe-today, weekly-menu, livre-recettes

Les expand de ces tuiles posent leur propre layout (header sticky + body
scrollable interne). Le max-width:720px du parent les comprimait en colonne
centrée et causait le bug scroll iOS 9 (rubber-band stuck at bottom).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3 : Anti-rubber-band global sur les scrollers `data-scroll-lock`

**Files:**
- Modify: `apps/display/public/js/core.js` (ajouter handler dans `boot()`)
- Modify: `apps/display/public/js/tiles/recipe-today.js` (poser `data-scroll-lock="1"` sur le body interne)
- Modify: `apps/display/public/js/tiles/weekly-menu.js` (poser `data-scroll-lock="1"` sur les scrollers)

- [ ] **Step 1 : Ajouter le handler global dans core.js**

Dans `boot()` (vers la ligne 364, juste après `cleanUrl()`), insérer :

```js
/* Anti-rubber-band iOS 9 : sur les scrollers marqués data-scroll-lock="1",
   bloquer le touchmove aux bornes (top/bottom) pour empêcher le rebond
   parent qui peut coincer le momentum interne. Opt-in : seulement les
   éléments qui posent l'attribut. */
setupScrollLock();

```

Puis ajouter la fonction (avant `function boot()`, vers la ligne 360) :

```js
function setupScrollLock() {
  document.addEventListener('touchmove', function (e) {
    var t = e.target;
    while (t && t !== document.body && t.nodeType === 1) {
      if (t.getAttribute && t.getAttribute('data-scroll-lock') === '1') {
        var atTop = t.scrollTop <= 0;
        var atBottom = (t.scrollTop + t.clientHeight) >= t.scrollHeight;
        if (atTop || atBottom) {
          /* On laisse passer un epsilon pour que le scroll interne démarre
             si on est pile à 0 et qu'on swipe vers le haut (=> bottom) */
          if (atTop && atBottom) return; /* contenu plus court que le scroller : aucun scroll possible, on bloque tout */
          if (atTop) {
            /* Au top, on ne bloque que les swipes vers le bas (rubber-band) */
            if (e.touches && e.touches[0] && t._lastY != null && e.touches[0].clientY > t._lastY) {
              e.preventDefault();
            }
          }
          if (atBottom) {
            if (e.touches && e.touches[0] && t._lastY != null && e.touches[0].clientY < t._lastY) {
              e.preventDefault();
            }
          }
        }
        if (e.touches && e.touches[0]) t._lastY = e.touches[0].clientY;
        return;
      }
      t = t.parentNode;
    }
  }, false);

  /* Reset _lastY au touchstart pour ne pas comparer entre 2 gestes distincts */
  document.addEventListener('touchstart', function (e) {
    var t = e.target;
    while (t && t !== document.body && t.nodeType === 1) {
      if (t.getAttribute && t.getAttribute('data-scroll-lock') === '1') {
        if (e.touches && e.touches[0]) t._lastY = e.touches[0].clientY;
        return;
      }
      t = t.parentNode;
    }
  }, false);
}
```

- [ ] **Step 2 : Marquer le scroller dans recipe-today.js**

Ligne ~452 (le `body` créé dans `expand()`), ajouter l'attribut juste après `body.id = 'rt-body';` :

```js
body.id = 'rt-body';
body.setAttribute('data-scroll-lock', '1');
```

- [ ] **Step 3 : Marquer les scrollers dans weekly-menu.js**

Dans `expand()` → le `gridWrap` (ligne ~497) :

```js
gridWrap.setAttribute('data-scroll-lock', '1');
```

Dans `showBatchView()` → le `body` (ligne ~291) :

```js
body.setAttribute('data-scroll-lock', '1');
```

- [ ] **Step 4 : Vérifier syntaxe ES5**

Relire le code ajouté :
- Pas de `const`/`let` → seulement `var`. ✓
- Pas de fonctions fléchées → uniquement `function`. ✓
- Pas de `Array.from`, `Object.entries`, etc. (ES6+) → seulement APIs ES5. ✓
- `Element.prototype.getAttribute` est OK iOS 9.

- [ ] **Step 5 : Vérification visuelle (Chrome iPad simulé)**

1. Ouvrir une recette longue (>10 étapes).
2. Scroller jusqu'en bas via touch (en mode device toolbar Chrome).
3. Au bas, swiper encore vers le haut (geste qui voudrait rubber-band) → la page parent ne doit pas bouger, le scroller interne reste en place.
4. Re-scroller vers le haut → fonctionne normalement.

**À noter** : le bug ne se reproduit fiablement que sur iPad mini 1 réel. Chrome simulé ne montre pas toujours le rubber-band stuck. Le fix sera validé définitivement par le test manuel sur iPad de l'utilisateur.

- [ ] **Step 6 : Commit**

```bash
git add apps/display/public/js/core.js apps/display/public/js/tiles/recipe-today.js apps/display/public/js/tiles/weekly-menu.js
git commit -m "$(cat <<'EOF'
fix(display): anti-rubber-band iOS 9 sur scrollers data-scroll-lock

Sur iPad mini 1 (iOS 9.3.6), le momentum scroll interne se coince parfois
en bas d'un scroller (recette longue, batch cooking). Le rubber-band parent
prend la main et bloque le retour. Fix : handler touchmove global qui
preventDefault aux bornes des scrollers explicitement marqués (opt-in).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Validation utilisateur après Task 3** : tester sur l'iPad réel avant de continuer la sous-phase 4.2.

---

## Sous-phase 4.2 — Layout landscape

### Task 4 : recipe-today expand en 2 colonnes (landscape ≥900px)

**Files:**
- Modify: `apps/display/public/js/tiles/recipe-today.js` (fonction `renderRecette()` lignes 468-577)

- [ ] **Step 1 : Repérer la zone à modifier**

Dans `renderRecette()`, le `html` est construit en linéaire : description → ingrédients → étapes. On va transformer le `body.innerHTML` en 2 sections, encadrées par un wrapper flex en landscape.

- [ ] **Step 2 : Réécrire la construction du html**

Remplacer le bloc qui va de `var html = '';` (ligne ~498) jusqu'à `document.getElementById('rt-body').innerHTML = html;` (ligne ~553) par :

```js
var twoCol = window.innerWidth >= 900;

var html = '';
if (r.description) {
  html += '<p style="font-style:italic; opacity:0.85; margin-bottom:18px;">' +
            escapeHtml(r.description) + '</p>';
}

/* Wrapper 2-col landscape / 1-col portrait */
if (twoCol) {
  html += '<div style="display:-webkit-flex; display:flex; gap:32px;">';
  html += '<div style="-webkit-flex:0 0 320px; flex:0 0 320px;">';
} else {
  html += '<div>';
}

/* Ingredients */
html += '<h3 style="font-size:15px; letter-spacing:0.15em; text-transform:uppercase; opacity:0.7; margin-bottom:8px;">Ingrédients</h3>';
html += '<ul style="list-style:none; padding:0; margin:0 0 24px 0;">';
var ings = r.ingredients || [];
for (var i = 0; i < ings.length; i++) {
  var ing = ings[i];
  var qty = scaleQuantite(ing.quantite, ratio);
  var qtyStr = (qty != null && qty !== '') ? (qty + ' ' + (ing.unite || '')) : (ing.unite || '');
  var frigoBadge = ing.noteFrigo
    ? '<span style="margin-left:6px; padding:1px 6px; background:rgba(125,159,118,0.2); color:#7D9F76; font-size:10px; border-radius:3px;">FRIGO</span>'
    : '';
  html += '<li style="padding:4px 0; border-bottom:1px solid rgba(217,160,91,0.08); font-size:15px;">' +
            '<span style="font-weight:600; min-width:80px; display:inline-block;">' + escapeHtml(qtyStr.trim()) + '</span> · ' +
            escapeHtml(ing.libelle || '') +
            frigoBadge +
          '</li>';
}
html += '</ul>';

if (twoCol) {
  html += '</div>';                 /* fin colonne ingrédients */
  html += '<div style="-webkit-flex:1; flex:1;">';  /* début colonne étapes */
}

/* Etapes */
html += '<h3 style="font-size:15px; letter-spacing:0.15em; text-transform:uppercase; opacity:0.7; margin-bottom:12px;">Étapes</h3>';
html += '<ol style="list-style:none; padding:0; margin:0; counter-reset:step;">';
var etapes = (r.etapes || []).slice().sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); });
for (var s = 0; s < etapes.length; s++) {
  var e = etapes[s];
  var stepNum = s + 1;
  var timerBtn = '';
  if (e.dureeMinutes && e.dureeMinutes > 0) {
    timerBtn =
      '<button type="button" class="rt-timer-btn" data-step-idx="' + s + '" ' +
        'data-duration="' + e.dureeMinutes + '" data-recette-nom="' + escapeHtml(r.nom || '') + '" ' +
        'style="margin-top:8px; padding:8px 14px; background:#D9A05B; color:#1F1A14; ' +
        'border:none; border-radius:4px; font-size:13px; font-weight:600; min-height:44px; ' +
        'display:-webkit-inline-flex; display:inline-flex; -webkit-align-items:center; align-items:center; gap:6px;">' +
        svgHourglass(16).replace('#D9A05B', '#1F1A14') +
        '<span>Timer ' + e.dureeMinutes + ' min</span>' +
      '</button>';
  }
  html += '<li style="display:-webkit-flex; display:flex; gap:12px; padding:14px 0; border-bottom:1px solid rgba(217,160,91,0.08);">' +
            '<div style="flex-shrink:0; width:32px; height:32px; border-radius:50%; background:rgba(217,160,91,0.15); ' +
                    'color:#D9A05B; line-height:32px; text-align:center; font-weight:600; font-size:14px;">' + stepNum + '</div>' +
            '<div style="-webkit-flex:1; flex:1;">' +
              '<div style="font-size:15px; line-height:1.5;">' + escapeHtml(e.description || '') + '</div>' +
              timerBtn +
            '</div>' +
          '</li>';
}
html += '</ol>';

html += '</div>';  /* fin div étapes (ou div unique en portrait) */
if (twoCol) {
  html += '</div>';  /* fin wrapper flex */
}

document.getElementById('rt-body').innerHTML = html;
```

Note : j'ai aussi ajouté `min-height:44px` au timer button (HIG iOS).

- [ ] **Step 3 : Vérifier le padding du body interne**

Le body recipe-today (ligne 449) a `padding:20px`. En landscape avec 2 colonnes, ce padding s'applique à l'ensemble — c'est bon. Pas de changement nécessaire.

- [ ] **Step 4 : Build + vérification visuelle**

```bash
npm run build
```

Vérifier en Chrome iPad simulé landscape (1024×768) :
1. Ouvrir une recette → ingrédients à gauche (~320px), étapes à droite (flex 1).
2. Tourner en portrait (768×1024 dans le simulateur) → fermer la recette, rouvrir → 1 colonne.

**Limitation connue** : le layout est figé au moment du `renderRecette()`. Si l'utilisateur tourne l'iPad pendant qu'il lit une recette, il faut rouvrir pour voir le nouveau layout. Acceptable (cas rare).

- [ ] **Step 5 : Commit**

```bash
git add apps/display/public/js/tiles/recipe-today.js
git commit -m "$(cat <<'EOF'
feat(display): recipe-today expand 2 colonnes en landscape iPad

Split ingrédients (320px fixe) / étapes (flex:1) quand window.innerWidth >= 900.
Fallback 1 colonne en portrait. Layout figé au render — re-render au prochain
changement de portion ou réouverture (cas rotation = rouvrir la recette).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5 : weekly-menu — grille fluide landscape

**Files:**
- Modify: `apps/display/public/js/tiles/weekly-menu.js` (fonction `buildGridUI()` lignes 437-593)

- [ ] **Step 1 : Retirer le scroll horizontal du wrapper**

Ligne ~497, modifier `gridWrap.style.cssText` :

```js
// AVANT
gridWrap.style.cssText =
  'padding:16px 20px; overflow:auto; -webkit-overflow-scrolling:touch; ' +
  '-webkit-flex:1 1 auto; flex:1 1 auto; min-height:0;';

// APRÈS
gridWrap.style.cssText =
  'padding:16px 20px; overflow-y:auto; overflow-x:hidden; ' +
  '-webkit-overflow-scrolling:touch; ' +
  '-webkit-flex:1 1 auto; flex:1 1 auto; min-height:0;';
```

- [ ] **Step 2 : Rendre les cellules fluides**

Ligne ~503, modifier le style de la table :

```js
table.style.cssText = 'width:100%; border-collapse:separate; border-spacing:6px; font-size:12px; table-layout:fixed;';
```

Ajout de `table-layout:fixed` : force les colonnes à se partager équitablement (1 col label + 7 jours = 8 colonnes ~125px chacune en landscape).

Ligne ~552, retirer le `min-width:100px` du cell.cssText :

```js
// AVANT
cell.style.cssText =
  'padding:8px 6px; vertical-align:top; min-width:100px; ' +
  ...

// APRÈS
cell.style.cssText =
  'padding:8px 6px; vertical-align:top; ' +
  ...
```

- [ ] **Step 3 : Augmenter le font-size des noms de recettes en landscape**

Ligne ~571, dans la boucle qui construit le html du contenu cell :

```js
// AVANT
html += '<div style="font-size:12px; line-height:1.3; margin-bottom:' +
        ...

// APRÈS
var cellFontSize = window.innerWidth >= 900 ? '13px' : '11px';
html += '<div style="font-size:' + cellFontSize + '; line-height:1.3; margin-bottom:' +
        ...
```

(Variable déclarée juste avant la boucle des cellules, à factoriser au début de buildGridUI.)

- [ ] **Step 4 : Build + vérification visuelle**

```bash
npm run build
```

Chrome iPad simulé landscape :
1. Ouvrir le menu de la semaine.
2. Vérifier : les 7 jours sont visibles **sans scroll horizontal**.
3. Le scroll vertical fonctionne (si la grille dépasse en hauteur, ce qui est rare avec 4 lignes).

- [ ] **Step 5 : Commit**

```bash
git add apps/display/public/js/tiles/weekly-menu.js
git commit -m "$(cat <<'EOF'
feat(display): weekly-menu grille fluide en landscape (plus de scroll H)

table-layout:fixed + suppression du min-width:100px sur les cellules : les
7 jours se partagent équitablement la largeur disponible. Font-size
augmenté à 13px en landscape (lisibilité depuis le plan de travail).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6 : Audit ponctuel + tap targets 44px

**Files:**
- Modify: `apps/display/public/js/tiles/livreRecettes.js` (audit, fix si nécessaire)
- Modify: `apps/display/public/js/tiles/shopping-list.js` (audit, fix si nécessaire)
- Modify: `apps/display/public/js/tiles/calendar.js` (audit, fix si nécessaire)
- Modify: `apps/display/public/js/tiles/recipe-today.js` (tap targets boutons portion + tabs + back)
- Modify: `apps/display/public/js/tiles/weekly-menu.js` (tap targets back, batch button)

- [ ] **Step 1 : Audit livreRecettes.js**

```bash
grep -n "max-width\|min-width" apps/display/public/js/tiles/livreRecettes.js
```

Pour chaque match, juger : impact en landscape iPad ? Si oui, retirer ou ajuster (avec commentaire `/* iPad landscape: ... */`).

- [ ] **Step 2 : Audit shopping-list.js**

Idem :

```bash
grep -n "max-width\|min-width" apps/display/public/js/tiles/shopping-list.js
```

Décider au cas par cas. Best-effort, ne pas refondre.

- [ ] **Step 3 : Audit calendar.js**

Idem :

```bash
grep -n "max-width\|min-width" apps/display/public/js/tiles/calendar.js
```

- [ ] **Step 4 : Tap targets recipe-today**

Dans `expand()`, les boutons portion (lignes 423-426) :

```js
// AVANT
'<button type="button" data-act="minus" style="width:36px; height:36px; ...
'<button type="button" data-act="plus" style="width:36px; height:36px; ...

// APRÈS
'<button type="button" data-act="minus" style="width:44px; height:44px; ...
'<button type="button" data-act="plus" style="width:44px; height:44px; ...
```

Vote buttons (renderVoteButtons, ligne 595) : `padding:6px 10px` → `padding:10px 14px; min-height:44px`.

Tabs recettes (ligne ~403) : `padding:8px 14px` → `padding:12px 18px; min-height:44px`.

- [ ] **Step 5 : Tap targets weekly-menu**

Bouton batch (ligne ~462) : ajouter `min-height:44px` au style.

Bouton back (showBatchView, ligne ~272) : ajouter `min-height:44px`.

- [ ] **Step 6 : Build + vérif visuelle**

```bash
npm run build
```

Chrome iPad simulé : tous les boutons interactifs doivent faire ≥44px en hauteur.

- [ ] **Step 7 : Commit**

```bash
git add apps/display/public/js/tiles/
git commit -m "$(cat <<'EOF'
chore(display): audit landscape autres tuiles + tap targets 44px (HIG iOS)

Audit ponctuel livreRecettes / shopping-list / calendar pour les
contraintes max-width/min-width gênantes en landscape. Mise à 44px de
hauteur min des boutons interactifs (portions, tabs, vote, batch, back)
selon Apple Human Interface Guidelines.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Validation utilisateur après Task 6** : tester l'iPad réel sur les 3 tuiles auditées avant de passer à 4.3.

---

## Sous-phase 4.3 — Tuile Réglages

### Task 7 : Ajouter les 6 thèmes dans styles.css

**Files:**
- Modify: `apps/display/public/css/styles.css` (insertion à la fin du fichier, après le dernier bloc)

- [ ] **Step 1 : Identifier les couleurs par thème**

Source de vérité : [apps/hub/src/lib/themes.ts](../../../apps/hub/src/lib/themes.ts). Les 6 thèmes :

| ID | bg | card | accent | text | border |
|----|----|----|--------|------|--------|
| caractere (default, vide) | #0F0D0A | #1C1815 | #D9A05B | #F2E8D5 | #3A2E22 |
| foret | #0E1A16 | #162621 | #D4AF5F | #F0EAD7 | #2C3E37 |
| marine | #0B1220 | #131E32 | #E09160 | #EAE0C7 | #2A3850 |
| bordeaux | #1A0C0E | #2C161A | #D6A07C | #F4E8DB | #4A2932 |
| glacier | #101620 | #1E2836 | #AEBCD2 | #E8F0F8 | #2F3D52 |
| lin (clair) | #F8F0DE | #FFFAF0 | #B26E38 | #3C2A1A | #D4C7AC |

- [ ] **Step 2 : Ajouter le bloc thèmes en fin de styles.css**

À la fin de `apps/display/public/css/styles.css`, ajouter :

```css

/* ===========================================================================
   THEMES — synchro avec apps/hub/src/lib/themes.ts (6 entrées).
   Pas de variables CSS (Safari 9 ne les supporte pas), duplication brute.
   La classe est posée sur <html> par core.js au boot et au snapshot household.
   =========================================================================== */

/* ----- Forêt ----- */
html.theme-foret,
html.theme-foret body { background:#0E1A16; color:#F0EAD7; }
html.theme-foret .grid-cell { background:#162621; border-color:#2C3E37; }
html.theme-foret .tile-title { color:#D4AF5F; }
html.theme-foret .tile-overlay { background:#0E1A16; }
html.theme-foret .tile-overlay-bar { background:#0F1B17; border-bottom-color:#2C3E37; }
html.theme-foret .tile-overlay-back { color:#D4AF5F; }
html.theme-foret .boot-title,
html.theme-foret .error-title { color:#D4AF5F; }
html.theme-foret .error-link { background:#D4AF5F; color:#0E1A16; }

/* ----- Marine ----- */
html.theme-marine,
html.theme-marine body { background:#0B1220; color:#EAE0C7; }
html.theme-marine .grid-cell { background:#131E32; border-color:#2A3850; }
html.theme-marine .tile-title { color:#E09160; }
html.theme-marine .tile-overlay { background:#0B1220; }
html.theme-marine .tile-overlay-bar { background:#0C1426; border-bottom-color:#2A3850; }
html.theme-marine .tile-overlay-back { color:#E09160; }
html.theme-marine .boot-title,
html.theme-marine .error-title { color:#E09160; }
html.theme-marine .error-link { background:#E09160; color:#0B1220; }

/* ----- Bordeaux ----- */
html.theme-bordeaux,
html.theme-bordeaux body { background:#1A0C0E; color:#F4E8DB; }
html.theme-bordeaux .grid-cell { background:#2C161A; border-color:#4A2932; }
html.theme-bordeaux .tile-title { color:#D6A07C; }
html.theme-bordeaux .tile-overlay { background:#1A0C0E; }
html.theme-bordeaux .tile-overlay-bar { background:#1C0E10; border-bottom-color:#4A2932; }
html.theme-bordeaux .tile-overlay-back { color:#D6A07C; }
html.theme-bordeaux .boot-title,
html.theme-bordeaux .error-title { color:#D6A07C; }
html.theme-bordeaux .error-link { background:#D6A07C; color:#1A0C0E; }

/* ----- Glacier ----- */
html.theme-glacier,
html.theme-glacier body { background:#101620; color:#E8F0F8; }
html.theme-glacier .grid-cell { background:#1E2836; border-color:#2F3D52; }
html.theme-glacier .tile-title { color:#AEBCD2; }
html.theme-glacier .tile-overlay { background:#101620; }
html.theme-glacier .tile-overlay-bar { background:#121824; border-bottom-color:#2F3D52; }
html.theme-glacier .tile-overlay-back { color:#AEBCD2; }
html.theme-glacier .boot-title,
html.theme-glacier .error-title { color:#AEBCD2; }
html.theme-glacier .error-link { background:#AEBCD2; color:#101620; }

/* ----- Lin (clair) ----- */
html.theme-lin,
html.theme-lin body { background:#F8F0DE; color:#3C2A1A; }
html.theme-lin .grid-cell { background:#FFFAF0; border-color:#D4C7AC; }
html.theme-lin .tile-title { color:#B26E38; }
html.theme-lin .tile-overlay { background:#F8F0DE; }
html.theme-lin .tile-overlay-bar { background:#FCF6E6; border-bottom-color:#D4C7AC; }
html.theme-lin .tile-overlay-back { color:#B26E38; }
html.theme-lin .boot-title,
html.theme-lin .error-title { color:#B26E38; }
html.theme-lin .error-link { background:#B26E38; color:#F8F0DE; }
```

- [ ] **Step 3 : Bumper le query string de version**

Dans `apps/display/public/index.html`, le `<link rel="stylesheet" href="css/styles.css?v=20260505e">`. Bumper à `?v=20260508a` pour forcer iOS 9 à re-fetch (cache agressif).

- [ ] **Step 4 : Vérification visuelle**

Ouvrir le display, ajouter manuellement la classe via DevTools Console :

```js
document.documentElement.className = 'theme-foret';
```

Le fond doit passer en vert sombre, l'accent en or chaud. Tester chaque thème (`theme-marine`, `theme-bordeaux`, `theme-glacier`, `theme-lin`).

Retirer manuellement (`document.documentElement.className = '';`) → retour au défaut Caractère.

- [ ] **Step 5 : Commit**

```bash
git add apps/display/public/css/styles.css apps/display/public/index.html
git commit -m "$(cat <<'EOF'
feat(display): 6 thèmes CSS (Caractère, Forêt, Marine, Bordeaux, Glacier, Lin)

Synchro avec apps/hub/src/lib/themes.ts. Duplication brute (Safari 9 ne
supporte pas les variables CSS). Application via classe sur <html>.
Bump version CSS pour forcer le cache iOS 9.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8 : Apply theme au boot + listener live (core.js)

**Files:**
- Modify: `apps/display/public/js/core.js` (ajout `applyDisplayTheme`, fetch household, listener)

- [ ] **Step 1 : Ajouter les champs au `state`**

Dans l'objet `state` au début du fichier (ligne ~16), ajouter deux nouveaux champs :

```js
var state = {
  db: null,
  functions: null,
  auth: null,
  householdId: null,
  displayId: null,
  cellsByTileId: {},
  tilesById: {},
  snapshotUnsub: null,
  displayConfig: null,
  // NOUVEAUX :
  householdConfig: null,
  householdUnsub: null,
  appliedThemeId: null
};
```

- [ ] **Step 2 : Ajouter `applyDisplayTheme()` exposé globalement**

Avant `function boot()` dans core.js, ajouter :

```js
/* Applique un thème sur <html>. Retire d'abord toute classe theme-*
   présente. Vide / 'caractere' = thème par défaut (pas de classe). */
function applyDisplayTheme(themeId) {
  var html = document.documentElement;
  var classes = (html.className || '').split(/\s+/);
  var kept = [];
  for (var i = 0; i < classes.length; i++) {
    var c = classes[i];
    if (!c) continue;
    if (c.indexOf('theme-') === 0) continue;
    kept.push(c);
  }
  if (themeId && themeId !== 'caractere') {
    kept.push('theme-' + themeId);
  }
  html.className = kept.join(' ');
  state.appliedThemeId = themeId || 'caractere';
}

/* Exposé pour la tuile settings */
window.FamilyHubApplyTheme = applyDisplayTheme;
```

- [ ] **Step 3 : Lire `parametres.themeId` dans `loadDisplayAndTiles()`**

Modifier la fonction (ligne 209) :

```js
function loadDisplayAndTiles() {
  var hid = state.householdId;
  var did = state.displayId;
  var householdRef = state.db.collection('households').doc(hid);
  var displayRef = householdRef.collection('displays').doc(did);
  var tilesRef = householdRef.collection('tiles');

  setStatus('Chargement de la configuration…');
  return householdRef.get().then(function (hSnap) {
    if (hSnap.exists) {
      var hData = hSnap.data() || {};
      state.householdConfig = hData;
      var themeId = hData.parametres && hData.parametres.themeId;
      applyDisplayTheme(themeId);
    }
    return displayRef.get();
  }).then(function (snap) {
    if (!snap.exists) throw new Error('Display introuvable');
    state.displayConfig = snap.data();
    return tilesRef.get();
  }).then(function (tilesSnap) {
    var byId = {};
    tilesSnap.forEach(function (doc) { byId[doc.id] = doc.data(); });
    state.tilesById = byId;
    renderInitialGrid();
    attachSnapshotListener(displayRef);
    attachDisplayConfigListener(displayRef);
    attachHouseholdListener(householdRef);
    if (window.FamilyHubTimers) {
      window.FamilyHubTimers.init(state.db, hid);
    }
  });
}
```

- [ ] **Step 4 : Listener live sur le household**

Ajouter la fonction à côté de `attachDisplayConfigListener` :

```js
/* Listener live sur le doc household — détecte changement de thème
   pushé depuis le hub web. Re-applique sans reload. */
function attachHouseholdListener(householdRef) {
  if (state.householdUnsub) state.householdUnsub();
  state.householdUnsub = householdRef.onSnapshot(function (snap) {
    if (!snap.exists) return;
    var data = snap.data() || {};
    state.householdConfig = data;
    var newThemeId = (data.parametres && data.parametres.themeId) || 'caractere';
    if (newThemeId !== state.appliedThemeId) {
      applyDisplayTheme(newThemeId);
    }
  }, function (err) {
    if (window.console && window.console.error) window.console.error('household listener', err);
  });
}
```

- [ ] **Step 5 : Vérification visuelle**

1. Ouvrir le display.
2. Le thème actuel du household doit s'appliquer immédiatement au boot (vérifier en regardant `parametres.themeId` dans Firestore).
3. Depuis le hub web, changer le thème (Paramètres → Thème de l'interface).
4. **Sur le display**, dans les ~2 secondes (latence Firestore), le thème change sans reload.

- [ ] **Step 6 : Commit**

```bash
git add apps/display/public/js/core.js
git commit -m "$(cat <<'EOF'
feat(display): apply theme household au boot + listener live

Lit households/{hid}.parametres.themeId au boot et pose la classe theme-*
sur <html>. Listener onSnapshot pour répercuter en live les changements
pushés depuis le hub web (Paramètres → Thème de l'interface).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9 : Singleton brightness (overlay + localStorage)

**Files:**
- Create: `apps/display/public/js/brightness.js`
- Modify: `apps/display/public/index.html` (ajouter `<script>`)
- Modify: `apps/display/public/js/core.js` (init au boot)

- [ ] **Step 1 : Créer `apps/display/public/js/brightness.js`**

Contenu complet :

```js
/* brightness.js — singleton de contrôle de luminosité du display.
   Crée un overlay <div> noir plein écran avec opacity 0..0.6 par-dessus
   tout le contenu (z-index élevé, pointer-events:none → pas d'interception
   des clics). Valeur stockée en localStorage par display. ES5, iOS 9 OK. */
(function (global) {
  'use strict';

  var KEY = 'familyhub.brightness';
  var MAX_DIM = 0.6;
  var overlay = null;

  function clamp(v) {
    if (typeof v !== 'number' || isNaN(v)) v = 0;
    if (v < 0) v = 0;
    if (v > MAX_DIM) v = MAX_DIM;
    return v;
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'brightness-overlay';
    overlay.style.cssText =
      'position:fixed; top:0; left:0; right:0; bottom:0; ' +
      'background:#000; pointer-events:none; z-index:1000; opacity:0;';
    if (document.body) {
      document.body.appendChild(overlay);
    } else {
      /* Si appelé avant DOMContentLoaded, attendre */
      document.addEventListener('DOMContentLoaded', function () {
        if (!overlay.parentNode) document.body.appendChild(overlay);
      });
    }
  }

  function get() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw == null) return 0;
      return clamp(parseFloat(raw));
    } catch (e) { return 0; }
  }

  function set(v) {
    v = clamp(v);
    ensureOverlay();
    overlay.style.opacity = String(v);
    try { localStorage.setItem(KEY, String(v)); } catch (e) { /* private mode */ }
    return v;
  }

  function init() {
    ensureOverlay();
    var current = get();
    if (current > 0) overlay.style.opacity = String(current);
  }

  global.FamilyHubBrightness = {
    get: get,
    set: set,
    init: init,
    MAX: MAX_DIM
  };
})(window);
```

- [ ] **Step 2 : Ajouter le `<script>` dans index.html**

Dans `apps/display/public/index.html`, après `<script src="js/audio-singleton.js?v=...">` et `<script src="js/timer-singleton.js?v=...">`, ajouter :

```html
<script src="js/brightness.js?v=20260508a"></script>
```

Et bumper le `?v=` des autres scripts à `20260508a` aussi pour le cache-bust iOS 9.

- [ ] **Step 3 : Init au boot dans core.js**

Dans `function boot()`, juste après `setupAudioUnlock()` :

```js
if (window.FamilyHubBrightness) {
  window.FamilyHubBrightness.init();
}
```

- [ ] **Step 4 : Vérification manuelle via Console**

Ouvrir le display, dans la Console DevTools :

```js
FamilyHubBrightness.set(0.4);  // l'écran s'assombrit
FamilyHubBrightness.set(0);    // retour normal
FamilyHubBrightness.set(0.7);  // clampé à 0.6
FamilyHubBrightness.get();     // doit renvoyer 0.6
```

Reload la page → la dernière valeur (0.6) est restaurée au boot.

- [ ] **Step 5 : Commit**

```bash
git add apps/display/public/js/brightness.js apps/display/public/index.html apps/display/public/js/core.js
git commit -m "$(cat <<'EOF'
feat(display): singleton brightness (overlay noir + localStorage)

Contrôle de luminosité perçue via un <div> overlay plein écran avec
opacity 0..0.6 (au-delà = illisible). Stockage par display dans
localStorage : chaque écran (cuisine / bureau / mobile) a sa propre
luminosité. API window.FamilyHubBrightness.set/get/init.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Validation utilisateur après Task 9** : tester sur l'iPad réel que le slider/overlay marche avant de construire la tuile UI.

---

### Task 10 : Tuile settings (compact + expand)

**Files:**
- Create: `apps/display/public/js/tiles/settings.js`
- Modify: `apps/display/public/index.html` (ajouter `<script>`)

- [ ] **Step 1 : Créer settings.js — partie 1 (constantes + compact)**

Contenu de `apps/display/public/js/tiles/settings.js` :

```js
/* tiles/settings.js — Réglages display (thème + luminosité).
   Compact : aperçu thème actif + niveau lumino + CTA.
   Expand : sélecteur thème (6 cards) + slider lumino + infos.
   ES5 vanilla, iOS 9.3.6 OK. */
(function (global) {
  'use strict';

  var DISPLAY_VERSION = '20260508a';

  /* Synchro avec apps/hub/src/lib/themes.ts. Duplication acceptable
     (6 entrées peu volatiles, pas de transpile sur le display). */
  var THEMES = [
    { id:'caractere', nom:'Caractère',
      preview:{ bg:'#0F0D0A', card:'#1C1815', accent:'#D9A05B', text:'#F2E8D5' } },
    { id:'foret', nom:'Forêt',
      preview:{ bg:'#0E1A16', card:'#162621', accent:'#D4AF5F', text:'#F0EAD7' } },
    { id:'marine', nom:'Marine',
      preview:{ bg:'#0B1220', card:'#131E32', accent:'#E09160', text:'#EAE0C7' } },
    { id:'bordeaux', nom:'Bordeaux',
      preview:{ bg:'#1A0C0E', card:'#2C161A', accent:'#D6A07C', text:'#F4E8DB' } },
    { id:'glacier', nom:'Glacier',
      preview:{ bg:'#101620', card:'#1E2836', accent:'#AEBCD2', text:'#E8F0F8' } },
    { id:'lin', nom:'Lin',
      preview:{ bg:'#F8F0DE', card:'#FFFAF0', accent:'#B26E38', text:'#3C2A1A' } }
  ];

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getCurrentThemeId() {
    var html = document.documentElement;
    var classes = (html.className || '').split(/\s+/);
    for (var i = 0; i < classes.length; i++) {
      if (classes[i].indexOf('theme-') === 0) return classes[i].slice(6);
    }
    return 'caractere';
  }

  function getThemeById(id) {
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].id === id) return THEMES[i];
    }
    return THEMES[0];
  }

  function brightnessLevel() {
    if (!global.FamilyHubBrightness) return 0;
    return global.FamilyHubBrightness.get();
  }

  /* ---------- COMPACT ---------- */

  function render(container, _data, _config) {
    container.className = 'grid-cell tile-settings tile-clickable';
    container.innerHTML = '';

    var titleEl = document.createElement('div');
    titleEl.className = 'tile-title';
    titleEl.innerHTML = 'Réglages';
    container.appendChild(titleEl);

    var body = document.createElement('div');
    body.style.cssText = 'padding:8px 0; display:-webkit-flex; display:flex; -webkit-flex-direction:column; flex-direction:column; gap:14px;';
    container.appendChild(body);

    /* Thème actif */
    var theme = getThemeById(getCurrentThemeId());
    var themeBlock = document.createElement('div');
    themeBlock.innerHTML =
      '<div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; opacity:0.7; margin-bottom:6px">Thème</div>' +
      '<div style="display:-webkit-flex; display:flex; -webkit-align-items:center; align-items:center; gap:8px;">' +
        '<span style="display:-webkit-flex; display:flex; gap:2px;">' +
          '<span style="width:14px;height:14px;background:' + theme.preview.bg + ';border:1px solid ' + theme.preview.card + ';border-radius:2px"></span>' +
          '<span style="width:14px;height:14px;background:' + theme.preview.card + ';border-radius:2px"></span>' +
          '<span style="width:14px;height:14px;background:' + theme.preview.accent + ';border-radius:2px"></span>' +
          '<span style="width:14px;height:14px;background:' + theme.preview.text + ';border-radius:2px"></span>' +
        '</span>' +
        '<span style="font-size:13px">' + escapeHtml(theme.nom) + '</span>' +
      '</div>';
    body.appendChild(themeBlock);

    /* Luminosité */
    var lvl = brightnessLevel();
    var pct = Math.round((lvl / 0.6) * 100);
    var lumBlock = document.createElement('div');
    lumBlock.innerHTML =
      '<div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; opacity:0.7; margin-bottom:6px">Luminosité</div>' +
      '<div style="background:rgba(217,160,91,0.10); height:6px; border-radius:3px; position:relative; overflow:hidden">' +
        '<div style="position:absolute; left:0; top:0; bottom:0; width:' + (100 - pct) + '%; background:#D9A05B"></div>' +
      '</div>';
    body.appendChild(lumBlock);

    /* CTA */
    var cta = document.createElement('div');
    cta.style.cssText =
      'font-size:10px; letter-spacing:0.15em; text-transform:uppercase; ' +
      'opacity:0.5; text-align:right;';
    cta.innerHTML = 'Toucher → modifier →';
    body.appendChild(cta);
  }

  function cleanup(container) { container.innerHTML = ''; }
```

(suite à la step 2)

- [ ] **Step 2 : Continuer settings.js — partie 2 (expand)**

Continuer le même fichier :

```js

  /* ---------- EXPAND ---------- */

  function expand(container, _data, _config, _tileId) {
    container.className = 'tile-overlay-content tile-overlay-content--full tile-settings-expand';
    container.innerHTML = '';
    container.style.cssText =
      'display:-webkit-flex; display:flex; ' +
      '-webkit-flex-direction:column; flex-direction:column; ' +
      'height:100%; width:100%; overflow:hidden;';

    /* Header */
    var header = document.createElement('div');
    header.style.cssText =
      'padding:24px 32px 16px 32px; border-bottom:1px solid rgba(217,160,91,0.15); ' +
      '-webkit-flex-shrink:0; flex-shrink:0;';
    header.innerHTML =
      '<div style="font-size:11px; letter-spacing:0.2em; text-transform:uppercase; opacity:0.7">Display</div>' +
      '<div style="font-family:Georgia,serif; font-size:32px; margin-top:2px">Réglages</div>';
    container.appendChild(header);

    /* Body scrollable */
    var body = document.createElement('div');
    body.setAttribute('data-scroll-lock', '1');
    body.style.cssText =
      'padding:24px 32px; overflow-y:auto; -webkit-overflow-scrolling:touch; ' +
      '-webkit-flex:1 1 auto; flex:1 1 auto; min-height:0;';
    container.appendChild(body);

    /* Section thème */
    var themeSection = document.createElement('section');
    themeSection.style.cssText = 'margin-bottom:36px;';
    themeSection.innerHTML =
      '<h3 style="font-size:13px; letter-spacing:0.2em; text-transform:uppercase; opacity:0.7; margin:0 0 12px 0;">Thème de l\'interface</h3>';
    var grid = document.createElement('div');
    grid.style.cssText =
      'display:-webkit-flex; display:flex; -webkit-flex-wrap:wrap; flex-wrap:wrap; gap:10px;';
    var currentId = getCurrentThemeId();
    for (var i = 0; i < THEMES.length; i++) {
      grid.appendChild(makeThemeCard(THEMES[i], currentId === THEMES[i].id));
    }
    themeSection.appendChild(grid);
    body.appendChild(themeSection);

    /* Section luminosité */
    var lumSection = document.createElement('section');
    lumSection.style.cssText = 'margin-bottom:36px;';
    lumSection.innerHTML =
      '<h3 style="font-size:13px; letter-spacing:0.2em; text-transform:uppercase; opacity:0.7; margin:0 0 12px 0;">Luminosité</h3>' +
      '<p style="font-size:12px; opacity:0.6; margin:0 0 14px 0;">Réglage local à cet écran. Les autres displays gardent leur propre luminosité.</p>';
    var lumRow = document.createElement('div');
    lumRow.style.cssText = 'display:-webkit-flex; display:flex; -webkit-align-items:center; align-items:center; gap:14px;';
    var current = (global.FamilyHubBrightness ? global.FamilyHubBrightness.get() : 0);
    var sliderVal = Math.round(current * 100);  /* 0..60 */
    lumRow.innerHTML =
      '<span style="font-size:11px; opacity:0.7; min-width:60px; text-align:right">Très clair</span>' +
      '<input type="range" min="0" max="60" step="5" value="' + sliderVal + '" data-role="brightness-slider" ' +
        'style="-webkit-flex:1; flex:1; min-width:0;">' +
      '<span style="font-size:11px; opacity:0.7; min-width:60px">Très sombre</span>';
    lumSection.appendChild(lumRow);

    var slider = lumRow.querySelector('[data-role="brightness-slider"]');
    if (slider) {
      slider.addEventListener('input', function () {
        var v = parseFloat(slider.value) / 100;
        if (global.FamilyHubBrightness) global.FamilyHubBrightness.set(v);
      });
      slider.addEventListener('change', function () {
        var v = parseFloat(slider.value) / 100;
        if (global.FamilyHubBrightness) global.FamilyHubBrightness.set(v);
      });
    }
    body.appendChild(lumSection);

    /* Section infos */
    var infoSection = document.createElement('section');
    infoSection.style.cssText = 'margin-bottom:24px; opacity:0.6;';
    var hid = (global.FamilyHubGetHouseholdId && global.FamilyHubGetHouseholdId()) || '?';
    var did = '?';
    try { did = localStorage.getItem('familyHub.displayId') || '?'; } catch (e) { /* noop */ }
    infoSection.innerHTML =
      '<h3 style="font-size:13px; letter-spacing:0.2em; text-transform:uppercase; opacity:0.7; margin:0 0 8px 0;">Informations</h3>' +
      '<div style="font-size:12px; line-height:1.6">' +
        'Version display : <code style="font-family:Menlo,monospace">' + DISPLAY_VERSION + '</code><br>' +
        'Display ID : <code style="font-family:Menlo,monospace">' + escapeHtml(did) + '</code><br>' +
        'Household ID : <code style="font-family:Menlo,monospace">' + escapeHtml(hid) + '</code>' +
      '</div>';
    body.appendChild(infoSection);
  }

  function makeThemeCard(theme, isActive) {
    var card = document.createElement('button');
    card.type = 'button';
    card.setAttribute('data-theme-id', theme.id);
    card.style.cssText =
      'background:transparent; border:' + (isActive ? '2px solid #D9A05B' : '1px solid rgba(217,160,91,0.30)') + '; ' +
      'border-radius:6px; padding:14px; cursor:pointer; text-align:left; ' +
      'min-height:44px; min-width:140px; -webkit-flex:0 1 calc(33.33% - 8px); flex:0 1 calc(33.33% - 8px); ' +
      'color:inherit;';
    card.innerHTML =
      '<div style="display:-webkit-flex; display:flex; gap:3px; margin-bottom:8px;">' +
        '<span style="width:22px; height:22px; background:' + theme.preview.bg + '; border:1px solid ' + theme.preview.card + '; border-radius:3px"></span>' +
        '<span style="width:22px; height:22px; background:' + theme.preview.card + '; border-radius:3px"></span>' +
        '<span style="width:22px; height:22px; background:' + theme.preview.accent + '; border-radius:3px"></span>' +
        '<span style="width:22px; height:22px; background:' + theme.preview.text + '; border-radius:3px"></span>' +
      '</div>' +
      '<div style="font-weight:600; font-size:14px;">' + escapeHtml(theme.nom) + '</div>';
    card.addEventListener('click', function () {
      pickTheme(theme.id, card);
    });
    return card;
  }

  function pickTheme(themeId, cardEl) {
    /* Apply local immédiat (optimistic) */
    if (global.FamilyHubApplyTheme) global.FamilyHubApplyTheme(themeId);

    /* Update UI : retire le bord actif des autres cards, ajoute sur celle-ci */
    var allCards = document.querySelectorAll('[data-theme-id]');
    for (var i = 0; i < allCards.length; i++) {
      allCards[i].style.border = '1px solid rgba(217,160,91,0.30)';
    }
    if (cardEl) cardEl.style.border = '2px solid #D9A05B';

    /* Persist Firestore (households/{hid}.parametres.themeId) */
    var db = global.FamilyHubGetDb && global.FamilyHubGetDb();
    var hid = global.FamilyHubGetHouseholdId && global.FamilyHubGetHouseholdId();
    if (!db || !hid) return;

    var FieldValue = global.firebase && global.firebase.firestore && global.firebase.firestore.FieldValue;
    var serverTs = FieldValue ? FieldValue.serverTimestamp() : new Date();

    db.collection('households').doc(hid).update({
      'parametres.themeId': themeId,
      'updatedAt': serverTs
    }).catch(function (err) {
      if (window.console && window.console.error) console.error('[settings] persist theme', err);
      /* Rollback : on ne sait pas l'ancien thème ici, le snapshot listener
         de core.js le récupèrera et re-appliquera. */
    });
  }

  function collapse(_container) { /* noop */ }

  global.Tiles = global.Tiles || {};
  global.Tiles['settings'] = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse
  };
})(window);
```

- [ ] **Step 3 : Ajouter `<script>` dans index.html**

Dans `apps/display/public/index.html`, après les autres `<script src="js/tiles/...">` :

```html
<script src="js/tiles/settings.js?v=20260508a"></script>
```

- [ ] **Step 4 : Build + vérification**

```bash
npm run build
```

Pour tester sans avoir encore l'option dans le hub TileEditor (Task 12 plus tard), créer manuellement la tuile via Firestore Console :
- Document : `households/{hid}/tiles/settings-test`
- Champs : `{ type: 'settings', config: {} }`
- Layout : ajouter dans `households/{hid}/displays/{did}.layout` une entrée `{ tileId: 'settings-test', position: { col: 0, row: 0, w: 2, h: 2 } }`.

Reload le display → la tuile Réglages apparaît. Tap → expand → tester :
1. Cliquer sur "Forêt" → fond passe en vert, bordure active sur la card.
2. Vérifier dans Firestore que `households.parametres.themeId === 'foret'`.
3. Bouger le slider luminosité → l'écran s'assombrit en temps réel.
4. Reload le display → le thème est restauré, la lumino aussi.

- [ ] **Step 5 : Commit**

```bash
git add apps/display/public/js/tiles/settings.js apps/display/public/index.html
git commit -m "$(cat <<'EOF'
feat(display): tuile Réglages — thème + luminosité

Compact = aperçu thème actif + barre lumino + CTA.
Expand = grille de 6 thèmes (sync households.parametres.themeId via Firestore)
+ slider HTML5 lumino (local au display, via FamilyHubBrightness).
Rollback visuel implicite via le listener household de core.js si la persist échoue.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Validation utilisateur après Task 10** : tester sur l'iPad réel le tap, le changement de thème, le slider, la persistance. Avant Tasks 11-12 (hub).

---

### Task 11 : Type 'settings' dans TileType union

**Files:**
- Modify: `packages/types/src/tile.ts`

- [ ] **Step 1 : Lire le fichier actuel**

```bash
cat packages/types/src/tile.ts
```

Identifier l'union `TileType`.

- [ ] **Step 2 : Ajouter 'settings'**

Ajouter `| 'settings'` à l'union :

```ts
// AVANT (exemple)
export type TileType =
  | 'clock'
  | 'weather'
  | 'radio'
  | 'timer'
  | 'calendar'
  | 'recipe-today'
  | 'weekly-menu'
  | 'livre-recettes'
  | 'shopping-list';

// APRÈS
export type TileType =
  | 'clock'
  | 'weather'
  | 'radio'
  | 'timer'
  | 'calendar'
  | 'recipe-today'
  | 'weekly-menu'
  | 'livre-recettes'
  | 'shopping-list'
  | 'settings';
```

(Adapter à la liste réelle du fichier — la liste ci-dessus est indicative.)

S'il y a aussi une `interface TileConfig` ou map par type, vérifier si on doit ajouter une entrée vide pour `settings` (tuile sans config).

- [ ] **Step 3 : Build types**

```bash
cd "/c/Users/guill/Desktop/family hub"
npm run build:types
```

Expected : pas d'erreur.

- [ ] **Step 4 : Build complet (typecheck hub)**

```bash
npm run build
```

Si TileEditor ou un switch quelque part ne couvre pas le nouveau type, ça ressort ici en erreur TS — c'est le but. Noter les fichiers à patcher pour Task 12.

- [ ] **Step 5 : Commit**

```bash
git add packages/types/
git commit -m "$(cat <<'EOF'
feat(types): ajouter 'settings' à TileType

Pour la tuile Réglages display (Phase 4.3).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12 : Entrée settings dans TileEditor (hub)

**Files:**
- Modify: `apps/hub/src/pages/TileEditor.tsx`

- [ ] **Step 1 : Lire le picker de type actuel**

```bash
cat apps/hub/src/pages/TileEditor.tsx
```

Repérer la liste des types (probablement un array `TILE_TYPES` ou similaire) et où l'icône / le label est rendu.

- [ ] **Step 2 : Ajouter l'entrée settings**

Dans la liste des types, ajouter :

```tsx
{
  id: 'settings',
  label: 'Réglages',
  description: 'Thème de l\'interface et luminosité (par display).',
  icon: Settings,  // de lucide-react
}
```

Importer `Settings` depuis `lucide-react` (en haut du fichier) :

```tsx
import { Settings } from 'lucide-react';
```

Si TileEditor a une logique de form pour la config par type, gérer settings comme une tuile **sans config** (juste son type, position héritée du layout). Pas de form spécifique.

- [ ] **Step 3 : Si erreurs TS résiduelles de Task 11**

Si Task 11 step 4 a sorti des erreurs (switch non exhaustif, etc.), les corriger ici en ajoutant les cases manquantes (généralement `case 'settings': return null;` ou équivalent neutre).

- [ ] **Step 4 : Build + dev hub**

```bash
npm run build
npm run dev:hub
```

Ouvrir `localhost:5173`, aller dans **Tuiles** → créer une nouvelle tuile → choisir "Réglages" → la sauvegarder sur un display.

- [ ] **Step 5 : Vérifier sur le display**

Reload le display iPad → la tuile Réglages apparaît à l'emplacement défini.

- [ ] **Step 6 : Commit**

```bash
git add apps/hub/src/pages/TileEditor.tsx
git commit -m "$(cat <<'EOF'
feat(hub): type tuile 'Réglages' dans TileEditor

Permet d'ajouter la tuile Réglages sur un display via le hub web (Tuiles
→ Nouvelle tuile → Réglages). Pas de config spécifique : la tuile lit
le thème courant et la luminosité au render.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Validation utilisateur finale** : créer la tuile depuis le hub, vérifier sur iPad qu'elle apparaît bien et fonctionne. Si OK : push de la branche, merge décidé par l'utilisateur (PR ou direct sur main, selon préférence).

---

## Vérifications finales (avant push)

- [ ] **Build complet passe**

```bash
cd "/c/Users/guill/Desktop/family hub"
npm run build
```

- [ ] **Smoke test display sur iPad réel**

1. Recette longue : scroll bas → re-haut sans blocage.
2. Menu semaine landscape : 7 jours visibles sans scroll H.
3. Tuile Réglages : changement de thème depuis le display → propagé au hub. Inverse aussi (changement depuis le hub → display reflète sous 2s).
4. Slider luminosité : réagit en temps réel, persiste après reload.

- [ ] **Smoke test hub**

1. Paramètres → Thème : changement → propagé sur l'iPad.
2. Tuiles → Nouvelle → Réglages : possible et fonctionne.

- [ ] **Push de la branche**

```bash
git push -u origin phase-4-ipad-ux
```

---

## Hors scope (référer à la spec, section "Hors scope")

- Section 4.3.c "Taille de police" — bonus reporté Phase 5+.
- Sync luminosité multi-display via Firestore.
- Thème auto jour/nuit.
- Refonte UX livre-recettes / shopping-list / calendar (limité à audit ponctuel en Task 6).

---

## Récap commits attendus

| Task | Commit |
|------|--------|
| 1 | feat(display): classe CSS .tile-overlay-content--full pour expand fullbleed |
| 2 | feat(display): adopter .tile-overlay-content--full sur recipe-today, weekly-menu, livre-recettes |
| 3 | fix(display): anti-rubber-band iOS 9 sur scrollers data-scroll-lock |
| 4 | feat(display): recipe-today expand 2 colonnes en landscape iPad |
| 5 | feat(display): weekly-menu grille fluide en landscape (plus de scroll H) |
| 6 | chore(display): audit landscape autres tuiles + tap targets 44px (HIG iOS) |
| 7 | feat(display): 6 thèmes CSS (Caractère, Forêt, Marine, Bordeaux, Glacier, Lin) |
| 8 | feat(display): apply theme household au boot + listener live |
| 9 | feat(display): singleton brightness (overlay noir + localStorage) |
| 10 | feat(display): tuile Réglages — thème + luminosité |
| 11 | feat(types): ajouter 'settings' à TileType |
| 12 | feat(hub): type tuile 'Réglages' dans TileEditor |

12 commits, ~3 sous-phases, validation utilisateur entre chaque.
