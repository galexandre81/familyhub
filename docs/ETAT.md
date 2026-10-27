# État du projet

Mis à jour le 26.10.2026. Seul document d'état du dépôt : le tenir à jour dans le même commit que tout changement de comportement.

## En service

Déployé sur le projet Firebase du propriétaire, utilisé par le foyer : un iPad mini 1 en cuisine et les téléphones des deux parents.

## Livré

| Date | Quoi | Où |
|---|---|---|
| avant le 04.05.2026 | Fondation monorepo, tuiles horloge, météo, radio ; iPad mural (phase 1) ; mise en page, tuiles agenda et minuteur (phase 2) | historique git |
| 04 → 11.05.2026 | Phase 3 : planificateur de repas avec Claude.ai, batch cooking, livre de recettes, liste de courses, mode cuisine iPad, recherche par ingrédients du frigo | historique git |
| 06.05.2026 | Dépôt public, licence PolyForm Noncommercial, guide [ONBOARDING.md](../ONBOARDING.md) | [décision 0003](decisions/0003-licence-polyform-noncommercial.md) |
| 08 → 21.05.2026 | Phase 4 : défilement et mise en page iPad, tuile Réglages ; plans de durée variable, historique des menus | [archive](archive/INDEX.md) |
| 17.06.2026 | Audit complet (navigation, accessibilité, fiabilité kiosque, sécurité, perf) ; CI ; tests des règles Firestore | [archive](archive/INDEX.md) |
| 28.09.2026 | Correctifs de l'audit du 28.09 (sécurité, appairage, données), Node 22, déploiement des fonctions avec npm 10 | PR #10, #19 |
| 25.10.2026 | Refonte : ambiance jour/nuit du design system, application de téléphone installable et hors ligne, invitation de l'autre parent, liste de courses cochable hors ligne, nouvel écran de cuisine de l'iPad (tableau, mode recette, minuteurs partagés), rechargement automatique de l'iPad | PR #21 à #30, [archive](archive/INDEX.md) |
| 27.10.2026 | Contrôle parental du PC des enfants : écran parent `/pc` (modes, verrouillage, demandes, journée, filtre internet NextDNS, réglages), règles, simulateur ; déployé et PC relié | PR #32, [BILAN](controle-parental/BILAN.md) |
| 27.10.2026 | Notifications des demandes : interrupteur « Me prévenir des demandes » par téléphone ou navigateur, fonction `notifierDemandePc` | [BILAN](controle-parental/BILAN.md) phase 9 |

## En cours

Rien. Aucune spec ni aucun plan ouvert dans `docs/superpowers/`.

## Bloqué

Rien.

## Prochaines étapes

- **PC des enfants** : suite dans [BILAN.md « Ce qui reste »](controle-parental/BILAN.md#ce-qui-reste-dans-lordre) (bascule de l'agent du PC, déploiement des notifications, essai réel).
- **Mises à jour de dépendances** proposées par Dependabot, en attente : PR #11 à #13, #15 à #18 et #20 (dont des montées de version majeures : Firebase 12, React Router 7, React, actions GitHub). À traiter une par une, CI verte et vérification sur l'iPad.
- **Amendements proposés au guide [ONBOARDING.md](../ONBOARDING.md)** (26.10.2026, document canonique non modifié par le rangement) : « ~14 fonctions » (§ 7.4) devient « ~22 » (nombre exporté par `functions/src/index.ts`) ; `npm install` (§ 6.3, § 11, § 12.5) pourrait devenir `npm ci`, qui respecte le lockfile (sans gravité pour un foyer qui installe une fois).
- **Connexion depuis l'application installée sur iPhone** : réglage à faire par le propriétaire (`VITE_FIREBASE_AUTH_DOMAIN` sur le domaine du site), voir [DESIGN.md § Téléphone](DESIGN.md#téléphone-application-installable). Fait ou non : inconnu.

## Questions ouvertes

- Les vérifications à la main du lot du 25.10.2026 ([deploiement.md](exploitation/deploiement.md#lot-du-25102026-refonte-ipad--téléphone)) ont-elles toutes été faites ?
- Trois brouillons de PR datent d'avant la remise à zéro de `main` du 03.05.2026 (#1, #5, #9) et ne correspondent plus au code : à fermer ?
- `.env.example` déclare `VITE_HUB_URL`, `VITE_DISPLAY_URL` et `VITE_GOOGLE_CALENDAR_CLIENT_ID`, typées dans `apps/hub/src/lib/env.d.ts` mais lues nulle part : à retirer du code et du modèle ?
- **Ancienne configuration web Firebase dans l'historique public** : la clé web (`apiKey`) et l'`appId` d'un projet Firebase réel ont été versionnés dans `apps/display/public/js/firebase-config.js` du 01.05 au 28.09.2026 (commits `68612ef` à `be4b24b`), puis retirés ; ils restent lisibles dans l'historique. Une clé web Firebase n'est pas un secret (la sécurité vient des règles Firestore), mais si ce projet est toujours en service, restreindre la clé aux domaines du site dans la console Google Cloud suffit. Réécrire l'historique n'est pas recommandé.
- **Branches GitHub à nettoyer** (rien n'a été supprimé) :
  - 18 branches déjà fusionnées dans `main`, supprimables sans perte : `claude/home-three-tiles`, `claude/livre-recettes-wizard`, `claude/recipe-meal-filter-n1Xuj`, `claude/tile-livre-recettes`, `correctifs-apres-refonte`, `correctifs-audit-2026-09-28`, `fix-deploy-npm10`, `fix-reappairage`, `icone-maison`, `ipad-dernieres-vues`, `menu-depuis-ensuite`, `minuteurs-sonnerie-locale`, `nom-pc-enfants`, `onglet-ipad-cuisine`, `phase-3-kitchen-buddy`, `phase-4-ipad-ux`, `radios`, `refonte-ipad-mobile`.
  - 5 branches mortes du 03.05.2026, antérieures à la remise à zéro de `main` : `phase-1-bootstrap`, `claude/review-project-status-O1TyI` (sans PR), et celles des brouillons #1, #5, #9 (`claude/fix-kitchen-visibility-q9iSD`, `claude/livre-standalone`, `claude/livre-recettes-ux-v2`).
  - Les branches `dependabot/*` vivent avec leurs PR.
