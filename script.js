const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreSpan = document.getElementById('score');
const highScoreSpan = document.getElementById('highScore');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');

canvas.width = 400;
canvas.height = 600;

let gameActive = false;
let score = 0;
let highScore = localStorage.getItem('faceRunnerHighScore') || 0;
highScoreSpan.textContent = highScore;

let frameId;
let frames = 0;

// Игрок (ваша голова)
const player = {
    x: canvas.width / 2 - 35,  // центрируем
    y: canvas.height - 100,     // стоит почти у пола
    width: 80,                  // визуальный размер (увеличен)
    height: 80,
    hitboxScale: 0.7,           // хитбокс 70% от визуала
    speed: 6,
    image: new Image()
};
player.image.src = 'assets/head.jpg'; // убедитесь, что фото лежит в assets/

// Препятствия
let obstacles = [];
const obstacleTypes = [
    { emoji: '💩', name: 'poop' },
    { emoji: '🧻', name: 'toilet' },
    { emoji: '🗑️', name: 'trash' },
    { emoji: '🦠', name: 'virus' }
];
const OBSTACLE_SIZE = 50;               // визуальный размер
const OBSTACLE_HITBOX_SCALE = 0.8;      // хитбокс 80%
const FALL_SPEED = 3;
const SPAWN_RATE = 35;                  // чаще, чем было (больше экшена)

// Управление
let leftPressed = false;
let rightPressed = false;

// Клавиатура
document.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft') {
        e.preventDefault();
        leftPressed = true;
    }
    if (e.code === 'ArrowRight') {
        e.preventDefault();
        rightPressed = true;
    }
});
document.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft') leftPressed = false;
    if (e.code === 'ArrowRight') rightPressed = false;
});

// Мобильные касания (по левой/правой половине)
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const canvasX = (touch.clientX - rect.left) * scaleX;
    if (canvasX < canvas.width / 2) {
        leftPressed = true;
    } else {
        rightPressed = true;
    }
});
canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    leftPressed = false;
    rightPressed = false;
});
canvas.addEventListener('touchcancel', (e) => {
    e.preventDefault();
    leftPressed = false;
    rightPressed = false;
});

// Мышь (для теста на компьютере)
canvas.addEventListener('mousedown', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const canvasX = (e.clientX - rect.left) * scaleX;
    if (canvasX < canvas.width / 2) {
        leftPressed = true;
    } else {
        rightPressed = true;
    }
});
canvas.addEventListener('mouseup', () => {
    leftPressed = false;
    rightPressed = false;
});
canvas.addEventListener('mouseleave', () => {
    leftPressed = false;
    rightPressed = false;
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);

function startGame() {
    gameActive = true;
    score = 0;
    obstacles = [];
    player.x = canvas.width / 2 - player.width / 2;
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

    // Движение игрока
    if (leftPressed) player.x -= player.speed;
    if (rightPressed) player.x += player.speed;
    // Границы
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Спавн препятствий
    if (frames % SPAWN_RATE === 0) {
        const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
        obstacles.push({
            x: Math.random() * (canvas.width - OBSTACLE_SIZE),
            y: -OBSTACLE_SIZE,
            width: OBSTACLE_SIZE,
            height: OBSTACLE_SIZE,
            type: type
        });
    }

    // Обновление препятствий и проверка столкновений
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.y += FALL_SPEED;

        // Hitbox игрока
        const playerHitbox = {
            x: player.x + player.width * (1 - player.hitboxScale) / 2,
            y: player.y + player.height * (1 - player.hitboxScale) / 2,
            w: player.width * player.hitboxScale,
            h: player.height * player.hitboxScale
        };
        // Hitbox препятствия
        const obsHitbox = {
            x: obs.x + obs.width * (1 - OBSTACLE_HITBOX_SCALE) / 2,
            y: obs.y + obs.height * (1 - OBSTACLE_HITBOX_SCALE) / 2,
            w: obs.width * OBSTACLE_HITBOX_SCALE,
            h: obs.height * OBSTACLE_HITBOX_SCALE
        };

        // Проверка пересечения
        if (!(playerHitbox.x + playerHitbox.w < obsHitbox.x ||
              playerHitbox.x > obsHitbox.x + obsHitbox.w ||
              playerHitbox.y + playerHitbox.h < obsHitbox.y ||
              playerHitbox.y > obsHitbox.y + obsHitbox.h)) {
            gameActive = false;
            cancelAnimationFrame(frameId);
            drawGameOver();
            updateHighScore();
            return;
        }

        // Удаляем, если упало вниз (увеличиваем счёт)
        if (obs.y > canvas.height) {
            obstacles.splice(i, 1);
            score++;
            scoreSpan.textContent = score;
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем игрока с круглой маской
    if (player.image.complete) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(player.x + player.width/2, player.y + player.height/2, player.width/2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(player.image, player.x, player.y, player.width, player.height);
        ctx.restore();
    } else {
        ctx.fillStyle = '#ffaa00';
        ctx.fillRect(player.x, player.y, player.width, player.height);
    }

    // Рисуем препятствия (эмодзи)
    ctx.font = `${OBSTACLE_SIZE}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    obstacles.forEach(obs => {
        ctx.fillText(obs.type.emoji, obs.x + obs.width/2, obs.y + obs.height/2);
    });

    // Для отладки можно раскомментировать и увидеть hitbox'ы
    /*
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 2;
    const playerHitbox = {
        x: player.x + player.width * (1 - player.hitboxScale) / 2,
        y: player.y + player.height * (1 - player.hitboxScale) / 2,
        w: player.width * player.hitboxScale,
        h: player.height * player.hitboxScale
    };
    ctx.strokeRect(playerHitbox.x, playerHitbox.y, playerHitbox.w, playerHitbox.h);
    obstacles.forEach(obs => {
        const obsHitbox = {
            x: obs.x + obs.width * (1 - OBSTACLE_HITBOX_SCALE) / 2,
            y: obs.y + obs.height * (1 - OBSTACLE_HITBOX_SCALE) / 2,
            w: obs.width * OBSTACLE_HITBOX_SCALE,
            h: obs.height * OBSTACLE_HITBOX_SCALE
        };
        ctx.strokeStyle = 'blue';
        ctx.strokeRect(obsHitbox.x, obsHitbox.y, obsHitbox.w, obsHitbox.h);
    });
    */
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
