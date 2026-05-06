# Guide d'installation — Family Hub

> **Pour qui ?** Une personne qui veut installer Family Hub chez elle pour sa famille, **sans aucune expérience technique préalable** (jamais ouvert un terminal, jamais déployé de site web). Tout est expliqué pas à pas.

> **Combien de temps ?** Comptez **2 à 3 heures** la première fois, en suivant le guide tranquillement. Les mises à jour ensuite prennent 2 minutes.

> **Combien ça coûte ?** **Probablement 0 € / mois pour une famille** — mais Firebase exige une carte bancaire (au cas où vous dépassez le seuil gratuit, ce qui est très improbable pour un usage familial). Détails en section 2.3.

---

## Table des matières

1. [Bienvenue et ce que fait Family Hub](#1-bienvenue-et-ce-que-fait-family-hub)
2. [Comprendre Firebase en 5 minutes](#2-comprendre-firebase-en-5-minutes)
3. [Architecture du projet](#3-architecture-du-projet)
4. [Préparer ton ordinateur (~30 min)](#4-préparer-ton-ordinateur-30-min)
5. [Créer ton projet Firebase (~30 min)](#5-créer-ton-projet-firebase-30-min)
6. [Cloner et configurer le code (~20 min)](#6-cloner-et-configurer-le-code-20-min)
7. [Premier déploiement (~15 min)](#7-premier-déploiement-15-min)
8. [Configurer ton foyer (~30 min)](#8-configurer-ton-foyer-30-min)
9. [Premier plan repas avec Claude.ai (~15 min)](#9-premier-plan-repas-avec-claudeai-15-min)
10. [Optionnel : calendrier Google iCal](#10-optionnel--calendrier-google-ical)
11. [Maintenance courante](#11-maintenance-courante)
12. [Si ça plante](#12-si-ça-plante)

---

# 1. Bienvenue et ce que fait Family Hub

## 1.1 Le pitch

**Family Hub**, c'est un assistant familial qui tourne sur :
- ton **PC** (édition / configuration / wizard plan repas)
- un ou plusieurs **iPad ou tablettes** (affichage en cuisine, salon, entrée…)
- les **mobiles** de la famille (liste de courses, recette du jour)

Il regroupe en un seul système :
- 🍽️ **Planning des repas hebdomadaire** générés en collaboration avec Claude.ai
- 📖 **Livre de recettes** familial avec favoris
- 🛒 **Liste de courses** auto-générée, envoyable vers Google Keep en un tap
- 📅 **Agenda familial** depuis Google Calendar
- ⏲️ **Minuteurs** de cuisine partagés entre tous les écrans
- 🌤️ **Météo**, ⏰ **horloge**, 📻 **radio**, etc.

## 1.2 Comment ça marche en pratique : le dimanche soir

```
1. Tu ouvres https://family-hub-TONNOM.web.app/menu/nouveau sur ton PC
2. Tu remplis le wizard (5 minutes) :
   - Date du début de semaine
   - Qui mange à quels repas (case "express" pour les jours pressés)
   - Contexte (batch cooking OK ? jour des courses ? frigo à écouler ?)
3. Tu cliques "Créer le brouillon", puis "Télécharger le .md"
4. Tu copies le prompt suggéré, ouvres https://claude.ai
5. Tu colles le prompt + le contenu du .md dans Claude.ai
6. Claude.ai te propose un menu, tu peux dire "remplace mardi soir par
   un plat plus végé" → il ajuste
7. Quand ça te convient, tu lui dis "OK, génère le JSON"
8. Tu copies le JSON et le colles dans /menu/import
9. C'est fini : le menu est sur l'iPad cuisine, la liste de courses
   sur ton mobile, prêt pour la semaine
```

Pendant la semaine :
- L'iPad cuisine affiche **automatiquement la recette du moment** (le matin → petit-déj, midi → déjeuner, soir → dîner)
- En tapant la recette, tu passes en **mode cuisine** plein écran avec timers intégrés sur les étapes
- Tu peux **cocher la liste de courses** dans Google Keep en faisant les courses
- Si tu as commandé des pizzas un soir, tu **marques le slot comme annulé** en un tap

## 1.3 Ce que tu vas obtenir

À la fin du guide, tu auras :
- une **URL personnelle** pour ta famille : `https://family-hub-TONNOM.web.app`
- le tout **gratuit** ou quasi (le quota Firebase gratuit suffit largement)
- les **données de ta famille restent à toi** (Firebase = compte Google personnel)
- la possibilité de **modifier ce que tu veux** dans le code (c'est ouvert sur GitHub)

---

# 2. Comprendre Firebase en 5 minutes

## 2.1 C'est quoi Firebase

**Firebase, c'est une plateforme de Google qui fournit toute l'infrastructure technique d'une appli web ou mobile**, sans que tu aies à gérer un serveur toi-même.

C'est comme si tu louais en un seul endroit :
- l'hébergement de ton site web
- la base de données qui stocke tes profils, recettes, plans de repas
- le système de connexion par compte Google
- des "petits programmes" qui tournent dans le cloud quand on les appelle

Family Hub utilise 5 services Firebase. Tu n'as **rien à comprendre techniquement** : tu cliques pour les activer, et le code du projet sait s'en servir tout seul.

## 2.2 Les 5 services qu'on utilise

| Service | Rôle dans Family Hub |
|---|---|
| **Authentication** | Connexion par compte Google (toi + les membres de la famille) |
| **Firestore Database** | Stocke les profils, plans de repas, recettes, listes de courses |
| **Cloud Functions** | Petits programmes serveur (rafraîchir la météo, calculer la "recette du jour", générer le QR code des écrans, etc.) |
| **Hosting** | Héberge le site `family-hub-TONNOM.web.app` |
| **Storage** | Stockera plus tard les photos de profil ou les images de recettes (pas encore utilisé en V1, mais on l'active par sécurité) |

## 2.3 ⚠️ Le coût : à lire absolument

**Firebase a deux plans** :

### Plan Spark (gratuit, sans CB)
- Auth, Firestore, Hosting, Storage : **gratuits avec quotas larges**
- Mais : **Cloud Functions ne marchent PAS** sur ce plan

### Plan Blaze (pay-as-you-go, CB requise)
- **Quota gratuit identique au plan Spark, et au-delà tu payes**
- Cloud Functions marchent
- **Pour une famille de 3-5 personnes, on est très très loin de dépasser le quota gratuit. On reste à 0 € / mois en pratique.**

**Tu DOIS prendre le plan Blaze** parce que Family Hub utilise des Cloud Functions (météo, calendrier, recette du jour…).

> 💡 **Concrètement** : tu mets ta carte bancaire dans Firebase, mais tu ne seras jamais débitée tant que tu restes sous les seuils gratuits, qui sont énormes pour un usage familial. Pour ordre d'idée : le quota Cloud Functions inclut **2 millions d'appels gratuits par mois**. Une famille en fait peut-être 1 000 par mois.

> 🛡️ **Sécurité** : on configurera **une alerte budget à 1 €** dans Firebase pour que tu reçoives un mail si jamais quelque chose tourne mal et que la facture grimpe. C'est expliqué en section 11.3.

---

# 3. Architecture du projet

Cette section est **optionnelle** pour comprendre. Tu peux la sauter et y revenir plus tard. Mais si tu te poses la question "qu'est-ce que je suis en train d'installer exactement ?", elle répond.

## 3.1 Carte mentale

```
                          ┌─────────────────────────┐
                          │    Firebase (Google)    │
                          │                         │
  Tu écris du code  →     │  ▸ Hosting (le site)   │  ←  Tes utilisateurs
  Tu déploies            │  ▸ Firestore (BDD)     │     visitent ton site
                          │  ▸ Auth Google         │
                          │  ▸ Cloud Functions     │
                          └─────────────────────────┘
```

Le projet Family Hub s'appuie sur Firebase pour TOUT (hébergement, base de données, logique serveur). Toi, tu écris uniquement le **code** ; Firebase s'occupe d'exécuter ce code chez Google.

## 3.2 Le monorepo : 3 morceaux

Le projet est un **monorepo**, c'est-à-dire un seul dépôt GitHub qui contient plusieurs sous-projets. Concrètement, dans le dossier `family hub` que tu vas cloner :

```
family hub/
├── apps/
│   ├── hub/         ← le site web pour PC + mobile (React, moderne)
│   └── display/     ← le site pour iPad mini cuisine (vanilla JS, vieux mais
│                       compatible avec les iPad mini 1 sous iOS 9 !)
├── functions/       ← les "petits programmes serveur" (Cloud Functions)
├── packages/
│   └── types/       ← des types partagés entre apps/hub et functions
└── firebase.json    ← configuration Firebase
```

**Tu n'as PAS besoin de comprendre tous ces dossiers**. Le système saura compiler tout ça avec une seule commande.

## 3.3 Comment les pièces communiquent

```
┌──────────────────┐                    ┌──────────────────┐
│  Hub web (PC)    │ ←─── écrit/lit ──→ │   Firestore      │
│  /menu, /tiles…  │                    │   (la BDD)       │
└──────────────────┘                    └──────────────────┘
                                              ▲       ▲
┌──────────────────┐                          │       │
│  iPad cuisine    │ ←──── lit ────────────────┘       │
│  (display)       │                                  │
└──────────────────┘                                  │
                                                      │
┌──────────────────┐                                  │
│  Cloud Functions │ ←── écrivent / appelées ────────┘
│  (météo, calendar│
│  ai, etc.)       │
└──────────────────┘
```

L'iPad **lit** la base de données et affiche tout en temps réel. Toi tu **écris** des données depuis le hub web (plans, profils…). Les Cloud Functions tournent en background (toutes les 30 minutes par exemple, pour rafraîchir la météo).

---

# 4. Préparer ton ordinateur (~30 min)

On va installer 3 outils sur ton PC ou Mac :

1. **Node.js** : un programme qui exécute du code JavaScript en dehors du navigateur. C'est utilisé pour compiler le projet.
2. **Git** : un outil de gestion de versions. Permet de "cloner" (télécharger) le projet depuis GitHub.
3. **Firebase CLI** : un outil en ligne de commande pour communiquer avec Firebase.

## 4.1 Comprendre ce qu'est un terminal

Avant de commencer : un **terminal** (ou "ligne de commande") est une fenêtre où tu tapes des commandes texte au lieu de cliquer dans des menus. C'est ce qu'on va utiliser pour installer et déployer le projet.

- Sur **Windows**, le terminal s'appelle **PowerShell** ou **Command Prompt** (cmd).
- Sur **Mac**, il s'appelle **Terminal**.

> 💡 Tu vas voir, ça fait un peu peur la première fois mais c'est juste taper du texte et appuyer sur Entrée.

### Ouvrir un terminal sur Windows

1. Clique sur **Démarrer** (ou appuie sur la touche Windows)
2. Tape **PowerShell**
3. Clique sur **Windows PowerShell** dans les résultats
4. Une fenêtre noire (ou bleue) s'ouvre avec une ligne du genre `PS C:\Users\TonNom>`. C'est là qu'on tape les commandes.

### Ouvrir un terminal sur Mac

1. Appuie sur **Cmd + Espace** (ouvre Spotlight)
2. Tape **Terminal**
3. Appuie sur Entrée
4. Une fenêtre s'ouvre avec une ligne du genre `tonnom@MacBook ~ %`.

## 4.2 Installer Node.js

Node.js est requis pour compiler le projet et utiliser Firebase CLI.

### Sur Windows ET Mac (méthode simple)

1. Va sur [https://nodejs.org/fr](https://nodejs.org/fr)
2. Clique sur le bouton **LTS** (Long Term Support, version stable) — il devrait afficher quelque chose comme "20.X.X LTS"
3. Le téléchargement démarre. Une fois fini, ouvre le fichier téléchargé.
4. Suis l'installateur en cliquant **Suivant** / **Next** plusieurs fois (laisse tous les choix par défaut). Sur Windows, accepte la case "Automatically install the necessary tools" si elle apparaît.
5. À la fin, clique **Terminer** / **Finish**.

### Vérifier que Node.js est installé

Ouvre un **nouveau** terminal (important : un nouveau, pas un déjà ouvert avant l'installation), et tape :

```powershell
node --version
```

Tu devrais voir s'afficher quelque chose comme `v20.11.0`. Si oui, parfait.

Tape ensuite :

```powershell
npm --version
```

Tu devrais voir `10.X.X` ou similaire. Parfait.

> 🚨 **Si la commande `node` n'est pas reconnue** : ferme et rouvre le terminal. Si toujours pas : redémarre l'ordinateur. Si toujours pas, refait l'installation.

## 4.3 Installer Git

### Sur Windows

1. Va sur [https://git-scm.com/download/win](https://git-scm.com/download/win)
2. Le téléchargement de **Git for Windows** démarre automatiquement
3. Ouvre le fichier téléchargé
4. Clique **Next** plusieurs fois en gardant tous les choix par défaut. C'est important.
5. À la fin, **Finish**.

### Sur Mac

Git est probablement déjà installé. Vérifie en tapant dans le Terminal :

```bash
git --version
```

Si ça affiche un numéro de version, c'est bon. Sinon, le Mac va te proposer d'installer les outils développeur Apple — accepte (gros téléchargement de ~1 Go, peut prendre 10-20 min).

### Vérifier Git

Dans un **nouveau** terminal :

```powershell
git --version
```

Tu devrais voir `git version 2.X.X`. Parfait.

## 4.4 Installer Firebase CLI

C'est le programme en ligne de commande qui parle à Firebase.

Dans le terminal, tape :

### Sur Windows (PowerShell)

```powershell
npm install -g firebase-tools
```

> ⚠️ Si tu vois une erreur "permission denied" ou "EACCES", ouvre PowerShell **en administrateur** (clic droit sur PowerShell → Exécuter en tant qu'administrateur) et retape la commande.

### Sur Mac (Terminal)

```bash
sudo npm install -g firebase-tools
```

Tape ton mot de passe Mac quand on te le demande (le curseur ne bouge pas pendant que tu tapes, c'est normal — appuie Entrée à la fin).

### Vérifier Firebase CLI

Dans un terminal :

```powershell
firebase --version
```

Tu devrais voir un numéro de version comme `13.X.X`. Parfait.

## 4.5 (Optionnel mais recommandé) Installer VS Code

**Visual Studio Code** est un éditeur de texte gratuit pour ouvrir et lire le code du projet. Tu n'es pas obligée de l'installer mais c'est très utile pour le fichier de config.

1. Va sur [https://code.visualstudio.com/](https://code.visualstudio.com/)
2. Télécharge la version pour ton OS
3. Installe-la (laisse les choix par défaut)

---

# 5. Créer ton projet Firebase (~30 min)

C'est l'étape la plus longue et la plus "clic-clic dans une console web". Une fois que c'est fait, on n'y touche presque plus.

## 5.1 Créer un compte Google (si tu n'en as pas déjà un)

Tu auras besoin d'un compte Google pour :
- Te connecter à la console Firebase
- Te connecter à ton site Family Hub plus tard

Si tu as déjà un compte Gmail, c'est ton compte Google. Sinon, va sur [https://accounts.google.com/signup](https://accounts.google.com/signup) et crée-en un.

## 5.2 Créer le projet Firebase

1. Va sur [https://console.firebase.google.com](https://console.firebase.google.com)
2. Connecte-toi avec ton compte Google si demandé
3. Clique sur le grand bouton **+ Ajouter un projet** (ou "Add project")
4. **Nom du projet** : tape `family-hub-TONNOM` (remplace TONNOM par ton prénom ou nom de famille, en minuscules, sans espace ni accent — ex : `family-hub-dupont`)
5. Firebase te suggère un identifiant unique (ex: `family-hub-dupont`). **Note-le quelque part**, on en aura besoin. Si l'identifiant te plaît, continue.
6. Clique **Continuer**
7. **Activer Google Analytics** : tu peux décocher (on n'en a pas besoin) ou laisser cocher (gratuit, c'est juste des stats). Continue.
8. Clique **Créer le projet**. Attends 30 secondes — 1 minute.
9. Quand c'est prêt, clique **Continuer**.

Tu arrives sur le tableau de bord de ton projet Firebase. Bravo !

## 5.3 Activer le plan Blaze (paiement à l'usage)

> ⚠️ Étape obligatoire : Cloud Functions ne marchent pas sans ce plan. Rappelle-toi : tu paies seulement si tu dépasses le quota gratuit, ce qui n'arrivera pas pour un usage familial.

1. En bas à gauche de la console Firebase, clique sur **Mettre à niveau** (ou "Upgrade") — petit bouton près du plan "Spark".
2. Choisis le plan **Blaze**.
3. Si on te demande de configurer un compte de facturation Google Cloud :
   - Clique **Créer un compte de facturation**
   - Renseigne : nom, adresse, **carte bancaire**
   - Valide.
4. Une fois la facturation liée, clique **Acheter** ou "Confirmer le plan Blaze". Tu n'es PAS débitée à ce moment-là.

> 🛡️ **Configurer une alerte budget MAINTENANT** :
> 1. Toujours dans la console Firebase, clique sur l'engrenage en haut à gauche → **Utilisation et facturation** → onglet **Détails et paramètres**.
> 2. Clique **Modifier le budget** ou "Set budget alert".
> 3. Mets un montant **à 1 €** (oui, juste 1 euro).
> 4. Coche les seuils 50%, 90%, 100%.
> 5. Sauvegarde.
>
> Comme ça, si jamais tu reçois un mail "tu as dépassé 0,50€", tu sauras qu'il y a un truc anormal et tu pourras me contacter (ou Claude.ai 😄). En usage normal famille, **tu ne recevras jamais ce mail**.

## 5.4 Activer Authentication

1. Dans le menu de gauche, sous **Build / Créer**, clique **Authentication**.
2. Clique **Commencer**.
3. Onglet **Méthode de connexion** (sign-in method).
4. Clique sur **Google** dans la liste des providers.
5. **Active** Google (toggle en haut).
6. Email d'assistance public : sélectionne ton email Gmail.
7. Clique **Enregistrer**.

## 5.5 Activer Firestore Database

1. Dans le menu de gauche, sous **Build**, clique **Firestore Database**.
2. Clique **Créer une base de données**.
3. Sélectionne le mode **Production** (pas le mode test). On configurera les règles de sécurité plus tard via le code.
4. **Emplacement** : choisis **eur3 (europe-west)** ou **europe-west1** (Belgique). C'est le plus proche pour la France.
5. Clique **Activer**.
6. Attends 30 secondes — 1 minute.

## 5.6 Activer Cloud Functions

1. Dans le menu de gauche, sous **Build**, clique **Functions**.
2. Si tu vois un bouton **Mettre à niveau** ici, c'est que le plan Blaze n'est pas pris. Retourne à 5.3.
3. Si le plan est bon, clique **Commencer** ou laisse vide — il n'y a pas de fonction à activer manuellement, on les déploie via le code en section 7.

## 5.7 Activer Hosting

1. Dans le menu de gauche, sous **Build**, clique **Hosting**.
2. Clique **Commencer**.
3. Suis les étapes mais **NE PAS exécuter les commandes qu'il te montre** — on a déjà tout dans le code, on s'en occupera en section 7.
4. Clique **Suivant** plusieurs fois jusqu'à finir.

## 5.8 Activer Storage

1. Dans le menu de gauche, sous **Build**, clique **Storage**.
2. Clique **Commencer**.
3. Choisis **mode production**.
4. Emplacement : laisse celui par défaut (déjà aligné sur Firestore).
5. Clique **Terminer**.

## 5.9 Récupérer la "config web" du projet

C'est l'étape **la plus importante**. Cette config est ce qui dit au code "voilà ton projet Firebase".

1. En haut à gauche de la console, clique sur **l'engrenage** ⚙️ → **Paramètres du projet**.
2. Reste sur l'onglet **Général**.
3. Descends en bas de la page, jusqu'à la section **Tes applications**.
4. Tu vois écrit "Une appli pour démarrer". Clique sur l'**icône web** (le `</>`).
5. **Surnom de l'application** : tape `family-hub-web`.
6. **NE PAS cocher** "Configurer également Firebase Hosting" (on l'a déjà activé).
7. Clique **Enregistrer l'application**.
8. Firebase t'affiche un encadré avec du code JavaScript. Repère le bloc qui ressemble à :

```javascript
const firebaseConfig = {
  apiKey: "AIza...XYZ",
  authDomain: "family-hub-TONNOM.firebaseapp.com",
  projectId: "family-hub-TONNOM",
  storageBucket: "family-hub-TONNOM.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef..."
};
```

> 📋 **Copie ce bloc dans un fichier texte temporaire** (Notepad sur Windows, TextEdit sur Mac). On en aura besoin en section 6. C'est OK que ce soit "secret" : ces valeurs sont publiques (on les met dans le code source). La sécurité vient des règles Firestore qu'on déploiera, pas de ces clés.

9. Clique **Continuer vers la console**.

## 5.10 Configurer les domaines autorisés (Auth)

Pour que la connexion Google fonctionne sur ton URL `family-hub-TONNOM.web.app` :

1. Toujours dans Firebase, dans le menu de gauche, **Authentication** → onglet **Settings** (Paramètres).
2. Section **Domaines autorisés** (Authorized domains).
3. Vérifie que `family-hub-TONNOM.firebaseapp.com` et `family-hub-TONNOM.web.app` sont dans la liste. Si non, clique **Ajouter un domaine** et ajoute-les.

## 5.11 (Important) Activer l'API Cloud Build & autres

Pour que le déploiement des Cloud Functions marche, certaines APIs Google Cloud doivent être activées. **Bonne nouvelle** : Firebase les active automatiquement la première fois qu'on déploie des fonctions, donc tu n'as **rien à faire ici manuellement**. Ça peut prendre 1-2 minutes la première fois.

## ✅ Récap section 5

À ce stade, tu devrais avoir :
- ✅ Un projet Firebase nommé `family-hub-TONNOM`
- ✅ Plan Blaze activé avec alerte budget à 1 €
- ✅ Auth Google activé
- ✅ Firestore créé en europe-west
- ✅ Hosting et Storage initialisés
- ✅ Une "config web" copiée dans un fichier texte temporaire

---

# 6. Cloner et configurer le code (~20 min)

Maintenant on télécharge le code source et on le configure pour qu'il pointe sur **ton** projet Firebase (pas le mien).

## 6.1 Choisir où mettre le projet sur ton ordi

Tu vas télécharger un dossier d'environ 200 Mo (avec les dépendances). Choisis un endroit pratique :

- **Windows** : `C:\Users\TonNom\Desktop\family-hub` ou `C:\Users\TonNom\Documents\family-hub`
- **Mac** : `~/Documents/family-hub` ou `~/Desktop/family-hub`

> 💡 **Évite les chemins avec des espaces ou des accents** dans le nom (ex: pas de "Mes Documents"). Préfère un dossier sans espace.

## 6.2 Cloner le projet GitHub

Dans ton terminal (PowerShell ou Terminal), tape ces commandes une par une.

### Aller sur ton bureau

#### Sur Windows

```powershell
cd $HOME\Desktop
```

#### Sur Mac

```bash
cd ~/Desktop
```

### Cloner le projet

```powershell
git clone https://github.com/galexandre81/familyhub.git family-hub
```

> ⏳ Le téléchargement prend 30 secondes — 1 minute.

Une fois fini, tu vois le dossier `family-hub` apparaître sur ton bureau.

### Entrer dans le dossier

```powershell
cd family-hub
```

> 💡 À partir de maintenant, **toutes les commandes du guide doivent être exécutées depuis ce dossier**. Si tu fermes le terminal et rouvres, refais `cd` jusqu'au dossier.

## 6.3 Installer les dépendances

Le projet utilise des centaines de "bibliothèques" (du code écrit par d'autres). On les installe en une seule commande :

```powershell
npm install
```

> ⏳ La première fois, **ça prend 5 à 10 minutes**. Le terminal va afficher beaucoup de texte. C'est normal. Tant qu'il n'y a pas le mot `error` à la fin, tout va bien.
>
> Tu peux ignorer les messages qui commencent par `warning` ou `WARN`. Ils sont normaux.

## 6.4 Configurer ton projet Firebase dans le code

### Étape 1 : modifier `.firebaserc`

Le fichier `.firebaserc` (avec un point devant) dit à Firebase CLI à quel projet déployer.

Ouvre le dossier `family-hub` dans **VS Code** (si tu l'as installé) ou un éditeur de texte simple :
- Sur Windows : clic droit sur le dossier → "Ouvrir avec Code" si VS Code est installé, sinon **Notepad++** ou même **Bloc-notes**.
- Sur Mac : **TextEdit** marche, mais utilise plutôt VS Code si tu peux.

Dans le fichier `.firebaserc`, tu verras :

```json
{
  "projects": {
    "default": "family-hub-guillaume"
  }
}
```

**Remplace** `family-hub-guillaume` par **ton** identifiant de projet Firebase (celui de la section 5.2). Sauvegarde.

Exemple final :

```json
{
  "projects": {
    "default": "family-hub-dupont"
  }
}
```

### Étape 2 : créer `apps/hub/.env.local`

Ce fichier dit au code web "voici les clés Firebase à utiliser" — c'est la "config web" de la section 5.9.

1. Dans le dossier `apps/hub`, crée un nouveau fichier nommé exactement `.env.local` (avec le point devant, **sans extension** `.txt`).
   - Sur Windows, dans l'Explorateur, clic droit dans `apps/hub` → Nouveau → Document texte → renomme-le en `.env.local` (et accepte le warning sur l'extension).
   - **Plus simple** : ouvre VS Code dans `apps/hub`, clique "Nouveau fichier", tape `.env.local`.
2. Ouvre ce fichier.
3. Reprends la "config web" Firebase que tu as copiée en section 5.9, et **convertis-la** dans ce format :

```env
VITE_FIREBASE_API_KEY=AIza...XYZ
VITE_FIREBASE_AUTH_DOMAIN=family-hub-TONNOM.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=family-hub-TONNOM
VITE_FIREBASE_STORAGE_BUCKET=family-hub-TONNOM.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef...
```

> ⚠️ **Pas de guillemets**, **pas d'espaces** autour du `=`. Une variable par ligne. Utilise les **vraies** valeurs de ton projet (récupérées section 5.9), pas celles de l'exemple.

Sauvegarde.

### Étape 3 : créer `apps/display/public/js/firebase-config.js`

Le site iPad (display) utilise une config légèrement différente (vieille syntaxe pour iPad mini 1 sous iOS 9).

1. Va dans `apps/display/public/js/`
2. Le fichier `firebase-config.js` existe peut-être déjà avec mes valeurs. Ouvre-le.
3. Remplace son contenu par :

```javascript
window.firebaseConfig = {
  apiKey: "AIza...XYZ",
  authDomain: "family-hub-TONNOM.firebaseapp.com",
  projectId: "family-hub-TONNOM",
  storageBucket: "family-hub-TONNOM.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef..."
};
```

Avec **tes** valeurs Firebase, comme dans le `.env.local`.

> ⚠️ Garde **les guillemets**, **les virgules**, **les accolades**. Si tu doutes, copie-colle l'exemple ci-dessus et remplace seulement les valeurs après les `:`.

Sauvegarde.

## 6.5 Première compilation

Pour vérifier que tout est correctement configuré, on compile le projet :

```powershell
npm run build
```

> ⏳ Ça prend 1-2 minutes la première fois.

Si tout va bien, à la fin tu verras :

```
✓ built in 5.34s
[copy-display] copied ...
```

> 🚨 **Si tu vois des erreurs rouges** :
> - Vérifie que `apps/hub/.env.local` contient bien les 6 lignes avec les vraies valeurs.
> - Vérifie que `.firebaserc` contient bien ton projectId.
> - Si erreur "Cannot find module" : refais `npm install`.
> - Section 12 a la liste des erreurs fréquentes.

## ✅ Récap section 6

- ✅ Code cloné dans `family-hub` sur ton bureau
- ✅ Dépendances installées (`npm install` réussi)
- ✅ `.firebaserc` pointe vers ton projet
- ✅ `apps/hub/.env.local` créé avec ta config web
- ✅ `apps/display/public/js/firebase-config.js` mis à jour
- ✅ Compilation réussie (`npm run build`)

---

# 7. Premier déploiement (~15 min)

## 7.1 Se connecter à Firebase CLI

Dans le terminal (toujours dans le dossier `family-hub`) :

```powershell
firebase login
```

Le terminal te demande si tu acceptes l'envoi de stats anonymes (peu importe, choisis Y ou N).

Puis ton navigateur s'ouvre automatiquement avec la page de connexion Google. Connecte-toi avec **le même compte Google** que celui de la console Firebase.

Quand le navigateur affiche "Firebase CLI Login Successful", reviens dans le terminal — il devrait afficher "Success! Logged in as ton-email@gmail.com".

## 7.2 Vérifier que CLI parle au bon projet

```powershell
firebase projects:list
```

Tu devrais voir une liste avec ton projet `family-hub-TONNOM` dedans, avec une étoile ou la mention `(current)`.

Si non, force le bon projet :

```powershell
firebase use family-hub-TONNOM
```

(Remplace `family-hub-TONNOM` par ton vrai identifiant.)

## 7.3 Déployer les règles Firestore et les indexes

```powershell
firebase deploy --only firestore
```

> ⏳ ~30 secondes.

Si c'est OK, tu verras `+ Deploy complete!`.

## 7.4 Déployer les Cloud Functions

```powershell
firebase deploy --only functions
```

> ⏳ **La toute première fois, c'est long : 5 à 10 minutes**. Firebase doit activer plein d'APIs Google Cloud derrière. Sois patiente, regarde une vidéo en attendant.

> 🚨 **Erreurs possibles** :
> - "Billing account is required" : ton plan Blaze n'est pas activé. Retourne section 5.3.
> - "Cloud Build API has not been used" : Firebase essaie d'activer automatiquement, attends et relance.
> - "Permission denied" : ton compte Google n'a pas le bon accès au projet. Refais `firebase login` avec le compte qui a créé le projet en 5.2.

À la fin, tu devrais voir un truc comme :

```
+ functions[refreshWeatherTile(europe-west1)] Successful create operation.
+ functions[scheduledRecipeTodayRefresh(europe-west1)] Successful create operation.
... (etc, ~14 fonctions au total)
+ Deploy complete!
```

## 7.5 Déployer le site web (Hosting)

```powershell
firebase deploy --only hosting
```

> ⏳ ~30 secondes.

À la fin :

```
+ hosting[family-hub-TONNOM]: release complete
+ Deploy complete!

Hosting URL: https://family-hub-TONNOM.web.app
```

🎉 **Bravo. Ton site est en ligne.** Ouvre l'URL `https://family-hub-TONNOM.web.app` dans ton navigateur.

## 7.6 Vérifier que ça marche

Sur l'URL, tu devrais voir une page de connexion "Family Hub" avec un bouton **Se connecter avec Google**.

Clique dessus, choisis ton compte Google.

Tu arrives sur le tableau de bord. Pour l'instant tout est vide — c'est normal, on n'a pas encore créé de foyer. C'est la prochaine étape.

> 🚨 **Erreurs possibles** :
> - **Page blanche** : ouvre la console développeur (F12 → onglet Console). Si tu vois "Firebase config not found" ou similaire, ton `.env.local` est mal rempli. Vérifie.
> - **"Auth/unauthorized-domain"** : retourne section 5.10 et vérifie les domaines autorisés.

## ✅ Récap section 7

- ✅ Connectée à Firebase via CLI
- ✅ Règles Firestore déployées
- ✅ Cloud Functions déployées
- ✅ Site web en ligne sur `https://family-hub-TONNOM.web.app`
- ✅ Connexion Google fonctionnelle

---

# 8. Configurer ton foyer (~30 min)

Maintenant tu vas créer ton foyer dans le système, ajouter les profils famille, et configurer un premier display (iPad).

## 8.1 Créer le foyer

1. Sur ton site, après connexion, va dans **Paramètres** (engrenage en haut à droite).
2. Clique **Créer mon foyer** ou similaire.
3. Renseigne :
   - **Nom du foyer** : ex `Famille Dupont`
   - **Localisation** : tape ta ville, sélectionne dans la liste qui apparaît. Ça récupère lat/lon/timezone automatiquement.
   - **Langue** : Français
   - **Système d'unités** : Métrique
4. Clique **Créer**.

## 8.2 Choisir ton thème UI

Toujours dans **Paramètres**, descends à la section **Thème de l'interface**.

6 thèmes au choix :
- **Caractère** (défaut, noir + laiton + crème)
- **Forêt** (vert profond + or)
- **Marine** (bleu nuit + cuivre)
- **Bordeaux** (rouge sombre + or rose)
- **Glacier** (gris-bleu + argent)
- **Lin** (clair, ivoire + caramel + brun)

Clique sur celui qui te plaît, ça s'applique immédiatement et c'est partagé avec tous tes futurs displays.

## 8.3 Créer les profils famille

1. **Paramètres** → **Profils famille**.
2. Clique **+ Nouveau profil** pour chaque membre de ta famille :
   - Nom (ex: Marie)
   - Initiale (M)
   - Couleur (color picker)
   - Emoji optionnel (🦊, 🐻, etc.)
   - Date de naissance (optionnel — sert à afficher l'âge dans le wizard)
   - Régimes (ex: végétarien, sans porc)
   - Aversions (ex: champignons, endives)
   - Objectifs nutrition (ex: plus de légumes verts)
   - Préférences cuisson (ex: viande bien cuite)
   - Notes libres (ex: "n'aime pas trop épicé")
3. **Crée tous les membres présents aux repas**, c'est ce qui guidera Claude.ai pour le menu.

## 8.4 Créer un display (iPad cuisine, mobile, etc.)

Un "display" est un écran qui affiche les tuiles. Tu peux en avoir plusieurs (iPad cuisine, mobile pour la liste de courses, tablette du salon…).

1. Dans la nav du haut, clique **Écrans**.
2. Clique **+ Nouvel écran**.
3. **Nom** : ex `iPad cuisine`
4. **Type d'appareil** : choisis selon le device cible
   - `ipad-mini-1` : iPad mini 1ère génération (très vieux, vu chez toi en cuisine)
   - `modern-tablet` : iPad récent, autre tablette
   - `mobile` : téléphone portable
   - `desktop` : ordinateur, écran mural moderne
5. **Résolution** : laisse les valeurs par défaut suggérées
6. **Thème** : `dark` ou `light` selon préférence
7. **Configuration de la grille** :
   - 4 colonnes × 3 lignes pour iPad mini cuisine
   - 2 colonnes × 4 lignes pour mobile
8. Clique **Créer**.

## 8.5 Ajouter des tuiles à ce display

Tu viens de créer un display vide. Maintenant tu choisis quelles tuiles afficher.

D'abord il faut **créer les tuiles** dans la bibliothèque de tuiles, puis on les place dans le layout du display.

### Créer les tuiles

1. Dans la nav du haut, clique **Tuiles**.
2. Clique **+ Nouvelle tuile**.
3. **Type** : choisis dans la liste :
   - **Horloge** : affiche l'heure
   - **Météo** : météo de la ville (sélectionne la ville)
   - **Radio** : lecteur de radios web (avec presets)
   - **Minuteur** : timers de cuisine partagés
   - **Calendrier** : agenda Google (optionnel, voir section 10)
   - **Recette du jour** : recipe-today (recette du repas en cours)
   - **Menu de la semaine** : weekly-menu (grille 7×3)
   - **Liste de courses** : shopping-list (avec Web Share Keep)
   - **Livre de recettes** : livre-recettes (recherche/filtres)
4. Renseigne nom + paramètres spécifiques au type.
5. Clique **Créer**.

**Crée les tuiles que tu veux** sur ton display cuisine. Pour démarrer, je conseille :
- Horloge
- Météo (ta ville)
- Recette du jour
- Menu de la semaine
- Livre de recettes
- Minuteur

### Placer les tuiles dans le display

1. Retourne dans **Écrans**, clique sur ton display.
2. Tu vois une grille vide (4×3 si iPad mini cuisine).
3. Pour chaque case, clique → choisis la tuile à mettre.
4. Quand tu es satisfaite, clique **Enregistrer**.

## 8.6 Pairer ton display physique (l'iPad)

Le display est créé côté serveur, mais l'iPad ne sait pas encore qu'il est ce display-là. On va le "pairer".

1. Dans **Écrans**, clique sur ton display.
2. Clique **Configurer cet écran** (en haut).
3. Une fenêtre s'ouvre avec un **QR code** + un **lien court** + un **token temporaire**.
4. Sur l'iPad cuisine (ou autre device cible) :
   - Ouvre Safari (ou Chrome)
   - Va sur l'URL `https://family-hub-TONNOM.web.app/display/`
   - On te demande "Configurer ce display ?" — clique **Setup**.
   - Tape ou colle le **token** affiché dans le QR code.
5. L'iPad se charge, et hop, il affiche maintenant les tuiles configurées.

> 💡 **Astuce iPad** : sur l'iPad cuisine, ajoute le site à l'**écran d'accueil** (Safari → Partager → Sur l'écran d'accueil). Ça donne une icône comme une vraie app, sans la barre d'adresse.

## ✅ Récap section 8

- ✅ Foyer créé avec localisation et thème
- ✅ Profils famille créés
- ✅ Au moins un display créé avec des tuiles
- ✅ iPad / mobile pairé sur ce display

---

# 9. Premier plan repas avec Claude.ai (~15 min)

C'est le **moment fun**. On va générer un plan de repas avec Claude.ai pour la semaine.

## 9.1 Pré-requis

- Un compte **Claude.ai** : [https://claude.ai](https://claude.ai). Le plan **Pro** (~ 20 €/mois) est recommandé pour des conversations longues — mais le plan gratuit peut marcher pour 1-2 plans par mois.
- Tes **profils famille créés** (section 8.3)

## 9.2 Lancer le wizard

1. Sur ton hub, va dans **Menu** (nav du haut).
2. Clique **+ Nouveau plan**.
3. **Étape 1 — Date** : choisis la date du **lundi de la semaine** que tu veux planifier. Par défaut le prochain lundi.
4. **Étape 2 — Présence** : pour chaque slot (jour × repas), coche les profils présents :
   - Par défaut tout le monde est présent.
   - Décoche les exceptions (Marie au boulot mardi midi, Pierre chez sa mère samedi soir, etc.).
   - Le toggle **⚡ express** force Claude à choisir une recette ≤ 15 min pour ce slot — tous les petits-déjeuners en express par défaut.
5. **Étape 3 — Contexte** :
   - **Batch cooking OK ?** : oui si tu acceptes une session de prep batch le dimanche aprem.
   - **Jour des courses (optionnel)** : si défini, Claude évite de placer le batch ce jour-là.
   - **Style ou envie** : texte libre, ex: "léger et végé cette semaine, on est crevés".
   - **À écouler du frigo** : liste les restes / ingrédients à utiliser, un par ligne. Claude les utilisera en priorité.
6. Clique **Créer le brouillon**.

## 9.3 Étape 4 — Export pour Claude.ai

Tu arrives sur l'étape Review avec **4 cartes numérotées**.

### Carte 1 : copier le prompt

Clique **Copier le prompt**. Le prompt est maintenant dans ton presse-papier.

### Carte 2 : télécharger le .md

Clique **Télécharger plan-AAAA-MM-JJ.md**. Le fichier descend sur ton disque (dans `Downloads` typiquement).

Ouvre ce fichier avec **Bloc-notes** (Win) ou **TextEdit** (Mac) — tu peux le visualiser, c'est juste du texte structuré qui dit "voici la famille, voici la présence, voici le frigo, voici l'historique récent".

### Carte 3 : aller sur Claude.ai

1. Ouvre [https://claude.ai](https://claude.ai) dans un nouvel onglet.
2. **Démarre une nouvelle conversation** (bouton "+ Nouvelle conversation" ou similaire).
3. **Colle le prompt** copié à la carte 1 (Ctrl+V / Cmd+V) dans la zone de message.
4. **Sans envoyer**, ouvre le fichier `.md` téléchargé en carte 2, sélectionne tout (Ctrl+A), copie (Ctrl+C).
5. Dans Claude.ai, **après le prompt** (à la suite, dans le même message), colle le contenu du `.md` (Ctrl+V).
6. **Envoie** ce gros message à Claude.

Claude va lire et répondre avec **un menu proposé en français** : pour chaque slot, un plat principal + accompagnement. Il te demande à la fin si ça te va.

> 💡 **Tu peux dialoguer avec Claude** : "remplace mardi soir par un poisson", "moins de viande rouge", "ajoute un dessert samedi soir", etc. Il itère.

### Carte 4 : récupérer le JSON

Quand le menu te plaît, **dis explicitement** "OK génère le JSON" à Claude.

Il te répond en générant un **artefact** (un encadré spécial) contenant un JSON. **Sélectionne tout le JSON** et copie-le (Ctrl+C).

## 9.4 Importer le plan

1. Retourne sur Family Hub, sur l'étape Review.
2. Clique **J'ai le JSON, importer le plan →**. Tu arrives sur la page d'import.
3. **Colle le JSON** dans la grande zone de texte.
4. Clique **Valider le JSON**.
   - ✅ Si valide : tu vois un récap (X recettes, X slots, X items de courses) + le commentaire de Claude.
   - ❌ Si invalide : tu vois la liste des erreurs. Le plus souvent c'est que Claude a oublié un champ. Retourne lui demander "tu as oublié X, regénère le JSON".
5. Clique **Importer et activer le plan**.
6. Quelques secondes plus tard, tu es redirigée sur `/menu` avec ton **plan actif**.

## 9.5 Profiter du résultat

- **Sur le hub web** (`/menu`) : tu vois la grille semaine, le batch cooking proposé, la liste de courses agrégée. Tu peux cliquer sur n'importe quelle recette pour la voir en détail (ingrédients + étapes).
- **Sur ton iPad cuisine** : la tuile **Recette du jour** affiche maintenant la recette du moment (déjà ce midi par exemple). Tap → mode cuisine plein écran avec timers.
- **Sur ton mobile** : ouvre `/menu`, descends à **Liste de courses**, clique **Envoyer aux courses**, choisis **Keep**. La liste arrive dans Google Keep.

## ✅ Récap section 9

- ✅ Plan généré avec Claude.ai
- ✅ JSON importé dans Family Hub
- ✅ Plan actif visible sur tous les écrans

---

# 10. Optionnel : calendrier Google iCal

> 🟡 **Cette section est optionnelle**. Tu peux l'ignorer pour l'instant et y revenir plus tard quand tu maîtrises le reste.

Si tu veux que la **tuile Calendrier** affiche les événements de ton agenda Google familial, voici comment :

## 10.1 Récupérer l'URL privée iCal

1. Va sur [https://calendar.google.com](https://calendar.google.com)
2. À gauche, dans la liste **Mes agendas**, survole l'agenda que tu veux afficher (ex: "Famille") → 3 points → **Paramètres et partage**.
3. Descends jusqu'à **Adresse secrète au format iCal**.
4. Copie l'URL (commence par `https://calendar.google.com/calendar/ical/...`).

> ⚠️ Cette URL est secrète : qui l'a peut voir tous tes événements. Ne la partage pas, ne la commit pas dans Git.

## 10.2 La stocker comme secret Firebase

Dans le terminal, dans le dossier `family-hub` :

```powershell
firebase functions:secrets:set CALENDAR_ICAL_URL
```

Le terminal te demande la valeur du secret. **Colle ton URL iCal**, appuie Entrée.

## 10.3 Redéployer les fonctions

```powershell
firebase deploy --only functions
```

## 10.4 Configurer la tuile Calendrier

Si pas déjà fait, dans **Tuiles** sur ton hub :
1. **+ Nouvelle tuile** → type **Calendrier**.
2. Configure (nb de jours à afficher, max events).
3. Crée. Une synchronisation initiale se fait à la création.
4. Place la tuile dans le layout d'un display.

> Le scheduler Firebase rafraîchit l'agenda toutes les 15 minutes automatiquement.

---

# 11. Maintenance courante

Une fois Family Hub installé, tu n'as pas grand-chose à faire au quotidien. Mais pour :
- **Mettre à jour le code** (récupérer les nouveautés que je publie)
- **Surveiller la facture** Firebase
- **Voir les logs en cas de bug**

## 11.1 Mettre à jour le code

Quand le repo GitHub est mis à jour, tu peux récupérer les changements :

```powershell
cd C:\Users\TonNom\Desktop\family-hub        # ou ~/Desktop/family-hub sur Mac
git pull
npm install
npm run build
firebase deploy
```

> ⏳ Compte 5-10 minutes total. Le `firebase deploy` est rapide les fois suivantes (les Cloud Functions ne sont mises à jour que si elles ont changé).

## 11.2 Voir les logs des Cloud Functions

Si une fonction plante (ex: la météo ne se rafraîchit plus) :

1. Console Firebase → **Functions** → onglet **Logs**.
2. Filtre par fonction (ex: `refreshWeatherTile`).
3. Lis les erreurs récentes.

Tu peux aussi voir tout dans le terminal :

```powershell
firebase functions:log
```

## 11.3 Surveiller la facture Firebase

1. Console Firebase → engrenage → **Utilisation et facturation**.
2. Onglet **Détails et paramètres**.
3. Tu vois ta consommation actuelle et le budget.

> 💡 Si tu reçois un mail "alerte budget 50%", checke ce qui consomme. En usage normal famille, c'est très improbable.

## 11.4 Sauvegarde

Firestore est chez Google donc déjà sauvegardé côté infra. Si tu veux une sauvegarde locale de tes données :

1. Console Firebase → **Firestore** → onglet **Sauvegardes**.
2. Active les sauvegardes journalières (gratuit dans une certaine limite).

---

# 12. Si ça plante

## 12.1 Au premier déploiement Cloud Functions

**"Error: Billing account is required"**
→ Le plan Blaze n'est pas activé. Section 5.3.

**"Cloud Build API has not been used in project... before or it is disabled"**
→ Première fois : Firebase active automatiquement. Attends 1-2 min et relance `firebase deploy --only functions`.

**"functions: failed to create function" + permission**
→ Ton compte Google doit être propriétaire (owner) du projet. Va dans Console Firebase → engrenage → Utilisateurs et permissions, vérifie ton rôle.

**Le déploiement reste bloqué très longtemps**
→ Annule (Ctrl+C dans le terminal), réessaie. La première fois, Firebase doit construire des images Docker pour chaque fonction, ça peut être long. Si ça reste bloqué après 15 min, c'est un problème.

## 12.2 À la connexion sur le site

**Page blanche, console développeur (F12) montre "Firebase config not found"**
→ Ton `apps/hub/.env.local` est mal rempli ou manquant. Section 6.4.

**"Auth/unauthorized-domain"**
→ Domaine pas autorisé. Section 5.10. Vérifie que `family-hub-TONNOM.firebaseapp.com` ET `family-hub-TONNOM.web.app` sont dans la liste.

**Le bouton "Se connecter avec Google" ne fait rien**
→ Auth Google pas activé. Section 5.4.

## 12.3 Sur l'iPad

**"Type inconnu : recipe-today" / "Tuile manquante"**
→ Cache Safari iPad. Clique sur le bouton **Recharger** dans la cellule. Si ça persiste : **Réglages iPad → Safari → Effacer historique et données**.

**Le QR code de pairing ne marche pas**
→ Le token expire après 30 minutes. Régénère un nouveau token depuis le DisplayEditor sur le hub.

**Recettes du jour vide après import**
→ La recette du moment est calculée toutes les 30 min par un cron. Soit tu attends, soit tu retires/remets la tuile (déclenche un refresh).

## 12.4 Dans l'import JSON Claude.ai

**"JSON invalide : ..."**
→ Claude a fait une erreur de format. Retourne lui dire "le JSON est invalide, tu as oublié le champ X" en lui collant le message d'erreur. Il regénère.

**Profils non résolus warning**
→ Claude a écrit "Marie" alors que ton profil est "Marie L." (par exemple). Va modifier les noms dans tes profils, ou laisse le warning (le slot est créé sans ces profils mais reste fonctionnel).

## 12.5 Erreurs npm

**"npm install" échoue avec EACCES sur Mac**
→ Préfixe par `sudo` : `sudo npm install`. Tape ton mot de passe Mac.

**"npm: command not found"**
→ Node.js pas installé ou pas dans le PATH. Refais section 4.2.

**"Cannot find module '...'"** au build
→ Refais `npm install` depuis le dossier `family-hub`.

## 12.6 À qui demander de l'aide

- **Claude.ai** : pose-lui directement ta question, il connaît Firebase et le projet (montre-lui ce ONBOARDING.md, le repo GitHub, ton message d'erreur).
- **Issues GitHub** : ouvre une issue sur [https://github.com/galexandre81/familyhub/issues](https://github.com/galexandre81/familyhub/issues) en décrivant ton souci, en collant l'erreur, et en disant à quelle étape du guide tu en étais.
- **Firebase Support** : pour les problèmes purement Firebase (factu, projet, etc.) → console Firebase → engrenage → **Support**.

---

# 🎉 C'est fini !

Si tu as suivi le guide jusqu'ici, tu as :
- Ton propre Family Hub à `https://family-hub-TONNOM.web.app`
- Un coût mensuel **probablement de 0 €** (sauf si vraiment beaucoup d'usage)
- Tes données chez toi (compte Google personnel)
- La possibilité d'ajouter, modifier, étendre ce que tu veux

**Workflow type d'une famille avec Family Hub** :

| Quand | Ce qui se passe |
|---|---|
| Dimanche soir 20h | Tu lances le wizard plan repas, dialogue avec Claude.ai, importes le JSON. ~10 min. |
| Lundi-dimanche midi | L'iPad cuisine affiche automatiquement la recette du moment. Tap → mode cuisine, timers. |
| Samedi matin | Tu ouvres `/menu` sur ton mobile, tap "Envoyer aux courses" → la liste arrive dans Keep. |
| Au supermarché | Tu coches dans Keep en faisant les courses, hors-ligne. |
| Pizza commandée mardi | Tu marques le slot mardi soir comme "annulé" en un tap sur `/menu`. |

**Bon Family Hub à toi et à ta famille** 🍽️
