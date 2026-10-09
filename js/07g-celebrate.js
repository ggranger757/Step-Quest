/* Stepquest — celebrations: a short burst of pixel confetti and a warm, varied message when you level up,
   earn an achievement or complete any mission. Confetti is skipped with reduced motion and waits until a
   battle is over; bursts close together merge into one. */
(() => {
  const S = () => WB.state;
  const COLORS = ['#ffcc4d', '#8b6cff', '#59e3ff', '#ff6b8a', '#6ee7a0', '#ffffff', '#c7b8ff'];
  let cv = null, parts = [], raf = 0, last = 0, pending = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const x = cv.getContext('2d'), W = cv.width, H = cv.height;
    x.clearRect(0, 0, W, H);
    parts = parts.filter((p) => p.t < p.life);
    for (const p of parts) {
      p.t += dt; p.vy += 520 * dt; p.vx *= 0.99; p.x += p.vx * dt; p.y += p.vy * dt; p.spin += p.vs * dt;
      const w = Math.max(1, Math.abs(Math.cos(p.spin)) * p.w);   // a flat flake turning over
      x.globalAlpha = Math.min(1, (p.life - p.t) / 0.4); x.fillStyle = p.c;
      x.fillRect(Math.round(p.x - w / 2), Math.round(p.y), Math.round(w), p.h);
    }
    if (parts.length) raf = requestAnimationFrame(frame);
    else { cv.remove(); cv = null; raf = 0; }
  }
  function confetti(amount = 90) {
    if (WB.reducedMotion && WB.reducedMotion()) return;
    if (document.documentElement.classList.contains('battling')) { pending = Math.max(pending, amount); return; }   // after the fight
    if (!cv) {
      cv = document.createElement('canvas'); cv.className = 'confetti'; cv.setAttribute('aria-hidden', 'true');
      cv.width = Math.round(innerWidth / 2); cv.height = Math.round(innerHeight / 2);   // half resolution = chunky pixels
      document.body.appendChild(cv);
    }
    const W = cv.width, H = cv.height;
    for (let i = 0; i < amount; i++) {
      const left = i % 2 === 0;   // two cannons, bottom corners, firing up and inward
      parts.push({ x: left ? -4 : W + 4, y: H * (0.65 + Math.random() * 0.2), vx: (left ? 1 : -1) * (90 + Math.random() * 170), vy: -(260 + Math.random() * 240),
        w: 2 + Math.round(Math.random() * 2), h: 2 + Math.round(Math.random() * 2), c: COLORS[i % COLORS.length], spin: Math.random() * 6, vs: 6 + Math.random() * 10, t: 0, life: 1.5 + Math.random() * 0.7 });
    }
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }
  // confetti held during a battle bursts as soon as the battle screen closes
  setInterval(() => { if (pending && !document.documentElement.classList.contains('battling')) { const n = pending; pending = 0; confetti(n); } }, 500);

  // ---------- warm messages: varied, and about this player right now ----------
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function ctx() {
    const s = S(), h = new Date().getHours();
    const part = h < 5 ? 'late-night' : h < 12 ? 'morning' : h < 17 ? 'afternoon' : h < 21 ? 'evening' : 'night';
    const steps = s.today && s.today.day === WB.dayKey() ? s.today.steps : 0;
    const streak = WB.Game.streakView ? WB.Game.streakView().count : 0;
    const name = s.name && s.name !== 'Wanderer' ? s.name : 'walker';
    return { s, part, steps, streak, name };
  }
  function message(kind, d = {}) {
    const c = ctx(), N = c.name, stepsLine = c.steps >= 100 ? WB.fmt(c.steps) + ' steps today and counting.' : 'Every step adds up.';
    const streakLine = c.streak >= 2 ? c.streak + '-day streak, still going strong.' : 'That’s how momentum starts.';
    if (kind === 'level') return pick([
      `Level ${d.level}, ${N}! Every step you took got you here.`,
      `You reached level ${d.level}. ${stepsLine}`,
      `Level ${d.level}: stronger, steadier, still walking. Proud of you.`,
      `What a ${c.part}, ${N}. Level ${d.level} looks good on you.`,
      d.level % 5 === 0 ? `Level ${d.level}! A milestone worth a little victory lap.` : `Level ${d.level}. New worlds are taking notice.`,
    ]);
    if (kind === 'achievement') return pick([
      `${d.title}: earned the honest way, one step at a time.`,
      `You did it, ${N}. “${d.title}” is yours to keep.`,
      `${d.title}! Small steps, big story.`,
      `A ${c.part} to remember: ${d.title}.`,
    ]);
    if (kind === 'merlin') return pick([
      `“Hoo! I knew you had it in you, ${N}.” Merlin is impressed.`,
      `“${d.title}” conquered. Merlin will tell the other owls about you.`,
      `That was no small walk, ${N}. ${stepsLine}`,
      `A wizard’s quest, finished on foot. Legendary ${c.part}, ${N}.`,
      `Merlin bows low. ${streakLine}`,
    ]);
    if (kind === 'custom') return pick([
      `You kept a promise to yourself, ${N}. That matters.`,
      `“${d.title}” done. ${streakLine}`,
      `Look at you go! One more thing off your list this ${c.part}.`,
      `Done and dusted. Your future self says thanks.`,
      d.late ? `Late still counts, ${N}. You finished it.` : `Right on time. Nicely done, ${N}.`,
    ]);
    return pick([   // any game mission: daily, adventure, delivery, field
      `Mission complete! ${streakLine}`,
      `Nice work, ${N}. “${d.title}” is done.`,
      `You showed up for yourself this ${c.part}. ${stepsLine}`,
      `Another one for the journal, ${N}. Keep walking.`,
      `That’s the spirit! Rewards are waiting for you.`,
    ]);
  }

  WB.Celebrate = { confetti, message, fire(kind, d, amount) { confetti(amount); return message(kind, d); } };
})();
