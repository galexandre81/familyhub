/* radio.js — Web radio with HTTPS streams. ES5 vanilla. */
(function (global) {
  'use strict';

  var STATIONS = [
    { id: 'inter',    nom: 'France Inter',    url: 'https://icecast.radiofrance.fr/franceinter-midfi.mp3' },
    { id: 'info',     nom: 'France Info',     url: 'https://icecast.radiofrance.fr/franceinfo-midfi.mp3' },
    { id: 'culture',  nom: 'France Culture',  url: 'https://icecast.radiofrance.fr/franceculture-midfi.mp3' },
    { id: 'musique',  nom: 'France Musique',  url: 'https://icecast.radiofrance.fr/francemusique-midfi.mp3' },
    { id: 'rts1',     nom: 'RTS La 1ère',     url: 'https://stream.srg-ssr.ch/m/la-1ere/mp3_128' },
    { id: 'couleur3', nom: 'Couleur 3',       url: 'https://stream.srg-ssr.ch/m/couleur3/mp3_128' }
  ];

  var player = null;
  var currentId = null;
  var isPlaying = false;
  var errorTimeout = null;

  var stationsEl, playBtn, playIconEl, statusEl, statusTextEl;

  function setStatus(state, text) {
    if (!statusEl) return;
    statusEl.className = 'radio-status' + (state === 'playing' ? ' is-playing' : '') + (state === 'error' ? ' is-error' : '');
    if (statusTextEl) statusTextEl.innerHTML = text;
  }

  function updatePlayBtn() {
    if (!playBtn) return;
    if (isPlaying) {
      playBtn.className = 'radio-play is-playing';
      playIconEl.innerHTML = '&#10074;&#10074;';
      playBtn.setAttribute('aria-label', 'Pause');
    } else {
      playBtn.className = 'radio-play';
      playIconEl.innerHTML = '&#9658;';
      playBtn.setAttribute('aria-label', 'Lecture');
    }
  }

  function highlightActive() {
    var btns = stationsEl.getElementsByClassName('radio-station');
    for (var i = 0; i < btns.length; i++) {
      var id = btns[i].getAttribute('data-id');
      if (id === currentId && isPlaying) {
        btns[i].className = 'radio-station is-active';
      } else {
        btns[i].className = 'radio-station';
      }
    }
  }

  function findStation(id) {
    for (var i = 0; i < STATIONS.length; i++) {
      if (STATIONS[i].id === id) return STATIONS[i];
    }
    return null;
  }

  function play(id) {
    var st = findStation(id);
    if (!st) return;
    clearTimeout(errorTimeout);

    if (player.src !== st.url) {
      player.src = st.url;
    }
    currentId = id;
    var promise = player.play();
    if (promise && typeof promise.then === 'function') {
      promise['catch'](function () { onError(); });
    }
    isPlaying = true;
    setStatus('playing', '▶ ' + st.nom);
    updatePlayBtn();
    highlightActive();
  }

  function pause() {
    player.pause();
    isPlaying = false;
    setStatus('idle', '⏸ Arrêté');
    updatePlayBtn();
    highlightActive();
  }

  function onError() {
    isPlaying = false;
    setStatus('error', 'Stream indisponible');
    updatePlayBtn();
    highlightActive();
    errorTimeout = setTimeout(function () {
      setStatus('idle', '⏸ Arrêté');
    }, 3000);
  }

  function togglePlay() {
    if (isPlaying) {
      pause();
    } else if (currentId) {
      play(currentId);
    } else {
      play(STATIONS[0].id);
    }
  }

  function buildStationButtons() {
    var html = '';
    for (var i = 0; i < STATIONS.length; i++) {
      html += '<button type="button" class="radio-station" data-id="' + STATIONS[i].id + '">' + STATIONS[i].nom + '</button>';
    }
    stationsEl.innerHTML = html;

    var btns = stationsEl.getElementsByClassName('radio-station');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', function (e) {
        var id = e.currentTarget.getAttribute('data-id');
        if (id === currentId && isPlaying) {
          pause();
        } else {
          play(id);
        }
      });
    }
  }

  function init() {
    player = document.getElementById('player');
    stationsEl = document.getElementById('radio-stations');
    playBtn = document.getElementById('radio-play');
    playIconEl = document.getElementById('radio-play-icon');
    statusEl = document.getElementById('radio-status');
    statusTextEl = document.getElementById('radio-status-text');

    if (!player || !stationsEl || !playBtn) return;

    buildStationButtons();
    playBtn.addEventListener('click', togglePlay);
    player.addEventListener('error', onError);
    player.addEventListener('stalled', function () {
      /* Brief stall — show subtle indicator */
      setStatus('error', 'Reconnexion…');
    });
    player.addEventListener('playing', function () {
      var st = findStation(currentId);
      if (st) setStatus('playing', '▶ ' + st.nom);
    });
    player.addEventListener('ended', function () { pause(); });

    setStatus('idle', '⏸ Arrêté');
    updatePlayBtn();
  }

  global.Radio = { init: init };
})(window);
