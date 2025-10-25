import nipplejs from 'nipplejs';

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');

const startScreen = document.getElementById('start-screen');
const hud = document.getElementById('hud');
const scoreEl = document.getElementById('score');
const endScreen = document.getElementById('end-screen');
const endTitle = document.getElementById('end-title');
const endScoreEl = document.getElementById('end-score');
const restartBtn = document.getElementById('restart-btn');
const charOptions = document.querySelectorAll('.char-option');
const startGameBtn = document.getElementById('start-game-btn');
const pauseButton = document.getElementById('pause-button');
const unpauseButton = document.getElementById('unpause-button');

let canvasWidth, canvasHeight;

const BIRD_STATS = {
    hummingbird: { speed: 4, agility: 2.5, file: '/hummingbird.png' },
    sparrow: { speed: 3, agility: 4, file: '/sparrow.png' },
    eagle: { speed: 2, agility: 5.5, file: '/eagle.png' },
};

let selectedChar = 'sparrow';

const game = {
    state: 'start', // start, playing, paused, gameover, win
    score: 0,
    speed: 0,
    backgroundY: 0,
    backgrounds: {},
    obstacles: [],
    player: {
        x: 0, y: 0, width: 50, height: 50, dx: 0, agility: 0, img: null
    },
    currentStage: null,
    isMobile: false
};

const sounds = {
    hit: new Audio('/hit.mp3'),
    flap: new Audio('/flap.mp3'),
    levelUp: new Audio('/level_up.mp3'),
    win: new Audio('/win.mp3'),
    music: new Audio('/game_music.mp3')
};
sounds.music.loop = true;

const STAGES = {
    forest: {
        altitude: 0,
        background: '/forest_bg.png',
        obstacleImg: '/nut.png',
        obstacleSpeed: 4,
        spawnRate: 0.02
    },
    sky: {
        altitude: 100,
        background: '/sky_bg.png',
        obstacleImg: '/raindrop.png',
        obstacleSpeed: 6,
        spawnRate: 0.05
    },
    space: {
        altitude: 250,
        background: '/space_bg.png',
        obstacleImg: '/asteroid.png',
        obstacleSpeed: 8,
        spawnRate: 0.03
    }
};
const WIN_ALTITUDE = 500;
const moon = { img: null, y: 0, width: 200, height: 200 };

function resizeCanvas() {
    const container = document.getElementById('game-container');
    canvasWidth = container.clientWidth;
    canvasHeight = container.clientHeight;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    game.player.y = canvasHeight * 0.8;
    game.player.x = canvasWidth / 2 - game.player.width / 2;
}

function preloadAssets() {
    const promises = [];
    Object.values(BIRD_STATS).forEach(bird => {
        const img = new Image();
        img.src = bird.file;
        promises.push(img.decode());
    });
    Object.values(STAGES).forEach(stage => {
        const bg = new Image();
        bg.src = stage.background;
        game.backgrounds[stage.background] = bg;
        promises.push(bg.decode());
        const obs = new Image();
        obs.src = stage.obstacleImg;
        stage.obstacleImgEl = obs;
        promises.push(obs.decode());
    });
    const moonImg = new Image();
    moonImg.src = '/moon.png';
    moon.img = moonImg;
    promises.push(moonImg.decode());

    return Promise.all(promises);
}

function update() {
    if (game.state !== 'playing') return;

    // Update score and game speed
    game.score += game.speed / 60; // 60 fps
    game.speed = BIRD_STATS[selectedChar].speed;
    scoreEl.textContent = `Altitude: ${Math.floor(game.score)} ft`;

    // Update background
    game.backgroundY += game.speed;

    // Update player position
    game.player.x += game.player.dx;
    if (game.player.x < 0) game.player.x = 0;
    if (game.player.x > canvasWidth - game.player.width) game.player.x = canvasWidth - game.player.width;

    // Update obstacles
    game.obstacles.forEach(o => o.y += o.speed);
    game.obstacles = game.obstacles.filter(o => o.y < canvasHeight);

    // Spawn new obstacles
    if (Math.random() < game.currentStage.spawnRate) {
        game.obstacles.push({
            x: Math.random() * (canvasWidth - 30),
            y: -30,
            width: 30,
            height: 30,
            speed: game.currentStage.obstacleSpeed,
            img: game.currentStage.obstacleImgEl
        });
    }

    // Check for stage change
    let newStage = getStage(game.score);
    if (newStage !== game.currentStage) {
        game.currentStage = newStage;
        sounds.levelUp.play();
    }
    
    // Check for win condition
    if (game.score >= WIN_ALTITUDE) {
        winGame();
    }

    // Check for collisions
    for (const obstacle of game.obstacles) {
        if (
            game.player.x < obstacle.x + obstacle.width &&
            game.player.x + game.player.width > obstacle.x &&
            game.player.y < obstacle.y + obstacle.height &&
            game.player.y + game.player.height > obstacle.y
        ) {
            gameOver();
            break;
        }
    }

    requestAnimationFrame(update);
}

