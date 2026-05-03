# Seed du livre de recettes

Script Node.js qui génère **~500 recettes** dans la collection `households/{hid}/recettes` via un LLM, avec **validation post-génération des contraintes des profils familiaux**.

Deux providers supportés :

| Provider | Coût | Vitesse | Setup |
|---|---|---|---|
| **`gemini`** (défaut) | ~$0.50 pour 500 recettes avec `gemini-2.5-flash` | ~10-15 min | Clé API gratuite à créer sur Google AI Studio |
| **`lmstudio`** | 0€ | ~30-60 min selon GPU | Lourd : LM Studio + modèle Qwen 9B chargé localement |

Mode `gemini` recommandé : le coût est négligeable et la qualité du JSON / suivi des contraintes nettement supérieurs à un Qwen 9B local.

## Répartition des 500 recettes

- **Petit-déjeuner salé : 60** (œufs, tartines salées, du monde, batch)
- **Petit-déjeuner sucré : 20** (porridge, smoothie bowls, pancakes…)
- **Déjeuner : 200** (salades, bowls, méditerranéen léger, asiatique léger, soupes froides, wraps, poissons rapides, batch céréales, végétariens créatifs)
- **Dîner : 220** (français revisité, méditerranéen, moyen-oriental batch, asiatique, indien batch, grillades, poissons, dîners familiaux, mexicain)

Chaque recette est tagguée `seedTags.repas` (`petit-dej-sale | petit-dej-sucre | dejeuner | diner | tout`) pour que le meal planner puisse filtrer par slot.

## Garantie sur les contraintes profils

C'est l'intérêt central de l'outil : les **régimes** (`végétarien`, `sans porc`, `sans gluten`, `vegan`, `sans poisson`, `sans lactose`, `halal`, `casher`, etc.) et les **aversions** (texte libre par profil) sont :

1. Convertis en liste d'ingrédients interdits agrégée (régimes mappés via dictionnaire dans `constraints.ts`, aversions ajoutées telles quelles avec normalisation accent/pluriel).
2. **Injectés dans le prompt** à deux endroits : system prompt (consigne stricte) + user prompt en bloc explicite numéroté.
3. **Vérifiés après génération** sur la liste d'ingrédients de chaque recette. Toute recette qui viole une contrainte est **rejetée** (mode strict, défaut) avant écriture en base.

Pour passer en mode warning au lieu de rejet : `--no-strict-constraints`.

## Règles nutrition famille (preset)

Le foyer choisit un preset structurel via le hub (`/parametres/regles-nutrition`) — par défaut **« Équilibre Guillaume »** (60% légumes / 22% protéines / 18% féculents, max 1 féculent par repas, légumes peu caloriques privilégiés, carottes/betteraves limitées).

Presets disponibles : `equilibre`, `perte-poids`, `proteine`, `mediterraneen`, `vegetarien-equilibre`, `sans-sel-strict`, ou `custom` (le foyer réécrit chaque champ).

Le seed :
1. **Charge** le preset actif depuis `households/{hid}/reglesNutrition/active` (ou utilise le défaut si aucun doc).
2. **Injecte un bloc « ⚖️ STRUCTURE DU REPAS — RÈGLES FAMILLE »** en haut du user prompt, avec les ratios et la règle « max N féculents par repas ».
3. **Valide après génération** que chaque déjeuner / dîner respecte la règle (compte les groupes de féculents distincts, vérifie la présence de légumes et de protéine si obligatoire). Les petits-déjeuners sont exemptés.
4. **Tague chaque recette** avec `seedTags.convientAuxPresets: [presetId]` pour que le meal planner puisse filtrer si tu changes de preset par la suite.

## Prérequis

### Provider Gemini (défaut)

1. Crée une clé API sur https://aistudio.google.com/apikey
2. **Credentials Firebase Admin** (un des deux) :
   - Service-account JSON dans `scripts/seedRecipes/service-account.json`
   - ou `gcloud auth application-default login`

### Provider LM Studio (alternative locale)

1. **LM Studio** installé avec un modèle chargé. Recommandés :
   - `qwen/qwen3.5-9b` (testé)
   - `Qwen2.5-9B-Instruct`, `Qwen3-8B`, `Qwen3-14B`
2. **Serveur LM Studio démarré** : onglet "Local Server" → "Start Server" (port 1234 par défaut).
3. **Credentials Firebase Admin** (idem ci-dessus).

## Setup (1 fois)

```bash
cd scripts/seedRecipes
npm install
cp .env.example .env
# édite .env :
#   - FIREBASE_PROJECT_ID
#   - GOOGLE_APPLICATION_CREDENTIALS (ou ADC)
#   - LLM_PROVIDER=gemini (ou lmstudio)
#   - GEMINI_API_KEY=AIza...
```

## Utilisation

### Test à blanc (pas d'écriture Firestore)

