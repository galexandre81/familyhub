/* tableau.js — tableau de cuisine de l'iPad (écran principal, 1024×768 paysage).
   ES5 strict (syntaxe ET fonctions intégrées), Safari 9 / iOS 9.3.6.

   API : FamilyHubTableau.monter(conteneur, contexte) → { actualiser(), demonter() }
     contexte.sources() : renvoie, par TYPE de tuile présente dans le layout de
       l'écran, { tileId, config, data } (data = snapshot, null s'il manque).
       Types lus : weekly-menu (prochain repas, « Ensuite »), recipe-today
       (recettes complètes confiées au mode recette), weather, calendar,
       livre-recettes, radio, settings. Un type absent du layout = bloc
       « À configurer dans le hub ».
     actualiser() : à appeler à chaque snapshot ou changement de config ; ne
       reconstruit que les blocs dont le contenu a changé.
   Chaque minute (calée sur le changement de minute), seuls l'heure, la date,
   « dans 1 h 30 » et la barre sont réécrits ; la carte du repas n'est
   reconstruite que si le repas affiché change (un toucher en cours ne saute
   pas). Les minuteurs ont leur propre rafraîchissement (minuteurs-panneau.js).

   Disposition (d'après les maquettes Sys-iPad-Jour / Sys-iPad-Nuit) :
   - en-tête : date, heure en très grand, météo à droite (toucher → météo) ;
   - carte du prochain repas (≈ 60 %) : « Dîner · 19:00 », « dans 1 h 30 »,
     barre qui se vide, plat, accompagnements, présents, « Commencer » → mode
     recette ; dessous, le batch cooking du jour ou du lendemain s'il y en a
     un (toucher → mode recette avec toutes ses recettes), puis l'agenda de la
     semaine (toucher → agenda) ;
   - colonne droite : minuteurs (1 / 5 / 10 min, Autre, en cours ; la carte
     ne grandit qu'avec les minuteurs en cours), « PC des enfants » (place
     réservée au temps d'écran, projet à venir) puis « Ensuite » (le repas
     d'après) ;
   - rangée « plus » : Recettes, Menu de la semaine, Radio, Réglages.

   iOS 9 : jamais de flex sur un <button> (contenu dans un <span> intérieur).

   Les fonctions pures (haut du fichier) sont testées par
   packages/design/src/displayTableau.test.ts ; elles s'appuient sur
   window.FamilyHubRepas (js/repas.js, chargé avant). */
