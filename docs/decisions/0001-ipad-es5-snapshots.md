# 0001 — L'iPad mini 1 reste en ES5 et lit des snapshots pré-calculés

Date : 2026-05 (phase 1), confirmée par la refonte du 25.10.2026 · Statut : en vigueur

## Contexte

L'écran de cuisine est un iPad mini 1 bloqué sous iOS 9.3.6 (Safari 9), allumé 24 h/24.

## Décision

- `apps/display` est un site séparé du hub, en JavaScript ES5 avec le SDK Firebase v8 compat, sans variables CSS, grid ni `gap` (liste complète : [DESIGN.md § Contraintes iPad](../DESIGN.md#contraintes-ipad-ios-9)).
- L'iPad s'authentifie par un jeton personnalisé d'écran (appairage par code court), pas par un compte Google.
- Il lit des snapshots que les Cloud Functions pré-calculent ; ses écritures sont limitées par les règles (minuteurs, vote recette, ville météo).

## Conséquences

- Chaque fonctionnalité de l'iPad est écrite deux fois (hub React et display ES5). `npm run check:display` et les tests de `packages/design` gardent la compatibilité.
- Les flux radio sont en HTTP : iOS 9 ne valide pas les certificats récents.
