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

  function fmtRelativeDay(d, now) {
    var today = startOfDay(now);
    var diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Demain';
    if (diffDays > 1 && diffDays < 7) return DAYS_LONG_FR[d.getDay()];
    return DAYS_FR[d.getDay()] + ' ' + d.getDate() + ' ' + MONTHS_FR[d.getMonth()];
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

  /* --- Vue COMPACTE (tile dans la grille) --- */
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
    var upcoming = [];
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var endD = parseISO(ev.endISO);
      if (endD && endD.getTime() < now.getTime()) continue;
      upcoming.push(ev);
      if (upcoming.length >= 4) break;
    }

    if (upcoming.length === 0) {
      wrap.innerHTML = '<div class="tile-calendar-empty">Aucun événement à venir</div>';
      return;
    }

    var first = upcoming[0];
    var firstStart = parseISO(first.startISO);
    if (!firstStart) {
      wrap.innerHTML = '<div class="tile-calendar-empty">Données invalides</div>';
      return;
    }

    var html = '';
    html += '<div class="tile-calendar-next">';
    html += '<div class="tile-calendar-next-when">' + escapeHtml(fmtRelativeDay(firstStart, now));
    if (!first.allDay) html += ' · ' + fmtTime(firstStart);
    html += '</div>';
    html += '<div class="tile-calendar-next-summary">' + escapeHtml(first.summary) + '</div>';
    if (first.location) {
      html += '<div class="tile-calendar-next-loc">' + escapeHtml(first.location) + '</div>';
    }
    html += '</div>';

    if (upcoming.length > 1) {
      html += '<div class="tile-calendar-list">';
      for (var j = 1; j < upcoming.length; j++) {
        var ev2 = upcoming[j];
        var s2 = parseISO(ev2.startISO);
        if (!s2) continue;
        html += '<div class="tile-calendar-row">';
        html += '<div class="tile-calendar-row-when">' + escapeHtml(fmtRelativeDay(s2, now));
        if (!ev2.allDay) html += ' · ' + fmtTime(s2);
        html += '</div>';
        html += '<div class="tile-calendar-row-summary">' + escapeHtml(ev2.summary) + '</div>';
        html += '</div>';
      }
      html += '</div>';
    }

    if (events.length > upcoming.length) {
      html += '<div class="tile-calendar-hint">Touche pour voir tout l’agenda</div>';
    }

    wrap.innerHTML = html;
  }

  function cleanup(container) {
    container.innerHTML = '';
  }

  /* --- Vue PLEIN ÉCRAN — pager 7 jours/page swipeable --- */

  /* Construit les pages : tableau de pages, chaque page = tableau de 7 jours { date, items } */
  function buildPages(events, now, pageCount) {
    var today = startOfDay(now);
    var byDay = {};
    for (var i = 0; i < events.length; i++) {
      var ev = events[i];
      var s = parseISO(ev.startISO);
      var e = parseISO(ev.endISO);
      if (!s) continue;
      /* On garde les events en cours (start passé, end futur) en les rangeant à today */
      var anchor = s;
      if (s.getTime() < today.getTime()) {
        if (!e || e.getTime() < now.getTime()) continue;
        anchor = today;
      }
      var k = dayKey(anchor);
      if (!byDay[k]) byDay[k] = [];
      byDay[k].push({ ev: ev, start: s, end: e, displayedDay: anchor });
    }

    /* Détermine le nombre de pages : minimum 1, maximum pageCount,
       mais on étend si des events tombent au-delà */
    var maxOffset = 0;
    for (var key in byDay) {
      if (!byDay.hasOwnProperty(key)) continue;
      var d = byDay[key][0].displayedDay;
      var off = Math.round((d.getTime() - today.getTime()) / 86400000);
      if (off > maxOffset) maxOffset = off;
    }
    var actualPages = Math.max(1, Math.min(
      Math.max(pageCount, Math.ceil((maxOffset + 1) / DAYS_PER_PAGE)),
      6 /* hard cap : 6 pages = 42 jours */
    ));

    var pages = [];
    for (var p = 0; p < actualPages; p++) {
      var page = [];
      for (var di = 0; di < DAYS_PER_PAGE; di++) {
        var date = addDays(today, p * DAYS_PER_PAGE + di);
        var items = byDay[dayKey(date)] || [];
        items.sort(function (a, b) { return a.start.getTime() - b.start.getTime(); });
        page.push({ date: date, items: items });
      }
      pages.push(page);
    }
    return pages;
  }

  function renderDayRow(day, now) {
    var row = document.createElement('div');
    row.className = 'cal-day-row';
    if (sameDay(day.date, now)) row.className += ' cal-day-row-today';
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

    /* Pagination dots + flèches */
    var nav = document.createElement('div');
    nav.className = 'cal-pager-nav';

    var prevBtn = document.createElement('button');
    prevBtn.className = 'cal-pager-arrow cal-pager-arrow-prev';
    prevBtn.innerHTML = '‹';
    prevBtn.setAttribute('aria-label', 'Semaine précédente');

    var dots = document.createElement('div');
    dots.className = 'cal-pager-dots';
    var dotEls = [];
    for (var d = 0; d < pageCount; d++) {
      var dot = document.createElement('span');
      dot.className = 'cal-pager-dot';
      dotEls.push(dot);
      dots.appendChild(dot);
      (function (idx, dotEl) {
        dotEl.addEventListener('click', function () { goTo(idx); });
      })(d, dot);
    }

    var nextBtn = document.createElement('button');
    nextBtn.className = 'cal-pager-arrow cal-pager-arrow-next';
    nextBtn.innerHTML = '›';
    nextBtn.setAttribute('aria-label', 'Semaine suivante');

    nav.appendChild(prevBtn);
    nav.appendChild(dots);
    nav.appendChild(nextBtn);

    function setTransform(x, animate) {
      var t = 'translate3d(' + x + 'px,0,0)';
      track.style.webkitTransition = animate ? '-webkit-transform 0.32s ease' : 'none';
      track.style.transition = animate ? 'transform 0.32s ease' : 'none';
      track.style.webkitTransform = t;
      track.style.transform = t;
    }

    function updateDots() {
      for (var i = 0; i < dotEls.length; i++) {
        dotEls[i].className = 'cal-pager-dot' + (i === currentIdx ? ' cal-pager-dot-active' : '');
      }
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
