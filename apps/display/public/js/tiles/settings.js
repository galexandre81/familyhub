/* tiles/settings.js — Réglages display (thème + luminosité).
   Compact : aperçu thème actif + niveau lumino + CTA.
   Expand : sélecteur thème (6 cards) + slider lumino + infos.
   ES5 vanilla, iOS 9.3.6 OK. */
(function (global) {
  'use strict';

  var DISPLAY_VERSION = '20260508a';

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

  /* ---------- COMPACT ---------- */

  function render(container, _data, _config) {
    container.className = 'grid-cell tile-settings tile-clickable';
    container.innerHTML = '';

    var titleEl = document.createElement('div');
    titleEl.className = 'tile-title';
    titleEl.innerHTML = 'Réglages';
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

    /* Section luminosité */
    var lumSection = document.createElement('section');
    lumSection.style.cssText = 'margin-bottom:36px;';
    lumSection.innerHTML =
      '<h3 style="font-size:13px; letter-spacing:0.2em; text-transform:uppercase; opacity:0.7; margin:0 0 12px 0;">Luminosité</h3>' +
      '<p style="font-size:12px; opacity:0.6; margin:0 0 14px 0;">Réglage local à cet écran. Les autres displays gardent leur propre luminosité.</p>';
    var lumRow = document.createElement('div');
    lumRow.style.cssText = 'display:-webkit-flex; display:flex; -webkit-align-items:center; align-items:center; gap:14px;';
    var current = (global.FamilyHubBrightness ? global.FamilyHubBrightness.get() : 0);
    var sliderVal = Math.round(current * 100);  /* 0..60 */
    lumRow.innerHTML =
      '<span style="font-size:11px; opacity:0.7; min-width:60px; text-align:right">Très clair</span>' +
      '<input type="range" min="0" max="60" step="5" value="' + sliderVal + '" data-role="brightness-slider" ' +
        'style="-webkit-flex:1; flex:1; min-width:0;">' +
      '<span style="font-size:11px; opacity:0.7; min-width:60px">Très sombre</span>';
    lumSection.appendChild(lumRow);

    var slider = lumRow.querySelector('[data-role="brightness-slider"]');
    if (slider) {
      slider.addEventListener('input', function () {
        var v = parseFloat(slider.value) / 100;
        if (global.FamilyHubBrightness) global.FamilyHubBrightness.set(v);
      });
      slider.addEventListener('change', function () {
        var v = parseFloat(slider.value) / 100;
        if (global.FamilyHubBrightness) global.FamilyHubBrightness.set(v);
      });
    }
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

  function pickTheme(themeId, cardEl) {
    /* Apply local immédiat (optimistic) */
    if (global.FamilyHubApplyTheme) global.FamilyHubApplyTheme(themeId);

    /* Update UI : retire le bord actif des autres cards, ajoute sur celle-ci */
    var allCards = document.querySelectorAll('[data-theme-id]');
    for (var i = 0; i < allCards.length; i++) {
      allCards[i].style.border = '1px solid rgba(217,160,91,0.30)';
    }
    if (cardEl) cardEl.style.border = '2px solid #D9A05B';

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
      /* Rollback : on ne sait pas l'ancien thème ici, le snapshot listener
         de core.js le récupèrera et re-appliquera. */
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
