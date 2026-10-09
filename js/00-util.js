/* Walkbound — shared utilities */
const WB = (window.WB = window.WB || {});

WB.$ = (s, r = document) => r.querySelector(s);
WB.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
WB.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
WB.lerp = (a, b, t) => a + (b - a) * t;
WB.fmt = (n) => Math.floor(n).toLocaleString('en-US');
WB.fmtKm = (m) => (m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 1 : 2) + ' km' : Math.round(m) + ' m');
WB.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

WB.dayKey = (d = new Date()) => {
  const z = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate());
};
WB.parseDay = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
WB.daysBetween = (a, b) => Math.round((WB.parseDay(b) - WB.parseDay(a)) / 86400000);
WB.addDays = (k, n) => { const d = WB.parseDay(k); d.setDate(d.getDate() + n); return WB.dayKey(d); };

// Seeded RNG (mulberry32) so daily tasks are stable for a given day
WB.rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
WB.hash = (s) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
WB.pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
WB.weighted = (items, r = Math.random) => {
  const tot = items.reduce((s, i) => s + i.w, 0); let x = r() * tot;
  for (const i of items) { x -= i.w; if (x <= 0) return i; }
  return items[items.length - 1];
};

// Safe browser storage (can throw or be empty in some contexts)
WB.store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};

// Tiny event bus
WB.bus = (() => {
  const m = {};
  return {
    on(e, f) { (m[e] = m[e] || []).push(f); },
    emit(e, d) { (m[e] || []).forEach((f) => { try { f(d); } catch (err) { console.error(err); } }); },
  };
})();

WB.reducedMotion = () => {
  const s = WB.state && WB.state.settings;
  if (s && s.reducedMotion != null) return s.reducedMotion;
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
};

WB.isDev = () => {
  try { return location.hash === '#dev' || WB.store.get('walkbound.dev') === true; } catch (e) { return false; }
};
