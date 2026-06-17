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

      var cell = document.createElement('div');
      cell.className = 'grid-cell';
      cell.setAttribute('data-tile-id', entry.tileId);
      cell.setAttribute('data-tile-type', tile ? tile.type : 'missing');

      var pos = entry.position || { col: 0, row: 0, w: 1, h: 1 };
      cell.style.position = 'absolute';
      cell.style.left   = (pos.col / cols * 100) + '%';
      cell.style.top    = (pos.row / rows * 100) + '%';
      cell.style.width  = (pos.w   / cols * 100) + '%';
      cell.style.height = (pos.h   / rows * 100) + '%';

      if (!tile) {
        /* La tuile est référencée par le layout mais absente de tilesById :
           soit elle vient d'être créée et l'iPad n'a pas encore re-fetché
           la collection tiles, soit elle a été supprimée. On affiche une
           cellule visible avec bouton "Recharger" pour forcer un re-fetch. */
        cell.innerHTML =
          '<div style="padding:14px; text-align:center;">' +
            '<div class="tile-title" style="margin-bottom:8px">Tuile manquante</div>' +
            '<div style="font-size:10px; opacity:0.6; margin-bottom:8px; word-break:break-all;">' +
              entry.tileId +
            '</div>' +
            '<button type="button" class="tile-reload-btn" ' +
              'style="padding:6px 14px; background:#D9A05B; color:#1F1A14; ' +
              'border:none; border-radius:4px; font-size:12px; font-weight:600;">' +
              'Recharger' +
            '</button>' +
          '</div>';
        var rb = cell.querySelector('.tile-reload-btn');
        if (rb) {
          rb.addEventListener('click', function (ev) {
            ev.stopPropagation();
            var url = window.location.pathname + '?reload=' + Date.now();
            window.location.replace(url);
          });
        }
        container.appendChild(cell);
        cellsByTileId[entry.tileId] = cell;
        continue;
      }

      /* Tap handler — si la tuile a une vue plein écran, l'ouvrir au tap.
         La config est lue dynamiquement depuis state pour refléter les MAJ
         (ex: changement de selectedLocationId pour weather). */
      (function (tileType, tileId) {
        cell.addEventListener('click', function () {
          var module = global.Tiles && global.Tiles[tileType];
          if (module && typeof module.expand === 'function' && global.FamilyHubOverlay) {
            var data = (global.FamilyHubGetTileSnapshot
              ? global.FamilyHubGetTileSnapshot(tileId)
              : null);
            var config = (global.FamilyHubGetTileConfig
              ? global.FamilyHubGetTileConfig(tileId)
              : null);
            global.FamilyHubOverlay.open(tileType, data, config, tileId);
          }
        });
      })(tile.type, entry.tileId);

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
      /* Cas typique : nouveau type de tuile ajouté côté serveur, mais l'iPad
         a chargé un index.html caché qui ne référence pas le module JS de
         ce type. Solution : bouton de rechargement avec cache buster. */
      cell.innerHTML =
        '<div style="padding:14px; text-align:center;">' +
          '<div class="tile-title" style="margin-bottom:8px">Type inconnu : ' + type + '</div>' +
          '<div style="font-size:11px; opacity:0.7; margin-bottom:10px">' +
            'Le module pour cette tuile n\'est pas chargé.' +
          '</div>' +
          '<button type="button" class="tile-reload-btn" ' +
            'style="padding:6px 14px; background:#D9A05B; color:#1F1A14; ' +
            'border:none; border-radius:4px; font-size:12px; font-weight:600;">' +
            'Recharger' +
          '</button>' +
        '</div>';
      var btn = cell.querySelector('.tile-reload-btn');
      if (btn) {
        btn.addEventListener('click', function (ev) {
          ev.stopPropagation();
          /* Bust cache via query string sur l'URL courante */
          var url = window.location.pathname + '?reload=' + Date.now();
          window.location.replace(url);
        });
      }
      return;
    }
    /* Cleanup de la tuile précédemment rendue dans cette cell AVANT de
       re-render. Sur un device 24/7, renderTile() est rappelé à chaque
       snapshot ; sans ça les listeners radio/timer et les setInterval
       (clock, shopping-list) s'accumulent indéfiniment et fuient. On
       mémorise le type rendu dans un attribut sur la cell, on le relit
       au début du re-render, et si son module expose cleanup(container)
       on l'appelle. cleanupTile() est défensif (vérifie typeof === 'function'
       et try/catch). */
    var prevType = cell.getAttribute('data-prev-tile-type');
    if (prevType) {
      cleanupTile(prevType, cell);
    }

    try {
      module.render(cell, data || {}, config || {});
      cell.setAttribute('data-prev-tile-type', type);
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
