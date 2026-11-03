/* remplacements.js — remplacements notés sur les listes de courses, affichés
   dans les recettes de l'iPad (« yaourt à la place de crème »).
   ES5 strict (syntaxe ET fonctions intégrées), Safari 9 / iOS 9.3.6.

   API : FamilyHubRemplacements.lire() : Promise<actifs>, ne rejette jamais.
           actifs : [{ nomArticle, remplacement, recetteIds }]. Résout [] sans
           snapshot « weekly-menu », sans base, en erreur, ou après 20 s (seulement pour libérer la promesse : une réponse tardive reste affichée par les écrans qui attendent encore).
           Lit les plans du snapshot dont la semaine contient aujourd'hui, les
           listes de courses de ces plans (planId), puis leurs articles.
         Fonctions pures *Es5, testées contre apps/hub/src/lib/remplacements.ts
         par packages/design/src/displayRemplacements.test.ts. */
(function (root) {
  'use strict';

  /* ===================== Fonctions pures ===================== */

  var A_ACCENTS = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a', 'ā': 'a',
    'ç': 'c', 'č': 'c',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e', 'ē': 'e', 'ě': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ī': 'i',
    'ñ': 'n', 'ň': 'n',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o', 'ō': 'o',
    'š': 's',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ū': 'u', 'ů': 'u',
    'ý': 'y', 'ÿ': 'y',
    'ž': 'z'
  };

  /* Minuscules, sans accents (table explicite : pas de String.prototype.
     normalize sur Safari 9), œ → oe, æ → ae. */
  function sansAccentsEs5(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/œ/g, 'oe').replace(/æ/g, 'ae')
      .replace(/[^\u0000-\u007f]/g, function (c) {
        return Object.prototype.hasOwnProperty.call(A_ACCENTS, c) ? A_ACCENTS[c] : c;
      });
  }

  /* Comme `normaliserNom` du hub : sans accents, espaces réduits, pluriel
     final s/x retiré de chaque mot de plus de deux lettres. */
  function normaliserNomEs5(nom) {
    var mots = sansAccentsEs5(nom).replace(/^\s+|\s+$/g, '').split(/\s+/);
    var sortie = [];
    for (var i = 0; i < mots.length; i++) {
      var mot = mots[i];
      if (mot.length === 0) continue;
      sortie.push(mot.length > 2 && /[sx]$/.test(mot) ? mot.slice(0, -1) : mot);
    }
    return sortie.join(' ');
  }

  /* Ponctuation retirée avant comparaison (l'apostrophe reste). */
  var PONCTUATION = /[.,;:!?()[\]"«»\-–—\/]/g;

  function cleIngredientEs5(nom) {
    return normaliserNomEs5(String(nom == null ? '' : nom).replace(PONCTUATION, ' '));
  }

  function motsEs5(cle) {
    var bruts = cle.split(' ');
    var out = [];
    for (var i = 0; i < bruts.length; i++) if (bruts[i] !== '') out.push(bruts[i]);
    return out;
  }

  function contientEs5(liste, mot) {
    for (var i = 0; i < liste.length; i++) if (liste[i] === mot) return true;
    return false;
  }

  function contientTousEs5(grand, petit) {
    if (petit.length === 0) return false;
    for (var i = 0; i < petit.length; i++) if (!contientEs5(grand, petit[i])) return false;
    return true;
  }

  /* Lignes d'une recette qui correspondent à l'article : toutes celles de clé
     identique ; sinon, une seule ligne qui contient tous les mots de l'article
     (ou l'inverse) ; zéro ou plusieurs → aucune. */
  function indicesIngredientEs5(nomArticle, ingredients) {
    var liste = ingredients || [];
    var cle = cleIngredientEs5(nomArticle);
    var cles = [];
    var i;
    for (i = 0; i < liste.length; i++) cles.push(cleIngredientEs5(liste[i] && liste[i].libelle));
    var identiques = [];
    for (i = 0; i < cles.length; i++) if (cles[i] === cle) identiques.push(i);
    if (identiques.length > 0) return identiques;
    var motsArticle = motsEs5(cle);
    var proches = [];
    for (i = 0; i < cles.length; i++) {
      var motsLigne = motsEs5(cles[i]);
      if (contientTousEs5(motsLigne, motsArticle) || contientTousEs5(motsArticle, motsLigne)) proches.push(i);
    }
    return proches.length === 1 ? proches : [];
  }

  /* Identité d'un rappel : même article et même remplacement (casse et
     ponctuation sans effet), comme `cleRappel` du hub. */
  function cleRappelEs5(a) {
    return cleIngredientEs5(a.nomArticle) + '|' +
      String(a.remplacement == null ? '' : a.remplacement).replace(/^\s+|\s+$/g, '').toLowerCase();
  }

  /* Remplacements d'une recette ; deux plans en cours qui disent la même chose
     ne donnent qu'un rappel. */
  function remplacementsDeRecetteEs5(actifs, recetteId) {
    var liste = actifs || [];
    var out = [];
    var vus = {};
    for (var i = 0; i < liste.length; i++) {
      if (!liste[i] || !contientEs5(liste[i].recetteIds || [], recetteId)) continue;
      var cle = cleRappelEs5(liste[i]);
      if (Object.prototype.hasOwnProperty.call(vus, cle)) continue;
      vus[cle] = true;
      out.push(liste[i]);
    }
    return out;
  }

  /* Libellé exact d'une ligne → remplacement ; le premier actif gagne.
     Objet nu lu avec hasOwnProperty : un libellé est un texte quelconque
     (« constructor »). */
  function carteRemplacementsEs5(ingredients, actifs) {
    var carte = {};
    var liste = ingredients || [];
    var as = actifs || [];
    for (var a = 0; a < as.length; a++) {
      var idx = indicesIngredientEs5(as[a].nomArticle, liste);
      for (var k = 0; k < idx.length; k++) {
        var libelle = liste[idx[k]].libelle;
        if (!Object.prototype.hasOwnProperty.call(carte, libelle)) carte[libelle] = as[a].remplacement;
      }
    }
    return carte;
  }

  /* Bornes comprises ; dates absentes → faux. */
  function semaineEnCoursEs5(debutISO, finISO, aujourdhuiISO) {
    if (!debutISO || !finISO) return false;
    return debutISO <= aujourdhuiISO && aujourdhuiISO <= finISO;
  }

  /* Début d'application : le plus ancien du premier repas du plan et de ses
     sessions batch (on cuisine parfois le dimanche d'avant) ; comme
     `debutRemplacement` du hub. Sans début de plan : indéfini. */
  function debutRemplacementEs5(debutPlanISO, datesBatchISO) {
    if (!debutPlanISO) return undefined;
    var min = debutPlanISO;
    var dates = datesBatchISO || [];
    for (var i = 0; i < dates.length; i++) if (dates[i] && dates[i] < min) min = dates[i];
    return min;
  }

  /* Plans du snapshot dont la semaine contient aujourd'hui (actifs ou archivés),
     batchs compris : `batchSessions[].date` du snapshot « weekly-menu ». */
  function plansEnCoursEs5(plans, aujourdhuiISO) {
    var liste = plans || [];
    var out = [];
    for (var i = 0; i < liste.length; i++) {
      var p = liste[i];
      if (!p || !p.planId) continue;
      var dates = [];
      var batchs = p.batchSessions || [];
      for (var b = 0; b < batchs.length; b++) dates.push(batchs[b] && batchs[b].date);
      if (semaineEnCoursEs5(debutRemplacementEs5(p.dateDebutISO, dates), p.dateFinISO, aujourdhuiISO)) out.push(p);
    }
    return out;
  }

  function texteRappelEs5(a) {
    return 'Cette semaine : ' + a.remplacement + ' à la place de ' + a.nomArticle;
  }

  /* Jour civil local « AAAA-MM-JJ » d'une date. */
  function dateISOLocaleEs5(d) {
    var m = d.getMonth() + 1;
    var j = d.getDate();
    return d.getFullYear() + '-' + (m < 10 ? '0' : '') + m + '-' + (j < 10 ? '0' : '') + j;
  }

  /* ===================== Lecture (Firestore compat) ===================== */

  var DELAI_MS = 20000;
  var PLANS_MAX = 3;

  /* Articles d'une liste portant un remplacement ; un échec = aucun article. */
  function lireArticles(listes, listeId) {
    return listes.doc(listeId).collection('items').get().then(function (snap) {
      var out = [];
      var docs = (snap && snap.docs) || [];
      for (var i = 0; i < docs.length; i++) {
        var a = docs[i].data() || {};
        if (typeof a.remplacement === 'string' && a.remplacement !== '') {
          out.push({
            nomArticle: String(a.nom == null ? '' : a.nom),
            remplacement: a.remplacement,
            recetteIds: a.recetteIds || []
          });
        }
      }
      return out;
    }).then(null, function () { return []; });
  }

  function lireTout() {
    var db = root.FamilyHubGetDb && root.FamilyHubGetDb();
    var hid = root.FamilyHubGetHouseholdId && root.FamilyHubGetHouseholdId();
    var snapshot = typeof root.FamilyHubGetTileSnapshotByType === 'function'
      ? root.FamilyHubGetTileSnapshotByType('weekly-menu') : null;
    if (!db || !hid || !snapshot) return Promise.resolve([]);
    var plans = plansEnCoursEs5(snapshot.plans, dateISOLocaleEs5(new Date())).slice(0, PLANS_MAX);
    if (plans.length === 0) return Promise.resolve([]);
    var listes = db.collection('households').doc(hid).collection('shoppingLists');
    var lectures = [];
    for (var i = 0; i < plans.length; i++) {
      lectures.push(listes.where('planId', '==', plans[i].planId).get().then(function (snap) {
        var docs = (snap && snap.docs) || [];
        var parListe = [];
        for (var k = 0; k < docs.length; k++) parListe.push(lireArticles(listes, docs[k].id));
        return Promise.all(parListe);
      }).then(null, function () { return []; }));
    }
    return Promise.all(lectures).then(function (parPlan) {
      var actifs = [];
      for (var p = 0; p < parPlan.length; p++) {
        for (var l = 0; l < parPlan[p].length; l++) actifs = actifs.concat(parPlan[p][l]);
      }
      return actifs;
    });
  }

  /* Ne rejette jamais ; [] après DELAI_MS (20 s) sans réponse, pour libérer la promesse. */
  function lire() {
    return new Promise(function (resolve) {
      var fini = false;
      var minuterie = null;
      function finir(actifs) {
        if (fini) return;
        fini = true;
        if (minuterie && root.clearTimeout) root.clearTimeout(minuterie);
        resolve(actifs);
      }
      if (root.setTimeout) minuterie = root.setTimeout(function () { finir([]); }, DELAI_MS);
      try {
        lireTout().then(finir, function () { finir([]); });
      } catch (e) {
        finir([]);
      }
    });
  }

  var api = {
    cleIngredientEs5: cleIngredientEs5,
    indicesIngredientEs5: indicesIngredientEs5,
    carteRemplacementsEs5: carteRemplacementsEs5,
    remplacementsDeRecetteEs5: remplacementsDeRecetteEs5,
    semaineEnCoursEs5: semaineEnCoursEs5,
    plansEnCoursEs5: plansEnCoursEs5,
    debutRemplacementEs5: debutRemplacementEs5,
    texteRappelEs5: texteRappelEs5,
    dateISOLocaleEs5: dateISOLocaleEs5,
    lire: lire
  };

  if (root) root.FamilyHubRemplacements = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
