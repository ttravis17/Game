/* NEON BREAKER — entities.js
 * Spielobjekte: Paddle, Ball, Brick, PowerUp, Laser.
 * Stein-Grafiken werden in Offscreen-Canvases gecacht (Glow ist teuer).
 */
'use strict';
window.NB = window.NB || {};

/* Logische Spielfeld-Konstanten (das Canvas wird darauf skaliert) */
NB.C = {
  W: 720, H: 1080,
  WALL: 14,
  TOP: 118,               // HUD-Bereich oben
  COLS: 10,
  BRICK_W: 62, BRICK_H: 30, BRICK_GAP: 6,
  BRICK_TOP: 176,
  PADDLE_Y: 992,
  PADDLE_H: 18,
  BALL_R: 9,
  SHIELD_Y: 1054,
};
NB.C.BRICK_MARGIN = (NB.C.W - (NB.C.COLS * NB.C.BRICK_W + (NB.C.COLS - 1) * NB.C.BRICK_GAP)) / 2;

/* Power-Up-Definitionen */
NB.POWERUPS = {
  multi:  { letter: 'M', hue: 195, label: 'Multiball',      dur: 0,  weight: 16 },
  wide:   { letter: 'B', hue: 130, label: 'Breites Paddle', dur: 14, weight: 15 },
  laser:  { letter: 'L', hue: 355, label: 'Laser',          dur: 10, weight: 13 },
  fire:   { letter: 'F', hue: 25,  label: 'Feuerball',      dur: 9,  weight: 11 },
  sticky: { letter: 'K', hue: 285, label: 'Klebe-Paddle',   dur: 12, weight: 12 },
  slow:   { letter: 'Z', hue: 220, label: 'Zeitlupe',       dur: 8,  weight: 12 },
  shield: { letter: 'S', hue: 160, label: 'Schild',         dur: 0,  weight: 12 },
  life:   { letter: '♥', hue: 340, label: 'Extra-Leben',    dur: 0,  weight: 5 },
};

