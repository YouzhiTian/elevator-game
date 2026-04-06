// ============================================================
//  Elevator Dispatcher v3.0 — CrazyGames Ready
//  deltaTime, endless day system, special events, high scores
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
function sfxEvent() { playTone(660, 0.12, 'triangle', 0.1); setTimeout(() => playTone(880, 0.12, 'triangle', 0.08), 100); }

// ====== BACKGROUND MUSIC (procedural looping ambient) ======
let bgmPlaying = false;
let bgmNodes = [];
const BGM_CHORDS = [
  [261.6, 329.6, 392.0],  // C major
  [293.7, 370.0, 440.0],  // D minor-ish
  [220.0, 277.2, 329.6],  // A minor
  [246.9, 311.1, 370.0],  // B dim-ish
  [261.6, 311.1, 392.0],  // C sus
  [220.0, 293.7, 349.2],  // Dm7-ish
];
let bgmChordIdx = 0;
let bgmInterval = null;

function startBGM() {
  if (bgmPlaying || !audioCtx) return;
  bgmPlaying = true;
  playBGMChord();
  bgmInterval = setInterval(playBGMChord, 3200);
}

function playBGMChord() {
  if (!audioCtx || !bgmPlaying) return;
  const chord = BGM_CHORDS[bgmChordIdx % BGM_CHORDS.length];
  bgmChordIdx++;
  for (const freq of chord) {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq * 0.5; // one octave lower for ambient feel
    g.gain.setValueAtTime(0, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.018, audioCtx.currentTime + 0.8);
    g.gain.linearRampToValueAtTime(0.012, audioCtx.currentTime + 2.0);
    g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 3.2);
    o.connect(g); g.connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + 3.3);
  }
  // occasional high sparkle note
  if (Math.random() < 0.4) {
    const sparkle = chord[Math.floor(Math.random() * chord.length)] * 2;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'triangle';
    o.frequency.value = sparkle;
    g.gain.setValueAtTime(0, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.015, audioCtx.currentTime + 0.1);
    g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.5);
    o.connect(g); g.connect(audioCtx.destination);
    const delay = 0.8 + Math.random() * 1.5;
    o.start(audioCtx.currentTime + delay);
    o.stop(audioCtx.currentTime + delay + 1.6);
  }
}

function stopBGM() {
  bgmPlaying = false;
  if (bgmInterval) { clearInterval(bgmInterval); bgmInterval = null; }
}

// ====== CONSTANTS ======
let FLOORS = 12;
const ELEV_COUNT = 3;
const HUD_H = 56;
const BAR_H = 50;
const ELEV_COLORS = ['#4fc3f7', '#81c784', '#ba68c8'];
const ELEV_NAMES = ['A', 'B', 'C'];

const PERSON_TYPES = [
  { head: '#ffcc80', body: '#42a5f5', pants: '#1565c0', hair: '#4e342e', hairStyle: 'short', label: 'M' },
  { head: '#ffcc80', body: '#ef5350', pants: '#c62828', hair: '#5d4037', hairStyle: 'long',  label: 'F' },
  { head: '#ffcc80', body: '#66bb6a', pants: '#33691e', hair: '#3e2723', hairStyle: 'short', label: 'M' },
  { head: '#d7ccc8', body: '#78909c', pants: '#455a64', hair: '#9e9e9e', hairStyle: 'bun',   label: 'F' },
  { head: '#ffcc80', body: '#ffa726', pants: '#4e342e', hair: '#3e2723', hairStyle: 'spiky', label: 'M' },
  { head: '#ffcc80', body: '#ab47bc', pants: '#6a1b9a', hair: '#4e342e', hairStyle: 'long',  label: 'F' },
  { head: '#ffcc80', body: '#26c6da', pants: '#00695c', hair: '#212121', hairStyle: 'short', label: 'M' },
  { head: '#ffe0b2', body: '#ec407a', pants: '#880e4f', hair: '#5d4037', hairStyle: 'pony',  label: 'F' },
  { head: '#8d6e63', body: '#fff176', pants: '#f9a825', hair: '#212121', hairStyle: 'short', label: 'M' },
  { head: '#8d6e63', body: '#4dd0e1', pants: '#00838f', hair: '#212121', hairStyle: 'long',  label: 'F' },
  { head: '#ffcc80', body: '#90a4ae', pants: '#37474f', hair: '#6d4c41', hairStyle: 'bald',  label: 'M' },
  { head: '#ffe0b2', body: '#f48fb1', pants: '#ad1457', hair: '#d32f2f', hairStyle: 'bun',   label: 'F' },
];

// Base periods — scaled by day
const BASE_PERIODS = [
  { name: 'Morning', dur: 65, spawnRate: 0.4, type: 'morning', baseFloors: 4, skyTop: '#1a2744', skyBot: '#ff8a65' },
  { name: 'Lunch', dur: 65, spawnRate: 0.7, type: 'lunch', baseFloors: 8, skyTop: '#42a5f5', skyBot: '#81d4fa' },
  { name: 'Evening', dur: 70, spawnRate: 1.0, type: 'evening', baseFloors: 12, skyTop: '#1a1a3e', skyBot: '#4a2060' },
];

// ====== CANVAS ======
const cvs = document.getElementById('cvs');
const ctx = cvs.getContext('2d');
let W, H, FLOOR_H, BUILD_X, BUILD_W, SHAFT_W, SHAFT_GAP, LOBBY_W;

