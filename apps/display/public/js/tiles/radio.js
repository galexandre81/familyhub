/* tiles/radio.js — vue compacte (dans la tuile) + vue plein écran (overlay).
   L'audio est géré par window.FamilyHubAudio (singleton, persiste). */
(function (global) {
  'use strict';

  /**
   * Vue COMPACTE — affichée dans la cell de la grille.
   *  - Bouton play/pause central : tap = lecture/pause (sans ouvrir l'overlay)
   *  - Tap autour du bouton = ouvrir overlay pour gérer les stations
   */
  function render(container, _data, config) {
    container.className = 'grid-cell tile-radio tile-clickable';
    container.innerHTML = '';

    var stations = (config && config.stations) ? config.stations : [];
    var defaultStationId = (config && config.defaultStationId) ? config.defaultStationId : (stations[0] && stations[0].id);
    container._radioConfig = config || {};

    function findDefaultStation() {
      for (var i = 0; i < stations.length; i++) {
        if (stations[i].id === defaultStationId) return stations[i];
      }
      return stations[0] || null;
    }

    var titleEl = document.createElement('div');
    titleEl.className = 'tile-title';
    titleEl.innerHTML = 'Radio';
    container.appendChild(titleEl);

    var center = document.createElement('div');
    center.className = 'tile-radio-compact';
    container.appendChild(center);

    /* Icônes SVG laiton 110px — taille comparable au sablier minuteur, sans cercle. */
    var ICON_PLAY =
      '<svg viewBox="0 0 100 100" width="96" height="96">' +
      '<path d="M 26 12 L 88 50 L 26 88 Z" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>' +
      '</svg>';
    var ICON_PAUSE =
      '<svg viewBox="0 0 100 100" width="96" height="96">' +
      '<rect x="22" y="14" width="20" height="72" rx="3" fill="currentColor"/>' +
      '<rect x="58" y="14" width="20" height="72" rx="3" fill="currentColor"/>' +
      '</svg>';
    var ICON_LOADING =
      '<svg viewBox="0 0 100 100" width="100" height="100">' +
      '<circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-dasharray="70 240">' +
      '<animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="1s" repeatCount="indefinite"/>' +
      '</circle>' +
      '</svg>';
    var ICON_ERROR =
      '<svg viewBox="0 0 100 100" width="100" height="100">' +
      '<path d="M50 12 L90 82 L10 82 Z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/>' +
      '<rect x="46" y="36" width="8" height="26" rx="2" fill="currentColor"/>' +
      '<rect x="46" y="66" width="8" height="8" rx="2" fill="currentColor"/>' +
      '</svg>';

    /* Bouton play/pause (tappable indépendamment de l'expand) */
    var playBtn = document.createElement('button');
    playBtn.className = 'tile-radio-compact-btn';
    playBtn.setAttribute('aria-label', 'Play / Pause');
    playBtn.innerHTML = ICON_PLAY;
    /* IMPORTANT iOS 9 : play() doit être SYNCHRONE dans le handler de tap. */
    playBtn.addEventListener('click', function (e) {
      e.stopPropagation(); /* ne pas ouvrir l'overlay */
      var s = global.FamilyHubAudio.getState();
      if (s.playing) {
        global.FamilyHubAudio.pause();
      } else if (s.currentStation) {
        global.FamilyHubAudio.play(s.currentStation);
      } else {
        var def = findDefaultStation();
        if (def) global.FamilyHubAudio.play(def);
      }
    });
    center.appendChild(playBtn);

    var stationEl = document.createElement('div');
    stationEl.className = 'tile-radio-compact-station';
    stationEl.innerHTML = stations.length + ' station' + (stations.length > 1 ? 's' : '');
    center.appendChild(stationEl);

    var statusEl = document.createElement('div');
    statusEl.className = 'tile-radio-compact-status';
    statusEl.innerHTML = 'Touche ▶ pour ' + (findDefaultStation() ? findDefaultStation().nom : 'lire');
    center.appendChild(statusEl);

    /* Subscribe to audio singleton state.
       Le status text est masqué sauf en cas d'erreur — l'icône (play/pause) et
       la couleur (sage = lecture, brass = pause) communiquent l'état visuellement. */
    var unsub = global.FamilyHubAudio.subscribe(function (state) {
      if (state.error) {
        playBtn.innerHTML = ICON_ERROR;
        playBtn.className = 'tile-radio-compact-btn error';
        playBtn.setAttribute('aria-label', 'Erreur radio — réessayer');
        stationEl.innerHTML = state.currentStation ? state.currentStation.nom : '—';
        statusEl.innerHTML = state.error;
        statusEl.style.display = '';
      } else if (state.loading) {
        playBtn.innerHTML = ICON_LOADING;
        playBtn.className = 'tile-radio-compact-btn loading';
        playBtn.setAttribute('aria-label', 'Chargement de la radio');
        stationEl.innerHTML = state.currentStation ? state.currentStation.nom : '—';
        statusEl.innerHTML = '';
        statusEl.style.display = 'none';
      } else if (state.playing) {
        playBtn.innerHTML = ICON_PAUSE;
        playBtn.className = 'tile-radio-compact-btn playing';
        playBtn.setAttribute('aria-label', 'Mettre la radio en pause');
        stationEl.innerHTML = state.currentStation ? state.currentStation.nom : '—';
        statusEl.innerHTML = '';
        statusEl.style.display = 'none';
      } else if (state.currentStation) {
        playBtn.innerHTML = ICON_PLAY;
        playBtn.className = 'tile-radio-compact-btn';
        playBtn.setAttribute('aria-label', 'Reprendre la radio (' + state.currentStation.nom + ')');
        stationEl.innerHTML = state.currentStation.nom;
        statusEl.innerHTML = '';
        statusEl.style.display = 'none';
      } else {
        playBtn.innerHTML = ICON_PLAY;
        playBtn.className = 'tile-radio-compact-btn';
        var def = findDefaultStation();
        playBtn.setAttribute('aria-label', def ? 'Lire ' + def.nom : 'Lire la radio');
        stationEl.innerHTML = def ? def.nom : (stations.length + ' station' + (stations.length > 1 ? 's' : ''));
        statusEl.innerHTML = '';
        statusEl.style.display = 'none';
      }
    });

    container._radioUnsub = unsub;
  }

  function cleanup(container) {
    if (typeof container._radioUnsub === 'function') {
      try { container._radioUnsub(); } catch (e) { /* noop */ }
      container._radioUnsub = null;
    }
    container.innerHTML = '';
  }

  /* --- Vue PLEIN ÉCRAN — design « Alpage + Veillée » ---
     Barre (overlay.js, tete()) : « Radio », l'état en sous-titre, et
     « Arrêter » quand une station joue. Contenu : les stations en grandes
     cartes (3 par ligne) ; celle qui joue est en jaune (fh-maintenant).
     Toucher une station la lance ; toucher celle qui joue la met en pause.
     Styles : css/plein-ecran.css (fh-ra-*). */

  function escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* État d'une station d'après l'état du lecteur (audio-singleton.js) :
     'erreur' | 'chargement' | 'lecture' | 'pause' pour la station courante,
     null pour les autres. */
  function etatStation(state, station) {
    var s = state || {};
    if (!station || !s.currentStation || s.currentStation.id !== station.id) return null;
    if (s.error) return 'erreur';
    if (s.loading) return 'chargement';
    if (s.playing) return 'lecture';
    return 'pause';
  }

  /* Sous-titre de la barre : ce que fait la radio, en une phrase. */
  function sousTitreRadio(state, nbStations) {
    var s = state || {};
    var nom = s.currentStation && s.currentStation.nom ? s.currentStation.nom : '';
    var etat = etatStation(s, s.currentStation);
    if (etat === 'erreur') return (nom ? nom + ' : ' : '') + (s.error || 'indisponible');
    if (etat === 'chargement') return 'Connexion à ' + nom + '…';
    if (etat === 'lecture') return 'En écoute : ' + nom;
    if (etat === 'pause') return nom + ' en pause';
    if (!nbStations) return 'Aucune station';
    return 'Touche une station pour l\'écouter';
  }

  var LIBELLES_ETAT = {
    lecture: 'En écoute · toucher pour couper',
    pause: 'En pause · toucher pour reprendre',
    chargement: 'Connexion…',
    erreur: 'Indisponible · toucher pour réessayer'
  };

  function svg(inner, taille) {
    return '<svg viewBox="0 0 24 24" width="' + taille + '" height="' + taille + '" aria-hidden="true">' + inner + '</svg>';
  }
  var IC_LECTURE = '<path d="M8 5 L19 12 L8 19 Z" fill="currentColor"/>';
  var IC_PAUSE = '<rect x="6" y="5" width="4.5" height="14" rx="1" fill="currentColor"/>' +
    '<rect x="13.5" y="5" width="4.5" height="14" rx="1" fill="currentColor"/>';
  var IC_ATTENTE = '<circle cx="6" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/>' +
    '<circle cx="18" cy="12" r="2" fill="currentColor"/>';
  var IC_ERREUR = '<path d="M12 4 L21 19 L3 19 Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>' +
    '<path d="M12 10 V14 M12 16.5 V16.6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>';
  var IC_STOP = '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/>';

  function iconeEtat(etat) {
    if (etat === 'lecture') return IC_PAUSE;
    if (etat === 'chargement') return IC_ATTENTE;
    if (etat === 'erreur') return IC_ERREUR;
    return IC_LECTURE;
  }

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

  function expand(container, _data, config) {
    container.innerHTML = '';
    container.className = 'tile-overlay-content tile-overlay-content--full fh-pe-fixe fh-ra';

    var stations = (config && config.stations) ? config.stations : [];
    var audio = global.FamilyHubAudio;

    var corps = document.createElement('div');
    corps.className = 'fh-pe-corps';
    corps.setAttribute('data-scroll-lock', '1');
    container.appendChild(corps);

    /* Barre : titres + « Arrêter » (visible seulement quand ça joue). */
    var tete = zoneTete(container);
    var titres = document.createElement('div');
    titres.className = 'fh-pe-titres';
    titres.innerHTML = '<div class="fh-pe-titre fh-titre fh-texte">Radio</div>' +
      '<div class="fh-pe-sous-titre fh-texte-doux"></div>';
    tete.appendChild(titres);
    var sousTitreEl = titres.lastChild;

    /* iOS 9 : pas de flex sur un <button> ; contenu dans un span. */
    var stopBtn = document.createElement('button');
    stopBtn.type = 'button';
    stopBtn.className = 'fh-pe-btn fh-ra-arreter-btn fh-action fh-corps';
    stopBtn.innerHTML = '<span class="fh-pe-dedans">' +
      svg(IC_STOP, 26).replace('<svg ', '<svg class="fh-pe-icone" ') + '<span>Arrêter</span></span>';
    stopBtn.style.display = 'none';
    stopBtn.addEventListener('click', function () { if (audio) audio.pause(); });
    tete.appendChild(stopBtn);

    var erreurEl = document.createElement('div');
    erreurEl.className = 'fh-ra-erreur fh-carte fh-texte';
    erreurEl.style.display = 'none';
    corps.appendChild(erreurEl);

    if (stations.length === 0) {
      var vide = document.createElement('div');
      vide.className = 'fh-pe-message fh-texte-doux';
      vide.innerHTML = 'Aucune station.<br>Ajoute des stations depuis le hub.';
      corps.appendChild(vide);
    }

    var listEl = document.createElement('div');
    listEl.className = 'fh-ra-stations';
    corps.appendChild(listEl);

    /* Cartes des stations. Le contenu est réécrit seulement si l'état de la
       station change (sinon un toucher en cours sauterait). */
    var cartes = [];
    for (var i = 0; i < stations.length; i++) {
      (function (st) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('aria-pressed', 'false');
        /* IMPORTANT iOS 9 : appel synchrone à FamilyHubAudio.play(),
           sans setTimeout / await — sinon Safari bloque. */
        btn.addEventListener('click', function () {
          if (!audio) return;
          var cur = audio.getState();
          if (cur.playing && cur.currentStation && cur.currentStation.id === st.id) {
            audio.pause();
          } else {
            audio.play(st);
          }
        });
        listEl.appendChild(btn);
        cartes.push({ station: st, btn: btn, etat: undefined });
      })(stations[i]);
    }

    function majCarte(c, etat) {
      if (c.etat === etat) return;
      c.etat = etat;
      var enAvant = etat === 'lecture' || etat === 'chargement';
      c.btn.className = 'fh-pe-btn fh-ra-station-btn fh-corps fh-bordure ' +
        (enAvant ? 'fh-maintenant' : 'fh-carte fh-texte') + (etat === 'pause' ? ' is-pause' : '');
      c.btn.setAttribute('aria-pressed', etat === 'lecture' ? 'true' : 'false');
      if (etat) c.btn.setAttribute('aria-current', 'true');
      else c.btn.removeAttribute('aria-current');
      c.btn.innerHTML = '<span class="fh-pe-dedans fh-ra-station-dedans">' +
        '<span class="fh-ra-pastille">' + svg(iconeEtat(etat), 30) + '</span>' +
        '<span class="fh-ra-station-textes">' +
          '<span class="fh-ra-station-nom fh-titre">' + escapeHtml(c.station.nom) + '</span>' +
          (etat ? '<span class="fh-ra-station-etat' + (enAvant ? '' : ' fh-texte-doux') + '">' + LIBELLES_ETAT[etat] + '</span>' : '') +
        '</span></span>';
    }

    function rendre(state) {
      var s = state || {};
      for (var k = 0; k < cartes.length; k++) majCarte(cartes[k], etatStation(s, cartes[k].station));
      var st = sousTitreRadio(s, stations.length);
      if (sousTitreEl.textContent !== st) sousTitreEl.textContent = st;
      stopBtn.style.display = (s.playing || s.loading) && !s.error ? '' : 'none';
      if (s.error) {
        erreurEl.innerHTML = svg(IC_ERREUR, 30) + '<span>' + escapeHtml(s.error) +
          (s.currentStation ? ' (' + escapeHtml(s.currentStation.nom) + ')' : '') +
          ' — touche la station pour réessayer.</span>';
        erreurEl.style.display = '';
      } else {
        erreurEl.style.display = 'none';
      }
    }

    if (audio) {
      container._radioExpandUnsub = audio.subscribe(rendre);
    } else {
      rendre(null);
    }
  }

  function collapse(container) {
    if (typeof container._radioExpandUnsub === 'function') {
      try { container._radioExpandUnsub(); } catch (e) { /* noop */ }
      container._radioExpandUnsub = null;
    }
  }

  global.Tiles = global.Tiles || {};
  global.Tiles.radio = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse,
    /* Fonctions pures (testées par packages/design/src/displayRadio.test.ts). */
    etatStation: etatStation,
    sousTitreRadio: sousTitreRadio
  };
})(window);
