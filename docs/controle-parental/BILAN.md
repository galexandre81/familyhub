# Contrôle parental du PC des enfants : bilan (phase 6)

Branche `controle-parental`, 26.10.2026. Document public : aucun identifiant
réel ici (ils sont chez le propriétaire).

## Ce qui est fait

| Phase | Livré | Vérifié |
|---|---|---|
| 1. Schéma | `packages/controle-parental` : chemins, champs, valeurs, moteur exception > planning > défauts, conversion tolérante, lectures/écritures | Garde : un test échoue si un autre fichier écrit un nom stocké en dur |
| 2. Règles | Bloc racine `devices` dans `firestore.rules`, sans toucher l'existant | 35 tests émulateur autorisé/interdit + 53 existants ; brèche plantée → les tests attendus échouent |
| 3. Simulateur | `scripts/simulateur-appareil.mjs`, mode « essai » du hub | Passe par les vraies règles ; 21h30, 22h30, 7h observés |
| 4. Écran parent | Page `/pc`, carte Aujourd'hui, menu iPad/ordinateur | Parcours joué au format téléphone (deux parents) ; aucun mot technique ; un défaut trouvé et corrigé |
| 5. NextDNS | Fonction `nextdnsAppareil`, « Internet aujourd'hui », alerte de quota, listes | 20 tests (routes fermées, parents seuls, cache, quota) ; essai bout en bout contre `scripts/faux-nextdns.mjs` |

Docs : `COMPTE-APPAREIL.md`, `SIMULATEUR.md`, `NEXTDNS.md`. Les sources (brief,
prompt de l'agent, futur contrat) restent hors du dépôt : `sources/`, ignoré.

## Ce qui reste, dans l'ordre

1. **L'autre parent rejoint le foyer** par son lien d'invitation (`/rejoindre/<code>`).
2. **Pousser la branche, ouvrir la pull request**, attendre la CI (jobs `build`
   et `rules-tests`), fusionner (propriétaire).
3. **Déployer** dans l'ordre fonctions → règles → hébergement (DESIGN.md).
   Nouvelle fonction : `nextdnsAppareil` (secret `NEXTDNS_API_KEY`). Vérifier
   ensuite qu'elle répond 401 sans connexion (403 = droit d'appel manquant, cf.
   le piège des callables neuves).
4. **Relier le PC** dans l'appli (fondateur, écran « PC des enfants ») :
   identifiant de l'appareil convenu avec l'agent + UID du compte du PC.
5. **Brancher l'agent réel** : lui transmettre la configuration web publique du
   projet, l'identifiant de l'appareil, l'adresse du compte du PC (le mot de
   passe, le propriétaire le pose lui-même, root seulement) — voir
   COMPTE-APPAREIL.md.
6. **Confronter le contrat** (CONTRAT-FAMILY-HUB.md) avec la checklist ci-dessous,
   ajuster `schema.ts`, relancer les tests, redéployer.
7. **Au bout de deux semaines** : regarder la jauge du filtre internet ; passer
   NextDNS en Pro si le mois approche la limite.

## Checklist : le contrat réel face au module

Pour chaque ligne : lire le contrat, comparer à `packages/controle-parental/src/schema.ts`
(marques [brief] / [supposé] / [hub]), corriger **ce seul fichier** (et
`conversion.ts` si une FORME change), puis :
`node scripts/copier-controle-parental-functions.mjs`, tests du module, tests
émulateur, et le test de concordance règles ↔ schéma dira si `firestore.rules`
doit suivre.

### Chemins
- [ ] Config : `devices/{id}` ? Identifiant de l'appareil ?
- [ ] État : `devices/{id}/status/current` ? Un seul document ?
- [ ] Usage : `devices/{id}/usage/{AAAA-MM-JJ}` ? Jour en heure locale ou UTC ?
- [ ] Demandes : `devices/{id}/requests/{id}` ? Id choisi par l'agent ou automatique ?

### Config (écrite par les parents, lue par l'agent)
- [ ] `schedule` : forme exacte. Supposé : clés `sun`…`sat`, `{ lockFrom, lockUntil }`
      "HH:MM", créneau rattaché au soir où il commence, `null` = pas de verrou.
- [ ] `defaults` : `{ pc, internet }` ?
- [ ] `override` : `{ pc?, internet?, until, by }` — une seule échéance pour les
      deux dimensions ? (Family Hub : une décision remplace la précédente ; seule
      l'acceptation de « plus de temps » fusionne.) `until` en Timestamp ?
- [ ] **Verrouillage « jusqu'à ce qu'un parent le déverrouille »** (décision du
      26.10) : écrit comme une exception `pc: locked` d'échéance 01.01.2100
      (`JUSQUA_NOUVEL_ORDRE_MS`), pour qu'un agent qui exige une échéance
      verrouille quand même. Le contrat prévoit-il mieux (échéance absente) ?
- [ ] `schoolAllowlist` : domaines nus ; sous-domaines inclus implicitement ?
      (Family Hub retire seulement « www. ».)
- [ ] `apps` : `{ id: { allowed, category, label? } }` — format des ids (binaire,
      id Flatpak) ? `label` lu ou ignoré ?
- [ ] `categoryLimits` : supposé `{ categorie: { enabled, minutesPerDay } }`.
- [ ] Valeurs : `allowed|locked`, `filtered|school`, catégories supposées
      `school|creative|game|other`.
- [ ] L'agent tolère-t-il les champs ajoutés par Family Hub : `householdId`,
      `deviceUid`, `name`, `updatedAt`, `updatedBy` ? (Il doit les ignorer.)
- [ ] **TROU : qui remplit la liste des applis ?** L'agent ne peut pas écrire la
      config (règles). Proposer au contrat un catalogue publié par l'agent (par
      exemple dans `status/current` : applis installées, nom lisible, catégorie
      proposée), que l'écran des réglages présente au parent.

### État (écrit par l'agent)
- [ ] Champs : `pc`, `internet`, `reason`, `lastSeen`, `version` ? Valeurs de
      `reason` (supposé `override|schedule|default|parentCode`) ?
- [ ] Cadence d'écriture → régler `SEUIL_HORS_LIGNE_MS` (10 min supposées,
      `apps/hub/src/lib/controleParental/phrases.ts`).
- [ ] **Horloge du PC** (question du 26.10) : proposer au contrat que l'agent
      écrive aussi son heure locale (`deviceTime`) et que `lastSeen` soit l'heure
      du serveur (`serverTimestamp`) — les règles peuvent l'imposer
      (`== request.time`). L'écran signalerait « L'heure du PC est fausse » au-delà
      de quelques minutes d'écart.

### Usage (écrit par l'agent)
- [ ] Supposé : `sessionMinutes`, `appMinutes { id: minutes }`,
      `deniedLaunches [{ app, at }]`, `parentCodeUses [{ at }]`, `updatedAt`.
- [ ] Minutes entières ou secondes ?

### Demandes
- [ ] Supposé : `type` (`time|site|app`), `message`, `target` (domaine ou id
      d'appli), `createdAt`, `status` (`pending|accepted|refused`).
- [ ] Champs posés par le parent : `decidedBy`, `decidedAt`, `grantedUntil` —
      l'agent les lit-il ? Que fait-il d'une demande acceptée (rien : l'effet
      passe par la config) ?

### Sécurité
- [ ] Le contrat demande-t-il autre chose que : appareil = lecture de sa config,
      écriture status/usage/requests ; parents = lecture de tout, écriture de la
      config et de la décision des demandes ?
- [ ] Procédure de création du compte de l'appareil : identique à
      COMPTE-APPAREIL.md ?

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
