/* Step Quest — "My missions": create, edit, check off and complete your own real-life missions, as a list or on a
   month calendar. Missions can repeat (daily, weekdays, chosen weekdays, monthly). */
(() => {
  const C = WB.Custom, G = WB.Game, UI = WB.UI, S = () => WB.state, $ = (q, r = document) => r.querySelector(q);
  const esc = WB.esc;
  const pad = (n) => String(n).padStart(2, '0');
  const toLocal = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fromLocal = (v) => { if (!v) return 0; const [dd, tt] = v.split('T'), [y, mo, da] = dd.split('-').map(Number), [h, mi] = (tt || '0:0').split(':').map(Number); return +new Date(y, mo - 1, da, h, mi); };
  const when = (ms) => new Date(ms).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const hm = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const rel = (ms) => { const d = ms - Date.now(), m = Math.round(Math.abs(d) / 60000), t = m >= 2880 ? Math.round(m / 1440) + ' days' : UI.dur(m); return d >= 0 ? 'in ' + t : t + ' overdue'; };

  // each mission card folds down to just its title row; the choice is remembered on this device
  const COLL_KEY = 'sq.cm.collapsed';
  const collapsed = () => { try { return new Set(JSON.parse(localStorage.getItem(COLL_KEY) || '[]')); } catch (e) { return new Set(); } };
  const saveColl = (set) => { try { localStorage.setItem(COLL_KEY, JSON.stringify([...set])); } catch (e) { /* storage blocked: still works for this session */ } };
  let coll = collapsed();
  function card(m) {
    const L = m.lock || m, late = Math.min(m.due, L.due) < Date.now(), r = C.payout(m), why = C.noPayWhy(m), armed = UI.cdelArm === m.id;
    const done = m.steps.filter((x) => x.done).length, tpl = C.tpl(m.tpl);
    const shut = coll.has(m.id), x = m.sid && C.series(m.sid);
    return `<div class="cm pbox pri-${m.pri} ${late ? 'late' : ''} ${shut ? 'collapsed' : ''}" data-cm="${m.id}">
      <div class="cm-top"><span class="m-ic">${WB.icon(tpl.icon, 3)}</span><div class="cm-head">
        <div class="m-kick"><span class="pri">${C.PRI[L.pri].name} priority</span> · ${C.DIFF[L.diff].name}</div>
        <div class="t-title">${esc(m.title)}</div>
        <div class="cm-due ${late ? 'late' : ''}">${WB.icon('calendar', 1)}Due ${esc(when(m.due))} · ${rel(m.due)}</div>
        ${L.due !== m.due ? `<div class="cm-due ${L.due < Date.now() ? 'late' : ''}">Reward deadline ${esc(when(L.due))} (as created)</div>` : ''}
        ${x ? `<div class="cm-due cm-repl">${WB.icon('repeat', 1)}${esc(C.repLabel(x.rep))}</div>` : ''}
        ${m.steps.length ? `<div class="cm-mini">${done} / ${m.steps.length} sub-missions</div>` : ''}
      </div><button type="button" class="cm-fold" data-cfold="${m.id}" aria-expanded="${!shut}" aria-controls="cmb-${m.id}" aria-label="${shut ? 'Expand' : 'Collapse'} ${esc(m.title)}"><svg viewBox="0 0 12 8" width="14" height="10" aria-hidden="true"><path fill="currentColor" d="M1 1h2v2h2v2h2V3h2V1h2v2h-2v2h-2v2H5V5H3V3H1z"/></svg></button></div>
      <div class="cm-body" id="cmb-${m.id}" ${shut ? 'hidden' : ''}>
      ${m.notes ? `<p class="cm-notes">${esc(m.notes)}</p>` : ''}
      ${m.steps.length ? `<div class="cm-steps">${m.steps.map((x, i) => `<button type="button" class="cm-step ${x.done ? 'done' : ''}" role="checkbox" aria-checked="${x.done}" data-cstep="${m.id}:${i}"><span class="box">${x.done ? WB.icon('check', 2) : ''}</span><span>${esc(x.t)}</span>${x.paid ? `<span class="cm-coin" aria-label="1 coin earned">${WB.icon('coin', 1)}+1</span>` : '<span class="cm-coin todo">+1</span>'}</button>`).join('')}</div>
        <div class="obj-prog"><div class="bar seg ${done === m.steps.length ? 'gold' : 'cyan'}"><i style="width:${(done / m.steps.length) * 100}%"></i></div><span class="num">${done} / ${m.steps.length} sub-missions</span></div>` : ''}
      <div class="cm-foot"><span class="t-rew">${why ? 'Daily reward cap reached' : '+' + r.coins + ' coins · +' + r.xp + ' XP · ' + r.timing + (r.capped ? ' · capped' : '')}</span>
        <div class="cm-acts">${armed && x
          ? `<button class="btn danger sm" type="button" data-cdel="${m.id}" data-sure="1">Delete this one</button><button class="btn danger sm" type="button" data-cdel="${m.id}" data-sure="1" data-all="1">Stop repeating</button><button class="linkbtn" type="button" data-ckeep="1">Keep</button>`
          : armed
          ? `<button class="btn danger sm" type="button" data-cdel="${m.id}" data-sure="1">Delete</button><button class="linkbtn" type="button" data-ckeep="1">Keep</button>`
          : `<button class="linkbtn" type="button" data-cedit="${m.id}">Edit</button><button class="linkbtn" type="button" data-cdel="${m.id}">Delete</button><button class="btn gold sm" type="button" data-cdone="${m.id}" ${UI.off(C.tooNewWhy(m))}>Complete</button>`}</div></div>
      ${why && !armed ? `<p class="fine cm-why">${esc(why)}</p>` : ''}
      </div>
    </div>`;
  }
  // ---------- list or calendar (remembered on this device) ----------
  const VIEW_KEY = 'sq.cm.view';
  let view = (() => { try { return localStorage.getItem(VIEW_KEY) === 'cal' ? 'cal' : 'list'; } catch (e) { return 'list'; } })();
  const histRow = (h) => `<div class="cm-h ${h.missed ? 'missed' : ''}"><span>${WB.icon(h.missed ? 'lock' : 'check', 2)}${esc(h.title)}</span><span class="t-rew">${h.missed ? 'Missed · no reward' : (h.coins ? '+' + h.coins + ' coins · +' + h.xp + ' XP' : 'No reward') + (h.late ? ' · late' : '')}</span></div>`;
  UI.customSection = () => {
    const c = S().custom, list = C.list(), reps = (c.series || []).filter((x) => !x.ended).length;
    const hist = c.history.slice(0, 5);
    return `<div class="sect" id="my-missions"><h2>My missions <span class="aside">${list.length} open${reps ? ' · ' + reps + ' repeating' : ''} · ${c.done || 0} completed</span></h2>
      <p class="fine">Turn real-life goals into missions. Finish early to earn more; late pays half. Up to ${C.DAILY_COINS} coins a day (${C.leftToday().coins} left today).</p>
      <button class="btn gold block" type="button" data-cnew="1">${WB.icon('pencil', 2)}New mission</button>
      ${UI.quickSection ? UI.quickSection() : ''}
      <div class="cm-seg cm-view" role="radiogroup" aria-label="Show my missions as"><button type="button" role="radio" aria-checked="${view === 'list'}" data-cview="list">${WB.icon('tasks', 1)} List</button><button type="button" role="radio" aria-checked="${view === 'cal'}" data-cview="cal">${WB.icon('calendar', 1)} Calendar</button></div>
      ${view === 'cal' ? calendar() : `
      ${list.length ? `<div class="list">${list.map(card).join('')}</div>` : '<p class="empty cm-empty">No open missions. Tap <b>New mission</b> to add one.</p>'}
      ${hist.length ? `<h3 class="m-sub">Recently completed <span class="aside">${C.earnedToday().coins} / ${C.DAILY_COINS} coins today</span></h3><div class="cm-hist">${hist.map(histRow).join('')}</div>` : ''}`}
    </div>`;
  };

  // ---------- calendar: a month at a glance, then the chosen day's missions ----------
  const weekStart = /^en-(US|CA)|^(ja|ko|zh|he|pt-BR)/i.test(navigator.language || '') ? 0 : 1;
  let calMonth = null, calSel = null;   // calMonth: 'YYYY-MM-01' key; calSel: 'YYYY-MM-DD'
  // everything that lands on each day of [from, to): open missions by due day, upcoming repeats, completed or missed
  const dayMap = (from, to) => {
    const c = S().custom, map = {}, put = (k, o) => (map[k] = map[k] || []).push(o);
    for (const m of c.list) if (m.due >= from && m.due < to) put(WB.dayKey(new Date(m.due)), { k: 'open', m, due: m.due, late: m.due < Date.now() });
    for (const u of C.upcoming(Math.max(from, Date.now()), to - 1)) put(WB.dayKey(new Date(u.due)), { k: 'next', u, due: u.due });
    for (const h of c.history) { const t = h.missed ? h.due || h.at : h.at; if (t >= from && t < to) put(WB.dayKey(new Date(t)), { k: h.missed ? 'missed' : 'done', h, due: t }); }
    for (const k of Object.keys(map)) map[k].sort((a, b) => a.due - b.due);
    return map;
  };
  const dayLabel = (k) => WB.parseDay(k).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const countText = (items) => {
    const n = (k) => items.filter((i) => i.k === k).length, parts = [];
    const late = items.filter((i) => i.k === 'open' && i.late).length, open = n('open') - late;
    if (open) parts.push(open + ' due'); if (late) parts.push(late + ' overdue'); if (n('next')) parts.push(n('next') + ' repeating');
    if (n('done')) parts.push(n('done') + ' completed'); if (n('missed')) parts.push(n('missed') + ' missed');
    return parts.join(', ') || 'nothing planned';
  };
  function calendar() {
    const today = WB.dayKey();
    if (!calSel) calSel = today;
    if (!calMonth) calMonth = calSel.slice(0, 8) + '01';
    const first = WB.parseDay(calMonth), y = first.getFullYear(), mo = first.getMonth(), days = new Date(y, mo + 1, 0).getDate();
    const lead = (first.getDay() - weekStart + 7) % 7, from = +first, to = +new Date(y, mo + 1, 1);
    const map = dayMap(from, to), title = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const wd = [...Array(7)].map((_, i) => (i + weekStart) % 7);
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<span class="mcal-pad" aria-hidden="true"></span>');
    for (let d = 1; d <= days; d++) {
      const k = WB.dayKey(new Date(y, mo, d)), items = map[k] || [];
      const dot = (cls, n) => (n ? `<i class="mcal-dot ${cls}"></i>` : '');
      const n = (kk, f) => items.filter((i) => i.k === kk && (!f || f(i))).length;
      const dots = dot('late', n('open', (i) => i.late)) + dot('open', n('open', (i) => !i.late)) + dot('next', n('next')) + dot('done', n('done')) + dot('missed', n('missed'));
      cells.push(`<button type="button" class="mcal-d ${k === today ? 'today' : ''} ${k < today ? 'past' : ''}" data-calday="${k}" aria-pressed="${k === calSel}" tabindex="${k === calSel ? 0 : -1}" aria-label="${esc((k === today ? 'Today, ' : '') + dayLabel(k) + ': ' + countText(items))}"><span class="mcal-n">${d}</span><span class="mcal-dots" aria-hidden="true">${dots}${items.length > 4 ? `<b>${items.length}</b>` : ''}</span></button>`);
    }
    const sel = calSel.slice(0, 8) + '01' === calMonth ? calSel : null, selItems = sel ? map[sel] || [] : [];
    const row = (it) => {
      if (it.k === 'open') return card(it.m);
      if (it.k === 'next') return `<div class="mcal-row next pbox"><span class="ar-ic">${WB.icon('repeat', 2)}</span><div><div class="t-title">${esc(it.u.title)}</div><div class="cm-due">Due ${esc(hm(it.u.due))} · ${esc(C.repLabel(it.u.rep, true))}</div><div class="fine">Appears in your list once the one before it is due.</div></div></div>`;
      if (it.k === 'missed') return `<div class="mcal-row missed pbox"><span class="ar-ic">${WB.icon('lock', 2)}</span><div><div class="t-title">${esc(it.h.title)}</div><div class="cm-due">Missed · was due ${esc(hm(it.due))}</div></div></div>`;
      return `<div class="mcal-row done pbox"><span class="ar-ic">${WB.icon('check', 2)}</span><div><div class="t-title">${esc(it.h.title)}</div><div class="cm-due">Completed ${esc(hm(it.h.at))} · ${it.h.coins ? '+' + it.h.coins + ' coins · +' + it.h.xp + ' XP' : 'no reward'}${it.h.late ? ' · late' : ''}</div></div></div>`;
    };
    const head = wd.map((i) => `<span class="mcal-wd" aria-hidden="true">${C.DAYS[i].slice(0, 1)}</span>`).join('');
    return `<div class="mcal pbox" id="cm-cal">
      <div class="mcal-h"><button type="button" class="mcal-nav" data-calnav="-1" aria-label="Previous month">‹</button><h3 id="cal-title" aria-live="polite">${esc(title)}</h3><button type="button" class="mcal-nav" data-calnav="1" aria-label="Next month">›</button>${calMonth !== today.slice(0, 8) + '01' || calSel !== today ? '<button type="button" class="linkbtn mcal-today" data-caltoday="1">Today</button>' : ''}</div>
      <div class="mcal-g" role="group" aria-labelledby="cal-title">${head}${cells.join('')}</div>
      <div class="mcal-key" aria-hidden="true"><span><i class="mcal-dot open"></i>Due</span><span><i class="mcal-dot late"></i>Overdue</span><span><i class="mcal-dot next"></i>Repeating</span><span><i class="mcal-dot done"></i>Completed</span><span><i class="mcal-dot missed"></i>Missed</span></div>
    </div>
    ${sel ? `<h3 class="m-sub mcal-sel-h" id="cal-sel-h">${esc((sel === today ? 'Today · ' : '') + dayLabel(sel))} <span class="aside">${esc(countText(selItems))}</span></h3>
    <div class="list mcal-list" aria-labelledby="cal-sel-h">${selItems.map(row).join('') || '<p class="empty">Nothing on this day.</p>'}
      ${sel >= today ? `<button type="button" class="btn ghost block" data-cnewday="${sel}">${WB.icon('pencil', 2)}New mission on this day</button>` : ''}</div>` : '<p class="fine">Pick a day to see its missions.</p>'}`;
  }
  // after a re-render, put focus back where it was (the calendar is rebuilt on every change)
  const refocus = (sel) => requestAnimationFrame(() => { const el = $(sel); if (el) el.focus({ preventScroll: true }); });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-cview], [data-calnav], [data-caltoday], [data-calday], [data-cnewday]'); if (!t) return;
    const d = t.dataset; WB.Sfx.play('tap');
    if (d.cview) { view = d.cview; try { localStorage.setItem(VIEW_KEY, view); } catch (er) {} UI.render(); return refocus(`[data-cview="${view}"]`); }
    if (d.cnewday) return pickTemplate(d.cnewday);
    if (d.caltoday) { calSel = WB.dayKey(); calMonth = calSel.slice(0, 8) + '01'; UI.render(); return refocus(`[data-calday="${calSel}"]`); }
    if (d.calnav) {
      const m = WB.parseDay(calMonth); m.setMonth(m.getMonth() + +d.calnav); calMonth = WB.dayKey(m).slice(0, 8) + '01';
      const today = WB.dayKey(); calSel = calMonth === today.slice(0, 8) + '01' ? today : calMonth;   // land on today, or the 1st
      UI.render(); return refocus(`[data-calnav="${d.calnav}"]`);
    }
    if (d.calday) { calSel = d.calday; UI.render(); return refocus(`[data-calday="${calSel}"]`); }
  });
  // arrow keys move between days (a roving tab stop), Home / End to the week's ends, Page Up / Down by month
  document.addEventListener('keydown', (e) => {
    const t = e.target.closest && e.target.closest('[data-calday]'); if (!t) return;
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    let k = null;
    if (step) k = WB.addDays(t.dataset.calday, step);
    else if (e.key === 'Home' || e.key === 'End') { const wd = (WB.parseDay(t.dataset.calday).getDay() - weekStart + 7) % 7; k = WB.addDays(t.dataset.calday, e.key === 'Home' ? -wd : 6 - wd); }
    else if (e.key === 'PageUp' || e.key === 'PageDown') { const m = WB.parseDay(t.dataset.calday); m.setMonth(m.getMonth() + (e.key === 'PageUp' ? -1 : 1)); k = WB.dayKey(m); }
    if (!k) return;
    e.preventDefault(); calSel = k; calMonth = k.slice(0, 8) + '01'; UI.render(); refocus(`[data-calday="${k}"]`);
  });

  // ---------- create / edit ----------
  let pickDay = null;   // a day picked on the calendar: the new mission is due that day
  function pickTemplate(day) {
    pickDay = typeof day === 'string' ? day : null;
    UI.sheet(`<h3 id="sheet-title">New mission</h3><p>Pick a template or start from scratch. You can edit everything next.${pickDay ? ' Due ' + esc(dayLabel(pickDay)) + '.' : ''}</p>
      <div class="tpl-grid">${C.TEMPLATES.map((t) => `<button type="button" class="tpl pbox" data-ctpl="${t.id}">${WB.icon(t.icon, 3)}<b>${esc(t.name)}</b><span>${t.steps.length ? t.steps.length + ' sub-missions · ' : ''}${C.DIFF[t.diff].name}</span></button>`).join('')}</div>`);
  }
  const seg = (name, obj, cur, locked) => `<div class="cm-seg" role="radiogroup" aria-label="${name}">${Object.entries(obj).map(([k, v]) => `<button type="button" role="radio" aria-checked="${k === cur}" data-${name}="${k}" ${locked ? UI.off('Difficulty and priority are locked once a mission is created. To change them, delete it and make a new one.') : ''}>${v.name}</button>`).join('')}</div>`;
  // ---------- sub-mission rows: type in each, delete, or drag the handle (or use arrow keys on it) to reorder ----------
  const SUB_MAX = 20;
  const GRIP = '<svg viewBox="0 0 8 12" width="10" height="15" aria-hidden="true"><path fill="currentColor" d="M0 0h3v3H0zM5 0h3v3H5zM0 4.5h3v3H0zM5 4.5h3v3H5zM0 9h3v3H0zM5 9h3v3H5z"/></svg>';
  const subRow = (x) => `<li class="cm-sub ${x.done ? 'done' : ''}" data-i="${x.i}">
      <button type="button" class="cm-grip" aria-label="Move sub-mission. Drag, or press the up and down arrow keys">${GRIP}</button>
      <input type="text" maxlength="80" value="${esc(x.t)}" placeholder="Sub-mission" aria-label="Sub-mission" enterkeyhint="next">
      ${x.done ? `<span class="cm-sub-ok" title="Checked off">${WB.icon('check', 1)}</span>` : ''}
      <button type="button" class="cm-sub-del" aria-label="Delete sub-mission">×</button></li>`;
  function subEditor(list, addBtn) {
    const rows = () => [...list.children];
    const sync = () => {
      const n = rows().length; addBtn.hidden = n >= SUB_MAX;
      rows().forEach((r, k) => { r.querySelector('input').setAttribute('aria-label', 'Sub-mission ' + (k + 1) + ' of ' + n); });
    };
    const add = (after) => {
      if (rows().length >= SUB_MAX) return null;
      const tmp = document.createElement('ol'); tmp.innerHTML = subRow({ t: '', i: -1 });
      const r = tmp.firstElementChild; UI.hydrateIcons(r);
      if (after) after.after(r); else list.append(r);
      sync(); r.querySelector('input').focus(); return r;
    };
    const del = (r) => {
      const prev = r.previousElementSibling, next = r.nextElementSibling; r.remove(); sync();
      const to = prev || next; if (to) to.querySelector('input').focus(); else addBtn.focus();
    };
    addBtn.onclick = () => add(list.lastElementChild);
    list.addEventListener('click', (e) => { const d = e.target.closest('.cm-sub-del'); if (d) del(d.closest('.cm-sub')); });
    list.addEventListener('keydown', (e) => {
      const r = e.target.closest('.cm-sub'); if (!r) return;
      if (e.target.tagName === 'INPUT') {
        if (e.key === 'Enter') { e.preventDefault(); if (e.target.value.trim()) add(r); }   // Enter adds the next row (never submits)
        else if (e.key === 'Backspace' && !e.target.value && rows().length > 1) { e.preventDefault(); del(r); }
        return;
      }
      if (e.target.classList.contains('cm-grip') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        if (e.key === 'ArrowUp' && r.previousElementSibling) r.previousElementSibling.before(r);
        if (e.key === 'ArrowDown' && r.nextElementSibling) r.nextElementSibling.after(r);
        sync(); e.target.focus();
      }
    });
    // drag to reorder: the row follows your finger; it swaps with a neighbour once you pass that neighbour's middle
    list.addEventListener('pointerdown', (e) => {
      const g = e.target.closest('.cm-grip'); if (!g || e.button > 0) return;
      e.preventDefault();
      const r = g.closest('.cm-sub'); let y0 = e.clientY;
      g.setPointerCapture(e.pointerId); r.classList.add('dragging'); list.classList.add('sorting');
      const move = (ev) => {
        const dy = ev.clientY - y0; r.style.transform = `translateY(${dy}px)`;
        const prev = r.previousElementSibling, next = r.nextElementSibling;
        if (next && dy > next.offsetHeight / 2) { const h = next.offsetHeight + 8; next.after(r); y0 += h; r.style.transform = `translateY(${ev.clientY - y0}px)`; }
        else if (prev && dy < -prev.offsetHeight / 2) { const h = prev.offsetHeight + 8; prev.before(r); y0 -= h; r.style.transform = `translateY(${ev.clientY - y0}px)`; }
      };
      const end = () => {
        r.style.transform = ''; r.classList.remove('dragging'); list.classList.remove('sorting');
        g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', end); g.removeEventListener('pointercancel', end);
        sync();
      };
      g.addEventListener('pointermove', move); g.addEventListener('pointerup', end); g.addEventListener('pointercancel', end);
    });
    sync();
  }
  function form(opts) {
    const m = opts.m, tpl = C.tpl(opts.tpl || (m && m.tpl));
    const ser = m && m.sid && C.series(m.sid);
    const v = m ? { title: m.title, notes: m.notes, steps: m.steps.map((x, i) => ({ t: x.t, i, done: x.done })), due: m.due, diff: m.diff, pri: m.pri, rep: ser ? ser.rep : null }
      : { title: tpl.id === 'blank' ? '' : tpl.name, notes: tpl.notes, steps: tpl.steps.map((t) => ({ t, i: -1 })), due: dueOn(opts.day, C.defaultDue(tpl)), diff: tpl.diff, pri: tpl.pri, rep: null };
    const untilKey = v.rep && v.rep.until ? WB.dayKey(new Date(v.rep.until)) : '';
    const dayOrder = [...Array(7)].map((_, i) => (i + weekStart) % 7);
    const quick = [['Tonight', () => { const d = new Date(); d.setHours(21, 0, 0, 0); if (d < Date.now() + 30 * 60000) d.setDate(d.getDate() + 1); return +d; }],
      ['Tomorrow', () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return +d; }],
      ['In 3 days', () => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(18, 0, 0, 0); return +d; }],
      ['Next week', () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(18, 0, 0, 0); return +d; }]];
    UI.sheet(`<h3 id="sheet-title">${m ? 'Edit mission' : esc(tpl.name)}</h3>
      <form class="cm-form" id="cm-form" novalidate>
        <label class="fl"><span>Mission name</span><input type="text" name="title" maxlength="60" required value="${esc(v.title)}" placeholder="e.g. Finish chapter 3"></label>
        <label class="fl"><span>Notes <span class="opt">· optional</span></span><textarea name="notes" rows="2" maxlength="400" placeholder="Anything to remember">${esc(v.notes)}</textarea></label>
        <div class="fl" role="group" aria-labelledby="cm-subs-lbl"><span id="cm-subs-lbl">Sub-missions <span class="opt">· +1 coin each · drag ⠿ to reorder</span></span>
          <ol class="cm-subs" id="cm-subs">${v.steps.map(subRow).join('')}</ol>
          <button type="button" class="cm-sub-add" data-subadd="1">+ Add sub-mission</button></div>
        <div class="fl"><span>Due date and time</span><input type="datetime-local" name="due" required value="${toLocal(v.due)}">
          <div class="quick">${quick.map(([l], i) => `<button type="button" class="chipbtn" aria-pressed="false" data-cquick="${i}">${l}</button>`).join('')}</div></div>
        <div class="fl cm-repf"><span id="cm-rep-lbl">Repeat</span>
          <div class="cm-seg cm-rep" role="radiogroup" aria-labelledby="cm-rep-lbl">${[['', 'Never'], ...Object.entries(C.REP).map(([k, r]) => [k, r.name])].map(([k, l]) => `<button type="button" role="radio" aria-checked="${(v.rep ? v.rep.f : '') === k}" data-crep="${k}">${l}</button>`).join('')}</div>
          <div class="cm-days" id="cm-days" role="group" aria-label="Repeat on" ${v.rep && v.rep.f === 'week' ? '' : 'hidden'}>${dayOrder.map((i) => `<button type="button" aria-pressed="false" data-cday="${i}" aria-label="${C.DAYS_LONG[i]}">${C.DAYS[i].slice(0, 2)}</button>`).join('')}</div>
          <label class="cm-until" id="cm-until" ${v.rep ? '' : 'hidden'}><span>Ends <span class="opt">· optional, leave empty to keep repeating</span></span><input type="date" name="until" value="${untilKey}"></label>
          <p class="fine cm-rep-note" id="cm-rep-note" aria-live="polite"></p></div>
        <div class="fl"><span>Difficulty${m ? ' <span class="opt">· set at creation</span>' : ''}</span>${seg('cdiff', C.DIFF, v.diff, !!m)}</div>
        <div class="fl"><span>Priority${m ? ' <span class="opt">· set at creation</span>' : ''}</span>${seg('cpri', C.PRI, v.pri, !!m)}</div>
        ${m ? `<p class="fine">Changing the due date keeps the original reward deadline (${esc(when((m.lock || m).due))}).</p>` : ''}
        <div class="cm-prev pbox" id="cm-prev"></div>
        <p class="cm-err" id="cm-err" role="alert"></p>
        <button class="btn gold block" type="submit">${m ? 'Save changes' : 'Create mission'}</button>
      </form>`, (b) => {
      const f = $('#cm-form', b), st = { diff: v.diff, pri: v.pri, rep: v.rep ? v.rep.f : '', days: v.rep && v.rep.days ? v.rep.days.slice() : null };
      const pickQuick = (on) => f.querySelectorAll('[data-cquick]').forEach((x) => x.setAttribute('aria-pressed', x === on));
      // repeat: weekly starts on the due date's weekday until the player picks days themselves
      const dueWd = () => { const ms = fromLocal(f.due.value); return ms ? new Date(ms).getDay() : new Date().getDay(); };
      const repNote = () => {
        const days = $('#cm-days', b), until = $('#cm-until', b);
        days.hidden = st.rep !== 'week'; until.hidden = !st.rep;
        if (st.rep === 'week' && !st.days) st.days = [dueWd()];
        days.querySelectorAll('[data-cday]').forEach((x) => x.setAttribute('aria-pressed', String(!!st.days && st.days.includes(+x.dataset.cday))));
        const ms = fromLocal(f.due.value);
        $('#cm-rep-note', b).textContent = !st.rep ? '' : C.repLabel({ f: st.rep, days: st.days || [], mday: ms ? new Date(ms).getDate() : 1 }, true) + (ms ? ' at ' + hm(ms) : '') + '. The next one appears in your list once this one’s due time passes.';
      };
      f.due.addEventListener('input', () => { pickQuick(null); repNote(); });
      f.until.addEventListener('input', repNote);
      subEditor($('#cm-subs', b), $('[data-subadd]', b));
      const prev = () => { const r = C.preview(st.diff, st.pri), mx = C.reward({ diff: st.diff, pri: st.pri, due: 2, at: 1 }, 1); $('#cm-prev', b).innerHTML = `<span class="lbl">Reward if finished on time</span><b>+${r.coins} coins · +${r.xp} XP</b><span class="fine">Finish early for up to +${mx.coins} coins · +${mx.xp} XP. Finishing late pays half. Your own missions pay up to ${C.DAILY_COINS} coins and ${C.DAILY_XP} XP a day in total.</span>`; };
      f.addEventListener('click', (e) => {
        const t = e.target.closest('[data-cdiff], [data-cpri], [data-cquick], [data-crep], [data-cday]'); if (!t || t.getAttribute('aria-disabled') === 'true') return;
        if (t.dataset.cquick) { f.due.value = toLocal(quick[+t.dataset.cquick][1]()); pickQuick(t); repNote(); return; }
        if (t.dataset.crep !== undefined) { st.rep = t.dataset.crep; t.parentNode.querySelectorAll('[role="radio"]').forEach((x) => x.setAttribute('aria-checked', String(x === t))); repNote(); return; }
        if (t.dataset.cday) { const i = +t.dataset.cday, d = new Set(st.days || []); d.has(i) ? d.delete(i) : d.add(i); st.days = [...d]; repNote(); return; }
        const k = t.dataset.cdiff ? 'diff' : 'pri'; st[k] = t.dataset.cdiff || t.dataset.cpri;
        t.parentNode.querySelectorAll('[role="radio"]').forEach((x) => x.setAttribute('aria-checked', x === t));
        prev();
      });
      f.onsubmit = (e) => {
        e.preventDefault();
        const steps = [...b.querySelectorAll('#cm-subs .cm-sub')].map((r) => ({ t: r.querySelector('input').value, i: +r.dataset.i }));
        const data = { title: f.title.value, notes: f.notes.value, steps, due: fromLocal(f.due.value), diff: st.diff, pri: st.pri,
          rep: st.rep ? { f: st.rep, days: st.days || [], until: f.until.value } : null };
        const r = m ? C.update(m.id, data) : C.create(data, tpl.id);
        if (!r.ok) { $('#cm-err', b).textContent = r.msg; WB.Sfx.play('tap'); return; }
        UI.closeSheet(); WB.Sfx.play('claim');
        const sx = r.m.sid && C.series(r.m.sid);
        UI.toast({ kicker: m ? 'Mission updated' : 'Mission created', title: r.m.title, sub: sx ? C.repLabel(sx.rep) : undefined, icon: sx ? 'repeat' : 'flag', cls: 'ok' });
        UI.missionTab = 'mine'; UI.go('tasks'); UI.render();
        setTimeout(() => { const el = $('#my-missions'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60);
      };
      prev(); repNote();
    });
  }
  // a calendar day: due at 6 pm that day (or the template's own default when that is sooner and still on the day)
  function dueOn(day, fallback) {
    if (!day) return fallback;
    const d = WB.parseDay(day), fb = new Date(fallback);
    if (WB.dayKey(fb) === day) return fallback;
    d.setHours(18, 0, 0, 0);
    return +d < Date.now() + (C.MIN_AGE_MIN + 5) * 60000 ? fallback : +d;
  }
  UI.customForm = form;
  UI.customNew = pickTemplate;

  document.addEventListener('click', (e) => {   // fold / unfold a mission in place (no re-render, so nothing jumps)
    const b = e.target.closest('[data-cfold]'); if (!b) return;
    const id = b.dataset.cfold, card = b.closest('.cm'), body = card.querySelector('.cm-body'), shut = !body.hidden;
    body.hidden = shut; card.classList.toggle('collapsed', shut);
    b.setAttribute('aria-expanded', String(!shut)); b.setAttribute('aria-label', (shut ? 'Expand ' : 'Collapse ') + (card.querySelector('.t-title') || {}).textContent);
    if (shut) coll.add(id); else coll.delete(id);
    saveColl(coll); WB.Sfx.play('tap');
  });
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-cnew], [data-ctpl], [data-cedit], [data-cdel], [data-ckeep], [data-cdone], [data-cstep]');
    if (!t || t.getAttribute('aria-disabled') === 'true') return;
    const d = t.dataset;
    if (d.cnew) return pickTemplate();
    if (d.ctpl) { const day = pickDay; pickDay = null; return form({ tpl: d.ctpl, day }); }
    if (d.cedit) { const m = C.get(d.cedit); return m && form({ m }); }
    if (d.cstep) { const [id, i] = d.cstep.split(':'); const r = C.toggleStep(id, +i); WB.Sfx.play(r && r.coin ? 'coin' : 'tap'); if (r && r.coin) UI.updateHud(); return UI.render(); }
    if (d.ckeep) { UI.cdelArm = null; return UI.render(); }
    if (d.cdel && !d.sure) { UI.cdelArm = d.cdel; return UI.render(); }
    if (d.cdel) {
      const m = C.get(d.cdel), x = m && m.sid && C.series(m.sid);
      UI.cdelArm = null; C.remove(d.cdel, !!d.all);
      UI.toast(d.all ? { kicker: 'Stopped repeating', title: m ? m.title : '', icon: 'check' }
        : x && !x.ended ? { kicker: 'Mission deleted', title: 'The next one appears ' + when(Math.max(Date.now(), x.last)) + '.', icon: 'repeat' }
        : { kicker: 'Mission deleted', title: '', icon: 'check' });
      return UI.render();
    }
    if (d.cdone) {
      const res = C.complete(d.cdone); if (!res) return;
      const cheer = WB.Celebrate.fire('custom', { title: res.m.title, late: Date.now() > (res.m.lock || res.m).due }, 80);
      UI.toast(res.why ? { kicker: 'Mission complete', title: res.m.title, sub: cheer + ' (' + res.why + ')', icon: 'check', cls: 'ok', ms: 5200 }
        : { kicker: 'Mission complete · ' + res.r.timing, title: '+' + res.r.coins + ' coins · +' + res.r.xp + ' XP', sub: cheer, icon: 'coin', cls: 'gold', ms: 4600 });
      UI.updateHud(); UI.render();
      UI.missionAmbushRoll('custom', res.m.title);   // finishing a mission can stir up a battle
    }
  });
  WB.bus.on('customOverdue', (m) => UI.toast({ kicker: 'Mission overdue', title: m.title + ' · finish it for half the reward', icon: 'calendar', cls: 'msg', ms: 4000 }));
  // a repeating mission's next occurrence just appeared
  WB.bus.on('customRepeat', (m) => { if (UI.tab === 'tasks') UI.render(); });
})();
