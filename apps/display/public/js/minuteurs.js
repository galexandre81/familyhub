/* Minuteurs de l'iPad — fonctions PURES (ES5 strict, Safari 9).

   Chargé par index.html avant timer-singleton.js : expose
   window.FamilyHubMinuteurs. Exporté aussi en CommonJS (module.exports) pour
   le test Node packages/design/src/displayMinuteurs.test.ts, qui vérifie la
   parité avec apps/hub/src/lib/minuteurs.ts (libelleParDefaut, ajoutUneMinute) :
   le hub et l'iPad écrivent les mêmes documents households/{hid}/timers/{id}. */
(function (root) {
  'use strict';

  function deux(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  /* Date, Timestamp Firestore (toMillis), { seconds, nanoseconds } ou nombre → ms. */
  function versMs(ts) {
    if (ts === null || ts === undefined) return null;
    if (typeof ts === 'number') return isFinite(ts) ? ts : null;
    if (ts instanceof Date) {
      var v = ts.getTime();
      return v !== v ? null : v;
    }
    if (typeof ts === 'object') {
      if (typeof ts.toMillis === 'function') return ts.toMillis();
      if (typeof ts.getTime === 'function') return ts.getTime();
      if (typeof ts.seconds === 'number') return ts.seconds * 1000 + Math.floor((ts.nanoseconds || 0) / 1e6);
    }
    return null;
  }

  /* Nom d'un minuteur lancé sans nom : « 5 min », « 1 min 30 », « 1 h 05 », « 45 s ». */
  function libelleMinuteur(secondes) {
    var total = Math.max(0, Math.round(secondes));
    if (total < 60) return total + ' s';
    var m;
    if (total >= 3600) {
      var h = Math.floor(total / 3600);
      m = Math.floor((total % 3600) / 60);
      return m === 0 ? h + ' h' : h + ' h ' + deux(m);
    }
    m = Math.floor(total / 60);
    var s = total % 60;
    return s === 0 ? m + ' min' : m + ' min ' + deux(s);
  }

  /* Champs à écrire pour « +1 min » (même règle que ajoutUneMinute du hub) :
     en pause → remainingSeconds + 60 ; sinon fin + 60 s (à partir de
     maintenant si déjà passée) et status 'running' (relance un minuteur
     terminé). durationSeconds + 60 dans tous les cas. */
  function patchUneMinute(t, nowMs) {
    var durationSeconds = (t.durationSeconds || 0) + 60;
    if (t.status === 'paused') {
      return { remainingSeconds: (t.remainingSeconds || 0) + 60, durationSeconds: durationSeconds };
    }
    var fin = versMs(t.endsAt);
    var base = Math.max(fin === null ? nowMs : fin, nowMs);
    return { status: 'running', endsAtMs: base + 60000, durationSeconds: durationSeconds };
  }

  /* Sonne (son + bandeau) sur CET appareil : seulement celui qui a lancé le
     minuteur (champ appareil) ; un ancien minuteur sans appareil sonne partout.
     Même règle que sonneIci du hub. Fini = 'ended', ou 'running' arrivé à zéro. */
  function sonneIci(t, nowMs, appareil) {
    if (!t) return false;
    var fini = t.status === 'ended';
    if (!fini && t.status === 'running') {
      var fin = versMs(t.endsAt);
      fini = fin !== null && nowMs >= fin;
    }
    return fini && (!t.appareil || t.appareil === appareil);
  }

  var api = {
    versMs: versMs,
    sonneIci: sonneIci,
    libelleMinuteur: libelleMinuteur,
    patchUneMinute: patchUneMinute
  };

  if (root) root.FamilyHubMinuteurs = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
