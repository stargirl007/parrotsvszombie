const board = document.querySelector("#board");
const gameShell = document.querySelector(".game-shell");
const gameViewport = document.querySelector(".game-viewport");
const energyEl = document.querySelector("#energy");
const waveEl = document.querySelector("#wave");
const scoreEl = document.querySelector("#score");
const livesEl = document.querySelector("#lives");
const messageEl = document.querySelector("#message");
const startBtn = document.querySelector("#startBtn");
const boardWrap = document.querySelector(".board-wrap");
const cards = [...document.querySelectorAll(".card")];
const unitCards = [...document.querySelectorAll(".card[data-type]")];
const shovelBtn = document.querySelector("#shovelBtn");
const shovelStatus = document.querySelector("#shovelStatus");
const pauseModal = document.querySelector("#pauseModal");
const unlockModal = document.querySelector("#unlockModal");
const unlockKicker = document.querySelector("#unlockKicker");
const unlockImage = document.querySelector("#unlockImage");
const unlockTitle = document.querySelector("#unlockTitle");
const unlockDescription = document.querySelector("#unlockDescription");
const unlockContinueBtn = document.querySelector("#unlockContinueBtn");
const gameOverModal = document.querySelector("#gameOverModal");
const phaseToast = document.querySelector("#phaseToast");

const rows = 5;
const cols = 9;
const cellCount = rows * cols;
const fieldLayout = {
  boardLeft: 610 / 2750,
  boardTop: 150 / 1473,
  boardWidth: 1910 / 2750,
  boardHeight: 1210 / 1473,
  colEdges: [0, 212, 424, 637, 849, 1061, 1273, 1486, 1698, 1910],
  rowEdges: [0, 242, 484, 726, 968, 1210],
  mowerX: 0.18,
  snapOffsetX: 0.08,
  columnPlaceOffset: [0, 0.1, 0.16, 0.16, 0.16, 0.16, 0.16, 0.16, 0.16],
  snapOffsetY: 0.09,
  bottomRowOffsetY: -0.02,
  zombieLaneOffsetY: 0.04,
};

let gameScale = 1;

function updateGameScale() {
  if (!gameShell || !gameViewport) return;
  const previousScale = gameScale;
  gameScale = 1;
  document.documentElement.style.setProperty("--game-scale", "1");
  const shellWidth = gameShell.offsetWidth;
  const shellHeight = gameShell.offsetHeight;
  const viewportWidth = window.innerWidth - 16;
  const viewportHeight = (window.visualViewport?.height ?? window.innerHeight) - 16;
  gameScale = Math.min(1, viewportWidth / shellWidth, viewportHeight / shellHeight);
  document.documentElement.style.setProperty("--game-width", `${shellWidth}px`);
  document.documentElement.style.setProperty("--game-height", `${shellHeight}px`);
  document.documentElement.style.setProperty("--game-scale", `${gameScale}`);
  if (previousScale !== gameScale) {
    mowers.forEach(renderMower);
  }
}

function unscaledRect(element) {
  const rect = element.getBoundingClientRect();
  const scale = gameScale || 1;
  return {
    left: rect.left,
    top: rect.top,
    right: rect.left + rect.width,
    bottom: rect.top + rect.height,
    width: rect.width / scale,
    height: rect.height / scale,
  };
}

const zombieTypes = {
  lv1: {
    className: "lv1",
    frameCount: 8,
    sheet: "assets/opt/zombies/cat-zombie-walk-sheet.png",
    hp(waveNumber) {
      return 92 + waveNumber * 18;
    },
    speed(waveNumber) {
      return 15 + waveNumber * 2.6;
    },
  },
  lv2: {
    className: "lv2",
    frameCount: 10,
    sheet: "assets/opt/zombies/zombie-lv2-walk-sheet.png",
    traits: {
      armorReduction: 0.5,
      armoredAgainst: ["pizza", "ninja"],
      enrageAt: 0.3,
      enrageSpeedMultiplier: 1.55,
    },
    hp(waveNumber) {
      const lv2Wave = Math.max(1, waveNumber - 15);
      return 800 + (lv2Wave - 1) * 42;
    },
    speed(waveNumber) {
      const lv2Wave = Math.max(1, waveNumber - 15);
      return 25 + (lv2Wave - 1) * 1.85;
    },
  },
};
const parrots = [];
const producers = [];
const zombies = [];
const shots = [];
const lasers = [];
const suns = [];
const mowers = [];
const raindrops = [];
const poisonZones = [];
const hpBarVisibleMs = 2400;
const shovelCooldownMs = 30000;

Object.values(zombieTypes).forEach((config) => {
  const image = new Image();
  image.src = config.sheet;
});

const types = {
  sunflower: { name: "Sunflower", role: "producer", cost: 50, sunRate: 9600 },
  pizza: { name: "Pizza Parrot", role: "attacker", cost: 50, rate: 1250, damage: 18, speed: 270, shot: "pizza", asset: "opt/parrots/pizza.png", trait: "pizza" },
  baseball: { name: "Baseball Parrot", role: "attacker", cost: 125, rate: 900, damage: 55, speed: 0, shot: "melee", knockback: 48, meleeRange: 48, asset: "opt/parrots/baseball.png", trait: "baseball" },
  ninja: { name: "Ninja Parrot", role: "attacker", cost: 175, rate: 620, damage: 20, speed: 390, shot: "shuriken", critChance: 0.28, critMult: 2.25, asset: "opt/parrots/ninja.png", trait: "ninja" },
  vr: { name: "VR Parrot", role: "attacker", cost: 200, rate: 1500, damage: 30, speed: 0, shot: "laser", pierce: true, asset: "opt/parrots/vr.png", trait: "vr_goggles" },
  royal: { name: "Royal Parrot", role: "attacker", cost: 275, rate: 1900, damage: 82, speed: 235, shot: "crown", slowRadius: 110, slowFactor: 0.45, slowDuration: 2600, asset: "opt/parrots/royal.png", trait: "crown" },
  flower: { name: "Flower Parrot", role: "support", cost: 175, rate: 9000, stunDuration: 1500, afterSlowDuration: 3000, afterSlowFactor: 0.7, rangeCells: 5, asset: "opt/parrots/flower.png", unlockWave: 16, trait: "bloom_pulse" },
  grim: { name: "Grim Parrot", role: "bomb", cost: 350, countdown: 5000, poisonDuration: 5000, poisonSlowFactor: 0.55, asset: "opt/parrots/grim.png", unlockWave: 31, trait: "death_sentence" },
};

