/* tiles/clock.js — affichage de l'heure, ES5 vanilla, iOS 9 OK. */
(function (global) {
  'use strict';

  var DAYS_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MONTHS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                   'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function formatTime(date, config) {
    var h = date.getHours();
    var m = date.getMinutes();
    var s = date.getSeconds();
    var suffix = '';
    if (config.format === '12h') {
      suffix = h >= 12 ? ' PM' : ' AM';
      h = h % 12; if (h === 0) h = 12;
    }
    var t = h + ':' + pad2(m);
    if (config.showSeconds) t += ':' + pad2(s);
    return t + suffix;
  }

  function formatDate(date, config) {
    if (config.dateFormat === 'short') {
      return pad2(date.getDate()) + '/' + pad2(date.getMonth() + 1) + '/' + date.getFullYear();
    }
    return DAYS_FR[date.getDay()] + ' ' + date.getDate() + ' ' + MONTHS_FR[date.getMonth()] + ' ' + date.getFullYear();
  }

  function tick(container, config) {
    var date = new Date();
    var timeEl = container.querySelector('.tile-clock-time');
    var dateEl = container.querySelector('.tile-clock-date');
    if (timeEl) timeEl.innerHTML = formatTime(date, config);
    if (dateEl && config.showDate) dateEl.innerHTML = formatDate(date, config);
  }

  function render(container, _data, configRaw) {
    var config = {
      format: '24h',
      showSeconds: false,
      showDate: true,
      dateFormat: 'long'
    };
    if (configRaw) {
      if (configRaw.format) config.format = configRaw.format;
      if (typeof configRaw.showSeconds === 'boolean') config.showSeconds = configRaw.showSeconds;
      if (typeof configRaw.showDate === 'boolean') config.showDate = configRaw.showDate;
      if (configRaw.dateFormat) config.dateFormat = configRaw.dateFormat;
    }

    container.className = 'grid-cell tile-clock';
    var html = '<div class="tile-clock-time">--:--</div>';
    if (config.showDate) html += '<div class="tile-clock-date"></div>';
    container.innerHTML = html;

    tick(container, config);

    /* Cleanup l'éventuel interval précédent */
    cleanup(container);

    var intervalMs = config.showSeconds ? 1000 : 30000;
    container._clockInterval = setInterval(function () { tick(container, config); }, intervalMs);
  }

  function cleanup(container) {
    if (container._clockInterval) {
      clearInterval(container._clockInterval);
      container._clockInterval = null;
    }
  }

  global.Tiles = global.Tiles || {};
  global.Tiles.clock = { render: render, cleanup: cleanup };
})(window);