function draw() {
    if (game.state === 'start') return;
    
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Draw background
    const bgImg = game.backgrounds[game.currentStage.background];
    const bgRatio = bgImg.width / bgImg.height;
    const bgWidth = canvasWidth;
    const bgHeight = bgWidth / bgRatio;
    let y = (game.backgroundY % bgHeight) - bgHeight;
    while (y < canvasHeight) {
        ctx.drawImage(bgImg, 0, y, bgWidth, bgHeight);
        y += bgHeight;
    }
    
    // Draw Moon if near win
    if (game.score > WIN_ALTITUDE - 150) {
        const progress = (game.score - (WIN_ALTITUDE - 150)) / 150;
        moon.y = canvasHeight - progress * (canvasHeight * 0.8);
        const moonX = canvasWidth / 2 - moon.width / 2;
        ctx.drawImage(moon.img, moonX, moon.y, moon.width, moon.height);
    }


    // Draw obstacles
    game.obstacles.forEach(o => {
        ctx.drawImage(o.img, o.x, o.y, o.width, o.height);
    });

    // Draw player
    ctx.drawImage(game.player.img, game.player.x, game.player.y, game.player.width, game.player.height);
    
    requestAnimationFrame(draw);
}

function getStage(score) {
    if (score >= STAGES.space.altitude) return STAGES.space;
    if (score >= STAGES.sky.altitude) return STAGES.sky;
    return STAGES.forest;
}

function startGame() {
    game.state = 'playing';
    game.score = 0;
    game.obstacles = [];
    game.player.x = canvasWidth / 2 - game.player.width / 2;
    game.player.y = canvasHeight * 0.8;
    game.player.dx = 0;
    game.speed = BIRD_STATS[selectedChar].speed;
    game.player.agility = BIRD_STATS[selectedChar].agility;
    game.player.img = new Image();
    game.player.img.src = BIRD_STATS[selectedChar].file;
    game.currentStage = getStage(0);

    startScreen.classList.add('hidden');
    endScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    pauseButton.classList.remove('hidden');

    sounds.music.currentTime = 0;
    sounds.music.play();

    update();
    draw();
}

function gameOver() {
    game.state = 'gameover';
    sounds.hit.play();
    sounds.music.pause();
    endTitle.textContent = "Game Over";
    endScoreEl.textContent = `You reached ${Math.floor(game.score)} ft`;
    hud.classList.add('hidden');
    pauseButton.classList.add('hidden');
    endScreen.classList.remove('hidden');
}

function winGame() {
    game.state = 'win';
    sounds.win.play();
    sounds.music.pause();
    endTitle.textContent = "You Reached the Moon!";
    endScoreEl.textContent = `Final Altitude: ${Math.floor(game.score)} ft`;
    hud.classList.add('hidden');
    pauseButton.classList.add('hidden');
    endScreen.classList.remove('hidden');
}

function togglePause() {
    if (game.state === 'playing') {
        game.state = 'paused';
        sounds.music.pause();
        pauseButton.classList.add('hidden');
        unpauseButton.classList.remove('hidden');
    } else if (game.state === 'paused') {
        game.state = 'playing';
        sounds.music.play();
        pauseButton.classList.remove('hidden');
        unpauseButton.classList.add('hidden');
        // Restart the loops
        update();
        draw();
    }
}

function handleKeyDown(e) {
    if (game.state !== 'playing') return;
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        game.player.dx = -game.player.agility;
    } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        game.player.dx = game.player.agility;
    }
}

function handleKeyUp(e) {
    if (game.state !== 'playing') return;
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a' || e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        game.player.dx = 0;
    }
}

function setupMobileControls() {
    const mobileControls = document.getElementById('mobile-controls');
    mobileControls.classList.remove('hidden');
    const joystickZone = document.getElementById('joystick-zone');
    const joystick = nipplejs.create({
        zone: joystickZone,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'white',
        size: 150,
        threshold: 0.1
    });

    joystick.on('move', (evt, data) => {
        if (game.state !== 'playing') return;
        if (data.direction) {
            if (data.direction.x === 'right') {
                game.player.dx = game.player.agility;
            } else if (data.direction.x === 'left') {
                game.player.dx = -game.player.agility;
            }
        }
    });

    joystick.on('end', () => {
        game.player.dx = 0;
    });
}


function init() {
    game.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    preloadAssets().then(() => {
        document.body.style.cursor = 'default';
        startScreen.style.opacity = 1;
        
        charOptions.forEach(opt => {
            opt.addEventListener('click', () => {
                charOptions.forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                selectedChar = opt.dataset.char;
            });
        });
        charOptions[1].click();

        startGameBtn.addEventListener('click', startGame);
        restartBtn.addEventListener('click', () => {
            endScreen.classList.add('hidden');
            startScreen.classList.remove('hidden');
        });

        pauseButton.addEventListener('click', togglePause);
        unpauseButton.addEventListener('click', togglePause);

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        if (game.isMobile) {
            setupMobileControls();
        }

    }).catch(err => {
        console.error("Failed to load assets", err);
        // Display an error message to the user
    });
}

init();

