// games.js – финальная версия с 8 честными играми, раздельными лимитами, мин. ставкой 10⭐
const GAME_COMMISSION = 0.10;
const MIN_BET = 10;

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
async function getUserGameLimit(userId, game) {
    const { data, error } = await window.supabase
        .from('user_game_limits')
        .select('game_limits')
        .eq('user_id', userId)
        .single();
    if (error || !data) return 100;
    const limits = data.game_limits || {};
    return limits[game] || 100;
}

async function updateUserGameLimit(userId, game, newLimit) {
    if (newLimit > 100) throw new Error('Нельзя повысить лимит, только понизить до 100 или ниже');
    const { data } = await window.supabase
        .from('user_game_limits')
        .select('game_limits')
        .eq('user_id', userId)
        .single();
    let limits = data?.game_limits || {};
    limits[game] = Math.min(newLimit, 100);
    await window.supabase.from('user_game_limits').upsert({
        user_id: userId,
        game_limits: limits
    });
}

async function checkHourlyLimit(userId, game, deltaStars) {
    // Получаем текущий net change и время последнего сброса для этой игры
    const column = `hourly_net_change_${game}`;
    const timeColumn = `last_hour_${game}`;
    const { data: user, error } = await window.supabase
        .from('users')
        .select(`${column}, ${timeColumn}`)
        .eq('id', userId)
        .single();
    if (error) return false;
    const limit = await getUserGameLimit(userId, game);
    const lastHour = new Date(user[timeColumn] || 0);
    const hoursDiff = (Date.now() - lastHour) / (1000 * 3600);
    let net = user[column] || 0;
    if (hoursDiff >= 1) net = 0;
    const newNet = net + deltaStars;
    if (newNet > limit || newNet < -limit) return false;
    await window.supabase.from('users').update({
        [column]: newNet,
        [timeColumn]: new Date().toISOString()
    }).eq('id', userId);
    return true;
}

async function updateUserBalance(deltaStarsCents, reason) {
    const { user } = await window.getOrCreateUser();
    const newBalance = user.stars_balance + deltaStarsCents;
    await window.supabase.from('users').update({ stars_balance: newBalance }).eq('id', window.userId);
    window.currentUser.stars_balance = newBalance;
    console.log(`${reason}: изменение ${deltaStarsCents/100} ⭐, новый баланс ${newBalance/100}`);
}

