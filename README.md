# Family Hub

> Plateforme familiale modulaire à base de tuiles, hébergée sur Firebase. Le PC, l'iPad cuisine, le mobile au supermarché — tous synchronisés, chacun avec sa propre sélection de tuiles.

**Family Hub transforme une famille en un écosystème connecté de tuiles** : meal planner hebdomadaire généré avec Claude.ai, livre de recettes familial, liste de courses partageable vers Google Keep, mode cuisine plein écran avec timers, agenda Google, météo, radio, minuteurs partagés cross-device.

---

## 🚀 Installation chez toi (~2-3h, niveau zéro technique requis)

**Tu veux ton propre Family Hub pour ta famille ?**

👉 **[Suis le guide ONBOARDING.md →](./ONBOARDING.md)**

Le guide explique tout pas à pas : installer Node.js, créer un projet Firebase, cloner le code, déployer, configurer le foyer. **Aucune expérience technique n'est requise** — il est rédigé pour quelqu'un qui n'a jamais ouvert un terminal. Windows et macOS couverts.

**Coût pour usage familial** : 0 €/mois en pratique (le quota gratuit Firebase est très large), mais le plan Blaze de Firebase exige une carte bancaire (avec alerte budget à 1 € recommandée).

---

## ✨ Fonctionnalités

### 🍽️ Meal planner hebdomadaire
- **Wizard 4 étapes** : date / présence par profil par repas (avec mode ⚡ express ≤ 15 min) / contexte (batch cooking, jour des courses, frigo à écouler) / export
- **Workflow human-in-the-loop avec Claude.ai** : le hub génère un `.md` structuré, tu le colles dans Claude.ai (compte Pro recommandé), tu dialogues pour ajuster, tu récupères un JSON validé, tu l'importes
- **Édition inline** : notes par slot, marquer un repas annulé (pizzas commandées), changer de recette
- **Batch cooking** intégré : sessions de prep dimanche affichées séparément avec leurs recettes

### 📖 Livre de recettes familial
- Recherche par nom, tag, style culinaire (insensible aux accents)
- **Recherche par ingrédients du frigo** : tape ce que tu as, le livre te propose les recettes utilisant ces ingrédients, triées par pertinence
- Favoris ⭐ / Exclusion 👎 par recette
- Mode cuisine plein écran avec timers intégrés sur chaque étape
- Adaptation portions live (recalcul des quantités)

### 🛒 Liste de courses
- Auto-générée depuis le plan de repas (groupée par rayon, dédoublonnage)
- **Web Share API → Google Keep** en un tap (pour cocher en magasin hors-ligne)
- Ajout manuel d'items (oublis du frigo)
- Statut « envoyée il y a X temps · toucher pour renvoyer » avec reset auto sur ajout/retrait

### 📅 Tuiles d'écran
- **Recette du jour** (iPad cuisine) : auto-détection du slot du moment selon l'heure
- **Menu de la semaine** : grille 7×3 avec batch cooking en bandeau
- **Liste de courses** mobile / iPad
- **Livre de recettes** : grille filtrée tactile
- **Calendrier** Google iCal (optionnel)
- **Météo** Open-Meteo (gratuit, sans clé API)
- **Radio** : lecteur web avec presets
- **Minuteur** : timers de cuisine partagés cross-device
- **Horloge** : design soigné

### 🎨 Personnalisation
- 6 thèmes UI prêts à l'emploi (Caractère, Forêt, Marine, Bordeaux, Glacier, Lin clair)
- Choix partagé toute famille via la console Paramètres
- Layouts par display configurables individuellement

---

## 🏗️ Architecture en 30 secondes

```
┌────────────────┐                ┌────────────────────┐
│  Hub web (PC)  │ ←─── R/W ────→ │                    │
│  React + Vite  │                │     Firebase       │
└────────────────┘                │                    │
                                  │  ▸ Firestore (BDD) │
┌────────────────┐                │  ▸ Auth Google     │
│ iPad cuisine   │ ←──── R ─────→ │  ▸ Cloud Functions │
│ ES5 vanilla    │                │  ▸ Hosting         │
└────────────────┘                │  ▸ Storage         │
                                  │                    │
┌────────────────┐                └────────────────────┘
│ Mobile / autre │ ←─── R/W ────→
│ écran          │
└────────────────┘
```

- **`apps/hub/`** : interface React/Vite/TS pour PC + mobile responsive (édition, wizard, gestion)
- **`apps/display/`** : site vanilla JS ES5 pour iPad mini 1 (iOS 9.3.6) et autres écrans d'affichage uniquement
- **`functions/`** : Cloud Functions Node 20 (snapshot builders, calendrier iCal, refresh météo, etc.)
- **`packages/types/`** : interfaces TypeScript Firestore partagées Hub / Functions

L'iPad mini 1 est **read-only** (custom token), il consomme les snapshots pré-calculés par les Cloud Functions toutes les 30 minutes.

---

## 🛠️ Stack technique

| Couche | Tech |
|---|---|
| Frontend hub | React 18 + Vite + TypeScript + Tailwind CSS |
| Frontend display | HTML + JS ES5 + Firebase SDK v8 compat (iOS 9.3.6 OK) |
| Backend | Firebase Cloud Functions (Node 20, 2nd gen) |
| Base de données | Cloud Firestore |
| Auth | Firebase Auth — Google OAuth |
| Hosting | Firebase Hosting (CDN global) |
| Validation | Zod |
| State management | TanStack Query |
| Type sharing | Monorepo npm workspaces |

---

## 👨‍💻 Setup développeur (si tu fork pour adapter)

> Pour l'installation utilisateur final : voir [ONBOARDING.md](./ONBOARDING.md).