const nftTraitMap = {
  pizza: ["pizza", "blue hair", "purple scarf"],
  baseball: ["baseball bat", "blue jersey", "cap"],
  ninja: ["ninja", "headband", "martial robe"],
  vr_goggles: ["vr", "visor", "cyber"],
  crown: ["king", "queen", "gold crown"],
  bloom_pulse: ["flower", "vine", "sonic bloom"],
  death_sentence: ["grim", "reaper", "poison bomb"],
};

let selected = "sunflower";
let selectedTool = "unit";
let shovelReadyAt = 0;
let energy = 75;
let score = 0;
let wave = 1;
let lives = rows;
let running = false;
let gameOver = false;
let hasStarted = false;
let lastTime = 0;
let spawnTimer = 0;
let energyTimer = 0;
let skySunTimer = 0;
let rainTimer = 0;
let spawnEvery = 2600;
let currentPhase = "day";
let phaseToastTimer = 0;
let flowerUnlockShown = false;
let grimUnlockShown = false;

function buildGrid() {
  board.innerHTML = "";
  for (let i = 0; i < cellCount; i += 1) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "cell";
    cell.dataset.row = Math.floor(i / cols);
    cell.dataset.col = i % cols;
    cell.setAttribute("aria-label", `Place parrot row ${Number(cell.dataset.row) + 1} column ${Number(cell.dataset.col) + 1}`);
    board.append(cell);
  }
  buildMowers();
}

function buildMowers() {
  mowers.splice(0).forEach((mower) => mower.el.remove());
  const wrapRect = unscaledRect(boardWrap);
  for (let row = 0; row < rows; row += 1) {
    const rowCenter = (fieldLayout.rowEdges[row] + fieldLayout.rowEdges[row + 1]) / 2 / fieldLayout.rowEdges.at(-1);
    const el = document.createElement("div");
    el.className = "mower";
    el.innerHTML = '<span class="mower-smoke"></span><img src="assets/mower-trim.png" alt="" />';
    boardWrap.append(el);
    const mower = {
      row,
      x: wrapRect.width * fieldLayout.mowerX,
      y: wrapRect.height * (fieldLayout.boardTop + fieldLayout.boardHeight * rowCenter),
      state: "ready",
      speed: 620,
      el,
    };
    mowers.push(mower);
    renderMower(mower);
  }
}

function boardRect() {
  return unscaledRect(board);
}

function cellSize() {
  const rect = boardRect();
  return { width: rect.width / cols, height: rect.height / rows };
}

function cellCenter(row, col) {
  const rect = boardRect();
  const colStart = fieldLayout.colEdges[col];
  const colEnd = fieldLayout.colEdges[col + 1];
  const rowStart = fieldLayout.rowEdges[row];
  const rowEnd = fieldLayout.rowEdges[row + 1];
  const rowHeight = rowEnd - rowStart;
  const colWidth = colEnd - colStart;
  const colOffset = fieldLayout.columnPlaceOffset[col] ?? fieldLayout.columnPlaceOffset.at(-1) ?? 0;
  const rowOffset = row === rows - 1 ? fieldLayout.bottomRowOffsetY : 0;
  return {
    x: rect.width * (((colStart + colEnd) / 2 + colWidth * colOffset) / fieldLayout.colEdges.at(-1) + fieldLayout.snapOffsetX / cols),
    y: rect.height * ((rowStart + rowEnd) / 2 / fieldLayout.rowEdges.at(-1) + ((fieldLayout.snapOffsetY + rowOffset) * rowHeight) / fieldLayout.rowEdges.at(-1)),
  };
}

function laneCenterY(row, offset = 0) {
  const rect = boardRect();
  const rowStart = fieldLayout.rowEdges[row];
  const rowEnd = fieldLayout.rowEdges[row + 1];
  const rowHeight = rowEnd - rowStart;
  const rowOffset = row === rows - 1 ? fieldLayout.bottomRowOffsetY : 0;
  return rect.height * ((rowStart + rowEnd) / 2 / fieldLayout.rowEdges.at(-1) + ((offset + rowOffset) * rowHeight) / fieldLayout.rowEdges.at(-1));
}

function cellFromPoint(clientX, clientY) {
  const rect = boardRect();
  const x = (clientX - rect.left) / (gameScale || 1);
  const y = (clientY - rect.top) / (gameScale || 1);
  if (x < 0 || y < 0 || x > rect.width || y > rect.height) return null;
  const gridX = (x / rect.width) * fieldLayout.colEdges.at(-1);
  const gridY = (y / rect.height) * fieldLayout.rowEdges.at(-1);
  const col = fieldLayout.colEdges.findIndex((edge, index, edges) => index < edges.length - 1 && gridX >= edge && gridX <= edges[index + 1]);
  const row = fieldLayout.rowEdges.findIndex((edge, index, edges) => index < edges.length - 1 && gridY >= edge && gridY <= edges[index + 1]);
  if (row < 0 || col < 0) return null;
  return { row, col };
}

function setMessage(text) {
  messageEl.textContent = text;
}