// ========== ИГРА 1: НАЖМИ БЫСТРЕЕ ==========
function renderReactionGame() {
    const html = `
        <div class="card" style="text-align: center;">
            <h3>⚡ Нажми быстрее</h3>
            <p>Ставка: <span id="reactionBetVal">10</span> ⭐ (мин 10)</p>
            <input type="range" id="reactionBetSlider" min="10" max="100" step="5" value="10">
            <div id="reactionGameArea" style="margin: 20px 0;">
                <button id="reactionStartBtn" class="game-action-btn">▶ Начать игру</button>
            </div>
            <div class="small-text">Комиссия 10%. Чем выше ставка, тем меньше времени на реакцию. Лимит 100⭐/час (можно понизить в настройках).</div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    document.getElementById('reactionBetSlider').oninput = (e) => {
        document.getElementById('reactionBetVal').innerText = e.target.value;
    };
    document.getElementById('reactionStartBtn').onclick = startReactionGame;
}

function getReactionTimeLimit(betStars) {
    if (betStars < 30) return 2000;
    if (betStars < 60) return 1500;
    if (betStars < 90) return 1000;
    return 700;
}

let reactionTimer = null;
let reactionStartTime = 0;

async function startReactionGame() {
    const betStars = parseFloat(document.getElementById('reactionBetSlider').value);
    if (isNaN(betStars) || betStars < MIN_BET) {
        window.showCustomModal('Ошибка', `Минимальная ставка ${MIN_BET} ⭐`);
        return;
    }
    const { user } = await window.getOrCreateUser();
    if (user.stars_balance < window.toCents(betStars)) {
        window.showCustomModal('Ошибка', `Недостаточно средств. Доступно: ${window.fromCents(user.stars_balance)} ⭐`);
        return;
    }
    const gameArea = document.getElementById('reactionGameArea');
    gameArea.innerHTML = `
        <div style="font-size: 20px; margin: 10px;">Приготовьтесь...</div>
        <div id="reactionCountdown">3</div>
    `;
    let countdown = 3;
    const countdownInterval = setInterval(() => {
        countdown--;
        const cdDiv = document.getElementById('reactionCountdown');
        if (cdDiv) cdDiv.innerText = countdown;
        if (countdown <= 0) {
            clearInterval(countdownInterval);
            const timeLimit = getReactionTimeLimit(betStars);
            gameArea.innerHTML = `
                <div style="font-size: 24px; font-weight: bold; margin: 10px;">ЖМИ! (${timeLimit/1000} сек)</div>
                <button id="reactionHitBtn" style="background: #fbbf24; padding: 20px 40px; font-size: 24px;">🔥 ЖМИ 🔥</button>
            `;
            reactionStartTime = performance.now();
            document.getElementById('reactionHitBtn').onclick = () => finishReactionGame(betStars, timeLimit);
            reactionTimer = setTimeout(() => finishReactionGame(betStars, timeLimit, true), timeLimit + 500);
        }
    }, 1000);
}

async function finishReactionGame(betStars, timeLimit, timeout = false) {
    if (reactionTimer) clearTimeout(reactionTimer);
    let reactionMs = 9999;
    let won = false;
    let multiplier = 0;
    if (!timeout) {
        reactionMs = performance.now() - reactionStartTime;
        if (reactionMs <= timeLimit) {
            if (reactionMs < 500) multiplier = 2.0;
            else if (reactionMs < 1000) multiplier = 1.5;
            else multiplier = 1.0;
            won = true;
        }
    }
    const grossWinStars = won ? betStars * multiplier : 0;
    const commissionStars = Math.floor(grossWinStars * GAME_COMMISSION);
    const netWinStars = grossWinStars - commissionStars;
    const deltaStars = netWinStars - betStars;
    const limitOk = await checkHourlyLimit(window.userId, 'reaction', deltaStars);
    if (!limitOk) {
        window.showCustomModal('Лимит', 'Вы достигли часового лимита для этой игры. Попробуйте позже.');
        window.renderGamesTab();
        return;
    }
    await updateUserBalance(window.toCents(deltaStars), 'Reaction game');
    const gameArea = document.getElementById('reactionGameArea');
    if (won) {
        gameArea.innerHTML = `
            <div style="background: rgba(74,222,128,0.2); padding: 16px; border-radius: 24px;">
                ✅ Ваше время: ${reactionMs.toFixed(0)} мс (лимит ${timeLimit} мс)<br>
                Выигрыш: ${netWinStars.toFixed(2)} ⭐ (комиссия ${commissionStars} ⭐)<br>
                <button id="reactionAgainBtn" class="game-action-btn">Играть снова</button>
            </div>
        `;
    } else {
        gameArea.innerHTML = `
            <div style="background: rgba(239,68,68,0.2); padding: 16px; border-radius: 24px;">
                ❌ ${timeout ? 'Время вышло' : `Ваше время: ${reactionMs.toFixed(0)} мс (>${timeLimit} мс)`}<br>
                Вы проиграли ${betStars} ⭐<br>
                <button id="reactionAgainBtn" class="game-action-btn">Играть снова</button>
            </div>
        `;
    }
    document.getElementById('reactionAgainBtn')?.addEventListener('click', () => renderReactionGame());
    window.refreshActiveTab();
}

// ========== ИГРА 2: БАШНЯ (детерминированная) ==========
let towerGameActive = false;
let towerHeight = 0;
let towerBetStars = 0;

function renderTowerGame() {
    const html = `
        <div class="card" style="text-align: center;">
            <h3>🏗️ Башня</h3>
            <p>Ставка: <span id="towerBetVal">10</span> ⭐ (мин 10)</p>
            <input type="range" id="towerBetSlider" min="10" max="100" step="5" value="10">
            <div id="towerGameArea" style="margin: 20px 0;">
                <button id="towerStartBtn" class="game-action-btn">Построить башню</button>
            </div>
            <div class="small-text">Чем выше башня, тем больше множитель. Вы сами решаете, когда остановиться. Без случайности.</div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    document.getElementById('towerBetSlider').oninput = (e) => {
        document.getElementById('towerBetVal').innerText = e.target.value;
    };
    document.getElementById('towerStartBtn').onclick = startTowerGame;
}

async function startTowerGame() {
    if (towerGameActive) return;
    towerBetStars = parseFloat(document.getElementById('towerBetSlider').value);
    if (isNaN(towerBetStars) || towerBetStars < MIN_BET) {
        window.showCustomModal('Ошибка', `Минимальная ставка ${MIN_BET} ⭐`);
        return;
    }
    const { user } = await window.getOrCreateUser();
    if (user.stars_balance < window.toCents(towerBetStars)) {
        window.showCustomModal('Ошибка', `Недостаточно средств: ${window.fromCents(user.stars_balance)} ⭐`);
        return;
    }
    towerHeight = 0;
    towerGameActive = true;
    await updateTowerUI();
}

async function updateTowerUI() {
    const gameArea = document.getElementById('towerGameArea');
    const multiplier = Math.min(10, 1 + towerHeight * 0.2);
    const potentialWin = (towerBetStars * multiplier).toFixed(2);
    gameArea.innerHTML = `
        <div style="font-size: 18px; margin-bottom: 12px;">Высота башни: ${towerHeight} 🧱</div>
        <div>Текущий множитель: x${multiplier.toFixed(2)}</div>
        <div>Потенциальный выигрыш: ${potentialWin} ⭐</div>
        <div style="display: flex; gap: 12px; margin-top: 16px;">
            <button id="towerAddBtn" class="game-action-btn" style="flex:1">➕ Добавить блок</button>
            <button id="towerCashoutBtn" class="game-action-btn" style="flex:1; background: #2b6e9e;">💰 Забрать</button>
        </div>
    `;
    document.getElementById('towerAddBtn').onclick = addTowerBlock;
    document.getElementById('towerCashoutBtn').onclick = cashoutTower;
}

