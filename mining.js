// mining.js – полностью переработан с синхронизацией через Supabase

const CLAIM_THRESHOLD = 0.1;
const SESSION_DURATION = 12 * 3600 * 1000; // 12 часов
const MAX_PER_SESSION = 0.2;
const UPGRADE_MAX = 10;
const DAILY_BONUS_INTERVAL = 24 * 3600 * 1000; // 24 часа

let miningInterval = null;
let countdownInterval = null;
let dailyTimerInterval = null;
let miningData = null;
let lastDailyBonusTime = null;

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadMiningData() {
    try {
        // Проверяем, есть ли запись в Supabase
        const { data, error } = await window.supabase
            .from('mining')
            .select('*')
            .eq('user_id', window.userId)
            .maybeSingle();

        if (error) {
            console.error('Ошибка загрузки майнинга', error);
            return null;
        }

        if (!data) {
            // Создаём новую запись
            const defaultData = {
                user_id: window.userId,
                mining_active: false,
                mining_start: null,
                mining_end: null,
                mined_amount: 0,
                total_mined: 0,
                level: 1,
                claimed_total: 0,
                last_daily_bonus: null,
                daily_bonus_claimed: false
            };
            const { data: newData, error: insertError } = await window.supabase
                .from('mining')
                .insert(defaultData)
                .select()
                .single();
            if (insertError) throw insertError;
            miningData = newData;
        } else {
            miningData = data;
            // Проверяем, не истекла ли активная сессия
            if (miningData.mining_active && miningData.mining_end) {
                const now = Date.now();
                const end = new Date(miningData.mining_end).getTime();
                if (now > end) {
                    // Сессия истекла – завершаем
                    miningData.mining_active = false;
                    miningData.mined_amount = 0;
                    miningData.mining_start = null;
                    miningData.mining_end = null;
                    await saveMiningData();
                }
            }
        }
        // Загружаем время последнего бонуса из localStorage (для отображения таймера)
        const dailyData = localStorage.getItem('daily_bonus_time');
        if (dailyData) {
            lastDailyBonusTime = JSON.parse(dailyData);
        } else if (miningData.last_daily_bonus) {
            lastDailyBonusTime = miningData.last_daily_bonus;
        } else {
            lastDailyBonusTime = null;
        }
        return miningData;
    } catch(e) {
        console.error('Ошибка загрузки майнинга', e);
        window.showCustomModal('Ошибка', 'Не удалось загрузить данные майнинга');
        return null;
    }
}

// ===== СОХРАНЕНИЕ =====
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
                claimed_total: miningData.claimed_total,
                last_daily_bonus: miningData.last_daily_bonus,
                daily_bonus_claimed: miningData.daily_bonus_claimed
            })
            .eq('user_id', window.userId);
        if (error) throw error;
    } catch(e) {
        console.error('Ошибка сохранения майнинга', e);
    }
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function getCurrentRate(level) {
    const baseRate = 0.00000463; // 0.2 за 12 часов
    const bonus = 0.10; // +10% за уровень
    return baseRate * (1 + (level - 1) * bonus);
}

function getUpgradeCost(level) {
    return Math.floor(10 * Math.pow(1.5, level - 1));
}

function getDailyBonus(level) {
    return 0.1 * (1 + (level - 1) * 0.10);
}

function canClaimDailyBonus() {
    if (!lastDailyBonusTime) return true;
    const now = Date.now();
    const last = new Date(lastDailyBonusTime).getTime();
    return (now - last) >= DAILY_BONUS_INTERVAL;
}

function getTimeUntilDailyBonus() {
    if (!lastDailyBonusTime) return 0;
    const now = Date.now();
    const last = new Date(lastDailyBonusTime).getTime();
    const diff = DAILY_BONUS_INTERVAL - (now - last);
    return Math.max(0, diff);
}

// ===== НАЧАТЬ МАЙНИНГ =====
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

// ===== ТАЙМЕР СЕССИИ =====
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
        // Обновляем накопленное
        const minedEl = document.getElementById('minedAmount');
        if (minedEl) {
            minedEl.textContent = miningData.mined_amount.toFixed(6);
        }
        updateClaimButton();
    }, 1000);
}

