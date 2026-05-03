/* tiles/livreRecettes.js — Livre de recettes du foyer.
   Tuile compacte : icône livre + nombre de recettes.
   Expand : wizard 2 étapes (Repas → Envies + Résultats inline).
   ES5 vanilla, Firebase JS SDK v8 compat (iOS 9.3.6 OK).
   Emojis : Unicode <= 8.0 uniquement (compatibles iOS 9.3.6, pas de tofu). */
(function (global) {
  'use strict';

  var cache = { recettes: null, fetchedAt: 0, promise: null };
  var STALE_MS = 60 * 60 * 1000;

  function escapeHTML(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function deburr(s) {
    if (s == null) return '';
    return String(s).toLowerCase()
      .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e')
      .replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o')
      .replace(/[ùûü]/g, 'u').replace(/ÿ/g, 'y')
      .replace(/ç/g, 'c').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  }

  function tempsTotal(r) {
    return (+r.tempsPrepMinutes || 0) + (+r.tempsCuissonMinutes || 0);
  }

  /* ---------- Fetch & cache ---------- */

  function fetchRecettes() {
    if (cache.promise) return cache.promise;
    if (cache.recettes && (Date.now() - cache.fetchedAt) < STALE_MS) {
      return Promise.resolve(cache.recettes);
    }
    var db = global.FamilyHubGetDb && global.FamilyHubGetDb();
    var hid = global.FamilyHubGetHouseholdId && global.FamilyHubGetHouseholdId();
    if (!db || !hid) return Promise.resolve([]);

    cache.promise = db.collection('households').doc(hid).collection('recettes').get()
      .then(function (snap) {
        var list = [];
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          var seedTags = d.seedTags || {};
          /* Pré-calcul d'un blob de recherche déaccentué : nom + tags + ingrédients
             pour permettre matching robuste même sans seedTags. */
          var ingNames = '';
          if (d.ingredients && d.ingredients.length) {
            for (var i = 0; i < d.ingredients.length; i++) {
              ingNames += ' ' + (d.ingredients[i].libelle || '');
            }
          }
          var blob = (d.nom || '') + ' ' + (d.description || '') + ' ' +
                     ((d.tags || []).join(' ')) + ' ' + ingNames;

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
            seedTags: seedTags,
            repas: seedTags.repas || '',
            proteine: seedTags.proteinePrincipale || '',
            style: deburr(seedTags.styleCulinaire || ''),
            blob: deburr(blob)
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

  function applyConfigFilter(recettes, config) {
    var filtreTags = (config && config.filtreTags) || [];
    if (filtreTags.length === 0) return recettes;
    var out = [];
    for (var i = 0; i < recettes.length; i++) {
      var r = recettes[i];
      var match = false;
      for (var j = 0; j < filtreTags.length && !match; j++) {
        if (r.tags) {
          for (var k = 0; k < r.tags.length; k++) {
            if (r.tags[k] === filtreTags[j]) { match = true; break; }
          }
        }
      }
      if (match) out.push(r);
    }
    return out;
  }

  /* ---------- Catalogues d'icônes (emojis iOS 9.3.6 safe) ---------- */

  /* Repas — multi-select. Match seedTags.repas + fallback tags + keywords. */
  var REPAS = [
    {
      key: 'petit-dej', emoji: '🍞', label: 'Petit-déj',
      keywords: ['petit-dej', 'petit dej', 'petit-dejeuner', 'petit dejeuner', 'breakfast', 'tartine', 'porridge', 'granola', 'pancake', 'crepe sucre'],
      seedRepas: ['petit-dej-sale', 'petit-dej-sucre']
    },
    {
      key: 'dejeuner', emoji: '☀️', label: 'Déjeuner',
      keywords: ['dejeuner', 'lunch', 'midi'],
      seedRepas: ['dejeuner']
    },
    {
      key: 'diner', emoji: '🌙', label: 'Dîner',
      keywords: ['diner', 'dinner', 'soir'],
      seedRepas: ['diner']
    },
    {
      key: 'encas', emoji: '🍪', label: 'Goûter / Encas',
      keywords: ['gouter', 'encas', 'snack', 'collation'],
      seedRepas: []  /* pas de slot officiel, on s'appuie sur tags+keywords */
    }
  ];

  function matchRepas(r, key) {
    var def = null;
    for (var i = 0; i < REPAS.length; i++) if (REPAS[i].key === key) { def = REPAS[i]; break; }
    if (!def) return false;
    /* 1. seedTags.repas */
    if (r.repas) {
      for (var s = 0; s < def.seedRepas.length; s++) {
        if (r.repas === def.seedRepas[s]) return true;
      }
      /* "tout" matche déjeuner et dîner par défaut */
      if (r.repas === 'tout' && (key === 'dejeuner' || key === 'diner')) return true;
    }
    /* 2. fallback : tags + nom + description contiennent un keyword */
    for (var k = 0; k < def.keywords.length; k++) {
      if (r.blob.indexOf(def.keywords[k]) >= 0) return true;
    }
    return false;
  }

  /* Ingrédients — multi-select. Match seedTags.proteinePrincipale + keywords ingredients. */
  var INGREDIENTS = [
    { key: 'poulet',  emoji: '🍗', label: 'Poulet',
      proteines: ['viande-blanche'],
      keywords: ['poulet', 'volaille', 'dinde', 'pintade', 'canard', 'chapon'] },
    { key: 'boeuf',   emoji: '🍖', label: 'Bœuf / Porc',
      proteines: ['viande-rouge'],
      keywords: ['boeuf', 'beef', 'porc', 'jambon', 'lard', 'agneau', 'veau', 'mouton', 'lapin'] },
    { key: 'poisson', emoji: '🐟', label: 'Poisson',
      proteines: ['poisson'],
      keywords: ['poisson', 'saumon', 'thon', 'cabillaud', 'morue', 'truite', 'bar', 'dorade', 'maquereau', 'sardine', 'anchois', 'merlu', 'colin', 'crevette', 'crustace', 'moule', 'huitre', 'st-jacques', 'calamar', 'poulpe'] },
    { key: 'oeufs',   emoji: '🍳', label: 'Œufs',
      proteines: ['oeufs'],
      keywords: ['oeuf', 'omelette', 'frittata', 'quiche', 'flan'] },
    { key: 'vege',    emoji: '🌽', label: 'Végé',
      proteines: ['aucune', 'legumineuses', 'tofu'],
      keywords: ['vege', 'vegetarien', 'lentille', 'pois chiche', 'haricot', 'tofu', 'tempeh', 'seitan', 'fève'] },
    { key: 'fromage', emoji: '🧀', label: 'Fromage',
      proteines: ['fromage'],
      keywords: ['fromage', 'mozzarella', 'feta', 'parmesan', 'comte', 'gruyere', 'chevre', 'roquefort', 'camembert', 'reblochon', 'ricotta', 'mascarpone', 'cheddar', 'pecorino', 'manchego'] }
  ];

  function matchIngredient(r, key) {
    var def = null;
    for (var i = 0; i < INGREDIENTS.length; i++) if (INGREDIENTS[i].key === key) { def = INGREDIENTS[i]; break; }
    if (!def) return false;
    /* 1. seedTags.proteinePrincipale */
    if (r.proteine) {
      for (var p = 0; p < def.proteines.length; p++) {
        if (r.proteine === def.proteines[p]) return true;
      }
    }
    /* 2. fallback : keywords dans nom + ingrédients + description */
    for (var k = 0; k < def.keywords.length; k++) {
      if (r.blob.indexOf(def.keywords[k]) >= 0) return true;
    }
    return false;
  }

  /* Inspirations — multi-select. Match déaccentué dans style + nom + description. */
  var INSPIRATIONS = [
    { key: 'francais',      emoji: '🍷', label: 'Français',
      keywords: ['francais', 'francaise', 'bistro', 'tradition', 'terroir', 'normand', 'breton', 'savoyard', 'lyonnais', 'provencal'] },
    { key: 'italien',       emoji: '🍕', label: 'Italien',
      keywords: ['italien', 'italie', 'risotto', 'pasta', 'lasagne', 'tiramisu', 'pizza', 'bolognaise', 'carbonara', 'pesto', 'parmigiana'] },
    { key: 'mediterraneen', emoji: '🍅', label: 'Méditerranéen',
      keywords: ['mediterraneen', 'mediterranee', 'grec', 'libanais', 'taboule', 'houmous', 'feta', 'olive', 'caponata'] },
    { key: 'asiatique',     emoji: '🍜', label: 'Asiatique',
      keywords: ['asiatique', 'thai', 'thailand', 'vietnamien', 'vietnam', 'japonais', 'japon', 'sushi', 'ramen', 'wok', 'chinois', 'coreen', 'bibimbap', 'pad thai', 'pho', 'curry vert', 'curry rouge'] },
    { key: 'indien',        emoji: '🍛', label: 'Indien',
      keywords: ['indien', 'inde', 'curry', 'tikka', 'tandoori', 'masala', 'biryani', 'naan', 'dahl', 'samosa'] },
    { key: 'mexicain',      emoji: '🌶', label: 'Mexicain',
      keywords: ['mexicain', 'mexique', 'tacos', 'burrito', 'enchilada', 'quesadilla', 'guacamole', 'salsa', 'fajitas'] },
    { key: 'espagnol',      emoji: '🍤', label: 'Espagnol',
      keywords: ['espagnol', 'espagne', 'paella', 'tapas', 'tortilla', 'gazpacho', 'chorizo', 'iberique'] },
    { key: 'oriental',      emoji: '🍵', label: 'Oriental',
      keywords: ['marocain', 'maroc', 'tunisien', 'algerien', 'tagine', 'tajine', 'couscous', 'oriental', 'turc', 'kebab', 'pastilla', 'harira'] }
  ];

  function matchInspiration(r, key) {
    var def = null;
    for (var i = 0; i < INSPIRATIONS.length; i++) if (INSPIRATIONS[i].key === key) { def = INSPIRATIONS[i]; break; }
    if (!def) return false;
    for (var k = 0; k < def.keywords.length; k++) {
      if (r.blob.indexOf(def.keywords[k]) >= 0 || r.style.indexOf(def.keywords[k]) >= 0) return true;
    }
    return false;
  }

  /* ---------- Tuile compacte ---------- */

  function render(container, _data, config) {
    container.className = 'grid-cell tile-livre';
    container.innerHTML =
      '<div class="tile-title">Livre de recettes</div>' +
      '<div class="tile-livre-body">' +
        '<div class="tile-livre-icon">📖</div>' +
        '<div class="tile-livre-count">…</div>' +
        '<div class="tile-livre-label">recettes</div>' +
      '</div>' +
      '<div class="tile-livre-cta">Toucher pour explorer</div>';

    fetchRecettes().then(function (all) {
      var list = applyConfigFilter(all, config);
      var countEl = container.querySelector('.tile-livre-count');
      var labelEl = container.querySelector('.tile-livre-label');
      if (!countEl) return;
      countEl.innerHTML = list.length;
      if (labelEl) labelEl.innerHTML = (list.length === 1 ? 'recette' : 'recettes');
    });
  }

  function cleanup(_container) { /* rien d'asynchrone à arrêter */ }

  /* ---------- Expand : wizard 2 étapes ---------- */

  function expand(container, _data, config, _tileId) {
    container.className = 'tile-overlay-content tile-livre-expand';
    container.innerHTML = '<div class="livre-wizard" data-role="wizard">Chargement…</div>';
    var wrap = container.querySelector('[data-role="wizard"]');

    /* État partagé du wizard */
    var pickedRepas = {};   /* { 'petit-dej': true, ... } */
    var pickedIng = {};     /* { 'poulet': true, ... } — multi-select */
    var pickedInsp = {};    /* { 'italien': true, ... } — multi-select */
    var allRecettes = [];

    fetchRecettes().then(function (list) {
      allRecettes = applyConfigFilter(list, config);
      goStep1();
    });

    /* ===== Étape 1 — choisir le(s) repas ===== */

    function goStep1() {
      var html = '' +
        '<div class="wiz-bar">' +
          '<button type="button" class="wiz-back" data-act="cancel">✕ Annuler</button>' +
          '<div class="wiz-step">Étape 1 / 2</div>' +
        '</div>' +
        '<h1 class="wiz-question">Quel repas&nbsp;?</h1>' +
        '<p class="wiz-hint">Tu peux en choisir plusieurs, ou aucun pour tout voir</p>' +
        '<div class="wiz-icon-grid wiz-cols-2">';
      for (var i = 0; i < REPAS.length; i++) {
        var r = REPAS[i];
        var active = pickedRepas[r.key] ? ' is-active' : '';
        html += '<button type="button" class="wiz-icon-btn' + active + '" data-key="' + r.key + '">' +
          '<span class="wiz-icon-emoji">' + r.emoji + '</span>' +
          '<span class="wiz-icon-label">' + escapeHTML(r.label) + '</span>' +
          '</button>';
      }
      html += '</div>' +
        '<div class="wiz-actions">' +
          '<button type="button" class="wiz-secondary" data-act="all">Voir tout (' + allRecettes.length + ')</button>' +
          '<button type="button" class="wiz-primary" data-act="next">Suivant →</button>' +
        '</div>';
      wrap.innerHTML = html;

      var btns = wrap.querySelectorAll('.wiz-icon-btn');
      for (var b = 0; b < btns.length; b++) {
        btns[b].addEventListener('click', (function (btn, key) {
          return function () {
            if (pickedRepas[key]) {
              delete pickedRepas[key];
              btn.className = btn.className.replace(/\s*is-active\b/g, '');
            } else {
              pickedRepas[key] = true;
              btn.className += ' is-active';
            }
          };
        })(btns[b], btns[b].getAttribute('data-key')));
      }
      wrap.querySelector('[data-act="cancel"]').addEventListener('click', function () {
        if (global.FamilyHubOverlay && global.FamilyHubOverlay.close) global.FamilyHubOverlay.close();
      });
      wrap.querySelector('[data-act="all"]').addEventListener('click', function () {
        pickedRepas = {}; pickedIng = {}; pickedInsp = {};
        goStep2();
      });
      wrap.querySelector('[data-act="next"]').addEventListener('click', goStep2);
    }

    /* ===== Étape 2 — choisir les envies + résultats inline ===== */

    function goStep2() {
      var html = '' +
        '<div class="wiz-bar">' +
          '<button type="button" class="wiz-back" data-act="back">← Modifier le repas</button>' +
          '<button type="button" class="wiz-mini-surprise" data-act="surprise">🎲 Surprends-moi</button>' +
        '</div>' +
        '<h1 class="wiz-question">Quelle envie&nbsp;?</h1>' +
        '<p class="wiz-hint">Combine ingrédient + inspiration, ou laisse vide pour voir toute la sélection</p>';

      /* Section ingrédients */
      html += '<div class="wiz-section-title">Par ingrédient</div>' +
        '<div class="wiz-icon-grid wiz-cols-3">';
      for (var i = 0; i < INGREDIENTS.length; i++) {
        var ing = INGREDIENTS[i];
        var act = pickedIng[ing.key] ? ' is-active' : '';
        html += '<button type="button" class="wiz-icon-btn wiz-icon-btn-sm' + act + '" data-kind="ing" data-key="' + ing.key + '">' +
          '<span class="wiz-icon-emoji">' + ing.emoji + '</span>' +
          '<span class="wiz-icon-label">' + escapeHTML(ing.label) + '</span>' +
          '</button>';
      }
      html += '</div>';

      /* Section inspirations */
      html += '<div class="wiz-section-title">Par inspiration</div>' +
        '<div class="wiz-icon-grid wiz-cols-4">';
      for (var k = 0; k < INSPIRATIONS.length; k++) {
        var ins = INSPIRATIONS[k];
        var act2 = pickedInsp[ins.key] ? ' is-active' : '';
        html += '<button type="button" class="wiz-icon-btn wiz-icon-btn-sm' + act2 + '" data-kind="insp" data-key="' + ins.key + '">' +
          '<span class="wiz-icon-emoji">' + ins.emoji + '</span>' +
          '<span class="wiz-icon-label">' + escapeHTML(ins.label) + '</span>' +
          '</button>';
      }
      html += '</div>';

      /* Bouton effacer + summary */
      html += '<div class="wiz-actions wiz-actions-mid">' +
          '<button type="button" class="wiz-secondary wiz-btn-clear" data-act="clear">Effacer les envies</button>' +
        '</div>';

      /* Bloc résultats */
      html += '<div class="wiz-results" data-role="results"></div>';

      wrap.innerHTML = html;

      wrap.querySelector('[data-act="back"]').addEventListener('click', goStep1);
      wrap.querySelector('[data-act="clear"]').addEventListener('click', function () {
        pickedIng = {}; pickedInsp = {};
        goStep2();
      });
      wrap.querySelector('[data-act="surprise"]').addEventListener('click', function () {
        var list = filteredRecettes();
        if (list.length === 0) return;
        showDetail(list[Math.floor(Math.random() * list.length)]);
      });

      var allBtns = wrap.querySelectorAll('.wiz-icon-btn');
      for (var b = 0; b < allBtns.length; b++) {
        allBtns[b].addEventListener('click', (function (btn) {
          return function () {
            var kind = btn.getAttribute('data-kind');
            var key = btn.getAttribute('data-key');
            var dict = (kind === 'ing') ? pickedIng : pickedInsp;
            if (dict[key]) {
              delete dict[key];
              btn.className = btn.className.replace(/\s*is-active\b/g, '');
            } else {
              dict[key] = true;
              btn.className += ' is-active';
            }
            renderResults();
          };
        })(allBtns[b]));
      }

      renderResults();
    }

    function filteredRecettes() {
      var list = [];
      var anyRepas = false; for (var k1 in pickedRepas) if (pickedRepas.hasOwnProperty(k1)) { anyRepas = true; break; }
      var anyIng = false;   for (var k2 in pickedIng)   if (pickedIng.hasOwnProperty(k2))   { anyIng = true; break; }
      var anyInsp = false;  for (var k3 in pickedInsp)  if (pickedInsp.hasOwnProperty(k3))  { anyInsp = true; break; }

      for (var i = 0; i < allRecettes.length; i++) {
        var r = allRecettes[i];
        /* Repas — au moins un match */
        if (anyRepas) {
          var ok = false;
          for (var key in pickedRepas) {
            if (pickedRepas.hasOwnProperty(key) && matchRepas(r, key)) { ok = true; break; }
          }
          if (!ok) continue;
        }
        /* Ingrédient — au moins un match */
        if (anyIng) {
          var okI = false;
          for (var key2 in pickedIng) {
            if (pickedIng.hasOwnProperty(key2) && matchIngredient(r, key2)) { okI = true; break; }
          }
          if (!okI) continue;
        }
        /* Inspiration — au moins un match */
        if (anyInsp) {
          var okN = false;
          for (var key3 in pickedInsp) {
            if (pickedInsp.hasOwnProperty(key3) && matchInspiration(r, key3)) { okN = true; break; }
          }
          if (!okN) continue;
        }
        list.push(r);
      }
      return list;
    }

    function renderResults() {
      var resultsEl = wrap.querySelector('[data-role="results"]');
      if (!resultsEl) return;
      var list = filteredRecettes();

      var html = '<div class="wiz-results-bar">' +
        '<span class="wiz-results-count">' +
          (list.length === 0 ? 'Aucune recette' :
           list.length === 1 ? '1 recette' :
           list.length + ' recettes') +
        '</span>' +
      '</div>';

      if (list.length === 0) {
        html += '<div class="wiz-empty">' +
          '<div class="wiz-empty-icon">🤔</div>' +
          '<p>Aucune recette ne correspond. Essaie de retirer un filtre.</p>' +
          '</div>';
      } else {
        /* Tri : random shuffle léger pour varier l'affichage à chaque ouverture */
        var shuffled = list.slice();
        /* Limiter à 60 cartes affichées max pour iPad mini perf */
        if (shuffled.length > 60) shuffled = shuffled.slice(0, 60);

        html += '<div class="livre-grid">';
        for (var i = 0; i < shuffled.length; i++) {
          var r = shuffled[i];
          var meta = [];
          var t = tempsTotal(r); if (t > 0) meta.push(t + ' min');
          if (r.portions) meta.push(r.portions + ' pers.');
          html += '<button type="button" class="livre-card" data-rid="' + escapeHTML(r.id) + '">' +
            '<div class="livre-card-name">' + escapeHTML(r.nom) + '</div>' +
            '<div class="livre-card-meta">' + meta.join(' · ') + '</div>' +
            '</button>';
        }
        html += '</div>';
        if (list.length > 60) {
          html += '<p class="wiz-results-more">… affine les filtres pour voir plus précis (' +
            (list.length - 60) + ' autres)</p>';
        }
      }
      resultsEl.innerHTML = html;

      var cards = resultsEl.querySelectorAll('.livre-card');
      for (var c = 0; c < cards.length; c++) {
        cards[c].addEventListener('click', (function (rid) {
          return function () {
            for (var x = 0; x < allRecettes.length; x++) {
              if (allRecettes[x].id === rid) { showDetail(allRecettes[x]); return; }
            }
          };
        })(cards[c].getAttribute('data-rid')));
      }
    }

    /* ===== Détail recette ===== */

    function showDetail(r) {
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

      wrap.innerHTML = '' +
        '<div class="wiz-bar">' +
          '<button type="button" class="wiz-back" data-act="back-detail">← Retour à la liste</button>' +
        '</div>' +
        '<h2 class="livre-detail-name">' + escapeHTML(r.nom) + '</h2>' +
        '<div class="livre-detail-meta">' + meta.join(' · ') + '</div>' +
        (r.description ? '<p class="livre-detail-desc">' + escapeHTML(r.description) + '</p>' : '') +
        '<h3 class="livre-detail-h3">Ingrédients</h3>' +
        '<ul class="livre-detail-ing">' + ingHtml + '</ul>' +
        '<h3 class="livre-detail-h3">Étapes</h3>' +
        '<ol class="livre-detail-steps">' + stepHtml + '</ol>';

      wrap.querySelector('[data-act="back-detail"]').addEventListener('click', goStep2);
      container.scrollTop = 0;
    }
  }

  function collapse(container) { if (container) container.innerHTML = ''; }

  global.Tiles = global.Tiles || {};
  global.Tiles['livre-recettes'] = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse
  };
})(window);
