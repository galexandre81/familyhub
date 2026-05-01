/* core.js — boot du display, auth, listeners Firestore. ES5 strict. */
(function () {
  'use strict';

  var STORAGE = {
    householdId: 'familyHub.householdId',
    displayId: 'familyHub.displayId',
    authToken: 'familyHub.authToken',
    customToken: 'familyHub.customToken',
    customTokenIssuedAt: 'familyHub.customTokenIssuedAt'
  };

  var CUSTOM_TOKEN_REFRESH_MS = 50 * 60 * 1000; /* 50 min — Firebase custom tokens valent 1h */

  var state = {
    db: null,
    functions: null,
    auth: null,
    householdId: null,
    displayId: null,
    cellsByTileId: {},
    tilesById: {},
    snapshotUnsub: null,
    displayConfig: null
  };

  function setStatus(text) {
    var el = document.getElementById('boot-status');
    if (el) el.innerHTML = text;
  }

  function showError(text) {
    var grid = document.getElementById('grid');
    var boot = document.getElementById('boot-message');
    var overlay = document.getElementById('error-overlay');
    var t = document.getElementById('error-text');
    if (grid) grid.style.display = 'none';
    if (boot) boot.style.display = 'none';
    if (t) t.innerHTML = text;
    if (overlay) overlay.style.display = 'flex';
    if (window.console && window.console.error) {
      window.console.error('Family Hub display error', text);
    }
  }

  function showGrid() {
    var grid = document.getElementById('grid');
    var boot = document.getElementById('boot-message');
    if (boot) boot.style.display = 'none';
    if (grid) grid.style.display = 'flex';
  }

  function getStored(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function setStored(key, val) {
    try { localStorage.setItem(key, val); } catch (e) { /* noop */ }
  }

  /* iOS 9 audio unlock : un tap silencieux sur la première interaction
     pour que <audio>.play() programmatique fonctionne ensuite (radio + timer). */
  function setupAudioUnlock() {
    var unlocked = false;
    function unlock() {
      if (unlocked) return;
      unlocked = true;
      try {
        var a = document.createElement('audio');
        a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
        var p = a.play();
        if (p && typeof p.then === 'function') { p.then(function(){}, function(){}); }
      } catch (e) { /* noop */ }
      document.removeEventListener('touchstart', unlock, true);
      document.removeEventListener('click', unlock, true);
    }
    document.addEventListener('touchstart', unlock, true);
    document.addEventListener('click', unlock, true);
  }

  function refreshCustomToken() {
    var householdId = state.householdId;
    var displayId = state.displayId;
    var authToken = getStored(STORAGE.authToken);
    if (!householdId || !displayId || !authToken) return;

    var fn = state.functions.httpsCallable('refreshDisplayToken');
    fn({ householdId: householdId, displayId: displayId, authToken: authToken })
      .then(function (res) {
        var data = res.data || {};
        if (data.customToken) {
          setStored(STORAGE.customToken, data.customToken);
          setStored(STORAGE.customTokenIssuedAt, String(Date.now()));
          state.auth.signInWithCustomToken(data.customToken).then(function () {}, function () {});
        }
      })
      .catch(function () { /* silencieux : on retentera dans 50 min */ });
  }

  function startTokenRefreshLoop() {
    setInterval(refreshCustomToken, CUSTOM_TOKEN_REFRESH_MS);
  }

  function loadDisplayAndTiles() {
    var hid = state.householdId;
    var did = state.displayId;
    var displayRef = state.db.collection('households').doc(hid).collection('displays').doc(did);
    var tilesRef = state.db.collection('households').doc(hid).collection('tiles');

    setStatus('Chargement de la configuration…');
    return displayRef.get().then(function (snap) {
      if (!snap.exists) throw new Error('Display introuvable');
      state.displayConfig = snap.data();
      return tilesRef.get();
    }).then(function (tilesSnap) {
      var byId = {};
      tilesSnap.forEach(function (doc) { byId[doc.id] = doc.data(); });
      state.tilesById = byId;
      renderInitialGrid();
      attachSnapshotListener(displayRef);
      /* Démarre le singleton timers une fois auth + db prêts */
      if (window.FamilyHubTimers) {
        window.FamilyHubTimers.init(state.db, hid);
      }
    });
  }

  function renderInitialGrid() {
    var grid = document.getElementById('grid');
    if (!grid || !state.displayConfig) return;
    var cfg = state.displayConfig;
    var cells = window.FamilyHubRender.buildGrid(grid, cfg.gridConfig, cfg.layout || [], state.tilesById);
    state.cellsByTileId = cells;
    showGrid();

    /* Tuiles client-only (clock notamment) : rendu immédiat sans data du snapshot */
    for (var tileId in cells) {
      if (!cells.hasOwnProperty(tileId)) continue;
      var tile = state.tilesById[tileId];
      if (!tile) continue;
      window.FamilyHubRender.renderTile(tile.type, cells[tileId], {}, tile.config);
    }
  }

  function attachSnapshotListener(displayRef) {
    if (state.snapshotUnsub) { state.snapshotUnsub(); }
    var snapshotDoc = displayRef.collection('snapshot').doc('current');
    state.snapshotUnsub = snapshotDoc.onSnapshot(function (snap) {
      if (!snap.exists) return;
      var data = snap.data() || {};
      var tiles = data.tiles || {};
      state.lastSnapshotTiles = tiles;
      for (var tileId in tiles) {
        if (!tiles.hasOwnProperty(tileId)) continue;
        var cell = state.cellsByTileId[tileId];
        var tile = state.tilesById[tileId];
        if (!cell || !tile) continue;
        var entry = tiles[tileId] || {};
        window.FamilyHubRender.renderTile(tile.type, cell, entry.data || {}, tile.config);
      }
    }, function (err) {
      if (window.console && window.console.error) window.console.error('snapshot listener', err);
    });
  }

  /* Permet à render.js de récupérer la dernière data d'un tile pour l'expand. */
  window.FamilyHubGetTileSnapshot = function (tileId) {
    var entry = state.lastSnapshotTiles && state.lastSnapshotTiles[tileId];
    return entry ? entry.data : null;
  };
  /* Lecture courante de la config (suit les updates Firestore live via tilesById). */
  window.FamilyHubGetTileConfig = function (tileId) {
    var t = state.tilesById[tileId];
    return t ? t.config : null;
  };
  /* Patch partiel sur tile.config (utilisé par weather expand pour basculer la ville sélectionnée). */
  window.FamilyHubUpdateTileConfig = function (tileId, patch) {
    if (!tileId || !patch) return;
    if (!state.householdId) return;
    var ref = state.db.collection('households').doc(state.householdId)
      .collection('tiles').doc(tileId);
    var updates = {};
    for (var k in patch) {
      if (patch.hasOwnProperty(k)) updates['config.' + k] = patch[k];
    }
    updates['updatedAt'] = firebase.firestore.FieldValue.serverTimestamp();
    ref.update(updates).then(function () {
      /* Mise à jour locale immédiate pour réactivité */
      var t = state.tilesById[tileId];
      if (t && t.config) {
        for (var k2 in patch) {
          if (patch.hasOwnProperty(k2)) t.config[k2] = patch[k2];
        }
      }
      /* Re-render la cell avec la nouvelle config */
      var cell = state.cellsByTileId[tileId];
      if (cell && t) {
        var snapshotData = window.FamilyHubGetTileSnapshot(tileId);
        window.FamilyHubRender.renderTile(t.type, cell, snapshotData || {}, t.config);
      }
    }, function (err) {
      if (window.console && window.console.error) window.console.error('updateTileConfig failed', err);
    });
  };

  function boot() {
    setupAudioUnlock();

    if (!window.firebase || !window.__FIREBASE_CONFIG__) {
      showError('Firebase SDK ou configuration manquante.');
      return;
    }

    var householdId = getStored(STORAGE.householdId);
    var displayId = getStored(STORAGE.displayId);
    var customToken = getStored(STORAGE.customToken);

    if (!householdId || !displayId || !customToken) {
      window.location.href = '/display/setup.html';
      return;
    }

    state.householdId = householdId;
    state.displayId = displayId;

    firebase.initializeApp(window.__FIREBASE_CONFIG__);
    state.auth = firebase.auth();
    state.db = firebase.firestore();
    state.functions = firebase.app().functions('europe-west1');

    setStatus('Authentification…');
    state.auth.signInWithCustomToken(customToken)
      .then(function () { return loadDisplayAndTiles(); })
      .then(function () { startTokenRefreshLoop(); })
      .catch(function (err) {
        /* Custom token probablement expiré → on retente avec authToken */
        if (window.console && window.console.warn) window.console.warn('signin failed, refreshing', err);
        refreshCustomToken();
        setTimeout(function () {
          var fresh = getStored(STORAGE.customToken);
          if (!fresh) { showError('Authentification échouée. Reconfigurez le display.'); return; }
          state.auth.signInWithCustomToken(fresh)
            .then(function () { return loadDisplayAndTiles(); })
            .then(function () { startTokenRefreshLoop(); })
            .catch(function (e2) {
              showError('Authentification impossible : ' + (e2.message || 'inconnue'));
            });
        }, 2000);
      });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }
})();
