const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreSpan = document.getElementById('score');
const highScoreSpan = document.getElementById('highScore');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const soundToggleBtn = document.getElementById('soundToggle');

canvas.width = 400;
canvas.height = 600;

let gameActive = false;
let score = 0;
let highScore = localStorage.getItem('faceRunnerHighScore') || 0;
highScoreSpan.textContent = highScore;

let frameId;
let frames = 0;

// Музыка фоновая
let bgMusic = new Audio('assets/background.mp3');
bgMusic.loop = true;
bgMusic.volume = 0.5;
let isMusicMuted = false;

// Звук проигрыша
let gameoverSound = new Audio('assets/gameover.mp3');
gameoverSound.loop = false;
gameoverSound.volume = 0.7;

// Звук сбора монетки
let coinSound = new Audio('assets/coin.mp3');
coinSound.volume = 0.6;

// Игрок (ваша голова)
const player = {
    x: canvas.width / 2 - 35,
    y: canvas.height - 100,
    width: 80,
    height: 80,
    hitboxScale: 0.7,
    speed: 6,
    image: new Image()
};
player.image.src = 'assets/head.jpg';

// Загрузка изображений
function loadImage(src) {
    const img = new Image();
    img.src = src;
    return img;
}

// ===== ИЗМЕНЕНИЯ ЗДЕСЬ: теперь только один тип врага с i.png =====
const obstacleTypes = [
    { 
        name: 'enemy', 
        emoji: '👾',           // запасной вариант, если PNG не загрузится
        png: loadImage('assets/i.png')   // новое изображение врага
    }
];

// Собираемые предметы (монетка)
const collectibleTypes = [
    { 
        name: 'coin', 
        emoji: '🪙', 
        png: loadImage('assets/coin.png'), 
        points: 10 
    }
];

const OBSTACLE_SIZE = 50;
const COLLECTIBLE_SIZE = 45;
const OBSTACLE_HITBOX_SCALE = 0.8;
const COLLECTIBLE_HITBOX_SCALE = 0.8;
const FALL_SPEED = 3;
const OBSTACLE_SPAWN_RATE = 45;       // частота появления врагов
const COLLECTIBLE_SPAWN_RATE = 90;    // монетки в 3 раза реже (было 30)

let obstacles = [];
let collectibles = [];

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

// Мобильные касания
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

// Мышь
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

