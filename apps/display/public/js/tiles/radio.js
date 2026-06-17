/* tiles/radio.js — vue compacte (dans la tuile) + vue plein écran (overlay).
   L'audio est géré par window.FamilyHubAudio (singleton, persiste). */
(function (global) {
  'use strict';

  /**
   * Vue COMPACTE — affichée dans la cell de la grille.
   *  - Bouton play/pause central : tap = lecture/pause (sans ouvrir l'overlay)
   *  - Tap autour du bouton = ouvrir overlay pour gérer les stations
   */
  function render(container, _data, config) {
    container.className = 'grid-cell tile-radio tile-clickable';
    container.innerHTML = '';

    var stations = (config && config.stations) ? config.stations : [];
    var defaultStationId = (config && config.defaultStationId) ? config.defaultStationId : (stations[0] && stations[0].id);
    container._radioConfig = config || {};

    function findDefaultStation() {
      for (var i = 0; i < stations.length; i++) {
        if (stations[i].id === defaultStationId) return stations[i];
      }
      return stations[0] || null;
    }

    var titleEl = document.createElement('div');
    titleEl.className = 'tile-title';
    titleEl.innerHTML = 'Radio';
    container.appendChild(titleEl);

    var center = document.createElement('div');
    center.className = 'tile-radio-compact';
    container.appendChild(center);

    /* Icônes SVG laiton 110px — taille comparable au sablier minuteur, sans cercle. */
    var ICON_PLAY =
      '<svg viewBox="0 0 100 100" width="96" height="96">' +
      '<path d="M 26 12 L 88 50 L 26 88 Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
      '</svg>';
    var ICON_PAUSE =
      '<svg viewBox="0 0 100 100" width="96" height="96">' +
      '<rect x="22" y="14" width="20" height="72" rx="3" fill="currentColor"/>' +
      '<rect x="58" y="14" width="20" height="72" rx="3" fill="currentColor"/>' +
      '</svg>';
    var ICON_LOADING =
      '<svg viewBox="0 0 100 100" width="100" height="100">' +
      '<circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-dasharray="70 240">' +
      '<animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="1s" repeatCount="indefinite"/>' +
      '</circle>' +
      '</svg>';
    var ICON_ERROR =
      '<svg viewBox="0 0 100 100" width="100" height="100">' +
      '<path d="M50 12 L90 82 L10 82 Z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>' +
      '<rect x="46" y="36" width="8" height="26" rx="2" fill="currentColor"/>' +
      '<rect x="46" y="66" width="8" height="8" rx="2" fill="currentColor"/>' +
      '</svg>';

    /* Bouton play/pause (tappable indépendamment de l'expand) */
    var playBtn = document.createElement('button');
    playBtn.className = 'tile-radio-compact-btn';
    playBtn.setAttribute('aria-label', 'Play / Pause');
    playBtn.innerHTML = ICON_PLAY;
    /* IMPORTANT iOS 9 : play() doit être SYNCHRONE dans le handler de tap. */
    playBtn.addEventListener('click', function (e) {
      e.stopPropagation(); /* ne pas ouvrir l'overlay */
      var s = global.FamilyHubAudio.getState();
      if (s.playing) {
        global.FamilyHubAudio.pause();
      } else if (s.currentStation) {
        global.FamilyHubAudio.play(s.currentStation);
      } else {
        var def = findDefaultStation();
        if (def) global.FamilyHubAudio.play(def);
      }
    });
    center.appendChild(playBtn);

    var stationEl = document.createElement('div');
    stationEl.className = 'tile-radio-compact-station';
    stationEl.innerHTML = stations.length + ' station' + (stations.length > 1 ? 's' : '');
    center.appendChild(stationEl);

    var statusEl = document.createElement('div');
    statusEl.className = 'tile-radio-compact-status';
    statusEl.innerHTML = 'Touche ▶ pour ' + (findDefaultStation() ? findDefaultStation().nom : 'lire');
    center.appendChild(statusEl);

    /* Subscribe to audio singleton state.
       Le status text est masqué sauf en cas d'erreur — l'icône (play/pause) et
       la couleur (sage = lecture, brass = pause) communiquent l'état visuellement. */
    var unsub = global.FamilyHubAudio.subscribe(function (state) {
      if (state.error) {
        playBtn.innerHTML = ICON_ERROR;
        playBtn.className = 'tile-radio-compact-btn error';
        playBtn.setAttribute('aria-label', 'Erreur radio — réessayer');
        stationEl.innerHTML = state.currentStation ? state.currentStation.nom : '—';
        statusEl.innerHTML = state.error;
        statusEl.style.display = '';
      } else if (state.loading) {
        playBtn.innerHTML = ICON_LOADING;
        playBtn.className = 'tile-radio-compact-btn loading';
        playBtn.setAttribute('aria-label', 'Chargement de la radio');
        stationEl.innerHTML = state.currentStation ? state.currentStation.nom : '—';
        statusEl.innerHTML = '';
        statusEl.style.display = 'none';
      } else if (state.playing) {
        playBtn.innerHTML = ICON_PAUSE;
        playBtn.className = 'tile-radio-compact-btn playing';
        playBtn.setAttribute('aria-label', 'Mettre la radio en pause');
        stationEl.innerHTML = state.currentStation ? state.currentStation.nom : '—';
        statusEl.innerHTML = '';
        statusEl.style.display = 'none';
      } else if (state.currentStation) {
        playBtn.innerHTML = ICON_PLAY;
        playBtn.className = 'tile-radio-compact-btn';
        playBtn.setAttribute('aria-label', 'Reprendre la radio (' + state.currentStation.nom + ')');
        stationEl.innerHTML = state.currentStation.nom;
        statusEl.innerHTML = '';
        statusEl.style.display = 'none';
      } else {
        playBtn.innerHTML = ICON_PLAY;
        playBtn.className = 'tile-radio-compact-btn';
        var def = findDefaultStation();
        playBtn.setAttribute('aria-label', def ? 'Lire ' + def.nom : 'Lire la radio');
        stationEl.innerHTML = def ? def.nom : (stations.length + ' station' + (stations.length > 1 ? 's' : ''));
        statusEl.innerHTML = '';
        statusEl.style.display = 'none';
      }
    });

    container._radioUnsub = unsub;
  }

  function cleanup(container) {
    if (typeof container._radioUnsub === 'function') {
      try { container._radioUnsub(); } catch (e) { /* noop */ }
      container._radioUnsub = null;
    }
    container.innerHTML = '';
  }

  /**
   * Vue PLEIN ÉCRAN — appelée par l'overlay quand l'utilisateur tape sur la tuile.
   * Liste de stations grandes touchables, statut, gros bouton play/pause.
   */
  function expand(container, _data, config) {
    container.innerHTML = '';
    container.className = 'tile-overlay-content tile-radio-expand';

    var stations = (config && config.stations) ? config.stations : [];
    var defaultStationId = (config && config.defaultStationId) ? config.defaultStationId : (stations[0] && stations[0].id);

    var headerEl = document.createElement('h1');
    headerEl.className = 'tile-overlay-h1';
    headerEl.innerHTML = 'Radio';
    container.appendChild(headerEl);

    var nowPlayingEl = document.createElement('div');
    nowPlayingEl.className = 'tile-radio-expand-nowplaying';
    container.appendChild(nowPlayingEl);

    var listEl = document.createElement('div');
    listEl.className = 'tile-radio-expand-list';
    container.appendChild(listEl);

    /* Boutons de stations */
    var btnsByStation = {};
    function buildList() {
      for (var i = 0; i < stations.length; i++) {
        (function (st) {
          var btn = document.createElement('button');
          btn.className = 'tile-radio-expand-btn';
          btn.setAttribute('aria-pressed', 'false');
          btn.innerHTML = st.nom;
          /* IMPORTANT iOS 9 : appel synchrone à FamilyHubAudio.play(),
             sans setTimeout / await — sinon Safari bloque. */
          btn.addEventListener('click', function () {
            var cur = global.FamilyHubAudio.getState();
            if (cur.playing && cur.currentStation && cur.currentStation.id === st.id) {
              global.FamilyHubAudio.pause();
            } else {
              global.FamilyHubAudio.play(st);
            }
          });
          listEl.appendChild(btn);
          btnsByStation[st.id] = btn;
        })(stations[i]);
      }
    }
    buildList();

    /* Bouton stop global — icône SVG (carré plein) + libellé. Le glyph
       Unicode ⏸ s'affichait mal sur iPad mini 1 (fallback Safari moche). */
    var STOP_ICON_SVG =
      '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" ' +
        'style="display:inline-block; vertical-align:-2px; margin-right:8px;">' +
        '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/>' +
      '</svg>';
    var stopBtn = document.createElement('button');
    stopBtn.className = 'tile-radio-expand-stop';
    stopBtn.innerHTML = STOP_ICON_SVG + 'Arrêter';
    stopBtn.addEventListener('click', function () { global.FamilyHubAudio.pause(); });
    container.appendChild(stopBtn);

    /* Si aucune station active, suggère de démarrer celle par défaut */
    function maybeAutoplayHint() {
      var cur = global.FamilyHubAudio.getState();
      if (!cur.currentStation && defaultStationId) {
        nowPlayingEl.innerHTML = 'Touche une station pour démarrer';
      }
    }
    maybeAutoplayHint();

    /* Subscribe pour mise à jour du nowPlaying et des active states */
    var unsub = global.FamilyHubAudio.subscribe(function (state) {
      /* Active state visual */
      for (var id in btnsByStation) {
        if (btnsByStation.hasOwnProperty(id)) {
          var b = btnsByStation[id];
          var isCurrent = state.currentStation && state.currentStation.id === id;
          var classes = 'tile-radio-expand-btn';
          if (isCurrent) {
            if (state.playing) classes += ' active playing';
            else classes += ' active';
          }
          b.className = classes;
          b.setAttribute('aria-pressed', (isCurrent && state.playing) ? 'true' : 'false');
          if (isCurrent) b.setAttribute('aria-current', 'true');
          else b.removeAttribute('aria-current');
        }
      }
      /* Now playing */
      if (state.error) {
        nowPlayingEl.innerHTML = '⚠ ' + state.error
          + (state.currentStation ? ' (' + state.currentStation.nom + ')' : '');
        stopBtn.style.display = 'none';
      } else if (state.loading) {
        nowPlayingEl.innerHTML = '⋯ Chargement de '
          + (state.currentStation ? state.currentStation.nom : '');
        stopBtn.style.display = 'inline-block';
      } else if (state.playing) {
        nowPlayingEl.innerHTML = '♪ ' + state.currentStation.nom + ' — en lecture';
        stopBtn.style.display = 'inline-block';
      } else if (state.currentStation) {
        nowPlayingEl.innerHTML = '⏸ ' + state.currentStation.nom + ' — en pause';
        stopBtn.style.display = 'none';
      } else {
        nowPlayingEl.innerHTML = 'Touche une station pour démarrer';
        stopBtn.style.display = 'none';
      }
    });

    container._radioExpandUnsub = unsub;
  }

  function collapse(container) {
    if (typeof container._radioExpandUnsub === 'function') {
      try { container._radioExpandUnsub(); } catch (e) { /* noop */ }
      container._radioExpandUnsub = null;
    }
  }

  global.Tiles = global.Tiles || {};
  global.Tiles.radio = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse
  };
})(window);