async function addTowerBlock() {
    if (!towerGameActive) return;
    towerHeight++;
    await updateTowerUI();
}

async function cashoutTower() {
    if (!towerGameActive) return;
    towerGameActive = false;
    const multiplier = Math.min(10, 1 + towerHeight * 0.2);
    const grossWin = towerBetStars * multiplier;
    const commission = Math.floor(grossWin * GAME_COMMISSION);
    const netWin = grossWin - commission;
    const deltaStars = netWin - towerBetStars;
    const limitOk = await checkHourlyLimit(window.userId, 'tower', deltaStars);
    if (!limitOk) {
        window.showCustomModal('Лимит', 'Часовой лимит net change превышен. Игра остановлена.');
        window.renderGamesTab();
        return;
    }
    await updateUserBalance(window.toCents(deltaStars), 'Tower game');
    const gameArea = document.getElementById('towerGameArea');
    gameArea.innerHTML = `
        <div style="background: rgba(74,222,128,0.2); padding: 16px; border-radius: 24px;">
            ✅ Вы построили башню высотой ${towerHeight} этажей<br>
            Множитель: x${multiplier.toFixed(2)}<br>
            Выигрыш: ${netWin.toFixed(2)} ⭐ (комиссия ${commission} ⭐)<br>
            <button id="towerAgainBtn" class="game-action-btn">Играть снова</button>
        </div>
    `;
    document.getElementById('towerAgainBtn')?.addEventListener('click', () => renderTowerGame());
    window.refreshActiveTab();
}

// ========== ИГРА 3: БЛИЖЕ К ЦЕЛИ (прогрессивный выигрыш) ==========
function renderClosestGame() {
    const html = `
        <div class="card" style="text-align: center;">
            <h3>🎯 Ближе к цели</h3>
            <p>Ставка: <span id="closestBetVal">10</span> ⭐ (мин 10)</p>
            <input type="range" id="closestBetSlider" min="10" max="100" step="5" value="10">
            <div id="closestGameArea" style="margin: 20px 0;">
                <button id="closestStartBtn" class="game-action-btn">Начать</button>
            </div>
            <div class="small-text">Бот загадает число. Назовите своё. Чем ближе, тем выше выигрыш. При точном попадании – x2 (до комиссии).</div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    document.getElementById('closestBetSlider').oninput = (e) => {
        document.getElementById('closestBetVal').innerText = e.target.value;
    };
    document.getElementById('closestStartBtn').onclick = startClosestGame;
}

async function startClosestGame() {
    const betStars = parseFloat(document.getElementById('closestBetSlider').value);
    if (isNaN(betStars) || betStars < MIN_BET) {
        window.showCustomModal('Ошибка', `Минимальная ставка ${MIN_BET} ⭐`);
        return;
    }
    const { user } = await window.getOrCreateUser();
    if (user.stars_balance < window.toCents(betStars)) {
        window.showCustomModal('Ошибка', `Недостаточно средств`);
        return;
    }
    // Генерируем число от 1 до 100
    const secret = Math.floor(Math.random() * 100) + 1;
    const guess = parseInt(prompt(`Бот загадал число от 1 до 100. Ваше число:`));
    if (isNaN(guess) || guess < 1 || guess > 100) {
        window.showCustomModal('Ошибка', 'Некорректное число');
        return;
    }
    const diff = Math.abs(secret - guess);
    let multiplier = 1.0;
    if (diff === 0) multiplier = 2.0;
    else if (diff <= 5) multiplier = 1.8;
    else if (diff <= 10) multiplier = 1.5;
    else if (diff <= 20) multiplier = 1.2;
    else if (diff <= 30) multiplier = 1.0;
    else multiplier = 0.5; // проигрыш части ставки
    const grossWin = betStars * multiplier;
    const commission = Math.floor(grossWin * GAME_COMMISSION);
    const netWin = grossWin - commission;
    const deltaStars = netWin - betStars;
    const limitOk = await checkHourlyLimit(window.userId, 'closest', deltaStars);
    if (!limitOk) {
        window.showCustomModal('Лимит', 'Часовой лимит превышен');
        window.renderGamesTab();
        return;
    }
    await updateUserBalance(window.toCents(deltaStars), 'Closest game');
    let message = `Загадано ${secret}, вы назвали ${guess}. Отклонение ${diff}. `;
    if (deltaStars > 0) message += `Вы выиграли ${netWin.toFixed(2)} ⭐!`;
    else if (deltaStars < 0) message += `Вы проиграли ${(-deltaStars).toFixed(2)} ⭐.`;
    else message += `Ничья.`;
    window.showCustomModal('Результат', message);
    window.renderGamesTab();
}

// ========== ИГРА 4: СКОРОСТНОЙ НАБОР (Type Race против ИИ) ==========
let raceActive = false;
let raceTimer = null;
let raceText = '';
let playerProgress = 0;
let botProgress = 0;

function renderTypeRace() {
    const html = `
        <div class="card" style="text-align: center;">
            <h3>⌨️ Скоростной набор</h3>
            <p>Ставка: <span id="raceBetVal">10</span> ⭐ (мин 10)</p>
            <input type="range" id="raceBetSlider" min="10" max="100" step="5" value="10">
            <div id="raceGameArea" style="margin: 20px 0;">
                <button id="raceStartBtn" class="game-action-btn">Начать гонку</button>
            </div>
            <div class="small-text">Соревнуйтесь с ботом в скорости печати. У каждого 3 ошибки. Чем выше ставка, тем быстрее ИИ.</div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    document.getElementById('raceBetSlider').oninput = (e) => {
        document.getElementById('raceBetVal').innerText = e.target.value;
    };
    document.getElementById('raceStartBtn').onclick = startTypeRace;
}

