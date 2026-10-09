/* Stepquest — "My missions": create, edit, check off and complete your own real-life missions. */
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
      ${m.steps.length ? `<div class="cm-steps">${m.steps.map((x, i) => `<button type="button" class="cm-step ${x.done ? 'done' : ''}" role="checkbox" aria-checked="${x.done}" data-cstep="${m.id}:${i}"><span class="box">${x.done ? WB.icon('check', 2) : ''}</span><span>${esc(x.t)}</span></button>`).join('')}</div>
        <div class="obj-prog"><div class="bar seg ${done === m.steps.length ? 'gold' : 'cyan'}"><i style="width:${(done / m.steps.length) * 100}%"></i></div><span class="num">${done} / ${m.steps.length} steps</span></div>` : ''}
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
      <p class="fine">Turn real-life goals into missions: a workout, a book outline, a study session or anything you like. Set a due date and time, a difficulty and a priority. Harder, higher-priority missions finished early pay the most; late ones pay half. Together they pay up to ${C.DAILY_COINS} coins and ${C.DAILY_XP} XP a day (${C.leftToday().coins} coins left today), so walking stays the main way to earn.</p>
      <button class="btn gold block" type="button" data-cnew="1">${WB.icon('pencil', 2)}New mission</button>
      ${list.length ? `<div class="list">${list.map(card).join('')}</div>` : ''}
      ${hist.length ? `<h3 class="m-sub">Recently completed <span class="aside">${C.earnedToday().coins} / ${C.DAILY_COINS} coins today</span></h3><div class="cm-hist">${hist.map((h) => `<div class="cm-h"><span>${WB.icon('check', 2)}${esc(h.title)}</span><span class="t-rew">${h.coins ? '+' + h.coins + ' coins · +' + h.xp + ' XP' : 'No reward'}${h.late ? ' · late' : ''}</span></div>`).join('')}</div>` : ''}
    </div>`;
  };

  // ---------- create / edit ----------
  function pickTemplate() {
    UI.sheet(`<h3 id="sheet-title">New mission</h3><p>Start from a template or create your own. You can change everything on the next screen.</p>
      <div class="tpl-grid">${C.TEMPLATES.map((t) => `<button type="button" class="tpl pbox" data-ctpl="${t.id}">${WB.icon(t.icon, 3)}<b>${esc(t.name)}</b><span>${t.steps.length ? t.steps.length + ' steps · ' : ''}${C.DIFF[t.diff].name}</span></button>`).join('')}</div>`);
  }
  const seg = (name, obj, cur, locked) => `<div class="cm-seg" role="radiogroup" aria-label="${name}">${Object.entries(obj).map(([k, v]) => `<button type="button" role="radio" aria-checked="${k === cur}" data-${name}="${k}" ${locked ? UI.off('Difficulty and priority are set when a mission is created, so rewards stay fair. Delete it and create a new one to change them.') : ''}>${v.name}</button>`).join('')}</div>`;
  function form(opts) {
    const m = opts.m, tpl = C.tpl(opts.tpl || (m && m.tpl));
    const v = m ? { title: m.title, notes: m.notes, steps: m.steps.map((x) => x.t).join('\n'), due: m.due, diff: m.diff, pri: m.pri }
      : { title: tpl.id === 'blank' ? '' : tpl.name, notes: tpl.notes, steps: tpl.steps.join('\n'), due: C.defaultDue(tpl), diff: tpl.diff, pri: tpl.pri };
    const quick = [['Tonight', () => { const d = new Date(); d.setHours(21, 0, 0, 0); if (d < Date.now() + 30 * 60000) d.setDate(d.getDate() + 1); return +d; }],
      ['Tomorrow', () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(18, 0, 0, 0); return +d; }],
      ['In 3 days', () => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(18, 0, 0, 0); return +d; }],
      ['Next week', () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(18, 0, 0, 0); return +d; }]];
    UI.sheet(`<h3 id="sheet-title">${m ? 'Edit mission' : esc(tpl.name)}</h3>
      <form class="cm-form" id="cm-form" novalidate>
        <label class="fl"><span>Mission name</span><input type="text" name="title" maxlength="60" required value="${esc(v.title)}" placeholder="e.g. Finish chapter 3"></label>
        <label class="fl"><span>Notes <span class="opt">· optional</span></span><textarea name="notes" rows="2" maxlength="400" placeholder="Anything to remember">${esc(v.notes)}</textarea></label>
        <label class="fl"><span>Steps <span class="opt">· one per line, optional</span></span><textarea name="steps" rows="4" placeholder="Break it into small steps">${esc(v.steps)}</textarea></label>
        <div class="fl"><span>Due date and time</span><input type="datetime-local" name="due" required value="${toLocal(v.due)}">
          <div class="quick">${quick.map(([l], i) => `<button type="button" class="chipbtn" data-cquick="${i}">${l}</button>`).join('')}</div></div>
        <div class="fl"><span>Difficulty${m ? ' <span class="opt">· set at creation</span>' : ''}</span>${seg('cdiff', C.DIFF, v.diff, !!m)}</div>
        <div class="fl"><span>Priority${m ? ' <span class="opt">· set at creation</span>' : ''}</span>${seg('cpri', C.PRI, v.pri, !!m)}</div>
        ${m ? `<p class="fine">Changing the due date keeps the original reward deadline (${esc(when((m.lock || m).due))}).</p>` : ''}
        <div class="cm-prev pbox" id="cm-prev"></div>
        <p class="cm-err" id="cm-err" role="alert"></p>
        <button class="btn gold block" type="submit">${m ? 'Save changes' : 'Create mission'}</button>
      </form>`, (b) => {
      const f = $('#cm-form', b), st = { diff: v.diff, pri: v.pri };
      const prev = () => { const r = C.preview(st.diff, st.pri), mx = C.reward({ diff: st.diff, pri: st.pri, due: 2, at: 1 }, 1); $('#cm-prev', b).innerHTML = `<span class="lbl">Reward if finished on time</span><b>+${r.coins} coins · +${r.xp} XP</b><span class="fine">Finish early for up to +${mx.coins} coins · +${mx.xp} XP. Late: half. Your own missions pay up to ${C.DAILY_COINS} coins and ${C.DAILY_XP} XP a day in total.</span>`; };
      f.addEventListener('click', (e) => {
        const t = e.target.closest('[data-cdiff], [data-cpri], [data-cquick]'); if (!t || t.getAttribute('aria-disabled') === 'true') return;
        if (t.dataset.cquick) { f.due.value = toLocal(quick[+t.dataset.cquick][1]()); return; }
        const k = t.dataset.cdiff ? 'diff' : 'pri'; st[k] = t.dataset.cdiff || t.dataset.cpri;
        t.parentNode.querySelectorAll('[role="radio"]').forEach((x) => x.setAttribute('aria-checked', x === t));
        prev();
      });
      f.onsubmit = (e) => {
        e.preventDefault();
        const data = { title: f.title.value, notes: f.notes.value, steps: f.steps.value, due: fromLocal(f.due.value), diff: st.diff, pri: st.pri };
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
    if (d.cstep) { const [id, i] = d.cstep.split(':'); C.toggleStep(id, +i); WB.Sfx.play('tap'); return UI.render(); }
    if (d.ckeep) { UI.cdelArm = null; return UI.render(); }
    if (d.cdel && !d.sure) { UI.cdelArm = d.cdel; return UI.render(); }
    if (d.cdel) { UI.cdelArm = null; C.remove(d.cdel); UI.toast({ kicker: 'Mission deleted', title: '', icon: 'check' }); return UI.render(); }
    if (d.cdone) {
      const res = C.complete(d.cdone); if (!res) return;
      UI.toast(res.why ? { kicker: 'Mission complete', title: res.m.title + ' · no reward: ' + res.why, icon: 'check', cls: 'msg', ms: 4200 }
        : { kicker: 'Mission complete · ' + res.r.timing, title: '+' + res.r.coins + ' coins · +' + res.r.xp + ' XP', icon: 'coin', cls: 'gold' });
      UI.updateHud(); UI.render();
    }
  });
  WB.bus.on('customOverdue', (m) => UI.toast({ kicker: 'Mission overdue', title: m.title + ' · finish it for half the reward', icon: 'calendar', cls: 'msg', ms: 4000 }));
})();
