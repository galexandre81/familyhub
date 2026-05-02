# Seed du livre de recettes

Script Node.js qui génère **plusieurs centaines de recettes** dans la collection `households/{hid}/recettes` via un LLM local (LM Studio + Qwen 9B).

**Coût** : 0€ (tout local, pas de Gemini/Claude).
**Durée** : ~15-30 min pour ~300 recettes selon GPU.

## Prérequis

1. **LM Studio** installé avec un modèle chargé. Recommandés :
   - `qwen/qwen3.5-9b` (testé)
   - `Qwen2.5-9B-Instruct`, `Qwen3-8B`, `Qwen3-14B`
2. **Serveur LM Studio démarré** : onglet "Local Server" → bouton "Start Server" (port 1234 par défaut).
3. **Credentials Firebase Admin** :
   - Soit télécharger un service-account JSON (Firebase Console → Settings → Service accounts → Generate new private key) et le placer dans `scripts/seedRecipes/service-account.json`
   - Soit `gcloud auth application-default login` (plus simple si tu as déjà gcloud)

## Setup (1 fois)

```bash
cd scripts/seedRecipes
npm install
cp .env.example .env
# édite .env pour mettre FIREBASE_PROJECT_ID et le path du service-account
```

## Utilisation

### Test à blanc (pas d'écriture Firestore)

```bash
npm run seed -- --household HID --dry-run --count 10
```

Vérifie que LM Studio répond et que le LLM produit du JSON valide. Pas d'effet en base.

### Vraie génération

```bash
# ID du foyer = depuis le hub : /parametres → ton foyer (ou regarde l'URL Firestore Console)
npm run seed -- --household VOTRE_HID
```

→ Génère ~290 recettes (12 batches couvrant français, méditerranéen, asiatique, indien, etc.) pour la saison printemps-été.

### Options

| Flag | Effet |
|---|---|
| `--household HID` | **Obligatoire**. Foyer cible. |
| `--count N` | Cible totale (les batches sont scaled proportionnellement). Sinon : ~290. |
| `--theme "..."` | Force un seul thème (ex: `--theme "asiatique varié"`). |
| `--saison hiver` | Au lieu de printemps-été (défaut). |
| `--dry-run` | Affiche sans écrire en base. |
| `--model NAME` | Override le modèle. Défaut : `qwen/qwen3.5-9b`. |
| `--base-url URL` | Override LM Studio. Défaut : `http://localhost:1234/v1`. |

## Comportement

- **Dédoublonnage** : avant écriture, le script charge les noms déjà en base et les noms générés dans la session courante. Recettes dont le nom normalisé existe déjà → skippées (loggées).
- **Variété** : à chaque batch, les noms générés au précédent batch sont passés au LLM en "à éviter".
- **Profils** : lus depuis `households/{hid}/profils` au démarrage. Aversions, régimes, objectifs nutrition injectés dans chaque prompt.
- **Tags fins** : chaque recette est sauvée avec `seedTags: { styleCulinaire, proteinePrincipale, modeCuissonPrincipal, tempsTotal }` pour permettre le filtrage algorithmique côté génération de plan.
- **Statut initial** : `accepted` (apparaît dans le livre) avec `excluded: false`. Tu peux ensuite upvoter (passe en `favorite`) ou downvoter (`excluded: true`) depuis le hub.

## Itération saisonnière

Quand la saison change ou que tu veux enrichir :

```bash
# Garde les recettes upvotées, ajoute 100 nouvelles
npm run seed -- --household HID --count 100 --saison automne-hiver
```

Le dédoublonnage évite les conflits avec les recettes existantes.

## Troubleshooting

### "ECONNREFUSED localhost:1234"
LM Studio n'est pas démarré ou tourne sur un autre port. Vérifie l'onglet "Local Server".

### "Modèle X pas listé par LM Studio"
Le modèle indiqué via `--model` n'est pas chargé. Vérifie avec :
```bash
curl http://localhost:1234/v1/models
```

### "Could not load default credentials"
Soit définis `GOOGLE_APPLICATION_CREDENTIALS` dans `.env`, soit lance `gcloud auth application-default login`.

### "Aucun profil dans households/{hid}/profils"
Crée d'abord les profils via le hub (`/parametres/profils`).

### JSON invalide retourné par le LLM
Qwen 9B est généralement fiable mais peut occasionnellement produire du JSON malformé sur de gros batches. Réduis `count` par batch (option `--count`).
