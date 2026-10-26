# 0003 — Dépôt public sous licence PolyForm Noncommercial 1.0.0

Date : 2026-05-06 · Statut : en vigueur

## Contexte

Le projet est publié pour que d'autres familles l'installent (guide [ONBOARDING.md](../../ONBOARDING.md)), sans qu'un tiers puisse le revendre.

## Décision

Passage de MIT à PolyForm Noncommercial 1.0.0 ([LICENSE](../../LICENSE)). Données personnelles de la famille retirées avant le passage en public (commit « scrub données perso famille », 06.05.2026).

## Conséquences

- Le dépôt est public : jamais de photo personnelle, de contenu de livre, de donnée de la famille ni de secret dans git. Les configurations réelles (`.firebaserc`, `apps/hub/.env.local`) sont ignorées par git.
- Un usage commercial demande une licence séparée (voir le README).
