/* minuteurs-panneau.js — panneau des minuteurs, réutilisé par le tableau et le
   mode recette. ES5 strict, iOS 9.

   API : FamilyHubMinuteursPanneau.monter(conteneur, options) → { demonter() }
     options.libelleParDefaut : nom donné aux minuteurs lancés d'ici (ex. une
       étape de recette) ; sinon libellé automatique « 5 min ».
     options.autre : false pour masquer le bouton « Autre » (déjà dans le choix).
     options.surAutre : fonction appelée par « Autre » à la place de l'ouverture
       du choix plein écran (FamilyHubOverlay.open('timer', …)).

   Contenu : boutons 1 / 5 / 10 min et « Autre », puis la liste des minuteurs
   en cours (nom, temps restant, « +1 min », Pause/Reprendre, Arrêter). La
   liste n'est reconstruite que si sa composition change ; chaque seconde on
   ne réécrit que le texte du temps restant (sinon un tap en cours sauterait).
   Rien n'est tapé au clavier : le nom est automatique. */
(function (global) {
  'use strict';

  var RAPIDES = [1, 5, 10];

  var ICONE_MINUTEUR =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" class="fh-min-icone">' +
      '<circle cx="12" cy="13" r="8" fill="none" stroke="currentColor" stroke-width="2.2"/>' +
      '<path d="M12 9 V13 L15 15 M9 2 H15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' +
    '</svg>';
  var ICONE_PLUS =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" class="fh-min-icone">' +
      '<path d="M12 5 V19 M5 12 H19" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>' +
    '</svg>';
  var ICONE_PAUSE =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" class="fh-min-icone">' +
      '<rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/>' +
      '<rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/>' +
    '</svg>';
  var ICONE_LECTURE =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" class="fh-min-icone">' +
      '<path d="M7 5 L19 12 L7 19 Z" fill="currentColor"/>' +
    '</svg>';
  var ICONE_STOP =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" class="fh-min-icone">' +
      '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/>' +
    '</svg>';
  var ICONE_OK =
    '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" class="fh-min-icone">' +
      '<path d="M5 12.5 L10 17 L19 7" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  function echapper(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* « 09:00 », « 1:05:00 » au-delà d'une heure (comme formatMinuteur du hub). */
  function formatRestant(ms) {
    var total = Math.max(0, Math.ceil(ms / 1000));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    var deux = function (n) { return n < 10 ? '0' + n : '' + n; };
    return h > 0 ? h + ':' + deux(m) + ':' + deux(s) : deux(m) + ':' + deux(s);
  }

  function texteTemps(t, timers) {
    if (t.status === 'ended') return 'Prêt !';
    var txt = formatRestant(timers.timerRemainingMs(t));
    return t.status === 'paused' ? txt + ' · en pause' : txt;
  }

  function bouton(classes, html, aria) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'fh-min-btn fh-corps ' + classes;
    b.innerHTML = html;
    if (aria) b.setAttribute('aria-label', aria);
    return b;
  }

  function monter(conteneur, options) {
    var opts = options || {};
    var timers = global.FamilyHubTimers;
    var nom = (opts.libelleParDefaut && String(opts.libelleParDefaut).replace(/^\s+|\s+$/g, '')) || null;

    var racine = document.createElement('div');
    racine.className = 'fh-min-panneau fh-corps';
    conteneur.appendChild(racine);

    /* 1. Lancement en un toucher */
    var rangee = document.createElement('div');
    rangee.className = 'fh-min-rapides';
    racine.appendChild(rangee);
    for (var i = 0; i < RAPIDES.length; i++) {
      (function (min) {
        var b = bouton('fh-action fh-min-rapide', ICONE_MINUTEUR + '<span>' + min + ' min</span>',
          'Lancer un minuteur de ' + min + ' minute' + (min > 1 ? 's' : ''));
        b.addEventListener('click', function () {
          if (timers) timers.startTimer(nom, min * 60);
        });
        rangee.appendChild(b);
      })(RAPIDES[i]);
    }
    if (opts.autre !== false) {
      var autre = bouton('fh-carte fh-texte fh-bordure fh-min-rapide fh-min-doux', ICONE_PLUS + '<span>Autre</span>',
        'Choisir une autre durée');
      autre.addEventListener('click', function () {
        if (typeof opts.surAutre === 'function') { opts.surAutre(); return; }
        if (global.FamilyHubOverlay) {
          global.FamilyHubOverlay.open('timer', {}, { libelleParDefaut: nom });
        }
      });
      rangee.appendChild(autre);
    }

    /* 2. Minuteurs en cours */
    var liste = document.createElement('div');
    liste.className = 'fh-min-liste';
    racine.appendChild(liste);

    var cleListe = null;
    var tempsEls = {}; /* id → élément du temps restant */

    function actifs(state) {
      return (state.timers || []).filter(function (t) {
        return t.status === 'running' || t.status === 'paused' || t.status === 'ended';
      });
    }

    function construireLigne(t) {
      var ligne = document.createElement('div');
      ligne.className = 'fh-min-ligne fh-carte fh-bordure fh-min-' + t.status;

      var tete = document.createElement('div');
      tete.className = 'fh-min-tete';
      tete.innerHTML =
        '<div class="fh-min-nom fh-titre fh-texte">' + echapper(t.label || 'Minuteur') + '</div>' +
        '<div class="fh-min-temps fh-titre fh-texte">' + echapper(texteTemps(t, timers)) + '</div>';
      ligne.appendChild(tete);
      tempsEls[t.id] = tete.lastChild;

      var actions = document.createElement('div');
      actions.className = 'fh-min-actions';
      ligne.appendChild(actions);

      var plus = bouton('fh-action fh-min-action', ICONE_PLUS + '<span>1 min</span>', 'Ajouter une minute');
      plus.addEventListener('click', function () { timers.ajouterUneMinute(t); });
      actions.appendChild(plus);

      if (t.status === 'ended') {
        var ok = bouton('fh-maintenant fh-min-action', ICONE_OK + '<span>OK</span>', 'OK, arrêter l\'alarme');
        ok.addEventListener('click', function () { timers.acknowledgeTimer(t); });
        actions.appendChild(ok);
      } else if (t.status === 'paused') {
        var reprendre = bouton('fh-carte fh-texte fh-bordure fh-min-action fh-min-doux', ICONE_LECTURE + '<span>Reprendre</span>');
        reprendre.addEventListener('click', function () { timers.resumeTimer(t); });
        actions.appendChild(reprendre);
      } else {
        var pause = bouton('fh-carte fh-texte fh-bordure fh-min-action fh-min-doux', ICONE_PAUSE + '<span>Pause</span>');
        pause.addEventListener('click', function () { timers.pauseTimer(t); });
        actions.appendChild(pause);
      }

      if (t.status !== 'ended') {
        var arreter = bouton('fh-carte fh-texte fh-bordure fh-min-action fh-min-doux', ICONE_STOP + '<span>Arrêter</span>');
        arreter.addEventListener('click', function () { timers.stopTimer(t); });
        actions.appendChild(arreter);
      }
      return ligne;
    }

    function rendre(state) {
      var a = actifs(state);
      var morceaux = [];
      for (var k = 0; k < a.length; k++) {
        /* remainingSeconds/endsAt dans la clé : les objets capturés par les
           boutons doivent rester à jour (pause, +1 min). */
        var ends = global.FamilyHubMinuteurs ? global.FamilyHubMinuteurs.versMs(a[k].endsAt) : '';
        morceaux.push(a[k].id + '|' + a[k].status + '|' + (a[k].label || '') + '|' +
          (a[k].remainingSeconds || '') + '|' + ends + '|' + (a[k].durationSeconds || ''));
      }
      var cle = morceaux.join('#');
      if (cle !== cleListe) {
        cleListe = cle;
        tempsEls = {};
        liste.innerHTML = '';
        if (a.length === 0) {
          liste.innerHTML = '<p class="fh-min-vide fh-texte-doux">Aucun minuteur en cours.</p>';
          return;
        }
        for (var i = 0; i < a.length; i++) liste.appendChild(construireLigne(a[i]));
        return;
      }
      for (var j = 0; j < a.length; j++) {
        var el = tempsEls[a[j].id];
        if (!el) continue;
        var txt = texteTemps(a[j], timers);
        if (el.textContent !== txt) el.textContent = txt;
      }
    }

    var desabonner = timers ? timers.subscribe(rendre) : null;
    if (!timers) liste.innerHTML = '<p class="fh-min-vide fh-texte-doux">Minuteurs indisponibles.</p>';

    return {
      demonter: function () {
        if (desabonner) { try { desabonner(); } catch (e) {} desabonner = null; }
        tempsEls = {};
        if (racine.parentNode) racine.parentNode.removeChild(racine);
      }
    };
  }

  global.FamilyHubMinuteursPanneau = { monter: monter, formatRestant: formatRestant };
})(window);
