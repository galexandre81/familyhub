/* app.js — Home page glue: clock, menu loading, init weather + radio. ES5 vanilla. */
(function () {
  'use strict';

  var DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                   'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function formatTime(d) {
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function formatDateLong(d) {
    return DAYS_FR[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_FR[d.getMonth()] + ' ' + d.getFullYear();
  }

  function formatTodayISO(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function tickClock() {
    var now = new Date();
    var clockEl = document.getElementById('clock');
    var dateEl = document.getElementById('date');
    if (clockEl) clockEl.innerHTML = formatTime(now);
    if (dateEl) dateEl.innerHTML = formatDateLong(now);
  }

  function startClock() {
    tickClock();
    /* Align next tick on the next minute */
    var now = new Date();
    var msToNextMin = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    setTimeout(function () {
      tickClock();
      setInterval(tickClock, 60 * 1000);
    }, msToNextMin);
  }

  function escapeHTML(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderMeal(label, meal) {
    var html = '<div class="meal"><div class="meal-label">' + label + '</div>';
    if (meal && meal.id) {
      html += '<a class="meal-name" href="/recipe.html?id=' + encodeURIComponent(meal.id) + '">' + escapeHTML(meal.nom) + '</a>';
    } else {
      html += '<div class="meal-empty">—</div>';
    }
    html += '</div>';
    return html;
  }

  function dayDateNum(iso) {
    /* Extract day number from "2026-04-27" */
    if (!iso) return '';
    var parts = iso.split('-');
    if (parts.length < 3) return '';
    return parseInt(parts[2], 10);
  }

  function renderMenu(menu) {
    var todayISO = formatTodayISO(new Date());
    var weekEl = document.getElementById('week-label');
    if (weekEl && menu.semaine_iso) weekEl.innerHTML = 'Semaine ' + escapeHTML(menu.semaine_iso);

    var daysEl = document.getElementById('days');
    if (!daysEl || !menu.jours) return;

    var html = '';
    for (var i = 0; i < menu.jours.length; i++) {
      var j = menu.jours[i];
      var isToday = j.date === todayISO;
      html += '<div class="day' + (isToday ? ' is-today' : '') + '">';
      html += '<div class="day-head">';
      html += '<div class="day-name">' + escapeHTML(j.jour) + '</div>';
      html += '<div class="day-date">' + dayDateNum(j.date) + '</div>';
      html += '</div>';
      html += renderMeal('Midi', j.midi);
      html += renderMeal('Soir', j.soir);
      html += '</div>';
    }
    daysEl.innerHTML = html;
  }

  function loadMenu(callback) {
    var xhr = new XMLHttpRequest();
    /* Cache buster — the iPad runs 24/7 in standalone, Safari caches hard */
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

  function refreshMenu() {
    loadMenu(function (err, menu) {
      if (err || !menu) {
        var daysEl = document.getElementById('days');
        if (daysEl) daysEl.innerHTML = '<div class="meal-empty" style="padding:16px">Menu indisponible — vérifier <code>/data/menu-semaine.json</code>.</div>';
        return;
      }
      renderMenu(menu);
    });
  }

  function init() {
    startClock();
    refreshMenu();
    /* Reload menu hourly so a fresh JSON appears without page reload */
    setInterval(refreshMenu, 60 * 60 * 1000);

    if (window.Weather) window.Weather.start();
    if (window.Radio) window.Radio.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
