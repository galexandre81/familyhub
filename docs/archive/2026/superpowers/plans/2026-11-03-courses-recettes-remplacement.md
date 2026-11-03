# Courses : repas d'un article et remplacement facultatif — plan de construction

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** depuis un article de la liste, voir les repas qui l'utilisent et noter un remplacement facultatif, visible sur la liste et dans les recettes (hub et iPad).

**Architecture:** un champ `remplacement` sur l'article ; deux modules purs côté hub (`remplacements.ts`, `repasArticle.ts`) ; un module ES5 `remplacements.js` côté iPad, testé contre les fonctions du hub. Aucune fonction serveur ni règle Firestore ne change : l'iPad lit directement la liste (droit déjà ouvert) et prend les dates des plans dans son snapshot `weekly-menu`.

**Tech Stack:** React, TypeScript, TanStack Query, Firestore, Tailwind, Vitest ; ES5 / Safari 9 pour `apps/display`.

**Spec:** `docs/superpowers/specs/2026-11-03-courses-recettes-remplacement-design.md`

## Global Constraints

- Dépôt public : aucun prénom ni donnée de la famille, dans le code, les tests, les commits et la doc.
- `apps/display/` : ES5 et Safari 9 ; ni `String.prototype.normalize`, ni grid, ni `gap`, ni variables CSS, ni flex sur `<button>` ; `npm run check:display` passe.
- Fichiers en CRLF : utiliser Edit, jamais un remplacement scripté sur `\n`.
- Tout texte saisi passe par l'échappement existant sur iPad (`echapper`, `escapeHTML`) et dans le fichier HTML du magasin (`echapper`).
- Cibles tactiles d'au moins 48 px ; couleurs issues des classes et jetons existants.
- Écritures Firestore sans attente ni transaction, comme les coches.
- Aucun déploiement, aucun `git push` : le propriétaire ou l'agent principal s'en charge.
- Première installation du worktree : `npm ci`, puis `npm run build:design && npm run build:types`.

## Review Focus

- Article relié à deux recettes du **même repas** (plat et accompagnement) : deux lignes dans le panneau, mais « 1 repas » sur le bouton. Test en Task 2.
- Remplacement contenant `<`, `&` ou `"` : affiché tel quel dans le fichier HTML et sur l'iPad, sans interprétation. Tests en Tasks 1 et 6.
- Remplacement fait d'espaces, ou de plus de 100 caractères : espaces = rien (ou retrait de l'existant), texte long tronqué à 100. Test en Task 1.
- Recette absente du cache sans réseau : la lecture échoue pour celle-là, le panneau s'ouvre quand même, repas affiché sans quantité. Test de la fusion des lectures en Task 3.
- iPad sans snapshot `weekly-menu`, sans réseau ou avec une réponse tardive après fermeture de la recette : pas d'erreur, pas de rappel, pas d'écriture dans un écran fermé. Tests en Task 6.

---

### Task 1 : champ, logique pure des remplacements, textes de la liste

**Files:**
- Modify: `packages/types/src/shoppingList.ts` (`ArticleCourses`)
- Create: `apps/hub/src/lib/remplacements.ts`, `apps/hub/src/lib/remplacements.test.ts`
- Modify: `apps/hub/src/lib/listeCourses.ts` (`fusionnerReimport`), `apps/hub/src/lib/listeCourses.test.ts`
- Modify: `apps/hub/src/lib/coursesTelephone.ts`, `apps/hub/src/lib/drive.ts` et leurs tests

**Interfaces — Produces** (`remplacements.ts`) :
```ts
export const LONGUEUR_MAX_REMPLACEMENT = 100;
export function texteRemplacement(brut: string): string | null;        // trim, tronqué à 100, vide → null
export function cleIngredient(nom: string): string;                    // ponctuation → espace, puis normaliserNom
export function indicesIngredient(nomArticle: string, ingredients: Array<{ libelle: string }>): number[];
export interface RemplacementActif { nomArticle: string; remplacement: string; recetteIds: string[] }
export function remplacementsDeRecette(actifs: RemplacementActif[], recetteId: string): RemplacementActif[];
export function carteRemplacements(ingredients: Array<{ libelle: string }>, actifs: RemplacementActif[]): Map<string, string>; // libellé exact → remplacement ; le premier actif gagne
export function semaineEnCours(debutISO: string | undefined, finISO: string | undefined, aujourdhuiISO: string): boolean; // bornes comprises ; borne absente → false
export function libelleArticleTexte(a: Pick<ArticleCourses, "nom"|"quantite"|"unite"|"remplacement">): string;
```
Ponctuation retirée, la même des deux côtés : `. , ; : ! ? ( ) [ ] " « » - – — /`. L'apostrophe reste.

