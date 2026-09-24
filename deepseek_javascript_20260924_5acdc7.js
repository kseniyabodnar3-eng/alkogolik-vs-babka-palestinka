// ========== АЛКОГОЛИК ПРОТИВ БАБКИ ПАЛЕСТИНКИ ==========
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const GROUND_Y = H - 60;

// ---------- Игровые переменные ----------
let speed, score, bestScore = Number(localStorage.getItem('babkaBest') || 0);
let obstacles, clouds, particles;
let gameState = 'menu'; // menu | playing | gameover
let spawnTimer, spawnInterval;
let lastTime = 0;

// ---------- Игрок (Бабуся) ----------
const babka = {
    x: 130,
    y: GROUND_Y,
    w: 44,
    h: 62,
    vy: 0,
    jumping: false,
    runFrame: 0,
    runTimer: 0
};

// ---------- Преследователь (Дедуся с дубинкой) ----------
const ded = {
    x: 20,
    y: GROUND_Y,
    w: 48,
    h: 66,
    runFrame: 0,
    runTimer: 0,
    bobPhase: 0
};

// ---------- Физика ----------
const GRAVITY = 0.9;
const JUMP_POWER = -16;

// ---------- Инициализация ----------
function resetGame() {
    speed = 5;
    score = 0;
    obstacles = [];
    particles = [];
    spawnTimer = 0;
    spawnInterval = 100 + Math.random() * 60;
    babka.y = GROUND_Y;
    babka.vy = 0;
    babka.jumping = false;
    ded.x = 20;
    clouds = [
        { x: 200, y: 60, s: 1 },
        { x: 500, y: 90, s: 0.8 },
        { x: 750, y: 50, s: 1.2 }
    ];
    updateUI();
}

function updateUI() {
    document.getElementById('score').textContent = 'Счёт: ' + Math.floor(score);
    document.getElementById('best').textContent = 'Рекорд: ' + Math.floor(bestScore);
}

// ---------- Препятствие: стог сена ----------
function spawnObstacle() {
    const size = 40 + Math.random() * 25;
    obstacles.push({
        x: W + 40,
        y: GROUND_Y - size + 20,
        w: size,
        h: size,
        passed: false
    });
}

// ---------- Частицы (пыль/искры) ----------
function spawnDust(x, y, n = 4, color = '#d9c08a') {
    for (let i = 0; i < n; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 3 - 2,
            vy: (Math.random() - 0.5) * 3,
            life: 30 + Math.random() * 20,
            maxLife: 50,
            color,
            size: 2 + Math.random() * 3
        });
    }
}

// ---------- Прыжок ----------
function jump() {
    if (gameState !== 'playing' || babka.jumping) return;
    babka.vy = JUMP_POWER;
    babka.jumping = true;
    spawnDust(babka.x + babka.w / 2, GROUND_Y, 6, '#e6d3a3');
}

// ---------- Управление ----------
document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        if (gameState === 'menu' || gameState === 'gameover') startGame();
        else jump();
    }
});

canvas.addEventListener('pointerdown', () => {
    if (gameState === 'playing') jump();
});

// ---------- Кнопки интерфейса ----------
document.getElementById('start-btn').addEventListener('click', startGame);
document.getElementById('restart-btn').addEventListener('click', startGame);

function startGame() {
    document.getElementById('start-screen').classList.add('hidden');
    document.getElementById('game-over').classList.add('hidden');
    resetGame();
    gameState = 'playing';
    ensureAudio();
    lastTime = performance.now();
}

function gameOver() {
    gameState = 'gameover';
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('babkaBest', Math.floor(bestScore));
    }
    document.getElementById('final-score').textContent = Math.floor(score);
    document.getElementById('game-over').classList.remove('hidden');
    updateUI();
    playGameOverSound();
}

