const characters = [
  { id: "Barai", name: "Barai", tag: "The Juari", image: "public/barai.jpeg" },
];

const characterScreen = document.querySelector("#characterScreen");
const gameScreen = document.querySelector("#gameScreen");
const characterGrid = document.querySelector("#characters");
const startButton = document.querySelector("#startBtn");
const backButton = document.querySelector("#backBtn");
const restartButton = document.querySelector("#restartBtn");
const changeFriendButton = document.querySelector("#changeFriendBtn");
const canvas = document.querySelector("#gameCanvas");
const context = canvas.getContext("2d");
const scoreValue = document.querySelector("#scoreValue");
const gameOverlay = document.querySelector("#gameOverlay");
const finalScore = document.querySelector("#finalScore");
const bestScore = document.querySelector("#bestScore");
const overlayTitle = document.querySelector("#overlayTitle");
const touchHint = document.querySelector(".touch-hint");

const physics = {
  gravity: 1480,
  flapVelocity: -480,
  pipeSpeed: 190,
  pipeWidth: 72,
  pipeGap: 176,
  pipeInterval: 1.55,
};

let selectedCharacter = characters[0];
let selectedImage = new Image();
const crashSound = new Audio("public/barai.m4a");
crashSound.preload = "auto";
crashSound.volume = 0.78;
let phase = "menu";
let score = 0;
let best = loadBestScore();
let lastTime = 0;
let pipeTimer = 0;
let animationFrame = 0;
let hasStarted = false;
let bird = { x: 0, y: 0, velocity: 0, rotation: 0, radius: 20 };
let pipes = [];
let canvasWidth = 0;
let canvasHeight = 0;

function loadBestScore() {
  try {
    return (
      Number.parseInt(localStorage.getItem("friend-flappy-best") || "0", 10) ||
      0
    );
  } catch {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    localStorage.setItem("friend-flappy-best", String(value));
  } catch {
    // The game still works when storage is unavailable.
  }
}

function renderCharacterChoices() {
  characterGrid.innerHTML = characters
    .map(
      (character) => `
    <button class="character-card${character.id === selectedCharacter.id ? " selected" : ""}" type="button" data-character="${character.id}" aria-pressed="${character.id === selectedCharacter.id}">
      <img src="${character.image}" alt="${character.name} placeholder portrait" />
      <span class="character-name">${character.name}</span>
      <span class="character-tag">${character.tag}</span>
    </button>
  `,
    )
    .join("");

  characterGrid.querySelectorAll(".character-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedCharacter =
        characters.find(
          (character) => character.id === card.dataset.character,
        ) || characters[0];
      selectedImage = new Image();
      selectedImage.src = selectedCharacter.image;
      renderCharacterChoices();
    });
  });
}

function showMenu() {
  phase = "menu";
  cancelAnimationFrame(animationFrame);
  gameScreen.hidden = true;
  characterScreen.hidden = false;
  gameOverlay.hidden = true;
  touchHint.classList.remove("is-hidden");
}

function showGame() {
  characterScreen.hidden = true;
  gameScreen.hidden = false;
  resizeCanvas();
  startRound();
}

function resizeCanvas() {
  const width = Math.min(window.innerWidth - 26, 520);
  const height = Math.max(460, Math.min(window.innerHeight - 118, 760));
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

  canvasWidth = Math.max(280, width);
  canvasHeight = height;
  canvas.width = Math.round(canvasWidth * pixelRatio);
  canvas.height = Math.round(canvasHeight * pixelRatio);
  canvas.style.aspectRatio = `${canvasWidth} / ${canvasHeight}`;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  if (phase === "menu") return;
  bird.x = canvasWidth * 0.27;
  if (phase === "ready") bird.y = canvasHeight * 0.43;
}

function startRound() {
  phase = "ready";
  score = 0;
  scoreValue.textContent = score;
  pipes = [];
  pipeTimer = 0;
  bird = {
    x: canvasWidth * 0.27,
    y: canvasHeight * 0.43,
    velocity: 0,
    rotation: 0,
    radius: 21,
  };
  gameOverlay.hidden = true;
  touchHint.classList.remove("is-hidden");
  lastTime = performance.now();
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(gameLoop);
}

