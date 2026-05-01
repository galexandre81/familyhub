/* tiles/radio.js — lecteur radio web. ES5 vanilla, héritée du legacy MenuMaster.
   Lit `config.stations` au lieu d'une liste hardcodée. État local par tuile. */
(function (global) {
  'use strict';

  function render(container, _data, config) {
    container.className = 'grid-cell tile-radio';
    container.innerHTML = '';

    var stations = (config && config.stations) ? config.stations : [];
    var defaultId = (config && config.defaultStationId) ? config.defaultStationId : (stations[0] && stations[0].id);

    var titleEl = document.createElement('div');
    titleEl.className = 'tile-title';
    titleEl.innerHTML = 'Radio';
    container.appendChild(titleEl);

    var stationsWrap = document.createElement('div');
    stationsWrap.className = 'tile-radio-stations';
    container.appendChild(stationsWrap);

    var statusEl = document.createElement('div');
    statusEl.className = 'tile-radio-status';
    statusEl.innerHTML = '';
    container.appendChild(statusEl);

    var controls = document.createElement('div');
    controls.className = 'tile-radio-controls';
    container.appendChild(controls);

    var toggle = document.createElement('button');
    toggle.className = 'tile-radio-toggle';
    toggle.setAttribute('aria-label', 'Lecture / Pause');
    toggle.innerHTML = '▶';
    controls.appendChild(toggle);

    var audio = document.createElement('audio');
    audio.setAttribute('preload', 'none');
    container.appendChild(audio);

    var state = {
      currentId: null,
      playing: false,
      buttons: {}
    };

    function statusClear() { setTimeout(function () { statusEl.innerHTML = ''; }, 3000); }

    function setActive(stationId) {
      for (var k in state.buttons) {
        if (state.buttons.hasOwnProperty(k)) state.buttons[k].className = 'tile-radio-btn';
      }
      if (state.buttons[stationId]) state.buttons[stationId].className = 'tile-radio-btn active';
    }

    function playStation(station) {
      try {
        if (audio.src !== station.url) {
          audio.src = station.url;
        }
        var p = audio.play();
        if (p && typeof p.then === 'function') {
          p.then(function () {}, function (err) {
            statusEl.innerHTML = 'Lecture impossible';
            statusClear();
          });
        }
        state.currentId = station.id;
        state.playing = true;
        toggle.innerHTML = '❚❚';
        setActive(station.id);
        statusEl.innerHTML = station.nom;
      } catch (e) {
        statusEl.innerHTML = 'Erreur';
        statusClear();
      }
    }

    function pause() {
      try { audio.pause(); } catch (e) { /* noop */ }
      state.playing = false;
      toggle.innerHTML = '▶';
    }

    function buildStationButtons() {
      stationsWrap.innerHTML = '';
      for (var i = 0; i < stations.length; i++) {
        var st = stations[i];
        (function (station) {
          var btn = document.createElement('button');
          btn.className = 'tile-radio-btn';
          btn.innerHTML = station.nom;
          btn.addEventListener('click', function () {
            if (state.currentId === station.id && state.playing) {
              pause();
            } else {
              playStation(station);
            }
          });
          stationsWrap.appendChild(btn);
          state.buttons[station.id] = btn;
        })(st);
      }
    }

    toggle.addEventListener('click', function () {
      if (!state.currentId) {
        var def = null;
        for (var i = 0; i < stations.length; i++) {
          if (stations[i].id === defaultId) { def = stations[i]; break; }
        }
        if (!def && stations.length > 0) def = stations[0];
        if (def) playStation(def);
        return;
      }
      if (state.playing) pause();
      else {
        var st = null;
        for (var j = 0; j < stations.length; j++) {
          if (stations[j].id === state.currentId) { st = stations[j]; break; }
        }
        if (st) playStation(st);
      }
    });

    audio.addEventListener('error', function () {
      statusEl.innerHTML = 'Flux indisponible';
      pause();
      statusClear();
    });
    audio.addEventListener('stalled', function () {
      statusEl.innerHTML = 'Connexion en cours…';
    });
    audio.addEventListener('playing', function () {
      var st = null;
      for (var i = 0; i < stations.length; i++) {
        if (stations[i].id === state.currentId) { st = stations[i]; break; }
      }
      if (st) statusEl.innerHTML = st.nom;
    });

    buildStationButtons();
    container._radioState = { audio: audio };
  }

  function cleanup(container) {
    if (container._radioState && container._radioState.audio) {
      try { container._radioState.audio.pause(); } catch (e) {}
      container._radioState.audio.src = '';
      container._radioState = null;
    }
    container.innerHTML = '';
  }

  global.Tiles = global.Tiles || {};
  global.Tiles.radio = { render: render, cleanup: cleanup };
})(window);
