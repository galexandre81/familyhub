# CLAUDE.md

## Le projet

Family Hub : application familiale (menus de la semaine préparés avec Claude.ai, livre de recettes, courses, minuteurs, agenda, météo, radio) pour un foyer.
Trois écrans : un iPad mini 1 mural en cuisine (iOS 9), les téléphones des parents (application installable, hors ligne), un PC pour préparer.
Hébergé sur Firebase (Hosting, Firestore, Functions v2 en europe-west1, Auth). Dépôt **public**, chaque foyer déploie son propre projet.

## Commandes

```bash
npm ci                                   # installe tous les workspaces
npm run build:design && npm run build:types   # obligatoire avant dev:hub sur un clone neuf
npm run dev:hub                          # hub sur http://localhost:5173 (lit apps/hub/.env.local)
npm run check:display                    # iPad : ES5, CSS Safari 9, fichiers référencés
npm run lint --workspace=functions
npm run build                            # contrôles iPad + design + types + functions + hub
npm test --workspace=@family-hub/design  # idem : @family-hub/types, functions, hub
npm run emulators                        # émulateurs Firebase locaux
```

Tests des règles Firestore (Java 21 requis) : voir [firestore-tests/README.md](firestore-tests/README.md).
Déploiement : [docs/exploitation/deploiement.md](docs/exploitation/deploiement.md). Ne jamais déployer sans demande explicite du propriétaire.

## Règles non négociables

- Dépôt public : jamais de secret, de photo personnelle, de donnée de la famille ni de contenu de livre dans git. `.firebaserc` et `apps/hub/.env.local` restent hors de git.
- `apps/display/` reste compatible Safari iOS 9 : ES5 uniquement, pas de variables CSS, ni grid, ni `gap`, ni flex sur un `<button>` ([docs/DESIGN.md](docs/DESIGN.md#contraintes-ipad-ios-9)).
- Couleurs et polices viennent de `packages/design/src/tokens.ts`. Les CSS générés (`apps/hub/src/styles/ambiance.css`, CSS de l'iPad) ne s'éditent jamais à la main : modifier les jetons puis `npm run build:design`.
- Ordre de déploiement d'un lot : fonctions, puis règles, puis hébergement.
- Pas de LLM côté serveur ([décision 0002](docs/decisions/0002-llm-humain-dans-la-boucle.md)).
- Ne jamais pousser sur `main` directement : branche + PR, CI verte (`build` et `rules-tests`).

## Carte du dépôt

| Où | Quoi |
|---|---|
| `apps/hub/` | React + Vite + TS + Tailwind : PC et téléphone (`src/pages/`, `src/lib/`) |
| `apps/display/public/` | iPad ES5 : `js/core.js` (appairage, snapshot, rechargement), `js/tiles/<type>.js` (`window.Tiles[type]`) |
| `functions/src/` | Cloud Functions : `tiles/` (snapshots), `mealPlan/`, `auth/` (jetons d'écran), `household/` (invitations), `timers/` ; exports dans `index.ts` |
| `packages/types/` | Types Firestore partagés et règles pures |
| `packages/design/` | Jetons, règle jour/nuit, générateurs CSS, tests de la logique de l'iPad |
| `firestore.rules`, `firestore.indexes.json`, `firestore-tests/` | Sécurité et index |
| `scripts/` | Contrôles et copie de l'iPad, icônes ; `seedRecipes/` (pré-remplissage du livre par LLM, hors application) |

## Documents de référence (ordre d'autorité)

1. Le code et `firestore.rules`.
2. [docs/ETAT.md](docs/ETAT.md) : état courant, seul document d'état.
3. [docs/DESIGN.md](docs/DESIGN.md) : jetons, jour/nuit, contraintes iPad, téléphone.
4. [docs/architecture.md](docs/architecture.md) et [docs/decisions/](docs/decisions/).
5. [docs/exploitation/](docs/exploitation/) : déploiement, IAM des fonctions.
6. [ONBOARDING.md](ONBOARDING.md) : guide d'installation pour un foyer non technique (canonique pour l'utilisateur final).
7. [docs/archive/](docs/archive/INDEX.md) : historique, jamais une source de vérité.

## Méthode

- Concevoir et exécuter avec superpowers : brainstorming, puis spec dans `docs/superpowers/specs/`, plan dans `docs/superpowers/plans/`, puis subagent-driven-development. Spec et plan livrés : archivés dans `docs/archive/AAAA/` avec une ligne dans `docs/archive/INDEX.md`.
- Skills Pocock seulement pour auditer et affûter (improve-codebase-architecture, grill-with-docs).
- Jamais deux méthodes de planification en parallèle.
- Le propriétaire n'est pas technique : décider les choix techniques, les documenter dans la PR et `docs/ETAT.md`, ne lui soumettre que les décisions métier ou irréversibles, en langage simple.

## Pièges connus

- `npm run dev:hub` ne construit pas `packages/design` ni `packages/types` : « module introuvable » sur un clone neuf.
- Lockfile : le régénérer avec **npm 10** (celui de la CI et de Cloud Build), sinon `npm ci` ou le déploiement des fonctions échouent.
- Le build exige les variables `VITE_FIREBASE_*` (dans `apps/hub/.env.local` ou l'environnement) : `copy-display-into-hub-dist.mjs` échoue sans elles.
- Fonction publique qui répond « internal » à l'iPad : liaison IAM `allUsers` manquante, voir [docs/exploitation/OPS-IAM.md](docs/exploitation/OPS-IAM.md).
- iOS 9 refuse les certificats TLS récents : les flux radio sont en HTTP.
- Ajouter un script à l'iPad : le référencer dans `apps/display/public/index.html` avec `?v=__DISPLAY_VERSION__` (remplacé au build) ; `check:display` vérifie que le fichier existe.
- Un index simple sur `tiles.type` (collection) est requis : sans lui, « Mettre à jour les écrans » échoue en silence.
- Windows, Git Bash : les antislashs des commandes sont mangés ; écrire les scripts dans des fichiers.

## Entretien

Toute modification qui change le comportement met à jour `docs/ETAT.md` et `CHANGELOG.md` dans le même commit.
