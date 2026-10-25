# Plan 2 — Version téléphone (hors courses) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire du hub une application de téléphone installable, utilisable hors ligne et partagée entre Alex et Marie : Aujourd'hui, Semaine, Recettes, mode recette avec minuteurs partagés. L'onglet Courses est réservé ici et construit au plan 3.

**Architecture:** Le hub React détecte un écran étroit et affiche une coque téléphone (onglets en bas) au lieu de la navigation PC. Firestore garde ses données en local (persistance IndexedDB), un service worker met l'application en cache. Marie rejoint le foyer par une invitation traitée par des Cloud Functions (les règles interdisent aux clients de toucher `membres`). Chaque personne relie son compte à son profil (« C'est moi »), ce qui donne sa couleur.

**Tech Stack:** React 18, React Router 6, React Query 5, Firebase JS 11 (Firestore `persistentLocalCache`), `vite-plugin-pwa` (Workbox), Cloud Functions v2, règles Firestore, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-refonte-ipad-mobile-design.md` (§3, §5, §8 bis « Accès de Marie », « Téléphone : installation… », « Minuteurs », §12).

## Global Constraints

- Installer une dépendance **uniquement** avec `npx -y npm@10 install … --ignore-scripts` ; vérifier ensuite `npx -y npm@10 ci --dry-run --ignore-scripts`.
- `npm run build` passe à la fin de chaque tâche ; tests : `npm test --workspace=hub`, `--workspace=functions`, `--workspace=@family-hub/design` ; règles : job CI `rules-tests` (Java absent en local).
- Apparence : jetons du design system uniquement (classes Tailwind existantes reliées aux variables `--c-*`, couleurs de personnes `--c-p-*`) ; cibles tactiles ≥ 48 px sur téléphone ; texte ≥ 15 px ; « une seule chose en jaune (`--c-maintenant`) par écran : la prochaine » ; toujours icône + mot ; 2 lignes max, le reste replié.
- Téléphone = largeur < 768 px (`(max-width: 767px)`). Les pages PC ne deviennent pas responsive : sur téléphone, seules les pages de ce plan existent, les autres affichent « Disponible sur ordinateur ».
- Le service worker ne contrôle **jamais** `/display/` ni `/d/`.
- Heures des repas (réponse de Alex) : petit-déjeuner 07:00 en semaine, 08:00 le week-end ; déjeuner 12:15 ; dîner 19:00. Un repas reste « le prochain » jusqu'à 1 h après son heure.
- Minuteur téléphone : sonne seulement quand l'application est ouverte ; pas de notifications push.
- Textes visibles en français, tutoiement. Aucun déploiement dans ce plan.
- Commits : trailer `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

- Téléphone sans réseau au lancement : l'application s'ouvre et affiche les données déjà vues (cache SW + Firestore) — vérifié par la config du SW (navigateFallback) et la persistance activée ; test de la fonction de config.
- Marie ouvre le lien d'invitation alors qu'elle n'est pas connectée : après connexion Google, elle rejoint le foyer **sans** passer par « Créer mon foyer » — test du stockage/lecture du code en attente.
- Invitation expirée, déjà utilisée, ou ouverte par quelqu'un déjà membre : message clair, aucune écriture — tests de la fonction pure de validation.
- Repas à plusieurs recettes, recette supprimée entre-temps : le mode recette affiche les recettes présentes et signale celle qui manque — test de l'assemblage.
- Minuteur terminé pendant que deux appareils sont ouverts : un seul passage à « terminé », pas d'erreur si le document a déjà été modifié ou supprimé — test de `tempsRestantMs` / `estTermine` et écriture idempotente.

---

### Task 1: Hors ligne et installation (persistance, PWA, connexion)