// Кнопка звука
soundToggleBtn.addEventListener('click', () => {
    if (isMusicMuted) {
        if (gameActive) {
            bgMusic.play().catch(e => console.log('Не удалось запустить музыку:', e));
        }
        soundToggleBtn.textContent = '🔊';
        soundToggleBtn.classList.remove('muted');
    } else {
        bgMusic.pause();
        soundToggleBtn.textContent = '🔈';
        soundToggleBtn.classList.add('muted');
    }
    isMusicMuted = !isMusicMuted;
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', restartGame);

function startGame() {
    gameoverSound.pause();
    gameoverSound.currentTime = 0;
    coinSound.pause();
    coinSound.currentTime = 0;

    gameActive = true;
    score = 0;
    obstacles = [];
    collectibles = [];
    player.x = canvas.width / 2 - player.width / 2;
    frames = 0;
    startBtn.style.display = 'none';
    restartBtn.style.display = 'inline-block';
    scoreSpan.textContent = score;

    if (!isMusicMuted) {
        bgMusic.play().catch(e => console.log('Автовоспроизведение заблокировано:', e));
    }

    gameLoop();
}

function restartGame() {
    cancelAnimationFrame(frameId);
    bgMusic.pause();
    bgMusic.currentTime = 0;
    gameoverSound.pause();
    gameoverSound.currentTime = 0;
    coinSound.pause();
    coinSound.currentTime = 0;
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
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Спавн препятствий (только один тип врага)
    if (frames % OBSTACLE_SPAWN_RATE === 0) {
        const type = obstacleTypes[0]; // всегда первый (и единственный) тип
        obstacles.push({
            x: Math.random() * (canvas.width - OBSTACLE_SIZE),
            y: -OBSTACLE_SIZE,
            width: OBSTACLE_SIZE,
            height: OBSTACLE_SIZE,
            type: type
        });
    }

    // Спавн собираемых предметов (монеток) с проверкой наложения
    if (frames % COLLECTIBLE_SPAWN_RATE === 0) {
        const type = collectibleTypes[0];
        let placed = false;
        let attempts = 0;
        const maxAttempts = 20;
        while (!placed && attempts < maxAttempts) {
            const newX = Math.random() * (canvas.width - COLLECTIBLE_SIZE);
            const newY = -COLLECTIBLE_SIZE; // начинаем сверху
            // Проверяем пересечение с существующими препятствиями
            let collides = false;
            for (let obs of obstacles) {
                // Простая проверка прямоугольников
                if (!(newX + COLLECTIBLE_SIZE < obs.x ||
                      newX > obs.x + obs.width ||
                      newY + COLLECTIBLE_SIZE < obs.y ||
                      newY > obs.y + obs.height)) {
                    collides = true;
                    break;
                }
            }
            if (!collides) {
                collectibles.push({
                    x: newX,
                    y: newY,
                    width: COLLECTIBLE_SIZE,
                    height: COLLECTIBLE_SIZE,
                    type: type,
                    points: type.points
                });
                placed = true;
            }
            attempts++;
        }
        // Если не удалось разместить, просто пропускаем этот кадр
    }

    // Обработка препятствий (врагов)
    for (let i = obstacles.length - 1; i >= 0; i--) {
        const obs = obstacles[i];
        obs.y += FALL_SPEED;

        const playerHitbox = {
            x: player.x + player.width * (1 - player.hitboxScale) / 2,
            y: player.y + player.height * (1 - player.hitboxScale) / 2,
            w: player.width * player.hitboxScale,
            h: player.height * player.hitboxScale
        };
        const obsHitbox = {
            x: obs.x + obs.width * (1 - OBSTACLE_HITBOX_SCALE) / 2,
            y: obs.y + obs.height * (1 - OBSTACLE_HITBOX_SCALE) / 2,
            w: obs.width * OBSTACLE_HITBOX_SCALE,
            h: obs.height * OBSTACLE_HITBOX_SCALE
        };

        if (!(playerHitbox.x + playerHitbox.w < obsHitbox.x ||
              playerHitbox.x > obsHitbox.x + obsHitbox.w ||
              playerHitbox.y + playerHitbox.h < obsHitbox.y ||
              playerHitbox.y > obsHitbox.y + obsHitbox.h)) {
            gameActive = false;
            bgMusic.pause();
            bgMusic.currentTime = 0;
            if (!isMusicMuted) {
                gameoverSound.currentTime = 0;
                gameoverSound.play().catch(e => console.log('Ошибка gameover sound:', e));
            }
            cancelAnimationFrame(frameId);
            drawGameOver();
            updateHighScore();
            return;
        }

        if (obs.y > canvas.height) {
            obstacles.splice(i, 1);
        }
    }

    // Обработка собираемых предметов (монеток)
    for (let i = collectibles.length - 1; i >= 0; i--) {
        const col = collectibles[i];
        col.y += FALL_SPEED;

        const playerHitbox = {
            x: player.x + player.width * (1 - player.hitboxScale) / 2,
            y: player.y + player.height * (1 - player.hitboxScale) / 2,
            w: player.width * player.hitboxScale,
            h: player.height * player.hitboxScale
        };
        const colHitbox = {
            x: col.x + col.width * (1 - COLLECTIBLE_HITBOX_SCALE) / 2,
            y: col.y + col.height * (1 - COLLECTIBLE_HITBOX_SCALE) / 2,
            w: col.width * COLLECTIBLE_HITBOX_SCALE,
            h: col.height * COLLECTIBLE_HITBOX_SCALE
        };

        if (!(playerHitbox.x + playerHitbox.w < colHitbox.x ||
              playerHitbox.x > colHitbox.x + colHitbox.w ||
              playerHitbox.y + playerHitbox.h < colHitbox.y ||
              playerHitbox.y > colHitbox.y + colHitbox.h)) {
            // Собираем монетку
            score += col.points;
            scoreSpan.textContent = score;
            if (!isMusicMuted) {
                coinSound.currentTime = 0;
                coinSound.play().catch(e => console.log('Ошибка coin sound:', e));
            }
            collectibles.splice(i, 1);
            continue;
        }

        if (col.y > canvas.height) {
            collectibles.splice(i, 1);
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Рисуем игрока
    if (player.image.complete && player.image.naturalHeight !== 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(player.x + player.width/2, player.y + player.height/2, player.width/2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(player.image, player.x, player.y, player.width, player.height);
        ctx.restore();
    } else {
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(player.x + player.width/2, player.y + player.height/2, player.width/2, 0, Math.PI*2);
        ctx.fill();
    }

    // Рисуем препятствия (врагов) - теперь только один тип
    obstacles.forEach(obs => {
        if (obs.type.png && obs.type.png.complete && obs.type.png.naturalHeight !== 0) {
            ctx.drawImage(obs.type.png, obs.x, obs.y, obs.width, obs.height);
        } else {
            ctx.font = `${obs.width}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(obs.type.emoji, obs.x + obs.width/2, obs.y + obs.height/2);
        }
    });

    // Рисуем монетки
    collectibles.forEach(col => {
        if (col.type.png && col.type.png.complete && col.type.png.naturalHeight !== 0) {
            ctx.drawImage(col.type.png, col.x, col.y, col.width, col.height);
        } else {
            ctx.font = `${col.width}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(col.type.emoji, col.x + col.width/2, col.y + col.height/2);
        }
    });
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
