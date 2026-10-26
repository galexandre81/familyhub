<div align="center">

# 🍽️ Family Hub

### **Tu veux installer Family Hub chez toi pour ta famille ?**

# 👉 [📖 LIS LE GUIDE D'INSTALLATION](./ONBOARDING.md) 👈

**~2 à 3 heures · Niveau zéro technique requis · Windows + macOS · 0 € / mois**

*Aucune compétence en programmation nécessaire. Le guide est rédigé pour quelqu'un qui n'a jamais ouvert un terminal de sa vie.*

---

</div>

> Application familiale hébergée sur Firebase, pour un foyer : un iPad en cuisine, les téléphones des parents et un PC pour préparer, tous synchronisés.

**Statut** : en service dans le foyer de l'auteur ; dernière grosse livraison le 25.10.2026 (refonte iPad + téléphone). Détail : [docs/ETAT.md](docs/ETAT.md).

---

## ✨ Fonctionnalités

### 🍽️ Menus de la semaine
- **Assistant en 5 étapes** au PC : date, qui est là, présence par repas (avec repas express ≤ 15 min), contexte (batch cooking, jour des courses, frigo à écouler), revue
- **Plans de durée variable** : un plan démarre n'importe quel jour et peut dépasser 7 jours
- **Humain dans la boucle avec Claude.ai** : le hub génère un `.md`, tu dialogues avec Claude.ai, tu importes le JSON obtenu. Aucune IA côté serveur
- Notes par repas, repas annulé, changement de recette, historique des semaines passées, batch cooking

### 📖 Livre de recettes
- Recherche par nom, tag, style (insensible aux accents) et **par ingrédients du frigo**
- Favoris, exclusions, vote pouce ↑↓
- **Mode recette** : toutes les recettes du repas d'un coup, quantités ajustées aux portions, minuteurs à côté

### 🛒 Courses
- Liste générée depuis le menu, regroupée par rayon, produits de placard à vérifier
- Tri à la maison : « On l'a », « Drive », « Magasin »
- **Cochée en magasin sans réseau**, à la couleur de la personne, synchronisée au retour du réseau
- Oublis ajoutés à la main, reportés au plan suivant ; partage vers Google Keep en option

### 📱 Téléphone
- Application installable sur l'écran d'accueil, utilisable hors ligne : Aujourd'hui, Semaine, Courses, Recettes
- L'autre parent rejoint le foyer par invitation

### 🧑‍🍳 iPad de cuisine (iPad mini 1, iOS 9)
- Tableau fixe : prochain repas, ensuite, batch cooking, minuteurs, météo, agenda, « PC des enfants »
- Plein écran : agenda, menu de la semaine, livre de recettes, radio, réglages (luminosité)
- **Minuteurs partagés** avec les téléphones ; seul l'appareil qui lance un minuteur sonne
- Se met à jour tout seul après chaque déploiement

### 🎨 Ambiance
- Jour/nuit automatique (lever et coucher du soleil), sur le téléphone, le PC et l'iPad

---

## 🏗️ Architecture en 30 secondes

```
┌────────────────┐                ┌────────────────────┐
│ Hub (PC +      │ ←─── R/W ────→ │                    │
│ téléphone)     │                │     Firebase       │
│ React + Vite   │                │                    │
└────────────────┘                │  ▸ Firestore (BDD) │
                                  │  ▸ Auth Google     │
┌────────────────┐                │  ▸ Cloud Functions │
│ iPad cuisine   │ ←── lit ─────→ │  ▸ Hosting         │
│ ES5 vanilla    │                │  (Storage activé,  │
└────────────────┘                │   non utilisé)     │
                                  └────────────────────┘
```

- **`apps/hub/`** : React/Vite/TS, PC et application de téléphone (installable, hors ligne)
- **`apps/display/`** : site JavaScript ES5 pour l'iPad mini 1 (iOS 9.3.6)
- **`functions/`** : Cloud Functions Node 22 (snapshots des tuiles, plans de repas, appairage, invitations)
- **`packages/types/`**, **`packages/design/`** : types partagés, jetons du design et règle jour/nuit

L'iPad s'authentifie par un jeton d'écran (pas de compte Google) et lit des snapshots pré-calculés par les Cloud Functions. Détails : [docs/architecture.md](docs/architecture.md).

---

## 🛠️ Stack technique

| Couche | Tech |
|---|---|
| Hub (PC + téléphone) | React 18, Vite, TypeScript, Tailwind CSS, React Query, React Router, `vite-plugin-pwa` |
| iPad | HTML + JavaScript ES5 + Firebase SDK v8 compat (iOS 9.3.6) |
| Backend | Firebase Cloud Functions v2 (Node 22, europe-west1) |
| Données | Cloud Firestore (cache hors ligne IndexedDB côté hub) |
| Auth | Firebase Auth : Google pour les parents, jeton personnalisé pour l'iPad |
| Hébergement | Firebase Hosting |
| Validation, tests | Zod, Vitest, émulateur Firestore |
| Monorepo | npm workspaces |

---

## 👨‍💻 Démarrage développeur

> Pour installer Family Hub chez toi : [ONBOARDING.md](./ONBOARDING.md).

**Prérequis** : Node.js ≥ 22 (npm 10), Firebase CLI (`npm i -g firebase-tools`), un projet Firebase à toi (plan Blaze) pour lancer le hub contre de vraies données. Java 21 pour les émulateurs Firebase (`npm run emulators`) et les tests des règles.

```bash
git clone https://github.com/galexandre81/familyhub.git
cd familyhub
npm ci

cp .env.example apps/hub/.env.local      # puis remplis les VITE_FIREBASE_* de ton projet
cp .firebaserc.example .firebaserc       # puis mets ton projectId (fichier non versionné)

npm run build:design && npm run build:types   # paquets partagés, obligatoire avant dev:hub
npm run dev:hub                               # → http://localhost:5173
```

