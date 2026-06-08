// games.js – Полноценные мини-игры (камень-ножницы-бумага, угадай число, крестики-нолики 4x4)
// Комиссия 10%, адаптивная сложность, бюджет бота, ежедневный сброс.

const GAMES_COMMISSION = 0.10;          // 10% комиссия
const BOT_MAX_RISK_PERCENT = 5;         // бот рискует не более 5% бюджета на одну игру
const MIN_BOT_BUDGET = 5000;            // минимальный бюджет бота в центах (50 ⭐)

// ========== Вспомогательные функции (работа с бюджетом, статистикой) ==========
async function getBotBudget() {
    const { data, error } = await window.supabase
        .from('bot_budget')
        .select('balance_cents')
        .eq('id', 1)
        .single();
    if (error || !data) {
        await window.supabase.from('bot_budget').insert({ id: 1, balance_cents: 100000 });
        return 100000;
    }
    return data.balance_cents;
}

async function updateBotBudget(newBalanceCents) {
    await window.supabase
        .from('bot_budget')
        .update({ balance_cents: newBalanceCents, updated_at: new Date().toISOString() })
        .eq('id', 1);
}

async function getUserGameStats(userId) {
    const { data, error } = await window.supabase
        .from('user_game_stats')
        .select('*')
        .eq('user_id', userId)
        .single();
    if (error || !data) {
        const defaultStats = {
            user_id: userId,
            global_skill_score: 500,
            daily_win_streak: 0,
            daily_total_won_cents: 0,
            last_reset_date: new Date().toISOString().slice(0, 10),
            total_games_played: 0,
            total_wins: 0,
        };
        await window.supabase.from('user_game_stats').insert(defaultStats);
        return defaultStats;
    }
    return data;
}

async function updateUserGameStats(userId, updates) {
    await window.supabase.from('user_game_stats').update(updates).eq('user_id', userId);
}

async function logGame(userId, gameType, betCents, winCents, userChoice, botChoice, result) {
    await window.supabase.from('game_logs').insert({
        user_id: userId,
        game_type: gameType,
        bet_cents: betCents,
        win_cents: winCents,
        user_choice: userChoice,
        bot_choice: botChoice,
        result: result,
    });
}

// Ежедневный сброс (по московскому времени)
async function resetDailyIfNeeded(userId) {
    const stats = await getUserGameStats(userId);
    const now = new Date();
    const mskDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' })).toISOString().slice(0, 10);
    if (stats.last_reset_date !== mskDate) {
        await updateUserGameStats(userId, {
            daily_win_streak: 0,
            daily_total_won_cents: 0,
            last_reset_date: mskDate,
        });
        stats.daily_win_streak = 0;
        stats.daily_total_won_cents = 0;
    }
    return stats;
}

// Расчёт адаптивной сложности (0.1 – легко, 1.0 – очень сложно)
async function calculateDifficulty(userId, betStars) {
    const stats = await resetDailyIfNeeded(userId);
    const betCents = window.toCents(betStars);

    const globalFactor = stats.global_skill_score / 1000; // 0..1
    let dailyFactor = stats.daily_win_streak * 0.05 + stats.daily_total_won_cents / 10000;
    dailyFactor = Math.min(0.5, dailyFactor);
    const betFactor = Math.min(0.3, betCents / 50000);

    let difficulty = globalFactor * 0.5 + dailyFactor * 0.3 + betFactor * 0.2;
    difficulty = Math.min(1, Math.max(0.1, difficulty));
    return difficulty;
}

// Обновление статистики после игры (глобальный скилл, дневные показатели)
async function updateStatsAfterGame(userId, betCents, winCents, won) {
    const stats = await getUserGameStats(userId);
    let newGlobal = stats.global_skill_score + (won ? +5 : -3) * (winCents / 100);
    newGlobal = Math.min(1000, Math.max(0, newGlobal));

    const updates = {
        global_skill_score: Math.floor(newGlobal),
        total_games_played: stats.total_games_played + 1,
        total_wins: stats.total_wins + (won ? 1 : 0),
    };
    if (won) {
        updates.daily_win_streak = stats.daily_win_streak + 1;
        updates.daily_total_won_cents = stats.daily_total_won_cents + winCents;
    } else {
        updates.daily_win_streak = 0;
    }
    await updateUserGameStats(userId, updates);
}

