# 0002 — Pas de LLM côté serveur : menus préparés avec Claude.ai, humain dans la boucle

Date : 2026-05-04 (phase 3.0, « purge code LLM legacy ») · Statut : en vigueur

## Contexte

Le menu de la semaine dépend de contraintes familiales qui se discutent (présences, goûts, frigo à écouler).

## Décision

Le hub génère un fichier `.md` structuré ; la personne le colle dans Claude.ai, ajuste par la conversation, puis importe le JSON validé (schéma Zod dans le hub). Aucune Cloud Function n'appelle de LLM.

Seule exception, hors application : `scripts/seedRecipes/` peut appeler un LLM (Gemini, Claude ou LM Studio) depuis le poste du développeur pour pré-remplir le livre de recettes.

## Conséquences

- Coût d'exploitation quasi nul, aucune clé d'API dans Firebase.
- L'import doit tolérer les erreurs du LLM (noms de profils, dates) : voir `apps/hub/src/lib/planImportSchema.ts`.