function isRainWave() {
  const phaseWave = ((wave - 1) % 15) + 1;
  return phaseWave >= 6 && phaseWave <= 10;
}

function isNightWave() {
  const phaseWave = ((wave - 1) % 15) + 1;
  return phaseWave >= 11 && phaseWave <= 15;
}

function phaseForWave() {
  if (isRainWave()) return "rain";
  if (isNightWave()) return "night";
  return "day";
}

function describeWave() {
  if (wave === 16) return "Wave 16: level 2 zombies arrive with armor and enrage. Flower Parrot unlocked.";
  if (wave === 31) return "Wave 31: Grim Parrot unlocked. Death Sentence is ready for emergency clears.";
  if (isRainWave()) return `Wave ${wave}: rainy evening. Sky suns are worth 50%, sunflower suns stay full value.`;
  if (isNightWave()) return `Wave ${wave}: night season. Sky suns stop falling, sunflower suns stay active.`;
  return `Wave ${wave}: zombies are faster. Bring stronger parrots.`;
}

function showPhaseToast(title, text) {
  if (!phaseToast) return;
  phaseToast.querySelector("strong").textContent = title;
  phaseToast.querySelector("span").textContent = text;
  phaseToast.classList.add("visible");
  phaseToast.setAttribute("aria-hidden", "false");
  phaseToastTimer = 3200;
}

function showTraitUnlock(type) {
  if (!unlockModal) return;
  if (type === "flower") {
    if (flowerUnlockShown) return;
    flowerUnlockShown = true;
    unlockKicker.textContent = "New Trait Unlocked";
    unlockImage.src = "assets/opt/parrots/flower.png";
    unlockTitle.textContent = "Flower Parrot";
    unlockDescription.textContent = "Bloom Stun slows zombie movement across the next 5 grass tiles in front, giving VR and Royal more time to shred the lane.";
    setMessage("Flower Parrot unlocked. Press Continue to resume the wave.");
  } else if (type === "grim") {
    if (grimUnlockShown) return;
    grimUnlockShown = true;
    unlockKicker.textContent = "New Trait Unlocked";
    unlockImage.src = "assets/opt/parrots/grim.png";
    unlockTitle.textContent = "Grim Parrot";
    unlockDescription.textContent = "Death Sentence counts down for 5 seconds, wipes zombies in a 3x3 zone, then leaves poison behind to slow anything that crosses it.";
    setMessage("Grim Parrot unlocked. Press Continue to resume the wave.");
  }
  running = false;
  hasStarted = true;
  startBtn.textContent = "Resume";
  startBtn.classList.add("paused");
  unlockModal.classList.add("visible");
  unlockModal.setAttribute("aria-hidden", "false");
  updateHud();
}

function closeUnlockModal() {
  unlockModal?.classList.remove("visible");
  unlockModal?.setAttribute("aria-hidden", "true");
  if (!gameOver) startGame();
}

function isUnlocked(type) {
  return wave >= (types[type].unlockWave ?? 1);
}

function updatePhase(dt = 0) {
  const nextPhase = phaseForWave();
  boardWrap.classList.toggle("raining", nextPhase === "rain");
  boardWrap.classList.toggle("evening", nextPhase === "rain");
  boardWrap.classList.toggle("night", nextPhase === "night");
  if (nextPhase !== currentPhase) {
    currentPhase = nextPhase;
    if (nextPhase === "rain") {
      showPhaseToast("Rainy Evening", "Sky suns are worth 50%. Sunflowers stay full value.");
    } else if (nextPhase === "night") {
      showPhaseToast("Night Falls", "Sky suns stop falling. Use sunflowers for tokens.");
    } else {
      showPhaseToast("Day Returns", "Sky suns are falling normally again.");
    }
  }
  if (phaseToastTimer > 0) {
    phaseToastTimer = Math.max(0, phaseToastTimer - dt);
    if (phaseToastTimer === 0 && phaseToast) {
      phaseToast.classList.remove("visible");
      phaseToast.setAttribute("aria-hidden", "true");
    }
  }
}

function addScore(points) {
  score += points;
  if (score > 0 && score % 80 === 0) {
    wave += 1;
    spawnEvery = Math.max(950, spawnEvery - 250);
    setMessage(describeWave());
    if (wave === types.flower.unlockWave) showTraitUnlock("flower");
    if (wave === types.grim.unlockWave) showTraitUnlock("grim");
  }
}

function updateHud() {
  energyEl.textContent = Math.floor(energy);
  waveEl.textContent = wave;
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  updatePhase();
  unitCards.forEach((card) => {
    const config = types[card.dataset.type];
    const locked = !isUnlocked(card.dataset.type);
    card.disabled = locked || config.cost > energy;
    card.classList.toggle("locked", locked);
    card.title = locked ? `Unlocks after wave ${config.unlockWave - 1}` : "";
  });
  const shovelRemaining = Math.max(0, shovelReadyAt - performance.now());
  if (shovelBtn && shovelStatus) {
    shovelBtn.disabled = shovelRemaining > 0;
    shovelStatus.textContent = shovelRemaining > 0
      ? `Cooldown ${Math.ceil(shovelRemaining / 1000)}s`
      : "Remove unit - ready";
  }
}

function unitAt(row, col) {
  const producer = producers.find((unit) => unit.row === row && unit.col === col);
  if (producer) return { unit: producer, group: producers };
  const parrot = parrots.find((unit) => unit.row === row && unit.col === col);
  if (parrot) return { unit: parrot, group: parrots };
  return null;
}

function occupantAt(row, col) {
  return Boolean(unitAt(row, col));
}

function syncSelection() {
  unitCards.forEach((item) => item.classList.toggle("selected", selectedTool === "unit" && item.dataset.type === selected));
  shovelBtn?.classList.toggle("selected", selectedTool === "shovel");
}

