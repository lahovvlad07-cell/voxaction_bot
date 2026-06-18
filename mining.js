// mining.js – данные в Supabase, синхронизация между устройствами

const SESSION_DURATION = 12 * 3600 * 1000;
const MAX_PER_SESSION = 0.2;
const CLAIM_THRESHOLD = 0.1;
const UPGRADE_BONUS = 0.10;
const UPGRADE_MAX = 10;
const DAILY_BONUS_AMOUNT = 0.1;

let miningData = null;
let lastBonusDate = null;
let miningInterval = null;
let countdownInterval = null;
let bonusCountdownInterval = null;

// ===== ЗАГРУЗКА ДАННЫХ ИЗ SUPABASE =====
async function loadMiningData() {
    try {
        const { data, error } = await window.supabase
            .from('mining')
            .select('*')
            .eq('user_id', window.userId)
            .maybeSingle();

        if (error) {
            // Проверяем, существует ли таблица
            if (error.message && error.message.includes('relation "mining" does not exist')) {
                console.error('Таблица mining не найдена. Создайте её через SQL.');
                window.showCustomModal('Ошибка', 'Таблица mining не создана. Обратитесь к администратору.');
                return null;
            }
            throw error;
        }

        if (!data) {
            // Создаём новую запись
            const { data: newData, error: insertError } = await window.supabase
                .from('mining')
                .insert({
                    user_id: window.userId,
                    mining_active: false,
                    mining_start: null,
                    mining_end: null,
                    mined_amount: 0,
                    total_mined: 0,
                    level: 1,
                    last_bonus: null,
                    last_update: new Date().toISOString()
                })
                .select()
                .single();
            if (insertError) throw insertError;
            miningData = newData;
        } else {
            miningData = data;
            // Проверяем активную сессию
            if (miningData.mining_active && miningData.mining_end) {
                const now = Date.now();
                const end = new Date(miningData.mining_end).getTime();
                if (now > end) {
                    miningData.mining_active = false;
                    miningData.mining_start = null;
                    miningData.mining_end = null;
                    miningData.mined_amount = 0;
                    await saveMiningData();
                }
            }
        }

        lastBonusDate = miningData.last_bonus ? new Date(miningData.last_bonus) : null;
        return miningData;
    } catch(e) {
        console.error('Ошибка загрузки майнинга', e);
        window.showCustomModal('Ошибка', 'Не удалось загрузить данные майнинга: ' + e.message);
        return null;
    }
}

// ===== СОХРАНЕНИЕ В SUPABASE =====
async function saveMiningData() {
    if (!miningData) return;
    try {
        const { error } = await window.supabase
            .from('mining')
            .update({
                mining_active: miningData.mining_active,
                mining_start: miningData.mining_start,
                mining_end: miningData.mining_end,
                mined_amount: miningData.mined_amount,
                total_mined: miningData.total_mined,
                level: miningData.level,
                last_bonus: miningData.last_bonus,
                last_update: new Date().toISOString()
            })
            .eq('user_id', window.userId);
        if (error) throw error;
    } catch(e) {
        console.error('Ошибка сохранения майнинга', e);
    }
}

// ===== ФУНКЦИИ ДЛЯ РАСЧЁТОВ =====
function getCurrentRate(level) {
    const baseRate = 0.00000463;
    return baseRate * (1 + (level - 1) * UPGRADE_BONUS);
}

function getUpgradeCost(level) {
    return Math.floor(10 * Math.pow(1.5, level - 1));
}

function getDailyBonus() {
    return DAILY_BONUS_AMOUNT * (1 + (miningData?.level || 1) * 0.10);
}

function canClaimDailyBonus() {
    if (!lastBonusDate) return true;
    const now = new Date();
    const diff = now - lastBonusDate;
    return diff >= 24 * 3600 * 1000;
}

function getTimeUntilBonus() {
    if (!lastBonusDate) return 0;
    const now = new Date();
    const diff = now - lastBonusDate;
    const remaining = 24 * 3600 * 1000 - diff;
    return Math.max(0, remaining);
}

// ===== ОСНОВНЫЕ ДЕЙСТВИЯ =====
async function startMining() {
    if (!miningData) return;
    if (miningData.mining_active) {
        window.showCustomModal('Уже майнинг', 'Подождите окончания текущей сессии');
        return;
    }
    const now = Date.now();
    const end = now + SESSION_DURATION;
    miningData.mining_active = true;
    miningData.mining_start = new Date(now).toISOString();
    miningData.mining_end = new Date(end).toISOString();
    miningData.mined_amount = 0;
    await saveMiningData();
    window.showToast('⛏️ Майнинг запущен на 12 часов!');
    updateUI();
    startCountdown();
    startMiningProgress();
}

