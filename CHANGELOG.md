# Changelog

Format [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), par date (le projet n'a pas de numéros de version publiés). Reconstitué depuis l'historique git le 26.10.2026 ; le détail est dans `git log`.

## [Non publié]

### Ajouté
- iPad de cuisine : la carte « PC des enfants » du tableau montre le mode en cours, si le PC est en ligne et s'il y a une demande en attente ; un toucher ouvre le rapport de la journée (applis, internet, demandes et réponses). Lecture seule : les règles interdisent à l'iPad toute écriture sur le PC, et `nextdnsAppareil` ne lui sert que le rapport de son foyer.
- PC des enfants : notifications des demandes. Chaque parent active « Me prévenir des demandes » sur ses téléphones et ordinateurs ; une demande de l'enfant les fait tous sonner, et un toucher ouvre l'écran du PC. Fonction `notifierDemandePc`, liste de jetons par parent (`devices/{id}/notifySubscribers/{uid}`), service worker `notifications-sw.js`.

### Documentation
- Rangement de la documentation : `CLAUDE.md`, `docs/ETAT.md`, `docs/architecture.md`, `docs/decisions/`, `docs/exploitation/`, archive des specs et plans livrés (`docs/archive/INDEX.md`). Aucun changement de code.

## 2026-10-25 — Refonte iPad de cuisine + téléphone (PR #21 à #30)

### Ajouté
- Paquet `@family-hub/design` : jetons du design system, ambiance jour/nuit automatique (lever et coucher du soleil) sur le hub et l'iPad.
- Application de téléphone installable et utilisable hors ligne : Aujourd'hui, Semaine, Courses, Recettes, mode recette.
- Invitation de l'autre parent dans le foyer, rôles (`parent`), profil relié à son compte.
- Liste de courses : un document par article, tri déjà / drive / magasin, produits de placard, coches hors ligne synchronisées, oublis reportés au plan suivant.
- Minuteurs partagés entre téléphones et iPad ; seul l'appareil qui a lancé un minuteur sonne.
- iPad : nouveau tableau (prochain repas, ensuite, batch cooking, minuteurs, « PC des enfants »), mode recette « toute la recette d'un coup », écrans plein écran au nouveau design, rechargement automatique après chaque déploiement, 17 stations de radio testées.
- Hub : un seul onglet « iPad de cuisine » (appairage, mise à jour, sources, agenda), nom de la carte « PC des enfants » réglable, nouvelle icône.

### Retiré
- Les 6 thèmes et le choix de thème (remplacés par l'ambiance jour/nuit).

### Corrigé
- Ré-appairage de l'iPad après suppression de l'écran ; index `tiles.type` rétabli ; Recettes en accès direct (erreur React #310).

## 2026-09-28 — Correctifs d'audit (PR #10, #19)

### Corrigé
- Sécurité des règles, appairage, iPad, données ; Node 22 ; déploiement des fonctions avec npm 10 (vitest remonté à la racine).

## 2026-06-17 — Audit complet

### Ajouté
- CI GitHub Actions (build, lint, tests, règles Firestore sur l'émulateur) ; tests Vitest du hub et des fonctions.
- Absences, hiérarchie des contraintes et règles de nutrition dans les profils ; gabarit de courses imprimable.

### Corrigé
- Fiabilité du kiosque 24 h/24, accessibilité, navigation des recettes sur tablette, import des plans, règles et index.

## 2026-05-08 → 2026-05-21 — Phase 4

### Ajouté
- Tuile Réglages de l'iPad (thèmes, luminosité), défilement iPad corrigé, plans de durée variable, navigation dans l'historique des menus.

## 2026-05-04 → 2026-05-11 — Phase 3

### Ajouté
- Planificateur de repas avec Claude.ai (export `.md`, import JSON), batch cooking, livre de recettes, liste de courses et partage vers Google Keep, mode cuisine iPad, recherche par ingrédients du frigo.

### Modifié
- 06.05 : dépôt rendu public, licence PolyForm Noncommercial 1.0.0, guide ONBOARDING.md.

## Avant le 2026-05-04 — Phases 1 et 2

### Ajouté
- Monorepo Firebase, tuiles horloge, météo, radio, agenda, minuteur ; iPad mural.
