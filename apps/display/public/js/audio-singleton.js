/* audio-singleton.js — un seul élément audio partagé par toute l'app.
   Survit aux re-renders et changements de vue (tuile compacte ↔ plein écran).
   ES5, iOS 9 OK. */
(function (global) {
  'use strict';

  /* iOS 9 exige un <audio> statique dans le DOM dès le chargement, pas display:none.
     L'élément est dans index.html avec id family-hub-audio-player. */
  var audio = document.getElementById('family-hub-audio-player');
  if (!audio) {
    /* Fallback : crée un audio si la balise statique manque (cas setup.html par ex). */
    audio = document.createElement('audio');
    audio.id = 'family-hub-audio-player';
    audio.setAttribute('preload', 'none');
    document.body.appendChild(audio);
  }

  /* DEBUG : panneau visible activé uniquement avec ?debug=audio dans l'URL. */
  var debugEnabled = (window.location.search.indexOf('debug=audio') !== -1);
  var debugLog = null;
  function debug(msg) {
    if (!debugEnabled) return;
    if (!debugLog) {
      debugLog = document.createElement('div');
      debugLog.id = 'audio-debug';
      debugLog.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:80px;overflow:auto;background:rgba(0,0,0,0.85);color:#FAFAF7;font:11px monospace;padding:4px 8px;z-index:9999;line-height:1.3';
      document.body.appendChild(debugLog);
    }
    var time = new Date().toTimeString().slice(0, 8);
    debugLog.innerHTML = '<div>' + time + ' ' + msg + '</div>' + debugLog.innerHTML;
    while (debugLog.children.length > 8) debugLog.removeChild(debugLog.lastChild);
  }
  if (debugEnabled) {
    var EVENTS = ['loadstart','progress','loadedmetadata','loadeddata','canplay','canplaythrough',
                  'play','playing','pause','waiting','stalled','seeking','seeked','ended',
                  'error','abort','suspend','emptied'];
    for (var ei = 0; ei < EVENTS.length; ei++) {
      (function (evtName) {
        audio.addEventListener(evtName, function () {
          var extra = '';
          if (evtName === 'error' && audio.error) extra = ' code=' + audio.error.code;
          debug('audio:' + evtName + extra);
        });
      })(EVENTS[ei]);
    }
    debug('singleton init, src=' + (audio.src || '(empty)'));
  }

  var state = {
    playing: false,
    loading: false,
    currentStation: null,  /* { id, nom, url } ou null */
    error: null
  };
  var listeners = [];

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state); } catch (e) { /* noop */ }
    }
  }

  /**
   * IMPORTANT iOS 9 : doit être appelé SYNCHRONE depuis un handler tap/click.
   * Pas dans setTimeout, pas après un await, pas après une promise then.
   * Sinon Safari refuse audio.play() comme non-user-gesture.
   */
  function play(station) {
    if (!station || !station.url) return;
    debug('play() called for ' + station.nom);

    /* iOS 9 user-gesture rule : audio.play() doit être l'action SYNCHRONE
       du handler de tap. Match exact du legacy MenuMaster qui marchait. */
    if (audio.src !== station.url) {
      audio.src = station.url;
      debug('src set to ' + station.url);
    }

    var p;
    try {
      p = audio.play();
      debug('audio.play() returned ' + (typeof p));
    } catch (e) {
      debug('play() threw: ' + (e.message || e));
      state.playing = false;
      state.loading = false;
      state.error = e && e.message ? e.message : 'Erreur';
      notify();
      return;
    }

    /* Update state APRÈS play() pour ne pas perturber le gesture */
    state.currentStation = station;
    state.loading = true;
    state.error = null;
    notify();

    if (p && typeof p.then === 'function') {
      p.then(function () {
        debug('play promise resolved');
      }, function (err) {
        debug('play promise rejected: ' + ((err && (err.name || err.message)) || 'unknown'));
        state.playing = false;
        state.loading = false;
        state.error = (err && (err.name || err.message)) || 'Erreur';
        notify();
      });
    }
  }

  function pause() {
    try { audio.pause(); } catch (e) { /* noop */ }
    state.playing = false;
    state.loading = false;
    notify();
  }

  function toggle() {
    if (state.playing) pause();
    else if (state.currentStation) play(state.currentStation);
  }

  audio.addEventListener('playing', function () {
    state.playing = true;
    state.loading = false;
    state.error = null;
    notify();
  });

  /* iOS 9 suspend bug : si on reçoit suspend après play() sans avoir atteint
     playing, on retente play() pour kicker l'audio. Évite la boucle infinie
     en limitant à 3 tentatives. */
  var suspendRetries = 0;
  audio.addEventListener('suspend', function () {
    if (state.loading && !state.playing && suspendRetries < 3) {
      suspendRetries++;
      debug('suspend, retry play() (' + suspendRetries + '/3)');
      try { audio.play(); } catch (e) { /* noop */ }
    }
  });
  audio.addEventListener('playing', function () { suspendRetries = 0; });
  audio.addEventListener('pause', function () {
    state.playing = false;
    notify();
  });
  audio.addEventListener('waiting', function () {
    state.loading = true;
    notify();
  });
  audio.addEventListener('error', function () {
    state.playing = false;
    state.loading = false;
    state.error = 'Flux indisponible';
    notify();
  });

  function subscribe(fn) {
    listeners.push(fn);
    /* Pousse l'état actuel immédiatement */
    try { fn(state); } catch (e) { /* noop */ }
    return function unsubscribe() {
      var idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }

  function getState() { return state; }

  global.FamilyHubAudio = {
    play: play,
    pause: pause,
    toggle: toggle,
    subscribe: subscribe,
    getState: getState
  };
})(window);
