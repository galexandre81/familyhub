/* livre.js — Recipe book: search + filters. ES5 vanilla, Safari 9 compatible. */
(function () {
  'use strict';

  var state = {
    recipes: [],          /* [{id, nom, ...}] */
    query: '',
    repas: {},            /* { dejeuner: true, ... } */
    ingredient: {}        /* { poulet: true, ... } */
  };

  function $(id) { return document.getElementById(id); }

  function escapeHTML(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* Strip French accents — Safari 9 has no String.normalize */
  function deburr(s) {
    if (s == null) return '';
    return String(s)
      .toLowerCase()
      .replace(/[àâä]/g, 'a')
      .replace(/[éèêë]/g, 'e')
      .replace(/[îï]/g, 'i')
      .replace(/[ôö]/g, 'o')
      .replace(/[ùûü]/g, 'u')
      .replace(/ÿ/g, 'y')
      .replace(/ç/g, 'c')
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae');
  }

  function hasAny(arr, dict) {
    /* Returns true if no key set in dict, or if at least one arr value is in dict */
    var keys = Object.keys(dict);
    if (keys.length === 0) return true;
    if (!arr || !arr.length) return false;
    for (var i = 0; i < arr.length; i++) {
      if (dict[arr[i]]) return true;
    }
    return false;
  }

  function countActive(dict) {
    return Object.keys(dict).length;
  }

  /* ---------- Loading ---------- */

  function loadMenu(callback) {
    var xhr = new XMLHttpRequest();
    var url = '/data/menu-semaine.json?t=' + (new Date()).getTime();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try { callback(null, JSON.parse(xhr.responseText)); }
        catch (e) { callback(e, null); }
      } else {
        callback(new Error('HTTP ' + xhr.status), null);
      }
    };
    xhr.onerror = function () { callback(new Error('Network'), null); };
    xhr.send();
  }

  function buildRecipeIndex(menu) {
    var list = [];
    if (!menu || !menu.recettes) return list;
    var ids = Object.keys(menu.recettes);
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var r = menu.recettes[id];
      if (!r) continue;
      /* Pre-compute search blob: name + all ingredients, deburred */
      var blob = r.nom || '';
      if (r.ingredients && r.ingredients.length) {
        blob += ' ' + r.ingredients.join(' ');
      }
      list.push({
        id: id,
        nom: r.nom || id,
        personnes: r.personnes,
        temps_min: r.temps_min,
        niveau: r.niveau,
        repas: r.repas || [],
        ingredient_principal: r.ingredient_principal || [],
        tags: r.tags || [],
        ingredients_count: (r.ingredients || []).length,
        search_blob: deburr(blob)
      });
    }
    /* Sort alpha by nom */
    list.sort(function (a, b) {
      var na = deburr(a.nom);
      var nb = deburr(b.nom);
      if (na < nb) return -1;
      if (na > nb) return 1;
      return 0;
    });
    return list;
  }

  /* ---------- Filtering ---------- */

  function filterRecipes() {
    var q = deburr(state.query).replace(/^\s+|\s+$/g, '');
    var out = [];
    for (var i = 0; i < state.recipes.length; i++) {
      var r = state.recipes[i];
      if (q && r.search_blob.indexOf(q) === -1) continue;
      if (!hasAny(r.repas, state.repas)) continue;
      if (!hasAny(r.ingredient_principal, state.ingredient)) continue;
      out.push(r);
    }
    return out;
  }

  /* ---------- Render ---------- */

  function renderCount(n) {
    var label;
    if (n === 0) label = 'Aucune recette';
    else if (n === 1) label = '1 recette';
    else label = n + ' recettes';
    $('livre-count').innerHTML = label;
  }

  function renderResults(list) {
    var el = $('livre-results');
    if (!el) return;
    if (!list.length) {
      el.innerHTML = '<div class="livre-empty">Aucune recette ne correspond. Essaie d\'enlever un filtre.</div>';
      return;
    }
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      var meta = [];
      if (r.temps_min) meta.push(r.temps_min + ' min');
      if (r.niveau) meta.push(escapeHTML(r.niveau));
      if (r.personnes) meta.push(r.personnes + ' pers.');
      var tags = '';
      if (r.tags && r.tags.length) {
        for (var t = 0; t < r.tags.length; t++) {
          tags += '<span class="livre-card-tag">' + escapeHTML(r.tags[t]) + '</span>';
        }
      }
      html += '<a class="livre-card" href="/recipe.html?id=' + encodeURIComponent(r.id) + '">';
      html += '<div class="livre-card-name">' + escapeHTML(r.nom) + '</div>';
      html += '<div class="livre-card-meta">' + meta.join(' <span class="dot">&middot;</span> ') + '</div>';
      if (tags) html += '<div class="livre-card-tags">' + tags + '</div>';
      html += '</a>';
    }
    el.innerHTML = html;
  }

  function refresh() {
    var list = filterRecipes();
    renderCount(list.length);
    renderResults(list);
    var anyFilter = state.query || countActive(state.repas) || countActive(state.ingredient);
    var resetBtn = $('livre-reset');
    if (anyFilter) resetBtn.removeAttribute('hidden');
    else resetBtn.setAttribute('hidden', 'hidden');
    var clearBtn = $('livre-search-clear');
    if (state.query) clearBtn.removeAttribute('hidden');
    else clearBtn.setAttribute('hidden', 'hidden');
  }

  /* ---------- Wiring ---------- */

  function toggleChip(btn, dict) {
    var v = btn.getAttribute('data-value');
    if (!v) return;
    if (dict[v]) {
      delete dict[v];
      btn.className = btn.className.replace(/\s*is-active\b/g, '');
    } else {
      dict[v] = true;
      if (btn.className.indexOf('is-active') === -1) {
        btn.className = btn.className + ' is-active';
      }
    }
    refresh();
  }

  function wireChipGroup(containerId, dict) {
    var container = $(containerId);
    if (!container) return;
    var btns = container.getElementsByTagName('button');
    for (var i = 0; i < btns.length; i++) {
      btns[i].addEventListener('click', (function (b) {
        return function () { toggleChip(b, dict); };
      })(btns[i]));
    }
  }

  function clearAll() {
    state.query = '';
    state.repas = {};
    state.ingredient = {};
    $('livre-search-input').value = '';
    var groups = ['chips-repas', 'tiles-ingredient'];
    for (var g = 0; g < groups.length; g++) {
      var container = $(groups[g]);
      if (!container) continue;
      var btns = container.getElementsByTagName('button');
      for (var i = 0; i < btns.length; i++) {
        btns[i].className = btns[i].className.replace(/\s*is-active\b/g, '');
      }
    }
    refresh();
  }

  function pickRandom() {
    var list = filterRecipes();
    if (!list.length) return;
    var idx = Math.floor(Math.random() * list.length);
    var r = list[idx];
    window.location.href = '/recipe.html?id=' + encodeURIComponent(r.id);
  }

  function init() {
    loadMenu(function (err, menu) {
      if (err || !menu) {
        $('livre-results').innerHTML = '<div class="livre-empty">Impossible de charger les recettes.</div>';
        return;
      }
      state.recipes = buildRecipeIndex(menu);
      refresh();
    });

    var input = $('livre-search-input');
    function onInput() {
      state.query = input.value || '';
      refresh();
    }
    input.addEventListener('input', onInput);
    input.addEventListener('keyup', onInput); /* Safari 9 fallback for IME / paste */

    $('livre-search-clear').addEventListener('click', function () {
      input.value = '';
      state.query = '';
      refresh();
      input.focus();
    });

    wireChipGroup('chips-repas', state.repas);
    wireChipGroup('tiles-ingredient', state.ingredient);

    $('livre-reset').addEventListener('click', clearAll);
    $('livre-random').addEventListener('click', pickRandom);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