async function startTypeRace() {
    const betStars = parseFloat(document.getElementById('raceBetSlider').value);
    if (isNaN(betStars) || betStars < MIN_BET) {
        window.showCustomModal('Ошибка', `Минимальная ставка ${MIN_BET} ⭐`);
        return;
    }
    const { user } = await window.getOrCreateUser();
    if (user.stars_balance < window.toCents(betStars)) {
        window.showCustomModal('Ошибка', `Недостаточно средств`);
        return;
    }
    // Выбираем текст (короткий)
    const texts = ['telegram', 'биржа', 'акции', 'бот', 'честность', 'скорость'];
    raceText = texts[Math.floor(Math.random() * texts.length)];
    playerProgress = 0;
    botProgress = 0;
    let playerErrors = 0;
    let botErrors = 0;
    raceActive = true;
    // ИИ печатает со скоростью, зависящей от ставки (чем выше ставка, тем быстрее)
    const botDelay = Math.max(200, 800 - Math.floor(betStars / 2)); // от 200 до 800 мс
    const gameArea = document.getElementById('raceGameArea');
    gameArea.innerHTML = `
        <div>Напечатайте слово: <strong>${raceText}</strong></div>
        <div>Ваш прогресс: <span id="playerProg">0</span> / ${raceText.length}</div>
        <div>Прогресс бота: <span id="botProg">0</span> / ${raceText.length}</div>
        <div>Ваши ошибки: <span id="playerErrors">0</span> / 3</div>
        <div>Ошибки бота: <span id="botErrors">0</span> / 3</div>
        <input type="text" id="raceInput" placeholder="Введите следующий символ..." style="margin-top: 16px;">
        <button id="raceSubmit" class="game-action-btn">Отправить</button>
    `;
    const raceInput = document.getElementById('raceInput');
    const submitBtn = document.getElementById('raceSubmit');
    // Бот печатает по таймеру
    const botInterval = setInterval(() => {
        if (!raceActive) return;
        if (botProgress < raceText.length && botErrors < 3) {
            // бот может ошибиться с вероятностью 10% (честно)
            if (Math.random() < 0.1) {
                botErrors++;
                document.getElementById('botErrors').innerText = botErrors;
                if (botErrors >= 3) {
                    clearInterval(botInterval);
                    finishRace(betStars, true); // игрок победил
                }
            } else {
                botProgress++;
                document.getElementById('botProg').innerText = botProgress;
                if (botProgress >= raceText.length) {
                    clearInterval(botInterval);
                    finishRace(betStars, false); // бот победил
                }
            }
        }
    }, botDelay);
    const checkWin = () => {
        if (playerProgress >= raceText.length) {
            clearInterval(botInterval);
            finishRace(betStars, true);
        } else if (playerErrors >= 3) {
            clearInterval(botInterval);
            finishRace(betStars, false);
        }
    };
    submitBtn.onclick = () => {
        if (!raceActive) return;
        const input = raceInput.value.trim();
        if (input.length === 0) return;
        const expected = raceText[playerProgress];
        if (input === expected) {
            playerProgress++;
            document.getElementById('playerProg').innerText = playerProgress;
        } else {
            playerErrors++;
            document.getElementById('playerErrors').innerText = playerErrors;
        }
        raceInput.value = '';
        checkWin();
    };
    async function finishRace(betStars, playerWon) {
        if (!raceActive) return;
        raceActive = false;
        const grossWin = playerWon ? betStars * 1.8 : 0;
        const commission = Math.floor(grossWin * GAME_COMMISSION);
        const netWin = grossWin - commission;
        const deltaStars = netWin - betStars;
        const limitOk = await checkHourlyLimit(window.userId, 'typerace', deltaStars);
        if (!limitOk) {
            window.showCustomModal('Лимит', 'Часовой лимит превышен');
            window.renderGamesTab();
            return;
        }
        await updateUserBalance(window.toCents(deltaStars), 'Type race');
        window.showCustomModal('Результат', playerWon ? `Вы победили! Выигрыш: ${netWin.toFixed(2)} ⭐` : `Бот победил. Вы проиграли ${betStars} ⭐`);
        window.renderGamesTab();
    }
}