`indicesIngredient` : d'abord tous les indices de clé identique ; sinon, les lignes dont les mots contiennent tous ceux de l'article, ou l'inverse ; un seul candidat → ce candidat ; zéro ou plusieurs → `[]`.

- [ ] **Step 1 : écrire les tests qui échouent** dans `remplacements.test.ts`

```ts
expect(texteRemplacement("  yaourt  ")).toBe("yaourt");
expect(texteRemplacement("   ")).toBeNull();
expect(texteRemplacement("x".repeat(150))).toHaveLength(100);
expect(indicesIngredient("Poivrons", [{ libelle: "poivron" }])).toEqual([0]);
expect(indicesIngredient("oignons jaunes", [{ libelle: "sel" }, { libelle: "oignon" }])).toEqual([1]);
expect(indicesIngredient("beurre", [{ libelle: "Beurre" }, { libelle: "beurre" }])).toEqual([0, 1]);
expect(indicesIngredient("crème", [{ libelle: "crème fraîche" }, { libelle: "crème liquide" }])).toEqual([]);
expect(indicesIngredient("poulet", [{ libelle: "riz" }])).toEqual([]);
expect(semaineEnCours("2026-11-02", "2026-11-08", "2026-11-08")).toBe(true);
expect(semaineEnCours("2026-11-02", "2026-11-08", "2026-11-09")).toBe(false);
expect(semaineEnCours("2026-11-09", "2026-11-15", "2026-11-07")).toBe(false);
expect(libelleArticleTexte({ nom: "Crème", quantite: 40, unite: "cl", remplacement: "yaourt" }))
  .toBe("yaourt (à la place de : Crème, 40 cl)");
expect(libelleArticleTexte({ nom: "Crème", quantite: 1, unite: "", remplacement: "yaourt" }))
  .toBe("yaourt (à la place de : Crème)");
expect(libelleArticleTexte({ nom: "Crème", quantite: 40, unite: "cl" })).toBe("Crème (40 cl)");
```
`carteRemplacements` : un actif sur « beurre » avec deux lignes identiques remplit la clé une fois ; aucun actif correspondant → carte vide.

Tests ajoutés aux fichiers existants :
- `listeCourses.test.ts` : `fusionnerReimport` garde `remplacement` d'un article repris ; `oublisAReporter` ne le reporte pas.
- `coursesTelephone.test.ts` : `texteAPartager` écrit `- yaourt (à la place de : Crème, 40 cl)`.
- `drive.test.ts` : `texteListeDrive` idem sans tiret ; `htmlListeMagasin` écrit `<span class="n">a&lt;b</span>` pour un remplacement `a<b`, et l'origine dans `.q`.

- [ ] **Step 2 : lancer** `npm test --workspace=hub -- remplacements listeCourses coursesTelephone drive` (adapter le nom du workspace à `apps/hub/package.json`). Attendu : échec, `remplacements` introuvable.
- [ ] **Step 3 : implémenter.** Ajouter `remplacement?: string` à `ArticleCourses`. `fusionnerReimport` reprend `e.remplacement` dans la branche « repris ». `champsDuPlan` et `oublisAReporter` ne changent pas. `texteAPartager`, `ligneArticle` de `drive.ts` et `htmlListeMagasin` utilisent le remplacement. `npm run build:types`.
- [ ] **Step 4 : relancer.** Attendu : tout passe.
- [ ] **Step 5 : commit** `feat(courses) : champ remplacement et logique pure`.

### Task 2 : repas d'un article (logique pure)

**Files:**
- Create: `apps/hub/src/lib/repasArticle.ts`, `apps/hub/src/lib/repasArticle.test.ts`

**Interfaces — Consumes:** `indicesIngredient` (Task 1), `quantiteAjustee`, `portionsParDefaut` (`repasCuisine.ts`).

