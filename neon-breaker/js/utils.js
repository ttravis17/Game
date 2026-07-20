/* NEON BREAKER — utils.js
 * Kleine Mathe- und Hilfsfunktionen, global unter NB.U
 */
'use strict';
window.NB = window.NB || {};

NB.U = (() => {
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (lo, hi) => lo + Math.random() * (hi - lo);
  const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];
  const dist2 = (x1, y1, x2, y2) => {
    const dx = x2 - x1, dy = y2 - y1;
    return dx * dx + dy * dy;
  };

  // Easing
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
  const easeOutBack = (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };
  const easeInCubic = (t) => t * t * t;
  const easeOutElastic = (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 :
      Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  };

  // Farbhelfer: hsla-String mit Cache (Strings sind teuer im Hot Path)
  const hslaCache = new Map();
  const hsla = (h, s, l, a) => {
    const key = ((h | 0) << 20) ^ ((s | 0) << 13) ^ ((l | 0) << 6) ^ ((a * 63) | 0);
    let v = hslaCache.get(key);
    if (!v) {
      v = `hsla(${h | 0},${s | 0}%,${l | 0}%,${a})`;
      if (hslaCache.size < 4000) hslaCache.set(key, v);
    }
    return v;
  };

  // Abgerundetes Rechteck als Pfad
  const roundRect = (ctx, x, y, w, h, r) => {
    if (r > w / 2) r = w / 2;
    if (r > h / 2) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // Kreis vs. Rechteck: liefert {nx, ny, depth} oder null
  const circleVsRect = (cx, cy, cr, rx, ry, rw, rh) => {
    const nearX = clamp(cx, rx, rx + rw);
    const nearY = clamp(cy, ry, ry + rh);
    const dx = cx - nearX, dy = cy - nearY;
    const d2 = dx * dx + dy * dy;
    if (d2 > cr * cr) return null;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      return { nx: dx / d, ny: dy / d, depth: cr - d };
    }
    // Mittelpunkt liegt im Rechteck: kürzesten Weg nach draußen suchen
    const left = cx - rx, right = rx + rw - cx;
    const top = cy - ry, bottom = ry + rh - cy;
    const m = Math.min(left, right, top, bottom);
    if (m === top) return { nx: 0, ny: -1, depth: top + cr };
    if (m === bottom) return { nx: 0, ny: 1, depth: bottom + cr };
    if (m === left) return { nx: -1, ny: 0, depth: left + cr };
    return { nx: 1, ny: 0, depth: right + cr };
  };

  // Formatiert Punktzahlen mit Tausender-Trennzeichen (de-CH: Apostroph)
  const fmt = (n) => {
    n = Math.round(n);
    let s = String(Math.abs(n)), out = '';
    while (s.length > 3) {
      out = '’' + s.slice(-3) + out;
      s = s.slice(0, -3);
    }
    return (n < 0 ? '-' : '') + s + out;
  };

  return {
    clamp, lerp, rand, randInt, pick, dist2,
    easeOutCubic, easeOutBack, easeInCubic, easeOutElastic,
    hsla, roundRect, circleVsRect, fmt,
    TAU: Math.PI * 2,
  };
})();