(() => {
  const U = NB.U, C = NB.C;

  // ---- Paddle --------------------------------------------------------

  class Paddle {
    constructor() {
      this.baseW = 124;
      this.w = this.baseW;
      this.targetW = this.baseW;
      this.h = C.PADDLE_H;
      this.x = C.W / 2;
      this.y = C.PADDLE_Y;
      this.squash = 0;        // Squash-Animation nach Balltreffer
      this.vx = 0;            // für Tastatursteuerung
    }

    reset() {
      this.w = this.targetW = this.baseW;
      this.x = C.W / 2;
      this.squash = 0;
      this.vx = 0;
    }

    update(dt) {
      this.w = U.lerp(this.w, this.targetW, 1 - Math.pow(0.001, dt));
      if (this.squash > 0) this.squash = Math.max(0, this.squash - dt * 5);
      const half = this.w / 2 + 2;
      this.x = U.clamp(this.x, C.WALL + half, C.W - C.WALL - half);
    }

    render(ctx, g) {
      const w = this.w, h = this.h;
      const sq = this.squash;
      const drawW = w * (1 + sq * 0.12);
      const drawH = h * (1 - sq * 0.3);
      const x = this.x - drawW / 2;
      const y = this.y - drawH / 2;
      const hue = g.fx.sticky > 0 ? 285 : 190;

      ctx.save();
      // Glow
      ctx.shadowColor = U.hsla(hue, 100, 60, 0.9);
      ctx.shadowBlur = 22;
      const grad = ctx.createLinearGradient(0, y, 0, y + drawH);
      grad.addColorStop(0, U.hsla(hue, 90, 82, 1));
      grad.addColorStop(0.5, U.hsla(hue, 85, 62, 1));
      grad.addColorStop(1, U.hsla(hue, 90, 45, 1));
      ctx.fillStyle = grad;
      U.roundRect(ctx, x, y, drawW, drawH, drawH / 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Lichtkante oben
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      U.roundRect(ctx, x + 6, y + 2, drawW - 12, 4, 2);
      ctx.fill();

      // Laser-Kanonen
      if (g.fx.laser > 0) {
        ctx.fillStyle = U.hsla(355, 95, 62, 1);
        ctx.shadowColor = U.hsla(355, 100, 60, 0.9);
        ctx.shadowBlur = 12;
        U.roundRect(ctx, x - 2, y - 10, 10, 14, 3);
        ctx.fill();
        U.roundRect(ctx, x + drawW - 8, y - 10, 10, 14, 3);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---- Ball ----------------------------------------------------------

  class Ball {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.vx = 0; this.vy = 0;
      this.r = C.BALL_R;
      this.stuck = true;        // klebt am Paddle (vor dem Start)
      this.stuckOffset = 0;     // Position relativ zur Paddle-Mitte
      this.trailAcc = 0;
      this.squash = 0;          // kurzer Squash beim Aufprall
      this.squashAngle = 0;
    }

    speed() { return Math.hypot(this.vx, this.vy); }

    setDir(angle, speed) {
      this.vx = Math.sin(angle) * speed;
      this.vy = -Math.cos(angle) * speed;
    }

    bounce(nx, ny) {
      const dot = this.vx * nx + this.vy * ny;
      this.vx -= 2 * dot * nx;
      this.vy -= 2 * dot * ny;
      this.squash = 1;
      this.squashAngle = Math.atan2(ny, nx);
    }

    render(ctx, g) {
      const fire = g.fx.fire > 0;
      const hue = fire ? 25 : 190;
      ctx.save();
      ctx.translate(this.x, this.y);
      if (this.squash > 0) {
        ctx.rotate(this.squashAngle);
        ctx.scale(1 - this.squash * 0.25, 1 + this.squash * 0.25);
        ctx.rotate(-this.squashAngle);
      }
      const r = this.r * (fire ? 1.15 : 1);
      const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r * 1.1);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.5, U.hsla(hue, 90, 80, 1));
      grad.addColorStop(1, U.hsla(hue, 95, 55, 1));
      ctx.shadowColor = U.hsla(hue, 100, 62, 1);
      ctx.shadowBlur = fire ? 26 : 18;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, U.TAU);
      ctx.fill();
      ctx.restore();
      if (this.squash > 0) this.squash = Math.max(0, this.squash - 0.08);
    }
  }

  // ---- Brick ---------------------------------------------------------

  const brickSpriteCache = new Map();
  const PAD = 14;   // Platz für den Glow im Sprite

  function brickSprite(type, hue, hp) {
    const key = type + '|' + hue + '|' + hp;
    let c = brickSpriteCache.get(key);
    if (c) return c;

    const w = C.BRICK_W, h = C.BRICK_H;
    c = document.createElement('canvas');
    c.width = w + PAD * 2;
    c.height = h + PAD * 2;
    const x = PAD, y = PAD;
    const ctx = c.getContext('2d');

    if (type === '#') {
      // Stahl: kühles Metall mit Nieten
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      grad.addColorStop(0, '#9aa7b8');
      grad.addColorStop(0.5, '#5c6a7d');
      grad.addColorStop(1, '#3a4552');
      ctx.shadowColor = 'rgba(150,180,220,0.5)';
      ctx.shadowBlur = 8;
      ctx.fillStyle = grad;
      U.roundRect(ctx, x, y, w, h, 5);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(210,225,245,0.55)';
      ctx.lineWidth = 1.5;
      U.roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 5);
      ctx.stroke();
      ctx.fillStyle = 'rgba(220,235,255,0.6)';
      for (const [rx, ry] of [[7, 7], [w - 7, 7], [7, h - 7], [w - 7, h - 7]]) {
        ctx.beginPath();
        ctx.arc(x + rx, y + ry, 2.2, 0, U.TAU);
        ctx.fill();
      }
    } else {
      const isExpl = type === 'E';
      const isMyst = type === 'M';
      const bh = isExpl ? 18 : isMyst ? 0 : hue;
      const sat = isMyst ? 20 : 88;
      const li = isMyst ? 30 : 55;

      ctx.shadowColor = isMyst ? 'rgba(255,255,255,0.5)' : U.hsla(bh, 100, 60, 0.85);
      ctx.shadowBlur = 13;
      const grad = ctx.createLinearGradient(0, y, 0, y + h);
      if (isMyst) {
        grad.addColorStop(0, '#3d3d4d');
        grad.addColorStop(1, '#1c1c28');
      } else {
        grad.addColorStop(0, U.hsla(bh, sat, li + 14, 1));
        grad.addColorStop(0.55, U.hsla(bh, sat, li, 1));
        grad.addColorStop(1, U.hsla(bh, sat + 5, li - 16, 1));
      }
      ctx.fillStyle = grad;
      U.roundRect(ctx, x, y, w, h, 6);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Lichtkante
      const hl = ctx.createLinearGradient(0, y + 2, 0, y + h * 0.5);
      hl.addColorStop(0, 'rgba(255,255,255,0.4)');
      hl.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = hl;
      U.roundRect(ctx, x + 3, y + 2, w - 6, h * 0.48, 4);
      ctx.fill();

      // Rand
      ctx.strokeStyle = isMyst ? 'rgba(255,255,255,0.5)' : U.hsla(bh, 100, 75, 0.9);
      ctx.lineWidth = 1.5;
      U.roundRect(ctx, x + 0.75, y + 0.75, w - 1.5, h - 1.5, 6);
      ctx.stroke();

      // HP-Punkte für harte Steine
      if ((type === '2' || type === '3') && hp > 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        const n = hp;
        for (let i = 0; i < n; i++) {
          ctx.beginPath();
          ctx.arc(x + w / 2 + (i - (n - 1) / 2) * 9, y + h - 6.5, 2, 0, U.TAU);
          ctx.fill();
        }
      }
    }
    brickSpriteCache.set(key, c);
    return c;
  }

  class Brick {
    constructor(gx, gy, type, levelHue) {
      this.gx = gx; this.gy = gy;
      this.type = type;
      const def = NB.BRICK_TYPES[type];
      this.hp = def.hp;
      this.maxHp = def.hp;
      this.points = def.points;
      this.kind = def.kind;
      this.hue = (levelHue + gy * 9) % 360;
      this.w = C.BRICK_W;
      this.h = C.BRICK_H;
      this.x = C.BRICK_MARGIN + gx * (C.BRICK_W + C.BRICK_GAP);
      this.y = C.BRICK_TOP + gy * (C.BRICK_H + C.BRICK_GAP);
      this.alive = true;
      this.flash = 0;                       // Aufblitzen bei Treffer
      this.born = -(gx * 0.028 + gy * 0.05); // gestaffelte Einflug-Animation
    }

    center() { return { x: this.x + this.w / 2, y: this.y + this.h / 2 }; }
    destructible() { return this.kind !== 'steel'; }

    render(ctx, g) {
      if (!this.alive) return;
      const t = g.time;
      let scale = 1;
      if (this.born < 0.32) {
        const p = U.clamp(this.born / 0.32, 0, 1);
        if (p <= 0) return;
        scale = U.easeOutBack(p);
      }
      const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
      const sprite = brickSprite(this.type, this.hue, this.hp);

      ctx.save();
      ctx.translate(cx, cy);
      if (scale !== 1) ctx.scale(scale, scale);
      ctx.drawImage(sprite, -this.w / 2 - PAD, -this.h / 2 - PAD);

      // Risse bei beschädigten Steinen
      if (this.maxHp !== Infinity && this.hp < this.maxHp) {
        const dmg = 1 - this.hp / this.maxHp;
        ctx.strokeStyle = `rgba(10,10,20,${0.35 + dmg * 0.3})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const seed = this.gx * 7 + this.gy * 13;
        const n = 2 + Math.floor(dmg * 3);
        for (let i = 0; i < n; i++) {
          const sx = -this.w / 2 + ((seed * (i + 3) * 37) % this.w);
          let px = sx, py = -this.h / 2;
          ctx.moveTo(px, py);
          for (let s = 0; s < 3; s++) {
            px += (((seed + i * 11 + s * 17) % 13) - 6) * 1.6;
            py += this.h / 3;
            ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
      }

      // Explosiv: pulsierender Kern
      if (this.type === 'E') {
        const pulse = 0.55 + 0.45 * Math.sin(t * 5 + this.gx * 1.7 + this.gy);
        ctx.fillStyle = U.hsla(30, 100, 60, 0.25 + pulse * 0.3);
        ctx.beginPath();
        ctx.arc(0, 0, 8 + pulse * 3, 0, U.TAU);
        ctx.fill();
        ctx.fillStyle = U.hsla(45, 100, 75, 0.9);
        ctx.beginPath();
        ctx.arc(0, 0, 3.5 + pulse * 1.5, 0, U.TAU);
        ctx.fill();
      }

      // Mystery: schimmerndes Fragezeichen
      if (this.type === 'M') {
        const hue = (t * 120 + this.gx * 30) % 360;
        ctx.font = '800 20px "Segoe UI", system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = U.hsla(hue, 100, 65, 1);
        ctx.shadowBlur = 10;
        ctx.fillStyle = U.hsla(hue, 100, 80, 1);
        ctx.fillText('?', 0, 1);
        ctx.shadowBlur = 0;
      }

      // Treffer-Blitz
      if (this.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.85})`;
        U.roundRect(ctx, -this.w / 2, -this.h / 2, this.w, this.h, 6);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---- PowerUp -------------------------------------------------------

  class PowerUp {
    constructor(x, y, type) {
      this.x = x; this.y = y;
      this.type = type;
      this.def = NB.POWERUPS[type];
      this.vy = 150;
      this.w = 52; this.h = 32;
      this.wob = Math.random() * U.TAU;
      this.alive = true;
    }

    update(dt) {
      this.vy = Math.min(this.vy + 220 * dt, 330);
      this.y += this.vy * dt;
      this.wob += dt * 5;
      if (this.y > C.H + 40) this.alive = false;
    }

    render(ctx, g) {
      const d = this.def;
      const wob = Math.sin(this.wob) * 0.12;
      ctx.save();
      ctx.translate(this.x + Math.sin(this.wob * 0.7) * 3, this.y);
      ctx.rotate(wob);
      ctx.shadowColor = U.hsla(d.hue, 100, 60, 0.95);
      ctx.shadowBlur = 16;
      const grad = ctx.createLinearGradient(0, -this.h / 2, 0, this.h / 2);
      grad.addColorStop(0, U.hsla(d.hue, 90, 68, 0.97));
      grad.addColorStop(1, U.hsla(d.hue, 95, 42, 0.97));
      ctx.fillStyle = grad;
      U.roundRect(ctx, -this.w / 2, -this.h / 2, this.w, this.h, 9);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.75)';
      ctx.lineWidth = 1.6;
      U.roundRect(ctx, -this.w / 2 + 1, -this.h / 2 + 1, this.w - 2, this.h - 2, 8);
      ctx.stroke();
      ctx.font = '800 19px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(d.letter, 0, 1.5);
      ctx.restore();
    }
  }

  // Gewichtete Zufallswahl eines Power-Up-Typs
  PowerUp.randomType = () => {
    const entries = Object.entries(NB.POWERUPS);
    let total = 0;
    for (const [, d] of entries) total += d.weight;
    let r = Math.random() * total;
    for (const [key, d] of entries) {
      r -= d.weight;
      if (r <= 0) return key;
    }
    return 'wide';
  };

  // ---- Laser ---------------------------------------------------------

  class Laser {
    constructor(x, y) {
      this.x = x; this.y = y;
      this.alive = true;
    }
    update(dt) {
      this.y -= 1000 * dt;
      if (this.y < C.TOP - 20) this.alive = false;
    }
    render(ctx) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createLinearGradient(0, this.y, 0, this.y + 22);
      grad.addColorStop(0, 'rgba(255,80,100,0)');
      grad.addColorStop(0.4, 'rgba(255,90,110,0.95)');
      grad.addColorStop(1, 'rgba(255,200,210,1)');
      ctx.fillStyle = grad;
      ctx.fillRect(this.x - 2.2, this.y, 4.4, 22);
      ctx.restore();
    }
  }

  NB.Paddle = Paddle;
  NB.Ball = Ball;
  NB.Brick = Brick;
  NB.PowerUp = PowerUp;
  NB.Laser = Laser;
})();
