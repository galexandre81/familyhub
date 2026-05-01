/* timer-singleton.js — état partagé des timers (synchro Firestore) + alarme audio.
   Plusieurs timers simultanés possibles (fin pâtes / fin œufs / etc.). ES5 iOS 9 OK. */
(function (global) {
  'use strict';

  /**
   * Alarme : Web Audio API (oscillateur 880Hz avec ADSR) en primaire, élément
   * <audio> en fallback. Web Audio est dispo sur iOS 9 (préfixe webkit) et
   * marche bien plus fiablement que <audio> + WAV statique : pas de chargement
   * réseau, pas de MIME, pas de bug `currentTime=0` avant load.
   */
  var alarmAudio = document.getElementById('family-hub-timer-alarm');
  if (!alarmAudio) {
    alarmAudio = document.createElement('audio');
    alarmAudio.id = 'family-hub-timer-alarm';
    alarmAudio.preload = 'auto';
    alarmAudio.src = 'lib/beep.wav';
    document.body.appendChild(alarmAudio);
  }
  var alarmTimers = {};
  var audioCtx = null;
  var audioCtxFailed = false;

  function debugAlarm(msg) {
    if (window.location.search.indexOf('debug=audio') === -1) return;
    var el = document.getElementById('audio-debug');
    if (!el) {
      el = document.createElement('div');
      el.id = 'audio-debug';
      el.style.cssText = 'position:fixed;bottom:0;left:0;right:0;max-height:80px;overflow:auto;background:rgba(0,0,0,0.85);color:#FAFAF7;font:11px monospace;padding:4px 8px;z-index:9999;line-height:1.3';
      document.body.appendChild(el);
    }
    var time = new Date().toTimeString().slice(0, 8);
    el.innerHTML = '<div>' + time + ' ALARM ' + msg + '</div>' + el.innerHTML;
    while (el.children.length > 12) el.removeChild(el.lastChild);
  }

  /* Hook diagnostic supplémentaire */
  ['playing', 'error', 'ended', 'suspend'].forEach
    ? ['playing', 'error', 'ended', 'suspend'].forEach(function (e) {
        alarmAudio.addEventListener(e, function () {
          var extra = '';
          if (e === 'error' && alarmAudio.error) extra = ' code=' + alarmAudio.error.code;
          debugAlarm('audio:' + e + extra);
        });
      })
    : null;

  /* Crée (ou récupère) l'AudioContext. Doit être appelé depuis un user-gesture
     la première fois sur iOS 9 / Safari pour autoriser la sortie audio. */
  function ensureAudioCtx() {
    if (audioCtx || audioCtxFailed) return audioCtx;
    var Ctor = global.AudioContext || global.webkitAudioContext;
    if (!Ctor) {
      audioCtxFailed = true;
      debugAlarm('no AudioContext support');
      return null;
    }
    try {
      audioCtx = new Ctor();
      debugAlarm('audioCtx created state=' + audioCtx.state);
    } catch (e) {
      audioCtxFailed = true;
      debugAlarm('audioCtx ctor threw: ' + (e.message || e));
      return null;
    }
    return audioCtx;
  }

  /* Joue un beep synthétique. Retourne true si lancé, false sinon. */
  function playWebAudioBeep(freq, durationMs, whenOffsetSec) {
    var ctx = ensureAudioCtx();
    if (!ctx) return false;
    /* iOS 9 / Safari : si le contexte est suspended, resume() depuis user-gesture. */
    if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
      try { ctx.resume(); } catch (e) {}
    }
    try {
      var now = ctx.currentTime + (whenOffsetSec || 0);
      var dur = (durationMs || 250) / 1000;
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq || 880;
      /* ADSR : attack 10ms, hold à 0.6, release 60ms */
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.6, now + 0.01);
      gain.gain.setValueAtTime(0.6, now + dur - 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + dur + 0.05);
      return true;
    } catch (e) {
      debugAlarm('webaudio beep threw: ' + (e.message || e));
      return false;
    }
  }

  /* Fallback : <audio> + beep.wav. */
  function playAudioElementBeep() {
    try {
      alarmAudio.volume = 1;
      try { alarmAudio.currentTime = 0; } catch (e) {}
      var p = alarmAudio.play();
      debugAlarm('audio.play() ' + (typeof p));
      if (p && p['catch']) p['catch'](function (err) {
        debugAlarm('audio rejected: ' + (err && (err.name || err.message)));
      });
      return true;
    } catch (e) {
      debugAlarm('audio threw: ' + (e.message || e));
      return false;
    }
  }

  /* Joue un "double bip" aigu (di-din) — plus reconnaissable qu'un seul ton. */
  function playOneAlarmCycle(whenOffsetSec) {
    var off = whenOffsetSec || 0;
    var okA = playWebAudioBeep(1320, 180, off);
    var okB = playWebAudioBeep(1760, 220, off + 0.22);
    return okA && okB;
  }

  function beepSequence(times) {
    debugAlarm('beepSequence(' + times + ')');
    var n = Math.max(1, times | 0);
    /* Tente Web Audio en premier — beep planifié sur le contexte = pas besoin
       de setTimeout, donc pas de risque de perdre le user-gesture. */
    var ctx = ensureAudioCtx();
    if (ctx) {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        try { ctx.resume(); } catch (e) {}
      }
      var ok = true;
      for (var i = 0; i < n; i++) {
        if (!playOneAlarmCycle(i * 0.95)) { ok = false; break; }
      }
      if (ok) return;
    }
    /* Fallback : <audio> + setTimeout pour les répétitions. */
    playAudioElementBeep();
    var count = 1;
    function step() {
      if (count >= n) return;
      playAudioElementBeep();
      count++;
      setTimeout(step, 700);
    }
    if (n > 1) setTimeout(step, 700);
  }

  /* --- Boucle d'alarme continue --- */
  /* alarmLoop : un seul interval JS qui beepe tant qu'il y a au moins un timer
     en status 'ended' non acquitté. Web Audio peut planifier plusieurs cycles
     d'avance ; on en pousse 2 dans le futur à chaque tick pour absorber les
     micro-jitters de setInterval (et au cas où l'onglet ralentit). */
  var alarmLoopInterval = null;
  var alarmCycleSec = 1.1; /* durée d'un cycle "di-din + silence" */

  function alarmLoopActive() {
    for (var i = 0; i < state.timers.length; i++) {
      if (state.timers[i].status === 'ended') return true;
    }
    return false;
  }

  function alarmLoopTick() {
    if (!alarmLoopActive()) {
      stopAlarmLoop();
      return;
    }
    var ctx = ensureAudioCtx();
    if (ctx) {
      if (ctx.state === 'suspended' && typeof ctx.resume === 'function') {
        try { ctx.resume(); } catch (e) {}
      }
      playOneAlarmCycle(0);
    } else {
      playAudioElementBeep();
    }
  }

  function startAlarmLoop() {
    if (alarmLoopInterval) return;
    debugAlarm('alarm loop START');
    alarmLoopTick();
    alarmLoopInterval = setInterval(alarmLoopTick, alarmCycleSec * 1000);
  }

  function stopAlarmLoop() {
    if (!alarmLoopInterval) return;
    debugAlarm('alarm loop STOP');
    clearInterval(alarmLoopInterval);
    alarmLoopInterval = null;
  }

  /* --- État partagé Firestore --- */
  var state = {
    timers: [], /* tableau triés par endsAt asc */
    db: null,
    householdId: null,
    listenerUnsub: null
  };
  var listeners = [];
  var rerenderInterval = null;

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](state); } catch (e) {}
    }
  }

  function subscribe(fn) {
    listeners.push(fn);
    try { fn(state); } catch (e) {}
    return function unsub() {
      var idx = listeners.indexOf(fn);
      if (idx >= 0) listeners.splice(idx, 1);
    };
  }

  /* --- Logique countdown --- */

  function timestampToMs(ts) {
    if (!ts) return null;
    if (typeof ts === 'number') return ts;
    if (ts.seconds !== undefined) return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
    if (ts.toMillis) return ts.toMillis();
    if (ts instanceof Date) return ts.getTime();
    return null;
  }

  function timerRemainingMs(t) {
    if (t.status === 'paused') {
      return Math.max(0, (t.remainingSeconds || 0) * 1000);
    }
    var end = timestampToMs(t.endsAt);
    if (end === null) return 0;
    return Math.max(0, end - Date.now());
  }

  function timerProgress(t) {
    var total = (t.durationSeconds || 1) * 1000;
    var remaining = timerRemainingMs(t);
    return Math.min(1, Math.max(0, 1 - remaining / total));
  }

  /* --- Actions Firestore --- */

  function colRef() {
    if (!state.db || !state.householdId) return null;
    return state.db.collection('households').doc(state.householdId).collection('timers');
  }

  function startTimer(label, durationSeconds) {
    var col = colRef(); if (!col) return;
    var startedAtMs = Date.now();
    var endsAtMs = startedAtMs + durationSeconds * 1000;
    col.add({
      label: label || (durationSeconds + 's'),
      durationSeconds: durationSeconds,
      startedAt: new Date(startedAtMs),
      endsAt: new Date(endsAtMs),
      status: 'running',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {}, function (err) {
      if (window.console && window.console.error) window.console.error('startTimer', err);
    });
  }

  function pauseTimer(t) {
    var col = colRef(); if (!col) return;
    var remainingSec = Math.ceil(timerRemainingMs(t) / 1000);
    col.doc(t.id).update({
      status: 'paused',
      pausedAt: new Date(),
      remainingSeconds: remainingSec,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function resumeTimer(t) {
    var col = colRef(); if (!col) return;
    var remainingMs = (t.remainingSeconds || 0) * 1000;
    var endsAtMs = Date.now() + remainingMs;
    col.doc(t.id).update({
      status: 'running',
      endsAt: new Date(endsAtMs),
      pausedAt: firebase.firestore.FieldValue.delete(),
      remainingSeconds: firebase.firestore.FieldValue.delete(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function stopTimer(t) {
    var col = colRef(); if (!col) return;
    col.doc(t.id).delete();
  }

  function acknowledgeTimer(t) {
    var col = colRef(); if (!col) return;
    col.doc(t.id).update({
      status: 'acknowledged',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function () {
      /* Auto-cleanup 2 min plus tard pour libérer la liste */
      setTimeout(function () { col.doc(t.id).delete(); }, 120000);
    });
  }

  /* --- Détection des fins de timer (déclenche l'alarme) --- */

  function tick() {
    var anyChange = false;
    var hasEnded = false;
    for (var i = 0; i < state.timers.length; i++) {
      var t = state.timers[i];
      if (t.status === 'running' && timerRemainingMs(t) === 0 && !alarmTimers[t.id]) {
        alarmTimers[t.id] = true;
        var col = colRef();
        if (col) {
          col.doc(t.id).update({
            status: 'ended',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        anyChange = true;
      }
      if (t.status === 'ended') hasEnded = true;
    }
    /* Démarre / arrête la boucle d'alarme selon qu'il reste ou non un timer
       'ended' non acquitté. */
    if (hasEnded) startAlarmLoop();
    else stopAlarmLoop();
    /* Re-render quel que soit le statut (pour mettre à jour les compteurs) */
    notify();
    return anyChange;
  }

  /* --- Initialisation après auth Firebase --- */

  function init(db, householdId) {
    if (state.listenerUnsub) state.listenerUnsub();
    state.db = db;
    state.householdId = householdId;
    var col = colRef(); if (!col) return;

    state.listenerUnsub = col
      .orderBy('endsAt', 'asc')
      .onSnapshot(function (snap) {
        var arr = [];
        snap.forEach(function (d) {
          arr.push(Object.assign({ id: d.id }, d.data()));
        });
        state.timers = arr;
        /* Si le timer qui sonnait a été acquitté/supprimé côté Firestore,
           coupe la boucle d'alarme immédiatement (sans attendre tick). */
        if (alarmLoopInterval && !alarmLoopActive()) stopAlarmLoop();
        notify();
      });

    if (rerenderInterval) clearInterval(rerenderInterval);
    rerenderInterval = setInterval(tick, 1000);
  }

  global.FamilyHubTimers = {
    init: init,
    subscribe: subscribe,
    getState: function () { return state; },
    startTimer: startTimer,
    pauseTimer: pauseTimer,
    resumeTimer: resumeTimer,
    stopTimer: stopTimer,
    acknowledgeTimer: acknowledgeTimer,
    timerRemainingMs: timerRemainingMs,
    timerProgress: timerProgress,
    beepSequence: beepSequence
  };
})(window);
