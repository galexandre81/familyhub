/* render.js — dispatcher pour les modules de tuiles, ES5 vanilla. */
(function (global) {
  'use strict';

  global.Tiles = global.Tiles || {};

  /**
   * Place les tuiles dans la grille selon le layout du display.
   * gridConfig: { cols, rows, gap }
   * layout: [{ tileId, position: { col, row, w, h } }]
   * tilesByid: dict { tileId: { type, nom, config } }
   */
  function buildGrid(container, gridConfig, layout, tilesById) {
    container.innerHTML = '';
    container.style.display = '-webkit-flex';
    container.style.display = 'flex';

    var cols = (gridConfig && gridConfig.cols) ? gridConfig.cols : 4;
    var rows = (gridConfig && gridConfig.rows) ? gridConfig.rows : 3;
    var gap = (gridConfig && gridConfig.gap !== undefined) ? gridConfig.gap : 16;

    /* On simule une grille avec des positions absolues calculées en pourcentage. */
    container.style.position = 'relative';
    container.style.padding = gap + 'px';

    var cellsByTileId = {};

    for (var i = 0; i < layout.length; i++) {
      var entry = layout[i];
      var tile = tilesById[entry.tileId];
      if (!tile) continue;

      var cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.setAttribute('data-tile-id', entry.tileId);
      cell.setAttribute('data-tile-type', tile.type);

      var pos = entry.position || { col: 0, row: 0, w: 1, h: 1 };
      cell.style.position = 'absolute';
      cell.style.left   = (pos.col / cols * 100) + '%';
      cell.style.top    = (pos.row / rows * 100) + '%';
      cell.style.width  = (pos.w   / cols * 100) + '%';
      cell.style.height = (pos.h   / rows * 100) + '%';

      container.appendChild(cell);
      cellsByTileId[entry.tileId] = cell;
    }

    return cellsByTileId;
  }

  /**
   * Demande à un module de tuile de se rendre dans son cell.
   * data: depuis snapshot (peut être vide pour les tuiles sans snapshot).
   * config: depuis le doc tile.
   */
  function renderTile(type, cell, data, config) {
    var module = global.Tiles[type];
    if (!module || typeof module.render !== 'function') {
      cell.innerHTML = '<div class="tile-title">Type inconnu : ' + type + '</div>';
      return;
    }
    try {
      module.render(cell, data || {}, config || {});
    } catch (e) {
      cell.innerHTML = '<div class="tile-title">Erreur rendu ' + type + '</div>';
      if (window.console && window.console.error) {
        window.console.error('renderTile error', type, e);
      }
    }
  }

  function cleanupTile(type, cell) {
    var module = global.Tiles[type];
    if (module && typeof module.cleanup === 'function') {
      try { module.cleanup(cell); } catch (e) { /* noop */ }
    }
  }

  global.FamilyHubRender = {
    buildGrid: buildGrid,
    renderTile: renderTile,
    cleanupTile: cleanupTile
  };
})(window);
