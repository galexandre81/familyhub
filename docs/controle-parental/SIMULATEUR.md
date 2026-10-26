# Simulateur du PC des enfants

Pour développer et tester l'écran parent **sans le vrai PC** : un script joue le
rôle de l'appareil contre les émulateurs Firebase locaux. Rien ne touche la vraie
base : tout se passe dans le projet `demo-fh`, qui n'existe pas chez Google.

Prérequis : Java 21 (émulateur Firestore) et le CLI Firebase.

## Démarrer

Trois terminaux, depuis la racine du dépôt :

```bash
# 1. Les émulateurs (Auth + Firestore). Les données sont perdues à l'arrêt.
npm run emulateurs:essai

# 2. Le hub branché sur les émulateurs (http://localhost:5173)
npm run dev:hub:essai

# 3. Le simulateur (voir les commandes ci-dessous)
npm run simulateur -- <commande>
```

Le mode « essai » du hub (`apps/hub/.env.essai`) ne vaut qu'en développement :
le build de production ne contient ni l'adresse des émulateurs ni `demo-fh`.

## Avec le filtre internet (NextDNS), sans compte ni clé réels

`scripts/faux-nextdns.mjs` répond aux seules routes que la fonction
`nextdnsAppareil` appelle, garde ses listes en mémoire et refuse toute requête
sans la clé d'essai. Il faut alors aussi l'émulateur des fonctions :

```bash
# Une fois : deux fichiers locaux, ignorés par git, lus par l'émulateur seul
echo NEXTDNS_API_KEY=cle-emulateur > functions/.secret.local
echo NEXTDNS_BASE_EMULATEUR=http://127.0.0.1:7777 > functions/.env.local

npm run build:functions
node scripts/faux-nextdns.mjs --requetes 48000      # 246000 : déclenche l'alerte du quota
firebase emulators:start --only auth,firestore,functions --project demo-fh
```

`preparer` pose le profil NextDNS d'essai de l'appareil. L'adresse du faux
NextDNS n'est prise en compte que dans l'émulateur (`FUNCTIONS_EMULATOR`) : en
production, la fonction ne parle qu'à `api.nextdns.io`.

## Première fois (à refaire à chaque redémarrage des émulateurs)

1. Dans le hub, **se connecter avec Google** : l'émulateur affiche une fausse
   fenêtre Google. « Add new account », par exemple `parent-a@test.local`.
   Recommencer dans une fenêtre privée avec `parent-b@test.local` (le second
   parent), et si besoin `enfant@test.local`. Ne pas créer de foyer.
2. Préparer le foyer d'essai et l'appareil :

   ```bash
   npm run simulateur -- preparer --parent parent-a@test.local --parent parent-b@test.local --enfant enfant@test.local
   ```

   Le premier parent est le fondateur du foyer (les réglages lui sont réservés à
   l'écran). L'appareil `pc-essai` reçoit le planning par défaut, dix applis et
   une liste école de départ, et son propre compte (`appareil-essai@appareils.invalid`).
3. Recharger le hub.

## Commandes

| Commande | Effet |
|---|---|
| `jouer` | Le PC tourne : lit sa config en direct, écrit son état et son temps d'écran à chaque tour. Ctrl+C pour l'arrêter. |
| `jouer --heure 21:27 --vitesse 60 --rythme 2` | Même chose, en partant de 21h27, une minute simulée par seconde : on voit le verrouillage de 21h30 en quelques secondes. |
| `journee` | Écrit d'un coup une journée réaliste (2h35 de PC, cinq applis, deux lancements refusés). |
| `demande temps` · `demande site` · `demande appli` | Le bouton « Demander » du PC (`--cible`, `--message` pour changer l'exemple). |
| `refus [idAppli]` | Un lancement d'appli refusé, maintenant. |
| `hors-ligne --depuis 3h` | Le PC se tait : dernier signe de vie il y a 3 h. Ne pas relancer `jouer` pendant le test. |
| `etat [--heure 21:45]` | Ce que le PC appliquerait, et le prochain changement. |

Toutes acceptent `--appareil <id>` (défaut `pc-essai`).

## Ce que le simulateur prouve, et ce qu'il ne prouve pas

- Côté appareil, il se connecte avec **son propre compte** et passe par les
  vraies règles Firestore : une écriture refusée s'affiche « Écriture refusée ».
  Seul `preparer` utilise les droits d'administration, sur l'émulateur.
- Il calcule l'état avec le **même moteur** que l'écran parent
  (`@family-hub/controle-parental`) : il ne vérifie donc pas l'agent réel du PC,
  seulement que Family Hub et le contrat se comprennent. Le moteur de l'agent
  est l'autre moitié, à confronter au contrat (`CONTRAT-FAMILY-HUB.md`).
- `--heure` et `--vitesse` décalent l'heure **du simulateur seul**. Une exception
  posée depuis le hub porte une échéance réelle : pour tester « débloqué jusqu'à
  23h » à 22h, poser l'exception pour aujourd'hui puis lancer
  `jouer --heure 22:00`.
