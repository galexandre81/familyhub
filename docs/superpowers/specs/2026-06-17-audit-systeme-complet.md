# Family Hub — Audit système complet : findings & statut

> Date : 2026-06-17 · Branche `main` (commits directs). Complète le spec
> `2026-06-17-audit-improvements-design.md` (Phases 1–3, front).
>
> Deux tours de diagnostic multi-agents ont couvert **tout le système**.
> Tour 1 (front) → Phases 1–3 livrées. Tour 2 (backend/sécurité/perf) → Phase 4
> ci-dessous (sous-ensemble sûr livré) + backlog différé documenté.

## Couverture (qui a été audité)

| Domaine | Tour | Statut |
|---|---|---|
| Nav recettes tablette, UX hub, kiosk, a11y, générateur de menu | 1 | ✅ livré (Phases 1–3) |
| Cloud Functions | 2 | ⚠️ sous-ensemble corrigé (Phase 4), reste différé |
| Règles Firestore + indexes | 2 | ⚠️ sous-ensemble corrigé, reste différé |
| Pipeline d'import JSON | 2 | ✅ corrigé (Phase 4) |
| Sécurité / secrets / dépendances | 2 | ✅ sain (rien à corriger) |
| Perf / build / config / complétude | 2 | ⚠️ code-split + CI + error boundary livrés, reste différé |

> ⚠️ Important : `git push` ≠ `firebase deploy`. Les changements de **règles
> Firestore** et de **functions** ne prennent effet qu'au prochain
> `firebase deploy` lancé par Guillaume.

---

## Phase 4 — corrigé maintenant (sûr, build vert)

### Cloud Functions (`functions/src/`)
- **snapshot/builder.ts** : un seul `Timestamp.now()` réutilisé (au lieu de 2 `serverTimestamp()` censés être égaux → fraîcheur de tuile incohérente).
- **tiles/weather.ts** : `forecastHours` ancré à l'heure courante (avant : index brut dans le tableau horaire → renvoyait minuit/6h/12h au lieu de maintenant/+6/+12).
- **tiles/weeklyMenu.ts** : suppression du double-fetch slots/batches (lectures Firestore /2).
- **mealPlan/plans.ts** : `deleteMealPlan` → `db.recursiveDelete` (supprime aussi batchSessions/chatMessages orphelins, gère la limite 500) ; `validateMealPlan` enveloppé dans une transaction (invariant « au plus 1 plan actif »).

### Règles Firestore + indexes
- **Fix d'un bug prod réel** : le kiosk vote sur les recettes (`statut`/`excluded`/`updatedAt`) mais les règles refusaient l'écriture display → vote silencieusement annulé. Ajout d'une règle `match /recettes` autorisant le display à `update` uniquement ces 3 clés.
- **Durcissement** : un membre ne peut plus muter `ownerUid`/`membres` du foyer via update (vérifié : l'app ne les écrit qu'à la création).
- **Nettoyage** : suppression de 2 indexes morts (`courses` coche/rayon ; `recettes` statut/`rating` — `rating` était une typo, `notation` existe déjà).

### Pipeline d'import (`apps/hub/src/lib/plan*`)
- **C3** : rejet si deux slots partagent `(date, repas)` (avant : écrasement silencieux, compte faux).
- **M4** : refus des dates impossibles (`2026-02-31`) + garde-fou fenêtre > 31 j (régression exposée par la fin du lundi forcé).
- **M2** : `jour` ancré à la **date minimale** des slots (avant : `slots[0]` + clamp `Math.max(0,…)` qui écrasait les jours antérieurs à jour=0) + tri chronologique.
- **H4** : noms de profils normalisés (accents) avant matching + noms non reconnus **remontés à l'utilisateur** (avant : `console.warn` muet).

### Robustesse / perf hub
- **Code-splitting** : routes en `React.lazy` + `manualChunks` (firebase / vendor séparés) → fin du bundle unique > 1 Mo, une chunk par page.
- **Error boundary** : `components/ErrorBoundary.tsx` enveloppe l'app → plus d'écran blanc sur exception de rendu, fallback FR + « Recharger ».
- **CI** : `.github/workflows/ci.yml` (build types→functions→hub + tests functions sur push/PR).

---

## Backlog différé (à valider / tester runtime avant d'appliquer)

Ces points sont réels mais **sensibles** (sécurité, schéma de données) ou
demandent un test sur device/émulateur — non appliqués en aveugle.

### Sécurité auth display (functions/src/auth/displayToken.ts) — PRIORITÉ
- **C1/H1/H2** : `exchangeSetupToken` valide puis supprime le setup token **sans transaction** (rejouable) ; `resolveSetupShortId` (public) **renvoie le setup token brut** (oracle par brute-force du short-id 6 car.) ; pas de révocation par display (authToken 90 j). Fix : consume transactionnel, ne plus renvoyer le token, flag `revoked` + `auth.revokeRefreshTokens`, rate-limit / App Check. → réécriture du flux setup.html ↔ functions, à tester de bout en bout.

### Cohérence slots wizard ↔ import (C2)
- `createMealPlan` écrit des slots `${jour}-${repas}` **sans champ `date`** et en dur sur 7 jours, alors que l'import écrit `${date}_${repas}` avec `date`, et `recipe-today` requête par `date`. Les plans créés par wizard (avant import) sont invisibles à la tuile « recette du moment » ; risque de slots orphelins selon la gestion de suppression. + `createMealPlan` ne tient pas compte de `nbJours`. À unifier (convention d'ID + champ `date` + nbJours), avec vérif de la suppression des anciens slots à l'import.

### Règles Firestore — scoping lecture display
- Le display peut **lire toute la sous-collection `profils`** (données médicales `contraintesMedicales`, `dateNaissance`). Le kiosk ne lit pas `profils` directement → restreindre les lectures display à `tiles/displays/recettes/shoppingLists/timers` et exclure `profils`/`mealPlans`. À tester sur device (risque de casser une lecture).

### Import — sémantique de suppression (C1/C2)
- `planImporter` supprime **toutes** les shoppingLists du foyer avant recréation (OK en mono-plan, perte de données si multi-plans) et la suppression non bornée peut dépasser 500 écritures sur un très gros plan. À scoper par `planId`.

### Observabilité & tests (gaps majeurs)
- **Zéro test** dans le repo (la config vitest functions pointe sur des fichiers inexistants → `npm test` passe à vide). Cibles prioritaires : règles nutrition, dedup/hash, parsing iCal, pipeline d'import.
- **Aucun monitoring d'erreurs** (pas de Sentry) — impossible de savoir qu'un kiosk distant plante. Toasts hub = éphémères ; functions = `logger` only.
- **Kiosk offline** : pas d'indicateur de fraîcheur/offline ; le TTL snapshot (`generatedAt`+`ttlSeconds`) est stocké mais jamais vérifié au rendu.

### Divers (faible)
- Recette : `useRecettes` charge tout sans pagination/virtualisation (OK à 228, dégrade au-delà).
- `firebase.json` : assets display servis `no-store` (re-download à chaque reload) — envisager versioning + `immutable`.
- i18n inexistant (FR en dur) — non urgent.
- Pas de stratégie de backup/migration Firestore.
- Sécurité : posture saine ; clé web Firebase committée = **normal** (publique par design) ; secrets (service-account, .env, iCal URL) bien gitignorés / en Secret Manager.

---

## Vérification
`npm run build` (racine : types → functions → hub) **vert** ; build functions vert ;
code-splitting confirmé (chunks firebase/vendor/par-page) ; règles : syntaxe validée
(non déployées). Tests : aucun (gap documenté ci-dessus).
