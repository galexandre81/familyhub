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

    wrap.innerHTML =
      '<div class="tile-weather-icon">' + iconSVG(ld.current.iconKey) + '</div>' +
      '<div class="tile-weather-temp">' + temp + '°</div>' +
      '<div class="tile-weather-label">' + ld.current.label + '</div>' +
      '<div class="tile-weather-range">Min ' + minC + '° / Max ' + maxC + '°</div>' +
      (locs.length > 1 ? '<div class="tile-weather-hint">Touche pour changer de ville</div>' : '');
  }

  function cleanup(container) {
    container.innerHTML = '';
  }

  /* --- Vue PLEIN ÉCRAN (overlay) --- */
  function expand(container, data, config) {
    container.innerHTML = '';
    container.className = 'tile-overlay-content tile-weather-expand';

    var locs = (config && config.locations) || [];
    var selectedId = config && config.selectedLocationId;

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

    var hint = document.createElement('p');
    hint.className = 'tile-weather-expand-hint';
    hint.innerHTML = 'Touche une ville pour la mettre en avant dans la tuile principale.';
    container.appendChild(hint);

    /* DIAG : affiche les clés du snapshot pour débugger un mismatch d'ID. */
    var diag = document.createElement('p');
    diag.style.cssText = 'font:11px monospace;color:#6B7280;background:#FAFAF7;padding:6px;border-radius:4px;word-break:break-all';
    var dataKeys = data ? Object.keys(data).join(',') : '(no data)';
    var byLocKeys = (data && data.byLocation) ? Object.keys(data.byLocation).join(',') : '(no byLocation)';
    var configKeys = (config && config.locations) ? config.locations.map(function (l) { return l.id; }).join(',') : '(no config locations)';
    diag.innerHTML = 'DIAG · data keys: [' + dataKeys + '] · byLocation: [' + byLocKeys + '] · config locs: [' + configKeys + ']';
    container.appendChild(diag);

    var listEl = document.createElement('div');
    listEl.className = 'tile-weather-expand-list';
    container.appendChild(listEl);

    for (var i = 0; i < locs.length; i++) {
      (function (loc) {
        var ld = dataFor(data, loc.id);
        var card = document.createElement('button');
        card.className = 'tile-weather-expand-card' + (loc.id === selectedId ? ' selected' : '');
        card.setAttribute('data-loc-id', loc.id);

        var html = '<div class="weather-card-left">';
        html += '<div class="weather-card-ville">' + loc.ville + '</div>';
        if (ld) {
          html += '<div class="weather-card-label">' + ld.current.label + '</div>';
          html += '<div class="weather-card-range">Min ' + Math.round(ld.daily.minC) + '° · Max ' + Math.round(ld.daily.maxC) + '° · ☀ ' + ld.daily.sunrise + ' / 🌙 ' + ld.daily.sunset + '</div>';
        } else {
          html += '<div class="weather-card-label">Données indisponibles</div>';
        }
        html += '</div>';

        html += '<div class="weather-card-right">';
        if (ld) {
          html += '<div class="weather-card-icon">' + iconSVG(ld.current.iconKey) + '</div>';
          html += '<div class="weather-card-temp">' + Math.round(ld.current.tempC) + '°</div>';
        } else {
          html += '<div class="weather-card-temp">—</div>';
        }
        if (loc.id === selectedId) {
          html += '<div class="weather-card-selected-badge">Affichée</div>';
        }
        html += '</div>';

        card.innerHTML = html;
        card.addEventListener('click', function () {
          if (loc.id === selectedId) return;
          /* Met à jour la config tile.selectedLocationId via le helper exposé par core */
          if (global.FamilyHubUpdateTileConfig) {
            global.FamilyHubUpdateTileConfig(container._tileId, { selectedLocationId: loc.id });
          }
          /* Optimistic UI update */
          var allCards = listEl.querySelectorAll('.tile-weather-expand-card');
          for (var k = 0; k < allCards.length; k++) {
            allCards[k].className = 'tile-weather-expand-card';
            var badge = allCards[k].querySelector('.weather-card-selected-badge');
            if (badge) badge.parentNode.removeChild(badge);
          }
          card.className = 'tile-weather-expand-card selected';
          var rightEl = card.querySelector('.weather-card-right');
          if (rightEl) {
            var b = document.createElement('div');
            b.className = 'weather-card-selected-badge';
            b.innerHTML = 'Affichée';
            rightEl.appendChild(b);
          }
          selectedId = loc.id;
        });
        listEl.appendChild(card);
      })(locs[i]);
    }
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