// ========== ЛОГИКА ==========
function update(dt) {
    if (gameState !== 'playing') return;

    // Ускорение со временем
    speed = 5 + score / 40;
    score += dt * 0.02;

    // ---- Бабуся: гравитация ----
    babka.vy += GRAVITY;
    babka.y += babka.vy;
    if (babka.y >= GROUND_Y) {
        if (babka.jumping) spawnDust(babka.x + babka.w / 2, GROUND_Y, 4);
        babka.y = GROUND_Y;
        babka.vy = 0;
        babka.jumping = false;
    }

    // ---- Анимация бега ----
    babka.runTimer += dt;
    if (babka.runTimer > 100) {
        babka.runTimer = 0;
        babka.runFrame = (babka.runFrame + 1) % 4;
        if (!babka.jumping && Math.random() < 0.4)
            spawnDust(babka.x + 5, GROUND_Y, 1, '#c9b184');
    }

    ded.runTimer += dt;
    if (ded.runTimer > 90) {
        ded.runTimer = 0;
        ded.runFrame = (ded.runFrame + 1) % 4;
    }
    ded.bobPhase += dt * 0.01;

    // ---- Дедуся догоняет (эффект погони) ----
    // Чем больше счёт, тем ближе дед, но он всегда отстаёт немного
    const targetDedX = 10 + Math.min(60, score / 8);
    ded.x += (targetDedX - ded.x) * 0.02;

    // ---- Спавн препятствий ----
    spawnTimer += dt;
    if (spawnTimer > spawnInterval * (100 / speed) * 1.6) {
        spawnTimer = 0;
        spawnInterval = 80 + Math.random() * 100;
        spawnObstacle();
    }

    // ---- Движение препятствий ----
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const o = obstacles[i];
        o.x -= speed * (dt / 16);

        // Проверка столкновения
        if (
            babka.x + babka.w - 8 > o.x &&
            babka.x + 8 < o.x + o.w &&
            babka.y + babka.h > o.y &&
            babka.y < o.y + o.h
        ) {
            // Дедуся подбегает вплотную — проигрыш
            ded.x = babka.x - 30;
            spawnDust(o.x + o.w / 2, o.y, 12, '#f0c040');
            gameOver();
            return;
        }

        // Плюс за пройденное препятствие
        if (!o.passed && o.x + o.w < babka.x) {
            o.passed = true;
            score += 10;
            updateUI();
        }

        if (o.x + o.w < -50) obstacles.splice(i, 1);
    }

    // ---- Частицы ----
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life--;
        if (p.life <= 0) particles.splice(i, 1);
    }

    // ---- Облака ----
    for (const c of clouds) {
        c.x -= speed * 0.15 * (dt / 16);
        if (c.x < -100) { c.x = W + 100; c.y = 40 + Math.random() * 80; }
    }

    // ---- Дед почти поймал — при "0" препятствий он не догоняет, но давит психологически ----
    if (Math.random() < 0.02) spawnDust(ded.x + ded.w, GROUND_Y, 1, '#a08060');

    updateUI();
}

// ========== ОТРИСОВКА ==========
function draw() {
    // ---- Небо ----
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#ffb56b');
    grad.addColorStop(0.6, '#f9d89c');
    grad.addColorStop(1, '#e8c98a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // ---- Солнце ----
    ctx.fillStyle = 'rgba(255, 220, 120, 0.9)';
    ctx.beginPath();
    ctx.arc(W - 120, 90, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 240, 180, 0.5)';
    ctx.beginPath();
    ctx.arc(W - 120, 90, 65, 0, Math.PI * 2);
    ctx.fill();

    // ---- Облака ----
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const c of clouds) drawCloud(c.x, c.y, c.s);

    // ---- Дальние холмы ----
    ctx.fillStyle = '#9fb06b';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 10);
    for (let x = 0; x <= W; x += 50) {
        ctx.lineTo(x, GROUND_Y - 30 - Math.sin(x * 0.01) * 25);
    }
    ctx.lineTo(W, GROUND_Y + 10);
    ctx.closePath();
    ctx.fill();

    // ---- Земля ----
    ctx.fillStyle = '#7a5a2a';
    ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = '#5c431e';
    ctx.fillRect(0, GROUND_Y, W, 8);
    // Травинки
    ctx.strokeStyle = '#8b6f3a';
    ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 18) {
        const off = (x + performance.now() * 0.05) % W;
        ctx.beginPath();
        ctx.moveTo(off, GROUND_Y);
        ctx.lineTo(off + 3, GROUND_Y - 8);
        ctx.stroke();
    }

    // ---- Препятствия (стога сена) ----
    for (const o of obstacles) drawHaystack(o);

    // ---- Частицы ----
    for (const p of particles) {
        ctx.globalAlpha = p.life / p.maxLife;
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // ---- Дедуся (сзади бабуси, но при проигрыше поверх) ----
    drawDed(ded.x, ded.y, ded.w, ded.h, ded.runFrame);
    // ---- Бабуся ----
    drawBabka(babka.x, babka.y, babka.w, babka.h, babka.runFrame, babka.jumping);

    // ---- Падающие листья для атмосферы ----
    drawFallingLeaves();
}

