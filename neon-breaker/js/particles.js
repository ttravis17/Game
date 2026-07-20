/* NEON BREAKER — particles.js
 * Partikelsystem mit Objekt-Pool und vorgerenderten Glow-Sprites
 * (schneller als shadowBlur pro Partikel).
 */
'use strict';
window.NB = window.NB || {};

NB.particles = (() => {
  const U = NB.U;
  const MAX = 1600;
  const pool = [];
  let count = 0;

  // Typen
  const SPARK = 0, SHARD = 1, RING = 2, TEXT = 3, TRAIL = 4;

  for (let i = 0; i < MAX; i++) {
    pool.push({
      type: 0, x: 0, y: 0, vx: 0, vy: 0, g: 0, drag: 1,
      life: 0, maxLife: 1, size: 4, hue: 0, sat: 100, light: 60,
      rot: 0, vrot: 0, w: 0, h: 0, text: '', big: false,
    });
  }

  function alloc() {
    if (count >= MAX) return null;
    return pool[count++];
  }
  function free(i) {
    count--;
    const tmp = pool[i];
    pool[i] = pool[count];
    pool[count] = tmp;
  }

  // ---- Glow-Sprite-Cache --------------------------------------------
  const glowCache = new Map();
  function glowSprite(hue) {
    const key = Math.round(hue / 12) * 12;
    let c = glowCache.get(key);
    if (c) return c;
    c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, `hsla(${key},100%,88%,1)`);
    grad.addColorStop(0.25, `hsla(${key},100%,65%,0.85)`);
    grad.addColorStop(0.6, `hsla(${key},100%,55%,0.28)`);
    grad.addColorStop(1, `hsla(${key},100%,50%,0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 32, 32);
    glowCache.set(key, c);
    return c;
  }

  // ---- Spawner -------------------------------------------------------

  function spawnSparks(x, y, hue, n, speed = 260, spread = U.TAU, baseAngle = 0) {
    for (let i = 0; i < n; i++) {
      const p = alloc();
      if (!p) return;
      const a = baseAngle + (Math.random() - 0.5) * spread;
      const v = speed * (0.35 + Math.random() * 0.9);
      p.type = SPARK;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * v;
      p.vy = Math.sin(a) * v;
      p.g = 300; p.drag = 0.985;
      p.maxLife = p.life = 0.35 + Math.random() * 0.45;
      p.size = 2.5 + Math.random() * 4;
      p.hue = hue + U.rand(-14, 14);
    }
  }

  function spawnShards(x, y, w, h, hue, n = 10) {
    for (let i = 0; i < n; i++) {
      const p = alloc();
      if (!p) return;
      p.type = SHARD;
      p.x = x + U.rand(-w / 2, w / 2);
      p.y = y + U.rand(-h / 2, h / 2);
      p.vx = U.rand(-190, 190);
      p.vy = U.rand(-320, -40);
      p.g = 850; p.drag = 0.995;
      p.maxLife = p.life = 0.6 + Math.random() * 0.5;
      p.w = U.rand(5, 13);
      p.h = U.rand(4, 9);
      p.rot = U.rand(0, U.TAU);
      p.vrot = U.rand(-9, 9);
      p.hue = hue + U.rand(-10, 10);
      p.light = U.rand(52, 70);
    }
  }

  function spawnRing(x, y, hue, size = 60, dur = 0.4) {
    const p = alloc();
    if (!p) return;
    p.type = RING;
    p.x = x; p.y = y;
    p.vx = 0; p.vy = 0; p.g = 0;
    p.maxLife = p.life = dur;
    p.size = size;
    p.hue = hue;
  }

  function spawnText(x, y, text, { hue = 55, big = false, dur = 0.9 } = {}) {
    const p = alloc();
    if (!p) return;
    // Text im Spielfeld halten
    if (NB.C) {
      const m = big ? 150 : 60;
      x = U.clamp(x, m, NB.C.W - m);
      y = Math.max(y, big ? 140 : 60);
    }
    p.type = TEXT;
    p.x = x; p.y = y;
    p.vx = 0; p.vy = big ? -34 : -58;
    p.g = 0; p.drag = 1;
    p.maxLife = p.life = dur;
    p.text = text;
    p.hue = hue;
    p.big = big;
  }

  function spawnTrail(x, y, hue, size) {
    const p = alloc();
    if (!p) return;
    p.type = TRAIL;
    p.x = x; p.y = y;
    p.vx = 0; p.vy = 0; p.g = 0;
    p.maxLife = p.life = 0.3;
    p.size = size;
    p.hue = hue;
  }

  // Feuerwerk für Level-Abschluss / Sieg
  function spawnFirework(x, y, hue) {
    spawnRing(x, y, hue, 120, 0.55);
    spawnSparks(x, y, hue, 42, 380);
    spawnSparks(x, y, (hue + 40) % 360, 18, 200);
  }

  // ---- Update & Render ----------------------------------------------

  function update(dt) {
    for (let i = count - 1; i >= 0; i--) {
      const p = pool[i];
      p.life -= dt;
      if (p.life <= 0) { free(i); continue; }
      p.vy += p.g * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === SHARD) p.rot += p.vrot * dt;
    }
  }

  function render(ctx) {
    // Additive Partikel (Sparks, Trails, Ringe)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < count; i++) {
      const p = pool[i];
      const t = p.life / p.maxLife;
      if (p.type === SPARK || p.type === TRAIL) {
        const s = p.size * (p.type === TRAIL ? t : 0.5 + t * 0.7) * 2.6;
        ctx.globalAlpha = t * (p.type === TRAIL ? 0.55 : 0.95);
        ctx.drawImage(glowSprite(p.hue), p.x - s / 2, p.y - s / 2, s, s);
      } else if (p.type === RING) {
        const prog = 1 - t;
        const r = p.size * U.easeOutCubic(prog);
        ctx.globalAlpha = t * 0.8;
        ctx.strokeStyle = U.hsla(p.hue, 100, 70, 1);
        ctx.lineWidth = 3 + 5 * t;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, U.TAU);
        ctx.stroke();
      }
    }
    ctx.restore();

    // Normale Partikel (Scherben, Texte)
    for (let i = 0; i < count; i++) {
      const p = pool[i];
      const t = p.life / p.maxLife;
      if (p.type === SHARD) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, t * 2);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = U.hsla(p.hue, 90, p.light, 1);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      } else if (p.type === TEXT) {
        const age = 1 - t;
        const scale = p.big
          ? Math.min(1, U.easeOutBack(Math.min(1, age * 3)))
          : 1;
        ctx.save();
        ctx.globalAlpha = Math.min(1, t * 2.6);
        ctx.translate(p.x, p.y);
        ctx.scale(scale, scale);
        ctx.font = p.big
          ? '800 44px "Segoe UI", system-ui, sans-serif'
          : '700 22px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = U.hsla(p.hue, 100, 60, 0.9);
        ctx.shadowBlur = p.big ? 22 : 10;
        ctx.fillStyle = U.hsla(p.hue, 100, 82, 1);
        ctx.fillText(p.text, 0, 0);
        ctx.restore();
      }
    }
  }

  function clear() { count = 0; }

  return {
    spawnSparks, spawnShards, spawnRing, spawnText, spawnTrail, spawnFirework,
    update, render, clear,
    get count() { return count; },
  };
})();
