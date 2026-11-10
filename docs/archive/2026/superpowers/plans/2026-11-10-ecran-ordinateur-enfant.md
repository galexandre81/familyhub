# Écran « Ordinateur des enfants » : plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gérer, depuis la page « iPad de cuisine », un second écran de type ordinateur (celui d'un enfant) sans toucher l'iPad, et cacher sur cet écran la carte « PC des enfants ».

**Architecture:** Le hub choisit deux écrans dans la collection `displays` (la tablette et l'ordinateur les plus récents) et offre à chacun ses boutons ; l'appairage, les instantanés, les règles et la suppression existants servent tels quels. Côté iPad, le tableau reçoit son propre document d'écran et une fonction pure décide de monter ou non la carte du PC.

**Tech Stack:** React + Vite + TS (hub, tests vitest), JavaScript ES5 de l'iPad (tests vitest en vm), aucune fonction ni règle Firestore modifiée.

**Spec:** `docs/superpowers/specs/2026-11-10-ecran-ordinateur-enfant-design.md`

## Global Constraints

- `apps/display/` reste compatible Safari iOS 9 : ES5 seulement, pas de `let`, flèches, `const`, template strings.
- Aucun changement dans `firestore.rules` ni dans `functions/`.
- Aucun mot technique à l'écran du hub (pas « display », « desktop », « token »).
- Dépôt public : aucun prénom ni identifiant réel dans le code ou les docs.
- Toute modification de comportement met à jour `docs/ETAT.md` et `CHANGELOG.md` dans le même commit.

## Review Focus

- Un foyer qui n'a encore aucun écran de type ordinateur : la page propose « Ajouter », rien d'autre (Task 1 : `choisirOrdinateur([])` renvoie `null`).
- Deux écrans de type ordinateur (ancien PC appairé avant la refonte) : le plus récent est l'ordinateur des enfants, l'autre reste dans « Anciens écrans » (Task 1).
- Un écran dont le document n'a pas de `type` (très ancien) : jamais pris pour l'ordinateur ni l'iPad (Task 1).
- L'iPad reçoit un contexte sans `ecran` (ancienne version de core.js en cache) : la carte reste affichée, comme avant (Task 4 : `montrerCartePc(undefined)` vrai).
- La fenêtre d'appairage pour un ordinateur ne doit proposer aucun QR code ni mentionner Safari ou AirDrop (Task 2).

---

### Task 1 : choisir l'ordinateur des enfants parmi les écrans

**Files:**
- Modify: `apps/hub/src/lib/ipadCuisine.ts`
- Test: `apps/hub/src/lib/ipadCuisine.test.ts`

**Interfaces:**
- Produces: `choisirOrdinateur<E extends EcranLu>(ecrans: E[]): E | null` (type `"desktop"`, le plus récent par `updatedAt`) ; `autresEcrans<E>(ecrans: E[], ipad: E | null, ordinateur: E | null): E[]` (troisième paramètre nouveau, facultatif).

- [ ] **Step 1: Écrire les tests**

```ts
describe("choisirOrdinateur", () => {
  it("prend l'ordinateur modifié le plus récemment, jamais une tablette ni un téléphone", () => {
    const ecrans = [
      { id: "ipad", type: "ipad-mini-1", updatedAt: new Date(NOW) },
      { id: "vieux-pc", type: "desktop", updatedAt: new Date(NOW - 10_000) },
      { id: "pc", type: "desktop", updatedAt: new Date(NOW - 1_000) },
      { id: "tel", type: "mobile", updatedAt: new Date(NOW) },
      { id: "sans-type" },
    ];
    expect(choisirOrdinateur(ecrans)?.id).toBe("pc");
    expect(autresEcrans(ecrans, choisirIpad(ecrans), choisirOrdinateur(ecrans)).map((e) => e.id))
      .toEqual(["vieux-pc", "tel", "sans-type"]);
  });
  it("aucun ordinateur : null ; autresEcrans sans troisième argument inchangé", () => {
    expect(choisirOrdinateur([{ id: "ipad", type: "ipad-mini-1" }])).toBeNull();
    expect(autresEcrans([{ id: "pc", type: "desktop" }], null).map((e) => e.id)).toEqual(["pc"]);
  });
});
```

- [ ] **Step 2: Lancer, vérifier l'échec** : `npm test --workspace=hub -- ipadCuisine` → `choisirOrdinateur is not a function`.
- [ ] **Step 3: Implémenter** `choisirOrdinateur` (filtre `type === "desktop"`, réduction par `versMs(updatedAt)` comme `choisirIpad`) et étendre `autresEcrans(ecrans, ipad, ordinateur = null)`.
- [ ] **Step 4: Lancer, vérifier le succès** de tout `npm test --workspace=hub`.
- [ ] **Step 5: Commit** `hub : choisir l'ordinateur des enfants parmi les écrans du foyer`.

### Task 2 : phrases de la fenêtre d'appairage selon l'appareil

**Files:**
- Create: `apps/hub/src/lib/appairage.ts`, `apps/hub/src/lib/appairage.test.ts`
- Modify: `apps/hub/src/components/SetupTokenModal.tsx`

**Interfaces:**
- Produces: `type CibleAppairage = "ipad" | "ordinateur"` ; `phrasesAppairage(cible: CibleAppairage): { appareil: string; navigateur: string; intro: string; avertissement: string; code: string; lien: string; qr: boolean }` ; prop facultative `cible?: CibleAppairage` (défaut `"ipad"`) sur `SetupTokenModal`.

- [ ] **Step 1: Écrire les tests**

```ts
it("iPad : Safari, QR code proposé", () => {
  const p = phrasesAppairage("ipad");
  expect(p.navigateur).toBe("Safari");
  expect(p.qr).toBe(true);
  expect(p.avertissement).toContain("uniquement sur l'iPad");
});
it("ordinateur : Chrome, pas de QR code, jamais Safari ni AirDrop", () => {
  const p = phrasesAppairage("ordinateur");
  expect(p.navigateur).toBe("Chrome");
  expect(p.qr).toBe(false);
  for (const t of Object.values(p)) if (typeof t === "string") expect(t).not.toMatch(/Safari|AirDrop|iPad/);
  expect(p.avertissement).toContain("uniquement sur l'ordinateur des enfants");
});
```

- [ ] **Step 2: Vérifier l'échec**, **Step 3: Implémenter** `phrasesAppairage` ; dans la fenêtre, remplacer les textes fixes par les phrases et n'afficher la colonne QR que si `qr`. Le lien long de secours reste.
- [ ] **Step 4: `npm test --workspace=hub` et `npx tsc -p apps/hub/tsconfig.app.json --noEmit`**.
- [ ] **Step 5: Commit** `hub : la fenêtre d'appairage parle de l'appareil visé`.

### Task 3 : section « Ordinateur des enfants » de la page iPad de cuisine

**Files:**
- Modify: `apps/hub/src/pages/IpadCuisine.tsx`

**Interfaces:**
- Consumes: Task 1 et Task 2 ; `useCreateDisplay`, `useDeleteDisplay`, `useUpdateDisplayLayout`, `layoutCuisine`, `tuileParDefaut`, `rafraichirEcransSansAttendre`, `SetupTokenModal` existants.

- [ ] **Step 1: Implémenter**
  - `const ordinateur = choisirOrdinateur(ecrans ?? [])`, `anciens = autresEcrans(ecrans, ipad, ordinateur)`.
  - `ajouterOrdinateur()` : `createDisplay` avec `nom: "Ordinateur des enfants"`, `type: "desktop"`, `resolution: { w: 1280, h: 800 }`, `gridConfig` identique à l'iPad, puis `preparerEcran(id, [])`.
  - Factoriser `preparer()` en `preparerEcran(displayId: string, layoutActuel: DisplayLayoutEntry[])` (création des tuiles manquantes, `updateLayout`, rafraîchissement) ; l'iPad l'appelle avec son layout.
  - État `appairage: { id: string; nom: string; cible: CibleAppairage } | null` à la place du booléen ; la fenêtre reçoit `cible`.
  - Section (après l'iPad, avant « Ce qu'il affiche ») : titre « Ordinateur des enfants », texte « Pour qu'un enfant voie les menus et les recettes sur son ordinateur, en lecture seule. La carte du PC des enfants n'y apparaît pas. » ; sans écran : bouton « Ajouter l'ordinateur des enfants » ; avec écran : état d'appairage (mêmes phrases que l'iPad), boutons « Appairer l'ordinateur », « Mettre à jour », « Préparer » si incomplet, « Retirer cet écran » (confirmation existante). Icône `Monitor`.
  - Mettre à jour le commentaire d'en-tête du fichier.
- [ ] **Step 2: Vérifier** `npm run lint --workspace=hub`, `npx tsc -p apps/hub/tsconfig.app.json --noEmit`, `npm test --workspace=hub`.
- [ ] **Step 3: Parcours dans Chromium sur émulateurs** (`npm run emulateurs:essai`, `npm run dev:hub:essai`, simulateur `preparer`) : ajouter l'ordinateur, l'iPad reste « Appairé », « Anciens écrans » absent, fenêtre d'appairage sans QR.
- [ ] **Step 4: Commit** `hub : un second écran de cuisine pour l'ordinateur des enfants`.

### Task 4 : l'iPad cache la carte « PC des enfants » sur un écran ordinateur

**Files:**
- Modify: `apps/display/public/js/tableau.js`, `apps/display/public/js/core.js`
- Test: `packages/design/src/displayTableau.test.ts`

**Interfaces:**
- Produces: `montrerCartePc(ecran)` exposée dans l'API de `tableau.js` (comme `titrePc`) ; contexte du tableau enrichi de `ecran: function () { return state.displayConfig; }` dans `core.js`.

- [ ] **Step 1: Écrire le test**

```ts
describe("montrerCartePc", () => {
  it("cachée sur un écran de type ordinateur, montrée partout ailleurs et sans écran", () => {
    expect(api.montrerCartePc({ type: "desktop" })).toBe(false);
    expect(api.montrerCartePc({ type: "ipad-mini-1" })).toBe(true);
    expect(api.montrerCartePc({})).toBe(true);
    expect(api.montrerCartePc(undefined)).toBe(true);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** : `npm test --workspace=@family-hub/design -- displayTableau`.
- [ ] **Step 3: Implémenter** : dans `tableau.js`, `function montrerCartePc(ecran) { return !(ecran && ecran.type === 'desktop'); }` ; dans `monter`, lire `ctx.ecran()` (protégé par try) et ne créer ni attacher `pcEl` ni son rendu si faux. Dans `core.js`, ajouter `ecran` au contexte et ne pas appeler `FamilyHubPc.demarrer` quand `state.displayConfig.type === 'desktop'`.
- [ ] **Step 4: Vérifier** `npm test --workspace=@family-hub/design`, `npm run check:display`.
- [ ] **Step 5: Commit** `iPad : pas de carte « PC des enfants » sur l'écran d'un enfant`.

### Task 5 : documentation et archivage

**Files:**
- Modify: `docs/ETAT.md`, `CHANGELOG.md`, `ONBOARDING.md` (§ 8.6, note « Un seul iPad à la fois »), `docs/controle-parental/BILAN.md` (décision du 10.11), `docs/archive/INDEX.md`
- Move: spec et plan vers `docs/archive/2026/superpowers/{specs,plans}/`

- [ ] **Step 1:** ETAT « Livré » (10.11) et « Prochaines étapes » (côté propriétaire : liste devoirs, appairage, icône) ; CHANGELOG « Ajouté » ; ONBOARDING : la note devient « Un seul iPad : appairer un autre iPad déconnecte le premier. L'ordinateur d'un enfant a sa propre section et son propre code. » ; BILAN : une ligne de décision.
- [ ] **Step 2:** `git mv` de la spec et du plan, ligne dans `docs/archive/INDEX.md`.
- [ ] **Step 3: Commit** `docs : écran de l'ordinateur des enfants`.
