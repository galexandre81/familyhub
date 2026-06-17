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

  /* Guard contre les refresh concurrents. Trois sources peuvent firer
     refreshCustomToken(0) en parallèle : setInterval 50min,
     visibilitychange, onAuthStateChanged(null). Sans guard, deux
     signInWithCustomToken concurrents → la 2e invalide la 1ère →
     onAuthStateChanged(null) → encore un refresh = cascade. Le flag
     reste à true pendant TOUTE la chaîne (incluant retries internes)
     et n'est reset qu'à la résolution finale. */
  var refreshInFlight = false;

  /* Devient true dès que loadDisplayAndTiles() a réussi AU MOINS une fois.
     Sert à éviter le "reload spiral" : si l'iPad perd le réseau après un
     boot réussi, on garde le dernier grid affiché et on ne fait PAS de
     hard reload sur échec d'auth — on retente silencieusement. Le hard
     reload n'est conservé que pour le cas "le tout premier load n'a
     jamais abouti" (boot offline pur). */
  var hasLoadedOnce = false;

  /* Guard pour ne démarrer la boucle de refresh token qu'une seule fois.
     startTokenRefreshLoop() peut être appelé depuis 2 chemins (succès du
     1er signin, ET le fallback dans le catch) → sans guard, 2 setInterval. */
  var tokenRefreshLoopStarted = false;

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
    appliedThemeId: null,
    /* Indicateur fraîcheur / hors-ligne (kiosk 24/7) */
    snapshotGeneratedAtMs: 0,    /* age de référence du dernier snapshot reçu (ms epoch) */
    snapshotTtlSeconds: 0,       /* ttlSeconds top-level du snapshot, sert au seuil */
    staleCheckInterval: null,    /* id du setInterval de re-vérification (à nettoyer) */
    isOffline: false,            /* dernier état connu navigator/online-offline */
    onlineHandler: null,         /* ref des listeners window pour cleanup */
    offlineHandler: null
  };

  /* Seuil par défaut si le snapshot n'expose pas de ttlSeconds exploitable.
     2h en secondes — large, pour ne pas crier au stale sur un simple retard. */
  var STALE_FALLBACK_SECONDS = 2 * 60 * 60;

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
    /* Guard concurrent refreshes — uniquement au premier appel (attempt 0).
       Les retries internes (attempt >= 1) sont chaînés depuis le catch
       du précédent, le flag est déjà à true. */
    if (attemptIdx === 0) {
      if (refreshInFlight) {
        if (window.console && window.console.log) {
          window.console.log('[auth] refresh already in flight, skip');
        }
        return;
      }
      refreshInFlight = true;
    }

    var householdId = state.householdId;
    var displayId = state.displayId;
    var authToken = getStored(STORAGE.authToken);
    if (!householdId || !displayId || !authToken) {
      setAuthBadge('error', 'pas d\'authToken');
      refreshInFlight = false;
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
        refreshInFlight = false;
        if (window.console && window.console.log) {
          window.console.log('[auth] custom token refreshed');
        }
      })
      .catch(function (err) {
        /* Affiche le CODE Firebase si dispo (ex: "unavailable",
           "deadline-exceeded") — sinon "auth-fail" générique. On NE met
           PAS err.message car il peut contenir des arguments échoés
           (ex: un householdId invalide) — l'iPad est dans la cuisine,
           visible à tous, donc pas de leak côté UI. Le full err est loggé
           console.warn pour debug par devtools si nécessaire. */
        var code = (err && err.code) ? String(err.code) : '';
        var detail = code ? code : 'auth-fail';
        if (window.console && window.console.warn) {
          window.console.warn('[auth] refresh attempt ' + (attemptIdx + 1) + ' failed', err);
        }
        if (attemptIdx < REFRESH_RETRY_DELAYS_MS.length) {
          /* Retry programmé — on garde refreshInFlight = true pendant la
             chaîne pour que les triggers concurrents (visibilitychange,
             setInterval, onAuthStateChanged) skipent silencieusement. */
          setAuthBadge('retrying', 'try ' + (attemptIdx + 2) + ' · ' + detail);
          setTimeout(function () {
            refreshCustomToken(attemptIdx + 1);
          }, REFRESH_RETRY_DELAYS_MS[attemptIdx]);
        } else {
          /* Tous les retries ont échoué. */
          if (hasLoadedOnce) {
            /* On a déjà un grid valide affiché : NE PAS hard-reload (ça
               viderait l'écran et, hors-ligne, repartirait dans un cycle de
               reloads). On garde le dernier bon grid, on met le badge en
               "reconnexion…" et on relance des tentatives silencieuses
               espacées. refreshInFlight est remis à false pour autoriser un
               nouveau cycle. */
            setAuthBadge('error', detail + ' · reconnexion…');
            refreshInFlight = false;
            setTimeout(function () {
              refreshCustomToken(0);
            }, 60 * 1000);
          } else {
            /* Le tout premier load n'a jamais abouti (boot offline pur) :
               reload de la page dans 30s pour re-bootstrap propre. Le reload
               reset le module state donc refreshInFlight sera réinitialisé. */
            setAuthBadge('error', detail + ' · reload 30s');
            setTimeout(function () {
              var url = window.location.pathname + '?reload=' + Date.now();
              window.location.replace(url);
            }, 30 * 1000);
          }
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
    /* Guard : ne démarrer qu'une fois (appelé depuis le succès du 1er
       signin ET depuis le fallback du catch). */
    if (tokenRefreshLoopStarted) return;
    tokenRefreshLoopStarted = true;
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

  /* ----- Indicateur fraîcheur / hors-ligne (kiosk) ---------------------- */

  /**
   * Crée (lazy) et renvoie le noeud du badge de statut, distinct du badge
   * auth (#fh-auth-badge en haut à droite). Celui-ci vit en bas à gauche,
   * stylé via la classe .fh-status-badge dans styles.css.
   */
  function getStatusBadge() {
    var el = document.getElementById('fh-status-badge');
    if (!el) {
      el = document.createElement('div');
      el.id = 'fh-status-badge';
      el.className = 'fh-status-badge fh-status-badge--hidden';
      if (document.body) document.body.appendChild(el);
    }
    return el;
  }

  function hideStatusBadge() {
    var el = getStatusBadge();
    if (el && el.className.indexOf('fh-status-badge--hidden') === -1) {
      el.className = 'fh-status-badge fh-status-badge--hidden';
    }
  }

  /**
   * Affiche le badge avec un texte donné. variant: '' (stale) | 'offline'.
   */
  function showStatusBadge(text, variant) {
    var el = getStatusBadge();
    if (!el) return;
    var cls = 'fh-status-badge';
    if (variant === 'offline') cls += ' fh-status-badge--offline';
    el.className = cls;
    el.innerHTML = text;
  }

  /* Formate un ms epoch en "HH:MM" local, robuste sur Safari 9. */
  function formatHHMM(ms) {
    var d = new Date(ms);
    var h = d.getHours();
    var m = d.getMinutes();
    return (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m);
  }

  /**
   * Re-calcule l'état fraîcheur du dernier snapshot et met à jour le badge.
   * Hors-ligne a priorité (badge "Hors ligne"). Sinon, si l'âge du snapshot
   * dépasse le seuil, on montre "Données du HH:MM". Sinon on masque.
   *
   * Seuil = max(ttlSeconds du snapshot, fallback 2h) * 2. Le *2 laisse une
   * marge généreuse : un snapshot d'1h de TTL doit avoir >2h avant d'être
   * signalé périmé, pour absorber un cron en retard sans fausse alerte.
   */
  function evaluateStaleness() {
    /* L'état offline est géré par updateOfflineState ; ne pas l'écraser. */
    if (state.isOffline) return;
    if (!state.snapshotGeneratedAtMs) { hideStatusBadge(); return; }
    var ttl = state.snapshotTtlSeconds > 0
      ? state.snapshotTtlSeconds
      : STALE_FALLBACK_SECONDS;
    var thresholdMs = Math.max(ttl, STALE_FALLBACK_SECONDS) * 2 * 1000;
    var ageMs = Date.now() - state.snapshotGeneratedAtMs;
    if (ageMs > thresholdMs) {
      showStatusBadge('Données du ' + formatHHMM(state.snapshotGeneratedAtMs), '');
    } else {
      hideStatusBadge();
    }
  }

  /* Met à jour l'état hors-ligne et le badge en conséquence. */
  function updateOfflineState(offline) {
    state.isOffline = !!offline;
    if (state.isOffline) {
      showStatusBadge('Hors ligne', 'offline');
    } else {
      /* Retour en ligne : on retombe sur l'évaluation de fraîcheur
         (qui masquera le badge si tout est frais). */
      evaluateStaleness();
    }
  }

  /**
   * Démarre la surveillance fraîcheur/offline :
   *  - re-évaluation périodique (toutes les 60s) de la fraîcheur du snapshot ;
   *  - listeners window 'online'/'offline'.
   * Idempotent : nettoie d'abord toute surveillance précédente pour ne pas
   * empiler d'intervalles/listeners (device 24/7, zéro leak toléré).
   */
  function setupStalenessWatch() {
    stopStalenessWatch();

    if (window.addEventListener) {
      state.onlineHandler = function () { updateOfflineState(false); };
      state.offlineHandler = function () { updateOfflineState(true); };
      window.addEventListener('online', state.onlineHandler, false);
      window.addEventListener('offline', state.offlineHandler, false);
    }

    /* État initial : navigator.onLine peut être absent / peu fiable sur
       iOS 9 — on ne l'utilise que s'il est explicitement false. */
    if (typeof navigator !== 'undefined'
        && navigator
        && navigator.onLine === false) {
      updateOfflineState(true);
    }

    state.staleCheckInterval = setInterval(evaluateStaleness, 60 * 1000);
  }

  /* Nettoie intervalle + listeners (anti-leak sur ré-init). */
  function stopStalenessWatch() {
    if (state.staleCheckInterval) {
      clearInterval(state.staleCheckInterval);
      state.staleCheckInterval = null;
    }
    if (window.removeEventListener) {
      if (state.onlineHandler) {
        window.removeEventListener('online', state.onlineHandler, false);
        state.onlineHandler = null;
      }
      if (state.offlineHandler) {
        window.removeEventListener('offline', state.offlineHandler, false);
        state.offlineHandler = null;
      }
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
     présente. Vide / 'caractere' = thème par défaut (pas de classe).
     Re-render aussi les tuiles 'settings' compactes pour mettre à jour
     leur aperçu thème (swatches + nom) — sans ça la tuile compacte
     reste figée sur l'ancien thème jusqu'au prochain snapshot. */
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

    /* Force re-render des compact tiles 'settings' qui affichent l'aperçu
       du thème courant — sans ça l'aperçu reste figé. */
    if (state.cellsByTileId && state.tilesById && window.FamilyHubRender) {
      for (var tileId in state.cellsByTileId) {
        if (!state.cellsByTileId.hasOwnProperty(tileId)) continue;
        var tile = state.tilesById[tileId];
        if (!tile || tile.type !== 'settings') continue;
        var snapshotData = window.FamilyHubGetTileSnapshot
          ? window.FamilyHubGetTileSnapshot(tileId)
          : null;
        window.FamilyHubRender.renderTile(
          tile.type,
          state.cellsByTileId[tileId],
          snapshotData || {},
          tile.config
        );
      }
    }
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
      /* Marque qu'on a au moins un grid valide affiché — désactive le
         hard-reload sur échec d'auth ultérieur (anti reload-spiral). */
      hasLoadedOnce = true;
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
        reloadForLayoutChange();
      }
    }, function (err) {
      if (window.console && window.console.error) window.console.error('display listener', err);
    });
  }

  /* Hard reload pour re-fetch index.html après un changement de layout.
     Si l'overlay plein écran est ouvert (ex: une recette lue en grand),
     on diffère le reload pour ne pas l'arracher sous les yeux : on poll
     jusqu'à fermeture de l'overlay puis on reload. Idempotent via un flag. */
  var layoutReloadPending = false;
  function reloadForLayoutChange() {
    function doReload() {
      /* Cache buster sur le reload pour forcer iOS 9 à re-fetch index.html */
      var url = window.location.pathname + '?reload=' + Date.now();
      window.location.replace(url);
    }
    var overlayOpen = window.FamilyHubOverlay
      && window.FamilyHubOverlay.isOpen
      && window.FamilyHubOverlay.isOpen();
    if (!overlayOpen) {
      doReload();
      return;
    }
    if (layoutReloadPending) return;
    layoutReloadPending = true;
    if (window.console && window.console.log) {
      window.console.log('[display] overlay open, deferring reload until close');
    }
    var poll = setInterval(function () {
      var stillOpen = window.FamilyHubOverlay
        && window.FamilyHubOverlay.isOpen
        && window.FamilyHubOverlay.isOpen();
      if (!stillOpen) {
        clearInterval(poll);
        doReload();
      }
    }, 1000);
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

      /* Fraîcheur : lit le generatedAt top-level (Firestore Timestamp) et le
         ttlSeconds. generatedAt peut être absent ou pas encore résolu (write
         serveur en attente) → on garde l'ancienne valeur dans ce cas. */
      var genMs = 0;
      var gen = data.generatedAt;
      if (gen) {
        if (typeof gen.toMillis === 'function') {
          genMs = gen.toMillis();
        } else if (typeof gen.seconds === 'number') {
          genMs = gen.seconds * 1000;
        }
      }
      if (genMs) {
        state.snapshotGeneratedAtMs = genMs;
        state.snapshotTtlSeconds = (typeof data.ttlSeconds === 'number')
          ? data.ttlSeconds : 0;
        evaluateStaleness();
      }
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

    setupStalenessWatch();

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
