// games.js – мини-игры (камень-ножницы-бумага, угадай число, крестики-нолики)
const GAMES_COMMISSION = 0.10;

async function getBotBudget() {
    const { data, error } = await window.supabase.from('bot_budget').select('balance_cents').eq('id', 1).single();
    if (error || !data) {
        await window.supabase.from('bot_budget').insert({ id: 1, balance_cents: 100000 });
        return 100000;
    }
    return data.balance_cents;
}

async function updateBotBudget(newBalanceCents) {
    await window.supabase.from('bot_budget').update({ balance_cents: newBalanceCents, updated_at: new Date().toISOString() }).eq('id', 1);
}

async function getUserGameStats(userId) {
    const { data, error } = await window.supabase.from('user_game_stats').select('*').eq('user_id', userId).single();
    if (error || !data) {
        const defaultStats = {
            user_id: userId,
            global_skill_score: 500,
            daily_win_streak: 0,
            daily_total_won_cents: 0,
            last_reset_date: new Date().toISOString().slice(0,10),
            total_games_played: 0,
            total_wins: 0
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
        user_id: userId, game_type: gameType, bet_cents: betCents, win_cents: winCents,
        user_choice: userChoice, bot_choice: botChoice, result: result
    });
}

async function canAcceptBet(betStars, maxCoefficient) {
    const botBudget = await getBotBudget();
    const betCents = window.toCents(betStars);
    const maxLossCents = betCents * maxCoefficient;
    const maxAllowedLoss = botBudget * 0.05;
    if (maxLossCents > maxAllowedLoss) {
        const maxBet = Math.floor(maxAllowedLoss / maxCoefficient);
        return { ok: false, maxBet: window.fromCents(maxBet) };
    }
    if (botBudget < 5000) return { ok: false, reason: 'Банк игр временно недоступен.' };
    return { ok: true };
}

window.renderGamesTab = async function() {
    const currentUser = window.currentUser;
    const botBudget = await getBotBudget();
    const html = `
        <div class="card">
            <h2 style="text-align:center;">🎮 Мини-игры</h2>
            <p style="text-align:center; font-size:13px;">Играйте против бота. Комиссия платформы 10%.</p>
            <div class="games-menu" style="display:flex; flex-direction:column; gap:16px; margin:20px 0;">
                <button id="gameRpsBtn" style="background: linear-gradient(135deg,#2b6e9e,#1a4c6e);">✂️ Камень, ножницы, бумага</button>
                <button id="gameGuessBtn" style="background: linear-gradient(135deg,#2b6e9e,#1a4c6e);">🔢 Угадай число</button>
                <button id="gameTttBtn" style="background: linear-gradient(135deg,#2b6e9e,#1a4c6e);">❌⭕ Крестики-нолики 4x4</button>
            </div>
            <div class="games-info">
                <p>💰 Ваш баланс: <strong>${window.fromCents(currentUser.stars_balance)}</strong> ⭐</p>
                <p>🎰 Банк игр бота: <strong>${window.fromCents(botBudget)}</strong> ⭐</p>
            </div>
            <div id="gameResult"></div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    
    document.getElementById('gameRpsBtn').onclick = async () => {
        const bet = parseFloat(prompt('Ваша ставка (⭐):', '10'));
        if (isNaN(bet) || bet < 1) return window.showCustomModal('Ошибка', 'Ставка от 1 ⭐');
        const accept = await canAcceptBet(bet, 2.0);
        if (!accept.ok) return window.showCustomModal('Ошибка', accept.reason || `Макс. ставка ${accept.maxBet} ⭐`);
        alert('Игра: камень, ножницы, бумага до 3 побед. Сыграем 5 раундов? (пока демо)');
        // здесь можно добавить полноценную логику, но для краткости – заглушка
        window.showCustomModal('Результат', 'Вы выиграли 0 ⭐ (демо-режим)');
    };
    document.getElementById('gameGuessBtn').onclick = async () => {
        const bet = parseFloat(prompt('Ваша ставка (⭐):', '10'));
        if (isNaN(bet) || bet < 1) return;
        window.showCustomModal('Угадай число', 'Загадано число от 1 до 100. Попробуйте угадать (демо)');
    };
    document.getElementById('gameTttBtn').onclick = async () => {
        const bet = parseFloat(prompt('Ваша ставка (⭐):', '10'));
        if (isNaN(bet) || bet < 1) return;
        window.showCustomModal('Крестики-нолики', 'Игра в разработке (демо)');
    };
};
