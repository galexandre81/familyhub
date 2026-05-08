/* tiles/weekly-menu.js — Menu de la semaine.
   Compact : titre + jour courant en avant + mini-aperçu 7 jours.
   Expand : grille 7 colonnes (jours) x 3 lignes (repas) plein écran.
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

  function todayJourIndex(semaine) {
    for (var i = 0; i < (semaine || []).length; i++) {
      if (semaine[i].isToday) return semaine[i].jour;
    }
    return -1;
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
        html += '<div style="display:-webkit-flex; display:flex; -webkit-align-items:center; align-items:center; gap:6px; font-size:12px; padding:1px 0;">' +
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
      'display:-webkit-flex; display:flex; gap:3px; -webkit-justify-content:space-between; justify-content:space-between;';
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
      weekRow.innerHTML += '<div style="' + pillStyle + '">' +
        '<div style="font-weight:600; letter-spacing:0.05em">' + JOURS_SHORT[j].toUpperCase() + '</div>' +
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

  /**
   * Transforme une recette Firestore (champ `nom`, `tempsPrepMinutes`, etc.)
   * vers le format `RecipeTodayRecette` consommé par recipe-today.expand.
   */
  function transformFirestoreRecette(id, raw) {
    var data = raw || {};
    var tempsPrep = +data.tempsPrepMinutes || 0;
    var tempsCuisson = +data.tempsCuissonMinutes || 0;
    var ingFromFrigo = data.ingredientsFromFrigo || [];
    var ingredientsRaw = data.ingredients || [];
    var etapesRaw = data.etapes || [];
    var ingredients = [];
    for (var i = 0; i < ingredientsRaw.length; i++) {
      var ing = ingredientsRaw[i] || {};
      var item = {
        libelle: ing.libelle || '',
        quantite: ing.quantite != null ? String(ing.quantite) : '',
        unite: ing.unite || ''
      };
      if (ing.rayon) item.rayon = String(ing.rayon);
      if (ingFromFrigo[i]) item.noteFrigo = true;
      ingredients.push(item);
    }
    var etapes = [];
    for (var j = 0; j < etapesRaw.length; j++) {
      var e = etapesRaw[j] || {};
      var step = {
        ordre: +e.ordre || j + 1,
        description: e.description || ''
      };
      if (e.dureeMinutes && +e.dureeMinutes > 0) step.dureeMinutes = +e.dureeMinutes;
      etapes.push(step);
    }
    return {
      recetteId: id,
      nom: data.nom || '(sans nom)',
      description: data.description || '',
      portions: +data.portions || 4,
      tempsPrepMinutes: tempsPrep,
      tempsCuissonMinutes: tempsCuisson,
      tempsTotalMinutes: tempsPrep + tempsCuisson,
      difficulte: +data.difficulte || 1,
      ingredients: ingredients,
      etapes: etapes,
      tags: data.tags || []
    };
  }

  function repasLabelLong(repas) {
    if (repas === 'petitDej') return 'Petit-déj';
    if (repas === 'dej') return 'Déjeuner';
    if (repas === 'diner') return 'Dîner';
    return repas || 'Repas';
  }

  function expand(container, data, _config, _tileId) {
    container.className = 'tile-overlay-content tile-overlay-content--full tile-weekly-menu-expand';
    container.innerHTML = '';
    /* Force layout flex column pour que la grille puisse scroller proprement
       et que la vue détail (chargée plus tard via recipe-today) se positionne
       bien (sinon overlap header/body sur iOS 9). */
    container.style.cssText =
      'display:-webkit-flex; display:flex; ' +
      '-webkit-flex-direction:column; flex-direction:column; ' +
      'height:100%; width:100%; overflow:hidden;';

    var d = data || {};
    if (!d.hasActivePlan || !d.semaine || d.semaine.length === 0) {
      container.innerHTML =
        '<div style="padding:60px; text-align:center; font-size:18px; opacity:0.7">' +
          'Pas de plan actif cette semaine.' +
        '</div>';
      return;
    }

    /* Vue grille — extraite dans une fonction pour pouvoir y revenir
       depuis la vue détail recette. */
    renderGrid();

    function renderGrid() {
      container.innerHTML = '';
      container.style.cssText =
        'display:-webkit-flex; display:flex; ' +
        '-webkit-flex-direction:column; flex-direction:column; ' +
        'height:100%; width:100%; overflow:hidden;';
      buildGridUI(container, d, function (slot) { showRecetteForSlot(slot); }, function () { showBatchView(); });
    }

    function showBatchView() {
      var sessions = (d.batchSessions || []);
      if (sessions.length === 0) {
        container.innerHTML =
          '<div style="padding:60px; text-align:center; opacity:0.7">' +
            '<div style="font-size:18px; margin-bottom:14px">Aucune session de batch cooking cette semaine.</div>' +
            '<button type="button" data-act="back" style="padding:10px 20px; background:#D9A05B; color:#1F1A14; border:none; border-radius:4px; font-weight:600;">← Retour à la semaine</button>' +
          '</div>';
        var bb0 = container.querySelector('[data-act="back"]');
        if (bb0) bb0.addEventListener('click', renderGrid);
        return;
      }

      container.innerHTML = '';
      container.style.cssText =
        'display:-webkit-flex; display:flex; ' +
        '-webkit-flex-direction:column; flex-direction:column; ' +
        'height:100%; width:100%; overflow:hidden;';

      /* Bandeau retour */
      var backBar = document.createElement('div');
      backBar.style.cssText =
        'padding:8px 20px; background:rgba(217,160,91,0.10); ' +
        'border-bottom:1px solid rgba(217,160,91,0.25); ' +
        '-webkit-flex-shrink:0; flex-shrink:0;';
      backBar.innerHTML =
        '<button type="button" style="background:transparent; color:#D9A05B; ' +
        'border:none; font-size:14px; padding:4px 0; font-weight:600;">' +
        '← Retour à la semaine</button>';
      backBar.querySelector('button').addEventListener('click', renderGrid);
      container.appendChild(backBar);

      /* Header batch */
      var bHeader = document.createElement('div');
      bHeader.style.cssText =
        'padding:16px 20px; border-bottom:1px solid rgba(217,160,91,0.15); ' +
        '-webkit-flex-shrink:0; flex-shrink:0;';
      bHeader.innerHTML =
        '<div style="font-size:11px; letter-spacing:0.2em; text-transform:uppercase; opacity:0.7">Batch cooking de la semaine</div>' +
        '<div style="font-family:Georgia,serif; font-size:24px; margin-top:2px">' +
        sessions.length + ' session' + (sessions.length > 1 ? 's' : '') + ' à préparer</div>';
      container.appendChild(bHeader);

      /* Body : liste des sessions, chaque session liste ses recettes (cliquables) */
      var body = document.createElement('div');
      body.style.cssText =
        'padding:20px; overflow-y:auto; -webkit-overflow-scrolling:touch; ' +
        '-webkit-flex:1 1 auto; flex:1 1 auto; min-height:0;';
      container.appendChild(body);
      body.setAttribute('data-scroll-lock', '1');

      for (var s = 0; s < sessions.length; s++) {
        (function (session) {
          var dateLabel = session.date
            ? new Date(session.date + 'T12:00:00Z').toLocaleDateString('fr-FR', {
                weekday: 'long', day: 'numeric', month: 'long'
              })
            : '';
          var card = document.createElement('div');
          card.style.cssText =
            'background:rgba(217,160,91,0.05); border:1px solid rgba(217,160,91,0.20); ' +
            'border-radius:6px; padding:16px; margin-bottom:14px;' +
            (session.done ? 'opacity:0.55;' : '');
          var html =
            '<div style="display:-webkit-flex; display:flex; -webkit-justify-content:space-between; justify-content:space-between; -webkit-align-items:flex-start; align-items:flex-start; gap:12px; -webkit-flex-wrap:wrap; flex-wrap:wrap; margin-bottom:10px">' +
              '<div>' +
                '<div style="font-family:Georgia,serif; font-size:18px; line-height:1.2">' +
                  escapeHtml(dateLabel) + (session.done ? ' <span style="font-size:11px; color:#7D9F76; font-family:inherit; font-weight:600; letter-spacing:0.05em">· TERMINÉ</span>' : '') +
                '</div>' +
                '<div style="font-size:12px; opacity:0.7; margin-top:2px">' +
                  '⏱ ' + session.dureeEstimeeMinutes + ' min · ' +
                  session.recetteIds.length + ' recette' + (session.recetteIds.length > 1 ? 's' : '') +
                '</div>' +
              '</div>' +
            '</div>';
          if (session.notes) {
            html +=
              '<div style="background:rgba(217,160,91,0.08); border-left:3px solid #D9A05B; ' +
              'padding:8px 12px; font-style:italic; font-size:13px; margin-bottom:12px;">' +
              '« ' + escapeHtml(session.notes) + ' »</div>';
          }
          html += '<div style="font-size:11px; letter-spacing:0.15em; text-transform:uppercase; opacity:0.6; margin-bottom:6px">Recettes à préparer</div>';
          html += '<div data-role="recettes" style="display:-webkit-flex; display:flex; -webkit-flex-direction:column; flex-direction:column; gap:6px"></div>';
          card.innerHTML = html;
          var recettesWrap = card.querySelector('[data-role="recettes"]');
          for (var ri = 0; ri < session.recetteIds.length; ri++) {
            (function (rid, nom) {
              var btn = document.createElement('button');
              btn.type = 'button';
              btn.style.cssText =
                'text-align:left; padding:10px 14px; background:transparent; ' +
                'border:1px solid rgba(217,160,91,0.25); border-radius:4px; ' +
                'color:#FAFAF7; font-size:14px; cursor:pointer;';
              btn.innerHTML = '<span style="color:#D9A05B; margin-right:8px">▸</span>' + escapeHtml(nom || rid);
              btn.addEventListener('click', function () {
                showRecetteForSlot({
                  recetteIds: [rid],
                  repas: 'dej', /* fallback : on n'a pas de repas pour un batch */
                  date: session.date
                });
              });
              recettesWrap.appendChild(btn);
            })(session.recetteIds[ri], session.recetteNoms[ri]);
          }
          body.appendChild(card);
        })(sessions[s]);
      }
    }

    function showRecetteForSlot(slot) {
      if (!slot || !slot.recetteIds || slot.recetteIds.length === 0) return;
      container.innerHTML =
        '<div style="padding:60px; text-align:center; font-size:16px; opacity:0.7">' +
          'Chargement de la recette…' +
        '</div>';
      var db = global.FamilyHubGetDb && global.FamilyHubGetDb();
      var hid = global.FamilyHubGetHouseholdId && global.FamilyHubGetHouseholdId();
      if (!db || !hid) {
        container.innerHTML =
          '<div style="padding:40px; text-align:center; color:#C8553D">' +
            'Erreur : DB non disponible.' +
          '</div>';
        return;
      }
      var promises = [];
      for (var k = 0; k < slot.recetteIds.length; k++) {
        promises.push(
          db.collection('households').doc(hid).collection('recettes').doc(slot.recetteIds[k]).get()
        );
      }
      Promise.all(promises).then(function (docs) {
        var recettes = [];
        for (var m = 0; m < docs.length; m++) {
          if (docs[m].exists) {
            recettes.push(transformFirestoreRecette(docs[m].id, docs[m].data()));
          }
        }
        if (recettes.length === 0) {
          container.innerHTML =
            '<div style="padding:40px; text-align:center; opacity:0.7">' +
              'Aucune recette trouvée pour ce repas.' +
              '<br><br><button type="button" data-act="back" style="padding:8px 16px; background:#D9A05B; color:#1F1A14; border:none; border-radius:4px; font-weight:600;">← Retour à la semaine</button>' +
            '</div>';
          var bb = container.querySelector('[data-act="back"]');
          if (bb) bb.addEventListener('click', renderGrid);
          return;
        }
        var fakeData = {
          repasActif: slot.repas,
          repasLabel: repasLabelLong(slot.repas) + ' · ' +
            (slot.date ? new Date(slot.date + 'T12:00:00Z').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : ''),
          date: slot.date,
          slotId: '',
          recettes: recettes,
          profilsPresents: [],
          generatedAtISO: new Date().toISOString()
        };
        if (global.Tiles && global.Tiles['recipe-today'] && typeof global.Tiles['recipe-today'].expand === 'function') {
          global.Tiles['recipe-today'].expand(container, fakeData, {}, null);
          /* Ajoute un bandeau "Retour" en haut du container (avant le header
             posé par recipe-today.expand). Avec flex-shrink:0, il reste visible. */
          var backBar = document.createElement('div');
          backBar.style.cssText =
            'padding:8px 20px; background:rgba(217,160,91,0.10); ' +
            'border-bottom:1px solid rgba(217,160,91,0.25); ' +
            '-webkit-flex-shrink:0; flex-shrink:0;';
          backBar.innerHTML =
            '<button type="button" style="background:transparent; color:#D9A05B; ' +
            'border:none; font-size:14px; padding:4px 0; font-weight:600;">' +
            '← Retour à la semaine</button>';
          backBar.querySelector('button').addEventListener('click', renderGrid);
          container.insertBefore(backBar, container.firstChild);
        } else {
          container.innerHTML =
            '<div style="padding:40px; text-align:center; color:#C8553D">' +
              'Module recipe-today non chargé.' +
            '</div>';
        }
      }).catch(function (err) {
        if (window.console && window.console.error) console.error('[weekly-menu] fetch recette', err);
        container.innerHTML =
          '<div style="padding:40px; text-align:center; color:#C8553D">' +
            'Erreur de chargement.' +
          '</div>';
      });
    }
  }

  /**
   * Construit la grille semaine dans `container`. Le `onCellTap(slot)` est
   * appelé au tap d'une cellule contenant des recettes.
   */
  function buildGridUI(container, d, onCellTap, onBatchTap) {
    /* Header */
    var header = document.createElement('div');
    header.style.cssText =
      'padding:16px 20px; border-bottom:1px solid rgba(217,160,91,0.15); ' +
      '-webkit-flex-shrink:0; flex-shrink:0;';
    var dateRange = '';
    if (d.dateDebutISO) {
      var debut = new Date(d.dateDebutISO + 'T12:00:00Z');
      var fin = new Date((d.dateFinISO || d.dateDebutISO) + 'T12:00:00Z');
      dateRange = 'Semaine du ' +
        debut.getDate() + ' ' + ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'][debut.getMonth()] +
        ' au ' +
        fin.getDate() + ' ' + ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'][fin.getMonth()];
    }
    var batchSessions = d.batchSessions || [];
    var batchCount = batchSessions.length;
    var batchTotalMin = 0;
    for (var bi = 0; bi < batchSessions.length; bi++) {
      batchTotalMin += +batchSessions[bi].dureeEstimeeMinutes || 0;
    }
    var batchBtnHtml = '';
    if (batchCount > 0 && typeof onBatchTap === 'function') {
      batchBtnHtml =
        '<button type="button" data-act="batch" ' +
          'style="margin-top:10px; padding:10px 14px; background:rgba(217,160,91,0.12); ' +
          'border:1px solid rgba(217,160,91,0.40); color:#D9A05B; border-radius:4px; ' +
          'font-size:13px; font-weight:600; cursor:pointer; ' +
          'display:-webkit-flex; display:flex; -webkit-align-items:center; align-items:center; gap:8px">' +
          /* SVG mini chef hat / casserole */
          '<svg viewBox="0 0 50 50" width="18" height="18" aria-hidden="true">' +
            '<path d="M10 22 L40 22 L38 38 Q38 42, 34 42 L16 42 Q12 42, 12 38 Z" ' +
              'fill="rgba(217,160,91,0.18)" stroke="#D9A05B" stroke-width="2" stroke-linejoin="round"/>' +
            '<path d="M14 22 Q14 12, 25 12 Q36 12, 36 22" fill="none" stroke="#D9A05B" stroke-width="2"/>' +
            '<line x1="6" y1="42" x2="44" y2="42" stroke="#D9A05B" stroke-width="2" stroke-linecap="round"/>' +
          '</svg>' +
          '<span>Batch cooking de la semaine · ' + batchCount + ' session' + (batchCount > 1 ? 's' : '') +
          ' · ' + batchTotalMin + ' min</span>' +
          '<span style="margin-left:auto; opacity:0.7">→</span>' +
        '</button>';
    }
    header.innerHTML =
      '<div style="font-size:11px; letter-spacing:0.2em; text-transform:uppercase; opacity:0.7">Menu de la semaine</div>' +
      '<div style="font-family:Georgia,serif; font-size:24px; margin-top:2px">' + escapeHtml(dateRange) + '</div>' +
      batchBtnHtml;
    if (batchBtnHtml) {
      var batchBtn = header.querySelector('[data-act="batch"]');
      if (batchBtn) {
        batchBtn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          onBatchTap();
        });
      }
    }
    container.appendChild(header);

    /* Grid 8 cols (1 label repas + 7 jours), 4 rows (1 header + 3 repas) */
    var byJour = groupByJour(d.semaine);
    var todayIdx = todayJourIndex(d.semaine);

    var gridWrap = document.createElement('div');
    gridWrap.style.cssText =
      'padding:16px 20px; overflow:auto; -webkit-overflow-scrolling:touch; ' +
      '-webkit-flex:1 1 auto; flex:1 1 auto; min-height:0;';
    container.appendChild(gridWrap);
    gridWrap.setAttribute('data-scroll-lock', '1');

    var table = document.createElement('table');
    table.style.cssText = 'width:100%; border-collapse:separate; border-spacing:6px; font-size:12px;';
    gridWrap.appendChild(table);

    /* Header row */
    var thead = document.createElement('thead');
    var trH = document.createElement('tr');
    trH.appendChild(document.createElement('th'));
    for (var j = 0; j < 7; j++) {
      var th = document.createElement('th');
      var isToday = j === todayIdx;
      th.style.cssText =
        'padding:6px 4px; font-weight:600; letter-spacing:0.08em; ' +
        'text-transform:uppercase; font-size:11px; ' +
        'color:' + (isToday ? BRASS : 'inherit') + ';' +
        (isToday ? 'border-bottom:2px solid ' + BRASS + ';' : '');
      var dateLabel = '';
      if (byJour[j] && byJour[j].date) {
        var d2 = new Date(byJour[j].date + 'T12:00:00Z');
        dateLabel = '<div style="font-size:9px; opacity:0.6; margin-top:1px; font-weight:400; letter-spacing:0">' +
                    d2.getDate() + '/' + (d2.getMonth() + 1) + '</div>';
      }
      th.innerHTML = JOURS_SHORT[j] + dateLabel;
      trH.appendChild(th);
    }
    thead.appendChild(trH);
    table.appendChild(thead);

    /* Body : 3 rows for petitDej / dej / diner */
    var tbody = document.createElement('tbody');
    var repasList = ['petitDej', 'dej', 'diner'];
    for (var ri = 0; ri < repasList.length; ri++) {
      var repas = repasList[ri];
      var tr = document.createElement('tr');

      var tdLabel = document.createElement('td');
      tdLabel.style.cssText =
        'padding:8px; vertical-align:middle; text-align:center; ' +
        'border-right:1px solid rgba(217,160,91,0.1);';
      tdLabel.title = repasShort(repas);
      tdLabel.innerHTML = repasIconSvg(repas, 28);
      tr.appendChild(tdLabel);

      for (var jj = 0; jj < 7; jj++) {
        var slot = (byJour[jj] && byJour[jj].slots[repas]) || null;
        var cell = document.createElement('td');
        var isPast = slot && slot.isPast;
        var isCellToday = jj === todayIdx;
        var hasRecettes = slot && slot.recetteIds && slot.recetteIds.length > 0;
        cell.style.cssText =
          'padding:8px 6px; vertical-align:top; min-width:100px; ' +
          'border:1px solid ' + (isCellToday ? 'rgba(217,160,91,0.4)' : 'rgba(217,160,91,0.1)') + ';' +
          'background:' + (isCellToday ? 'rgba(217,160,91,0.05)' : 'transparent') + ';' +
          'border-radius:4px;' +
          (isPast ? 'opacity:0.55;' : '') +
          (hasRecettes ? 'cursor:pointer;' : '');
        if (hasRecettes && typeof onCellTap === 'function') {
          (function (s) {
            cell.addEventListener('click', function () { onCellTap(s); });
          })(slot);
        }
        if (!slot || (slot.recetteNoms.length === 0 && slot.profilsCount === 0)) {
          cell.style.opacity = '0.3';
          cell.innerHTML = '<span style="font-size:18px; color:' + BRASS + '">—</span>';
        } else if (slot.recetteNoms.length === 0) {
          cell.innerHTML = '<span style="font-size:11px; opacity:0.6; font-style:italic">à compléter</span>';
        } else {
          var html = '';
          for (var ni = 0; ni < slot.recetteNoms.length; ni++) {
            html += '<div style="font-size:12px; line-height:1.3; margin-bottom:' +
                    (ni < slot.recetteNoms.length - 1 ? '4px' : '0') + ';' +
                    (ni === 0 ? 'font-weight:600' : 'opacity:0.75; font-style:italic') + '">' +
                    escapeHtml(slot.recetteNoms[ni]) + '</div>';
          }
          var meta = [];
          if (slot.profilsCount > 0) meta.push(slot.profilsCount + (slot.profilsCount > 1 ? ' personnes' : ' personne'));
          if (slot.invitesCount > 0) meta.push('+' + slot.invitesCount + ' invité' + (slot.invitesCount > 1 ? 's' : ''));
          if (slot.isBatchConsumer) meta.push('batch');
          if (meta.length > 0) {
            html += '<div style="margin-top:6px; font-size:10px; opacity:0.55; ' +
                    'letter-spacing:0.05em; text-transform:uppercase">' +
                    escapeHtml(meta.join(' · ')) + '</div>';
          }
          cell.innerHTML = html;
        }
        tr.appendChild(cell);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
  }

  function collapse(_container) { /* nothing to clean */ }

  global.Tiles = global.Tiles || {};
  global.Tiles['weekly-menu'] = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse
  };
})(window);
