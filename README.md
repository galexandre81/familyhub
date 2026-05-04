# Family Hub

Plateforme familiale modulaire à base de tuiles, hébergée sur Firebase. Plusieurs écrans dans la maison (cuisine, bureau, mobile) affichent chacun leur sélection de tuiles avec leur propre layout. La logique vit côté serveur ; les écrans ne font qu'afficher.

> **Spec produit & technique complète** : voir `family-hub-spec.md` (à la racine du projet ou dans `docs/`).

## Stack

- **Backend** — Firebase (Auth Google, Firestore, Cloud Functions Node 20, Hosting, Storage), projet `family-hub-guillaume`
- **Hub React** (`apps/hub/`) — édition/configuration. React 18 + Vite + TS + Tailwind + shadcn/ui. Cible : PC, mobile, tablette moderne
- **Display vanilla** (`apps/display/`) — affichage uniquement. HTML + JS ES5 + Firebase SDK v8 compat. Cible : iPad mini 1 (iOS 9.3.6) et autres écrans d'affichage
- **Cloud Functions** (`functions/`) — logique métier des tuiles + jobs programmés (pré-calcul snapshot)
- **Types partagés** (`packages/types/`) — interfaces Firestore TypeScript partagées Hub / Functions

## Structure du repo

```
family-hub/
├── apps/
│   ├── hub/                  # React app
│   └── display/              # site vanilla pour iPad
├── functions/                # Cloud Functions
├── packages/
│   └── types/                # types Firestore partagés
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── .firebaserc
├── .env.example
└── package.json              # workspaces
```

## Setup local

Prérequis : Node.js ≥ 20, Firebase CLI (`npm i -g firebase-tools`), accès au projet `family-hub-guillaume`.

```bash
# Install dépendances (workspaces)
npm install

# Copier env exemple, remplir avec les valeurs Firebase Web app
cp .env.example apps/hub/.env.local

# Login Firebase
firebase login

# Dev hub React
npm run dev:hub        # http://localhost:5173

# Émulateurs Firebase locaux (optionnel)
npm run emulators      # http://localhost:5000 hosting, 4000 UI
```

## Déploiement

```bash
npm run build           # build types + functions + hub
firebase deploy         # tout
```

URLs prod :
- Hub : https://family-hub-guillaume.web.app
- Display : https://family-hub-guillaume.web.app/display/
- Setup display : https://family-hub-guillaume.web.app/display/setup?token=XXX

## Phases

- **Phase 1** — fondation monorepo + tuiles `clock`, `weather`, `radio`. iPad mural en cuisine. ✅
- **Phase 2** — drag&drop layout, mode édition tactile, tuiles `calendar`, `timer`. ✅
- **Phase 3** (en cours) — Kitchen Buddy : meal planner hebdomadaire, batch cooking, livre de recettes, liste de courses mobile.
- **Phase 4** — extensions famille (photos, todo, anniversaires…).

### Phase 3 — Kitchen Buddy

Architecture **human-in-the-loop avec Claude.ai** (cf. `kitchen-buddy-phase3-brief.md`). Pas de Cloud Function LLM ni de provider API : le hub génère un `.md` structuré avec contexte foyer + frigo + historique, l'utilisateur le colle dans Claude.ai (abonnement Pro) avec un prompt template, récupère un JSON validé selon `KBPlanImport`, le colle dans `/hub/plan/import` qui écrit le plan dans Firestore.

**Workflow dimanche soir** : ~10 min de bout en bout, ensuite plus aucune décision jusqu'au dimanche suivant.

Tuiles introduites :
- `weekly-menu` (Hub PC + iPad + mobile) — vue éditable de la semaine
- `recipe-today` (iPad) — auto-détection du slot du moment
- `recipe-mode` (iPad) — plein écran avec timers intégrés depuis les étapes
- `batch-mode` (iPad) — navigation entre recettes d'une session batch
- `shopping-list` (mobile) — Web Share API → Google Keep
- `livre-recettes` (Hub/iPad/mobile) — recettes favorites notées 4-5 ⭐
- `profils` — page admin CRUD

Sous-phases d'implémentation : 3.0 types & schéma → 3.1 profils → 3.2 wizard + export `.md` → 3.3 import JSON → 3.4 shopping list mobile → 3.5 recipe today/mode → 3.6 batch mode → 3.7 livre + notation → 3.8 édition manuelle. Validation utilisateur entre chaque sous-phase.

**Hors scope Phase 3** : Cloud Function `generateMealPlan`, chat conversationnel, PWA installable, fusion d'étapes batch, inventaire frigo persistant, OCR recettes externes.

## Ajouter une nouvelle tuile

1. Définir le type dans `packages/types/src/tiles/<type>.ts`
2. Ajouter le composant React dans `apps/hub/src/components/tiles/<Type>Tile.tsx`
3. Ajouter le module display dans `apps/display/public/js/tiles/<type>.js`
4. (Si pré-calcul) Cloud Function dans `functions/src/tiles/<type>.ts`
5. (Si refresh régulier) entrée dans le scheduler

Pattern strict : pas de `if/else` à rallonge sur `tile.type`, dispatch via dictionnaire.

## Legacy

Le code MenuMaster (ancien dashboard cuisine standalone) est archivé dans le tag git `legacy-menumaster` et toujours servi sur le projet Firebase `menumaster-cuisine` jusqu'au cutover.
