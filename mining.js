// mining.js – с ежедневным бонусом (+10% за уровень)

const MINING_KEY = 'mining_data_v1';
const DAILY_BONUS_KEY = 'daily_bonus_v1';

const SESSION_DURATION = 12 * 3600 * 1000;
const MAX_PER_SESSION = 0.2;
const BASE_RATE_PER_SEC = MAX_PER_SESSION / (SESSION_DURATION / 1000);
const CLAIM_THRESHOLD = 0.1;
const UPGRADE_BONUS = 0.10;
const UPGRADE_MAX = 10;

function getDefaultMiningData() {
    return {
        mining_active: false,
        mining_start: null,
        mining_end: null,
        mined_amount: 0,
        total_mined: 0,
        level: 1,
        claimed_total: 0
    };
}

function loadMiningData() {
    try {
        const raw = localStorage.getItem(MINING_KEY);
        if (!raw) {
            const def = getDefaultMiningData();
            localStorage.setItem(MINING_KEY, JSON.stringify(def));
            return def;
        }
        const data = JSON.parse(raw);
        if (data.mining_active && data.mining_end) {
            const now = Date.now();
            const end = new Date(data.mining_end).getTime();
            if (now > end) {
                data.mining_active = false;
                data.mined_amount = 0;
                data.mining_start = null;
                data.mining_end = null;
                localStorage.setItem(MINING_KEY, JSON.stringify(data));
            }
        }
        return data;
    } catch (e) {
        return getDefaultMiningData();
    }
}

function saveMiningData(data) {
    localStorage.setItem(MINING_KEY, JSON.stringify(data));
}

function getDailyBonus(level) {
    return 0.1 * (1 + (level - 1) * 0.10);
}

function canClaimDailyBonus() {
    const data = localStorage.getItem(DAILY_BONUS_KEY);
    if (!data) return true;
    try {
        const parsed = JSON.parse(data);
        const lastClaim = new Date(parsed.lastClaim);
        const now = new Date();
        return (now - lastClaim) >= 24 * 3600 * 1000;
    } catch(e) { return true; }
}

async function claimDailyBonus() {
    if (!canClaimDailyBonus()) {
        window.showCustomModal('Ежедневный бонус', 'Вы уже получили бонус сегодня. Приходите завтра!');
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
        saveMiningData(miningData);
        localStorage.setItem(DAILY_BONUS_KEY, JSON.stringify({ lastClaim: new Date().toISOString() }));
        window.showToast(`🎁 Ежедневный бонус: +${bonus.toFixed(4)} акций!`);
        updateUI();
    }
}

function getUpgradeCost(level) {
    return Math.floor(10 * Math.pow(1.5, level - 1));
}

function getCurrentRate(level) {
    return BASE_RATE_PER_SEC * (1 + (level - 1) * UPGRADE_BONUS);
}

let miningInterval = null;
let countdownInterval = null;
let miningData = loadMiningData();

async function startMining() {
    if (miningData.mining_active) {
        window.showCustomModal('Уже майнинг', 'Подождите окончания текущей сессии');
        return;
    }
    const now = Date.now();
    const end = now + SESSION_DURATION;
    miningData.mining_active = true;
    miningData.mining_start = now;
    miningData.mining_end = end;
    miningData.mined_amount = 0;
    saveMiningData(miningData);
    window.showToast('⛏️ Майнинг запущен на 12 часов!');
    updateUI();
    startCountdown();
    startMiningProgress();
}

function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        if (!miningData.mining_active) {
            clearInterval(countdownInterval);
            return;
        }
        const now = Date.now();
        const end = miningData.mining_end;
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
        if (!miningData.mining_active) {
            clearInterval(miningInterval);
            return;
        }
        const now = Date.now();
        const end = miningData.mining_end;
        if (now >= end) {
            clearInterval(miningInterval);
            finishMining();
            return;
        }
        const rate = getCurrentRate(miningData.level);
        const elapsedSeconds = (now - miningData.mining_start) / 1000;
        let theoretical = elapsedSeconds * rate;
        const newAmount = Math.min(theoretical, MAX_PER_SESSION);
        miningData.mined_amount = newAmount;
        const minedEl = document.getElementById('minedAmount');
        if (minedEl) minedEl.textContent = miningData.mined_amount.toFixed(6);
        updateClaimButton();
    }, 1000);
}

