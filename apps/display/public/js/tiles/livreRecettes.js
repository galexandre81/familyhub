/* tiles/livreRecettes.js — Livre de recettes du foyer.
   Tuile compacte : compteur + 3 derniers titres.
   Expand : recherche + filtres tags + détail recette.
   ES5 vanilla, Firebase JS SDK v8 compat (iOS 9.3.6 OK). */
(function (global) {
  'use strict';

  /* Cache global au module — recettes du foyer chargées une fois et partagées
     entre la tuile compacte et l'expand. Re-fetch automatique toutes les heures. */
  var cache = {
    recettes: null,        /* [{id, nom, tempsTotalMinutes, difficulte, tags, notation, ingredients, etapes}] */
    fetchedAt: 0,
    promise: null
  };
  var STALE_MS = 60 * 60 * 1000;

  function escapeHTML(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Strip French accents — Safari 9 sans String.normalize. */
  function deburr(s) {
    if (s == null) return '';
    return String(s).toLowerCase()
      .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e')
      .replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o')
      .replace(/[ùûü]/g, 'u').replace(/ÿ/g, 'y')
      .replace(/ç/g, 'c').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  }

  function tempsTotal(r) {
    var p = +r.tempsPrepMinutes || 0;
    var c = +r.tempsCuissonMinutes || 0;
    return p + c;
  }

  /* ---------- Fetch & cache ---------- */

  function fetchRecettes() {
    if (cache.promise) return cache.promise;
    if (cache.recettes && (Date.now() - cache.fetchedAt) < STALE_MS) {
      return Promise.resolve(cache.recettes);
    }
    var db = global.FamilyHubGetDb && global.FamilyHubGetDb();
    var hid = global.FamilyHubGetHouseholdId && global.FamilyHubGetHouseholdId();
    if (!db || !hid) {
      return Promise.resolve([]);
    }
    cache.promise = db.collection('households').doc(hid).collection('recettes').get()
      .then(function (snap) {
        var list = [];
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          list.push({
            id: doc.id,
            nom: d.nom || '(sans nom)',
            description: d.description || '',
            portions: d.portions || 4,
            tempsPrepMinutes: d.tempsPrepMinutes || 0,
            tempsCuissonMinutes: d.tempsCuissonMinutes || 0,
            difficulte: d.difficulte || 1,
            tags: d.tags || [],
            saison: d.saison || ['toutes'],
            notation: d.notation || null,
            statut: d.statut || 'accepted',
            ingredients: d.ingredients || [],
            etapes: d.etapes || [],
            createdAtMs: (d.createdAt && d.createdAt.toMillis) ? d.createdAt.toMillis() : 0,
            seedTags: d.seedTags || {},
            search: deburr((d.nom || '') + ' ' + ((d.tags || []).join(' ')))
          });
        });
        cache.recettes = list;
        cache.fetchedAt = Date.now();
        cache.promise = null;
        return list;
      })
      .catch(function (err) {
        cache.promise = null;
        if (global.console && global.console.error) {
          global.console.error('[livreRecettes] fetch error', err);
        }
        return [];
      });
    return cache.promise;
  }

  /* ---------- Filtrage ---------- */

  function applyConfigFilter(recettes, config) {
    var filtreTags = (config && config.filtreTags) || [];
    var out = recettes;
    if (filtreTags.length > 0) {
      out = [];
      for (var i = 0; i < recettes.length; i++) {
        var r = recettes[i];
        var match = false;
        for (var j = 0; j < filtreTags.length && !match; j++) {
          if (r.tags && indexOfStr(r.tags, filtreTags[j]) >= 0) match = true;
        }
        if (match) out.push(r);
      }
    }
    var tri = (config && config.tri) || 'recente';
    out = out.slice();
    if (tri === 'alpha') {
      out.sort(function (a, b) { return deburr(a.nom) < deburr(b.nom) ? -1 : 1; });
    } else if (tri === 'notation') {
      out.sort(function (a, b) { return (b.notation || 0) - (a.notation || 0); });
    } else {
      out.sort(function (a, b) { return b.createdAtMs - a.createdAtMs; });
    }
    return out;
  }

  function indexOfStr(arr, val) {
    for (var i = 0; i < arr.length; i++) if (arr[i] === val) return i;
    return -1;
  }

  /* ---------- Tuile compacte ---------- */

  function render(container, _data, config) {
    container.className = 'grid-cell tile-livre';
    container.innerHTML =
      '<div class="tile-title">Livre de recettes</div>' +
      '<div class="tile-livre-body">' +
        '<div class="tile-livre-count">…</div>' +
        '<ul class="tile-livre-recent"></ul>' +
        '<div class="tile-livre-cta">Toucher pour explorer</div>' +
      '</div>';

    fetchRecettes().then(function (all) {
      var list = applyConfigFilter(all, config);
      var countEl = container.querySelector('.tile-livre-count');
      var recentEl = container.querySelector('.tile-livre-recent');
      if (!countEl || !recentEl) return;

      countEl.innerHTML = list.length === 0
        ? 'Aucune recette'
        : list.length + (list.length === 1 ? ' recette' : ' recettes');

      var sampleN = Math.min(3, list.length);
      var html = '';
      for (var i = 0; i < sampleN; i++) {
        html += '<li>' + escapeHTML(list[i].nom) + '</li>';
      }
      recentEl.innerHTML = html;
    });
  }

  function cleanup(_container) { /* rien d'asynchrone à arrêter sur la tuile compacte */ }

  /* ---------- Expand (overlay plein écran) ---------- */

  function expand(container, _data, config, _tileId) {
    container.className = 'tile-overlay-content tile-livre-expand';
    container.innerHTML =
      '<h1 class="tile-overlay-h1">Livre de recettes</h1>' +
      '<div class="livre-search-row">' +
        '<input type="search" class="livre-search-input" placeholder="Cherche une recette, un tag…" ' +
          'autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">' +
      '</div>' +
      '<div class="livre-tag-row" data-role="tags"></div>' +
      '<div class="livre-status" data-role="status">Chargement…</div>' +
      '<div class="livre-grid" data-role="grid"></div>' +
      '<div class="livre-detail" data-role="detail" style="display:none"></div>';

    var input = container.querySelector('.livre-search-input');
    var statusEl = container.querySelector('[data-role="status"]');
    var gridEl = container.querySelector('[data-role="grid"]');
    var tagRow = container.querySelector('[data-role="tags"]');
    var detailEl = container.querySelector('[data-role="detail"]');

    var query = '';
    var activeTag = null;
    var allRecettes = [];

    function rerender() {
      var list = applyConfigFilter(allRecettes, config);
      if (activeTag) {
        list = list.filter(function (r) { return indexOfStr(r.tags || [], activeTag) >= 0; });
      }
      if (query) {
        var q = deburr(query).replace(/^\s+|\s+$/g, '');
        list = list.filter(function (r) { return r.search.indexOf(q) >= 0; });
      }
      if (list.length === 0) {
        statusEl.innerHTML = 'Aucune recette ne correspond.';
        gridEl.innerHTML = '';
        return;
      }
      statusEl.innerHTML = list.length + (list.length === 1 ? ' recette' : ' recettes');
      var html = '';
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        var meta = [];
        var t = tempsTotal(r); if (t > 0) meta.push(t + ' min');
        if (r.portions) meta.push(r.portions + ' pers.');
        var stars = r.notation ? ('★'.charAt(0) ? repeat('★', r.notation) : '') : '';
        html += '<button type="button" class="livre-card" data-rid="' + escapeHTML(r.id) + '">' +
          '<div class="livre-card-name">' + escapeHTML(r.nom) + '</div>' +
          '<div class="livre-card-meta">' + meta.join(' · ') +
            (stars ? ' <span class="livre-card-stars">' + stars + '</span>' : '') + '</div>' +
          (r.tags && r.tags.length ? '<div class="livre-card-tags">' +
            tagsHtml(r.tags.slice(0, 4)) + '</div>' : '') +
          '</button>';
      }
      gridEl.innerHTML = html;

      var cards = gridEl.querySelectorAll('.livre-card');
      for (var k = 0; k < cards.length; k++) {
        cards[k].addEventListener('click', (function (rid) {
          return function () { showDetail(rid); };
        })(cards[k].getAttribute('data-rid')));
      }
    }

    function tagsHtml(tags) {
      var html = '';
      for (var i = 0; i < tags.length; i++) {
        html += '<span class="livre-tag">' + escapeHTML(tags[i]) + '</span>';
      }
      return html;
    }

    function repeat(s, n) {
      var out = ''; for (var i = 0; i < n; i++) out += s; return out;
    }

    function buildTagBar() {
      /* Top tags : on aggrège l'union des tags présents et on prend les plus fréquents */
      var counts = {};
      for (var i = 0; i < allRecettes.length; i++) {
        var t = allRecettes[i].tags || [];
        for (var j = 0; j < t.length; j++) {
          counts[t[j]] = (counts[t[j]] || 0) + 1;
        }
      }
      var arr = [];
      for (var k in counts) {
        if (counts.hasOwnProperty(k)) arr.push({ tag: k, n: counts[k] });
      }
      arr.sort(function (a, b) { return b.n - a.n; });
      var top = arr.slice(0, 8);
      var html = '<button type="button" class="livre-tag-btn is-active" data-tag="">Tous</button>';
      for (var i = 0; i < top.length; i++) {
        html += '<button type="button" class="livre-tag-btn" data-tag="' +
          escapeHTML(top[i].tag) + '">' + escapeHTML(top[i].tag) +
          ' <span class="livre-tag-count">' + top[i].n + '</span></button>';
      }
      tagRow.innerHTML = html;
      var btns = tagRow.querySelectorAll('.livre-tag-btn');
      for (var b = 0; b < btns.length; b++) {
        btns[b].addEventListener('click', (function (btn, tag) {
          return function () {
            activeTag = tag || null;
            for (var x = 0; x < btns.length; x++) {
              btns[x].className = btns[x].className.replace(/\s*is-active\b/g, '');
            }
            btn.className = btn.className + ' is-active';
            rerender();
          };
        })(btns[b], btns[b].getAttribute('data-tag')));
      }
    }

    function showDetail(rid) {
      var r = null;
      for (var i = 0; i < allRecettes.length; i++) {
        if (allRecettes[i].id === rid) { r = allRecettes[i]; break; }
      }
      if (!r) return;
      gridEl.style.display = 'none';
      tagRow.style.display = 'none';
      statusEl.style.display = 'none';
      var searchRow = container.querySelector('.livre-search-row');
      if (searchRow) searchRow.style.display = 'none';
      detailEl.style.display = 'block';

      var ingHtml = '';
      for (var i = 0; i < r.ingredients.length; i++) {
        var ing = r.ingredients[i];
        var qty = (ing.quantite || '') + (ing.unite ? ' ' + ing.unite : '');
        ingHtml += '<li><strong>' + escapeHTML(qty.replace(/^\s+|\s+$/g, '')) + '</strong> ' +
          escapeHTML(ing.libelle || '') + '</li>';
      }
      var stepHtml = '';
      var steps = (r.etapes || []).slice().sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); });
      for (var s = 0; s < steps.length; s++) {
        var st = steps[s];
        stepHtml += '<li>' + escapeHTML(st.description || '') +
          (st.dureeMinutes ? ' <span class="livre-step-time">(' + st.dureeMinutes + ' min)</span>' : '') +
          '</li>';
      }
      var meta = [];
      var t = tempsTotal(r); if (t > 0) meta.push(t + ' min');
      if (r.portions) meta.push(r.portions + ' pers.');
      var difStr = ['', 'Facile', 'Moyen', 'Difficile'][r.difficulte] || '';
      if (difStr) meta.push(difStr);

      detailEl.innerHTML =
        '<button type="button" class="livre-back-btn" data-role="back">← Retour à la liste</button>' +
        '<h2 class="livre-detail-name">' + escapeHTML(r.nom) + '</h2>' +
        '<div class="livre-detail-meta">' + meta.join(' · ') + '</div>' +
        (r.description ? '<p class="livre-detail-desc">' + escapeHTML(r.description) + '</p>' : '') +
        '<h3 class="livre-detail-h3">Ingrédients</h3>' +
        '<ul class="livre-detail-ing">' + ingHtml + '</ul>' +
        '<h3 class="livre-detail-h3">Étapes</h3>' +
        '<ol class="livre-detail-steps">' + stepHtml + '</ol>';

      detailEl.querySelector('[data-role="back"]').addEventListener('click', function () {
        detailEl.style.display = 'none';
        detailEl.innerHTML = '';
        gridEl.style.display = '';
        tagRow.style.display = '';
        statusEl.style.display = '';
        if (searchRow) searchRow.style.display = '';
      });
      detailEl.scrollTop = 0;
    }

    /* Wire search */
    function onInput() { query = input.value || ''; rerender(); }
    input.addEventListener('input', onInput);
    input.addEventListener('keyup', onInput);

    fetchRecettes().then(function (list) {
      allRecettes = list;
      buildTagBar();
      rerender();
    });
  }

  function collapse(container) {
    /* Pas d'interval à clear, on retire juste les listeners en clearant le DOM */
    if (container) container.innerHTML = '';
  }

  global.Tiles = global.Tiles || {};
  global.Tiles['livre-recettes'] = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse
  };
})(window);