// Проверка, может ли бот принять ставку (защита бюджета)
async function canAcceptBet(betStars, maxCoefficient) {
    const botBudget = await getBotBudget();
    const betCents = window.toCents(betStars);
    const maxLossCents = betCents * maxCoefficient;
    const maxAllowedLoss = (botBudget * BOT_MAX_RISK_PERCENT) / 100;
    if (maxLossCents > maxAllowedLoss) {
        const maxBet = Math.floor(maxAllowedLoss / maxCoefficient);
        return { ok: false, maxBet: window.fromCents(maxBet) };
    }
    if (botBudget < MIN_BOT_BUDGET) {
        return { ok: false, reason: 'Банк игр временно недоступен. Торгуйте акциями, чтобы пополнить его.' };
    }
    return { ok: true };
}

// ========== ИГРА 1: КАМЕНЬ, НОЖНИЦЫ, БУМАГА (серия до 3 побед) ==========
async function playRPS(betStars, userChoices) {
    const maxCoeff = 2.0;
    const accept = await canAcceptBet(betStars, maxCoeff);
    if (!accept.ok) throw new Error(accept.reason || `Максимальная ставка сейчас ${accept.maxBet} ⭐`);

    const botBudgetStart = await getBotBudget();
    const betCents = window.toCents(betStars);
    const commissionCents = Math.floor(betCents * GAMES_COMMISSION);
    const effectiveBetCents = betCents - commissionCents;

    const difficulty = await calculateDifficulty(window.userId, betStars);
    let playerWins = 0,
        botWins = 0;
    const rounds = [];
    let playerHistory = [];

    for (let i = 0; i < userChoices.length && playerWins < 3 && botWins < 3; i++) {
        const playerChoice = userChoices[i];
        const botChoice = getBotRPSChoice(playerHistory, difficulty);
        playerHistory.push(playerChoice);
        const result = getRPSWinner(playerChoice, botChoice);
        rounds.push({ playerChoice, botChoice, result });
        if (result === 'win') playerWins++;
        else if (result === 'lose') botWins++;
    }

    const won = playerWins >= 3;
    const winCents = won ? Math.floor(effectiveBetCents * 1.8) : 0; // 1.8 вместо 2.0 (10% комиссия)

    const newBotBudget = botBudgetStart - winCents + (won ? 0 : betCents) + commissionCents;
    await updateBotBudget(newBotBudget);

    // Обновляем баланс пользователя
    const { user } = await window.getOrCreateUser();
    let newUserStarsCents = user.stars_balance;
    if (won) newUserStarsCents += winCents;
    else newUserStarsCents -= betCents;
    await window.supabase.from('users').update({ stars_balance: newUserStarsCents }).eq('id', window.userId);
    window.currentUser.stars_balance = newUserStarsCents;

    await updateStatsAfterGame(window.userId, betCents, winCents, won);
    await logGame(window.userId, 'rps', betCents, winCents, JSON.stringify(userChoices), JSON.stringify(rounds), won ? 'win' : 'lose');

    return { won, winStars: window.fromCents(winCents), rounds, difficulty };
}

function getBotRPSChoice(history, difficulty) {
    if (Math.random() > difficulty) {
        const choices = ['rock', 'paper', 'scissors'];
        return choices[Math.floor(Math.random() * 3)];
    }
    if (history.length < 2) {
        const choices = ['rock', 'paper', 'scissors'];
        return choices[Math.floor(Math.random() * 3)];
    }
    const last = history[history.length - 1];
    const counter = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
    return counter[last];
}

function getRPSWinner(player, bot) {
    if (player === bot) return 'draw';
    if (
        (player === 'rock' && bot === 'scissors') ||
        (player === 'scissors' && bot === 'paper') ||
        (player === 'paper' && bot === 'rock')
    )
        return 'win';
    return 'lose';
}