function makeSunflowerElement() {
  const el = document.createElement("div");
  el.className = "sunflower";
  el.innerHTML = '<img class="sunflower-base" src="assets/opt/sunflower-degen.png" alt="" /><img class="sunflower-top" src="assets/opt/sunflower-degen.png" alt="" /><span class="unit-hp"><span></span></span>';
  board.append(el);
  return el;
}

function makeParrotElement(type) {
  const el = document.createElement("div");
  el.className = `parrot ${type}`;
  const timer = types[type].role === "bomb" ? '<span class="grim-timer">5</span>' : "";
  el.innerHTML = `<img src="assets/${types[type].asset}" alt="" />${timer}<span class="unit-hp"><span></span></span>`;
  board.append(el);
  return el;
}

function placeParrot(row, col) {
  if (gameOver || !running || selectedTool !== "unit") return;
  if (occupantAt(row, col)) {
    setMessage("This tile is occupied. Pick another grass tile.");
    return;
  }
  const config = types[selected];
  if (!isUnlocked(selected)) {
    setMessage(`${config.name} unlocks after wave ${config.unlockWave - 1}.`);
    return;
  }
  if (energy < config.cost) {
    setMessage(`You need ${config.cost} tokens to place ${config.name}.`);
    return;
  }
  energy -= config.cost;
  const pos = cellCenter(row, col);
  if (config.role === "producer") {
    const producer = { id: crypto.randomUUID(), type: selected, row, col, x: pos.x, y: pos.y, hp: 95, maxHp: 95, hpVisibleUntil: 0, cooldown: 1800, el: makeSunflowerElement() };
    producers.push(producer);
    producer.el.style.left = `${producer.x}px`;
    producer.el.style.top = `${producer.y}px`;
    setMessage("Sunflower planted. Click falling suns to collect tokens.");
  } else {
    const initialCooldown = config.role === "support" ? 1200 : 350;
    const parrot = { id: crypto.randomUUID(), type: selected, row, col, x: pos.x, y: pos.y, hp: 125, maxHp: 125, hpVisibleUntil: 0, cooldown: initialCooldown, el: makeParrotElement(selected) };
    if (config.role === "bomb") {
      parrot.hp = 160;
      parrot.maxHp = 160;
      parrot.explodeAt = performance.now() + config.countdown;
    }
    parrots.push(parrot);
    parrot.el.style.left = `${parrot.x}px`;
    parrot.el.style.top = `${parrot.y}px`;
    setMessage(`${config.name} parrot placed in lane ${row + 1}. Trait hook: ${config.trait}.`);
  }
  updateHud();
}

function shovelUnit(row, col) {
  if (gameOver || !running) return;
  const remaining = shovelReadyAt - performance.now();
  if (remaining > 0) {
    setMessage(`Shovel is cooling down. Ready in ${Math.ceil(remaining / 1000)}s.`);
    updateHud();
    return;
  }
  const target = unitAt(row, col);
  if (!target) {
    setMessage("No sunflower or parrot on this tile.");
    return;
  }
  target.unit.el.remove();
  const index = target.group.indexOf(target.unit);
  if (index >= 0) target.group.splice(index, 1);
  shovelReadyAt = performance.now() + shovelCooldownMs;
  syncSelection();
  setMessage("Unit removed. Shovel cooldown started: 30s.");
  updateHud();
}

function makeSun(x, y, targetY = y, drift = 0, value = 25, source = "sunflower") {
  const el = document.createElement("button");
  el.type = "button";
  el.className = `sun-token ${source === "sky" ? "sky-sun" : "sunflower-sun"} ${value < 25 ? "rain-discount" : ""}`;
  el.textContent = `+${Number.isInteger(value) ? value : value.toFixed(1)}`;
  board.append(el);
  const sun = { id: crypto.randomUUID(), x, y, targetY, drift, value, life: 10000, el };
  suns.push(sun);
  el.addEventListener("click", (event) => {
    event.stopPropagation();
    collectSun(sun);
  });
  return sun;
}

function collectSun(sun) {
  if (!running || gameOver) return;
  energy = Math.min(999, energy + sun.value);
  sun.el.remove();
  const index = suns.indexOf(sun);
  if (index >= 0) suns.splice(index, 1);
  updateHud();
}

function renderUnitHp(unit) {
  const hpBar = unit.el.querySelector(".unit-hp");
  const hpFill = hpBar?.querySelector("span");
  if (!hpBar || !hpFill) return;
  const ratio = Math.max(0, unit.hp / unit.maxHp);
  hpFill.style.width = `${ratio * 100}%`;
  hpBar.classList.toggle("hp-visible", ratio < 1 && performance.now() < (unit.hpVisibleUntil ?? 0));
}

function renderMower(mower) {
  mower.el.style.left = `${mower.x}px`;
  mower.el.style.top = `${mower.y}px`;
  mower.el.classList.toggle("used", mower.state === "used");
  mower.el.classList.toggle("launched", mower.state === "launched");
}

function renderZombie(zombie) {
  zombie.el.style.left = `${zombie.x}px`;
  zombie.el.style.top = `${zombie.y}px`;
  zombie.el.classList.toggle("enraged", zombie.level === "lv2" && zombie.hp / zombie.maxHp < zombie.traits.enrageAt);
  const frameIndex = zombie.frame % zombie.frameCount;
  const sprite = zombie.el.querySelector(".zombie-sprite");
  if (sprite) sprite.style.backgroundPosition = `${(frameIndex / (zombie.frameCount - 1)) * 100}% 0`;
  const hpBar = zombie.el.querySelector(".hp");
  const hpFill = hpBar?.querySelector("span");
  if (hpBar && hpFill) {
    const ratio = Math.max(0, zombie.hp / zombie.maxHp);
    hpFill.style.width = `${ratio * 100}%`;
    hpBar.classList.toggle("hp-visible", ratio < 1 && performance.now() < (zombie.hpVisibleUntil ?? 0));
  }
}

