/* weather.js — Open-Meteo, no key, ES5 vanilla. Safari 9 compatible. */
(function (global) {
  'use strict';

  var LAT = 46.5833;
  var LON = 6.1833;
  var URL = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + LAT
    + '&longitude=' + LON
    + '&current_weather=true'
    + '&daily=temperature_2m_max,temperature_2m_min,weather_code'
    + '&timezone=Europe%2FZurich';

  /* WMO weather code -> { kind, label } */
  function describeCode(code) {
    if (code === 0) return { kind: 'sun', label: 'Ciel dégagé' };
    if (code === 1) return { kind: 'partly', label: 'Plutôt ensoleillé' };
    if (code === 2) return { kind: 'partly', label: 'Partiellement nuageux' };
    if (code === 3) return { kind: 'cloud', label: 'Couvert' };
    if (code === 45 || code === 48) return { kind: 'fog', label: 'Brouillard' };
    if (code >= 51 && code <= 57) return { kind: 'rain', label: 'Bruine' };
    if (code >= 61 && code <= 67) return { kind: 'rain', label: 'Pluie' };
    if (code >= 71 && code <= 77) return { kind: 'snow', label: 'Neige' };
    if (code >= 80 && code <= 82) return { kind: 'rain', label: 'Averses' };
    if (code === 85 || code === 86) return { kind: 'snow', label: 'Averses de neige' };
    if (code >= 95) return { kind: 'storm', label: 'Orage' };
    return { kind: 'cloud', label: '—' };
  }

  /* SVG icon set — kitchen-magazine vibe, single-color line+fill */
  function iconSVG(kind) {
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
    if (kind === 'sun') inner = sun;
    else if (kind === 'partly') inner = partly;
    else if (kind === 'rain') inner = rain;
    else if (kind === 'snow') inner = snow;
    else if (kind === 'fog') inner = fog;
    else if (kind === 'storm') inner = storm;
    else inner = cloud;

    return '<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }

  function fetchWeather(callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', URL, true);
    xhr.timeout = 12000;
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          var data = JSON.parse(xhr.responseText);
          callback(null, data);
        } catch (e) {
          callback(e, null);
        }
      } else {
        callback(new Error('HTTP ' + xhr.status), null);
      }
    };
    xhr.onerror = function () { callback(new Error('Network error'), null); };
    xhr.ontimeout = function () { callback(new Error('Timeout'), null); };
    xhr.send();
  }

  function render(data) {
    if (!data || !data.current_weather) return;
    var cur = data.current_weather;
    var temp = Math.round(cur.temperature);
    var code = cur.weathercode;
    var desc = describeCode(code);

    var iconEl = document.getElementById('weather-icon');
    var tempEl = document.getElementById('weather-temp');
    var minmaxEl = document.getElementById('weather-minmax');
    var summaryEl = document.getElementById('weather-summary');

    if (iconEl) iconEl.innerHTML = iconSVG(desc.kind);
    if (tempEl) tempEl.innerHTML = temp + '°';
    if (summaryEl) summaryEl.innerHTML = desc.label;

    if (minmaxEl && data.daily && data.daily.temperature_2m_min) {
      var tMin = Math.round(data.daily.temperature_2m_min[0]);
      var tMax = Math.round(data.daily.temperature_2m_max[0]);
      minmaxEl.innerHTML = 'Min ' + tMin + '° / Max ' + tMax + '°';
    }
  }

  function refresh() {
    fetchWeather(function (err, data) {
      if (err) {
        var s = document.getElementById('weather-summary');
        if (s) s.innerHTML = 'Météo indisponible';
        return;
      }
      render(data);
    });
  }

  global.Weather = {
    refresh: refresh,
    /* Refresh every 30 minutes */
    start: function () {
      refresh();
      setInterval(refresh, 30 * 60 * 1000);
    }
  };
})(window);
