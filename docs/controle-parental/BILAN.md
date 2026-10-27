# Contrôle parental du PC des enfants : bilan

Branche `controle-parental`, 26–27.10.2026. Document public : aucun identifiant
réel ici (ils sont chez le propriétaire).

## Ce qui est fait

| Phase | Livré | Vérifié |
|---|---|---|
| 1. Schéma | `packages/controle-parental` : chemins, champs, valeurs, moteur exception > planning > défauts, conversion tolérante, lectures/écritures | Garde : un test échoue si un autre fichier écrit un nom stocké en dur |
| 2. Règles | Bloc racine `devices` dans `firestore.rules`, sans toucher l'existant | Tests émulateur autorisé/interdit (95/95 au 27.10) ; brèche plantée → les tests attendus échouent |
| 3. Simulateur | `scripts/simulateur-appareil.mjs`, mode « essai » du hub | Passe par les vraies règles ; écrit au format de l'agent réel |
| 4. Écran parent | Page `/pc`, carte Aujourd'hui, menu iPad/ordinateur | Voir phase 8 |
| 5. NextDNS | Fonction `nextdnsAppareil`, « Internet aujourd'hui », alerte de quota, listes | 20 tests (routes fermées, parents seuls, cache, quota) ; essai bout en bout contre `scripts/faux-nextdns.mjs` |
| 6. Bilan | Ce document, checklist contrat ↔ schéma | — |
| 7. Contrat réel | `schema.ts` aligné sur le contrat de l'agent (version 1, agent 1.0.0, 27.10) : chaque nom marqué [contrat] ou [hub] ; quatre modes, internet coupé, planning en plages, une seule exception avec le nom montré à l'enfant | Module 107 tests, règles 95/95, fonctions 85 |
| 8. Écran refait | Maquette A « le mode au centre » (validée le 27.10) : carte « Mode en cours », quatre modes, Verrouiller / Débloquer / Couper internet, Revenir à la normale, demandes (« Oui, 45 min »), journée en secondes, lignes repliées internet et site du prof, réglages (planning par plages, applis du catalogue, limites, nom montré à l'enfant, programmes inconnus) | Hub 302 tests (39 sur les phrases) ; parcours joué au format téléphone avec deux parents et le simulateur ; aucun mot technique à l'écran |

Docs : `COMPTE-APPAREIL.md`, `SIMULATEUR.md`, `NEXTDNS.md`. Les sources (brief,
prompt de l'agent, contrat) restent hors du dépôt : `sources/`, ignoré.

## Décisions d'écran (27.10)

- **Une seule décision à la fois** : choisir un mode, verrouiller, débloquer ou
  couper internet REMPLACE la décision en cours ; la feuille « Jusqu'à quand ? »
  le dit (« Remplace : … »). Accepter « plus de temps » garde le mode en cours.
- **« Jusqu'à ce que je change »** en tête de « Jusqu'à quand ? », pour toutes
  les décisions : échéance 01.01.2100 (`JUSQUA_NOUVEL_ORDRE_MS`, acceptée par le
  PC). Puis 30 min, 1 h, 2 h, « jusqu'au dîner » (heures de repas du foyer),
  « demain matin » pour verrouiller ou couper internet, et une heure libre.
- **Nom montré à l'enfant** : réglé par parent (`parentLabels`), saisi en
  reliant le PC puis dans les réglages ; « Un parent » à défaut.
- Pas d'emoji dans l'interface (icônes en trait) ; couleurs du thème du hub.
- Ce qui est affiché vient de la config (calcul immédiat du moteur) ; l'état du
  PC sert à dire ce qui diffère : code parent tapé sur le PC, « en cours
  d'application… » (≤ 3 min), changement pas encore pris, fermeture annoncée
  (`lockPendingAt`), réglage illisible, sauvegarde ratée ou de plus de 2 jours,
  horloge du PC fausse (> 5 min). Hors ligne au-delà de 10 min.

## Ce qui reste, dans l'ordre

1. **Pull request** : attendre la CI (jobs `build` et `rules-tests`), fusionner
   (propriétaire).
2. **Déployer** dans l'ordre fonctions → règles → hébergement (DESIGN.md).
   Nouvelle fonction : `nextdnsAppareil` (secret `NEXTDNS_API_KEY`). Vérifier
   ensuite qu'elle répond 401 sans connexion (403 = droit d'appel manquant, cf.
   le piège des callables neuves).
3. **Relier le PC** dans l'appli (fondateur, écran « PC des enfants ») :
   identifiant de l'appareil convenu avec l'agent, UID du compte du PC, nom
   montré à l'enfant pour chaque parent.
4. **Brancher l'agent réel** : passer son mode distant de `file` à `firestore`
   (contrat § 7.6) avec la configuration web publique du projet, l'identifiant
   de l'appareil et le compte du PC (mot de passe posé par le propriétaire, root
   seulement) — voir COMPTE-APPAREIL.md.