// ========== ИГРА 5: ЛАБИРИНТ (ограниченное число ходов) ==========
let mazeActive = false;
let mazeGrid = [];
let mazeX, mazeY;
let mazeStepsLeft = 0;
function renderMaze() {
    const html = `
        <div class="card" style="text-align: center;">
            <h3>🧩 Лабиринт</h3>
            <p>Ставка: <span id="mazeBetVal">10</span> ⭐ (мин 10)</p>
            <input type="range" id="mazeBetSlider" min="10" max="100" step="5" value="10">
            <div id="mazeGameArea" style="margin: 20px 0;">
                <button id="mazeStartBtn" class="game-action-btn">Начать</button>
            </div>
            <div class="small-text">Найдите выход за ограниченное число шагов. Сложность зависит от ставки.</div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    document.getElementById('mazeBetSlider').oninput = (e) => {
        document.getElementById('mazeBetVal').innerText = e.target.value;
    };
    document.getElementById('mazeStartBtn').onclick = startMaze;
}

async function startMaze() {
    const betStars = parseFloat(document.getElementById('mazeBetSlider').value);
    if (isNaN(betStars) || betStars < MIN_BET) {
        window.showCustomModal('Ошибка', `Минимальная ставка ${MIN_BET} ⭐`);
        return;
    }
    const { user } = await window.getOrCreateUser();
    if (user.stars_balance < window.toCents(betStars)) {
        window.showCustomModal('Ошибка', `Недостаточно средств`);
        return;
    }
    // Генерация лабиринта (размер зависит от ставки)
    const size = betStars < 30 ? 5 : betStars < 70 ? 7 : 9;
    mazeGrid = Array(size).fill().map(() => Array(size).fill('⬜'));
    // Простой лабиринт: вход (0,0), выход (size-1, size-1)
    mazeX = 0; mazeY = 0;
    mazeGrid[0][0] = '🟢';
    const exitX = size-1, exitY = size-1;
    mazeGrid[exitX][exitY] = '🏁';
    // Минимальное число шагов для решения = (size-1)*2 (для простоты)
    const minSteps = (size-1)*2;
    const extraSteps = Math.floor(betStars / 20); // запас ходов
    mazeStepsLeft = minSteps + extraSteps;
    mazeActive = true;
    updateMazeUI(betStars, size, exitX, exitY);
}

function updateMazeUI(betStars, size, exitX, exitY) {
    const gameArea = document.getElementById('mazeGameArea');
    let mazeHtml = '<div style="font-family: monospace; font-size: 20px; margin-bottom: 16px;">';
    for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
            if (i === mazeX && j === mazeY) mazeHtml += '🤖';
            else if (i === exitX && j === exitY) mazeHtml += '🏁';
            else mazeHtml += mazeGrid[i][j];
        }
        mazeHtml += '<br>';
    }
    mazeHtml += `</div><div>Шагов осталось: ${mazeStepsLeft}</div>`;
    mazeHtml += `
        <div style="display: flex; gap: 12px; margin-top: 16px;">
            <button id="mazeUp" class="game-action-btn">⬆️</button>
            <button id="mazeDown" class="game-action-btn">⬇️</button>
            <button id="mazeLeft" class="game-action-btn">⬅️</button>
            <button id="mazeRight" class="game-action-btn">➡️</button>
        </div>
    `;
    gameArea.innerHTML = mazeHtml;
    document.getElementById('mazeUp').onclick = () => moveMaze(-1, 0, betStars, size, exitX, exitY);
    document.getElementById('mazeDown').onclick = () => moveMaze(1, 0, betStars, size, exitX, exitY);
    document.getElementById('mazeLeft').onclick = () => moveMaze(0, -1, betStars, size, exitX, exitY);
    document.getElementById('mazeRight').onclick = () => moveMaze(0, 1, betStars, size, exitX, exitY);
}

async function moveMaze(dx, dy, betStars, size, exitX, exitY) {
    if (!mazeActive) return;
    const newX = mazeX + dx;
    const newY = mazeY + dy;
    if (newX < 0 || newX >= size || newY < 0 || newY >= size) {
        window.showCustomModal('Ошибка', 'Стена!');
        return;
    }
    mazeX = newX; mazeY = newY;
    mazeStepsLeft--;
    if (mazeX === exitX && mazeY === exitY) {
        mazeActive = false;
        const grossWin = betStars * 1.8;
        const commission = Math.floor(grossWin * GAME_COMMISSION);
        const netWin = grossWin - commission;
        const deltaStars = netWin - betStars;
        const limitOk = await checkHourlyLimit(window.userId, 'maze', deltaStars);
        if (!limitOk) {
            window.showCustomModal('Лимит', 'Часовой лимит превышен');
            window.renderGamesTab();
            return;
        }
        await updateUserBalance(window.toCents(deltaStars), 'Maze');
        window.showCustomModal('Победа', `Вы нашли выход! Выигрыш: ${netWin.toFixed(2)} ⭐`);
        window.renderGamesTab();
        return;
    }
    if (mazeStepsLeft <= 0) {
        mazeActive = false;
        const deltaStars = -betStars;
        const limitOk = await checkHourlyLimit(window.userId, 'maze', deltaStars);
        if (!limitOk) {
            window.showCustomModal('Лимит', 'Часовой лимит превышен');
            window.renderGamesTab();
            return;
        }
        await updateUserBalance(window.toCents(deltaStars), 'Maze');
        window.showCustomModal('Поражение', 'Вы не успели найти выход за отведённое число шагов.');
        window.renderGamesTab();
        return;
    }
    updateMazeUI(betStars, size, exitX, exitY);
}

// ========== ИГРА 6: MEMORY MATCH (Пазл на память) ==========
let memoryCards = [];
let memoryFlipped = [];
let memoryLock = false;
let memoryFirstIndex = null;
let memoryMatches = 0;
let memoryAttempts = 0;
let memoryGameActive = false;
let memoryBetStars = 0;

function renderMemoryGame() {
    const html = `
        <div class="card" style="text-align: center;">
            <h3>🧠 Memory Match</h3>
            <p>Ставка: <span id="memoryBetVal">10</span> ⭐ (мин 10)</p>
            <input type="range" id="memoryBetSlider" min="10" max="100" step="5" value="10">
            <div id="memoryGameArea" style="margin: 20px 0;">
                <button id="memoryStartBtn" class="game-action-btn">Начать игру</button>
            </div>
            <div class="small-text">Найдите все пары. Чем выше ставка, тем больше карточек. Ошибки = проигрыш.</div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    document.getElementById('memoryBetSlider').oninput = (e) => {
        document.getElementById('memoryBetVal').innerText = e.target.value;
    };
    document.getElementById('memoryStartBtn').onclick = startMemoryGame;
}

