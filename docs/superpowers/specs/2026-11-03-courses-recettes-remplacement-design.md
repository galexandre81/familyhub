# Courses : voir les repas d'un article et noter un remplacement

Date : 2026-11-03. Statut : validée par le propriétaire le 03.11.2026.

## Pourquoi

Au moment de faire les courses, on veut parfois remplacer un article. Pour décider, il faut savoir où il
sert : quelles recettes, quel jour, quel repas, quelle quantité. Aujourd'hui, il faut rouvrir le menu et
chercher à la main. Une fois le remplacement décidé, celui qui cuisine doit le retrouver dans la recette.

Le besoin est réel : sur la liste de la semaine mesurée, un tiers des articles servent à au moins deux recettes.

## Objectifs

1. Depuis un article de la liste, voir d'un geste les repas de la semaine qui l'utilisent.
2. Pouvoir, **sans obligation**, noter un remplacement de cet article.
3. Retrouver ce remplacement sur la liste et dans les recettes concernées, téléphone, PC et iPad.

## Hors périmètre

- Remplacer un ingrédient pour une seule recette : **un remplacement vaut pour toutes les recettes de l'article**
  (décision du propriétaire).
- Modifier la fiche d'une recette du livre. Un remplacement ne vaut que pour la semaine.
- Réécrire le texte des étapes.
- Suggérer des remplacements, recalculer une quantité ou une valeur nutritive.
- Utiliser un LLM côté serveur (décision 0002).

## Ce qui serait un échec, même si ça marche

- Une quantité fausse affichée avec assurance : mieux vaut pas de quantité.
- Une coche déclenchée par erreur en voulant ouvrir le panneau.
- Un remplacement de cette semaine qui ressort sur la fiche du livre la semaine suivante.
- Un champ de remplacement qui donne l'impression qu'il faut le remplir pour consulter.
- Un panneau qui ne s'ouvre pas en magasin, sans réseau.

## Comportement

### Le bouton sur la liste

Chaque article issu du menu porte, en bout de ligne, un bouton qui affiche le nombre de repas : « 1 repas »,
« 2 repas ». Il apparaît en mode Trier et en mode Magasin, sur téléphone et sur les colonnes du PC
(Trier, Drive, Magasin). Il est distinct de la zone qui coche.

Un article ajouté à la main sans recette d'origine n'a pas ce bouton : pas de panneau, donc pas de remplacement.

Si un article est relié à une recette qui n'est plus dans aucun repas ni batch (cas théorique, aucun mesuré),
le panneau affiche le nom de la recette avec « Pas prévue dans le menu ». Elle ne compte pas dans le nombre
du bouton. Si aucun repas n'est trouvé, le bouton affiche « Voir ».

### Le panneau

Il monte du bas sur téléphone et s'affiche en fenêtre centrée sur PC.

```
┌─ Crème fraîche · 40 cl sur la liste ─── ✕ ─┐
│ Mardi 10 · Dîner                           │
│ Gratin de courgettes              25 cl  › │
│ Jeudi 12 · Déjeuner                        │
│ Quiche aux poireaux               15 cl  › │
│                                            │
│ Remplacer par (facultatif)                 │
│ [ yaourt grec                         ] OK │
└────────────────────────────────────────────┘
```

- **Tri :** les repas sont classés par date, puis dans l'ordre petit-déjeuner, déjeuner, dîner.
- **Ouverture d'une recette :** toucher une ligne ouvre la recette, aux portions de ce repas. Le retour ramène
  à la liste dans le même mode.
- **Batch cooking :** une recette du batch forme une seule entrée, avec une seule quantité :
  « Cuisiné dimanche · mangé mardi et jeudi ». Ses quantités sont celles de ses propres portions, comme sur
  la page Batch cooking. Un repas qui consomme ce batch n'a pas de ligne séparée.
  - Le bouton compte les **repas où l'on mange**, donc « 2 repas » dans cet exemple.
  - Si mardi est annulé, « mardi » reste barré dans l'entrée et le bouton passe à « 1 repas ».
  - Si tous ces repas sont annulés, l'entrée est barrée et compte pour 0, même si le batch est déjà fait.
  - Un batch sans repas rattaché affiche « Cuisiné dimanche » et compte pour 1 : il faut l'article pour cuisiner.
  - Le tri se fait sur le jour de cuisine. L'entrée est « déjà passée » quand tous ses repas sont passés.
