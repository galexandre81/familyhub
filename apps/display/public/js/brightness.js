/* brightness.js — singleton de contrôle de luminosité du display.
   Crée un overlay <div> noir plein écran avec opacity 0..0.6 par-dessus
   tout le contenu (z-index élevé, pointer-events:none → pas d'interception
   des clics). Valeur stockée en localStorage par display. ES5, iOS 9 OK. */
(function (global) {
  'use strict';

  var KEY = 'familyhub.brightness';
  var MAX_DIM = 0.6;
  var overlay = null;

  function clamp(v) {
    if (typeof v !== 'number' || isNaN(v)) v = 0;
    if (v < 0) v = 0;
    if (v > MAX_DIM) v = MAX_DIM;
    return v;
  }

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'brightness-overlay';
    overlay.style.cssText =
      'position:fixed; top:0; left:0; right:0; bottom:0; ' +
      'background:#000; pointer-events:none; z-index:1000; opacity:0;';
    if (document.body) {
      document.body.appendChild(overlay);
    } else {
      /* Si appelé avant DOMContentLoaded, attendre */
      document.addEventListener('DOMContentLoaded', function () {
        if (!overlay.parentNode) document.body.appendChild(overlay);
      });
    }
  }

  function get() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw == null) return 0;
      return clamp(parseFloat(raw));
    } catch (e) { return 0; }
  }

  function set(v) {
    v = clamp(v);
    ensureOverlay();
    overlay.style.opacity = String(v);
    try { localStorage.setItem(KEY, String(v)); } catch (e) { /* private mode */ }
    return v;
  }

  function init() {
    ensureOverlay();
    var current = get();
    if (current > 0) overlay.style.opacity = String(current);
  }

  global.FamilyHubBrightness = {
    get: get,
    set: set,
    init: init,
    MAX: MAX_DIM
  };
})(window);