async function claimMining() {
    if (!miningData) return;
    const amount = miningData.mined_amount;
    if (amount < CLAIM_THRESHOLD) {
        window.showCustomModal('Ошибка', `Накоплено ${amount.toFixed(6)} акций. Минимум для забора: ${CLAIM_THRESHOLD} акций.`);
        return;
    }
    const sharesCents = Math.round(amount * 100);
    if (sharesCents > 0) {
        const { error } = await window.supabase
            .from('users')
            .update({ shares: window.supabase.raw(`shares + ${sharesCents}`) })
            .eq('id', window.userId);
        if (error) {
            console.error('Ошибка начисления акций', error);
            window.showCustomModal('Ошибка', 'Не удалось начислить акции');
            return;
        }
        window.currentUser.shares += sharesCents;
        miningData.total_mined += amount;
    }
    miningData.mined_amount = 0;
    await saveMiningData();
    window.showToast(`✅ Забрано ${amount.toFixed(4)} акций!`);
    updateUI();
}

async function claimDailyBonus() {
    if (!miningData) return;
    if (!canClaimDailyBonus()) {
        window.showCustomModal('Ежедневный бонус', 'Вы уже получили бонус сегодня. Приходите завтра!');
        return;
    }
    const bonus = getDailyBonus();
    const sharesCents = Math.round(bonus * 100);
    if (sharesCents > 0) {
        const { error } = await window.supabase
            .from('users')
            .update({ shares: window.supabase.raw(`shares + ${sharesCents}`) })
            .eq('id', window.userId);
        if (error) {
            console.error('Ошибка начисления бонуса', error);
            window.showCustomModal('Ошибка', 'Не удалось начислить бонус');
            return;
        }
        window.currentUser.shares += sharesCents;
        miningData.total_mined += bonus;
        miningData.last_bonus = new Date().toISOString();
        lastBonusDate = new Date();
        await saveMiningData();
        window.showToast(`🎁 Ежедневный бонус: +${bonus.toFixed(4)} акций!`);
        updateUI();
        startBonusCountdown();
    }
}

async function upgradeLevel() {
    if (!miningData) return;
    const cost = getUpgradeCost(miningData.level);
    const userSharesCents = window.currentUser.shares;
    if (userSharesCents < cost * 100) {
        window.showCustomModal('Ошибка', `Недостаточно акций! Нужно ${cost} акций`);
        return;
    }
    if (miningData.level >= UPGRADE_MAX) {
        window.showCustomModal('Уведомление', 'Вы достигли максимального уровня!');
        return;
    }
    const costCents = cost * 100;
    const { error } = await window.supabase
        .from('users')
        .update({ shares: window.supabase.raw(`shares - ${costCents}`) })
        .eq('id', window.userId);
    if (error) {
        window.showCustomModal('Ошибка', error.message);
        return;
    }
    window.currentUser.shares -= costCents;
    miningData.level += 1;
    await saveMiningData();
    window.showToast(`⬆️ Уровень повышен до ${miningData.level}! Скорость майнинга +10%`);
    updateUI();
}

// ===== ТАЙМЕРЫ =====
function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        if (!miningData || !miningData.mining_active) {
            clearInterval(countdownInterval);
            return;
        }
        const now = Date.now();
        const end = new Date(miningData.mining_end).getTime();
        if (now >= end) {
            clearInterval(countdownInterval);
            finishMining();
            return;
        }
        const diff = end - now;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        const timerEl = document.getElementById('miningTimer');
        if (timerEl) {
            timerEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }, 1000);
}

function startMiningProgress() {
    if (miningInterval) clearInterval(miningInterval);
    miningInterval = setInterval(() => {
        if (!miningData || !miningData.mining_active) {
            clearInterval(miningInterval);
            return;
        }
        const now = Date.now();
        const end = new Date(miningData.mining_end).getTime();
        if (now >= end) {
            clearInterval(miningInterval);
            finishMining();
            return;
        }
        const rate = getCurrentRate(miningData.level);
        const elapsedSeconds = (now - new Date(miningData.mining_start).getTime()) / 1000;
        let theoretical = elapsedSeconds * rate;
        const newAmount = Math.min(theoretical, MAX_PER_SESSION);
        miningData.mined_amount = newAmount;
        const minedEl = document.getElementById('minedAmount');
        if (minedEl) minedEl.textContent = miningData.mined_amount.toFixed(6);
        updateClaimButton();
    }, 1000);
}

