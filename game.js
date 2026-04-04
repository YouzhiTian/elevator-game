// ============================================================
//  电梯调度员 v2.0 — 全面升级版
// ============================================================

// ====== AUDIO ENGINE (Web Audio API) ======
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioCtx();
}
function playTone(freq, dur, type, vol) {
  if (!audioCtx) return;
  const g = audioCtx.createGain();
  const o = audioCtx.createOscillator();
  o.type = type || 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime((vol || 0.08), audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(); o.stop(audioCtx.currentTime + dur);
}
function sfxDing() { playTone(880, 0.15, 'sine', 0.1); setTimeout(() => playTone(1100, 0.12, 'sine', 0.08), 80); }
function sfxPickup() { playTone(660, 0.08, 'triangle', 0.06); }
function sfxDeliver() { playTone(784, 0.1, 'sine', 0.1); setTimeout(() => playTone(1047, 0.15, 'sine', 0.08), 60); }
function sfxCombo() { playTone(1047, 0.08, 'square', 0.06); setTimeout(() => playTone(1319, 0.08, 'square', 0.06), 60); setTimeout(() => playTone(1568, 0.12, 'square', 0.05), 120); }
function sfxAngry() { playTone(220, 0.2, 'sawtooth', 0.06); }
function sfxClick() { playTone(440, 0.05, 'sine', 0.05); }
function sfxUpgrade() { playTone(523, 0.1, 'sine', 0.08); setTimeout(() => playTone(659, 0.1, 'sine', 0.08), 80); setTimeout(() => playTone(784, 0.15, 'sine', 0.08), 160); }

// ====== CONSTANTS ======
let FLOORS = 12;
const ELEV_COUNT = 3;
const HUD_H = 56;
const BAR_H = 50;
const ELEV_COLORS = ['#4fc3f7', '#81c784', '#ba68c8'];
const ELEV_NAMES = ['A', 'B', 'C'];

// Person appearance variety
const PERSON_TYPES = [
  { head: '#ffcc80', body: '#42a5f5', label: 'M' },  // businessman blue
  { head: '#ffcc80', body: '#ef5350', label: 'F' },  // woman red
  { head: '#ffcc80', body: '#66bb6a', label: 'M' },  // guy green
  { head: '#d7ccc8', body: '#78909c', label: 'F' },  // elder gray
  { head: '#ffcc80', body: '#ffa726', label: 'M' },  // casual orange
  { head: '#ffcc80', body: '#ab47bc', label: 'F' },  // woman purple
  { head: '#ffcc80', body: '#26c6da', label: 'M' },  // tech teal
  { head: '#ffe0b2', body: '#ec407a', label: 'F' },  // girl pink
];

const PERIODS = [
  { name: '早高峰 🌅', dur: 65, spawnRate: 0.4, type: 'morning', floors: 4, skyTop: '#1a2744', skyBot: '#ff8a65' },
  { name: '午间 🍜', dur: 65, spawnRate: 0.7, type: 'lunch', floors: 8, skyTop: '#42a5f5', skyBot: '#81d4fa' },
  { name: '晚高峰 🌙', dur: 70, spawnRate: 1.0, type: 'evening', floors: 12, skyTop: '#1a1a3e', skyBot: '#4a2060' },
];

// ====== CANVAS ======
const cvs = document.getElementById('cvs');
const ctx = cvs.getContext('2d');
let W, H, FLOOR_H, BUILD_X, BUILD_W, SHAFT_W, SHAFT_GAP, LOBBY_W;

function resize() {
  W = cvs.width = window.innerWidth;
  H = cvs.height = window.innerHeight;
  const drawH = H - HUD_H - BAR_H;
  FLOOR_H = drawH / FLOORS;
  SHAFT_W = Math.min(56, W * 0.08);
  SHAFT_GAP = Math.min(10, W * 0.015);
  LOBBY_W = Math.max(40, SHAFT_W * 1.5);
  BUILD_W = 30 + ELEV_COUNT * SHAFT_W + (ELEV_COUNT - 1) * SHAFT_GAP + 15 + LOBBY_W + 15;
  BUILD_X = (W - BUILD_W) / 2;
}
window.addEventListener('resize', resize);
resize();

// ====== GAME STATE ======
let elevators = [];
let waitingPeople = [];
let score = 0;
let satisfaction = 100;
let totalDelivered = 0;
let totalAngry = 0;
let selectedElev = 0;
let periodIdx = 0;
let periodTimer = 0;
let periodDurFrames = 0;
let spawnAcc = 0;
let gameActive = false;
let tick = 0;
let animFrame = null;
let satisAccum = 0;
let satisCount = 0;
let floatTexts = [];
let particles = [];
let combo = 0;
let comboTimer = 0;
let maxCombo = 0;
let hoveredFloor = -1;
let skyTransition = 0; // 0-1 for sky color lerp
let periodDelivered = 0;
let periodCombo = 0;

// Upgrade state
let elevSpeed = [2.8, 2.8, 2.8];
let elevCap = [6, 6, 6];
let upgrades = [];

// ====== HELPERS ======
function floorY(f) { return HUD_H + (FLOORS - f) * FLOOR_H; }

function shaftX(i) {
  return BUILD_X + 20 + i * (SHAFT_W + SHAFT_GAP);
}

function lobbyStartX() {
  return BUILD_X + 20 + ELEV_COUNT * SHAFT_W + (ELEV_COUNT - 1) * SHAFT_GAP + 15;
}

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

function lerp(a, b, t) { return a + (b - a) * t; }

function lerpColor(c1, c2, t) {
  // parse hex
  const r1 = parseInt(c1.slice(1,3),16), g1 = parseInt(c1.slice(3,5),16), b1 = parseInt(c1.slice(5,7),16);
  const r2 = parseInt(c2.slice(1,3),16), g2 = parseInt(c2.slice(3,5),16), b2 = parseInt(c2.slice(5,7),16);
  const r = Math.round(lerp(r1,r2,t)), g = Math.round(lerp(g1,g2,t)), b = Math.round(lerp(b1,b2,t));
  return `rgb(${r},${g},${b})`;
}

function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

// ====== INIT ======
function initGame() {
  selectedElev = 0; periodIdx = 0;
  FLOORS = PERIODS[0].floors;
  resize();
  elevators = [];
  for (let i = 0; i < ELEV_COUNT; i++) {
    elevators.push({
      floor: 1, y: floorY(1), targetFloor: 1,
      queue: [], passengers: [],
      moving: false, doorOpen: 0, doorAnim: 0,
      color: ELEV_COLORS[i], name: ELEV_NAMES[i],
      idx: i
    });
  }
  waitingPeople = [];
  score = 0; satisfaction = 100;
  totalDelivered = 0; totalAngry = 0;
  periodDurFrames = PERIODS[0].dur * 60;
  periodTimer = periodDurFrames;
  spawnAcc = 0; tick = 0;
  gameActive = true;
  floatTexts = []; particles = [];
  combo = 0; comboTimer = 0; maxCombo = 0;
  satisAccum = 0; satisCount = 0;
  skyTransition = 0;
  elevSpeed = [2.8, 2.8, 2.8];
  elevCap = [6, 6, 6];
  periodDelivered = 0; periodCombo = 0;
  updateHUD();
  document.getElementById('gameover-overlay').classList.remove('show');
  document.getElementById('upgrade-overlay').classList.remove('show');
}

// ====== SPAWN PEOPLE ======
function spawnPerson() {
  const period = PERIODS[periodIdx];
  let fromFloor, toFloor;

  if (period.type === 'morning') {
    fromFloor = Math.random() < 0.75 ? 1 : randInt(1, FLOORS);
    toFloor = randInt(2, FLOORS);
    if (fromFloor === toFloor) toFloor = fromFloor < FLOORS ? fromFloor + 1 : fromFloor - 1;
  } else if (period.type === 'lunch') {
    fromFloor = Math.random() < 0.7 ? randInt(2, FLOORS) : randInt(1, FLOORS);
    toFloor = Math.random() < 0.7 ? 1 : randInt(1, FLOORS);
    if (fromFloor === toFloor) toFloor = fromFloor > 1 ? 1 : 2;
  } else {
    fromFloor = Math.random() < 0.85 ? randInt(2, FLOORS) : randInt(1, FLOORS);
    toFloor = 1;
    if (fromFloor === 1) fromFloor = randInt(2, FLOORS);
  }

  const maxOnFloor = waitingPeople.filter(p => p.floor === fromFloor).length;
  if (maxOnFloor >= 3) return;

  const isVIP = Math.random() < 0.08;
  waitingPeople.push({
    floor: fromFloor, dest: toFloor,
    waitTime: 0, maxWait: isVIP ? 600 + Math.random()*300 : 900 + Math.random()*600,
    type: PERSON_TYPES[randInt(0, PERSON_TYPES.length - 1)],
    angry: false, leaving: false, leaveTimer: 0,
    bobOffset: Math.random() * Math.PI * 2,
    slot: maxOnFloor,
    vip: isVIP,
    enterAnim: 1.0 // 1 -> 0 for slide-in
  });
}

// ====== ELEVATOR LOGIC ======
function sendElevToFloor(elevIdx, floor) {
  const e = elevators[elevIdx];
  if (floor < 1 || floor > FLOORS) return;
  if (!e.queue.includes(floor) && e.floor !== floor) {
    e.queue.push(floor);
    sfxClick();
  } else if (e.floor === floor && e.doorOpen <= 0) {
    // re-open door if already there
    e.doorOpen = 55;
    handleArrival(e);
    sfxDing();
  }
}

function updateElevator(e) {
  // door animation
  if (e.doorOpen > 0) {
    e.doorAnim = Math.min(1, e.doorAnim + 0.06);
    e.doorOpen--;
    if (e.doorOpen === 0) {
      e.doorAnim = 0;
    }
    return;
  }
  e.doorAnim = Math.max(0, e.doorAnim - 0.08);

  // auto-pickup: if idle on a floor with waiting people, open doors
  if (!e.moving && e.queue.length === 0 && e.passengers.length < elevCap[e.idx]) {
    const waiting = waitingPeople.filter(p => p.floor === e.floor && !p.angry && !p.leaving);
    if (waiting.length > 0) {
      e.doorOpen = 55;
      e.doorAnim = 0;
      handleArrival(e);
      sfxDing();
      return;
    }
  }

  if (!e.moving && e.queue.length > 0) {
    e.targetFloor = e.queue[0];
    e.moving = true;
  }

  if (e.moving) {
    const ty = floorY(e.targetFloor);
    const speed = elevSpeed[e.idx];
    // acceleration/deceleration feel
    const dist = Math.abs(e.y - ty);
    const accelSpeed = dist < FLOOR_H * 0.5 ? speed * 0.6 : speed;

    if (dist < accelSpeed + 0.5) {
      e.y = ty;
      e.floor = e.targetFloor;
      e.moving = false;
      e.queue.shift();
      e.doorOpen = 55;
      e.doorAnim = 0;
      handleArrival(e);
      sfxDing();
    } else {
      const prevY = e.y;
      e.y += e.y < ty ? accelSpeed : -accelSpeed;
      e.floor = Math.round((floorY(1) - e.y) / FLOOR_H) + 1;
      e.floor = Math.max(1, Math.min(FLOORS, e.floor));

      // check if we crossed a floor with waiting people going same direction
      const dir = e.targetFloor > e.floor ? 1 : -1;
      const fy = floorY(e.floor);
      const crossed = (prevY < fy && e.y >= fy) || (prevY > fy && e.y <= fy) || Math.abs(e.y - fy) < accelSpeed;
      if (crossed && e.passengers.length < elevCap[e.idx]) {
        const waiting = waitingPeople.filter(p =>
          p.floor === e.floor && !p.angry && !p.leaving &&
          ((dir > 0 && p.dest > e.floor) || (dir < 0 && p.dest < e.floor))
        );
        if (waiting.length > 0) {
          // stop at this floor to pick up
          e.y = fy;
          e.moving = false;
          // insert current target back if not this floor
          if (e.targetFloor !== e.floor) {
            e.queue.unshift(e.targetFloor);
          } else {
            e.queue.shift();
          }
          e.doorOpen = 55;
          e.doorAnim = 0;
          handleArrival(e);
          sfxDing();
        }
      }
    }
  }
}

function handleArrival(e) {
  const ei = elevators.indexOf(e);
  const sx = shaftX(ei) + SHAFT_W / 2;

  // drop off
  const dropoff = e.passengers.filter(p => p.dest === e.floor);
  for (const p of dropoff) {
    const pts = p.vip ? 25 : 10;
    const comboMult = Math.min(combo + 1, 5);
    const total = pts * comboMult;
    score += total;
    totalDelivered++;
    periodDelivered++;
    combo++;
    comboTimer = 180; // 3 seconds to keep combo
    if (combo > maxCombo) maxCombo = combo;
    if (combo > periodCombo) periodCombo = combo;

    addFloatText(sx, e.y + 5, `+${total}`, combo >= 3 ? '#ffd54f' : '#a5d6a7');
    if (combo >= 3 && combo % 3 === 0) {
      sfxCombo();
      addFloatText(sx, e.y - 15, `${combo}连击!`, '#ffd54f', 18);
      spawnBurst(sx, e.y + FLOOR_H / 2, combo >= 6 ? '#ffd54f' : '#4fc3f7', 12);
    } else {
      sfxDeliver();
    }
    spawnBurst(sx, e.y + FLOOR_H / 2, p.vip ? '#ffd54f' : '#a5d6a7', 6);
  }
  e.passengers = e.passengers.filter(p => p.dest !== e.floor);

  // pick up
  const onFloor = waitingPeople.filter(p => p.floor === e.floor && !p.angry && !p.leaving);
  for (const p of onFloor) {
    if (e.passengers.length >= elevCap[e.idx]) break;
    e.passengers.push({ dest: p.dest, color: p.type.body, head: p.type.head, vip: p.vip });
    waitingPeople = waitingPeople.filter(wp => wp !== p);
    sfxPickup();
    if (!e.queue.includes(p.dest)) {
      e.queue.push(p.dest);
    }
  }
  // sort queue smartly — direction-aware
  if (e.queue.length > 1) {
    const dir = e.passengers.length > 0 ? (e.passengers[0].dest > e.floor ? 1 : -1) : 1;
    e.queue.sort((a, b) => {
      if (dir > 0) return a - b;
      return b - a;
    });
  }
}

// ====== UPDATE ======
function update() {
  tick++;
  const period = PERIODS[periodIdx];

  // sky transition
  skyTransition = 1 - (periodTimer / periodDurFrames);

  // spawn
  spawnAcc += period.spawnRate / 60;
  while (spawnAcc >= 1) { spawnPerson(); spawnAcc -= 1; }

  // combo decay
  if (comboTimer > 0) { comboTimer--; }
  else if (combo > 0) { combo = 0; }

  // update waiting
  for (let i = waitingPeople.length - 1; i >= 0; i--) {
    const p = waitingPeople[i];
    if (p.leaving) {
      p.leaveTimer++;
      if (p.leaveTimer > 30) waitingPeople.splice(i, 1);
      continue;
    }
    if (p.enterAnim > 0) p.enterAnim = Math.max(0, p.enterAnim - 0.05);
    p.waitTime++;
    if (p.waitTime >= p.maxWait && !p.angry) {
      p.angry = true; p.leaving = true; p.leaveTimer = 0;
      totalAngry++;
      score = Math.max(0, score - 5);
      satisfaction = Math.max(0, satisfaction - 3);
      combo = 0; comboTimer = 0;
      const totalShaftW_ = ELEV_COUNT * SHAFT_W + (ELEV_COUNT - 1) * SHAFT_GAP;
      const shaftCX_ = shaftX(0) + totalShaftW_ / 2;
      addFloatText(shaftCX_ - totalShaftW_ * 0.4 + p.slot * (totalShaftW_ / 3), floorY(p.floor) + FLOOR_H * 0.3, '-5', '#ef5350');
      sfxAngry();
    }
  }
  // recalc slots
  for (let f = 1; f <= FLOORS; f++) {
    const onFloor = waitingPeople.filter(p => p.floor === f && !p.angry);
    onFloor.forEach((p, idx) => p.slot = idx);
  }

  // update elevators
  for (const e of elevators) updateElevator(e);

  // satisfaction
  const waitCount = waitingPeople.filter(p => !p.angry).length;
  const avgWait = waitCount > 0 ? waitingPeople.filter(p => !p.angry).reduce((s, p) => s + p.waitTime, 0) / waitCount : 0;
  if (avgWait > 300) satisfaction = Math.max(0, satisfaction - 0.02);
  else if (avgWait < 100 && satisfaction < 100) satisfaction = Math.min(100, satisfaction + 0.01);
  satisAccum += satisfaction; satisCount++;

  // fail condition: satisfaction hits 0
  if (satisfaction <= 0) {
    endGame(true);
    return;
  }

  // float texts
  for (const ft of floatTexts) { ft.y -= 0.8; ft.life--; ft.scale = Math.min(1, ft.life / 10); }
  floatTexts = floatTexts.filter(f => f.life > 0);

  // particles
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.06;
    p.life--; p.size *= 0.97;
  }
  particles = particles.filter(p => p.life > 0);

  // period timer
  periodTimer--;
  if (periodTimer <= 0) {
    periodIdx++;
    if (periodIdx >= PERIODS.length) {
      endGame();
      return;
    }
    // show upgrade screen
    showUpgradeScreen();
    return;
  }

  updateHUD();
}

