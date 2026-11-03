# État du projet

Mis à jour le 03.11.2026. Seul document d'état du dépôt : le tenir à jour dans le même commit que tout changement de comportement.

## En service

Déployé sur le projet Firebase du propriétaire, utilisé par le foyer : un iPad mini 1 en cuisine et les téléphones des deux parents.

## Livré

| Date | Quoi | Où |
|---|---|---|
| avant le 04.05.2026 | Fondation monorepo, tuiles horloge, météo, radio ; iPad mural (phase 1) ; mise en page, tuiles agenda et minuteur (phase 2) | historique git |
| 04 → 11.05.2026 | Phase 3 : planificateur de repas avec Claude.ai, batch cooking, livre de recettes, liste de courses, mode cuisine iPad, recherche par ingrédients du frigo | historique git |
| 06.05.2026 | Dépôt public, licence PolyForm Noncommercial, guide [ONBOARDING.md](../ONBOARDING.md) | [décision 0003](decisions/0003-licence-polyform-noncommercial.md) |
| 08 → 21.05.2026 | Phase 4 : défilement et mise en page iPad, tuile Réglages ; plans de durée variable, historique des menus | [archive](archive/INDEX.md) |
| 17.06.2026 | Audit complet (navigation, accessibilité, fiabilité kiosque, sécurité, perf) ; CI ; tests des règles Firestore | [archive](archive/INDEX.md) |
| 28.09.2026 | Correctifs de l'audit du 28.09 (sécurité, appairage, données), Node 22, déploiement des fonctions avec npm 10 | PR #10, #19 |
| 25.10.2026 | Refonte : ambiance jour/nuit du design system, application de téléphone installable et hors ligne, invitation de l'autre parent, liste de courses cochable hors ligne, nouvel écran de cuisine de l'iPad (tableau, mode recette, minuteurs partagés), rechargement automatique de l'iPad | PR #21 à #30, [archive](archive/INDEX.md) |
| 27.10.2026 | Contrôle parental du PC des enfants : écran parent `/pc` (modes, verrouillage, demandes, journée, filtre internet NextDNS, réglages), règles, simulateur ; déployé et PC relié | PR #32, [BILAN](controle-parental/BILAN.md) |
| 27.10.2026 | Notifications des demandes : interrupteur « Me prévenir des demandes » par téléphone ou navigateur, fonction `notifierDemandePc` | PR #33, [BILAN](controle-parental/BILAN.md) phase 9 |
| 27.10.2026 | iPad de cuisine : carte « PC des enfants » et rapport de la journée, en lecture seule (aucune décision sur l'iPad) | [BILAN](controle-parental/BILAN.md) phase 10 |
| 01.11.2026 | Livre de recettes : desserts et gestes de base (types de repas « dessert » et « technique »), parcours « Je cuisine seule » sur l'iPad (tag `ado`, niveaux, gestes liés depuis la fiche), import qui enrichit un lot déjà importé (`--maj-source`). Choix techniques : un tag plutôt qu'un filtre de difficulté (la difficulté mesure la technique, pas la sécurité) ; gestes reliés par nom pour rester importables depuis un JSON. Rien à déployer côté fonctions ni règles. | branche `feat/repas-dessert` |

## En cours

**Courses : voir les repas d'un article et noter un remplacement** (branche `courses-recettes-remplacement`, construite le 03.11.2026, vérifiée en partie (voir « Vérification » ci-dessous), ni fusionnée ni déployée). Spec : [2026-11-03-courses-recettes-remplacement-design.md](archive/2026/superpowers/specs/2026-11-03-courses-recettes-remplacement-design.md) ; plan : [2026-11-03-courses-recettes-remplacement.md](archive/2026/superpowers/plans/2026-11-03-courses-recettes-remplacement.md).

- Sur la liste (Trier, Magasin, colonnes du PC), chaque article issu du menu a un bouton « 3 repas » (ou « Voir ») qui ouvre un panneau : les repas de la semaine qui l'utilisent, jour, repas, quantité ajustée aux personnes présentes. Les repas annulés restent barrés et ne comptent pas ; une recette de batch forme une seule ligne (« Cuisiné lundi · mangé samedi et dimanche »). Un article ajouté à la main n'a pas ce bouton.
- Le panneau permet, sans obligation, de noter un remplacement (texte libre, 100 caractères au plus). Il ne coche pas l'article et ne change pas sa destination. Fermer sans écrire n'écrit rien ; « Annuler le remplacement » l'efface.
- Le remplacement s'affiche barré → remplaçant sur la liste, dans le texte partagé, la liste Drive copiée (et sa recherche) et le fichier HTML du magasin ; dans les recettes (fiche, fenêtre du menu, mode recette, batch cooking, et sur l'iPad le mode recette et la fiche du livre) sous forme d'un rappel « Cette semaine : … » et d'une ligne d'ingrédient barrée, du premier jour du plan (ou de son batch s'il est cuisiné la veille du premier repas) au dernier, pas au-delà. La fiche `recettes/{id}` n'est jamais écrite : un remplacement ne vaut que pour la semaine.
- Stockage : champ facultatif `remplacement` sur l'article (`shoppingLists/{id}/items/{id}`), écrit sans attente comme les coches (marche hors ligne, part au retour du réseau), conservé au ré-import du même plan. Aucun changement de règles Firestore (un test le confirme, y compris la lecture par l'écran), aucune fonction : rien à déployer hors Hosting.
- **Vérification** : le hub a été exercé dans Chromium sur l'émulateur (téléphone 390 px et PC). **Démarrage à froid en magasin** : application rechargée dans un navigateur neuf (mémoire vide), toutes les connexions à Firestore et à l'authentification refusées, Vite servant l'application ; seul le cache persistant de Firestore pouvait répondre. Observé : liste et bouton « 6 repas » à 0,37 s (« Voir » n'a pas été vu, moins de 60 ms), panneau complet (repas, quantités, noms de recettes) dès l'ouverture, sans « Chargement des repas… » visible, recette ouverte depuis le panneau en 0,08 s, remplacement noté et visible sur la liste tout de suite, écrit sur le serveur 0,5 s après le retour du réseau. Retour d'une recette ouverte depuis le panneau : la position dans une longue liste Magasin est retrouvée (perdue avant ce correctif). **Non couvert** : le service worker (Vite en développement n'en a pas), un démarrage hors ligne dans un navigateur sans aucun cache (l'état « Repas indisponibles sans réseau » n'est couvert que par test unitaire), le texte partagé, la liste Drive et sa recherche, et le fichier HTML du magasin (tests unitaires seulement). L'iPad a été vu dans Chromium, pas sur Safari 9.
- **Reste à vérifier** : le clavier du téléphone par-dessus le panneau (sur un vrai téléphone), un démarrage à froid en mode avion sur le vrai téléphone, et l'iPad mini réel (Safari 9 : rappel dans le mode recette et la fiche du livre, ligne barrée, lecture des listes de courses). Sans réseau l'iPad n'a pas la recette (comportement d'avant), donc pas de rappel.

