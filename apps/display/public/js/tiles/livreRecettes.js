/* tiles/livreRecettes.js — Livre de recettes du foyer.
   Tuile compacte : icône livre SVG laiton + nombre de recettes.
   Expand : wizard 2 étapes (Repas → Envies + Résultats inline).
   Logique contextuelle : petit-déj seul affiche Sucré/Salé + Type au lieu
   de ingrédient/accompagnement/inspiration.
   ES5 vanilla, Firebase JS SDK v8 compat (iOS 9.3.6 OK).
   Toutes les icônes sont en SVG inline laiton (#D9A05B) pour éviter les
   tofus d'emojis Unicode > 8.0 sur Safari 9. */
(function (global) {
  'use strict';

  var cache = { recettes: null, fetchedAt: 0, promise: null };
  var STALE_MS = 60 * 60 * 1000;
  var BRASS = '#D9A05B';
  var DARK = '#1C1815';

  function escapeHTML(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function deburr(s) {
    if (s == null) return '';
    return String(s).toLowerCase()
      .replace(/[àâä]/g, 'a').replace(/[éèêë]/g, 'e')
      .replace(/[îï]/g, 'i').replace(/[ôö]/g, 'o')
      .replace(/[ùûü]/g, 'u').replace(/ÿ/g, 'y')
      .replace(/ç/g, 'c').replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  }

  function tempsTotal(r) {
    return (+r.tempsPrepMinutes || 0) + (+r.tempsCuissonMinutes || 0);
  }

  /* ---------- SVG icons (laiton, viewBox 50x50, taille via CSS) ----------
     Le wrapper svg() retourne un <svg> sans width/height inline ; les tailles
     sont contrôlées par .wiz-icon-svg svg / .wiz-icon-btn-sm .wiz-icon-svg svg
     dans le CSS, ce qui permet d'ajuster selon la grille (étape 1 vs étape 2). */

  function svg(inner) {
    return '<svg viewBox="0 0 50 50" aria-hidden="true">' + inner + '</svg>';
  }

  /* === Tuile compacte : livre ouvert (plus large, avec dimensions inline) === */
  var BOOK_SVG_LARGE =
    '<svg viewBox="0 0 100 80" width="96" height="76" aria-hidden="true">' +
      '<path d="M48 14 L48 74 L52 74 L52 14 Z" fill="' + BRASS + '" opacity="0.9"/>' +
      '<path d="M48 16 C36 12, 22 11, 10 14 L10 70 C22 67, 36 68, 48 72 Z" ' +
        'fill="rgba(217,160,91,0.10)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<path d="M52 16 C64 12, 78 11, 90 14 L90 70 C78 67, 64 68, 52 72 Z" ' +
        'fill="rgba(217,160,91,0.10)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
      '<line x1="18" y1="26" x2="44" y2="26" stroke="' + BRASS + '" stroke-width="1.2" opacity="0.65"/>' +
      '<line x1="18" y1="34" x2="44" y2="34" stroke="' + BRASS + '" stroke-width="1.2" opacity="0.65"/>' +
      '<line x1="18" y1="42" x2="40" y2="42" stroke="' + BRASS + '" stroke-width="1.2" opacity="0.65"/>' +
      '<line x1="18" y1="50" x2="42" y2="50" stroke="' + BRASS + '" stroke-width="1.2" opacity="0.45"/>' +
      '<line x1="56" y1="26" x2="82" y2="26" stroke="' + BRASS + '" stroke-width="1.2" opacity="0.65"/>' +
      '<line x1="56" y1="34" x2="82" y2="34" stroke="' + BRASS + '" stroke-width="1.2" opacity="0.65"/>' +
      '<line x1="56" y1="42" x2="78" y2="42" stroke="' + BRASS + '" stroke-width="1.2" opacity="0.65"/>' +
      '<line x1="56" y1="50" x2="80" y2="50" stroke="' + BRASS + '" stroke-width="1.2" opacity="0.45"/>' +
    '</svg>';

  /* === Repas (étape 1) === */
  var ICON_PETIT_DEJ = svg(
    /* Tasse fumante */
    '<path d="M14 18 L14 36 Q14 40, 18 40 L30 40 Q34 40, 34 36 L34 18 Z" ' +
      'fill="rgba(217,160,91,0.14)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M34 22 Q40 22, 40 28 Q40 34, 34 34" fill="none" stroke="' + BRASS + '" stroke-width="2"/>' +
    '<line x1="10" y1="42" x2="38" y2="42" stroke="' + BRASS + '" stroke-width="1.6" stroke-linecap="round"/>' +
    /* Vapeur */
    '<path d="M19 14 Q21 10, 19 6" fill="none" stroke="' + BRASS + '" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M24 14 Q26 10, 24 6" fill="none" stroke="' + BRASS + '" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M29 14 Q31 10, 29 6" fill="none" stroke="' + BRASS + '" stroke-width="1.4" stroke-linecap="round"/>'
  );

  var ICON_DEJEUNER = svg(
    /* Soleil */
    '<circle cx="25" cy="25" r="9" fill="rgba(217,160,91,0.20)" stroke="' + BRASS + '" stroke-width="2"/>' +
    '<line x1="25" y1="5" x2="25" y2="11" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="25" y1="39" x2="25" y2="45" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="5" y1="25" x2="11" y2="25" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="39" y1="25" x2="45" y2="25" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="11" y1="11" x2="15" y2="15" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="35" y1="35" x2="39" y2="39" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="11" y1="39" x2="15" y2="35" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
    '<line x1="35" y1="15" x2="39" y2="11" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>'
  );

  var ICON_DINER = svg(
    /* Lune croissant */
    '<path d="M32 8 A18 18 0 1 0 32 42 A14 14 0 1 1 32 8 Z" ' +
      'fill="rgba(217,160,91,0.18)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>'
  );

  var ICON_ENCAS = svg(
    /* Cookie aux pépites */
    '<circle cx="25" cy="25" r="16" fill="rgba(217,160,91,0.14)" stroke="' + BRASS + '" stroke-width="2"/>' +
    '<circle cx="20" cy="20" r="2" fill="' + BRASS + '" opacity="0.85"/>' +
    '<circle cx="30" cy="22" r="1.8" fill="' + BRASS + '" opacity="0.85"/>' +
    '<circle cx="33" cy="30" r="2" fill="' + BRASS + '" opacity="0.85"/>' +
    '<circle cx="22" cy="32" r="1.8" fill="' + BRASS + '" opacity="0.85"/>' +
    '<circle cx="26" cy="26" r="1.5" fill="' + BRASS + '" opacity="0.65"/>'
  );

  /* === Ingrédients === */
  var ICON_POULET = svg(
    /* Cuisse de poulet (drumstick) */
    '<ellipse cx="20" cy="22" rx="12" ry="9" fill="rgba(217,160,91,0.18)" stroke="' + BRASS + '" stroke-width="2" transform="rotate(-32 20 22)"/>' +
    '<path d="M28 30 L42 42" stroke="' + BRASS + '" stroke-width="2.6" stroke-linecap="round"/>' +
    '<circle cx="42" cy="42" r="2" fill="rgba(217,160,91,0.18)" stroke="' + BRASS + '" stroke-width="1.6"/>' +
    '<circle cx="38" cy="38" r="1.6" fill="rgba(217,160,91,0.18)" stroke="' + BRASS + '" stroke-width="1.6"/>'
  );

  var ICON_BOEUF = svg(
    /* Pièce de viande / steak */
    '<path d="M12 20 Q12 12, 20 12 L34 12 Q42 12, 42 20 L42 32 Q42 38, 36 38 L18 38 Q12 38, 12 32 Z" ' +
      'fill="rgba(217,160,91,0.18)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M18 22 Q22 19, 28 22 Q34 25, 38 22" fill="none" stroke="' + BRASS + '" stroke-width="1.2" opacity="0.6"/>' +
    '<path d="M16 28 Q22 25, 28 28 Q34 31, 40 28" fill="none" stroke="' + BRASS + '" stroke-width="1.2" opacity="0.6"/>'
  );

  var ICON_POISSON = svg(
    /* Poisson de profil */
    '<path d="M9 25 Q18 14, 30 18 Q40 22, 42 25 Q40 28, 30 32 Q18 36, 9 25 Z" ' +
      'fill="rgba(217,160,91,0.16)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
    /* Queue */
    '<path d="M9 25 L3 19 L3 31 Z" fill="rgba(217,160,91,0.12)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
    /* Œil */
    '<circle cx="34" cy="23" r="1.5" fill="' + BRASS + '"/>' +
    /* Branchie */
    '<path d="M28 19 Q26 25, 28 31" fill="none" stroke="' + BRASS + '" stroke-width="1.2" opacity="0.6"/>'
  );

  var ICON_OEUFS = svg(
    /* Œuf au plat */
    '<path d="M11 28 C8 22, 14 17, 18 19 C20 13, 26 13, 28 19 C32 15, 38 21, 36 28 C40 32, 36 38, 30 36 C28 42, 22 42, 20 36 C14 38, 8 33, 11 28 Z" ' +
      'fill="rgba(217,160,91,0.10)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
    '<circle cx="24" cy="27" r="6" fill="' + BRASS + '" opacity="0.85"/>'
  );

  var ICON_VEGE = svg(
    /* Pousse à 2 feuilles */
    '<line x1="25" y1="42" x2="25" y2="14" stroke="' + BRASS + '" stroke-width="2"/>' +
    '<path d="M25 22 C18 22, 13 16, 13 10 C20 10, 25 14, 25 22 Z" fill="rgba(217,160,91,0.20)" stroke="' + BRASS + '" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M25 30 C32 30, 37 24, 37 18 C30 18, 25 22, 25 30 Z" fill="rgba(217,160,91,0.10)" stroke="' + BRASS + '" stroke-width="1.6" stroke-linejoin="round"/>'
  );

  var ICON_FROMAGE = svg(
    /* Triangle de fromage */
    '<path d="M8 38 L42 38 L42 20 Z" fill="rgba(217,160,91,0.20)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
    '<circle cx="22" cy="34" r="2" fill="none" stroke="' + BRASS + '" stroke-width="1.5"/>' +
    '<circle cx="32" cy="30" r="1.6" fill="none" stroke="' + BRASS + '" stroke-width="1.5"/>' +
    '<circle cx="36" cy="34" r="1.3" fill="none" stroke="' + BRASS + '" stroke-width="1.5"/>'
  );

  /* === Inspirations === */
  var ICON_FRANCAIS = svg(
    /* Verre de vin */
    '<path d="M16 8 L34 8 L34 14 Q34 24, 25 28 Q16 24, 16 14 Z" fill="rgba(217,160,91,0.20)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
    '<line x1="25" y1="28" x2="25" y2="40" stroke="' + BRASS + '" stroke-width="2"/>' +
    '<line x1="16" y1="42" x2="34" y2="42" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>'
  );

  var ICON_ITALIEN = svg(
    /* Pizza coupée */
    '<circle cx="25" cy="25" r="16" fill="rgba(217,160,91,0.14)" stroke="' + BRASS + '" stroke-width="2"/>' +
    '<line x1="25" y1="9" x2="25" y2="41" stroke="' + BRASS + '" stroke-width="1.4" opacity="0.7"/>' +
    '<line x1="9" y1="25" x2="41" y2="25" stroke="' + BRASS + '" stroke-width="1.4" opacity="0.7"/>' +
    '<circle cx="20" cy="20" r="1.6" fill="' + BRASS + '" opacity="0.75"/>' +
    '<circle cx="30" cy="20" r="1.6" fill="' + BRASS + '" opacity="0.75"/>' +
    '<circle cx="20" cy="30" r="1.6" fill="' + BRASS + '" opacity="0.75"/>' +
    '<circle cx="30" cy="30" r="1.6" fill="' + BRASS + '" opacity="0.75"/>'
  );

  var ICON_MEDITERRANEEN = svg(
    /* Branche d'olivier (3 olives + tige diagonale) */
    '<line x1="8" y1="42" x2="42" y2="8" stroke="' + BRASS + '" stroke-width="1.6"/>' +
    '<ellipse cx="20" cy="22" rx="3" ry="5" fill="rgba(217,160,91,0.22)" stroke="' + BRASS + '" stroke-width="1.5" transform="rotate(45 20 22)"/>' +
    '<ellipse cx="32" cy="22" rx="3" ry="5" fill="rgba(217,160,91,0.22)" stroke="' + BRASS + '" stroke-width="1.5" transform="rotate(-45 32 22)"/>' +
    '<ellipse cx="26" cy="34" rx="3" ry="5" fill="rgba(217,160,91,0.22)" stroke="' + BRASS + '" stroke-width="1.5"/>'
  );

  var ICON_ASIATIQUE = svg(
    /* Bol fumant */
    '<path d="M8 24 Q8 36, 25 38 Q42 36, 42 24 Z" fill="rgba(217,160,91,0.18)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
    '<line x1="6" y1="24" x2="44" y2="24" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M16 18 Q18 14, 16 10" fill="none" stroke="' + BRASS + '" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M25 16 Q27 12, 25 8" fill="none" stroke="' + BRASS + '" stroke-width="1.4" stroke-linecap="round"/>' +
    '<path d="M34 18 Q36 14, 34 10" fill="none" stroke="' + BRASS + '" stroke-width="1.4" stroke-linecap="round"/>'
  );

  var ICON_INDIEN = svg(
    /* Anis étoilé / étoile à 5 branches */
    '<path d="M25 8 L29 19 L41 19 L31 26 L34 38 L25 31 L16 38 L19 26 L9 19 L21 19 Z" ' +
      'fill="rgba(217,160,91,0.18)" stroke="' + BRASS + '" stroke-width="1.8" stroke-linejoin="round"/>' +
    '<circle cx="25" cy="25" r="2" fill="' + BRASS + '" opacity="0.85"/>'
  );

  var ICON_MEXICAIN = svg(
    /* Piment + tige */
    '<path d="M14 14 Q18 12, 22 16" stroke="' + BRASS + '" stroke-width="2" fill="none" stroke-linecap="round"/>' +
    '<path d="M22 16 Q26 20, 30 24 Q36 30, 36 38 Q34 42, 28 42 Q20 40, 16 32 Q12 22, 22 16 Z" ' +
      'fill="rgba(217,160,91,0.24)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>'
  );

  var ICON_ESPAGNOL = svg(
    /* Paella : poêle + poignée */
    '<circle cx="22" cy="28" r="14" fill="rgba(217,160,91,0.14)" stroke="' + BRASS + '" stroke-width="2"/>' +
    '<line x1="36" y1="28" x2="46" y2="28" stroke="' + BRASS + '" stroke-width="2.4" stroke-linecap="round"/>' +
    '<circle cx="18" cy="26" r="1.5" fill="' + BRASS + '" opacity="0.75"/>' +
    '<circle cx="26" cy="28" r="1.5" fill="' + BRASS + '" opacity="0.75"/>' +
    '<circle cx="22" cy="33" r="1.5" fill="' + BRASS + '" opacity="0.75"/>' +
    '<circle cx="28" cy="32" r="1.2" fill="' + BRASS + '" opacity="0.6"/>'
  );

  var ICON_ORIENTAL = svg(
    /* Théière */
    '<ellipse cx="25" cy="30" rx="13" ry="9" fill="rgba(217,160,91,0.18)" stroke="' + BRASS + '" stroke-width="2"/>' +
    '<ellipse cx="25" cy="21" rx="6" ry="2" fill="rgba(217,160,91,0.22)" stroke="' + BRASS + '" stroke-width="1.6"/>' +
    '<line x1="25" y1="16" x2="25" y2="19" stroke="' + BRASS + '" stroke-width="1.6"/>' +
    '<circle cx="25" cy="14" r="1.5" fill="' + BRASS + '"/>' +
    '<path d="M38 28 L44 24 L44 28 Z" fill="rgba(217,160,91,0.22)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
    '<path d="M12 28 Q6 30, 12 35" fill="none" stroke="' + BRASS + '" stroke-width="2" stroke-linecap="round"/>'
  );

  /* === Accompagnements === */
  var ICON_VERT = svg(
    '<path d="M25 6 C16 12, 12 22, 14 32 C20 28, 23 22, 25 14 Z" ' +
      'fill="rgba(217,160,91,0.18)" stroke="' + BRASS + '" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<path d="M25 6 C34 12, 38 22, 36 32 C30 28, 27 22, 25 14 Z" ' +
      'fill="rgba(217,160,91,0.10)" stroke="' + BRASS + '" stroke-width="1.6" stroke-linejoin="round"/>' +
    '<line x1="25" y1="6" x2="25" y2="44" stroke="' + BRASS + '" stroke-width="1.6"/>'
  );

  var ICON_FRAIS = svg(
    /* Tomate */
    '<circle cx="25" cy="29" r="14" fill="rgba(217,160,91,0.10)" stroke="' + BRASS + '" stroke-width="1.8"/>' +
    '<path d="M19 12 L25 16 L31 12 L29 19 L25 16 L21 19 Z" fill="' + BRASS + '" opacity="0.85"/>'
  );

  var ICON_RACINE = svg(
    /* Carotte */
    '<path d="M25 8 L17 16 L13 22 L25 44 L37 22 L33 16 Z" ' +
      'fill="rgba(217,160,91,0.14)" stroke="' + BRASS + '" stroke-width="1.8" stroke-linejoin="round"/>' +
    '<line x1="20" y1="20" x2="30" y2="20" stroke="' + BRASS + '" stroke-width="1.1" opacity="0.55"/>' +
    '<line x1="18" y1="26" x2="32" y2="26" stroke="' + BRASS + '" stroke-width="1.1" opacity="0.55"/>' +
    '<line x1="20" y1="32" x2="30" y2="32" stroke="' + BRASS + '" stroke-width="1.1" opacity="0.55"/>' +
    '<path d="M22 8 Q24 4, 25 8 Q26 4, 28 8" fill="none" stroke="' + BRASS + '" stroke-width="1.4"/>'
  );

  var ICON_PATES = svg(
    /* 3 vagues parallèles */
    '<path d="M6 18 Q14 10, 22 18 T38 18 T46 18" fill="none" stroke="' + BRASS + '" stroke-width="2"/>' +
    '<path d="M6 27 Q14 19, 22 27 T38 27 T46 27" fill="none" stroke="' + BRASS + '" stroke-width="2"/>' +
    '<path d="M6 36 Q14 28, 22 36 T38 36 T46 36" fill="none" stroke="' + BRASS + '" stroke-width="2"/>'
  );

  var ICON_PATATE = svg(
    '<ellipse cx="25" cy="26" rx="16" ry="13" ' +
      'fill="rgba(217,160,91,0.16)" stroke="' + BRASS + '" stroke-width="1.8" transform="rotate(-12 25 26)"/>' +
    '<circle cx="20" cy="22" r="1.2" fill="' + BRASS + '" opacity="0.75"/>' +
    '<circle cx="30" cy="20" r="1" fill="' + BRASS + '" opacity="0.75"/>' +
    '<circle cx="33" cy="29" r="1.4" fill="' + BRASS + '" opacity="0.75"/>' +
    '<circle cx="22" cy="32" r="1" fill="' + BRASS + '" opacity="0.75"/>'
  );

  /* === Petit-déj GOUT === */
  var ICON_SUCRE = svg(
    /* Cupcake */
    '<path d="M14 26 L36 26 L34 42 L16 42 Z" fill="rgba(217,160,91,0.18)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
    '<line x1="20" y1="26" x2="20" y2="42" stroke="' + BRASS + '" stroke-width="1" opacity="0.55"/>' +
    '<line x1="25" y1="26" x2="25" y2="42" stroke="' + BRASS + '" stroke-width="1" opacity="0.55"/>' +
    '<line x1="30" y1="26" x2="30" y2="42" stroke="' + BRASS + '" stroke-width="1" opacity="0.55"/>' +
    '<path d="M12 26 Q14 16, 25 14 Q36 16, 38 26 Z" fill="rgba(217,160,91,0.26)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
    '<circle cx="25" cy="11" r="2" fill="' + BRASS + '"/>'
  );

  var ICON_SALE = svg(
    /* Tartine garnie : pain + topping ovale */
    '<rect x="8" y="24" width="34" height="14" rx="2" fill="rgba(217,160,91,0.16)" stroke="' + BRASS + '" stroke-width="2"/>' +
    '<ellipse cx="25" cy="22" rx="13" ry="3.5" fill="rgba(217,160,91,0.30)" stroke="' + BRASS + '" stroke-width="1.6"/>' +
    '<line x1="14" y1="30" x2="36" y2="30" stroke="' + BRASS + '" stroke-width="1" opacity="0.5"/>'
  );

  /* === Petit-déj TYPE === */
  var ICON_PAIN = svg(
    /* Tranche de pain de mie */
    '<path d="M10 22 Q10 14, 18 12 Q25 9, 32 12 Q40 14, 40 22 L40 38 L10 38 Z" ' +
      'fill="rgba(217,160,91,0.16)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>' +
    '<line x1="14" y1="22" x2="36" y2="22" stroke="' + BRASS + '" stroke-width="1" opacity="0.55"/>'
  );

  var ICON_OEUFS_RONDS = svg(
    /* Œuf au plat rond — distinct de ICON_OEUFS (irrégulier) */
    '<ellipse cx="25" cy="25" rx="17" ry="13" fill="rgba(217,160,91,0.10)" stroke="' + BRASS + '" stroke-width="2"/>' +
    '<circle cx="25" cy="25" r="6" fill="' + BRASS + '" opacity="0.85"/>'
  );

  var ICON_CEREALES = svg(
    /* Épi de blé */
    '<line x1="25" y1="44" x2="25" y2="14" stroke="' + BRASS + '" stroke-width="1.8"/>' +
    '<ellipse cx="25" cy="12" rx="2.5" ry="4" fill="rgba(217,160,91,0.24)" stroke="' + BRASS + '" stroke-width="1.4"/>' +
    '<ellipse cx="20" cy="20" rx="2.4" ry="3.4" fill="rgba(217,160,91,0.20)" stroke="' + BRASS + '" stroke-width="1.4" transform="rotate(-30 20 20)"/>' +
    '<ellipse cx="30" cy="20" rx="2.4" ry="3.4" fill="rgba(217,160,91,0.20)" stroke="' + BRASS + '" stroke-width="1.4" transform="rotate(30 30 20)"/>' +
    '<ellipse cx="20" cy="26" rx="2.4" ry="3.4" fill="rgba(217,160,91,0.20)" stroke="' + BRASS + '" stroke-width="1.4" transform="rotate(-30 20 26)"/>' +
    '<ellipse cx="30" cy="26" rx="2.4" ry="3.4" fill="rgba(217,160,91,0.20)" stroke="' + BRASS + '" stroke-width="1.4" transform="rotate(30 30 26)"/>' +
    '<ellipse cx="20" cy="32" rx="2.4" ry="3.4" fill="rgba(217,160,91,0.20)" stroke="' + BRASS + '" stroke-width="1.4" transform="rotate(-30 20 32)"/>' +
    '<ellipse cx="30" cy="32" rx="2.4" ry="3.4" fill="rgba(217,160,91,0.20)" stroke="' + BRASS + '" stroke-width="1.4" transform="rotate(30 30 32)"/>'
  );

  var ICON_FRUITS = svg(
    /* Pomme */
    '<line x1="25" y1="14" x2="25" y2="10" stroke="' + BRASS + '" stroke-width="1.8" stroke-linecap="round"/>' +
    '<path d="M25 10 Q31 7, 33 12 Q28 13, 25 12 Z" fill="rgba(217,160,91,0.30)" stroke="' + BRASS + '" stroke-width="1.4" stroke-linejoin="round"/>' +
    '<path d="M25 14 C18 14, 12 18, 12 28 C12 38, 18 42, 22 42 C24 41, 26 41, 28 42 C32 42, 38 38, 38 28 C38 18, 32 14, 25 14 Z" ' +
      'fill="rgba(217,160,91,0.20)" stroke="' + BRASS + '" stroke-width="2" stroke-linejoin="round"/>'
  );

  /* === Dé pour "Surprends-moi" — couleur sombre car fond bouton laiton === */
  var ICON_DICE =
    '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" ' +
      'style="vertical-align:-4px;margin-right:7px">' +
      '<rect x="3.5" y="3.5" width="17" height="17" rx="3" ' +
        'fill="rgba(28,24,21,0.10)" stroke="' + DARK + '" stroke-width="2"/>' +
      '<circle cx="8" cy="8" r="1.6" fill="' + DARK + '"/>' +
      '<circle cx="16" cy="16" r="1.6" fill="' + DARK + '"/>' +
      '<circle cx="16" cy="8" r="1.6" fill="' + DARK + '"/>' +
      '<circle cx="8" cy="16" r="1.6" fill="' + DARK + '"/>' +
      '<circle cx="12" cy="12" r="1.6" fill="' + DARK + '"/>' +
    '</svg>';

  /* === Empty state (au lieu de 🤔) === */
  var ICON_EMPTY =
    '<svg viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">' +
      '<circle cx="32" cy="32" r="26" fill="rgba(217,160,91,0.10)" stroke="' + BRASS + '" stroke-width="2.5"/>' +
      '<path d="M22 24 Q22 16, 32 16 Q42 16, 42 24 Q42 30, 32 32 L32 38" ' +
        'fill="none" stroke="' + BRASS + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="32" cy="46" r="2.5" fill="' + BRASS + '"/>' +
    '</svg>';

  /* ---------- Fetch & cache ---------- */

  function fetchRecettes() {
    if (cache.promise) return cache.promise;
    if (cache.recettes && (Date.now() - cache.fetchedAt) < STALE_MS) {
      return Promise.resolve(cache.recettes);
    }
    var db = global.FamilyHubGetDb && global.FamilyHubGetDb();
    var hid = global.FamilyHubGetHouseholdId && global.FamilyHubGetHouseholdId();
    if (!db || !hid) return Promise.resolve([]);

    cache.promise = db.collection('households').doc(hid).collection('recettes').get()
      .then(function (snap) {
        var list = [];
        snap.forEach(function (doc) {
          var d = doc.data() || {};
          var seedTags = d.seedTags || {};
          var ingNames = '';
          if (d.ingredients && d.ingredients.length) {
            for (var i = 0; i < d.ingredients.length; i++) {
              ingNames += ' ' + (d.ingredients[i].libelle || '');
            }
          }
          var blob = (d.nom || '') + ' ' + (d.description || '') + ' ' +
                     ((d.tags || []).join(' ')) + ' ' + ingNames;

          list.push({
            id: doc.id,
            nom: d.nom || '(sans nom)',
            description: d.description || '',
            portions: d.portions || 4,
            tempsPrepMinutes: d.tempsPrepMinutes || 0,
            tempsCuissonMinutes: d.tempsCuissonMinutes || 0,
            difficulte: d.difficulte || 1,
            tags: d.tags || [],
            saison: d.saison || ['toutes'],
            notation: d.notation || null,
            statut: d.statut || 'accepted',
            ingredients: d.ingredients || [],
            etapes: d.etapes || [],
            createdAtMs: (d.createdAt && d.createdAt.toMillis) ? d.createdAt.toMillis() : 0,
            seedTags: seedTags,
            repas: seedTags.repas || '',
            proteine: seedTags.proteinePrincipale || '',
            style: deburr(seedTags.styleCulinaire || ''),
            blob: deburr(blob)
          });
        });
        cache.recettes = list;
        cache.fetchedAt = Date.now();
        cache.promise = null;
        return list;
      })
      .catch(function (err) {
        cache.promise = null;
        if (global.console && global.console.error) {
          global.console.error('[livreRecettes] fetch error', err);
        }
        return [];
      });
    return cache.promise;
  }

  function applyConfigFilter(recettes, config) {
    var filtreTags = (config && config.filtreTags) || [];
    if (filtreTags.length === 0) return recettes;
    var out = [];
    for (var i = 0; i < recettes.length; i++) {
      var r = recettes[i];
      var match = false;
      for (var j = 0; j < filtreTags.length && !match; j++) {
        if (r.tags) {
          for (var k = 0; k < r.tags.length; k++) {
            if (r.tags[k] === filtreTags[j]) { match = true; break; }
          }
        }
      }
      if (match) out.push(r);
    }
    return out;
  }

  /* ---------- Catalogues ---------- */

  var REPAS = [
    { key: 'petit-dej', svg: ICON_PETIT_DEJ, label: 'Petit-déj',
      keywords: ['petit-dej', 'petit dej', 'petit-dejeuner', 'petit dejeuner', 'breakfast', 'tartine', 'porridge', 'granola', 'pancake', 'crepe sucre'],
      seedRepas: ['petit-dej-sale', 'petit-dej-sucre'] },
    { key: 'dejeuner',  svg: ICON_DEJEUNER,  label: 'Déjeuner',
      keywords: ['dejeuner', 'lunch', 'midi'],
      seedRepas: ['dejeuner'] },
    { key: 'diner',     svg: ICON_DINER,     label: 'Dîner',
      keywords: ['diner', 'dinner', 'soir'],
      seedRepas: ['diner'] },
    { key: 'encas',     svg: ICON_ENCAS,     label: 'Goûter / Encas',
      keywords: ['gouter', 'encas', 'snack', 'collation'],
      seedRepas: [] }
  ];

  function matchRepas(r, key) {
    var def = null;
    for (var i = 0; i < REPAS.length; i++) if (REPAS[i].key === key) { def = REPAS[i]; break; }
    if (!def) return false;
    if (r.repas) {
      for (var s = 0; s < def.seedRepas.length; s++) {
        if (r.repas === def.seedRepas[s]) return true;
      }
      if (r.repas === 'tout' && (key === 'dejeuner' || key === 'diner')) return true;
    }
    for (var k = 0; k < def.keywords.length; k++) {
      if (r.blob.indexOf(def.keywords[k]) >= 0) return true;
    }
    return false;
  }

  var INGREDIENTS = [
    { key: 'poulet',  svg: ICON_POULET,  label: 'Poulet',
      proteines: ['viande-blanche'],
      keywords: ['poulet', 'volaille', 'dinde', 'pintade', 'canard', 'chapon'] },
    { key: 'boeuf',   svg: ICON_BOEUF,   label: 'Bœuf / Porc',
      proteines: ['viande-rouge'],
      keywords: ['boeuf', 'beef', 'porc', 'jambon', 'lard', 'agneau', 'veau', 'mouton', 'lapin'] },
    { key: 'poisson', svg: ICON_POISSON, label: 'Poisson',
      proteines: ['poisson'],
      keywords: ['poisson', 'saumon', 'thon', 'cabillaud', 'morue', 'truite', 'bar', 'dorade', 'maquereau', 'sardine', 'anchois', 'merlu', 'colin', 'crevette', 'crustace', 'moule', 'huitre', 'st-jacques', 'calamar', 'poulpe'] },
    { key: 'oeufs',   svg: ICON_OEUFS,   label: 'Œufs',
      proteines: ['oeufs'],
      keywords: ['oeuf', 'omelette', 'frittata', 'quiche', 'flan'] },
    { key: 'vege',    svg: ICON_VEGE,    label: 'Végé',
      proteines: ['aucune', 'legumineuses', 'tofu'],
      keywords: ['vege', 'vegetarien', 'lentille', 'pois chiche', 'haricot', 'tofu', 'tempeh', 'seitan', 'feve'] },
    { key: 'fromage', svg: ICON_FROMAGE, label: 'Fromage',
      proteines: ['fromage'],
      keywords: ['fromage', 'mozzarella', 'feta', 'parmesan', 'comte', 'gruyere', 'chevre', 'roquefort', 'camembert', 'reblochon', 'ricotta', 'mascarpone', 'cheddar', 'pecorino', 'manchego'] }
  ];

  function matchIngredient(r, key) {
    var def = null;
    for (var i = 0; i < INGREDIENTS.length; i++) if (INGREDIENTS[i].key === key) { def = INGREDIENTS[i]; break; }
    if (!def) return false;
    if (r.proteine) {
      for (var p = 0; p < def.proteines.length; p++) {
        if (r.proteine === def.proteines[p]) return true;
      }
    }
    for (var k = 0; k < def.keywords.length; k++) {
      if (r.blob.indexOf(def.keywords[k]) >= 0) return true;
    }
    return false;
  }

  var ACCOMPAGNEMENTS = [
    { key: 'vert',      svg: ICON_VERT,    label: 'Vert',
      keywords: ['epinard', 'brocoli', 'courgette', 'asperge', 'haricot vert', 'haricot plat', 'poireau', 'aubergine', 'chou ', 'chou-', 'choux', 'salade', 'roquette', 'pousse', 'mache', 'blette', 'edamame', 'bok choy', 'pak choi', 'champignon', 'petits pois', 'pois mange', 'feve fraiche'] },
    { key: 'frais',     svg: ICON_FRAIS,   label: 'Frais',
      keywords: ['tomate', 'concombre', 'poivron', 'avocat', 'radis', 'endive'] },
    { key: 'racine',    svg: ICON_RACINE,  label: 'Racine',
      keywords: ['carotte', 'fenouil', 'celeri', 'panais', 'navet', 'courge', 'butternut', 'potiron', 'betterave', 'rutabaga', 'topinambour'] },
    { key: 'pates-riz', svg: ICON_PATES,   label: 'Pâtes & Riz',
      keywords: ['pates', 'riz ', 'riz,', 'riz.', 'quinoa', 'nouille', 'vermicelle', 'semoule', 'boulgour', 'polenta', 'lasagne', 'gnocchi', 'couscous', 'tagliatelle', 'penne', 'fusilli', 'spaghetti', 'orzo', 'risotto', 'pad thai', 'pho'] },
    { key: 'patate',    svg: ICON_PATATE,  label: 'Patate',
      keywords: ['pomme de terre', 'patate douce', 'patate'] }
  ];

  function matchAccompagnement(r, key) {
    var def = null;
    for (var i = 0; i < ACCOMPAGNEMENTS.length; i++) if (ACCOMPAGNEMENTS[i].key === key) { def = ACCOMPAGNEMENTS[i]; break; }
    if (!def) return false;
    for (var k = 0; k < def.keywords.length; k++) {
      if (r.blob.indexOf(def.keywords[k]) >= 0) return true;
    }
    return false;
  }

  var INSPIRATIONS = [
    { key: 'francais',      svg: ICON_FRANCAIS,      label: 'Français',
      keywords: ['francais', 'francaise', 'bistro', 'tradition', 'terroir', 'normand', 'breton', 'savoyard', 'lyonnais', 'provencal'] },
    { key: 'italien',       svg: ICON_ITALIEN,       label: 'Italien',
      keywords: ['italien', 'italie', 'risotto', 'pasta', 'lasagne', 'tiramisu', 'pizza', 'bolognaise', 'carbonara', 'pesto', 'parmigiana'] },
    { key: 'mediterraneen', svg: ICON_MEDITERRANEEN, label: 'Méditerranéen',
      keywords: ['mediterraneen', 'mediterranee', 'grec', 'libanais', 'taboule', 'houmous', 'feta', 'olive', 'caponata'] },
    { key: 'asiatique',     svg: ICON_ASIATIQUE,     label: 'Asiatique',
      keywords: ['asiatique', 'thai', 'thailand', 'vietnamien', 'vietnam', 'japonais', 'japon', 'sushi', 'ramen', 'wok', 'chinois', 'coreen', 'bibimbap', 'pad thai', 'pho', 'curry vert', 'curry rouge'] },
    { key: 'indien',        svg: ICON_INDIEN,        label: 'Indien',
      keywords: ['indien', 'inde', 'curry', 'tikka', 'tandoori', 'masala', 'biryani', 'naan', 'dahl', 'samosa'] },
    { key: 'mexicain',      svg: ICON_MEXICAIN,      label: 'Mexicain',
      keywords: ['mexicain', 'mexique', 'tacos', 'burrito', 'enchilada', 'quesadilla', 'guacamole', 'salsa', 'fajitas'] },
    { key: 'espagnol',      svg: ICON_ESPAGNOL,      label: 'Espagnol',
      keywords: ['espagnol', 'espagne', 'paella', 'tapas', 'tortilla', 'gazpacho', 'chorizo', 'iberique'] },
    { key: 'oriental',      svg: ICON_ORIENTAL,      label: 'Oriental',
      keywords: ['marocain', 'maroc', 'tunisien', 'algerien', 'tagine', 'tajine', 'couscous', 'oriental', 'turc', 'kebab', 'pastilla', 'harira'] }
  ];

  function matchInspiration(r, key) {
    var def = null;
    for (var i = 0; i < INSPIRATIONS.length; i++) if (INSPIRATIONS[i].key === key) { def = INSPIRATIONS[i]; break; }
    if (!def) return false;
    for (var k = 0; k < def.keywords.length; k++) {
      if (r.blob.indexOf(def.keywords[k]) >= 0 || r.style.indexOf(def.keywords[k]) >= 0) return true;
    }
    return false;
  }

  var PETIT_DEJ_GOUT = [
    { key: 'sucre', svg: ICON_SUCRE, label: 'Sucré',
      seedRepas: ['petit-dej-sucre'],
      keywords: ['sucre', 'miel', 'confiture', 'chocolat', 'banane', 'pomme', 'fraise', 'framboise', 'myrtille', 'granola', 'porridge', 'pancake', 'crepe sucre', 'gaufre', 'brioche', 'pain perdu', 'viennois', 'muesli', 'compote', 'sirop'] },
    { key: 'sale',  svg: ICON_SALE,  label: 'Salé',
      seedRepas: ['petit-dej-sale'],
      keywords: ['oeuf', 'omelette', 'jambon', 'fromage', 'avocat', 'tartine', 'cheddar', 'bacon', 'saucisse', 'mozzarella', 'feta', 'comte', 'beurre sale'] }
  ];

  function matchPetitDejGout(r, key) {
    var def = null;
    for (var i = 0; i < PETIT_DEJ_GOUT.length; i++) if (PETIT_DEJ_GOUT[i].key === key) { def = PETIT_DEJ_GOUT[i]; break; }
    if (!def) return false;
    if (r.repas) {
      for (var s = 0; s < def.seedRepas.length; s++) {
        if (r.repas === def.seedRepas[s]) return true;
      }
    }
    for (var k = 0; k < def.keywords.length; k++) {
      if (r.blob.indexOf(def.keywords[k]) >= 0) return true;
    }
    return false;
  }

  var PETIT_DEJ_TYPE = [
    { key: 'pain',     svg: ICON_PAIN,        label: 'Pain & tartines',
      keywords: ['pain', 'tartine', 'baguette', 'brioche', 'pita', 'foccacia', 'biscotte', 'pain perdu'] },
    { key: 'oeufs',    svg: ICON_OEUFS_RONDS, label: 'Œufs',
      keywords: ['oeuf', 'omelette', 'frittata', 'scramble', 'shakshuka'] },
    { key: 'cereales', svg: ICON_CEREALES,    label: 'Céréales',
      keywords: ['muesli', 'granola', 'porridge', 'flocon', 'avoine', 'cereal', 'overnight oats', 'gruau'] },
    { key: 'fruits',   svg: ICON_FRUITS,      label: 'Fruits & yaourt',
      keywords: ['fruit', 'banane', 'pomme', 'fraise', 'framboise', 'poire', 'peche', 'mangue', 'ananas', 'kiwi', 'yaourt', 'smoothie', 'fromage blanc', 'compote', 'myrtille', 'mure'] }
  ];

  function matchPetitDejType(r, key) {
    var def = null;
    for (var i = 0; i < PETIT_DEJ_TYPE.length; i++) if (PETIT_DEJ_TYPE[i].key === key) { def = PETIT_DEJ_TYPE[i]; break; }
    if (!def) return false;
    for (var k = 0; k < def.keywords.length; k++) {
      if (r.blob.indexOf(def.keywords[k]) >= 0) return true;
    }
    return false;
  }

  /* ---------- Helpers dict ---------- */

  function dictHasAny(d) {
    for (var k in d) if (d.hasOwnProperty(k)) return true;
    return false;
  }
  function dictKeys(d) {
    var out = [];
    for (var k in d) if (d.hasOwnProperty(k)) out.push(k);
    return out;
  }

  /* ---------- Tuile compacte ---------- */

  function render(container, _data, config) {
    container.className = 'grid-cell tile-livre';
    container.innerHTML =
      '<div class="tile-title">Livre de recettes</div>' +
      '<div class="tile-livre-body">' +
        '<div class="tile-livre-icon">' + BOOK_SVG_LARGE + '</div>' +
        '<div class="tile-livre-count">…</div>' +
        '<div class="tile-livre-label">recettes</div>' +
      '</div>' +
      '<div class="tile-livre-cta">Toucher pour explorer</div>';

    fetchRecettes().then(function (all) {
      var list = applyConfigFilter(all, config);
      var countEl = container.querySelector('.tile-livre-count');
      var labelEl = container.querySelector('.tile-livre-label');
      if (!countEl) return;
      countEl.innerHTML = list.length;
      if (labelEl) labelEl.innerHTML = (list.length === 1 ? 'recette' : 'recettes');
    });
  }

  function cleanup(_container) { /* rien d'asynchrone à arrêter */ }

  /* ---------- Expand : wizard 2 étapes ---------- */

  function expand(container, _data, config, _tileId) {
    container.className = 'tile-overlay-content tile-overlay-content--full tile-livre-expand';
    container.innerHTML = '<div class="livre-wizard" data-role="wizard">Chargement…</div>';
    var wrap = container.querySelector('[data-role="wizard"]');

    var pickedRepas = {};
    var pickedIng   = {};
    var pickedAcc   = {};
    var pickedInsp  = {};
    var pickedGout  = {};
    var pickedType  = {};
    var pickedFrigo = []; /* Liste libre d'ingrédients tapés par l'utilisateur (chips) */
    var allRecettes = [];
    /* Scroll de la liste de résultats mémorisé avant d'ouvrir un détail, pour
       restaurer la position au retour (container = conteneur scrollable de l'overlay). */
    var savedListScrollTop = 0;

    fetchRecettes().then(function (list) {
      allRecettes = applyConfigFilter(list, config);
      goStep1();
    });

    function isPetitDejSeul() {
      var keys = dictKeys(pickedRepas);
      return keys.length === 1 && keys[0] === 'petit-dej';
    }

    /* ===== Étape 1 — choisir le(s) repas ===== */

    function goStep1() {
      var html = '' +
        '<div class="wiz-bar">' +
          '<button type="button" class="wiz-back" data-act="cancel">✕ Annuler</button>' +
          '<div class="wiz-step">Étape 1 / 2</div>' +
        '</div>' +
        '<h1 class="wiz-question">Quel repas&nbsp;?</h1>' +
        '<p class="wiz-hint">Tu peux en choisir plusieurs, ou aucun pour tout voir</p>' +
        '<div class="wiz-icon-grid wiz-cols-2">';
      for (var i = 0; i < REPAS.length; i++) {
        var r = REPAS[i];
        var active = pickedRepas[r.key] ? ' is-active' : '';
        html += '<button type="button" class="wiz-icon-btn' + active + '" data-key="' + r.key + '"' +
          ' aria-pressed="' + (pickedRepas[r.key] ? 'true' : 'false') + '">' +
          '<span class="wiz-icon-svg">' + r.svg + '</span>' +
          '<span class="wiz-icon-label">' + escapeHTML(r.label) + '</span>' +
          '</button>';
      }
      html += '</div>' +
        '<div class="wiz-actions">' +
          '<button type="button" class="wiz-secondary" data-act="all">Voir tout (' + allRecettes.length + ')</button>' +
          '<button type="button" class="wiz-primary" data-act="next">Suivant →</button>' +
        '</div>';
      wrap.innerHTML = html;

      var btns = wrap.querySelectorAll('.wiz-icon-btn');
      for (var b = 0; b < btns.length; b++) {
        btns[b].addEventListener('click', (function (btn, key) {
          return function () {
            if (pickedRepas[key]) {
              delete pickedRepas[key];
              btn.className = btn.className.replace(/\s*is-active\b/g, '');
              btn.setAttribute('aria-pressed', 'false');
            } else {
              pickedRepas[key] = true;
              btn.className += ' is-active';
              btn.setAttribute('aria-pressed', 'true');
            }
          };
        })(btns[b], btns[b].getAttribute('data-key')));
      }
      wrap.querySelector('[data-act="cancel"]').addEventListener('click', function () {
        if (global.FamilyHubOverlay && global.FamilyHubOverlay.close) global.FamilyHubOverlay.close();
      });
      wrap.querySelector('[data-act="all"]').addEventListener('click', function () {
        pickedRepas = {}; pickedIng = {}; pickedAcc = {}; pickedInsp = {};
        pickedGout = {}; pickedType = {};
        pickedFrigo = [];
        goStep2();
      });
      wrap.querySelector('[data-act="next"]').addEventListener('click', goStep2);
    }

    /* ===== Étape 2 — envies + résultats inline ===== */

    function goStep2() {
      var petitDej = isPetitDejSeul();
      if (petitDej) {
        pickedIng = {}; pickedAcc = {}; pickedInsp = {};
      } else {
        pickedGout = {}; pickedType = {};
      }

      var html = '' +
        '<div class="wiz-bar">' +
          '<button type="button" class="wiz-back" data-act="back">← Modifier le repas</button>' +
        '</div>' +
        '<h1 class="wiz-question">Quelle envie&nbsp;?</h1>' +
        '<p class="wiz-hint">' +
          (petitDej ? 'Choisis le profil de ton petit-déj, ou laisse vide pour tout voir'
                    : 'Combine ingrédient, accompagnement et inspiration') +
        '</p>' +
        '<div class="wiz-surprise-bar">' +
          '<button type="button" class="wiz-mini-surprise" data-act="surprise">' +
          ICON_DICE + 'Surprends-moi</button>' +
        '</div>' +
        '<div class="wiz-frigo">' +
          '<div class="wiz-frigo-title">Ce que j\'ai au frigo</div>' +
          '<p class="wiz-frigo-hint">Tape un ingrédient et valide (Entrée ou virgule). Les recettes utilisant tes ingrédients passent en haut.</p>' +
          '<div class="wiz-frigo-input-row">' +
            '<input type="text" class="wiz-frigo-input" data-role="frigo-input" ' +
              'aria-label="Ajouter un ingrédient que tu as au frigo" ' +
              'placeholder="ex: tomate, oignon, pâtes…" ' +
              'autocapitalize="off" autocorrect="off" spellcheck="false" />' +
            '<button type="button" class="wiz-frigo-add" data-act="frigo-add">Ajouter</button>' +
          '</div>' +
          '<div class="wiz-frigo-chips" data-role="frigo-chips"></div>' +
        '</div>';

      if (petitDej) {
        html += renderSection('gout',  'Sucré ou salé', PETIT_DEJ_GOUT, pickedGout, 'wiz-cols-2');
        html += renderSection('type',  'Par type',      PETIT_DEJ_TYPE, pickedType, 'wiz-cols-4');
      } else {
        html += renderSection('ing',   'Par ingrédient',     INGREDIENTS,     pickedIng,  'wiz-cols-3');
        html += renderSection('acc',   'Par accompagnement', ACCOMPAGNEMENTS, pickedAcc,  'wiz-cols-5');
        html += renderSection('insp',  'Par inspiration',    INSPIRATIONS,    pickedInsp, 'wiz-cols-4');
      }

      html += '<div class="wiz-actions wiz-actions-mid">' +
          '<button type="button" class="wiz-secondary wiz-btn-clear" data-act="clear">Effacer les envies</button>' +
        '</div>';

      html += '<div class="wiz-results" data-role="results"></div>';

      wrap.innerHTML = html;

      wrap.querySelector('[data-act="back"]').addEventListener('click', goStep1);
      wrap.querySelector('[data-act="clear"]').addEventListener('click', function () {
        pickedIng = {}; pickedAcc = {}; pickedInsp = {};
        pickedGout = {}; pickedType = {};
        pickedFrigo = [];
        goStep2();
      });
      wrap.querySelector('[data-act="surprise"]').addEventListener('click', function () {
        var list = filteredRecettes();
        if (list.length === 0) return;
        showDetail(list[Math.floor(Math.random() * list.length)].recette);
      });

      /* Frigo : input + bouton + chips */
      var frigoInput = wrap.querySelector('[data-role="frigo-input"]');
      var frigoAddBtn = wrap.querySelector('[data-act="frigo-add"]');
      function commitFrigoInput() {
        if (!frigoInput) return;
        var raw = frigoInput.value || '';
        /* Si l'utilisateur a tapé "tomate, oignon", on splitte en plusieurs */
        var parts = raw.split(',');
        for (var i = 0; i < parts.length; i++) {
          addFrigoItem(parts[i]);
        }
        frigoInput.value = '';
      }
      if (frigoInput) {
        frigoInput.addEventListener('keypress', function (ev) {
          if (ev.key === 'Enter' || ev.keyCode === 13) {
            ev.preventDefault();
            commitFrigoInput();
            /* Re-focus pour garder le clavier iOS ouvert — sans ça le
               clavier soft se ferme après le commit (renderFrigoChips
               mute le DOM et iOS perd le focus). */
            try { frigoInput.focus(); } catch (e) { /* noop */ }
          }
        });
        frigoInput.addEventListener('input', function () {
          /* Auto-commit à la virgule (la virgule reste dans l'input le temps qu'on splitte) */
          if (frigoInput.value.indexOf(',') !== -1) {
            commitFrigoInput();
          }
        });
        frigoInput.addEventListener('keydown', function (ev) {
          /* Backspace dans un input vide retire le dernier chip */
          if ((ev.key === 'Backspace' || ev.keyCode === 8) && frigoInput.value === '' && pickedFrigo.length > 0) {
            pickedFrigo.pop();
            renderFrigoChips();
            renderResults();
          }
        });
      }
      if (frigoAddBtn) {
        frigoAddBtn.addEventListener('click', function () {
          commitFrigoInput();
          if (frigoInput) frigoInput.focus();
        });
      }
      renderFrigoChips();

      bindSectionHandlers();
      renderResults();
    }

    function addFrigoItem(value) {
      if (value == null) return;
      var v = String(value).replace(/^\s+|\s+$/g, '');
      if (!v) return;
      var vNorm = deburr(v);
      /* Pas de doublon (insensible à la casse + accents) */
      for (var i = 0; i < pickedFrigo.length; i++) {
        if (deburr(pickedFrigo[i]) === vNorm) return;
      }
      pickedFrigo.push(v);
      renderFrigoChips();
      renderResults();
    }

    function renderFrigoChips() {
      var chipsEl = wrap.querySelector('[data-role="frigo-chips"]');
      if (!chipsEl) return;
      if (pickedFrigo.length === 0) {
        chipsEl.innerHTML = '';
        return;
      }
      var html = '';
      for (var i = 0; i < pickedFrigo.length; i++) {
        html += '<span class="wiz-frigo-chip" data-idx="' + i + '">' +
          escapeHTML(pickedFrigo[i]) +
          '<button type="button" class="wiz-frigo-chip-x" data-act="frigo-rm" data-idx="' + i + '" aria-label="Retirer">×</button>' +
          '</span>';
      }
      html += '<button type="button" class="wiz-frigo-clear" data-act="frigo-clear">Vider</button>';
      chipsEl.innerHTML = html;

      var rmBtns = chipsEl.querySelectorAll('[data-act="frigo-rm"]');
      for (var b = 0; b < rmBtns.length; b++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var idx = parseInt(btn.getAttribute('data-idx'), 10);
            if (!isNaN(idx)) {
              pickedFrigo.splice(idx, 1);
              renderFrigoChips();
              renderResults();
            }
          });
        })(rmBtns[b]);
      }
      var clearBtn = chipsEl.querySelector('[data-act="frigo-clear"]');
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          pickedFrigo = [];
          renderFrigoChips();
          renderResults();
        });
      }
    }

    function renderSection(name, title, items, dict, colsClass) {
      var allOn = true;
      for (var i = 0; i < items.length; i++) {
        if (!dict[items[i].key]) { allOn = false; break; }
      }
      var toggleLabel = allOn ? 'Tout décocher' : 'Tout cocher';

      var html = '<div class="wiz-section-row">' +
        '<div class="wiz-section-title">' + escapeHTML(title) + '</div>' +
        '<button type="button" class="wiz-toggle-all" data-section="' + name + '">' + toggleLabel + '</button>' +
        '</div>';

      html += '<div class="wiz-icon-grid ' + colsClass + '">';
      for (var j = 0; j < items.length; j++) {
        var it = items[j];
        var act = dict[it.key] ? ' is-active' : '';
        html += '<button type="button" class="wiz-icon-btn wiz-icon-btn-sm' + act + '"' +
          ' data-section="' + name + '" data-key="' + it.key + '"' +
          ' aria-pressed="' + (dict[it.key] ? 'true' : 'false') + '">' +
          '<span class="wiz-icon-svg">' + it.svg + '</span>' +
          '<span class="wiz-icon-label">' + escapeHTML(it.label) + '</span>' +
          '</button>';
      }
      html += '</div>';
      return html;
    }

    function dictForSection(name) {
      if (name === 'ing')  return pickedIng;
      if (name === 'acc')  return pickedAcc;
      if (name === 'insp') return pickedInsp;
      if (name === 'gout') return pickedGout;
      if (name === 'type') return pickedType;
      return null;
    }
    function itemsForSection(name) {
      if (name === 'ing')  return INGREDIENTS;
      if (name === 'acc')  return ACCOMPAGNEMENTS;
      if (name === 'insp') return INSPIRATIONS;
      if (name === 'gout') return PETIT_DEJ_GOUT;
      if (name === 'type') return PETIT_DEJ_TYPE;
      return [];
    }

    function bindSectionHandlers() {
      var btns = wrap.querySelectorAll('.wiz-icon-btn');
      for (var b = 0; b < btns.length; b++) {
        btns[b].addEventListener('click', (function (btn) {
          return function () {
            var sec = btn.getAttribute('data-section');
            var key = btn.getAttribute('data-key');
            var dict = dictForSection(sec);
            if (!dict) return;
            if (dict[key]) {
              delete dict[key];
              btn.className = btn.className.replace(/\s*is-active\b/g, '');
              btn.setAttribute('aria-pressed', 'false');
            } else {
              dict[key] = true;
              btn.className += ' is-active';
              btn.setAttribute('aria-pressed', 'true');
            }
            refreshToggleLabel(sec);
            renderResults();
          };
        })(btns[b]));
      }
      var togs = wrap.querySelectorAll('.wiz-toggle-all');
      for (var t = 0; t < togs.length; t++) {
        togs[t].addEventListener('click', (function (btn) {
          return function () {
            var sec = btn.getAttribute('data-section');
            var dict = dictForSection(sec);
            var items = itemsForSection(sec);
            if (!dict) return;
            var allOn = true;
            for (var i = 0; i < items.length; i++) {
              if (!dict[items[i].key]) { allOn = false; break; }
            }
            if (allOn) {
              for (var j = 0; j < items.length; j++) delete dict[items[j].key];
            } else {
              for (var k = 0; k < items.length; k++) dict[items[k].key] = true;
            }
            refreshSectionVisuals(sec);
            renderResults();
          };
        })(togs[t]));
      }
    }

    function refreshToggleLabel(name) {
      var dict = dictForSection(name);
      var items = itemsForSection(name);
      if (!dict) return;
      var allOn = true;
      for (var i = 0; i < items.length; i++) {
        if (!dict[items[i].key]) { allOn = false; break; }
      }
      var btn = wrap.querySelector('.wiz-toggle-all[data-section="' + name + '"]');
      if (btn) btn.innerHTML = allOn ? 'Tout décocher' : 'Tout cocher';
    }

    function refreshSectionVisuals(name) {
      var dict = dictForSection(name);
      if (!dict) return;
      var btns = wrap.querySelectorAll('.wiz-icon-btn[data-section="' + name + '"]');
      for (var i = 0; i < btns.length; i++) {
        var key = btns[i].getAttribute('data-key');
        var has = !!dict[key];
        var has2 = btns[i].className.indexOf('is-active') >= 0;
        if (has && !has2) btns[i].className += ' is-active';
        if (!has && has2) btns[i].className = btns[i].className.replace(/\s*is-active\b/g, '');
        btns[i].setAttribute('aria-pressed', has ? 'true' : 'false');
      }
      refreshToggleLabel(name);
    }

    /* ---------- Filtrage ---------- */

    function filteredRecettes() {
      var list = [];
      var petitDej = isPetitDejSeul();

      for (var i = 0; i < allRecettes.length; i++) {
        var r = allRecettes[i];

        if (dictHasAny(pickedRepas)) {
          var ok = false;
          for (var key in pickedRepas) {
            if (pickedRepas.hasOwnProperty(key) && matchRepas(r, key)) { ok = true; break; }
          }
          if (!ok) continue;
        }

        if (petitDej) {
          if (dictHasAny(pickedGout)) {
            var okG = false;
            for (var kg in pickedGout) {
              if (pickedGout.hasOwnProperty(kg) && matchPetitDejGout(r, kg)) { okG = true; break; }
            }
            if (!okG) continue;
          }
          if (dictHasAny(pickedType)) {
            var okT = false;
            for (var kt in pickedType) {
              if (pickedType.hasOwnProperty(kt) && matchPetitDejType(r, kt)) { okT = true; break; }
            }
            if (!okT) continue;
          }
        } else {
          if (dictHasAny(pickedIng)) {
            var okI = false;
            for (var ki in pickedIng) {
              if (pickedIng.hasOwnProperty(ki) && matchIngredient(r, ki)) { okI = true; break; }
            }
            if (!okI) continue;
          }
          if (dictHasAny(pickedAcc)) {
            var okA = false;
            for (var ka in pickedAcc) {
              if (pickedAcc.hasOwnProperty(ka) && matchAccompagnement(r, ka)) { okA = true; break; }
            }
            if (!okA) continue;
          }
          if (dictHasAny(pickedInsp)) {
            var okN = false;
            for (var kn in pickedInsp) {
              if (pickedInsp.hasOwnProperty(kn) && matchInspiration(r, kn)) { okN = true; break; }
            }
            if (!okN) continue;
          }
        }

        list.push(r);
      }

      /* Scoring frigo : compte ingrédients matchés (substring bidirectionnel
         + déaccentué + lowercase). Si frigo vide → matched=0 partout, ordre
         préservé. Si frigo non vide → garde uniquement matched > 0, trie par
         matched DESC puis missing ASC (favorise les recettes "presque complètes"). */
      var frigoNorm = [];
      for (var f = 0; f < pickedFrigo.length; f++) {
        var fn = deburr(pickedFrigo[f]);
        if (fn) frigoNorm.push(fn);
      }

      var scored = [];
      for (var j = 0; j < list.length; j++) {
        var rec = list[j];
        if (frigoNorm.length === 0) {
          scored.push({ recette: rec, matched: 0, missing: 0 });
          continue;
        }
        var ingsNorm = [];
        var ings = rec.ingredients || [];
        for (var k = 0; k < ings.length; k++) {
          ingsNorm.push(deburr(ings[k].libelle || ''));
        }
        var matched = 0;
        for (var fi = 0; fi < frigoNorm.length; fi++) {
          var fNorm = frigoNorm[fi];
          var hit = false;
          for (var ii = 0; ii < ingsNorm.length; ii++) {
            var ingN = ingsNorm[ii];
            if (ingN.indexOf(fNorm) !== -1 || fNorm.indexOf(ingN) !== -1) { hit = true; break; }
          }
          if (hit) matched++;
        }
        var missing = ingsNorm.length - matched;
        if (missing < 0) missing = 0;
        scored.push({ recette: rec, matched: matched, missing: missing });
      }

      if (frigoNorm.length > 0) {
        var onlyMatches = [];
        for (var m = 0; m < scored.length; m++) {
          if (scored[m].matched > 0) onlyMatches.push(scored[m]);
        }
        onlyMatches.sort(function (a, b) {
          if (b.matched !== a.matched) return b.matched - a.matched;
          return a.missing - b.missing;
        });
        return onlyMatches;
      }
      return scored;
    }

    function renderResults() {
      var resultsEl = wrap.querySelector('[data-role="results"]');
      if (!resultsEl) return;
      var list = filteredRecettes();
      var frigoActive = pickedFrigo.length > 0;

      var countLabel = list.length === 0 ? 'Aucune recette' :
        list.length === 1 ? '1 recette' : list.length + ' recettes';
      if (frigoActive && list.length > 0) {
        countLabel += ' avec au moins 1 ingrédient du frigo';
      }
      var html = '<div class="wiz-results-bar">' +
        '<span class="wiz-results-count">' + escapeHTML(countLabel) + '</span>' +
      '</div>';

      if (list.length === 0) {
        var emptyMsg = frigoActive
          ? 'Aucune recette ne contient un de tes ingrédients. Retire des chips ou élargis les filtres.'
          : 'Aucune recette ne correspond. Essaie de retirer un filtre.';
        html += '<div class="wiz-empty">' +
          '<div class="wiz-empty-icon">' + ICON_EMPTY + '</div>' +
          '<p>' + escapeHTML(emptyMsg) + '</p>' +
          '</div>';
      } else {
        var shuffled = list.slice();
        if (shuffled.length > 60) shuffled = shuffled.slice(0, 60);

        html += '<div class="livre-grid">';
        for (var i = 0; i < shuffled.length; i++) {
          var entry = shuffled[i];
          var r = entry.recette;
          var meta = [];
          var t = tempsTotal(r); if (t > 0) meta.push(t + ' min');
          if (r.portions) meta.push(r.portions + ' pers.');
          var badgeHtml = '';
          if (frigoActive) {
            badgeHtml = '<div class="livre-card-frigo">' +
              entry.matched + ' du frigo · ' + entry.missing + ' à acheter' +
              '</div>';
          }
          html += '<button type="button" class="livre-card" data-rid="' + escapeHTML(r.id) + '">' +
            '<div class="livre-card-name">' + escapeHTML(r.nom) + '</div>' +
            badgeHtml +
            '<div class="livre-card-meta">' + meta.join(' · ') + '</div>' +
            '</button>';
        }
        html += '</div>';
        if (list.length > 60) {
          html += '<p class="wiz-results-more">… affine les filtres pour voir plus précis (' +
            (list.length - 60) + ' autres)</p>';
        }
      }
      resultsEl.innerHTML = html;

      var cards = resultsEl.querySelectorAll('.livre-card');
      for (var c = 0; c < cards.length; c++) {
        cards[c].addEventListener('click', (function (rid) {
          return function () {
            for (var x = 0; x < allRecettes.length; x++) {
              if (allRecettes[x].id === rid) { showDetail(allRecettes[x]); return; }
            }
          };
        })(cards[c].getAttribute('data-rid')));
      }
    }

    /* ===== Détail recette ===== */

    function showDetail(r) {
      /* Mémorise la position de scroll de la liste pour la restaurer au retour. */
      savedListScrollTop = container.scrollTop || 0;
      var ingHtml = '';
      for (var i = 0; i < r.ingredients.length; i++) {
        var ing = r.ingredients[i];
        var qty = (ing.quantite || '') + (ing.unite ? ' ' + ing.unite : '');
        ingHtml += '<li><strong>' + escapeHTML(qty.replace(/^\s+|\s+$/g, '')) + '</strong> ' +
          escapeHTML(ing.libelle || '') + '</li>';
      }
      var stepHtml = '';
      var steps = (r.etapes || []).slice().sort(function (a, b) { return (a.ordre || 0) - (b.ordre || 0); });
      for (var s = 0; s < steps.length; s++) {
        var st = steps[s];
        stepHtml += '<li>' + escapeHTML(st.description || '') +
          (st.dureeMinutes ? ' <span class="livre-step-time">(' + st.dureeMinutes + ' min)</span>' : '') +
          '</li>';
      }
      var meta = [];
      var t = tempsTotal(r); if (t > 0) meta.push(t + ' min');
      if (r.portions) meta.push(r.portions + ' pers.');
      var difStr = ['', 'Facile', 'Moyen', 'Difficile'][r.difficulte] || '';
      if (difStr) meta.push(difStr);

      wrap.innerHTML = '' +
        '<div class="wiz-bar">' +
          '<button type="button" class="wiz-back" data-act="back-detail">← Retour à la liste</button>' +
        '</div>' +
        '<h2 class="livre-detail-name">' + escapeHTML(r.nom) + '</h2>' +
        '<div class="livre-detail-meta">' + meta.join(' · ') + '</div>' +
        (r.description ? '<p class="livre-detail-desc">' + escapeHTML(r.description) + '</p>' : '') +
        '<h3 class="livre-detail-h3">Ingrédients</h3>' +
        '<ul class="livre-detail-ing">' + ingHtml + '</ul>' +
        '<h3 class="livre-detail-h3">Étapes</h3>' +
        '<ol class="livre-detail-steps">' + stepHtml + '</ol>';

      wrap.querySelector('[data-act="back-detail"]').addEventListener('click', function () {
        goStep2();
        /* Restaure la position de scroll de la liste après le re-render. */
        container.scrollTop = savedListScrollTop;
      });
      container.scrollTop = 0;
    }
  }

  function collapse(container) { if (container) container.innerHTML = ''; }

  global.Tiles = global.Tiles || {};
  global.Tiles['livre-recettes'] = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse
  };
})(window);
