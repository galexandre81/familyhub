/* tiles/timer.js — vue compacte (timers actifs en mini) + vue plein écran (choix « Autre » sans clavier,
   minuteurs en cours via FamilyHubMinuteursPanneau, presets).
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

  /* Icônes SVG inline (currentColor) — les glyphes Unicode ▶ ⏸ ✕ 🔔
     s'affichaient en tofu / mal rendus sur iPad mini 1 (Safari 9). On suit
     le pattern déjà utilisé dans radio.js (STOP_ICON_SVG). aria-hidden car
     le bouton porte un aria-label. */
  var ICON_BELL_SM =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" style="display:inline-block; vertical-align:-4px; margin-right:6px">' +
      '<path d="M12 3 Q17 3, 17 10 L18 16 L6 16 L7 10 Q7 3, 12 3 Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M10 18 Q12 21, 14 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
    '</svg>';

  /* Échappe un texte libre (label saisi dans le hub) avant insertion HTML. */
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

    /* tick() notifie chaque seconde, même sans minuteur actif. On mémorise
       le dernier HTML écrit et on saute les écritures identiques : sinon le
       SVG du sablier est reconstruit 86 400 fois par jour sur l'iPad mini. */
    var lastHtml = null;
    function writeBody(html) {
      if (html === lastHtml) return;
      lastHtml = html;
      bodyEl.innerHTML = html;
    }

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
        writeBody(''
          + '<div class="timer-compact-empty">'
          + '<div class="timer-compact-empty-icon">' + hourglassSvg + '</div>'
          + '</div>');
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
      html += '<div class="timer-hero-time" style="color:' + topColor + '">' + (top.status === 'ended' ? '<span aria-label="Minuteur terminé">' + ICON_BELL_SM.replace('width="20" height="20"', 'width="40" height="40"').replace('margin-right:6px', 'margin:0') + '</span>' : fmt(topRemaining)) + '</div>';
      html += '<div class="timer-hero-label">' + escapeHtml(top.label || '?') + '</div>';
      html += '</div></div>';

      if (active.length > 1) {
        html += '<div class="timer-compact-others">+ ' + (active.length - 1) + ' autre' + (active.length > 2 ? 's' : '') + '</div>';
      }
      writeBody(html);
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
  /* Choix « Autre » : gros boutons de durées courantes (un toucher lance) et
     un sélecteur −/+ en minutes. Pas de clavier, pas de nom à taper : le nom
     est automatique (« 20 min ») ou celui passé par l'appelant. */
  var CHOIX_MINUTES = [2, 3, 4, 15, 20, 30, 45, 60];
  var PAS_MIN = 1, PAS_MAX = 180;
  /* −/+ dessinés en SVG : les glyphes Unicode peuvent sortir en tofu sur Safari 9. */
  var SVG_MOINS = '<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true" style="display:block">' +
    '<path d="M5 12 H19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';
  var SVG_PLUS = '<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true" style="display:block">' +
    '<path d="M12 5 V19 M5 12 H19" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>';

  function monterChoix(conteneur, options) {
    var opts = options || {};
    var nom = opts.libelleParDefaut || null;
    var minutes = 5;

    function lancer(min) {
      if (!global.FamilyHubTimers || min <= 0) return;
      global.FamilyHubTimers.startTimer(nom, min * 60);
      if (typeof opts.apresLancement === 'function') opts.apresLancement();
    }

    var racine = document.createElement('div');
    racine.className = 'fh-min-choix fh-corps';
    conteneur.appendChild(racine);

    var rangee = document.createElement('div');
    rangee.className = 'fh-min-choix-rangee';
    racine.appendChild(rangee);
    for (var i = 0; i < CHOIX_MINUTES.length; i++) {
      (function (min) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'fh-min-btn fh-min-choix-btn fh-action fh-corps';
        b.setAttribute('aria-label', 'Lancer un minuteur de ' + min + ' minutes');
        b.innerHTML = '<span class="fh-min-dedans fh-min-colonne">'
          + '<span class="fh-min-choix-nb fh-titre">' + min + '</span><span>min</span></span>';
        b.addEventListener('click', function () { lancer(min); });
        rangee.appendChild(b);
      })(CHOIX_MINUTES[i]);
    }

    var pas = document.createElement('div');
    pas.className = 'fh-min-pas';
    pas.innerHTML =
      '<button type="button" class="fh-min-btn fh-min-pas-btn fh-carte fh-texte fh-bordure fh-corps" data-pas="-1" aria-label="Une minute de moins"><span class="fh-min-dedans">' + SVG_MOINS + '</span></button>' +
      '<div class="fh-min-pas-valeur fh-titre fh-texte"></div>' +
      '<button type="button" class="fh-min-btn fh-min-pas-btn fh-carte fh-texte fh-bordure fh-corps" data-pas="1" aria-label="Une minute de plus"><span class="fh-min-dedans">' + SVG_PLUS + '</span></button>' +
      '<button type="button" class="fh-min-btn fh-min-pas-lancer fh-action fh-corps"><span class="fh-min-dedans"></span></button>';
    racine.appendChild(pas);

    var valeurEl = pas.querySelector('.fh-min-pas-valeur');
    var lancerBtn = pas.querySelector('.fh-min-pas-lancer');
    var lancerEl = lancerBtn.querySelector('.fh-min-dedans');
    function maj() {
      valeurEl.textContent = minutes + ' min';
      lancerEl.textContent = 'Lancer ' + minutes + ' min';
    }
    var boutonsPas = pas.querySelectorAll('[data-pas]');
    for (var j = 0; j < boutonsPas.length; j++) {
      boutonsPas[j].addEventListener('click', function () {
        var d = parseInt(this.getAttribute('data-pas'), 10);
        minutes = Math.min(PAS_MAX, Math.max(PAS_MIN, minutes + d));
        maj();
      });
    }
    /* Écouteur sur le <button> (toute sa surface), pas sur le span intérieur. */
    lancerBtn.addEventListener('click', function () { lancer(minutes); });
    maj();

    return {
      demonter: function () {
        if (racine.parentNode) racine.parentNode.removeChild(racine);
      }
    };
  }

  function section(container, titre) {
    var s = document.createElement('div');
    s.className = 'tile-timer-section';
    var h = document.createElement('h2');
    h.className = 'tile-timer-section-h2 fh-titre';
    h.innerHTML = titre;
    s.appendChild(h);
    container.appendChild(s);
    return s;
  }

  function fermerOverlay() {
    if (global.FamilyHubOverlay) global.FamilyHubOverlay.close();
  }

  function expand(container, _data, config) {
    container.innerHTML = '';
    container.className = 'tile-overlay-content tile-timer-expand';

    var cfg = config || {};
    var presets = cfg.presets ? cfg.presets : [];
    var nom = cfg.libelleParDefaut || null;

    /* Posé tout de suite : si la suite lève une erreur, on démonte ce qui a
       déjà été monté (abonnement du panneau) avant de la relancer. */
    var monte = { choix: null, panneau: null };
    container._timerExpand = monte;

    try {
      var headerEl = document.createElement('h1');
      headerEl.className = 'tile-overlay-h1 fh-titre';
      headerEl.innerHTML = 'Minuteur';
      container.appendChild(headerEl);

      /* 1. Autre durée — c'est ce qu'on vient chercher ici (le panneau du
         tableau a déjà 1 / 5 / 10 min). Tout lancement referme le plein écran. */
      var choixSection = section(container, 'Choisis une durée');
      monte.choix = monterChoix(choixSection, { libelleParDefaut: nom, apresLancement: fermerOverlay });

      /* 2. Minuteurs en cours + lancement rapide (panneau partagé). */
      if (global.FamilyHubMinuteursPanneau) {
        var enCours = section(container, 'En cours');
        monte.panneau = global.FamilyHubMinuteursPanneau.monter(enCours, {
          libelleParDefaut: nom,
          autre: false,
          apresLancement: fermerOverlay
        });
      }

      /* 3. Presets configurés dans le hub (suggestions, en bas) */
      if (presets.length > 0) {
        var presetSection = section(container, 'Démarrage rapide');
        var presetGrid = document.createElement('div');
        presetGrid.className = 'tile-timer-preset-grid';
        presetSection.appendChild(presetGrid);

        for (var i = 0; i < presets.length; i++) {
          (function (p) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tile-timer-preset-btn';
            /* iOS 9 : pas de flex sur le <button>, span intérieur. */
            btn.innerHTML = '<span class="tile-timer-preset-in">'
              + '<span class="preset-label">' + escapeHtml(p.label) + '</span>'
              + '<span class="preset-duration">' + fmtDuration(p.seconds) + '</span></span>';
            btn.addEventListener('click', function () {
              global.FamilyHubTimers.startTimer(p.label, p.seconds);
              fermerOverlay();
            });
            presetGrid.appendChild(btn);
          })(presets[i]);
        }
      }

      /* 4. Bouton de test du son — discret, tout en bas */
      var testBtn = document.createElement('button');
      testBtn.className = 'btn-tile-secondary timer-test-sound';
      testBtn.setAttribute('aria-label', 'Tester le son');
      testBtn.innerHTML = ICON_BELL_SM + 'Tester le son';
      testBtn.addEventListener('click', function () {
        global.FamilyHubTimers.beepSequence(2);
      });
      container.appendChild(testBtn);
    } catch (e) {
      collapse(container);
      throw e;
    }
  }

  function collapse(container) {
    var e = container._timerExpand;
    if (!e) return;
    container._timerExpand = null;
    if (e.panneau) { try { e.panneau.demonter(); } catch (err) {} }
    if (e.choix) { try { e.choix.demonter(); } catch (err2) {} }
  }

  global.Tiles = global.Tiles || {};
  global.Tiles.timer = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse,
    monterChoix: monterChoix
  };
})(window);
