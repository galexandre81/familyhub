/* tiles/weather.js — vue compacte (location sélectionnée) + vue plein écran (toutes les locations).
   ES5 vanilla, iOS 9 OK. SVG icônes héritées du legacy MenuMaster. */
(function (global) {
  'use strict';

  function iconSVG(iconKey) {
    var sun = '<circle cx="36" cy="36" r="14" fill="#E8A53C"/>'
      + '<g stroke="#E8A53C" stroke-width="3" stroke-linecap="round">'
      + '<line x1="36" y1="6" x2="36" y2="14"/>'
      + '<line x1="36" y1="58" x2="36" y2="66"/>'
      + '<line x1="6" y1="36" x2="14" y2="36"/>'
      + '<line x1="58" y1="36" x2="66" y2="36"/>'
      + '<line x1="14" y1="14" x2="20" y2="20"/>'
      + '<line x1="52" y1="52" x2="58" y2="58"/>'
      + '<line x1="58" y1="14" x2="52" y2="20"/>'
      + '<line x1="14" y1="58" x2="20" y2="52"/>'
      + '</g>';
    var moon = '<path d="M44 20 a18 18 0 1 0 14 28 a14 14 0 0 1 -14 -28 z" fill="#9AA5B1"/>';
    var cloud = '<path d="M18 46 q-10 0 -10 -10 q0 -8 8 -10 q1 -10 12 -10 q9 0 12 8 q2 -1 5 -1 q9 0 9 9 q7 1 7 8 q0 7 -8 7 z" fill="#9AA5B1"/>';
    var partly = '<circle cx="24" cy="22" r="10" fill="#E8A53C"/>'
      + '<g stroke="#E8A53C" stroke-width="2.5" stroke-linecap="round">'
      + '<line x1="24" y1="4" x2="24" y2="9"/>'
      + '<line x1="6" y1="22" x2="11" y2="22"/>'
      + '<line x1="11" y1="9" x2="14" y2="12"/>'
      + '</g>'
      + '<path d="M22 50 q-10 0 -10 -10 q0 -8 8 -10 q1 -8 11 -8 q8 0 11 6 q2 -1 5 -1 q9 0 9 9 q7 1 7 8 q0 6 -8 6 z" fill="#9AA5B1"/>';
    var rain = '<path d="M18 36 q-10 0 -10 -10 q0 -8 8 -10 q1 -10 12 -10 q9 0 12 8 q2 -1 5 -1 q9 0 9 9 q7 1 7 8 q0 7 -8 7 z" fill="#7B8794"/>'
      + '<g stroke="#3E7CB1" stroke-width="3" stroke-linecap="round">'
      + '<line x1="20" y1="50" x2="16" y2="62"/>'
      + '<line x1="34" y1="50" x2="30" y2="62"/>'
      + '<line x1="48" y1="50" x2="44" y2="62"/>'
      + '</g>';
    var snow = '<path d="M18 36 q-10 0 -10 -10 q0 -8 8 -10 q1 -10 12 -10 q9 0 12 8 q2 -1 5 -1 q9 0 9 9 q7 1 7 8 q0 7 -8 7 z" fill="#9AA5B1"/>'
      + '<g fill="#FFFFFF" stroke="#3E7CB1" stroke-width="1.5">'
      + '<circle cx="20" cy="56" r="3"/>'
      + '<circle cx="36" cy="60" r="3"/>'
      + '<circle cx="52" cy="56" r="3"/>'
      + '</g>';
    var fog = '<path d="M18 30 q-10 0 -10 -10 q0 -8 8 -10 q1 -10 12 -10 q9 0 12 8 q2 -1 5 -1 q9 0 9 9 q7 1 7 8 q0 7 -8 7 z" fill="#B7B7B0" transform="translate(0,8)"/>'
      + '<g stroke="#7B8794" stroke-width="3" stroke-linecap="round">'
      + '<line x1="10" y1="52" x2="58" y2="52"/>'
      + '<line x1="14" y1="60" x2="54" y2="60"/>'
      + '</g>';
    var storm = '<path d="M18 32 q-10 0 -10 -10 q0 -8 8 -10 q1 -10 12 -10 q9 0 12 8 q2 -1 5 -1 q9 0 9 9 q7 1 7 8 q0 7 -8 7 z" fill="#5D6470"/>'
      + '<polygon points="32,40 24,56 32,56 28,68 44,50 36,50 40,40" fill="#E8A53C"/>';

    var inner;
    switch (iconKey) {
      case 'sun': inner = sun; break;
      case 'moon': inner = moon; break;
      case 'cloud-sun':
      case 'cloud-moon': inner = partly; break;
      case 'rain': inner = rain; break;
      case 'snow': inner = snow; break;
      case 'fog': inner = fog; break;
      case 'storm': inner = storm; break;
      default: inner = cloud;
    }
    return '<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }

  /* --- Helpers communs --- */
  function findLocation(config, id) {
    var locs = (config && config.locations) || [];
    for (var i = 0; i < locs.length; i++) {
      if (locs[i].id === id) return locs[i];
    }
    return null;
  }

  function selectedLocation(config) {
    var locs = (config && config.locations) || [];
    if (locs.length === 0) return null;
    var sel = findLocation(config, config.selectedLocationId);
    return sel || locs[0];
  }

  function dataFor(data, locId) {
    var by = data && data.byLocation;
    return (by && by[locId]) ? by[locId] : null;
  }

  /* --- Vue COMPACTE (cell de la grille) --- */
  function render(container, data, config) {
    container.className = 'grid-cell tile-weather tile-clickable';
    container.innerHTML = '';

    var loc = selectedLocation(config);
    var ld = loc ? dataFor(data, loc.id) : null;
    var locs = (config && config.locations) || [];

    var titleEl = document.createElement('div');
    titleEl.className = 'tile-title';
    var titleText = 'Météo';
    if (loc && loc.ville) titleText += ' — ' + loc.ville;
    if (locs.length > 1) titleText += ' (' + locs.length + ')';
    titleEl.innerHTML = titleText;
    container.appendChild(titleEl);

    var wrap = document.createElement('div');
    wrap.className = 'tile-weather-compact';
    container.appendChild(wrap);

    if (!loc) {
      wrap.innerHTML = '<div class="tile-weather-label">Aucune ville configurée</div>';
      return;
    }
    if (!ld) {
      wrap.innerHTML = '<div class="tile-weather-label">En attente des données…</div>';
      return;
    }

    var temp = Math.round(ld.current.tempC);
    var minC = Math.round(ld.daily.minC);
    var maxC = Math.round(ld.daily.maxC);

    /* Layout : icône + temp côte à côte, puis label, puis min/max, puis hint. */
    wrap.innerHTML =
      '<div class="tile-weather-row">' +
        '<div class="tile-weather-icon">' + iconSVG(ld.current.iconKey) + '</div>' +
        '<div class="tile-weather-temp">' + temp + '°</div>' +
      '</div>' +
      '<div class="tile-weather-label">' + ld.current.label + '</div>' +
      '<div class="tile-weather-range">Min ' + minC + '° &nbsp;·&nbsp; Max ' + maxC + '°</div>' +
      (locs.length > 1 ? '<div class="tile-weather-hint">Touche pour changer de ville</div>' : '');
  }

  function cleanup(container) {
    container.innerHTML = '';
  }

  /* --- Vue PLEIN ÉCRAN (overlay) ---
     Layout :
       1. Hero : ville sélectionnée — gros temp/icône, label, min/max, sunrise/sunset
       2. Semaine : 7 colonnes (jour + icône + max/min) pour la ville sélectionnée
       3. Autres villes : chips compactes (nom + icône + temp) — tap pour switcher
  */
  function expand(container, data, config) {
    container.innerHTML = '';
    container.className = 'tile-overlay-content tile-weather-expand';

    var locs = (config && config.locations) || [];
    var selectedId = config && config.selectedLocationId;
    if (!selectedId && locs.length > 0) selectedId = locs[0].id;

    var headerEl = document.createElement('h1');
    headerEl.className = 'tile-overlay-h1';
    headerEl.innerHTML = 'Météo';
    container.appendChild(headerEl);

    if (locs.length === 0) {
      var noEl = document.createElement('p');
      noEl.innerHTML = 'Aucune ville configurée. Configure les villes depuis le hub.';
      container.appendChild(noEl);
      return;
    }

    var bodyEl = document.createElement('div');
    bodyEl.className = 'tile-weather-expand-body';
    container.appendChild(bodyEl);

    function findLoc(id) {
      for (var i = 0; i < locs.length; i++) if (locs[i].id === id) return locs[i];
      return locs[0];
    }

    function renderBody() {
      var loc = findLoc(selectedId);
      var ld = dataFor(data, loc.id);
      var html = '';

      /* HERO : ville sélectionnée en grand */
      html += '<section class="weather-hero">';
      html += '<div class="weather-hero-ville">' + loc.ville + '</div>';
      html += '<div class="weather-hero-row">';
      if (ld) {
        html += '<div class="weather-hero-icon">' + iconSVG(ld.current.iconKey) + '</div>';
        html += '<div class="weather-hero-temp">' + Math.round(ld.current.tempC) + '°</div>';
        html += '<div class="weather-hero-meta">';
        html += '<div class="weather-hero-label">' + ld.current.label + '</div>';
        html += '<div class="weather-hero-range">Min ' + Math.round(ld.daily.minC) + '° &nbsp;·&nbsp; Max ' + Math.round(ld.daily.maxC) + '°</div>';
        html += '<div class="weather-hero-sun">☀ ' + ld.daily.sunrise + '&nbsp;&nbsp;/&nbsp;&nbsp;🌙 ' + ld.daily.sunset + '</div>';
        html += '</div>';
      } else {
        html += '<div class="weather-hero-meta"><div class="weather-hero-label">Données indisponibles</div></div>';
      }
      html += '</div>';
      html += '</section>';

      /* SEMAINE : 7 colonnes pour la ville sélectionnée */
      if (ld && ld.weekly && ld.weekly.length > 0) {
        html += '<section class="weather-week-section">';
        html += '<div class="weather-section-title">Cette semaine</div>';
        html += '<div class="weather-card-week">';
        for (var d = 0; d < ld.weekly.length; d++) {
          var day = ld.weekly[d];
          html += '<div class="weather-day' + (d === 0 ? ' weather-day-today' : '') + '">';
          html += '<div class="weather-day-name">' + dayLabel(day.date, d) + '</div>';
          html += '<div class="weather-day-icon">' + iconSVG(day.iconKey) + '</div>';
          html += '<div class="weather-day-max">' + Math.round(day.maxC) + '°</div>';
          html += '<div class="weather-day-min">' + Math.round(day.minC) + '°</div>';
          html += '</div>';
        }
        html += '</div>';
        html += '</section>';
      }

      /* AUTRES VILLES : chips */
      if (locs.length > 1) {
        html += '<section class="weather-others-section">';
        html += '<div class="weather-section-title">Autres villes — touche pour changer</div>';
        html += '<div class="weather-chips">';
        for (var i = 0; i < locs.length; i++) {
          var l = locs[i];
          if (l.id === selectedId) continue;
          var lld = dataFor(data, l.id);
          html += '<button class="weather-chip" data-loc-id="' + l.id + '">';
          if (lld) {
            html += '<div class="weather-chip-icon">' + iconSVG(lld.current.iconKey) + '</div>';
          }
          html += '<div class="weather-chip-info">';
          html += '<div class="weather-chip-ville">' + l.ville + '</div>';
          if (lld) {
            html += '<div class="weather-chip-temp">' + Math.round(lld.current.tempC) + '°</div>';
          } else {
            html += '<div class="weather-chip-temp">—</div>';
          }
          html += '</div>';
          html += '</button>';
        }
        html += '</div>';
        html += '</section>';
      }

      bodyEl.innerHTML = html;

      /* Bind clics sur les chips */
      var chips = bodyEl.querySelectorAll('.weather-chip');
      for (var k = 0; k < chips.length; k++) {
        (function (chip) {
          chip.addEventListener('click', function () {
            var newId = chip.getAttribute('data-loc-id');
            if (!newId || newId === selectedId) return;
            selectedId = newId;
            /* Persiste sur Firestore — la tuile principale du dashboard se mettra à jour. */
            if (global.FamilyHubUpdateTileConfig) {
              global.FamilyHubUpdateTileConfig(container._tileId, { selectedLocationId: newId });
            }
            renderBody();
            /* Scroll vers le haut pour voir le hero mis à jour */
            container.scrollTop = 0;
          });
        })(chips[k]);
      }
    }

    renderBody();
  }

  /* Format court "Lun", "Mar", ... — index 0 = "Auj." */
  function dayLabel(isoDate, idx) {
    if (idx === 0) return 'Auj.';
    var DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    /* Parse YYYY-MM-DD comme date locale (sans décalage UTC). */
    var parts = (isoDate || '').split('-');
    if (parts.length !== 3) return '';
    var d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    return DAYS[d.getDay()];
  }

  function collapse(container) {
    container.innerHTML = '';
  }

  global.Tiles = global.Tiles || {};
  global.Tiles.weather = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse
  };
})(window);