**Files:**
- Modify: `apps/hub/src/lib/firebase.ts` (remplacer `getFirestore(app)` par `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`)
- Modify: `apps/hub/vite.config.ts` (plugin `VitePWA`), `apps/hub/package.json` (`vite-plugin-pwa`)
- Create: `apps/hub/src/lib/pwaConfig.ts` (objet de config exporté, consommé par vite.config.ts) + test `apps/hub/src/lib/pwaConfig.test.ts`
- Create: `scripts/generate-hub-icons.mjs` (réutilise l'encodeur PNG de `scripts/generate-display-icon.mjs` — extraire l'encodeur commun dans `scripts/lib/png.mjs`) → `apps/hub/public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png` (180)
- Modify: `apps/hub/index.html` (`<link rel="apple-touch-icon">`, `<meta name="apple-mobile-web-app-capable" content="yes">`)
- Modify: `apps/hub/src/lib/auth.tsx` (connexion par redirection quand l'app est installée)
- Modify: `docs/DESIGN.md` (section « Téléphone » : `VITE_FIREBASE_AUTH_DOMAIN` = domaine du site, ajout de l'URI de redirection `https://<site>/__/auth/handler` dans la console Google Cloud, à faire par Alex)

**Interfaces:**
- Produces: `pwaOptions: Partial<VitePWAOptions>` — `registerType: "autoUpdate"`, manifest `{ name: "Family Hub", short_name: "Family Hub", lang: "fr", start_url: "/", display: "standalone", background_color: "#EEF4EA", theme_color: "#EEF4EA", icons: [192, 512 (purpose any maskable)] }`, workbox `{ navigateFallback: "/index.html", navigateFallbackDenylist: [/^\/display/, /^\/d\//, /^\/__/], globPatterns: ["**/*.{js,css,html,woff,woff2,png,svg}"], globIgnores: ["display/**"] }`.
- Produces: `function doitUtiliserRedirection(estStandalone: boolean, userAgent: string): boolean` (vrai si standalone ou iOS/iPadOS) dans `auth.tsx` ou `lib/authMode.ts`.

- [ ] **Step 1: Tests** — `pwaOptions.workbox.navigateFallbackDenylist` rejette `/display/`, `/display/index.html`, `/d/ABC123`, `/__/auth/handler` et accepte `/menu` ; `doitUtiliserRedirection(true, "…")` vrai, `doitUtiliserRedirection(false, "…iPhone…")` vrai, `doitUtiliserRedirection(false, "…Windows…")` faux.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter (connexion : `signInWithRedirect` si `doitUtiliserRedirection(window.matchMedia("(display-mode: standalone)").matches, navigator.userAgent)`, sinon popup ; `getRedirectResult` au démarrage pour créer le doc user comme aujourd'hui). **Step 4:** tests PASS, `npm run build` OK, `apps/hub/dist/sw.js` et `manifest.webmanifest` présents, `dist/display/` absent du précache (grep dans `sw.js`).
- [ ] **Step 5: Commit** `feat(hub): application installable et utilisable hors ligne`

### Task 2: Rôles, invitations et arrivée de Marie

**Files:**
- Create: `functions/src/household/invitations.ts` (+ export dans `functions/src/index.ts`), `functions/src/household/invitationRules.ts` (logique pure) + test `invitationRules.test.ts`
- Modify: `packages/types/src/household.ts` (`roles?: Record<string, "parent" | "enfant">`), ajouter `packages/types/src/invitation.ts`
- Modify: `firestore.rules` (création du foyer : `keys().hasOnly([... , 'roles'])` et `roles == {uid: 'parent'}` si présent ; mise à jour par un membre : `roles` inchangé comme `membres` ; `match /invitations/{code} { allow read, write: if false; }`), `firestore-tests/rules.test.ts`
- Modify: `apps/hub/src/lib/mutations.ts` (`useCreateHousehold` pose `roles: {[uid]: "parent"}`), nouvelles mutations `useCreateInvitation`, `useAcceptInvitation`
- Create: `apps/hub/src/pages/Rejoindre.tsx` (route `/rejoindre/:code`, hors `RequireAuth`), `apps/hub/src/lib/invitationEnAttente.ts` + test
- Modify: `apps/hub/src/App.tsx`, `apps/hub/src/pages/Parametres.tsx` (bloc « Inviter quelqu'un dans le foyer » : bouton → lien + bouton Copier/Partager), `apps/hub/src/pages/Dashboard.tsx` (si une invitation est en attente, la traiter avant d'afficher « Créer mon foyer »)

**Interfaces:**
- Produces (functions, région `europe-west1` comme les autres) :
  - `createInvitation({ householdId })` → `{ code, expiresAt }` — membre requis (`assertHouseholdMember`), code 10 caractères alphabet de `displayToken.ts`, validité 7 jours, doc `invitations/{code}` = `{ householdId, createdBy, createdAt, expiresAt, role: "parent" }`.
  - `acceptInvitation({ code })` → `{ householdId }` — utilisateur connecté et **non display** ; transaction : vérifie l'invitation (`validerInvitation`), `membres` ← `arrayUnion(uid)`, `roles.<uid>` ← rôle, `users/{uid}.householdsIds` ← `arrayUnion`, invitation `usedBy`/`usedAt` (usage unique).
  - `validerInvitation(inv: InvitationDoc | undefined, uid: string, membres: string[], nowMs: number): { ok: true } | { ok: false; raison: "introuvable" | "expiree" | "deja-utilisee" | "deja-membre" }` (pur).
- Produces (hub) : `garderInvitationEnAttente(code: string): void`, `lireInvitationEnAttente(): string | null`, `oublierInvitationEnAttente(): void` (sessionStorage + localStorage, try/catch).
- Textes : succès « Bienvenue dans le foyer {nom} » ; erreurs « Cette invitation a expiré — demande un nouveau lien », « Cette invitation a déjà servi », « Tu fais déjà partie de ce foyer », « Invitation introuvable ».

- [ ] **Step 1: Tests** — `validerInvitation` (4 refus + succès ; `expiresAt` exactement égal à now = expirée) ; `invitationEnAttente` (aller-retour, stockage indisponible → `null` sans exception) ; règles : un membre ne peut pas modifier `roles`, un client ne lit ni n'écrit `invitations`, création de foyer avec `roles` = `{moi: parent}` OK et `{autre: parent}` refusée.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** tests hub + functions PASS, lint functions, build OK.
- [ ] **Step 5: Commit** `feat: invitation d'un membre du foyer (Marie) et rôles`

### Task 3: « C'est moi » et couleurs de personnes

**Files:**
- Modify: `packages/types/src/profil.ts` (`uid?: string` ; `couleurPersonne?: "sapin" | "toleRouge" | "lilas" | "miel" | "ardoise"`)
- Create: `apps/hub/src/lib/personnes.ts` + test (`couleurDuProfil`, `profilDuCompte`)
- Modify: `apps/hub/src/components/ProfilForm.tsx` (choix de la couleur dans la palette fermée des 5 teintes, plus d'hex libre), `apps/hub/src/components/ProfilBadge.tsx` (couleur via `rgb(var(--c-p-<clé>))`, repli sur l'ancien `couleur` hex si `couleurPersonne` absent ; un seul repère : pastille avec initiale, l'emoji n'est plus affiché à côté)
- Create: `apps/hub/src/components/CestMoi.tsx` (sur téléphone, si aucun profil n'a `uid === user.uid` : « Qui es-tu ? » liste des profils → enregistre `uid` sur le profil choisi et l'enlève d'un éventuel autre profil du même compte)

**Interfaces:**
- Produces: `couleurDuProfil(p: Pick<Profil, "couleurPersonne" | "couleur">): string` (renvoie `rgb(var(--c-p-sapin))` ou l'hex de repli), `profilDuCompte(profils: Array<Profil & { id: string }>, uid: string): (Profil & { id: string }) | undefined`, `estParent(household: Household, uid: string): boolean` (vrai si `roles[uid] === "parent"` ou si `roles` absent et `uid ∈ membres` — compatibilité foyers existants).

- [ ] **Step 1: Tests** des trois fonctions (repli hex, rôle absent, rôle enfant). **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS + build. **Step 5: Commit** `feat(hub): profil relié à son compte, couleurs de personnes du design system`

### Task 4: Heures des repas et « prochain repas »

**Files:**
- Create: `packages/types/src/heuresRepas.ts` (exporté par `index.ts`) + test `packages/types/src/heuresRepas.test.ts` (ajouter `vitest` en devDependency + script `test` au paquet types, et l'étape CI « Test (types) »)
- Modify: `packages/types/src/household.ts` (`parametres.heuresRepas?: HeuresRepas`)
- Modify: `apps/hub/src/pages/Parametres.tsx` (section « Heures des repas » : semaine / week-end × 3 champs `type="time"`)

**Interfaces:**
- Produces:
  - `type HeuresRepas = { semaine: Record<Repas, string>; weekend: Record<Repas, string> }` (`"HH:MM"`)
  - `const HEURES_REPAS_DEFAUT: HeuresRepas = { semaine: { petitDej: "07:00", dej: "12:15", diner: "19:00" }, weekend: { petitDej: "08:00", dej: "12:15", diner: "19:00" } }`
  - `heureDuRepas(dateISO: string, repas: Repas, heures?: HeuresRepas): Date` (heure locale ; samedi/dimanche = week-end)
  - `prochainsRepas<S extends { date?: string; repas: Repas; annule?: boolean }>(slots: S[], now: Date, heures?: HeuresRepas, n = 2): Array<{ slot: S; heure: Date }>` — ignore les slots sans `date`, annulés, ou sans recette (`recetteIds` vide) ; un repas reste prochain jusqu'à `heure + 60 min` ; trié par heure.
  - `minutesAvant(heure: Date, now: Date): number` et `libelleDans(minutes: number): string` → `"dans 10 min"`, `"dans 1 h 30"`, `"dans 2 h"`, `"maintenant"` (≤ 0 et < 60 min après).

- [ ] **Step 1: Tests** — samedi 07:30 → petit-déj du samedi encore « prochain » (08:00) ; mardi 13:00 → déjeuner (12:15) toujours prochain jusqu'à 13:15, à 13:16 → dîner ; slot annulé ignoré ; `libelleDans(90)` = `"dans 1 h 30"`, `libelleDans(120)` = `"dans 2 h"`, `libelleDans(-20)` = `"maintenant"`.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS + build. **Step 5: Commit** `feat: heures des repas et calcul du prochain repas`

### Task 5: Minuteurs partagés dans le hub

**Files:**
- Create: `apps/hub/src/lib/minuteurs.ts` (logique pure) + test, `apps/hub/src/lib/useMinuteurs.ts` (abonnement temps réel + actions + son), `apps/hub/src/components/MinuteurPanneau.tsx`
- Modify: `apps/hub/src/lib/mutations.ts` (retirer `useCreateTimer`, inutilisé, remplacé par les actions de `useMinuteurs`)

**Interfaces:**
- Document `households/{hid}/timers/{id}` : **même forme que l'iPad** (`apps/display/public/js/timer-singleton.js`) : `label`, `durationSeconds`, `startedAt`, `endsAt`, `status: "running" | "paused" | "ended" | "acknowledged"`, `pausedAt?`, `remainingSeconds?`, `createdAt`, `updatedAt`.
- Produces (pur) : `tempsRestantMs(t, nowMs): number` (en pause → `remainingSeconds*1000`), `estTermine(t, nowMs): boolean`, `formatMinuteur(ms): string` (`"09:00"`, `"1:05:00"` au-delà d'une heure), `libelleParDefaut(secondes): string` (`"5 min"`, `"1 min 30"`).
- Produces (hook) : `useMinuteurs(householdId?: string): { minuteurs: Minuteur[]; lancer(label: string | null, secondes: number): Promise<void>; ajouterUneMinute(m): Promise<void>; pause(m); reprendre(m); arreter(m); acquitter(m) }` — `onSnapshot` trié par `endsAt` ; quand un minuteur `running` arrive à zéro sur cet appareil : mise à jour `status: "ended"` **seulement si** le document est encore `running` (transaction légère ou `update` avec précondition `updateTime`, erreur ignorée si déjà modifié/supprimé) ; son : bip Web Audio répété toutes les 2 s tant qu'un minuteur est `ended` et que la page est visible ; `acquitter` → `acknowledged` puis suppression.
- `MinuteurPanneau` : boutons rapides **1, 5, 10 min et « Autre »** (champ minutes) ; minuteurs en cours (nom, temps restant, « +1 min », pause/reprise, arrêter) ; minuteur terminé en bandeau `--c-maintenant` avec « OK » (≥ 48 px).

- [ ] **Step 1: Tests** purs (pause, fin exacte, format > 1 h, libellés). **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS + build. **Step 5: Commit** `feat(hub): minuteurs partagés avec l'iPad`

### Task 6: Mode recette (repas complet, tout d'un coup)

**Files:**
- Create: `apps/hub/src/lib/repasCuisine.ts` + test (assemblage et quantités), `apps/hub/src/pages/ModeRecette.tsx`
- Modify: `apps/hub/src/App.tsx` (routes `livre-recettes/:recetteId/cuisine` → `ModeRecette` ; nouvelle route `menu/:planId/:slotId/cuisine`), supprimer `apps/hub/src/pages/RecetteCuisine.tsx` après reprise de ce qui sert (portions, ingrédients)

**Interfaces:**
- Consumes: `useMinuteurs`, `MinuteurPanneau` (tâche 5), `usePlanSlots`, `usePlanRecettes`, `useRecette` (existants).
- Produces: `assemblerRepas(recetteIds: string[], recettes: Record<string, Recette | undefined>): { presentes: Array<{ id: string; recette: Recette }>; manquantes: string[] }` ; `quantiteAjustee(quantite: string, portionsBase: number, portions: number): string` (nombres et fractions simples `"1/2"`, `"1,5"` ; texte non numérique inchangé ; arrondi à 1 décimale, virgule française).
- Écran : titre du repas (ou de la recette) ; portions +/− (défaut : nombre de présents du slot, sinon portions de la recette) ; **ingrédients regroupés par recette** ; **toutes les étapes** de toutes les recettes l'une sous l'autre (plat principal d'abord), une étape avec `dureeMinutes > 0` porte « Lancer N min » (libellé du minuteur = début de l'étape, 30 caractères) ; recette manquante → ligne « Recette introuvable ». PC (≥ 768 px) : étapes à gauche (2/3), colonne droite fixe ingrédients + `MinuteurPanneau`. Téléphone : une colonne (ingrédients puis étapes) + bouton « Minuteur » fixé en bas qui ouvre `MinuteurPanneau` en feuille. Écran maintenu allumé (`navigator.wakeLock.request("screen")` si disponible, relâché à la sortie). Fond opaque (`bg-ebony`), au-dessus de l'en-tête.

- [ ] **Step 1: Tests** — `assemblerRepas` avec une recette manquante ; `quantiteAjustee("1/2", 2, 4)` = `"1"`, `("1,5", 4, 6)` = `"2,3"`, `("200", 4, 2)` = `"100"`, `("qsp", 4, 8)` = `"qsp"`. **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS + build. **Step 5: Commit** `feat(hub): mode recette — tout le repas d'un coup, minuteurs partagés`

### Task 7: Coque téléphone et onglet Aujourd'hui

**Files:**
- Create: `apps/hub/src/lib/useEstTelephone.ts`, `apps/hub/src/components/TelephoneLayout.tsx` (onglets bas : Aujourd'hui `/`, Semaine `/semaine`, Courses `/courses`, Recettes `/livre-recettes` ; icône + mot ; onglet actif sur fond `--c-maintenant`), `apps/hub/src/pages/Aujourdhui.tsx`, `apps/hub/src/pages/Courses.tsx` (provisoire : « Les courses arrivent bientôt ici » — remplacé au plan 3), `apps/hub/src/components/DisponibleSurOrdinateur.tsx`
- Modify: `apps/hub/src/components/Layout.tsx` (si téléphone → `TelephoneLayout` ; `CestMoi` affiché tant que le compte n'a pas de profil), `apps/hub/src/App.tsx` (routes `/semaine`, `/courses` ; `/` = `Aujourdhui` sur téléphone, `Dashboard` sur PC ; Écrans, Tuiles, Paramètres, Profils, Menu (PC), import, assistant → `DisponibleSurOrdinateur` sur téléphone)
- Test: `apps/hub/src/lib/aujourdhui.test.ts` pour la logique pure de la page (`apps/hub/src/lib/aujourdhui.ts`)

**Interfaces:**
- Consumes: `prochainsRepas`, `minutesAvant`, `libelleDans`, `heureDuRepas` (tâche 4), `estParent` / `couleurDuProfil` (tâche 3), `useActivePlan`, `usePlanSlots`, `usePlanRecettes`, `usePlanBatchSessions`.
- Produces: `useEstTelephone(): boolean` (`matchMedia("(max-width: 767px)")`, à jour au redimensionnement) ; `resumeAujourdhui(slots, recettes, batchSessions, now, heures): { prochain?: {…}; autresDuJour: […]; batchDuJour?: BatchSession }`.
- Page Aujourd'hui : deux cartes **de même taille, moyennes** côte à côte si la largeur le permet, sinon l'une sous l'autre à hauteur égale : (1) **Prochain repas** — en-tête jaune `--c-maintenant` « Dîner · 19:00 » + « dans 1 h 30 », barre de temps qui se vide (référence : 3 h avant le repas = barre pleine), plat principal + accompagnements (2 lignes max), pastilles des présents, bouton « Cuisiner » → `menu/:planId/:slotId/cuisine` ; (2) **PC d'Léo** — visible seulement si `estParent`, contenu « Bientôt : couper ou remettre le wifi du PC d'Léo » ; en dessous : les autres repas du jour (passés effacés : opacité réduite + barré léger), et le batch du jour s'il existe. Pas d'agenda. Sans plan actif : « Pas de menu en cours — il se prépare sur l'ordinateur ».

- [ ] **Step 1: Tests** `resumeAujourdhui` (repas passé effacé, batch du jour, sans plan). **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS + build. **Step 5: Commit** `feat(hub): coque téléphone et écran Aujourd'hui`

### Task 8: Onglets Semaine et Recettes sur téléphone

**Files:**
- Create: `apps/hub/src/pages/Semaine.tsx`, `apps/hub/src/lib/semaine.ts` + test
- Modify: `apps/hub/src/pages/LivreRecettes.tsx` (sur téléphone : une colonne, recherche en haut collée, cartes compactes 2 lignes, actions pouce/corbeille masquées ; toucher → mode recette de la recette)

**Interfaces:**
- Produces: `joursDuPlan(slots, plan): Array<{ dateISO: string; libelleCourt: string /* "mar" */; numero: number; repas: Array<{ repas: Repas; slot?: MealPlanSlot }> }>` ; `jourInitial(jours, now): string` (aujourd'hui si dans le plan, sinon le premier jour).
- Page Semaine : rangée de jours (boutons ≥ 48 px, jour sélectionné en jaune) ; les 3 repas du jour choisi ; repas passés effacés ; le prochain repas encadré avec « Cuisiner » ; présents en pastilles ; notes du créneau repliées ; en bas « Pourquoi ce menu ? » replié (commentaire du plan) ; flèches semaine précédente / suivante parmi les plans (`useAllPlans`). « Changer » n'est pas dans ce lot.

- [ ] **Step 1: Tests** `joursDuPlan` (plan du samedi 24 au samedi 31 → 8 jours, ordre), `jourInitial`. **Step 2:** FAIL. **Step 3:** implémenter. **Step 4:** PASS + build. **Step 5: Commit** `feat(hub): Semaine et Recettes sur téléphone`
