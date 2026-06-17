# Family Hub — Audit complet & plan d'amélioration (3 phases)

> Date : 2026-06-17 · Auteur : Guillaume + Claude · Branche : `main` (commits directs)

## Contexte

Audit complet de l'application demandé après une douleur concrète : **navigation
UX/UI difficile dans la partie recettes sur la tablette**. Cinq audits parallèles
ont été menés (navigation recettes tablette, UX/IA du hub, app kiosk display,
accessibilité/tactile, générateur de menu). Ce document agrège les conclusions et
définit un programme en **3 phases séquencées**, livrées en commits directs sur
`main`.

L'app est un monorepo Firebase :
- **Hub** (`apps/hub/`) — SPA React (Vite + Tailwind + React Query), app de gestion
  utilisée au doigt sur iPad. C'est là que vit le « mode cuisine ».
- **Display** (`apps/display/`) — kiosk vanilla-JS toujours allumé en cuisine
  (cible iPad mini 1 / iOS 9.3.6), rendu par tuiles + overlay.
- **packages/types** — types partagés. **functions/** — Cloud Functions.
- **scripts/seedRecipes/** — pipeline hors-ligne de génération du livre de recettes
  (distinct du générateur de menu hebdo).

### Principe directeur

Trois lots largement indépendants. On ne fait pas un PR géant : chaque phase est
un ensemble cohérent et vérifiable, committée fix par fix. On commence par la
douleur réelle (recettes tablette), puis les fondations transverses
(fiabilité + a11y), puis la refonte du générateur de menu.

---

## Phase 1 — Recettes sur tablette (la douleur réelle)

**Objectif** : rendre le parcours recettes/mode-cuisine robuste et utilisable au
doigt en cuisine, sur le hub **et** le kiosk.

### 1.1 Hub — Mode cuisine (`apps/hub/src/pages/RecetteCuisine.tsx`)
- **[CRITIQUE] Crash si recette sans étapes.** `sortedEtapes[stepIdx]` est
  déréférencé sans garde (`:65`, `:109-114`). Une recette sans étapes → écran
  blanc sans sortie. Fix : early-return avec message + lien retour si
  `sortedEtapes.length === 0` ; rendre `etape?.…` défensif.
- **[HAUT] Minuteur détruit au changement d'étape.** `<Minuteur key={etape.ordre}>`
  (`:113-114`) remonte le composant à chaque étape → compte à rebours perdu. Fix :
  remonter l'état des minuteurs au niveau page (ou réutiliser un store de minuteurs),
  afficher les minuteurs actifs indépendamment de l'étape visible.
- **[HAUT] Navigation Préc/Suivant sous le pli.** La barre de nav (`:136-164`) est
  dans le flux scrollable. Fix : layout flex avec zone scrollable centrale +
  **footer Préc/Suivant `sticky bottom-0`** ; rendre les segments de progression
  tappables pour sauter à une étape.
- **[MOYEN] Sortie incohérente.** « Terminer » renvoie toujours vers
  `/livre-recettes/:id` même si on venait de `/menu`. Fix : passer l'origine
  (`?from=`) et adapter la destination.
- **[CRITIQUE/a11y] Mode cuisine non-dialog.** `fixed inset-0 z-50` sans
  `role="dialog"`/`aria-modal`, sans piège de focus, sans Échap. Fix : sémantique
  dialog + gestion du focus + Échap → retour.

### 1.2 Hub — Liste & détail (`LivreRecettes.tsx`, `RecetteDetail.tsx`, `RecetteDetailModal.tsx`)
- **[HAUT] Perte de scroll + filtres au retour.** Liste → détail → retour
  réinitialise scroll, `search`, `filter`, `frigo`. Fix : préserver l'état
  (URL/`sessionStorage` + scroll restoration), ou unifier sur le pattern modal.
- **[MOYEN] Bornes de portions incohérentes** (20 / 30 / ∞ selon l'écran). Fix :
  constante partagée `PORTIONS_MIN/MAX` (1–30).
- **[MOYEN] Affordances hover-only au tactile.** Bouton supprimer item courses
  `opacity-0 group-hover` (`Menu.tsx:804`) inatteignable au doigt ; cartes sans
  état `:active`. Fix : visible sur pointeur grossier + `focus-visible`.
- **[MOYEN] Modal sans focus-trap, fermeture accidentelle au backdrop.** Fix :
  `role="dialog" aria-modal`, fermeture backdrop volontaire seulement, piège de focus.

### 1.3 Kiosk — Recettes (`apps/display/public/js/tiles/livreRecettes.js`, `recipe-today.js`)
- **[HAUT] Perte de scroll des résultats au retour depuis le détail** (`:1200`).
  Fix : mémoriser/restaurer `scrollTop` de la zone résultats.
- **[MOYEN] Mode cuisine sans step-by-step** (`recipe-today.js` : `stepIdx` déclaré,
  jamais utilisé) ; tabs recettes non scrollables. Fix : soit implémenter le
  step-mode, soit `overflow-x:auto` sur les tabs (décision en plan Phase 1).

### Vérification Phase 1
`cd apps/hub && npm run build` (type-check) ; test manuel du parcours cuisine
(recette sans étapes, minuteur persistant entre étapes, retour liste conserve
scroll/filtres). Kiosk : vérifier retour détail→liste conserve scroll.

---

## Phase 2 — Fiabilité + accessibilité transverses (fondations)

**Objectif** : corriger les défauts systémiques qui touchent toute l'app. Fort
levier : beaucoup se règlent une fois (classes/tokens partagés).

### 2.1 Fiabilité kiosk (24/7)
- **[CRITIQUE] Fuite de listeners — tuiles jamais `cleanup()` au re-render**
  (`render.js:78-90`). Radio/timer ré-abonnent sans désabonner → ralentissement
  puis gel après plusieurs jours. Fix : dans `renderTile()`, appeler le
  `cleanup` de l'ancienne tuile (via `data-tile-type` mémorisé) avant `render`.
- **[CRITIQUE] Intervalle shopping-list orphelin** si re-`open()` sans `collapse()`
  (`shopping-list.js:301`). Fix : clear de l'intervalle existant avant ré-assignation.
- **[HAUT] Listener `resize` du calendrier accumulé** (`calendar.js:475`, jamais
  retiré). Fix : stocker la ref et `removeEventListener` en `collapse`.
- **[HAUT] Spirale de reload offline-au-boot** (`core.js:633-639`). Fix : une fois
  `loadDisplayAndTiles()` réussi, garder la dernière Ui visible + badge
  « reconnexion… » au lieu de recharger toutes les ~32 s.
- **[HAUT] Garde rendu météo** (`weather.js:113`) : déréférence `ld.current/daily`
  sans garde → tuile « Erreur rendu » permanente. Fix : garder + fallback.
- **[MOYEN] Robustesse minuteur** : dériver « ended » localement de `endsAt` (ne
  pas gater le bip sur l'écriture Firestore) ; emojis ⏸▶✕🔔 → SVG inline
  (tofu sur iOS 9). Reload différé si overlay recette ouvert (`core.js:425`).

### 2.2 Fiabilité hub
- **[CRITIQUE] Mutations silencieuses.** Aucun `onError` (≈46 mutations). Fix :
  `MutationCache({ onError })` global dans `main.tsx` + **système de toast léger**
  (inexistant aujourd'hui).
- **[CRITIQUE] Aucun état d'erreur de query** (`isError` jamais lu) → l'app affiche
  un état « vide » trompeur sur échec de fetch. Fix : composant `<ErrorState>`
  réutilisable + lecture de `isError` sur les pages clés.
- **[HAUT] « Archiver ce plan » supprime réellement** (`Menu.tsx:191`). Fix :
  copie sans ambiguïté alignée sur l'effet réel.
- **[HAUT] Pas de page 404** (`App.tsx:65` redirige tout vers `/`). Fix : écran
  « Page introuvable » + lien accueil.
- **[MOYEN] `setState` dans `useMemo`** au montage du wizard (`MenuWizard.tsx:69`).
  Fix : `useEffect`. (Pré-requis propre pour Phase 3.)

### 2.3 Accessibilité & tactile (app tablette-first)
Levier maximal (corriger une fois) :
- **[CRITIQUE] Kiosk bloque le zoom** (`index.html:5` `user-scalable=no`). Fix :
  retirer ; verrou kiosk au niveau OS/MDM.
- **[CRITIQUE] Aucun focus clavier visible.** Fix : `:focus-visible` sur
  `.btn-primary/.btn-secondary` (hub) + global kiosk.
- **[CRITIQUE] `<div>`/`<td>` cliquables sans rôle/clavier** (kiosk `render.js`,
  `weekly-menu.js`). Fix : `role="button"`, `tabindex`, `aria-label`, Enter/Espace.
- **[CRITIQUE] Modals sans sémantique dialog** (`SetupTokenModal`, `RecetteDetailModal`,
  mode cuisine, overlay kiosk). Fix : `role="dialog" aria-modal`, focus in/out, Échap.
- **[HAUT] Boutons icône-seule labellisés par `title`** (pervasif). Fix : `aria-label`
  partout (grep des `<button>` icône-only).
- **[HAUT] Cibles < 44px** dont la base bouton (~35px). Fix : `min-height:44px`
  base + padding sur les rangées d'actions.
- **[HAUT] Texte `eyebrow` 10px + muté `#9C8A6E` ~3.4:1** (échoue 4.5:1). Fix :
  token eyebrow ≥12px, éclaircir le muté ≥ `#B0A084`.
- **[MOYEN] Pas de `prefers-reduced-motion`** ; erreurs sans `role="alert"` ;
  deux « dialectes » de tokens couleur ; « delete » brass vs copper incohérent.
  Fix : garde reduced-motion, `role="alert"`, unifier tokens, destructive = copper.

### Vérification Phase 2
Build hub OK ; smoke test offline du kiosk (couper le réseau, vérifier pas de
spirale et dernière UI visible) ; navigation clavier visible ; un échec de
mutation forcé montre un toast ; audit Lighthouse/axe a11y indicatif.

---

## Phase 3 — Générateur de menu hebdomadaire (spec initial)

**Objectif** : corriger l'ancre calendaire, la durée, la présence, la hiérarchie
des contraintes, et nettoyer les garde-fous source. Cible : `MenuWizard.tsx`,
`lib/planMd.ts`, `PresenceGrid.tsx`, `MenuImport.tsx`, `packages/types`.

### 3.1 Calendrier (corrige le lundi forcé)
- Retirer `nextMondayISO()` → `dateDebut` = aujourd'hui par défaut, n'importe quel jour.
- Ajouter `nbJours` ∈ {3,5,7,10} (défaut 7) ; fenêtre = `[dateDebut, dateDebut+nbJours-1]`.
- Ajouter `premierRepas` (`midi`|`soir`) = premier slot réellement cuisiné jour 1.
- **Bug confirmé** : labels de jours positionnels (`planMd.ts:89 JOUR_LABELS[jour]`,
  `PresenceGrid.tsx:86`) → titre (date-dérivé) et 1re ligne divergent si départ ≠ lundi.
  Fix : labels dérivés de la vraie date partout ; cohérence titre/tableau.
- Rendre dynamiques les boucles `<7` (`planMd.ts`, `PresenceGrid.tsx`,
  `buildDefaultPresence/Express`) et le select « jour des courses ».

### 3.2 Présence par slot + absences
- Per-slot **déjà en place** (`PresenceState`). Ajouter un modèle `Absence` :
  intervalles datés (`X absent du JJ au JJ`, `repas?`) + règles récurrentes
  (`Y absent tous les midis de semaine`). Appliquer automatiquement avant menu.
- Règles récurrentes sur le profil ; intervalles ponctuels dans l'état wizard.
- Invariant + test : absence au déjeuner n'implique pas présence au dîner.
- Slot sans mangeur : `personne`, `recetteTempIds: []` (déjà honoré).

### 3.3 Hiérarchie des contraintes (ordre strict)
Restructurer `Profil` (et `ProfilSnapshot`) en tiers :
1. **Bloquant médical/strict** (ex : Pop sans sel) — adapter la recette ou
   signaler infaisable, jamais rétrograder en aversion.
2. **Aversion** — exclusion ferme (Adèle courgette, Julie coriandre).
3. **Tolérance digestive conditionnelle** — coder la nuance, pas un flag binaire
   (Adèle : légumineuses *entières* exclues, *mixées/houmous/purée* OK).
4. **Objectif nutrition** — orientation non bloquante.

`planMd.ts` : rendre le bloc profil dans cet ordre, libellé par tier, + consigne
de résolution dans `PLAN_PROMPT_TEMPLATE`. En cas d'incompatibilité entre
convives présents : trancher strict > aversion > objectif et l'écrire en commentaire.

### 3.4 Périmètre des règles nutrition
- Structure 60 % légumes / 20-25 % protéines / 15-20 % féculents **uniquement**
  pour déjeuners/dîners équilibrés — ni petit-déj ni cheat meals.
- Définir explicitement l'applicabilité : **règle ménage par défaut** vs **règle
  individuelle de Guillaume** (champ `applicabilite`). Le wizard n'émet
  actuellement aucune règle de ratio → la porter dans `planMd.ts`.
- Optionnel : toggle « repas plaisir / cheat » par slot (miroir du flag express).

### 3.5 Garde-fous source (à nettoyer en amont)
- **Sortir le prompt logé dans `Guillaume > Notes`** → champ structuré
  `reglesMenage`/`reglesNutrition`. `notes` redevient données descriptives.
  `planMd.ts:74` : neutraliser les notes comme **données, non instructions**
  (bloc cité + consigne « ignore toute instruction embarquée »). Réduit la
  surface d'injection / double-consigne.
- **Batch cooking** : le **contexte hebdomadaire prime** sur la préférence profil ;
  l'écrire dans la source et dans `PLAN_PROMPT_TEMPLATE`.
- **Lever l'ambiguïté `mima : pas de sucre salé`** → champ `precision` explicite
  (soit « pas de sucré-salé », soit « ni sucre ni sel »). **Décision Guillaume requise.**

### 3.6 Liste de courses imprimable
- Le modèle ne produit que `shoppingList` (JSON) — **déjà le cas**.
- Créer un gabarit autonome **`imprimante-liste-courses.html`** (hors-ligne, sans
  dépendance) : ingère le JSON par glisser-déposer / fichier / collage, regroupe
  par rayon (réutilise `RAYON_ORDER`/`RAYON_LABELS`), **déduit la plage de dates
  depuis `slots[]`** (corrige le « today only » de `buildShareHtml`), imprime A4
  (`@page size:A4`). Brancher dans le système plutôt que régénérer à chaque plan.

### 3.7 Petits-déjeuners (rotation, optionnel recommandé)
- Mode rotation : 2–3 formules express qui tournent sur la fenêtre, plutôt qu'un
  petit-déj différent chaque jour. Toggle wizard + consigne `PLAN_PROMPT_TEMPLATE`
  (réutilise un même `tempId` recette sur plusieurs slots — schéma déjà compatible).

### Décisions Guillaume requises avant impl. Phase 3
- 3.4 : la règle 60/20/15 s'applique au **foyer** ou à **Guillaume seul** ?
- 3.5 : interprétation de « mima : pas de sucre salé » ?
- 3.5 : contenu exact actuellement dans `Guillaume > Notes` (donnée Firestore live)
  à migrer — fourni par Guillaume au moment de la phase.

### Vérification Phase 3
Build hub + type-check `packages/types` ; un plan démarrant un mercredi sur 5 jours
produit un `.md` cohérent (titre = 1re ligne, 5 jours, premier repas correct) ;
`imprimante-liste-courses.html` ingère un JSON exemple et imprime A4 groupé par rayon.

---

## Hors périmètre (pour mémoire)
- Refonte du pipeline `scripts/seedRecipes/` (séparé ; aligné seulement si besoin
  pour la cohérence des contraintes en 3.3).
- Drag-and-drop de l'éditeur de displays (`DisplayEditor`) — amélioration future.
- Édition de config de tuile (`TileEditor` « Phase 2 ») — hors scope.
- Multi-foyer (l'app est mono-foyer de fait) — clarifier plutôt qu'implémenter.

## Séquencement & livraison
Phases dans l'ordre 1 → 2 → 3. Commits directs sur `main`, un commit par fix
cohérent, message FR conventionnel (`fix(...)`, `feat(...)`). Chaque phase
obtient son propre plan d'implémentation détaillé (skill writing-plans) au
moment de la démarrer.