function makeZombieUnit(row, zombieLevel, xOffset = 0) {
  const size = cellSize();
  const rowCenter = laneCenterY(row, fieldLayout.zombieLaneOffsetY);
  const config = zombieTypes[zombieLevel];
  const hp = config.hp(wave);
  const el = document.createElement("div");
  el.className = `zombie ${config.className}`;
  el.innerHTML = '<span class="zombie-sprite"></span><span class="hp"><span></span></span>';
  board.append(el);
  const sprite = el.querySelector(".zombie-sprite");
  sprite.style.backgroundImage = `url("${config.sheet}")`;
  sprite.style.backgroundSize = `${config.frameCount * 100}% 100%`;
  const zombie = {
    id: crypto.randomUUID(),
    level: zombieLevel,
    traits: config.traits ?? {},
    row,
    x: boardRect().width + size.width * 1.35 + xOffset,
    y: rowCenter,
    hp,
    maxHp: hp,
    speed: config.speed(wave),
    slowUntil: 0,
    slowFactor: 1,
    frameCount: config.frameCount,
    frame: Math.floor(Math.random() * config.frameCount),
    frameTime: 0,
    hpVisibleUntil: 0,
    el,
  };
  zombies.push(zombie);
  renderZombie(zombie);
}

function makeZombie() {
  const row = Math.floor(Math.random() * rows);
  const zombieLevel = wave > 15 ? "lv2" : "lv1";
  const config = zombieTypes[zombieLevel];
  const groupSize = config.traits?.groupSize ?? 1;
  const spacing = cellSize().width * 0.62;
  for (let i = 0; i < groupSize; i += 1) {
    makeZombieUnit(row, zombieLevel, i * spacing);
  }
}

function makeShot(parrot, target, config) {
  if (config.shot === "melee") {
    if (target.x - parrot.x <= config.meleeRange) {
      applyDamage(target, config.damage, { source: parrot.type });
      target.x += config.knockback;
    }
    return;
  }
  if (config.shot === "laser") {
    zombies
      .filter((zombie) => zombie.row === parrot.row && zombie.x > parrot.x)
      .forEach((zombie) => {
        applyDamage(zombie, config.damage, { source: parrot.type });
      });
    const laser = document.createElement("div");
    laser.className = "laser";
    laser.style.left = `${parrot.x + 22}px`;
    laser.style.top = `${parrot.y}px`;
    laser.style.width = `${Math.max(80, boardRect().width - parrot.x - 28)}px`;
    board.append(laser);
    lasers.push({ el: laser, life: 110 });
    return;
  }
  const isCrit = config.critChance ? Math.random() < config.critChance : false;
  const damage = isCrit ? config.damage * config.critMult : config.damage;
  const angles = config.shot === "crown" ? [-30, 0, 30] : [0];
  angles.forEach((angle) => {
    const el = document.createElement("div");
    el.className = `projectile ${config.shot}`;
    board.append(el);
    const radians = (angle * Math.PI) / 180;
    shots.push({
      row: config.shot === "crown" ? null : parrot.row,
      x: parrot.x + 24,
      y: parrot.y,
      speed: config.speed,
      vy: Math.tan(radians) * config.speed,
      damage,
      source: parrot.type,
      slowRadius: config.slowRadius ?? 0,
      slowFactor: config.slowFactor ?? 1,
      slowDuration: config.slowDuration ?? 0,
      el,
    });
  });
}

function flash(target) {
  target.el.classList.remove("hit");
  target.el.offsetWidth;
  target.el.classList.add("hit");
}

function applyDamage(target, amount, options = {}) {
  const shouldFlash = typeof options === "boolean" ? options : options.shouldFlash ?? true;
  const source = typeof options === "object" ? options.source : null;
  const armoredAgainst = target.traits?.armoredAgainst ?? [];
  const reduction = source && armoredAgainst.includes(source) ? target.traits.armorReduction ?? 1 : 1;
  target.hp -= amount * reduction;
  target.hpVisibleUntil = performance.now() + hpBarVisibleMs;
  if (shouldFlash) flash(target);
}

function nearestZombie(parrot) {
  return zombies
    .filter((zombie) => zombie.row === parrot.row && zombie.x > parrot.x)
    .sort((a, b) => a.x - b.x)[0];
}

function pulseFlower(parrot, config) {
  const size = cellSize();
  const range = size.width * config.rangeCells;
  const height = size.height * 0.86;
  const now = performance.now();
  const waveEl = document.createElement("span");
  waveEl.className = "sonic-wave";
  waveEl.style.left = `${parrot.x + range / 2}px`;
  waveEl.style.top = `${parrot.y}px`;
  waveEl.style.width = `${range}px`;
  waveEl.style.height = `${height}px`;
  board.append(waveEl);
  setTimeout(() => waveEl.remove(), 760);
  zombies.forEach((zombie) => {
    const inFront = zombie.x >= parrot.x && zombie.x <= parrot.x + range;
    const inLane = Math.abs(zombie.y - parrot.y) <= size.height * 0.46;
    if (inFront && inLane) {
      zombie.stunUntil = Math.max(zombie.stunUntil ?? 0, now + config.stunDuration);
      zombie.slowAfterStunUntil = Math.max(zombie.slowAfterStunUntil ?? 0, now + config.stunDuration + config.afterSlowDuration);
      zombie.slowAfterStunFactor = config.afterSlowFactor;
      zombie.hpVisibleUntil = now + hpBarVisibleMs;
      zombie.el.classList.add("stunned");
    }
  });
}