**Produces:**
```ts
export type EntreeRepasArticle =
  | { type: "repas"; cle: string; recetteId: string; nomRecette?: string; date?: string; repas: Repas; annule: boolean; passe: boolean; quantite: string | null; portions: number }
  | { type: "batch"; cle: string; recetteId: string; nomRecette?: string; dateCuisine: string; mange: Array<{ date?: string; repas: Repas; annule: boolean }>; annule: boolean; passe: boolean; quantite: string | null; portions: number }
  | { type: "hors-menu"; cle: string; recetteId: string; nomRecette?: string };
export interface RepasDeLArticle { entrees: EntreeRepasArticle[]; nombreRepas: number; libelleBouton: string }
export function repasDeLArticle(
  article: Pick<ArticleCourses, "nom" | "recetteIds">,
  slots: Array<MealPlanSlot & { id: string }>,
  batchs: Array<BatchSession & { id: string }>,
  recettes: Record<string, Recette | undefined>,
  aujourdhuiISO: string,
  debutPlanISO?: string,
): RepasDeLArticle;
```

Règles (spec, § Le panneau) :
- La date d'un repas est `slot.date`, sinon `debutPlanISO + slot.jour`.
- Un repas est `passe` si sa date est avant aujourd'hui (l'heure n'entre pas en compte). Il continue de compter.
- Un repas qui a `batchSessionId` d'une session contenant la recette alimente l'entrée `batch`, sans ligne séparée.
- `nombreRepas` compte des repas **distincts** non annulés (ensemble d'ids de slot), plus 1 par batch sans repas rattaché.
- `libelleBouton` : `"N repas"` ; `"Voir"` s'il n'y a que des entrées `hors-menu`.
- Quantité : indices de `indicesIngredient`, chaque ligne `quantiteAjustee(q, recette.portions, portions)` + unité, jointes par ` + `, sans addition ; aucun indice ou recette absente → `null`.
- Portions : `portionsParDefaut(slot, recette.portions)` pour un repas, `recette.portions` pour un batch.
- Tri : date (jour de cuisine pour un batch), puis petit-déjeuner, déjeuner, dîner ; `hors-menu` en dernier.

- [ ] **Step 1 : écrire les tests qui échouent**, un par cas :
  - recette dans deux repas → 2 entrées, « 2 repas » ;
  - deux recettes dans le même repas → 2 entrées, « 1 repas » ;
  - repas annulé → entrée `annule`, non compté ; tous annulés → « 0 repas » ;
  - repas passé → `passe: true`, compté ;
  - batch mangé mardi et jeudi → 1 entrée, `mange` de longueur 2, « 2 repas » ;
  - mardi annulé → `mange[0].annule`, « 1 repas » ;
  - tous annulés → `annule: true`, « 0 repas », même avec `done: true` ;
  - batch sans repas → `mange: []`, « 1 repas » ;
  - batch plus un repas ordinaire de la même recette → 2 entrées ;
  - tri sur le jour de cuisine ; `passe` du batch vrai seulement si tous ses repas sont passés ;
  - recette dans aucun repas → `hors-menu`, « Voir » ;
  - recette manquante dans `recettes` → entrée présente, `quantite: null` ;
  - portions : recette pour 4, 2 présents, `"200"` + `g` → `"100 g"` ;
  - deux lignes au même nom → `"20 g + 30 g"` ;
  - slot sans `date` → date issue de `debutPlanISO`.
- [ ] **Step 2 : lancer** les tests de `repasArticle`. Attendu : échec, module introuvable.
- [ ] **Step 3 : implémenter `repasDeLArticle`.**
- [ ] **Step 4 : relancer.** Attendu : tout passe.
- [ ] **Step 5 : commit** `feat(courses) : repas d'un article`.

### Task 3 : lectures et écriture

**Files:**
- Modify: `apps/hub/src/lib/useListeCourses.ts`
- Create: `apps/hub/src/lib/useRepasDesArticles.ts`, `apps/hub/src/lib/useRemplacementsEnCours.ts`
- Modify: `firestore-tests/rules.test.ts`
- Test: `apps/hub/src/lib/remplacements.test.ts`

**Interfaces — Produces:**
- `ListeCoursesApi.remplacer(id: string, brut: string): void` : `texteRemplacement(brut)` ; `null` → `updateDoc(ref, { remplacement: deleteField() })` si l'article en a un, sinon rien ; sinon `updateDoc(ref, { remplacement })`. Passe par `refArticle` (refus avec message sur l'ancien format). Erreur : `signalerErreur(err, "Le remplacement n'a pas pu être enregistré.")`. Invalide `["remplacementsEnCours", householdId]`.
- `useRepasDesArticles(householdId?, plan?: MealPlanWithId): { resume(article): RepasDeLArticle; chargement: boolean }` : `usePlanSlots`, `usePlanBatchSessions`, et une lecture tolérante des recettes de tous les slots et batchs. La lecture part au montage de la page, pour remplir le cache avant le magasin.
- `lectureTolerante<T>(ids: string[], lire: (id: string) => Promise<T | null>): Promise<Record<string, T>>` dans `remplacements.ts` : `Promise.allSettled`, un échec est simplement absent du résultat.
- `useRemplacementsEnCours(householdId?): RemplacementActif[]` : `useAllPlans(householdId, 3)`, filtre `semaineEnCours` (dates via `dateDuTimestamp` + `dateISOLocale`), listes `where("planId", "in", ids)`, puis `getDocs` de leurs `items` ; garde les articles qui ont un `remplacement`. Clé `["remplacementsEnCours", householdId, ids]`. Aucun plan en cours → `[]` sans lecture.