// ===== ПРОГРЕСС МАЙНИНГА =====
function startMiningProgress() {
    if (miningInterval) clearInterval(miningInterval);
    miningInterval = setInterval(async () => {
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
        // Сохраняем раз в 30 секунд
        if (Math.random() < 0.03) {
            await saveMiningData();
        }
        const minedEl = document.getElementById('minedAmount');
        if (minedEl) minedEl.textContent = miningData.mined_amount.toFixed(6);
        updateClaimButton();
    }, 1000);
}

// ===== ЗАВЕРШЕНИЕ СЕССИИ =====
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

// ===== ЗАБРАТЬ НАКОПЛЕННОЕ =====
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
        miningData.claimed_total += amount;
    }
    miningData.mined_amount = 0;
    // Если сессия ещё активна, продолжаем майнинг с нуля
    await saveMiningData();
    window.showToast(`✅ Забрано ${amount.toFixed(4)} акций!`);
    updateUI();
}

// ===== ЕЖЕДНЕВНЫЙ БОНУС =====
async function claimDailyBonus() {
    if (!miningData) return;
    if (!canClaimDailyBonus()) {
        const remaining = getTimeUntilDailyBonus();
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        window.showCustomModal('Ежедневный бонус', `Бонус уже получен. Следующий через ${hours}ч ${minutes}м`);
        return;
    }
    const bonus = getDailyBonus(miningData.level);
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
        miningData.last_daily_bonus = new Date().toISOString();
        miningData.daily_bonus_claimed = true;
        lastDailyBonusTime = miningData.last_daily_bonus;
        localStorage.setItem('daily_bonus_time', JSON.stringify(lastDailyBonusTime));
        await saveMiningData();
        window.showToast(`🎁 Ежедневный бонус: +${bonus.toFixed(4)} акций!`);
        updateUI();
    }
}

// ===== ПОВЫШЕНИЕ УРОВНЯ =====
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
        console.error('Ошибка списания акций', error);
        window.showCustomModal('Ошибка', 'Не удалось списать акции');
        return;
    }
    window.currentUser.shares -= costCents;
    miningData.level += 1;
    await saveMiningData();
    window.showToast(`⬆️ Уровень повышен до ${miningData.level}! Скорость майнинга +10%`);
    updateUI();
}

// ===== ОБНОВЛЕНИЕ КНОПКИ CLAIM =====
function updateClaimButton() {
    const claimBtn = document.getElementById('claimBtn');
    if (!claimBtn) return;
    const amount = miningData ? miningData.mined_amount : 0;
    if (amount >= CLAIM_THRESHOLD && miningData && miningData.mining_active) {
        claimBtn.disabled = false;
        claimBtn.textContent = `💰 Забрать (${amount.toFixed(4)} акций)`;
        claimBtn.style.opacity = '1';
    } else {
        claimBtn.disabled = true;
        claimBtn.textContent = `💰 Забрать (нужно ${CLAIM_THRESHOLD} акций)`;
        claimBtn.style.opacity = '0.5';
    }
}

