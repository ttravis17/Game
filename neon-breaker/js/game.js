/* NEON BREAKER — game.js
 * Hauptlogik: Game-Loop (fester Physik-Takt), Zustände, Kollisionen,
 * Combos, Power-Ups, Effekte, HUD und alle Screens.
 */
'use strict';
window.NB = window.NB || {};

(() => {
  const U = NB.U, C = NB.C, P = NB.particles, A = NB.audio;

  const STORE = {
    get high() { try { return +localStorage.getItem('nb_high') || 0; } catch (e) { return 0; } },
    set high(v) { try { localStorage.setItem('nb_high', String(v)); } catch (e) { /* egal */ } },
    get maxLevel() { try { return +localStorage.getItem('nb_maxlevel') || 1; } catch (e) { return 1; } },
    set maxLevel(v) { try { localStorage.setItem('nb_maxlevel', String(v)); } catch (e) { /* egal */ } },
  };

  const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';
  const reducedMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  class Game {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.state = 'title';
      this.time = 0;              // Gesamtzeit (real)
      this.stateT = 0;            // Zeit im aktuellen Zustand

      // Laufende Partie
      this.score = 0;
      this.displayScore = 0;
      this.scorePop = 0;
      this.lives = 3;
      this.level = 0;
      this.combo = 0;
      this.maxCombo = 0;
      this.bricksDestroyed = 0;
      this.paddleHits = 0;
      this.newRecord = false;

      // Entities
      this.paddle = new NB.Paddle();
      this.balls = [];
      this.bricks = [];
      this.grid = [];
      this.powerups = [];
      this.lasers = [];
      this.destructibleCount = 0;
      this.expQueue = [];         // verzögerte Kettenexplosionen

      // Aktive Power-Up-Effekte (Restzeit in Sekunden)
      this.fx = { wide: 0, laser: 0, fire: 0, sticky: 0, slow: 0, shield: 0, laserCd: 0 };

      // Bildschirm-Effekte
      this.trauma = 0;            // Screenshake
      this.flashAlpha = 0;
      this.flashColor = '255,60,80';
      this.hitStop = 0;
      this.slowmo = 0;
      this.timeScale = 1;
      this.shieldFlash = 0;

      // Banner (Level-Intro usw.)
      this.banner = null;

      // Hintergrund
      this.bgHue = NB.LEVELS[0].hue;
      this.bgHueTarget = this.bgHue;
      this.stars = [];
      for (let i = 0; i < 110; i++) {
        this.stars.push({
          x: Math.random() * C.W,
          y: Math.random() * C.H,
          z: 0.25 + Math.random() * 0.75,
          tw: Math.random() * U.TAU,
        });
      }

      // Demo-Bälle für den Titelscreen
      this.demoBalls = [];
      for (let i = 0; i < 3; i++) {
        this.demoBalls.push({
          x: U.rand(100, C.W - 100), y: U.rand(300, C.H - 200),
          vx: U.rand(-1, 1) > 0 ? U.rand(120, 220) : -U.rand(120, 220),
          vy: U.rand(-1, 1) > 0 ? U.rand(120, 220) : -U.rand(120, 220),
          hue: [190, 320, 55][i],
        });
      }

      // Eingabe
      this.keys = {};
      this.pointer = { x: C.W / 2, y: 0, down: false, type: 'mouse' };
      this.lastTouchX = null;
      this.uiButtons = [];
      this.hoverBtn = null;

      // Skalierung
      this.dpr = 1; this.scale = 1; this.offX = 0; this.offY = 0;

      this.bindEvents();
      this.resize();

      this.last = performance.now();
      requestAnimationFrame((t) => this.frame(t));
    }

    // ---- Setup / Eingabe ----------------------------------------------

    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(w * this.dpr);
      this.canvas.height = Math.round(h * this.dpr);
      this.canvas.style.width = w + 'px';
      this.canvas.style.height = h + 'px';
      this.scale = Math.min(w / C.W, h / C.H);
      this.offX = (w - C.W * this.scale) / 2;
      this.offY = (h - C.H * this.scale) / 2;
    }

    toLogical(e) {
      const r = this.canvas.getBoundingClientRect();
      return {
        x: (e.clientX - r.left - this.offX) / this.scale,
        y: (e.clientY - r.top - this.offY) / this.scale,
      };
    }

    bindEvents() {
      window.addEventListener('resize', () => this.resize());
      this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

      this.canvas.addEventListener('pointerdown', (e) => {
        A.unlock();
        const p = this.toLogical(e);
        this.pointer.x = p.x; this.pointer.y = p.y;
        this.pointer.down = true;
        this.pointer.type = e.pointerType;
        if (e.pointerType === 'touch') this.lastTouchX = p.x;
        this.onPress(p);
        e.preventDefault();
      });
      this.canvas.addEventListener('pointermove', (e) => {
        const p = this.toLogical(e);
        this.pointer.x = p.x; this.pointer.y = p.y;
        if (this.state === 'playing') {
          if (e.pointerType === 'touch') {
            if (this.lastTouchX != null) this.paddle.x += (p.x - this.lastTouchX) * 1.25;
            this.lastTouchX = p.x;
          } else {
            this.paddle.x = p.x;
          }
        }
        this.updateHover(p);
      });
      this.canvas.addEventListener('pointerup', () => {
        this.pointer.down = false;
        this.lastTouchX = null;
      });
      this.canvas.addEventListener('pointercancel', () => {
        this.pointer.down = false;
        this.lastTouchX = null;
      });

      window.addEventListener('keydown', (e) => {
        A.unlock();
        this.keys[e.code] = true;
        if (e.code === 'Space') {
          e.preventDefault();
          this.onConfirm();
        }
        if (e.code === 'KeyP' || e.code === 'Escape') this.togglePause(e.code === 'Escape');
        if (e.code === 'KeyM') {
          const on = !(A.sfxOn || A.musicOn);
          A.setSfxOn(on); A.setMusicOn(on);
        }
      });
      window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });

      // Automatisch pausieren, wenn das Fenster den Fokus verliert
      const autoPause = () => { if (this.state === 'playing') this.setState('paused'); };
      window.addEventListener('blur', autoPause);
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) autoPause();
      });
    }

    updateHover(p) {
      this.hoverBtn = null;
      for (const b of this.uiButtons) {
        if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
          this.hoverBtn = b.id;
          break;
        }
      }
      this.canvas.style.cursor = this.hoverBtn ? 'pointer' : 'default';
    }

    onPress(p) {
      // Zuerst UI-Buttons prüfen
      for (const b of this.uiButtons) {
        if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
          A.sfx.click();
          this.onButton(b.id);
          return;
        }
      }
      if (this.state === 'playing') this.launchBalls();
      else if (this.state === 'levelclear' && this.stateT > 0.8) this.nextLevel();
    }

    onConfirm() {
      switch (this.state) {
        case 'title': this.startGame(0); break;
        case 'playing': this.launchBalls(); break;
        case 'levelclear': if (this.stateT > 0.8) this.nextLevel(); break;
        case 'gameover': case 'win': this.setState('title'); break;
        case 'paused': this.setState('playing'); break;
        default: break;
      }
    }

    onButton(id) {
      switch (id) {
        case 'play': this.startGame(0); break;
        case 'continue': this.startGame(STORE.maxLevel - 1); break;
        case 'help': this.setState('help'); break;
        case 'back': this.setState('title'); break;
        case 'pause': this.togglePause(); break;
        case 'resume': this.setState('playing'); break;
        case 'restart': this.startGame(0); break;
        case 'menu': this.setState('title'); break;
        case 'again': this.startGame(0); break;
        case 'sfx': A.setSfxOn(!A.sfxOn); break;
        case 'music': A.setMusicOn(!A.musicOn); break;
        default: break;
      }
    }

    togglePause(escape) {
      if (this.state === 'playing') this.setState('paused');
      else if (this.state === 'paused') this.setState('playing');
      else if (escape && this.state === 'help') this.setState('title');
    }

    setState(s) {
      this.state = s;
      this.stateT = 0;
      this.uiButtons = [];
      if (s === 'title') A.music.setIntensity(0.12);
    }

    // ---- Spielablauf ----------------------------------------------------

    startGame(levelIndex) {
      this.score = 0;
      this.displayScore = 0;
      this.lives = 3;
      this.combo = 0;
      this.maxCombo = 0;
      this.bricksDestroyed = 0;
      this.newRecord = false;
      this.startLevel(levelIndex);
    }

    startLevel(i) {
      this.level = i;
      const L = NB.LEVELS[i];
      STORE.maxLevel = Math.max(STORE.maxLevel, i + 1);

      this.bricks = [];
      this.grid = [];
      this.destructibleCount = 0;
      for (let gy = 0; gy < L.rows.length; gy++) {
        const row = L.rows[gy];
        this.grid.push(new Array(C.COLS).fill(null));
        for (let gx = 0; gx < Math.min(C.COLS, row.length); gx++) {
          const ch = row[gx];
          if (ch === '.' || !NB.BRICK_TYPES[ch]) continue;
          const brick = new NB.Brick(gx, gy, ch, L.hue);
          this.bricks.push(brick);
          this.grid[gy][gx] = brick;
          if (brick.destructible()) this.destructibleCount++;
        }
      }

      this.powerups = [];
      this.lasers = [];
      this.expQueue = [];
      this.balls = [];
      this.fx = { wide: 0, laser: 0, fire: 0, sticky: 0, slow: 0, shield: 0, laserCd: 0 };
      this.paddle.reset();
      this.spawnStuckBall();
      this.paddleHits = 0;
      this.combo = 0;
      this.bgHueTarget = L.hue;
      this.banner = { title: `LEVEL ${i + 1}`, sub: L.name, t: 0, dur: 2.1 };
      this.setState('playing');
      A.music.setIntensity(0.3);
    }

    nextLevel() {
      if (this.level + 1 >= NB.LEVELS.length) {
        this.balls = [];
        this.lasers = [];
        this.powerups = [];
        this.setState('win');
        this.checkHighscore();
        A.sfx.win();
        A.music.setIntensity(0.8);
      } else {
        this.startLevel(this.level + 1);
      }
    }

    spawnStuckBall() {
      const b = new NB.Ball(this.paddle.x, this.paddle.y - this.paddle.h / 2 - C.BALL_R - 1);
      b.stuck = true;
      b.stuckOffset = 0;
      this.balls.push(b);
    }

    launchBalls() {
      let launched = false;
      for (const b of this.balls) {
        if (!b.stuck) continue;
        const off = b.stuckOffset / (this.paddle.w / 2);
        const angle = off * 0.7 + U.rand(-0.12, 0.12);
        b.setDir(angle, this.targetSpeed());
        b.stuck = false;
        launched = true;
      }
      if (launched) A.sfx.launch();
    }

    targetSpeed() {
      const base = NB.LEVELS[this.level].speed;
      const ramp = 1 + Math.min(this.paddleHits * 0.016, 0.42);
      return base * ramp * (this.fx.slow > 0 ? 0.6 : 1);
    }

    comboMult() { return 1 + Math.floor(this.combo / 5); }

    addScore(pts, x, y, hue) {
      const total = pts * this.comboMult();
      this.score += total;
      this.scorePop = 1;
      if (x !== undefined) P.spawnText(x, y, '+' + U.fmt(total), { hue: hue ?? 55 });
      if (this.score > STORE.high && !this.newRecord && STORE.high > 0) {
        this.newRecord = true;
        P.spawnText(C.W / 2, 300, 'NEUER REKORD!', { hue: 55, big: true, dur: 1.6 });
      }
    }

    checkHighscore() {
      if (this.score > STORE.high) {
        STORE.high = this.score;
        this.newRecord = true;
      }
    }

    // ---- Steine ---------------------------------------------------------

    gridAt(x, y) {
      const gx = Math.floor((x - C.BRICK_MARGIN) / (C.BRICK_W + C.BRICK_GAP));
      const gy = Math.floor((y - C.BRICK_TOP) / (C.BRICK_H + C.BRICK_GAP));
      if (gy < 0 || gy >= this.grid.length || gx < 0 || gx >= C.COLS) return null;
      return this.grid[gy][gx];
    }

    damageBrick(brick, amount, cause) {
      if (!brick.alive) return;
      if (brick.kind === 'steel') {
        brick.flash = 0.6;
        return;
      }
      brick.hp -= amount;
      brick.flash = 1;
      if (brick.hp > 0) {
        A.sfx.tough();
        const c = brick.center();
        P.spawnSparks(c.x, c.y, brick.hue, 6, 160);
        return;
      }
      this.destroyBrick(brick, cause);
    }

    destroyBrick(brick, cause) {
      if (!brick.alive) return;
      brick.alive = false;
      this.grid[brick.gy][brick.gx] = null;
      this.destructibleCount--;
      this.bricksDestroyed++;
      const c = brick.center();

      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      if (this.combo >= 5 && this.combo % 5 === 0) {
        P.spawnText(c.x, c.y - 34, `COMBO ×${this.comboMult()}`, { hue: 320, big: true, dur: 1.1 });
      }
      A.music.setIntensity(Math.min(0.35 + this.combo * 0.06, 1));

      const hue = brick.type === 'E' ? 25 : brick.hue;
      this.addScore(brick.points, c.x, c.y, hue);
      P.spawnShards(c.x, c.y, brick.w, brick.h, hue, 9);
      P.spawnSparks(c.x, c.y, hue, 12, 240);
      this.shake(0.16);

      if (brick.type === 'E') {
        this.expQueue.push({ t: 0.07, gx: brick.gx, gy: brick.gy });
      } else if (cause !== 'explosion') {
        A.sfx.brick(this.combo);
      }

      // Power-Up fallen lassen
      const chance = brick.type === 'M' ? 1
        : brick.kind === 'tough' ? 0.16
        : brick.kind === 'explosive' ? 0.1 : 0.08;
      if (Math.random() < chance && this.powerups.length < 4) {
        this.powerups.push(new NB.PowerUp(c.x, c.y, NB.PowerUp.randomType()));
      }

      if (this.destructibleCount <= 0) this.onLevelClear();
    }

    explode(gx, gy) {
      const cx = C.BRICK_MARGIN + gx * (C.BRICK_W + C.BRICK_GAP) + C.BRICK_W / 2;
      const cy = C.BRICK_TOP + gy * (C.BRICK_H + C.BRICK_GAP) + C.BRICK_H / 2;
      A.sfx.explosion();
      this.shake(0.55);
      this.hitStop = Math.max(this.hitStop, 0.05);
      this.flash('255,150,60', 0.16);
      P.spawnRing(cx, cy, 30, 130, 0.5);
      P.spawnSparks(cx, cy, 25, 34, 420);
      P.spawnSparks(cx, cy, 45, 16, 260);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const ny = gy + dy, nx = gx + dx;
          if (ny < 0 || ny >= this.grid.length || nx < 0 || nx >= C.COLS) continue;
          const b = this.grid[ny][nx];
          if (b && b.alive) this.damageBrick(b, 1, 'explosion');
        }
      }
    }

    onLevelClear() {
      this.slowmo = 1.0;
      this.lasers = [];
      this.powerups = [];
      this.setState('levelclear');
      const bonus = this.lives * 500;
      this.levelBonus = bonus;
      this.score += bonus;
      A.sfx.levelClear();
      this.checkHighscore();
      // Feuerwerk zeitversetzt
      for (let i = 0; i < 7; i++) {
        this.expQueue.push({
          t: 0.15 + i * 0.22,
          fw: true,
          x: U.rand(100, C.W - 100),
          y: U.rand(240, 640),
          hue: (this.bgHueTarget + i * 47) % 360,
        });
      }
    }

    // ---- Power-Ups ------------------------------------------------------

    applyPowerup(type) {
      const def = NB.POWERUPS[type];
      const px = this.paddle.x, py = this.paddle.y;
      A.sfx.powerup();
      P.spawnRing(px, py, def.hue, 90, 0.5);
      P.spawnText(px, py - 46, def.label, { hue: def.hue, dur: 1.2 });

      switch (type) {
        case 'multi': {
          const existing = this.balls.filter((b) => !b.stuck);
          const src = existing.length ? existing : this.balls.slice(0, 1);
          for (const b of src) {
            if (this.balls.length >= 12) break;
            for (const da of [-0.4, 0.4]) {
              if (this.balls.length >= 12) break;
              const nb = new NB.Ball(b.x, b.y);
              nb.stuck = false;
              if (b.stuck) {
                nb.y = this.paddle.y - this.paddle.h / 2 - C.BALL_R - 1;
                nb.setDir(da, this.targetSpeed());
              } else {
                const a = Math.atan2(b.vx, -b.vy) + da;
                nb.setDir(a, b.speed());
              }
              this.balls.push(nb);
            }
          }
          break;
        }
        case 'wide':
          this.fx.wide = def.dur;
          this.paddle.targetW = this.paddle.baseW * 1.55;
          break;
        case 'laser': this.fx.laser = def.dur; break;
        case 'fire': this.fx.fire = def.dur; break;
        case 'sticky': this.fx.sticky = def.dur; break;
        case 'slow': this.fx.slow = def.dur; break;
        case 'shield':
          this.fx.shield = Math.min(this.fx.shield + 1, 2);
          A.sfx.shield();
          break;
        case 'life':
          this.lives = Math.min(this.lives + 1, 6);
          P.spawnText(px, py - 80, '+1 LEBEN', { hue: 340, big: true, dur: 1.3 });
          break;
        default: break;
      }
    }

    // ---- Leben / Game Over ---------------------------------------------

    loseLife() {
      this.lives--;
      this.combo = 0;
      this.paddleHits = 0;
      this.fx = { wide: 0, laser: 0, fire: 0, sticky: 0, slow: 0, shield: this.fx.shield, laserCd: 0 };
      this.paddle.targetW = this.paddle.baseW;
      this.shake(0.7);
      this.flash('255,50,70', 0.25);
      A.sfx.lifeLost();
      A.music.setIntensity(0.2);
      if (this.lives < 0) {
        this.lasers = [];
        this.powerups = [];
        this.setState('gameover');
        this.checkHighscore();
        A.sfx.gameOver();
      } else {
        this.spawnStuckBall();
      }
    }

    // ---- Effekte --------------------------------------------------------

    shake(amount) { this.trauma = Math.min(1, this.trauma + amount); }
    flash(color, alpha) { this.flashColor = color; this.flashAlpha = Math.max(this.flashAlpha, alpha); }

    // ---- Haupt-Loop -----------------------------------------------------

    frame(now) {
      const rawDt = Math.min((now - this.last) / 1000, 0.05);
      this.last = now;
      this.time += rawDt;
      this.stateT += rawDt;

      // Zeitlupe / Hit-Stop
      let target = 1;
      if (this.slowmo > 0) { target = 0.3; this.slowmo -= rawDt; }
      if (this.hitStop > 0) { target = 0.05; this.hitStop -= rawDt; }
      this.timeScale = U.lerp(this.timeScale, target, 1 - Math.pow(0.0001, rawDt));
      const dt = rawDt * this.timeScale;

      // Reale (nicht skalierte) Updates
      this.trauma = Math.max(0, this.trauma - rawDt * 1.9);
      this.flashAlpha = Math.max(0, this.flashAlpha - rawDt * 1.4);
      this.shieldFlash = Math.max(0, this.shieldFlash - rawDt * 2.5);
      this.scorePop = Math.max(0, this.scorePop - rawDt * 3);
      if (this.banner) {
        this.banner.t += rawDt;
        if (this.banner.t > this.banner.dur) this.banner = null;
      }
      const diff = this.score - this.displayScore;
      if (diff > 0) this.displayScore = Math.min(this.score, this.displayScore + Math.max(2, diff * 8 * rawDt));
      this.bgHue += (this.bgHueTarget - this.bgHue) * Math.min(1, rawDt * 1.5);

      // Spiel-Updates
      if (this.state === 'playing') this.updatePlaying(dt, rawDt);
      else if (this.state === 'title') this.updateTitle(rawDt);
      else if (this.state === 'levelclear') this.updateLevelClear(dt, rawDt);

      P.update(this.state === 'paused' ? 0 : dt);

      this.render();
      requestAnimationFrame((t) => this.frame(t));
    }

    updateTitle(dt) {
      // Demo-Bälle hüpfen im Hintergrund
      for (const b of this.demoBalls) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < 30) { b.x = 30; b.vx = Math.abs(b.vx); }
        if (b.x > C.W - 30) { b.x = C.W - 30; b.vx = -Math.abs(b.vx); }
        if (b.y < 30) { b.y = 30; b.vy = Math.abs(b.vy); }
        if (b.y > C.H - 30) { b.y = C.H - 30; b.vy = -Math.abs(b.vy); }
        P.spawnTrail(b.x, b.y, b.hue, 7);
      }
    }

    updateLevelClear(dt, rawDt) {
      this.processQueue(rawDt);
      this.updateBalls(dt, true);
      this.paddle.update(dt);
      if (this.stateT > 2.6) this.nextLevel();
    }

    processQueue(dt) {
      for (let i = this.expQueue.length - 1; i >= 0; i--) {
        const q = this.expQueue[i];
        q.t -= dt;
        if (q.t <= 0) {
          this.expQueue.splice(i, 1);
          if (q.fw) {
            P.spawnFirework(q.x, q.y, q.hue);
            A.sfx.brick(U.randInt(2, 9));
          } else {
            this.explode(q.gx, q.gy);
          }
        }
      }
    }

    updatePlaying(dt, rawDt) {
      // Tastatur-Steuerung
      const left = this.keys.ArrowLeft || this.keys.KeyA;
      const right = this.keys.ArrowRight || this.keys.KeyD;
      if (left || right) {
        this.paddle.vx = U.clamp(this.paddle.vx + (right ? 1 : -1) * 5200 * dt, -980, 980);
        this.paddle.x += this.paddle.vx * dt;
      } else {
        this.paddle.vx *= Math.pow(0.0001, dt);
      }
      this.paddle.update(dt);

      // Power-Up-Timer
      for (const key of ['wide', 'laser', 'fire', 'sticky', 'slow']) {
        if (this.fx[key] > 0) {
          this.fx[key] -= rawDt;
          if (this.fx[key] <= 0) {
            this.fx[key] = 0;
            if (key === 'wide') this.paddle.targetW = this.paddle.baseW;
          }
        }
      }

      // Laser abfeuern
      if (this.fx.laser > 0) {
        this.fx.laserCd -= dt;
        if (this.fx.laserCd <= 0) {
          this.fx.laserCd = 0.27;
          const hw = this.paddle.w / 2 - 4;
          this.lasers.push(new NB.Laser(this.paddle.x - hw, this.paddle.y - 16));
          this.lasers.push(new NB.Laser(this.paddle.x + hw, this.paddle.y - 16));
          A.sfx.laser();
        }
      }

      // Physik in festen Schritten
      const STEP = 1 / 120;
      this.acc = (this.acc || 0) + dt;
      let steps = 0;
      while (this.acc >= STEP && steps < 10) {
        this.physicsStep(STEP);
        this.acc -= STEP;
        steps++;
      }

      // Einflug-Animation der Steine
      for (const b of this.bricks) {
        if (b.born < 1) b.born += rawDt;
        if (b.flash > 0) b.flash = Math.max(0, b.flash - rawDt * 4);
      }

      this.processQueue(dt);

      // Power-Ups fangen
      const padRect = {
        x: this.paddle.x - this.paddle.w / 2 - 6,
        y: this.paddle.y - this.paddle.h / 2 - 8,
        w: this.paddle.w + 12,
        h: this.paddle.h + 20,
      };
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const pu = this.powerups[i];
        pu.update(dt);
        if (!pu.alive) { this.powerups.splice(i, 1); continue; }
        if (pu.x > padRect.x - pu.w / 2 && pu.x < padRect.x + padRect.w + pu.w / 2 &&
            pu.y > padRect.y - pu.h / 2 && pu.y < padRect.y + padRect.h + pu.h / 2) {
          this.powerups.splice(i, 1);
          this.applyPowerup(pu.type);
        }
      }

      // Laser bewegen + Treffer
      for (let i = this.lasers.length - 1; i >= 0; i--) {
        const l = this.lasers[i];
        l.update(dt);
        if (!l.alive) { this.lasers.splice(i, 1); continue; }
        const brick = this.gridAt(l.x, l.y);
        if (brick && brick.alive) {
          P.spawnSparks(l.x, l.y + 4, brick.kind === 'steel' ? 210 : brick.hue, 6, 180, Math.PI, -Math.PI / 2);
          this.damageBrick(brick, 1, 'laser');
          this.lasers.splice(i, 1);
        }
      }

      // Musik beruhigt sich ohne Combo
      if (this.combo === 0) A.music.setIntensity(0.3);
    }

    physicsStep(dt) {
      this.updateBalls(dt, false);
    }

    updateBalls(dt, decorativeOnly) {
      const pad = this.paddle;
      const speed = this.targetSpeed();

      for (let i = this.balls.length - 1; i >= 0; i--) {
        const ball = this.balls[i];

        if (ball.stuck) {
          ball.x = pad.x + ball.stuckOffset;
          ball.y = pad.y - pad.h / 2 - ball.r - 1;
          continue;
        }

        // Geschwindigkeit sanft normalisieren
        const cur = ball.speed();
        if (cur > 1) {
          const f = speed / cur;
          ball.vx *= f; ball.vy *= f;
        }

        const px = ball.x, py = ball.y;
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // Durchgehender Trail (alle ~7 px ein Glow-Punkt)
        const moved = Math.hypot(ball.x - px, ball.y - py);
        ball.trailAcc += moved;
        if (ball.trailAcc > 7) {
          const n = Math.floor(ball.trailAcc / 7);
          ball.trailAcc -= n * 7;
          const hue = this.fx.fire > 0 ? 25 : 190;
          const size = this.fx.fire > 0 ? 9 : 6;
          for (let k = 1; k <= n; k++) {
            const f = k / n;
            P.spawnTrail(U.lerp(px, ball.x, f), U.lerp(py, ball.y, f), hue, size);
          }
        }

        // Wände
        if (ball.x - ball.r < C.WALL) {
          ball.x = C.WALL + ball.r;
          ball.vx = Math.abs(ball.vx);
          ball.squash = 1; ball.squashAngle = 0;
          A.sfx.wall();
          P.spawnSparks(C.WALL, ball.y, 190, 4, 130, 1.2, 0);
        } else if (ball.x + ball.r > C.W - C.WALL) {
          ball.x = C.W - C.WALL - ball.r;
          ball.vx = -Math.abs(ball.vx);
          ball.squash = 1; ball.squashAngle = 0;
          A.sfx.wall();
          P.spawnSparks(C.W - C.WALL, ball.y, 190, 4, 130, 1.2, Math.PI);
        }
        if (ball.y - ball.r < C.TOP) {
          ball.y = C.TOP + ball.r;
          ball.vy = Math.abs(ball.vy);
          ball.squash = 1; ball.squashAngle = Math.PI / 2;
          A.sfx.wall();
        }

        if (decorativeOnly) {
          // Im Level-Clear-Zustand nur noch hübsch abprallen
          if (ball.y + ball.r > C.H) { ball.y = C.H - ball.r; ball.vy = -Math.abs(ball.vy); }
          continue;
        }

        // Schild
        if (this.fx.shield > 0 && ball.vy > 0 && ball.y + ball.r >= C.SHIELD_Y) {
          this.fx.shield--;
          this.shieldFlash = 1;
          ball.y = C.SHIELD_Y - ball.r;
          ball.vy = -Math.abs(ball.vy);
          A.sfx.shield();
          P.spawnSparks(ball.x, C.SHIELD_Y, 160, 18, 300, Math.PI, -Math.PI / 2);
        }

        // Ball verloren
        if (ball.y - ball.r > C.H + 30) {
          this.balls.splice(i, 1);
          if (this.balls.length === 0) this.loseLife();
          continue;
        }

        // Paddle
        if (ball.vy > 0) {
          const hit = U.circleVsRect(
            ball.x, ball.y, ball.r,
            pad.x - pad.w / 2, pad.y - pad.h / 2, pad.w, pad.h
          );
          if (hit && ball.y < pad.y + pad.h) {
            const off = U.clamp((ball.x - pad.x) / (pad.w / 2), -1, 1);
            if (this.fx.sticky > 0) {
              ball.stuck = true;
              ball.stuckOffset = off * (pad.w / 2) * 0.9;
              A.sfx.sticky();
            } else {
              const angle = off * 1.1 + U.rand(-0.025, 0.025);
              ball.setDir(angle, speed);
              ball.y = pad.y - pad.h / 2 - ball.r - 0.5;
              A.sfx.paddle(off);
            }
            pad.squash = 1;
            this.paddleHits++;
            this.combo = 0;
            P.spawnSparks(ball.x, pad.y - pad.h / 2, 190, 5, 150, 1.4, -Math.PI / 2);
            continue;
          }
        }

        // Steine
        this.collideBallBricks(ball);

        // Nie ganz horizontal oder ganz vertikal fliegen lassen
        const sp = ball.speed();
        if (sp > 1 && Math.abs(ball.vy) < sp * 0.22) {
          const sign = ball.vy === 0 ? -1 : Math.sign(ball.vy);
          ball.vy = sign * sp * 0.25;
          const f = sp / ball.speed();
          ball.vx *= f; ball.vy *= f;
        } else if (sp > 1 && Math.abs(ball.vx) < sp * 0.045) {
          const sign = ball.vx === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(ball.vx);
          ball.vx = sign * sp * 0.06;
          const f = sp / ball.speed();
          ball.vx *= f; ball.vy *= f;
        }
      }
    }

    collideBallBricks(ball) {
      const cw = C.BRICK_W + C.BRICK_GAP, chh = C.BRICK_H + C.BRICK_GAP;
      const gx0 = Math.floor((ball.x - ball.r - C.BRICK_MARGIN) / cw);
      const gx1 = Math.floor((ball.x + ball.r - C.BRICK_MARGIN) / cw);
      const gy0 = Math.floor((ball.y - ball.r - C.BRICK_TOP) / chh);
      const gy1 = Math.floor((ball.y + ball.r - C.BRICK_TOP) / chh);

      let best = null, bestBrick = null;
      for (let gy = gy0; gy <= gy1; gy++) {
        if (gy < 0 || gy >= this.grid.length) continue;
        for (let gx = gx0; gx <= gx1; gx++) {
          if (gx < 0 || gx >= C.COLS) continue;
          const b = this.grid[gy][gx];
          if (!b || !b.alive || b.born < 0.2) continue;
          const hit = U.circleVsRect(ball.x, ball.y, ball.r, b.x, b.y, b.w, b.h);
          if (hit && (!best || hit.depth > best.depth)) {
            best = hit; bestBrick = b;
          }
        }
      }
      if (!bestBrick) return;

      const fire = this.fx.fire > 0;
      if (fire && bestBrick.destructible()) {
        // Feuerball durchschlägt alles Zerstörbare
        this.damageBrick(bestBrick, 99, 'fire');
        P.spawnSparks(ball.x, ball.y, 25, 8, 220);
      } else {
        ball.x += best.nx * best.depth;
        ball.y += best.ny * best.depth;
        ball.bounce(best.nx, best.ny);
        if (bestBrick.kind === 'steel') {
          A.sfx.steel();
          const c = bestBrick.center();
          P.spawnSparks(c.x, c.y, 210, 5, 150);
        }
        this.damageBrick(bestBrick, 1, 'ball');
      }
    }

    // =====================================================================
    //  RENDERING
    // =====================================================================

    render() {
      const ctx = this.ctx;
      const shakeAmt = (reducedMotion ? 0.25 : 1) * this.trauma * this.trauma * 22;
      const sx = U.rand(-1, 1) * shakeAmt;
      const sy = U.rand(-1, 1) * shakeAmt;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#05060e';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.setTransform(
        this.dpr * this.scale, 0, 0, this.dpr * this.scale,
        this.dpr * (this.offX + sx * this.scale),
        this.dpr * (this.offY + sy * this.scale)
      );

      // Spielfeld clippen
      ctx.save();
      ctx.beginPath();
      ctx.rect(-40, -40, C.W + 80, C.H + 80);
      ctx.clip();

      this.renderBackground(ctx);

      if (this.state === 'title' || this.state === 'help') {
        P.render(ctx);
        if (this.state === 'title') this.renderTitle(ctx);
        else this.renderHelp(ctx);
      } else {
        this.renderWalls(ctx);
        for (const b of this.bricks) b.render(ctx, this);
        for (const pu of this.powerups) pu.render(ctx, this);
        for (const l of this.lasers) l.render(ctx);
        if (this.fx.shield > 0 || this.shieldFlash > 0) this.renderShield(ctx);
        this.paddle.render(ctx, this);
        for (const ball of this.balls) ball.render(ctx, this);
        P.render(ctx);
        this.renderHUD(ctx);

        if (this.state === 'paused') this.renderPause(ctx);
        else if (this.state === 'gameover') this.renderGameOver(ctx);
        else if (this.state === 'win') this.renderWin(ctx);
        else if (this.state === 'levelclear') this.renderLevelClear(ctx);
      }

      if (this.banner) this.renderBanner(ctx);

      // Vollbild-Blitz
      if (this.flashAlpha > 0) {
        ctx.fillStyle = `rgba(${this.flashColor},${this.flashAlpha})`;
        ctx.fillRect(0, 0, C.W, C.H);
      }

      // Vignette
      const vig = ctx.createRadialGradient(C.W / 2, C.H / 2, C.H * 0.35, C.W / 2, C.H / 2, C.H * 0.75);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, this.lives === 0 && this.state === 'playing'
        ? `rgba(120,0,20,${0.4 + Math.sin(this.time * 4) * 0.12})`
        : 'rgba(0,0,10,0.42)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, C.W, C.H);

      ctx.restore();
    }

    renderBackground(ctx) {
      const hue = this.bgHue;
      // Grund-Verlauf
      const bg = ctx.createLinearGradient(0, 0, 0, C.H);
      bg.addColorStop(0, U.hsla(hue, 45, 8, 1));
      bg.addColorStop(0.5, U.hsla((hue + 40) % 360, 40, 6, 1));
      bg.addColorStop(1, U.hsla(hue, 50, 9, 1));
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, C.W, C.H);

      // Nebelschwaden
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const t = this.time;
      for (let i = 0; i < 3; i++) {
        const nx = C.W / 2 + Math.sin(t * 0.07 + i * 2.1) * 260;
        const ny = C.H * (0.25 + i * 0.28) + Math.cos(t * 0.09 + i) * 90;
        const nr = 260 + i * 60;
        const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr);
        g.addColorStop(0, U.hsla((hue + i * 50) % 360, 80, 30, 0.05));
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
      }
      ctx.restore();

      // Gitter
      ctx.strokeStyle = U.hsla(hue, 70, 55, 0.05);
      ctx.lineWidth = 1;
      ctx.beginPath();
      const off = (this.time * 12) % 60;
      for (let x = 0; x <= C.W; x += 60) {
        ctx.moveTo(x, 0); ctx.lineTo(x, C.H);
      }
      for (let y = -60 + off; y <= C.H; y += 60) {
        ctx.moveTo(0, y); ctx.lineTo(C.W, y);
      }
      ctx.stroke();

      // Sterne
      for (const s of this.stars) {
        s.y += s.z * 14 * (1 / 60);
        if (s.y > C.H) { s.y = -3; s.x = Math.random() * C.W; }
        const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(this.time * 2 + s.tw));
        ctx.fillStyle = U.hsla(hue, 30, 90, 0.25 * s.z * tw);
        const sz = s.z * 2.2;
        ctx.fillRect(s.x, s.y, sz, sz);
      }
    }

    renderWalls(ctx) {
      const hue = this.bgHue;
      ctx.save();
      ctx.shadowColor = U.hsla(hue, 100, 60, 0.8);
      ctx.shadowBlur = 14;
      ctx.fillStyle = U.hsla(hue, 80, 55, 0.9);
      ctx.fillRect(C.WALL - 4, C.TOP, 4, C.H - C.TOP);
      ctx.fillRect(C.W - C.WALL, C.TOP, 4, C.H - C.TOP);
      ctx.fillRect(C.WALL - 4, C.TOP - 4, C.W - 2 * C.WALL + 8, 4);
      ctx.restore();
    }

    renderShield(ctx) {
      const alpha = this.fx.shield > 0 ? 0.75 : this.shieldFlash * 0.9;
      const pulse = 0.7 + 0.3 * Math.sin(this.time * 6);
      ctx.save();
      ctx.shadowColor = U.hsla(160, 100, 60, alpha);
      ctx.shadowBlur = 18 * pulse;
      ctx.fillStyle = U.hsla(160, 95, 60, alpha * pulse);
      U.roundRect(ctx, C.WALL, C.SHIELD_Y, C.W - C.WALL * 2, 5, 3);
      ctx.fill();
      ctx.restore();
    }

    // ---- HUD ------------------------------------------------------------

    renderHUD(ctx) {
      this.uiButtons = this.state === 'playing' ? [] : this.uiButtons;
      ctx.save();
      ctx.textBaseline = 'middle';

      // Punkte
      ctx.textAlign = 'left';
      ctx.font = `600 15px ${FONT}`;
      ctx.fillStyle = 'rgba(160,180,220,0.75)';
      ctx.fillText('PUNKTE', 26, 34);
      const pop = 1 + this.scorePop * 0.12;
      ctx.save();
      ctx.translate(26, 66);
      ctx.scale(pop, pop);
      ctx.font = `800 34px ${FONT}`;
      ctx.shadowColor = 'rgba(120,220,255,0.7)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = '#eaf6ff';
      ctx.fillText(U.fmt(this.displayScore), 0, 0);
      ctx.restore();

      // Combo
      if (this.combo >= 3 && (this.state === 'playing' || this.state === 'levelclear')) {
        const mult = this.comboMult();
        const pulse = 1 + Math.sin(this.time * 8) * 0.05;
        ctx.save();
        ctx.translate(26, 98);
        ctx.scale(pulse, pulse);
        ctx.font = `800 20px ${FONT}`;
        ctx.shadowColor = 'rgba(255,80,200,0.9)';
        ctx.shadowBlur = 12;
        ctx.fillStyle = U.hsla(320, 100, 75, 1);
        ctx.fillText(`COMBO ×${mult}  (${this.combo})`, 0, 0);
        ctx.restore();
      }

      // Level (Mitte)
      const L = NB.LEVELS[this.level];
      ctx.textAlign = 'center';
      ctx.font = `600 15px ${FONT}`;
      ctx.fillStyle = 'rgba(160,180,220,0.75)';
      ctx.fillText(`LEVEL ${this.level + 1}/12`, C.W / 2, 34);
      ctx.font = `700 22px ${FONT}`;
      ctx.fillStyle = U.hsla(this.bgHue, 80, 78, 1);
      ctx.shadowColor = U.hsla(this.bgHue, 100, 60, 0.8);
      ctx.shadowBlur = 10;
      ctx.fillText(L.name, C.W / 2, 62);
      ctx.shadowBlur = 0;

      // Leben (rechts)
      ctx.textAlign = 'right';
      ctx.font = `600 15px ${FONT}`;
      ctx.fillStyle = 'rgba(160,180,220,0.75)';
      ctx.fillText('LEBEN', C.W - 82, 34);
      for (let i = 0; i < Math.max(0, this.lives); i++) {
        const x = C.W - 90 - i * 26;
        const g = ctx.createRadialGradient(x - 2, 60 - 2, 0, x, 60, 9);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.5, U.hsla(340, 90, 70, 1));
        g.addColorStop(1, U.hsla(340, 95, 52, 1));
        ctx.shadowColor = U.hsla(340, 100, 60, 0.9);
        ctx.shadowBlur = 10;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, 60, 8, 0, U.TAU);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Pause-Button
      this.drawIconButton(ctx, 'pause', C.W - 56, 26, 40, this.state === 'paused' ? 'play' : 'pause');

      // Aktive Power-Ups als Pillen
      let px = 26;
      for (const key of ['wide', 'laser', 'fire', 'sticky', 'slow']) {
        if (this.state !== 'playing') break;
        if (this.fx[key] <= 0) continue;
        const def = NB.POWERUPS[key];
        const frac = U.clamp(this.fx[key] / def.dur, 0, 1);
        const y = C.H - 30;
        ctx.fillStyle = U.hsla(def.hue, 80, 30, 0.5);
        U.roundRect(ctx, px, y - 12, 66, 24, 12);
        ctx.fill();
        ctx.fillStyle = U.hsla(def.hue, 95, 60, 0.85);
        U.roundRect(ctx, px, y - 12, 66 * frac, 24, 12);
        ctx.fill();
        ctx.font = `800 14px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText(`${def.letter} ${Math.ceil(this.fx[key])}s`, px + 33, y + 1);
        px += 76;
      }
      if (this.fx.shield > 0 && this.state === 'playing') {
        ctx.font = `800 14px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = U.hsla(160, 95, 65, 0.9);
        ctx.fillText(`S ×${this.fx.shield}`, px + 20, C.H - 29);
      }

      // Start-Hinweis
      const anyStuck = this.balls.some((b) => b.stuck);
      if (anyStuck && this.state === 'playing') {
        const a = 0.55 + 0.45 * Math.sin(this.time * 5);
        ctx.font = `700 21px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(200,225,255,${a})`;
        ctx.fillText('Klick oder Leertaste zum Start', C.W / 2, C.PADDLE_Y - 80);
        if (this.level === 0 && this.bricksDestroyed === 0) {
          ctx.font = `500 16px ${FONT}`;
          ctx.fillStyle = 'rgba(170,195,230,0.65)';
          ctx.fillText('Steuerung: Maus bewegen · Finger ziehen · Pfeiltasten', C.W / 2, C.PADDLE_Y - 50);
        }
      }
      ctx.restore();
    }

    // ---- UI-Helfer ------------------------------------------------------

    drawIconButton(ctx, id, x, y, size, icon) {
      const hover = this.hoverBtn === id;
      ctx.save();
      ctx.fillStyle = hover ? 'rgba(120,160,255,0.28)' : 'rgba(90,110,160,0.16)';
      U.roundRect(ctx, x, y, size, size, 10);
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,180,230,0.4)';
      ctx.lineWidth = 1.5;
      U.roundRect(ctx, x, y, size, size, 10);
      ctx.stroke();
      // Icons selbst zeichnen (fontunabhängig)
      ctx.fillStyle = '#dce8ff';
      const cx = x + size / 2, cy = y + size / 2;
      if (icon === 'pause') {
        ctx.fillRect(cx - 7, cy - 8, 5, 16);
        ctx.fillRect(cx + 2, cy - 8, 5, 16);
      } else if (icon === 'play') {
        ctx.beginPath();
        ctx.moveTo(cx - 5, cy - 9);
        ctx.lineTo(cx + 8, cy);
        ctx.lineTo(cx - 5, cy + 9);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      this.uiButtons.push({ id, x, y, w: size, h: size });
    }

    drawButton(ctx, id, cx, cy, w, h, label, primary) {
      const hover = this.hoverBtn === id;
      const x = cx - w / 2, y = cy - h / 2;
      const hue = primary ? 190 : 230;
      ctx.save();
      if (primary || hover) {
        ctx.shadowColor = U.hsla(hue, 100, 60, hover ? 0.9 : 0.6);
        ctx.shadowBlur = hover ? 24 : 14;
      }
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      if (primary) {
        g.addColorStop(0, U.hsla(hue, 90, hover ? 66 : 58, 0.95));
        g.addColorStop(1, U.hsla(hue, 95, hover ? 48 : 40, 0.95));
      } else {
        g.addColorStop(0, `rgba(70,90,140,${hover ? 0.85 : 0.55})`);
        g.addColorStop(1, `rgba(40,55,95,${hover ? 0.85 : 0.55})`);
      }
      ctx.fillStyle = g;
      U.roundRect(ctx, x, y, w, h, h / 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = primary ? 'rgba(220,250,255,0.85)' : 'rgba(150,180,230,0.5)';
      ctx.lineWidth = 1.6;
      U.roundRect(ctx, x, y, w, h, h / 2);
      ctx.stroke();
      ctx.font = `700 ${Math.round(h * 0.42)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = primary ? '#04101c' : '#dce8ff';
      ctx.fillText(label, cx, cy + 1);
      ctx.restore();
      this.uiButtons.push({ id, x, y, w, h });
    }

    dimOverlay(ctx, alpha = 0.65) {
      const a = Math.min(alpha, this.stateT * 3);
      ctx.fillStyle = `rgba(3,5,14,${a})`;
      ctx.fillRect(0, 0, C.W, C.H);
    }

    bigTitle(ctx, text, y, hue, size = 64) {
      const scale = U.easeOutBack(Math.min(1, this.stateT * 2.4));
      ctx.save();
      ctx.translate(C.W / 2, y);
      ctx.scale(scale, scale);
      ctx.font = `800 ${size}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = U.hsla(hue, 100, 60, 0.95);
      ctx.shadowBlur = 30;
      ctx.fillStyle = U.hsla(hue, 100, 82, 1);
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }

    // ---- Screens --------------------------------------------------------

    renderTitle(ctx) {
      this.uiButtons = [];
      const t = this.time;

      // Demo-Bälle im Hintergrund
      for (const b of this.demoBalls) {
        const g = ctx.createRadialGradient(b.x - 3, b.y - 3, 0, b.x, b.y, 11);
        g.addColorStop(0, '#fff');
        g.addColorStop(0.5, U.hsla(b.hue, 90, 75, 0.9));
        g.addColorStop(1, U.hsla(b.hue, 95, 55, 0.8));
        ctx.save();
        ctx.shadowColor = U.hsla(b.hue, 100, 60, 0.9);
        ctx.shadowBlur = 16;
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 10, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      }

      // Logo
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const bounce = Math.sin(t * 1.6) * 6;
      const hueShift = (t * 24) % 360;

      ctx.font = `800 108px ${FONT}`;
      ctx.shadowColor = U.hsla((190 + hueShift) % 360, 100, 60, 1);
      ctx.shadowBlur = 42;
      ctx.fillStyle = U.hsla((190 + hueShift) % 360, 100, 80, 1);
      ctx.fillText('NEON', C.W / 2, 250 + bounce);

      ctx.font = `800 86px ${FONT}`;
      ctx.shadowColor = U.hsla((320 + hueShift) % 360, 100, 60, 1);
      ctx.shadowBlur = 42;
      ctx.fillStyle = U.hsla((320 + hueShift) % 360, 100, 80, 1);
      ctx.fillText('BREAKER', C.W / 2, 352 + bounce);
      ctx.restore();

      // Untertitel
      ctx.font = `600 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(170,200,240,0.8)';
      ctx.fillText('12 Level · Power-Ups · Combos', C.W / 2, 428);

      // Buttons
      const maxLvl = STORE.maxLevel;
      let y = 560;
      this.drawButton(ctx, 'play', C.W / 2, y, 320, 74, '▶  Spielen', true);
      y += 100;
      if (maxLvl > 1 && maxLvl <= NB.LEVELS.length) {
        this.drawButton(ctx, 'continue', C.W / 2, y, 320, 64, `Fortsetzen · Level ${maxLvl}`, false);
        y += 90;
      }
      this.drawButton(ctx, 'help', C.W / 2, y, 320, 64, 'Anleitung', false);
      y += 90;
      this.drawButton(ctx, 'sfx', C.W / 2 - 85, y, 150, 56, `Sound ${A.sfxOn ? 'AN' : 'AUS'}`, false);
      this.drawButton(ctx, 'music', C.W / 2 + 85, y, 150, 56, `Musik ${A.musicOn ? 'AN' : 'AUS'}`, false);

      // Highscore
      if (STORE.high > 0) {
        ctx.font = `700 24px ${FONT}`;
        ctx.fillStyle = U.hsla(55, 100, 70, 0.95);
        ctx.shadowColor = U.hsla(55, 100, 60, 0.8);
        ctx.shadowBlur = 12;
        ctx.fillText(`★ Highscore: ${U.fmt(STORE.high)}`, C.W / 2, y + 90);
        ctx.shadowBlur = 0;
      }

      ctx.font = `500 15px ${FONT}`;
      ctx.fillStyle = 'rgba(140,160,200,0.55)';
      ctx.fillText('Erstellt mit Claude · HTML5 Canvas', C.W / 2, C.H - 36);
    }

    renderHelp(ctx) {
      this.uiButtons = [];
      this.dimOverlay(ctx, 0.5);
      this.bigTitle(ctx, 'Anleitung', 120, 190, 54);

      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      let y = 210;
      const line = (txt, opts = {}) => {
        ctx.font = `${opts.bold ? 700 : 500} ${opts.size || 19}px ${FONT}`;
        ctx.fillStyle = opts.color || 'rgba(210,225,250,0.92)';
        ctx.fillText(txt, opts.x || 60, y);
        y += opts.gap || 32;
      };

      line('Steuerung', { bold: true, size: 24, color: '#8fd8ff' });
      line('Maus bewegen oder Finger ziehen — Paddle steuern');
      line('Klick / Leertaste — Ball starten');
      line('Pfeiltasten oder A/D — Paddle per Tastatur');
      line('P oder Esc — Pause · M — Stumm');
      y += 14;

      line('Steine', { bold: true, size: 24, color: '#8fd8ff' });
      line('Bunte Steine: 1–3 Treffer · Stahl: unzerstörbar');
      line('Sprengsteine explodieren · ? lässt immer ein Extra fallen');
      y += 14;

      line('Power-Ups (mit dem Paddle fangen)', { bold: true, size: 24, color: '#8fd8ff' });
      const pu = Object.values(NB.POWERUPS);
      for (let i = 0; i < pu.length; i += 2) {
        const a = pu[i], b = pu[i + 1];
        ctx.font = `800 19px ${FONT}`;
        ctx.fillStyle = U.hsla(a.hue, 95, 68, 1);
        ctx.fillText(a.letter, 60, y);
        ctx.font = `500 19px ${FONT}`;
        ctx.fillStyle = 'rgba(210,225,250,0.92)';
        ctx.fillText(a.label, 92, y);
        if (b) {
          ctx.font = `800 19px ${FONT}`;
          ctx.fillStyle = U.hsla(b.hue, 95, 68, 1);
          ctx.fillText(b.letter, 380, y);
          ctx.font = `500 19px ${FONT}`;
          ctx.fillStyle = 'rgba(210,225,250,0.92)';
          ctx.fillText(b.label, 412, y);
        }
        y += 34;
      }
      y += 10;
      line('Combo: Steine ohne Paddle-Berührung treffen erhöht', {});
      line('den Multiplikator — bis ×8!', {});
      ctx.restore();

      this.drawButton(ctx, 'back', C.W / 2, C.H - 110, 280, 66, 'Zurück', true);
    }

    renderPause(ctx) {
      this.uiButtons = [];
      this.dimOverlay(ctx);
      this.bigTitle(ctx, 'PAUSE', 300, 190);
      this.drawButton(ctx, 'resume', C.W / 2, 460, 320, 70, '▶  Weiter', true);
      this.drawButton(ctx, 'restart', C.W / 2, 560, 320, 62, 'Neustart', false);
      this.drawButton(ctx, 'menu', C.W / 2, 650, 320, 62, 'Hauptmenü', false);
      this.drawButton(ctx, 'sfx', C.W / 2 - 85, 740, 150, 56, `Sound ${A.sfxOn ? 'AN' : 'AUS'}`, false);
      this.drawButton(ctx, 'music', C.W / 2 + 85, 740, 150, 56, `Musik ${A.musicOn ? 'AN' : 'AUS'}`, false);
    }

    renderLevelClear(ctx) {
      this.uiButtons = [];
      const a = Math.min(0.45, this.stateT * 2);
      ctx.fillStyle = `rgba(3,5,14,${a})`;
      ctx.fillRect(0, 0, C.W, C.H);
      this.bigTitle(ctx, 'LEVEL GESCHAFFT!', 420, 130, 56);
      if (this.stateT > 0.5) {
        ctx.font = `700 30px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = U.hsla(55, 100, 72, 1);
        ctx.shadowColor = U.hsla(55, 100, 60, 0.9);
        ctx.shadowBlur = 14;
        ctx.fillText(`Bonus: +${U.fmt(this.levelBonus || 0)}`, C.W / 2, 500);
        ctx.shadowBlur = 0;
      }
      if (this.stateT > 1.1) {
        ctx.font = `500 19px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(190,210,240,0.75)';
        ctx.fillText('Klick für nächstes Level …', C.W / 2, 560);
      }
    }

    renderGameOver(ctx) {
      this.uiButtons = [];
      this.dimOverlay(ctx, 0.72);
      this.bigTitle(ctx, 'GAME OVER', 320, 0, 72);

      ctx.textAlign = 'center';
      ctx.font = `700 32px ${FONT}`;
      ctx.fillStyle = '#eaf6ff';
      ctx.fillText(`Punkte: ${U.fmt(this.score)}`, C.W / 2, 430);
      if (this.newRecord) {
        const pulse = 1 + Math.sin(this.time * 6) * 0.06;
        ctx.save();
        ctx.translate(C.W / 2, 490);
        ctx.scale(pulse, pulse);
        ctx.font = `800 34px ${FONT}`;
        ctx.shadowColor = U.hsla(55, 100, 60, 1);
        ctx.shadowBlur = 20;
        ctx.fillStyle = U.hsla(55, 100, 72, 1);
        ctx.fillText('★ NEUER REKORD! ★', 0, 0);
        ctx.restore();
      } else if (STORE.high > 0) {
        ctx.font = `500 22px ${FONT}`;
        ctx.fillStyle = 'rgba(190,210,240,0.8)';
        ctx.fillText(`Highscore: ${U.fmt(STORE.high)}`, C.W / 2, 486);
      }
      ctx.font = `500 20px ${FONT}`;
      ctx.fillStyle = 'rgba(190,210,240,0.7)';
      ctx.fillText(`Level ${this.level + 1} erreicht · ${this.bricksDestroyed} Steine · Max-Combo ${this.maxCombo}`, C.W / 2, 540);

      this.drawButton(ctx, 'again', C.W / 2, 650, 320, 72, '⟳  Nochmal', true);
      this.drawButton(ctx, 'menu', C.W / 2, 750, 320, 62, 'Hauptmenü', false);
    }

    renderWin(ctx) {
      this.uiButtons = [];
      this.dimOverlay(ctx, 0.6);
      // Dauerkonfetti
      if (Math.random() < 0.12) {
        P.spawnFirework(U.rand(80, C.W - 80), U.rand(180, 600), U.rand(0, 360));
      }
      this.bigTitle(ctx, 'DU HAST', 300, 55, 60);
      this.bigTitle(ctx, 'GEWONNEN!', 380, 130, 72);

      ctx.textAlign = 'center';
      ctx.font = `700 30px ${FONT}`;
      ctx.fillStyle = '#eaf6ff';
      ctx.fillText(`Endstand: ${U.fmt(this.score)} Punkte`, C.W / 2, 500);
      if (this.newRecord) {
        ctx.font = `800 30px ${FONT}`;
        ctx.fillStyle = U.hsla(55, 100, 72, 1);
        ctx.shadowColor = U.hsla(55, 100, 60, 0.9);
        ctx.shadowBlur = 16;
        ctx.fillText('★ NEUER REKORD! ★', C.W / 2, 552);
        ctx.shadowBlur = 0;
      }
      ctx.font = `500 21px ${FONT}`;
      ctx.fillStyle = 'rgba(190,210,240,0.8)';
      ctx.fillText(`Alle 12 Level geschafft · Max-Combo ${this.maxCombo}`, C.W / 2, 600);

      this.drawButton(ctx, 'again', C.W / 2, 700, 320, 72, '⟳  Nochmal', true);
      this.drawButton(ctx, 'menu', C.W / 2, 800, 320, 62, 'Hauptmenü', false);
    }

    renderBanner(ctx) {
      const b = this.banner;
      const inT = Math.min(1, b.t * 3.2);
      const outT = U.clamp((b.dur - b.t) * 2.5, 0, 1);
      const alpha = Math.min(inT, outT);
      const slide = (1 - U.easeOutCubic(inT)) * -60;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(0, slide);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `800 64px ${FONT}`;
      ctx.shadowColor = U.hsla(this.bgHueTarget, 100, 60, 1);
      ctx.shadowBlur = 30;
      ctx.fillStyle = U.hsla(this.bgHueTarget, 100, 82, 1);
      ctx.fillText(b.title, C.W / 2, 460);
      ctx.font = `600 30px ${FONT}`;
      ctx.shadowBlur = 16;
      ctx.fillStyle = 'rgba(225,240,255,0.95)';
      ctx.fillText(b.sub, C.W / 2, 526);
      ctx.restore();
    }
  }

  // ---- Start ----------------------------------------------------------

  window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game');
    const game = new Game(canvas);

    // Kleine Debug-Schnittstelle (für automatische Tests)
    NB.debug = {
      game,
      state: () => game.state,
      skipLevel: () => {
        for (const b of game.bricks) {
          if (b.alive && b.destructible()) {
            b.alive = false;
            game.grid[b.gy][b.gx] = null;
            game.destructibleCount--;
          }
        }
        game.onLevelClear();
      },
      give: (type) => game.applyPowerup(type),
      setLevel: (i) => game.startLevel(i),
      launch: () => game.launchBalls(),
    };
  });
})();