async function startMemoryGame() {
    memoryBetStars = parseFloat(document.getElementById('memoryBetSlider').value);
    if (isNaN(memoryBetStars) || memoryBetStars < MIN_BET) {
        window.showCustomModal('Ошибка', `Минимальная ставка ${MIN_BET} ⭐`);
        return;
    }
    const { user } = await window.getOrCreateUser();
    if (user.stars_balance < window.toCents(memoryBetStars)) {
        window.showCustomModal('Ошибка', `Недостаточно средств`);
        return;
    }
    const size = memoryBetStars < 30 ? 4 : memoryBetStars < 70 ? 6 : 8;
    const totalCards = size * size;
    const pairs = totalCards / 2;
    let symbols = [];
    for (let i = 0; i < pairs; i++) symbols.push(i, i);
    for (let i = symbols.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [symbols[i], symbols[j]] = [symbols[j], symbols[i]];
    }
    memoryCards = symbols;
    memoryFlipped = Array(totalCards).fill(false);
    memoryMatches = 0;
    memoryAttempts = 0;
    memoryGameActive = true;
    memoryFirstIndex = null;
    memoryLock = false;
    renderMemoryBoard(size);
}

function renderMemoryBoard(size) {
    const gameArea = document.getElementById('memoryGameArea');
    let html = `<div style="display: grid; grid-template-columns: repeat(${size}, 1fr); gap: 8px; margin-bottom: 16px;">`;
    for (let i = 0; i < memoryCards.length; i++) {
        let display = '❓';
        if (memoryFlipped[i] || (memoryFirstIndex === i && !memoryLock)) {
            display = memoryCards[i].toString();
        }
        html += `<button class="memory-card" data-idx="${i}" style="padding: 12px; font-size: 20px;">${display}</button>`;
    }
    html += `</div><div>Пар найдено: ${memoryMatches} / ${memoryCards.length/2}</div><div>Ошибки: ${memoryAttempts}</div>`;
    gameArea.innerHTML = html;
    document.querySelectorAll('.memory-card').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!memoryGameActive || memoryLock) return;
            const idx = parseInt(btn.dataset.idx);
            if (memoryFlipped[idx]) return;
            if (memoryFirstIndex === null) {
                memoryFirstIndex = idx;
                renderMemoryBoard(size);
                return;
            }
            // второй клик
            const val1 = memoryCards[memoryFirstIndex];
            const val2 = memoryCards[idx];
            if (val1 === val2) {
                memoryFlipped[memoryFirstIndex] = true;
                memoryFlipped[idx] = true;
                memoryMatches++;
                memoryFirstIndex = null;
                if (memoryMatches === memoryCards.length / 2) {
                    memoryGameActive = false;
                    const grossWin = memoryBetStars * 1.8;
                    const commission = Math.floor(grossWin * GAME_COMMISSION);
                    const netWin = grossWin - commission;
                    const deltaStars = netWin - memoryBetStars;
                    const limitOk = await checkHourlyLimit(window.userId, 'memory', deltaStars);
                    if (!limitOk) {
                        window.showCustomModal('Лимит', 'Часовой лимит превышен');
                        window.renderGamesTab();
                        return;
                    }
                    await updateUserBalance(window.toCents(deltaStars), 'Memory');
                    window.showCustomModal('Победа', `Вы нашли все пары! Выигрыш: ${netWin.toFixed(2)} ⭐`);
                    window.renderGamesTab();
                    return;
                }
                renderMemoryBoard(size);
            } else {
                memoryAttempts++;
                if (memoryAttempts >= 3) {
                    memoryGameActive = false;
                    const deltaStars = -memoryBetStars;
                    const limitOk = await checkHourlyLimit(window.userId, 'memory', deltaStars);
                    if (!limitOk) {
                        window.showCustomModal('Лимит', 'Часовой лимит превышен');
                        window.renderGamesTab();
                        return;
                    }
                    await updateUserBalance(window.toCents(deltaStars), 'Memory');
                    window.showCustomModal('Поражение', `Вы совершили 3 ошибки. Вы проиграли ${memoryBetStars} ⭐`);
                    window.renderGamesTab();
                    return;
                }
                memoryLock = true;
                renderMemoryBoard(size);
                setTimeout(() => {
                    memoryLock = false;
                    memoryFirstIndex = null;
                    renderMemoryBoard(size);
                }, 1000);
            }
        });
    });
}