function startBonusCountdown() {
    if (bonusCountdownInterval) clearInterval(bonusCountdownInterval);
    bonusCountdownInterval = setInterval(() => {
        const remaining = getTimeUntilBonus();
        if (remaining <= 0) {
            clearInterval(bonusCountdownInterval);
            updateUI();
            return;
        }
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const bonusTimer = document.getElementById('bonusTimer');
        if (bonusTimer) {
            bonusTimer.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }, 1000);
}

async function finishMining() {
    if (!miningData) return;
    miningData.mining_active = false;
    miningData.mining_start = null;
    miningData.mining_end = null;
    await saveMiningData();
    if (miningInterval) clearInterval(miningInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    window.showToast('⏰ Сессия майнинга завершена! Заберите накопленные акции.');
    updateUI();
}

// ===== ОБНОВЛЕНИЕ UI =====
function updateClaimButton() {
    const claimBtn = document.getElementById('claimBtn');
    if (!claimBtn) return;
    const amount = miningData?.mined_amount || 0;
    if (amount >= CLAIM_THRESHOLD && miningData?.mining_active) {
        claimBtn.disabled = false;
        claimBtn.textContent = `💰 Забрать (${amount.toFixed(4)} акций)`;
        claimBtn.style.opacity = '1';
    } else {
        claimBtn.disabled = true;
        claimBtn.textContent = `💰 Забрать (нужно ${CLAIM_THRESHOLD} акций)`;
        claimBtn.style.opacity = '0.5';
    }
}

function updateUI() {
    if (!miningData) return;
    const levelEl = document.getElementById('miningLevel');
    const totalEl = document.getElementById('totalMined');
    const minedEl = document.getElementById('minedAmount');
    const timerEl = document.getElementById('miningTimer');
    const startBtn = document.getElementById('startMiningBtn');
    const upgradeBtn = document.getElementById('upgradeLevelBtn');
    const claimBtn = document.getElementById('claimBtn');
    const dailyBtn = document.getElementById('dailyBonusBtn');
    const bonusTimer = document.getElementById('bonusTimer');

    if (levelEl) levelEl.textContent = miningData.level;
    if (totalEl) totalEl.textContent = miningData.total_mined.toFixed(4);
    if (minedEl) minedEl.textContent = miningData.mined_amount.toFixed(6);

    if (startBtn) {
        if (miningData.mining_active) {
            startBtn.textContent = '⛏️ Майнинг идёт...';
            startBtn.disabled = true;
            startBtn.style.opacity = '0.6';
        } else {
            startBtn.textContent = '🚀 Начать майнинг (12ч)';
            startBtn.disabled = false;
            startBtn.style.opacity = '1';
        }
    }

    if (upgradeBtn) {
        const cost = getUpgradeCost(miningData.level);
        const nextLevel = miningData.level + 1;
        upgradeBtn.textContent = `⬆️ Уровень ${nextLevel} (${cost} акций, +${(UPGRADE_BONUS*100).toFixed(0)}% скорости)`;
        const userSharesCents = window.currentUser.shares;
        upgradeBtn.disabled = (userSharesCents / 100) < cost || miningData.level >= UPGRADE_MAX;
        if (miningData.level >= UPGRADE_MAX) {
            upgradeBtn.textContent = '🏆 Максимальный уровень';
        }
    }

    updateClaimButton();

    if (dailyBtn) {
        const canClaim = canClaimDailyBonus();
        const bonus = getDailyBonus();
        dailyBtn.disabled = !canClaim;
        dailyBtn.textContent = canClaim ? `🎁 Забрать бонус (${bonus.toFixed(4)} акций)` : '🎁 Бонус уже получен';
        dailyBtn.style.opacity = canClaim ? '1' : '0.5';
    }

    // Таймер до бонуса
    if (bonusTimer) {
        const remaining = getTimeUntilBonus();
        if (remaining > 0 && !canClaimDailyBonus()) {
            const hours = Math.floor(remaining / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            bonusTimer.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
            bonusTimer.textContent = 'Готово!';
        }
    }

    if (miningData.mining_active && miningData.mining_end) {
        const now = Date.now();
        const end = new Date(miningData.mining_end).getTime();
        if (now < end) {
            const diff = end - now;
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            if (timerEl) {
                timerEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
        } else {
            if (timerEl) timerEl.textContent = '00:00:00';
        }
    } else {
        if (timerEl) timerEl.textContent = '--:--:--';
    }

    // Информация о скорости
    const rateInfo = document.getElementById('rateInfo');
    if (rateInfo) {
        const currentRate = getCurrentRate(miningData.level);
        const nextRate = miningData.level < UPGRADE_MAX ? getCurrentRate(miningData.level + 1) : currentRate;
        const dailyBonus = getDailyBonus();
        const canClaim = canClaimDailyBonus();
        rateInfo.innerHTML = `
            <div class="rate-row"><span>⚡ Скорость майнинга</span><span>${(currentRate * 3600).toFixed(4)} акций/час</span></div>
            ${miningData.level < UPGRADE_MAX ? `<div class="rate-row"><span>📈 После улучшения</span><span>${(nextRate * 3600).toFixed(4)} акций/час (+${(UPGRADE_BONUS*100).toFixed(0)}%)</span></div>` : ''}
            <div class="rate-row"><span>🎁 Ежедневный бонус</span><span>${dailyBonus.toFixed(4)} акций ${canClaim ? '✅ доступен' : '⏳'}</span></div>
        `;
    }
}

// ===== ГЛАВНЫЙ РЕНДЕР =====
window.renderMiningTab = async function() {
    if (miningInterval) clearInterval(miningInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    if (bonusCountdownInterval) clearInterval(bonusCountdownInterval);

    await loadMiningData();
    if (!miningData) {
        document.getElementById('app').innerHTML = `
            <div class="card error">
                Ошибка загрузки данных майнинга.<br>
                Проверьте, что таблица <strong>mining</strong> создана в базе данных.
            </div>
        `;
        return;
    }

    const bonus = getDailyBonus();
    const canClaim = canClaimDailyBonus();

    const html = `
        <div class="mining-container">
            <div class="mining-header">
                <h2>⛏️ Майнинг акций</h2>
                <p>Запустите майнинг на 12 часов – накапливайте акции</p>
            </div>
            <div class="mining-stats">
                <div class="mining-stat"><div class="mining-stat-value" id="miningLevel">${miningData.level}</div><div class="mining-stat-label">Уровень</div></div>
                <div class="mining-stat"><div class="mining-stat-value" id="totalMined">${miningData.total_mined.toFixed(4)}</div><div class="mining-stat-label">Всего намайнено</div></div>
                <div class="mining-stat"><div class="mining-stat-value" id="minedAmount">${miningData.mined_amount.toFixed(6)}</div><div class="mining-stat-label">Накоплено сейчас</div></div>
            </div>
            <div class="mining-timer">
                <div class="timer-label">⏳ Осталось до завершения сессии</div>
                <div class="timer-value" id="miningTimer">--:--:--</div>
            </div>
            <div class="mining-timer bonus-timer">
                <div class="timer-label">🎁 До следующего бонуса</div>
                <div class="timer-value" id="bonusTimer">${canClaim ? 'Готово!' : '--:--:--'}</div>
            </div>
            <button id="dailyBonusBtn" class="mining-btn daily" ${!canClaim ? 'disabled' : ''}>🎁 Забрать бонус (${bonus.toFixed(4)} акций)</button>
            <button id="startMiningBtn" class="mining-btn primary">🚀 Начать майнинг (12ч)</button>
            <button id="claimBtn" class="mining-btn claim" disabled>💰 Забрать (нужно ${CLAIM_THRESHOLD} акций)</button>
            <button id="upgradeLevelBtn" class="mining-btn secondary">⬆️ Улучшить уровень</button>
            <div class="mining-info" id="rateInfo"></div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    document.getElementById('dailyBonusBtn').addEventListener('click', claimDailyBonus);
    document.getElementById('startMiningBtn').addEventListener('click', startMining);
    document.getElementById('claimBtn').addEventListener('click', claimMining);
    document.getElementById('upgradeLevelBtn').addEventListener('click', upgradeLevel);

    updateUI();
    if (miningData.mining_active) {
        startCountdown();
        startMiningProgress();
    }
    if (!canClaimDailyBonus()) {
        startBonusCountdown();
    }
};

// Остановка интервалов
document.addEventListener('visibilitychange', () => {
    const activeTab = document.querySelector('.tab.active');
    if (activeTab && activeTab.dataset.tab === 'mining') {
        if (!document.hidden) {
            if (miningData?.mining_active) {
                startCountdown();
                startMiningProgress();
            }
            if (!canClaimDailyBonus()) {
                startBonusCountdown();
            }
        } else {
            if (miningInterval) clearInterval(miningInterval);
            if (countdownInterval) clearInterval(countdownInterval);
            if (bonusCountdownInterval) clearInterval(bonusCountdownInterval);
        }
    }
});
