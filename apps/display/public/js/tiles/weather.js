/* tiles/weather.js — vue compacte (location sélectionnée) + vue plein écran (toutes les locations).
   ES5 vanilla, iOS 9 OK. SVG icônes héritées du legacy MenuMaster. */
(function (global) {
  'use strict';

  function iconSVG(iconKey) {
    var sun = '<circle cx="36" cy="36" r="14" fill="#E8A53C"/>'
      + '<g stroke="#E8A53C" stroke-width="3" stroke-linecap="round">'
      + '<line x1="36" y1="6" x2="36" y2="14"/>'
      + '<line x1="36" y1="58" x2="36" y2="66"/>'
      + '<line x1="6" y1="36" x2="14" y2="36"/>'
      + '<line x1="58" y1="36" x2="66" y2="36"/>'
      + '<line x1="14" y1="14" x2="20" y2="20"/>'
      + '<line x1="52" y1="52" x2="58" y2="58"/>'
      + '<line x1="58" y1="14" x2="52" y2="20"/>'
      + '<line x1="14" y1="58" x2="20" y2="52"/>'
      + '</g>';
    var moon = '<path d="M44 20 a18 18 0 1 0 14 28 a14 14 0 0 1 -14 -28 z" fill="#9AA5B1"/>';
    var cloud = '<path d="M18 46 q-10 0 -10 -10 q0 -8 8 -10 q1 -10 12 -10 q9 0 12 8 q2 -1 5 -1 q9 0 9 9 q7 1 7 8 q0 7 -8 7 z" fill="#9AA5B1"/>';
    var partly = '<circle cx="24" cy="22" r="10" fill="#E8A53C"/>'
      + '<g stroke="#E8A53C" stroke-width="2.5" stroke-linecap="round">'
      + '<line x1="24" y1="4" x2="24" y2="9"/>'
      + '<line x1="6" y1="22" x2="11" y2="22"/>'
      + '<line x1="11" y1="9" x2="14" y2="12"/>'
      + '</g>'
      + '<path d="M22 50 q-10 0 -10 -10 q0 -8 8 -10 q1 -8 11 -8 q8 0 11 6 q2 -1 5 -1 q9 0 9 9 q7 1 7 8 q0 6 -8 6 z" fill="#9AA5B1"/>';
    var rain = '<path d="M18 36 q-10 0 -10 -10 q0 -8 8 -10 q1 -10 12 -10 q9 0 12 8 q2 -1 5 -1 q9 0 9 9 q7 1 7 8 q0 7 -8 7 z" fill="#7B8794"/>'
      + '<g stroke="#3E7CB1" stroke-width="3" stroke-linecap="round">'
      + '<line x1="20" y1="50" x2="16" y2="62"/>'
      + '<line x1="34" y1="50" x2="30" y2="62"/>'
      + '<line x1="48" y1="50" x2="44" y2="62"/>'
      + '</g>';
    var snow = '<path d="M18 36 q-10 0 -10 -10 q0 -8 8 -10 q1 -10 12 -10 q9 0 12 8 q2 -1 5 -1 q9 0 9 9 q7 1 7 8 q0 7 -8 7 z" fill="#9AA5B1"/>'
      + '<g fill="#FFFFFF" stroke="#3E7CB1" stroke-width="1.5">'
      + '<circle cx="20" cy="56" r="3"/>'
      + '<circle cx="36" cy="60" r="3"/>'
      + '<circle cx="52" cy="56" r="3"/>'
      + '</g>';
    var fog = '<path d="M18 30 q-10 0 -10 -10 q0 -8 8 -10 q1 -10 12 -10 q9 0 12 8 q2 -1 5 -1 q9 0 9 9 q7 1 7 8 q0 7 -8 7 z" fill="#B7B7B0" transform="translate(0,8)"/>'
      + '<g stroke="#7B8794" stroke-width="3" stroke-linecap="round">'
      + '<line x1="10" y1="52" x2="58" y2="52"/>'
      + '<line x1="14" y1="60" x2="54" y2="60"/>'
      + '</g>';
    var storm = '<path d="M18 32 q-10 0 -10 -10 q0 -8 8 -10 q1 -10 12 -10 q9 0 12 8 q2 -1 5 -1 q9 0 9 9 q7 1 7 8 q0 7 -8 7 z" fill="#5D6470"/>'
      + '<polygon points="32,40 24,56 32,56 28,68 44,50 36,50 40,40" fill="#E8A53C"/>';

    var inner;
    switch (iconKey) {
      case 'sun': inner = sun; break;
      case 'moon': inner = moon; break;
      case 'cloud-sun':
      case 'cloud-moon': inner = partly; break;
      case 'rain': inner = rain; break;
      case 'snow': inner = snow; break;
      case 'fog': inner = fog; break;
      case 'storm': inner = storm; break;
      default: inner = cloud;
    }
    return '<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">' + inner + '</svg>';
  }

  /* --- Helpers communs --- */
  function findLocation(config, id) {
    var locs = (config && config.locations) || [];
    for (var i = 0; i < locs.length; i++) {
      if (locs[i].id === id) return locs[i];
    }
    return null;
  }

  function selectedLocation(config) {
    var locs = (config && config.locations) || [];
    if (locs.length === 0) return null;
    var sel = findLocation(config, config.selectedLocationId);
    return sel || locs[0];
  }

  function dataFor(data, locId) {
    var by = data && data.byLocation;
    return (by && by[locId]) ? by[locId] : null;
  }

  /* --- Vue COMPACTE (cell de la grille) --- */
  function render(container, data, config) {
    container.className = 'grid-cell tile-weather tile-clickable';
    container.innerHTML = '';

    var loc = selectedLocation(config);
    var ld = loc ? dataFor(data, loc.id) : null;
    var locs = (config && config.locations) || [];

    var titleEl = document.createElement('div');
    titleEl.className = 'tile-title';
    var titleText = 'Météo';
    if (loc && loc.ville) titleText += ' — ' + loc.ville;
    if (locs.length > 1) titleText += ' (' + locs.length + ')';
    titleEl.innerHTML = titleText;
    container.appendChild(titleEl);

    var wrap = document.createElement('div');
    wrap.className = 'tile-weather-compact';
    container.appendChild(wrap);

    if (!loc) {
      wrap.innerHTML = '<div class="tile-weather-label">Aucune ville configurée</div>';
      return;
    }
    /* Garde contre un snapshot partiel : si current/daily manquent, on
       retombe sur "en attente" plutôt que de throw (ce qui figerait la
       tuile sur "Erreur rendu" via le catch de renderTile). */
    if (!ld || !ld.current || !ld.daily) {
      wrap.innerHTML = '<div class="tile-weather-label">En attente des données…</div>';
      return;
    }

    var temp = Math.round(ld.current.tempC);
    var minC = Math.round(ld.daily.minC);
    var maxC = Math.round(ld.daily.maxC);

    /* Layout : icône + temp côte à côte, puis label, puis min/max, puis hint. */
    wrap.innerHTML =
      '<div class="tile-weather-row">' +
        '<div class="tile-weather-icon">' + iconSVG(ld.current.iconKey) + '</div>' +
        '<div class="tile-weather-temp">' + temp + '°</div>' +
      '</div>' +
      '<div class="tile-weather-label">' + ld.current.label + '</div>' +
      '<div class="tile-weather-range">Min ' + minC + '° &nbsp;·&nbsp; Max ' + maxC + '°</div>' +
      (locs.length > 1 ? '<div class="tile-weather-hint">Touche pour changer de ville</div>' : '');
  }

  function cleanup(container) {
    container.innerHTML = '';
  }

  /* --- Vue PLEIN ÉCRAN (overlay) — design « Alpage + Veillée » ---
     Barre (overlay.js, tete()) : « Météo », ville + nombre de jours, et les
     villes en boutons (≤ 3 ; au-delà, rangée en haut du contenu). Toucher une
     ville la choisit (config.selectedLocationId, comme avant).
     Contenu : carte du moment (icône, température, ciel, min/max, lever et
     coucher du soleil, prochaines heures), puis les jours en 7 colonnes.
     Styles : css/plein-ecran.css (fh-mt-*). */

  var JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  var MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var VILLES_MAX_BARRE = 3;

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* « 12° » ; jamais « -0° ». '' si la valeur n'est pas un nombre. */
  function degres(v) {
    if (typeof v !== 'number' || isNaN(v)) return '';
    var n = Math.round(v);
    if (n === 0) n = 0;
    return n + '°';
  }

  /* Libellé d'une colonne de jour. idx 0 = aujourd'hui, 1 = demain (les jours
     du snapshot commencent aujourd'hui). isoDate « YYYY-MM-DD » lue comme date
     locale. → { nom: 'Aujourd'hui' | 'Demain' | 'Mercredi', date: '28 oct.' } */
  function libelleJour(isoDate, idx) {
    var parts = String(isoDate || '').split('-');
    var d = parts.length === 3
      ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
      : null;
    if (d && isNaN(d.getTime())) d = null;
    var nom = idx === 0 ? 'Aujourd\'hui' : (idx === 1 ? 'Demain' : (d ? JOURS[d.getDay()] : ''));
    var date = d ? d.getDate() + ' ' + MOIS_COURTS[d.getMonth()] : '';
    return { nom: nom, date: date };
  }

  /* Prochaines heures du snapshot (forecast, offsets > 0, 3 au plus).
     → [{ quand: 'Dans 6 h', temp: '9°', iconKey }] */
  function prochainesHeures(ld) {
    var f = (ld && ld.forecast) || [];
    var out = [];
    for (var i = 0; i < f.length && out.length < 3; i++) {
      var h = f[i] || {};
      if (!(h.hourOffset > 0) || typeof h.tempC !== 'number') continue;
      out.push({ quand: 'Dans ' + h.hourOffset + ' h', temp: degres(h.tempC), iconKey: h.iconKey });
    }
    return out;
  }

  /* Données utilisables d'une ville : current ET daily, sinon null. */
  function donneesVille(data, locId) {
    var ld = dataFor(data, locId);
    return ld && ld.current && ld.daily ? ld : null;
  }

  var ICONE_LEVER =
    '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" class="fh-mt-soleil-icone">' +
      '<path d="M4 18 H20 M7.5 18 A4.5 4.5 0 0 1 16.5 18 M12 6 V10 M9.5 8 L12 5.5 L14.5 8 M5 12.5 L6.5 13.5 M19 12.5 L17.5 13.5" ' +
        'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';
  var ICONE_COUCHER =
    '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" class="fh-mt-soleil-icone">' +
      '<path d="M4 18 H20 M7.5 18 A4.5 4.5 0 0 1 16.5 18 M12 5.5 V9.5 M9.5 7.5 L12 10 L14.5 7.5 M5 12.5 L6.5 13.5 M19 12.5 L17.5 13.5" ' +
        'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
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

  function titresHtml(titre, sousTitre) {
    return '<div class="fh-pe-titres">' +
      '<div class="fh-pe-titre fh-titre fh-texte">' + escapeHtml(titre) + '</div>' +
      (sousTitre ? '<div class="fh-pe-sous-titre fh-texte-doux">' + escapeHtml(sousTitre) + '</div>' : '') +
      '</div>';
  }

  function heroHtml(ld) {
    var html = '<div class="fh-mt-hero fh-pe-carte fh-carte fh-bordure">';
    html += '<div class="fh-mt-hero-icone">' + iconSVG(ld.current.iconKey) + '</div>';
    html += '<div class="fh-mt-hero-temp fh-titre fh-texte">' + degres(ld.current.tempC) + '</div>';
    html += '<div class="fh-mt-hero-infos">';
    html += '<div class="fh-mt-hero-ciel fh-titre fh-texte">' + escapeHtml(ld.current.label || '') + '</div>';
    html += '<div class="fh-mt-hero-minmax fh-texte">Min ' + degres(ld.daily.minC) +
      ' · <span class="fh-mt-minmax-max">Max ' + degres(ld.daily.maxC) + '</span></div>';
    if (ld.daily.sunrise || ld.daily.sunset) {
      html += '<div class="fh-mt-hero-soleil fh-texte-doux">';
      if (ld.daily.sunrise) html += '<div class="fh-mt-soleil">' + ICONE_LEVER + '<span>Lever ' + escapeHtml(ld.daily.sunrise) + '</span></div>';
      if (ld.daily.sunset) html += '<div class="fh-mt-soleil">' + ICONE_COUCHER + '<span>Coucher ' + escapeHtml(ld.daily.sunset) + '</span></div>';
      html += '</div>';
    }
    html += '</div>';
    var heures = prochainesHeures(ld);
    if (heures.length > 0) {
      html += '<div class="fh-mt-heures">';
      for (var i = 0; i < heures.length; i++) {
        html += '<div class="fh-mt-heure">' +
          '<div class="fh-mt-heure-quand fh-texte-doux">' + escapeHtml(heures[i].quand) + '</div>' +
          '<div class="fh-mt-heure-icone">' + iconSVG(heures[i].iconKey) + '</div>' +
          '<div class="fh-mt-heure-temp fh-texte">' + heures[i].temp + '</div>' +
          '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function semaineHtml(weekly) {
    var html = '<div class="fh-mt-semaine">';
    for (var d = 0; d < weekly.length; d++) {
      var day = weekly[d] || {};
      var lib = libelleJour(day.date, d);
      var auj = d === 0;
      html += '<div class="fh-mt-jour fh-carte fh-bordure' + (auj ? ' fh-mt-jour-aujourdhui' : '') + '">';
      html += '<div class="fh-mt-jour-nom fh-titre ' + (auj ? 'fh-maintenant' : 'fh-texte') + '">' + escapeHtml(lib.nom) + '</div>';
      html += '<div class="fh-mt-jour-date fh-texte-doux">' + escapeHtml(lib.date) + '</div>';
      html += '<div class="fh-mt-jour-icone">' + iconSVG(day.iconKey) + '</div>';
      html += '<div class="fh-mt-jour-max fh-titre fh-texte">' + degres(day.maxC) + '</div>';
      html += '<div class="fh-mt-jour-min fh-texte-doux">' + degres(day.minC) + '</div>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  function expand(container, data, config) {
    container.innerHTML = '';
    container.className = 'tile-overlay-content tile-overlay-content--full fh-pe-fixe fh-mt';

    var locs = (config && config.locations) || [];
    var selectedId = config && config.selectedLocationId;
    if (!selectedId && locs.length > 0) selectedId = locs[0].id;

    var corps = document.createElement('div');
    corps.className = 'fh-pe-corps';
    corps.setAttribute('data-scroll-lock', '1');
    container.appendChild(corps);

    if (locs.length === 0) {
      zoneTete(container).innerHTML = titresHtml('Météo', '');
      corps.innerHTML = '<div class="fh-pe-message fh-texte-doux">Aucune ville configurée.<br>Ajoute des villes depuis le hub.</div>';
      return;
    }

    function findLoc(id) {
      for (var i = 0; i < locs.length; i++) if (locs[i].id === id) return locs[i];
      return locs[0];
    }

    function villesHtml(dansBarre) {
      var html = '<div class="fh-mt-villes' + (dansBarre ? '' : ' fh-mt-villes-contenu') + '">';
      for (var i = 0; i < locs.length; i++) {
        var l = locs[i];
        var lld = dataFor(data, l.id);
        var actif = l.id === selectedId;
        html += '<button type="button" class="fh-pe-btn fh-mt-ville-btn fh-carte fh-texte fh-bordure fh-corps' +
          (actif ? ' is-active' : '') + '" data-loc-id="' + escapeHtml(l.id) + '"' +
          ' aria-pressed="' + (actif ? 'true' : 'false') + '">' +
          '<span class="fh-pe-dedans">' +
          (lld && lld.current ? '<span class="fh-mt-ville-icone">' + iconSVG(lld.current.iconKey) + '</span>' : '') +
          '<span>' + escapeHtml(l.ville) + '</span>' +
          (lld && lld.current ? '<span class="fh-mt-ville-temp">' + degres(lld.current.tempC) + '</span>' : '') +
          '</span></button>';
      }
      html += '</div>';
      return html;
    }

    function renderBody() {
      var loc = findLoc(selectedId);
      var ld = donneesVille(data, loc.id);
      var weekly = (ld && ld.weekly) || [];
      var villesEnBarre = locs.length > 1 && locs.length <= VILLES_MAX_BARRE;

      var tete = zoneTete(container);
      tete.innerHTML = titresHtml('Météo', loc.ville +
        (weekly.length > 1 ? ' · prévisions sur ' + weekly.length + ' jours' : '')) +
        (villesEnBarre ? villesHtml(true) : '');

      var html = '';
      if (locs.length > VILLES_MAX_BARRE) html += villesHtml(false);
      if (ld) {
        html += heroHtml(ld);
        if (weekly.length > 0) {
          html += '<h2 class="fh-pe-section-titre fh-titre fh-texte">Les prochains jours</h2>';
          html += semaineHtml(weekly);
        }
      } else {
        html += '<div class="fh-pe-message fh-texte-doux">Pas encore de données pour ' + escapeHtml(loc.ville) + '.</div>';
      }
      corps.innerHTML = html;

      /* Choix de la ville : boutons de la barre ou du contenu. */
      var zones = [tete, corps];
      for (var z = 0; z < zones.length; z++) {
        var btns = zones[z].querySelectorAll('[data-loc-id]');
        for (var k = 0; k < btns.length; k++) {
          btns[k].addEventListener('click', choisirVille);
        }
      }
    }

    function choisirVille() {
      var newId = this.getAttribute('data-loc-id');
      if (!newId || newId === selectedId) return;
      selectedId = newId;
      /* Persiste sur Firestore — la tuile principale du dashboard se mettra à jour. */
      if (global.FamilyHubUpdateTileConfig) {
        global.FamilyHubUpdateTileConfig(container._tileId, { selectedLocationId: newId });
      }
      renderBody();
      corps.scrollTop = 0;
    }

    renderBody();
  }

  function collapse(container) {
    container.innerHTML = '';
  }

  global.Tiles = global.Tiles || {};
  global.Tiles.weather = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse,
    /* Fonctions pures (testées par packages/design/src/displayMeteo.test.ts). */
    libelleJour: libelleJour,
    prochainesHeures: prochainesHeures,
    degres: degres
  };
})(window);
