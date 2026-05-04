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

  function expand(container, data, _config, _tileId) {
    container.className = 'tile-overlay-content tile-weekly-menu-expand';
    container.innerHTML = '';

    var d = data || {};
    if (!d.hasActivePlan || !d.semaine || d.semaine.length === 0) {
      container.innerHTML =
        '<div style="padding:60px; text-align:center; font-size:18px; opacity:0.7">' +
          'Pas de plan actif cette semaine.' +
        '</div>';
      return;
    }

    /* Header */
    var header = document.createElement('div');
    header.style.cssText = 'padding:16px 20px; border-bottom:1px solid rgba(217,160,91,0.15);';
    var dateRange = '';
    if (d.dateDebutISO) {
      var debut = new Date(d.dateDebutISO + 'T12:00:00Z');
      var fin = new Date((d.dateFinISO || d.dateDebutISO) + 'T12:00:00Z');
      dateRange = 'Semaine du ' +
        debut.getDate() + ' ' + ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'][debut.getMonth()] +
        ' au ' +
        fin.getDate() + ' ' + ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'][fin.getMonth()];
    }
    header.innerHTML =
      '<div style="font-size:11px; letter-spacing:0.2em; text-transform:uppercase; opacity:0.7">Menu de la semaine</div>' +
      '<div style="font-family:Georgia,serif; font-size:24px; margin-top:2px">' + escapeHtml(dateRange) + '</div>';
    container.appendChild(header);

    /* Grid 8 cols (1 label repas + 7 jours), 4 rows (1 header + 3 repas) */
    var byJour = groupByJour(d.semaine);
    var todayIdx = todayJourIndex(d.semaine);

    var gridWrap = document.createElement('div');
    gridWrap.style.cssText = 'padding:16px 20px; overflow:auto; -webkit-overflow-scrolling:touch;';
    container.appendChild(gridWrap);

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
        'padding:6px 8px; font-size:11px; letter-spacing:0.05em; ' +
        'text-transform:uppercase; opacity:0.7; white-space:nowrap; ' +
        'vertical-align:top; border-right:1px solid rgba(217,160,91,0.1);';
      tdLabel.innerHTML = repasIconSvg(repas, 16) + '<span style="margin-left:6px">' + repasShort(repas) + '</span>';
      tr.appendChild(tdLabel);

      for (var jj = 0; jj < 7; jj++) {
        var slot = (byJour[jj] && byJour[jj].slots[repas]) || null;
        var cell = document.createElement('td');
        var isPast = slot && slot.isPast;
        var isCellToday = jj === todayIdx;
        cell.style.cssText =
          'padding:8px 6px; vertical-align:top; min-width:100px; ' +
          'border:1px solid ' + (isCellToday ? 'rgba(217,160,91,0.4)' : 'rgba(217,160,91,0.1)') + ';' +
          'background:' + (isCellToday ? 'rgba(217,160,91,0.05)' : 'transparent') + ';' +
          'border-radius:4px;' +
          (isPast ? 'opacity:0.55;' : '');
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
