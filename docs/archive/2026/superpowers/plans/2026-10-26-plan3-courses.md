# Plan 3 — Liste de courses (tri, drive, magasin hors ligne) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une liste de courses partagée qu'on trie à la maison (déjà / drive / magasin, placard à vérifier), qu'on passe en drive Intermarché depuis le PC, et qu'on coche en magasin sans réseau, chaque coche à la couleur de la personne et synchronisée au retour du réseau.

**Architecture:** La liste reste un document `shoppingLists/{listId}` (lié au plan), mais chaque article devient un document de la sous-collection `items/{itemId}`, modifié champ par champ sans transaction : deux téléphones hors ligne ne s'écrasent plus. Une migration idempotente côté hub convertit les listes existantes (tableau `items`). L'import de plan écrit la sous-collection et conserve tri et coches au ré-import. Lecture en temps réel (`onSnapshot`) sur le cache Firestore persistant (plan 2).

**Tech Stack:** React 18, Firebase JS 11 (Firestore persistant), React Query 5 (`networkMode: "always"`), Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-refonte-ipad-mobile-design.md` (§6, §8 bis « Courses hors ligne »).

## Global Constraints

- Installer une dépendance uniquement avec `npx -y npm@10 install … --ignore-scripts` (aucune n'est prévue).
- `npm run build` passe à la fin de chaque tâche ; tests : `npm test --workspace=hub`, `--workspace=@family-hub/types`, `--workspace=functions` si touchées.
- **Aucune transaction ni Cloud Function dans le parcours des courses** (tri, cochage, ajout, suppression) ; écritures sans attente de l'accusé serveur (l'UI suit le cache local).
- Apparence : jetons du design system ; cibles ≥ 48 px sur téléphone, lignes d'articles de 60 px ; une seule chose en jaune (`--c-maintenant`) par écran ; icône + mot ; case cochée à la couleur de la personne qui a coché (`couleurDuProfil` du profil relié au compte `checkedBy`).
- Ce qui est coché descend en bas de son rayon, barré, n'est jamais effacé ; on peut décocher.
- Produits de placard : **jamais effacés par défaut**, rangés dans « Sûrement dans le placard — à vérifier », affiché en premier pendant le tri.
- Drive : Intermarché, **liste drive sur le PC seulement** ; aucun remplissage automatique du panier.
- L'iPad n'est pas modifié dans ce plan (sa tuile courses disparaît au plan 4) ; rien n'est déployé entre les plans.
- Textes en français, tutoiement. Aucun déploiement. Commits : trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

- Deux téléphones hors ligne cochent des articles différents puis retrouvent le réseau : toutes les coches restent — garanti par le modèle (un document par article, `updateDoc` par champ) ; test de la fonction qui construit le patch (seuls les champs modifiés).
- Liste existante (ancien format tableau) ouverte pour la première fois par deux appareils en même temps : migration sans doublon ni perte — ids déterministes (= ancien `item.id`), test de `migrerArticles`.
- Ré-import du même plan après avoir trié et coché : le tri et les coches des articles identiques sont conservés, les oublis ajoutés à la main restent — test de `fusionnerReimport`.
- Article au nom accentué / pluriel / composé (« huile d'olive », « Œufs », « gousses d'ail ») : détection placard et regroupement corrects — tests de `estProduitPlacard` et `normaliserNom`.
- Article sans rayon connu ou rayon legacy (`RayonCourses`) : rangé dans « Autres », jamais perdu — test du regroupement par rayon.

---

### Task 1: Invitation — pas deux acceptations en même temps

**Files:** Modify `apps/hub/src/lib/invitationContext.tsx` (ou le fichier qui relance l'acceptation au retour du réseau) ; test sur la logique pure si extraite.

- [ ] **Step 1:** Ne pas relancer `acceptInvitation` si un appel est déjà en cours (`enCours`) ; un refus `deja-membre` reçu **après** un succès dans la même session n'écrase pas « Bienvenue ». Extraire la décision dans `decisionResultat(precedent, nouveau)` testée. **Step 2:** tests + build. **Step 3: Commit** `fix(hub): une seule acceptation d'invitation à la fois`

### Task 2: Modèle « un document par article », migration et lecture en temps réel

