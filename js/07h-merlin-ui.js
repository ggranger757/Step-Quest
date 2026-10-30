/* Step Quest — Merlin's Eggs on screen: the Missions → Merlin tab (the nest, the daily egg) and the hatching card
   (Knowledge Check → History Note → reward). Rules live in 05e-merlin.js. */
(() => {
  const D = WB.DATA, G = WB.Game, UI = WB.UI, S = () => WB.state, esc = WB.esc;

  const eggCard = (r) => {
    const e = D.eggById[r.egg], p = G.eggProgress(r);
    return `<div class="egg-card pbox ${p.ready ? 'ready' : ''}">
      <span class="ek-img">${WB.eggImg(r.egg, 48, p.ready ? '' : 'still')}</span>
      <div class="ek-main">
        <div class="ek-top"><b>${esc(e.name)}</b><span class="lbl">${esc(e.rarity)}</span></div>
        ${p.ready ? `<p class="fine">Ready! Answer Merlin to hatch.</p>`
          : `<div class="bar seg cyan" role="progressbar" aria-label="${esc(e.name)} warmth" aria-valuemin="0" aria-valuemax="${p.target}" aria-valuenow="${p.cur}"><i style="width:${p.pct}%"></i></div>
             <p class="fine">${WB.fmt(p.cur)} / ${WB.fmt(p.target)} steps</p>`}
      </div>
      ${p.ready ? `<button class="btn gold sm" type="button" data-hatch="${r.id}">Hatch</button>` : ''}
    </div>`;
  };
  const emptySlot = (gift) => `<div class="egg-card pbox empty">
      <span class="ek-img ek-none" aria-hidden="true">${WB.eggImg('frost', 48, 'still')}</span>
      <div class="ek-main"><b>Empty spot</b><p class="fine">${gift ? 'Today’s egg is ready.' : 'New egg daily.'}</p></div>
      ${gift ? `<button class="btn gold sm" type="button" data-merlin-gift>Get egg</button>` : ''}
    </div>`;

  // Missions → Merlin
  UI.merlinSection = () => {
    const m = G.merlin(), nest = G.nest(), gift = G.merlinGiftReady();
    const slots = [...nest.map(eggCard), ...Array.from({ length: D.NEST_MAX - nest.length }, (_, i) => emptySlot(gift && i === 0))];
    return `<div class="sect merlin-sect" id="merlin-quest">
        <h2><canvas class="mer-face" width="40" height="40" aria-hidden="true"></canvas>Merlin’s Eggs <span class="aside">${m.hatched} hatched</span></h2>
        <p class="fine">Every step warms all your eggs.</p>
        <div class="list nest" id="egg-strip">${slots.join('')}</div>
      </div>
      <div class="sect"><h2>How it works</h2>
        <ul class="m-lock-list pbox card">
          <li>${WB.eggImg('frost', 24, 'still')}<span><b>Get an egg</b><small>One daily, more on the road, a Crystal Egg per guardian. Holds ${D.NEST_MAX}.</small></span></li>
          <li>${WB.icon('steps', 2)}<span><b>Walk to hatch</b><small>${D.EGGS.map((e) => e.name.replace(' Egg', '') + ' ' + e.short).join(' · ')}. Eggs never expire.</small></span></li>
          <li>${WB.icon('cap', 2)}<span><b>Answer Merlin</b><small>Right: +${Math.round((D.QUIZ_BONUS - 1) * 100)}% reward. Crystal adds a weapon or pet. Wrong still hatches.</small></span></li>
          <li>${WB.icon('note', 2)}<span><b>History Note</b><small>A real fact with every hatch.</small></span></li>
        </ul>
        <p class="fine">Answered right: ${m.right} / ${m.taken}</p>
      </div>`;
  };

  // ---------- hatching: Knowledge Check → History Note → reward ----------
  UI.hatch = (nid) => {
    const r = G.nest().find((x) => x.id === nid), qz = G.hatchQuestion(nid);
    if (!r || !qz) return;
    const e = D.eggById[r.egg];
    UI.sheet(`<div class="hatch" data-npc="merlin">
        <span class="lbl">${esc(e.name)} · Knowledge Check</span>
        <h3 id="sheet-title">${esc(qz.topic)}</h3>
        <div class="hatch-top"><canvas class="mer-face" width="64" height="64" aria-hidden="true"></canvas><p class="hatch-say">${esc(WB.pick(D.MERLIN_HATCH))}</p></div>
        <p class="dq">${esc(qz.q)}</p>
        <div class="choices quiz">${qz.options.map((o, i) => `<button class="btn ghost" type="button" data-ans="${i}">${esc(o)}</button>`).join('')}</div>
        <p class="fine">Right: +${Math.round((D.QUIZ_BONUS - 1) * 100)}% reward${e.hoard ? ' and a weapon or pet' : ''}. Hatches either way.</p>
      </div>`, (root) => {
      WB.paintThumb(root.querySelector('.mer-face'), { kind: 'npc', id: 'merlin' });
      root.querySelectorAll('[data-ans]').forEach((b) => (b.onclick = () => {
        const res = G.hatch(nid, +b.dataset.ans); if (!res) return;
        root.querySelectorAll('[data-ans]').forEach((x, i) => { x.disabled = true; x.classList.toggle('right', i === qz.answer); x.classList.toggle('wrong', i === +b.dataset.ans && !res.right); });
        WB.Sfx.play(res.right ? 'level' : 'tap');
        setTimeout(() => reveal(res), 900);
      }));
    });
  };
  function reveal(res) {
    const e = D.eggById[res.egg];
    UI.sheet(`<div class="hatch done" data-npc="merlin">
        <span class="lbl">${esc(e.name)} hatched</span>
        <h3 id="sheet-title">${res.right ? 'Correct!' : 'Not quite'}</h3>
        <div class="hatch-top"><canvas class="mer-face" width="64" height="64" aria-hidden="true"></canvas><p class="hatch-say">${esc(WB.pick(res.right ? D.MERLIN_RIGHT : D.MERLIN_WRONG))}${res.right ? '' : ` The answer was <b>${esc(res.answer)}</b>.`}</p></div>
        <div class="pbox card history"><span class="lbl">${WB.icon('note', 1)} Merlin’s History Note</span><p>${esc(res.fact)}</p></div>
        <div class="outcome">${UI.pills(res.granted)}</div>
        <button class="btn gold block" type="button" data-close data-autofocus>Collect</button>
      </div>`, (root) => {
      root.querySelectorAll('.mer-face').forEach((c) => WB.paintThumb(c, { kind: 'npc', id: 'merlin' }));
    });
    WB.Celebrate.fire('merlin', { title: e.name }, res.right ? 120 : 60);
    UI.updateHud(); UI.render();
  }

  // ---------- taps and events ----------
  document.addEventListener('click', (ev) => {
    const h = ev.target.closest('[data-hatch]');
    if (h) { WB.Sfx.play('tap'); return UI.hatch(h.dataset.hatch); }
    const g = ev.target.closest('[data-merlin-gift]');
    if (g) {
      const r = G.claimGift(); if (!r) return;
      WB.Sfx.play('quest');
      UI.toast({ kicker: 'A gift from Merlin', title: D.eggById[r.egg].name, sub: WB.fmt(D.eggById[r.egg].steps) + ' steps to hatch.', egg: r.egg, cls: 'cyan' });
      UI.render();
    }
  });
  WB.bus.on('eggReady', (r) => {
    const e = D.eggById[r.egg];
    UI.toast({ kicker: 'Ready to hatch', title: e.name, sub: 'Answer Merlin to hatch.', egg: r.egg, cls: 'gold', action: { label: 'Hatch', fn: () => UI.hatch(r.id) } });
    UI.updateBadges && UI.updateBadges();
  });
})();