function makePoisonZone(parrot, config) {
  const size = cellSize();
  const el = document.createElement("span");
  el.className = "poison-zone";
  el.style.left = `${parrot.x - size.width * 1.5}px`;
  el.style.top = `${parrot.y - size.height * 1.5}px`;
  el.style.width = `${size.width * 3}px`;
  el.style.height = `${size.height * 3}px`;
  board.append(el);
  poisonZones.push({
    row: parrot.row,
    x: parrot.x,
    width: size.width * 3,
    slowFactor: config.poisonSlowFactor,
    until: performance.now() + config.poisonDuration,
    el,
  });
}

function removeParrot(parrot) {
  parrot.el.remove();
  const index = parrots.indexOf(parrot);
  if (index >= 0) parrots.splice(index, 1);
}

function explodeGrim(parrot, config) {
  const size = cellSize();
  const minRow = Math.max(0, parrot.row - 1);
  const maxRow = Math.min(rows - 1, parrot.row + 1);
  const minX = parrot.x - size.width * 1.5;
  const maxX = parrot.x + size.width * 1.5;
  const burst = document.createElement("span");
  burst.className = "grim-burst";
  burst.style.left = `${parrot.x}px`;
  burst.style.top = `${parrot.y}px`;
  burst.style.width = `${size.width * 3}px`;
  burst.style.height = `${size.height * 3}px`;
  board.append(burst);
  setTimeout(() => burst.remove(), 700);
  for (let i = zombies.length - 1; i >= 0; i -= 1) {
    const zombie = zombies[i];
    if (zombie.row >= minRow && zombie.row <= maxRow && zombie.x >= minX && zombie.x <= maxX) {
      zombie.el.remove();
      zombies.splice(i, 1);
      addScore(10);
    }
  }
  makePoisonZone(parrot, config);
  removeParrot(parrot);
  setMessage("Death Sentence detonated. Poison zone active for 5s.");
}

function updateParrots(dt) {
  [...parrots].forEach((parrot) => {
    const config = types[parrot.type];
    parrot.cooldown -= dt;
    if (config.role === "support") {
      if (parrot.cooldown <= 0) {
        pulseFlower(parrot, config);
        parrot.cooldown = config.rate;
      }
      renderUnitHp(parrot);
      return;
    }
    if (config.role === "bomb") {
      const remaining = Math.max(0, parrot.explodeAt - performance.now());
      const timer = parrot.el.querySelector(".grim-timer");
      if (timer) timer.textContent = Math.ceil(remaining / 1000);
      if (remaining <= 0) {
        explodeGrim(parrot, config);
        return;
      }
      renderUnitHp(parrot);
      return;
    }
    const target = nearestZombie(parrot);
    const inRange = target && (config.shot !== "melee" || target.x - parrot.x <= config.meleeRange);
    if (inRange && parrot.cooldown <= 0) {
      makeShot(parrot, target, config);
      parrot.cooldown = config.rate;
    }
    renderUnitHp(parrot);
  });
}

function updateProducers(dt) {
  producers.forEach((producer) => {
    producer.cooldown -= dt;
    if (producer.cooldown <= 0) {
      producer.cooldown = types[producer.type].sunRate;
      makeSun(producer.x + 18, producer.y - 32, producer.y - 32, 0);
    }
    renderUnitHp(producer);
  });
}

function updateSuns(dt) {
  for (let i = suns.length - 1; i >= 0; i -= 1) {
    const sun = suns[i];
    sun.life -= dt;
    if (sun.y < sun.targetY) {
      sun.y = Math.min(sun.targetY, sun.y + (34 * dt) / 1000);
      sun.x += (sun.drift * dt) / 1000;
    }
    if (sun.life <= 0) {
      sun.el.remove();
      suns.splice(i, 1);
      continue;
    }
    sun.el.style.left = `${sun.x}px`;
    sun.el.style.top = `${sun.y}px`;
  }
}

function makeRaindrop() {
  const el = document.createElement("span");
  el.className = "raindrop";
  boardWrap.append(el);
  const wrapRect = unscaledRect(boardWrap);
  const drop = {
    x: Math.random() * wrapRect.width,
    y: -18 - Math.random() * 80,
    speed: 380 + Math.random() * 260,
    drift: -70 - Math.random() * 70,
    length: 10 + Math.random() * 12,
    el,
  };
  el.style.height = `${drop.length}px`;
  raindrops.push(drop);
}

function updateRain(dt) {
  if (isRainWave()) {
    rainTimer += dt;
    while (rainTimer >= 85) {
      rainTimer -= 85;
      makeRaindrop();
    }
  } else {
    rainTimer = 0;
  }
  const wrapRect = unscaledRect(boardWrap);
  for (let i = raindrops.length - 1; i >= 0; i -= 1) {
    const drop = raindrops[i];
    drop.x += (drop.drift * dt) / 1000;
    drop.y += (drop.speed * dt) / 1000;
    if (drop.y > wrapRect.height + 30 || drop.x < -40) {
      drop.el.remove();
      raindrops.splice(i, 1);
      continue;
    }
    drop.el.style.left = `${drop.x}px`;
    drop.el.style.top = `${drop.y}px`;
  }
}

function updatePoisonZones() {
  const now = performance.now();
  for (let i = poisonZones.length - 1; i >= 0; i -= 1) {
    if (poisonZones[i].until <= now) {
      poisonZones[i].el.remove();
      poisonZones.splice(i, 1);
    }
  }
}

