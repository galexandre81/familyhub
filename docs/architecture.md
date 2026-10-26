# Architecture

Vue d'ensemble pour un développeur. La version pour débutant est dans [ONBOARDING.md § 3](../ONBOARDING.md#3-architecture-du-projet).

## Les morceaux

```
┌──────────────────────┐   lit / écrit    ┌──────────────────────────┐
│ Hub (apps/hub)       │ ───────────────→ │ Firebase                 │
│ React, PC + téléphone│                  │  ▸ Firestore             │
│ installable, hors    │ ←─── callable ── │  ▸ Cloud Functions v2    │
│ ligne                │                  │    (europe-west1)        │
└──────────────────────┘                  │  ▸ Auth (Google + jeton  │
                                          │    personnalisé iPad)    │
┌──────────────────────┐   lit (snapshot) │  ▸ Hosting               │
│ iPad (apps/display)  │ ───────────────→ │  (Storage : activé, non  │
│ ES5, iOS 9, jeton    │                  │   utilisé)               │
│ d'écran              │                  └──────────────────────────┘
└──────────────────────┘                             ▲
                                                     │ cron + déclencheurs
                                          ┌──────────────────────────┐
                                          │ functions/ : construit   │
                                          │ les snapshots des tuiles │
                                          └──────────────────────────┘
```

| Dossier | Rôle | Contraintes |
|---|---|---|
| `apps/hub/` | Site React (Vite, TypeScript, Tailwind, React Query, React Router) : préparation des menus au PC, application de téléphone (Aujourd'hui, Semaine, Courses, Recettes, mode recette) | PWA (`vite-plugin-pwa`), cache Firestore IndexedDB, voir [DESIGN.md § Téléphone](DESIGN.md#téléphone-application-installable) |
| `apps/display/public/` | Écran de cuisine de l'iPad mini 1 : tableau, mode recette, minuteurs, tuiles plein écran (`js/tiles/*.js`, un fichier par type) | JavaScript ES5 et Firebase SDK v8 compat, pas de variables CSS ni de grid : [DESIGN.md § Contraintes iPad](DESIGN.md#contraintes-ipad-ios-9). Recopié dans `apps/hub/dist/display` au build |
| `functions/src/` | Cloud Functions Node 22 : snapshots des tuiles (`tiles/`), plans de repas (`mealPlan/`), jetons d'écran (`auth/`), invitations (`household/`), nettoyage des minuteurs (`timers/`) | Région `europe-west1`, exports listés dans `functions/src/index.ts` |
| `packages/types/` | Types Firestore partagés hub / functions, règles pures (repas passé, heures de repas) | |
| `packages/design/` | Jetons du design system, règle jour/nuit, générateurs du CSS du hub et de l'iPad | CSS généré : ne pas éditer à la main |
| `firestore.rules`, `firestore-tests/` | Règles de sécurité et leurs tests sur l'émulateur | |
| `scripts/` | Contrôles de l'iPad (`check-display-*`), copie de l'iPad dans le build, générateurs d'icônes et de son ; `seedRecipes/` pré-remplit le livre de recettes par un LLM ([README](../scripts/seedRecipes/README.md)) | |

## Flux de données

- **Hub** : lit et écrit Firestore sous `households/{hid}/…` (profils, plans, recettes, listes de courses, minuteurs) ; les opérations sensibles passent par des fonctions callable (création/validation de plan, invitations, appairage d'écran).
- **iPad** : appairé par un code court, il reçoit un jeton personnalisé (`auth/displayToken.ts`) et **lit** les snapshots que les fonctions pré-calculent pour chaque tuile (météo, agenda, recette du jour, menu de la semaine), rafraîchis par des tâches planifiées (agenda toutes les 15 min, météo et recette du jour toutes les 30 min, menu de la semaine chaque nuit) et à la demande depuis le hub. Ses seules écritures, bornées par `firestore.rules` : les minuteurs partagés, le vote sur une recette (`statut`, `excluded`) et le choix de la ville météo.
- **Rechargement de l'iPad** : il surveille `version.json` (toutes les 10 minutes) et se recharge après chaque déploiement, sauf pendant une recette ouverte.
- **Menus** : pas de LLM côté serveur. Le hub exporte un `.md`, la personne dialogue avec Claude.ai, puis importe le JSON obtenu ([décision 0002](decisions/0002-llm-humain-dans-la-boucle.md)).

## Intégrations externes

- **Open-Meteo** : météo et horaires du soleil, sans clé.
- **Agenda** : URL iCal collée dans le hub (page « iPad de cuisine »), lue par `functions/src/tiles/calendar.ts`.
- **Google Keep** : partage de la liste de courses par la Web Share API, en option.
- **Radio** : flux HTTP publics (iOS 9 refuse les certificats récents), stations proposées dans `packages/types/src/tiles/radio.ts`.
