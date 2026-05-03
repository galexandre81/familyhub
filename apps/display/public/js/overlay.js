/* overlay.js — gestion du mode plein écran "détail tuile".
   Une tuile module peut exposer .expand(container, data, config) pour s'afficher
   en plein écran, accessible via tap. ES5, iOS 9 OK. */
(function (global) {
  'use strict';

  var overlay = null;
  var content = null;
  var backBtn = null;
  var currentTileType = null;

  function ensureDom() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'tile-overlay';
    overlay.className = 'tile-overlay';

    var bar = document.createElement('div');
    bar.className = 'tile-overlay-bar';
    backBtn = document.createElement('button');
    backBtn.className = 'tile-overlay-back';
    backBtn.innerHTML = '← Retour';
    backBtn.addEventListener('click', close);
    bar.appendChild(backBtn);
    overlay.appendChild(bar);

    content = document.createElement('div');
    content.className = 'tile-overlay-content';
    overlay.appendChild(content);

    document.body.appendChild(overlay);
  }

  function open(tileType, data, config, tileId) {
    ensureDom();
    var module = global.Tiles && global.Tiles[tileType];
    if (!module || typeof module.expand !== 'function') {
      return false;
    }
    /* Cleanup éventuel d'un précédent expand */
    if (currentTileType) {
      var prev = global.Tiles[currentTileType];
      if (prev && typeof prev.collapse === 'function') {
        try { prev.collapse(content); } catch (e) { /* noop */ }
      }
    }
    content.innerHTML = '';
    content.setAttribute('data-tile-type', tileType);
    content._tileId = tileId || null;
    currentTileType = tileType;
    overlay.style.display = 'flex';
    /* Force reflow puis ajoute la classe pour transition */
    overlay.offsetHeight;
    overlay.className = 'tile-overlay tile-overlay-visible';

    try {
      module.expand(content, data || {}, config || {});
    } catch (e) {
      content.innerHTML = '<div style="color:#C8553D">Erreur ouverture : ' + (e.message || e) + '</div>';
    }
    return true;
  }

  function close() {
    if (!overlay) return;
    if (currentTileType) {
      var module = global.Tiles && global.Tiles[currentTileType];
      if (module && typeof module.collapse === 'function') {
        try { module.collapse(content); } catch (e) { /* noop */ }
      }
      currentTileType = null;
    }
    overlay.className = 'tile-overlay';
    overlay.style.display = 'none';
    content.innerHTML = '';
  }

  function isOpen() {
    return overlay && overlay.style.display === 'flex';
  }

  global.FamilyHubOverlay = {
    open: open,
    close: close,
    isOpen: isOpen
  };
})(window);
