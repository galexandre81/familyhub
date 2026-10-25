/* mode-recette.js — mode recette de l'iPad : tout le repas d'un coup.
   ES5 strict (syntaxe ET fonctions intégrées), Safari 9 / iOS 9.3.6.

   API : FamilyHubModeRecette.ouvrir({ recetteIds, titre?, portions?, noms? })
           titre : sinon le nom de la première recette ;
           noms : { id: nom } connus de l'appelant (ex. recetteNoms du menu),
             affichés si la recette est indisponible.
         FamilyHubModeRecette.fermer() / estOuvert()
         FamilyHubModeRecette.memoriser(id, donnees) : confie une copie déjà en
           main (recette du livre) ; memoriserListe(recettes) : idem pour une
           liste d'objets portant recetteId (ou id), ex. snapshot.recettes de la
           tuile « À cuisiner ». Le TABLEAU (prochain repas) fait pareil avant
           ouvrir() avec les recettes de son snapshot.
         Champs lus : nom, portions, tempsPrepMinutes, tempsCuissonMinutes,
           ingredients[{ libelle, quantite, unite }], etapes[{ ordre,
           description, dureeMinutes? }] (doc Firestore ou copie du snapshot).
   Même écran depuis le prochain repas (tableau), le menu de la semaine et le
   livre de recettes.

   Écran plein (z-index 500 : au-dessus du tableau et du plein écran des
   tuiles (200), sous le bandeau d'alarme (10000)) :
   - barre haute : « Fermer » (72 px), titre, portions −/+ ;
   - colonne gauche (≈ 2/3) : toutes les étapes de toutes les recettes du repas,
     plat d'abord ; SEULE zone qui défile ; « Lancer N min » sur les étapes
     avec durée (nom du minuteur = début de l'étape) ;
   - colonne droite fixe : ingrédients regroupés par recette en haut (défilent
     seuls si la liste est longue), panneau des minuteurs en dessous (« Autre »
     ouvre le choix de durée DANS la colonne, sans quitter la recette).
   Lecture réseau d'abord (households/{hid}/recettes/{id} ; l'iPad tourne
   jour et nuit : pas de copie périmée quand le réseau répond). La copie en
   mémoire (dernière lecture ou memoriser) ne sert qu'en secours : lecture en
   échec, ou sans réponse après DELAI_RESEAU_MS. Sans copie, abandon après
   DELAI_SANS_COPIE_MS → « Recette indisponible sans réseau ». Recette
   introuvable (ou lecture refusée en ligne) → « Recette indisponible :
   <nom> » à sa place dans le repas ; le minuteur marche quand même.

   Les fonctions *Es5 sont pures et testées (packages/design/src/
   displayModeRecette.test.ts) contre apps/hub/src/lib/repasCuisine.ts. */