- [ ] **Step 1 : écrire les tests qui échouent.** `lectureTolerante` : une lecture rejetée et une réussie → seule la réussie est dans le résultat ; lecture à `null` → absente. Règles : un membre met à jour `remplacement` d'un article ; un écran lit `shoppingLists/sl1/items/i1` ; un écran ne peut pas l'écrire.
- [ ] **Step 2 : lancer** les tests hub, puis `npx firebase-tools@15.31.0 emulators:exec --only firestore --project demo-fh "npm test --prefix firestore-tests"` (JDK dans `C:\Program Files\Eclipse Adoptium`). Attendu : échec sur `lectureTolerante` ; les règles passent déjà, puisqu'elles ne changent pas.
- [ ] **Step 3 : implémenter** `lectureTolerante`, `remplacer` et les deux hooks.
- [ ] **Step 4 : relancer** les mêmes commandes et `npx tsc -p apps/hub/tsconfig.app.json --noEmit`. Attendu : tout passe.
- [ ] **Step 5 : commit** `feat(courses) : lire les repas, écrire le remplacement`.

### Task 4 : bouton, panneau et affichage sur la liste

**Files:**
- Create: `apps/hub/src/components/courses/NomArticle.tsx`, `BoutonRepas.tsx`, `PanneauRepasArticle.tsx`
- Modify: `apps/hub/src/components/courses/LigneArticle.tsx`, `VueTri.tsx`, `VueMagasin.tsx`, `ListeDrive.tsx`, `SectionCoursesPc.tsx`, `apps/hub/src/pages/Courses.tsx`, `apps/hub/src/pages/Menu.tsx`

**Interfaces — Consumes:** Tasks 1 à 3.

**Produces:**
- `NomArticle({ article })` : `nom` seul, ou `<s>nom</s> → remplacement`. Le barré de coche existant reste sur l'ensemble.
- `BoutonRepas({ libelle, nom, onClick })` : `min-h-12`, `aria-label={`Voir les repas de ${nom}`}`, texte visible = libellé. Il n'est pas imbriqué dans le bouton qui coche.
- Props ajoutées à `VueTri`, `VueMagasin`, `ListeDrive`, `LigneArticle` : `repasDe?(article): RepasDeLArticle` et `onVoirRepas?(article): void`. Bouton affiché seulement si `article.recetteIds.length > 0`.
- `PanneauRepasArticle({ article, repas, onRemplacer, onFermer })` : en bas sur téléphone, centré sur PC (`items-end md:items-center`), `max-h-[85dvh]` défilant. Échap, fond cliquable et focus piégé comme `RecetteDetailModal`.

Contenu du panneau (titres et textes de la spec) :
- en-tête `{nom} · {quantité} sur la liste` ;
- entrée repas : `titreRepas`, nom, quantité, lien `/livre-recettes/{id}?portions={portions}` ; annulée → barrée ; passée → `text-cream-mute` ;
- entrée batch : `Cuisiné {jour} · mangé {jours}`, jours annulés barrés ; sans repas : `Cuisiné {jour}` ;
- entrée hors menu : nom + `Pas prévue dans le menu` ;
- champ `Remplacer par (facultatif)`, `maxLength={100}`, bouton `OK` ; si un remplacement existe, pré-rempli, avec `Annuler le remplacement`.
- recette sans nom connu : `Recette indisponible sans réseau`, sans lien.