async function finishMining() {
    if (!miningData) return;
    miningData.mining_active = false;
    miningData.mining_start = null;
    miningData.mining_end = null;
    saveMiningData(miningData);
    if (miningInterval) clearInterval(miningInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    window.showToast('⏰ Сессия майнинга завершена! Заберите накопленные акции.');
    updateUI();
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
        miningData.claimed_total += amount;
    }
    miningData.mined_amount = 0;
    saveMiningData(miningData);
    window.showToast(`✅ Забрано ${amount.toFixed(4)} акций!`);
    updateUI();
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
    await window.supabase
        .from('users')
        .update({ shares: window.supabase.raw(`shares - ${costCents}`) })
        .eq('id', window.userId);
    window.currentUser.shares -= costCents;
    miningData.level += 1;
    saveMiningData(miningData);
    window.showToast(`⬆️ Уровень повышен до ${miningData.level}! Скорость майнинга +10%`);
    updateUI();
}

function updateClaimButton() {
    const claimBtn = document.getElementById('claimBtn');
    if (!claimBtn) return;
    const amount = miningData.mined_amount;
    if (amount >= CLAIM_THRESHOLD && miningData.mining_active) {
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
        const bonus = getDailyBonus(miningData.level);
        dailyBtn.disabled = !canClaim;
        dailyBtn.textContent = canClaim ? `🎁 Забрать бонус (${bonus.toFixed(4)} акций)` : '🎁 Бонус уже получен (ждите завтра)';
        dailyBtn.style.opacity = canClaim ? '1' : '0.5';
    }

    if (miningData.mining_active && miningData.mining_end) {
        const now = Date.now();
        const end = miningData.mining_end;
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

    const rateInfo = document.getElementById('rateInfo');
    if (rateInfo) {
        const currentRate = getCurrentRate(miningData.level);
        const nextRate = miningData.level < UPGRADE_MAX ? getCurrentRate(miningData.level + 1) : currentRate;
        const dailyBonus = getDailyBonus(miningData.level);
        rateInfo.innerHTML = `
            <div class="rate-row"><span>⚡ Скорость майнинга</span><span>${(currentRate * 3600).toFixed(4)} акций/час</span></div>
            ${miningData.level < UPGRADE_MAX ? `<div class="rate-row"><span>📈 После улучшения</span><span>${(nextRate * 3600).toFixed(4)} акций/час (+${(UPGRADE_BONUS*100).toFixed(0)}%)</span></div>` : ''}
            <div class="rate-row"><span>🎁 Ежедневный бонус</span><span>${dailyBonus.toFixed(4)} акций</span></div>
        `;
    }
}

window.renderMiningTab = async function() {
    if (miningInterval) clearInterval(miningInterval);
    if (countdownInterval) clearInterval(countdownInterval);

    miningData = loadMiningData();
    const dailyBonus = getDailyBonus(miningData.level);
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
                <div class="timer-label">⏳ Осталось</div>
                <div class="timer-value" id="miningTimer">--:--:--</div>
            </div>
            <button id="dailyBonusBtn" class="mining-btn daily" ${!canClaim ? 'disabled' : ''}>🎁 Забрать бонус (${dailyBonus.toFixed(4)} акций)</button>
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
};

document.addEventListener('visibilitychange', () => {
    const activeTab = document.querySelector('.tab.active');
    if (activeTab && activeTab.dataset.tab === 'mining') {
        if (!document.hidden) {
            miningData = loadMiningData();
            if (miningData.mining_active) {
                startCountdown();
                startMiningProgress();
            }
        } else {
            if (miningInterval) clearInterval(miningInterval);
            if (countdownInterval) clearInterval(countdownInterval);
        }
    }
});
