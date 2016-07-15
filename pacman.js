const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');
document.body.appendChild(canvas);
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const PACMAN_SIZE = 30;
const NUM_PELLETS = 100;
const NUM_BONUS = 5;
const NUM_GHOSTS = 4;
const SPEED = 120; // lower is faster
const PACMAN_SPEED = 0.5;
const GHOST_SPEED = 0.25;
const GHOST_PROBABILITY_RANDOM = 0.2;
const SCARE_TIME = 5000; // in miliseconds
const DEBUG = 0;


function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function paintPacman(pacman) {
    ctx.fillStyle = '#FFFF00';
    let img = document.getElementById("pacman-" + pacman.direction);
    ctx.drawImage(img, pacman.x, pacman.y);
    if (DEBUG) {
        ctx.fillText('x: ' + pacman.x + ' y: ' + pacman.y, pacman.x, pacman.y);
    }
}

function paintPellets(pellets) {
    ctx.fillStyle = '#00FF00';
    let img = document.getElementById("cookie");
    pellets.forEach(function(position) {
        ctx.drawImage(img, position.x, position.y);
        if (DEBUG) {
            ctx.fillText('x: ' + position.x + ' y: ' + position.y, position.x, position.y);
        }
    });
}

function paintBonus(bonus) {
    let img = document.getElementById("bonus");
    bonus.forEach(function(position) {
        ctx.drawImage(img, position.x, position.y);
    });
}

function paintGhosts(ghosts) {
    ctx.fillStyle = '#FF0000';
    ghosts.forEach(function(ghost) {
        let img = document.getElementById("ghost-" + ghost.direction);
        if (ghost.scared) {
            img = document.getElementById("ghost-scared");
        }
        ctx.drawImage(img, ghost.x, ghost.y);
        if (DEBUG) {
            ctx.fillText('x: ' + ghost.x + ' y: ' + ghost.y, ghost.x, ghost.y);
        }
    });
}

function paintBackground() {
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function gameOver(pacman, ghosts) {
    return ghosts.some(function(ghost) {
        if (ghost.scared) {
            return false;
        }
        if (collision(pacman, ghost)) {
            return true;
        }
        return false;
    });
}

function collision(target1, target2) {
    return (target1.x > target2.x - PACMAN_SIZE && target1.x < target2.x + PACMAN_SIZE) &&
        (target1.y > target2.y - PACMAN_SIZE && target1.y < target2.y + PACMAN_SIZE);
}

function getRandomPosition() {
    return {
        x: getRandomInt(0, canvas.width),
        y: getRandomInt(0, canvas.height)
    };
}

function paintScore(score) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('Score: ' + score, 40, 43);
}

function renderGameOver() {
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('GAME OVER!', 100, 100);
}

function renderScene(actors) {
    paintBackground();
    paintPellets(actors.pellets);
    paintBonus(actors.bonus);
    paintScore(actors.score);
    paintGhosts(actors.ghosts);
    paintPacman(actors.pacman);
}

function createInitialRandomPositions(num) {
    let pos = [];
    for (let i = 1; i <= num; i++) {
        let newPos = getRandomPosition();
        while (pos.some(function(oldPos) {
                return collision(newPos, oldPos);
            })) {
            newPos = getRandomPosition();
        }
        pos.push(newPos);
    }
    return pos;
}

function createSumFromPositions(positions) {
    return positions.reduce(function(sum, pos) {
        return sum += pos.x + pos.y;
    }, 0);
}

function getMoveTowards(from, to) {
    let xDiff = from.x - to.x;
    let yDiff = from.y - to.y;
    let direction = '';
    if (Math.abs(xDiff) > Math.abs(yDiff)) {
        if (xDiff > 0) {
            direction = 'left';
        } else {
            direction = 'right';
        }
    } else {
        if (yDiff > 0) {
            direction = 'up';
        } else {
            direction = 'down';
        }
    }
    return direction;
}

function getRandomMove() {
    let moveType = getRandomInt(0, 3);
    let direction = '';
    switch (moveType) {
        case 0:
            direction = 'up';
            break;
        case 1:
            direction = 'down';
            break;
        case 2:
            direction = 'left';
            break;
        case 3:
            direction = 'right';
            break;
    }
    return direction;
}

function getPositionsWithoutCollision(positions, collisionPosition) {
    positions.forEach(
        function(positionToTest, index, object) {
            if (collision(positionToTest, collisionPosition)) {
                object.splice(index, 1);
            }
        }
    );
    return positions;
}

const KEYMAP = {
    left: 37,
    up: 38,
    right: 39,
    down: 40
};

const ticker$ = Rx.Observable
    .interval(SPEED, Rx.Scheduler.requestAnimationFrame)
    .map(() => ({
        time: Date.now(),
        deltaTime: null
    }))
    .scan(
        (previous, current) => ({
            time: current.time,
            deltaTime: (current.time - previous.time) / 1000
        })
    );


