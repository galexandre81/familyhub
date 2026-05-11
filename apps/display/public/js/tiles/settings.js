/* tiles/settings.js — Réglages display (thème + luminosité).
   Compact : aperçu thème actif + niveau lumino + CTA.
   Expand : sélecteur thème (6 cards) + slider lumino + infos.
   ES5 vanilla, iOS 9.3.6 OK. */
(function (global) {
  'use strict';

  var DISPLAY_VERSION = '20260511a';

  /* Synchro avec apps/hub/src/lib/themes.ts. Duplication acceptable
     (6 entrées peu volatiles, pas de transpile sur le display). */
  var THEMES = [
    { id:'caractere', nom:'Caractère',
      preview:{ bg:'#0F0D0A', card:'#1C1815', accent:'#D9A05B', text:'#F2E8D5' } },
    { id:'foret', nom:'Forêt',
      preview:{ bg:'#0E1A16', card:'#162621', accent:'#D4AF5F', text:'#F0EAD7' } },
    { id:'marine', nom:'Marine',
      preview:{ bg:'#0B1220', card:'#131E32', accent:'#E09160', text:'#EAE0C7' } },
    { id:'bordeaux', nom:'Bordeaux',
      preview:{ bg:'#1A0C0E', card:'#2C161A', accent:'#D6A07C', text:'#F4E8DB' } },
    { id:'glacier', nom:'Glacier',
      preview:{ bg:'#101620', card:'#1E2836', accent:'#AEBCD2', text:'#E8F0F8' } },
    { id:'lin', nom:'Lin',
      preview:{ bg:'#F8F0DE', card:'#FFFAF0', accent:'#B26E38', text:'#3C2A1A' } }
  ];

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getCurrentThemeId() {
    var html = document.documentElement;
    var classes = (html.className || '').split(/\s+/);
    for (var i = 0; i < classes.length; i++) {
      if (classes[i].indexOf('theme-') === 0) return classes[i].slice(6);
    }
    return 'caractere';
  }

  function getThemeById(id) {
    for (var i = 0; i < THEMES.length; i++) {
      if (THEMES[i].id === id) return THEMES[i];
    }
    return THEMES[0];
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
    titleEl.className = 'tile-title';
    titleEl.style.cssText = 'display:-webkit-flex; display:flex; -webkit-align-items:center; align-items:center; gap:10px;';
    titleEl.innerHTML = GEAR_SVG + '<span>Réglages</span>';
    container.appendChild(titleEl);

    var body = document.createElement('div');
    body.style.cssText = 'padding:8px 0; display:-webkit-flex; display:flex; -webkit-flex-direction:column; flex-direction:column; gap:14px;';
    container.appendChild(body);

    /* Thème actif */
    var theme = getThemeById(getCurrentThemeId());
    var themeBlock = document.createElement('div');
    themeBlock.innerHTML =
      '<div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; opacity:0.7; margin-bottom:6px">Thème</div>' +
      '<div style="display:-webkit-flex; display:flex; -webkit-align-items:center; align-items:center; gap:8px;">' +
        '<span style="display:-webkit-flex; display:flex; gap:2px;">' +
          '<span style="width:14px;height:14px;background:' + theme.preview.bg + ';border:1px solid ' + theme.preview.card + ';border-radius:2px"></span>' +
          '<span style="width:14px;height:14px;background:' + theme.preview.card + ';border-radius:2px"></span>' +
          '<span style="width:14px;height:14px;background:' + theme.preview.accent + ';border-radius:2px"></span>' +
          '<span style="width:14px;height:14px;background:' + theme.preview.text + ';border-radius:2px"></span>' +
        '</span>' +
        '<span style="font-size:13px">' + escapeHtml(theme.nom) + '</span>' +
      '</div>';
    body.appendChild(themeBlock);

    /* Luminosité */
    var lvl = brightnessLevel();
    var pct = Math.round((lvl / 0.6) * 100);
    var lumBlock = document.createElement('div');
    lumBlock.innerHTML =
      '<div style="font-size:10px; letter-spacing:0.18em; text-transform:uppercase; opacity:0.7; margin-bottom:6px">Luminosité</div>' +
      '<div style="background:rgba(217,160,91,0.10); height:6px; border-radius:3px; position:relative; overflow:hidden">' +
        '<div style="position:absolute; left:0; top:0; bottom:0; width:' + (100 - pct) + '%; background:#D9A05B"></div>' +
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

  /* ---------- EXPAND ---------- */

  function expand(container, _data, _config, _tileId) {
    container.className = 'tile-overlay-content tile-overlay-content--full tile-settings-expand';
    container.innerHTML = '';
    container.style.cssText =
      'display:-webkit-flex; display:flex; ' +
      '-webkit-flex-direction:column; flex-direction:column; ' +
      'height:100%; width:100%; overflow:hidden;';

    /* Header */
    var header = document.createElement('div');
    header.style.cssText =
      'padding:24px 32px 16px 32px; border-bottom:1px solid rgba(217,160,91,0.15); ' +
      '-webkit-flex-shrink:0; flex-shrink:0;';
    header.innerHTML =
      '<div style="font-size:11px; letter-spacing:0.2em; text-transform:uppercase; opacity:0.7">Display</div>' +
      '<div style="font-family:Georgia,serif; font-size:32px; margin-top:2px">Réglages</div>';
    container.appendChild(header);

    /* Body scrollable */
    var body = document.createElement('div');
    body.setAttribute('data-scroll-lock', '1');
    body.style.cssText =
      'padding:24px 32px; overflow-y:auto; -webkit-overflow-scrolling:touch; ' +
      '-webkit-flex:1 1 auto; flex:1 1 auto; min-height:0;';
    container.appendChild(body);

    /* Section thème */
    var themeSection = document.createElement('section');
    themeSection.style.cssText = 'margin-bottom:36px;';
    themeSection.innerHTML =
      '<h3 style="font-size:13px; letter-spacing:0.2em; text-transform:uppercase; opacity:0.7; margin:0 0 12px 0;">Thème de l\'interface</h3>';
    var grid = document.createElement('div');
    grid.style.cssText =
      'display:-webkit-flex; display:flex; -webkit-flex-wrap:wrap; flex-wrap:wrap; gap:10px;';
    var currentId = getCurrentThemeId();
    for (var i = 0; i < THEMES.length; i++) {
      grid.appendChild(makeThemeCard(THEMES[i], currentId === THEMES[i].id));
    }
    themeSection.appendChild(grid);
    body.appendChild(themeSection);

    /* Section luminosité — boutons discrets (5 niveaux) plutôt qu'un
       <input type="range"> qui est fragile sur Safari 9 PWA standalone.
       Note : la value est l'opacité de l'overlay noir (0 = pas d'overlay
       = max luminosité, 0.6 = overlay 60% noir = lecture nocturne).
       Cap à 0.6 (cf. brightness.js MAX_DIM) car au-delà c'est illisible.
       Les labels sont donc INVERSES de la value : "Max" = 0 (le plus
       clair), "Très basse" = 0.6 (le plus sombre). */
    var LUM_LEVELS = [
      { value: 0,    label: 'Max' },
      { value: 0.15, label: 'Haute' },
      { value: 0.3,  label: 'Moyenne' },
      { value: 0.45, label: 'Basse' },
      { value: 0.6,  label: 'Très basse' }
    ];
    var lumSection = document.createElement('section');
    lumSection.style.cssText = 'margin-bottom:36px;';
    lumSection.innerHTML =
      '<h3 style="font-size:13px; letter-spacing:0.2em; text-transform:uppercase; opacity:0.7; margin:0 0 12px 0;">Luminosité</h3>' +
      '<p style="font-size:12px; opacity:0.6; margin:0 0 14px 0;">Réglage local à cet écran. Les autres displays gardent leur propre luminosité.</p>';
    var lumRow = document.createElement('div');
    lumRow.className = 'tile-settings-lum-row';
    var current = (global.FamilyHubBrightness ? global.FamilyHubBrightness.get() : 0);

    function renderLumButtons() {
      var html = '';
      for (var i = 0; i < LUM_LEVELS.length; i++) {
        var lvl = LUM_LEVELS[i];
        var active = Math.abs(current - lvl.value) < 0.05;
        html += '<button type="button" data-lum="' + lvl.value + '" ' +
          'class="tile-settings-lum-btn' + (active ? ' is-active' : '') + '">' +
          escapeHtml(lvl.label) +
        '</button>';
      }
      lumRow.innerHTML = html;
      var btns = lumRow.querySelectorAll('[data-lum]');
      for (var b = 0; b < btns.length; b++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var v = parseFloat(btn.getAttribute('data-lum'));
            if (isNaN(v)) return;
            if (global.FamilyHubBrightness) global.FamilyHubBrightness.set(v);
            current = v;
            renderLumButtons();
          });
        })(btns[b]);
      }
    }
    renderLumButtons();
    lumSection.appendChild(lumRow);
    body.appendChild(lumSection);

    /* Section infos */
    var infoSection = document.createElement('section');
    infoSection.style.cssText = 'margin-bottom:24px; opacity:0.6;';
    var hid = (global.FamilyHubGetHouseholdId && global.FamilyHubGetHouseholdId()) || '?';
    var did = '?';
    try { did = localStorage.getItem('familyHub.displayId') || '?'; } catch (e) { /* noop */ }
    infoSection.innerHTML =
      '<h3 style="font-size:13px; letter-spacing:0.2em; text-transform:uppercase; opacity:0.7; margin:0 0 8px 0;">Informations</h3>' +
      '<div style="font-size:12px; line-height:1.6">' +
        'Version display : <code style="font-family:Menlo,monospace">' + DISPLAY_VERSION + '</code><br>' +
        'Display ID : <code style="font-family:Menlo,monospace">' + escapeHtml(did) + '</code><br>' +
        'Household ID : <code style="font-family:Menlo,monospace">' + escapeHtml(hid) + '</code>' +
      '</div>';
    body.appendChild(infoSection);
  }

  function makeThemeCard(theme, isActive) {
    var card = document.createElement('button');
    card.type = 'button';
    card.setAttribute('data-theme-id', theme.id);
    card.style.cssText =
      'background:transparent; border:' + (isActive ? '2px solid #D9A05B' : '1px solid rgba(217,160,91,0.30)') + '; ' +
      'border-radius:6px; padding:14px; cursor:pointer; text-align:left; ' +
      'min-height:44px; min-width:140px; -webkit-flex:0 1 calc(33.33% - 8px); flex:0 1 calc(33.33% - 8px); ' +
      'color:inherit;';
    card.innerHTML =
      '<div style="display:-webkit-flex; display:flex; gap:3px; margin-bottom:8px;">' +
        '<span style="width:22px; height:22px; background:' + theme.preview.bg + '; border:1px solid ' + theme.preview.card + '; border-radius:3px"></span>' +
        '<span style="width:22px; height:22px; background:' + theme.preview.card + '; border-radius:3px"></span>' +
        '<span style="width:22px; height:22px; background:' + theme.preview.accent + '; border-radius:3px"></span>' +
        '<span style="width:22px; height:22px; background:' + theme.preview.text + '; border-radius:3px"></span>' +
      '</div>' +
      '<div style="font-weight:600; font-size:14px;">' + escapeHtml(theme.nom) + '</div>';
    card.addEventListener('click', function () {
      pickTheme(theme.id, card);
    });
    return card;
  }

  function setActiveCardBorder(themeId) {
    var allCards = document.querySelectorAll('[data-theme-id]');
    for (var i = 0; i < allCards.length; i++) {
      var isActive = allCards[i].getAttribute('data-theme-id') === themeId;
      allCards[i].style.border = isActive
        ? '2px solid #D9A05B'
        : '1px solid rgba(217,160,91,0.30)';
    }
  }

  function pickTheme(themeId, _cardEl) {
    /* Capture le thème actuel AVANT l'apply optimistic — sinon le rollback
       sur échec Firestore ne saurait pas où revenir (le listener household
       de core.js ne re-applique que si newThemeId !== state.appliedThemeId,
       or applyDisplayTheme a déjà mis state.appliedThemeId = themeId, donc
       sans capture explicite l'iPad reste sur le thème optimistic à vie). */
    var previousThemeId = getCurrentThemeId();
    if (previousThemeId === themeId) return;

    /* Apply local immédiat (optimistic) + UI cards */
    if (global.FamilyHubApplyTheme) global.FamilyHubApplyTheme(themeId);
    setActiveCardBorder(themeId);

    /* Persist Firestore (households/{hid}.parametres.themeId) */
    var db = global.FamilyHubGetDb && global.FamilyHubGetDb();
    var hid = global.FamilyHubGetHouseholdId && global.FamilyHubGetHouseholdId();
    if (!db || !hid) return;

    var FieldValue = global.firebase && global.firebase.firestore && global.firebase.firestore.FieldValue;
    var serverTs = FieldValue ? FieldValue.serverTimestamp() : new Date();

    db.collection('households').doc(hid).update({
      'parametres.themeId': themeId,
      'updatedAt': serverTs
    }).catch(function (err) {
      if (window.console && window.console.error) console.error('[settings] persist theme', err);
      /* Rollback explicite — restaure le thème précédent et la card active.
         Sans ça, l'optimistic apply resterait à vie (cf. Code Review C1). */
      if (global.FamilyHubApplyTheme) global.FamilyHubApplyTheme(previousThemeId);
      setActiveCardBorder(previousThemeId);
    });
  }

  function collapse(_container) { /* noop */ }

  global.Tiles = global.Tiles || {};
  global.Tiles['settings'] = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse
  };
})(window);
