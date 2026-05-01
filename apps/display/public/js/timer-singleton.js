/* timer-singleton.js — état partagé des timers (synchro Firestore) + alarme audio.
   Plusieurs timers simultanés possibles (fin pâtes / fin œufs / etc.). ES5 iOS 9 OK. */
(function (global) {
  'use strict';

  /**
   * Beep court (sinusoïdale 880Hz, 250ms, fade in/out, 8kHz mono 16-bit) servi en static.
   * Élément <audio> pré-créé dans index.html avec id "family-hub-timer-alarm".
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
  var alarmUnlocked = false;

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

  /* iOS 9 : pas d'auto-unlock global (collision avec les play volontaires).
     L'unlock se fait au premier appel à beepSequence() depuis un user-gesture. */

  /* Hook diagnostic supplémentaire */
  ['playing', 'error', 'ended', 'suspend'].forEach
    ? ['playing', 'error', 'ended', 'suspend'].forEach(function (e) {
        alarmAudio.addEventListener(e, function () {
          var extra = '';
          if (e === 'error' && alarmAudio.error) extra = ' code=' + alarmAudio.error.code;
          debugAlarm(e + extra);
        });
      })
    : null;

  function beepSequence(times) {
    debugAlarm('beepSequence(' + times + ')');
    /* Premier appel : on en profite pour "warm up" iOS 9. play() sync = unlock. */
    try {
      alarmAudio.volume = 1;
      alarmAudio.currentTime = 0;
      var p = alarmAudio.play();
      debugAlarm('first play() ' + (typeof p));
      if (p && p['catch']) p['catch'](function (err) {
        debugAlarm('first play rejected: ' + (err && (err.name || err.message)));
      });
      alarmUnlocked = true;
    } catch (e) {
      debugAlarm('first play threw: ' + (e.message || e));
    }

    /* Bips suivants programmés via setTimeout — iOS 9 les accepte une fois unlock. */
    var count = 1;
    function step() {
      if (count >= times) return;
      try {
        alarmAudio.currentTime = 0;
        var p2 = alarmAudio.play();
        if (p2 && p2['catch']) p2['catch'](function () {});
      } catch (e) {
        debugAlarm('beep step threw: ' + (e.message || e));
      }
      count++;
      setTimeout(step, 700);
    }
    setTimeout(step, 700);
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
    var now = Date.now();
    var anyChange = false;
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
        beepSequence(5);
        anyChange = true;
      }
    }
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
