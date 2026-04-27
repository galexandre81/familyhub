# MenuMaster — Cuisine iPad

Dashboard mural pour la cuisine, affiché en plein écran sur **iPad mini 1ère génération (iOS 9.3.6)**, en mode "Ajouter à l'écran d'accueil" (web app standalone).

3 zones :
- **Menu de la semaine** (lu depuis `public/data/menu-semaine.json`, cliquable → mode recette)
- **Météo locale** (Le Brassus, via Open-Meteo, sans clé)
- **Radio web** (presets France Inter / Info / Culture / Musique, RTS La 1ère, Couleur 3)

Mode recette : étapes en plein écran avec gros texte, minuteur intégré et alerte sonore en fin de cuisson.

---

## Stack

- HTML / CSS Flexbox / **JavaScript ES5 vanilla**
- Pas de framework, pas de build, pas de modules ES, pas de service worker
- Hébergement **Firebase Hosting**
- Icônes météo en SVG inline (générées dans `weather.js`)

Compatible Safari 9 (iPad mini 1) — pas de `fetch`, pas d'`async/await`, pas de CSS Grid, pas de variables CSS.

---

## Lancer en local

```bash
firebase serve
```

Puis ouvrir `http://localhost:5000` (ou l'IP locale depuis l'iPad sur le même Wi-Fi).

> Pour tester depuis l'iPad sans déployer, lancer `firebase serve --host 0.0.0.0` et viser `http://<IP-de-ton-PC>:5000`. Note : Open-Meteo et les flux radio restent en HTTPS, ils marcheront depuis l'iPad mais l'origine en HTTP en local peut bloquer certains tests — déployer sur Firebase est le plus fiable.

## Déployer

```bash
firebase login
firebase deploy --only hosting
```

Avant le premier deploy, vérifier que le project ID dans `.firebaserc` correspond à un projet Firebase existant (ou créer un projet sur https://console.firebase.google.com puis ajuster).

---

## Éditer le menu

Modifier `public/data/menu-semaine.json` :

- Champ `jours[]` : 7 entrées (un par jour). Chaque entrée a `jour`, `date` (ISO `YYYY-MM-DD`), `midi` et `soir`. Mettre `null` pour un repas absent.
- Champ `recettes` : dictionnaire `{ "id": { ... } }`. Les `id` référencés dans `jours` doivent exister ici.
- Format d'une recette : `nom`, `personnes`, `temps_min`, `niveau`, `ingredients[]`, `etapes[]`. Chaque étape a `texte` (string) et `duree_min` (number ou `null`). Si `duree_min` est défini, le bouton minuteur apparaît.

Le fichier est rechargé à chaque ouverture de page (cache busting avec `?t=timestamp`), pas besoin de redéployer pour voir les changements après refresh.

---

## Mode standalone iPad

Sur l'iPad :

1. Ouvrir l'URL Firebase dans Safari.
2. Bouton **Partager** → **Sur l'écran d'accueil**.
3. L'icône s'ajoute sur l'écran d'accueil (terracotta, couverts blancs).
4. Lancer l'app depuis l'icône → plein écran sans barre Safari.

À régler une fois sur l'iPad :

- **Réglages → Affichage et luminosité → Verrouillage automatique → Jamais** (l'iPad reste allumé tant qu'il est branché).
- **Accès guidé** (Réglages → Général → Accessibilité → Accès guidé) si tu veux verrouiller l'app pour empêcher les sorties accidentelles.

---

## Structure

```
public/
  index.html          # vue principale
  recipe.html         # mode cuisine
  manifest.json
  css/styles.css
  js/
    app.js            # horloge, chargement menu, glue
    weather.js        # Open-Meteo + icônes SVG
    radio.js          # lecteur audio + presets
    recipe.js         # étapes + minuteur
  data/menu-semaine.json
  icons/icon-180.png  # apple-touch-icon
firebase.json
.firebaserc
```

---

## Notes techniques

- **TLS** : Safari 9 ne parle pas TLS 1.3. Open-Meteo et les flux Radio France / SRG marchent en TLS 1.2, donc ok. Si un endpoint passe en TLS 1.3-only un jour, prévoir un proxy via Firebase Functions.
- **Audio iOS** : sur iOS, le minuteur ne sonne que si l'utilisateur a touché l'écran au moins une fois (politique d'auto-play). `recipe.js` débloque l'audio dès le premier `touchstart`.
- **Cache** : `firebase.json` désactive le cache pour `/data/**` pour que les modifs du JSON soient prises en compte sans redéploiement.

## Hors scope (plus tard)

- Authentification, génération auto du menu, liste de courses, capteur de présence, mode offline complet.
