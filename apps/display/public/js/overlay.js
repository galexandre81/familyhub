/* overlay.js — gestion du mode plein écran "détail tuile".
   Une tuile module peut exposer .expand(container, data, config) pour s'afficher
   en plein écran, accessible via tap. ES5, iOS 9 OK.

   Barre haute (design « Alpage + Veillée », css/plein-ecran.css) : bouton
   « Fermer » (72 px) puis une zone de tête que la vue peut remplir (titre,
   navigation, actions) via FamilyHubOverlay.tete() — vidée à chaque
   ouverture et fermeture. Les vues qui ne s'en servent pas gardent leur
   propre titre dans le contenu. */
(function (global) {
  'use strict';

  var overlay = null;
  var content = null;
  var backBtn = null;
  var teteEl = null;
  var currentTileType = null;

  var ICONE_FERMER =
    '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" class="fh-pe-icone">' +
      '<path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/>' +
    '</svg>';

  function ensureDom() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'tile-overlay';
    overlay.className = 'tile-overlay fh-fond fh-corps';

    var bar = document.createElement('div');
    bar.className = 'tile-overlay-bar fh-carte fh-bordure';
    /* iOS 9 : pas de flex sur un <button> ; contenu dans un span. */
    backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'tile-overlay-fermer-btn fh-pe-btn fh-carte fh-texte fh-bordure fh-corps';
    backBtn.innerHTML = '<span class="fh-pe-dedans">' + ICONE_FERMER + '<span>Fermer</span></span>';
    backBtn.addEventListener('click', close);
    bar.appendChild(backBtn);
    teteEl = document.createElement('div');
    teteEl.className = 'tile-overlay-tete';
    bar.appendChild(teteEl);
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
    /* Une vue précédente a pu poser des styles inline (overflow:hidden…) :
       on repart d'un conteneur neutre pour la suivante. */
    content.style.cssText = '';
    content.className = 'tile-overlay-content';
    teteEl.innerHTML = '';
    content.setAttribute('data-tile-type', tileType);
    content._tileId = tileId || null;
    currentTileType = tileType;
    overlay.style.display = 'flex';
    /* Force reflow puis ajoute la classe pour transition */
    overlay.offsetHeight;
    overlay.className = 'tile-overlay fh-fond fh-corps tile-overlay-visible';

    try {
      module.expand(content, data || {}, config || {});
    } catch (e) {
      content.innerHTML = '<div class="fh-pe-message fh-texte">Erreur ouverture : ' + (e.message || e) + '</div>';
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
    overlay.className = 'tile-overlay fh-fond fh-corps';
    overlay.style.display = 'none';
    content.innerHTML = '';
    teteEl.innerHTML = '';
  }

  function isOpen() {
    return overlay && overlay.style.display === 'flex';
  }

  /* Zone de tête de la barre (à droite de « Fermer »), ou null si le
     plein écran n'a jamais été ouvert. */
  function tete() {
    return teteEl;
  }

  global.FamilyHubOverlay = {
    open: open,
    close: close,
    isOpen: isOpen,
    tete: tete
  };
})(window);
