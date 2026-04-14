/* ============================================================
   KILKARIYAN PLAYWAY SCHOOL — PHYSICS ENTRY APP
   Physics: Matter.js | Animations: GSAP | Rendering: Canvas
   ============================================================ */

(function () {
  'use strict';

  // ── MATTER.JS DESTRUCTURING ──────────────────────────────────
  const { Engine, Bodies, Body, World, Events, Mouse, MouseConstraint } = Matter;

  // ── CONFIGURATION ────────────────────────────────────────────
  const CFG = {
    BALL_R: 44,      // ball radius (px)
    GRAVITY: 2.0,     // downward gravity
    RESTITUTION: 0.72,    // bounciness (0–1)
    FRICTION: 0.06,
    FRICTION_AIR: 0.013,
    DENSITY: 0.002,
    HIT_THRESH: 7.8,     // speed threshold for "strong hit"
    HIT_THRESH_PREV: 3.5,  // previous frame speed must be below this
    HIT_COOLDOWN: 680,     // ms between registered hits
    MAX_HITS: 3,
    GROUND_H: 88,      // grass height from screen bottom (px)
    WALL_T: 60,      // wall/ceiling thickness
    CLICK_FX: 0.009,   // click force magnitude X
    CLICK_FY: -0.019,   // click force magnitude Y (up)
  };

  // ── STATE ──────────────────────────────────────────────────
  let canvas, ctx;
  let engine, world;
  let ballBody, groundBody, leftWall, rightWall, ceilBody;
  let mouseConstraint, mouse;
  let hitCount = 0;
  let hitCooldown = false;
  let lastSpeed = 0;
  let entryDone = false;
  let isMuted = false;
  let audioCtx = null;
  let isDragging = false;
  let dragHistory = [];
  let particles = [];
  let clouds = [];
  let sunAngle = 0;
  let ballGlow = { active: false, r: 0, alpha: 0 };

  // ── BOOT ───────────────────────────────────────────────────
  function boot() {
    canvas = document.getElementById('physicsCanvas');
    ctx = canvas.getContext('2d');

    resizeCanvas();
    buildWorld();
    spawnClouds();
    hookMouseInput();
    hookTouchInput();
    hookKeyboard();
    hookHitDetection();
    hookUI();
    gameLoop();

    window.addEventListener('resize', onResize);
  }

  // ── CANVAS RESIZE ─────────────────────────────────────────
  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function onResize() {
    resizeCanvas();
    // Rebuild static walls to fit new size
    World.remove(world, [groundBody, leftWall, rightWall, ceilBody]);
    buildStaticBodies();
    clampBall();
  }

  // ── PHYSICS WORLD ─────────────────────────────────────────
  function buildWorld() {
    engine = Engine.create();
    engine.gravity.y = CFG.GRAVITY;
    world = engine.world;
    buildStaticBodies();
    buildBall();
  }

  function buildStaticBodies() {
    const W = canvas.width, H = canvas.height;
    const T = CFG.WALL_T, GH = CFG.GROUND_H;

    groundBody = Bodies.rectangle(W / 2, H - GH + T / 2, W + T * 2, T, {
      isStatic: true, label: 'ground', friction: 0.3, restitution: 0.3,
    });
    leftWall = Bodies.rectangle(-T / 2, H / 2, T, H * 3, {
      isStatic: true, label: 'wall', friction: 0.1,
    });
    rightWall = Bodies.rectangle(W + T / 2, H / 2, T, H * 3, {
      isStatic: true, label: 'wall', friction: 0.1,
    });
    ceilBody = Bodies.rectangle(W / 2, -T / 2, W + T * 2, T, {
      isStatic: true, label: 'ceil', restitution: 0.5,
    });
    World.add(world, [groundBody, leftWall, rightWall, ceilBody]);
  }

  function buildBall() {
    const W = canvas.width, H = canvas.height;
    ballBody = Bodies.circle(W / 2, H / 3, CFG.BALL_R, {
      restitution: CFG.RESTITUTION,
      friction: CFG.FRICTION,
      frictionAir: CFG.FRICTION_AIR,
      density: CFG.DENSITY,
      label: 'ball',
    });
    World.add(world, ballBody);
  }

  function clampBall() {
    const W = canvas.width, H = canvas.height;
    const bp = ballBody.position, R = CFG.BALL_R;
    if (bp.x < R) Body.setPosition(ballBody, { x: R, y: bp.y });
    if (bp.x > W - R) Body.setPosition(ballBody, { x: W - R, y: bp.y });
    if (bp.y > H - CFG.GROUND_H - R) Body.setPosition(ballBody, { x: bp.x, y: H - CFG.GROUND_H - R });
  }

  // ── HIT DETECTION ─────────────────────────────────────────
  function hookHitDetection() {
    Events.on(engine, 'afterUpdate', () => {
      if (entryDone) return;
      const vel = ballBody.velocity;
      const speed = Math.sqrt(vel.x * vel.x + vel.y * vel.y);

      if (speed >= CFG.HIT_THRESH && lastSpeed < CFG.HIT_THRESH_PREV && !hitCooldown) {
        registerHit({ x: ballBody.position.x, y: ballBody.position.y });
      }
      lastSpeed = speed;
    });

    Events.on(engine, 'collisionStart', (ev) => {
      ev.pairs.forEach(pair => {
        const isBall = pair.bodyA.label === 'ball' || pair.bodyB.label === 'ball';
        if (isBall) {
          const spd = Math.sqrt(ballBody.velocity.x ** 2 + ballBody.velocity.y ** 2);
          if (spd > 3) playBounce(spd);
        }
      });
    });
  }

  function registerHit(pos) {
    hitCount = Math.min(hitCount + 1, CFG.MAX_HITS);
    hitCooldown = true;
    setTimeout(() => { hitCooldown = false; }, CFG.HIT_COOLDOWN);

    playHit();
    spawnParticles(pos.x, pos.y);
    updateHitUI(hitCount);
    monkeyReact(hitCount);

    if (hitCount >= CFG.MAX_HITS) {
      entryDone = true;
      ballGlow.active = true;
      setTimeout(beginTransition, 600);
    }
  }

  // ── HIT COUNTER UI ────────────────────────────────────────
  function updateHitUI(n) {
    const text = document.getElementById('hit-counter-text');
    if (text) text.textContent = `${n} / 3`;

    document.querySelectorAll('.hit-dot').forEach((d, i) => {
      if (i < n) d.classList.add('active');
    });

    if (window.gsap) {
      gsap.fromTo('#hit-ui', { scale: 0.87 }, { scale: 1, duration: 0.5, ease: 'back.out(2.5)' });
    }
  }

  // ── MONKEY REACTIONS ──────────────────────────────────────
  const SPEECH = ['🎉 Yay!', '👏 Nice hit!', '🐒 Woohoo!'];

  function monkeyReact(n) {
    const mc = document.getElementById('monkey-container');
    const ms = document.getElementById('monkey-speech');
    if (!mc) return;

    mc.className = 'monkey-hit';
    if (ms) {
      ms.textContent = SPEECH[n - 1] || '🎉 Yahoo!';
      ms.classList.remove('hidden');
    }

    setTimeout(() => {
      if (ms) ms.classList.add('hidden');
      mc.className = n >= CFG.MAX_HITS ? 'monkey-dance' : 'monkey-idle';
    }, 820);
  }

  // ── UI HOOKS ──────────────────────────────────────────────
  function hookUI() {
    const skipBtn = document.getElementById('skip-btn');
    if (skipBtn) {
      skipBtn.addEventListener('click', () => {
        if (entryDone) return;
        entryDone = true;
        hitCount = CFG.MAX_HITS;
        beginTransition();
      });
    }

    const muteBtn = document.getElementById('mute-btn');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        isMuted = !isMuted;
        muteBtn.textContent = isMuted ? '🔇' : '🔊';
      });
    }
  }

  // ── PARTICLES ─────────────────────────────────────────────
  const P_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6BB5', '#FF9500', '#BB86FC', '#00E5FF'];

  function spawnParticles(x, y) {
    const N = 20;
    for (let i = 0; i < N; i++) {
      const angle = (Math.PI * 2 / N) * i + (Math.random() - 0.5) * 0.7;
      const spd = 4 + Math.random() * 8;
      particles.push({
        x, y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd - 3,
        r: 4 + Math.random() * 5,
        color: P_COLORS[Math.floor(Math.random() * P_COLORS.length)],
        life: 1,
        grav: 0.15,
      });
    }
  }

  function tickParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.vy += p.grav;
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.98;
      p.life -= 0.024;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // ── CLOUDS ────────────────────────────────────────────────
  function spawnClouds() {
    const W = canvas.width;
    clouds = [
      { x: W * 0.12, y: 70, w: 120, h: 58, spd: 0.28, op: 0.88 },
      { x: W * 0.52, y: 115, w: 90, h: 44, spd: 0.18, op: 0.74 },
      { x: W * 0.78, y: 55, w: 135, h: 65, spd: 0.22, op: 0.82 },
      { x: -160, y: 140, w: 100, h: 50, spd: 0.32, op: 0.68 },
    ];
  }

  function drawCloud(c) {
    const { x, y, w, h, op } = c;
    const rx = w / 2, ry = h / 2;
    ctx.save();
    ctx.globalAlpha = op;
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(100,176,255,0.3)';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.ellipse(x - rx * 0.55, y + ry * 0.1, rx * 0.55, ry * 0.68, 0, 0, Math.PI * 2);
    ctx.ellipse(x + rx * 0.55, y + ry * 0.1, rx * 0.60, ry * 0.74, 0, 0, Math.PI * 2);
    ctx.ellipse(x + rx * 0.15, y - ry * 0.4, rx * 0.50, ry * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── SCENE RENDERING ───────────────────────────────────────
  function drawScene() {
    const W = canvas.width, H = canvas.height;
    const GH = CFG.GROUND_H;
    const skyH = H - GH;

    // ── SKY ──
    const skyG = ctx.createLinearGradient(0, 0, 0, skyH);
    skyG.addColorStop(0.0, '#0B3D91');
    skyG.addColorStop(0.35, '#1565C0');
    skyG.addColorStop(0.72, '#1E88E5');
    skyG.addColorStop(1.0, '#81D4FA');
    ctx.fillStyle = skyG;
    ctx.fillRect(0, 0, W, skyH);

    // ── CLOUDS ──
    clouds.forEach(c => {
      c.x += c.spd;
      if (c.x - c.w * 0.9 > W + 50) c.x = -c.w - 50;
      drawCloud(c);
    });

    // ── SUN ──
    drawSun(W * 0.87, skyH * 0.14);

    // ── BIRDS ──
    drawBirds(W, skyH);

    // ── GRASS ──
    const grassG = ctx.createLinearGradient(0, skyH, 0, H);
    grassG.addColorStop(0, '#5CC668');
    grassG.addColorStop(0.3, '#48B556');
    grassG.addColorStop(1, '#1B5E20');
    ctx.fillStyle = grassG;
    ctx.beginPath();
    ctx.moveTo(0, H);
    ctx.lineTo(0, skyH + 6);
    for (let tx = 0; tx <= W; tx += 32) {
      ctx.lineTo(tx, skyH - 5 + Math.sin(tx * 0.06) * 9);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();

    // Grass rim highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let tx = 0; tx <= W; tx += 32) {
      tx === 0
        ? ctx.moveTo(tx, skyH - 5 + Math.sin(tx * 0.06) * 9)
        : ctx.lineTo(tx, skyH - 5 + Math.sin(tx * 0.06) * 9);
    }
    ctx.stroke();

    // ── FLOWERS ──
    drawFlowers(W, skyH);

    // ── BALL SHADOW ──
    if (!entryDone || ballGlow.active) {
      const bx = ballBody.position.x;
      const by = ballBody.position.y;
      const dist = skyH - by - CFG.BALL_R;
      const sAlpha = Math.max(0, Math.min(0.32, (1 - dist / 360) * 0.32));
      const sScaleX = Math.max(0.25, 1 - dist / 620);
      if (sAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = sAlpha;
        const sg = ctx.createRadialGradient(bx, skyH - 8, 0, bx, skyH - 8, CFG.BALL_R * sScaleX * 1.3);
        sg.addColorStop(0, 'rgba(0,0,0,0.5)');
        sg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.ellipse(bx, skyH - 8, CFG.BALL_R * sScaleX * 1.3, CFG.BALL_R * sScaleX * 0.32, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // ── BALL ──
    if (!entryDone || ballGlow.active) {
      drawBall(ballBody.position.x, ballBody.position.y, ballBody.angle);
    }

    // ── BALL GLOW (after final hit) ──
    if (ballGlow.active) {
      ballGlow.r = Math.min(ballGlow.r + 4, 90);
      ballGlow.alpha = Math.sin((ballGlow.r / 90) * Math.PI) * 0.75;

      const bx = ballBody.position.x, by = ballBody.position.y;
      ctx.save();
      ctx.globalAlpha = ballGlow.alpha;
      const gg = ctx.createRadialGradient(bx, by, CFG.BALL_R, bx, by, ballGlow.r + CFG.BALL_R);
      gg.addColorStop(0, 'rgba(255,217,61,0.9)');
      gg.addColorStop(0.5, 'rgba(255,112,67,0.45)');
      gg.addColorStop(1, 'rgba(255,217,61,0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(bx, by, ballGlow.r + CFG.BALL_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      if (ballGlow.r >= 90) { ballGlow.r = 0; ballGlow.alpha = 0; }
    }

    // ── PARTICLES ──
    drawParticles();
  }

  // ── SUN ──
  function drawSun(x, y) {
    sunAngle += 0.003;
    const R = 38;

    // Rays
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sunAngle);
    ctx.strokeStyle = 'rgba(255,230,80,0.85)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 / 12) * i;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (R + 8), Math.sin(a) * (R + 8));
      ctx.lineTo(Math.cos(a) * (R + 22), Math.sin(a) * (R + 22));
      ctx.stroke();
    }
    ctx.restore();

    // Disc
    const sg = ctx.createRadialGradient(x - 9, y - 9, 0, x, y, R);
    sg.addColorStop(0, '#FFFDE7');
    sg.addColorStop(0.5, '#FFD93D');
    sg.addColorStop(1, '#F5A623');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.fill();

    // Face
    ctx.fillStyle = '#9a5800';
    ctx.beginPath(); ctx.arc(x - 11, y - 6, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 11, y - 6, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9a5800';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(x, y + 4, 10, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }

  // ── BIRDS (simple flying) ──
  let birdT = 0;
  const birds = [
    { ox: 0.18, oy: 0.18, phase: 0, spd: 0.0012 },
    { ox: 0.35, oy: 0.24, phase: 1.2, spd: 0.001 },
    { ox: 0.62, oy: 0.12, phase: 0.6, spd: 0.0014 },
  ];

  function drawBirds(W, skyH) {
    birdT += 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';

    birds.forEach(b => {
      const x = ((b.ox * W + birdT * b.spd * 1000) % (W + 120)) - 60;
      const y = skyH * b.oy + Math.sin(birdT * 0.04 + b.phase) * 12;
      const flap = Math.sin(birdT * 0.22 + b.phase) * 6;
      ctx.beginPath();
      ctx.moveTo(x - 10, y);
      ctx.quadraticCurveTo(x - 5, y - flap, x, y);
      ctx.quadraticCurveTo(x + 5, y - flap, x + 10, y);
      ctx.stroke();
    });
  }

  // ── FLOWERS ──
  const FLOWER_POSITIONS = [0.07, 0.18, 0.30, 0.44, 0.58, 0.70, 0.82, 0.92];
  const FLOWER_COLORS = ['#FF6BB5', '#FFD93D', '#FF6B6B', '#BB86FC', '#FF9500', '#6BCB77', '#4D96FF', '#FF8A65'];

  function drawFlowers(W, skyH) {
    FLOWER_POSITIONS.forEach((pct, i) => {
      const fx = W * pct;
      const fy = skyH + 14 + Math.sin(i * 1.5) * 7;
      const fc = FLOWER_COLORS[i % FLOWER_COLORS.length];

      // Stem
      ctx.strokeStyle = '#2E7D32';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(fx, fy);
      ctx.lineTo(fx, fy + 22);
      ctx.stroke();

      // Petals
      ctx.fillStyle = fc;
      for (let p = 0; p < 5; p++) {
        const pa = (Math.PI * 2 / 5) * p;
        ctx.beginPath();
        ctx.ellipse(fx + Math.cos(pa) * 7, fy + Math.sin(pa) * 7, 5, 4, pa, 0, Math.PI * 2);
        ctx.fill();
      }

      // Centre
      ctx.fillStyle = '#FFE82B';
      ctx.beginPath();
      ctx.arc(fx, fy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ── BALL RENDERING ──────────────────────────────────────
  function drawBall(x, y, angle) {
    const R = CFG.BALL_R;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Body
    const bg = ctx.createRadialGradient(-R * 0.22, -R * 0.28, R * 0.04, R * 0.08, R * 0.08, R * 1.08);
    bg.addColorStop(0, '#FF8A65');
    bg.addColorStop(0.44, '#FF5722');
    bg.addColorStop(0.86, '#E64A19');
    bg.addColorStop(1, '#BF360C');
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = bg;
    ctx.fill();

    // Soccer lines
    ctx.strokeStyle = 'rgba(0,0,0,0.16)';
    ctx.lineWidth = 1.8;
    const lines = [
      [0, -R * 0.9, 0, R * 0.9],
      [-R * 0.78, -R * 0.45, R * 0.78, R * 0.45],
      [-R * 0.78, R * 0.45, R * 0.78, -R * 0.45],
    ];
    lines.forEach(([x1, y1, x2, y2]) => {
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    });
    ctx.beginPath(); ctx.arc(0, 0, R * 0.24, 0, Math.PI * 2); ctx.stroke();

    // Shine
    const shine = ctx.createRadialGradient(-R * 0.3, -R * 0.36, 0, -R * 0.3, -R * 0.36, R * 0.52);
    shine.addColorStop(0, 'rgba(255,255,255,0.62)');
    shine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = shine;
    ctx.fill();

    // Sparkle
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(-R * 0.27, -R * 0.32, R * 0.09, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ── CINEMATIC TRANSITION ──────────────────────────────────
  function beginTransition() {
    // Freeze ball
    Body.setVelocity(ballBody, { x: 0, y: 0 });
    Body.setAngularVelocity(ballBody, 0);
    Body.setStatic(ballBody, true);

    const bx = ballBody.position.x;
    const by = ballBody.position.y;
    const W = canvas.width;
    const H = canvas.height;

    // Max distance from ball to any screen corner
    const maxDist = Math.max(
      Math.hypot(bx, by),
      Math.hypot(W - bx, by),
      Math.hypot(bx, H - by),
      Math.hypot(W - bx, H - by)
    );

    const SIZE = 20;
    const targetScale = (maxDist * 2.4) / SIZE;

    const overlay = document.getElementById('transition-overlay');
    overlay.style.display = 'block';
    overlay.style.left = `${bx - SIZE / 2}px`;
    overlay.style.top = `${by - SIZE / 2}px`;
    overlay.style.width = `${SIZE}px`;
    overlay.style.height = `${SIZE}px`;
    overlay.style.transform = 'scale(0)';

    gsap.to(overlay, {
      scale: targetScale,
      duration: 1.05,
      delay: 0.25,
      ease: 'power2.inOut',
      onComplete: showHomepage,
    });
  }

  function showHomepage() {
    const entry = document.getElementById('entry-screen');
    const homepage = document.getElementById('homepage');

    homepage.style.display = 'block';
    homepage.style.opacity = '0';

    gsap.to(homepage, {
      opacity: 1,
      duration: 0.72,
      ease: 'power1.inOut',
      onComplete: () => {
        entry.style.display = 'none';
        document.body.classList.add('hp-active');
        animateHeroIn();
      },
    });
  }

  function animateHeroIn() {
    const els = [
      '.kk-hero-badge',
      '.kk-hero-title',
      '.kk-hero-sub',
      '.kk-hero-desc',
      '.kk-hero-btns',
    ].map(s => document.querySelector(s)).filter(Boolean);

    gsap.fromTo(
      els,
      { opacity: 0, y: 44 },
      { opacity: 1, y: 0, duration: 0.72, stagger: 0.11, ease: 'power3.out', delay: 0.08 }
    );
  }

  // ── MOUSE INPUT ──────────────────────────────────────────
  function hookMouseInput() {
    mouse = Mouse.create(canvas);
    mouseConstraint = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.18, damping: 0.08, render: { visible: false } },
    });
    World.add(world, mouseConstraint);

    Events.on(mouseConstraint, 'startdrag', (e) => {
      if (e.body?.label === 'ball') {
        isDragging = true;
        dragHistory = [];
        initAudio();
      }
    });

    Events.on(mouseConstraint, 'mousemove', () => {
      if (isDragging) {
        dragHistory.push({ x: mouse.position.x, y: mouse.position.y, t: Date.now() });
        if (dragHistory.length > 8) dragHistory.shift();
      }
    });

    Events.on(mouseConstraint, 'enddrag', (e) => {
      if (e.body?.label === 'ball' && isDragging) {
        isDragging = false;
        applyFlick(dragHistory);
        dragHistory = [];
      }
    });

    Events.on(mouseConstraint, 'mouseup', () => {
      if (!isDragging) applyClick(mouse.position.x, mouse.position.y);
    });
  }

  // ── TOUCH INPUT ──────────────────────────────────────────
  function hookTouchInput() {
    let touchDragging = false;
    let th = [];

    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      th = [{ x: t.clientX, y: t.clientY, t: Date.now() }];
      touchDragging = false;
      initAudio();
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      th.push({ x: t.clientX, y: t.clientY, t: Date.now() });
      if (th.length > 8) th.shift();

      const dx = t.clientX - ballBody.position.x;
      const dy = t.clientY - ballBody.position.y;
      if (Math.sqrt(dx * dx + dy * dy) < CFG.BALL_R * 2.5) {
        touchDragging = true;
        Body.setPosition(ballBody, { x: t.clientX, y: t.clientY });
        Body.setVelocity(ballBody, { x: 0, y: 0 });
      }
    }, { passive: false });

    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      if (touchDragging && th.length >= 2) {
        applyFlick(th);
      } else if (th.length >= 1) {
        applyClick(th[0].x, th[0].y);
      }
      touchDragging = false;
      th = [];
    }, { passive: false });
  }

  // ── SHARED INPUT HELPERS ──────────────────────────────────
  function applyFlick(history) {
    if (!history || history.length < 2) return;
    const last = history[history.length - 1];
    const prev = history[Math.max(0, history.length - 4)];
    const dt = (last.t - prev.t) / 1000;
    if (dt <= 0 || dt > 0.32) return;

    let vx = (last.x - prev.x) / dt * 0.0034;
    let vy = (last.y - prev.y) / dt * 0.0034;
    const spd = Math.sqrt(vx * vx + vy * vy);
    const MAX = 24;
    if (spd > MAX) { vx = vx / spd * MAX; vy = vy / spd * MAX; }

    Body.setVelocity(ballBody, { x: vx, y: vy });
  }

  function applyClick(cx, cy) {
    if (entryDone) return;
    const { x: bx, y: by } = ballBody.position;
    const dx = bx - cx;
    const dy = by - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < CFG.BALL_R * 4.5) {
      const len = Math.max(dist, 1);
      Body.applyForce(ballBody, ballBody.position, {
        x: (dx / len) * CFG.CLICK_FX,
        y: (dy / len) * CFG.CLICK_FY - 0.008,
      });
      initAudio();
    }
  }

  // ── KEYBOARD ─────────────────────────────────────────────
  function hookKeyboard() {
    document.addEventListener('keydown', e => {
      if (entryDone) return;
      if (e.key === ' ' || e.key === 'ArrowUp') {
        e.preventDefault();
        Body.applyForce(ballBody, ballBody.position, {
          x: (Math.random() - 0.5) * 0.014,
          y: -0.026,
        });
        initAudio();
      }
    });
  }

  // ── WEB AUDIO ─────────────────────────────────────────────
  function initAudio() {
    if (!audioCtx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (AC) audioCtx = new AC();
      } catch (_) { }
    }
  }

  function playBounce(spd) {
    if (isMuted || !audioCtx) return;
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      osc.type = 'sine';
      const freq = Math.min(180 + spd * 18, 750);
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.32, audioCtx.currentTime + 0.18);
      gain.gain.setValueAtTime(Math.min(0.22, spd / 32), audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.22);
      osc.start(); osc.stop(audioCtx.currentTime + 0.22);
    } catch (_) { }
  }

  function playHit() {
    if (isMuted || !audioCtx) return;
    try {
      [660, 990, 1320].forEach((freq, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.type = 'triangle';
        const t = audioCtx.currentTime + i * 0.022;
        osc.frequency.setValueAtTime(freq, t);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.38, t + 0.38);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.start(t); osc.stop(t + 0.45);
      });
    } catch (_) { }
  }

  // ── GAME LOOP ─────────────────────────────────────────────
  function gameLoop() {
    Engine.update(engine, 1000 / 60);
    tickParticles();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawScene();
    requestAnimationFrame(gameLoop);
  }

  // ── START ─────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

})();
