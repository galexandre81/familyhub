/* tiles/recipe-today.js — Repas du moment.
   Compact : libellé du repas + recettes du slot + profils présents.
   Expand : mode cuisine plein écran (portions, ingrédients, étapes avec timers).
   ES5 vanilla, iOS 9.3.6 OK. La data vient du snapshot (pré-calculée par
   functions/src/tiles/recipeToday.ts). Pas d'appel Firestore direct ici. */
(function (global) {
  'use strict';

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- helpers ---------- */

  function parseQuantity(q) {
    if (q == null) return null;
    /* Tolère : "300", "1.5", "1,5", "1/2". Renvoie null pour "qsp", "1 botte", etc. */
    var s = String(q).replace(',', '.').trim();
    if (s.indexOf('/') > -1) {
      var parts = s.split('/');
      if (parts.length === 2) {
        var num = parseFloat(parts[0]);
        var den = parseFloat(parts[1]);
        if (!isNaN(num) && !isNaN(den) && den !== 0) return num / den;
      }
      return null;
    }
    var n = parseFloat(s);
    if (isNaN(n)) return null;
    /* Si la string contient autre chose qu'un nombre (ex "1 botte"), on rejette. */
    if (String(n) !== s && (n + '.0') !== s && (n + '.5') !== s) {
      /* Tolère aussi "1.5" avec parseFloat exact match */
      if (s.replace(/^0+/, '').replace('.', '') !== String(n).replace('.', '')) {
        /* Trop strict ? Acceptons si parseFloat a au moins consommé des chiffres. */
      }
    }
    /* Vérifie : la string nettoyée ne doit contenir que [0-9.] */
    if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
    return n;
  }

  function formatScaled(n) {
    if (n == null) return null;
    /* Round à 1 décimale max, retire les .0 */
    var rounded = Math.round(n * 10) / 10;
    if (rounded === Math.round(rounded)) return String(Math.round(rounded));
    return String(rounded);
  }

  function scaleQuantite(q, ratio) {
    var n = parseQuantity(q);
    if (n == null) return q; /* qsp, 1 botte → garde tel quel */
    return formatScaled(n * ratio);
  }

  function repasIcon(repas) {
    if (repas === 'petitDej') return '☕';
    if (repas === 'dej') return '☀';
    if (repas === 'diner') return '🌙';
    return '🍽';
  }

  function difficulteLabel(d) {
    if (d <= 1) return 'Facile';
    if (d === 2) return 'Moyen';
    return 'Avancé';
  }

  /* ---------- COMPACT ---------- */

  function render(container, data, _config) {
    container.className = 'grid-cell tile-recipe-today tile-clickable';
    container.innerHTML = '';

    var d = data || {};

    var titleEl = document.createElement('div');
    titleEl.className = 'tile-title';
    titleEl.innerHTML = 'À cuisiner';
    container.appendChild(titleEl);

    var body = document.createElement('div');
    body.style.padding = '4px 0';
    container.appendChild(body);

    if (d.repasActif === 'aucun' || !d.recettes || d.recettes.length === 0) {
      body.innerHTML =
        '<div style="text-align:center; padding:14px 8px; opacity:0.7">' +
          '<div style="font-size:32px; margin-bottom:6px">📋</div>' +
          '<div style="font-size:13px">Pas de plan actif<br>ou pas de recette<br>pour le moment</div>' +
        '</div>';
      return;
    }

    /* Eyebrow : "Ce midi" / "Demain matin" + icône */
    var eyebrow = document.createElement('div');
    eyebrow.style.cssText =
      'font-size:10px; letter-spacing:0.18em; text-transform:uppercase; ' +
      'opacity:0.7; margin-bottom:6px;';
    eyebrow.innerHTML =
      '<span style="margin-right:6px; font-size:14px">' + repasIcon(d.repasActif) + '</span>' +
      escapeHtml(d.repasLabel || '') +
      (d.isFallbackToNext
        ? ' <span style="opacity:0.6;font-style:italic">(prochain)</span>'
        : '') +
      (d.source === 'batch'
        ? ' <span style="font-size:9px; padding:1px 5px; background:rgba(217,160,91,0.15); border-radius:3px; margin-left:4px">BATCH</span>'
        : '');
    body.appendChild(eyebrow);

    /* Titres des recettes */
    var titles = document.createElement('div');
    titles.style.cssText = 'margin:8px 0 10px 0; line-height:1.25;';
    var html = '';
    for (var i = 0; i < d.recettes.length; i++) {
      var r = d.recettes[i];
      var nom = escapeHtml(r.nom || '(sans nom)');
      var temps = (r.tempsTotalMinutes != null) ? r.tempsTotalMinutes : '?';
      if (i === 0) {
        html += '<div style="font-family:Georgia,serif; font-size:18px; font-weight:600">' +
                  nom +
                '</div>' +
                '<div style="font-size:11px; opacity:0.65; margin-top:2px">' + temps + ' min · ' +
                  difficulteLabel(r.difficulte || 1) +
                '</div>';
      } else {
        html += '<div style="font-size:13px; opacity:0.85; margin-top:6px; font-style:italic">+ ' +
                  nom +
                '</div>';
      }
    }
    titles.innerHTML = html;
    body.appendChild(titles);

    /* Pastilles profils */
    if (d.profilsPresents && d.profilsPresents.length > 0) {
      var profilsEl = document.createElement('div');
      profilsEl.style.cssText = 'display:-webkit-flex; display:flex; gap:4px; flex-wrap:wrap; margin-top:8px;';
      for (var p = 0; p < d.profilsPresents.length; p++) {
        var prof = d.profilsPresents[p];
        var pill = document.createElement('span');
        pill.style.cssText =
          'display:inline-block; width:24px; height:24px; line-height:24px; text-align:center; ' +
          'border-radius:50%; font-size:11px; font-weight:600; ' +
          'background:' + (prof.couleur || '#888') + '; color:#fff;';
        pill.title = prof.nom;
        pill.innerHTML = escapeHtml(prof.initiale || (prof.nom ? prof.nom.charAt(0).toUpperCase() : '?'));
        profilsEl.appendChild(pill);
      }
      if (d.invitesNoms && d.invitesNoms.length > 0) {
        var inv = document.createElement('span');
        inv.style.cssText =
          'display:inline-block; padding:0 8px; height:24px; line-height:24px; ' +
          'border-radius:12px; font-size:11px; ' +
          'border:1px dashed rgba(217,160,91,0.6); color:#D9A05B;';
        inv.innerHTML = '+ ' + escapeHtml(d.invitesNoms.join(', '));
        profilsEl.appendChild(inv);
      }
      body.appendChild(profilsEl);
    }

    /* CTA discret */
    var cta = document.createElement('div');
    cta.style.cssText =
      'font-size:10px; letter-spacing:0.15em; text-transform:uppercase; ' +
      'opacity:0.5; margin-top:10px; text-align:right;';
    cta.innerHTML = 'Toucher → mode cuisine →';
    body.appendChild(cta);
  }

  function cleanup(container) {
    container.innerHTML = '';
  }

  /* ---------- EXPAND : mode cuisine plein écran ---------- */

  /**
   * État local de l'expand :
   * - currentRecetteIdx : index de la recette affichée (0 par défaut)
   * - portionsTarget : nombre de portions courant
   */
  function expand(container, data, _config, _tileId) {
    container.className = 'tile-overlay-content tile-recipe-today-expand';
    container.innerHTML = '';

    var d = data || {};
    var recettes = (d.recettes || []);
    if (recettes.length === 0) {
      container.innerHTML =
        '<div style="padding:40px; text-align:center; font-size:18px; opacity:0.7">' +
          'Pas de recette à afficher pour le moment.' +
        '</div>';
      return;
    }

    var state = {
      idx: 0,
      portionsTarget: recettes[0].portions || 4
    };

    /* ---- Header : title + tabs si plusieurs recettes + portion picker ---- */

    var header = document.createElement('div');
    header.style.cssText = 'padding:16px 20px; border-bottom:1px solid rgba(217,160,91,0.15);';
    container.appendChild(header);

    var headerTop = document.createElement('div');
    headerTop.style.cssText = 'display:-webkit-flex; display:flex; -webkit-align-items:flex-start; align-items:flex-start; gap:16px; -webkit-flex-wrap:wrap; flex-wrap:wrap;';
    header.appendChild(headerTop);

    var titleBlock = document.createElement('div');
    titleBlock.style.cssText = '-webkit-flex:1; flex:1; min-width:200px;';
    headerTop.appendChild(titleBlock);

    /* Eyebrow repas */
    if (d.repasLabel) {
      var eyebrow = document.createElement('div');
      eyebrow.style.cssText = 'font-size:11px; letter-spacing:0.2em; text-transform:uppercase; opacity:0.7; margin-bottom:4px;';
      eyebrow.innerHTML = repasIcon(d.repasActif) + ' ' + escapeHtml(d.repasLabel);
      titleBlock.appendChild(eyebrow);
    }

    var titleEl = document.createElement('div');
    titleEl.style.cssText = 'font-family:Georgia,serif; font-size:28px; line-height:1.15; margin-bottom:4px;';
    titleEl.id = 'rt-title';
    titleBlock.appendChild(titleEl);

    var metaEl = document.createElement('div');
    metaEl.style.cssText = 'font-size:13px; opacity:0.7;';
    metaEl.id = 'rt-meta';
    titleBlock.appendChild(metaEl);

    /* Pastilles profils sur la droite */
    if (d.profilsPresents && d.profilsPresents.length > 0) {
      var profilsBlock = document.createElement('div');
      profilsBlock.style.cssText = 'display:-webkit-flex; display:flex; gap:6px; -webkit-flex-wrap:wrap; flex-wrap:wrap;';
      for (var p = 0; p < d.profilsPresents.length; p++) {
        var prof = d.profilsPresents[p];
        var pill = document.createElement('span');
        pill.style.cssText =
          'display:inline-block; width:32px; height:32px; line-height:32px; text-align:center; ' +
          'border-radius:50%; font-size:14px; font-weight:600; ' +
          'background:' + (prof.couleur || '#888') + '; color:#fff;';
        pill.innerHTML = escapeHtml(prof.initiale || (prof.nom ? prof.nom.charAt(0).toUpperCase() : '?'));
        profilsBlock.appendChild(pill);
      }
      headerTop.appendChild(profilsBlock);
    }

    /* Tabs si plusieurs recettes */
    if (recettes.length > 1) {
      var tabs = document.createElement('div');
      tabs.style.cssText = 'display:-webkit-flex; display:flex; gap:6px; margin-top:12px;';
      header.appendChild(tabs);
      for (var ti = 0; ti < recettes.length; ti++) {
        (function (ix) {
          var btn = document.createElement('button');
          btn.type = 'button';
          btn.setAttribute('data-tab-idx', ix);
          btn.style.cssText =
            'padding:8px 14px; font-size:13px; border:1px solid rgba(217,160,91,0.3); ' +
            'background:transparent; color:#FAFAF7; border-radius:4px; cursor:pointer;';
          btn.innerHTML = escapeHtml(recettes[ix].nom || '(sans nom)');
          btn.addEventListener('click', function () {
            state.idx = ix;
            state.portionsTarget = recettes[ix].portions || 4;
            renderRecette();
          });
          tabs.appendChild(btn);
        })(ti);
      }
    }

    /* Portion picker */
    var portionRow = document.createElement('div');
    portionRow.style.cssText =
      'display:-webkit-flex; display:flex; -webkit-align-items:center; align-items:center; ' +
      'gap:10px; margin-top:14px; font-size:13px;';
    portionRow.innerHTML =
      '<span style="opacity:0.7">Portions :</span>' +
      '<button type="button" data-act="minus" style="width:36px; height:36px; border:1px solid rgba(217,160,91,0.3); background:transparent; color:#FAFAF7; border-radius:4px; font-size:18px;">−</button>' +
      '<span data-role="portions-display" style="font-size:20px; font-weight:600; min-width:34px; text-align:center;">' + state.portionsTarget + '</span>' +
      '<button type="button" data-act="plus" style="width:36px; height:36px; border:1px solid rgba(217,160,91,0.3); background:transparent; color:#FAFAF7; border-radius:4px; font-size:18px;">+</button>' +
      '<button type="button" data-act="reset" style="margin-left:8px; padding:4px 10px; background:transparent; color:#D9A05B; border:none; font-size:12px; text-decoration:underline;">réinit.</button>';
    header.appendChild(portionRow);

    portionRow.querySelector('[data-act="minus"]').addEventListener('click', function () {
      if (state.portionsTarget > 1) {
        state.portionsTarget--;
        renderRecette();
      }
    });
    portionRow.querySelector('[data-act="plus"]').addEventListener('click', function () {
      if (state.portionsTarget < 30) {
        state.portionsTarget++;
        renderRecette();
      }
    });
    portionRow.querySelector('[data-act="reset"]').addEventListener('click', function () {
      state.portionsTarget = recettes[state.idx].portions || 4;
      renderRecette();
    });

    /* ---- Body : ingredients + etapes ---- */

    var body = document.createElement('div');
    body.style.cssText = 'padding:20px; overflow-y:auto; -webkit-overflow-scrolling:touch;';
    body.id = 'rt-body';
    container.appendChild(body);

    /* Notes du slot (ex: "Marc et Sophie invités") */
    if (d.notes) {
      var notesEl = document.createElement('div');
      notesEl.style.cssText =
        'background:rgba(217,160,91,0.08); border-left:3px solid #D9A05B; ' +
        'padding:10px 14px; font-style:italic; font-size:13px; margin:0 20px 16px 20px;';
      notesEl.innerHTML = '« ' + escapeHtml(d.notes) + ' »';
      header.appendChild(notesEl);
    }

    /* Initial render */
    renderRecette();

    function renderRecette() {
      var r = recettes[state.idx];
      var ratio = r.portions > 0 ? state.portionsTarget / r.portions : 1;

      /* Update tabs visuel */
      var tabBtns = container.querySelectorAll('[data-tab-idx]');
      for (var t = 0; t < tabBtns.length; t++) {
        var active = parseInt(tabBtns[t].getAttribute('data-tab-idx'), 10) === state.idx;
        tabBtns[t].style.background = active ? '#D9A05B' : 'transparent';
        tabBtns[t].style.color = active ? '#1F1A14' : '#FAFAF7';
      }

      /* Update title + meta */
      document.getElementById('rt-title').innerHTML = escapeHtml(r.nom || '(sans nom)');
      var metaParts = [];
      if (r.tempsTotalMinutes) metaParts.push(r.tempsTotalMinutes + ' min total');
      if (r.tempsPrepMinutes != null) metaParts.push('prep ' + r.tempsPrepMinutes + ' + cuisson ' + r.tempsCuissonMinutes);
      metaParts.push(difficulteLabel(r.difficulte || 1));
      if (r.tags && r.tags.length > 0) {
        for (var tg = 0; tg < Math.min(r.tags.length, 3); tg++) {
          metaParts.push(escapeHtml(r.tags[tg]));
        }
      }
      document.getElementById('rt-meta').innerHTML = metaParts.join(' · ');

      /* Update portions display */
      var portionsDisp = container.querySelector('[data-role="portions-display"]');
      if (portionsDisp) portionsDisp.innerHTML = state.portionsTarget;

      /* Update body */
      var html = '';
      if (r.description) {
        html += '<p style="font-style:italic; opacity:0.85; margin-bottom:18px;">' +
                  escapeHtml(r.description) + '</p>';
      }

      /* Ingredients */
      html += '<h3 style="font-size:15px; letter-spacing:0.15em; text-transform:uppercase; opacity:0.7; margin-bottom:8px;">Ingrédients</h3>';
      html += '<ul style="list-style:none; padding:0; margin:0 0 24px 0;">';
      var ings = r.ingredients || [];
      for (var i = 0; i < ings.length; i++) {
        var ing = ings[i];
        var qty = scaleQuantite(ing.quantite, ratio);
        var qtyStr = (qty != null && qty !== '') ? (qty + ' ' + (ing.unite || '')) : (ing.unite || '');
        var frigoBadge = ing.noteFrigo
          ? '<span style="margin-left:6px; padding:1px 6px; background:rgba(125,159,118,0.2); color:#7D9F76; font-size:10px; border-radius:3px;">FRIGO</span>'
          : '';
        html += '<li style="padding:4px 0; border-bottom:1px solid rgba(217,160,91,0.08); font-size:15px;">' +
                  '<span style="font-weight:600; min-width:80px; display:inline-block;">' + escapeHtml(qtyStr.trim()) + '</span> · ' +
                  escapeHtml(ing.libelle || '') +
                  frigoBadge +
                '</li>';
      }
      html += '</ul>';

      /* Etapes */
      html += '<h3 style="font-size:15px; letter-spacing:0.15em; text-transform:uppercase; opacity:0.7; margin-bottom:12px;">Étapes</h3>';
      html += '<ol style="list-style:none; padding:0; margin:0; counter-reset:step;">';
      var etapes = (r.etapes || []).slice().sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); });
      for (var s = 0; s < etapes.length; s++) {
        var e = etapes[s];
        var stepNum = s + 1;
        var timerBtn = '';
        if (e.dureeMinutes && e.dureeMinutes > 0) {
          timerBtn =
            '<button type="button" class="rt-timer-btn" data-step-idx="' + s + '" ' +
              'data-duration="' + e.dureeMinutes + '" data-recette-nom="' + escapeHtml(r.nom || '') + '" ' +
              'style="margin-top:8px; padding:8px 14px; background:#D9A05B; color:#1F1A14; ' +
              'border:none; border-radius:4px; font-size:13px; font-weight:600;">' +
              '⏱ Timer ' + e.dureeMinutes + ' min' +
            '</button>';
        }
        html += '<li style="display:-webkit-flex; display:flex; gap:12px; padding:14px 0; border-bottom:1px solid rgba(217,160,91,0.08);">' +
                  '<div style="flex-shrink:0; width:32px; height:32px; border-radius:50%; background:rgba(217,160,91,0.15); ' +
                          'color:#D9A05B; line-height:32px; text-align:center; font-weight:600; font-size:14px;">' + stepNum + '</div>' +
                  '<div style="-webkit-flex:1; flex:1;">' +
                    '<div style="font-size:15px; line-height:1.5;">' + escapeHtml(e.description || '') + '</div>' +
                    timerBtn +
                  '</div>' +
                '</li>';
      }
      html += '</ol>';

      document.getElementById('rt-body').innerHTML = html;

      /* Wire timer buttons */
      var timerBtns = container.querySelectorAll('.rt-timer-btn');
      for (var b = 0; b < timerBtns.length; b++) {
        timerBtns[b].addEventListener('click', function (ev) {
          var btn = ev.currentTarget;
          var dur = parseInt(btn.getAttribute('data-duration'), 10);
          var nom = btn.getAttribute('data-recette-nom') || 'Étape';
          var stepIdx = parseInt(btn.getAttribute('data-step-idx'), 10) + 1;
          if (global.FamilyHubTimers && typeof global.FamilyHubTimers.startTimer === 'function') {
            var label = nom + ' — étape ' + stepIdx;
            global.FamilyHubTimers.startTimer(label, dur * 60);
            btn.innerHTML = '✓ Timer lancé';
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.background = '#7D9F76';
            btn.style.color = '#fff';
          }
        });
      }
    }
  }

  function collapse(_container) {
    /* Rien à nettoyer (les timers une fois lancés vivent dans la collection partagée). */
  }

  global.Tiles = global.Tiles || {};
  global.Tiles['recipe-today'] = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse
  };
})(window);
