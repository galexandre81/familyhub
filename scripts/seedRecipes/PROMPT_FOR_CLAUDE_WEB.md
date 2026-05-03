# Générer un JSON de recettes via Claude.ai (web)

Si tu veux **éviter l'API payante** et utiliser ton abonnement Claude Pro/Max, tu peux demander à Claude.ai de générer un fichier JSON de recettes que tu importeras ensuite via :

```powershell
npm run import -- --household HID --file recettes.json --repas dejeuner
```

Le script `import.ts` applique exactement les mêmes validations que le seed (contraintes profils, règles nutrition, dédoublonnage), donc la qualité du livre reste protégée.

---

## Prompt à coller dans Claude.ai

Adapte les variables `{...}` selon tes besoins, puis colle dans une nouvelle conversation Claude.ai (Sonnet 4.5 ou Opus 4.7 recommandés).

```
Tu es un chef cuisinier expérimenté. Génère 60 recettes pour un livre de recettes familial sous forme de JSON strict.

🚫 INGRÉDIENTS STRICTEMENT INTERDITS (JAMAIS dans les ingrédients) :
- coriandre
- courgette
{ajoute ici toutes tes aversions, séparées par tirets}

⚠️ RÈGLE D'OR : la recette finale doit être présentée comme si elle avait été conçue ainsi DÈS LE DÉPART. Tu ne mentionnes JAMAIS l'ingrédient interdit, JAMAIS la substitution, JAMAIS le mot "INTERDIT" ni "Substitution" — ni dans le nom, ni dans la description, ni dans les étapes. Si tu hésites, passe à une autre idée totalement différente.

⚖️ STRUCTURE DU REPAS (obligatoire pour déjeuners et dîners, pas pour petits-déjeuners) :
- 60% légumes / 22% protéines / 18% féculents
- Légumes prioritaires : brocoli, épinards, haricots verts, poivrons, choux, salades, asperges, champignons, aubergine, fenouil, céleri, concombre
- Carottes / betteraves OK mais minoritaires
- UNE SEULE source de féculents par repas (riz OU pâtes OU pain OU pommes de terre OU semoule OU quinoa, pas deux)
- Protéine obligatoire (viande, poisson, œufs, tofu, légumineuses)

VARIÉTÉ MAXIMALE :
- Pas deux fois le même plat
- Varie les styles : français, méditerranéen, italien, espagnol, grec, marocain, libanais, turc, indien, thaï, vietnamien, japonais, coréen, mexicain, péruvien, nordique
- Varie les protéines, les modes de cuisson, les textures

THÈMES À COUVRIR (équilibre) :
- 10 petits-déjeuners salés (œufs, tartines, du monde, batch)
- 4 petits-déjeuners sucrés
- 23 déjeuners (salades, bowls, méditerranéen léger, asiatique léger, soupes froides, wraps, poissons rapides, batch céréales, végétariens créatifs)
- 23 dîners (français revisité, méditerranéen, moyen-oriental, asiatique, indien, grillades, poissons, dimanche familial, mexicain)

FORMAT DE SORTIE — JSON STRICT, pas de markdown, pas de commentaires, pas de texte avant/après :

{
  "recettes": [
    {
      "nom": "Tajine d'agneau aux abricots",
      "description": "1-2 phrases d'intro mentionnant les ratios si pertinent",
      "portions": 4,
      "tempsPrepMinutes": 20,
      "tempsCuissonMinutes": 90,
      "difficulte": 2,
      "ingredients": [
        { "libelle": "Épaule d'agneau", "quantite": "800", "unite": "g", "rayon": "frais-boucherie" },
        { "libelle": "Abricots secs", "quantite": "150", "unite": "g", "rayon": "sec-epicerie" }
      ],
      "etapes": [
        { "ordre": 1, "description": "Découper l'agneau en cubes de 3cm.", "dureeMinutes": 0 },
        { "ordre": 2, "description": "Saisir 5 min puis mijoter 1h30.", "dureeMinutes": 90 }
      ],
      "tags": ["marocain", "mijoté", "épicé"],
      "saison": ["toutes"],
      "estBatch": false,
      "styleCulinaire": "marocain",
      "proteinePrincipale": "viande-rouge",
      "modeCuissonPrincipal": "mijote",
      "tempsTotal": "30-60min",
      "repas": "diner"
    }
  ]
}

Champs énumérés (utilise EXACTEMENT ces valeurs) :
- rayon : "frais-fruits-legumes" | "frais-laitier" | "frais-boucherie" | "frais-poissonnerie" | "sec-epicerie" | "surgele" | "boulangerie" | "autre"
- saison : array contenant "hiver" | "printemps" | "ete" | "automne" | "toutes"
- proteinePrincipale : "viande-blanche" | "viande-rouge" | "poisson" | "oeufs" | "legumineuses" | "tofu" | "fromage" | "aucune"
- modeCuissonPrincipal : "poele" | "four" | "vapeur" | "mijote" | "grillade" | "cru" | "wok" | "papillote"
- tempsTotal : "<15min" | "15-30min" | "30-60min" | ">60min"
- repas : "petit-dej-sale" | "petit-dej-sucre" | "dejeuner" | "diner" | "tout"
- difficulte : 1 | 2 | 3

Génère les 60 recettes en JSON. Pas de texte autour.
```

---

## Workflow

1. **Colle le prompt** dans Claude.ai → tu obtiens un gros bloc JSON
2. **Sauvegarde** dans un fichier local, ex `recettes-claude.json` :
   - Sur Windows : ouvre Notepad, colle, enregistre dans `C:\Users\guill\Desktop\family hub\scripts\seedRecipes\recettes-claude.json`
   - **Important** : pas de markdown ` ```json ` autour, juste le JSON brut
3. **Importe** :
   ```powershell
   cd "C:\Users\guill\Desktop\family hub\scripts\seedRecipes"
   npm run import -- --household 9mX8Ggp5bLDpPWGRnOQ7 --file recettes-claude.json --source "Claude.ai web - Sonnet 4.5"
   ```
4. **Va sur `/kitchen-buddy/livre`** pour voir le résultat

## Si Claude.ai te coupe la réponse à mi-JSON

Demande-lui « continue le JSON exactement où tu t'es arrêté, sans répéter, sans rien dire d'autre ». Concatène les morceaux dans Notepad. Vérifie que c'est bien un JSON valide (un site comme jsonlint.com peut t'aider) avant l'import.

## Avantages vs API

| Critère | API (`npm run seed`) | Claude.ai web (`npm run import`) |
|---|---|---|
| Coût | $3-15 selon modèle | 0€ (déjà payé via Pro/Max) |
| Vitesse | 10-15 min, échec sur erreurs réseau | Instantané une fois copié-collé |
| Qualité | Bonne (Haiku 4.5 → Opus 4.7) | Excellente (Sonnet 4.5/Opus 4.7 sur Claude.ai) |
| Volume | Illimité par run | ~60 recettes max par message Claude.ai |
| Reprise | Auto (dédoublonnage) | Manuel (relancer un autre prompt) |

Pour 500 recettes via Claude.ai web : 8-9 prompts de 60 recettes, à concaténer/importer.