## Bloqué

Rien.

## Prochaines étapes

- **PC des enfants** : suite dans [BILAN.md « Ce qui reste »](controle-parental/BILAN.md#ce-qui-reste-dans-lordre) (bascule de l'agent du PC, déploiement des notifications, essai réel).
- **Mises à jour de dépendances** proposées par Dependabot, en attente : PR #11 à #13, #15 à #18 et #20 (dont des montées de version majeures : Firebase 12, React Router 7, React, actions GitHub). À traiter une par une, CI verte et vérification sur l'iPad.
- **Amendements proposés au guide [ONBOARDING.md](../ONBOARDING.md)** (26.10.2026, document canonique non modifié par le rangement) : « ~14 fonctions » (§ 7.4) devient « ~22 » (nombre exporté par `functions/src/index.ts`) ; `npm install` (§ 6.3, § 11, § 12.5) pourrait devenir `npm ci`, qui respecte le lockfile (sans gravité pour un foyer qui installe une fois).
- **Connexion depuis l'application installée sur iPhone** : réglage à faire par le propriétaire (`VITE_FIREBASE_AUTH_DOMAIN` sur le domaine du site), voir [DESIGN.md § Téléphone](DESIGN.md#téléphone-application-installable). Fait ou non : inconnu.

## Questions ouvertes

- Les vérifications à la main du lot du 25.10.2026 ([deploiement.md](exploitation/deploiement.md#lot-du-25102026-refonte-ipad--téléphone)) ont-elles toutes été faites ?
- Trois brouillons de PR datent d'avant la remise à zéro de `main` du 03.05.2026 (#1, #5, #9) et ne correspondent plus au code : à fermer ?
- `.env.example` déclare `VITE_HUB_URL`, `VITE_DISPLAY_URL` et `VITE_GOOGLE_CALENDAR_CLIENT_ID`, typées dans `apps/hub/src/lib/env.d.ts` mais lues nulle part : à retirer du code et du modèle ?
- **Ancienne configuration web Firebase dans l'historique public** : la clé web (`apiKey`) et l'`appId` d'un projet Firebase réel ont été versionnés dans `apps/display/public/js/firebase-config.js` du 01.05 au 28.09.2026 (commits `68612ef` à `be4b24b`), puis retirés ; ils restent lisibles dans l'historique. Une clé web Firebase n'est pas un secret (la sécurité vient des règles Firestore), mais si ce projet est toujours en service, restreindre la clé aux domaines du site dans la console Google Cloud suffit. Réécrire l'historique n'est pas recommandé.
- **Branches GitHub à nettoyer** (rien n'a été supprimé) :
  - 18 branches déjà fusionnées dans `main`, supprimables sans perte : `claude/home-three-tiles`, `claude/livre-recettes-wizard`, `claude/recipe-meal-filter-n1Xuj`, `claude/tile-livre-recettes`, `correctifs-apres-refonte`, `correctifs-audit-2026-09-28`, `fix-deploy-npm10`, `fix-reappairage`, `icone-maison`, `ipad-dernieres-vues`, `menu-depuis-ensuite`, `minuteurs-sonnerie-locale`, `nom-pc-enfants`, `onglet-ipad-cuisine`, `phase-3-kitchen-buddy`, `phase-4-ipad-ux`, `radios`, `refonte-ipad-mobile`.
  - 5 branches mortes du 03.05.2026, antérieures à la remise à zéro de `main` : `phase-1-bootstrap`, `claude/review-project-status-O1TyI` (sans PR), et celles des brouillons #1, #5, #9 (`claude/fix-kitchen-visibility-q9iSD`, `claude/livre-standalone`, `claude/livre-recettes-ux-v2`).
  - Les branches `dependabot/*` vivent avec leurs PR.
