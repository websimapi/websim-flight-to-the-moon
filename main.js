const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const altitudeDisplay = document.getElementById('altitude-display');
const charSelectionScreen = document.getElementById('character-selection');
const gameOverScreen = document.getElementById('game-over-screen');
const winScreen = document.getElementById('win-screen');
const finalAltitudeDisplay = document.getElementById('final-altitude');
const restartButton = document.getElementById('restart-button');
const playAgainButton = document.getElementById('play-again-button');

let canvasWidth, canvasHeight;

const BIRD_STATS = {
    sparrow: { speed: 100, agility: 5, img: 'sparrow.png' },
    eagle: { speed: 150, agility: 3, img: 'eagle.png' },
    hummingbird: { speed: 75, agility: 8, img: 'hummingbird.png' }
};

const LEVELS = {
    FOREST: { altitude: 0, bg: 'forest_bg.png', obstacle: 'nut.png', obsSpeed: 200 },
    SKY: { altitude: 1000, bg: 'sky_bg.png', obstacle: 'raindrop.png', obsSpeed: 350 },
    SPACE: { altitude: 5000, bg: 'space_bg.png', obstacle: 'asteroid.png', obsSpeed: 500 },
    MOON: { altitude: 15000 }
};

let gameState = 'char-select'; // char-select, playing, game-over, win
let player, obstacles, altitude, currentLevel;
let backgrounds = {};
let playerImage, obstacleImages = {};
let targetX = null;
let lastTime = 0;
let bgY = [0, 0];

const sounds = {};

function loadAssets() {
    const promises = [];
    
    // Images
    const imageUrls = {
        sparrow: 'sparrow.png', eagle: 'eagle.png', hummingbird: 'hummingbird.png',
        forest_bg: 'forest_bg.png', sky_bg: 'sky_bg.png', space_bg: 'space_bg.png', forest_top_bg: 'forest_top_bg.png',
        nut: 'nut.png', raindrop: 'raindrop.png', asteroid: 'asteroid.png',
        moon: 'moon.png'
    };

    for (const key in imageUrls) {
        promises.push(new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                if(key.includes('_bg')) backgrounds[key] = img;
                else if (BIRD_STATS[key]) BIRD_STATS[key].image = img;
                else if (key === 'moon') backgrounds[key] = img;
                else obstacleImages[key] = img;
                resolve();
            };
            img.src = imageUrls[key];
        }));
    }

    // Sounds
    const soundUrls = {
        hit: 'hit.mp3',
        level_up: 'level_up.mp3',
        win: 'win.mp3',
        flap: 'flap.mp3',
        music: 'game_music.mp3'
    };
    for (const key in soundUrls) {
        promises.push(new Promise(resolve => {
            const audio = new Audio(soundUrls[key]);
            if (key === 'music') audio.loop = true;
            sounds[key] = audio;
            resolve();
        }));
    }
    
    return Promise.all(promises);
}

function resizeCanvas() {
    canvasWidth = window.innerWidth;
    canvasHeight = window.innerHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    bgY = [0, -canvasHeight];
}

function initGame(birdType) {
    const stats = BIRD_STATS[birdType];
    player = {
        x: canvasWidth / 2,
        y: canvasHeight - 150,
        width: 60,
        height: 60,
        speed: stats.speed, // pixels (altitude) per second
        agility: stats.agility,
        image: stats.image
    };
    targetX = player.x;
    altitude = 0;
    obstacles = [];
    currentLevel = LEVELS.FOREST;
    gameState = 'playing';
    charSelectionScreen.style.display = 'none';
    gameOverScreen.style.display = 'none';
    winScreen.style.display = 'none';
    altitudeDisplay.style.display = 'block';

    sounds.music.currentTime = 0;
    sounds.music.play();
}