// ========== ИГРА 7: КРЕСТИКИ-НОЛИКИ 3x3 с адаптивной сложностью ==========
let tttGameActive = false;
let tttBoard = [];
let tttPlayer = 'X';
let tttBot = 'O';
let tttBetStars = 0;
function renderTicTacToe() {
    const html = `
        <div class="card" style="text-align: center;">
            <h3>❌⭕ Крестики-нолики</h3>
            <p>Ставка: <span id="tttBetVal">10</span> ⭐ (мин 10)</p>
            <input type="range" id="tttBetSlider" min="10" max="100" step="5" value="10">
            <div id="tttGameArea" style="margin: 20px 0;">
                <button id="tttStartBtn" class="game-action-btn">Начать игру</button>
            </div>
            <div class="small-text">Играйте с ботом. Чем выше ставка, тем умнее бот (глубже просчёт).</div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    document.getElementById('tttBetSlider').oninput = (e) => {
        document.getElementById('tttBetVal').innerText = e.target.value;
    };
    document.getElementById('tttStartBtn').onclick = startTicTacToe;
}

async function startTicTacToe() {
    tttBetStars = parseFloat(document.getElementById('tttBetSlider').value);
    if (isNaN(tttBetStars) || tttBetStars < MIN_BET) {
        window.showCustomModal('Ошибка', `Минимальная ставка ${MIN_BET} ⭐`);
        return;
    }
    const { user } = await window.getOrCreateUser();
    if (user.stars_balance < window.toCents(tttBetStars)) {
        window.showCustomModal('Ошибка', `Недостаточно средств`);
        return;
    }
    tttBoard = [
        ['', '', ''],
        ['', '', ''],
        ['', '', '']
    ];
    tttGameActive = true;
    // Игрок ходит первым
    renderTicTacToeBoard();
}

function renderTicTacToeBoard() {
    const gameArea = document.getElementById('tttGameArea');
    let html = `<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; width: 200px; margin: 0 auto;">`;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            const val = tttBoard[i][j];
            html += `<button class="ttt-cell" data-row="${i}" data-col="${j}" style="padding: 20px; font-size: 24px;">${val || ' '}</button>`;
        }
    }
    html += `</div>`;
    gameArea.innerHTML = html;
    document.querySelectorAll('.ttt-cell').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (!tttGameActive) return;
            const row = parseInt(btn.dataset.row);
            const col = parseInt(btn.dataset.col);
            if (tttBoard[row][col] !== '') return;
            tttBoard[row][col] = tttPlayer;
            if (checkWin(tttBoard, tttPlayer)) {
                tttGameActive = false;
                await finishTicTacToe(true);
                return;
            }
            if (isDraw(tttBoard)) {
                tttGameActive = false;
                await finishTicTacToe(null);
                return;
            }
            // ход бота (сложность зависит от ставки)
            const difficulty = tttBetStars < 30 ? 1 : tttBetStars < 70 ? 2 : 3;
            const botMove = getBestMove(tttBoard, tttBot, difficulty);
            if (botMove) {
                tttBoard[botMove.row][botMove.col] = tttBot;
                if (checkWin(tttBoard, tttBot)) {
                    tttGameActive = false;
                    await finishTicTacToe(false);
                    return;
                }
                if (isDraw(tttBoard)) {
                    tttGameActive = false;
                    await finishTicTacToe(null);
                    return;
                }
            }
            renderTicTacToeBoard();
        });
    });
}

