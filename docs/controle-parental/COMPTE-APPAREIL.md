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

## 1. Activer la connexion par adresse et mot de passe (une fois)

Console Firebase → **Authentication** → **Sign-in method** → **Adresse e-mail/Mot
de passe** → activer (pas le « lien par e-mail »).

Le hub, lui, continue de ne proposer que Google : il n'a aucun écran
d'inscription. Mais l'API publique permettrait à n'importe qui de se créer un
compte. Un tel compte n'aurait accès à rien (les règles le refusent partout,
comme aujourd'hui un compte Google inconnu). Pour fermer quand même la porte,
une fois le compte de l'appareil créé :
**Authentication** → **Settings** → **User actions** → décocher **Enable create (sign-up)**.

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
(`accounts:signInWithPassword`, avec la clé web publique du projet), reçoit un
jeton d'une heure et un jeton de renouvellement, et parle à Firestore avec ce
jeton. Aucune clé d'administration n'est nécessaire.

## 5. Révoquer ou remplacer

- **Couper l'appareil tout de suite** : vider ou changer `deviceUid` dans sa
  config. Les règles refusent dès la requête suivante.
- **Désactiver le compte** : **Authentication** → **Users** → menu du compte →
  **Disable account**. Le jeton en cours peut encore servir jusqu'à une heure.
- **Changer le mot de passe** (s'il a pu être lu) : même menu → **Reset
  password**, puis le remettre sur le PC.

Si l'agent ne peut plus joindre Family Hub, le PC continue d'appliquer la
dernière configuration reçue : couper le compte ne débloque rien.