`ListeDrive` : `lienRechercheDrive(a.remplacement ?? a.nom, modele)`. `SectionCoursesPc` reçoit `householdId` et `plan` depuis `Menu.tsx` ; son `ApercuMagasin` affiche aussi `NomArticle` et `BoutonRepas`.

- [ ] **Step 1 : écrire le test qui échoue**, pur : `lienRechercheDrive` reçoit le remplacement ; extraire `titreEntreeBatch(entree): string` dans `repasArticle.ts` et tester `Cuisiné dimanche 8 · mangé mardi 10 et jeudi 12` et `Cuisiné dimanche 8`.
- [ ] **Step 2 : lancer.** Attendu : échec, `titreEntreeBatch` introuvable.
- [ ] **Step 3 : implémenter** `titreEntreeBatch`, puis les composants et le câblage. L'état du panneau est un `articleId` dans `Courses` et `SectionCoursesPc`, relu dans `articles` pour suivre les changements en direct.
- [ ] **Step 4 : vérifier** `npm test`, `npx tsc -p apps/hub/tsconfig.app.json --noEmit` et le test `tailwindClasses`. Attendu : tout passe.
- [ ] **Step 5 : commit** `feat(courses) : panneau des repas et remplacement`.

### Task 5 : remplacement dans les recettes du hub

**Files:**
- Create: `apps/hub/src/components/recette/RappelRemplacements.tsx`, `NomIngredient.tsx`
- Modify: `apps/hub/src/components/recette/ListeIngredients.tsx`, `apps/hub/src/pages/RecetteDetail.tsx`, `apps/hub/src/pages/ModeRecette.tsx`, `apps/hub/src/pages/BatchCooking.tsx`, `apps/hub/src/components/menu/RecetteDetailModal.tsx`

**Interfaces — Consumes:** `useRemplacementsEnCours`, `remplacementsDeRecette`, `carteRemplacements`.

**Produces:**
- `RappelRemplacements({ remplacements })` : une ligne par actif, `Cette semaine : {remplacement} à la place de {nomArticle}` ; rien si la liste est vide.
- `NomIngredient({ libelle, remplacement })` : `libelle`, ou `<s>{libelle}</s> → {remplacement}`.
- `ListeIngredients` gagne `remplacements?: RemplacementActif[]`.

Emplacements du rappel : `RecetteDetail`, au-dessus des deux colonnes ; `RecetteDetailModal`, en haut du corps défilant ; `ModeRecette`, en haut de `Ingredients`, par recette ; `BatchCooking`, juste avant `ListeIngredients`. Une recette hors plan en cours n'affiche rien.

- [ ] **Step 1 : écrire le test qui échoue**, pur : `texteRappel({ nomArticle: "Crème", remplacement: "yaourt", recetteIds: [] })` vaut `Cette semaine : yaourt à la place de Crème` (dans `remplacements.ts`).
- [ ] **Step 2 : lancer.** Attendu : échec, `texteRappel` introuvable.
- [ ] **Step 3 : implémenter** et câbler les quatre écrans. Aucun de ces écrans n'écrit dans `recettes/{id}`.
- [ ] **Step 4 : vérifier** `npm test` et `npx tsc -p apps/hub/tsconfig.app.json --noEmit`. Attendu : tout passe.
- [ ] **Step 5 : commit** `feat(recettes) : remplacement de la semaine dans les recettes`.

### Task 6 : iPad

**Files:**
- Create: `apps/display/public/js/remplacements.js`, `packages/design/src/displayRemplacements.test.ts`
- Modify: `apps/display/public/index.html` (script avec `?v=__DISPLAY_VERSION__`, **avant** `mode-recette.js`)
- Modify: `apps/display/public/js/core.js`, `apps/display/public/js/mode-recette.js`, `apps/display/public/js/tiles/livreRecettes.js`, `apps/display/public/css/mode-recette.css`, `apps/display/public/css/plein-ecran.css`

**Interfaces — Produces:**
- `core.js` : `window.FamilyHubGetTileSnapshotByType(type)` : données de la première tuile de ce type, sinon `null`.
- `root.FamilyHubRemplacements` :
  - pures, comparées au hub : `cleIngredientEs5`, `indicesIngredientEs5`, `carteRemplacementsEs5` (objet libellé → remplacement), `remplacementsDeRecetteEs5`, `semaineEnCoursEs5`, `plansEnCoursEs5(plans, aujourdhuiISO)`, `texteRappelEs5` ;
  - `lire(): Promise<actifs>` : plans du snapshot `weekly-menu`, `shoppingLists` par `planId`, puis `items`. Résout `[]` sans snapshot, sans base, en erreur ou après 3 000 ms. Ne rejette jamais.

