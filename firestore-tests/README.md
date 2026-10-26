# firestore-tests

Tests unitaires des règles de sécurité `../firestore.rules`, exécutés sur l'émulateur Firestore (Java 21 requis). Ce dossier n'est pas un workspace npm : il a ses propres dépendances.

Depuis la racine du dépôt, comme la CI (job `rules-tests` de `.github/workflows/ci.yml`) :

```bash
npm install --prefix firestore-tests
npx --yes firebase-tools@15.31.0 emulators:exec --only firestore --project demo-fh "npm test --prefix firestore-tests"
```

`demo-fh` est un projet de démonstration : l'émulateur ne touche à aucun projet réel.