- **Repas annulé :** il reste affiché, barré, et ne compte pas dans le nombre du bouton. Si tous les repas sont
  annulés, le bouton affiche « 0 repas » : on voit qu'on peut se passer de l'article.
- **Repas déjà passé :** il reste affiché, plus discret, et continue de compter. Le panneau décrit la semaine
  entière ; l'article a pu être acheté pour ce repas.
- **Plusieurs repas pour une même recette :** une ligne par repas, chacune avec sa quantité.
- **Quantité :** celle de la ligne d'ingrédient de la recette, ajustée au nombre de personnes présentes à ce
  repas, comme à l'ouverture de la recette depuis le menu. **Aucun total recalculé** : le seul total affiché
  est celui de la liste.
- **Ingrédient non retrouvé :** le repas s'affiche quand même, sans quantité.

### Le remplacement

- **Saisie :** texte libre, facultatif, sans quantité imposée (« yaourt grec, 30 cl »). Texte vide : rien n'est
  enregistré. On peut fermer le panneau sans y toucher.
- **Modifier ou annuler :** le panneau montre le remplacement en cours, modifiable, avec un bouton
  « Annuler le remplacement ».
- **Coche et tri :** noter un remplacement ne coche pas l'article et ne change pas sa destination.
- **Sans réseau :** l'écriture marche comme les coches, et part au retour du réseau.

### Où le remplacement se voit

| Endroit | Affichage |
|---|---|
| Lignes de la liste (Trier, Magasin, Drive, tous écrans) | ~~Crème fraîche~~ → yaourt grec, la quantité d'origine reste à côté |
| Texte partagé, liste Drive copiée, fichier HTML du magasin | `yaourt grec (à la place de : Crème fraîche, 40 cl)` |
| Lien de recherche du Drive | cherche le texte du remplacement |
| Recette ouverte, si l'article est relié à cette recette et que sa semaine est en cours (voir ci-dessous) | rappel en haut : « Cette semaine : yaourt grec à la place de Crème fraîche » |
| Ligne de l'ingrédient, s'il est retrouvé | ~~Crème fraîche~~ → yaourt grec, avec la quantité de la recette |

Écrans de recette du hub à couvrir : fiche (`RecetteDetail`), fenêtre du menu (`RecetteDetailModal`), mode
recette (`ModeRecette`), page batch cooking (`BatchCooking`).

Écrans de l'iPad à couvrir : mode recette (`mode-recette.js`), quelle que soit son entrée (prochain repas, menu,
livre), et fiche du livre (`tiles/livreRecettes.js`). Un remplacement noté doit y être visible à la prochaine
ouverture de la recette quand le réseau répond. Sans réseau, l'iPad peut afficher la recette sans le rappel.

Le rappel en haut s'appuie sur le lien article-recette, pas sur le nom : il s'affiche même si la ligne
d'ingrédient n'est pas retrouvée. Le texte des étapes garde le mot d'origine ; c'est à ça que sert le rappel.

### Quand un remplacement s'applique aux recettes

La règle suit **les dates de la semaine du plan, pas son statut** : un remplacement s'affiche dans une recette du
début au `dateFin` de son plan, dates comprises. Le début est le plus ancien de `dateDebut` (premier repas) et de la
date de la plus ancienne session batch du plan : on cuisine parfois le dimanche d'avant (l'import accepte une
session la veille du premier repas), et ce batch doit déjà porter le rappel. Rien n'archive un plan à la fin de sa semaine, et un plan
est archivé dès l'import du suivant, d'où ces cas à couvrir et à tester :

- Pas de nouveau menu importé : le remplacement quitte les recettes après `dateFin`, même si le plan reste actif.
- Batch cuisiné la veille du premier repas : le remplacement s'applique dès ce jour-là (pas seulement à partir
  du premier repas).
- Aucun batch : le début reste `dateDebut`. Batch dans la semaine : le début ne change pas.
- Menu de la semaine suivante importé avant la fin de la semaine : les remplacements du plan archivé restent
  visibles dans les recettes jusqu'à son `dateFin`, et le nouveau plan n'a aucun effet avant son début (batch de la veille compris).

La liste de courses n'applique pas cette règle : elle affiche toujours les remplacements de ses propres articles.

## Données

- **Stockage :** nouveau champ facultatif `remplacement?: string` sur `ArticleCourses`
  (`shoppingLists/{id}/items/{id}`). Une liste appartient à un plan, donc le remplacement reste propre à ce plan.
  La fiche `recettes/{id}` n'est jamais écrite.