Accents : table explicite comme `deburr` de `livreRecettes.js`, sans `normalize`. Le pluriel suit `normaliserNom`.

Mode recette : le rendu ne dépend pas de la lecture. À l'ouverture, `lire()` part en parallèle ; à la réponse, si `monJeton === jeton && ecran === e`, poser `e.remplacements` et rappeler `majPortions(e)`. `rendreIngredients` affiche par recette le rappel `.fh-mr-rappel`, et `<s>{libellé}</s> → {remplacement}` sur les lignes concernées, tout passé par `echapper`.

Fiche du livre : après `wrap.innerHTML` dans `showDetail`, `lire()` ; à la réponse, si la fiche affichée est toujours `r`, insérer le rappel `.fh-lv-rappel` en tête de `.fh-lv-fiche-ing` et réécrire les lignes concernées (`data-libelle` sur chaque `li`, `escapeHTML`).

- [ ] **Step 1 : écrire les tests qui échouent**, sur le modèle de `displayModeRecette.test.ts` (exécution en `vm`, comparaison au hub) :
  - les mêmes cas que Task 1 pour les noms, accents et `œ` compris, via `expect(es5).toEqual(ts)` ;
  - `semaineEnCoursEs5` aux bornes ;
  - `plansEnCoursEs5` garde un plan archivé dont la semaine court et écarte un plan actif dont la semaine est finie ou pas commencée ;
  - le fichier ne contient ni `normalize(` ni `=>` ;
  - `lire()` résout `[]` sans `FamilyHubGetDb` et sans snapshot.
- [ ] **Step 2 : lancer** `npm test --workspace=@family-hub/design -- displayRemplacements`. Attendu : échec, fichier absent.
- [ ] **Step 3 : implémenter** `remplacements.js` et l'accès au snapshot, puis les deux écrans et les styles (`.fh-mr-rappel`, `.fh-lv-rappel` : `font-weight: 700`, marge basse, sans `gap` ni variable CSS).
- [ ] **Step 4 : vérifier** `npm run check:display` et `npm test --workspace=@family-hub/design`. Attendu : tout passe, y compris `displayModeRecette`.
- [ ] **Step 5 : commit** `feat(ipad) : remplacement de la semaine dans les recettes`.

### Task 7 : parcours complet et documentation

**Files:**
- Modify: `docs/ETAT.md`, `CHANGELOG.md`
- Move: spec et plan dans `docs/archive/2026/superpowers/{specs,plans}/`, avec une ligne dans `docs/archive/INDEX.md`

- [ ] **Step 1 : lancer l'ensemble.** `npm run build`, `npm test` dans `@family-hub/design`, `@family-hub/types`, `functions` et hub, puis les tests de règles. Attendu : tout passe. Le build exige `apps/hub/.env.local` : le copier depuis le clone principal, il reste hors de git.
- [ ] **Step 2 : parcours navigateur sur émulateur, à 390 px de large** (voir les notes `docs/controle-parental/SIMULATEUR.md` et le lancement `npx vite --mode essai --port X` depuis `apps/hub`). Vérifier et capturer :
  - ouvrir le panneau sans cocher l'article ;
  - fermer sans rien saisir : aucune écriture ;
  - noter un remplacement : visible sur la ligne, dans la recette, avec le rappel ;
  - annuler le remplacement ;
  - refaire hors ligne, puis constater l'envoi au retour du réseau ;
  - contrôler que `recettes/{id}` n'a pas changé.
- [ ] **Step 3 : contrôler l'iPad.** Servir `apps/display`, ou l'ouvrir sur émulateur si l'appairage le permet : rappel en mode recette et sur la fiche du livre. Si ce n'est pas possible sans l'iPad réel, le dire clairement au propriétaire comme vérification restante ; ne pas la déclarer faite.
- [ ] **Step 4 : mettre à jour** `docs/ETAT.md` et `CHANGELOG.md`, archiver spec et plan.
- [ ] **Step 5 : scanner tous les commits.** `git log -p origin/main..HEAD`, à la recherche de prénoms et de données de la famille (écrire le motif avec des alternatives pour les lettres accentuées, et faire un témoin). Attendu : rien.
- [ ] **Step 6 : commit** `docs(courses) : état, changelog, archivage de la spec et du plan`.