const isMobile = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.innerWidth < 600;
function resize() {
  W = cvs.width = window.innerWidth;
  H = cvs.height = window.innerHeight;
  const drawH = H - HUD_H - BAR_H;
  FLOOR_H = drawH / FLOORS;
  // on mobile, make shafts wider for better tappability
  if (isMobile) {
    SHAFT_W = Math.min(90, W * 0.19);
    SHAFT_GAP = Math.min(12, W * 0.02);
    LOBBY_W = Math.max(30, SHAFT_W * 1.0);
  } else {
    SHAFT_W = Math.min(90, W * 0.14);
    SHAFT_GAP = Math.min(16, W * 0.025);
    LOBBY_W = Math.max(40, SHAFT_W * 1.5);
  }
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
let periodDur = 0; // in seconds
let spawnAcc = 0;
let gameActive = false;
let tick = 0;
let animFrame = null;
let lastTime = 0;
let satisAccum = 0;
let satisCount = 0;
let floatTexts = [];
let particles = [];
let combo = 0;
let comboTimer = 0; // in seconds
let maxCombo = 0;
let hoveredFloor = -1;
let skyTransition = 0;
let periodDelivered = 0;
let periodCombo = 0;

// Day system
let currentDay = 1;
let periods = [];

// Upgrade state
let elevSpeed = [2.8, 2.8, 2.8];
let elevCap = [6, 6, 6];
let upgrades = [];
let doorSpeedMult = 1;
let patienceMult = 1;
let scoreMult = 1;

// Tutorial state
// Tutorial steps (guides through entire Morning period):
// 0  = waiting for first person to appear
// 1  = "click elevator to select"
// 2  = "click a floor to send it"
// 3  = "nice!" (2s then auto-advance)
// 4  = "try using all 3 elevators" (wait until player selects a different elevator)
// 5  = "watch the timer" (shown for 4s)
// 6  = "passengers get angry if they wait too long" (shown when someone is orange)
// 7  = "use keyboard 1/2/3 to switch fast" (shown for 5s)
// 8  = "keep satisfaction above 0%" (shown for 4s)
// 9  = "morning almost done!" (shown near end of period)
// 10 = tutorial complete, fade out
// -1 = fully done
let tutorialStep = 0;
let tutorialTimer = 0;
let tutorialPulse = 0;
let firstDeliveryDone = false;
let tutorialElevSwitched = false;
let tutorialAngryShown = false;

// Special events
let activeEvent = null;
let eventTimer = 0; // seconds
let eventCooldown = 0; // seconds
let brokenElevIdx = -1;

// High score (localStorage with try/catch for incognito)
let highScore = 0;
let highDay = 0;
function loadHighScore() {
  try {
    highScore = parseInt(localStorage.getItem('ed_highscore')) || 0;
    highDay = parseInt(localStorage.getItem('ed_highday')) || 0;
  } catch (e) { /* incognito */ }
}
function saveHighScore() {
  try {
    if (score > highScore) localStorage.setItem('ed_highscore', score);
    if (currentDay > highDay) localStorage.setItem('ed_highday', currentDay);
  } catch (e) { /* incognito */ }
}
loadHighScore();

// Show high score on start screen
function showHighScoreOnStart() {
  if (highScore > 0) {
    document.getElementById('high-score-display').style.display = 'block';
    document.getElementById('hs-score').textContent = highScore;
    document.getElementById('hs-day').textContent = highDay;
  }
}
showHighScoreOnStart();

// ====== HELPERS ======
function floorY(f) { return HUD_H + (FLOORS - f) * FLOOR_H; }
function shaftX(i) { return BUILD_X + 20 + i * (SHAFT_W + SHAFT_GAP); }
function lobbyStartX() { return BUILD_X + 20 + ELEV_COUNT * SHAFT_W + (ELEV_COUNT - 1) * SHAFT_GAP + 15; }
function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpColor(c1, c2, t) {
  const r1 = parseInt(c1.slice(1,3),16), g1 = parseInt(c1.slice(3,5),16), b1 = parseInt(c1.slice(5,7),16);
  const r2 = parseInt(c2.slice(1,3),16), g2 = parseInt(c2.slice(3,5),16), b2 = parseInt(c2.slice(5,7),16);
  const r = Math.round(lerp(r1,r2,t)), g = Math.round(lerp(g1,g2,t)), b = Math.round(lerp(b1,b2,t));
  return `rgb(${r},${g},${b})`;
}

// ====== DAY/PERIOD GENERATION ======
function generatePeriods(day) {
  const diffScale = 1 + (day - 1) * 0.15; // 15% harder each day
  return BASE_PERIODS.map(bp => ({
    name: bp.name,
    dur: bp.dur + (day - 1) * 5, // longer days
    spawnRate: Math.min(bp.spawnRate * diffScale, 3.0),
    type: bp.type,
    floors: Math.min(bp.baseFloors + (day - 1) * 2, 20), // max 20 floors
    skyTop: bp.skyTop,
    skyBot: bp.skyBot,
  }));
}

// ====== INIT ======
function initGame() {
  currentDay = 1;
  periods = generatePeriods(1);
  selectedElev = 0;
  periodIdx = 0;
  FLOORS = periods[0].floors;
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
  periodDur = periods[0].dur;
  periodTimer = periodDur;
  spawnAcc = 0; tick = 0;
  gameActive = true;
  floatTexts = []; particles = [];
  combo = 0; comboTimer = 0; maxCombo = 0;
  satisAccum = 0; satisCount = 0;
  skyTransition = 0;
  elevSpeed = [2.8, 2.8, 2.8];
  elevCap = [6, 6, 6];
  doorSpeedMult = 1;
  patienceMult = 1;
  scoreMult = 1;
  periodDelivered = 0; periodCombo = 0;
  activeEvent = null; eventTimer = 0; eventCooldown = 15;
  brokenElevIdx = -1;
  lastTime = 0;
  tutorialStep = 0; tutorialTimer = 0; tutorialPulse = 0; firstDeliveryDone = false; tutorialElevSwitched = false; tutorialAngryShown = false;
  buildMobileFloors();
  updateHUD();
  document.getElementById('gameover-overlay').classList.remove('show');
  document.getElementById('upgrade-overlay').classList.remove('show');
  hideEventBanner();
}

// ====== SPAWN PEOPLE ======
function spawnPerson() {
  const period = periods[periodIdx];
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
  if (maxOnFloor >= 4) return;

  const isVIP = Math.random() < 0.08 + currentDay * 0.01;
  const basePatience = isVIP ? 10 + Math.random() * 5 : 15 + Math.random() * 10; // seconds
  waitingPeople.push({
    floor: fromFloor, dest: toFloor,
    waitTime: 0, maxWait: basePatience * patienceMult,
    type: PERSON_TYPES[randInt(0, PERSON_TYPES.length - 1)],
    angry: false, leaving: false, leaveTimer: 0,
    bobOffset: Math.random() * Math.PI * 2,
    slot: maxOnFloor,
    vip: isVIP,
    enterAnim: 1.0
  });
}

// ====== ELEVATOR LOGIC ======
function sendElevToFloor(elevIdx, floor) {
  const e = elevators[elevIdx];
  if (brokenElevIdx === elevIdx) return; // broken elevator can't move
  if (floor < 1 || floor > FLOORS) return;
  if (!e.queue.includes(floor) && e.floor !== floor) {
    e.queue.push(floor);
    sfxClick();
  } else if (e.floor === floor && e.doorOpen <= 0) {
    e.doorOpen = 0.9;
    handleArrival(e);
    sfxDing();
  }
}

function updateElevator(e, dt) {
  // Broken elevator: flash and skip
  if (brokenElevIdx === e.idx) {
    e.doorAnim = 0;
    return;
  }

  // door animation (in seconds)
  if (e.doorOpen > 0) {
    e.doorAnim = Math.min(1, e.doorAnim + 3.6 * doorSpeedMult * dt);
    e.doorOpen -= dt;
    if (e.doorOpen <= 0) {
      e.doorOpen = 0;
      e.doorAnim = 0;
    }
    return;
  }
  e.doorAnim = Math.max(0, e.doorAnim - 4.8 * doorSpeedMult * dt);

  // auto-pickup: if idle on a floor with waiting people
  if (!e.moving && e.queue.length === 0 && e.passengers.length < elevCap[e.idx]) {
    const waiting = waitingPeople.filter(p => p.floor === e.floor && !p.angry && !p.leaving);
    if (waiting.length > 0) {
      e.doorOpen = 0.9;
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
    const speed = elevSpeed[e.idx] * 60 * dt; // convert to per-frame equivalent
    const dist = Math.abs(e.y - ty);
    const accelSpeed = dist < FLOOR_H * 0.5 ? speed * 0.6 : speed;

    if (dist < accelSpeed + 0.5) {
      e.y = ty;
      e.floor = e.targetFloor;
      e.moving = false;
      e.queue.shift();
      e.doorOpen = 0.9;
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
          e.y = fy;
          e.moving = false;
          if (e.targetFloor !== e.floor) {
            e.queue.unshift(e.targetFloor);
          } else {
            e.queue.shift();
          }
          e.doorOpen = 0.9;
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
    const pts = (p.vip ? 25 : 10) * scoreMult;
    const comboMult = Math.min(combo + 1, 5);
    const total = Math.round(pts * comboMult);
    score += total;
    totalDelivered++;
    periodDelivered++;
    if (!firstDeliveryDone) { firstDeliveryDone = true; tutorialStep = 3; tutorialTimer = 0; }
    combo++;
    comboTimer = 3; // 3 seconds
    if (combo > maxCombo) maxCombo = combo;
    if (combo > periodCombo) periodCombo = combo;

    addFloatText(sx, e.y + 5, `+${total}`, combo >= 3 ? '#ffd54f' : '#a5d6a7');
    if (combo >= 3 && combo % 3 === 0) {
      sfxCombo();
      addFloatText(sx, e.y - 15, `${combo} COMBO!`, '#ffd54f', 18);
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
  if (e.queue.length > 1) {
    const dir = e.passengers.length > 0 ? (e.passengers[0].dest > e.floor ? 1 : -1) : 1;
    e.queue.sort((a, b) => dir > 0 ? a - b : b - a);
  }
}

// ====== SPECIAL EVENTS ======
const EVENT_TYPES = [
  { name: 'VIP Rush', desc: 'VIP visitors incoming!', color: '#ffd54f', duration: 8 },
  { name: 'Rush Hour', desc: 'Double the passengers!', color: '#ef5350', duration: 10 },
  { name: 'Elevator Down', desc: 'An elevator is broken!', color: '#ff7043', duration: 8 },
  { name: 'Happy Hour', desc: 'Passengers are more patient!', color: '#66bb6a', duration: 12 },
  { name: 'Score Frenzy', desc: 'Double points!', color: '#ba68c8', duration: 10 },
];

function triggerRandomEvent() {
  const pool = EVENT_TYPES.slice();
  const evt = pool[randInt(0, pool.length - 1)];
  activeEvent = { ...evt };
  eventTimer = evt.duration;

  if (evt.name === 'Elevator Down') {
    brokenElevIdx = randInt(0, ELEV_COUNT - 1);
    // force stop the broken elevator
    const be = elevators[brokenElevIdx];
    be.moving = false; be.queue = [];
    activeEvent.desc = `Elevator ${ELEV_NAMES[brokenElevIdx]} is broken!`;
  }

  sfxEvent();
  showEventBanner(activeEvent.desc, activeEvent.color);
}

function updateEvents(dt) {
  if (activeEvent) {
    eventTimer -= dt;
    if (eventTimer <= 0) {
      // end event
      if (activeEvent.name === 'Elevator Down') brokenElevIdx = -1;
      activeEvent = null;
      eventTimer = 0;
      hideEventBanner();
    }
  } else {
    eventCooldown -= dt;
    if (eventCooldown <= 0 && currentDay >= 1 && tutorialStep < 0) {
      // trigger event with some randomness
      if (Math.random() < 0.3) {
        triggerRandomEvent();
      }
      eventCooldown = 20 + Math.random() * 15; // 20-35 seconds between events
    }
  }
}

function getEventSpawnMult() {
  if (!activeEvent) return 1;
  if (activeEvent.name === 'Rush Hour') return 2;
  if (activeEvent.name === 'VIP Rush') return 1.5;
  return 1;
}

function getEventVIPBoost() {
  return activeEvent && activeEvent.name === 'VIP Rush' ? 0.4 : 0;
}

function getEventPatienceMult() {
  return activeEvent && activeEvent.name === 'Happy Hour' ? 1.5 : 1;
}

function getEventScoreMult() {
  return activeEvent && activeEvent.name === 'Score Frenzy' ? 2 : 1;
}

function showEventBanner(text, color) {
  const el = document.getElementById('event-banner');
  el.textContent = text;
  el.style.background = color + 'dd';
  el.classList.add('show');
}
function hideEventBanner() {
  document.getElementById('event-banner').classList.remove('show');
}

// ====== UPDATE ======
function update(dt) {
  tick += dt * 60; // keep tick for visual animations
  const period = periods[periodIdx];

  // sky transition
  skyTransition = 1 - (periodTimer / periodDur);

  // spawn
  const spawnMult = getEventSpawnMult();
  spawnAcc += period.spawnRate * spawnMult * dt;
  while (spawnAcc >= 1) {
    spawnPerson();
    spawnAcc -= 1;
  }

  // tutorial progression
  if (tutorialStep >= 0) {
    tutorialPulse += dt * 4;
    if (tutorialStep === 0 && waitingPeople.length > 0) {
      tutorialStep = 1; tutorialTimer = 0;
    }
    // step 3: "Nice!" auto-advance to step 4 after 2s
    if (tutorialStep === 3 && tutorialTimer >= 2) {
      tutorialStep = 4; tutorialTimer = 0;
    }
    // step 4: "Try all 3 elevators" — advanced by click handler when switching
    // step 5: "Watch the timer" auto-advance after 4s
    if (tutorialStep === 5 && tutorialTimer >= 4) {
      tutorialStep = 6; tutorialTimer = 0;
    }
    // step 6: "Passengers get angry" — check if someone is getting impatient
    if (tutorialStep === 6) {
      const impatient = waitingPeople.find(p => !p.angry && !p.leaving && p.waitTime > p.maxWait * 0.5);
      if (impatient || tutorialTimer >= 5) { tutorialAngryShown = true; }
      if (tutorialAngryShown && tutorialTimer >= 3) {
        tutorialStep = 7; tutorialTimer = 0;
      }
    }
    // step 7: "Use keyboard 1/2/3" auto-advance after 4s
    if (tutorialStep === 7 && tutorialTimer >= 4) {
      tutorialStep = 8; tutorialTimer = 0;
    }
    // step 8: "Keep satisfaction above 0%" auto-advance after 4s
    if (tutorialStep === 8 && tutorialTimer >= 4) {
      tutorialStep = 9; tutorialTimer = 0;
    }
    // step 9: "Morning almost done!" — show when <30% time left
    if (tutorialStep === 9 && periodTimer > periodDur * 0.3) {
      // wait until near end of morning, don't count timer yet
    } else if (tutorialStep === 9 && tutorialTimer >= 3) {
      tutorialStep = 10; tutorialTimer = 0;
    }
    // step 10: "You're ready!" fade out
    if (tutorialStep === 10 && tutorialTimer >= 2.5) {
      tutorialStep = -1;
    }
    if (tutorialStep >= 0) tutorialTimer += dt;
  }

  // combo decay
  if (comboTimer > 0) { comboTimer -= dt; }
  else if (combo > 0) { combo = 0; }

  // update events
  updateEvents(dt);

  // update waiting
  for (let i = waitingPeople.length - 1; i >= 0; i--) {
    const p = waitingPeople[i];
    if (p.leaving) {
      p.leaveTimer += dt;
      if (p.leaveTimer > 0.5) waitingPeople.splice(i, 1);
      continue;
    }
    if (p.enterAnim > 0) p.enterAnim = Math.max(0, p.enterAnim - 3 * dt);
    p.waitTime += dt;
    const effectiveMaxWait = p.maxWait * getEventPatienceMult();
    if (p.waitTime >= effectiveMaxWait && !p.angry) {
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
  for (const e of elevators) updateElevator(e, dt);

  // satisfaction
  const waitCount = waitingPeople.filter(p => !p.angry).length;
  const avgWait = waitCount > 0 ? waitingPeople.filter(p => !p.angry).reduce((s, p) => s + p.waitTime, 0) / waitCount : 0;
  if (avgWait > 5) satisfaction = Math.max(0, satisfaction - 1.2 * dt);
  else if (avgWait < 1.7 && satisfaction < 100) satisfaction = Math.min(100, satisfaction + 0.6 * dt);
  satisAccum += satisfaction; satisCount++;

  // fail condition
  if (satisfaction <= 0) {
    endGame(true);
    return;
  }

  // float texts
  for (const ft of floatTexts) { ft.y -= 48 * dt; ft.life -= dt; ft.scale = Math.min(1, ft.life / 0.17); }
  floatTexts = floatTexts.filter(f => f.life > 0);

  // particles
  for (const p of particles) {
    p.x += p.vx * 60 * dt; p.y += p.vy * 60 * dt; p.vy += 3.6 * dt;
    p.life -= dt; p.size *= Math.pow(0.97, 60 * dt);
  }
  particles = particles.filter(p => p.life > 0);

  // apply event score mult temporarily
  scoreMult = getEventScoreMult();

  // period timer
  periodTimer -= dt;
  if (periodTimer <= 0) {
    periodIdx++;
    if (periodIdx >= periods.length) {
      // Day complete! Start next day
      currentDay++;
      periods = generatePeriods(currentDay);
      periodIdx = 0;
      showUpgradeScreen(true); // day transition
      return;
    }
    showUpgradeScreen(false);
    return;
  }

  updateHUD();
}

// ====== EFFECTS ======
function addFloatText(x, y, text, color, size) {
  floatTexts.push({ x, y, text, color, life: 0.83, size: size || 14, scale: 1 });
}

function spawnBurst(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 1 + Math.random() * 3;
    particles.push({
      x, y, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 1.5,
      life: 0.33 + Math.random()*0.25, color, size: 2 + Math.random()*3
    });
  }
}

// ====== RENDER ======
function render() {
  drawSky();
  drawCitySilhouette();
  drawBuilding();
  drawElevatorShafts();
  drawWaitingPeople();
  drawElevatorCabs();

  // floor hover
  if (hoveredFloor > 0 && hoveredFloor <= FLOORS) {
    const fy = floorY(hoveredFloor);
    ctx.fillStyle = 'rgba(79,195,247,0.06)';
    ctx.fillRect(BUILD_X, fy, BUILD_W, FLOOR_H);
    ctx.strokeStyle = 'rgba(79,195,247,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(BUILD_X, fy, BUILD_W, FLOOR_H);
  }

  // float texts
  for (const ft of floatTexts) {
    const alpha = Math.min(1, ft.life / 0.25);
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${ft.size}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillStyle = ft.color;
    ctx.shadowColor = ft.color;
    ctx.shadowBlur = 8;
    ctx.fillText(ft.text, ft.x, ft.y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;

  // particles
  for (const p of particles) {
    ctx.globalAlpha = Math.min(1, p.life / 0.17);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // danger vignette when satisfaction is low
  drawDangerVignette();

  // tutorial overlay
  drawTutorial();

  // pause dim
  if (paused) {
    ctx.fillStyle = 'rgba(6,10,20,0.3)';
    ctx.fillRect(0, 0, W, H);
  }
}

function drawDangerVignette() {
  if (satisfaction >= 60) return;
  const intensity = 1 - satisfaction / 60; // 0 at 60%, 1 at 0%
  const pulse = Math.sin(tick * 0.12) * 0.3 + 0.7;
  const alpha = intensity * 0.35 * pulse;

  // red vignette from edges
  const grad = ctx.createRadialGradient(W/2, H/2, H * 0.3, W/2, H/2, H * 0.8);
  grad.addColorStop(0, 'transparent');
  grad.addColorStop(1, `rgba(200,30,30,${alpha})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

function drawSpotlightMask(cx, cy, r) {
  // dark overlay with circular cutout — the circle area stays bright
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2, true); // counter-clockwise = cutout
  ctx.closePath();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fill();
  ctx.restore();
}

function drawTutorial() {
  if (tutorialStep < 0) return;

  const pulse = (Math.sin(tutorialPulse) * 0.5 + 0.5); // 0-1 pulsing

  if (tutorialStep === 1) {
    // highlight elevator A with spotlight
    const e = elevators[0];
    const sx = shaftX(0);
    const cabY = e.y;
    const cabH = FLOOR_H - 4;
    const cx = sx + SHAFT_W / 2;
    const cy = cabY + cabH / 2;
    const radius = Math.max(SHAFT_W, cabH) * 0.65 + pulse * 5;

    // dim mask with cutout
    drawSpotlightMask(cx, cy, radius);

    // outer glow ring
    ctx.shadowColor = '#4fc3f7';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = `rgba(79,195,247,${0.5 + pulse * 0.4})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;

    // inner dashed ring (spinning)
    ctx.strokeStyle = `rgba(79,195,247,${0.2 + pulse * 0.2})`;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -tick * 0.3;
    ctx.beginPath(); ctx.arc(cx, cy, radius - 6, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // finger tap icon
    const fingerY = cy + radius + 10 + pulse * 3;
    ctx.font = '18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(79,195,247,${0.6 + pulse * 0.3})`;
    ctx.fillText('\u{1F446}', cx, fingerY + 5);

    drawTutorialBubble(cx, cabY - 35, 'Tap this elevator');
    // explain the number badge above passengers
    drawTutorialBubble(W / 2, H * 0.88, 'The number above a person = their destination floor');
  }

  if (tutorialStep === 2) {
    const person = waitingPeople.find(p => !p.angry && !p.leaving);
    if (person) {
      const fy = floorY(person.floor);
      const floorCX = BUILD_X + BUILD_W / 2;
      const floorCY = fy + FLOOR_H / 2;
      const circleR = Math.max(BUILD_W * 0.55, FLOOR_H * 0.6) + pulse * 4;

      // dim mask with cutout
      drawSpotlightMask(floorCX, floorCY, circleR);

      // outer glow ring
      ctx.shadowColor = '#ffd54f';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = `rgba(255,213,79,${0.5 + pulse * 0.4})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(floorCX, floorCY, circleR, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;

      // inner dashed ring
      ctx.strokeStyle = `rgba(255,213,79,${0.2 + pulse * 0.2})`;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -tick * 0.3;
      ctx.beginPath(); ctx.arc(floorCX, floorCY, circleR - 6, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;

      // finger tap icon
      const fingerY = floorCY + circleR + 10 + pulse * 3;
      ctx.font = '18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,213,79,${0.6 + pulse * 0.3})`;
      ctx.fillText('\u{1F446}', floorCX, fingerY + 5);

      drawTutorialBubble(floorCX, fy - 30, 'Tap this floor to send elevator');
    } else {
      drawTutorialBubble(W / 2, H / 2, 'Tap a floor to dispatch');
    }
  }

  if (tutorialStep === 3) {
    // explain auto-delivery after first success
    const alpha = Math.max(0, 1 - tutorialTimer / 1.8);
    ctx.globalAlpha = Math.max(0.15, alpha);
    drawTutorialBubble(W / 2, H * 0.3, 'Nice! Elevator auto-delivers passengers');
    drawTutorialBubble(W / 2, H * 0.3 + 32, 'Multiple passengers? Nearest floor first');
    ctx.globalAlpha = 1;
  }

  if (tutorialStep === 4) {
    // highlight elevators B and C
    for (let i = 1; i < ELEV_COUNT; i++) {
      const e = elevators[i];
      const sx = shaftX(i);
      const cabY = e.y;
      const cabH = FLOOR_H - 4;
      const cx = sx + SHAFT_W / 2;
      const cy = cabY + cabH / 2;
      const radius = Math.max(SHAFT_W, cabH) * 0.6 + pulse * 6;
      ctx.strokeStyle = `rgba(129,199,132,${0.3 + pulse * 0.4})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();
    }
    drawTutorialBubble(W / 2, H * 0.25, 'Try selecting all 3 elevators!');
  }

  if (tutorialStep === 5) {
    // highlight the period timer bar
    // draw arrow pointing to HUD center area
    const cx = W / 2;
    const arrowY = HUD_H + 8 + pulse * 4;
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath();
    ctx.moveTo(cx, arrowY - 8);
    ctx.lineTo(cx - 8, arrowY + 4);
    ctx.lineTo(cx + 8, arrowY + 4);
    ctx.closePath();
    ctx.fill();
    drawTutorialBubble(W / 2, arrowY + 22, 'Watch the timer — deliver before it runs out!');
  }

  if (tutorialStep === 6) {
    // highlight angry passenger or warn about patience
    const impatient = waitingPeople.find(p => !p.angry && !p.leaving && p.waitTime > p.maxWait * 0.4);
    if (impatient) {
      const fy = floorY(impatient.floor);
      ctx.strokeStyle = `rgba(239,83,80,${0.3 + pulse * 0.5})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(BUILD_X, fy, BUILD_W, FLOOR_H);
    }
    drawTutorialBubble(W / 2, H * 0.3, 'Passengers get angry if they wait too long!');
  }

  if (tutorialStep === 7) {
    // keyboard hint
    drawTutorialBubble(W / 2, H * 0.35, 'Tip: Press 1, 2, 3 to quickly switch elevators');
  }

  if (tutorialStep === 8) {
    // highlight satisfaction meter
    const arrowX = W - 80;
    const arrowY = HUD_H + 8 + pulse * 4;
    ctx.fillStyle = '#ef5350';
    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY - 8);
    ctx.lineTo(arrowX - 8, arrowY + 4);
    ctx.lineTo(arrowX + 8, arrowY + 4);
    ctx.closePath();
    ctx.fill();
    drawTutorialBubble(W / 2, arrowY + 22, 'Keep satisfaction above 0% or game over!');
  }

  if (tutorialStep === 9) {
    drawTutorialBubble(W / 2, H * 0.35, 'Morning rush almost done — keep it up!');
  }

  if (tutorialStep === 10) {
    const alpha = Math.max(0, 1 - tutorialTimer / 2);
    ctx.globalAlpha = Math.max(0, alpha);
    drawTutorialBubble(W / 2, H * 0.35, "You're ready! Good luck!");
    ctx.globalAlpha = 1;
  }
}

function drawTutorialBubble(x, y, text) {
  ctx.font = 'bold 14px -apple-system, sans-serif';
  const metrics = ctx.measureText(text);
  const tw = metrics.width;
  const padX = 14;
  const bw = tw + padX * 2;
  const bh = 28;
  const bx = x - bw / 2;
  const by = y - bh / 2;

  // background
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.fill();

  // border
  ctx.strokeStyle = 'rgba(79,195,247,0.5)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, bx, by, bw, bh, 8);
  ctx.stroke();

  // text
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.textBaseline = 'alphabetic';
}

function drawSky() {
  const period = periods[periodIdx];
  const nextPeriod = periods[Math.min(periodIdx + 1, periods.length - 1)];
  const t = Math.min(1, skyTransition);

  const topColor = lerpColor(period.skyTop, nextPeriod.skyTop, t * 0.3);
  const botColor = lerpColor(period.skyBot, nextPeriod.skyBot, t * 0.3);

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, topColor);
  sky.addColorStop(0.6, botColor);
  sky.addColorStop(1, '#0a0e1a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // stars
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
    const sunX = W * 0.2 + skyTransition * W * 0.1;
    const sunY = H * 0.12;
    const sunGlow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 60);
    sunGlow.addColorStop(0, 'rgba(255,235,59,0.4)');
    sunGlow.addColorStop(0.5, 'rgba(255,235,59,0.08)');
    sunGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(sunX - 60, sunY - 60, 120, 120);
    ctx.fillStyle = '#fff8e1';
    ctx.beginPath(); ctx.arc(sunX, sunY, 14, 0, Math.PI * 2); ctx.fill();
  } else if (periodIdx === 2) {
    const moonX = W * 0.82, moonY = H * 0.1;
    ctx.fillStyle = '#e8eaf6';
    ctx.beginPath(); ctx.arc(moonX, moonY, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = periods[2].skyTop;
    ctx.beginPath(); ctx.arc(moonX + 4, moonY - 3, 10, 0, Math.PI * 2); ctx.fill();
  }

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

  const lx = BUILD_X - 20;
  for (let i = 0; i < 4; i++) {
    const bw = 20 + Math.sin(i * 2.3) * 8;
    const bh = 60 + i * 40 + Math.sin(i * 1.7) * 30;
    const bx = lx - (i + 1) * (bw + 8);
    ctx.fillRect(bx, baseY - bh, bw, bh);
    ctx.fillStyle = 'rgba(255,220,120,0.08)';
    for (let wy = baseY - bh + 8; wy < baseY - 6; wy += 12) {
      for (let wx = bx + 4; wx < bx + bw - 4; wx += 8) {
        if (Math.sin(wx * 3.1 + wy * 2.7 + tick * 0.005) > 0.3)
          ctx.fillRect(wx, wy, 4, 6);
      }
    }
    ctx.fillStyle = 'rgba(8,12,24,0.7)';
  }

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

  // building shadow — soft layered
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(bx + 10, by + 6, bw + 2, bh + 6);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(bx + 5, by + 3, bw + 1, bh + 3);

  // main building body — warm concrete facade
  const bGrad = ctx.createLinearGradient(bx, by, bx + bw, by + bh);
  bGrad.addColorStop(0, '#1e2d3d');
  bGrad.addColorStop(0.3, '#233448');
  bGrad.addColorStop(0.6, '#263a50');
  bGrad.addColorStop(1, '#1c2a3a');
  ctx.fillStyle = bGrad;
  roundRect(ctx, bx, by, bw, bh, 3);
  ctx.fill();

  // subtle glass sheen — gentle diagonal
  const refl = ctx.createLinearGradient(bx, by, bx + bw * 0.6, by + bh * 0.6);
  refl.addColorStop(0, 'rgba(160,210,240,0.05)');
  refl.addColorStop(0.3, 'rgba(160,210,240,0.02)');
  refl.addColorStop(0.7, 'rgba(160,210,240,0)');
  refl.addColorStop(1, 'rgba(160,210,240,0.03)');
  ctx.fillStyle = refl;
  ctx.fillRect(bx, by, bw, bh);

  // horizontal floor dividers
  for (let f = 1; f <= FLOORS; f++) {
    const fy = floorY(f);

    // clean floor separator
    ctx.fillStyle = 'rgba(80,120,160,0.18)';
    ctx.fillRect(bx + 1, fy + FLOOR_H - 1, bw - 2, 1.5);
    // subtle shadow below separator
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(bx + 1, fy + FLOOR_H + 0.5, bw - 2, 1);

    // floor number — clean rounded tag
    const plateX = bx + 6;
    const plateY = fy + FLOOR_H * 0.5;
    const plateW = 22, plateH = 14;
    // tag bg
    ctx.fillStyle = 'rgba(15,25,40,0.65)';
    roundRect(ctx, plateX, plateY - plateH/2, plateW, plateH, 4);
    ctx.fill();
    // tag subtle border
    ctx.strokeStyle = 'rgba(100,160,220,0.12)';
    ctx.lineWidth = 0.5;
    roundRect(ctx, plateX, plateY - plateH/2, plateW, plateH, 4);
    ctx.stroke();
    // floor number text
    ctx.font = 'bold 9px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(130,190,240,0.8)';
    ctx.fillText(`${f}F`, plateX + plateW/2, plateY + 3);

    // windows — cleaner rounded glass panels
    const winStartX = bx + 34;
    const winAreaW = LOBBY_W - 10;
    const winW = 14, winH = Math.max(8, FLOOR_H - 12), winGap = 5;
    const winCount = Math.floor(winAreaW / (winW + winGap));

    for (let w = 0; w < winCount; w++) {
      const wx = winStartX + w * (winW + winGap);
      const wy = fy + (FLOOR_H - winH) / 2;
      const seed = f * 7.3 + w * 13.7;
      const lit = Math.sin(seed + tick * 0.008) > 0.2;
      const warmLit = Math.sin(seed * 0.7 + tick * 0.003) > 0.55;

      // window base color
      if (warmLit && (periodIdx === 0 || periodIdx === 2)) {
        const wGlow = ctx.createLinearGradient(wx, wy, wx, wy + winH);
        wGlow.addColorStop(0, 'rgba(255,225,150,0.28)');
        wGlow.addColorStop(0.7, 'rgba(255,200,120,0.12)');
        wGlow.addColorStop(1, 'rgba(255,180,90,0.06)');
        ctx.fillStyle = wGlow;
      } else if (lit) {
        ctx.fillStyle = periodIdx === 1 ? 'rgba(120,200,255,0.12)' : 'rgba(160,195,230,0.08)';
      } else {
        ctx.fillStyle = 'rgba(10,18,30,0.5)';
      }
      roundRect(ctx, wx, wy, winW, winH, 2);
      ctx.fill();

      // window frame
      ctx.strokeStyle = 'rgba(80,130,180,0.13)';
      ctx.lineWidth = 0.8;
      roundRect(ctx, wx, wy, winW, winH, 2);
      ctx.stroke();

      // center cross
      ctx.strokeStyle = 'rgba(80,130,180,0.06)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(wx + winW/2, wy + 1); ctx.lineTo(wx + winW/2, wy + winH - 1);
      ctx.stroke();

      // warm-lit window details
      if (warmLit && (periodIdx === 0 || periodIdx === 2)) {
        // subtle warm glow spill
        ctx.shadowColor = 'rgba(255,200,100,0.1)';
        ctx.shadowBlur = 4;
        ctx.fillStyle = 'rgba(255,220,150,0.04)';
        ctx.fillRect(wx - 2, wy - 1, winW + 4, winH + 2);
        ctx.shadowBlur = 0;
        // small plant on windowsill
        if (Math.sin(seed * 3.1) > 0.5) {
          ctx.fillStyle = 'rgba(90,170,90,0.2)';
          ctx.beginPath();
          ctx.arc(wx + winW/2, wy + winH - 2, 3, Math.PI, 0);
          ctx.fill();
        }
      }
    }

    // floor interior back wall tint
    const lobbyX = lobbyStartX();
    ctx.fillStyle = 'rgba(12,20,32,0.25)';
    ctx.fillRect(lobbyX, fy + 1, LOBBY_W, FLOOR_H - 2);
  }

  // vertical edge columns — subtle
  const colGrad = ctx.createLinearGradient(bx, by, bx + 4, by);
  colGrad.addColorStop(0, 'rgba(60,90,120,0.2)');
  colGrad.addColorStop(1, 'rgba(60,90,120,0.05)');
  ctx.fillStyle = colGrad;
  ctx.fillRect(bx, by, 4, bh);
  const colGrad2 = ctx.createLinearGradient(bx + bw - 4, by, bx + bw, by);
  colGrad2.addColorStop(0, 'rgba(60,90,120,0.05)');
  colGrad2.addColorStop(1, 'rgba(60,90,120,0.2)');
  ctx.fillStyle = colGrad2;
  ctx.fillRect(bx + bw - 4, by, 4, bh);

  // building outline — single clean border
  ctx.strokeStyle = 'rgba(80,130,180,0.2)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, bx, by, bw, bh, 3);
  ctx.stroke();

  // left edge light reflection
  ctx.strokeStyle = 'rgba(160,210,240,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(bx + 1.5, by + 4); ctx.lineTo(bx + 1.5, by + bh - 4); ctx.stroke();

  // ====== ROOFTOP ======
  const parapetH = 7;
  const parapetGrad = ctx.createLinearGradient(bx, by - parapetH, bx, by);
  parapetGrad.addColorStop(0, '#2c4560');
  parapetGrad.addColorStop(1, '#213550');
  ctx.fillStyle = parapetGrad;
  roundRect(ctx, bx + 4, by - parapetH, bw - 8, parapetH, 2);
  ctx.fill();
  // parapet top highlight
  ctx.fillStyle = 'rgba(100,160,220,0.15)';
  ctx.fillRect(bx + 5, by - parapetH, bw - 10, 1);

  // simple railing
  ctx.strokeStyle = 'rgba(90,140,190,0.2)';
  ctx.lineWidth = 0.8;
  for (let rx = bx + 14; rx < bx + bw - 14; rx += 14) {
    ctx.beginPath(); ctx.moveTo(rx, by - parapetH); ctx.lineTo(rx, by - parapetH - 8); ctx.stroke();
  }
  ctx.beginPath(); ctx.moveTo(bx + 14, by - parapetH - 8); ctx.lineTo(bx + bw - 14, by - parapetH - 8); ctx.stroke();

  // rooftop AC unit
  ctx.fillStyle = '#1c3248';
  roundRect(ctx, bx + 18, by - parapetH - 7, 13, 7, 1.5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(80,130,180,0.15)'; ctx.lineWidth = 0.5;
  roundRect(ctx, bx + 18, by - parapetH - 7, 13, 7, 1.5);
  ctx.stroke();
  // fan
  ctx.strokeStyle = 'rgba(100,170,230,0.2)';
  ctx.lineWidth = 0.8;
  const fanX = bx + 24.5, fanY = by - parapetH - 3.5;
  const fanAngle = tick * 0.15;
  for (let fi = 0; fi < 3; fi++) {
    const a = fanAngle + fi * Math.PI * 2 / 3;
    ctx.beginPath(); ctx.moveTo(fanX, fanY);
    ctx.lineTo(fanX + Math.cos(a) * 3.5, fanY + Math.sin(a) * 2.5);
    ctx.stroke();
  }

  // second AC unit — smaller
  ctx.fillStyle = '#1c3248';
  roundRect(ctx, bx + bw - 36, by - parapetH - 5, 10, 5, 1.5);
  ctx.fill();

  // antenna — simpler
  const antX = bx + bw * 0.5;
  const antBase = by - parapetH - 8;
  ctx.strokeStyle = '#4a6a8a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(antX, antBase); ctx.lineTo(antX, antBase - 18); ctx.stroke();
  // crossbar
  ctx.strokeStyle = 'rgba(80,130,180,0.25)'; ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.moveTo(antX - 4, antBase - 7); ctx.lineTo(antX + 4, antBase - 7); ctx.stroke();
  // blinking red light
  const blink = Math.sin(tick * 0.1) > 0.3;
  if (blink) {
    ctx.fillStyle = '#ef5350';
    ctx.shadowColor = '#ef5350'; ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(antX, antBase - 20, 2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ====== GROUND FLOOR ENTRANCE ======
  const gfy = floorY(1);
  const entranceW = 42;
  const entranceX = bx + (34 + LOBBY_W/2) - entranceW/2;

  // entrance warm ambient glow
  const entGlow = ctx.createRadialGradient(entranceX + entranceW/2, gfy + FLOOR_H/2, 4, entranceX + entranceW/2, gfy + FLOOR_H/2, 35);
  entGlow.addColorStop(0, 'rgba(255,225,150,0.12)');
  entGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = entGlow;
  ctx.fillRect(entranceX - 15, gfy - 8, entranceW + 30, FLOOR_H + 16);

  // door frame
  ctx.fillStyle = '#263e55';
  roundRect(ctx, entranceX - 2, gfy + 3, entranceW + 4, FLOOR_H - 3, 2);
  ctx.fill();
  // glass door panels
  const doorGrad = ctx.createLinearGradient(entranceX, gfy, entranceX, gfy + FLOOR_H);
  doorGrad.addColorStop(0, 'rgba(255,240,210,0.18)');
  doorGrad.addColorStop(0.5, 'rgba(255,225,160,0.1)');
  doorGrad.addColorStop(1, 'rgba(255,210,130,0.04)');
  ctx.fillStyle = doorGrad;
  roundRect(ctx, entranceX + 1, gfy + 5, entranceW/2 - 3, FLOOR_H - 8, 1.5);
  ctx.fill();
  roundRect(ctx, entranceX + entranceW/2 + 2, gfy + 5, entranceW/2 - 3, FLOOR_H - 8, 1.5);
  ctx.fill();
  // door handles
  ctx.fillStyle = 'rgba(200,185,150,0.35)';
  ctx.fillRect(entranceX + entranceW/2 - 3, gfy + FLOOR_H * 0.4, 1.5, 7);
  ctx.fillRect(entranceX + entranceW/2 + 1.5, gfy + FLOOR_H * 0.4, 1.5, 7);
  // door frame line
  ctx.strokeStyle = 'rgba(200,180,140,0.15)';
  ctx.lineWidth = 0.8;
  ctx.strokeRect(entranceX, gfy + 4, entranceW, FLOOR_H - 6);

  // canopy
  ctx.fillStyle = '#2a4560';
  ctx.beginPath();
  ctx.moveTo(entranceX - 10, gfy + 3);
  ctx.lineTo(entranceX + entranceW + 10, gfy + 3);
  ctx.lineTo(entranceX + entranceW + 6, gfy - 3);
  ctx.lineTo(entranceX - 6, gfy - 3);
  ctx.closePath();
  ctx.fill();
  // canopy edge highlight
  ctx.strokeStyle = 'rgba(130,180,220,0.12)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(entranceX - 6, gfy - 3);
  ctx.lineTo(entranceX + entranceW + 6, gfy - 3);
  ctx.stroke();

  // ====== GROUND / SIDEWALK ======
  ctx.fillStyle = '#0c1520';
  ctx.fillRect(0, gfy + FLOOR_H, W, H - gfy - FLOOR_H);
  // pavement
  const paveGrad = ctx.createLinearGradient(0, gfy + FLOOR_H, 0, gfy + FLOOR_H + 10);
  paveGrad.addColorStop(0, 'rgba(55,75,95,0.45)');
  paveGrad.addColorStop(1, 'rgba(35,55,75,0.15)');
  ctx.fillStyle = paveGrad;
  ctx.fillRect(bx - 35, gfy + FLOOR_H, bw + 70, 10);
  // curb line
  ctx.fillStyle = 'rgba(80,110,140,0.25)';
  ctx.fillRect(bx - 35, gfy + FLOOR_H, bw + 70, 1.5);
  // pavement joints
  ctx.strokeStyle = 'rgba(70,90,110,0.1)';
  ctx.lineWidth = 0.5;
  for (let px = bx - 25; px < bx + bw + 25; px += 22) {
    ctx.beginPath(); ctx.moveTo(px, gfy + FLOOR_H + 2); ctx.lineTo(px, gfy + FLOOR_H + 10); ctx.stroke();
  }
}

// ====== DETAILED PERSON DRAWING ======
// draws a person at (x, y=feet position) with given scale and type data
function drawPersonDetailed(x, y, scale, type, isAngry) {
  const s = scale;

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath(); ctx.ellipse(x, y + 2 * s, 5 * s, 1.5 * s, 0, 0, Math.PI * 2); ctx.fill();

  // legs
  ctx.strokeStyle = type.pants;
  ctx.lineWidth = 2.5 * s;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x - 2.5 * s, y - 7 * s); ctx.lineTo(x - 3 * s, y); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + 2.5 * s, y - 7 * s); ctx.lineTo(x + 3 * s, y); ctx.stroke();

  // shoes
  ctx.fillStyle = '#37474f';
  ctx.beginPath(); ctx.ellipse(x - 3 * s, y + 1 * s, 2.5 * s, 1.2 * s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + 3 * s, y + 1 * s, 2.5 * s, 1.2 * s, 0, 0, Math.PI * 2); ctx.fill();

  // body / torso
  ctx.fillStyle = type.body;
  roundRect(ctx, x - 5.5 * s, y - 16 * s, 11 * s, 10 * s, 3 * s);
  ctx.fill();

  // arms
  ctx.strokeStyle = type.body;
  ctx.lineWidth = 2.5 * s;
  const armSwing = isAngry ? Math.sin(tick * 0.4) * 3 * s : Math.sin(tick * 0.04 + x) * 1.5 * s;
  // left arm
  ctx.beginPath();
  ctx.moveTo(x - 5.5 * s, y - 14 * s);
  ctx.lineTo(x - 8 * s, y - 8 * s + armSwing);
  ctx.stroke();
  // right arm
  ctx.beginPath();
  ctx.moveTo(x + 5.5 * s, y - 14 * s);
  ctx.lineTo(x + 8 * s, y - 8 * s - armSwing);
  ctx.stroke();

  // hands
  ctx.fillStyle = type.head;
  ctx.beginPath(); ctx.arc(x - 8 * s, y - 7.5 * s + armSwing, 1.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 8 * s, y - 7.5 * s - armSwing, 1.5 * s, 0, Math.PI * 2); ctx.fill();

  // neck
  ctx.fillStyle = type.head;
  ctx.fillRect(x - 1.5 * s, y - 18 * s, 3 * s, 3 * s);

  // head
  ctx.fillStyle = type.head;
  ctx.beginPath(); ctx.arc(x, y - 21 * s, 5.5 * s, 0, Math.PI * 2); ctx.fill();

  // hair
  ctx.fillStyle = type.hair;
  if (type.hairStyle === 'short') {
    ctx.beginPath(); ctx.arc(x, y - 23 * s, 5 * s, Math.PI, 0, false); ctx.fill();
    ctx.fillRect(x - 5 * s, y - 23 * s, 10 * s, 2 * s);
  } else if (type.hairStyle === 'long') {
    ctx.beginPath(); ctx.arc(x, y - 23 * s, 5.5 * s, Math.PI, 0, false); ctx.fill();
    // flowing sides
    ctx.fillRect(x - 5.5 * s, y - 23 * s, 2.5 * s, 9 * s);
    ctx.fillRect(x + 3 * s, y - 23 * s, 2.5 * s, 9 * s);
  } else if (type.hairStyle === 'bun') {
    ctx.beginPath(); ctx.arc(x, y - 23 * s, 5 * s, Math.PI, 0, false); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - 27 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
  } else if (type.hairStyle === 'spiky') {
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 2.5 * s, y - 23 * s);
      ctx.lineTo(x + i * 2 * s, y - 29 * s);
      ctx.lineTo(x + i * 2.5 * s + 2 * s, y - 23 * s);
      ctx.fill();
    }
  } else if (type.hairStyle === 'pony') {
    ctx.beginPath(); ctx.arc(x, y - 23 * s, 5 * s, Math.PI, 0, false); ctx.fill();
    // ponytail
    ctx.beginPath();
    ctx.moveTo(x + 4 * s, y - 23 * s);
    ctx.quadraticCurveTo(x + 10 * s, y - 22 * s, x + 8 * s, y - 15 * s);
    ctx.lineTo(x + 5 * s, y - 22 * s);
    ctx.fill();
  }
  // bald = no hair drawn

  // eyes
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(x - 2 * s, y - 21.5 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 2 * s, y - 21.5 * s, 1.5 * s, 0, Math.PI * 2); ctx.fill();
  // pupils
  ctx.fillStyle = isAngry ? '#ef5350' : '#212121';
  ctx.beginPath(); ctx.arc(x - 1.5 * s, y - 21.5 * s, 0.8 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 2.5 * s, y - 21.5 * s, 0.8 * s, 0, Math.PI * 2); ctx.fill();

  // mouth
  if (isAngry) {
    ctx.strokeStyle = '#ef5350';
    ctx.lineWidth = 0.8 * s;
    ctx.beginPath();
    ctx.moveTo(x - 2 * s, y - 18 * s);
    ctx.lineTo(x, y - 19 * s);
    ctx.lineTo(x + 2 * s, y - 18 * s);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#795548';
    ctx.lineWidth = 0.6 * s;
    ctx.beginPath();
    ctx.arc(x, y - 19 * s, 1.5 * s, 0.1 * Math.PI, 0.9 * Math.PI);
    ctx.stroke();
  }

  ctx.lineCap = 'butt';
}

// mini version for inside elevator cab
function drawPersonMini(x, y, scale, color, headColor) {
  const s = scale;
  // body
  ctx.fillStyle = color;
  roundRect(ctx, x - 3 * s, y - 6 * s, 6 * s, 7 * s, 1.5 * s);
  ctx.fill();
  // head
  ctx.fillStyle = headColor || '#ffcc80';
  ctx.beginPath(); ctx.arc(x, y - 9 * s, 3 * s, 0, Math.PI * 2); ctx.fill();
  // eyes
  ctx.fillStyle = '#212121';
  ctx.beginPath(); ctx.arc(x - 1 * s, y - 9.5 * s, 0.5 * s, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + 1 * s, y - 9.5 * s, 0.5 * s, 0, Math.PI * 2); ctx.fill();
}

function drawWaitingPeople() {
  for (const p of waitingPeople) {
    if (p.leaving) {
      const alpha = 1 - p.leaveTimer / 0.5;
      ctx.globalAlpha = alpha;
    }

    const totalShaftW = ELEV_COUNT * SHAFT_W + (ELEV_COUNT - 1) * SHAFT_GAP;
    const shaftCenterX = shaftX(0) + totalShaftW / 2;
    const px = shaftCenterX - totalShaftW * 0.4 + p.slot * (totalShaftW / 3);
    const fy = floorY(p.floor);
    const py = fy + FLOOR_H * 0.85;
    const bob = Math.sin(tick * 0.06 + p.bobOffset) * 1.0;
    const slideIn = p.enterAnim * -30;

    const dx = px + slideIn;
    const dy = py + bob;

    const effectiveMaxWait = p.maxWait * getEventPatienceMult();
    const urgency = p.waitTime / effectiveMaxWait;
    const isAngry = urgency > 0.7;

    // draw the person
    const personScale = Math.min(1.0, FLOOR_H / 36);
    drawPersonDetailed(dx, dy, personScale, p.type, isAngry);

    // VIP tag
    if (p.vip) {
      ctx.fillStyle = '#ffd54f';
      ctx.font = `bold ${Math.round(9 * personScale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('VIP', dx, dy - 30 * personScale);
    }

    // destination badge above head
    let badgeColor;
    if (urgency > 0.75) badgeColor = '#ef5350';
    else if (urgency > 0.45) badgeColor = '#ffa726';
    else badgeColor = '#66bb6a';

    const badgeX = dx;
    const badgeY = dy - 33 * personScale - (p.vip ? 10 * personScale : 0);
    ctx.fillStyle = badgeColor;
    ctx.shadowColor = badgeColor;
    ctx.shadowBlur = urgency > 0.6 ? 8 : 0;
    ctx.beginPath(); ctx.arc(badgeX, badgeY, 9 * personScale, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(12 * personScale)}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.dest, badgeX, badgeY);
    ctx.textBaseline = 'alphabetic';

    // urgency exclamation
    if (urgency > 0.7) {
      const shake = Math.sin(tick * 0.3) * 2;
      ctx.fillStyle = '#ef5350';
      ctx.font = `bold ${Math.round(11 * personScale)}px sans-serif`;
      ctx.fillText('!', dx + 12 * personScale + shake, badgeY);
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
    const sw = SHAFT_W;

    // shaft deep background
    const shaftGrad = ctx.createLinearGradient(sx, shaftY, sx + sw, shaftY);
    shaftGrad.addColorStop(0, '#121c2a');
    shaftGrad.addColorStop(0.15, '#0d1620');
    shaftGrad.addColorStop(0.5, '#0a1018');
    shaftGrad.addColorStop(0.85, '#0d1620');
    shaftGrad.addColorStop(1, '#121c2a');
    ctx.fillStyle = shaftGrad;
    ctx.fillRect(sx, shaftY, sw, shaftH);

    // broken elevator tint
    if (brokenElevIdx === i) {
      ctx.fillStyle = `rgba(255,30,30,${0.04 + Math.sin(tick * 0.15) * 0.03})`;
      ctx.fillRect(sx, shaftY, sw, shaftH);
    }

    // shaft walls — brushed metal inset
    const lwGrad = ctx.createLinearGradient(sx, shaftY, sx + 3, shaftY);
    lwGrad.addColorStop(0, 'rgba(70,100,130,0.18)');
    lwGrad.addColorStop(1, 'rgba(40,60,80,0.04)');
    ctx.fillStyle = lwGrad;
    ctx.fillRect(sx, shaftY, 3, shaftH);
    const rwGrad = ctx.createLinearGradient(sx + sw - 3, shaftY, sx + sw, shaftY);
    rwGrad.addColorStop(0, 'rgba(40,60,80,0.04)');
    rwGrad.addColorStop(1, 'rgba(70,100,130,0.18)');
    ctx.fillStyle = rwGrad;
    ctx.fillRect(sx + sw - 3, shaftY, 3, shaftH);

    // guide rails — T-profile
    ctx.fillStyle = 'rgba(80,110,140,0.08)';
    ctx.fillRect(sx + 3, shaftY, 2, shaftH);
    ctx.fillRect(sx + sw - 5, shaftY, 2, shaftH);
    // rail highlight
    ctx.fillStyle = 'rgba(120,160,200,0.04)';
    ctx.fillRect(sx + 3, shaftY, 0.5, shaftH);
    ctx.fillRect(sx + sw - 5, shaftY, 0.5, shaftH);

    // floor landing doors — stainless steel look
    for (let f = 1; f <= FLOORS; f++) {
      const fy = floorY(f);
      const doorX = sx + 6;
      const doorW = sw - 12;
      const doorY = fy + 3;
      const doorH = FLOOR_H - 5;

      // door recess shadow
      ctx.fillStyle = 'rgba(5,10,18,0.5)';
      roundRect(ctx, doorX - 1, doorY - 1, doorW + 2, doorH + 2, 2);
      ctx.fill();

      // closed landing doors — brushed steel
      const ldGrad = ctx.createLinearGradient(doorX, doorY, doorX + doorW, doorY);
      ldGrad.addColorStop(0, 'rgba(55,70,85,0.55)');
      ldGrad.addColorStop(0.3, 'rgba(70,88,105,0.5)');
      ldGrad.addColorStop(0.48, 'rgba(60,78,95,0.55)');
      ldGrad.addColorStop(0.52, 'rgba(55,72,88,0.6)');
      ldGrad.addColorStop(0.7, 'rgba(70,88,105,0.5)');
      ldGrad.addColorStop(1, 'rgba(55,70,85,0.55)');
      ctx.fillStyle = ldGrad;
      roundRect(ctx, doorX, doorY, doorW, doorH, 1.5);
      ctx.fill();

      // center seam (two-panel door)
      ctx.strokeStyle = 'rgba(30,45,60,0.4)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(sx + sw / 2, doorY + 2);
      ctx.lineTo(sx + sw / 2, doorY + doorH - 2);
      ctx.stroke();

      // door frame — thin metallic border
      ctx.strokeStyle = 'rgba(90,120,150,0.12)';
      ctx.lineWidth = 1;
      roundRect(ctx, doorX, doorY, doorW, doorH, 1.5);
      ctx.stroke();

      // floor indicator above door — LED display
      const indW = Math.min(18, sw * 0.28);
      const indH = 7;
      const indX = sx + sw / 2 - indW / 2;
      const indY = fy + 1;
      // indicator bg
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      roundRect(ctx, indX, indY, indW, indH, 2);
      ctx.fill();
      // LED number
      ctx.fillStyle = e.color + '77';
      ctx.font = `bold ${Math.min(6, sw * 0.1)}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f, sx + sw / 2, indY + indH / 2);
      ctx.textBaseline = 'alphabetic';

      // call button — small circle beside door
      const btnR = 2;
      const btnX = doorX + doorW + 3;
      const btnY = fy + FLOOR_H / 2;
      if (btnX + btnR < sx + sw) {
        ctx.fillStyle = 'rgba(40,55,70,0.4)';
        ctx.beginPath(); ctx.arc(btnX, btnY, btnR + 0.5, 0, Math.PI * 2); ctx.fill();
        // lit if in queue
        const inQueue = e.queue.includes(f);
        ctx.fillStyle = inQueue ? e.color + 'aa' : 'rgba(60,80,100,0.3)';
        ctx.beginPath(); ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2); ctx.fill();
        if (inQueue) {
          ctx.shadowColor = e.color;
          ctx.shadowBlur = 4;
          ctx.beginPath(); ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2); ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }

    // cables — twin steel wires
    const cableX = sx + sw / 2;
    ctx.strokeStyle = 'rgba(140,170,200,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cableX - 1.5, shaftY); ctx.lineTo(cableX - 1.5, e.y + 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cableX + 1.5, shaftY); ctx.lineTo(cableX + 1.5, e.y + 2); ctx.stroke();
    // cable highlight
    ctx.strokeStyle = 'rgba(180,210,240,0.04)';
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cableX - 1, shaftY); ctx.lineTo(cableX - 1, e.y + 2); ctx.stroke();
  }
}

function drawElevatorCabs() {
  for (let i = 0; i < ELEV_COUNT; i++) {
    const e = elevators[i];
    const sx = shaftX(i);
    const sw = SHAFT_W;
    const cabY = e.y;
    const cabH = FLOOR_H - 4;
    const cabX = sx + 3;
    const cabW = sw - 6;
    const m = sw / 70; // scale factor relative to default shaft width

    // broken elevator: dim and flash
    if (brokenElevIdx === i) {
      ctx.globalAlpha = 0.3 + Math.sin(tick * 0.2) * 0.15;
    }

    // ---- cab outer shell — stainless steel ----
    // outer glow (subtle for unselected, brighter for selected)
    ctx.shadowColor = e.color;
    ctx.shadowBlur = i === selectedElev ? 16 : 4;

    // main body — brushed steel gradient (top to bottom)
    const bodyGrad = ctx.createLinearGradient(cabX, cabY, cabX, cabY + cabH);
    bodyGrad.addColorStop(0, '#c8c0b0');
    bodyGrad.addColorStop(0.03, '#d8d0c0');
    bodyGrad.addColorStop(0.08, '#e8e0d2');
    bodyGrad.addColorStop(0.5, '#ddd5c5');
    bodyGrad.addColorStop(0.92, '#ccc4b4');
    bodyGrad.addColorStop(1, '#b8b0a0');
    ctx.fillStyle = bodyGrad;
    roundRect(ctx, cabX, cabY + 1, cabW, cabH, 4);
    ctx.fill();
    ctx.shadowBlur = 0;

    // horizontal brushed texture lines
    ctx.strokeStyle = 'rgba(0,0,0,0.03)';
    ctx.lineWidth = 0.5;
    for (let ty = cabY + 6; ty < cabY + cabH - 4; ty += 3) {
      ctx.beginPath();
      ctx.moveTo(cabX + 2, ty);
      ctx.lineTo(cabX + cabW - 2, ty);
      ctx.stroke();
    }

    // colored accent strip at top
    const stripH = Math.max(3, 4 * m);
    const stripGrad = ctx.createLinearGradient(cabX, cabY, cabX + cabW, cabY);
    stripGrad.addColorStop(0, e.color + 'aa');
    stripGrad.addColorStop(0.5, e.color);
    stripGrad.addColorStop(1, e.color + 'aa');
    ctx.fillStyle = stripGrad;
    roundRect(ctx, cabX, cabY + 1, cabW, stripH, 4);
    ctx.fill();
    // cover bottom rounding
    ctx.fillStyle = stripGrad;
    ctx.fillRect(cabX + 2, cabY + stripH - 1, cabW - 4, 2);

    // interior visible area — darker recessed area
    const intX = cabX + 3;
    const intY = cabY + stripH + 3;
    const intW = cabW - 6;
    const intH = cabH - stripH - 8;

    // interior back wall
    const intGrad = ctx.createLinearGradient(intX, intY, intX, intY + intH);
    intGrad.addColorStop(0, 'rgba(180,172,158,0.35)');
    intGrad.addColorStop(0.5, 'rgba(165,157,143,0.3)');
    intGrad.addColorStop(1, 'rgba(140,132,118,0.35)');
    ctx.fillStyle = intGrad;
    roundRect(ctx, intX, intY, intW, intH, 2);
    ctx.fill();

    // ceiling light — warm LED strip
    ctx.fillStyle = 'rgba(255,248,230,0.25)';
    const lightW = intW * 0.7;
    ctx.fillRect(intX + (intW - lightW) / 2, intY, lightW, 1.5);
    // light glow downward
    const lightGlow = ctx.createLinearGradient(intX, intY, intX, intY + intH * 0.4);
    lightGlow.addColorStop(0, 'rgba(255,245,220,0.06)');
    lightGlow.addColorStop(1, 'rgba(255,245,220,0)');
    ctx.fillStyle = lightGlow;
    ctx.fillRect(intX, intY, intW, intH * 0.4);

    // interior floor — dark polished
    const flrH = 3;
    const flrY = intY + intH - flrH;
    const flrGrad = ctx.createLinearGradient(intX, flrY, intX, flrY + flrH);
    flrGrad.addColorStop(0, 'rgba(60,55,45,0.3)');
    flrGrad.addColorStop(1, 'rgba(45,40,32,0.5)');
    ctx.fillStyle = flrGrad;
    ctx.fillRect(intX + 1, flrY, intW - 2, flrH);
    // floor reflection
    ctx.fillStyle = 'rgba(255,250,240,0.03)';
    ctx.fillRect(intX + 2, flrY, intW - 4, 0.8);

    // interior side handrail hints
    ctx.strokeStyle = 'rgba(160,150,130,0.15)';
    ctx.lineWidth = 0.8;
    const railY = intY + intH * 0.55;
    ctx.beginPath();
    ctx.moveTo(intX + 1, railY);
    ctx.lineTo(intX + intW - 1, railY);
    ctx.stroke();

    // outer frame — steel border with highlight
    ctx.strokeStyle = 'rgba(150,140,125,0.45)';
    ctx.lineWidth = 1.2;
    roundRect(ctx, cabX, cabY + 1, cabW, cabH, 4);
    ctx.stroke();
    // top edge highlight (light reflection)
    ctx.strokeStyle = 'rgba(255,250,240,0.12)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(cabX + 6, cabY + 1.5);
    ctx.lineTo(cabX + cabW - 6, cabY + 1.5);
    ctx.stroke();

    // broken X overlay
    if (brokenElevIdx === i) {
      ctx.strokeStyle = '#ef5350';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(cabX + 6, cabY + 8); ctx.lineTo(cabX + cabW - 6, cabY + cabH - 6);
      ctx.moveTo(cabX + cabW - 6, cabY + 8); ctx.lineTo(cabX + 6, cabY + cabH - 6);
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.globalAlpha = 1;
    }

    // ---- passengers inside cab ----
    const pCount = e.passengers.length;
    if (pCount > 0 && brokenElevIdx !== i) {
      const cols = Math.min(pCount, 3);
      const rows = Math.ceil(pCount / 3);
      const personW = intW / cols;
      const personH = intH / rows;

      for (let pi = 0; pi < pCount; pi++) {
        const p = e.passengers[pi];
        const col = pi % 3;
        const row = Math.floor(pi / 3);
        const ppx = intX + col * personW + personW / 2;
        const ppy = intY + 4 + row * personH + personH * 0.65;
        const mScale = Math.min(1.5, personH / 14);

        drawPersonMini(ppx, ppy, mScale, p.color, p.head);

        if (p.vip) {
          ctx.fillStyle = '#ffd54f';
          ctx.font = `${Math.max(6, 7 * mScale)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText('*', ppx, ppy - 12 * mScale);
        }

        // dest badge
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.beginPath(); ctx.arc(ppx, ppy + 3 * mScale, 5 * mScale, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.max(8, 9 * mScale)}px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.dest, ppx, ppy + 3 * mScale);
        ctx.textBaseline = 'alphabetic';
      }
    }

    // ---- door animation — stainless steel sliding panels ----
    if (e.doorAnim > 0.01) {
      const doorOpenW = (cabW - 8) * 0.5 * e.doorAnim;
      const dLeft = cabX + 3;
      const dRight = cabX + cabW - 3;
      const dTop = intY;
      const dH = intH;

      // left door panel
      const leftW = cabW / 2 - 4 - doorOpenW;
      if (leftW > 0) {
        const lgrd = ctx.createLinearGradient(dLeft, dTop, dLeft + leftW, dTop);
        lgrd.addColorStop(0, 'rgba(180,172,160,0.85)');
        lgrd.addColorStop(0.7, 'rgba(195,187,175,0.82)');
        lgrd.addColorStop(1, 'rgba(170,162,150,0.88)');
        ctx.fillStyle = lgrd;
        roundRect(ctx, dLeft, dTop, leftW, dH, 1);
        ctx.fill();
        // edge groove
        ctx.strokeStyle = 'rgba(130,122,110,0.25)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(dLeft + leftW - 0.5, dTop + 2);
        ctx.lineTo(dLeft + leftW - 0.5, dTop + dH - 2);
        ctx.stroke();
      }
      // right door panel
      const rightStart = sx + sw / 2 + doorOpenW;
      const rightW = dRight - rightStart;
      if (rightW > 0) {
        const rgrd = ctx.createLinearGradient(rightStart, dTop, rightStart + rightW, dTop);
        rgrd.addColorStop(0, 'rgba(170,162,150,0.88)');
        rgrd.addColorStop(0.3, 'rgba(195,187,175,0.82)');
        rgrd.addColorStop(1, 'rgba(180,172,160,0.85)');
        ctx.fillStyle = rgrd;
        roundRect(ctx, rightStart, dTop, rightW, dH, 1);
        ctx.fill();
        ctx.strokeStyle = 'rgba(130,122,110,0.25)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(rightStart + 0.5, dTop + 2);
        ctx.lineTo(rightStart + 0.5, dTop + dH - 2);
        ctx.stroke();
      }
      // warm light spill from open doors
      if (doorOpenW > 4) {
        const spillAlpha = 0.02 * e.doorAnim;
        ctx.fillStyle = `rgba(255,242,215,${spillAlpha})`;
        ctx.beginPath();
        ctx.moveTo(sx + sw / 2 - doorOpenW, dTop + dH);
        ctx.lineTo(sx - 8, cabY + cabH + 6);
        ctx.lineTo(sx + sw + 8, cabY + cabH + 6);
        ctx.lineTo(sx + sw / 2 + doorOpenW, dTop + dH);
        ctx.closePath();
        ctx.fill();
      }
    }

    // ---- name badge — colored pill above cab ----
    const badgeW = Math.max(16, 18 * m);
    const badgeH = Math.max(10, 12 * m);
    const badgeX2 = sx + sw / 2 - badgeW / 2;
    const badgeYPos = cabY - badgeH;
    // badge bg
    ctx.fillStyle = brokenElevIdx === i ? '#ef5350' : e.color;
    ctx.shadowColor = brokenElevIdx === i ? '#ef5350' : e.color;
    ctx.shadowBlur = 5;
    roundRect(ctx, badgeX2, badgeYPos, badgeW, badgeH, badgeH / 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // badge text
    ctx.font = `bold ${Math.max(7, Math.min(9, sw * 0.14))}px -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(e.name, sx + sw / 2, badgeYPos + badgeH / 2);
    ctx.textBaseline = 'alphabetic';

    // ---- passenger count badge below cab ----
    if (pCount > 0) {
      const cW = Math.max(18, 22 * m);
      const cH = Math.max(9, 11 * m);
      const cx = sx + sw / 2 - cW / 2;
      const cy = cabY + cabH + 2;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, cx, cy, cW, cH, cH / 2);
      ctx.fill();
      ctx.strokeStyle = e.color + '33';
      ctx.lineWidth = 0.5;
      roundRect(ctx, cx, cy, cW, cH, cH / 2);
      ctx.stroke();
      ctx.font = `bold ${Math.max(6, 7 * m)}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ccc';
      ctx.fillText(`${pCount}/${elevCap[e.idx]}`, sx + sw / 2, cy + cH / 2);
      ctx.textBaseline = 'alphabetic';
    }

    // ---- direction arrow ----
    if (e.moving) {
      const goingUp = e.targetFloor > e.floor;
      const arrowBob = Math.sin(tick * 0.15) * 1.5;
      const arrowY = goingUp ? badgeYPos - 7 + arrowBob : cabY + cabH + (pCount > 0 ? 16 : 6) - arrowBob;
      const arrowSize = 4 * m;
      ctx.fillStyle = e.color + 'cc';
      ctx.beginPath();
      if (goingUp) {
        ctx.moveTo(sx + sw / 2, arrowY - arrowSize);
        ctx.lineTo(sx + sw / 2 - arrowSize, arrowY + arrowSize * 0.6);
        ctx.lineTo(sx + sw / 2 + arrowSize, arrowY + arrowSize * 0.6);
      } else {
        ctx.moveTo(sx + sw / 2, arrowY + arrowSize);
        ctx.lineTo(sx + sw / 2 - arrowSize, arrowY - arrowSize * 0.6);
        ctx.lineTo(sx + sw / 2 + arrowSize, arrowY - arrowSize * 0.6);
      }
      ctx.closePath();
      ctx.fill();
    }

    // ---- selected indicator — animated glow border ----
    if (i === selectedElev) {
      const selPulse = Math.sin(tick * 0.08) * 0.15 + 0.85;
      ctx.strokeStyle = e.color + '99';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 8 * selPulse;
      ctx.setLineDash([5, 3]);
      ctx.lineDashOffset = -tick * 0.4;
      roundRect(ctx, cabX - 2, cabY - 1, cabW + 4, cabH + 4, 6);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineDashOffset = 0;
      ctx.shadowBlur = 0;
    }

    ctx.globalAlpha = 1;
  }
}

// ====== HUD ======
function updateHUD() {
  document.getElementById('h-score').textContent = score;
  document.getElementById('h-combo').textContent = combo > 1 ? `x${combo}` : 'x1';
  document.getElementById('h-combo').style.color = combo >= 5 ? '#ff9800' : combo >= 3 ? '#ffd54f' : '#6a8098';
  const satisEl = document.getElementById('h-satis');
  satisEl.textContent = Math.round(satisfaction) + '%';
  satisEl.style.color = satisfaction >= 70 ? '#66bb6a' : satisfaction >= 40 ? '#ffa726' : '#ef5350';
  document.getElementById('h-period').textContent = periods[Math.min(periodIdx, periods.length - 1)].name;
  document.getElementById('h-waiting').textContent = waitingPeople.filter(p => !p.angry && !p.leaving).length;
  document.getElementById('h-day').textContent = 'Day ' + currentDay;

  const pct = periodTimer / periodDur * 100;
  document.getElementById('h-bar').style.width = pct + '%';

  for (let i = 0; i < ELEV_COUNT; i++) {
    const e = elevators[i];
    const info = document.getElementById(`ei${i}`);
    if (info) {
      if (brokenElevIdx === i) {
        info.textContent = 'BROKEN';
        info.style.color = '#ef5350';
      } else {
        info.textContent = `${e.floor}F-${e.passengers.length}`;
        info.style.color = '';
      }
    }
  }
  updateMobileElevBar();
}

// ====== MOBILE FLOOR BUTTONS ======
let lastMobileFloors = 0;
function buildMobileFloors() {
  if (FLOORS === lastMobileFloors) return;
  lastMobileFloors = FLOORS;
  const container = document.getElementById('mobile-floors');
  container.innerHTML = '';
  for (let f = FLOORS; f >= 1; f--) {
    const btn = document.createElement('div');
    btn.className = 'mf-btn';
    btn.textContent = f;
    btn.addEventListener('touchstart', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!gameActive || paused) return;
      ensureAudio();
      sendElevToFloor(selectedElev, f);
    }, { passive: false });
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (!gameActive || paused) return;
      ensureAudio();
      sendElevToFloor(selectedElev, f);
    });
    container.appendChild(btn);
  }
}

// ====== MOBILE ELEVATOR SELECTOR ======
function initMobileElevBar() {
  const bar = document.getElementById('mobile-elev-bar');
  if (!bar) return;
  const btns = bar.querySelectorAll('.me-btn');
  btns.forEach(btn => {
    const handler = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!gameActive || paused) return;
      ensureAudio();
      const idx = parseInt(btn.dataset.idx);
      const prevElev = selectedElev;
      selectedElev = idx;
      sfxClick();
      // update visual
      btns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      // tutorial step 4
      if (tutorialStep === 4 && idx !== prevElev) {
        tutorialElevSwitched = true;
        tutorialStep = 5; tutorialTimer = 0;
      }
    };
    btn.addEventListener('touchstart', handler, { passive: false });
    btn.addEventListener('click', handler);
  });
}
function updateMobileElevBar() {
  const bar = document.getElementById('mobile-elev-bar');
  if (!bar || bar.style.display === 'none') return;
  const btns = bar.querySelectorAll('.me-btn');
  btns.forEach((btn, idx) => {
    btn.classList.toggle('selected', idx === selectedElev);
    if (brokenElevIdx === idx) {
      btn.style.opacity = '0.4';
      btn.style.borderColor = '#ef5350';
    } else {
      btn.style.opacity = '';
      btn.style.borderColor = '';
    }
  });
}
initMobileElevBar();

// ====== LANDSCAPE HINT ======
let landscapeHintDismissed = false;
function showLandscapeHint() {
  if (landscapeHintDismissed) return;
  const el = document.getElementById('landscape-hint');
  if (el) el.classList.add('active');
}
function dismissLandscapeHint() {
  landscapeHintDismissed = true;
  const el = document.getElementById('landscape-hint');
  if (el) el.classList.remove('active');
}
// show on game start if portrait on mobile
function checkLandscapeHint() {
  if (isMobile && window.innerHeight > window.innerWidth && !landscapeHintDismissed) {
    showLandscapeHint();
  }
}

// ====== UPGRADE SYSTEM ======
function showUpgradeScreen(isDayTransition) {
  gameActive = false;

  // clear events
  if (activeEvent) {
    if (activeEvent.name === 'Elevator Down') brokenElevIdx = -1;
    activeEvent = null;
    hideEventBanner();
  }

  const overlay = document.getElementById('upgrade-overlay');

  if (isDayTransition) {
    document.getElementById('upg-title').textContent = `Day ${currentDay - 1} Complete!`;
  } else {
    const period = periods[periodIdx - 1];
    document.getElementById('upg-title').textContent = `${period.name} Done!`;
  }
  document.getElementById('upg-score').textContent = score;
  document.getElementById('upg-delivered').textContent = periodDelivered;
  document.getElementById('upg-combo').textContent = periodCombo;

  const allUpgrades = [
    { icon: '\u26A1', name: 'Turbo Boost', desc: 'All elevators +20% speed', apply: () => { elevSpeed = elevSpeed.map(s => s * 1.2); } },
    { icon: '\uD83D\uDCE6', name: 'Expand', desc: 'All elevators +2 capacity', apply: () => { elevCap = elevCap.map(c => c + 2); } },
    { icon: '\uD83D\uDE0A', name: 'Patience', desc: 'Passengers wait 30% longer', apply: () => { patienceMult *= 1.3; } },
    { icon: '\uD83D\uDD27', name: 'Quick Doors', desc: 'Doors open/close faster', apply: () => { doorSpeedMult *= 1.5; } },
    { icon: '\uD83D\uDCB0', name: 'Double Points', desc: 'Score x2 next period', apply: () => { scoreMult *= 2; } },
    { icon: '\uD83D\uDED7', name: 'Boost A', desc: 'Elevator A +50% speed', apply: () => { elevSpeed[0] *= 1.5; } },
    { icon: '\uD83D\uDED7', name: 'Boost B', desc: 'Elevator B +50% speed', apply: () => { elevSpeed[1] *= 1.5; } },
    { icon: '\uD83D\uDED7', name: 'Boost C', desc: 'Elevator C +50% speed', apply: () => { elevSpeed[2] *= 1.5; } },
    { icon: '\u2764\uFE0F', name: 'Recover', desc: 'Satisfaction +25', apply: () => { satisfaction = Math.min(100, satisfaction + 25); } },
    { icon: '\uD83C\uDFAF', name: 'Combo Shield', desc: 'Combo lasts 50% longer', apply: () => { /* handled in combo logic via comboShield */ comboShield = true; } },
  ];

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

let comboShield = false;

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
  // if this is the first period of a new day, show day splash
  if (periodIdx === 0) {
    showDaySplash(() => { actuallyResumePeriod(); });
  } else {
    actuallyResumePeriod();
  }
}

function actuallyResumePeriod() {
  FLOORS = periods[periodIdx].floors;
  resize();
  for (const e of elevators) {
    if (e.floor > FLOORS) { e.floor = FLOORS; e.y = floorY(FLOORS); }
    e.y = floorY(e.floor);
    e.targetFloor = e.floor;
    e.queue = []; e.moving = false;
  }
  waitingPeople = waitingPeople.filter(p => p.floor <= FLOORS && p.dest <= FLOORS);
  periodDur = periods[periodIdx].dur;
  periodTimer = periodDur;
  periodDelivered = 0;
  periodCombo = 0;
  eventCooldown = 15;
  buildMobileFloors();
  gameActive = true;
}

function showDaySplash(onDone) {
  const el = document.getElementById('day-splash');
  document.getElementById('ds-day').textContent = 'Day ' + currentDay;
  const periodName = periods[0] ? periods[0].name : 'Morning';
  document.getElementById('ds-sub').textContent = periodName + ' Rush';
  document.getElementById('ds-floors').textContent = periods[0].floors + ' Floors';
  el.classList.remove('out');
  el.classList.add('show');
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => {
      el.classList.remove('show', 'out');
      if (onDone) onDone();
    }, 400);
  }, 1600);
}

// ====== INTERACTION ======
function hitTestElevator(mx, my) {
  const pad = isMobile ? 14 : 8;
  for (let i = 0; i < ELEV_COUNT; i++) {
    const e = elevators[i];
    const sx = shaftX(i);
    const cabY = e.y;
    const cabH = FLOOR_H - 4;
    if (mx >= sx - pad && mx <= sx + SHAFT_W + pad && my >= cabY - pad && my <= cabY + cabH + pad) {
      return i;
    }
  }
  return -1;
}

function handleCanvasClick(mx, my) {
  if (!gameActive || paused) return;
  ensureAudio();

  const hitElev = hitTestElevator(mx, my);
  if (hitElev >= 0) {
    const prevElev = selectedElev;
    selectedElev = hitElev;
    sfxClick();
    if (tutorialStep === 1) { tutorialStep = 2; tutorialTimer = 0; }
    if (tutorialStep === 4 && hitElev !== prevElev) {
      tutorialElevSwitched = true;
      tutorialStep = 5; tutorialTimer = 0;
    }
    return;
  }

  if (mx >= BUILD_X && mx <= BUILD_X + BUILD_W && my >= HUD_H && my <= HUD_H + FLOORS * FLOOR_H) {
    const clickedFloor = Math.floor((HUD_H + FLOORS * FLOOR_H - my) / FLOOR_H) + 1;
    if (clickedFloor >= 1 && clickedFloor <= FLOORS) {
      sendElevToFloor(selectedElev, clickedFloor);
    }
  }
}

cvs.addEventListener('click', (ev) => {
  const rect = cvs.getBoundingClientRect();
  const scaleX = cvs.width / rect.width;
  const scaleY = cvs.height / rect.height;
  handleCanvasClick((ev.clientX - rect.left) * scaleX, (ev.clientY - rect.top) * scaleY);
});

cvs.addEventListener('mousemove', (ev) => {
  if (!gameActive) return;
  const rect = cvs.getBoundingClientRect();
  const scaleX = cvs.width / rect.width;
  const scaleY = cvs.height / rect.height;
  const mx = (ev.clientX - rect.left) * scaleX;
  const my = (ev.clientY - rect.top) * scaleY;

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
  const scaleX = cvs.width / rect.width;
  const scaleY = cvs.height / rect.height;
  handleCanvasClick((touch.clientX - rect.left) * scaleX, (touch.clientY - rect.top) * scaleY);
}, { passive: false });

// Keyboard
document.addEventListener('keydown', (ev) => {
  // start screen
  if (ev.key === ' ' || ev.key === 'Enter') {
    const startScreen = document.getElementById('start-screen');
    if (startScreen.style.display !== 'none') {
      startGame();
      ev.preventDefault();
      return;
    }
  }
  // pause with Escape or P
  if (ev.key === 'Escape' || ev.key === 'p' || ev.key === 'P') {
    if (document.getElementById('game').classList.contains('active')) {
      // don't pause during game over or upgrade screen
      const goShow = document.getElementById('gameover-overlay').classList.contains('show');
      const upShow = document.getElementById('upgrade-overlay').classList.contains('show');
      if (!goShow && !upShow) {
        togglePause();
        ev.preventDefault();
      }
    }
    return;
  }
  // mute with M
  if (ev.key === 'm' || ev.key === 'M') {
    toggleMute();
    return;
  }
  // elevator selection
  if (gameActive && !paused) {
    const prevElev = selectedElev;
    if (ev.key === '1') { selectedElev = 0; sfxClick(); }
    if (ev.key === '2') { selectedElev = 1; sfxClick(); }
    if (ev.key === '3') { selectedElev = 2; sfxClick(); }
    if (tutorialStep === 4 && selectedElev !== prevElev) {
      tutorialElevSwitched = true;
      tutorialStep = 5; tutorialTimer = 0;
    }
  }
});

// ====== GAME OVER ======
function endGame(failed) {
  gameActive = false;
  const avgSatis = satisCount > 0 ? Math.round(satisAccum / satisCount) : 0;

  let grade, gradeClass;
  if (failed && currentDay <= 1) {
    grade = 'F'; gradeClass = 'f';
  } else {
    grade = 'D'; gradeClass = 'd';
    if (currentDay >= 4 && avgSatis >= 80) { grade = 'S'; gradeClass = 's'; }
    else if (currentDay >= 3 && avgSatis >= 65) { grade = 'A'; gradeClass = 'a'; }
    else if (currentDay >= 2 && avgSatis >= 50) { grade = 'B'; gradeClass = 'b'; }
    else if (score >= 300) { grade = 'C'; gradeClass = 'c'; }
  }

  const gradeEl = document.getElementById('go-grade');
  gradeEl.textContent = grade;
  gradeEl.className = 'go-grade ' + gradeClass;

  const titles = {
    'S': 'Master Dispatcher!', 'A': 'Great Job!', 'B': 'Well Done!',
    'C': 'Not Bad!', 'D': 'Keep Trying...', 'F': 'Dispatch Failed!'
  };
  document.getElementById('go-title').textContent = titles[grade];
  document.getElementById('go-score').textContent = score;
  document.getElementById('go-day').textContent = currentDay;
  document.getElementById('go-delivered').textContent = totalDelivered;
  document.getElementById('go-angry').textContent = totalAngry;
  document.getElementById('go-combo').textContent = maxCombo;
  document.getElementById('go-satis').textContent = avgSatis + '%';

  // high score check
  const isNewBest = score > highScore || currentDay > highDay;
  document.getElementById('go-newbest').style.display = isNewBest ? 'block' : 'none';
  if (score > highScore) highScore = score;
  if (currentDay > highDay) highDay = currentDay;
  saveHighScore();

  setTimeout(() => document.getElementById('gameover-overlay').classList.add('show'), 500);
}

function retryGame() {
  document.getElementById('gameover-overlay').classList.remove('show');
  initGame();
}

// ====== PAUSE / MUTE / MENU ======
let paused = false;
let muted = false;

function togglePause() {
  if (!document.getElementById('game').classList.contains('active')) return;
  paused = !paused;
  gameActive = !paused;
  document.getElementById('pause-overlay').classList.toggle('show', paused);
  document.getElementById('btn-pause').textContent = paused ? '\u25B6' : 'II';
}

function toggleMute() {
  muted = !muted;
  const btn = document.getElementById('btn-mute');
  btn.classList.toggle('muted', muted);
  btn.textContent = muted ? 'OFF' : 'SFX';
  if (audioCtx) {
    if (muted) {
      audioCtx.suspend();
    } else {
      audioCtx.resume();
    }
  }
}

// public mute control for ad integration
function muteGame() { if (!muted) toggleMute(); }
function unmuteGame() { if (muted) toggleMute(); }

function goToMenu() {
  paused = false;
  gameActive = false;
  stopBGM();
  document.getElementById('pause-overlay').classList.remove('show');
  document.getElementById('gameover-overlay').classList.remove('show');
  document.getElementById('upgrade-overlay').classList.remove('show');
  document.getElementById('game').classList.remove('active');
  const s = document.getElementById('start-screen');
  s.style.display = '';
  s.classList.remove('hide');
  document.getElementById('btn-pause').textContent = 'II';
  loadHighScore();
  showHighScoreOnStart();
}

// ====== START / LOOP ======
function startGame() {
  ensureAudio();
  startBGM();
  const s = document.getElementById('start-screen');
  s.classList.add('hide');
  setTimeout(() => s.style.display = 'none', 600);
  document.getElementById('game').classList.add('active');
  resize();
  initGame();
  checkLandscapeHint();
  if (!animFrame) gameLoop(0);
  // show Day 1 splash (game paused during splash)
  gameActive = false;
  showDaySplash(() => { gameActive = true; });
}

function gameLoop(timestamp) {
  if (lastTime === 0) lastTime = timestamp;
  let dt = (timestamp - lastTime) / 1000; // seconds
  lastTime = timestamp;

  // clamp dt to avoid spiral of death
  if (dt > 0.1) dt = 0.1;
  if (dt <= 0) dt = 1 / 60;

  // skip update when paused but keep rendering
  if (paused) dt = 0;

  if (gameActive && !paused) update(dt);
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

// ====== LOADING SCREEN ======
window.addEventListener('load', () => {
  const ls = document.getElementById('loading-screen');
  if (ls) {
    setTimeout(() => {
      ls.classList.add('done');
      setTimeout(() => ls.remove(), 500);
    }, 600);
  }
});