function checkWin(board, player) {
    // проверка строк, столбцов, диагоналей
    for (let i = 0; i < 3; i++) {
        if (board[i][0] === player && board[i][1] === player && board[i][2] === player) return true;
        if (board[0][i] === player && board[1][i] === player && board[2][i] === player) return true;
    }
    if (board[0][0] === player && board[1][1] === player && board[2][2] === player) return true;
    if (board[0][2] === player && board[1][1] === player && board[2][0] === player) return true;
    return false;
}
function isDraw(board) {
    return board.every(row => row.every(cell => cell !== ''));
}
function getBestMove(board, player, depth) {
    // упрощённый минимакс на глубину depth
    let bestScore = -Infinity;
    let bestMove = null;
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            if (board[i][j] === '') {
                board[i][j] = player;
                let score = minimax(board, 0, false, player, depth);
                board[i][j] = '';
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = { row: i, col: j };
                }
            }
        }
    }
    return bestMove;
}
function minimax(board, depth, isMax, player, maxDepth) {
    const opponent = player === 'X' ? 'O' : 'X';
    if (checkWin(board, player)) return 10 - depth;
    if (checkWin(board, opponent)) return depth - 10;
    if (isDraw(board) || depth >= maxDepth) return 0;
    if (isMax) {
        let best = -Infinity;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (board[i][j] === '') {
                    board[i][j] = player;
                    best = Math.max(best, minimax(board, depth+1, false, player, maxDepth));
                    board[i][j] = '';
                }
            }
        }
        return best;
    } else {
        let best = Infinity;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (board[i][j] === '') {
                    board[i][j] = opponent;
                    best = Math.min(best, minimax(board, depth+1, true, player, maxDepth));
                    board[i][j] = '';
                }
            }
        }
        return best;
    }
}
async function finishTicTacToe(playerWon) {
    let deltaStars = 0;
    if (playerWon === true) {
        const grossWin = tttBetStars * 1.8;
        const commission = Math.floor(grossWin * GAME_COMMISSION);
        const netWin = grossWin - commission;
        deltaStars = netWin - tttBetStars;
    } else if (playerWon === false) {
        deltaStars = -tttBetStars;
    } else {
        // ничья – возврат ставки минус комиссия
        const netWin = tttBetStars * 0.9;
        deltaStars = netWin - tttBetStars;
    }
    const limitOk = await checkHourlyLimit(window.userId, 'ttt', deltaStars);
    if (!limitOk) {
        window.showCustomModal('Лимит', 'Часовой лимит превышен');
        window.renderGamesTab();
        return;
    }
    await updateUserBalance(window.toCents(deltaStars), 'TicTacToe');
    let msg = '';
    if (playerWon === true) msg = `Вы победили! Выигрыш: ${(deltaStars+tttBetStars).toFixed(2)} ⭐`;
    else if (playerWon === false) msg = `Бот победил. Вы проиграли ${tttBetStars} ⭐`;
    else msg = `Ничья. Возврат ставки с комиссией: ${(tttBetStars * 0.9).toFixed(2)} ⭐`;
    window.showCustomModal('Результат', msg);
    window.renderGamesTab();
}

// ========== ГЛАВНЫЙ РЕНДЕР ВКЛАДКИ (меню выбора игр) ==========
window.renderGamesTab = async function() {
    const currentUser = window.currentUser;
    const html = `
        <div class="card">
            <h2 style="text-align:center;">🎮 Мини-игры</h2>
            <p style="text-align:center; font-size:13px; color:#9ca3af;">Честные игры против бота. Комиссия 10%. Мин. ставка 10⭐.</p>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 20px 0;">
                <button id="gameReactionBtn" class="game-select-btn">⚡ Нажми быстрее</button>
                <button id="gameTowerBtn" class="game-select-btn">🏗️ Башня</button>
                <button id="gameClosestBtn" class="game-select-btn">🎯 Ближе к цели</button>
                <button id="gameTypeRaceBtn" class="game-select-btn">⌨️ Скоростной набор</button>
                <button id="gameMazeBtn" class="game-select-btn">🧩 Лабиринт</button>
                <button id="gameMemoryBtn" class="game-select-btn">🧠 Memory Match</button>
                <button id="gameTicTacToeBtn" class="game-select-btn">❌⭕ Крестики-нолики</button>
            </div>
            <div style="background: rgba(0,0,0,0.2); border-radius: 20px; padding: 12px; margin-top: 16px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>💰 Ваш баланс:</span>
                    <span><strong>${window.fromCents(currentUser.stars_balance)} ⭐</strong></span>
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    document.getElementById('gameReactionBtn').onclick = () => renderReactionGame();
    document.getElementById('gameTowerBtn').onclick = () => renderTowerGame();
    document.getElementById('gameClosestBtn').onclick = () => renderClosestGame();
    document.getElementById('gameTypeRaceBtn').onclick = () => renderTypeRace();
    document.getElementById('gameMazeBtn').onclick = () => renderMaze();
    document.getElementById('gameMemoryBtn').onclick = () => renderMemoryGame();
    document.getElementById('gameTicTacToeBtn').onclick = () => renderTicTacToe();
};