```bash
npm run seed -- --household HID --dry-run --count 10
```

Vérifie que le LLM répond et produit du JSON valide. Pas d'effet en base.

### Vraie génération — 500 recettes

```bash
npm run seed -- --household VOTRE_HID
```

→ Génère ~500 recettes (24 batches couvrant petit-déj salé majoritaire, déjeuner light, dîner familial varié) pour la saison printemps-été, avec rejet automatique des recettes qui violent les contraintes des profils.

### Options

| Flag | Effet |
|---|---|
| `--household HID` | **Obligatoire**. Foyer cible. |
| `--provider gemini\|lmstudio` | Défaut : `gemini` (ou `LLM_PROVIDER` du `.env`). |
| `--count N` | Cible totale (les batches sont scaled proportionnellement). Sinon : 500. |
| `--theme "..."` | Force un seul thème (ex: `--theme "asiatique varié"`). |
| `--saison hiver` | Au lieu de printemps-été (défaut). |
| `--dry-run` | Affiche sans écrire en base. |
| `--model NAME` | Override le modèle. Défaut : `gemini-2.5-flash` ou `qwen/qwen3.5-9b`. |
| `--base-url URL` | Override LM Studio. Défaut : `http://localhost:1234/v1`. |
| `--no-strict-constraints` | Désactive le rejet auto, juste warn. À éviter en prod. |

## Comportement

- **Dédoublonnage** : avant écriture, le script charge les noms déjà en base et les noms générés dans la session courante. Recettes dont le nom normalisé existe déjà → skippées (loggées).
- **Variété** : à chaque batch, les noms générés au précédent batch sont passés au LLM en "à éviter".
- **Profils** : lus depuis `households/{hid}/profils` au démarrage. Aversions + régimes (mappés) → liste d'ingrédients interdits agrégée. Objectifs nutrition + notes injectés dans chaque prompt.
- **Validation post-génération** : pour chaque recette, parse les ingrédients (lowercase, sans accents, singulier basique, tokens et bigrammes) et vérifie qu'aucun terme interdit n'apparaît. Sinon rejet (strict) ou warn.
- **Tags fins** : chaque recette est sauvée avec `seedTags: { styleCulinaire, proteinePrincipale, modeCuissonPrincipal, tempsTotal, repas }` pour permettre le filtrage algorithmique côté génération de plan et la tuile « Livre de recettes ».
- **Statut initial** : `accepted` (apparaît dans le livre) avec `excluded: false`. Tu peux ensuite upvoter (passe en `favorite`) ou downvoter (`excluded: true`) depuis le hub (`/livre-recettes`).

## Compteur de tokens et coût

Le résumé final affiche :

```
Tokens                          : 412 803 in + 1 287 152 out
Coût estimé (gemini/gemini-2.5-flash) : $3.3567 ≈ €3.0882
  → input  : $0.1238 (0.413M × $0.30/M)
  → output : $3.2329 (1.287M × $2.50/M)
```

Tarifs configurés dans `seed.ts:GEMINI_PRICING_USD` (à mettre à jour quand Google change ses prix).

Pour un coût mini, utiliser `--model gemini-2.0-flash-lite` (~$0.10–0.15 pour 500 recettes) ou `--model gemini-2.0-flash` (~$0.40).

## Itération saisonnière

Quand la saison change ou que tu veux enrichir :

```bash
# Garde les recettes upvotées, ajoute 100 nouvelles d'automne-hiver
npm run seed -- --household HID --count 100 --saison automne-hiver
```

Le dédoublonnage évite les conflits avec les recettes existantes.

## Troubleshooting

### "GEMINI_API_KEY manquante"
Renseigne-la dans `scripts/seedRecipes/.env`. Récupère-la sur https://aistudio.google.com/apikey.

### "ECONNREFUSED localhost:1234"
LM Studio n'est pas démarré ou tourne sur un autre port. Vérifie l'onglet "Local Server".

### "Could not load default credentials"
Soit définis `GOOGLE_APPLICATION_CREDENTIALS` dans `.env`, soit lance `gcloud auth application-default login`.

### "Aucun profil dans households/{hid}/profils"
Crée d'abord les profils via le hub (`/parametres/profils`). Sans profil → aucune contrainte → l'outil perd son intérêt.

### Beaucoup de recettes rejetées par le validateur
Cela peut indiquer que :
- Un régime libre saisi dans le profil n'est pas mappé (ex: « pas de noix »). Le LLM tient compte du texte mais le validateur ne sait pas. Solution : ajouter le régime dans `constraints.ts:REGIME_INTERDITS`.
- Une aversion est très commune (ex: « tomate ») et le LLM a du mal à éviter sur certains styles. Solution : retirer l'aversion ou la passer en note.

Vérifie le détail dans les logs : `🚫 contrainte violée → "X" rejetée ("terme" dans "ingrédient")`.