// ====== EFFECTS ======
function addFloatText(x, y, text, color, size) {
  floatTexts.push({ x, y, text, color, life: 50, size: size || 14, scale: 1 });
}

function spawnBurst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 1 + Math.random() * 3;
    particles.push({
      x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 1.5,
      life: 20 + Math.random()*15, color, size: 2 + Math.random()*3
    });
  }
}

// ====== RENDER ======
function render() {
  // --- Sky ---
  drawSky();

  // --- City silhouette ---
  drawCitySilhouette();

  // --- Building ---
  drawBuilding();

  // --- Elevator shafts (background, behind people) ---
  drawElevatorShafts();

  // --- Waiting people ---
  drawWaitingPeople();

  // --- Elevator cabs (on top, covers people when arriving) ---
  drawElevatorCabs();

  // --- Floor hover highlight ---
  if (hoveredFloor > 0 && hoveredFloor <= FLOORS) {
    const fy = floorY(hoveredFloor);
    ctx.fillStyle = 'rgba(79,195,247,0.06)';
    ctx.fillRect(BUILD_X, fy, BUILD_W, FLOOR_H);
    ctx.strokeStyle = 'rgba(79,195,247,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(BUILD_X, fy, BUILD_W, FLOOR_H);
  }

  // --- Float texts ---
  for (const ft of floatTexts) {
    const alpha = Math.min(1, ft.life / 15);
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${ft.size}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = ft.color;
    // shadow
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 8;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // --- Particles ---
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life / 10);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawSky() {
  const period = PERIODS[periodIdx];
  const nextPeriod = PERIODS[Math.min(periodIdx + 1, PERIODS.length - 1)];
  const t = Math.min(1, skyTransition);

  const topColor = lerpColor(period.skyTop, nextPeriod.skyTop, t * 0.3);
  const botColor = lerpColor(period.skyBot, nextPeriod.skyBot, t * 0.3);

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, topColor);
  sky.addColorStop(0.6, botColor);
  sky.addColorStop(1, '#0a0e1a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // stars (visible in evening)
  if (periodIdx === 2 || periodIdx === 0) {
    const starAlpha = periodIdx === 2 ? 0.6 : 0.25;
    ctx.fillStyle = `rgba(255,255,255,${starAlpha})`;
    for (let i = 0; i < 40; i++) {
      const sx = (Math.sin(i * 137.508 + 50) * 0.5 + 0.5) * W;
      const sy = (Math.cos(i * 97.31 + 30) * 0.5 + 0.5) * H * 0.35;
      const twinkle = Math.sin(tick * 0.03 + i * 2.5) * 0.5 + 0.5;
      ctx.globalAlpha = twinkle * starAlpha;
      const starSize = 1 + (i % 3) * 0.5;
      ctx.fillRect(sx, sy, starSize, starSize);
    }
    ctx.globalAlpha = 1;
  }

  // sun/moon
  if (periodIdx === 1) {
    // sun
    const sunX = W * 0.2 + skyTransition * W * 0.1;
    const sunY = H * 0.12;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 60);
    sunGlow.addColorStop(0, 'rgba(255,235,59,0.4)');
    sunGlow.addColorStop(0.5, 'rgba(255,235,59,0.08)');
    sunGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(sunX - 60, sunY - 60, 120, 120);
    ctx.fillStyle = '#fff8e1';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 14, 0, Math.PI * 2);
    ctx.fill();
  } else if (periodIdx === 2) {
    // moon
    const moonX = W * 0.82;
    const moonY = H * 0.1;
    ctx.fillStyle = '#e8eaf6';
    ctx.beginPath();
    ctx.arc(moonX, moonY, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PERIODS[2].skyTop;
    ctx.beginPath();
    ctx.arc(moonX + 4, moonY - 3, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  // clouds
  drawClouds();
}

function drawClouds() {
  ctx.fillStyle = periodIdx === 2
    ? 'rgba(100,120,160,0.06)'
    : periodIdx === 1 ? 'rgba(255,255,255,0.08)' : 'rgba(200,200,220,0.05)';
  for (let i = 0; i < 5; i++) {
    const cx = ((i * 237 + tick * 0.15) % (W + 200)) - 100;
    const cy = 40 + i * 25 + Math.sin(i * 3.1) * 15;
    drawCloud(cx, cy, 40 + i * 8);
  }
}

function drawCloud(x, y, w) {
  ctx.beginPath();
  ctx.arc(x, y, w * 0.25, 0, Math.PI * 2);
  ctx.arc(x + w * 0.2, y - w * 0.1, w * 0.3, 0, Math.PI * 2);
  ctx.arc(x + w * 0.45, y, w * 0.25, 0, Math.PI * 2);
  ctx.fill();
}

function drawCitySilhouette() {
  const baseY = HUD_H + FLOORS * FLOOR_H;
  ctx.fillStyle = 'rgba(8,12,24,0.7)';

  // left buildings
  const lx = BUILD_X - 20;
  for (let i = 0; i < 4; i++) {
    const bw = 20 + Math.sin(i * 2.3) * 8;
    const bh = 60 + i * 40 + Math.sin(i * 1.7) * 30;
    const bx = lx - (i + 1) * (bw + 8);
    ctx.fillRect(bx, baseY - bh, bw, bh);
    // tiny windows
    ctx.fillStyle = 'rgba(255,220,120,0.08)';
    for (let wy = baseY - bh + 8; wy < baseY - 6; wy += 12) {
      for (let wx = bx + 4; wx < bx + bw - 4; wx += 8) {
        if (Math.sin(wx * 3.1 + wy * 2.7 + tick * 0.005) > 0.3)
          ctx.fillRect(wx, wy, 4, 6);
      }
    }
    ctx.fillStyle = 'rgba(8,12,24,0.7)';
  }

  // right buildings
  const rx = BUILD_X + BUILD_W + 20;
  for (let i = 0; i < 4; i++) {
    const bw = 18 + Math.sin(i * 3.1) * 6;
    const bh = 50 + i * 35 + Math.sin(i * 2.3) * 25;
    const bx = rx + i * (bw + 8);
    ctx.fillRect(bx, baseY - bh, bw, bh);
    ctx.fillStyle = 'rgba(255,220,120,0.08)';
    for (let wy = baseY - bh + 8; wy < baseY - 6; wy += 12) {
      for (let wx = bx + 3; wx < bx + bw - 3; wx += 7) {
        if (Math.sin(wx * 2.7 + wy * 3.1 + tick * 0.005) > 0.35)
          ctx.fillRect(wx, wy, 3, 5);
      }
    }
    ctx.fillStyle = 'rgba(8,12,24,0.7)';
  }
}

function drawBuilding() {
  const bx = BUILD_X;
  const by = HUD_H;
  const bw = BUILD_W;
  const bh = FLOORS * FLOOR_H;

  // building shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(bx + 8, by + 5, bw, bh + 5);

  // main building body — glass facade gradient
  const bGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  bGrad.addColorStop(0, '#18283e');
  bGrad.addColorStop(0.3, '#1e3350');
  bGrad.addColorStop(0.7, '#1a2e48');
  bGrad.addColorStop(1, '#162840');
  ctx.fillStyle = bGrad;
  ctx.fillRect(bx, by, bw, bh);

  // glass reflection overlay
  const refl = ctx.createLinearGradient(bx, by, bx + bw * 0.6, by + bh);
  refl.addColorStop(0, 'rgba(100,180,255,0.06)');
  refl.addColorStop(0.3, 'rgba(100,180,255,0.02)');
  refl.addColorStop(0.7, 'rgba(100,180,255,0)');
  ctx.fillStyle = refl;
  ctx.fillRect(bx, by, bw, bh);

  // floors
  for (let f = 1; f <= FLOORS; f++) {
    const fy = floorY(f);

    // floor separator — thin bright line
    ctx.strokeStyle = 'rgba(80,140,200,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx, fy + FLOOR_H);
    ctx.lineTo(bx + bw, fy + FLOOR_H);
    ctx.stroke();

    // floor number plate
    const plateX = bx + 6;
    const plateY = fy + FLOOR_H * 0.35;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    roundRect(ctx, plateX, plateY - 7, 22, 14, 3);
    ctx.fill();
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5a8aaa';
    ctx.fillText(`${f}F`, plateX + 11, plateY + 3);

    // windows — glass panels with occasional warm glow
    const winStartX = bx + 34;
    const winAreaW = LOBBY_W - 10;
    const winW = 16, winH = FLOOR_H - 10, winGap = 4;
    const winCount = Math.floor(winAreaW / (winW + winGap));

    for (let w = 0; w < winCount; w++) {
      const wx = winStartX + w * (winW + winGap);
      const wy = fy + 5;
      const lit = Math.sin(f * 3.7 + w * 2.1 + tick * 0.008) > 0.15;
      const warmLit = Math.sin(f * 2.3 + w * 5.1 + tick * 0.003) > 0.6;

      // window pane
      if (warmLit && (periodIdx === 0 || periodIdx === 2)) {
        // warm interior light
        const wGlow = ctx.createLinearGradient(wx, wy, wx, wy + winH);
        wGlow.addColorStop(0, 'rgba(255,220,120,0.25)');
        wGlow.addColorStop(1, 'rgba(255,180,80,0.1)');
        ctx.fillStyle = wGlow;
      } else if (lit) {
        ctx.fillStyle = periodIdx === 1 ? 'rgba(135,206,250,0.12)' : 'rgba(180,210,240,0.08)';
      } else {
        ctx.fillStyle = 'rgba(10,20,40,0.5)';
      }
      ctx.fillRect(wx, wy, winW, winH);

      // window frame
      ctx.strokeStyle = 'rgba(80,140,200,0.1)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(wx, wy, winW, winH);

      // cross bar
      ctx.beginPath();
      ctx.moveTo(wx + winW/2, wy); ctx.lineTo(wx + winW/2, wy + winH);
      ctx.stroke();
    }
  }

  // building outline — subtle glass edge
  ctx.strokeStyle = 'rgba(80,160,220,0.2)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx, by, bw, bh);

  // left edge highlight
  ctx.strokeStyle = 'rgba(120,180,240,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(bx + 1, by); ctx.lineTo(bx + 1, by + bh);
  ctx.stroke();

  // rooftop structure
  ctx.fillStyle = '#1e3350';
  ctx.fillRect(bx + 15, by - 6, bw - 30, 6);
  // rooftop railing
  ctx.strokeStyle = 'rgba(80,140,200,0.3)';
  ctx.lineWidth = 1;
  for (let rx = bx + 20; rx < bx + bw - 20; rx += 15) {
    ctx.beginPath();
    ctx.moveTo(rx, by - 6); ctx.lineTo(rx, by - 14);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(bx + 20, by - 14); ctx.lineTo(bx + bw - 20, by - 14);
  ctx.stroke();

  // antenna / satellite
  const antX = bx + bw * 0.5;
  ctx.strokeStyle = '#4a6a8a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(antX, by - 14); ctx.lineTo(antX, by - 32); ctx.stroke();
  // blinking light
  const blink = Math.sin(tick * 0.1) > 0.3;
  if (blink) {
    ctx.fillStyle = '#ef5350';
    ctx.shadowColor = '#ef5350'; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(antX, by - 34, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ground floor entrance
  const gfy = floorY(1);
  const entranceW = 40;
  const entranceX = bx + (34 + LOBBY_W/2) - entranceW/2;
  // door frame
  ctx.fillStyle = 'rgba(255,220,120,0.12)';
  ctx.fillRect(entranceX, gfy + 4, entranceW, FLOOR_H - 4);
  ctx.strokeStyle = 'rgba(255,220,120,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(entranceX, gfy + 4, entranceW, FLOOR_H - 4);
  // canopy
  ctx.fillStyle = '#2a4060';
  ctx.beginPath();
  ctx.moveTo(entranceX - 10, gfy + 4);
  ctx.lineTo(entranceX + entranceW + 10, gfy + 4);
  ctx.lineTo(entranceX + entranceW + 5, gfy);
  ctx.lineTo(entranceX - 5, gfy);
  ctx.closePath();
  ctx.fill();

  // ground
  ctx.fillStyle = '#0c1520';
  ctx.fillRect(0, gfy + FLOOR_H, W, H - gfy - FLOOR_H);
  // pavement
  ctx.fillStyle = 'rgba(40,60,80,0.4)';
  ctx.fillRect(bx - 30, gfy + FLOOR_H, bw + 60, 6);
}

function drawWaitingPeople() {
  for (const p of waitingPeople) {
    if (p.leaving) {
      // fade out + slide
      const alpha = 1 - p.leaveTimer / 30;
      ctx.globalAlpha = alpha;
    }

    // position people at the elevator shafts area
    const totalShaftW = ELEV_COUNT * SHAFT_W + (ELEV_COUNT - 1) * SHAFT_GAP;
    const shaftCenterX = shaftX(0) + totalShaftW / 2;
    const px = shaftCenterX - totalShaftW * 0.4 + p.slot * (totalShaftW / 3);
    const fy = floorY(p.floor);
    const py = fy + FLOOR_H * 0.78;
    const bob = Math.sin(tick * 0.06 + p.bobOffset) * 1.2;
    const slideIn = p.enterAnim * -30;

    const dx = px + slideIn;
    const dy = py + bob;

    // person shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(dx, dy + 4, 5, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // body
    ctx.fillStyle = p.type.body;
    roundRect(ctx, dx - 4, dy - 5, 8, 11, 2);
    ctx.fill();

    // head
    ctx.fillStyle = p.type.head;
    ctx.beginPath();
    ctx.arc(dx, dy - 10, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // hair (top of head)
    ctx.fillStyle = p.type.label === 'F' ? '#5d4037' : '#3e2723';
    ctx.beginPath();
    ctx.arc(dx, dy - 12.5, 4, 0, Math.PI, true);
    ctx.fill();

    // VIP crown
    if (p.vip) {
      ctx.fillStyle = '#ffd54f';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('👑', dx, dy - 17);
    }

    // destination badge
    const urgency = p.waitTime / p.maxWait;
    let badgeColor;
    if (urgency > 0.75) badgeColor = '#ef5350';
    else if (urgency > 0.45) badgeColor = '#ffa726';
    else badgeColor = '#66bb6a';

    // badge background
    const badgeX = dx;
    const badgeY = dy - 23 - (p.vip ? 6 : 0);
    ctx.fillStyle = badgeColor;
    ctx.shadowColor = badgeColor;
    ctx.shadowBlur = urgency > 0.6 ? 6 : 0;
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // badge text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.dest, badgeX, badgeY);
    ctx.textBaseline = 'alphabetic';

    // urgency exclamation
    if (urgency > 0.7) {
      const shake = Math.sin(tick * 0.3) * 2;
      ctx.fillStyle = '#ef5350';
      ctx.font = 'bold 10px sans-serif';
      ctx.fillText('!', dx + 10 + shake, dy - 18);
    }

    ctx.globalAlpha = 1;
  }
}

function drawElevatorShafts() {
  for (let i = 0; i < ELEV_COUNT; i++) {
    const e = elevators[i];
    const sx = shaftX(i);
    const shaftY = HUD_H;
    const shaftH = FLOORS * FLOOR_H;

    // shaft background
    const shaftGrad = ctx.createLinearGradient(sx, shaftY, sx + SHAFT_W, shaftY);
    shaftGrad.addColorStop(0, '#142337');
    shaftGrad.addColorStop(0.5, '#0f1c2d');
    shaftGrad.addColorStop(1, '#142337');
    ctx.fillStyle = shaftGrad;
    ctx.fillRect(sx - 1, shaftY, SHAFT_W + 2, shaftH);

    // shaft side walls
    ctx.strokeStyle = 'rgba(80,130,180,0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx - 1, shaftY); ctx.lineTo(sx - 1, shaftY + shaftH);
    ctx.moveTo(sx + SHAFT_W + 1, shaftY); ctx.lineTo(sx + SHAFT_W + 1, shaftY + shaftH);
    ctx.stroke();

    // shaft guide rails
    ctx.strokeStyle = 'rgba(100,160,220,0.08)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx + 3, shaftY); ctx.lineTo(sx + 3, shaftY + shaftH);
    ctx.moveTo(sx + SHAFT_W - 3, shaftY); ctx.lineTo(sx + SHAFT_W - 3, shaftY + shaftH);
    ctx.stroke();

    // floor door frames
    for (let f = 1; f <= FLOORS; f++) {
      const fy = floorY(f);
      ctx.strokeStyle = 'rgba(80,130,180,0.1)';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(sx, fy + FLOOR_H); ctx.lineTo(sx + SHAFT_W, fy + FLOOR_H); ctx.stroke();
      ctx.strokeStyle = 'rgba(100,160,220,0.08)';
      ctx.strokeRect(sx + 3, fy + 2, SHAFT_W - 6, FLOOR_H - 4);
    }

    // queue indicators
    for (const qf of e.queue) {
      const qy = floorY(qf) + FLOOR_H / 2;
      ctx.fillStyle = e.color + '44';
      ctx.beginPath(); ctx.arc(sx + SHAFT_W / 2, qy, 3, 0, Math.PI * 2); ctx.fill();
      const pulse = Math.sin(tick * 0.08) * 2 + 4;
      ctx.strokeStyle = e.color + '22';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(sx + SHAFT_W / 2, qy, pulse, 0, Math.PI * 2); ctx.stroke();
    }

    // cable
    ctx.strokeStyle = 'rgba(100,160,220,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx + SHAFT_W/2, shaftY);
    ctx.lineTo(sx + SHAFT_W/2, e.y + 2);
    ctx.stroke();
  }
}

function drawElevatorCabs() {
  for (let i = 0; i < ELEV_COUNT; i++) {
    const e = elevators[i];
    const sx = shaftX(i);
    const cabY = e.y;
    const cabH = FLOOR_H - 4;

    // cab glow
    ctx.shadowColor = e.color;
    ctx.shadowBlur = i === selectedElev ? 18 : 10;

    // cab body
    const cabGrad = ctx.createLinearGradient(sx, cabY, sx, cabY + cabH);
    cabGrad.addColorStop(0, '#f0e6d2');
    cabGrad.addColorStop(0.15, '#e6dcc3');
    cabGrad.addColorStop(0.85, '#d2c8b4');
    cabGrad.addColorStop(1, '#c0b4a0');
    ctx.fillStyle = cabGrad;
    roundRect(ctx, sx + 2, cabY + 2, SHAFT_W - 4, cabH, 3);
    ctx.fill();
    ctx.shadowBlur = 0;

    // colored top bar
    ctx.fillStyle = e.color;
    ctx.fillRect(sx + 2, cabY + 2, SHAFT_W - 4, 3);

    // cab floor
    ctx.fillStyle = 'rgba(80,70,60,0.5)';
    ctx.fillRect(sx + 3, cabY + cabH - 3, SHAFT_W - 6, 2);

    // cab side walls
    ctx.strokeStyle = 'rgba(160,140,120,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx + 2, cabY + 2, SHAFT_W - 4, cabH);

    // --- draw passengers inside cab ---
    const pCount = e.passengers.length;
    if (pCount > 0) {
      const innerW = SHAFT_W - 10;
      const innerX = sx + 5;
      const cols = Math.min(pCount, 3);
      const rows = Math.ceil(pCount / 3);
      const personW = innerW / cols;
      const personAreaH = cabH - 14;
      const personH = personAreaH / rows;

      for (let pi = 0; pi < pCount; pi++) {
        const p = e.passengers[pi];
        const col = pi % 3;
        const row = Math.floor(pi / 3);
        const px = innerX + col * personW + personW / 2;
        const py = cabY + 8 + row * personH + personH * 0.7;
        const scale = Math.min(1, personH / 16);

        ctx.fillStyle = p.color;
        const bw = 4 * scale, bh = 6 * scale;
        roundRect(ctx, px - bw/2, py - bh, bw, bh, 1);
        ctx.fill();

        ctx.fillStyle = p.head || '#ffcc80';
        ctx.beginPath();
        ctx.arc(px, py - bh - 2 * scale, 2.5 * scale, 0, Math.PI * 2);
        ctx.fill();

        if (p.vip) {
          ctx.fillStyle = '#ffd54f';
          ctx.font = `${Math.max(5, 6 * scale)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('★', px, py - bh - 4.5 * scale);
        }

        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.beginPath();
        ctx.arc(px, py + 2 * scale, 4.5 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(7, 8 * scale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.dest, px, py + 2 * scale);
        ctx.textBaseline = 'alphabetic';
      }
    }

    // door animation
    if (e.doorAnim > 0.01) {
      const doorW = (SHAFT_W - 8) * 0.5 * e.doorAnim;
      ctx.fillStyle = 'rgba(180,170,150,0.7)';
      ctx.fillRect(sx + 3, cabY + 5, SHAFT_W/2 - 2 - doorW, cabH - 8);
      ctx.fillRect(sx + SHAFT_W/2 + doorW, cabY + 5, SHAFT_W/2 - 2 - doorW, cabH - 8);
      ctx.fillStyle = 'rgba(255,240,200,0.05)';
      ctx.beginPath();
      ctx.moveTo(sx + SHAFT_W/2 - doorW, cabY + 5);
      ctx.lineTo(sx - 12, cabY + cabH);
      ctx.lineTo(sx + SHAFT_W + 12, cabY + cabH);
      ctx.lineTo(sx + SHAFT_W/2 + doorW, cabY + 5);
      ctx.closePath();
      ctx.fill();
    }

    // elevator name badge
    ctx.fillStyle = e.color;
    const nameY = cabY - 1;
    ctx.beginPath();
    ctx.arc(sx + SHAFT_W/2, nameY, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = `bold ${Math.min(9, SHAFT_W * 0.2)}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.fillText(e.name, sx + SHAFT_W/2, nameY + 3);

    // passenger count badge
    if (pCount > 0) {
      const countX = sx + SHAFT_W - 2;
      const countY = cabY + cabH + 1;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      roundRect(ctx, countX - 14, countY - 7, 16, 9, 3);
      ctx.fill();
      ctx.font = `bold 7px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText(`${pCount}/${elevCap[e.idx]}`, countX - 6, countY - 1);
    }

    // direction arrow
    if (e.moving) {
      const arrowY = cabY + (e.targetFloor > e.floor ? -8 : cabH + 14);
      ctx.fillStyle = e.color;
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(e.targetFloor > e.floor ? '▲' : '▼', sx + SHAFT_W/2, arrowY);
    }

    // selected indicator
    if (i === selectedElev) {
      ctx.strokeStyle = e.color + 'aa';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 4]);
      roundRect(ctx, sx - 2, cabY - 1, SHAFT_W + 4, cabH + 4, 5);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

// ====== HUD ======
function updateHUD() {
  document.getElementById('h-score').textContent = score;
  document.getElementById('h-combo').textContent = combo > 1 ? `×${combo}` : '×1';
  document.getElementById('h-combo').style.color = combo >= 5 ? '#ff9800' : combo >= 3 ? '#ffd54f' : '#6a8098';
  const satisEl = document.getElementById('h-satis');
  satisEl.textContent = Math.round(satisfaction) + '%';
  satisEl.style.color = satisfaction >= 70 ? '#66bb6a' : satisfaction >= 40 ? '#ffa726' : '#ef5350';
  document.getElementById('h-period').textContent = PERIODS[Math.min(periodIdx, PERIODS.length - 1)].name;
  document.getElementById('h-waiting').textContent = waitingPeople.filter(p => !p.angry && !p.leaving).length + '人';

  // progress bar
  const pct = periodTimer / periodDurFrames * 100;
  document.getElementById('h-bar').style.width = pct + '%';

  // elevator info in bottom bar
  for (let i = 0; i < ELEV_COUNT; i++) {
    const e = elevators[i];
    const info = document.getElementById(`ei${i}`);
    if (info) info.textContent = `${e.floor}F · ${e.passengers.length}人`;
  }
}

// ====== UPGRADE SYSTEM ======
function showUpgradeScreen() {
  gameActive = false;
  const overlay = document.getElementById('upgrade-overlay');
  const period = PERIODS[periodIdx - 1];
  document.getElementById('upg-title').textContent = `${period.name} 完成！`;
  document.getElementById('upg-score').textContent = score;
  document.getElementById('upg-delivered').textContent = periodDelivered;
  document.getElementById('upg-combo').textContent = periodCombo;

  // generate upgrade options
  const allUpgrades = [
    { icon: '⚡', name: '涡轮加速', desc: '全部电梯速度+20%', apply: () => { elevSpeed = elevSpeed.map(s => s * 1.2); } },
    { icon: '📦', name: '扩容改造', desc: '全部电梯容量+2', apply: () => { elevCap = elevCap.map(c => c + 2); } },
    { icon: '😊', name: '安抚广播', desc: '乘客耐心+30%', apply: () => { waitingPeople.forEach(p => { p.maxWait *= 1.3; }); } },
    { icon: '🔧', name: '快速开门', desc: '开门时间减半', apply: () => { /* handled in door logic */ } },
    { icon: '💰', name: '双倍积分', desc: '下一时段分数×2', apply: () => { } },
    { icon: '🛗', name: 'A号特化', desc: 'A号速度+50%', apply: () => { elevSpeed[0] *= 1.5; } },
  ];

  // pick 3 random
  const shuffled = allUpgrades.sort(() => Math.random() - 0.5);
  upgrades = shuffled.slice(0, 3);

  const container = document.getElementById('upg-options');
  container.innerHTML = '';
  upgrades.forEach((u, idx) => {
    const card = document.createElement('div');
    card.className = 'upg-card';
    card.innerHTML = `<div class="upg-icon">${u.icon}</div><div class="upg-name">${u.name}</div><div class="upg-desc">${u.desc}</div>`;
    card.onclick = () => selectUpgrade(idx);
    container.appendChild(card);
  });

  overlay.classList.add('show');
}

function selectUpgrade(idx) {
  ensureAudio();
  sfxUpgrade();
  upgrades[idx].apply();
  resumeAfterUpgrade();
}

function skipUpgrade() {
  resumeAfterUpgrade();
}

function resumeAfterUpgrade() {
  document.getElementById('upgrade-overlay').classList.remove('show');
  FLOORS = PERIODS[periodIdx].floors;
  resize();
  // move elevators to floor 1 of new layout
  for (const e of elevators) {
    e.floor = 1; e.y = floorY(1); e.targetFloor = 1;
    e.queue = []; e.moving = false;
  }
  // remove people on floors that no longer exist
  waitingPeople = waitingPeople.filter(p => p.floor <= FLOORS && p.dest <= FLOORS);
  periodDurFrames = PERIODS[periodIdx].dur * 60;
  periodTimer = periodDurFrames;
  periodDelivered = 0;
  periodCombo = 0;
  satisfaction = 100;
  gameActive = true;
}

// ====== INTERACTION ======
// Click directly on elevator cab to select, click on floor to dispatch
function selElev(idx) {
  selectedElev = idx;
  sfxClick();
}

function hitTestElevator(mx, my) {
  // check if click lands on any elevator cab (generous hitbox)
  for (let i = 0; i < ELEV_COUNT; i++) {
    const e = elevators[i];
    const sx = shaftX(i);
    const cabY = e.y;
    const cabH = FLOOR_H - 4;
    const pad = 8; // extra padding for easier tapping
    if (mx >= sx - pad && mx <= sx + SHAFT_W + pad && my >= cabY - pad && my <= cabY + cabH + pad) {
      return i;
    }
  }
  return -1;
}

function handleCanvasClick(mx, my) {
  if (!gameActive) return;
  ensureAudio();

  // first: check if clicking on an elevator cab
  const hitElev = hitTestElevator(mx, my);
  if (hitElev >= 0) {
    selectedElev = hitElev;
    sfxClick();
    return;
  }

  // otherwise: click on building floor → send selected elevator there
  if (mx >= BUILD_X && mx <= BUILD_X + BUILD_W && my >= HUD_H && my <= HUD_H + FLOORS * FLOOR_H) {
    const clickedFloor = Math.floor((HUD_H + FLOORS * FLOOR_H - my) / FLOOR_H) + 1;
    if (clickedFloor >= 1 && clickedFloor <= FLOORS) {
      sendElevToFloor(selectedElev, clickedFloor);
    }
  }
}

cvs.addEventListener('click', (ev) => {
  const rect = cvs.getBoundingClientRect();
  handleCanvasClick(ev.clientX - rect.left, ev.clientY - rect.top);
});

cvs.addEventListener('mousemove', (ev) => {
  if (!gameActive) return;
  const rect = cvs.getBoundingClientRect();
  const mx = ev.clientX - rect.left;
  const my = ev.clientY - rect.top;

  // check hover on elevator
  const hitElev = hitTestElevator(mx, my);
  if (hitElev >= 0) {
    hoveredFloor = -1;
    cvs.style.cursor = 'pointer';
    return;
  }

  if (mx >= BUILD_X && mx <= BUILD_X + BUILD_W && my >= HUD_H && my <= HUD_H + FLOORS * FLOOR_H) {
    hoveredFloor = Math.floor((HUD_H + FLOORS * FLOOR_H - my) / FLOOR_H) + 1;
    cvs.style.cursor = 'pointer';
  } else {
    hoveredFloor = -1;
    cvs.style.cursor = 'default';
  }
});

cvs.addEventListener('mouseleave', () => {
  hoveredFloor = -1;
  cvs.style.cursor = 'default';
});

// Touch support
cvs.addEventListener('touchstart', (ev) => {
  ev.preventDefault();
  const touch = ev.touches[0];
  const rect = cvs.getBoundingClientRect();
  handleCanvasClick(touch.clientX - rect.left, touch.clientY - rect.top);
}, { passive: false });

// keyboard — just space to start
document.addEventListener('keydown', (ev) => {
  if (ev.key === ' ' || ev.key === 'Enter') {
    const startScreen = document.getElementById('start-screen');
    if (startScreen.style.display !== 'none') {
      startGame();
      ev.preventDefault();
    }
  }
});

// ====== GAME OVER ======
function endGame(failed = false) {
  gameActive = false;
  const avgSatis = satisCount > 0 ? Math.round(satisAccum / satisCount) : 0;

  // grade
  let grade, gradeClass;
  if (failed) {
    grade = 'F'; gradeClass = 'f';
  } else {
    grade = 'D'; gradeClass = 'd';
    if (score >= 1500 && avgSatis >= 80) { grade = 'S'; gradeClass = 's'; }
    else if (score >= 1000 && avgSatis >= 65) { grade = 'A'; gradeClass = 'a'; }
    else if (score >= 600 && avgSatis >= 50) { grade = 'B'; gradeClass = 'b'; }
    else if (score >= 300) { grade = 'C'; gradeClass = 'c'; }
  }

  const gradeEl = document.getElementById('go-grade');
  gradeEl.textContent = grade;
  gradeEl.className = 'go-grade ' + gradeClass;

  document.getElementById('go-title').textContent = failed ? '调度失败！' : grade === 'S' ? '完美调度！' : grade === 'D' ? '需要加油...' : '调度完成！';
  document.getElementById('go-score').textContent = score;
  document.getElementById('go-delivered').textContent = totalDelivered;
  document.getElementById('go-angry').textContent = totalAngry;
  document.getElementById('go-combo').textContent = maxCombo;
  document.getElementById('go-satis').textContent = avgSatis + '%';

  setTimeout(() => document.getElementById('gameover-overlay').classList.add('show'), 500);
}

function retryGame() {
  initGame();
}

// ====== START / LOOP ======
function startGame() {
  ensureAudio();
  const s = document.getElementById('start-screen');
  s.classList.add('hide');
  setTimeout(() => s.style.display = 'none', 600);
  document.getElementById('game').classList.add('active');
  resize();
  initGame();
  if (!animFrame) gameLoop();
}

function gameLoop() {
  if (gameActive) update();
  render();
  animFrame = requestAnimationFrame(gameLoop);
}

// ====== UTILITY ======
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