function beginFlight() {
  if (phase === "ready") {
    phase = "running";
    hasStarted = true;
    touchHint.classList.add("is-hidden");
  }
  if (phase === "running") bird.velocity = physics.flapVelocity;
}

function addPipe() {
  const floor = canvasHeight - 47;
  const safeMargin = 78;
  const minimumGapCenter = safeMargin + physics.pipeGap / 2;
  const maximumGapCenter = floor - safeMargin - physics.pipeGap / 2;
  const gapCenter =
    minimumGapCenter +
    Math.random() * Math.max(1, maximumGapCenter - minimumGapCenter);
  pipes.push({ x: canvasWidth + 16, gapCenter, scored: false });
}

function update(delta) {
  if (phase !== "running") return;

  bird.velocity += physics.gravity * delta;
  bird.y += bird.velocity * delta;
  bird.rotation = Math.max(-0.45, Math.min(1.25, bird.velocity / 680));
  pipeTimer += delta;

  if (pipeTimer >= physics.pipeInterval) {
    pipeTimer -= physics.pipeInterval;
    addPipe();
  }

  pipes.forEach((pipe) => {
    pipe.x -= physics.pipeSpeed * delta;
  });
  pipes = pipes.filter((pipe) => pipe.x + physics.pipeWidth > -20);

  pipes.forEach((pipe) => {
    if (!pipe.scored && pipe.x + physics.pipeWidth < bird.x) {
      pipe.scored = true;
      score += 1;
      scoreValue.textContent = score;
    }
  });

  const floor = canvasHeight - 47;
  const birdHitEdge = bird.y - bird.radius < 0 || bird.y + bird.radius > floor;
  const birdHitPipe = pipes.some((pipe) => {
    const withinPipeX =
      bird.x + bird.radius > pipe.x &&
      bird.x - bird.radius < pipe.x + physics.pipeWidth;
    const outsideGap =
      bird.y - bird.radius < pipe.gapCenter - physics.pipeGap / 2 ||
      bird.y + bird.radius > pipe.gapCenter + physics.pipeGap / 2;
    return withinPipeX && outsideGap;
  });

  if (birdHitEdge || birdHitPipe) endRound();
}

function endRound() {
  phase = "gameover";
  crashSound.currentTime = 0;
  const playback = crashSound.play();
  if (playback && typeof playback.catch === "function")
    playback.catch(() => {});
  best = Math.max(best, score);
  saveBestScore(best);
  finalScore.textContent = score;
  bestScore.textContent = best;
  overlayTitle.textContent = score > 0 ? "Great flying!" : "Nice try!";
  gameOverlay.hidden = false;
}

function draw() {
  drawSky();
  pipes.forEach(drawPipe);
  drawGround();
  drawBird();
}

function drawSky() {
  const sky = context.createLinearGradient(0, 0, 0, canvasHeight);
  sky.addColorStop(0, "#293d81");
  sky.addColorStop(0.55, "#6682c1");
  sky.addColorStop(1, "#f0a6a4");
  context.fillStyle = sky;
  context.fillRect(0, 0, canvasWidth, canvasHeight);

  context.globalAlpha = 0.24;
  context.fillStyle = "#fff4d0";
  context.beginPath();
  context.arc(canvasWidth * 0.78, canvasHeight * 0.16, 47, 0, Math.PI * 2);
  context.fill();
  context.globalAlpha = 1;

  drawCloud(canvasWidth * 0.1, canvasHeight * 0.22, 0.8);
  drawCloud(canvasWidth * 0.73, canvasHeight * 0.34, 0.55);
}

function drawCloud(x, y, scale) {
  context.save();
  context.globalAlpha = 0.18;
  context.fillStyle = "#fff";
  context.beginPath();
  context.arc(x, y, 17 * scale, 0, Math.PI * 2);
  context.arc(x + 21 * scale, y - 8 * scale, 25 * scale, 0, Math.PI * 2);
  context.arc(x + 48 * scale, y, 16 * scale, 0, Math.PI * 2);
  context.roundRect(x - 17 * scale, y, 82 * scale, 17 * scale, 10 * scale);
  context.fill();
  context.restore();
}