function updateShots(dt) {
  const rect = boardRect();
  for (let i = shots.length - 1; i >= 0; i -= 1) {
    const shot = shots[i];
    shot.x += (shot.speed * dt) / 1000;
    shot.y += ((shot.vy ?? 0) * dt) / 1000;
    const hit = zombies.find((zombie) => {
      if (shot.row !== null) return zombie.row === shot.row && Math.abs(zombie.x - shot.x) < 24;
      return Math.abs(zombie.x - shot.x) < 28 && Math.abs(zombie.y - shot.y) < 42;
    });
    if (hit) {
      applyDamage(hit, shot.damage, { source: shot.source });
      if (shot.slowRadius) {
        const now = performance.now();
        zombies.forEach((zombie) => {
          if (zombie.row === hit.row && Math.abs(zombie.x - hit.x) <= shot.slowRadius) {
            zombie.slowUntil = now + shot.slowDuration;
            zombie.slowFactor = shot.slowFactor;
          }
        });
      }
      shot.el.remove();
      shots.splice(i, 1);
    } else if (shot.x > rect.width + cellSize().width * 1.7 || shot.y < -40 || shot.y > rect.height + 40) {
      shot.el.remove();
      shots.splice(i, 1);
    } else {
      shot.el.style.left = `${shot.x}px`;
      shot.el.style.top = `${shot.y}px`;
    }
  }
}

function updateZombies(dt) {
  for (let i = zombies.length - 1; i >= 0; i -= 1) {
    const zombie = zombies[i];
    const now = performance.now();
    const isEnraged = zombie.level === "lv2" && zombie.hp / zombie.maxHp < zombie.traits.enrageAt;
    const enragedSpeed = isEnraged ? zombie.speed * zombie.traits.enrageSpeedMultiplier : zombie.speed;
    const poisonFactor = poisonZones.some((zone) => zombie.row >= zone.row - 1 && zombie.row <= zone.row + 1 && Math.abs(zombie.x - zone.x) <= zone.width / 2)
      ? Math.min(...poisonZones
        .filter((zone) => zombie.row >= zone.row - 1 && zombie.row <= zone.row + 1 && Math.abs(zombie.x - zone.x) <= zone.width / 2)
        .map((zone) => zone.slowFactor))
      : 1;
    const postStunFactor = zombie.slowAfterStunUntil > now ? zombie.slowAfterStunFactor : 1;
    const royalFactor = zombie.slowUntil > now ? zombie.slowFactor : 1;
    const currentSpeed = zombie.stunUntil > now ? 0 : enragedSpeed * Math.min(poisonFactor, postStunFactor, royalFactor);
    zombie.el.classList.toggle("stunned", zombie.stunUntil > now);
    zombie.frameTime += dt;
    if (zombie.frameTime >= 105) {
      zombie.frameTime = 0;
      zombie.frame = (zombie.frame + 1) % zombie.frameCount;
    }
    zombie.x -= (currentSpeed * dt) / 1000;
    const blockers = [...parrots, ...producers];
    const blocker = blockers.find((unit) => unit.row === zombie.row && Math.abs(unit.x - zombie.x) < 36);
    if (blocker) {
      zombie.x += (currentSpeed * dt) / 1000;
      applyDamage(blocker, dt * 0.025, false);
      renderUnitHp(blocker);
      if (blocker.hp <= 0) {
        blocker.el.remove();
        const parrotIndex = parrots.indexOf(blocker);
        const producerIndex = producers.indexOf(blocker);
        if (parrotIndex >= 0) parrots.splice(parrotIndex, 1);
        if (producerIndex >= 0) producers.splice(producerIndex, 1);
      }
    }
    if (zombie.hp <= 0) {
      zombie.el.remove();
      zombies.splice(i, 1);
      addScore(10);
      continue;
    }
    if (zombie.x < 12) {
      const mowerWillHandleLane = triggerMower(zombie.row);
      if (!mowerWillHandleLane) return;
      zombie.x = 12;
      renderZombie(zombie);
      continue;
    }
    renderZombie(zombie);
  }
}

function triggerMower(row) {
  const mower = mowers.find((item) => item.row === row && item.state === "ready");
  if (!mower) {
    const launchedMower = mowers.find((item) => item.row === row && item.state === "launched");
    if (launchedMower) {
      setMessage(`Lane ${row + 1} mower is already clearing the lane.`);
      updateHud();
      return true;
    }
    endGame();
    return false;
  }
  mower.state = "launched";
  lives = Math.max(0, lives - 1);
  setMessage(`Lane ${row + 1} mower launched. ${lives} lives left.`);
  updateHud();
  return true;
}

function updateMowers(dt) {
  const wrapRect = unscaledRect(boardWrap);
  const boardLeft = wrapRect.width * fieldLayout.boardLeft;
  const boardRight = wrapRect.width * (fieldLayout.boardLeft + fieldLayout.boardWidth);
  mowers.forEach((mower) => {
    if (mower.state !== "launched") return;
    mower.x += (mower.speed * dt) / 1000;
    const mowerBoardX = mower.x - boardLeft;
    for (let i = zombies.length - 1; i >= 0; i -= 1) {
      const zombie = zombies[i];
      if (zombie.row === mower.row && Math.abs(zombie.x - mowerBoardX) < 48) {
        zombie.el.remove();
        zombies.splice(i, 1);
        addScore(10);
      }
    }
    if (mower.x > boardRight + 80) {
      mower.state = "used";
    }
    renderMower(mower);
  });
}

function updateLasers(dt) {
  for (let i = lasers.length - 1; i >= 0; i -= 1) {
    lasers[i].life -= dt;
    if (lasers[i].life <= 0) {
      lasers[i].el.remove();
      lasers.splice(i, 1);
    }
  }
}

