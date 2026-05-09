/* tiles/calendar.js — calendrier familial Google via flux iCal pré-calculé.
   Vue compacte = prochain event + 2 suivants. Vue expand = pager 7 jours/page swipeable.
   ES5 vanilla, iOS 9 OK. La data vient du snapshot ; aucun appel réseau direct ici. */
(function (global) {
  'use strict';

  var DAYS_FR = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
  var DAYS_LONG_FR = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  var MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin',
                   'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
  var MONTHS_LONG_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  var DAYS_PER_PAGE = 7;
  var DEFAULT_PAGES = 3; /* 21 jours visibles par défaut côté display */

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function parseISO(s) {
    if (!s) return null;
    var d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function startOfDay(d) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function addDays(d, n) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  }

  /* ISO week : lundi = jour 1. Pour un dim (jour 0 JS), on recule de 6. */
  function startOfWeekMonday(d) {
    var day = d.getDay();
    var diff = (day === 0) ? -6 : (1 - day);
    return addDays(startOfDay(d), diff);
  }

  function sameDay(a, b) {
    return a.getFullYear() === b.getFullYear()
      && a.getMonth() === b.getMonth()
      && a.getDate() === b.getDate();
  }

  function dayKey(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function fmtTime(d) {
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /* Date locale ISO YYYY-MM-DD (iPad timezone). */
  function todayISOLocal() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  /* Label relatif partagé : "Aujourd'hui", "Demain", "lundi", ou "lun. 9 mai". */
  function dayLabel(d, diffDays) {
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Demain';
    if (diffDays > 1 && diffDays < 7) return DAYS_LONG_FR[d.getDay()];
    return DAYS_FR[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_FR[d.getMonth()];
  }

  /* Pour un event all-day, on évite la math timezone : on lit juste la
     date portion (YYYY-MM-DD) du startISO et on compare au today local
     en string. Évite les bugs node-ical / iOS 9 qui peuvent décaler
     l'event d'une journée selon l'interprétation TZ de DATE iCal. */
  function fmtRelativeDayForEvent(ev, evStartDate, now) {
    if (ev && ev.allDay && ev.startISO) {
      var eventISO = String(ev.startISO).slice(0, 10);
      var todayStr = todayISOLocal();
      /* Event multi-jours qui a commencé dans le passé mais est encore
         upcoming (le filtre upcoming garantit que eventEndDate > todayStr).
         L'event est en cours aujourd'hui → label "Aujourd'hui" plutôt que
         la date de début dans le passé ("ven. 8 mai"). */
      if (eventISO < todayStr) return "Aujourd'hui";
      var parts = eventISO.split('-');
      if (parts.length === 3) {
        var year = parseInt(parts[0], 10);
        var month = parseInt(parts[1], 10) - 1;
        var day = parseInt(parts[2], 10);
        if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
          /* Date locale à midi pour day-of-week stable et diff sans DST gotcha */
          var localDate = new Date(year, month, day, 12, 0, 0);
          var todayNoon = new Date(todayStr + 'T12:00:00');
          var diffDays = Math.round((localDate.getTime() - todayNoon.getTime()) / 86400000);
          return dayLabel(localDate, diffDays);
        }
      }
    }
    return fmtRelativeDay(evStartDate, now);
  }

  function fmtRelativeDay(d, now) {
    /* Ancrage à midi pour calculer un diff EN JOURS calendrier propre.
       L'ancien code faisait `d.getTime() - startOfDay(now).getTime()` puis
       Math.round en jours, ce qui pour un event aujourd'hui à 14h donnait
       14h = 0.58 jour → arrondi à 1 → "Demain" au lieu d'"Aujourd'hui".
       Bug indépendant du fuseau iPad. Pinning à midi des deux côtés
       neutralise l'heure de l'event ET les transitions DST (23h/25h day
       → 0.96/1.04 → arrondi propre). */
    var todayNoon = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0);
    var eventDayNoon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0);
    var diffDays = Math.round((eventDayNoon.getTime() - todayNoon.getTime()) / 86400000);
    /* Idem all-day : event timé multi-jours qui a commencé hier ou avant
       et qui est encore upcoming → en cours aujourd'hui. */
    if (diffDays < 0) return "Aujourd'hui";
    return dayLabel(d, diffDays);
  }

  function fmtEventTime(ev, evStart, evEnd) {
    if (ev.allDay) return 'Journée';
    if (!evEnd || evEnd.getTime() === evStart.getTime()) return fmtTime(evStart);
    if (sameDay(evStart, evEnd)) return fmtTime(evStart) + '–' + fmtTime(evEnd);
    return fmtTime(evStart);
  }

  function escapeHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* --- Vue COMPACTE (tile dans la grille) — minimaliste, façon météo --- */
  /* Affiche UN seul prochain événement gros & lisible + un compteur de l'à-venir.
     L'agenda complet est dans la vue plein écran (tap). */
  function render(container, data, _config) {
    container.className = 'grid-cell tile-calendar tile-clickable';
    container.innerHTML = '';

    var titleEl = document.createElement('div');
    titleEl.className = 'tile-title';
    titleEl.innerHTML = 'Agenda';
    container.appendChild(titleEl);

    var wrap = document.createElement('div');
    wrap.className = 'tile-calendar-compact';
    container.appendChild(wrap);

    var events = (data && data.events) || [];
    var now = new Date();
    var todayStr = todayISOLocal();
    var upcoming = [];
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      if (ev.allDay) {
        /* Pour all-day : compare juste la date portion en string. Évite
           le bug où un event Friday all-day apparaît "encore upcoming"
           samedi à cause d'une interprétation TZ exotique de l'endISO. */
        var eventEndDate = String(ev.endISO || ev.startISO || '').slice(0, 10);
        if (eventEndDate <= todayStr) continue;
      } else {
        var endD = parseISO(ev.endISO);
        if (endD && endD.getTime() < now.getTime()) continue;
      }
      upcoming.push(ev);
    }

    if (upcoming.length === 0) {
      wrap.innerHTML = '<div class="cal-compact-empty">Aucun événement à venir</div>';
      return;
    }

    var first = upcoming[0];
    var firstStart = parseISO(first.startISO);
    if (!firstStart) {
      wrap.innerHTML = '<div class="cal-compact-empty">Données invalides</div>';
      return;
    }

    var when = fmtRelativeDayForEvent(first, firstStart, now);
    if (!first.allDay) when += ' · ' + fmtTime(firstStart);

    var html = '';
    /* Premier event : grand format (when + summary + loc) */
    html += '<div class="cal-compact-when">' + escapeHtml(when) + '</div>';
    html += '<div class="cal-compact-summary">' + escapeHtml(first.summary) + '</div>';
    if (first.location) {
      html += '<div class="cal-compact-loc">' + escapeHtml(first.location) + '</div>';
    }

    /* 2 events suivants : compacts (when + summary inline). On compte les
       events EFFECTIVEMENT rendus (pas le max théorique) pour que le
       compteur "+ N autres" reste cohérent si un event a un startISO
       malformé et est skippé dans la boucle. */
    var nextN = Math.min(2, upcoming.length - 1);
    var nextRendered = 0;
    var lastRenderedIdx = 0;
    if (nextN > 0) {
      var nextHtml = '';
      for (var k = 1; k <= nextN; k++) {
        var ev = upcoming[k];
        var evStart = parseISO(ev.startISO);
        if (!evStart) continue;
        var evWhen = fmtRelativeDayForEvent(ev, evStart, now);
        if (!ev.allDay) evWhen += ' · ' + fmtTime(evStart);
        nextHtml += '<div class="cal-compact-next">' +
          '<span class="cal-compact-next-when">' + escapeHtml(evWhen) + '</span>' +
          '<span class="cal-compact-next-summary">' + escapeHtml(ev.summary) + '</span>' +
          '</div>';
        nextRendered++;
        lastRenderedIdx = k;
      }
      if (nextRendered > 0) {
        html += '<div class="cal-compact-next-list">' + nextHtml + '</div>';
      }
    }

    /* moreCount = events restants après le primary (idx 0) et après le
       dernier rendu inline. Évite de mentir si un event invalide a été
       skippé dans la boucle ci-dessus. */
    var moreCount = upcoming.length - 1 - nextRendered;
    if (moreCount > 0) {
      var label = moreCount === 1 ? '+ 1 autre' : '+ ' + moreCount + ' autres';
      html += '<div class="cal-compact-more">' + label + '</div>';
    }

    wrap.innerHTML = html;
  }

  function cleanup(container) {
    container.innerHTML = '';
  }

  /* --- Vue PLEIN ÉCRAN — pager 7 jours/page swipeable --- */

  /* Construit les pages alignées sur la semaine Lun→Dim (semaine ISO).
     Page 1 = semaine de today (avec jours passés visibles mais dimés). */
  function buildPages(events, now, pageCount) {
    var today = startOfDay(now);
    var weekStart = startOfWeekMonday(now);
    var byDay = {};
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var s = parseISO(ev.startISO);
      var e = parseISO(ev.endISO);
      if (!s) continue;
      /* Events dont end est passé : skip. Events en cours (start passé, end futur) → today. */
      var anchor = s;
      if (s.getTime() < today.getTime()) {
        if (!e || e.getTime() < now.getTime()) continue;
        anchor = today;
      }
      var k = dayKey(anchor);
      if (!byDay[k]) byDay[k] = [];
      byDay[k].push({ ev: ev, start: s, end: e, displayedDay: anchor });
    }

    /* Étend le nombre de pages si des events tombent au-delà du défaut. */
    var maxOffsetFromWeekStart = 0;
    for (var key in byDay) {
      if (!byDay.hasOwnProperty(key)) continue;
      var d = byDay[key][0].displayedDay;
      var off = Math.round((d.getTime() - weekStart.getTime()) / 86400000);
      if (off > maxOffsetFromWeekStart) maxOffsetFromWeekStart = off;
    }
    var actualPages = Math.max(1, Math.min(
      Math.max(pageCount, Math.ceil((maxOffsetFromWeekStart + 1) / DAYS_PER_PAGE)),
      6 /* hard cap : 6 pages = 42 jours */
    ));

    var pages = [];
    for (var p = 0; p < actualPages; p++) {
      var page = [];
      for (var di = 0; di < DAYS_PER_PAGE; di++) {
        var date = addDays(weekStart, p * DAYS_PER_PAGE + di);
        var items = byDay[dayKey(date)] || [];
        items.sort(function (a, b) { return a.start.getTime() - b.start.getTime(); });
        page.push({ date: date, items: items, isPast: date.getTime() < today.getTime() });
      }
      pages.push(page);
    }
    return pages;
  }

  function renderDayRow(day, now) {
    var row = document.createElement('div');
    row.className = 'cal-day-row';
    if (sameDay(day.date, now)) row.className += ' cal-day-row-today';
    else if (day.isPast) row.className += ' cal-day-row-past';
    if (day.items.length === 0) row.className += ' cal-day-row-empty';

    var pill = document.createElement('div');
    pill.className = 'cal-day-pill';
    var dayName = DAYS_LONG_FR[day.date.getDay()];
    var rel = fmtRelativeDay(day.date, now);
    var labelTop = (rel === "Aujourd'hui" || rel === 'Demain') ? rel : dayName;
    pill.innerHTML =
      '<div class="cal-day-pill-name">' + escapeHtml(labelTop) + '</div>' +
      '<div class="cal-day-pill-date">' + day.date.getDate() + ' ' + MONTHS_FR[day.date.getMonth()] + '</div>';
    row.appendChild(pill);

    var events = document.createElement('div');
    events.className = 'cal-day-events';

    if (day.items.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'cal-day-empty';
      empty.innerHTML = '—';
      events.appendChild(empty);
    } else {
      for (var i = 0; i < day.items.length; i++) {
        var it = day.items[i];
        var card = document.createElement('div');
        card.className = 'cal-event' + (it.ev.allDay ? ' cal-event-allday' : '');
        var loc = it.ev.location
          ? '<div class="cal-event-loc">' + escapeHtml(it.ev.location) + '</div>'
          : '';
        card.innerHTML =
          '<div class="cal-event-time">' + escapeHtml(fmtEventTime(it.ev, it.start, it.end)) + '</div>' +
          '<div class="cal-event-body">' +
            '<div class="cal-event-summary">' + escapeHtml(it.ev.summary) + '</div>' +
            loc +
          '</div>';
        events.appendChild(card);
      }
    }
    row.appendChild(events);
    return row;
  }

  function renderPage(page, now) {
    var pageEl = document.createElement('div');
    pageEl.className = 'cal-page';
    for (var i = 0; i < page.length; i++) {
      pageEl.appendChild(renderDayRow(page[i], now));
    }
    return pageEl;
  }

  /* Format "1er – 7 mai" ou "29 avril – 5 mai" pour le label de page. */
  function formatPageRange(page) {
    if (!page || page.length === 0) return '';
    var first = page[0].date;
    var last = page[page.length - 1].date;
    function dayLabel(d, withMonth) {
      var num = d.getDate();
      var prefix = (num === 1) ? '1er' : String(num);
      return withMonth ? (prefix + ' ' + MONTHS_FR[d.getMonth()]) : prefix;
    }
    if (first.getMonth() === last.getMonth() && first.getFullYear() === last.getFullYear()) {
      return dayLabel(first, false) + ' – ' + dayLabel(last, true);
    }
    return dayLabel(first, true) + ' – ' + dayLabel(last, true);
  }

  /* Pager swipeable. Retourne { root, goTo(idx) }. */
  function buildPager(pages, now) {
    var pageCount = pages.length;
    var currentIdx = 0;

    var viewport = document.createElement('div');
    viewport.className = 'cal-pager-viewport';

    var track = document.createElement('div');
    track.className = 'cal-pager-track';
    track.style.width = (pageCount * 100) + '%';
    viewport.appendChild(track);

    for (var i = 0; i < pageCount; i++) {
      var pg = renderPage(pages[i], now);
      pg.style.width = (100 / pageCount) + '%';
      track.appendChild(pg);
    }

    /* Navigation : flèches + libellé de page central explicite. */
    var nav = document.createElement('div');
    nav.className = 'cal-pager-nav';

    var prevBtn = document.createElement('button');
    prevBtn.className = 'cal-pager-arrow cal-pager-arrow-prev';
    prevBtn.innerHTML = '‹';
    prevBtn.setAttribute('aria-label', 'Semaine précédente');

    var label = document.createElement('div');
    label.className = 'cal-pager-label';

    var nextBtn = document.createElement('button');
    nextBtn.className = 'cal-pager-arrow cal-pager-arrow-next';
    nextBtn.innerHTML = '›';
    nextBtn.setAttribute('aria-label', 'Semaine suivante');

    nav.appendChild(prevBtn);
    nav.appendChild(label);
    nav.appendChild(nextBtn);

    function setTransform(x, animate) {
      var t = 'translate3d(' + x + 'px,0,0)';
      track.style.webkitTransition = animate ? '-webkit-transform 0.32s ease' : 'none';
      track.style.transition = animate ? 'transform 0.32s ease' : 'none';
      track.style.webkitTransform = t;
      track.style.transform = t;
    }

    function updateDots() {
      var range = formatPageRange(pages[currentIdx]);
      label.innerHTML =
        '<span class="cal-pager-label-range">' + escapeHtml(range) + '</span>' +
        '<span class="cal-pager-label-step">Semaine ' + (currentIdx + 1) + ' / ' + pageCount + '</span>';
      prevBtn.disabled = (currentIdx === 0);
      nextBtn.disabled = (currentIdx === pageCount - 1);
      prevBtn.style.opacity = (currentIdx === 0) ? '0.25' : '1';
      nextBtn.style.opacity = (currentIdx === pageCount - 1) ? '0.25' : '1';
    }

    function goTo(idx) {
      if (idx < 0) idx = 0;
      if (idx > pageCount - 1) idx = pageCount - 1;
      currentIdx = idx;
      var w = viewport.offsetWidth;
      setTransform(-idx * w, true);
      updateDots();
    }

    prevBtn.addEventListener('click', function () { goTo(currentIdx - 1); });
    nextBtn.addEventListener('click', function () { goTo(currentIdx + 1); });

    /* Touch swipe — uniquement horizontal, ne capte pas le scroll vertical */
    var touchStartX = 0, touchStartY = 0;
    var dragging = false, isHorizontal = null;
    var pageWidth = 0;

    viewport.addEventListener('touchstart', function (e) {
      if (!e.touches || e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isHorizontal = null;
      dragging = true;
      pageWidth = viewport.offsetWidth;
    }, false);

    viewport.addEventListener('touchmove', function (e) {
      if (!dragging || !e.touches || e.touches.length !== 1) return;
      var dx = e.touches[0].clientX - touchStartX;
      var dy = e.touches[0].clientY - touchStartY;
      if (isHorizontal === null) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        isHorizontal = Math.abs(dx) > Math.abs(dy);
      }
      if (isHorizontal) {
        if (e.cancelable !== false) e.preventDefault();
        var offset = -currentIdx * pageWidth + dx;
        /* Rubber band aux extrémités */
        if (currentIdx === 0 && dx > 0) offset = dx * 0.3;
        if (currentIdx === pageCount - 1 && dx < 0) offset = -currentIdx * pageWidth + dx * 0.3;
        setTransform(offset, false);
      }
    }, false);

    function endTouch(e) {
      if (!dragging) return;
      dragging = false;
      if (!isHorizontal) return;
      var endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : touchStartX;
      var dx = endX - touchStartX;
      var threshold = Math.min(80, pageWidth * 0.2);
      if (dx <= -threshold && currentIdx < pageCount - 1) goTo(currentIdx + 1);
      else if (dx >= threshold && currentIdx > 0) goTo(currentIdx - 1);
      else goTo(currentIdx);
    }

    viewport.addEventListener('touchend', endTouch, false);
    viewport.addEventListener('touchcancel', endTouch, false);

    /* Init */
    updateDots();
    /* Recalc transform au resize éventuel (orientation) */
    window.addEventListener('resize', function () { goTo(currentIdx); });

    return {
      viewport: viewport,
      nav: nav,
      goTo: goTo,
      pageCount: pageCount
    };
  }

  function expand(container, data, _config) {
    container.innerHTML = '';
    container.className = 'tile-overlay-content tile-calendar-expand';

    /* Header : titre + meta refresh */
    var headWrap = document.createElement('div');
    headWrap.className = 'cal-head';

    var titleEl = document.createElement('h1');
    titleEl.className = 'tile-overlay-h1 cal-head-title';
    titleEl.innerHTML = 'Agenda famille';
    headWrap.appendChild(titleEl);

    if (data && data.fetchedAt) {
      var fetched = parseISO(data.fetchedAt);
      if (fetched) {
        var refreshEl = document.createElement('div');
        refreshEl.className = 'cal-head-meta';
        refreshEl.innerHTML = 'Mis à jour ' + fmtTime(fetched);
        headWrap.appendChild(refreshEl);
      }
    }
    container.appendChild(headWrap);

    var events = (data && data.events) || [];
    var now = new Date();
    var pages = buildPages(events, now, DEFAULT_PAGES);
    var pager = buildPager(pages, now);

    container.appendChild(pager.viewport);
    container.appendChild(pager.nav);

    /* Stocke la ref pager pour cleanup éventuel */
    container._calPager = pager;
  }

  function collapse(container) {
    if (container && container._calPager) container._calPager = null;
    if (container) container.innerHTML = '';
  }

  global.Tiles = global.Tiles || {};
  global.Tiles.calendar = {
    render: render,
    cleanup: cleanup,
    expand: expand,
    collapse: collapse
  };
})(window);