let leaves = null;
function initLeaves() {
    leaves = [];
    for (let i = 0; i < 20; i++) {
        leaves.push({
            x: Math.random() * W,
            y: Math.random() * H,
            s: 2 + Math.random() * 3,
            vy: 0.3 + Math.random() * 0.7,
            vx: -0.5 - Math.random() * 1.5,
            rot: Math.random() * Math.PI * 2
        });
    }
}
function drawFallingLeaves() {
    if (!leaves) initLeaves();
    ctx.fillStyle = 'rgba(200, 120, 40, 0.7)';
    for (const l of leaves) {
        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.rotate(l.rot);
        ctx.fillRect(-l.s, -l.s / 2, l.s * 2, l.s);
        ctx.restore();
        l.x += l.vx;
        l.y += l.vy;
        l.rot += 0.02;
        if (l.y > H || l.x < -20) {
            l.x = W + 20;
            l.y = -10;
        }
    }
}

function drawCloud(x, y, s) {
    ctx.beginPath();
    ctx.arc(x, y, 22 * s, 0, Math.PI * 2);
    ctx.arc(x + 25 * s, y + 5 * s, 18 * s, 0, Math.PI * 2);
    ctx.arc(x - 25 * s, y + 6 * s, 16 * s, 0, Math.PI * 2);
    ctx.arc(x + 10 * s, y - 12 * s, 16 * s, 0, Math.PI * 2);
    ctx.fill();
}

// ---------- Стог сена ----------
function drawHaystack(o) {
    const cx = o.x + o.w / 2;
    const baseY = o.y + o.h;

    // Тень
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(cx, baseY + 4, o.w * 0.6, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Стог (два треугольника)
    ctx.fillStyle = '#d9a441';
    ctx.beginPath();
    ctx.moveTo(o.x - 5, baseY);
    ctx.lineTo(cx, o.y - 8);
    ctx.lineTo(o.x + o.w + 5, baseY);
    ctx.closePath();
    ctx.fill();

    // Соломинки
    ctx.strokeStyle = '#b8862f';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 8; i++) {
        const px = o.x + (o.w / 8) * i + 2;
        ctx.beginPath();
        ctx.moveTo(px, baseY - 4);
        ctx.lineTo(cx + (Math.random() - 0.5) * o.w * 0.5, o.y + Math.random() * o.h * 0.6);
        ctx.stroke();
    }

    // Обвязка верёвкой
    ctx.strokeStyle = '#6b4a1e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(o.x - 2, baseY - o.h * 0.35);
    ctx.lineTo(o.x + o.w + 2, baseY - o.h * 0.35);
    ctx.stroke();
}

