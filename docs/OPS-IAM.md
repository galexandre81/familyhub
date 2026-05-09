# OPS — IAM bindings sur Cloud Functions v2

## Le piège connu

Les Cloud Functions v2 (onCall) sont déployées sous le capot comme des services Cloud Run. Quand le code source déclare `invoker: "public"` :

```ts
export const refreshDisplayToken = onCall(
  { region: "europe-west1", invoker: "public" },
  async (req) => { ... }
);
```

Firebase CLI EST CENSÉ ajouter automatiquement le binding IAM :

```
roles/run.invoker → allUsers
```

…sur le service Cloud Run correspondant. **Mais ça rate parfois silencieusement** (race ou bug selon la version de firebase-tools). Le code prétend être public, le déploiement réussit, mais Cloud Run rejette toute requête au niveau réseau (avant même d'atteindre la fonction). Le SDK client voit `internal` ou `unauthenticated`.

C'est arrivé sur `refreshDisplayToken` — résolu manuellement le 2026-05-09. Symptôme côté iPad : badge auth en cycle "↻ try N · internal" toutes les ~50 min, jamais résolu sans reload.

## Diagnostic

### Vérifier le binding sur une fonction

```powershell
gcloud run services get-iam-policy <function-name-lowercase> `
  --region=europe-west1 `
  --project=family-hub-guillaume
```

Une fonction publique correctement bindée doit retourner :

```yaml
bindings:
- members:
  - allUsers
  role: roles/run.invoker
etag: ...
```

Si le binding est manquant (`etag: ACAB` seul), Cloud Run rejette tout.

### Vérifier les logs de la fonction

```powershell
firebase functions:log --only <functionName> --lines 30
```

Si tu vois plein de :

```
W <functionname>: The request was not authenticated. Either allow unauthenticated
invocations or set the proper Authorization header. Empty Authorization header value.
```

→ binding manquant.

### Comparer avec une fonction qui marche

Toutes les fonctions déclarant `invoker: "public"` dans le source devraient avoir le même binding. Pour un audit groupé :

```powershell
$funcs = @("createdisplaytoken","resolvesetupshortid","exchangesetuptoken",
           "refreshdisplaytoken","synccalendartile","refreshweathertile")
foreach ($f in $funcs) {
  Write-Host "=== $f ===" -NoNewline
  $out = gcloud run services get-iam-policy $f --region=europe-west1 `
           --project=family-hub-guillaume --format="value(bindings.members)" 2>$null
  if ($out) { Write-Host " -> $out" } else { Write-Host " -> MISSING binding" }
}
```

## Fix

### Re-binding manuel (recommandé)

```powershell
gcloud run services add-iam-policy-binding <function-name-lowercase> `
  --member=allUsers `
  --role=roles/run.invoker `
  --region=europe-west1 `
  --project=family-hub-guillaume
```

Effet immédiat, pas besoin de redéployer.

### Re-déploiement (peut suffire mais pas garanti)

```powershell
firebase deploy --only functions:<functionName>
```

Le CLI tente de re-poser le binding. Si ça rate à nouveau (le bug peut se reproduire), retomber sur le manual gcloud ci-dessus.

## Quand c'est important

À chaque déploiement Cloud Functions, **vérifier les bindings des fonctions publiques** avec le script d'audit ci-dessus. Si tu en perds une, l'iPad cesse de pouvoir refresh son auth → badge en cycle.

Liste actuelle des fonctions publiques (devraient toutes avoir `allUsers` → `run.invoker`) :

| Fonction | Pourquoi publique |
|---|---|
| `createdisplaytoken` | Hub web déclenche la création de short ID, pas authentifié à ce stade |
| `resolvesetupshortid` | iPad résout le code à 6 chars, pas encore authentifié |
| `exchangesetuptoken` | iPad exchange le setup token contre un custom token, pas encore authentifié |
| `refreshdisplaytoken` | iPad refresh sa session toutes les ~50 min via authToken local |
| `synccalendartile` | Fonction `onCall` invoquée depuis le hub authentifié — la check d'auth est dans le code (assertHouseholdMember) |
| `refreshweathertile` | Idem |

Pour les fonctions `synccalendartile` et `refreshweathertile`, "public" au sens Cloud Run signifie "le SDK client peut atteindre l'endpoint" ; l'authentification réelle est faite par le code de la fonction qui vérifie `req.auth?.uid`. Pour `createdisplaytoken`/`resolvesetupshortid`/`exchangesetuptoken`/`refreshdisplaytoken`, "public" signifie pas d'auth Firebase requise (l'auth se fait via setupToken/authToken applicatif).