- **Lien existant, à réutiliser :** `article.recetteIds` → recettes ; `slot.recetteIds` et
  `batchSession.recetteIds` → jours et repas.
- **Écriture :** `updateDoc` du seul champ, sans attente ni transaction, comme les coches. Annuler passe par
  `deleteField()`. Taille bornée à 100 caractères.
- **Ré-import du même plan :** `fusionnerReimport` garde le remplacement d'un article repris. Un article retiré
  par le ré-import disparaît avec son remplacement.
- **Liste à l'ancien format :** écriture refusée comme les autres actions (`refArticle`, message existant).
- **Règles Firestore :** aucun changement attendu. Les membres écrivent via le catch-all, et l'écran lit déjà
  `shoppingLists/**`. À confirmer par un test de règles, y compris la lecture de `items` par l'écran.

## Retrouver l'ingrédient dans la recette

Mesure sur la liste actuelle (61 articles issus du menu, tous reliés, 102 liens article-recette) : 98 noms
identiques une fois normalisés, 2 différant par le pluriel, 2 non retrouvés (article au pluriel avec un
qualificatif, type « oignons jaunes »).

- Comparer après normalisation : casse, accents, ponctuation, espaces, puis singulier/pluriel simple.
- En cas d'échec seulement, accepter une inclusion par mots entiers, s'il n'y a **qu'un seul** candidat dans la
  recette. Plusieurs candidats : pas de correspondance.
- Deux lignes de la recette au même nom normalisé (beurre pour la pâte et pour la sauce) : le remplacement
  s'affiche sur les deux, et le panneau montre les deux quantités sans les additionner (« 20 g + 30 g »).
- Pas de correspondance : pas de quantité et pas de ligne barrée. C'est le comportement voulu, pas une erreur.
- Même logique des deux côtés : fonction pure du hub et copie ES5 pour l'iPad, testées avec les mêmes cas, sur
  le modèle des fonctions `*Es5` existantes (`displayModeRecette.test.ts`).

## Contraintes

- `apps/display/` reste ES5 et Safari 9 (`npm run check:display`).
- Dépôt public : aucun prénom ni donnée de la famille, dans le code, les tests et la documentation.
- Hors ligne en magasin : le panneau doit s'ouvrir avec une liste, un plan et des recettes déjà ouverts une fois
  avec du réseau. Le cache Firestore persistant existe, mais il faut vérifier que les repas et les recettes du
  plan sont bien lus hors ligne par la voie choisie. Si une recette manque au cache : repas affiché avec ce
  qu'on sait, sans quantité, jamais d'écran d'erreur.
- Lignes de Trier et de Magasin : cibles tactiles d'au moins 48 px, le bouton en dehors de la zone qui coche.
- Couleurs issues des jetons de `packages/design`.
- Mettre à jour `docs/ETAT.md` et `CHANGELOG.md`.
- Déploiement par le propriétaire, ou sur sa demande explicite : fonctions, puis règles, puis hébergement.

## Laissé au constructeur

- La voie de lecture sur l'iPad (lecture directe de la liste à l'ouverture, ou autre), tant que l'exigence de
  fraîcheur ci-dessus est tenue. Une lecture directe éviterait tout déploiement de fonction. L'iPad ne peut pas
  lire `mealPlans` : les plans et leurs dates lui viennent du snapshot `weekly-menu`.
- Le découpage en composants, le nom exact des fonctions et le style des règles de normalisation.
- Le chargement à la demande ou d'avance des repas et recettes du panneau.
- L'emplacement du rappel dans chaque écran, dans le style existant.

## Comment savoir que c'est réussi

- Tests purs : nombre de repas (annulés, batch partiellement ou totalement annulé, batch sans repas, recette dans
  plusieurs repas), correspondance des noms, dates d'application du remplacement, textes partagés, conservation
  du remplacement au ré-import, quantités ajustées.
- Parcours navigateur sur émulateur, à largeur de téléphone : ouvrir le panneau sans cocher, noter un
  remplacement, le voir sur la liste et dans une recette, l'annuler, puis la même chose sans réseau.
- Sur l'iPad, ou son simulateur : remplacement visible en mode recette et sur la fiche du livre.
- La fiche `recettes/{id}` n'a pas changé après un remplacement.
