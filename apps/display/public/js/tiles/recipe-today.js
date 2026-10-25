/* tiles/recipe-today.js — Repas du moment.
   Compact : libellé du repas + recettes du slot + profils présents.
   Toucher : ouvre le repas dans le mode recette (js/mode-recette.js), le même
   écran que depuis le menu et le livre. Pas de vue « expand » : render.js
   n'ouvre donc pas de plein écran de tuile, le clic est posé ici.
   ES5 vanilla, iOS 9.3.6 OK. La data vient du snapshot (pré-calculée par
   functions/src/tiles/recipeToday.ts). */
(function (global) {
  'use strict';

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------- SVG icons (laiton, viewBox 50x50) ----------
     Cohérent avec apps/display/public/js/tiles/livreRecettes.js — pas
     d'emoji susceptible d'être en tofu sur iOS 9.3.6 / Safari 9. */

  var BRASS = '#D9A05B';

  function svgWrap(inner, size) {
    var dim = size || 24;
    return '<svg viewBox="0 0 50 50" width="' + dim + '" height="' + dim + '" ' +
      'aria-hidden="true" style="vertical-align:middle">' + inner + '</svg>';
  }

  /* Tasse fumante (petit-déj) */
  function svgPetitDej(size) {
    return svgWrap(
      '<path d="M14 18 L14 36 Q14 40, 18 40 L30 40 Q34 40, 34 36 L34 18 Z" ' +
        'fill="rgba(217,160,91,0.14)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M34 22 Q40 22, 40 28 Q40 34, 34 34" fill="none" stroke="' + BRASS + '" stroke-width="2"/>' +
      '<line x1="10" y1="42" x2="38" y2="42" stroke="' + BRASS + '" stroke-width="1.6" stroke-linecap="round"/>' +
      '<path d="M19 14 Q21 10, 19 6" fill="none" stroke="' + BRASS + '" stroke-width="1.4" stroke-linecap="round"/>' +
      '<path d="M24 14 Q26 10, 24 6" fill="none" stroke="' + BRASS + '" stroke-width="1.4" stroke-linecap="round"/>' +
      '<path d="M29 14 Q31 10, 29 6" fill="none" stroke="' + BRASS + '" stroke-width="1.4" stroke-linecap="round"/>',
      size
    );
  }

  /* Soleil (déjeuner) */
  function svgDej(size) {
    return svgWrap(
      '<circle cx="25" cy="25" r="9" fill="rgba(217,160,91,0.20)" stroke="' + BRASS + '" stroke-width="2"/>' +
      '<line x1="25" y1="5" x2="25" y2="11" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="25" y1="39" x2="25" y2="45" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="5" y1="25" x2="11" y2="25" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="39" y1="25" x2="45" y2="25" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="11" y1="11" x2="15" y2="15" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="35" y1="35" x2="39" y2="39" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="11" y1="39" x2="15" y2="35" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="35" y1="15" x2="39" y2="11" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>',
      size
    );
  }

  /* Lune croissant (dîner) */
  function svgDiner(size) {
    return svgWrap(
      '<path d="M32 8 A18 18 0 1 0 32 42 A14 14 0 1 1 32 8 Z" ' +
        'fill="rgba(217,160,91,0.18)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>',
      size
    );
  }

  /* Couvert (fallback / "À cuisiner") */
  function svgCutlery(size) {
    return svgWrap(
      /* Fourchette */
      '<line x1="16" y1="6" x2="16" y2="22" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="11" y1="6" x2="11" y2="14" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="21" y1="6" x2="21" y2="14" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
      '<line x1="16" y1="22" x2="16" y2="44" stroke="' + BRASS + '" stroke-width="2.4" stroke-linecap="round"/>' +
      /* Couteau */
      '<path d="M34 6 Q39 8, 39 22 L34 22 Z" fill="rgba(217,160,91,0.18)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<line x1="34" y1="22" x2="34" y2="44" stroke="' + BRASS + '" stroke-width="2.4" stroke-linecap="round"/>',
      size
    );
  }

  /* Plat couvert (état vide compact) */
  function svgEmpty(size) {
    return svgWrap(
      '<ellipse cx="25" cy="34" rx="18" ry="3.2" fill="' + BRASS + '" opacity="0.12"/>' +
      '<path d="M7 30 L43 30 Q43 18, 25 18 Q7 18, 7 30 Z" ' +
        'fill="rgba(217,160,91,0.10)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<circle cx="25" cy="14" r="2.2" fill="' + BRASS + '"/>',
      size
    );
  }

  function repasSvg(repas, size) {
    if (repas === 'petitDej') return svgPetitDej(size);
    if (repas === 'dej') return svgDej(size);
    if (repas === 'diner') return svgDiner(size);
    return svgCutlery(size);
  }

  function difficulteLabel(d) {
    if (d <= 1) return 'Facile';
    if (d === 2) return 'Moyen';
    return 'Avancé';
  }

  /* Portions : présents du repas (invités compris), sinon celles de la recette. */
  function ouvrirModeRecette(d) {
    if (!global.FamilyHubModeRecette || !d.recettes || d.recettes.length === 0) return;
    var ids = [];
    for (var i = 0; i < d.recettes.length; i++) {
      if (d.recettes[i] && d.recettes[i].recetteId) ids.push(d.recettes[i].recetteId);
    }
    if (ids.length === 0) return;
    var presents = (d.profilsPresents ? d.profilsPresents.length : 0) +
      (d.invitesNoms ? d.invitesNoms.length : 0);
    global.FamilyHubModeRecette.ouvrir({
      recetteIds: ids,
      titre: d.repasLabel || '',
      portions: presents > 0 ? presents : undefined
    });
  }

  /* ---------- COMPACT ---------- */

  function render(container, data, _config) {
    container.className = 'grid-cell tile-recipe-today tile-clickable';
    container.innerHTML = '';

    var d = data || {};
    /* Affectation (pas addEventListener) : render est rappelé à chaque
       snapshot, un seul gestionnaire à la fois. */
    container.onclick = function () { ouvrirModeRecette(d); };

    var titleEl = document.createElement('div');
    titleEl.className = 'tile-title';
    titleEl.innerHTML = 'À cuisiner';
    container.appendChild(titleEl);

    var body = document.createElement('div');
    body.style.padding = '4px 0';
    container.appendChild(body);

    if (d.repasActif === 'aucun' || !d.recettes || d.recettes.length === 0) {
      body.innerHTML =
        '<div style="text-align:center; padding:14px 8px; opacity:0.7">' +
          '<div style="margin-bottom:8px">' + svgEmpty(56) + '</div>' +
          '<div style="font-size:13px">Pas de plan actif<br>ou pas de recette<br>pour le moment</div>' +
        '</div>';
      return;
    }

    /* Eyebrow : "Ce midi" / "Demain matin" + icône SVG laiton */
    var eyebrow = document.createElement('div');
    eyebrow.style.cssText =
      'font-size:10px; letter-spacing:0.18em; text-transform:uppercase; ' +
      'opacity:0.85; margin-bottom:6px; display:-webkit-flex; display:flex; ' +
      '-webkit-align-items:center; align-items:center;';
    eyebrow.className = 'fh-gap-r6'; /* ex-gap 6px (Safari 9 ignore gap en flex) */
    eyebrow.innerHTML =
      repasSvg(d.repasActif, 18) +
      '<span>' + escapeHtml(d.repasLabel || '') + '</span>' +
      (d.isFallbackToNext
        ? ' <span style="opacity:0.6;font-style:italic;text-transform:none;letter-spacing:0">(prochain)</span>'
        : '') +
      (d.source === 'batch'
        ? ' <span style="font-size:9px; padding:1px 5px; background:rgba(217,160,91,0.15); border-radius:3px; margin-left:10px">BATCH</span>'
        : '');
    body.appendChild(eyebrow);

    /* Titres des recettes */
    var titles = document.createElement('div');
    titles.style.cssText = 'margin:8px 0 10px 0; line-height:1.25;';
    var html = '';
    for (var i = 0; i < d.recettes.length; i++) {
      var r = d.recettes[i];
      var nom = escapeHtml(r.nom || '(sans nom)');
      var temps = (r.tempsTotalMinutes != null) ? r.tempsTotalMinutes : '?';
      if (i === 0) {
        html += '<div style="font-family:Georgia,serif; font-size:18px; font-weight:600">' +
                  nom +
                '</div>' +
                '<div style="font-size:11px; opacity:0.65; margin-top:2px">' + temps + ' min · ' +
                  difficulteLabel(r.difficulte || 1) +
                '</div>';
      } else {
        html += '<div style="font-size:13px; opacity:0.85; margin-top:6px; font-style:italic">+ ' +
                  nom +
                '</div>';
      }
    }
    titles.innerHTML = html;
    body.appendChild(titles);

    /* Pastilles profils */
    if (d.profilsPresents && d.profilsPresents.length > 0) {
      var profilsEl = document.createElement('div');
      profilsEl.style.cssText = 'display:-webkit-flex; display:flex; -webkit-flex-wrap:wrap; flex-wrap:wrap; margin-top:8px;';
      profilsEl.className = 'fh-gap-w4'; /* ex-gap 4px (Safari 9) */
      for (var p = 0; p < d.profilsPresents.length; p++) {
        var prof = d.profilsPresents[p];
        var pill = document.createElement('span');
        pill.style.cssText =
          'display:inline-block; width:24px; height:24px; line-height:24px; text-align:center; ' +
          'border-radius:50%; font-size:11px; font-weight:600; ' +
          'background:' + (prof.couleur || '#888') + '; color:#fff;';
        pill.title = prof.nom;
        pill.innerHTML = escapeHtml(prof.initiale || (prof.nom ? prof.nom.charAt(0).toUpperCase() : '?'));
        profilsEl.appendChild(pill);
      }
      if (d.invitesNoms && d.invitesNoms.length > 0) {
        var inv = document.createElement('span');
        inv.style.cssText =
          'display:inline-block; padding:0 8px; height:24px; line-height:24px; ' +
          'border-radius:12px; font-size:11px; ' +
          'border:1px dashed rgba(217,160,91,0.6); color:#D9A05B;';
        inv.innerHTML = '+ ' + escapeHtml(d.invitesNoms.join(', '));
        profilsEl.appendChild(inv);
      }
      body.appendChild(profilsEl);
    }

    /* CTA discret */
    var cta = document.createElement('div');
    cta.style.cssText =
      'font-size:10px; letter-spacing:0.15em; text-transform:uppercase; ' +
      'opacity:0.5; margin-top:10px; text-align:right;';
    cta.innerHTML = 'Toucher → mode recette →';
    body.appendChild(cta);
  }

  function cleanup(container) {
    container.onclick = null;
    container.innerHTML = '';
  }

  global.Tiles = global.Tiles || {};
  global.Tiles['recipe-today'] = {
    render: render,
    cleanup: cleanup
  };
})(window);