function drawPipe(pipe) {
  const topEnd = pipe.gapCenter - physics.pipeGap / 2;
  const bottomStart = pipe.gapCenter + physics.pipeGap / 2;
  drawPipePart(pipe.x, -10, physics.pipeWidth, topEnd + 10, true);
  drawPipePart(
    pipe.x,
    bottomStart,
    physics.pipeWidth,
    canvasHeight - bottomStart,
    false,
  );
}

function drawPipePart(x, y, width, height, isTop) {
  const pipeGradient = context.createLinearGradient(x, 0, x + width, 0);
  pipeGradient.addColorStop(0, "#243b68");
  pipeGradient.addColorStop(0.25, "#5e7fbd");
  pipeGradient.addColorStop(0.55, "#7897d0");
  pipeGradient.addColorStop(1, "#304a80");
  context.fillStyle = pipeGradient;
  context.fillRect(x, y, width, height);

  const capHeight = 19;
  const capY = isTop ? y + height - capHeight : y;
  context.fillStyle = "#89a7dc";
  context.fillRect(x - 5, capY, width + 10, capHeight);
  context.fillStyle = "rgba(20, 31, 72, 0.22)";
  context.fillRect(x + width - 9, y, 9, height);
}

function drawGround() {
  const floor = canvasHeight - 47;
  context.fillStyle = "#182a5c";
  context.fillRect(0, floor, canvasWidth, 47);
  context.fillStyle = "#f3d77e";
  context.fillRect(0, floor, canvasWidth, 6);
  context.globalAlpha = 0.22;
  context.fillStyle = "#fff4b0";
  for (let x = -20; x < canvasWidth + 25; x += 30) {
    context.beginPath();
    context.moveTo(x, floor + 14);
    context.lineTo(x + 17, floor + 47);
    context.lineTo(x + 27, floor + 47);
    context.lineTo(x + 9, floor + 14);
    context.fill();
  }
  context.globalAlpha = 1;
}

function drawBird() {
  context.save();
  context.translate(bird.x, bird.y);
  context.rotate(bird.rotation);
  context.shadowColor = "rgba(16, 20, 48, 0.32)";
  context.shadowBlur = 10;
  context.shadowOffsetY = 5;
  context.beginPath();
  context.arc(0, 0, bird.radius, 0, Math.PI * 2);
  context.clip();
  if (selectedImage.complete && selectedImage.naturalWidth > 0) {
    context.drawImage(
      selectedImage,
      -bird.radius,
      -bird.radius,
      bird.radius * 2,
      bird.radius * 2,
    );
  } else {
    context.fillStyle = "#ff97c4";
    context.fill();
  }
  context.restore();

  context.save();
  context.translate(bird.x, bird.y);
  context.rotate(bird.rotation);
  context.strokeStyle = "rgba(255,255,255,0.85)";
  context.lineWidth = 2;
  context.beginPath();
  context.arc(0, 0, bird.radius, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function gameLoop(timestamp) {
  const delta = Math.min((timestamp - lastTime) / 1000, 0.035);
  lastTime = timestamp;
  update(delta);
  draw();
  if (phase !== "gameover") animationFrame = requestAnimationFrame(gameLoop);
}

function handleAction(event) {
  if (event) event.preventDefault();
  if (phase === "ready" || phase === "running") beginFlight();
  else if (phase === "gameover") startRound();
}

startButton.addEventListener("click", showGame);
restartButton.addEventListener("click", startRound);
backButton.addEventListener("click", showMenu);
changeFriendButton.addEventListener("click", showMenu);
canvas.addEventListener("pointerdown", handleAction, { passive: false });
window.addEventListener("resize", resizeCanvas);
window.addEventListener("keydown", (event) => {
  if (event.code !== "Space" && event.code !== "ArrowUp") return;
  event.preventDefault();
  if (!characterScreen.hidden && event.code === "Space") showGame();
  else handleAction(event);
});

selectedImage.src = selectedCharacter.image;
bestScore.textContent = best;
renderCharacterChoices();