const input$ = Rx.Observable.fromEvent(document, 'keydown').scan(function(lastDir, event) {
    let nextMove = lastDir;
    switch (event.keyCode) {
        case KEYMAP.left:
            nextMove = {
                x: -PACMAN_SIZE * PACMAN_SPEED,
                y: 0,
                direction: 'left'
            };
            break;
        case KEYMAP.right:
            nextMove = {
                x: PACMAN_SIZE * PACMAN_SPEED,
                y: 0,
                direction: 'right'
            };
            break;
        case KEYMAP.up:
            nextMove = {
                x: 0,
                y: -PACMAN_SIZE * PACMAN_SPEED,
                direction: 'up'
            };
            break;
        case KEYMAP.down:
            nextMove = {
                x: 0,
                y: PACMAN_SIZE * PACMAN_SPEED,
                direction: 'down'
            };
            break;
    }
    return nextMove;
}, {
    x: PACMAN_SIZE * PACMAN_SPEED,
    y: 0,
    direction: 'right'
}).sample(SPEED);

const pacman$ = input$
    .scan(function(pos, keypress) {
        let nextX = Math.max(0, Math.min(pos.x + keypress.x, canvas.width - PACMAN_SIZE));
        let nextY = Math.max(0, Math.min(pos.y + keypress.y, canvas.height - PACMAN_SIZE));
        return {
            x: nextX,
            y: nextY,
            direction: keypress.direction
        };
    }, {
        x: 10,
        y: 10,
        direction: 'right'
    });

const pellets$ = pacman$.scan(function(pellets, pacmanPos) {
    return getPositionsWithoutCollision(pellets, pacmanPos);
}, createInitialRandomPositions(NUM_PELLETS)).distinctUntilChanged(createSumFromPositions);

const bonus$ = pacman$.scan(function(bonusPositions, pacman) {
    return getPositionsWithoutCollision(bonusPositions, pacman);
}, createInitialRandomPositions(NUM_BONUS)).distinctUntilChanged(createSumFromPositions);

const bonusTaken$ = bonus$.scan(function(prevNumber, bonus) {
    return prevNumber + 1;
}, -1).timestamp();

const bonusEnd$ = bonusTaken$.skip(1).delay(SCARE_TIME).timestamp().startWith({
    timestamp: 0
});

const ghosts$ = ticker$.withLatestFrom(pacman$, bonusTaken$, bonusEnd$)
    .scan(function(ghostPositions, [ticker, pacmanPos, bonusTaken, bonusEnd]) {
        let ghostSpeed = GHOST_SPEED;
        let scared = false;
        if (bonusTaken.value > 0 && bonusTaken.timestamp > bonusEnd.timestamp) {
            scared = true;
            ghostSpeed = 0.5 * ghostSpeed;
        }
        let newPositions = [];
        ghostPositions.forEach(
            function(ghostPos) {
                let direction = '';
                if (scared) {
                    if (collision(ghostPos, pacmanPos)) {
                        // Put scared ghost touching pacman far away
                        ghostPos.x = pacmanPos.x + 200;
                        ghostPos.y = pacmanPos.y + 200;
                    }
                    direction = getMoveTowards(pacmanPos, ghostPos); // Move pacman needs to do to run towards ghost is the same as ghost running away from pacman
                } else {
                    if (Math.random() > GHOST_PROBABILITY_RANDOM) {
                        direction = getMoveTowards(ghostPos, pacmanPos);
                    } else {
                        direction = getRandomMove();
                    }
                }
                switch (direction) {
                    case 'up':
                        xPos = ghostPos.x;
                        yPos = ghostPos.y + (-ghostSpeed * PACMAN_SIZE);
                        break;
                    case 'down':
                        xPos = ghostPos.x,
                            yPos = ghostPos.y + (ghostSpeed * PACMAN_SIZE);
                        break;
                    case 'left':
                        xPos = ghostPos.x + (-ghostSpeed * PACMAN_SIZE);
                        yPos = ghostPos.y;
                        break;
                    case 'right':
                        xPos = ghostPos.x + (ghostSpeed * PACMAN_SIZE);
                        yPos = ghostPos.y;
                        break;
                }
                newPositions.push({
                    x: xPos,
                    y: yPos,
                    direction: direction,
                    scared: scared
                });
            }
        );
        return newPositions;
    }, createInitialRandomPositions(NUM_GHOSTS));

const length$ = pellets$.scan(function(prevLength, apple) {
    return prevLength + 1;
}, -1);

const score$ = length$.withLatestFrom(bonusTaken$).map(function([length, numBonus]) {
    return Math.max(0, length * 10 + 100 * numBonus.value);
});

function renderError(error) {
    alert("error: " + error);
}

const game$ = Rx.Observable.combineLatest(
        pacman$, pellets$, score$, ghosts$, bonus$,
        function(pacman, pellets, score, ghosts, bonus) {
            return {
                pacman: pacman,
                pellets: pellets,
                score: score,
                ghosts: ghosts,
                bonus: bonus
            };
        })
    .sample(SPEED);


game$.takeWhile(function(actors) {
    return gameOver(actors.pacman, actors.ghosts) === false;
}).subscribe(renderScene, renderError, renderGameOver);