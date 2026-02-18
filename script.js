const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreSpan = document.getElementById('score');
const highScoreSpan = document.getElementById('highScore');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

// Размеры canvas (физические, не CSS)
canvas.width = 400;
canvas.height = 600;

// Параметры игры
let gameActive = false;
let score = 0;
let highScore = localStorage.getItem('faceRunnerHighScore') || 0;
highScoreSpan.textContent = highScore;

let frameId;
let frames = 0;

// Игрок
const player = {
    x: 70,
    y: canvas.height - 150, // начальная позиция (стоим на земле)
    width: 60,
    height: 60,
    vy: 0,
    gravity: 0.5,
    jumpPower: -12,
    grounded: true,
    image: new Image()
};
player.image.src = 'assets/head.png'; // убедитесь, что файл лежит по этому пути

// Препятствия
let obstacles = [];
const obstacleTypes = [
    { emoji: '💩', name: 'poop' },
    { emoji: '🧻', name: 'toilet' },
    { emoji: '🗑️', name: 'trash' },
    { emoji: '🦠', name: 'virus' }
];
const OBSTACLE_WIDTH = 40;
const OBSTACLE_HEIGHT = 40;
const MIN_OBS_Y = canvas.height - 200; // минимальная Y (земля)
const MAX_OBS_Y = canvas.height - 100; // максимальная Y (чуть выше)
const OBSTACLE_SPEED = 4;
const SPAWN_RATE = 60; // кадров между появлениями

// Управление
let jumpRequested = false;

// Функция прыжка
function jump() {
    if (!gameActive) return;
    if (player.grounded) {
        player.vy = player.jumpPower;
        player.grounded = false;
    }
}

// Обработчики событий
canvas.addEventListener('click', (e) => {
    e.preventDefault();
    jump();
});
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    jump();
});
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        jump();
    }
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);

function startGame() {
    gameActive = true;
    score = 0;
    obstacles = [];
    player.y = canvas.height - 150;
    player.vy = 0;
    player.grounded = true;
    frames = 0;
    startBtn.style.display = 'none';
    restartBtn.style.display = 'inline-block';
    gameLoop();
}

function restartGame() {
    cancelAnimationFrame(frameId);
    startGame();
}

function gameLoop() {
    if (!gameActive) return;
    update();
    draw();
    frameId = requestAnimationFrame(gameLoop);
}

function update() {
    frames++;

    // Гравитация
    player.vy += player.gravity;
    player.y += player.vy;

    // Границы земли
    const groundY = canvas.height - 150;
    if (player.y > groundY) {
        player.y = groundY;
        player.vy = 0;
        player.grounded = true;
    }

    // Спавн препятствий
    if (frames % SPAWN_RATE === 0) {
        const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        obstacles.push({
            x: canvas.width,
            y: Math.random() * (MAX_OBS_Y - MIN_OBS_Y) + MIN_OBS_Y,
            width: OBSTACLE_WIDTH,
            height: OBSTACLE_HEIGHT,
            type: type
        });
    }

    // Движение препятствий и проверка столкновений
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.x -= OBSTACLE_SPEED;

        // Столкновение с игроком
        if (!(player.x + player.width < obs.x ||
              player.x > obs.x + obs.width ||
              player.y + player.height < obs.y ||
              player.y > obs.y + obs.height)) {
            gameActive = false;
            cancelAnimationFrame(frameId);
            drawGameOver();
            updateHighScore();
            return;
        }

        // Удаляем, если ушли за экран
        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
            score++;
            scoreSpan.textContent = score;
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем фон (небо и земля уже заданы в CSS, но можно перекрыть)
    // Здесь можно добавить детали: облака, траву

    // Рисуем игрока (фото)
    if (player.image.complete) {
        // Рисуем круглую маску (если фото квадратное)
        ctx.save();
        ctx.beginPath();
        ctx.arc(player.x + player.width/2, player.y + player.height/2, player.width/2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(player.image, player.x, player.y, player.width, player.height);
        ctx.restore();
    } else {
        // Пока грузится — заглушка
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    // Рисуем препятствия (эмодзи)
    ctx.font = `${OBSTACLE_HEIGHT}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    obstacles.forEach(obs => {
        ctx.fillText(obs.type.emoji, obs.x + obs.width/2, obs.y + obs.height/2);
    });

    // Отображаем счёт (дополнительно на canvas, но у нас уже есть сверху)
}

function drawGameOver() {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 30px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', canvas.width/2, canvas.height/2 - 30);
    ctx.font = '20px Arial';
    ctx.fillText(`Счёт: ${score}`, canvas.width/2, canvas.height/2 + 10);
}

function updateHighScore() {
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('faceRunnerHighScore', highScore);
        highScoreSpan.textContent = highScore;
    }
}
