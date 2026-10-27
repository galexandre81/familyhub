/* FICHIER GÉNÉRÉ — ne pas modifier. Valeurs de packages/controle-parental/src/schema.ts
   (node scripts/copier-controle-parental-functions.mjs). ES5 : lu par l'iPad. */
(function (root) {
  root.FamilyHubSchemaPc = {
    "ACTION_NEXTDNS": {
      "rapport": "report",
      "debloquer": "allow",
      "bloquer": "block",
      "retirer": "remove"
    },
    "CHAMPS_DEMANDE_PARENT": [
      "status",
      "response",
      "handledBy",
      "handledAt"
    ],
    "CHAMP_ABONNE": {
      "jetons": "pushTokens",
      "majLe": "updatedAt"
    },
    "CHAMP_APPLI": {
      "autorisee": "allowed",
      "categorie": "category"
    },
    "CHAMP_CATALOGUE": {
      "nom": "name",
      "categorie": "category",
      "categorieParDefaut": "defaultCategory",
      "autorisee": "allowed",
      "raison": "reason"
    },
    "CHAMP_CHANGEMENT": {
      "quand": "at",
      "valeur": "value"
    },
    "CHAMP_CONFIG": {
      "foyer": "householdId",
      "compteAppareil": "deviceUid",
      "nom": "displayName",
      "versionSchema": "schemaVersion",
      "planning": "schedule",
      "defauts": "defaults",
      "exception": "override",
      "reinitialiserLocalAvant": "resetLocalBefore",
      "listeEcole": "schoolAllowlist",
      "applis": "apps",
      "limites": "categoryLimits",
      "executablesInconnus": "unknownExecutables",
      "nomsParents": "parentLabels",
      "modifieLe": "updatedAt",
      "modifiePar": "updatedBy"
    },
    "CHAMP_DEMANDE": {
      "id": "id",
      "creeeLe": "createdAt",
      "de": "from",
      "type": "type",
      "detail": "detail",
      "message": "message",
      "dureeMinutes": "durationMinutes",
      "statut": "status",
      "reponse": "response",
      "traitePar": "handledBy",
      "traiteLe": "handledAt"
    },
    "CHAMP_ETAT": {
      "pc": "pc",
      "internet": "internet",
      "mode": "mode",
      "libelleMode": "modeLabel",
      "reseau": "network",
      "resume": "summary",
      "prochainChangement": "nextChange",
      "exceptionsActives": "activeOverrides",
      "sessionOuverte": "sessionActive",
      "fermetureA": "lockPendingAt",
      "minutesDuJour": "todayMinutes",
      "applisRefusees": "deniedApps",
      "vuLe": "lastSeen",
      "heureSimulee": "simulatedTime",
      "version": "version",
      "modeDistant": "remoteMode",
      "erreurDistante": "remoteError",
      "erreursConfig": "configErrors",
      "sauvegarde": "backup",
      "catalogue": "apps",
      "heurePc": "deviceTime"
    },
    "CHAMP_EVENEMENT": {
      "quand": "time",
      "appli": "app",
      "chemin": "path",
      "resultat": "result",
      "service": "service",
      "executable": "exe",
      "action": "action",
      "date": "date",
      "detail": "detail"
    },
    "CHAMP_EXCEPTION_ACTIVE": {
      "valeur": "value",
      "jusqua": "until",
      "source": "source",
      "par": "by"
    },
    "CHAMP_PLAGE": {
      "debut": "start",
      "fin": "end"
    },
    "CHAMP_PRIVE_NEXTDNS": {
      "profil": "profileId"
    },
    "CHAMP_RAPPORT": {
      "jour": "day",
      "visites": "visitedSites",
      "bloques": "blockedSites",
      "toujoursAutorises": "alwaysAllowed",
      "toujoursBloques": "alwaysBlocked",
      "requetesDuMois": "monthQueries",
      "limiteDuMois": "monthLimit",
      "majLe": "updatedAt"
    },
    "CHAMP_REGLE": {
      "pc": "pc",
      "internet": "internet",
      "mode": "mode",
      "jusqua": "until",
      "par": "by",
      "poseLe": "setAt"
    },
    "CHAMP_SAUVEGARDE": {
      "date": "date",
      "resultat": "resultat",
      "code": "code"
    },
    "CHAMP_SITE": {
      "domaine": "siteName",
      "requetes": "count"
    },
    "CHAMP_USAGE": {
      "date": "date",
      "secondesSession": "sessionSeconds",
      "secondesActives": "activeSeconds",
      "secondesParAppli": "apps",
      "nomsApplis": "appNames",
      "secondesParCategorie": "categories",
      "lancementsRefuses": "deniedLaunches",
      "codeParent": "parentCodeUses",
      "executablesInconnus": "unknownExecutables",
      "vpnBloques": "blockedVpn",
      "limitesAtteintes": "limitReached",
      "majLe": "updatedAt"
    },
    "CLE_JOUR": [
      "sun",
      "mon",
      "tue",
      "wed",
      "thu",
      "fri",
      "sat"
    ],
    "COLLECTION_APPAREILS": "devices",
    "DOC_ETAT_COURANT": "current",
    "DOC_PRIVE_NEXTDNS": "nextdns",
    "DOC_RAPPORT_NEXTDNS": "nextdns",
    "FONCTION_NEXTDNS": "nextdnsAppareil",
    "FRAICHEUR_RAPPORT_MS": 300000,
    "JUSQUA_NOUVEL_ORDRE_MS": 4102444800000,
    "LISTE_ECOLE_INITIALE": [
      "index-education.net",
      "index-education.com",
      "educonnect.education.gouv.fr",
      "education.gouv.fr",
      "gstatic.com",
      "googleapis.com",
      "accounts.google.com",
      "eclat-bfc.fr",
      "larousse.fr",
      "lerobert.com"
    ],
    "MAX_JETONS_PAR_PARENT": 10,
    "PREFIXE_AUTRE_APPLI": "autre:",
    "PREFIXE_INTERNE": "_",
    "QUOTA_GRATUIT_NEXTDNS": 300000,
    "SEUIL_ALERTE_QUOTA": 0.7,
    "SOUS_COLLECTION": {
      "etat": "status",
      "usage": "usage",
      "demandes": "requests"
    },
    "SOUS_COLLECTION_ABONNES": "notifySubscribers",
    "SOUS_COLLECTION_PRIVE": "private",
    "SOUS_COLLECTION_RAPPORTS": "reports",
    "SUFFIXE_ETAT": {
      "raison": "Reason",
      "source": "Source",
      "jusqua": "Until"
    },
    "VALEUR": {
      "pc": {
        "autorise": "allowed",
        "verrouille": "locked"
      },
      "internet": {
        "complet": "filtered",
        "ecole": "school",
        "coupe": "blocked"
      },
      "mode": {
        "devoirs": "devoirs",
        "devoirsInternet": "devoirs_internet",
        "libre": "libre",
        "libreInternet": "libre_internet"
      },
      "reseau": {
        "ecole": "school",
        "complet": "filtered",
        "coupe": "blocked"
      },
      "categorie": {
        "ecole": "ecole",
        "creation": "creation",
        "jeu": "jeu",
        "autre": "autre"
      },
      "source": {
        "exception": "override",
        "local": "local",
        "codeParent": "code",
        "planning": "schedule",
        "defaut": "default"
      },
      "typeDemande": {
        "temps": "time",
        "site": "site",
        "appli": "app",
        "mode": "mode",
        "autre": "other"
      },
      "statutDemande": {
        "enAttente": "pending",
        "acceptee": "approved",
        "refusee": "denied",
        "traitee": "done"
      },
      "executablesInconnus": {
        "signaler": "report",
        "fermer": "kill"
      },
      "resultatCode": {
        "ok": "ok",
        "echec": "echec"
      },
      "resultatSauvegarde": {
        "ok": "ok",
        "echec": "echec",
        "nonConnecte": "non_connecte"
      }
    },
    "VERSION_SCHEMA": 1
  };
})(typeof window !== 'undefined' ? window : this);