// ---------- Бабуся ----------
function drawBabka(x, y, w, h, frame, jumping) {
    ctx.save();
    ctx.translate(x + w / 2, y + h);
    const s = 1;

    // Тень
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 4, w * 0.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Платок (красный) — рисуем как основу головы
    // Тело — сарафан
    ctx.fillStyle = '#8b1a1a';
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2 + 6, -h + 20);
    ctx.lineTo(w / 2 - 6, -h + 20);
    ctx.lineTo(w / 2, 0);
    ctx.closePath();
    ctx.fill();

    // Фартук
    ctx.fillStyle = '#f5e6c8';
    ctx.fillRect(-w / 4, -h + 30, w / 2, h - 30);

    // Ноги
    const legSwing = jumping ? 0.5 : Math.sin(frame * Math.PI / 2) * 0.6;
    ctx.strokeStyle = '#3a2a1a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-6 + legSwing * 8, 8);
    ctx.moveTo(6, 0);
    ctx.lineTo(6 - legSwing * 8, 8);
    ctx.stroke();

    // Руки
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 8, -h + 26);
    ctx.lineTo(-w / 2 - 4, -h + 42 + legSwing * 5);
    ctx.moveTo(w / 2 - 8, -h + 26);
    ctx.lineTo(w / 2 + 4, -h + 42 - legSwing * 5);
    ctx.stroke();

    // Голова
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(0, -h + 4, 14, 0, Math.PI * 2);
    ctx.fill();

    // Платок
    ctx.fillStyle = '#c0392b';
    ctx.beginPath();
    ctx.moveTo(-14, -h + 4);
    ctx.quadraticCurveTo(0, -h - 22, 14, -h + 4);
    ctx.quadraticCurveTo(14, -h + 16, 0, -h + 14);
    ctx.quadraticCurveTo(-14, -h + 16, -14, -h + 4);
    ctx.closePath();
    ctx.fill();

    // Узел платка
    ctx.fillStyle = '#a02820';
    ctx.beginPath();
    ctx.arc(0, -h + 16, 3, 0, Math.PI * 2);
    ctx.fill();

    // Глаза
    ctx.fillStyle = '#000';
    ctx.fillRect(-6, -h + 2, 3, 3);
    ctx.fillRect(3, -h + 2, 3, 3);

    // Рот (испуганный)
    ctx.beginPath();
    ctx.arc(0, -h + 9, 3, 0, Math.PI);
    ctx.stroke();

    // Щёчки
    ctx.fillStyle = 'rgba(230,100,100,0.5)';
    ctx.beginPath();
    ctx.arc(-9, -h + 6, 3, 0, Math.PI * 2);
    ctx.arc(9, -h + 6, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ---------- Дедуся с дубинкой ----------
function drawDed(x, y, w, h, frame) {
    ctx.save();
    ctx.translate(x + w / 2, y + h);

    // Тень
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(0, 4, w * 0.5, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Злобное дыхание
    const bob = Math.sin(frame * Math.PI / 2) * 2;

    // Рубаха (косоворотка)
    ctx.fillStyle = '#4a6b8a';
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(-w / 2 + 6, -h + 20 + bob);
    ctx.lineTo(w / 2 - 6, -h + 20 + bob);
    ctx.lineTo(w / 2, 0);
    ctx.closePath();
    ctx.fill();

    // Штаны
    ctx.fillStyle = '#2c2c2c';
    ctx.fillRect(-w / 2 + 4, -h + 40, w - 8, h - 40);

    // Ноги
    const legSwing = Math.sin(frame * Math.PI / 2) * 0.8;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-8 + legSwing * 10, 8);
    ctx.moveTo(8, 0);
    ctx.lineTo(8 - legSwing * 10, 8);
    ctx.stroke();

    // Лапти
    ctx.fillStyle = '#8b6f3a';
    ctx.beginPath();
    ctx.ellipse(-8 + legSwing * 10, 9, 8, 4, 0, 0, Math.PI * 2);
    ctx.ellipse(8 - legSwing * 10, 9, 8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Руки
    ctx.strokeStyle = '#f2c9a0';
    ctx.lineWidth = 5;

    // Левая рука
    ctx.beginPath();
    ctx.moveTo(-w / 2 + 8, -h + 26 + bob);
    ctx.lineTo(-w / 2 - 6, -h + 40 - legSwing * 6);
    ctx.stroke();

    // Правая рука с дубинкой
    ctx.beginPath();
    ctx.moveTo(w / 2 - 8, -h + 26 + bob);
    ctx.lineTo(w / 2 + 12, -h + 34 - legSwing * 8);
    ctx.stroke();

    // ДУБИНКА
    const clubX = w / 2 + 12;
    const clubY = -h + 34 - legSwing * 8;
    ctx.save();
    ctx.translate(clubX, clubY);
    ctx.rotate(-0.4 - legSwing * 0.15);
    // палка
    ctx.strokeStyle = '#5c3a1a';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -22);
    ctx.stroke();
    // утолщение
    ctx.fillStyle = '#3f2710';
    ctx.beginPath();
    ctx.ellipse(0, -24, 6, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    // гвозди
    ctx.fillStyle = '#aaa';
    ctx.beginPath();
    ctx.arc(-4, -24, 1.5, 0, Math.PI * 2);
    ctx.arc(4, -26, 1.5, 0, Math.PI * 2);
    ctx.arc(0, -18, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Голова
    ctx.fillStyle = '#f2c9a0';
    ctx.beginPath();
    ctx.arc(0, -h + 6 + bob, 13, 0, Math.PI * 2);
    ctx.fill();

    // Седая шевелюра + борода
    ctx.fillStyle = '#e8e8e8';
    ctx.beginPath();
    ctx.arc(0, -h + 0 + bob, 13, Math.PI, 0);
    ctx.fill();
    // Борода
    ctx.beginPath();
    ctx.arc(0, -h + 12 + bob, 8, 0, Math.PI);
    ctx.fill();

    // Злые глаза
    ctx.fillStyle = '#000';
    ctx.fillRect(-6, -h + 3 + bob, 4, 3);
    ctx.fillRect(2, -h + 3 + bob, 4, 3);
    // Брови нахмуренные
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -h - 1 + bob);
    ctx.lineTo(-2, -h + 1 + bob);
    ctx.moveTo(8, -h - 1 + bob);
    ctx.lineTo(2, -h + 1 + bob);
    ctx.stroke();

    // Открытый рот (кричит)
    ctx.fillStyle = '#5a1010';
    ctx.beginPath();
    ctx.ellipse(0, -h + 11 + bob, 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ========== ЗВУК (Web Audio API — напряжённая русско-народная музыка) ==========
let audioCtx = null;
let musicTimer = null;
let musicPlaying = false;

function ensureAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
}

// Русская народная «тревожная» мелодия — минорная, быстрая, с балалаечным характером
// Ноты в полутонах от A3 (220 Гц)
function noteFreq(semitones) {
    return 220 * Math.pow(2, semitones / 12);
}

// Мелодия: напряжённая, в стиле "Калинка" наоборот — тревожная погоня
const MELODY = [
    // такт 1
    [0, 0.15], [3, 0.15], [5, 0.15], [7, 0.15],
    // такт 2
    [5, 0.15], [3, 0.15], [2, 0.3],
    // такт 3
    [0, 0.15], [3, 0.15], [7, 0.15], [10, 0.15],
    // такт 4
    [7, 0.15], [5, 0.15], [3, 0.3],
    // такт 5 — нарастание
    [12, 0.15], [10, 0.15], [8, 0.15], [7, 0.15],
    // такт 6
    [5, 0.15], [3, 0.15], [0, 0.3],
    // такт 7
    [-2, 0.15], [0, 0.15], [3, 0.15], [5, 0.15],
    // такт 8
    [3, 0.15], [0, 0.15], [-2, 0.3],
];

let melodyIndex = 0;
let bassIndex = 0;

function playNote(freq, duration, type = 'triangle', gainVal = 0.08) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(gainVal, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.05);
}

// Басовая линия — тревожный пульс
function playBass() {
    if (!audioCtx) return;
    const freqs = [55, 55, 58, 62, 55, 55, 49, 52];
    playNote(freqs[bassIndex % freqs.length], 0.25, 'sawtooth', 0.05);
    bassIndex++;
}

// Перкуссия — стук (барабан)
function playDrum() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
}

function musicLoop() {
    if (!musicPlaying) return;
    const [semi, dur] = MELODY[melodyIndex % MELODY.length];
    playNote(noteFreq(semi), dur * 0.9, 'triangle', 0.09);

    if (melodyIndex % 2 === 0) playBass();
    if (melodyIndex % 4 === 0 || melodyIndex % 4 === 2) playDrum();

    melodyIndex++;
    musicTimer = setTimeout(musicLoop, dur * 1000);
}

function startMusic() {
    if (!audioCtx) return;
    if (musicPlaying) return;
    musicPlaying = true;
    musicLoop();
}

function stopMusic() {
    musicPlaying = false;
    if (musicTimer) clearTimeout(musicTimer);
}

function playGameOverSound() {
    if (!audioCtx) return;
    // Нисходящий "трагический" аккорд
    [0, -3, -7, -12].forEach((semi, i) => {
        setTimeout(() => playNote(noteFreq(semi), 0.5, 'sawtooth', 0.12), i * 120);
    });
    setTimeout(() => playDrum(), 100);
    setTimeout(() => playDrum(), 400);
}

function playJumpSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
}

// Кнопка музыки
document.getElementById('music-btn').addEventListener('click', () => {
    ensureAudio();
    if (musicPlaying) {
        stopMusic();
        document.getElementById('music-btn').textContent = '🔇';
    } else {
        startMusic();
        document.getElementById('music-btn').textContent = '🔊';
    }
});

// Обёртка прыжка со звуком
const _origJump = jump;
jump = function () {
    if (gameState === 'playing' && !babka.jumping) playJumpSound();
    _origJump();
};

// ========== ГЛАВНЫЙ ЦИКЛ ==========
function loop(now) {
    const dt = Math.min(50, now - lastTime);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
}

// ---------- Старт ----------
resetGame();
gameState = 'menu';
requestAnimationFrame(t => { lastTime = t; loop(t); });