# Créer le compte Firebase d'un appareil piloté

Un appareil piloté (le PC des enfants) se connecte à Family Hub avec **son propre
compte Firebase Auth**, jamais avec une clé de compte de service : une telle clé
donnerait les droits d'administrateur sur tout le projet, et elle vivrait sur la
machine même qu'on cherche à contrôler.

Ce que ce compte peut faire est fixé par `firestore.rules` (bloc `devices`) :

| | Lire | Écrire |
|---|---|---|
| Sa config `devices/{id}` | oui | non |
| `status/current` | oui | oui (ce document seul) |
| `usage/{AAAA-MM-JJ}` | oui | oui (création, mise à jour) |
| `requests/{id}` | oui | création seule, statut « en attente » |
| Tout le reste (foyer, recettes, autres appareils) | non | non |

Le compte est reconnu par le champ `deviceUid` de la config : c'est un parent
qui l'y inscrit. Les noms exacts des champs sont dans
`packages/controle-parental/src/schema.ts`.

## 1. Fermer l'inscription, PUIS ouvrir la connexion par mot de passe

L'ordre compte (relevé le 26.10.2026) : activer d'abord le mot de passe
laisserait un moment où n'importe qui peut se créer un compte par l'API
publique. Un tel compte n'aurait accès à rien — les règles n'accordent jamais
rien sur la seule connexion, toujours par l'appartenance au foyer ou l'UID de
l'appareil — mais autant ne pas ouvrir la porte.

1. **Avant**, s'assurer que tous les membres ont déjà un compte (premier passage
   par Google fait) : ensuite, un **nouveau** compte Google ne pourra plus se
   connecter pour la première fois, même invité. Pour inviter quelqu'un plus
   tard : recocher l'inscription le temps de sa première connexion.
2. **Authentication** → **Settings** → **User actions** :
   - décocher **Enable create (sign-up)** ;
   - décocher **Enable deletion** (sinon le compte de l'appareil pourrait se
     supprimer lui-même ; le hub ne propose pas de suppression de compte).
   Les comptes des écrans de cuisine (`display:…`) n'en souffrent pas : la
   fonction `exchangeSetupToken` les crée par le SDK d'administration
   (`auth.createUser`), que ce réglage ne bloque pas.
3. **Authentication** → **Sign-in method** → **Adresse e-mail/Mot de passe** →
   activer (pas le « lien par e-mail »). Le hub, lui, continue de ne proposer que
   Google.

## 2. Créer le compte

**Authentication** → **Users** → **Add user** :

- **Adresse** : une adresse qui ne sert qu'à ça et n'a pas besoin d'exister,
  par exemple `pc-enfants@appareils.invalid`. Rien n'est envoyé à cette adresse.
- **Mot de passe** : long et aléatoire (au moins 32 caractères, généré, jamais
  réutilisé). Exemple pour en générer un : `openssl rand -base64 32`.

Noter l'**UID** du compte (colonne « User UID »).

## 3. Relier le compte à l'appareil

Dans Family Hub, un parent crée l'appareil et y colle l'UID (écran « PC des
enfants », réglages). L'identifiant de l'appareil (`devices/{id}`) est celui que
l'agent du PC lit : il est convenu avec lui, et n'apparaît pas dans le code.

## 4. Donner les identifiants à l'agent du PC

L'adresse et le mot de passe vont sur le PC, **lisibles par root seulement**
(fichier `chmod 600`, propriétaire root), jamais dans le compte de l'enfant.
L'agent se connecte par l'API REST d'authentification
(`accounts:signInWithPassword`), reçoit un
jeton d'une heure et un jeton de renouvellement, et parle à Firestore avec ce
jeton. Aucune clé d'administration n'est nécessaire.

**Clé d'API du PC** : pas la clé web du hub, restreinte aux sites du hub
(référents HTTP) et donc refusée au PC (403). Le PC a sa propre clé, sans
restriction d'application mais limitée à trois API : Identity Toolkit, Token
Service et Cloud Firestore (créée le 27.10.2026 ; son nom et sa valeur ne
sont pas dans ce dépôt). La sécurité vient des règles : la clé ne donne
aucun droit par elle-même.

## 5. Révoquer ou remplacer

- **Couper l'appareil tout de suite** : vider ou changer `deviceUid` dans sa
  config. Les règles refusent dès la requête suivante.
- **Désactiver le compte** : **Authentication** → **Users** → menu du compte →
  **Disable account**. Le jeton en cours peut encore servir jusqu'à une heure.
- **Changer le mot de passe** (s'il a pu être lu) : même menu → **Reset
  password**, puis le remettre sur le PC.

Si l'agent ne peut plus joindre Family Hub, le PC continue d'appliquer la
dernière configuration reçue : couper le compte ne débloque rien.
