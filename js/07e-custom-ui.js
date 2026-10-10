/* Step Quest — "My missions": create, edit, check off and complete your own real-life missions. */
(() => {
  const C = WB.Custom, G = WB.Game, UI = WB.UI, S = () => WB.state, $ = (q, r = document) => r.querySelector(q);
  const esc = WB.esc;
  const pad = (n) => String(n).padStart(2, '0');
  const toLocal = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fromLocal = (v) => { if (!v) return 0; const [dd, tt] = v.split('T'), [y, mo, da] = dd.split('-').map(Number), [h, mi] = (tt || '0:0').split(':').map(Number); return +new Date(y, mo - 1, da, h, mi); };
  const when = (ms) => new Date(ms).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  const rel = (ms) => { const d = ms - Date.now(), m = Math.round(Math.abs(d) / 60000), t = m >= 2880 ? Math.round(m / 1440) + ' days' : UI.dur(m); return d >= 0 ? 'in ' + t : t + ' overdue'; };

  function card(m) {
    const L = m.lock || m, late = Math.min(m.due, L.due) < Date.now(), r = C.payout(m), why = C.noPayWhy(m), armed = UI.cdelArm === m.id;
    const done = m.steps.filter((x) => x.done).length, tpl = C.tpl(m.tpl);
    return `<div class="cm pbox pri-${m.pri} ${late ? 'late' : ''}">
      <div class="cm-top"><span class="m-ic">${WB.icon(tpl.icon, 3)}</span><div class="cm-head">
        <div class="m-kick"><span class="pri">${C.PRI[L.pri].name} priority</span> · ${C.DIFF[L.diff].name}</div>
        <div class="t-title">${esc(m.title)}</div>
        <div class="cm-due ${late ? 'late' : ''}">${WB.icon('calendar', 1)}Due ${esc(when(m.due))} · ${rel(m.due)}</div>
        ${L.due !== m.due ? `<div class="cm-due ${L.due < Date.now() ? 'late' : ''}">Reward deadline ${esc(when(L.due))} (as created)</div>` : ''}
      </div></div>
      ${m.notes ? `<p class="cm-notes">${esc(m.notes)}</p>` : ''}
      ${m.steps.length ? `<div class="cm-steps">${m.steps.map((x, i) => `<button type="button" class="cm-step ${x.done ? 'done' : ''}" role="checkbox" aria-checked="${x.done}" data-cstep="${m.id}:${i}"><span class="box">${x.done ? WB.icon('check', 2) : ''}</span><span>${esc(x.t)}</span>${x.paid ? `<span class="cm-coin" aria-label="1 coin earned">${WB.icon('coin', 1)}+1</span>` : '<span class="cm-coin todo">+1</span>'}</button>`).join('')}</div>
        <div class="obj-prog"><div class="bar seg ${done === m.steps.length ? 'gold' : 'cyan'}"><i style="width:${(done / m.steps.length) * 100}%"></i></div><span class="num">${done} / ${m.steps.length} sub-missions</span></div>` : ''}
      <div class="cm-foot"><span class="t-rew">${why ? 'Daily reward cap reached' : '+' + r.coins + ' coins · +' + r.xp + ' XP · ' + r.timing + (r.capped ? ' · capped' : '')}</span>
        <div class="cm-acts">${armed
          ? `<button class="btn danger sm" type="button" data-cdel="${m.id}" data-sure="1">Delete</button><button class="linkbtn" type="button" data-ckeep="1">Keep</button>`
          : `<button class="linkbtn" type="button" data-cedit="${m.id}">Edit</button><button class="linkbtn" type="button" data-cdel="${m.id}">Delete</button><button class="btn gold sm" type="button" data-cdone="${m.id}" ${UI.off(C.tooNewWhy(m))}>Complete</button>`}</div></div>
      ${why && !armed ? `<p class="fine cm-why">${esc(why)}</p>` : ''}
    </div>`;
  }
  UI.customSection = () => {
    const c = S().custom, list = C.list();
    const hist = c.history.slice(0, 5);
    return `<div class="sect" id="my-missions"><h2>My missions <span class="aside">${list.length} open · ${c.done || 0} completed</span></h2>
      <p class="fine">Turn real-life goals into missions. Finish early to earn more; late pays half. Up to ${C.DAILY_COINS} coins a day (${C.leftToday().coins} left today).</p>
      <button class="btn gold block" type="button" data-cnew="1">${WB.icon('pencil', 2)}New mission</button>
      ${UI.quickButton ? UI.quickButton() : ''}
      ${list.length ? `<div class="list">${list.map(card).join('')}</div>` : ''}
      ${hist.length ? `<h3 class="m-sub">Recently completed <span class="aside">${C.earnedToday().coins} / ${C.DAILY_COINS} coins today</span></h3><div class="cm-hist">${hist.map((h) => `<div class="cm-h"><span>${WB.icon('check', 2)}${esc(h.title)}</span><span class="t-rew">${h.coins ? '+' + h.coins + ' coins · +' + h.xp + ' XP' : 'No reward'}${h.late ? ' · late' : ''}</span></div>`).join('')}</div>` : ''}
    </div>`;
  };

  // ---------- create / edit ----------
  function pickTemplate() {
    UI.sheet(`<h3 id="sheet-title">New mission</h3><p>Pick a template or start from scratch. You can edit everything next.</p>
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
    const v = m ? { title: m.title, notes: m.notes, steps: m.steps.map((x, i) => ({ t: x.t, i, done: x.done })), due: m.due, diff: m.diff, pri: m.pri }
      : { title: tpl.id === 'blank' ? '' : tpl.name, notes: tpl.notes, steps: tpl.steps.map((t) => ({ t, i: -1 })), due: C.defaultDue(tpl), diff: tpl.diff, pri: tpl.pri };
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
        <div class="fl"><span>Difficulty${m ? ' <span class="opt">· set at creation</span>' : ''}</span>${seg('cdiff', C.DIFF, v.diff, !!m)}</div>
        <div class="fl"><span>Priority${m ? ' <span class="opt">· set at creation</span>' : ''}</span>${seg('cpri', C.PRI, v.pri, !!m)}</div>
        ${m ? `<p class="fine">Changing the due date keeps the original reward deadline (${esc(when((m.lock || m).due))}).</p>` : ''}
        <div class="cm-prev pbox" id="cm-prev"></div>
        <p class="cm-err" id="cm-err" role="alert"></p>
        <button class="btn gold block" type="submit">${m ? 'Save changes' : 'Create mission'}</button>
      </form>`, (b) => {
      const f = $('#cm-form', b), st = { diff: v.diff, pri: v.pri };
      const pickQuick = (on) => f.querySelectorAll('[data-cquick]').forEach((x) => x.setAttribute('aria-pressed', x === on));
      f.due.addEventListener('input', () => pickQuick(null));
      subEditor($('#cm-subs', b), $('[data-subadd]', b));
      const prev = () => { const r = C.preview(st.diff, st.pri), mx = C.reward({ diff: st.diff, pri: st.pri, due: 2, at: 1 }, 1); $('#cm-prev', b).innerHTML = `<span class="lbl">Reward if finished on time</span><b>+${r.coins} coins · +${r.xp} XP</b><span class="fine">Finish early for up to +${mx.coins} coins · +${mx.xp} XP. Finishing late pays half. Your own missions pay up to ${C.DAILY_COINS} coins and ${C.DAILY_XP} XP a day in total.</span>`; };
      f.addEventListener('click', (e) => {
        const t = e.target.closest('[data-cdiff], [data-cpri], [data-cquick]'); if (!t || t.getAttribute('aria-disabled') === 'true') return;
        if (t.dataset.cquick) { f.due.value = toLocal(quick[+t.dataset.cquick][1]()); pickQuick(t); return; }
        const k = t.dataset.cdiff ? 'diff' : 'pri'; st[k] = t.dataset.cdiff || t.dataset.cpri;
        t.parentNode.querySelectorAll('[role="radio"]').forEach((x) => x.setAttribute('aria-checked', x === t));
        prev();
      });
      f.onsubmit = (e) => {
        e.preventDefault();
        const steps = [...b.querySelectorAll('#cm-subs .cm-sub')].map((r) => ({ t: r.querySelector('input').value, i: +r.dataset.i }));
        const data = { title: f.title.value, notes: f.notes.value, steps, due: fromLocal(f.due.value), diff: st.diff, pri: st.pri };
        const r = m ? C.update(m.id, data) : C.create(data, tpl.id);
        if (!r.ok) { $('#cm-err', b).textContent = r.msg; WB.Sfx.play('tap'); return; }
        UI.closeSheet(); WB.Sfx.play('claim');
        UI.toast({ kicker: m ? 'Mission updated' : 'Mission created', title: r.m.title, icon: 'flag', cls: 'ok' });
        UI.missionTab = 'mine'; UI.go('tasks'); UI.render();
        setTimeout(() => { const el = $('#my-missions'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60);
      };
      prev();
    });
  }
  UI.customForm = form;
  UI.customNew = pickTemplate;

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-cnew], [data-ctpl], [data-cedit], [data-cdel], [data-ckeep], [data-cdone], [data-cstep]');
    if (!t || t.getAttribute('aria-disabled') === 'true') return;
    const d = t.dataset;
    if (d.cnew) return pickTemplate();
    if (d.ctpl) return form({ tpl: d.ctpl });
    if (d.cedit) { const m = C.get(d.cedit); return m && form({ m }); }
    if (d.cstep) { const [id, i] = d.cstep.split(':'); const r = C.toggleStep(id, +i); WB.Sfx.play(r && r.coin ? 'coin' : 'tap'); if (r && r.coin) UI.updateHud(); return UI.render(); }
    if (d.ckeep) { UI.cdelArm = null; return UI.render(); }
    if (d.cdel && !d.sure) { UI.cdelArm = d.cdel; return UI.render(); }
    if (d.cdel) { UI.cdelArm = null; C.remove(d.cdel); UI.toast({ kicker: 'Mission deleted', title: '', icon: 'check' }); return UI.render(); }
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
})();