function loop(time) {
  if (!running) return;
  const dt = Math.min(50, time - lastTime || 16);
  lastTime = time;
  spawnTimer += dt;
  energyTimer += dt;
  skySunTimer += dt;
  if (spawnTimer >= spawnEvery) {
    spawnTimer = 0;
    makeZombie();
  }
  if (energyTimer >= 10000) {
    energyTimer = 0;
    setMessage(isNightWave()
      ? "Night has fallen. Sky suns stop falling; rely on sunflowers."
      : isRainWave()
        ? "Rain is falling. Sky suns are worth 50%, sunflower suns stay full value."
        : "Suns are falling. Click them to collect tokens.");
  }
  if (!isNightWave() && skySunTimer >= 5200) {
    skySunTimer = 0;
    const col = Math.floor(Math.random() * cols);
    const targetRow = Math.floor(Math.random() * rows);
    const target = cellCenter(targetRow, col);
    makeSun(target.x, -26, target.y, Math.random() * 14 - 7, isRainWave() ? 12.5 : 25, "sky");
  } else if (isNightWave()) {
    skySunTimer = 0;
  }
  updatePhase(dt);
  updateProducers(dt);
  updateSuns(dt);
  updateRain(dt);
  updatePoisonZones();
  updateParrots(dt);
  updateShots(dt);
  updateZombies(dt);
  updateMowers(dt);
  updateLasers(dt);
  updateHud();
  requestAnimationFrame(loop);
}

function startGame() {
  if (running) return;
  running = true;
  gameOver = false;
  hasStarted = true;
  lastTime = performance.now();
  startBtn.textContent = "Pause";
  startBtn.classList.remove("paused");
  pauseModal.classList.remove("visible");
  pauseModal.setAttribute("aria-hidden", "true");
  gameOverModal.classList.remove("visible");
  gameOverModal.setAttribute("aria-hidden", "true");
  unlockModal?.classList.remove("visible");
  unlockModal?.setAttribute("aria-hidden", "true");
  setMessage("Zombies are coming. Collect suns and plant more parrots.");
  requestAnimationFrame(loop);
}

function pauseGame() {
  if (!running || gameOver) return;
  running = false;
  startBtn.textContent = "Resume";
  startBtn.classList.add("paused");
  pauseModal.classList.add("visible");
  pauseModal.setAttribute("aria-hidden", "false");
  unlockModal?.classList.remove("visible");
  unlockModal?.setAttribute("aria-hidden", "true");
  setMessage("Paused. Press Resume when you are ready to continue.");
}

function endGame() {
  running = false;
  gameOver = true;
  hasStarted = false;
  startBtn.textContent = "Restart";
  startBtn.classList.remove("paused");
  pauseModal.classList.remove("visible");
  pauseModal.setAttribute("aria-hidden", "true");
  gameOverModal.classList.add("visible");
  gameOverModal.setAttribute("aria-hidden", "false");
  unlockModal?.classList.remove("visible");
  unlockModal?.setAttribute("aria-hidden", "true");
  setMessage(`Game over. Score: ${score}. Press Restart to play again.`);
}

function resetGame() {
  parrots.splice(0).forEach((item) => item.el.remove());
  producers.splice(0).forEach((item) => item.el.remove());
  zombies.splice(0).forEach((item) => item.el.remove());
  shots.splice(0).forEach((item) => item.el.remove());
  lasers.splice(0).forEach((item) => item.el.remove());
  suns.splice(0).forEach((item) => item.el.remove());
  raindrops.splice(0).forEach((item) => item.el.remove());
  poisonZones.splice(0).forEach((item) => item.el.remove());
  energy = 75;
  score = 0;
  wave = 1;
  lives = rows;
  spawnTimer = 0;
  energyTimer = 0;
  skySunTimer = 0;
  rainTimer = 0;
  spawnEvery = 2600;
  currentPhase = "day";
  phaseToastTimer = 0;
  flowerUnlockShown = false;
  grimUnlockShown = false;
  hasStarted = false;
  selectedTool = "unit";
  selected = "sunflower";
  shovelReadyAt = 0;
  syncSelection();
  pauseModal.classList.remove("visible");
  pauseModal.setAttribute("aria-hidden", "true");
  gameOverModal.classList.remove("visible");
  gameOverModal.setAttribute("aria-hidden", "true");
  unlockModal?.classList.remove("visible");
  unlockModal?.setAttribute("aria-hidden", "true");
  phaseToast?.classList.remove("visible");
  phaseToast?.setAttribute("aria-hidden", "true");
  boardWrap.classList.remove("raining", "evening", "night");
  buildMowers();
  updateHud();
  startGame();
}

cards.forEach((card) => {
  card.addEventListener("click", () => {
    if (card.disabled) return;
    if (card.dataset.tool === "shovel") {
      selectedTool = "shovel";
      syncSelection();
      setMessage("Shovel selected. Click a planted sunflower or parrot to remove it.");
      return;
    }
    selectedTool = "unit";
    selected = card.dataset.type;
    syncSelection();
    setMessage(`Selected ${types[selected].name}. Place it on a grass tile.`);
  });
});

board.addEventListener("click", (event) => {
  const cell = event.target.closest(".cell");
  const targetCell = cell
    ? { row: Number(cell.dataset.row), col: Number(cell.dataset.col) }
    : cellFromPoint(event.clientX, event.clientY);
  if (!targetCell) return;
  const { row, col } = targetCell;
  if (selectedTool === "shovel") {
    event.preventDefault();
    event.stopPropagation();
    shovelUnit(row, col);
    return;
  }
  placeParrot(row, col);
});

startBtn.addEventListener("click", () => {
  if (gameOver) {
    resetGame();
  } else if (running) {
    pauseGame();
  } else if (hasStarted) {
    startGame();
  } else {
    startGame();
  }
});

unlockContinueBtn?.addEventListener("click", closeUnlockModal);

window.addEventListener("resize", () => {
  updateGameScale();
});

window.visualViewport?.addEventListener("resize", () => {
  updateGameScale();
});

updateGameScale();
buildGrid();
syncSelection();
updateHud();
setInterval(updateHud, 250);
