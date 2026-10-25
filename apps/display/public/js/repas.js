/* Prochain repas de l'iPad — fonctions PURES (ES5 strict, Safari 9).

   Chargé par index.html avant core.js : expose window.FamilyHubRepas.
   Exporté aussi en CommonJS (module.exports) pour le test Node
   packages/design/src/displayRepas.test.ts, qui vérifie la parité avec
   prochainsRepas & co de @family-hub/types (heuresRepas.ts).

   Règles : heures du foyer (parametres.heuresRepas), défauts 07:00 (08:00 le
   week-end) / 12:15 / 19:00, champ par champ si invalide ; un repas reste
   « le prochain » jusqu'à 1 h après son heure ; les repas annulés ou sans
   recette sont ignorés. */
(function (root) {
  'use strict';

  var DUREE_REPAS_MIN = 60;
  var MINUTES_BARRE_PLEINE = 180;

  var DEFAUT = {
    semaine: { petitDej: '07:00', dej: '12:15', diner: '19:00' },
    weekend: { petitDej: '08:00', dej: '12:15', diner: '19:00' }
  };
  var REPAS = ['petitDej', 'dej', 'diner'];
  var FORMAT_HEURE = /^([01]\d|2[0-3]):[0-5]\d$/;

  var NOMS_REPAS = { petitDej: 'Petit-déjeuner', dej: 'Déjeuner', diner: 'Dîner' };
  var DEMAIN = { petitDej: 'Demain matin', dej: 'Demain midi', diner: 'Demain soir' };
  var JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

  function pad2(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function heureValide(v) {
    return typeof v === 'string' && FORMAT_HEURE.test(v);
  }

  function periode(heures, cle) {
    var def = DEFAUT[cle];
    var src = heures && typeof heures === 'object' ? heures[cle] : null;
    var res = {};
    for (var i = 0; i < REPAS.length; i++) {
      var r = REPAS[i];
      res[r] = src && heureValide(src[r]) ? src[r] : def[r];
    }
    return res;
  }

  function parseISO(dateISO) {
    var p = String(dateISO).split('-');
    return { y: parseInt(p[0], 10), m: parseInt(p[1], 10), d: parseInt(p[2], 10) };
  }

  /* Heure locale d'un repas pour un jour ISO AAAA-MM-JJ ; null si le repas
     est inconnu (ni petitDej, ni dej, ni diner) ou la date illisible : les
     appelants l'ignorent. */
  function heureDuRepas(dateISO, repas, heures) {
    var j = parseISO(dateISO);
    if (isNaN(j.y) || isNaN(j.m) || isNaN(j.d)) return null;
    var jour = new Date(j.y, j.m - 1, j.d).getDay();
    var weekend = jour === 0 || jour === 6;
    var p = periode(heures, weekend ? 'weekend' : 'semaine');
    if (!Object.prototype.hasOwnProperty.call(p, repas)) return null;
    var hhmm = p[repas].split(':');
    return new Date(j.y, j.m - 1, j.d, parseInt(hhmm[0], 10), parseInt(hhmm[1], 10));
  }

  function repasEstPasse(heure, now) {
    return heure.getTime() < now.getTime() - DUREE_REPAS_MIN * 60000;
  }

  /* Prochains repas (à venir ou commencés depuis moins d'une heure), triés
     par heure : [{ slot, heure }]. */
  function prochainsRepas(slots, now, heures, n) {
    var res = [];
    var liste = slots || [];
    for (var i = 0; i < liste.length; i++) {
      var slot = liste[i];
      if (!slot || !slot.date || slot.annule) continue;
      if (!slot.recetteIds || slot.recetteIds.length === 0) continue;
      var heure = heureDuRepas(slot.date, slot.repas, heures);
      if (!heure) continue; /* repas inconnu : ignoré */
      if (!repasEstPasse(heure, now)) res.push({ slot: slot, heure: heure, ordre: i });
    }
    res.sort(function (a, b) {
      return (a.heure.getTime() - b.heure.getTime()) || (a.ordre - b.ordre);
    });
    var out = [];
    var max = n == null ? 2 : n;
    for (var k = 0; k < res.length && k < max; k++) {
      out.push({ slot: res[k].slot, heure: res[k].heure });
    }
    return out;
  }

  function minutesAvant(heure, now) {
    return Math.round((heure.getTime() - now.getTime()) / 60000);
  }

  function libelleDans(minutes) {
    if (minutes <= 0) return 'maintenant';
    if (minutes < 60) return 'dans ' + minutes + ' min';
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return m === 0 ? 'dans ' + h + ' h' : 'dans ' + h + ' h ' + pad2(m);
  }

  /* Part de la barre « avant le repas » : pleine à 3 h et plus, vide à 0. */
  function remplissageBarre(minutes) {
    return Math.min(1, Math.max(0, minutes / MINUTES_BARRE_PLEINE));
  }

  function dateISOLocale(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* « Déjeuner · 12:15 » (aujourd'hui), « Demain midi », « Mardi 27 · Dîner ». */
  function libelleMoment(repas, dateISO, now, heures) {
    var nom = NOMS_REPAS[repas] || '';
    if (dateISO === dateISOLocale(now)) {
      var h = heureDuRepas(dateISO, repas, heures);
      if (!h) return nom;
      return nom + ' · ' + pad2(h.getHours()) + ':' + pad2(h.getMinutes());
    }
    var lendemain = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    if (dateISO === dateISOLocale(lendemain)) return DEMAIN[repas] || 'Demain';
    var j = parseISO(dateISO);
    var jour = new Date(j.y, j.m - 1, j.d).getDay();
    return JOURS[jour] + ' ' + j.d + ' · ' + nom;
  }

  /* Titre du mode recette ouvert sur un repas (même texte depuis le menu de
     la semaine et le tableau) : « Dîner · mardi 27 octobre ». */
  var NOMS_TITRE = { petitDej: 'Petit-déj', dej: 'Déjeuner', diner: 'Dîner' };
  var JOURS_MIN = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MOIS_MIN = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
    'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function titreRepas(repas, dateISO) {
    var nom = NOMS_TITRE[repas] || repas || 'Repas';
    var j = parseISO(dateISO || '');
    if (isNaN(j.y) || isNaN(j.m) || isNaN(j.d)) return nom + ' · ';
    var d = new Date(j.y, j.m - 1, j.d, 12, 0, 0);
    return nom + ' · ' + JOURS_MIN[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS_MIN[d.getMonth()];
  }

  var api = {
    titreRepas: titreRepas,
    heureDuRepas: heureDuRepas,
    prochainsRepas: prochainsRepas,
    minutesAvant: minutesAvant,
    libelleDans: libelleDans,
    remplissageBarre: remplissageBarre,
    libelleMoment: libelleMoment
  };

  if (root) root.FamilyHubRepas = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