**Prérequis** : Node.js ≥ 20, Firebase CLI (`npm i -g firebase-tools`), un projet Firebase à toi avec plan Blaze.

```bash
# Cloner
git clone https://github.com/galexandre81/familyhub.git
cd familyhub

# Installer
npm install

# Configurer
cp .env.example apps/hub/.env.local
# → édite apps/hub/.env.local avec tes clés Firebase
# → édite .firebaserc avec ton projectId
# → édite apps/display/public/js/firebase-config.js avec tes clés

# Connexion
firebase login

# Dev local hub
npm run dev:hub        # → http://localhost:5173

# Émulateurs Firebase locaux (optionnel)
npm run emulators

# Build complet
npm run build

# Déploiement
firebase deploy
firebase deploy --only hosting       # plus rapide
firebase deploy --only functions     # quand seul le code CF change
firebase deploy --only firestore     # rules + indexes
```

### Structure du repo

```
familyhub/
├── apps/
│   ├── hub/                  # React app (PC + mobile)
│   │   ├── src/
│   │   │   ├── components/   # composants partagés
│   │   │   ├── pages/        # Menu, LivreRecettes, Profils, etc.
│   │   │   └── lib/          # auth, queries, mutations, firebase, themes
│   │   └── .env.local        # ⚠️ à créer, gitignored
│   └── display/              # site iPad/mobile-display vanilla JS
│       └── public/js/tiles/  # 1 fichier JS ES5 par type de tuile
├── functions/                # Cloud Functions (logique serveur)
│   └── src/
│       ├── tiles/            # snapshot builders par tuile
│       ├── mealPlan/         # CFs création/validation/suppression plans
│       └── auth/             # display token (custom auth)
├── packages/
│   └── types/                # types Firestore partagés
├── scripts/
│   └── seedRecipes/          # script Node pour pré-remplir le livre via LLM
├── firebase.json
├── firestore.rules
├── firestore.indexes.json
├── .firebaserc               # ⚠️ projectId à éditer pour ton projet
├── .env.example
└── package.json              # workspaces npm
```

### Ajouter une nouvelle tuile

1. Définir le type config dans `packages/types/src/tiles/<type>.ts`
2. Ajouter le type dans l'enum `TileType` de `packages/types/src/common.ts` ET `functions/src/types.ts`
3. Composant React dans `apps/hub/src/components/tiles/<Type>Tile.tsx` (si édition spécifique)
4. Module display dans `apps/display/public/js/tiles/<type>.js` (ES5 vanilla)
5. (Si pré-calcul) Cloud Function dans `functions/src/tiles/<type>.ts`
6. (Si refresh régulier) `scheduledXxxRefresh` cron toutes les X minutes
7. Ajouter au TileForm `SUPPORTED_TYPES` + label
8. Référence le script dans `apps/display/public/index.html` avec un cache-buster `?v=YYYYMMDDx`

Pattern : pas de `if/else` à rallonge sur `tile.type`, dispatch via `window.Tiles[type]`.

---

## 📦 Phases livrées

- **Phase 1** ✅ — Fondation monorepo + tuiles `clock`, `weather`, `radio`. iPad mural en cuisine.
- **Phase 2** ✅ — Drag&drop layout, mode édition tactile, tuiles `calendar`, `timer`.
- **Phase 3** ✅ — Meal planner hebdo, batch cooking, livre de recettes, liste de courses mobile, recipe-mode iPad. Workflow human-in-the-loop avec Claude.ai.
- **Bonus** ✅ — Thèmes UI personnalisables, recherche par ingrédients du frigo, repas express, notation pouce ↑↓.

**Hors scope (volontairement)** : Cloud Function LLM (le LLM = Claude.ai en human-in-the-loop), chat conversationnel intégré, PWA installable, OCR recettes externes.

---

## 💸 Coût d'exploitation

Pour un usage familial (3-5 personnes, 1 plan/semaine, ~50 recettes/mois cuisinées) :

- **Quasiment toujours 0 €/mois** : le quota gratuit Firebase est généreux pour cet usage
- **Plan Blaze obligatoire** (CB requise) car les Cloud Functions 2nd gen ne marchent pas sur Spark
- **Recommandé** : alerte budget à 1 € + restrictions HTTP referrer sur l'apiKey + cap budget manuel

Détails complets dans [ONBOARDING.md §2.3](./ONBOARDING.md#23--le-coût--à-lire-absolument).

---

## 🤝 Contribuer

Family Hub est un projet **open-source** que tu peux fork, cloner, adapter à ta famille. Si tu trouves un bug ou as une suggestion :

- 🐛 [Ouvrir une issue](https://github.com/galexandre81/familyhub/issues) en décrivant le problème + étapes pour reproduire
- 💡 [Proposer une fonctionnalité](https://github.com/galexandre81/familyhub/issues/new) en expliquant le besoin
- 🔧 [Pull request](https://github.com/galexandre81/familyhub/pulls) bienvenue (avec build qui passe et description des changements)

---

## 📜 Licence

MIT — voir [LICENSE](./LICENSE). Tu peux librement copier, modifier, distribuer pour usage perso ou commercial.

---

## 🙏 Remerciements

- **[Anthropic Claude](https://claude.ai)** : co-pilote pendant tout le développement et compagnon human-in-the-loop pour les meal plans
- **[Firebase](https://firebase.google.com)** : infrastructure backend
- **[Open-Meteo](https://open-meteo.com)** : API météo gratuite et sans clé
- **[Lucide Icons](https://lucide.dev)** : icônes SVG
- **[shadcn/ui](https://ui.shadcn.com)** + **[Tailwind](https://tailwindcss.com)** : système de design

---

**Made with 🤍 for our families.**