(function (root) {
  'use strict';

  /* ===================== Fonctions pures ===================== */

  /* Recettes du repas dans l'ordre donné (plat principal d'abord), doublons
     ignorés ; `recettes` : id → données (absent = manquante). */
  function assemblerRepasEs5(ids, recettes) {
    var vus = {};
    var presentes = [];
    var manquantes = [];
    var liste = ids || [];
    var src = recettes || {};
    for (var i = 0; i < liste.length; i++) {
      var id = liste[i];
      if (Object.prototype.hasOwnProperty.call(vus, id)) continue;
      vus[id] = true;
      var r = Object.prototype.hasOwnProperty.call(src, id) ? src[id] : undefined;
      if (r) presentes.push({ id: id, recette: r });
      else manquantes.push(id);
    }
    return { presentes: presentes, manquantes: manquantes };
  }

  /* Recettes du repas dans l'ordre donné, doublons ignorés, chacune à sa
     place : { id, recette } (recette null si introuvable). */
  function repasOrdonneEs5(ids, recettes) {
    var vus = {};
    var out = [];
    var liste = ids || [];
    var src = recettes || {};
    for (var i = 0; i < liste.length; i++) {
      var id = liste[i];
      if (Object.prototype.hasOwnProperty.call(vus, id)) continue;
      vus[id] = true;
      var r = Object.prototype.hasOwnProperty.call(src, id) ? src[id] : null;
      out.push({ id: id, recette: r || null });
    }
    return out;
  }

  function formatFr(n) {
    var arrondi = Math.round(n * 10 + 1e-9) / 10;
    return String(arrondi).replace('.', ',');
  }

  /* Quantité pour `portions` personnes (recette prévue pour `base`).
     « 200 », « 1,5 », « 0.5 », « 1/2 », suivis éventuellement d'un texte ;
     le reste (« qsp ») est rendu tel quel. 1 décimale, virgule française. */
  function quantiteAjusteeEs5(brute, base, portions) {
    var quantite = String(brute == null ? '' : brute);
    if (!(base > 0) || !(portions > 0)) return quantite;
    var texte = quantite.replace(/^\s+|\s+$/g, '');
    if (!texte) return quantite;
    var ratio = portions / base;

    var frac = texte.match(/^(\d+)\s*\/\s*(\d+)(.*)$/);
    if (frac) {
      var den = parseInt(frac[2], 10);
      if (den === 0) return quantite;
      return formatFr((parseInt(frac[1], 10) / den) * ratio) + frac[3];
    }
    var dec = texte.match(/^(\d+(?:[.,]\d+)?)(.*)$/);
    if (dec) {
      var n = parseFloat(dec[1].replace(',', '.'));
      if (typeof n === 'number' && isFinite(n)) return formatFr(n * ratio) + dec[2];
    }
    return quantite;
  }

  var LONGUEUR_LIBELLE = 30;

  /* Nom du minuteur lancé depuis une étape : son début, 30 caractères au plus. */
  function libelleEtapeEs5(description) {
    var propre = String(description == null ? '' : description)
      .replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    if (propre.length <= LONGUEUR_LIBELLE) return propre;
    return propre.slice(0, LONGUEUR_LIBELLE - 1).replace(/\s+$/, '') + '…';
  }

  function etapesTrieesEs5(etapes) {
    var copie = (etapes || []).slice();
    /* Tri stable (Safari 9 ne garantit pas la stabilité de sort). */
    for (var i = 0; i < copie.length; i++) copie[i] = { e: copie[i], i: i };
    copie.sort(function (a, b) { return (a.e.ordre - b.e.ordre) || (a.i - b.i); });
    for (var j = 0; j < copie.length; j++) copie[j] = copie[j].e;
    return copie;
  }

  /* Issue d'une lecture de recette → { recette, motif }.
     issue : 'trouve' (doc lu, `donnees`), 'absent' (doc inexistant),
     'erreur' (lecture refusée ; `horsLigne` vrai si l'erreur dit
     « hors ligne » ou si le navigateur se sait hors ligne), 'delai' (réseau
     muet après le délai). La copie en mémoire sert de secours en cas
     d'erreur ou de délai. motif : null (recette affichée), 'introuvable'
     (doc absent ou échec en ligne → « Recette indisponible : <nom> ») ou
     'hors-reseau' (rien reçu, pas de copie → « Recette indisponible sans
     réseau »). */
  function issueLectureEs5(issue, donnees, copie, horsLigne) {
    if (issue === 'trouve' && donnees) return { recette: donnees, motif: null };
    if (issue === 'absent' || issue === 'trouve') return { recette: null, motif: 'introuvable' };
    if (copie) return { recette: copie, motif: null };
    if (issue === 'delai' || horsLigne) return { recette: null, motif: 'hors-reseau' };
    return { recette: null, motif: 'introuvable' };
  }

  /* Libellé d'une recette absente du repas, selon le motif. */
  function libelleIndispoEs5(motif, nom) {
    var base = motif === 'hors-reseau' ? 'Recette indisponible sans réseau' : 'Recette indisponible';
    return nom ? base + ' : ' + nom : base;
  }

  /* Portions affichées à l'ouverture : celles de l'appelant, sinon celles de
     la première recette, sinon 4 ; entier ≥ 1. */
  function portionsInitialesEs5(portions, recettes) {
    var p = +portions;
    if (!(p > 0) && recettes && recettes.length > 0) p = +recettes[0].portions;
    if (!(p > 0)) p = 4;
    return Math.max(1, Math.round(p));
  }

  /* ===================== Écran (DOM) ===================== */

  var PORTIONS_MIN = 1;
  var PORTIONS_MAX = 20;
  var DELAI_RESEAU_MS = 5000;      /* réseau muet, copie en mémoire : on l'affiche */
  var DELAI_SANS_COPIE_MS = 8000;  /* réseau muet, pas de copie : « sans réseau » */

  var cache = {}; /* id → données Firestore de la recette */

  var ICONE_FERMER =
    '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" class="fh-mr-icone">' +
      '<path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>' +
    '</svg>';
  var ICONE_MOINS =
    '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" style="display:block">' +
      '<path d="M5 12 H19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  var ICONE_PLUS =
    '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" style="display:block">' +
      '<path d="M12 5 V19 M5 12 H19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  var ICONE_MINUTEUR =
    '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" class="fh-mr-icone">' +
      '<circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/>' +
      '<path d="M12 9 V13 L15 15 M9 2 H15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
    '</svg>';
  var ICONE_RETOUR =
    '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" class="fh-mr-icone">' +
      '<path d="M15 5 L8 12 L15 19" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  var ecran = null; /* état de l'écran ouvert, ou null */
  var jeton = 0;    /* invalide les lectures d'un écran déjà fermé */

  function echapper(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function el(tag, classes, html) {
    var e = document.createElement(tag);
    if (classes) e.className = classes;
    if (html != null) e.innerHTML = html;
    return e;
  }

  /* iOS 9 : un <button> n'est jamais conteneur flex ; span intérieur. */
  function bouton(classes, html, aria) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'fh-mr-btn fh-corps ' + classes;
    b.innerHTML = '<span class="fh-mr-dedans">' + html + '</span>';
    if (aria) b.setAttribute('aria-label', aria);
    return b;
  }

  function texteSeul(s) {
    return String(s == null ? '' : s).replace(/^\s+|\s+$/g, '');
  }

  function libellePortions(p) {
    return p + (p > 1 ? ' personnes' : ' personne');
  }

  /* --- Lecture des recettes (cache mémoire par id) --- */

  function navigateurHorsLigne() {
    var nav = root && root.navigator;
    return !!(nav && nav.onLine === false);
  }

  /* Réseau d'abord ; copie en mémoire en secours (échec ou réseau muet).
     Toujours une minuterie : sans copie, on abandonne après
     DELAI_SANS_COPIE_MS (« sans réseau ») au lieu d'attendre sans fin.
     Résout { recette, motif } (voir issueLectureEs5). Une réponse tardive
     met quand même la copie en mémoire à jour. */
  function lireRecette(id) {
    var copie = Object.prototype.hasOwnProperty.call(cache, id) ? cache[id] : null;
    var db = root.FamilyHubGetDb && root.FamilyHubGetDb();
    var hid = root.FamilyHubGetHouseholdId && root.FamilyHubGetHouseholdId();
    if (!db || !hid || !id) {
      return Promise.resolve(issueLectureEs5('erreur', null, copie, navigateurHorsLigne()));
    }
    return new Promise(function (resolve) {
      var fini = false;
      var minuterie = null;
      function finir(issue, donnees, horsLigne) {
        if (fini) return;
        fini = true;
        if (minuterie) clearTimeout(minuterie);
        resolve(issueLectureEs5(issue, donnees, copie, horsLigne));
      }
      minuterie = setTimeout(function () { finir('delai', null, true); },
        copie ? DELAI_RESEAU_MS : DELAI_SANS_COPIE_MS);
      try {
        db.collection('households').doc(hid).collection('recettes').doc(String(id)).get()
          .then(function (doc) {
            if (!doc.exists) { delete cache[id]; finir('absent', null, false); return; }
            var d = doc.data() || {};
            cache[id] = d;
            finir('trouve', d, false);
          }, function (err) {
            if (root.console && root.console.warn) root.console.warn('[mode-recette] lecture', id, err);
            var code = err && err.code ? String(err.code) : '';
            var msg = err && err.message ? String(err.message) : '';
            finir('erreur', null, code === 'unavailable' || /offline/i.test(msg) || navigateurHorsLigne());
          });
      } catch (e) {
        finir('erreur', null, navigateurHorsLigne());
      }
    });
  }

  function memoriser(id, donnees) {
    if (id && donnees) cache[String(id)] = donnees;
  }

  function memoriserListe(recettes) {
    var liste = recettes || [];
    for (var i = 0; i < liste.length; i++) {
      var r = liste[i];
      if (r) memoriser(r.recetteId || r.id, r);
    }
  }

  /* --- Colonne gauche : étapes --- */

  function meta(r) {
    var morceaux = [];
    var prep = +r.tempsPrepMinutes || 0;
    var cuisson = +r.tempsCuissonMinutes || 0;
    if (prep > 0) morceaux.push('Préparation ' + prep + ' min');
    if (cuisson > 0) morceaux.push('Cuisson ' + cuisson + ' min');
    return morceaux.join(' · ');
  }

  function boutonLancer(etape) {
    var minutes = Math.round(+etape.dureeMinutes);
    var libelle = 'Lancer ' + minutes + ' min';
    var b = bouton('fh-action fh-mr-lancer', ICONE_MINUTEUR + '<span>' + libelle + '</span>',
      'Lancer un minuteur de ' + minutes + ' minute' + (minutes > 1 ? 's' : ''));
    var occupe = false;
    b.addEventListener('click', function () {
      if (occupe || !root.FamilyHubTimers) return;
      occupe = true;
      root.FamilyHubTimers.startTimer(libelleEtapeEs5(etape.description) || null, minutes * 60);
      var texte = b.querySelector('.fh-mr-dedans span');
      if (texte) texte.textContent = 'C\'est lancé';
      setTimeout(function () {
        occupe = false;
        if (texte) texte.textContent = libelle;
      }, 2000);
    });
    return b;
  }

  function rendreEtapes(zone, ordonne, noms, motifs) {
    zone.innerHTML = '';
    for (var i = 0; i < ordonne.length; i++) {
      var r = ordonne[i].recette;
      if (!r) {
        var idM = ordonne[i].id;
        var nomConnu = noms && idM && Object.prototype.hasOwnProperty.call(noms, idM)
          ? texteSeul(noms[idM]) : '';
        var motif = motifs && idM && Object.prototype.hasOwnProperty.call(motifs, idM) ? motifs[idM] : null;
        zone.appendChild(el('p', 'fh-mr-indispo fh-carte fh-bordure fh-texte',
          echapper(libelleIndispoEs5(motif, nomConnu))));
        continue;
      }
      var bloc = el('section', 'fh-mr-recette');
      bloc.appendChild(el('h2', 'fh-mr-recette-nom fh-titre fh-texte', echapper(r.nom || 'Recette')));
      var m = meta(r);
      if (m) bloc.appendChild(el('p', 'fh-mr-meta fh-texte-doux', echapper(m)));

      var etapes = etapesTrieesEs5(r.etapes);
      if (etapes.length === 0) {
        bloc.appendChild(el('p', 'fh-mr-vide fh-texte-doux', 'Pas d\'étapes pour cette recette.'));
      }
      var liste = el('ol', 'fh-mr-etapes-liste');
      for (var k = 0; k < etapes.length; k++) {
        var e = etapes[k] || {};
        var li = el('li', 'fh-mr-etape fh-carte fh-bordure');
        li.appendChild(el('div', 'fh-mr-etape-num fh-titre fh-action', String(k + 1)));
        var corps = el('div', 'fh-mr-etape-corps');
        corps.appendChild(el('p', 'fh-mr-etape-texte fh-texte', echapper(e.description || '')));
        if (+e.dureeMinutes > 0) corps.appendChild(boutonLancer(e));
        li.appendChild(corps);
        liste.appendChild(li);
      }
      bloc.appendChild(liste);
      zone.appendChild(bloc);
    }
    zone.scrollTop = 0;
  }

  /* --- Colonne droite : ingrédients --- */

  function rendreIngredients(zone, repas, portions) {
    zone.innerHTML = '';
    var p = repas.presentes;
    if (p.length === 0) {
      zone.appendChild(el('p', 'fh-mr-vide fh-texte-doux',
        libelleIndispoEs5(repas.horsReseau ? 'hors-reseau' : null, '')));
      return;
    }
    for (var i = 0; i < p.length; i++) {
      var r = p[i].recette;
      var base = +r.portions || 0;
      if (p.length > 1) zone.appendChild(el('h3', 'fh-mr-ing-titre fh-titre fh-texte', echapper(r.nom || 'Recette')));
      var ings = r.ingredients || [];
      if (ings.length === 0) {
        zone.appendChild(el('p', 'fh-mr-vide fh-texte-doux', 'Aucun ingrédient.'));
        continue;
      }
      var ul = el('ul', 'fh-mr-ing-liste');
      for (var k = 0; k < ings.length; k++) {
        var ing = ings[k] || {};
        var q = texteSeul(quantiteAjusteeEs5(ing.quantite, base, portions));
        var qte = texteSeul(q + (ing.unite ? ' ' + ing.unite : ''));
        ul.appendChild(el('li', 'fh-mr-ing fh-texte',
          (qte ? '<strong class="fh-mr-ing-qte">' + echapper(qte) + '</strong> ' : '') +
          echapper(ing.libelle || '')));
      }
      zone.appendChild(ul);
    }
  }

  /* --- Colonne droite : minuteurs (panneau, ou choix « Autre ») --- */

  function demonterMinuteur(e) {
    if (e.minuteur) { try { e.minuteur.demonter(); } catch (err) {} e.minuteur = null; }
    if (e.retour && e.retour.parentNode) e.retour.parentNode.removeChild(e.retour);
    e.retour = null;
    e.zoneMinuteur.innerHTML = '';
  }

  function monterPanneau(e) {
    demonterMinuteur(e);
    if (!root.FamilyHubMinuteursPanneau) {
      e.zoneMinuteur.appendChild(el('p', 'fh-mr-vide fh-texte-doux', 'Minuteurs indisponibles.'));
      return;
    }
    e.minuteur = root.FamilyHubMinuteursPanneau.monter(e.zoneMinuteur, {
      libelleParDefaut: e.nomMinuteur,
      surAutre: function () { monterChoix(e); }
    });
  }

  /* Secours si le choix de durée n'est pas chargé : plein écran du minuteur
     (z-index 200, donc SOUS cet écran) ; on se cache tant qu'il est ouvert,
     puis on réapparaît tel quel. */
  function choixEnPleinEcran(e) {
    var overlay = root.FamilyHubOverlay;
    if (!overlay || typeof overlay.open !== 'function') return;
    var cfgTuile = typeof root.FamilyHubGetTileConfigByType === 'function'
      ? root.FamilyHubGetTileConfigByType('timer') : null;
    var ouvert = overlay.open('timer', {}, {
      libelleParDefaut: e.nomMinuteur,
      presets: (cfgTuile && cfgTuile.presets) || []
    });
    if (!ouvert) return;
    e.racine.style.display = 'none';
    e.attente = setInterval(function () {
      if (ecran !== e || !overlay.isOpen()) {
        clearInterval(e.attente);
        e.attente = null;
        e.racine.style.display = '';
      }
    }, 400);
  }

  function monterChoix(e) {
    var timerTuile = root.Tiles && root.Tiles.timer;
    if (!timerTuile || typeof timerTuile.monterChoix !== 'function') { choixEnPleinEcran(e); return; }
    demonterMinuteur(e);
    e.retour = bouton('fh-carte fh-texte fh-bordure fh-mr-retour', ICONE_RETOUR + '<span>Retour</span>',
      'Revenir aux minuteurs');
    e.retour.addEventListener('click', function () { monterPanneau(e); });
    e.zoneMinuteur.appendChild(e.retour);
    e.minuteur = timerTuile.monterChoix(e.zoneMinuteur, {
      libelleParDefaut: e.nomMinuteur,
      apresLancement: function () { monterPanneau(e); }
    });
  }

  /* --- Ouverture / fermeture --- */

  function majPortions(e) {
    e.valeurPortions.textContent = libellePortions(e.portions);
    e.moins.disabled = e.portions <= PORTIONS_MIN;
    e.plus.disabled = e.portions >= PORTIONS_MAX;
    if (e.repas) rendreIngredients(e.zoneIngredients, e.repas, e.portions);
  }

  function fermer() {
    jeton++;
    var e = ecran;
    if (!e) return;
    ecran = null;
    if (e.attente) { clearInterval(e.attente); e.attente = null; }
    demonterMinuteur(e);
    if (e.racine.parentNode) e.racine.parentNode.removeChild(e.racine);
  }

  function ouvrir(options) {
    var opts = options || {};
    fermer();
    var monJeton = ++jeton;
    var ids = [];
    var brut = opts.recetteIds || [];
    for (var i = 0; i < brut.length; i++) if (brut[i]) ids.push(String(brut[i]));

    var e = {
      portions: portionsInitialesEs5(opts.portions, []),
      portionsImposees: +opts.portions > 0,
      repas: null,
      minuteur: null,
      retour: null,
      nomMinuteur: texteSeul(opts.titre) || null,
      noms: opts.noms || null,
      attente: null
    };
    ecran = e;

    e.racine = el('div', 'fh-mr fh-fond fh-corps');

    /* Barre haute */
    var barre = el('div', 'fh-mr-barre fh-carte fh-bordure');
    var fermerBtn = bouton('fh-carte fh-texte fh-bordure fh-mr-fermer', ICONE_FERMER + '<span>Fermer</span>',
      'Fermer la recette');
    fermerBtn.addEventListener('click', fermer);
    barre.appendChild(fermerBtn);
    e.titre = el('h1', 'fh-mr-titre fh-titre fh-texte', echapper(texteSeul(opts.titre) || 'Recette'));
    barre.appendChild(e.titre);
    var portionsEl = el('div', 'fh-mr-portions');
    e.moins = bouton('fh-carte fh-texte fh-bordure fh-mr-pas', ICONE_MOINS, 'Une personne de moins');
    e.valeurPortions = el('div', 'fh-mr-portions-valeur fh-titre fh-texte');
    e.plus = bouton('fh-carte fh-texte fh-bordure fh-mr-pas', ICONE_PLUS, 'Une personne de plus');
    e.moins.addEventListener('click', function () {
      if (e.portions > PORTIONS_MIN) { e.portions--; majPortions(e); }
    });
    e.plus.addEventListener('click', function () {
      if (e.portions < PORTIONS_MAX) { e.portions++; majPortions(e); }
    });
    portionsEl.appendChild(e.moins);
    portionsEl.appendChild(e.valeurPortions);
    portionsEl.appendChild(e.plus);
    barre.appendChild(portionsEl);
    e.racine.appendChild(barre);

    /* Deux colonnes */
    var corps = el('div', 'fh-mr-corps');
    e.zoneEtapes = el('div', 'fh-mr-etapes');
    e.zoneEtapes.setAttribute('data-scroll-lock', '1');
    e.zoneEtapes.appendChild(el('p', 'fh-mr-vide fh-texte-doux', 'Chargement de la recette…'));
    corps.appendChild(e.zoneEtapes);

    var droite = el('div', 'fh-mr-droite');
    e.zoneIngredients = el('div', 'fh-mr-ingredients fh-carte fh-bordure');
    e.zoneIngredients.setAttribute('data-scroll-lock', '1');
    droite.appendChild(e.zoneIngredients);
    e.zoneMinuteur = el('div', 'fh-mr-minuteur');
    e.zoneMinuteur.setAttribute('data-scroll-lock', '1');
    droite.appendChild(e.zoneMinuteur);
    corps.appendChild(droite);
    e.racine.appendChild(corps);

    document.body.appendChild(e.racine);
    majPortions(e);
    monterPanneau(e);

    /* Lecture des recettes, puis rendu complet. */
    var lectures = [];
    for (var k = 0; k < ids.length; k++) lectures.push(lireRecette(ids[k]));
    Promise.all(lectures).then(function (res) {
      if (monJeton !== jeton || ecran !== e) return;
      var parId = {};
      var motifs = {};
      var horsReseau = false;
      for (var j = 0; j < ids.length; j++) {
        var lu = res[j] || {};
        if (lu.recette) parId[ids[j]] = lu.recette;
        else motifs[ids[j]] = lu.motif;
        if (lu.motif === 'hors-reseau') horsReseau = true;
      }
      var repas = assemblerRepasEs5(ids, parId);
      repas.horsReseau = horsReseau;
      var ordonne = repasOrdonneEs5(ids, parId);
      if (ids.length === 0) ordonne.push({ id: '', recette: null });
      e.repas = repas;

      var recettes = [];
      for (var x = 0; x < repas.presentes.length; x++) recettes.push(repas.presentes[x].recette);
      if (!e.portionsImposees) e.portions = portionsInitialesEs5(undefined, recettes);
      var premier = recettes.length > 0 ? texteSeul(recettes[0].nom) : '';
      if (!texteSeul(opts.titre) && premier) {
        e.titre.innerHTML = echapper(premier);
      }
      /* Minuteurs lancés d'ici (1 / 5 / 10 min, Autre) : nommés d'après le plat. */
      var nom = premier || e.nomMinuteur;
      if (nom !== e.nomMinuteur) {
        e.nomMinuteur = nom;
        if (!e.retour) monterPanneau(e);
      }
      rendreEtapes(e.zoneEtapes, ordonne, e.noms, motifs);
      majPortions(e);
    });
  }

  function estOuvert() {
    return ecran !== null;
  }

  var api = {
    assemblerRepasEs5: assemblerRepasEs5,
    quantiteAjusteeEs5: quantiteAjusteeEs5,
    libelleEtapeEs5: libelleEtapeEs5,
    etapesTrieesEs5: etapesTrieesEs5,
    portionsInitialesEs5: portionsInitialesEs5,
    repasOrdonneEs5: repasOrdonneEs5,
    issueLectureEs5: issueLectureEs5,
    libelleIndispoEs5: libelleIndispoEs5,
    ouvrir: ouvrir,
    fermer: fermer,
    estOuvert: estOuvert,
    memoriser: memoriser,
    memoriserListe: memoriserListe
  };

  if (root) root.FamilyHubModeRecette = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
