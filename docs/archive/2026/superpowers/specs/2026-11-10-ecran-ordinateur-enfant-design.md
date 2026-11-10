# L'ordinateur d'un enfant comme second écran de cuisine

Date : 2026-11-10. Statut : validée par le propriétaire le 10.11.2026 (option « second écran »
retenue, carte « PC des enfants » cachée sur cet écran).

## Pourquoi

Une enfant du foyer (13 ans) veut voir les menus de la semaine et les recettes depuis son PC Linux
(Chrome, icône déjà sur son bureau). Elle n'a pas de compte Family Hub et n'en aura pas pour l'instant :
le rôle « enfant » n'existe que de nom (les règles Firestore donnent tout le foyer à tout membre,
les invitations ne créent que des parents, l'inscription Firebase est fermée). Lui ouvrir un
compte demanderait de réécrire les règles par collection et par rôle.

L'écran de cuisine, lui, est déjà en lecture seule par construction : un écran lit tuiles,
recettes, liste de courses, minuteurs et instantanés, et n'écrit qu'un vote de recette, un
minuteur ou la ville météo. Le tableau montre le menu de la semaine, la recette du jour, le
livre de recettes avec le parcours « Je cuisine seule » (fait pour une ado le 01.11), le mode
recette. Tout ce qu'elle demande, sans nouveau rôle ni nouvelle règle.

Ce qui manque : la page « iPad de cuisine » du hub ne gère qu'un seul écran. « Appairer l'iPad »
ré-appaire l'iPad de la cuisine ; un écran de type ordinateur est rangé dans « Anciens écrans à
supprimer ». Le reste (un instantané par écran, règles et suppression par écran, type `desktop`
dans les types) sait déjà vivre avec plusieurs écrans.

## Objectifs

1. Depuis la page « iPad de cuisine », ajouter, appairer, mettre à jour et supprimer un second
   écran « Ordinateur des enfants », sans toucher à l'appairage de l'iPad.
2. Cet écran affiche le même tableau que l'iPad (menu de la semaine, recette du jour, livre,
   agenda, météo, minuteurs, radio).
3. Sur cet écran, la carte « PC des enfants » et son rapport ne s'affichent pas : l'enfant n'y
   voit ni son temps, ni ses demandes et vos réponses, ni ses sites bloqués (décision du
   propriétaire : l'écran de cuisine est un outil de parents ; la transparence passe par la
   fenêtre « Mon temps » du PC).

## Hors périmètre

- Un compte ou un rôle « enfant » dans Family Hub (voir la dette ci-dessus).
- Changer les règles Firestore ou les fonctions : aucune modification. L'écran de l'enfant a
  exactement les droits d'un écran de cuisine.
- Cacher la liste de courses ou les minuteurs sur cet écran (identique à l'iPad).
- La configuration du PC lui-même (liste du mode devoirs, icône de bureau) : faite par le
  propriétaire, procédure dans la PR.

## Ce qui serait un échec, même si ça marche

- L'iPad de la cuisine déconnecté (« Écran appairé ailleurs ») après l'appairage du PC.
- Le PC de l'enfant listé dans « Anciens écrans » avec un bouton Supprimer, ou pris pour l'iPad
  (« la tablette modifiée le plus récemment »).
- La carte « PC des enfants » visible sur l'écran de l'enfant, même brièvement au chargement.
- Une régression sur l'iPad mini (Safari 9) : le tableau de l'iPad ne change pas.

## Décisions

- **Nom et type** : un écran `nom: "Ordinateur des enfants"`, `type: "desktop"`, résolution
  1280 × 800, même `gridConfig` que l'iPad (sans effet : le tableau est fixe). Un seul écran de
  ce type est géré par la page (le plus récemment modifié) ; un second serait un « ancien écran ».
- **Contenu** : à la création, la liste de sources de l'écran est calculée par `layoutCuisine`
  à partir des tuiles existantes du foyer (celles de l'iPad) ; les tuiles manquantes sont créées
  comme pour l'iPad (« Préparer »).
- **Appairage** : même mécanisme (`createDisplayToken`, code à six caractères, lien `/d/…`),
  même fenêtre, dont les phrases s'adaptent à la cible : pour un ordinateur, « dans Chrome, sur
  l'ordinateur de l'enfant », pas de QR code (pas d'appareil photo).
- **Carte cachée** : l'écran lit déjà son propre document (`state.displayConfig`) ; le tableau
  reçoit l'écran dans son contexte et une fonction pure `montrerCartePc(ecran)` renvoie faux
  pour `type === "desktop"`. La carte n'est alors pas montée et le module `FamilyHubPc` n'est
  pas démarré (aucune lecture des documents du PC depuis cet écran). Ce n'est pas une règle de
  sécurité : l'écran garde le droit de lire ces documents, comme l'iPad.
- **« Mettre à jour »** rafraîchit tous les écrans du foyer (comportement existant).
- **Supprimer** passe par la fonction `deleteDisplay` existante (révocation réelle).

## Vérification

- Tests du hub (logique de choix des écrans, phrases de la fenêtre d'appairage).
- Test de l'iPad en vm (`montrerCartePc`), `check:display` (ES5).
- Parcours joué dans Chromium : ajouter l'ordinateur, voir l'iPad toujours « Appairé », ouvrir
  `/d/<code>` dans un second navigateur, tableau sans carte « PC des enfants » ; l'iPad (ou le
  simulateur Chromium 1024 × 768) garde la carte.
- Les règles ne changent pas : la suite `firestore-tests` n'est pas touchée.

## Côté propriétaire, après déploiement

1. Réglages du PC des enfants : ajouter le domaine du site (`<projet>.web.app`) et
   `cloudfunctions.net` à la liste du mode devoirs (`googleapis.com` et `gstatic.com` y sont déjà).
2. Page « iPad de cuisine » : « Ajouter l'ordinateur des enfants », puis « Relier », et ouvrir
   le lien `/d/<code>` dans Chrome sur son PC. Si un écran y apparaît déjà comme relié (un
   ordinateur appairé avant la refonte), le retirer d'abord.
3. Faire pointer l'icône de son bureau vers `https://<projet>.web.app/display/`.
