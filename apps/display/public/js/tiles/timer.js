/* tiles/timer.js — vue compacte (timers actifs en mini) + vue plein écran (presets + custom + contrôles).
   ES5 vanilla. Lit l'état depuis window.FamilyHubTimers (singleton Firestore). */
(function (global) {
  'use strict';

  function fmt(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000));
    var m = Math.floor(s / 60);
    var sec = s - m * 60;
    var h = Math.floor(m / 60);
    var mn = m - h * 60;
    var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
    if (h > 0) return h + ':' + pad(mn) + ':' + pad(sec);
    return pad(mn) + ':' + pad(sec);
  }

  function fmtDuration(seconds) {
    if (seconds < 60) return seconds + ' s';
    if (seconds < 3600) return Math.round(seconds / 60) + ' min';
    var h = Math.floor(seconds / 3600);
    var m = Math.round((seconds - h * 3600) / 60);
    if (m === 0) return h + ' h';
    return h + ' h ' + m + ' min';
  }

  /* Détermine la couleur en fonction du % restant */
  function timeColor(progress) {
    if (progress >= 0.9) return '#C8553D';      /* terracotta urgent */
    if (progress >= 0.66) return '#E8A042';     /* ambre */
    return '#4A7C59';                            /* vert sauge */
  }

  /* --- Vue COMPACTE --- */
  function render(container, _data, config) {
    container.className = 'grid-cell tile-timer tile-clickable';
    container.innerHTML = '';

    var titleEl = document.createElement('div');
    titleEl.className = 'tile-title';
    titleEl.innerHTML = 'Minuteur';
    container.appendChild(titleEl);

    var bodyEl = document.createElement('div');
    bodyEl.className = 'tile-timer-compact';
    container.appendChild(bodyEl);

    function renderState(state) {
      var active = (state.timers || []).filter(function (t) {
        return t.status === 'running' || t.status === 'paused' || t.status === 'ended';
      });

      if (active.length === 0) {
        /* Stopwatch SVG dessiné en laiton — beaucoup plus visible à 2m que l'emoji */
        var hourglassSvg =
          '<svg viewBox="0 0 80 96" width="120" height="140">' +
          /* Top + bottom caps en laiton */
          '<path d="M16 4 H64 V8 H16 Z" fill="#D9A05B"/>' +
          '<path d="M16 88 H64 V92 H16 Z" fill="#D9A05B"/>' +
          /* Verre extérieur (contour) */
          '<path d="M20 8 H60 V20 L42 44 V52 L60 76 V88 H20 V76 L38 52 V44 L20 20 Z" ' +
          '  fill="none" stroke="#D9A05B" stroke-width="2" stroke-linejoin="round"/>' +
          /* Sable supérieur (peu rempli — le minuteur attend) */
          '<path d="M24 12 H56 L42 30 H38 Z" fill="#D9A05B" opacity="0.85"/>' +
          /* Filet de sable central */
          '<line x1="40" y1="44" x2="40" y2="52" stroke="#D9A05B" stroke-width="1.5"/>' +
          /* Sable inférieur (petit tas) */
          '<path d="M28 84 H52 L46 76 H34 Z" fill="#D9A05B" opacity="0.85"/>' +
          '</svg>';
        bodyEl.innerHTML = ''
          + '<div class="timer-compact-empty">'
          + '<div class="timer-compact-empty-icon">' + hourglassSvg + '</div>'
          + '</div>';
        return;
      }

      /* Met le timer le plus urgent en vedette (celui avec le moins de temps restant) */
      var sorted = active.slice().sort(function (a, b) {
        return global.FamilyHubTimers.timerRemainingMs(a) - global.FamilyHubTimers.timerRemainingMs(b);
      });
      var top = sorted[0];
      var topRemaining = global.FamilyHubTimers.timerRemainingMs(top);
      var topProgress = global.FamilyHubTimers.timerProgress(top);
      var topColor = top.status === 'ended' ? '#C8553D' : timeColor(topProgress);

      var html = '<div class="timer-hero ' + top.status + '">';
      /* Cercle de progression SVG */
      var radius = 40, circ = 2 * Math.PI * radius;
      var dashOffset = circ * (1 - topProgress);
      html += '<svg class="timer-hero-ring" viewBox="0 0 100 100">';
      html += '<circle cx="50" cy="50" r="' + radius + '" fill="none" stroke="#E5E5E0" stroke-width="6"/>';
      html += '<circle cx="50" cy="50" r="' + radius + '" fill="none" stroke="' + topColor + '" stroke-width="6" '
        + 'stroke-dasharray="' + circ.toFixed(2) + '" stroke-dashoffset="' + dashOffset.toFixed(2) + '" '
        + 'stroke-linecap="round" transform="rotate(-90 50 50)"/>';
      html += '</svg>';
      html += '<div class="timer-hero-inner">';
      html += '<div class="timer-hero-time" style="color:' + topColor + '">' + (top.status === 'ended' ? '🔔' : fmt(topRemaining)) + '</div>';
      html += '<div class="timer-hero-label">' + (top.label || '?') + '</div>';
      html += '</div></div>';

      if (active.length > 1) {
        html += '<div class="timer-compact-others">+ ' + (active.length - 1) + ' autre' + (active.length > 2 ? 's' : '') + '</div>';
      }
      bodyEl.innerHTML = html;
    }

    var unsub = global.FamilyHubTimers.subscribe(renderState);
    container._timerUnsub = unsub;
  }

  function cleanup(container) {
    if (typeof container._timerUnsub === 'function') {
      try { container._timerUnsub(); } catch (e) {}
      container._timerUnsub = null;
    }
    container.innerHTML = '';
  }

  /* --- Vue PLEIN ÉCRAN --- */
  function expand(container, _data, config) {
    container.innerHTML = '';
    container.className = 'tile-overlay-content tile-timer-expand';

    var presets = (config && config.presets) ? config.presets : [];

    var headerEl = document.createElement('h1');
    headerEl.className = 'tile-overlay-h1';
    headerEl.innerHTML = 'Minuteur';
    container.appendChild(headerEl);

    /* Bouton de test du son — utile pour valider l'unlock iOS 9 */
    var testBtn = document.createElement('button');
    testBtn.className = 'btn-tile-secondary timer-test-sound';
    testBtn.innerHTML = '🔔 Tester le son';
    testBtn.addEventListener('click', function () {
      global.FamilyHubTimers.beepSequence(2);
    });
    container.appendChild(testBtn);

    /* Section : minuteurs actifs */
    var activeSection = document.createElement('div');
    activeSection.className = 'tile-timer-section';
    container.appendChild(activeSection);

    var activeTitle = document.createElement('h2');
    activeTitle.className = 'tile-timer-section-h2';
    activeTitle.innerHTML = 'En cours';
    activeSection.appendChild(activeTitle);

    var activeListEl = document.createElement('div');
    activeListEl.className = 'tile-timer-active-list';
    activeSection.appendChild(activeListEl);

    /* Section : presets */
    if (presets.length > 0) {
      var presetTitle = document.createElement('h2');
      presetTitle.className = 'tile-timer-section-h2';
      presetTitle.innerHTML = 'Démarrage rapide';
      container.appendChild(presetTitle);

      var presetGrid = document.createElement('div');
      presetGrid.className = 'tile-timer-preset-grid';
      container.appendChild(presetGrid);

      for (var i = 0; i < presets.length; i++) {
        (function (p) {
          var btn = document.createElement('button');
          btn.className = 'tile-timer-preset-btn';
          btn.innerHTML = '<span class="preset-label">' + p.label + '</span>'
            + '<span class="preset-duration">' + fmtDuration(p.seconds) + '</span>';
          btn.addEventListener('click', function () {
            global.FamilyHubTimers.startTimer(p.label, p.seconds);
          });
          presetGrid.appendChild(btn);
        })(presets[i]);
      }
    }

    /* Section : custom — deux <select> minutes / secondes.
       Sur iOS Safari, <select> ouvre nativement un picker à rouleaux (perfect). */
    var customTitle = document.createElement('h2');
    customTitle.className = 'tile-timer-section-h2';
    customTitle.innerHTML = 'Minuteur custom';
    container.appendChild(customTitle);

    function buildOptions(max, defaultVal) {
      var html = '';
      for (var i = 0; i <= max; i++) {
        var s = i < 10 ? '0' + i : '' + i;
        html += '<option value="' + i + '"' + (i === defaultVal ? ' selected' : '') + '>' + s + '</option>';
      }
      return html;
    }

    var customForm = document.createElement('div');
    customForm.className = 'tile-timer-custom';
    customForm.innerHTML =
      '<input type="text" id="custom-label" class="input-tile" placeholder="Label (ex: Tarte aux pommes)" />' +
      '<label class="input-tile-label">Durée — touche pour faire défiler les rouleaux</label>' +
      '<div class="timer-picker">' +
      '<div class="timer-picker-col">' +
      '<select id="custom-mins" class="timer-picker-select">' + buildOptions(120, 5) + '</select>' +
      '<div class="timer-picker-unit">minutes</div>' +
      '</div>' +
      '<div class="timer-picker-sep">:</div>' +
      '<div class="timer-picker-col">' +
      '<select id="custom-secs" class="timer-picker-select">' + buildOptions(59, 0) + '</select>' +
      '<div class="timer-picker-unit">secondes</div>' +
      '</div>' +
      '</div>' +
      '<button type="button" id="custom-start" class="btn-tile-primary">Démarrer le minuteur</button>';
    container.appendChild(customForm);

    customForm.querySelector('#custom-start').addEventListener('click', function () {
      var label = customForm.querySelector('#custom-label').value || 'Minuteur';
      var m = parseInt(customForm.querySelector('#custom-mins').value, 10) || 0;
      var s = parseInt(customForm.querySelector('#custom-secs').value, 10) || 0;
      var total = m * 60 + s;
      if (total <= 0) return;
      global.FamilyHubTimers.startTimer(label, total);
      customForm.querySelector('#custom-label').value = '';
      customForm.querySelector('#custom-mins').value = '5';
      customForm.querySelector('#custom-secs').value = '0';
    });

    /* Subscribe pour mise à jour des timers actifs */
    function renderActive(state) {
      var active = (state.timers || []).filter(function (t) {
        return t.status === 'running' || t.status === 'paused' || t.status === 'ended';
      });
      if (active.length === 0) {
        activeListEl.innerHTML = '<p class="timer-active-empty">Aucun minuteur en cours.</p>';
        return;
      }
      activeListEl.innerHTML = '';
      for (var i = 0; i < active.length; i++) {
        (function (t) {
          var remaining = global.FamilyHubTimers.timerRemainingMs(t);
          var progress = global.FamilyHubTimers.timerProgress(t);
          var row = document.createElement('div');
          row.className = 'timer-active-row ' + t.status;

          var html = '<div class="timer-active-info">';
          html += '<div class="timer-active-label">' + (t.label || '?') + '</div>';
          html += '<div class="timer-active-time">' + (t.status === 'ended' ? '🔔 Terminé !' : fmt(remaining)) + '</div>';
          html += '<div class="timer-active-progress"><div class="timer-active-progress-fill" style="width:' + Math.round(progress * 100) + '%"></div></div>';
          html += '</div>';
          html += '<div class="timer-active-actions">';
          if (t.status === 'ended') {
            html += '<button class="btn-tile-primary timer-ack">OK</button>';
          } else if (t.status === 'paused') {
            html += '<button class="btn-tile-secondary timer-resume">▶</button>';
            html += '<button class="btn-tile-secondary timer-stop">✕</button>';
          } else {
            html += '<button class="btn-tile-secondary timer-pause">⏸</button>';
            html += '<button class="btn-tile-secondary timer-stop">✕</button>';
          }
          html += '</div>';
          row.innerHTML = html;

          var pauseBtn = row.querySelector('.timer-pause');
          if (pauseBtn) pauseBtn.addEventListener('click', function () { global.FamilyHubTimers.pauseTimer(t); });
          var resumeBtn = row.querySelector('.timer-resume');
          if (resumeBtn) resumeBtn.addEventListener('click', function () { global.FamilyHubTimers.resumeTimer(t); });
          var stopBtn = row.querySelector('.timer-stop');
          if (stopBtn) stopBtn.addEventListener('click', function () { global.FamilyHubTimers.stopTimer(t); });
          var ackBtn = row.querySelector('.timer-ack');
          if (ackBtn) ackBtn.addEventListener('click', function () { global.FamilyHubTimers.acknowledgeTimer(t); });

          activeListEl.appendChild(row);
        })(active[i]);
      }
    }
    var unsub = global.FamilyHubTimers.subscribe(renderActive);
    container._timerExpandUnsub = unsub;
  }

  function collapse(container) {
    if (typeof container._timerExpandUnsub === 'function') {
      try { container._timerExpandUnsub(); } catch (e) {}
      container._timerExpandUnsub = null;
    }
  }

  global.Tiles = global.Tiles || {};
  global.Tiles.timer = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse
  };
})(window);
