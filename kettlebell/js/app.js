/* Girya Coach — app shell: navigation, logging, history, 3D stages and the Claude connection. */
(function () {
  'use strict';

  var EX = window.KB_EXERCISES || [];
  var CATS = window.KB_CATEGORIES || [];
  var byId = {};
  EX.forEach(function (e, i) { e.n = i + 1; byId[e.id] = e; });

  var $ = function (s) { return document.querySelector(s); };
  var el = function (tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* ---------- Pesos: código de color de competición ---------- */
  var WEIGHTS = [4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 28, 32, 36, 40, 44, 48];
  var COMP = { 8: '#e86fa8', 12: '#3b82d6', 16: '#f2c230', 20: '#8b5cc7', 24: '#3fae5a', 28: '#f08a24', 32: '#d93a32', 36: '#8a8f96', 40: '#ecebe6', 44: '#b8bec6', 48: '#d4a72c' };
  var IRON = '#3a3e45';
  function bellColor(kg) { return COMP[kg] || IRON; }

  var ONE_HAND = ['swing_1h', 'sl_deadlift', 'suitcase_deadlift', 'front_squat', 'clean', 'press', 'push_press', 'jerk', 'snatch', 'bent_row', 'windmill', 'tgu', 'reverse_lunge', 'floor_press', 'farmer_carry', 'overhead_carry'];

  /* ---------- Almacenamiento local seguro ---------- */
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };

  /* ---------- Fechas ---------- */
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function weekStart(ts) { var d = new Date(ts); d.setHours(0, 0, 0, 0); var wd = (d.getDay() + 6) % 7; d.setDate(d.getDate() - wd); return d.getTime(); }
  var fmtInt = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 });
  function fmtKg(v) { return v >= 10000 ? (v / 1000).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + ' t' : fmtInt.format(v) + ' kg'; }
  function dayLabel(key) {
    var today = dayKey(Date.now()), y = dayKey(Date.now() - 864e5);
    if (key === today) return 'Hoy';
    if (key === y) return 'Ayer';
    var p = key.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'short' });
  }

  /* ---------- Unidades por ejercicio ---------- */
  function unitOf(ex) {
    var r = (ex && ex.reps) || '';
    var m = r.match(/^[\d\s\u2013-]+(m|s|seg)\b/);
    return m ? (m[1] === 'm' ? 'm' : 's') : 'reps';
  }
  function firstNum(s, d) { var m = String(s || '').match(/\d+/); return m ? +m[0] : d; }
  function volumeOf(entry) {
    var ex = byId[entry.ex];
    if (unitOf(ex) !== 'reps') return 0;
    var sides = ex && ex.unilateral ? 2 : 1;
    return entry.series * entry.reps * entry.peso * (entry.double ? 2 : 1) * sides;
  }
  function doseText(entry) {
    var ex = byId[entry.ex], u = unitOf(ex);
    var r = entry.reps + (u === 'm' ? ' m' : u === 's' ? ' s' : '');
    return entry.series + ' × ' + r + ' · ' + (entry.double ? '2×' : '') + entry.peso + ' kg';
  }

  /* ---------- Registros (localStorage + base de datos del artifact) ---------- */
  var Store = {
    db: null,
    logs: LS.get('girya.logs', []),
    subs: [],
    sorted: function () { return this.logs.slice().sort(function (a, b) { return b.ts - a.ts; }); },
    emit: function () { LS.set('girya.logs', this.logs); this.subs.forEach(function (f) { f(); }); },
    connect: function (db) {
      var self = this, col = db.collection('sesiones');
      self.db = db;
      var pending = self.logs.filter(function (l) { return !l.synced; });
      var chain = Promise.resolve();
      pending.forEach(function (l) {
        chain = chain.then(function () { l.synced = true; return col.doc(l.id).set(l); }).catch(function () { l.synced = false; });
      });
      chain.then(function () {
        col.onSnapshot(function (snap) {
          self.logs = snap.docs.map(function (d) { return d.data(); }).filter(function (x) { return x && x.id && x.ts; });
          self.emit();
        }, function (e) { console.warn('db', e && e.code); });
      });
    },
    add: function (entry) {
      var self = this;
      entry.synced = !!self.db;
      self.logs.push(entry);
      self.emit();
      if (!self.db) return Promise.resolve(entry);
      return self.db.collection('sesiones').doc(entry.id).set(entry).then(function () { return entry; }, function () {
        entry.synced = false; self.emit(); toast('Guardado solo en este teléfono'); return entry;
      });
    },
    remove: function (id) {
      this.logs = this.logs.filter(function (l) { return l.id !== id; });
      this.emit();
      if (this.db) this.db.collection('sesiones').doc(id).delete().catch(function () {});
    }
  };

  function newEntry(ex, series, reps, peso, dbl, notas, origen) {
    var ts = Date.now();
    var e = {
      id: 's' + ts.toString(36) + Math.random().toString(36).slice(2, 6),
      ts: ts, fecha: dayKey(ts), ex: ex.id, nombre: ex.nombre, cat: ex.cat,
      series: series, reps: reps, peso: peso, double: !!dbl, notas: notas || '', origen: origen || 'app'
    };
    e.volumen = volumeOf(e);
    return e;
  }

  /* ---------- Toast ---------- */
  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }

  /* ---------- Colores para el 3D (desde los tokens del tema) ---------- */
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function sceneColors(kg) {
    return { figure: cssVar('--fig'), figureAccent: cssVar('--fig-2'), bell: bellColor(kg), floor: cssVar('--floor'), bg: null };
  }
  var has3D = function () { return !!(window.KB3D && window.THREE); };

  /* ---------- Navegación ---------- */
  var current = 'hoy';
  function go(view) {
    if (!document.getElementById('view-' + view)) view = 'hoy';
    current = view;
    document.querySelectorAll('.view').forEach(function (v) { v.hidden = v.dataset.view !== view; });
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.toggle('is-active', t.dataset.goto === view); });
    if (heroViewer) { if (view === 'hoy') heroViewer.resume(); else heroViewer.pause(); }
    if (view === 'ejercicios') startThumbs();
    if (view === 'historial') renderHistory();
    if (view === 'coach') { renderChat(); scrollChat(); }
    try { history.replaceState(history.state, '', '#' + view); } catch (e) { /* marco restringido */ }
    window.scrollTo(0, 0);
  }
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-goto]');
    if (b) { ev.preventDefault(); go(b.dataset.goto); }
  });

  /* ---------- HOY ---------- */
  var heroViewer = null, heroEx = null;
  function exOfDay() {
    var k = dayKey(Date.now()), h = 0;
    for (var i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) >>> 0;
    return EX[h % EX.length];
  }
  function setHero(ex) {
    heroEx = ex;
    $('#heroTitle').textContent = ex.nombre;
    $('#heroMeta').textContent = ex.cat + ' · ' + ex.musculos.slice(0, 3).join(', ') + ' · ' + ex.series + ' × ' + ex.reps;
    var kg = lastWeight(ex) || ex.pesoInicial || 16;
    document.querySelector('.hero').style.setProperty('--bell', bellColor(kg));
    if (has3D()) {
      if (!heroViewer) heroViewer = KB3D.create($('#heroStage'), { colors: sceneColors(kg), interactive: true });
      else heroViewer.setColors(sceneColors(kg));
      heroViewer.play(ex.anim, { double: !!ex.double });
    }
  }
  $('#heroOpen').addEventListener('click', function () { openSheet(heroEx.id); });
  $('#heroNext').addEventListener('click', function () {
    var next;
    do { next = EX[Math.floor(Math.random() * EX.length)]; } while (EX.length > 1 && next === heroEx);
    setHero(next);
  });

  function weekSummary(offsetWeeks) {
    var start = weekStart(Date.now()) - (offsetWeeks || 0) * 7 * 864e5, end = start + 7 * 864e5;
    var days = {}, sets = 0, vol = 0, n = 0;
    Store.logs.forEach(function (l) {
      if (l.ts >= start && l.ts < end) { days[l.fecha] = 1; sets += +l.series || 0; vol += volumeOf(l); n++; }
    });
    return { days: Object.keys(days).length, sets: sets, vol: vol, n: n, start: start };
  }
  function streak() {
    var set = {};
    Store.logs.forEach(function (l) { set[l.fecha] = 1; });
    var d = new Date(); d.setHours(12, 0, 0, 0);
    if (!set[dayKey(d.getTime())]) d.setDate(d.getDate() - 1);
    var s = 0;
    while (set[dayKey(d.getTime())]) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }
  function renderHome() {
    var w = weekSummary(0), st = streak();
    $('#weekStats').innerHTML =
      '<div class="stat"><div class="stat-num">' + w.days + '<small>/7</small></div><div class="stat-label">Días esta semana</div></div>' +
      '<div class="stat"><div class="stat-num">' + w.sets + '</div><div class="stat-label">Series esta semana</div></div>' +
      '<div class="stat"><div class="stat-num">' + (w.vol >= 10000 ? (w.vol / 1000).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + '<small>t</small>' : fmtInt.format(w.vol) + '<small>kg</small>') + '</div><div class="stat-label">Volumen' + (st > 1 ? ' · racha ' + st + ' días' : '') + '</div></div>';
    var list = $('#recentList');
    var logs = Store.sorted().slice(0, 4);
    list.innerHTML = '';
    if (!logs.length) {
      list.appendChild(el('li', 'empty', 'Aún no hay registros. Elige un ejercicio, ingresa series, reps y peso, y toca <b>Guardar</b>. También puedes decirle a Claude “registra 5 series de 10 swings con 24 kg”.'));
      return;
    }
    logs.forEach(function (l) { list.appendChild(logItem(l, false)); });
  }
  function logItem(l, deletable) {
    var li = el('li', 'log-item');
    li.innerHTML =
      '<span class="log-bell" style="--c:' + bellColor(l.peso) + '"></span>' +
      '<div class="log-main"><div class="log-name">' + esc(l.nombre) + '</div><div class="log-meta">' + esc(doseText(l)) + (l.origen === 'claude' ? ' · vía Claude' : '') + '</div>' +
      (l.notas ? '<div class="log-meta">' + esc(l.notas) + '</div>' : '') + '</div>' +
      '<div class="log-side">' + (l.volumen ? '<b>' + fmtInt.format(l.volumen) + '</b>kg' : '<b>' + new Date(l.ts).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }) + '</b>') +
      (deletable ? '<br><button type="button" class="log-del" data-del="' + esc(l.id) + '">Borrar</button>' : '') + '</div>';
    li.querySelector('.log-main').addEventListener('click', function () { if (byId[l.ex]) openSheet(l.ex); });
    return li;
  }

  /* ---------- EJERCICIOS ---------- */
  var filterCat = 'Todos', filterText = '';
  var thumbCache = {}, thumbQueue = [], thumbsRunning = false;
  var PH = '<svg class="ph" viewBox="0 0 32 32" aria-hidden="true"><path d="M7 17C4.8 8 8.5 3 16 3S27.2 8 25 17" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/><path d="M16 11.5c6.4 0 10.5 4.3 10.5 9.6 0 3-1.2 5.6-3.1 7.4H8.6c-1.9-1.8-3.1-4.4-3.1-7.4 0-5.3 4.1-9.6 10.5-9.6z" fill="currentColor"/></svg>';

  function renderChips() {
    var box = $('#catChips');
    box.innerHTML = '';
    ['Todos'].concat(CATS).forEach(function (c) {
      var b = el('button', 'chip', esc(c));
      b.type = 'button'; b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(c === filterCat));
      b.addEventListener('click', function () { filterCat = c; renderChips(); renderGrid(); });
      box.appendChild(b);
    });
  }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function matches(ex) {
    if (filterCat !== 'Todos' && ex.cat !== filterCat) return false;
    if (!filterText) return true;
    var hay = norm([ex.nombre, ex.en, ex.cat, ex.patron, ex.musculos.join(' ')].join(' '));
    return norm(filterText).split(/\s+/).every(function (t) { return hay.indexOf(t) >= 0; });
  }
  function thumbKey(ex) { return ex.anim + (ex.double ? ':2' : '') + ':' + (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'l' : 'd')); }
  function renderGrid() {
    var grid = $('#exGrid'), list = EX.filter(matches);
    var doneSet = {};
    Store.logs.forEach(function (l) { doneSet[l.ex] = (doneSet[l.ex] || 0) + 1; });
    $('#exCount').textContent = list.length + ' de ' + EX.length;
    grid.innerHTML = '';
    if (!list.length) { grid.appendChild(el('div', 'empty', 'Nada coincide con “' + esc(filterText) + '”.')); return; }
    list.forEach(function (ex) {
      var b = el('button', 'ex-card');
      b.type = 'button';
      b.dataset.id = ex.id;
      var t = thumbCache[thumbKey(ex)];
      b.innerHTML =
        '<div class="ex-thumb">' + (t ? '<img alt="" src="' + t + '">' : PH) + '</div>' +
        '<span class="ex-num">' + pad(ex.n) + '</span>' +
        (doneSet[ex.id] ? '<span class="ex-done">' + doneSet[ex.id] + '×</span>' : '') +
        '<div class="ex-info"><span class="ex-name">' + esc(ex.nombre) + '</span>' +
        '<span class="ex-sub"><span>' + esc(ex.cat) + '</span><span class="lvl" aria-label="Nivel ' + ex.nivel + ' de 3">' +
        [1, 2, 3].map(function (i) { return '<i class="' + (i <= ex.nivel ? 'on' : '') + '"></i>'; }).join('') + '</span></span></div>';
      b.addEventListener('click', function () { openSheet(ex.id); });
      grid.appendChild(b);
    });
    if (current === 'ejercicios') startThumbs();
  }
  $('#exSearch').addEventListener('input', function (e) { filterText = e.target.value.trim(); renderGrid(); });

  function startThumbs() {
    if (!has3D() || !KB3D.thumbnail) return;
    thumbQueue = EX.filter(function (ex) { return !thumbCache[thumbKey(ex)]; });
    if (thumbsRunning) return;
    thumbsRunning = true;
    (function next() {
      var ex = thumbQueue.shift();
      if (!ex) { thumbsRunning = false; return; }
      var key = thumbKey(ex);
      if (thumbCache[key]) return next();
      var c = sceneColors(ex.pesoInicial || 16);
      KB3D.thumbnail(ex.anim, { size: 240, colors: c, double: !!ex.double }).then(function (url) {
        if (url) {
          thumbCache[key] = url;
          var card = document.querySelector('.ex-card[data-id="' + ex.id + '"] .ex-thumb');
          if (card) card.innerHTML = '<img alt="" src="' + url + '">';
          // Los ejercicios que comparten animación reutilizan la miniatura
          EX.forEach(function (o) {
            if (o !== ex && thumbKey(o) === key) {
              var c2 = document.querySelector('.ex-card[data-id="' + o.id + '"] .ex-thumb');
              if (c2) c2.innerHTML = '<img alt="" src="' + url + '">';
            }
          });
        }
        setTimeout(next, 16);
      }, function () { setTimeout(next, 16); });
    })();
  }

  /* ---------- DETALLE + REGISTRO ---------- */
  var sheetEx = null, detailViewer = null, sel = { kg: 16, double: false }, speedIdx = 1;
  var SPEEDS = [0.5, 1, 1.5];
  function lastWeight(ex) {
    var l = Store.sorted().find(function (x) { return x.ex === ex.id; });
    return l ? l.peso : null;
  }
  function renderWeights() {
    var box = $('#weights');
    box.innerHTML = '';
    WEIGHTS.forEach(function (kg) {
      var b = el('button', 'wchip', '<i style="--c:' + bellColor(kg) + '"></i>' + kg);
      b.type = 'button'; b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(kg === sel.kg));
      b.setAttribute('aria-label', kg + ' kilos');
      b.addEventListener('click', function () { setWeight(kg, true); });
      box.appendChild(b);
    });
  }
  function setWeight(kg, scroll) {
    sel.kg = kg;
    $('#weightNow').textContent = kg;
    document.querySelectorAll('.wchip').forEach(function (b) { b.setAttribute('aria-checked', String(+b.textContent === kg)); });
    $('#sheet').style.setProperty('--bell', bellColor(kg));
    if (detailViewer) detailViewer.setColors(sceneColors(kg));
    if (scroll) {
      var on = document.querySelector('.wchip[aria-checked="true"]');
      if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }
  function openSheet(id, preset) {
    var ex = byId[id];
    if (!ex) return;
    sheetEx = ex;
    preset = preset || {};
    var u = unitOf(ex);
    $('#dCat').textContent = pad(ex.n) + ' · ' + ex.cat + ' · ' + ex.patron;
    $('#dTitle').textContent = ex.nombre;
    $('#dEn').textContent = ex.en;
    $('#dTags').innerHTML = '<span class="tag lv">Nivel ' + ['', 'principiante', 'intermedio', 'avanzado'][ex.nivel] + '</span>' +
      ex.musculos.map(function (m) { return '<span class="tag">' + esc(m) + '</span>'; }).join('') +
      (ex.unilateral ? '<span class="tag">Por lado</span>' : '');
    $('#dDesc').textContent = ex.desc;
    $('#dCues').innerHTML = ex.cues.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
    $('#dErrs').innerHTML = ex.errores.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('');
    $('#dSuggest').textContent = 'Sugerido: ' + ex.series + ' × ' + ex.reps + ' · ' + ex.descanso + ' s descanso';
    $('#repsLabel').textContent = u === 'm' ? 'Metros' : u === 's' ? 'Segundos' : ex.unilateral ? 'Reps por lado' : 'Reps';
    $('#inSeries').value = preset.series || firstNum(ex.series, 3);
    $('#inReps').value = preset.reps || firstNum(ex.reps, 10);
    $('#inNotes').value = '';
    sel.double = preset.double != null ? !!preset.double : !!ex.double;
    var canDouble = ONE_HAND.indexOf(ex.anim) >= 0;
    $('#ctlDouble').hidden = !canDouble;
    $('#ctlDouble').setAttribute('aria-pressed', String(sel.double));
    var kg = preset.peso || lastWeight(ex) || ex.pesoInicial || 16;
    if (WEIGHTS.indexOf(kg) < 0) WEIGHTS.push(kg), WEIGHTS.sort(function (a, b) { return a - b; });
    sel.kg = kg;
    renderWeights();
    resetTracker();
    var sh = $('#sheet');
    sh.hidden = false;
    sh.scrollTop = 0;
    document.body.style.overflow = 'hidden';
    setWeight(kg, true);
    if (heroViewer) heroViewer.pause();
    if (has3D()) {
      if (!detailViewer) detailViewer = KB3D.create($('#detailStage'), { colors: sceneColors(kg), interactive: true });
      detailViewer.resetView && detailViewer.resetView();
      detailViewer.play(ex.anim, { double: sel.double, speed: SPEEDS[speedIdx] });
      detailViewer.resume();
      syncPlayBtn();
    }
    try { if (!history.state || !history.state.sheet) history.pushState({ sheet: 1 }, ''); } catch (e) { /* sin historial */ }
  }
  function closeSheet(fromPop) {
    var sh = $('#sheet');
    if (sh.hidden) return;
    sh.hidden = true;
    document.body.style.overflow = '';
    if (detailViewer) detailViewer.pause();
    if (heroViewer && current === 'hoy') heroViewer.resume();
    stopRest(); releaseWake();
    if (!fromPop) { try { if (history.state && history.state.sheet) history.back(); } catch (e) { /* nada */ } }
  }
  window.addEventListener('popstate', function () { closeSheet(true); });
  $('#sheetClose').addEventListener('click', function () { closeSheet(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSheet(false); });

  function syncPlayBtn() {
    var p = detailViewer && detailViewer.isPaused();
    $('#ctlPlay').textContent = p ? 'Play' : 'Pausa';
    $('#ctlPlay').setAttribute('aria-label', p ? 'Reproducir' : 'Pausar');
  }
  $('#ctlPlay').addEventListener('click', function () {
    if (!detailViewer) return;
    if (detailViewer.isPaused()) detailViewer.resume(); else detailViewer.pause();
    syncPlayBtn();
  });
  $('#ctlSpeed').addEventListener('click', function () {
    speedIdx = (speedIdx + 1) % SPEEDS.length;
    $('#ctlSpeed').textContent = SPEEDS[speedIdx].toString().replace('.', ',') + '×';
    if (detailViewer) detailViewer.setSpeed(SPEEDS[speedIdx]);
  });
  $('#ctlDouble').addEventListener('click', function () {
    sel.double = !sel.double;
    $('#ctlDouble').setAttribute('aria-pressed', String(sel.double));
    if (detailViewer && sheetEx) detailViewer.play(sheetEx.anim, { double: sel.double, speed: SPEEDS[speedIdx] });
  });

  document.querySelectorAll('.step').forEach(function (b) {
    b.addEventListener('click', function () {
      var inp = b.dataset.step === 'series' ? $('#inSeries') : $('#inReps');
      var unit = sheetEx ? unitOf(sheetEx) : 'reps';
      var d = +b.dataset.d * (b.dataset.step === 'reps' && unit === 'm' ? 5 : b.dataset.step === 'reps' && unit === 's' ? 5 : 1);
      inp.value = Math.max(1, Math.min(+inp.max || 999, (parseInt(inp.value, 10) || 0) + d));
      if (b.dataset.step === 'series' && tracking) renderTracker();
    });
  });

  /* Contador de series con descanso */
  var tracking = false, doneSets = 0, restTimer = null, restLeft = 0, audioCtx = null, wakeLock = null;
  function resetTracker() { tracking = false; doneSets = 0; stopRest(); $('#tracker').hidden = true; $('#btnTrack').textContent = 'Contar series'; }
  function renderTracker() {
    var n = parseInt($('#inSeries').value, 10) || 1, box = $('#trackerSets');
    box.innerHTML = '';
    for (var i = 1; i <= n; i++) {
      box.appendChild(el('span', 'set-dot ' + (i <= doneSets ? 'done' : i === doneSets + 1 ? 'next' : ''), String(i)));
    }
    $('#btnTrack').textContent = doneSets >= n ? 'Series completas' : 'Serie ' + (doneSets + 1) + ' hecha';
    $('#btnTrack').disabled = doneSets >= n;
  }
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.18, 0.36].forEach(function (t, i) {
        var o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = i === 2 ? 1320 : 880; o.connect(g); g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0.0001, audioCtx.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + t + 0.15);
        o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.16);
      });
    } catch (e) { /* sin audio */ }
    try { navigator.vibrate && navigator.vibrate([120, 80, 120]); } catch (e) { /* sin vibración */ }
  }
  function fmtClock(s) { return Math.floor(s / 60) + ':' + pad(s % 60); }
  function startRest(sec) {
    stopRest();
    restLeft = sec;
    $('#restBox').hidden = false;
    $('#restTime').textContent = fmtClock(restLeft);
    restTimer = setInterval(function () {
      restLeft--;
      $('#restTime').textContent = fmtClock(Math.max(0, restLeft));
      if (restLeft <= 0) { stopRest(); beep(); toast('A la siguiente serie'); }
    }, 1000);
  }
  function stopRest() { clearInterval(restTimer); restTimer = null; var r = $('#restBox'); if (r) r.hidden = true; }
  function grabWake() { try { navigator.wakeLock && navigator.wakeLock.request('screen').then(function (w) { wakeLock = w; }, function () {}); } catch (e) { /* no disponible */ } }
  function releaseWake() { try { wakeLock && wakeLock.release(); } catch (e) { /* nada */ } wakeLock = null; }
  $('#restSkip').addEventListener('click', stopRest);
  $('#btnTrack').addEventListener('click', function () {
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* nada */ }
    if (!tracking) { tracking = true; doneSets = 0; $('#tracker').hidden = false; renderTracker(); grabWake(); return; }
    var n = parseInt($('#inSeries').value, 10) || 1;
    doneSets = Math.min(n, doneSets + 1);
    renderTracker();
    if (doneSets < n) startRest(sheetEx.descanso || 60);
    else { stopRest(); toast('Series completas. Toca Guardar.'); releaseWake(); }
  });

  $('#btnSave').addEventListener('click', function () {
    if (!sheetEx) return;
    var series = parseInt($('#inSeries').value, 10) || 0, reps = parseInt($('#inReps').value, 10) || 0;
    if (tracking && doneSets > 0 && doneSets < series) series = doneSets;
    if (series < 1 || reps < 1) { toast('Ingresa series y repeticiones mayores a cero'); return; }
    var e = newEntry(sheetEx, series, reps, sel.kg, sel.double, $('#inNotes').value.trim(), 'app');
    Store.add(e);
    toast('Guardado: ' + sheetEx.nombre + ' · ' + doseText(e));
    resetTracker(); releaseWake();
  });
  $('#askAbout').addEventListener('click', function () {
    var ex = sheetEx;
    closeSheet(false);
    go('coach');
    send('Explícame la técnica del ' + ex.nombre + ' (' + ex.id + ') y dime qué peso y dosis me recomiendas según mi historial.');
  });

  /* ---------- HISTORIAL ---------- */
  function renderChart() {
    var weeks = [];
    for (var i = 7; i >= 0; i--) weeks.push(weekSummary(i));
    var max = Math.max.apply(null, weeks.map(function (w) { return w.vol; }).concat([1]));
    var nice = Math.pow(10, Math.floor(Math.log10(max)));
    var top = Math.ceil(max / nice) * nice;
    var W = 340, H = 170, L = 40, R = 6, T = 18, B = 24, bw = (W - L - R) / weeks.length;
    var y = function (v) { return T + (H - T - B) * (1 - v / top); };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Volumen semanal de las últimas 8 semanas">';
    [0, top / 2, top].forEach(function (v) {
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(v) + '" y2="' + y(v) + '" stroke="var(--line)" stroke-width="1"' + (v ? ' stroke-dasharray="2 3"' : '') + '/>';
      s += '<text x="' + (L - 6) + '" y="' + (y(v) + 3.5) + '" text-anchor="end">' + (v >= 1000 ? (v / 1000).toLocaleString('es-CL', { maximumFractionDigits: 1 }) + 't' : fmtInt.format(v)) + '</text>';
    });
    weeks.forEach(function (w, i) {
      var x = L + i * bw + bw * 0.18, wd = bw * 0.64, cur = i === weeks.length - 1;
      var h = Math.max(w.vol ? 2 : 0, (H - T - B) * (w.vol / top));
      s += '<rect x="' + x.toFixed(1) + '" y="' + (H - B - h).toFixed(1) + '" width="' + wd.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3" fill="' + (cur ? 'var(--accent)' : 'var(--fig-2)') + '"/>';
      var d = new Date(w.start);
      s += '<text x="' + (x + wd / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle">' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '</text>';
      if (cur && w.vol) s += '<text x="' + (x + wd / 2).toFixed(1) + '" y="' + (H - B - h - 5).toFixed(1) + '" text-anchor="middle" style="fill:var(--fg);font-weight:600">' + fmtKg(w.vol) + '</text>';
    });
    s += '</svg>';
    $('#weekChart').innerHTML = s;
  }
  function renderHistory() {
    renderChart();
    var box = $('#historyList'), logs = Store.sorted();
    box.innerHTML = '';
    if (!logs.length) { box.appendChild(el('div', 'empty', 'Tu historial aparecerá aquí, agrupado por día, con el volumen de cada sesión.')); return; }
    var groups = {};
    logs.forEach(function (l) { (groups[l.fecha] = groups[l.fecha] || []).push(l); });
    Object.keys(groups).sort().reverse().forEach(function (k) {
      var g = groups[k], vol = g.reduce(function (a, l) { return a + volumeOf(l); }, 0);
      var sec = el('div', 'day-group');
      sec.innerHTML = '<div class="day-head"><span>' + esc(dayLabel(k)) + '</span><span>' + g.length + ' ejercicio' + (g.length > 1 ? 's' : '') + (vol ? ' · ' + fmtKg(vol) : '') + '</span></div>';
      var ul = el('ul', 'log-list');
      g.forEach(function (l) { ul.appendChild(logItem(l, true)); });
      sec.appendChild(ul);
      box.appendChild(sec);
    });
  }
  $('#historyList').addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]');
    if (!b) return;
    e.stopPropagation();
    if (!b.classList.contains('confirm')) {
      b.classList.add('confirm'); b.textContent = '¿Seguro?';
      setTimeout(function () { if (b.isConnected) { b.classList.remove('confirm'); b.textContent = 'Borrar'; } }, 3000);
      return;
    }
    Store.remove(b.dataset.del);
    toast('Registro borrado');
  });

  function csv() {
    var head = ['fecha', 'hora', 'ejercicio', 'categoria', 'series', 'reps', 'unidad', 'peso_kg', 'doble', 'volumen_kg', 'notas', 'origen'];
    var rows = Store.sorted().reverse().map(function (l) {
      var ex = byId[l.ex];
      return [l.fecha, new Date(l.ts).toTimeString().slice(0, 5), l.nombre, l.cat || (ex && ex.cat) || '', l.series, l.reps, unitOf(ex),
        l.peso, l.double ? 'si' : 'no', volumeOf(l), (l.notas || '').replace(/[;\n\r]/g, ' '), l.origen || 'app'];
    });
    return '﻿' + [head].concat(rows).map(function (r) { return r.join(';'); }).join('\r\n');
  }
  $('#btnCsv').addEventListener('click', function () {
    if (!Store.logs.length) { toast('Todavía no hay registros para exportar'); return; }
    var name = 'girya-historial-' + dayKey(Date.now()) + '.csv', data = csv();
    var claudeUse = window.claude && window.claude.use;
    if (claudeUse) {
      window.claude.use('downloads').then(function (dl) {
        if (!dl) return toast('La descarga no está disponible aquí');
        dl.save({ filename: name, data: data }).catch(function (e) { if (e && e.code !== 'declined') toast('No se pudo descargar el CSV'); });
      });
      return;
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([data], { type: 'text/csv;charset=utf-8' }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  });

  /* ---------- COACH CLAUDE ---------- */
  var Coach = { sample: null, tools: false, busy: false, ctl: null };
  var chatLog = LS.get('girya.chat', []);
  function saveChat() { LS.set('girya.chat', chatLog.slice(-40)); }

  var QUICK = [
    'Arma una rutina de 20 minutos para hoy',
    '¿Cómo voy esta semana?',
    'Registra 5 series de 10 swings rusos con 24 kg',
    'Quiero aprender el Turkish get-up paso a paso',
    'Plan de 4 semanas para mejorar mi swing'
  ];
  function renderQuick() {
    var box = $('#quickPrompts');
    box.innerHTML = '';
    QUICK.forEach(function (q) {
      var b = el('button', '', esc(q)); b.type = 'button';
      b.addEventListener('click', function () { send(q); });
      box.appendChild(b);
    });
  }

  function md(text) {
    var lines = esc(text).split('\n'), out = '', list = null;
    function close() { if (list) { out += '</' + list + '>'; list = null; } }
    lines.forEach(function (ln) {
      var t = ln.trim(), m;
      if (!t) { close(); return; }
      t = t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#{1,4}\s*/, '');
      if ((m = t.match(/^[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; } out += '<li>' + m[1] + '</li>'; }
      else if ((m = t.match(/^\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; } out += '<li>' + m[1] + '</li>'; }
      else { close(); out += '<p>' + t + '</p>'; }
    });
    close();
    return out;
  }
  function routineNode(r) {
    var box = el('div', 'routine');
    box.innerHTML = '<p class="eyebrow">Rutina propuesta</p><h4>' + esc(r.titulo) + '</h4>' + (r.nota ? '<p class="chart-sub">' + esc(r.nota) + '</p>' : '');
    var ol = el('ol');
    r.items.forEach(function (it, i) {
      var ex = byId[it.id];
      if (!ex) return;
      var li = el('li'), b = el('button');
      b.type = 'button';
      b.innerHTML = '<span class="ri-n">' + (i + 1) + '</span><span class="ri-name">' + esc(ex.nombre) + '</span><span class="ri-dose">' + it.series + '×' + esc(it.reps) + (it.peso ? ' · ' + it.peso + ' kg' : '') + '</span>';
      b.addEventListener('click', function () { openSheet(ex.id, { series: it.series, reps: firstNum(it.reps, null), peso: it.peso }); });
      li.appendChild(b); ol.appendChild(li);
    });
    box.appendChild(ol);
    return box;
  }
  function itemNode(it) {
    if (it.t === 'user') return el('div', 'msg msg-user', esc(it.text));
    if (it.t === 'ai') return el('div', 'msg msg-ai', md(it.text));
    if (it.t === 'note') return el('div', 'msg-note ' + (it.ok ? 'ok' : ''), esc(it.text));
    if (it.t === 'routine') return routineNode(it);
    return el('div');
  }
  function renderChat() {
    var chat = $('#chat');
    chat.innerHTML = '';
    if (!chatLog.length) {
      chat.appendChild(el('div', 'msg msg-ai', md(Coach.sample
        ? 'Hola, soy tu coach. Conozco los **50 ejercicios** de Girya y tu historial.\n\n- Pídeme una rutina y te la armo con tarjetas que abren cada ejercicio en 3D.\n- Dime lo que hiciste y lo registro por ti.\n- Pregúntame por técnica, progresiones o cuánto peso usar.'
        : 'Hola. Desde aquí puedes llevar tu contexto de entrenamiento a Claude. Escribe tu pregunta y se abrirá Claude con tu historial y el catálogo de ejercicios ya cargados.')));
    }
    chatLog.forEach(function (it) { chat.appendChild(itemNode(it)); });
  }
  function scrollChat() { requestAnimationFrame(function () { window.scrollTo(0, document.body.scrollHeight); }); }

  function catalogText() {
    return EX.map(function (e) { return e.id + ' | ' + e.nombre + ' | ' + e.cat + ' | nivel ' + e.nivel + ' | ' + e.series + 'x' + e.reps + (e.unilateral ? ' por lado' : '') + ' | ' + e.musculos.join(', '); }).join('\n');
  }
  function historyText(n) {
    var logs = Store.sorted().slice(0, n);
    if (!logs.length) return '(sin registros todavía)';
    return logs.map(function (l) { return l.fecha + ' | ' + l.ex + ' | ' + doseText(l) + (l.notas ? ' | nota: ' + l.notas : ''); }).join('\n');
  }
  function weekText() {
    var w = weekSummary(0), p = weekSummary(1);
    return 'Semana actual: ' + w.days + ' días, ' + w.sets + ' series, volumen ' + fmtInt.format(w.vol) + ' kg. Semana anterior: ' + p.days + ' días, ' + p.sets + ' series, ' + fmtInt.format(p.vol) + ' kg. Racha: ' + streak() + ' días.';
  }
  function instructions() {
    return [
      'Eres "Coach Claude", el entrenador dentro de Girya, una app de registro de entrenamiento con kettlebell que el usuario usa en su celular.',
      'Responde en español de Chile, cercano, directo y breve (máximo ~120 palabras salvo que pidan detalle). Usa kg. Prioriza la seguridad: ante dolor, sugiere parar y consultar a un profesional. Basa tus recomendaciones en su historial real cuando exista.',
      'Formato: texto plano; listas con "- " y **negrita** cuando ayuden. Sin tablas ni emojis.',
      'Hoy es ' + new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '.',
      Coach.tools
        ? 'Herramientas: usa registrar_entrenamiento cuando el usuario diga que hizo algo y quiera guardarlo (si falta el peso o las reps, pregunta antes de guardar). Usa mostrar_rutina cada vez que propongas una rutina, solo con ids del catálogo; después escribe 1–2 frases sin repetir la lista.'
        : 'Cuando propongas una rutina, escríbela como lista con nombre del ejercicio, series × reps y peso sugerido.',
      '', 'CATÁLOGO (id | nombre | categoría | nivel | dosis sugerida | músculos):', catalogText(),
      '', 'RESUMEN: ' + weekText(),
      '', 'HISTORIAL RECIENTE (fecha | id | series × reps · peso):', historyText(40)
    ].join('\n');
  }

  function toolDefs() {
    return [
      {
        name: 'registrar_entrenamiento',
        description: 'Guarda uno o más registros de entrenamiento en el historial del usuario. Devuelve lo guardado o el error si un id no existe.',
        inputSchema: {
          type: 'object',
          properties: {
            registros: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  ejercicio_id: { type: 'string', description: 'id exacto del catálogo' },
                  series: { type: 'integer' }, reps: { type: 'integer', description: 'reps (o metros/segundos en cargas)' },
                  peso_kg: { type: 'number' }, doble: { type: 'boolean', description: 'true si usó dos kettlebells' },
                  notas: { type: 'string' }
                },
                required: ['ejercicio_id', 'series', 'reps', 'peso_kg']
              }
            }
          },
          required: ['registros']
        },
        execute: function (input) {
          var regs = Array.isArray(input && input.registros) ? input.registros : [];
          if (!regs.length) throw new Error('No vienen registros');
          var saved = [], bad = [];
          regs.slice(0, 20).forEach(function (r) {
            var ex = byId[String(r.ejercicio_id)];
            var s = Math.round(Number(r.series)), rp = Math.round(Number(r.reps)), kg = Number(r.peso_kg);
            if (!ex || !(s > 0) || !(rp > 0) || !(kg > 0)) { bad.push(String(r.ejercicio_id)); return; }
            var e = newEntry(ex, s, rp, kg, !!r.doble, r.notas ? String(r.notas).slice(0, 140) : '', 'claude');
            Store.add(e);
            saved.push(ex.nombre + ' ' + doseText(e));
            pushItem({ t: 'note', ok: true, text: 'Guardado: ' + ex.nombre + ' · ' + doseText(e) });
          });
          if (!saved.length) throw new Error('Ningún registro válido. Ids no reconocidos: ' + bad.join(', '));
          return { guardados: saved, rechazados: bad };
        }
      },
      {
        name: 'mostrar_rutina',
        description: 'Muestra al usuario una rutina como tarjeta interactiva; cada ejercicio abre su animación 3D y su registro. Devuelve "ok".',
        inputSchema: {
          type: 'object',
          properties: {
            titulo: { type: 'string' }, nota: { type: 'string', description: 'formato, p. ej. "3 rondas, 60 s de descanso"' },
            ejercicios: {
              type: 'array',
              items: {
                type: 'object',
                properties: { ejercicio_id: { type: 'string' }, series: { type: 'integer' }, reps: { type: 'string' }, peso_kg: { type: 'number' } },
                required: ['ejercicio_id', 'series', 'reps']
              }
            }
          },
          required: ['titulo', 'ejercicios']
        },
        execute: function (input) {
          var items = (Array.isArray(input && input.ejercicios) ? input.ejercicios : []).map(function (x) {
            return { id: String(x.ejercicio_id), series: Math.max(1, Math.round(Number(x.series) || 1)), reps: String(x.reps || ''), peso: Number(x.peso_kg) || null };
          }).filter(function (x) { return byId[x.id]; }).slice(0, 15);
          if (!items.length) throw new Error('Ningún ejercicio_id válido del catálogo');
          pushItem({ t: 'routine', titulo: String(input.titulo || 'Rutina').slice(0, 60), nota: input.nota ? String(input.nota).slice(0, 160) : '', items: items });
          return 'ok';
        }
      }
    ];
  }

  var liveBubble = null;
  function pushItem(it) {
    chatLog.push(it); saveChat();
    var node = itemNode(it), chat = $('#chat');
    if (liveBubble && liveBubble.parentNode === chat) chat.insertBefore(node, liveBubble); else chat.appendChild(node);
    scrollChat();
  }
  var ERR = {
    not_granted: 'Para usar el coach, permite que esta app use Claude (se pide una sola vez).',
    sampling_disabled: 'Claude no está disponible para esta cuenta.',
    rate_limited: 'Llegaste al límite por ahora. Intenta de nuevo en un rato.',
    session_expired: 'Tu sesión expiró. Vuelve a iniciar sesión en Claude.',
    refused: 'Claude no pudo responder eso. Prueba reformulando.',
    empty_completion: 'No llegó respuesta. Intenta con una pregunta más corta.',
    prompt_too_large: 'Tu historial es muy largo para enviarlo completo. Intenta de nuevo.'
  };

  function send(text) {
    text = String(text || '').trim();
    if (!text || Coach.busy) return;
    if (current !== 'coach') go('coach');
    if (!Coach.sample) { openClaudeWith(text); return; }
    var chat = $('#chat');
    if (!chatLog.length) chat.innerHTML = '';
    pushItem({ t: 'user', text: text });
    var turns = [{ role: 'user', content: instructions() }];
    chatLog.filter(function (i) { return i.t === 'user' || i.t === 'ai'; }).slice(-12).forEach(function (i) {
      turns.push({ role: i.t === 'user' ? 'user' : 'assistant', content: i.text });
    });
    liveBubble = el('div', 'msg msg-ai thinking', 'Pensando');
    chat.appendChild(liveBubble);
    scrollChat();
    setBusy(true);
    Coach.ctl = new AbortController();
    var opts = { cache: false, signal: Coach.ctl.signal, onText: function (u) { liveBubble.classList.remove('thinking'); liveBubble.innerHTML = md(u.text); } };
    if (Coach.tools) { delete opts.cache; opts.tools = toolDefs(); }
    var bubble = liveBubble;
    Coach.sample(turns, opts).then(function (res) {
      bubble.remove(); liveBubble = null;
      pushItem({ t: 'ai', text: res.text + (res.truncated ? '\n\n(Respuesta cortada: pide menos a la vez.)' : '') });
    }, function (e) {
      bubble.remove(); liveBubble = null;
      var code = e && e.code;
      if (e && e.text && code !== 'refused') pushItem({ t: 'ai', text: e.text });
      if (code === 'cancelled') return;
      pushItem({ t: 'note', text: ERR[code] || 'Se cortó la conexión con Claude. Intenta de nuevo.' });
      if (code === 'not_granted' || code === 'sampling_disabled') setClaudeState('off');
    }).then(function () { setBusy(false); });
  }
  function setBusy(b) {
    Coach.busy = b;
    var btn = $('#composerSend');
    btn.setAttribute('aria-label', b ? 'Detener' : 'Enviar');
    btn.innerHTML = b
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12l16-8-6 16-2.5-6.5z" fill="currentColor"/></svg>';
  }
  $('#composer').addEventListener('submit', function (e) {
    e.preventDefault();
    if (Coach.busy) { Coach.ctl && Coach.ctl.abort(); return; }
    var ta = $('#composerInput'), v = ta.value;
    ta.value = ''; ta.style.height = '';
    send(v);
  });
  $('#composerInput').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(140, this.scrollHeight) + 'px'; });
  $('#composerInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); $('#composer').requestSubmit(); }
  });

  /* Modo sin Claude embebido: enviar contexto a la app de Claude */
  function contextSummary(question) {
    var recent = Store.sorted().slice(0, 15).map(function (l) { return '- ' + l.fecha + ': ' + l.nombre + ' ' + doseText(l); }).join('\n');
    return 'Soy usuario de Girya, mi app de entrenamiento con kettlebell. Actúa como mi coach (responde en español de Chile, breve).\n\n' +
      weekText() + '\n\nMis últimos registros:\n' + (recent || '- (aún sin registros)') +
      '\n\nEjercicios disponibles: ' + EX.map(function (e) { return e.nombre; }).join(', ') + '.' +
      (question ? '\n\nMi pregunta: ' + question : '');
  }
  function claudeUrl(q) { return 'https://claude.ai/new?q=' + encodeURIComponent(contextSummary(q).slice(0, 3500)); }
  function openClaudeWith(q) {
    var url = claudeUrl(q), w = null;
    try { w = window.open(url, '_blank', 'noopener'); } catch (e) { /* bloqueado */ }
    if (!w) { $('#openInClaude').href = url; toast('Toca “Abrir en Claude” para continuar'); }
  }
  $('#copyForClaude').addEventListener('click', function () {
    var txt = contextSummary('');
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast('Resumen copiado. Pégalo en Claude.'); }, function () { toast('No se pudo copiar'); });
  });

  function setClaudeState(state, label) {
    var s = $('#claudeStatus');
    s.dataset.state = state;
    s.querySelector('.label').textContent = label || (state === 'on' ? 'Claude conectado' : state === 'off' ? 'Claude vía app' : 'Conectando con Claude…');
    var offline = state === 'off';
    $('#offlineClaude').hidden = !offline;
    $('#coachSub').textContent = offline ? 'Se abre en tu app de Claude con tu contexto.' : 'Conoce tus 50 ejercicios y tu historial.';
    $('#openInClaude').href = claudeUrl('');
    if (current === 'coach') renderChat();
  }

  function connectClaude() {
    var c = window.claude;
    if (!c || typeof c.use !== 'function') { setClaudeState('off'); return; }
    c.use('sample').then(function (sample) {
      if (!sample) { setClaudeState('off'); return; }
      Coach.sample = sample;
      return (sample.limits ? sample.limits() : Promise.resolve({})).catch(function () { return {}; }).then(function (lim) {
        Coach.tools = !!(lim && lim.tools);
        setClaudeState('on');
      });
    }, function () { setClaudeState('off'); });
    c.use('db').then(function (db) {
      if (db) { Store.connect(db); }
    }, function () { /* sin nube */ });
  }

  /* ---------- Tema ---------- */
  function onTheme() {
    var kg = sheetEx ? sel.kg : 16;
    if (detailViewer) detailViewer.setColors(sceneColors(kg));
    if (heroViewer && heroEx) heroViewer.setColors(sceneColors(lastWeight(heroEx) || heroEx.pesoInicial || 16));
    if (current === 'ejercicios') renderGrid();
  }
  try { matchMedia('(prefers-color-scheme: light)').addEventListener('change', onTheme); } catch (e) { /* navegador antiguo */ }
  try { new MutationObserver(onTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { /* nada */ }

  /* ---------- Arranque ---------- */
  Store.subs.push(function () {
    renderHome();
    if (current === 'historial') renderHistory();
    if (current === 'ejercicios') renderGrid();
  });
  renderChips();
  renderGrid();
  renderQuick();
  renderHome();
  if (EX.length) setHero(exOfDay());
  var start = (location.hash || '').replace('#', '');
  go(['hoy', 'ejercicios', 'historial', 'coach'].indexOf(start) >= 0 ? start : 'hoy');
  connectClaude();

  // Precalcula miniaturas en segundo plano
  setTimeout(function () { if (has3D()) startThumbs(); }, 1500);

  // PWA: solo fuera de Claude (el visor de artifacts no admite service workers)
  if (!window.claude && 'serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () { /* sin offline */ });
  }
})();
