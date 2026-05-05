/* tiles/shopping-list.js — Liste de courses (mobile, iPad, etc.).
   Compact : caddy + compteur "12 / 35".
   Expand : liste groupée par rayon + bouton Envoyer aux courses (Web Share).
   ES5 vanilla, iOS 9.3.6 OK. Lit en live le doc shoppingLists du plan actif.
   Limitation : le display est en read-only via les rules Firestore (custom
   token). Le cochage n'est PAS possible depuis cette tuile — pour cela,
   ouvrir /menu sur le hub web (auth Google membre). */
(function (global) {
  'use strict';

  var BRASS = '#D9A05B';

  /* État partagé entre render() et expand() : on garde la dernière liste
     reçue via onSnapshot pour pouvoir afficher l'expand sans re-fetcher. */
  var state = {
    unsub: null,
    list: null,
    listId: null,
    cells: []   /* refs .tile-shopping-list pour réafficher au snapshot */
  };

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* Caddy SVG laiton */
  function svgCart(size) {
    var dim = size || 24;
    return '<svg viewBox="0 0 50 50" width="' + dim + '" height="' + dim + '" aria-hidden="true">' +
      '<path d="M6 8 L12 8 L16 32 L40 32 L44 14 L14 14" ' +
        'fill="none" stroke="' + BRASS + '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>' +
      '<circle cx="20" cy="40" r="3" fill="rgba(217,160,91,0.20)" stroke="' + BRASS + '" stroke-width="2"/>' +
      '<circle cx="36" cy="40" r="3" fill="rgba(217,160,91,0.20)" stroke="' + BRASS + '" stroke-width="2"/>' +
    '</svg>';
  }

  /* Send (avion papier) SVG laiton — pour bouton Envoyer */
  function svgSend(size) {
    var dim = size || 18;
    return '<svg viewBox="0 0 50 50" width="' + dim + '" height="' + dim + '" aria-hidden="true">' +
      '<path d="M6 24 L44 6 L36 44 L24 30 L6 24 Z" ' +
        'fill="rgba(217,160,91,0.18)" stroke="' + BRASS + '" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<line x1="24" y1="30" x2="36" y2="14" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>';
  }

  /* Check (item coché) */
  function svgCheck(size) {
    var dim = size || 18;
    return '<svg viewBox="0 0 50 50" width="' + dim + '" height="' + dim + '" aria-hidden="true">' +
      '<circle cx="25" cy="25" r="20" fill="rgba(125,159,118,0.18)" stroke="#7D9F76" stroke-width="2"/>' +
      '<path d="M14 26 L22 34 L36 18" fill="none" stroke="#7D9F76" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
  }

  /* Cercle vide (item non coché) */
  function svgCircle(size) {
    var dim = size || 18;
    return '<svg viewBox="0 0 50 50" width="' + dim + '" height="' + dim + '" aria-hidden="true">' +
      '<circle cx="25" cy="25" r="20" fill="none" stroke="' + BRASS + '" stroke-width="2" opacity="0.5"/>' +
    '</svg>';
  }

  var RAYON_LABELS = {
    'fruits-legumes': 'Fruits & légumes',
    'boucherie': 'Boucherie',
    'poissonnerie': 'Poissonnerie',
    'cremerie': 'Crémerie',
    'epicerie': 'Épicerie',
    'surgeles': 'Surgelés',
    'boulangerie': 'Boulangerie',
    'boissons': 'Boissons',
    'autres': 'Autres',
    /* Legacy */
    'frais-fruits-legumes': 'Fruits & légumes',
    'frais-laitier': 'Crémerie',
    'frais-boucherie': 'Boucherie',
    'frais-poissonnerie': 'Poissonnerie',
    'sec-epicerie': 'Épicerie',
    'surgele': 'Surgelés',
    'autre': 'Autres'
  };

  var RAYON_ORDER = [
    'fruits-legumes', 'frais-fruits-legumes',
    'boucherie', 'frais-boucherie',
    'poissonnerie', 'frais-poissonnerie',
    'cremerie', 'frais-laitier',
    'boulangerie',
    'epicerie', 'sec-epicerie',
    'surgeles', 'surgele',
    'boissons',
    'autres', 'autre'
  ];

  function rayonLabel(r) {
    return RAYON_LABELS[r] || r || 'Autres';
  }

  function formatQuantite(q, u) {
    if (q == null || q === '' || q === 0) return '';
    var n = parseFloat(q);
    var num = !isNaN(n) && n === Math.round(n) ? String(Math.round(n)) : String(q);
    return (num + ' ' + (u || '')).replace(/\s+$/, '');
  }

  /* ---------- Listener ---------- */

  function ensureListener(onUpdate) {
    if (state.unsub) {
      /* Already listening — appelle callback avec la dernière liste connue */
      if (state.list && typeof onUpdate === 'function') onUpdate(state.list, state.listId);
      return;
    }
    var db = global.FamilyHubGetDb && global.FamilyHubGetDb();
    var hid = global.FamilyHubGetHouseholdId && global.FamilyHubGetHouseholdId();
    if (!db || !hid) return;

    /* On cherche le shoppingList du plan actif. Approche simple : on écoute
       tous les shoppingLists du foyer et on prend le 1er (1 par plan actif). */
    state.unsub = db.collection('households').doc(hid).collection('shoppingLists')
      .onSnapshot(function (snap) {
        if (snap.empty) {
          state.list = null;
          state.listId = null;
          for (var i = 0; i < state.cells.length; i++) refreshCell(state.cells[i]);
          if (typeof onUpdate === 'function') onUpdate(null, null);
          return;
        }
        /* Si plusieurs : on prend celui dont le planId correspond au plan
           actif. Pour simplicité V1 : le 1er. */
        var doc = snap.docs[0];
        state.list = doc.data();
        state.listId = doc.id;
        for (var j = 0; j < state.cells.length; j++) refreshCell(state.cells[j]);
        if (typeof onUpdate === 'function') onUpdate(state.list, state.listId);
      }, function (err) {
        if (window.console && window.console.error) console.error('[shopping-list]', err);
      });
  }

  function refreshCell(cell) {
    if (!cell || !cell.parentNode) return;
    drawCompact(cell);
  }

  /* ---------- COMPACT ---------- */

  function drawCompact(container) {
    container.innerHTML = '';

    var titleEl = document.createElement('div');
    titleEl.className = 'tile-title';
    titleEl.innerHTML = 'Liste de courses';
    container.appendChild(titleEl);

    var body = document.createElement('div');
    body.style.cssText =
      '-webkit-flex:1; flex:1; display:-webkit-flex; display:flex; ' +
      '-webkit-flex-direction:column; flex-direction:column; ' +
      '-webkit-justify-content:center; justify-content:center; ' +
      '-webkit-align-items:center; align-items:center; text-align:center; padding:8px 4px;';
    container.appendChild(body);

    if (!state.list || !state.list.items) {
      body.innerHTML =
        '<div style="opacity:0.7; font-size:13px; line-height:1.5">' +
          'Pas de plan actif<br>ou pas de liste générée' +
        '</div>';
      return;
    }
    var items = state.list.items || [];
    var checked = 0;
    for (var i = 0; i < items.length; i++) if (items[i].checked) checked++;

    var iconWrap = document.createElement('div');
    iconWrap.style.cssText = 'line-height:0; margin-bottom:6px;';
    iconWrap.innerHTML = svgCart(56);
    body.appendChild(iconWrap);

    var countEl = document.createElement('div');
    countEl.style.cssText =
      'font-family:Georgia,serif; font-size:32px; line-height:1; color:#F2E8D5; ' +
      'letter-spacing:-0.02em; font-feature-settings:"tnum"; -webkit-font-feature-settings:"tnum";';
    countEl.innerHTML = checked + ' / ' + items.length;
    body.appendChild(countEl);

    var labelEl = document.createElement('div');
    labelEl.style.cssText = 'font-family:Georgia,serif; font-style:italic; font-size:13px; color:#C49B6B; margin-top:2px;';
    labelEl.innerHTML = items.length === 0 ? 'rien à acheter' :
                       (items.length === 1 ? 'item' : 'items');
    body.appendChild(labelEl);
  }

  function render(container, _data, _config) {
    container.className = 'grid-cell tile-shopping-list tile-clickable';
    /* track cell pour refresh sur snapshot */
    if (state.cells.indexOf(container) === -1) state.cells.push(container);
    drawCompact(container);
    ensureListener();
  }

  function cleanup(container) {
    /* On retire la cell de la liste. On garde le listener actif tant qu'au
       moins une cellule est rendue. */
    var idx = state.cells.indexOf(container);
    if (idx >= 0) state.cells.splice(idx, 1);
    container.innerHTML = '';
  }

  /* ---------- EXPAND : liste plein écran + Web Share ---------- */

  function expand(container, _data, _config, _tileId) {
    container.className = 'tile-overlay-content tile-shopping-list-expand';
    container.innerHTML = '';
    container.style.cssText =
      'display:-webkit-flex; display:flex; ' +
      '-webkit-flex-direction:column; flex-direction:column; ' +
      'height:100%; width:100%; overflow:hidden;';

    /* Header */
    var header = document.createElement('div');
    header.style.cssText =
      'padding:16px 20px; border-bottom:1px solid rgba(217,160,91,0.15); ' +
      '-webkit-flex-shrink:0; flex-shrink:0;';
    container.appendChild(header);

    var hRow = document.createElement('div');
    hRow.style.cssText =
      'display:-webkit-flex; display:flex; -webkit-align-items:center; align-items:center; ' +
      '-webkit-justify-content:space-between; justify-content:space-between; gap:12px; -webkit-flex-wrap:wrap; flex-wrap:wrap;';
    header.appendChild(hRow);

    var titleBlock = document.createElement('div');
    titleBlock.innerHTML =
      '<div style="font-size:11px; letter-spacing:0.2em; text-transform:uppercase; opacity:0.7">Liste de courses</div>' +
      '<div data-role="counter" style="font-family:Georgia,serif; font-size:24px; margin-top:2px">…</div>';
    hRow.appendChild(titleBlock);

    /* Bouton Envoyer aux courses */
    var sendBtn = document.createElement('button');
    sendBtn.type = 'button';
    sendBtn.style.cssText =
      'background:rgba(217,160,91,0.15); border:1px solid rgba(217,160,91,0.40); ' +
      'border-radius:6px; padding:10px 16px; color:' + BRASS + '; cursor:pointer; font-weight:600; font-size:14px; ' +
      'display:-webkit-inline-flex; display:inline-flex; -webkit-align-items:center; align-items:center; gap:8px;';
    sendBtn.innerHTML = svgSend(18) + '<span>Envoyer aux courses</span>';
    sendBtn.addEventListener('click', function () {
      handleShare(sendBtn);
    });
    hRow.appendChild(sendBtn);

    /* Body scrollable */
    var body = document.createElement('div');
    body.style.cssText =
      'padding:16px 20px; overflow-y:auto; -webkit-overflow-scrolling:touch; ' +
      '-webkit-flex:1 1 auto; flex:1 1 auto; min-height:0;';
    body.setAttribute('data-role', 'body');
    container.appendChild(body);

    /* Bandeau info read-only */
    var info = document.createElement('div');
    info.style.cssText =
      'margin:0 20px; padding:8px 12px; background:rgba(217,160,91,0.06); ' +
      'border-left:3px solid ' + BRASS + '; font-size:11px; opacity:0.75; ' +
      '-webkit-flex-shrink:0; flex-shrink:0;';
    info.innerHTML =
      'Lecture seule depuis ce display. Pour cocher les items, ouvre Family Hub sur ton mobile.';
    container.insertBefore(info, body);

    /* Render initial + update on snapshot */
    function redraw() {
      drawList(container);
    }
    redraw();
    /* Le listener met à jour state.list ; refresh manuel sur snapshot via
       la pile de cells. On ajoute un re-render local toutes les 4 secondes
       au cas où le snapshot global ne propage pas (rare). */
    var redrawTimer = setInterval(redraw, 4000);

    /* Stocke pour collapse */
    container._shoppingExpandTimer = redrawTimer;
  }

  function drawList(container) {
    var body = container.querySelector('[data-role="body"]');
    var counter = container.querySelector('[data-role="counter"]');
    if (!body) return;

    if (!state.list || !state.list.items) {
      body.innerHTML =
        '<div style="padding:40px; text-align:center; opacity:0.7">' +
          'Pas de plan actif ou pas de liste générée.' +
        '</div>';
      if (counter) counter.innerHTML = '';
      return;
    }

    var items = state.list.items;
    var checkedCount = 0;
    for (var i = 0; i < items.length; i++) if (items[i].checked) checkedCount++;
    if (counter) counter.innerHTML = checkedCount + ' / ' + items.length + ' pris';

    /* Group by rayon */
    var groups = {};
    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      var r = it.rayon || 'autres';
      if (!groups[r]) groups[r] = [];
      groups[r].push(it);
    }
    var orderedRayons = [];
    var seen = {};
    for (var ri = 0; ri < RAYON_ORDER.length; ri++) {
      var key = RAYON_ORDER[ri];
      if (groups[key] && !seen[key]) {
        orderedRayons.push(key);
        seen[key] = true;
      }
    }
    /* Add rayons inconnus */
    for (var key2 in groups) {
      if (groups.hasOwnProperty(key2) && !seen[key2]) {
        orderedRayons.push(key2);
        seen[key2] = true;
      }
    }

    var html = '';
    for (var oi = 0; oi < orderedRayons.length; oi++) {
      var rayon = orderedRayons[oi];
      var rItems = groups[rayon];
      html += '<div style="margin-bottom:18px">' +
                '<div style="font-size:11px; letter-spacing:0.18em; text-transform:uppercase; ' +
                  'opacity:0.6; padding-bottom:6px; margin-bottom:6px; ' +
                  'border-bottom:1px solid rgba(217,160,91,0.12);">' +
                  escapeHtml(rayonLabel(rayon)) +
                  ' <span style="opacity:0.6; letter-spacing:0; text-transform:none; font-size:11px">(' +
                  countUnchecked(rItems) + '/' + rItems.length + ')</span>' +
                '</div>' +
                '<ul style="list-style:none; padding:0; margin:0;">';
      for (var ii = 0; ii < rItems.length; ii++) {
        var it2 = rItems[ii];
        var qty = formatQuantite(it2.quantite, it2.unite);
        var prefix = it2.checked ? svgCheck(18) : svgCircle(18);
        var lineStyle = 'display:-webkit-flex; display:flex; -webkit-align-items:center; align-items:center; ' +
                        'gap:10px; padding:8px 0; font-size:14px;' +
                        (it2.checked ? 'opacity:0.55; text-decoration:line-through;' : '');
        html += '<li style="' + lineStyle + '">' +
                  '<span style="-webkit-flex-shrink:0; flex-shrink:0; line-height:0">' + prefix + '</span>' +
                  '<span style="-webkit-flex:1; flex:1">' +
                    (qty ? '<span style="font-weight:600; min-width:70px; display:inline-block">' + escapeHtml(qty) + '</span> · ' : '') +
                    escapeHtml(it2.nom || '') +
                  '</span>' +
                '</li>';
      }
      html += '</ul></div>';
    }
    body.innerHTML = html;
  }

  function countUnchecked(arr) {
    var n = 0;
    for (var i = 0; i < arr.length; i++) if (!arr[i].checked) n++;
    return n;
  }

  function buildShareText() {
    if (!state.list || !state.list.items) return '';
    var items = [];
    for (var i = 0; i < state.list.items.length; i++) {
      if (!state.list.items[i].checked) items.push(state.list.items[i]);
    }
    if (items.length === 0) return 'Liste de courses : tout est coché.';

    var groups = {};
    for (var k = 0; k < items.length; k++) {
      var it = items[k];
      var r = it.rayon || 'autres';
      if (!groups[r]) groups[r] = [];
      groups[r].push(it);
    }
    var orderedRayons = [];
    var seen = {};
    for (var ri = 0; ri < RAYON_ORDER.length; ri++) {
      var key = RAYON_ORDER[ri];
      if (groups[key] && !seen[key]) { orderedRayons.push(key); seen[key] = true; }
    }
    for (var key2 in groups) {
      if (groups.hasOwnProperty(key2) && !seen[key2]) { orderedRayons.push(key2); seen[key2] = true; }
    }

    var date = new Date();
    var monthsFr = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    var weekdaysFr = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
    var dateStr = weekdaysFr[date.getDay()] + ' ' + date.getDate() + ' ' + monthsFr[date.getMonth()];

    var lines = [];
    lines.push('Liste de courses — ' + dateStr);
    lines.push('');
    for (var oi = 0; oi < orderedRayons.length; oi++) {
      var rayon = orderedRayons[oi];
      lines.push('▸ ' + rayonLabel(rayon));
      var rItems = groups[rayon];
      for (var ii = 0; ii < rItems.length; ii++) {
        var it2 = rItems[ii];
        var qty = formatQuantite(it2.quantite, it2.unite);
        lines.push('☐ ' + (it2.nom || '') + (qty ? ' — ' + qty : ''));
      }
      lines.push('');
    }
    return lines.join('\n').replace(/\n+$/, '');
  }

  function handleShare(btn) {
    var text = buildShareText();
    if (!text) return;
    var origLabel = btn.innerHTML;
    btn.disabled = true;

    function done(label, color) {
      btn.innerHTML = label;
      if (color) {
        btn.style.background = color === 'sage' ? 'rgba(125,159,118,0.20)' : 'rgba(200,85,61,0.20)';
        btn.style.borderColor = color === 'sage' ? '#7D9F76' : '#C8553D';
        btn.style.color = color === 'sage' ? '#7D9F76' : '#C8553D';
      }
      setTimeout(function () {
        btn.innerHTML = origLabel;
        btn.style.background = 'rgba(217,160,91,0.15)';
        btn.style.borderColor = 'rgba(217,160,91,0.40)';
        btn.style.color = BRASS;
        btn.disabled = false;
      }, 3000);
    }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      navigator.share({ title: 'Liste de courses Family Hub', text: text })
        .then(function () {
          done(svgCheck(18) + '<span style="margin-left:6px; color:#7D9F76">Envoyée</span>', 'sage');
        })
        .catch(function (err) {
          if (err && err.name === 'AbortError') {
            btn.disabled = false;
            return;
          }
          fallbackClipboard(text, btn, done);
        });
    } else {
      fallbackClipboard(text, btn, done);
    }
  }

  function fallbackClipboard(text, btn, done) {
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function () {
          done(svgCheck(18) + '<span style="margin-left:6px; color:#7D9F76">Copiée — colle dans Keep</span>', 'sage');
        })
        .catch(function () {
          done('<span style="color:#C8553D">Échec — copie manuellement</span>', 'copper');
          if (window.console) console.log(text);
        });
    } else {
      done('<span style="color:#C8553D">Pas de partage dispo</span>', 'copper');
      if (window.console) console.log(text);
    }
  }

  function collapse(container) {
    if (container && container._shoppingExpandTimer) {
      clearInterval(container._shoppingExpandTimer);
      container._shoppingExpandTimer = null;
    }
  }

  global.Tiles = global.Tiles || {};
  global.Tiles['shopping-list'] = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse
  };
})(window);