function update(dt) {
    if (gameState !== 'playing') return;

    // Update altitude
    altitude += player.speed * dt;
    altitudeDisplay.textContent = `Altitude: ${Math.floor(altitude)} ft`;

    // Update player horizontal position
    const dx = targetX - player.x;
    if (Math.abs(dx) > 1) {
        player.x += dx * player.agility * dt;
    }

    // Clamp player position
    player.x = Math.max(player.width/2, Math.min(canvasWidth - player.width/2, player.x));

    // Update background scroll
    const scrollSpeed = player.speed;
    bgY[0] += scrollSpeed * dt;
    bgY[1] += scrollSpeed * dt;
    if (bgY[0] >= canvasHeight) bgY[0] = bgY[1] - canvasHeight;
    if (bgY[1] >= canvasHeight) bgY[1] = bgY[0] - canvasHeight;

    // Update obstacles
    obstacles.forEach(obs => {
        obs.y += currentLevel.obsSpeed * dt;
    });

    // Remove off-screen obstacles
    obstacles = obstacles.filter(obs => obs.y < canvasHeight + obs.height);

    // Spawn new obstacles
    if (Math.random() < 2 * dt) { // Spawn rate
        obstacles.push({
            x: Math.random() * canvasWidth,
            y: -50,
            width: 50,
            height: 50,
            image: obstacleImages[currentLevel.obstacle.replace('.png', '')]
        });
    }

    // Check collisions
    obstacles.forEach(obs => {
        if (
            player.x < obs.x + obs.width &&
            player.x + player.width > obs.x &&
            player.y < obs.y + obs.height &&
            player.y + player.height > obs.y
        ) {
            sounds.hit.play();
            sounds.music.pause();
            gameState = 'game-over';
            finalAltitudeDisplay.textContent = Math.floor(altitude);
            gameOverScreen.style.display = 'flex';
            altitudeDisplay.style.display = 'none';
        }
    });
    
    // Check level transitions
    let nextLevelKey = null;
    if (altitude >= LEVELS.SPACE.altitude && currentLevel !== LEVELS.SPACE) nextLevelKey = 'SPACE';
    else if (altitude >= LEVELS.SKY.altitude && currentLevel !== LEVELS.SKY) nextLevelKey = 'SKY';

    if(nextLevelKey) {
        currentLevel = LEVELS[nextLevelKey];
        sounds.level_up.play();
    }
    
    // Check for win condition
    if (altitude >= LEVELS.MOON.altitude) {
        sounds.win.play();
        sounds.music.pause();
        gameState = 'win';
        winScreen.style.display = 'flex';
        altitudeDisplay.style.display = 'none';
    }
}


function draw() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw background
    let bgImage;
    const forestTopTransitionAltitude = LEVELS.SKY.altitude - 500; // Start transition 500ft before sky level

    if (altitude >= LEVELS.SPACE.altitude) {
        bgImage = backgrounds.space_bg;
    } else if (altitude >= LEVELS.SKY.altitude) {
        bgImage = backgrounds.sky_bg;
    } else if (altitude >= forestTopTransitionAltitude) {
        bgImage = backgrounds.forest_top_bg;
    } else {
        bgImage = backgrounds.forest_bg;
    }
    
    if (bgImage) {
        ctx.drawImage(bgImage, 0, bgY[0], canvasWidth, canvasHeight);
        ctx.drawImage(bgImage, 0, bgY[1], canvasWidth, canvasHeight);
    }
    
    if (gameState !== 'playing') return;

    // Draw obstacles
    obstacles.forEach(obs => {
        ctx.drawImage(obs.image, obs.x - obs.width/2, obs.y - obs.height/2, obs.width, obs.height);
    });

    // Draw player
    ctx.drawImage(player.image, player.x - player.width / 2, player.y - player.height / 2, player.width, player.height);

    // Draw moon approaching
    if (altitude > LEVELS.SPACE.altitude) {
        const moonStartAlt = LEVELS.SPACE.altitude;
        const moonEndAlt = LEVELS.MOON.altitude;
        const progress = (altitude - moonStartAlt) / (moonEndAlt - moonStartAlt);
        if (progress > 0.5) { // Start showing moon halfway through space
            const size = canvasWidth * Math.min(1, (progress-0.5)*2);
            const yPos = canvasHeight - (canvasHeight * (progress - 0.5) * 2);
            ctx.drawImage(backgrounds.moon, canvasWidth/2 - size/2, yPos, size, size);
        }
    }
}

function gameLoop(timestamp) {
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    update(dt || 0); // handle first frame
    draw();

    requestAnimationFrame(gameLoop);
}

function handleInput(x) {
    if (gameState === 'playing') {
        targetX = x;
    }
}

// Event Listeners
window.addEventListener('resize', resizeCanvas);

canvas.addEventListener('pointerdown', (e) => handleInput(e.clientX));
canvas.addEventListener('pointermove', (e) => {
    if(e.buttons > 0) handleInput(e.clientX);
});

charSelectionScreen.addEventListener('click', (e) => {
    const option = e.target.closest('.char-option');
    if (option) {
        const birdType = option.dataset.bird;
        initGame(birdType);
    }
});

restartButton.addEventListener('click', () => {
    gameOverScreen.style.display = 'none';
    charSelectionScreen.style.display = 'flex';
    gameState = 'char-select';
});

playAgainButton.addEventListener('click', () => {
    winScreen.style.display = 'none';
    charSelectionScreen.style.display = 'flex';
    gameState = 'char-select';
});

// Initial Setup
resizeCanvas();
altitudeDisplay.style.display = 'none';
loadAssets().then(() => {
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
});

