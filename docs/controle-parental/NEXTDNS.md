# NextDNS dans Family Hub

**État (26.10.2026) : implémenté et essayé contre un faux NextDNS, NI déployé NI
branché sur le vrai compte.** Code : `functions/src/controleParental/`
(fonction `nextdnsAppareil`), écran `apps/hub/src/components/pcEnfants/`
(InternetDuJour, ListesDeSites). Essai local : SIMULATEUR.md.

Objectif : afficher dans Family Hub les sites visités et bloqués par le PC des
enfants, et bloquer ou débloquer un site précis, sans que la clé NextDNS
n'atteigne jamais le navigateur ni le PC. Sources : documentation de l'API
(https://nextdns.github.io/api/, « beta ») et page des prix, lues le 26.10.2026.

## Mise en service (propriétaire)

Décision du 26.10.2026 : **un compte NextDNS séparé, avec un seul profil, celui
du PC**. Une fuite de clé ne toucherait que ce profil, et la jauge ne compte que
ce PC (la limite gratuite est par compte).

1. Créer le compte et son profil ; y régler une fois les catégories (adulte,
   jeux d'argent, malveillants), SafeSearch, YouTube restreint ; **activer les
   journaux** (stockage Europe ou Suisse, 1 à 3 mois). Donner l'ID du profil à
   l'agent du PC.
2. Poser la clé : `firebase functions:secrets:set NEXTDNS_API_KEY --project <projet>`.
3. Console Firestore : créer `devices/<id du PC>/private/nextdns` avec le champ
   `profileId` = l'ID du profil (noms : `CHAMP_PRIVE_NEXTDNS` dans
   `packages/controle-parental/src/schema.ts`). Aucune règle ne l'ouvre aux
   navigateurs : seule la fonction le lit.
4. Déployer : fonctions, puis règles, puis hébergement (ordre de DESIGN.md).

## Deux faits qui décident de l'architecture

1. **La clé API ouvre tout le compte NextDNS.** Elle n'a pas de portée : qui la
   détient peut lire tous les profils, désactiver les filtres, supprimer un
   profil. Elle vit donc dans un secret de fonction serveur, et la fonction
   n'appelle qu'une liste fermée de routes.
2. **Au-delà de 300 000 requêtes par mois, l'offre gratuite cesse de filtrer**
   (« continue de répondre comme un DNS classique non bloquant »). Un PC avec
   Chrome peut atteindre ce volume : le filtre adulte, SafeSearch et YouTube
   restreint tomberaient alors sans que personne ne le voie.

## Prérequis (côté propriétaire, avant toute implémentation)

| Prérequis | Pourquoi | Coût |
|---|---|---|
| **NextDNS gratuit, puis Pro si la mesure l'exige** (décision du 26.10.2026) | Fait 2 : on commence gratuit et on mesure ; la jauge ci-dessous prévient avant la limite | 0, puis ~2 CHF / mois |
| **Un profil NextDNS réservé au PC** | Les listes de sites sont par profil : débloquer un site pour le PC ne doit le débloquer pour personne d'autre ; le rapport ne montre alors que ce PC | 0 |
| Recommandé : **un compte NextDNS séparé** pour ce profil | Fait 1 : une fuite de clé ne toucherait que ce profil, pas les autres réglages de la famille | 0 (un seul compte Pro suffit si on garde le compte actuel) |
| **Journaux activés** sur ce profil (stockage Europe ou Suisse, conservation 1 à 3 mois) | Sans journaux, pas de rapport des sites | 0 |
| **Clé API** posée en secret : `firebase functions:secrets:set NEXTDNS_API_KEY --project <projet>` | Jamais dans le code, le navigateur ou le PC | Secret Manager : gratuit jusqu'à 6 versions actives |
| Offre Firebase **Blaze** | Déjà active (le projet a 22 fonctions) | Appels de fonctions : largement dans le gratuit |

## Architecture

```
Téléphone (parent)                 Cloud Function (europe-west1)            NextDNS
  écran « PC des enfants »  ──►  nextdnsAppareil (callable)          ──►  api.nextdns.io
       │  appel signé               1. vérifie : connecté, parent du          (clé X-Api-Key,
       │  (jeton Firebase)             foyer de l'appareil (même règle         secret serveur)
       │                               que firestore.rules)
       │                            2. lit le profil NextDNS de l'appareil
       │                               dans devices/{id}/prive/nextdns
       │                               (aucune règle ne l'ouvre : Admin seul)
       │                            3. n'appelle QUE :
       │                               GET  analytics/domains (visités, bloqués)
       │                               POST/DELETE allowlist, denylist
       ◄──  rapport, ou « fait »    4. écrit le rapport du jour dans
                                       devices/{id}/sites/{AAAA-MM-JJ}
                                       (parents en lecture) et journalise
                                       qui a bloqué ou débloqué quoi
```

- **Une seule fonction appelable** avec quatre actions : `rapport`, `debloquer`
  (liste blanche NextDNS), `bloquer` (liste noire), `retirer`. Chaque domaine
  passe par `normaliserDomaine` du module. Aucune autre route NextDNS n'est
  joignable, même par un parent : pas de modification de profil ni de
  suppression.
- **Rapport mis en cache** dans Firestore : la page lit le document du jour
  (comme le reste de l'écran, temps réel et hors ligne) ; la fonction ne
  rappelle NextDNS que si le rapport a plus de 5 minutes. Le PC n'y a aucun
  accès (règles : parents seulement).
- **Ce qu'on montre** : les domaines « racine » (`root=true`), visités et
  bloqués, avec le nombre de visites. Pas de date à la seconde, pas de
  recherche : on mesure les domaines, jamais le contenu (principe du brief).
- **Mode école et NextDNS sont indépendants** : le mode école est appliqué par
  l'agent du PC (liste blanche locale) ; NextDNS filtre tout le reste du temps.
  « Le prof demande ce site » ajoute le site à la liste école (déjà fait) et,
  s'il apparaît dans les sites bloqués du jour, propose « Le débloquer aussi
  en temps normal » (liste blanche NextDNS).

## Jauge du quota (tant que le compte est en gratuit)

La limite des 300 000 requêtes vaut pour **le compte**, tous profils confondus.
Le rapport (`analytics/status` depuis le 1er du mois, sommé sur les profils du
compte) donne le total du mois ; les réglages du fondateur affichent « N
requêtes ce mois-ci sur 300 000 », et une alerte à 70 % laisse le temps de
passer en Pro avant que le filtrage ne s'arrête. Une requête n'est pas une page :
Chrome en fait plusieurs par page, et les mises à jour du PC passent aussi par
NextDNS. Sans code, le tableau de bord NextDNS donne le même chiffre.

## Ce que l'écran gagne

- La journée : « Sites les plus visités » et « Sites bloqués » (avec « Débloquer »).
- Une demande « Le site … » acceptée : liste école **et** liste blanche NextDNS.
- Réglages (fondateur) : sites toujours bloqués, sites toujours autorisés.

## Hors périmètre, et pourquoi

- Le flux en direct (`logs/stream`) : inutile pour un bilan de journée, et il
  garderait une fonction allumée en permanence.
- Les réglages de fond (catégories, SafeSearch, YouTube restreint) : le brief
  les règle une fois à la main dans NextDNS ; les exposer ouvrirait la porte
  qu'on ferme au fait 1.
