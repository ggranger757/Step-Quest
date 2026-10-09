/* Stepquest — loading screens: black, a spinning ring around the logo, the name underneath.
   It's in the page from the first byte (#boot in body.html, logo inlined by tools/build.py), stays up until
   the first screen and its art are ready, and comes back while a new world's scenery loads. */
(() => {
  const $ = (q) => document.querySelector(q);
  const T0 = performance.now();
  let hideT = 0;
  const L = (WB.Loading = {
    logo: () => { const i = $('#boot .boot-logo'); return i ? i.src : ''; },
    show(text = 'Loading…') {
      const b = $('#boot'); if (!b) return;
      clearTimeout(hideT);
      $('#boot-sub').textContent = text;
      b.hidden = false; b.classList.remove('out');
      document.documentElement.classList.add('booting');
    },
    hide() {
      const b = $('#boot'); if (!b || b.hidden) return;
      b.classList.add('out');
      document.documentElement.classList.remove('booting');
      hideT = setTimeout(() => { b.hidden = true; }, 380);
    },
    // keep the screen up until every promise settles (never longer than `max`), and at least `min` ms
    async until(promises, min = 0, max = 6000) {
      const start = performance.now();
      await Promise.race([Promise.allSettled(promises), new Promise((r) => setTimeout(r, max))]);
      const left = min - (performance.now() - start);
      if (left > 0) await new Promise((r) => setTimeout(r, left));
      L.hide();
    },
    // first launch of the page: fonts, then the art the first screen needs
    boot(paths = []) {
      const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
      const art = paths.filter(Boolean).map((p) => WB.Assets.load(p));
      return L.until([fonts, ...art], Math.max(0, 1100 - (performance.now() - T0)));
    },
    // a short loading screen while a world's scenery and creatures load (e.g. after travelling)
    world(w) {
      if (!w) return;
      const paths = [...w.layers.map((l) => WB.layerPath(w, l[0])), ...w.pool.map((c) => WB.sheet('cr', c, 'idle').path)];
      const missing = paths.filter((p) => !WB.Assets.ok(p));
      if (!missing.length) return;
      L.show('Travelling to ' + w.name + '…');
      return L.until(missing.map((p) => WB.Assets.load(p)), 650);
    },
  });
})();
