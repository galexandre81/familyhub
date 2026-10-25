/* tiles/weekly-menu.js — Menu de la semaine.
   Compact : titre + jour courant en avant + mini-aperçu 7 jours.
   Expand : plein écran, une ligne par jour, une colonne par repas, et la vue
   batch cooking (design « Alpage + Veillée », css/plein-ecran.css).
   ES5 vanilla, iOS 9.3.6 OK. Data depuis le snapshot pré-calculé. */
(function (global) {
  'use strict';

  var BRASS = '#D9A05B';
  var JOURS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  var JOURS_LONG = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function repasIconSvg(repas, size) {
    var dim = size || 14;
    var inner = '';
    if (repas === 'petitDej') {
      /* Tasse mini */
      inner = '<path d="M16 22 Q16 28, 22 28 L30 28 Q34 28, 34 22 L34 16 L16 16 Z" ' +
              'fill="rgba(217,160,91,0.18)" stroke="' + BRASS + '" stroke-width="2"/>' +
              '<path d="M34 18 Q40 18, 40 23 Q40 28, 34 28" fill="none" stroke="' + BRASS + '" stroke-width="2"/>';
    } else if (repas === 'dej') {
      /* Soleil mini */
      inner = '<circle cx="25" cy="25" r="8" fill="rgba(217,160,91,0.20)" stroke="' + BRASS + '" stroke-width="2"/>' +
              '<line x1="25" y1="10" x2="25" y2="14" stroke="' + BRASS + '" stroke-width="2"/>' +
              '<line x1="25" y1="36" x2="25" y2="40" stroke="' + BRASS + '" stroke-width="2"/>' +
              '<line x1="10" y1="25" x2="14" y2="25" stroke="' + BRASS + '" stroke-width="2"/>' +
              '<line x1="36" y1="25" x2="40" y2="25" stroke="' + BRASS + '" stroke-width="2"/>';
    } else if (repas === 'diner') {
      /* Lune mini */
      inner = '<path d="M30 12 A14 14 0 1 0 30 38 A11 11 0 1 1 30 12 Z" ' +
              'fill="rgba(217,160,91,0.18)" stroke="' + BRASS + '" stroke-width="2"/>';
    }
    return '<svg viewBox="0 0 50 50" width="' + dim + '" height="' + dim +
           '" aria-hidden="true" style="vertical-align:middle">' + inner + '</svg>';
  }

  function repasShort(repas) {
    if (repas === 'petitDej') return 'Petit-déj';
    if (repas === 'dej') return 'Déjeuner';
    if (repas === 'diner') return 'Dîner';
    return repas || '';
  }

  /* Group slots by jour for easier rendering */
  function groupByJour(semaine) {
    var byJour = {};
    for (var i = 0; i < (semaine || []).length; i++) {
      var s = semaine[i];
      var key = String(s.jour);
      if (!byJour[key]) byJour[key] = { jour: s.jour, date: s.date, slots: {} };
      byJour[key].slots[s.repas] = s;
    }
    return byJour;
  }

  /* Date locale ISO au format YYYY-MM-DD. iOS 9 sans Intl reliable :
     on construit à la main pour ne pas dépendre du fuseau iPad mal réglé. */
  function getTodayISO() {
    var d = new Date();
    var y = d.getFullYear();
    var m = d.getMonth() + 1;
    var day = d.getDate();
    return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
  }

  /* On ne fait PAS confiance à slot.isToday / slot.isPast du snapshot serveur
     (Cloud Function refresh 15min — peut être stale ou avoir failé). On
     recompute côté client à partir de slot.date qui lui est stable. */
  function todayJourIndex(semaine) {
    var today = getTodayISO();
    for (var i = 0; i < (semaine || []).length; i++) {
      if (semaine[i].date === today) return semaine[i].jour;
    }
    return -1;
  }

  function isSlotPast(slot) {
    if (!slot || !slot.date) return false;
    return slot.date < getTodayISO();
  }

  /* Label "Lun/Mar/.../Dim" dérivé de la VRAIE date du jour, pas de l'index
     `jour` du snapshot. Bug fix : les meal plans peuvent avoir un dateDebut
     qui n'est pas un lundi (ex: dateDebut = mardi → jour 0 est mardi). Avant,
     JOURS_SHORT[j] retournait toujours "Lun" pour jour 0, "Mar" pour jour 1,
     etc., ce qui décalait visuellement les labels et affichait "Ven" sur la
     pastille de samedi (jour 4 quand dateDebut = mardi). */
  function dayLabelFromDate(dateStr) {
    if (!dateStr) return '';
    var parts = String(dateStr).split('-');
    if (parts.length !== 3) return '';
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var dd = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(dd)) return '';
    /* Date locale à midi pour éviter les bugs DST sur les frontières */
    var d = new Date(y, m, dd, 12, 0, 0);
    /* JS getDay() = 0 (Dim) ... 6 (Sam) ; on remappe sur l'ordre français
       JOURS_SHORT [Lun, Mar, Mer, Jeu, Ven, Sam, Dim] */
    var jsDay = d.getDay();
    var idx = jsDay === 0 ? 6 : jsDay - 1;
    return JOURS_SHORT[idx];
  }

  /* « lundi 3 mars » à partir d'une date ISO AAAA-MM-JJ, sans Intl :
     Safari 9 (iPad mini 1) n'a pas Intl, toLocaleDateString y ignore les
     options et rend un format anglais/numérique. Même ancrage à midi local
     que dayLabelFromDate (pas de glissement de jour autour du DST). */
  var JOURS_LONG_DIM = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS_LONG = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function dateLongFr(dateStr) {
    if (!dateStr) return '';
    var parts = String(dateStr).split('-');
    if (parts.length !== 3) return '';
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var dd = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(dd)) return '';
    var d = new Date(y, m, dd, 12, 0, 0);
    return JOURS_LONG_DIM[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS_LONG[d.getMonth()];
  }

  /* ---------- COMPACT ---------- */

  function render(container, data, _config) {
    container.className = 'grid-cell tile-weekly-menu tile-clickable';
    container.innerHTML = '';

    var titleEl = document.createElement('div');
    titleEl.className = 'tile-title';
    titleEl.innerHTML = 'Menu de la semaine';
    container.appendChild(titleEl);

    var body = document.createElement('div');
    body.style.padding = '4px 0';
    container.appendChild(body);

    var d = data || {};
    if (!d.hasActivePlan || !d.semaine || d.semaine.length === 0) {
      body.innerHTML =
        '<div style="text-align:center; padding:20px 8px; opacity:0.7">' +
          '<div style="font-size:13px; line-height:1.45">Pas de plan actif<br>cette semaine</div>' +
        '</div>';
      return;
    }

    var byJour = groupByJour(d.semaine);
    var todayIdx = todayJourIndex(d.semaine);

    /* En-tête : focus sur le jour courant si dispo */
    if (todayIdx >= 0 && byJour[todayIdx]) {
      var todayBlock = document.createElement('div');
      todayBlock.style.cssText =
        'border:1px solid rgba(217,160,91,0.3); border-radius:4px; ' +
        'padding:8px 10px; margin-bottom:10px; background:rgba(217,160,91,0.06);';
      var html = '<div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; ' +
                 'color:' + BRASS + '; margin-bottom:4px">Aujourd\'hui</div>';
      var slots = byJour[todayIdx].slots;
      var ordered = ['petitDej', 'dej', 'diner'];
      for (var i = 0; i < ordered.length; i++) {
        var s = slots[ordered[i]];
        if (!s) continue;
        if (s.recetteNoms.length === 0 && s.profilsCount === 0) continue;
        var noms = (s.recetteNoms || []).join(', ');
        if (!noms) continue;
        html += '<div class="fh-gap-r6" style="display:-webkit-flex; display:flex; -webkit-align-items:center; align-items:center; font-size:12px; padding:1px 0;">' +
                  repasIconSvg(s.repas, 12) +
                  '<span style="opacity:0.85">' + escapeHtml(noms) + '</span>' +
                '</div>';
      }
      todayBlock.innerHTML = html;
      body.appendChild(todayBlock);
    }

    /* Mini-aperçu 7 jours en pastilles */
    var weekRow = document.createElement('div');
    weekRow.style.cssText =
      'display:-webkit-flex; display:flex; -webkit-justify-content:space-between; justify-content:space-between;';
    weekRow.className = 'fh-gap-r3'; /* ex-gap 3px (Safari 9 ignore gap en flex) */
    for (var j = 0; j < 7; j++) {
      var dayInfo = byJour[j] || { slots: {} };
      var filledCount = 0;
      for (var rk in dayInfo.slots) {
        if (dayInfo.slots.hasOwnProperty(rk) && dayInfo.slots[rk].recetteNoms.length > 0) filledCount++;
      }
      var isToday = j === todayIdx;
      var pillStyle =
        'flex:1; -webkit-flex:1; text-align:center; padding:4px 0; ' +
        'border-radius:3px; font-size:9px; ' +
        'background:' + (isToday ? 'rgba(217,160,91,0.20)' : 'rgba(217,160,91,0.05)') + ';' +
        'border:1px solid ' + (isToday ? BRASS : 'rgba(217,160,91,0.15)') + ';' +
        'color:' + (isToday ? BRASS : 'inherit') + ';' +
        'opacity:' + (filledCount === 0 ? '0.4' : '1') + ';';
      var pillLabel = dayLabelFromDate(dayInfo.date) || JOURS_SHORT[j];
      weekRow.innerHTML += '<div style="' + pillStyle + '">' +
        '<div style="font-weight:600; letter-spacing:0.05em">' + pillLabel.toUpperCase() + '</div>' +
        '<div style="font-size:8px; margin-top:2px">' + filledCount + '/3</div>' +
        '</div>';
    }
    body.appendChild(weekRow);

    /* CTA discret */
    var cta = document.createElement('div');
    cta.style.cssText =
      'font-size:9px; letter-spacing:0.15em; text-transform:uppercase; ' +
      'opacity:0.5; margin-top:8px; text-align:right;';
    cta.innerHTML = 'Voir la semaine →';
    body.appendChild(cta);
  }

  function cleanup(container) { container.innerHTML = ''; }

  /* ---------- EXPAND : grille semaine plein écran ---------- */

  function repasLabelLong(repas) {
    if (repas === 'petitDej') return 'Petit-déj';
    if (repas === 'dej') return 'Déjeuner';
    if (repas === 'diner') return 'Dîner';
    return repas || 'Repas';
  }

  /**
   * Sélectionne le plan à afficher dans la vue expand.
   * - Si `data.plans` existe (snapshot Phase 4) → retourne plans[idx]
   * - Sinon (snapshot ancien, sans historique) → fabrique un plan-shape
   *   depuis les champs top-level (back-compat).
   */
  function selectPlan(data, idx) {
    var d = data || {};
    if (d.plans && d.plans.length > 0) {
      var safe = Math.max(0, Math.min(idx | 0, d.plans.length - 1));
      return d.plans[safe];
    }
    if (!d.hasActivePlan) return null;
    return {
      planId: d.planId || '',
      statut: 'active',
      dateDebutISO: d.dateDebutISO || '',
      dateFinISO: d.dateFinISO || '',
      semaine: d.semaine || [],
      batchSessions: d.batchSessions || []
    };
  }

  function plansCount(data) {
    var d = data || {};
    if (d.plans && d.plans.length > 0) return d.plans.length;
    return d.hasActivePlan ? 1 : 0;
  }

  /* ---------- EXPAND : plein écran (design « Alpage + Veillée ») ----------
     css/plein-ecran.css, classes fh-sem-* (semaine) et fh-bt-* (batch).
     Titre et navigation dans la barre du plein écran (overlay.js, tete()).
     Semaine : une ligne par jour (le jour à gauche, aujourd'hui sur l'aplat
     « maintenant »), une colonne par repas ; la liste défile, ouverte sur
     aujourd'hui. iOS 9 : contenu des boutons dans un span intérieur. */

  var TRAIT = ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  function icone(inner, taille, classe) {
    var t = taille || 26;
    return '<svg viewBox="0 0 24 24" width="' + t + '" height="' + t + '" aria-hidden="true" class="' +
      (classe || 'fh-pe-icone') + '">' + inner + '</svg>';
  }
  var ICONES = {
    petitDej: '<path d="M5 9 H16 V14 Q16 18 12 18 H9 Q5 18 5 14 Z M16 10 H17.5 Q20 10 20 12.5 Q20 15 17.5 15 H16 M4 21 H18"' + TRAIT + '/>',
    dej: '<circle cx="12" cy="12" r="4"' + TRAIT + '/><path d="M12 2.5 V5 M12 19 V21.5 M2.5 12 H5 M19 12 H21.5 M5.3 5.3 L7 7 M17 17 L18.7 18.7 M5.3 18.7 L7 17 M17 7 L18.7 5.3"' + TRAIT + '/>',
    diner: '<path d="M19 14.5 A8 8 0 1 1 9.5 5 A6.5 6.5 0 0 0 19 14.5 Z"' + TRAIT + '/>',
    marmite: '<path d="M4 10 H20 V17 Q20 20 17 20 H7 Q4 20 4 17 Z M2 10 H22 M9 6 Q8 4.5 9 3 M13 6 Q12 4.5 13 3"' + TRAIT + '/>',
    horloge: '<circle cx="12" cy="13" r="8"' + TRAIT + '/><path d="M12 9 V13 L15 15 M9 2 H15"' + TRAIT + '/>',
    coche: '<path d="M5 12.5 L10 17 L19 7"' + TRAIT + '/>',
    gauche: '<path d="M15 5 L8 12 L15 19"' + TRAIT + ' stroke-width="2.8"/>',
    droite: '<path d="M9 5 L16 12 L9 19"' + TRAIT + ' stroke-width="2.8"/>'
  };

  var REPAS_ORDRE = ['petitDej', 'dej', 'diner'];

  /* Colonnes de la grille : déjeuner et dîner toujours ; le petit-déjeuner
     seulement si au moins un de ses créneaux porte une recette (sinon une
     colonne de « — » prendrait un tiers de la largeur). Pur, testé
     (packages/design/src/displayMenuSemaine.test.ts). */
  function repasAffichesEs5(semaine) {
    var liste = semaine || [];
    for (var i = 0; i < liste.length; i++) {
      var s = liste[i];
      if (s && s.repas === 'petitDej' && s.recetteIds && s.recetteIds.length > 0) {
        return REPAS_ORDRE.slice();
      }
    }
    return ['dej', 'diner'];
  }

  /* Ligne sous le plat : « Annulé », personnes, invités, batch. Pur, testé. */
  function metaCaseEs5(slot) {
    var s = slot || {};
    var morceaux = [];
    if (s.annule) morceaux.push('Annulé');
    var p = +s.profilsCount || 0;
    if (p > 0) morceaux.push(p + ' pers.');
    var inv = +s.invitesCount || 0;
    if (inv > 0) morceaux.push('+' + inv + ' invité' + (inv > 1 ? 's' : ''));
    if (s.isBatchConsumer) morceaux.push('batch');
    return morceaux.join(' · ');
  }

  var JOURS_COURTS_DIM = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  /* AAAA-MM-JJ → Date locale à midi (pas de glissement autour du DST). */
  function dateDepuisIso(dateStr) {
    if (!dateStr) return null;
    var parts = String(dateStr).split('-');
    if (parts.length !== 3) return null;
    var y = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10) - 1;
    var dd = parseInt(parts[2], 10);
    if (isNaN(y) || isNaN(m) || isNaN(dd)) return null;
    return new Date(y, m, dd, 12, 0, 0);
  }

  /* « Du jeu. 22 au mer. 28 oct. » (mois de début ajouté s'il change).
     Pur, testé. */
  function plageSemaineEs5(debutIso, finIso) {
    var d = dateDepuisIso(debutIso);
    var f = dateDepuisIso(finIso || debutIso);
    if (!d || !f) return '';
    var memeMois = d.getMonth() === f.getMonth() && d.getFullYear() === f.getFullYear();
    return 'Du ' + JOURS_COURTS_DIM[d.getDay()] + ' ' + d.getDate() +
      (memeMois ? '' : ' ' + MOIS_COURTS[d.getMonth()]) +
      ' au ' + JOURS_COURTS_DIM[f.getDay()] + ' ' + f.getDate() + ' ' + MOIS_COURTS[f.getMonth()];
  }

  function el(tag, classes, html) {
    var n = document.createElement(tag);
    if (classes) n.className = classes;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function bouton(classes, html, aria) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'fh-pe-btn fh-corps ' + classes;
    b.innerHTML = '<span class="fh-pe-dedans">' + html + '</span>';
    if (aria) b.setAttribute('aria-label', aria);
    return b;
  }

  /* Zone de tête de la barre du plein écran (overlay.js) ; sans elle (appel
     direct), une tête en haut du contenu. Vidée à chaque appel. */
  function zoneTete(container) {
    var O = global.FamilyHubOverlay;
    var t = O && typeof O.tete === 'function' ? O.tete() : null;
    if (t) { t.innerHTML = ''; return t; }
    var h = el('div', 'fh-pe-tete-repli fh-carte fh-bordure');
    container.appendChild(h);
    return h;
  }

  function titres(titre, sousTitre) {
    return el('div', 'fh-pe-titres',
      '<div class="fh-pe-titre fh-titre fh-texte">' + escapeHtml(titre) + '</div>' +
      (sousTitre ? '<div class="fh-pe-sous-titre fh-texte-doux">' + escapeHtml(sousTitre) + '</div>' : ''));
  }

  function expand(container, data, _config, _tileId) {
    container.className = 'tile-overlay-content tile-overlay-content--full fh-sem';
    container.innerHTML = '';
    container.style.cssText = '';

    var d = data || {};
    var nPlans = plansCount(d);
    if (nPlans === 0) {
      zoneTete(container).appendChild(titres('Menu de la semaine', ''));
      container.appendChild(el('div', 'fh-pe-message fh-texte-doux', 'Pas de menu prévu cette semaine.'));
      return;
    }

    /* Index du plan courant dans data.plans : 0 = plus récent = actif si présent.
       État closure : préservé entre re-renders du même expand mais reset à
       chaque ouverture (volontaire — on commence toujours sur l'actif). Un
       repas touché s'ouvre dans le mode recette (js/mode-recette.js), par-dessus. */
    var currentIdx = 0;

    /* Vue grille — extraite dans une fonction pour pouvoir y revenir
       depuis la vue batch. */
    renderGrid();

    function renderGrid() {
      container.innerHTML = '';
      var plan = selectPlan(d, currentIdx);
      if (!plan) {
        zoneTete(container).appendChild(titres('Menu de la semaine', ''));
        container.appendChild(el('div', 'fh-pe-message fh-texte-doux', 'Plan introuvable.'));
        return;
      }
      var nav = {
        index: currentIdx,
        total: nPlans,
        canPrev: currentIdx < nPlans - 1, /* plus ancien = idx supérieur */
        canNext: currentIdx > 0,
        onPrev: function () { if (currentIdx < nPlans - 1) { currentIdx++; renderGrid(); } },
        onNext: function () { if (currentIdx > 0) { currentIdx--; renderGrid(); } }
      };
      buildGridUI(
        container,
        plan,
        function (slot) { showRecetteForSlot(slot); },
        function () { showBatchView(); },
        nav
      );
    }

    function showBatchView() {
      var plan = selectPlan(d, currentIdx) || {};
      var sessions = (plan.batchSessions || []);
      container.innerHTML = '';

      var tete = zoneTete(container);
      var retour = bouton('fh-pe-retour-btn fh-carte fh-texte fh-bordure',
        icone(ICONES.gauche) + '<span>La semaine</span>', 'Retour au menu de la semaine');
      retour.setAttribute('data-act', 'back');
      retour.addEventListener('click', renderGrid);
      tete.appendChild(retour);
      tete.appendChild(titres('Batch cooking',
        sessions.length === 0 ? '' :
          sessions.length + ' session' + (sessions.length > 1 ? 's' : '') + ' à préparer'));

      if (sessions.length === 0) {
        container.appendChild(el('div', 'fh-pe-message fh-texte-doux',
          'Aucune session de batch cooking cette semaine.'));
        return;
      }

      /* Liste des sessions (défile) ; chaque recette s'ouvre dans le mode recette. */
      var body = el('div', 'fh-bt-liste');
      container.appendChild(body);
      body.setAttribute('data-scroll-lock', '1');

      for (var s = 0; s < sessions.length; s++) {
        (function (session) {
          var dateLabel = dateLongFr(session.date);
          dateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
          var ids = session.recetteIds || [];
          var noms = session.recetteNoms || [];
          var card = el('div', 'fh-bt-session fh-carte fh-bordure' + (session.done ? ' fh-bt-session-faite' : ''));
          var html =
            '<div class="fh-bt-tete">' +
              '<div class="fh-bt-date fh-titre fh-texte">' + escapeHtml(dateLabel) + '</div>' +
              (session.done
                ? '<div class="fh-bt-fait fh-texte">' + icone(ICONES.coche, 26) + '<span>Terminé</span></div>'
                : '') +
            '</div>' +
            '<div class="fh-bt-meta fh-texte-doux">' + icone(ICONES.horloge, 24) +
              '<span>' + (+session.dureeEstimeeMinutes || 0) + ' min · ' +
              ids.length + ' recette' + (ids.length > 1 ? 's' : '') + '</span></div>';
          if (session.notes) {
            html += '<p class="fh-bt-notes fh-texte">' + escapeHtml(session.notes) + '</p>';
          }
          html += '<div class="fh-bt-recettes"></div>';
          card.innerHTML = html;
          var recettesWrap = card.querySelector('.fh-bt-recettes');
          for (var ri = 0; ri < ids.length; ri++) {
            (function (rid, nom) {
              var btn = bouton('fh-bt-recette-btn fh-carte fh-texte fh-bordure',
                '<span class="fh-bt-recette-nom">' + escapeHtml(nom || rid) + '</span>' +
                icone(ICONES.droite, 26, 'fh-pe-icone-seule'));
              btn.addEventListener('click', function () {
                /* Pas de repas pour un batch : titre = nom de la recette. */
                if (!global.FamilyHubModeRecette) return;
                var nomsParRid = {};
                if (nom) nomsParRid[rid] = nom;
                global.FamilyHubModeRecette.ouvrir({ recetteIds: [rid], noms: nomsParRid });
              });
              recettesWrap.appendChild(btn);
            })(ids[ri], noms[ri]);
          }
          body.appendChild(card);
        })(sessions[s]);
      }
    }

    /* Le repas s'ouvre dans le mode recette (même écran que depuis le
       tableau et le livre) ; à sa fermeture on retrouve la semaine. */
    function showRecetteForSlot(slot) {
      if (!slot || !slot.recetteIds || slot.recetteIds.length === 0) return;
      if (!global.FamilyHubModeRecette) return;
      /* Snapshot du menu : profilsCount / invitesCount (pas les noms des invités). */
      var nbProfils = slot.profilsCount != null
        ? (+slot.profilsCount || 0)
        : (slot.profilsPresents ? slot.profilsPresents.length : 0);
      var nbPresents = nbProfils + (+slot.invitesCount || 0);
      global.FamilyHubModeRecette.ouvrir({
        recetteIds: slot.recetteIds,
        titre: global.FamilyHubRepas && global.FamilyHubRepas.titreRepas
          ? global.FamilyHubRepas.titreRepas(slot.repas, slot.date)
          : repasLabelLong(slot.repas) + ' · ' + dateLongFr(slot.date),
        portions: nbPresents > 0 ? nbPresents : undefined,
        noms: nomsParId(slot.recetteIds, slot.recetteNoms)
      });
    }

    /* recetteNoms ne garde que les noms connus : on ne l'aligne sur
       recetteIds que s'il est complet. */
    function nomsParId(ids, noms) {
      var out = {};
      if (!ids || !noms || noms.length !== ids.length) return out;
      for (var i = 0; i < ids.length; i++) out[ids[i]] = noms[i];
      return out;
    }
  }

  /**
   * Construit la vue semaine dans `container` à partir d'un PLAN (actif ou
   * archivé). Le nombre de jours est dérivé du plan lui-même, pas hardcodé 7.
   *
   * @param plan { planId, statut, dateDebutISO, dateFinISO, semaine[], batchSessions[] }
   * @param nav  { index, total, canPrev, canNext, onPrev, onNext } pour ‹ ›
   */
  function buildGridUI(container, plan, onCellTap, onBatchTap, nav) {
    var p = plan || {};
    var isArchived = p.statut === 'archived';

    /* ---- Tête (barre du plein écran) : titre, dates, navigation ---- */
    var tete = zoneTete(container);
    var plage = p.dateDebutISO ? plageSemaineEs5(p.dateDebutISO, p.dateFinISO) : '';
    tete.appendChild(titres('Menu de la semaine', (isArchived ? 'Archivé · ' : '') + plage));

    if (nav && nav.total > 1) {
      var navWrap = el('div', 'fh-pe-nav');
      navWrap.appendChild(makeNavBtn(ICONES.gauche, 'Semaine précédente', nav.canPrev, nav.onPrev));
      navWrap.appendChild(el('div', 'fh-pe-nav-etape fh-texte-doux', (nav.index + 1) + ' / ' + nav.total));
      navWrap.appendChild(makeNavBtn(ICONES.droite, 'Semaine suivante', nav.canNext, nav.onNext));
      tete.appendChild(navWrap);
    }

    /* ---- Batch cooking de la semaine ---- */
    var batchSessions = p.batchSessions || [];
    var batchCount = batchSessions.length;
    var batchTotalMin = 0;
    for (var bi = 0; bi < batchSessions.length; bi++) {
      batchTotalMin += +batchSessions[bi].dureeEstimeeMinutes || 0;
    }
    if (batchCount > 0 && typeof onBatchTap === 'function') {
      var batchBtn = bouton('fh-sem-batch-btn fh-carte fh-texte fh-bordure',
        icone(ICONES.marmite, 30) +
        '<span class="fh-sem-batch-texte">Batch cooking' +
          '<span class="fh-texte-doux"> · ' + batchCount + ' session' + (batchCount > 1 ? 's' : '') +
          ' · ' + batchTotalMin + ' min</span></span>' +
        '<span class="fh-sem-batch-voir">Voir</span>' + icone(ICONES.droite, 26, 'fh-pe-icone-seule'));
      batchBtn.setAttribute('data-act', 'batch');
      batchBtn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        onBatchTap();
      });
      container.appendChild(batchBtn);
    }

    /* ---- Grille : une ligne par jour (nDays = semaine.length / 3) ---- */
    var semaine = p.semaine || [];
    var nDays = Math.max(1, Math.floor(semaine.length / 3));
    var byJour = groupByJour(semaine);
    var todayIdx = todayJourIndex(semaine);
    var repasList = repasAffichesEs5(semaine);

    var entete = el('div', 'fh-sem-entete');
    entete.appendChild(el('div', 'fh-sem-jour'));
    for (var ri = 0; ri < repasList.length; ri++) {
      entete.appendChild(el('div', 'fh-sem-col-titre fh-texte-doux',
        icone(ICONES[repasList[ri]], 26) + '<span>' + escapeHtml(repasShort(repasList[ri])) + '</span>'));
    }
    container.appendChild(entete);

    var gridWrap = el('div', 'fh-sem-grille');
    container.appendChild(gridWrap);
    gridWrap.setAttribute('data-scroll-lock', '1');

    var ligneAujourdhui = null;
    for (var j = 0; j < nDays; j++) {
      var jourInfo = byJour[j] || null;
      var isToday = j === todayIdx;
      var dateJ = jourInfo && jourInfo.date ? dateDepuisIso(jourInfo.date) : null;
      var ligne = el('div', 'fh-sem-ligne' + (isToday ? ' fh-sem-ligne-aujourdhui' : ''));
      var nomJour = isToday ? 'Aujourd\'hui'
        : (dateJ ? JOURS_LONG[dateJ.getDay() === 0 ? 6 : dateJ.getDay() - 1] : JOURS_LONG[j % 7]);
      ligne.appendChild(el('div', 'fh-sem-jour',
        '<div class="fh-sem-jour-nom fh-titre' + (isToday ? ' fh-maintenant' : ' fh-texte') + '">' +
          escapeHtml(nomJour) + '</div>' +
        (dateJ ? '<div class="fh-sem-jour-date fh-texte-doux">' +
          (isToday ? JOURS_COURTS_DIM[dateJ.getDay()] + ' ' : '') +
          dateJ.getDate() + ' ' + MOIS_COURTS[dateJ.getMonth()] + '</div>' : '')));

      for (var rj = 0; rj < repasList.length; rj++) {
        var repas = repasList[rj];
        ligne.appendChild(caseRepas((jourInfo && jourInfo.slots[repas]) || null, repas, j, byJour, onCellTap));
      }
      gridWrap.appendChild(ligne);
      if (isToday) ligneAujourdhui = ligne;
    }

    /* Ouvre la semaine sur aujourd'hui (les jours passés restent au-dessus). */
    if (ligneAujourdhui) {
      setTimeout(function () {
        try { gridWrap.scrollTop = Math.max(0, ligneAujourdhui.offsetTop - 4); } catch (e) { /* noop */ }
      }, 0);
    }
  }

  /* Une case repas : carte touchable si des recettes, sinon « — » ou
     « À compléter ». Passé et annulé estompés (sans disparaître). */
  function caseRepas(slot, repas, dayJ, byJour, onCellTap) {
    var cell = document.createElement('div');
    var isPast = isSlotPast(slot);
    var hasRecettes = slot && slot.recetteIds && slot.recetteIds.length > 0;
    var noms = (slot && slot.recetteNoms) || [];
    var classes = 'fh-sem-case';
    if (isPast) classes += ' fh-sem-case-passee';
    if (slot && slot.annule) classes += ' fh-sem-case-annulee';

    if (!slot || (noms.length === 0 && !(+slot.profilsCount > 0))) {
      cell.className = classes + ' fh-sem-case-vide fh-texte-doux';
      cell.innerHTML = '—';
      return cell;
    }
    if (noms.length === 0) {
      cell.className = classes + ' fh-sem-case-acompleter fh-texte-doux';
      cell.innerHTML = 'À compléter';
    } else {
      cell.className = classes + ' fh-carte fh-bordure';
      var html = '<div class="fh-sem-plat fh-texte">' + escapeHtml(noms[0]) + '</div>';
      if (noms.length > 1) {
        html += '<div class="fh-sem-autres fh-texte-doux">+ ' + escapeHtml(noms.slice(1).join(', ')) + '</div>';
      }
      var meta = metaCaseEs5(slot);
      if (meta) html += '<div class="fh-sem-meta fh-texte-doux">' + escapeHtml(meta) + '</div>';
      cell.innerHTML = html;
    }

    if (hasRecettes && typeof onCellTap === 'function') {
      cell.className += ' fh-sem-case-touche';
      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', '0');
      var dayLbl = (byJour[dayJ] && byJour[dayJ].date)
        ? (dayLabelFromDate(byJour[dayJ].date) || JOURS_SHORT[dayJ % 7])
        : JOURS_SHORT[dayJ % 7];
      var nomsLbl = noms.length > 0 ? ' : ' + noms.join(', ') : '';
      cell.setAttribute('aria-label',
        'Voir la recette — ' + repasShort(repas) + ' ' + dayLbl + nomsLbl);
      cell.addEventListener('click', function () { onCellTap(slot); });
      cell.addEventListener('keydown', function (ev) {
        if (ev.keyCode === 13 || ev.keyCode === 32 ||
            ev.key === 'Enter' || ev.key === ' ' || ev.key === 'Spacebar') {
          ev.preventDefault();
          onCellTap(slot);
        }
      });
    }
    return cell;
  }

  function makeNavBtn(iconeInner, title, enabled, onClick) {
    var b = bouton('fh-pe-fleche-btn fh-carte fh-texte fh-bordure',
      icone(iconeInner, 30, 'fh-pe-icone-seule'), title);
    b.title = title;
    if (!enabled) {
      b.disabled = true;
      b.setAttribute('aria-disabled', 'true');
    }
    if (enabled && typeof onClick === 'function') {
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        onClick();
      });
    }
    return b;
  }

  function collapse(_container) { /* nothing to clean */ }

  global.Tiles = global.Tiles || {};
  global.Tiles['weekly-menu'] = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse,
    repasAffiches: repasAffichesEs5,
    metaCase: metaCaseEs5,
    plageSemaine: plageSemaineEs5
  };
})(window);
