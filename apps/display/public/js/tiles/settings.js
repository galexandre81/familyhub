/* tiles/settings.js — Réglages display (luminosité).
   Compact : niveau lumino + CTA.
   Expand : boutons lumino + infos. Le thème suit le jour/nuit (core.js).
   ES5 vanilla, iOS 9.3.6 OK. */
(function (global) {
  'use strict';

  /* Posée par index.html, horodatée au build (copy-display-into-hub-dist.mjs). */
  var DISPLAY_VERSION = global.FH_DISPLAY_VERSION || '—';

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function brightnessLevel() {
    if (!global.FamilyHubBrightness) return 0;
    return global.FamilyHubBrightness.get();
  }

  /* Engrenage Material — 8 dents propres, viewBox 24x24. Laiton plein. */
  var GEAR_SVG =
    '<svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true" style="display:block">' +
      '<path fill="#D9A05B" d="M19.14 12.94c0.04-0.3 0.06-0.61 0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14 0.23-0.41 0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39 0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4 2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24 0-0.43 0.17-0.47 0.41L9.25 5.35C8.66 5.59 8.12 5.92 7.63 6.29L5.24 5.33c-0.22-0.08-0.47 0-0.59 0.22L2.74 8.87C2.62 9.08 2.66 9.34 2.86 9.48l2.03 1.58C4.84 11.36 4.8 11.69 4.8 12s0.02 0.64 0.07 0.94l-2.03 1.58c-0.18 0.14-0.23 0.41-0.12 0.61l1.92 3.32c0.12 0.22 0.37 0.29 0.59 0.22l2.39-0.96c0.5 0.38 1.03 0.7 1.62 0.94l0.36 2.54c0.05 0.24 0.24 0.41 0.48 0.41h3.84c0.24 0 0.44-0.17 0.47-0.41l0.36-2.54c0.59-0.24 1.13-0.56 1.62-0.94l2.39 0.96c0.22 0.08 0.47 0 0.59-0.22l1.92-3.32c0.12-0.22 0.07-0.47-0.12-0.61L19.14 12.94zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6s3.6 1.62 3.6 3.6S13.98 15.6 12 15.6z"/>' +
    '</svg>';

  /* ---------- COMPACT ---------- */

  function render(container, _data, _config) {
    container.className = 'grid-cell tile-settings tile-clickable';
    container.innerHTML = '';

    var titleEl = document.createElement('div');
    titleEl.className = 'tile-title fh-gap-r10'; /* ex-gap 10px (Safari 9 ignore gap en flex) */
    titleEl.style.cssText = 'display:-webkit-flex; display:flex; -webkit-align-items:center; align-items:center;';
    titleEl.innerHTML = GEAR_SVG + '<span>Réglages</span>';
    container.appendChild(titleEl);

    var body = document.createElement('div');
    body.style.cssText = 'padding:8px 0; display:-webkit-flex; display:flex; -webkit-flex-direction:column; flex-direction:column;';
    body.className = 'fh-gap-c14'; /* ex-gap 14px (Safari 9) */
    container.appendChild(body);

    /* Luminosité */
    var lvl = brightnessLevel();
    var pct = Math.round((lvl / 0.6) * 100);
    var lumBlock = document.createElement('div');
    /* La barre représente la luminosité (inverse de l'overlay sombre) : pct=0
       => barre pleine (max lumino). aria-valuenow exprime la luminosité 0-100. */
    var lumNow = 100 - pct;
    lumBlock.innerHTML =
      '<div id="settings-lum-label" style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; opacity:0.7; margin-bottom:6px">Luminosité</div>' +
      '<div role="progressbar" aria-labelledby="settings-lum-label" ' +
        'aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + lumNow + '" ' +
        'style="background:rgba(217,160,91,0.10); height:6px; border-radius:3px; position:relative; overflow:hidden">' +
        '<div style="position:absolute; left:0; top:0; bottom:0; width:' + lumNow + '%; background:#D9A05B"></div>' +
      '</div>';
    body.appendChild(lumBlock);

    /* CTA */
    var cta = document.createElement('div');
    cta.style.cssText =
      'font-size:10px; letter-spacing:0.15em; text-transform:uppercase; ' +
      'opacity:0.5; text-align:right;';
    cta.innerHTML = 'Toucher → modifier →';
    body.appendChild(cta);
  }

  function cleanup(container) { container.innerHTML = ''; }

  /* ---------- EXPAND — design « Alpage + Veillée » ----------
     Barre (overlay.js, tete()) : « Réglages », « Cet écran uniquement ».
     Contenu : la luminosité en 5 grands boutons (un soleil de plus en plus
     faible), puis les informations utiles au dépannage.
     Styles : css/plein-ecran.css (fh-rg-*). */

  /* Valeur = opacité du voile noir de brightness.js (0 = pas de voile =
     luminosité maximale, 0.6 = voile à 60 % = lecture de nuit). Plafond 0.6
     (MAX_DIM de brightness.js) : au-delà c'est illisible. Les libellés sont
     donc à l'INVERSE de la valeur : « Max » = 0, « Très basse » = 0.6.
     Boutons plutôt qu'un <input type="range">, fragile sur Safari 9. */
  var LUM_LEVELS = [
    { value: 0,    label: 'Max' },
    { value: 0.15, label: 'Haute' },
    { value: 0.3,  label: 'Moyenne' },
    { value: 0.45, label: 'Basse' },
    { value: 0.6,  label: 'Très basse' }
  ];

  /* Index du niveau correspondant à la valeur (à 0,05 près), sinon -1. */
  function indexNiveau(valeur, niveaux) {
    var n = niveaux || LUM_LEVELS;
    if (typeof valeur !== 'number' || isNaN(valeur)) return -1;
    for (var i = 0; i < n.length; i++) {
      if (Math.abs(valeur - n[i].value) < 0.05) return i;
    }
    return -1;
  }

  /* Soleil de plus en plus faible : rayons plus courts, disque moins plein. */
  function iconeNiveau(i) {
    var rayons = [9, 7, 5, 3, 0][i] || 0;
    var plein = [1, 0.7, 0.45, 0.2, 0][i];
    var html = '<svg viewBox="0 0 48 48" width="60" height="60" aria-hidden="true">';
    html += '<circle cx="24" cy="24" r="8" fill="currentColor" fill-opacity="' + plein + '" stroke="currentColor" stroke-width="3"/>';
    if (rayons > 0) {
      html += '<g stroke="currentColor" stroke-width="3" stroke-linecap="round">';
      for (var k = 0; k < 8; k++) {
        var a = k * Math.PI / 4;
        var r1 = 13, r2 = 13 + rayons;
        html += '<line x1="' + (24 + r1 * Math.cos(a)).toFixed(1) + '" y1="' + (24 + r1 * Math.sin(a)).toFixed(1) +
          '" x2="' + (24 + r2 * Math.cos(a)).toFixed(1) + '" y2="' + (24 + r2 * Math.sin(a)).toFixed(1) + '"/>';
      }
      html += '</g>';
    }
    return html + '</svg>';
  }

  var ICONE_COCHE =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" class="fh-rg-coche">' +
      '<path d="M5 12.5 L10 17 L19 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  /* Zone de tête de la barre du plein écran (overlay.js) ; sans elle (appel
     direct), une tête en haut du contenu. Vidée à chaque appel. */
  function zoneTete(container) {
    var O = global.FamilyHubOverlay;
    var t = O && typeof O.tete === 'function' ? O.tete() : null;
    if (t) { t.innerHTML = ''; return t; }
    var h = document.createElement('div');
    h.className = 'fh-pe-tete-repli fh-carte fh-bordure';
    container.insertBefore(h, container.firstChild);
    return h;
  }

  function expand(container, _data, _config, _tileId) {
    container.className = 'tile-overlay-content tile-overlay-content--full fh-pe-fixe fh-rg';
    container.innerHTML = '';

    var corps = document.createElement('div');
    corps.className = 'fh-pe-corps';
    corps.setAttribute('data-scroll-lock', '1');
    container.appendChild(corps);

    zoneTete(container).innerHTML =
      '<div class="fh-pe-titres">' +
        '<div class="fh-pe-titre fh-titre fh-texte">Réglages</div>' +
        '<div class="fh-pe-sous-titre fh-texte-doux">Pour cet écran uniquement</div>' +
      '</div>';

    /* Luminosité */
    var bloc = document.createElement('section');
    bloc.className = 'fh-rg-bloc fh-pe-carte fh-carte fh-bordure';
    bloc.innerHTML =
      '<h2 class="fh-rg-bloc-titre fh-titre fh-texte">Luminosité de l\'écran</h2>' +
      '<p class="fh-pe-aide fh-texte-doux">Les autres écrans gardent leur propre réglage.</p>';
    var rangee = document.createElement('div');
    rangee.className = 'fh-rg-niveaux';
    bloc.appendChild(rangee);
    corps.appendChild(bloc);

    var current = brightnessLevel();

    function renderLumButtons() {
      var actif = indexNiveau(current, LUM_LEVELS);
      var html = '';
      for (var i = 0; i < LUM_LEVELS.length; i++) {
        var on = i === actif;
        /* iOS 9 : pas de flex sur un <button> ; contenu dans un span. */
        html += '<button type="button" data-lum="' + LUM_LEVELS[i].value + '" ' +
          'aria-pressed="' + (on ? 'true' : 'false') + '" ' +
          'class="fh-pe-btn fh-rg-niveau-btn fh-carte fh-texte fh-bordure fh-corps' + (on ? ' is-active' : '') + '">' +
          '<span class="fh-pe-dedans fh-rg-niveau-dedans">' +
            '<span class="fh-rg-niveau-icone">' + iconeNiveau(i) + '</span>' +
            '<span class="fh-rg-niveau-mot">' + ICONE_COCHE + escapeHtml(LUM_LEVELS[i].label) + '</span>' +
          '</span></button>';
      }
      rangee.innerHTML = html;
      var btns = rangee.querySelectorAll('[data-lum]');
      for (var b = 0; b < btns.length; b++) {
        btns[b].addEventListener('click', choisir);
      }
    }

    function choisir() {
      var v = parseFloat(this.getAttribute('data-lum'));
      if (isNaN(v)) return;
      if (global.FamilyHubBrightness) global.FamilyHubBrightness.set(v);
      current = v;
      renderLumButtons();
    }
    renderLumButtons();

    /* Informations (dépannage) */
    var hid = (global.FamilyHubGetHouseholdId && global.FamilyHubGetHouseholdId()) || '?';
    var did = '?';
    try { did = localStorage.getItem('familyHub.displayId') || '?'; } catch (e) { /* noop */ }
    var infos = document.createElement('section');
    infos.className = 'fh-rg-infos';
    infos.innerHTML =
      '<h2 class="fh-rg-infos-titre fh-titre fh-texte">Informations</h2>' +
      '<div class="fh-rg-info"><span class="fh-rg-info-cle fh-texte-doux">Version de l\'écran</span>' +
        '<span class="fh-rg-info-val fh-texte">' + escapeHtml(DISPLAY_VERSION) + '</span></div>' +
      '<div class="fh-rg-info"><span class="fh-rg-info-cle fh-texte-doux">Identifiant de l\'écran</span>' +
        '<span class="fh-rg-info-val fh-texte">' + escapeHtml(did) + '</span></div>' +
      '<div class="fh-rg-info"><span class="fh-rg-info-cle fh-texte-doux">Identifiant du foyer</span>' +
        '<span class="fh-rg-info-val fh-texte">' + escapeHtml(hid) + '</span></div>';
    corps.appendChild(infos);
  }

  function collapse(_container) { /* noop */ }

  global.Tiles = global.Tiles || {};
  global.Tiles['settings'] = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse,
    /* Fonction pure (testée par packages/design/src/displayReglages.test.ts). */
    indexNiveau: indexNiveau
  };
})(window);
