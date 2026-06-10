// games.js – финальная версия с 6 играми, удалён Memory Match
const GAME_COMMISSION = 0.10;
const MIN_BET = 10;

// ---- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (лимиты, баланс) ----
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

// ---- ГЛАВНОЕ МЕНЮ (красивые карточки) ----
window.renderGamesTab = async function() {
    const currentUser = window.currentUser;
    const balance = window.fromCents(currentUser.stars_balance);
    
    const games = [
        { id: 'reaction', name: 'Нажми быстрее', icon: '⚡', desc: 'Проверь свою реакцию', color: '#fbbf24' },
        { id: 'tower', name: 'Башня', icon: '🏗️', desc: 'Строй и забирай выигрыш', color: '#60a5fa' },
        { id: 'closest', name: 'Ближе к цели', icon: '🎯', desc: 'Угадай число', color: '#4ade80' },
        { id: 'typerace', name: 'Скоростной набор', icon: '⌨️', desc: 'Печатай быстрее бота', color: '#f472b6' },
        { id: 'maze', name: 'Лабиринт', icon: '🧩', desc: 'Найди выход', color: '#a78bfa' },
        { id: 'ttt', name: 'Крестики-нолики', icon: '❌', desc: 'Сразись с ботом', color: '#f97316' }
    ];
    
    const html = `
        <div class="games-container">
            <div class="games-header">
                <div class="games-balance">
                    <span class="games-balance-label">💰 Баланс</span>
                    <span class="games-balance-value">${balance} ⭐</span>
                </div>
                <div class="games-info">🎲 Честные игры против бота. Комиссия 10%. Мин. ставка 10⭐.</div>
            </div>
            <div class="games-grid">
                ${games.map(game => `
                    <div class="game-card" data-game="${game.id}">
                        <div class="game-card-icon" style="background: ${game.color}20; border-color: ${game.color};">${game.icon}</div>
                        <div class="game-card-title">${game.name}</div>
                        <div class="game-card-desc">${game.desc}</div>
                        <button class="game-card-btn">Играть →</button>
                    </div>
                `).join('')}
            </div>
            <div class="games-rules">
                <div class="rules-title">📜 Правила</div>
                <div class="rules-list">
                    <div>• Каждая игра имеет минимальную ставку <strong>10 ⭐</strong></div>
                    <div>• Комиссия платформы — <strong>10%</strong> от выигрыша</div>
                    <div>• Часовой лимит чистого выигрыша/проигрыша — настраивается в <strong>Настройках</strong></div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('app').innerHTML = html;
    
    document.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('game-card-btn') || e.target.closest('.game-card-btn')) {
                const gameId = card.dataset.game;
                switch(gameId) {
                    case 'reaction': renderReactionGame(); break;
                    case 'tower': renderTowerGame(); break;
                    case 'closest': renderClosestGame(); break;
                    case 'typerace': renderTypeRace(); break;
                    case 'maze': renderMaze(); break;
                    case 'ttt': renderTicTacToe(); break;
                }
            }
        });
    });
};

// ========== ИГРА 1: РЕАКЦИЯ ==========
function renderReactionGame() {
    const html = `
        <div class="game-play-container">
            <div class="game-play-header">
                <button class="game-back-btn" id="gameBackBtn">← Назад</button>
                <h2>⚡ Нажми быстрее</h2>
            </div>
            <div class="game-play-card">
                <p>Ставка: <span id="reactionBetVal">10</span> ⭐ (мин 10)</p>
                <input type="range" id="reactionBetSlider" min="10" max="100" step="5" value="10">
                <div id="reactionGameArea" style="margin: 20px 0;">
                    <button id="reactionStartBtn" class="game-action-btn">▶ Начать игру</button>
                </div>
                <div class="small-text">Комиссия 10%. Чем выше ставка, тем меньше времени на реакцию. Лимит 100⭐/час (можно понизить в настройках).</div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    document.getElementById('gameBackBtn').onclick = () => window.renderGamesTab();
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

// ========== ИГРА 2: БАШНЯ ==========
let towerGameActive = false;
let towerHeight = 0;
let towerBetStars = 0;

function renderTowerGame() {
    const html = `
        <div class="game-play-container">
            <div class="game-play-header">
                <button class="game-back-btn" id="gameBackBtn">← Назад</button>
                <h2>🏗️ Башня</h2>
            </div>
            <div class="game-play-card">
                <p>Ставка: <span id="towerBetVal">10</span> ⭐ (мин 10)</p>
                <input type="range" id="towerBetSlider" min="10" max="100" step="5" value="10">
                <div id="towerGameArea" style="margin: 20px 0;">
                    <button id="towerStartBtn" class="game-action-btn">Построить башню</button>
                </div>
                <div class="small-text">Чем выше башня, тем больше множитель. Вы сами решаете, когда остановиться. Без случайности.</div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    document.getElementById('gameBackBtn').onclick = () => window.renderGamesTab();
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

// ========== ИГРА 3: БЛИЖЕ К ЦЕЛИ ==========
function renderClosestGame() {
    const html = `
        <div class="game-play-container">
            <div class="game-play-header">
                <button class="game-back-btn" id="gameBackBtn">← Назад</button>
                <h2>🎯 Ближе к цели</h2>
            </div>
            <div class="game-play-card">
                <p>Ставка: <span id="closestBetVal">10</span> ⭐ (мин 10)</p>
                <input type="range" id="closestBetSlider" min="10" max="100" step="5" value="10">
                <div id="closestGameArea" style="margin: 20px 0;">
                    <button id="closestStartBtn" class="game-action-btn">Начать</button>
                </div>
                <div class="small-text">Бот загадает число. Назовите своё. Чем ближе, тем выше выигрыш. При точном попадании – x2 (до комиссии).</div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    document.getElementById('gameBackBtn').onclick = () => window.renderGamesTab();
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
    else multiplier = 0.5;
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

// ========== ИГРА 4: СКОРОСТНОЙ НАБОР ==========
let raceActive = false;
let raceTimer = null;
let raceText = '';
let playerProgress = 0;
let botProgress = 0;

function renderTypeRace() {
    const html = `
        <div class="game-play-container">
            <div class="game-play-header">
                <button class="game-back-btn" id="gameBackBtn">← Назад</button>
                <h2>⌨️ Скоростной набор</h2>
            </div>
            <div class="game-play-card">
                <p>Ставка: <span id="raceBetVal">10</span> ⭐ (мин 10)</p>
                <input type="range" id="raceBetSlider" min="10" max="100" step="5" value="10">
                <div id="raceGameArea" style="margin: 20px 0;">
                    <button id="raceStartBtn" class="game-action-btn">Начать гонку</button>
                </div>
                <div class="small-text">Соревнуйтесь с ботом в скорости печати. У каждого 3 ошибки. Чем выше ставка, тем быстрее ИИ.</div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    document.getElementById('gameBackBtn').onclick = () => window.renderGamesTab();
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
    const texts = ['telegram', 'биржа', 'акции', 'бот', 'честность', 'скорость'];
    raceText = texts[Math.floor(Math.random() * texts.length)];
    playerProgress = 0;
    botProgress = 0;
    let playerErrors = 0;
    let botErrors = 0;
    raceActive = true;
    const botDelay = Math.max(200, 800 - Math.floor(betStars / 2));
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
    const botInterval = setInterval(() => {
        if (!raceActive) return;
        if (botProgress < raceText.length && botErrors < 3) {
            if (Math.random() < 0.1) {
                botErrors++;
                document.getElementById('botErrors').innerText = botErrors;
                if (botErrors >= 3) {
                    clearInterval(botInterval);
                    finishRace(betStars, true);
                }
            } else {
                botProgress++;
                document.getElementById('botProg').innerText = botProgress;
                if (botProgress >= raceText.length) {
                    clearInterval(botInterval);
                    finishRace(betStars, false);
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

// ========== ИГРА 5: ЛАБИРИНТ ==========
let mazeActive = false;
let mazeGrid = [];
let mazeX, mazeY;
let mazeStepsLeft = 0;

function renderMaze() {
    const html = `
        <div class="game-play-container">
            <div class="game-play-header">
                <button class="game-back-btn" id="gameBackBtn">← Назад</button>
                <h2>🧩 Лабиринт</h2>
            </div>
            <div class="game-play-card">
                <p>Ставка: <span id="mazeBetVal">10</span> ⭐ (мин 10)</p>
                <input type="range" id="mazeBetSlider" min="10" max="100" step="5" value="10">
                <div id="mazeGameArea" style="margin: 20px 0;">
                    <button id="mazeStartBtn" class="game-action-btn">Начать</button>
                </div>
                <div class="small-text">Найдите выход за ограниченное число шагов. Сложность зависит от ставки.</div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    document.getElementById('gameBackBtn').onclick = () => window.renderGamesTab();
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
    const size = betStars < 30 ? 5 : betStars < 70 ? 7 : 9;
    mazeGrid = Array(size).fill().map(() => Array(size).fill('⬜'));
    mazeX = 0; mazeY = 0;
    mazeGrid[0][0] = '🟢';
    const exitX = size-1, exitY = size-1;
    mazeGrid[exitX][exitY] = '🏁';
    const minSteps = (size-1)*2;
    const extraSteps = Math.floor(betStars / 20);
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

// ========== ИГРА 6: КРЕСТИКИ-НОЛИКИ ==========
let tttGameActive = false;
let tttBoard = [];
let tttPlayer = 'X';
let tttBot = 'O';
let tttBetStars = 0;

function renderTicTacToe() {
    const html = `
        <div class="game-play-container">
            <div class="game-play-header">
                <button class="game-back-btn" id="gameBackBtn">← Назад</button>
                <h2>❌⭕ Крестики-нолики</h2>
            </div>
            <div class="game-play-card">
                <p>Ставка: <span id="tttBetVal">10</span> ⭐ (мин 10)</p>
                <input type="range" id="tttBetSlider" min="10" max="100" step="5" value="10">
                <div id="tttGameArea" style="margin: 20px 0;">
                    <button id="tttStartBtn" class="game-action-btn">Начать игру</button>
                </div>
                <div class="small-text">Играйте с ботом. Чем выше ставка, тем умнее бот (глубже просчёт).</div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    document.getElementById('gameBackBtn').onclick = () => window.renderGamesTab();
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
    tttBoard = [['','',''],['','',''],['','','']];
    tttGameActive = true;
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
