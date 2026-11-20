/* Step Quest — shared utilities */
const WB = (window.WB = window.WB || {});

WB.$ = (s, r = document) => r.querySelector(s);
WB.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
WB.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
WB.lerp = (a, b, t) => a + (b - a) * t;
WB.fmt = (n) => Math.floor(n).toLocaleString('en-US');
// distances follow the player's unit setting (Profile → Distance units): metric (m / km) or imperial (ft / mi)
WB.miles = () => !!(WB.state && WB.state.settings && WB.state.settings.units === 'mi');
WB.fmtKm = (m) => {
  if (WB.miles()) { const mi = m / 1609.344; return mi < 0.1 ? Math.round(m * 3.28084) + ' ft' : mi.toFixed(mi >= 10 ? 1 : 2) + ' mi'; }
  return m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 1 : 2) + ' km' : Math.round(m) + ' m';
};
// short form for goals ("1.5 km" / "0.9 mi")
WB.fmtDist = (m) => {
  if (WB.miles()) { const mi = m / 1609.344; return (mi < 10 ? +mi.toFixed(1) : Math.round(mi)) + ' mi'; }
  return m >= 1000 ? (m / 1000).toFixed(m % 1000 ? 1 : 0) + ' km' : m + ' m';
};
// rewrite "3 km" written in content text for players who use miles
WB.unitText = (t) => (WB.miles() && t ? String(t).replace(/(\d+(?:\.\d+)?)\s?km\b/g, (_, n) => WB.fmtDist(parseFloat(n) * 1000)) : t);
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
  // can this browser keep data at all? (private windows and blocked site data can't)
  ok() { try { localStorage.setItem('stepquest.probe', '1'); localStorage.removeItem('stepquest.probe'); return true; } catch (e) { return false; } },
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

// the developer panel exists only in dev builds (tools/build.py --dev); release builds never show it
WB.isDev = () => {
  if (!window.WB.DEV_TOOLS) return false;
  try { return location.hash === '#dev' || WB.store.get('walkbound.dev') === true; } catch (e) { return false; }
};