L'iPad n'a pas de serveur de dev : `npm run build` le recopie dans `apps/hub/dist/display`, servi par `npm run emulators` ou par l'hébergement.

### Commandes

| Commande | Rôle |
|---|---|
| `npm run dev:hub` | Hub en local |
| `npm run check:display` | iPad : ES5, CSS compatible Safari 9, fichiers référencés |
| `npm run lint --workspace=functions` | Lint des Cloud Functions |
| `npm test --workspace=<w>` | Tests, `<w>` = `@family-hub/design`, `@family-hub/types`, `functions`, `hub` |
| `npm run build` | Contrôles iPad + design + types + functions + hub |
| `npm run emulators` | Émulateurs Firebase locaux (Java 21 requis) |
| `npm run deploy:functions` / `deploy:rules` / `deploy:hosting` / `deploy` | Déploiement, dans cet ordre : [docs/exploitation/deploiement.md](docs/exploitation/deploiement.md) |

Tests des règles Firestore : [firestore-tests/README.md](firestore-tests/README.md). La CI (GitHub Actions) lance tout cela sur chaque PR, sans rien déployer.

### Ajouter une tuile à l'iPad

1. Type de config dans `packages/types/src/tiles/<type>.ts`, et le type dans `TileType` (`packages/types/src/common.ts` **et** `functions/src/types.ts`).
2. Module ES5 dans `apps/display/public/js/tiles/<type>.js`, enregistré dans `window.Tiles[type]`, référencé dans `apps/display/public/index.html` avec `?v=__DISPLAY_VERSION__`.
3. Si la tuile appartient au tableau de cuisine : `TYPES_TABLEAU` dans `apps/hub/src/lib/ecranCuisine.ts`.
4. Si elle a besoin de données pré-calculées : snapshot builder dans `functions/src/tiles/<type>.ts` (+ tâche planifiée), exporté dans `functions/src/index.ts`.
5. Logique pure de l'iPad testée dans `packages/design/src/display*.test.ts`.

---

## 📚 Documentation

Par ordre d'autorité (le code fait foi en cas de doute) :

| Document | Contenu |
|---|---|
| [docs/ETAT.md](docs/ETAT.md) | État courant : livré, en cours, prochaines étapes |
| [docs/DESIGN.md](docs/DESIGN.md) | Jetons, jour/nuit, contraintes iPad, application de téléphone |
| [docs/architecture.md](docs/architecture.md) | Morceaux, flux de données, intégrations |
| [docs/decisions/](docs/decisions/) | Décisions d'architecture |
| [docs/exploitation/](docs/exploitation/) | Déploiement, IAM des Cloud Functions |
| [ONBOARDING.md](ONBOARDING.md) | Guide d'installation pour un foyer non technique |
| [CHANGELOG.md](CHANGELOG.md) | Historique des livraisons |
| [CLAUDE.md](CLAUDE.md) | Consignes pour les agents de code |
| [docs/archive/](docs/archive/INDEX.md) | Specs et plans clos |

**Hors périmètre (volontairement)** : LLM côté serveur, chat intégré, OCR de recettes externes, notifications push.

---

## 💸 Coût d'exploitation

Pour un usage familial (3-5 personnes, 1 plan/semaine) :

- **Quasiment toujours 0 €/mois** : le quota gratuit Firebase suffit
- **Plan Blaze obligatoire** (CB requise) : les Cloud Functions 2nd gen ne marchent pas sur Spark
- **Recommandé** : alerte budget à 1 €, restrictions HTTP referrer sur l'apiKey

Détails dans [ONBOARDING.md §2.3](./ONBOARDING.md#23--le-coût--à-lire-absolument).

---

## 🤝 Contribuer

Family Hub est un projet **open-source** que tu peux fork, cloner, adapter à ta famille :

- 🐛 [Ouvrir une issue](https://github.com/galexandre81/familyhub/issues) en décrivant le problème et les étapes pour le reproduire
- 💡 [Proposer une fonctionnalité](https://github.com/galexandre81/familyhub/issues/new)
- 🔧 [Pull request](https://github.com/galexandre81/familyhub/pulls) bienvenue (CI verte, description des changements)

---

## 📜 Licence

**[PolyForm Noncommercial 1.0.0](./LICENSE)** — usage **non commercial uniquement**.

Tu peux librement copier, modifier, distribuer ce code pour :
- 🏠 Usage familial / perso
- 🎓 Étude, recherche, tests, hobby projects
- 🤝 Organisations caritatives, éducatives, recherche publique, santé
- 🔧 Contributions open-source, forks pour adaptations

L'**usage commercial** (revente d'un service basé sur ce code, intégration dans un produit commercial, SaaS payant pour des familles tierces) **requiert une licence séparée**. Si c'est ton cas, [ouvre une issue](https://github.com/galexandre81/familyhub/issues) pour qu'on en discute.

---

## 🙏 Remerciements

- **[Anthropic Claude](https://claude.ai)** : co-pilote pendant tout le développement et compagnon human-in-the-loop pour les menus
- **[Firebase](https://firebase.google.com)** : infrastructure backend
- **[Open-Meteo](https://open-meteo.com)** : API météo gratuite et sans clé
- **[Lucide Icons](https://lucide.dev)** : icônes SVG
- **[Tailwind](https://tailwindcss.com)** : CSS du hub

---

**Made with 🤍 for our families.**

---

<div align="center">

### Tu veux ton propre Family Hub ?

# 📖 [LIS LE GUIDE D'INSTALLATION →](./ONBOARDING.md)

</div>