(function (root) {
  'use strict';

  /* ===================== Fonctions pures ===================== */

  var JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  var JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
    'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  var CE_MOMENT = { petitDej: 'Ce matin', dej: 'Ce midi', diner: 'Ce soir' };
  var COULEURS_PERSONNE = { sapin: 1, toleRouge: 1, lilas: 1, miel: 1, ardoise: 1 };
  var RE_HEX = /^#[0-9a-fA-F]{3,8}$/;
  var RE_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
  var JOURS_AGENDA = 7;
  var MAX_AGENDA = 4;

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function repasApi() {
    return root && root.FamilyHubRepas ? root.FamilyHubRepas : null;
  }

  /* « Mardi 27 octobre », « Dimanche 1er novembre ». */
  function libelleDate(now) {
    var j = now.getDate();
    return JOURS[now.getDay()] + ' ' + (j === 1 ? '1er' : j) + ' ' + MOIS[now.getMonth()];
  }

  function libelleHeure(d) {
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function dateISOLocale(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* AAAA-MM-JJ → minuit local (null si illisible). */
  function jourLocal(iso) {
    var m = RE_DATE.exec(String(iso == null ? '' : iso).slice(0, 10));
    if (!m) return null;
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  }

  function jourCourt(d) {
    return JOURS_COURTS[d.getDay()] + ' ' + d.getDate();
  }

  /* Prochains événements de l'agenda sur 7 jours (aujourd'hui compris), triés :
     [{ jour: 'mar. 27', heure: '18:30' | null, titre }]. Journée entière :
     date lue telle quelle (pas de calcul de fuseau), fin exclusive. Un
     événement commencé avant aujourd'hui et pas fini s'affiche aujourd'hui,
     sans heure. */
  function evenementsSemaine(events, now, max) {
    var limite = max == null ? MAX_AGENDA : max;
    var debutJour = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var finFenetre = new Date(now.getFullYear(), now.getMonth(), now.getDate() + JOURS_AGENDA);
    var liste = events || [];
    var retenus = [];
    for (var i = 0; i < liste.length; i++) {
      var ev = liste[i];
      if (!ev || !ev.startISO) continue;
      var debut, fin, heure;
      if (ev.allDay) {
        debut = jourLocal(ev.startISO);
        if (!debut) continue;
        fin = jourLocal(ev.endISO);
        if (!fin || fin.getTime() <= debut.getTime()) {
          fin = new Date(debut.getFullYear(), debut.getMonth(), debut.getDate() + 1);
        }
        if (fin.getTime() <= debutJour.getTime()) continue;
        heure = null;
      } else {
        debut = new Date(ev.startISO);
        if (isNaN(debut.getTime())) continue;
        fin = ev.endISO ? new Date(ev.endISO) : debut;
        if (isNaN(fin.getTime()) || fin.getTime() < debut.getTime()) fin = debut;
        if (fin.getTime() < now.getTime()) continue;
        heure = debut.getTime() < debutJour.getTime() ? null : libelleHeure(debut);
      }
      if (debut.getTime() >= finFenetre.getTime()) continue;
      var affiche = debut.getTime() < debutJour.getTime() ? debutJour : debut;
      var titre = String(ev.summary == null ? '' : ev.summary).replace(/^\s+|\s+$/g, '');
      retenus.push({
        tri: affiche.getTime(),
        ordre: i,
        evt: { jour: jourCourt(affiche), heure: heure, titre: titre || 'Événement' }
      });
    }
    retenus.sort(function (a, b) { return (a.tri - b.tri) || (a.ordre - b.ordre); });
    var out = [];
    for (var k = 0; k < retenus.length && k < limite; k++) out.push(retenus[k].evt);
    return out;
  }

  /* Libellé de la carte « Ensuite » : « Ce soir · 19:00 » aujourd'hui,
     sinon comme libelleMoment (« Demain midi », « Mercredi 28 · Dîner »). */
  function libelleEnsuite(repas, dateISO, now, heures) {
    var R = repasApi();
    if (!R) return '';
    if (dateISO === dateISOLocale(now) && CE_MOMENT[repas]) {
      var h = R.heureDuRepas(dateISO, repas, heures);
      if (h) return CE_MOMENT[repas] + ' · ' + libelleHeure(h);
    }
    return R.libelleMoment(repas, dateISO, now, heures);
  }

  /* Pastilles des présents : { initiale, nom, classe (fh-p-<couleur>) | null,
     couleur (hex hérité) | null }. Profils inconnus ignorés ; anciens
     snapshots sans profilsPresents → aucune pastille. */
  function pastillesPresents(slot, profils) {
    var ids = slot && slot.profilsPresents;
    var out = [];
    if (!ids || !ids.length || !profils || typeof profils !== 'object') return out;
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      if (!Object.prototype.hasOwnProperty.call(profils, id)) continue;
      var p = profils[id];
      if (!p || typeof p !== 'object') continue;
      var nom = String(p.nom == null ? '' : p.nom);
      var initiale = p.initiale ? String(p.initiale) : (nom ? nom.charAt(0).toUpperCase() : '?');
      var classe = (typeof p.couleurPersonne === 'string'
        && Object.prototype.hasOwnProperty.call(COULEURS_PERSONNE, p.couleurPersonne))
        ? 'fh-p-' + p.couleurPersonne : null;
      var couleur = !classe && typeof p.couleur === 'string' && RE_HEX.test(p.couleur) ? p.couleur : null;
      out.push({ initiale: initiale, nom: nom, classe: classe, couleur: couleur });
    }
    return out;
  }

  /* Rangée « Commencer » : au plus `max` pastilles (3), puis une pastille
     « +N » pour le reste (personnes au-delà + invités). Largeur utile de la
     rangée : colonne gauche (960 − 22) × 1,6 / 2,6 ≈ 577 px − bordures 6 −
     marges internes 48 ≈ 523 px. Pastille = 60 + 10 de marge = 70 px.
     Pire cas, ex. 5 profils + 2 invités : 3 pastilles + « +4 » = 4 × 70 =
     280 px, + 10 de marge du bouton, + bouton min 180 px = 470 ≤ 523 px. */
  function pastillesAffichees(pastilles, invites, max) {
    var liste = pastilles || [];
    var limite = max == null ? 3 : max;
    var montrees = liste.slice(0, limite);
    var reste = (liste.length - montrees.length) + Math.max(0, +invites || 0);
    return { pastilles: montrees, reste: reste };
  }

  /* Taille du plat d'après sa longueur (estimation : Bricolage 800 ≈ 0,55 em
     par caractère, zone de 523 px) : ≤ 18 caractères à 52 px sur une ligne ;
     19 à 22 à 42 px sur une ligne ; au-delà, 42 px sur 2 lignes et la ligne
     des accompagnements est masquée (plutôt que coupée à moitié). */
  var PLAT_COURT = 18;
  var PLAT_UNE_LIGNE = 22;
  function formatPlat(plat) {
    var n = String(plat == null ? '' : plat).length;
    return { long: n > PLAT_COURT, deuxLignes: n > PLAT_UNE_LIGNE };
  }

  function nomsDuSlot(slot) {
    var noms = slot.recetteNoms || [];
    var propres = [];
    for (var i = 0; i < noms.length; i++) if (noms[i]) propres.push(String(noms[i]));
    return propres;
  }

  function pluriel(n, mot) {
    return n + ' ' + mot + (n > 1 ? 's' : '');
  }

  /* Prochain repas et « Ensuite » depuis les données de la tuile menu
     (WeeklyMenuData). Textes prêts à afficher ; `cle` ne dépend pas de
     l'heure courante (sauf changement de jour du libellé). */
  function resumeRepas(data, now) {
    var vide = { prochain: null, ensuite: null };
    var R = repasApi();
    if (!R || !data || typeof data !== 'object') return vide;
    var heures = data.heuresRepas;
    var liste = R.prochainsRepas(data.semaine || [], now, heures, 2);
    if (liste.length === 0) return vide;

    var slot = liste[0].slot;
    var minutes = R.minutesAvant(liste[0].heure, now);
    var noms = nomsDuSlot(slot);
    var pastilles = pastillesPresents(slot, data.profils);
    var nbProfils = slot.profilsCount != null
      ? (+slot.profilsCount || 0)
      : (slot.profilsPresents ? slot.profilsPresents.length : 0);
    var nbInvites = +slot.invitesCount || 0;
    var total = nbProfils + nbInvites;
    /* Pastilles connues : invités dans la pastille « +N ». Ancien snapshot
       sans présents : un simple « N personnes ». */
    var affichees = pastilles.length > 0 ? pastillesAffichees(pastilles, nbInvites, 3) : { pastilles: [], reste: 0 };
    var presence = pastilles.length === 0 && total > 0 ? pluriel(total, 'personne') : '';
    var ids = (slot.recetteIds || []).slice();
    var nomsParId = {};
    var bruts = slot.recetteNoms || [];
    if (bruts.length === ids.length) {
      for (var i = 0; i < ids.length; i++) if (bruts[i]) nomsParId[ids[i]] = String(bruts[i]);
    }
    var moment = R.libelleMoment(slot.repas, slot.date, now, heures);
    var cleP = [];
    for (var k = 0; k < affichees.pastilles.length; k++) {
      var pk = affichees.pastilles[k];
      cleP.push(pk.initiale + '/' + (pk.classe || pk.couleur || ''));
    }
    cleP.push('+' + affichees.reste);
    var plat = noms[0] || 'Repas prévu';
    var fmt = formatPlat(plat);
    var prochain = {
      moment: moment,
      dans: R.libelleDans(minutes),
      barre: R.remplissageBarre(minutes),
      plat: plat,
      platLong: fmt.long,
      accompagnements: fmt.deuxLignes ? '' : noms.slice(1).join(' · '),
      pastilles: affichees.pastilles,
      reste: affichees.reste,
      presence: presence,
      titre: typeof R.titreRepas === 'function' ? R.titreRepas(slot.repas, slot.date) : moment,
      portions: total > 0 ? total : undefined,
      recetteIds: ids,
      noms: nomsParId,
      cle: [slot.date, slot.repas, ids.join(','), noms.join(','), cleP.join(','), presence, moment].join('|')
    };

    var ensuite = null;
    if (liste.length > 1) {
      var s2 = liste[1].slot;
      var noms2 = nomsDuSlot(s2);
      ensuite = {
        libelle: libelleEnsuite(s2.repas, s2.date, now, heures),
        plat: noms2[0] || 'Repas prévu',
        accompagnements: noms2.slice(1).join(' · ')
      };
    }
    return { prochain: prochain, ensuite: ensuite };
  }

  /* « 2 h 30 », « 2 h », « 45 min » ; '' si la durée n'est pas connue. */
  function dureeTexte(minutes) {
    var m = +minutes;
    if (!(m > 0)) return '';
    var h = Math.floor(m / 60);
    var r = Math.round(m % 60);
    if (h === 0) return r + ' min';
    return r ? h + ' h ' + pad2(r) : h + ' h';
  }

  /* Carte « batch cooking » : la session du jour (même faite, marquée « fait »),
     sinon celle de demain si elle reste à faire ; null sinon. Données du menu
     de la semaine (WeeklyMenuData : batchSessions du plan actif, ou du premier
     plan de data.plans). */
  function resumeBatch(data, now) {
    if (!data || typeof data !== 'object') return null;
    var sessions = data.batchSessions;
    if (!sessions && data.plans && data.plans.length > 0) sessions = data.plans[0].batchSessions;
    if (!sessions || !sessions.length) return null;
    var auj = dateISOLocale(now);
    var dem = dateISOLocale(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    var choisie = null;
    var quand = '';
    for (var i = 0; i < sessions.length; i++) {
      var s = sessions[i] || {};
      if (s.date === auj) { choisie = s; quand = "aujourd'hui"; break; }
      if (s.date === dem && !s.done && !choisie) { choisie = s; quand = 'demain'; }
    }
    if (!choisie) return null;
    var ids = (choisie.recetteIds || []).slice();
    var bruts = choisie.recetteNoms || [];
    var noms = [];
    var nomsParId = {};
    for (var k = 0; k < bruts.length; k++) if (bruts[k]) noms.push(String(bruts[k]));
    if (bruts.length === ids.length) {
      for (var j = 0; j < ids.length; j++) if (bruts[j]) nomsParId[ids[j]] = String(bruts[j]);
    }
    var duree = dureeTexte(choisie.dureeEstimeeMinutes);
    var titre = 'Batch cooking ' + quand;
    return {
      titre: titre,
      duree: duree,
      noms: noms.join(' · '),
      recetteIds: ids,
      nomsParId: nomsParId,
      fait: !!choisie.done,
      cle: [choisie.id, titre, duree, noms.join(','), ids.join(','), choisie.done ? 1 : 0].join('|')
    };
  }

  /* Météo de l'en-tête : ville choisie dans la config de la tuile (sinon la
     première), { temp: '12°', ciel, ville } ou null. */
  function meteoResume(data, config) {
    var locs = (config && config.locations) || [];
    if (!locs.length) return null;
    var loc = null;
    for (var i = 0; i < locs.length; i++) {
      if (locs[i] && locs[i].id === config.selectedLocationId) { loc = locs[i]; break; }
    }
    if (!loc) loc = locs[0];
    var by = data && data.byLocation;
    var ld = (loc && by && typeof by === 'object' && Object.prototype.hasOwnProperty.call(by, loc.id)) ? by[loc.id] : null;
    var cur = ld && ld.current;
    if (!cur || typeof cur.tempC !== 'number' || !isFinite(cur.tempC)) return null;
    var t = Math.round(cur.tempC);
    if (t === 0) t = 0; /* pas de « -0° » */
    return { temp: t + '°', ciel: cur.label ? String(cur.label) : '', ville: loc.ville ? String(loc.ville) : '' };
  }

  /* ===================== Écran (DOM) ===================== */

  var A_CONFIGURER = 'À configurer dans le hub';

  function svg(inner, taille) {
    var t = taille || 30;
    return '<svg viewBox="0 0 24 24" width="' + t + '" height="' + t + '" aria-hidden="true" class="tab-icone">' + inner + '</svg>';
  }
  var TRAIT = ' fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"';
  var ICONES = {
    commencer: '<path d="M8 5 L19 12 L8 19 Z" fill="currentColor"/>',
    livre: '<path d="M4 5 Q4 4 5 4 L11 4 Q12 4 12 6 L12 20 Q12 18 10 18 L5 18 Q4 18 4 17 Z"' + TRAIT + '/>' +
      '<path d="M20 5 Q20 4 19 4 L13 4 Q12 4 12 6 L12 20 Q12 18 14 18 L19 18 Q20 18 20 17 Z"' + TRAIT + '/>',
    menu: '<rect x="3.5" y="5" width="17" height="15" rx="2"' + TRAIT + '/>' +
      '<path d="M3.5 10 H20.5 M8 3 V7 M16 3 V7 M7 14 H10 M14 14 H17"' + TRAIT + '/>',
    radio: '<rect x="3" y="8" width="18" height="12" rx="2"' + TRAIT + '/>' +
      '<circle cx="15.5" cy="14" r="3"' + TRAIT + '/><path d="M6 12 H10 M6 16 H10 M5 8 L16 3"' + TRAIT + '/>',
    reglages: '<circle cx="12" cy="12" r="3"' + TRAIT + '/>' +
      '<path d="M12 2.5 V5 M12 19 V21.5 M2.5 12 H5 M19 12 H21.5 M5.3 5.3 L7 7 M17 17 L18.7 18.7 M5.3 18.7 L7 17 M17 7 L18.7 5.3"' + TRAIT + '/>',
    marmite: '<path d="M4 10 H20 V17 Q20 20 17 20 H7 Q4 20 4 17 Z M2 10 H22 M9 6 Q8 4.5 9 3 M13 6 Q12 4.5 13 3"' + TRAIT + '/>',
    ecran: '<rect x="3" y="4" width="18" height="12" rx="2"' + TRAIT + '/><path d="M12 16 V20 M8 20 H16"' + TRAIT + '/>'
  };

  var PLUS = [
    { type: 'livre-recettes', mot: 'Recettes', icone: 'livre' },
    { type: 'weekly-menu', mot: 'Menu de la semaine', icone: 'menu' },
    { type: 'radio', mot: 'Radio', icone: 'radio' },
    /* Réglages (luminosité de CET écran) : ne dépend d'aucune donnée de tuile,
       toujours disponible. */
    { type: 'settings', mot: 'Réglages', icone: 'reglages', toujours: true }
  ];

  function echapper(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function el(tag, classes, html) {
    var n = document.createElement(tag);
    if (classes) n.className = classes;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function bouton(classes, html, aria) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = classes;
    b.innerHTML = '<span class="tab-dedans">' + html + '</span>';
    if (aria) b.setAttribute('aria-label', aria);
    return b;
  }

  function monter(conteneur, contexte) {
    var ctx = contexte || {};
    var actif = true;
    var minuteTimer = null;
    var panneau = null;
    var cles = {};
    var repasCourant = null;
    var refsRepas = null;

    function sources() {
      var s = null;
      try { s = typeof ctx.sources === 'function' ? ctx.sources() : null; } catch (e) { s = null; }
      return s || {};
    }

    function ouvrirOverlay(type) {
      var src = sources()[type];
      if (!src && type !== 'settings') return false;
      if (!root.FamilyHubOverlay) return false;
      return root.FamilyHubOverlay.open(type, (src && src.data) || {}, (src && src.config) || {}, src ? src.tileId : null);
    }

    /* --- Squelette --- */
    var racine = el('div', 'tab fh-fond fh-corps');

    var tete = el('div', 'tab-tete');
    var dateHeure = el('div', 'tab-date-heure');
    var dateEl = el('div', 'tab-date fh-texte-doux');
    var heureEl = el('div', 'tab-heure fh-titre fh-texte');
    dateHeure.appendChild(dateEl);
    dateHeure.appendChild(heureEl);
    tete.appendChild(dateHeure);
    var meteoEl = el('div', 'tab-meteo');
    meteoEl.setAttribute('role', 'button');
    meteoEl.addEventListener('click', function () { ouvrirOverlay('weather'); });
    tete.appendChild(meteoEl);
    racine.appendChild(tete);

    var milieu = el('div', 'tab-milieu');
    var gauche = el('div', 'tab-gauche');
    var repasEl = el('div', 'tab-repas tab-carte fh-carte fh-bordure');
    gauche.appendChild(repasEl);
    var batchEl = el('div', 'tab-batch tab-carte fh-carte fh-bordure');
    batchEl.setAttribute('role', 'button');
    batchEl.style.display = 'none';
    batchEl.addEventListener('click', cuisinerBatch);
    gauche.appendChild(batchEl);
    var batchCourant = null;
    var agendaEl = el('div', 'tab-agenda tab-carte fh-carte fh-bordure');
    agendaEl.setAttribute('role', 'button');
    agendaEl.addEventListener('click', function () { ouvrirOverlay('calendar'); });
    gauche.appendChild(agendaEl);
    milieu.appendChild(gauche);

    var droite = el('div', 'tab-droite');
    var minuteursEl = el('div', 'tab-minuteurs tab-carte fh-carte fh-bordure');
    minuteursEl.appendChild(el('div', 'tab-carte-titre fh-texte-doux', 'Minuteurs'));
    var minuteursCorps = el('div', 'tab-minuteurs-corps');
    minuteursEl.appendChild(minuteursCorps);
    droite.appendChild(minuteursEl);
    /* Place réservée : le temps d'écran du PC des enfants (projet à venir). */
    var pcEl = el('div', 'tab-pc tab-carte fh-carte fh-bordure');
    pcEl.innerHTML =
      '<div class="tab-pc-titre fh-texte">' + svg(ICONES.ecran, 24) + '<span>PC des enfants</span></div>' +
      '<p class="tab-pc-texte fh-texte-doux">Bientôt : le temps d’écran</p>';
    droite.appendChild(pcEl);
    var ensuiteEl = el('div', 'tab-ensuite tab-carte fh-carte fh-bordure');
    droite.appendChild(ensuiteEl);
    milieu.appendChild(droite);
    racine.appendChild(milieu);

    var plusEl = el('div', 'tab-plus');
    racine.appendChild(plusEl);

    conteneur.appendChild(racine);

    if (root.FamilyHubMinuteursPanneau) {
      panneau = root.FamilyHubMinuteursPanneau.monter(minuteursCorps, {});
      var liste = minuteursCorps.querySelector('.fh-min-liste');
      /* Seule la liste des minuteurs défile (core.js : anti-rebond iOS). */
      if (liste) liste.setAttribute('data-scroll-lock', '1');
    } else {
      minuteursCorps.innerHTML = '<p class="tab-message fh-texte-doux">Minuteurs indisponibles.</p>';
    }

    /* --- Rangée « plus » (construite une fois ; l'état « à configurer » est
       lu au toucher) --- */
    for (var i = 0; i < PLUS.length; i++) {
      (function (def) {
        var b = bouton('tab-plus-btn fh-carte fh-texte fh-bordure fh-corps',
          svg(ICONES[def.icone]) + '<span class="tab-plus-mot">' + echapper(def.mot) + '</span>', def.mot);
        var retour = null;
        b.addEventListener('click', function () {
          if (sources()[def.type] || def.toujours) { ouvrirOverlay(def.type); return; }
          /* Tuile absente de l'écran : on le dit à la place du mot, 3 s. */
          var mot = b.querySelector('.tab-plus-mot');
          if (!mot) return;
          mot.textContent = A_CONFIGURER;
          if (retour) clearTimeout(retour);
          retour = setTimeout(function () { mot.textContent = def.mot; retour = null; }, 3000);
        });
        plusEl.appendChild(b);
      })(PLUS[i]);
    }

    /* --- Blocs --- */

    function majHeure(now) {
      var h = libelleHeure(now);
      if (heureEl.textContent !== h) heureEl.textContent = h;
      var d = libelleDate(now);
      if (dateEl.textContent !== d) dateEl.textContent = d;
    }

    function rendreMeteo(src) {
      var html;
      if (!src) {
        html = '<div class="tab-meteo-ville fh-texte-doux">Météo</div>' +
          '<div class="tab-meteo-ciel fh-texte-doux">' + A_CONFIGURER + '</div>';
      } else {
        /* Config courante de la tuile (suit le hub), sinon celle des sources. */
        var cfg = root && typeof root.FamilyHubGetTileConfig === 'function' && src.tileId
          ? root.FamilyHubGetTileConfig(src.tileId) : null;
        var m = meteoResume(src.data, cfg || src.config);
        html = m
          ? '<div class="tab-meteo-temp fh-titre fh-texte">' + echapper(m.temp) + '</div>' +
            (m.ciel ? '<div class="tab-meteo-ciel fh-texte">' + echapper(m.ciel) + '</div>' : '') +
            (m.ville ? '<div class="tab-meteo-ville fh-texte-doux">' + echapper(m.ville) + '</div>' : '')
          : '<div class="tab-meteo-ville fh-texte-doux">Météo</div>' +
            '<div class="tab-meteo-ciel fh-texte-doux">En attente…</div>';
      }
      if (cles.meteo !== html) { cles.meteo = html; meteoEl.innerHTML = html; }
    }

    function rendreAgenda(src, now) {
      var html = '<div class="tab-carte-titre fh-texte-doux">Cette semaine</div>';
      if (!src) {
        html += '<p class="tab-message fh-texte-doux">' + A_CONFIGURER + '</p>';
      } else {
        var evs = evenementsSemaine(src.data && src.data.events, now, MAX_AGENDA);
        if (evs.length === 0) {
          html += '<p class="tab-message fh-texte-doux">Rien de prévu cette semaine.</p>';
        } else {
          html += '<div class="tab-agenda-liste">';
          for (var k = 0; k < evs.length; k++) {
            var e = evs[k];
            html += '<div class="tab-evt fh-texte"><span class="tab-evt-jour">' + echapper(e.jour) + '</span> · ' +
              (e.heure ? echapper(e.heure) + ' · ' : '') + echapper(e.titre) + '</div>';
          }
          html += '</div>';
        }
      }
      if (cles.agenda !== html) { cles.agenda = html; agendaEl.innerHTML = html; }
    }

    function commencer() {
      var p = repasCourant;
      var mr = root.FamilyHubModeRecette;
      if (!p || !mr || !p.recetteIds.length) return;
      var rt = sources()['recipe-today'];
      if (rt && rt.data && rt.data.recettes && mr.memoriserListe) mr.memoriserListe(rt.data.recettes);
      mr.ouvrir({ recetteIds: p.recetteIds, titre: p.titre, portions: p.portions, noms: p.noms });
    }

    function cuisinerBatch() {
      var b = batchCourant;
      var mr = root.FamilyHubModeRecette;
      if (!b || !mr || !b.recetteIds.length) return;
      mr.ouvrir({ recetteIds: b.recetteIds, titre: 'Batch cooking', noms: b.nomsParId, portionsPropres: true });
    }

    function rendreBatch(src, now) {
      var b = src && src.data ? resumeBatch(src.data, now) : null;
      batchCourant = b;
      var cle = b ? b.cle : '';
      if (cles.batch === cle) return;
      cles.batch = cle;
      if (!b) { batchEl.style.display = 'none'; batchEl.innerHTML = ''; return; }
      batchEl.style.display = '';
      batchEl.className = 'tab-batch tab-carte fh-carte fh-bordure' + (b.fait ? ' tab-batch-fait' : '');
      batchEl.innerHTML =
        '<div class="tab-batch-texte">' +
          '<div class="tab-batch-titre fh-titre fh-texte">' + svg(ICONES.marmite, 28) +
            '<span>' + echapper(b.titre) + (b.duree ? ' · ' + echapper(b.duree) : '') + (b.fait ? ' · fait' : '') +
            '</span></div>' +
          (b.noms ? '<div class="tab-batch-noms fh-texte-doux">' + echapper(b.noms) + '</div>' : '') +
        '</div>' +
        '<div class="tab-batch-aller fh-texte">Cuisiner ›</div>';
    }

    function rendreRepasMessage(titre, message) {
      repasCourant = null;
      refsRepas = null;
      repasEl.innerHTML =
        '<div class="tab-repas-tete tab-repas-tete-neutre fh-bordure">' +
          '<span class="tab-repas-moment fh-titre fh-texte">' + echapper(titre) + '</span>' +
        '</div>' +
        '<div class="tab-repas-corps"><p class="tab-repas-message fh-texte-doux">' + echapper(message) + '</p></div>';
    }

    function rendreRepas(p) {
      repasCourant = p;
      repasEl.innerHTML = '';
      var teteR = el('div', 'tab-repas-tete fh-maintenant fh-bordure');
      var moment = el('span', 'tab-repas-moment fh-titre', echapper(p.moment));
      var dans = el('span', 'tab-repas-dans', echapper(p.dans));
      teteR.appendChild(moment);
      teteR.appendChild(dans);
      repasEl.appendChild(teteR);

      var corps = el('div', 'tab-repas-corps');
      var barre = el('div', 'tab-barre fh-fond fh-bordure');
      var plein = el('div', 'tab-barre-plein');
      plein.style.width = Math.round(p.barre * 100) + '%';
      barre.appendChild(plein);
      corps.appendChild(barre);

      var textes = el('div', 'tab-repas-textes');
      textes.appendChild(el('div', 'tab-repas-plat fh-titre fh-texte' + (p.platLong ? ' tab-repas-plat-long' : ''),
        echapper(p.plat)));
      if (p.accompagnements) textes.appendChild(el('div', 'tab-repas-acc fh-texte-doux', echapper(p.accompagnements)));
      corps.appendChild(textes);

      var bas = el('div', 'tab-repas-bas');
      for (var k = 0; k < p.pastilles.length; k++) {
        var ps = p.pastilles[k];
        var pill = el('span', 'tab-pastille fh-titre fh-p-texte ' + (ps.classe || (ps.couleur ? '' : 'tab-pastille-neutre')),
          echapper(ps.initiale));
        if (ps.couleur) pill.style.backgroundColor = ps.couleur;
        if (ps.nom) pill.setAttribute('title', ps.nom);
        bas.appendChild(pill);
      }
      if (p.reste > 0) {
        bas.appendChild(el('span', 'tab-pastille tab-pastille-reste fh-titre fh-p-texte tab-pastille-neutre',
          '+' + p.reste));
      }
      if (p.presence) bas.appendChild(el('span', 'tab-presence fh-texte-doux', echapper(p.presence)));
      var go = bouton('tab-commencer-btn fh-action fh-titre', svg(ICONES.commencer, 28) + '<span>Commencer</span>',
        'Commencer : ouvrir la recette du repas');
      go.addEventListener('click', commencer);
      bas.appendChild(go);
      corps.appendChild(bas);
      repasEl.appendChild(corps);
      refsRepas = { dans: dans, plein: plein };
    }

    function rendreEnsuite(src, e) {
      var html = '<div class="tab-carte-titre fh-texte-doux">Ensuite</div>';
      if (!src) {
        html += '<p class="tab-message fh-texte-doux">' + A_CONFIGURER + '</p>';
      } else if (!e) {
        html += '<p class="tab-message fh-texte-doux">Rien de prévu après.</p>';
      } else {
        html = '<div class="tab-carte-titre fh-texte-doux">' + echapper(e.libelle) + '</div>' +
          '<div class="tab-ensuite-plat fh-titre fh-texte">' + echapper(e.plat) + '</div>' +
          (e.accompagnements ? '<div class="tab-ensuite-acc fh-texte-doux">' + echapper(e.accompagnements) + '</div>' : '');
      }
      if (cles.ensuite !== html) { cles.ensuite = html; ensuiteEl.innerHTML = html; }
    }

    function rendreRepasEtEnsuite(src, now) {
      if (!src) {
        if (cles.repas !== 'absent') { cles.repas = 'absent'; rendreRepasMessage('Prochain repas', A_CONFIGURER); }
        rendreEnsuite(null, null);
        return;
      }
      if (!src.data) {
        if (cles.repas !== 'attente') { cles.repas = 'attente'; rendreRepasMessage('Prochain repas', 'En attente des données…'); }
        rendreEnsuite(src, null);
        return;
      }
      var r = resumeRepas(src.data, now);
      if (!r.prochain) {
        if (cles.repas !== 'vide') { cles.repas = 'vide'; rendreRepasMessage('Prochain repas', 'Pas de menu en cours'); }
      } else if (cles.repas !== r.prochain.cle || !refsRepas) {
        cles.repas = r.prochain.cle;
        rendreRepas(r.prochain);
      } else {
        /* Même repas : seuls « dans … » et la barre bougent. */
        repasCourant = r.prochain;
        if (refsRepas.dans.textContent !== r.prochain.dans) refsRepas.dans.textContent = r.prochain.dans;
        var w = Math.round(r.prochain.barre * 100) + '%';
        if (refsRepas.plein.style.width !== w) refsRepas.plein.style.width = w;
      }
      rendreEnsuite(src, r.ensuite);
    }

    function actualiser() {
      if (!actif) return;
      var now = new Date();
      var s = sources();
      majHeure(now);
      try { rendreMeteo(s.weather); } catch (e1) { journal('météo', e1); }
      try { rendreRepasEtEnsuite(s['weekly-menu'], now); } catch (e2) { journal('repas', e2); }
      try { rendreBatch(s['weekly-menu'], now); } catch (e4) { journal('batch', e4); }
      try { rendreAgenda(s.calendar, now); } catch (e3) { journal('agenda', e3); }
    }

    function journal(bloc, err) {
      if (root.console && root.console.error) root.console.error('[tableau] ' + bloc, err);
    }

    /* Tic calé sur le changement de minute (l'heure affichée change pile). */
    function programmerMinute() {
      var now = new Date();
      var attente = 60000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 200;
      minuteTimer = setTimeout(function () {
        minuteTimer = null;
        if (!actif) return;
        actualiser();
        programmerMinute();
      }, attente);
    }

    actualiser();
    programmerMinute();

    return {
      actualiser: actualiser,
      demonter: function () {
        actif = false;
        if (minuteTimer) { clearTimeout(minuteTimer); minuteTimer = null; }
        if (panneau) { try { panneau.demonter(); } catch (e) {} panneau = null; }
        if (racine.parentNode) racine.parentNode.removeChild(racine);
      }
    };
  }

  var api = {
    libelleDate: libelleDate,
    libelleHeure: libelleHeure,
    evenementsSemaine: evenementsSemaine,
    libelleEnsuite: libelleEnsuite,
    pastillesPresents: pastillesPresents,
    pastillesAffichees: pastillesAffichees,
    formatPlat: formatPlat,
    resumeRepas: resumeRepas,
    meteoResume: meteoResume,
    resumeBatch: resumeBatch,
    monter: monter
  };

  if (root) root.FamilyHubTableau = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