5. **Côté agent, à demander** : publier le catalogue d'applis dans
   `status/current.apps` (l'écran des réglages le lit déjà), écrire `deviceTime`
   et passer `lastSeen` à l'heure du serveur, afficher « jusqu'à nouvel ordre »
   pour une échéance ≥ 2100.
6. **Au bout de deux semaines** : regarder la jauge du filtre internet ; passer
   NextDNS en Pro si le mois approche la limite.

## Checklist : le contrat réel face au module

Faite le 27.10 : la référence est `packages/controle-parental/src/schema.ts`.
Pour toute évolution du contrat : corriger **ce seul fichier** (et
`conversion.ts` si une FORME change), puis
`node scripts/copier-controle-parental-functions.mjs`, tests du module, tests
émulateur ; le test de concordance règles ↔ schéma dira si `firestore.rules`
doit suivre.

### Chemins
- [x] Config `devices/{id}` ; identifiant convenu avec l'agent, jamais écrit dans le code.
- [x] État `devices/{id}/status/current`, un seul document, écrit toutes les 60 s.
- [x] Usage `devices/{id}/usage/{AAAA-MM-JJ}`, jour local, écrit toutes les 5 min, durées en secondes.
- [x] Demandes `devices/{id}/requests/{id}`, id choisi par l'agent (`AAAAMMJJ-HHMMSS-xxxx`).

### Config (écrite par les parents, lue par l'agent)
- [x] `schedule` : plages `[start, end[` par jour, réglant pc, internet et/ou
      mode ; une plage qui passe minuit appartient au jour où elle commence ;
      en cas de chevauchement, la plus restrictive gagne.
- [x] `defaults` : `{ pc, internet, mode }` (PC autorisé, internet filtré, Devoirs).
- [x] `override` : une seule exception, une seule échéance `until`, `by` = nom
      montré à l'enfant (≤ 60), `setAt` à l'heure du serveur.
- [x] Verrouillage « jusqu'à nouvel ordre » : échéance 2100, acceptée (l'agent
      ignore une exception sans échéance).
- [x] `resetLocalBefore` : « Revenir à la normale » annule aussi un code parent tapé sur le PC.
- [x] `schoolAllowlist` : domaines, sous-domaines inclus ; présent, il REMPLACE
      la liste du PC (`LISTE_ECOLE_INITIALE` à la création).
- [x] `apps { id: { allowed, category } }`, `categoryLimits { catégorie: minutes }`,
      `unknownExecutables` (`report` | `kill`).
- [x] Champs ajoutés par Family Hub (`householdId`, `parentLabels`, `updatedAt`,
      `updatedBy`) : ignorés par l'agent sans erreur.
- [ ] **Catalogue d'applis publié par l'agent** (`status/current.apps`) : prévu
      au contrat, pas encore écrit par l'agent (point 5 ci-dessus).

### État (écrit par l'agent)
- [x] Par dimension (`pc`, `internet`, `mode`) : valeur, `…Reason`, `…Source`,
      `…Until` ; `network` (filtrage réel), `summary`, `nextChange`,
      `lockPendingAt`, `configErrors`, `backup`, `lastSeen`, `version`.
- [x] Hors ligne : seuil 10 min (accepté).
- [ ] **Horloge** : `deviceTime` + `lastSeen` à l'heure du serveur — accepté,
      pas encore écrit par l'agent (point 5).

### Usage (écrit par l'agent)
- [x] Secondes : `sessionSeconds`, `activeSeconds`, `apps`, `appNames`,
      `categories` ; événements `deniedLaunches`, `parentCodeUses`,
      `unknownExecutables`, `blockedVpn`, `limitReached`.

### Demandes
- [x] `type` `time|site|app|mode|other`, `detail`, `message`, `durationMinutes`,
      `status` `pending|approved|denied|done`.
- [x] Un parent n'écrit que `status`, `response`, `handledBy`, `handledAt` ;
      l'effet d'une acceptation passe par la config, dans le même envoi.

### Sécurité
- [x] Appareil : lecture de sa config, écriture status/usage/requests ;
      parents : lecture de tout, écriture de la config et de la décision des
      demandes (tests émulateur).
- [x] Procédure du compte de l'appareil : COMPTE-APPAREIL.md.

## Limites connues
- Le rapport NextDNS se met à jour à l'ouverture de l'appli par un parent (au
  plus toutes les 5 minutes) : pas de tâche planifiée, pour ne pas en payer une
  de plus. Sans ouverture, l'alerte de quota attend.
- L'API NextDNS est publiée en « beta » ; un changement s'afficherait en « le
  filtre n'a pas pu être changé », le reste de l'écran continue.
- Les messages de confirmation du hub recouvrent 4 secondes le bas de la
  fenêtre « Jusqu'à quand ? » (composant Toast existant).
- Les heures de l'écran sont celles du téléphone du parent ; minuit à Zurich
  côté fonction, à une heure près les jours de changement d'heure.
- Inscription fermée dans Firebase : un futur invité devra être autorisé le
  temps de sa première connexion (COMPTE-APPAREIL.md).
- `tsc -b` en local peut se croire à jour (cache `.tsbuildinfo`) alors que le
  hub ne compile plus : vérifier avec `npx tsc -p tsconfig.app.json --noEmit`.
