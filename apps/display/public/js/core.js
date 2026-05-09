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
  var REFRESH_RETRY_DELAYS_MS = [5 * 1000, 30 * 1000, 2 * 60 * 1000]; /* 5s, 30s, 2min */

  var state = {
    db: null,
    functions: null,
    auth: null,
    householdId: null,
    displayId: null,
    cellsByTileId: {},
    tilesById: {},
    snapshotUnsub: null,
    displayConfig: null,
    householdConfig: null,
    householdUnsub: null,
    appliedThemeId: null
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

  /**
   * Tente un refresh du custom token. Si échec : retry avec backoff
   * exponentiel (5s, 30s, 2min). Après 3 échecs : log visible et
   * reload de la page pour forcer un re-bootstrap complet (qui
   * tentera lui-même un fallback exchangeSetupToken si nécessaire).
   */
  function refreshCustomToken(attemptIdx) {
    attemptIdx = attemptIdx || 0;
    var householdId = state.householdId;
    var displayId = state.displayId;
    var authToken = getStored(STORAGE.authToken);
    if (!householdId || !displayId || !authToken) {
      setAuthBadge('error', 'pas d\'authToken');
      return;
    }

    setAuthBadge('refreshing');

    var fn = state.functions.httpsCallable('refreshDisplayToken');
    fn({ householdId: householdId, displayId: displayId, authToken: authToken })
      .then(function (res) {
        var data = res.data || {};
        if (!data.customToken) {
          throw new Error('réponse sans customToken');
        }
        setStored(STORAGE.customToken, data.customToken);
        setStored(STORAGE.customTokenIssuedAt, String(Date.now()));
        return state.auth.signInWithCustomToken(data.customToken);
      })
      .then(function () {
        setAuthBadge('ok');
        if (window.console && window.console.log) {
          window.console.log('[auth] custom token refreshed');
        }
      })
      .catch(function (err) {
        /* Extrait un identifiant compact de l'erreur pour le badge — le
           code Firebase (ex: "unavailable", "deadline-exceeded") est plus
           informatif que le message complet. Fallback sur le message si pas
           de code. Tronqué à 30 chars pour tenir dans le badge. */
        var code = (err && err.code) ? String(err.code) : '';
        var msgRaw = (err && err.message) ? String(err.message) : 'unknown';
        var detail = code ? code : msgRaw.substring(0, 30);
        if (window.console && window.console.warn) {
          window.console.warn('[auth] refresh attempt ' + (attemptIdx + 1) + ' failed', err);
        }
        if (attemptIdx < REFRESH_RETRY_DELAYS_MS.length) {
          setAuthBadge('retrying', 'try ' + (attemptIdx + 2) + ' · ' + detail);
          setTimeout(function () {
            refreshCustomToken(attemptIdx + 1);
          }, REFRESH_RETRY_DELAYS_MS[attemptIdx]);
        } else {
          /* Tous les retries ont échoué. Au lieu d'afficher "Reconfigurez le
             display" qui bloque l'utilisateur, on tente un reload de la page
             dans 30s — ça remet au tout début, refait un signin avec le
             customToken stocké (qui peut encore être valide), etc. */
          setAuthBadge('error', detail + ' · reload 30s');
          setTimeout(function () {
            var url = window.location.pathname + '?reload=' + Date.now();
            window.location.replace(url);
          }, 30 * 1000);
        }
      });
  }

  /**
   * iPad PWA standalone : quand l'iPad sort de veille (visibilitychange →
   * visible), si le customToken stocké approche de l'expiration, force un
   * refresh immédiat plutôt que d'attendre le tick setInterval. Ça évite
   * le scénario "timer fire pendant que le WiFi iPad n'est pas encore
   * réveillé après le sleep" qui causait des cycles de retry à répétition.
   */
  function setupVisibilityRefresh() {
    if (!document || !document.addEventListener) return;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) return;
      if (!state.auth || !state.householdId || !state.functions) return;
      var issuedAtRaw = getStored(STORAGE.customTokenIssuedAt);
      var issuedAt = issuedAtRaw ? parseInt(issuedAtRaw, 10) : 0;
      if (!issuedAt) return;
      var ageMs = Date.now() - issuedAt;
      /* customToken Firebase = 1h de validité. Si > 40min on refresh
         proactivement (10min de marge avant expiration). */
      if (ageMs > 40 * 60 * 1000) {
        if (window.console && window.console.log) {
          window.console.log('[auth] visibilitychange wake : token age ' + Math.round(ageMs / 60000) + 'min, refresh');
        }
        refreshCustomToken(0);
      }
    });
  }

  function startTokenRefreshLoop() {
    setInterval(function () { refreshCustomToken(0); }, CUSTOM_TOKEN_REFRESH_MS);
  }

  /**
   * Affiche un petit badge en haut à droite de l'écran avec l'état auth.
   * Visible uniquement quand pas "ok" — pour ne pas polluer le grid normal.
   * states: 'ok' | 'refreshing' | 'retrying' | 'error'
   */
  function setAuthBadge(stateName, detail) {
    var el = document.getElementById('fh-auth-badge');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fh-auth-badge';
      el.style.cssText =
        'position:fixed; top:6px; right:6px; z-index:9990; ' +
        'padding:4px 10px; border-radius:4px; font-size:10px; ' +
        'letter-spacing:0.1em; text-transform:uppercase; font-weight:600; ' +
        'background:rgba(0,0,0,0.55); color:#fff; ' +
        'transition:opacity 0.4s;';
      document.body.appendChild(el);
    }
    if (stateName === 'ok') {
      /* fade out après 1.5s puis hide */
      el.style.background = 'rgba(125,159,118,0.85)';
      el.innerHTML = '✓ connecté';
      setTimeout(function () {
        if (el && el.parentNode) {
          el.style.opacity = '0';
          setTimeout(function () {
            if (el && el.parentNode) el.parentNode.removeChild(el);
          }, 500);
        }
      }, 1500);
      return;
    }
    el.style.opacity = '1';
    if (stateName === 'refreshing') {
      el.style.background = 'rgba(217,160,91,0.85)';
      el.innerHTML = '↻ refresh auth';
    } else if (stateName === 'retrying') {
      el.style.background = 'rgba(217,160,91,0.85)';
      el.innerHTML = '↻ retry · ' + (detail || '');
    } else if (stateName === 'error') {
      el.style.background = 'rgba(200,85,61,0.90)';
      el.innerHTML = '⚠ ' + (detail || 'auth perdue');
    }
  }

  /**
   * Nettoie l'URL au boot : retire les query params qui ne servent qu'à
   * forcer le cache-bust (?reload=, ?ts=) ou les tokens orphelins
   * (?token=, ?household=, ?display=). Sans ça, "Add to Home Screen"
   * sur iOS épingle l'URL avec ces params et l'icône peut pointer vers
   * un état temporaire (token expiré → 404).
   */
  function cleanUrl() {
    if (!window.history || !window.history.replaceState) return;
    var search = window.location.search || '';
    if (!search) return;
    var keepParams = []; /* aucun query param utile pour /display/ — on vide tout */
    /* Si dans le futur on veut garder ?debug=audio par exemple : ajouter ici */
    var keepDebug = '';
    if (search.indexOf('debug=audio') !== -1) keepDebug = '?debug=audio';
    var clean = window.location.pathname + keepDebug + window.location.hash;
    try {
      window.history.replaceState(null, '', clean);
    } catch (e) { /* iOS 9 sometimes throws */ }
  }

  function setupScrollLock() {
    document.addEventListener('touchmove', function (e) {
      var t = e.target;
      while (t && t !== document.body && t.nodeType === 1) {
        if (t.getAttribute && t.getAttribute('data-scroll-lock') === '1') {
          var atTop = t.scrollTop <= 0;
          var atBottom = (t.scrollTop + t.clientHeight) >= t.scrollHeight;
          /* Update _lastY EN PREMIER pour qu'il soit valide même si on
             early-return dans le cas "scroller vide" en dessous */
          var newY = (e.touches && e.touches[0]) ? e.touches[0].clientY : null;
          var prevY = t._lastY;
          if (newY != null) t._lastY = newY;
          if (atTop || atBottom) {
            if (atTop && atBottom) {
              /* contenu plus court que le scroller : aucun scroll possible, on bloque tout */
              e.preventDefault();
              return;
            }
            if (atTop) {
              /* Au top, on ne bloque que les swipes vers le bas (rubber-band haut) */
              if (newY != null && prevY != null && newY > prevY) {
                e.preventDefault();
              }
            }
            if (atBottom) {
              /* Au bottom, on ne bloque que les swipes vers le haut (rubber-band bas) */
              if (newY != null && prevY != null && newY < prevY) {
                e.preventDefault();
              }
            }
          }
          return;
        }
        t = t.parentNode;
      }
    }, false);

    /* Reset _lastY au touchstart pour ne pas comparer entre 2 gestes distincts */
    document.addEventListener('touchstart', function (e) {
      var t = e.target;
      while (t && t !== document.body && t.nodeType === 1) {
        if (t.getAttribute && t.getAttribute('data-scroll-lock') === '1') {
          if (e.touches && e.touches[0]) t._lastY = e.touches[0].clientY;
          return;
        }
        t = t.parentNode;
      }
    }, false);
  }

  /* Applique un thème sur <html>. Retire d'abord toute classe theme-*
     présente. Vide / 'caractere' = thème par défaut (pas de classe). */
  function applyDisplayTheme(themeId) {
    var html = document.documentElement;
    var classes = (html.className || '').split(/\s+/);
    var kept = [];
    for (var i = 0; i < classes.length; i++) {
      var c = classes[i];
      if (!c) continue;
      if (c.indexOf('theme-') === 0) continue;
      kept.push(c);
    }
    if (themeId && themeId !== 'caractere') {
      kept.push('theme-' + themeId);
    }
    html.className = kept.join(' ');
    state.appliedThemeId = themeId || 'caractere';
  }
  window.FamilyHubApplyTheme = applyDisplayTheme;

  function loadDisplayAndTiles() {
    var hid = state.householdId;
    var did = state.displayId;
    var householdRef = state.db.collection('households').doc(hid);
    var displayRef = householdRef.collection('displays').doc(did);
    var tilesRef = householdRef.collection('tiles');

    setStatus('Chargement de la configuration…');
    return householdRef.get().then(function (hSnap) {
      if (hSnap.exists) {
        var hData = hSnap.data() || {};
        state.householdConfig = hData;
        var themeId = hData.parametres && hData.parametres.themeId;
        applyDisplayTheme(themeId);
      }
      return displayRef.get();
    }).then(function (snap) {
      if (!snap.exists) throw new Error('Display introuvable');
      state.displayConfig = snap.data();
      return tilesRef.get();
    }).then(function (tilesSnap) {
      var byId = {};
      tilesSnap.forEach(function (doc) { byId[doc.id] = doc.data(); });
      state.tilesById = byId;
      renderInitialGrid();
      attachSnapshotListener(displayRef);
      attachDisplayConfigListener(displayRef);
      attachHouseholdListener(householdRef);
      /* Démarre le singleton timers une fois auth + db prêts */
      if (window.FamilyHubTimers) {
        window.FamilyHubTimers.init(state.db, hid);
      }
    });
  }

  /* Listener live sur le doc household — détecte changement de thème
     pushé depuis le hub web. Re-applique sans reload. */
  function attachHouseholdListener(householdRef) {
    if (state.householdUnsub) state.householdUnsub();
    state.householdUnsub = householdRef.onSnapshot(function (snap) {
      if (!snap.exists) return;
      var data = snap.data() || {};
      state.householdConfig = data;
      var newThemeId = (data.parametres && data.parametres.themeId) || 'caractere';
      if (newThemeId !== state.appliedThemeId) {
        applyDisplayTheme(newThemeId);
      }
    }, function (err) {
      if (window.console && window.console.error) window.console.error('household listener', err);
    });
  }

  /**
   * Watch le doc display pour détecter les changements de layout.
   * Si le layout change (ajout/retrait/déplacement de tuile), on force
   * un location.reload() pour re-fetcher index.html (au cas où il
   * référence de nouveaux modules JS de tuiles). Sans ça, l'iPad reste
   * coincé avec les anciens script tags et affiche "Type inconnu" sur
   * les nouvelles tuiles.
   */
  function attachDisplayConfigListener(displayRef) {
    if (state.displayConfigUnsub) { state.displayConfigUnsub(); }
    /* Skip le 1er appel (data déjà chargée par loadDisplayAndTiles). */
    var firstCallback = true;
    state.displayConfigUnsub = displayRef.onSnapshot(function (snap) {
      if (firstCallback) { firstCallback = false; return; }
      if (!snap.exists) return;
      var newCfg = snap.data() || {};
      var oldLayoutKey = layoutKey(state.displayConfig && state.displayConfig.layout);
      var newLayoutKey = layoutKey(newCfg.layout);
      if (oldLayoutKey !== newLayoutKey) {
        if (window.console && window.console.log) {
          window.console.log('[display] layout changed, reloading…');
        }
        /* Cache buster sur le reload pour forcer iOS 9 à re-fetch index.html */
        var url = window.location.pathname + '?reload=' + Date.now();
        window.location.replace(url);
      }
    }, function (err) {
      if (window.console && window.console.error) window.console.error('display listener', err);
    });
  }

  function layoutKey(layout) {
    if (!layout || !layout.length) return '[]';
    var parts = [];
    for (var i = 0; i < layout.length; i++) {
      var e = layout[i] || {};
      var p = e.position || {};
      parts.push(e.tileId + ':' + p.col + ',' + p.row + ',' + p.w + ',' + p.h);
    }
    parts.sort();
    return parts.join('|');
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

  /* Permet aux modules de tuiles qui n'utilisent pas le snapshot de lire
     directement Firestore. Renvoie null tant que l'auth n'est pas faite. */
  window.FamilyHubGetDb = function () { return state.db; };
  window.FamilyHubGetHouseholdId = function () { return state.householdId; };

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
    /* 1. Nettoie l'URL des query params parasites (?reload=, ?token=, etc.).
       Sans ça, "Add to Home Screen" sur iOS épingle l'URL avec ces params
       et l'icône peut pointer vers un état temporaire (token expiré). */
    cleanUrl();

    setupScrollLock();

    setupAudioUnlock();

    setupVisibilityRefresh();

    if (window.FamilyHubBrightness) {
      window.FamilyHubBrightness.init();
    }

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

    /* 2. Persistence LOCAL : Firebase Auth conserve la session à travers
       les reloads via son refresh token interne. Notre customToken stocké
       devient juste un fallback de bootstrap. La session reste vivante
       même si le customToken local expire entre 2 reloads. */
    var persistencePromise;
    try {
      persistencePromise = state.auth.setPersistence(
        firebase.auth.Auth.Persistence.LOCAL
      );
    } catch (e) {
      persistencePromise = Promise.resolve();
    }

    /* 3. Listener global onAuthStateChanged : si Firebase nous notifie
       qu'on n'est plus auth (session expirée silencieusement, refresh
       token révoqué…), on déclenche un refresh au lieu d'attendre la
       prochaine opération qui échouerait. */
    state.auth.onAuthStateChanged(function (user) {
      if (!user && state.householdId && state.displayId) {
        if (window.console && window.console.warn) {
          window.console.warn('[auth] session lost, attempting refresh');
        }
        refreshCustomToken(0);
      }
    });

    setStatus('Authentification…');
    persistencePromise
      .then(function () {
        /* Si l'utilisateur est déjà auth via la persistance Firebase
           (cas reload après session vivante) — pas besoin de re-signin. */
        if (state.auth.currentUser) {
          return null;
        }
        return state.auth.signInWithCustomToken(customToken);
      })
      .then(function () {
        setAuthBadge('ok');
        return loadDisplayAndTiles();
      })
      .then(function () { startTokenRefreshLoop(); })
      .catch(function (err) {
        /* Custom token expiré ou invalide → tente refresh complet avec
           authToken local. Le nouveau retry-x3 + reload-final intégré dans
           refreshCustomToken garantit qu'on ne reste pas bloqué. */
        if (window.console && window.console.warn) {
          window.console.warn('[auth] initial signin failed, refreshing', err);
        }
        setAuthBadge('refreshing');
        refreshCustomToken(0);
        /* Tente loadDisplayAndTiles dans 3s — si le refresh a marché entre
           temps, currentUser sera rempli et on pourra continuer. */
        setTimeout(function () {
          if (state.auth.currentUser) {
            loadDisplayAndTiles().then(function () { startTokenRefreshLoop(); });
          }
          /* Sinon : refreshCustomToken poursuit ses retries en arrière-plan
             et finira par reload la page si tout échoue. */
        }, 3000);
      });
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot);
  }
})();
