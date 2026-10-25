/* Ambiance jour/nuit de l'iPad — fonctions PURES (ES5 strict, Safari 9).

   Chargé par index.html avant core.js : expose window.FamilyHubAmbiance.
   Exporté aussi en CommonJS (module.exports) pour le test Node
   packages/design/src/displayAmbiance.test.ts, qui vérifie la parité avec
   ambianceAt du design system.

   Règle (identique à ambianceAt) : jour si lever <= maintenant < coucher ;
   repli 07:00-19:00 si l'info est absente, illisible ou incohérente
   (lever >= coucher). */
(function (root) {
  'use strict';

  function parseHHMM(s) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(s == null ? '' : s));
    if (!m) return null;
    var h = parseInt(m[1], 10);
    var mi = parseInt(m[2], 10);
    if (h > 23 || mi > 59) return null;
    return h * 60 + mi;
  }

  function ambianceFromSun(now, sunrise, sunset) {
    var cur = now.getHours() * 60 + now.getMinutes();
    var rise = parseHHMM(sunrise);
    var set = parseHHMM(sunset);
    if (rise === null || set === null || rise >= set) {
      rise = 7 * 60;
      set = 19 * 60;
    }
    return (cur >= rise && cur < set) ? 'jour' : 'nuit';
  }

  function dailyOf(entry) {
    var d = entry && entry.daily;
    return (d && typeof d === 'object') ? d : null;
  }

  /* Lever/coucher depuis les données de la tuile météo.
     Forme actuelle : { byLocation: { [locId]: { daily: { sunrise, sunset } } } }.
     Ordre : la localisation choisie dans la config de la tuile
     (selectedLocationId), sinon la première de byLocation qui a un daily,
     sinon l'ancienne forme { daily: {...} }. Renvoie null si rien. */
  function sunFromWeatherData(data, selectedLocationId) {
    if (!data || typeof data !== 'object') return null;
    var by = data.byLocation;
    var d = null;
    if (by && typeof by === 'object') {
      if (selectedLocationId != null && by.hasOwnProperty(selectedLocationId)) {
        d = dailyOf(by[selectedLocationId]);
      }
      if (!d) {
        for (var id in by) {
          if (!by.hasOwnProperty(id)) continue;
          d = dailyOf(by[id]);
          if (d) break;
        }
      }
    }
    if (!d) d = dailyOf(data);
    if (!d) return null;
    return { sunrise: d.sunrise, sunset: d.sunset };
  }

  /* className de <html> avec l'ambiance demandée : retire toute classe
     theme-* (ancien choix de thème) et amb-* (ambiance précédente), garde
     les autres, puis ajoute amb-jour ou amb-nuit. Idempotent : appliqué
     chaque minute, le résultat ne grossit pas. */
  function classesAvecAmbiance(className, ambiance) {
    var classes = String(className == null ? '' : className).split(/\s+/);
    var kept = [];
    for (var i = 0; i < classes.length; i++) {
      var c = classes[i];
      if (!c || c.indexOf('theme-') === 0 || c.indexOf('amb-') === 0) continue;
      kept.push(c);
    }
    kept.push(ambiance === 'jour' ? 'amb-jour' : 'amb-nuit');
    return kept.join(' ');
  }

  var api = {
    parseHHMM: parseHHMM,
    ambianceFromSun: ambianceFromSun,
    sunFromWeatherData: sunFromWeatherData,
    classesAvecAmbiance: classesAvecAmbiance
  };

  if (root) root.FamilyHubAmbiance = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : null);
