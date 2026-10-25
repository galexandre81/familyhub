/* alarme.js — bandeau d'alarme global des minuteurs. ES5 strict, iOS 9.

   Visible par-dessus tout (tableau, overlay plein écran, mode recette :
   z-index le plus haut de la page) tant qu'un minuteur lancé SUR CET ÉCRAN
   est terminé (ceux lancés ailleurs sonnent là où ils ont été lancés) ; « OK » (≥ 72 px) l'acquitte. Le son reste géré par
   timer-singleton.js (boucle d'alarme) : ce fichier ne fait que l'affichage,
   via FamilyHubTimers.subscribe. Chargé après timer-singleton.js. */
(function (global) {
  'use strict';

  var ICONE_CLOCHE =
    '<svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true" class="fh-alarme-icone">' +
      '<path d="M12 3 Q17 3, 17 10 L18 16 L6 16 L7 10 Q7 3, 12 3 Z" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/>' +
      '<path d="M10 18 Q12 21, 14 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
    '</svg>';
  var ICONE_OK =
    '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" class="fh-min-icone">' +
      '<path d="M5 12.5 L10 17 L19 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  function echapper(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  var bandeau = null;
  var cle = null;

  function assurerDom() {
    if (bandeau) return bandeau;
    bandeau = document.createElement('div');
    bandeau.id = 'fh-alarme';
    bandeau.className = 'fh-alarme';
    bandeau.setAttribute('role', 'alert');
    bandeau.style.display = 'none';
    document.body.appendChild(bandeau);
    return bandeau;
  }

  function enAlarme(state, timers) {
    return (state.timers || []).filter(function (t) {
      if (typeof timers.sonneIci === 'function' && !timers.sonneIci(t)) return false;
      if (t.status === 'ended') return true;
      /* Arrivé à zéro ici avant que le document soit marqué « ended ». */
      return t.status === 'running' && timers.timerRemainingMs(t) === 0;
    });
  }

  function rendre(state) {
    var timers = global.FamilyHubTimers;
    var liste = enAlarme(state, timers);
    var morceaux = [];
    for (var k = 0; k < liste.length; k++) morceaux.push(liste[k].id + '|' + (liste[k].label || ''));
    var nouvelleCle = morceaux.join('#');
    if (nouvelleCle === cle) return;
    cle = nouvelleCle;

    var el = assurerDom();
    el.innerHTML = '';
    if (liste.length === 0) {
      el.style.display = 'none';
      return;
    }
    for (var i = 0; i < liste.length; i++) {
      (function (t) {
        var ligne = document.createElement('div');
        ligne.className = 'fh-alarme-ligne fh-maintenant fh-corps';
        ligne.innerHTML = ICONE_CLOCHE +
          '<div class="fh-alarme-texte fh-titre">' + echapper(t.label || 'Minuteur') + ' : c\'est prêt !</div>';
        var ok = document.createElement('button');
        ok.type = 'button';
        ok.className = 'fh-alarme-btn fh-corps';
        ok.setAttribute('aria-label', 'OK, arrêter l\'alarme');
        /* Pas de flex sur un <button> en iOS 9 : span intérieur. */
        ok.innerHTML = '<span class="fh-min-dedans">' + ICONE_OK + '<span>OK</span></span>';
        ok.addEventListener('click', function () { timers.acknowledgeTimer(t); });
        ligne.appendChild(ok);
        el.appendChild(ligne);
      })(liste[i]);
    }
    el.style.display = 'block';
  }

  function demarrer() {
    if (!global.FamilyHubTimers || typeof global.FamilyHubTimers.subscribe !== 'function') return;
    global.FamilyHubTimers.subscribe(rendre);
  }

  if (document.body) demarrer();
  else document.addEventListener('DOMContentLoaded', demarrer);

  global.FamilyHubAlarme = { rendre: rendre };
})(window);