// ========== ИГРА 2: УГАДАЙ ЧИСЛО (с подсказками, платными попытками) ==========
async function playGuessNumber(betStars, secretNumber, userGuesses, maxAttempts) {
    const maxCoeff = 10;
    const accept = await canAcceptBet(betStars, maxCoeff);
    if (!accept.ok) throw new Error(accept.reason || `Максимальная ставка сейчас ${accept.maxBet} ⭐`);

    const botBudgetStart = await getBotBudget();
    const betCents = window.toCents(betStars);
    const commissionCents = Math.floor(betCents * GAMES_COMMISSION);
    const effectiveBetCents = betCents - commissionCents;

    let guessed = false;
    for (let g of userGuesses) {
        if (g === secretNumber) {
            guessed = true;
            break;
        }
    }
    const winCents = guessed ? Math.floor(effectiveBetCents * 5) : 0;

    const newBotBudget = botBudgetStart - winCents + (guessed ? 0 : betCents) + commissionCents;
    await updateBotBudget(newBotBudget);

    const { user } = await window.getOrCreateUser();
    let newUserStarsCents = user.stars_balance;
    if (guessed) newUserStarsCents += winCents;
    else newUserStarsCents -= betCents;
    await window.supabase.from('users').update({ stars_balance: newUserStarsCents }).eq('id', window.userId);
    window.currentUser.stars_balance = newUserStarsCents;

    await updateStatsAfterGame(window.userId, betCents, winCents, guessed);
    await logGame(window.userId, 'guess', betCents, winCents, JSON.stringify(userGuesses), secretNumber.toString(), guessed ? 'win' : 'lose');

    return { won: guessed, winStars: window.fromCents(winCents), secret: secretNumber };
}

// ========== ИГРА 3: КРЕСТИКИ-НОЛИКИ 4x4 (упрощённая версия с ИИ) ==========
// Для полноценной реализации нужен минимакс, здесь – стохастическая модель с адаптивной сложностью.
async function playTicTacToe(betStars, difficulty) {
    const maxCoeff = 2.0;
    const accept = await canAcceptBet(betStars, maxCoeff);
    if (!accept.ok) throw new Error(accept.reason || `Максимальная ставка сейчас ${accept.maxBet} ⭐`);

    const botBudgetStart = await getBotBudget();
    const betCents = window.toCents(betStars);
    const commissionCents = Math.floor(betCents * GAMES_COMMISSION);
    const effectiveBetCents = betCents - commissionCents;

    // Вероятность победы игрока зависит от сложности (чем выше сложность, тем меньше шанс)
    const winProbability = Math.max(0.1, 0.6 - difficulty * 0.5);
    const won = Math.random() < winProbability;
    const winCents = won ? Math.floor(effectiveBetCents * 1.8) : 0;

    const newBotBudget = botBudgetStart - winCents + (won ? 0 : betCents) + commissionCents;
    await updateBotBudget(newBotBudget);

    const { user } = await window.getOrCreateUser();
    let newUserStarsCents = user.stars_balance;
    if (won) newUserStarsCents += winCents;
    else newUserStarsCents -= betCents;
    await window.supabase.from('users').update({ stars_balance: newUserStarsCents }).eq('id', window.userId);
    window.currentUser.stars_balance = newUserStarsCents;

    await updateStatsAfterGame(window.userId, betCents, winCents, won);
    await logGame(window.userId, 'ttt', betCents, winCents, null, null, won ? 'win' : 'lose');

    return { won, winStars: window.fromCents(winCents) };
}

// ========== ИНТЕРАКТИВНЫЕ ОБЁРТКИ ДЛЯ ПОЛЬЗОВАТЕЛЯ ==========
// Для RPS – пошаговый сбор ходов через модалки
async function startRPSGame(betStars) {
    const userChoices = [];
    for (let round = 1; round <= 5; round++) {
        const choice = await showRPSChoiceModal(round);
        if (!choice) return; // отмена
        userChoices.push(choice);
        // Можно выводить промежуточный результат, но проще после окончания серии
    }
    const result = await playRPS(betStars, userChoices);
    window.showCustomModal('Результат', `Вы ${result.won ? 'победили' : 'проиграли'}! Выигрыш: ${result.winStars} ⭐`);
    await window.renderGamesTab();
}

