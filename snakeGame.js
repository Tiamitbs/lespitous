/* global window, document, localStorage, requestAnimationFrame, cancelAnimationFrame */

/**
 * SnakeGame
 * - Vanilla JS, Canvas 2D, aucun module.
 * - Sprites supportés : head_[up|down|left|right], tail_[up|down|left|right],
 *   body_horizontal, body_vertical, body_[topleft|topright|bottomleft|bottomright], apple
 * - Contrôles clavier : flèches, WASD, ZQSD
 * - Contrôles tactiles : boutons #btnUp/#btnDown/#btnLeft/#btnRight
 *
 * API publique :
 *    const game = new SnakeGame(canvas, { gridSize: 20, assetsPath: 'images/snake/' });
 *    game.start(); game.pause(); game.reset();
 */
(function () {
  const LS_HIGHSCORE_KEY = 'snakeHighScoreV1';

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  // Directions cardinales normalisées
  const DIRS = {
    up:    { x: 0,  y: -1, name: 'up' },
    down:  { x: 0,  y: 1,  name: 'down' },
    left:  { x: -1, y: 0,  name: 'left' },
    right: { x: 1,  y: 0,  name: 'right' },
  };
  // Pour accès rapide via vecteur
  function dirFromDelta(dx, dy) {
    if (dx === 0 && dy === -1) return DIRS.up;
    if (dx === 0 && dy === 1)  return DIRS.down;
    if (dx === -1 && dy === 0) return DIRS.left;
    if (dx === 1 && dy === 0)  return DIRS.right;
    return null;
  }

  class SnakeGame {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {{
     *   gridSize?: number,
     *   initialSpeed?: number,     // cases par seconde
     *   speedStepEvery?: number,   // accélère toutes les N pommes
     *   maxSpeed?: number,
     *   assetsPath?: string        // ex: 'images/snake/'
     * }} opts
     */
    constructor(canvas, opts = {}) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });

      // Options
      this.gridSize = Math.max(8, opts.gridSize || 20);
      this.initialSpeed = clamp(opts.initialSpeed ?? 8, 4, 20);
      this.speedStepEvery = clamp(opts.speedStepEvery ?? 3, 1, 10);
      this.maxSpeed = clamp(opts.maxSpeed ?? 14, this.initialSpeed, 30);
      this.assetsPath = (opts.assetsPath || 'images/snake/').replace(/\\/g, '/');

      // UI (facultatif, sinon auto-lookup par ID)
      this.scoreEl = opts.scoreEl || document.getElementById('score');
      this.highScoreEl = opts.highScoreEl || document.getElementById('highScore');

      // État jeu
      this.resetState();

      // Images
      this.images = {};
      this.imagesReady = false;
      this._imagesPromise = this._loadImages([
        'apple.png',
        'body_horizontal.png',
        'body_vertical.png',
        'body_topleft.png',
        'body_topright.png',
        'body_bottomleft.png',
        'body_bottomright.png',
        'head_up.png', 'head_down.png', 'head_left.png', 'head_right.png',
        'tail_up.png', 'tail_down.png', 'tail_left.png', 'tail_right.png',
      ]);

      // Rendu net sur écrans HD
      this._resizeCanvasToDisplaySize();

      // Listeners
      this._onKeyDown = (e) => this._handleKeyDown(e);
      this._visibility = () => { if (document.hidden) this.pause(); };

      this._onResize = () => { this._resizeCanvasToDisplaySize(); this._draw(); };
      
      this._bindControls(true);

      // Contrôles tactiles (si présents)
      this._wireTouchButtons(true);

      // RAF
      this._raf = null;
      this._lastTs = 0;
      this._acc = 0;

      // High score
      const hs = Number(localStorage.getItem(LS_HIGHSCORE_KEY) || 0);
      this.highScore = isNaN(hs) ? 0 : hs;
      this._updateScoreUI();
    }

    resetState() {
      // Snake initial : 3 segments centrés allant vers la droite
      const mid = Math.floor(this.gridSize / 2);
      this.snake = [
        { x: mid - 1, y: mid },
        { x: mid - 2, y: mid },
        { x: mid - 3, y: mid },
      ];
      this.dir = DIRS.right;     // direction actuelle
      this.nextDir = DIRS.right; // direction choisie par le joueur (appliquée au tick)
      this.grow = 0;             // segments à ajouter
      this.score = 0;
      this.speed = this.initialSpeed;
      this.stepMs = 1000 / this.speed;
      this.gameOver = false;

      this.apple = this._randomApple();
    }

    async start() {
      await this._imagesPromise;
      this.imagesReady = true;

      if (this.gameOver) this.reset();
      this._lastTs = performance.now();
      this._acc = 0;
      this._loop();
    }

    pause() {
      if (this._raf) {
        cancelAnimationFrame(this._raf);
        this._raf = null;
      }
    }

    reset() {
      this.pause();
      this.resetState();
      this._resizeCanvasToDisplaySize();
      this._draw(); // montrer l'état initial
    }

    destroy() {
      this.pause();
      this._bindControls(false);
      this._wireTouchButtons(false);
    }

    // ---- Loop --------------------------------------------------------------

    _loop = (ts) => {
      this._raf = requestAnimationFrame(this._loop);
      if (ts == null) ts = performance.now();

      const dt = ts - this._lastTs;
      this._lastTs = ts;
      this._acc += dt;

      while (this._acc >= this.stepMs) {
        this._tick();
        this._acc -= this.stepMs;
      }
      this._draw();
    };

    _tick() {
      if (this.gameOver) return;

      // Applique la direction demandée si elle n’est pas un demi-tour
      if (!this._isReverse(this.dir, this.nextDir)) {
        this.dir = this.nextDir;
      }

      const head = this.snake[0];
      const nx = head.x + this.dir.x;
      const ny = head.y + this.dir.y;

      // Collisions murs
      if (nx < 0 || ny < 0 || nx >= this.gridSize || ny >= this.gridSize) {
        this._endGame();
        return;
      }
      // Collisions corps (sur la position cible)
      for (let i = 0; i < this.snake.length; i++) {
        if (this.snake[i].x === nx && this.snake[i].y === ny) {
          this._endGame();
          return;
        }
      }

      // Avance : ajoute nouvelle tête
      this.snake.unshift({ x: nx, y: ny });

      // Manger ?
      if (nx === this.apple.x && ny === this.apple.y) {
        this.score += 1;
        this._updateScoreUI();
        this._maybeSpeedUp();
        this.apple = this._randomApple();
        this.grow += 1; // on laisse la queue pour grandir
      }

      // Si pas de croissance, retirer queue
      if (this.grow > 0) {
        this.grow -= 1;
      } else {
        this.snake.pop();
      }
    }

    _endGame() {
      this.gameOver = true;
      this.pause();
      // High score
      if (this.score > this.highScore) {
        this.highScore = this.score;
        localStorage.setItem(LS_HIGHSCORE_KEY, String(this.highScore));
      }
      this._updateScoreUI();
      // Optionnel : petite vibration si supportée
      if (navigator.vibrate) { try { navigator.vibrate(80); } catch (_) {} }
    }

    _maybeSpeedUp() {
      if (this.score > 0 && this.score % this.speedStepEvery === 0) {
        const next = clamp(this.speed + 1, this.initialSpeed, this.maxSpeed);
        if (next !== this.speed) {
          this.speed = next;
          this.stepMs = 1000 / this.speed;
        }
      }
    }

    // ---- Rendu -------------------------------------------------------------

    _resizeCanvasToDisplaySize() {
      // Le canvas est rendu responsive via CSS (width 100%, aspect-ratio 1:1).
      // On ajuste la résolution interne pour un rendu net sur écrans haute densité.
      const dpr = window.devicePixelRatio || 1;
      const displaySize = Math.floor(this.canvas.clientWidth || this.canvas.width);
      const size = Math.max(100, displaySize);
      if (this.canvas.width !== size * dpr || this.canvas.height !== size * dpr) {
        this.canvas.width  = size * dpr;
        this.canvas.height = size * dpr;
      }
      this.cellPx = Math.floor((Math.min(this.canvas.width, this.canvas.height)) / this.gridSize);
      this.ctx.imageSmoothingEnabled = false;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // simplifie le texte si besoin
    }

    _draw() {
      const ctx = this.ctx;
      const sizePx = this.cellPx * this.gridSize;

      // Fond
      ctx.fillStyle = '#e8ffe1';
      ctx.fillRect(0, 0, sizePx, sizePx);

      if (!this.imagesReady) return;

      // Pomme
      this._drawImage('apple', this.apple.x, this.apple.y);

      // Serpent
      for (let i = 0; i < this.snake.length; i++) {
        const seg = this.snake[i];

        if (i === 0) {
          // HEAD : orientée par la direction actuelle
          this._drawImage('head_' + this.dir.name, seg.x, seg.y);
        } else if (i === this.snake.length - 1) {
          // TAIL : orientée en fonction du segment précédent
          const prev = this.snake[i - 1];
          const dx = seg.x - prev.x;
          const dy = seg.y - prev.y;
          const d = dirFromDelta(dx, dy);
          // Si seg (queue) est "après" prev, alors la queue pointe dans la
          // direction opposée au vecteur prev->seg : ex prev=(5,5), seg=(4,5) -> dx=-1 => queue_left
          // Ici on veut l’orientation "vers l’extérieur", donc :
          let tailDir = null;
          if (d === DIRS.left)  tailDir = 'left';
          if (d === DIRS.right) tailDir = 'right';
          if (d === DIRS.up)    tailDir = 'up';
          if (d === DIRS.down)  tailDir = 'down';
          this._drawImage('tail_' + tailDir, seg.x, seg.y);
        } else {
          // BODY : déterminer si segment droit ou coin
          const prev = this.snake[i - 1];
          const next = this.snake[i + 1];
          const dx1 = seg.x - prev.x;  // vecteur prev -> seg
          const dy1 = seg.y - prev.y;
          const dx2 = next.x - seg.x;  // vecteur seg -> next
          const dy2 = next.y - seg.y;

          // Droit horizontal
          if (dy1 === 0 && dy2 === 0) {
            this._drawImage('body_horizontal', seg.x, seg.y);
          }
          // Droit vertical
          else if (dx1 === 0 && dx2 === 0) {
            this._drawImage('body_vertical', seg.x, seg.y);
          }
          // Coin : déterminer lequel
          else {
            // On mappe selon l’entrée et la sortie.
            // Cas possibles pour former les 4 coins :
            //  - Entrée depuis haut (0,-1) et sortie vers droite (1,0)  => topright
            //  - Entrée depuis droite (1,0) et sortie vers haut (0,-1)  => topright
            //  - Entrée depuis haut et sortie vers gauche (-1,0)        => topleft
            //  - Entrée depuis gauche et sortie vers haut                => topleft
            //  - Entrée depuis bas (0,1) et sortie vers droite (1,0)    => bottomright
            //  - Entrée depuis droite et sortie vers bas                 => bottomright
            //  - Entrée depuis bas et sortie vers gauche (-1,0)         => bottomleft
            //  - Entrée depuis gauche et sortie vers bas                 => bottomleft
            const key = `${dx1},${dy1}|${dx2},${dy2}`;
            let corner = 'topright';
            if (
              (dx1 === 0 && dy1 === -1 && dx2 === 1 && dy2 === 0)
            ) corner = 'bottomright';
            else if (
              (dx1 === 1 && dy1 === 0 && dx2 === 0 && dy2 === -1)
            ) corner = 'topleft';
            else if (
              (dx1 === 0 && dy1 === -1 && dx2 === -1 && dy2 === 0)
            ) corner = 'bottomleft';
            else if (
              (dx1 === -1 && dy1 === 0 && dx2 === 0 && dy2 === -1)
            ) corner = 'topright';
            else if (
              (dx1 === 0 && dy1 === 1 && dx2 === 1 && dy2 === 0)
            ) corner = 'topright';
            else if (
              (dx1 === 1 && dy1 === 0 && dx2 === 0 && dy2 === 1)
            ) corner = 'bottomleft';
            else if (
              (dx1 === 0 && dy1 === 1 && dx2 === -1 && dy2 === 0)
            ) corner = 'topleft';
            else if (
              (dx1 === -1 && dy1 === 0 && dx2 === 0 && dy2 === 1)
            ) corner = 'bottomright';
            this._drawImage('body_' + corner, seg.x, seg.y);
          }
        }
      }

      if (this.gameOver) {
        this._drawGameOver();
      }
    }

    _drawGameOver() {
      const ctx = this.ctx;
      const sizePx = this.cellPx * this.gridSize;

      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, sizePx, sizePx);
      ctx.restore();

      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Game Over', sizePx / 2, sizePx / 2 - 16);
      ctx.font = '16px system-ui, sans-serif';
      ctx.fillText(`Score: ${this.score} — Record: ${this.highScore}`, sizePx / 2, sizePx / 2 + 12);
      ctx.restore();
    }

    _drawImage(name, gx, gy) {
      const img = this.images[name];
      if (!img) return;
      // on dessine en "cover" dans la cellule (les sprites sont carrés idéalement)
      const px = gx * this.cellPx;
      const py = gy * this.cellPx;
      this.ctx.drawImage(img, px, py, this.cellPx, this.cellPx);
    }

    // ---- Entrées -----------------------------------------------------------

    _handleKeyDown(e) {
      if (this.gameOver) return;

      const k = e.key;
      // normalise ZQSD/WASD/Arrows
      if (k === 'ArrowUp' || k === 'w' || k === 'W' || k === 'z' || k === 'Z') this._queueDir(DIRS.up);
      else if (k === 'ArrowDown' || k === 's' || k === 'S') this._queueDir(DIRS.down);
      else if (k === 'ArrowLeft' || k === 'a' || k === 'A' || k === 'q' || k === 'Q') this._queueDir(DIRS.left);
      else if (k === 'ArrowRight' || k === 'd' || k === 'D') this._queueDir(DIRS.right);
      else if (k === ' ' || k === 'Spacebar') {
        // Espace = pause / reprise
        if (this._raf) this.pause(); else this.start();
      } else {
        return;
      }
      e.preventDefault();
    }

    _queueDir(dir) {
      // Empêche demi-tour direct : tête droite → on ne peut pas aller gauche immédiatement
      if (this._isReverse(this.dir, dir)) return;
      // Empêche de pousser plusieurs changements contradictoires dans le même tick
      if (this._isReverse(this.nextDir, dir)) return;
      this.nextDir = dir;
    }

    _isReverse(a, b) {
      return a.x + b.x === 0 && a.y + b.y === 0;
    }

    _bindControls(on) {
      const method = on ? 'addEventListener' : 'removeEventListener';
      document[method]('keydown', this._onKeyDown, { passive: false });
      document[method]('visibilitychange', this._visibility);
      //window[method]('resize', () => this._resizeCanvasToDisplaySize());
      window[method]('resize', this._onResize);

    }

    refreshSize() {
      this._resizeCanvasToDisplaySize();
      this._draw();
    }

    _wireTouchButtons(on) {
      const up = document.getElementById('btnUp');
      const down = document.getElementById('btnDown');
      const left = document.getElementById('btnLeft');
      const right = document.getElementById('btnRight');
      const opts = { passive: true };

      const add = (el, fn) => {
        if (!el) return () => {};
        el.addEventListener('click', fn, opts);
        el.addEventListener('touchstart', fn, opts);
        return () => {
          el.removeEventListener('click', fn, opts);
          el.removeEventListener('touchstart', fn, opts);
        };
      };

      if (on) {
        this._unwireFns = [
          add(up,   () => this._queueDir(DIRS.up)),
          add(down, () => this._queueDir(DIRS.down)),
          add(left, () => this._queueDir(DIRS.left)),
          add(right,() => this._queueDir(DIRS.right)),
        ];
      } else if (this._unwireFns) {
        this._unwireFns.forEach((f) => f && f());
        this._unwireFns = null;
      }
    }

    // ---- Utilitaires -------------------------------------------------------

    _randomApple() {
      // Choisit une cellule libre
      const free = [];
      for (let y = 0; y < this.gridSize; y++) {
        for (let x = 0; x < this.gridSize; x++) {
          if (!this.snake.some(s => s.x === x && s.y === y)) {
            free.push({ x, y });
          }
        }
      }
      if (free.length === 0) return { x: 0, y: 0 };
      return free[(Math.random() * free.length) | 0];
    }

    async _loadImages(names) {
      const load = (name) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ name, img });
        img.onerror = reject;
        img.src = this.assetsPath + name;
      });
      const pairs = await Promise.all(names.map(load));
      pairs.forEach(({ name, img }) => {
        const key = name.replace('.png', '');
        this.images[key] = img;
      });
    }

    _updateScoreUI() {
      if (this.scoreEl) this.scoreEl.textContent = String(this.score);
      if (this.highScoreEl) this.highScoreEl.textContent = String(this.highScore);
    }
  }

  // Expose dans le global
  window.SnakeGame = SnakeGame;
})();
