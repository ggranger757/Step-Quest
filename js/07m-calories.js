/* Step Quest — calorie counter. The player enters weight, height, age and sex once (Profile → Settings →
   Steps & goals → Calorie counter); every step then counts toward an estimate of the active calories walking burns.

   The estimate (no pace needed, so it works the same for the motion sensor, Health sync and logged steps):
     ACSM walking equation: oxygen cost above rest = 0.1 ml/kg per metre walked on level ground
       -> active METs while walking = 0.1 × speed (m/min) / 3.5
     "Corrected" METs use the player's own resting rate (Mifflin–St Jeor) instead of the 3.5 ml/kg/min average,
     which is where height, age and sex come in:
       resting kcal/day = 10 × kg + 6.25 × cm − 5 × age + (5 men, −161 women, −78 unspecified)
     kcal per minute = active METs × resting kcal per minute; divided by steps per minute, the pace cancels out:
       active kcal per step = stride (m) × 0.1 / 3.5 × resting kcal per minute
   For a 75 kg, 175 cm, 35-year-old man with a 0.76 m stride: about 0.025 kcal a step, ~250 kcal per 10,000 steps.
   Shown as "active calories" (on top of what the body burns at rest), like phone fitness apps. An estimate, not
   medical advice. s.body = { kg, cm, age, sex: 'f' | 'm' | 'x' } or null. */
