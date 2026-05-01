/* tiles/weather.js — rendu météo depuis le snapshot Firestore.
   ES5 vanilla. SVG icônes héritées du legacy MenuMaster (kitchen-magazine vibe). */
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
      case 'cloud-sun': inner = partly; break;
      case 'cloud-moon': inner = partly; break; /* fallback */
      case 'rain': inner = rain; break;
      case 'snow': inner = snow; break;
      case 'fog': inner = fog; break;
      case 'storm': inner = storm; break;
      default: inner = cloud;
    }
    return '<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }

  function render(container, data, config) {
    container.className = 'grid-cell tile-weather';
    var ville = (config && config.ville) ? config.ville : '';

    if (!data || !data.current) {
      container.innerHTML = '<div class="tile-title">Météo</div>'
        + '<div class="tile-weather-label">En attente des données…</div>';
      return;
    }

    var temp = Math.round(data.current.tempC);
    var label = data.current.label || '';
    var icon = data.current.iconKey || 'cloud';
    var minC = (data.daily && typeof data.daily.minC === 'number') ? Math.round(data.daily.minC) : null;
    var maxC = (data.daily && typeof data.daily.maxC === 'number') ? Math.round(data.daily.maxC) : null;

    var html = '';
    html += '<div class="tile-title">Météo' + (ville ? ' — ' + ville : '') + '</div>';
    html += '<div class="tile-weather-icon">' + iconSVG(icon) + '</div>';
    html += '<div class="tile-weather-temp">' + temp + '°</div>';
    html += '<div class="tile-weather-label">' + label + '</div>';
    if (minC !== null && maxC !== null) {
      html += '<div class="tile-weather-range">Min ' + minC + '° / Max ' + maxC + '°</div>';
    }
    container.innerHTML = html;
  }

  function cleanup(container) {
    container.innerHTML = '';
  }

  global.Tiles = global.Tiles || {};
  global.Tiles.weather = { render: render, cleanup: cleanup };
})(window);