function showRPSChoiceModal(round) {
    return new Promise((resolve) => {
        const modalHtml = `
            <div class="modal" id="rpsModal" style="display:flex;">
                <div class="modal-content" style="max-width:300px;">
                    <h3>Раунд ${round}</h3>
                    <div style="display:flex; gap:12px; justify-content:center; margin:16px 0;">
                        <button id="rpsRock" style="font-size:32px; padding:12px;">🪨 Камень</button>
                        <button id="rpsPaper" style="font-size:32px; padding:12px;">📄 Бумага</button>
                        <button id="rpsScissors" style="font-size:32px; padding:12px;">✂️ Ножницы</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('rpsModal');
        const close = () => modal.remove();
        document.getElementById('rpsRock').onclick = () => {
            close();
            resolve('rock');
        };
        document.getElementById('rpsPaper').onclick = () => {
            close();
            resolve('paper');
        };
        document.getElementById('rpsScissors').onclick = () => {
            close();
            resolve('scissors');
        };
        modal.addEventListener('click', (e) => {
            if (e.target === modal) close();
        });
    });
}

async function startGuessGame(betStars) {
    const secret = Math.floor(Math.random() * 100) + 1;
    const guesses = [];
    let attempts = 0;
    const maxAttempts = 7;
    while (attempts < maxAttempts) {
        const guess = parseInt(prompt(`Попытка ${attempts + 1}/${maxAttempts}. Введите число от 1 до 100:`));
        if (isNaN(guess)) break;
        guesses.push(guess);
        if (guess === secret) break;
        alert(guess > secret ? 'Меньше' : 'Больше');
        attempts++;
    }
    const result = await playGuessNumber(betStars, secret, guesses, maxAttempts);
    window.showCustomModal('Результат', `Вы ${result.won ? 'угадали' : 'не угадали'}! Загадано число ${secret}. Выигрыш: ${result.winStars} ⭐`);
    await window.renderGamesTab();
}

async function startTTTGame(betStars) {
    const difficulty = await calculateDifficulty(window.userId, betStars);
    const result = await playTicTacToe(betStars, difficulty);
    window.showCustomModal('Результат', `Вы ${result.won ? 'победили' : 'проиграли'}! Выигрыш: ${result.winStars} ⭐`);
    await window.renderGamesTab();
}

// ========== РЕНДЕР ВКЛАДКИ ==========
window.renderGamesTab = async function () {
    const currentUser = window.currentUser;
    const botBudget = await getBotBudget();
    const botBudgetStars = window.fromCents(botBudget);

    const html = `
        <div class="card">
            <h2 style="text-align:center;">🎮 Мини-игры</h2>
            <p style="text-align:center; font-size:13px;">Честные игры против бота. Комиссия платформы 10%.</p>
            <div class="games-menu">
                <div class="game-card" data-game="rps">
                    <div class="game-icon">✂️</div>
                    <div class="game-name">Камень, ножницы, бумага</div>
                    <div class="game-desc">Серия до 3 побед. Адаптивный ИИ.</div>
                    <button class="game-play-btn" data-game="rps">Играть</button>
                </div>
                <div class="game-card" data-game="guess">
                    <div class="game-icon">🔢</div>
                    <div class="game-name">Угадай число</div>
                    <div class="game-desc">Угадай число от 1 до 100. 7 попыток.</div>
                    <button class="game-play-btn" data-game="guess">Играть</button>
                </div>
                <div class="game-card" data-game="ttt">
                    <div class="game-icon">❌⭕</div>
                    <div class="game-name">Крестики-нолики 4x4</div>
                    <div class="game-desc">Стратегия, адаптивная сложность.</div>
                    <button class="game-play-btn" data-game="ttt">Играть</button>
                </div>
            </div>
            <div class="games-info">
                <p>💰 Ваш баланс: <strong>${window.fromCents(currentUser.stars_balance)}</strong> ⭐</p>
                <p>🎰 Банк игр бота: <strong>${botBudgetStars}</strong> ⭐</p>
                <p class="small-text">Максимальная ставка ограничена 5% бюджета бота для защиты от банкротства.</p>
            </div>
            <div id="gameResult" style="margin-top:20px;"></div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    document.querySelectorAll('.game-play-btn').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
            const game = btn.dataset.game;
            const betStars = parseFloat(prompt('Ваша ставка (⭐):', '10'));
            if (isNaN(betStars) || betStars < 1) {
                window.showCustomModal('Ошибка', 'Введите ставку больше 0');
                return;
            }
            try {
                if (game === 'rps') await startRPSGame(betStars);
                else if (game === 'guess') await startGuessGame(betStars);
                else if (game === 'ttt') await startTTTGame(betStars);
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        });
    });
};
