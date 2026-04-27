/* recipe.js — Recipe step-by-step mode + timer. ES5 vanilla. */
(function () {
  'use strict';

  var state = {
    recipe: null,
    stepIdx: 0,
    timer: {
      running: false,
      endAt: 0,
      durationMin: 0,
      intervalId: null
    },
    audioUnlocked: false
  };

  function $(id) { return document.getElementById(id); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function escapeHTML(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getQueryParam(name) {
    var q = window.location.search.substring(1);
    var pairs = q.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var kv = pairs[i].split('=');
      if (decodeURIComponent(kv[0]) === name) {
        return decodeURIComponent((kv[1] || '').replace(/\+/g, ' '));
      }
    }
    return null;
  }

  /* iOS audio unlock — first touch, do a silent play() so beep fires later */
  function unlockAudio() {
    if (state.audioUnlocked) return;
    var a = $('timer-beep');
    if (!a) return;
    try {
      a.volume = 0;
      var p = a.play();
      if (p && typeof p.then === 'function') {
        p.then(function () {
          a.pause();
          a.currentTime = 0;
          a.volume = 1;
          state.audioUnlocked = true;
        })['catch'](function () { /* will retry on next gesture */ });
      } else {
        a.pause();
        a.currentTime = 0;
        a.volume = 1;
        state.audioUnlocked = true;
      }
    } catch (e) { /* swallow */ }
  }

  /* ---------- Render ---------- */

  function renderMeta(r) {
    var parts = [];
    if (r.personnes) parts.push(r.personnes + ' pers.');
    if (r.temps_min) parts.push(r.temps_min + ' min');
    if (r.niveau) parts.push(r.niveau);
    return parts.join(' <span class="dot">·</span> ');
  }

  function renderIngredients(list) {
    var ul = $('ingredients-list');
    if (!ul) return;
    var html = '';
    for (var i = 0; i < list.length; i++) {
      html += '<li>' + escapeHTML(list[i]) + '</li>';
    }
    ul.innerHTML = html;
  }

  function renderStep() {
    var r = state.recipe;
    if (!r || !r.etapes || !r.etapes.length) {
      $('step-text').innerHTML = 'Pas d\'étape';
      $('step-counter').innerHTML = '';
      return;
    }
    var idx = state.stepIdx;
    var step = r.etapes[idx];
    $('step-counter').innerHTML = 'Étape ' + (idx + 1) + ' / ' + r.etapes.length;
    $('step-text').innerHTML = escapeHTML(step.texte);

    var btn = $('step-timer-btn');
    if (step.duree_min && step.duree_min > 0) {
      $('step-timer-label').innerHTML = 'Lancer minuteur ' + step.duree_min + ' min';
      btn.removeAttribute('hidden');
      btn.setAttribute('data-min', step.duree_min);
    } else {
      btn.setAttribute('hidden', 'hidden');
    }

    var prev = $('step-prev');
    var next = $('step-next');
    if (idx === 0) prev.setAttribute('disabled', 'disabled'); else prev.removeAttribute('disabled');
    if (idx >= r.etapes.length - 1) next.setAttribute('disabled', 'disabled'); else next.removeAttribute('disabled');
  }

  /* ---------- Timer ---------- */

  function formatRemaining(ms) {
    if (ms < 0) ms = 0;
    var totalSec = Math.ceil(ms / 1000);
    var m = Math.floor(totalSec / 60);
    var s = totalSec % 60;
    return pad2(m) + ':' + pad2(s);
  }

  function updateTimerDisplay() {
    var t = state.timer;
    if (!t.running) return;
    var remaining = t.endAt - (new Date()).getTime();
    $('timer-pill-time').innerHTML = formatRemaining(remaining);
    if (remaining <= 0) {
      onTimerEnd();
    }
  }

  function onTimerEnd() {
    stopTimer(false);
    var beep = $('timer-beep');
    if (beep) {
      try {
        beep.currentTime = 0;
        beep.play();
        /* Repeat the beep a few times for kitchen ambient noise */
        var count = 0;
        var rep = setInterval(function () {
          count++;
          if (count >= 3) { clearInterval(rep); return; }
          try { beep.currentTime = 0; beep.play(); } catch (e) { clearInterval(rep); }
        }, 900);
      } catch (e) { /* */ }
    }
    /* Visual flash */
    var pill = $('timer-pill');
    pill.style.background = '#4A7C59';
    $('timer-pill-time').innerHTML = 'Terminé';
    setTimeout(function () {
      pill.setAttribute('hidden', 'hidden');
      pill.style.background = '';
    }, 4000);
  }

  function startTimer(minutes) {
    stopTimer(true);
    var t = state.timer;
    t.running = true;
    t.durationMin = minutes;
    t.endAt = (new Date()).getTime() + minutes * 60 * 1000;
    var pill = $('timer-pill');
    pill.removeAttribute('hidden');
    updateTimerDisplay();
    t.intervalId = setInterval(updateTimerDisplay, 500);
  }

  function stopTimer(silent) {
    var t = state.timer;
    if (t.intervalId) clearInterval(t.intervalId);
    t.intervalId = null;
    t.running = false;
    if (!silent) {
      $('timer-pill').setAttribute('hidden', 'hidden');
    }
  }

  /* ---------- Loading ---------- */

  function showError(msg) {
    $('recipe-title').innerHTML = 'Recette introuvable';
    $('step-text').innerHTML = escapeHTML(msg || 'La recette demandée n\'a pas été trouvée.');
    $('step-counter').innerHTML = '';
    $('step-timer-btn').setAttribute('hidden', 'hidden');
    $('step-prev').setAttribute('disabled', 'disabled');
    $('step-next').setAttribute('disabled', 'disabled');
  }

  function loadMenu(callback) {
    var xhr = new XMLHttpRequest();
    var url = '/data/menu-semaine.json?t=' + (new Date()).getTime();
    xhr.open('GET', url, true);
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        try { callback(null, JSON.parse(xhr.responseText)); }
        catch (e) { callback(e, null); }
      } else {
        callback(new Error('HTTP ' + xhr.status), null);
      }
    };
    xhr.onerror = function () { callback(new Error('Network'), null); };
    xhr.send();
  }

  function init() {
    var id = getQueryParam('id');
    if (!id) { showError('Aucun id de recette.'); return; }

    loadMenu(function (err, menu) {
      if (err || !menu || !menu.recettes || !menu.recettes[id]) {
        showError('Recette introuvable dans le menu.');
        return;
      }
      var r = menu.recettes[id];
      state.recipe = r;
      state.stepIdx = 0;

      $('recipe-title').innerHTML = escapeHTML(r.nom);
      $('recipe-meta').innerHTML = renderMeta(r);
      renderIngredients(r.ingredients || []);
      renderStep();
    });

    /* Wire interactions */
    $('step-prev').addEventListener('click', function () {
      if (state.stepIdx > 0) { state.stepIdx--; renderStep(); }
    });
    $('step-next').addEventListener('click', function () {
      if (state.recipe && state.stepIdx < state.recipe.etapes.length - 1) {
        state.stepIdx++; renderStep();
      }
    });
    $('step-timer-btn').addEventListener('click', function (e) {
      var min = parseInt(e.currentTarget.getAttribute('data-min'), 10);
      if (min > 0) startTimer(min);
    });
    $('timer-pill-stop').addEventListener('click', function () { stopTimer(false); });

    var ing = $('ingredients-section');
    $('ingredients-toggle').addEventListener('click', function () {
      if (ing.className.indexOf('is-collapsed') >= 0) {
        ing.className = 'ingredients';
      } else {
        ing.className = 'ingredients is-collapsed';
      }
    });

    /* Unlock audio on first user gesture */
    document.body.addEventListener('touchstart', unlockAudio, true);
    document.body.addEventListener('click', unlockAudio, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