**Files:**
- Modify: `packages/types/src/shoppingList.ts` (nouveaux types)
- Create: `apps/hub/src/lib/listeCourses.ts` (logique pure) + test `listeCourses.test.ts`
- Create: `apps/hub/src/lib/useListeCourses.ts` (abonnement + migration + actions)

**Interfaces:**
- Types :
  - `type DestinationArticle = "a-trier" | "deja" | "drive" | "magasin"`
  - `interface ArticleCourses { nom: string; quantite: number; unite: string; rayon: ShoppingListRayon | RayonCourses; recetteIds: string[]; ajoutManuel: boolean; destination: DestinationArticle; placard: boolean; checked: boolean; checkedAt?: Timestamp | null; checkedBy?: string | null; ordre: number; createdAt?: Timestamp }` — document `households/{hid}/shoppingLists/{listId}/items/{itemId}`.
  - `ShoppingList` garde `planId`, `lastSharedAt?`, `createdAt`, `updatedAt` ; ajoute `format?: 2` ; `items?` devient optionnel et marqué ancien format.
- Pur (`listeCourses.ts`) :
  - `normaliserNom(nom: string): string` — minuscules, sans accents, `œ`→`oe`, espaces réduits, pluriel final `s`/`x` retiré par mot.
  - `cleArticle(a: { nom: string; unite: string }): string` = `normaliserNom(nom) + "|" + unite.trim().toLowerCase()`.
  - `migrerArticles(anciens: ShoppingListItem[], estPlacard: (nom: string) => boolean): Array<{ id: string; data: ArticleCourses }>` — id = ancien `item.id` ; `destination` = `"magasin"` si `checked`, sinon `"a-trier"` ; `placard` calculé ; `ordre` = index.
  - `patchCoche(coche: boolean, uid: string): Partial<ArticleCourses>` → `{ checked, checkedBy: coche ? uid : null, checkedAt: coche ? <horodatage serveur> : null }` (l'horodatage est passé en paramètre pour rester pur).
  - `grouperParRayon(articles: Array<ArticleCourses & { id: string }>): Array<{ rayon: string; libelle: string; articles: …; restants: number }>` — ordre des rayons : fruits-légumes, boulangerie, boucherie, poissonnerie, crémerie, surgelés, épicerie, boissons, autres ; rayon inconnu → « autres » ; dans un rayon : non cochés d'abord (ordre), cochés ensuite.
  - `vueTri(articles)`, `vueMagasin(articles)`, `vueDrive(articles)` : `vueTri` = d'abord les `placard && destination === "a-trier"` (section « Sûrement dans le placard — à vérifier »), puis les autres `a-trier`, puis les déjà triés (repliés) ; `vueMagasin` = `destination` ∈ {`magasin`, `a-trier`} (un article non trié part au magasin par défaut) hors `deja` ; `vueDrive` = `destination === "drive"`.
- Hook : `useListeCourses(householdId?: string, planId?: string): { liste?: ShoppingList & { id: string }; articles: Array<ArticleCourses & { id: string }>; chargement: boolean; trier(id, destination): void; cocher(id, coche: boolean): void; ajouterOubli(nom: string): void; supprimer(id): void }` — `onSnapshot` sur la liste du plan (`where planId ==`) et sur sa sous-collection `items` ; si la liste a encore un tableau `items` et pas `format: 2` → migration en un `writeBatch` (set des articles aux ids déterministes, puis `format: 2` et `items: deleteField()`) ; toutes les actions sont des `updateDoc`/`setDoc`/`deleteDoc` **sans await bloquant** (erreur → toast). Un oubli ajouté : `ajoutManuel: true`, `destination: "magasin"`, rayon `"autres"`, `ordre` = max + 1.

- [ ] **Step 1: Tests** de toutes les fonctions pures (cas du Review Focus : migration idempotente, « Œufs »/« oeuf », rayon legacy → autres, cochés en bas). **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS + build. **Step 5: Commit** `feat: liste de courses — un document par article, migration, temps réel`

### Task 3: Produits de placard

**Files:**
- Create: `packages/types/src/placard.ts` (exporté) + test
- Modify: `packages/types/src/household.ts` (`parametres.placard?: string[]`), `apps/hub/src/pages/Parametres.tsx` (section « Produits de placard » : liste éditable, ajouter/retirer, bouton « Remettre la liste par défaut »)
- Modify: `apps/hub/src/lib/planImportSchema.ts` (champ optionnel `placard?: boolean` sur un article de courses) et `apps/hub/src/lib/planMd.ts` (consigne au modèle : marquer `"placard": true` les produits qu'on a en général à la maison — sel, poivre, farine, sucre, huiles, vinaigres, moutarde, épices, levure, bouillon, etc. — **sans les retirer de la liste**)

**Interfaces:**
- `const PLACARD_DEFAUT: string[]` = sel, poivre, farine, sucre, sucre glace, huile, huile d'olive, vinaigre, moutarde, levure chimique, bicarbonate, bouillon, cube, épices, herbes de Provence, paprika, cumin, curry, piment d'Espelette, cannelle, muscade, sauce soja, miel, maïzena.
- `estProduitPlacard(nom: string, placard: string[] = PLACARD_DEFAUT): boolean` — vrai si le nom normalisé (même normalisation que `normaliserNom`, à déplacer dans `@family-hub/types` et réexporter côté hub) **commence par** ou **égale** une entrée normalisée (« huile d'olive vierge » ✓, « huile » ✓, « pommes de terre » ✗ pour « poivre », « sucre » ✓ mais « sucre glace » aussi).

- [ ] **Step 1: Tests** (`"Huile d'olive"` ✓, `"Piment d'Espelette"` ✓, `"poivrons rouges"` ✗, `"Sel fin"` ✓, `"selle d'agneau"` ✗ → correspondance par mot entier en début de nom). **Step 2:** FAIL. **Step 3:** implémenter + schéma + consigne + Paramètres. **Step 4:** PASS (types, hub) + build. **Step 5: Commit** `feat: produits de placard reconnus et rangés à part`

### Task 4: Import de plan — sous-collection, ré-import sans perte, report des oublis

**Files:**
- Modify: `apps/hub/src/lib/planImporter.ts` (§6-7 : lecture des articles existants du plan et des oublis du plan actif précédent ; écriture de la liste `format: 2` + articles)
- Create: `apps/hub/src/lib/ecritureParLots.ts` + test (découpe une liste d'opérations en lots de 450)
- Test: `apps/hub/src/lib/listeCourses.test.ts` (nouvelles fonctions)

**Interfaces:**
- `fusionnerReimport(existants: Array<ArticleCourses & { id: string }>, nouveaux: ArticleCourses[]): { aEcrire: Array<{ id?: string; data: ArticleCourses }>; aSupprimer: string[] }` — même `cleArticle` → garde `id`, `destination`, `checked`, `checkedBy`, `checkedAt` de l'existant, prend quantité/rayon/recettes du nouveau ; existants `ajoutManuel` absents du nouveau → conservés ; autres existants absents → supprimés.
- `oublisAReporter(articlesPlanPrecedent): ArticleCourses[]` — `ajoutManuel && !checked`, remis en `destination: "magasin"`.
- `ecrireParLots(db, operations: Array<(b: WriteBatch) => void>, taille = 450): Promise<void>` — le lot principal (plan, slots, recettes, liste) reste atomique ; les articles partent en lots supplémentaires si besoin.
- `placard` d'un article importé = `json.placard === true || estProduitPlacard(nom, parametres.placard)`.

- [ ] **Step 1: Tests** `fusionnerReimport` (tri conservé, oubli conservé, article disparu supprimé), `oublisAReporter`, `ecrireParLots` (1 001 opérations → 3 lots). **Step 2:** FAIL. **Step 3:** implémenter dans l'import. **Step 4:** PASS + build. **Step 5: Commit** `feat(import): liste en sous-collection, ré-import sans perte du tri, oublis reportés`

### Task 5: Onglet Courses du téléphone

**Files:**
- Modify: `apps/hub/src/pages/Courses.tsx` (remplace la page provisoire)
- Create: `apps/hub/src/components/courses/LigneArticle.tsx`, `apps/hub/src/components/courses/VueTri.tsx`, `apps/hub/src/components/courses/VueMagasin.tsx`

**Interfaces:** Consumes `useListeCourses`, `grouperParRayon`, `vueTri`, `vueMagasin` (tâche 2), `couleurDuProfil`, `profilDuCompte` (plan 2), `useProfils`, `useActivePlan`.

Écran :
- En-tête : « Courses », « Semaine du … », compteur `14 / 58` et barre de progression (articles du magasin cochés / total magasin), indicateur discret « Hors ligne — tes coches partiront au retour du réseau » quand `navigator.onLine` est faux.
- Deux modes en haut (boutons ≥ 48 px, icône + mot) : **« Trier »** et **« Magasin »** ; mode par défaut : « Trier » s'il reste des articles `a-trier`, sinon « Magasin » ; mode retenu en `sessionStorage`.
- **Trier** : section « Sûrement dans le placard — à vérifier » en premier, puis les articles à trier ; chaque ligne (60 px) montre nom + quantité et trois boutons « On l'a » / « Drive » / « Magasin » (icône + mot) ; un article trié quitte la section (repli « Déjà trié (n) » en bas, où l'on peut changer d'avis).
- **Magasin** : pastilles de rayons défilantes en haut (« Légumes 9 ») qui font défiler jusqu'au rayon ; par rayon : titre + « n restants » ; lignes de 60 px avec grande case (30 px) ; case cochée remplie de la couleur de la personne + coche blanche (texte de coche via `--c-p-texte`), nom barré et grisé, initiale ou prénom de la personne à droite ; cochés en bas du rayon ; toucher à nouveau décoche. Les articles drive n'apparaissent pas ; les « On l'a » non plus.
- Bas d'écran : champ « Un oubli ? » + bouton « Ajouter » (≥ 48 px) au-dessus de la barre d'onglets.
- Bouton « Partager la liste » (icône + mot) en secours : texte des articles magasin non cochés, par rayon, via `navigator.share` (sinon copie).
- Sans plan actif ou sans liste : « Pas de liste en cours — elle arrive avec le prochain menu ».

- [ ] **Step 1:** Tests de toute logique ajoutée (ex. `texteAPartager`, `modeParDefaut`). **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS + build. **Step 5: Commit** `feat(hub): onglet Courses — trier à la maison, cocher en magasin hors ligne`

### Task 6: Courses sur le PC — tri et liste drive Intermarché

**Files:**
- Modify: `apps/hub/src/pages/Menu.tsx` (remplacer `ShoppingListSection` et ses fonctions par la nouvelle section), `apps/hub/src/lib/mutations.ts` (retirer les mutations sur le tableau `items` : `useAddShoppingItem`, `useRemoveShoppingItem`, `useToggleShoppingItem`, `runTransaction` associé ; garder/adapter `useMarkShoppingShared`), `apps/hub/src/lib/queries.ts` (`usePlanShoppingList` remplacé par `useListeCourses`)
- Create: `apps/hub/src/components/courses/SectionCoursesPc.tsx`, `apps/hub/src/components/courses/ListeDrive.tsx`, `apps/hub/src/lib/drive.ts` + test
- Modify: `packages/types/src/household.ts` (`parametres.modeleRechercheDrive?: string`), `apps/hub/src/pages/Parametres.tsx` (champ « Adresse de recherche du drive », défaut Intermarché)

**Interfaces:**
- `const RECHERCHE_DRIVE_DEFAUT = "https://www.intermarche.com/recherche/{terme}"` ; `lienRechercheDrive(nom: string, modele = RECHERCHE_DRIVE_DEFAUT): string` (remplace `{terme}` par `encodeURIComponent` du nom sans quantité).
- Section PC (dans Menu) : trois colonnes **Trier** (même vue que le téléphone, en plus large) · **Drive** (liste `vueDrive` : une ligne par article = case « dans le panier » + nom + quantité + lien « Chercher sur Intermarché » ouvrant un nouvel onglet + bouton « Pas dispo → Magasin ») · **Magasin** (aperçu en lecture, regroupé par rayon). Bouton « Copier la liste drive » (texte brut, un article par ligne).
- Le fichier `apps/hub/public/imprimante-liste-courses.html` et le téléchargement HTML existant : conservés s'ils lisent la nouvelle forme, sinon adaptés (articles magasin non cochés).

- [ ] **Step 1: Tests** `lienRechercheDrive` (accents, apostrophe, modèle personnalisé), toute logique d'export. **Step 2:** FAIL. **Step 3:** implémenter, supprimer le code mort (grep : plus aucune lecture de `list.items` hors migration). **Step 4:** PASS + build. **Step 5: Commit** `feat(hub): courses sur ordinateur — tri, liste drive Intermarché`