// ===== ТАЙМЕР ЕЖЕДНЕВНОГО БОНУСА =====
function startDailyTimer() {
    if (dailyTimerInterval) clearInterval(dailyTimerInterval);
    dailyTimerInterval = setInterval(() => {
        const remaining = getTimeUntilDailyBonus();
        const hours = Math.floor(remaining / 3600000);
        const minutes = Math.floor((remaining % 3600000) / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const bonusLabel = document.getElementById('dailyBonusLabel');
        if (bonusLabel) {
            if (remaining <= 0) {
                bonusLabel.textContent = '🎁 Бонус готов!';
            } else {
                bonusLabel.textContent = `⏳ До бонуса: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            }
        }
        // Обновляем кнопку бонуса
        const dailyBtn = document.getElementById('dailyBonusBtn');
        if (dailyBtn) {
            const canClaim = canClaimDailyBonus();
            dailyBtn.disabled = !canClaim;
            dailyBtn.textContent = canClaim ? `🎁 Забрать бонус (${getDailyBonus(miningData?.level || 1).toFixed(4)} акций)` : '⏳ Бонус уже получен';
            dailyBtn.style.opacity = canClaim ? '1' : '0.5';
        }
    }, 1000);
}

// ===== ОБНОВЛЕНИЕ ВСЕГО UI =====
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
        const nextRate = getCurrentRate(nextLevel);
        upgradeBtn.textContent = `⬆️ Уровень ${nextLevel} (${cost} акций, +10% скорости)`;
        const userSharesCents = window.currentUser.shares;
        upgradeBtn.disabled = (userSharesCents / 100) < cost || miningData.level >= UPGRADE_MAX;
        if (miningData.level >= UPGRADE_MAX) {
            upgradeBtn.textContent = '🏆 Максимальный уровень';
        }
    }

    updateClaimButton();

    // Таймер сессии
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
        const dailyBonus = getDailyBonus(miningData.level);
        rateInfo.innerHTML = `
            <div class="rate-row"><span>⚡ Скорость майнинга</span><span>${(currentRate * 3600).toFixed(4)} акций/час</span></div>
            ${miningData.level < UPGRADE_MAX ? `<div class="rate-row"><span>📈 После улучшения</span><span>${(nextRate * 3600).toFixed(4)} акций/час (+10%)</span></div>` : ''}
            <div class="rate-row"><span>🎁 Ежедневный бонус</span><span>${dailyBonus.toFixed(4)} акций</span></div>
        `;
    }

    // Обновляем кнопку ежедневного бонуса
    if (dailyBtn) {
        const canClaim = canClaimDailyBonus();
        dailyBtn.disabled = !canClaim;
        dailyBtn.textContent = canClaim ? `🎁 Забрать бонус (${getDailyBonus(miningData.level).toFixed(4)} акций)` : '⏳ Бонус уже получен';
        dailyBtn.style.opacity = canClaim ? '1' : '0.5';
    }
}

// ===== ГЛАВНЫЙ РЕНДЕР =====
window.renderMiningTab = async function() {
    if (miningInterval) clearInterval(miningInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    if (dailyTimerInterval) clearInterval(dailyTimerInterval);

    miningData = await loadMiningData();
    if (!miningData) {
        document.getElementById('app').innerHTML = `
            <div class="card error">
                Ошибка загрузки данных майнинга.<br>
                Попробуйте обновить страницу.
            </div>
        `;
        return;
    }

    const canClaim = canClaimDailyBonus();
    const dailyBonus = getDailyBonus(miningData.level);

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
                <div class="timer-label">⏳ Осталось</div>
                <div class="timer-value" id="miningTimer">--:--:--</div>
            </div>
            <div id="dailyBonusContainer" style="margin:8px 0;">
                <button id="dailyBonusBtn" class="mining-btn daily" ${!canClaim ? 'disabled' : ''}>${canClaim ? `🎁 Забрать бонус (${dailyBonus.toFixed(4)} акций)` : '⏳ Бонус уже получен'}</button>
                <div id="dailyBonusLabel" style="font-size:12px; color:#9ca3af; text-align:center; margin-top:4px;">${!canClaim ? '⏳ До бонуса: ' + formatTime(getTimeUntilDailyBonus()) : '🎁 Бонус готов!'}</div>
            </div>
            <button id="startMiningBtn" class="mining-btn primary">🚀 Начать майнинг (12ч)</button>
            <button id="claimBtn" class="mining-btn claim" disabled>💰 Забрать (нужно ${CLAIM_THRESHOLD} акций)</button>
            <button id="upgradeLevelBtn" class="mining-btn secondary">⬆️ Улучшить уровень</button>
            <div class="mining-info" id="rateInfo"></div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    // Обработчики
    document.getElementById('dailyBonusBtn').addEventListener('click', claimDailyBonus);
    document.getElementById('startMiningBtn').addEventListener('click', startMining);
    document.getElementById('claimBtn').addEventListener('click', claimMining);
    document.getElementById('upgradeLevelBtn').addEventListener('click', upgradeLevel);

    updateUI();
    if (miningData.mining_active) {
        startCountdown();
        startMiningProgress();
    }
    startDailyTimer();
};

// ===== ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ФОРМАТИРОВАНИЯ ВРЕМЕНИ =====
function formatTime(ms) {
    if (ms <= 0) return '00:00:00';
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Остановка интервалов при уходе
document.addEventListener('visibilitychange', () => {
    const activeTab = document.querySelector('.tab.active');
    if (activeTab && activeTab.dataset.tab === 'mining') {
        if (!document.hidden) {
            // Перезапускаем таймеры, если вкладка активна
            if (miningData && miningData.mining_active) {
                startCountdown();
                startMiningProgress();
            }
            startDailyTimer();
        } else {
            if (miningInterval) clearInterval(miningInterval);
            if (countdownInterval) clearInterval(countdownInterval);
            if (dailyTimerInterval) clearInterval(dailyTimerInterval);
        }
    }
});