(() => {
  const S = () => WB.state, UI = WB.UI, $ = (q, r = document) => r.querySelector(q), esc = WB.esc;
  const SEX = { f: -161, m: 5, x: -78 };
  const Cal = (WB.Cal = {});
  Cal.ready = () => { const b = S() && S().body; return !!(b && b.kg > 0); };
  Cal.rest = () => {   // resting kcal per day (Mifflin–St Jeor); height and age fall back to adult averages
    const b = S().body || {}, kg = +b.kg || 70, cm = +b.cm || 170, age = +b.age || 35;
    return Math.max(800, 10 * kg + 6.25 * cm - 5 * age + (SEX[b.sex] ?? SEX.x));
  };
  Cal.perStep = () => (Cal.ready() ? (S().settings.stride || WB.DATA.DEFAULT_STRIDE_M) * (0.1 / 3.5) * (Cal.rest() / 1440) : 0);
  Cal.of = (steps) => Math.round((steps || 0) * Cal.perStep());
  Cal.today = () => { const s = S(); return Cal.of(s.today.day === WB.dayKey() ? s.today.steps : 0); };
  Cal.day = (k) => Cal.of((S().days || {})[k] || (S().today.day === k ? S().today.steps : 0));
  const strideFor = (cm, sex) => Math.round(cm * (sex === 'm' ? 0.415 : sex === 'f' ? 0.413 : 0.414)) / 100;   // a common height-to-stride rule

  // ---------- the walking screen: a quiet "· 84 kcal" next to today's distance, ticking up as you walk ----------
  let lastV = null;   // the number shown last; it glows briefly whenever walking raises it
  const paint = () => {
    const of = $('#journey .today .of'); if (!of) return;
    let el = $('#j-kcal');
    if (!Cal.ready()) { if (el) el.remove(); lastV = null; return; }
    if (!el) { el = document.createElement('span'); el.id = 'j-kcal'; el.className = 'kcal'; of.append(el); }
    const v = Cal.today(), txt = ' · ' + WB.fmt(v) + ' kcal';
    if (el.textContent !== txt) { el.textContent = txt; el.title = 'About ' + WB.fmt(v) + ' active calories burned walking today'; }
    if (lastV !== null && v > lastV && !WB.reducedMotion()) { el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); }
    lastV = v;
  };
  const draw0 = UI.renderJourney;
  UI.renderJourney = (...a) => { const r = draw0.apply(UI, a); paint(); return r; };
  WB.bus.on('steps', () => { if (UI.tab === 'world') requestAnimationFrame(paint); });
  WB.bus.on('state', () => { if (UI.tab === 'world') paint(); });

  // ---------- setup (Profile → Settings) ----------
  const miles = () => (WB.miles ? WB.miles() : S().settings.units === 'mi');
  Cal.desc = () => {
    if (!Cal.ready()) return 'Enter your weight, height, age and sex to see the calories your walks burn.';
    const b = S().body, w = miles() ? Math.round(b.kg * 2.20462) + ' lb' : Math.round(b.kg) + ' kg';
    return 'On · ' + w + (b.cm ? ' · ' + (miles() ? Math.floor(b.cm / 30.48) + '′' + Math.round((b.cm / 2.54) % 12) + '″' : Math.round(b.cm) + ' cm') : '') + (b.age ? ' · ' + b.age + ' yrs' : '') + '. About ' + WB.fmt(Cal.of(10000)) + ' kcal per 10,000 steps.';
  };
  Cal.setup = () => {
    const b = S().body || {}, mi = miles(), def = Math.abs((S().settings.stride || 0) - WB.DATA.DEFAULT_STRIDE_M) < 0.001;
    const ft = b.cm ? Math.floor(b.cm / 30.48) : '', inch = b.cm ? Math.round((b.cm / 2.54) % 12) : '';
    const sexBtn = (k, l) => `<button type="button" role="radio" aria-checked="${(b.sex || '') === k}" data-csex="${k}">${l}</button>`;
    UI.sheet(`<h3 id="sheet-title">${WB.icon('flame', 2)} Calorie counter</h3>
      <p class="fine">Step Quest estimates the active calories your walks burn from your steps, stride and body. Your details stay in your save and are only used for this.</p>
      <form class="cm-form cal-form" id="cal-form" novalidate>
        <label class="fl"><span>Weight</span><span class="cal-in"><input type="number" name="w" inputmode="decimal" min="${mi ? 55 : 25}" max="${mi ? 660 : 300}" step="0.1" value="${b.kg ? (mi ? Math.round(b.kg * 2.20462) : Math.round(b.kg * 10) / 10) : ''}" required aria-describedby="cal-err"><i>${mi ? 'lb' : 'kg'}</i></span></label>
        ${mi ? `<div class="fl" role="group" aria-labelledby="cal-h-l"><span id="cal-h-l">Height</span><span class="cal-in2"><span class="cal-in"><input type="number" name="ft" inputmode="numeric" min="3" max="8" value="${ft}" aria-label="Feet"><i>ft</i></span><span class="cal-in"><input type="number" name="inch" inputmode="numeric" min="0" max="11" value="${inch}" aria-label="Inches"><i>in</i></span></span></div>`
        : `<label class="fl"><span>Height</span><span class="cal-in"><input type="number" name="cm" inputmode="numeric" min="100" max="250" value="${b.cm ? Math.round(b.cm) : ''}"><i>cm</i></span></label>`}
        <label class="fl"><span>Age</span><span class="cal-in"><input type="number" name="age" inputmode="numeric" min="13" max="100" value="${b.age || ''}"><i>years</i></span></label>
        <div class="fl"><span id="cal-sex-l">Sex <span class="opt">· used for your resting metabolism</span></span><div class="cm-seg cal-sex" role="radiogroup" aria-labelledby="cal-sex-l">${sexBtn('f', 'Female')}${sexBtn('m', 'Male')}${sexBtn('x', 'Prefer not to say')}</div></div>
        <label class="ck cal-stride"><input type="checkbox" name="stride" ${def ? 'checked' : ''}> <span>Set my stride length from my height${def ? '' : ' (you set it yourself; leave unticked to keep it)'}</span></label>
        <p class="cm-err" id="cal-err" role="alert"></p>
        <div class="cm-prev pbox" id="cal-prev" aria-live="polite"></div>
        <button class="btn gold block" type="submit">${Cal.ready() ? 'Save' : 'Start counting calories'}</button>
        ${Cal.ready() ? '<button class="btn ghost block" type="button" data-cal-off="1">Turn off and delete my details</button>' : ''}
        <p class="fine">An estimate for motivation, not medical advice.</p>
      </form>`, (root) => {
      const f = $('#cal-form', root), st = { sex: b.sex || '' };
      const read = () => {
        const num = (n) => { const el = f.elements[n]; return el && el.value !== '' ? +el.value : NaN; };
        const kg = mi ? num('w') / 2.20462 : num('w');
        const cm = mi ? (isNaN(num('ft')) ? NaN : (num('ft') * 12 + (num('inch') || 0)) * 2.54) : num('cm');
        return { kg, cm, age: num('age'), sex: st.sex };
      };
      const check = (v) => {
        if (!(v.kg >= 25 && v.kg <= 300)) return 'Enter your weight (' + (mi ? '55–660 lb' : '25–300 kg') + ').';
        if (!(v.cm >= 100 && v.cm <= 250)) return 'Enter your height (' + (mi ? '3 to 8 ft' : '100–250 cm') + ').';
        if (!(v.age >= 13 && v.age <= 100)) return 'Enter your age (13–100).';
        if (!st.sex) return 'Pick an option for sex (or “Prefer not to say”).';
        return '';
      };
      const preview = () => {
        const v = read(), ok = !check(v), p = $('#cal-prev', root);
        $('#cal-err', root).textContent = '';   // the last error goes as soon as anything changes
        if (!ok) { p.hidden = true; return; }
        const s = S(), keep = s.body, stride = s.settings.stride;
        s.body = { kg: v.kg, cm: v.cm, age: Math.round(v.age), sex: st.sex };
        if (f.stride.checked) s.settings.stride = strideFor(v.cm, st.sex);
        p.hidden = false; p.innerHTML = `<span class="lbl">Estimate</span><b>About ${WB.fmt(Cal.of(10000))} kcal per 10,000 steps</b><span class="fine">Today so far: ${WB.fmt(Cal.today())} kcal${f.stride.checked ? ' · stride ' + (miles() ? Math.round(s.settings.stride * 39.37) + ' in' : s.settings.stride.toFixed(2) + ' m') : ''}</span>`;
        s.body = keep; s.settings.stride = stride;
      };
      f.addEventListener('input', preview);
      f.addEventListener('click', (e) => {
        const t = e.target.closest('[data-csex]');
        if (t) { st.sex = t.dataset.csex; t.parentNode.querySelectorAll('[role="radio"]').forEach((x) => x.setAttribute('aria-checked', String(x === t))); WB.Sfx.play('tap'); return preview(); }
        if (e.target.closest('[data-cal-off]')) { S().body = null; WB.Save.queue(); UI.closeSheet(); UI.toast({ kicker: 'Calorie counter off', title: 'Your details were deleted', icon: 'check' }); WB.bus.emit('state'); if (UI.tab === 'profile') UI.renderProfile(); }
      });
      f.onsubmit = (e) => {
        e.preventDefault();
        const v = read(), why = check(v);
        if (why) { $('#cal-err', root).textContent = why; WB.Sfx.play('tap'); return; }
        const s = S(); s.body = { kg: Math.round(v.kg * 10) / 10, cm: Math.round(v.cm), age: Math.round(v.age), sex: st.sex };
        if (f.stride.checked) s.settings.stride = strideFor(v.cm, st.sex);
        WB.Save.queue(); UI.closeSheet(); WB.Sfx.play('claim');
        UI.toast({ kicker: 'Calorie counter on', title: WB.fmt(Cal.today()) + ' kcal today', sub: 'You’ll see it under today’s steps as you walk.', icon: 'flame', cls: 'ok' });
        WB.bus.emit('state'); if (UI.tab === 'profile') UI.renderProfile(); else UI.render();
      };
      preview();
    });
  };
  document.addEventListener('click', (e) => { if (e.target.closest('[data-act="cal-setup"]')) { WB.Sfx.play('tap'); Cal.setup(); } });
})();
