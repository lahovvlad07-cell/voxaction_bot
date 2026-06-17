// mining.js – майнинг без Supabase (всё в localStorage)

const MINING_KEY = 'mining_data_v1';

function getDefaultMiningData() {
    return {
        mining_active: false,
        mining_start: null,
        mining_end: null,
        mined_amount: 0,
        total_mined: 0,
        level: 1
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
        // Если активная сессия истекла – завершаем
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
        console.error('Ошибка загрузки майнинга', e);
        return getDefaultMiningData();
    }
}

function saveMiningData(data) {
    localStorage.setItem(MINING_KEY, JSON.stringify(data));
}

let miningInterval = null;
let countdownInterval = null;
let miningData = loadMiningData();

// ===== НАЧАТЬ МАЙНИНГ =====
async function startMining() {
    if (miningData.mining_active) {
        window.showCustomModal('Уже майнинг', 'Подождите окончания текущей сессии');
        return;
    }
    const now = Date.now();
    const end = now + 12 * 3600 * 1000;
    miningData.mining_active = true;
    miningData.mining_start = now;
    miningData.mining_end = end;
    miningData.mined_amount = 0;
    saveMiningData(miningData);
    window.showToast('⛏️ Майнинг запущен!');
    updateUI();
    startCountdown();
    startMiningProgress();
}

// ===== ТАЙМЕР =====
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

// ===== ПРОГРЕСС МАЙНИНГА =====
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
        const baseRate = 0.0002;
        const rate = baseRate * (1 + (miningData.level - 1) * 0.05);
        const elapsedSeconds = (now - miningData.mining_start) / 1000;
        const theoretical = elapsedSeconds * rate;
        const maxPerSession = 0.2;
        const newAmount = Math.min(theoretical, maxPerSession);
        miningData.mined_amount = newAmount;
        const minedEl = document.getElementById('minedAmount');
        if (minedEl) minedEl.textContent = miningData.mined_amount.toFixed(4);
    }, 1000);
}

// ===== ЗАВЕРШЕНИЕ МАЙНИНГА =====
async function finishMining() {
    const sharesCents = Math.round(miningData.mined_amount * 100);
    if (sharesCents > 0) {
        // Начисляем акции пользователю
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
        miningData.total_mined += miningData.mined_amount;
    }
    miningData.mining_active = false;
    miningData.mined_amount = 0;
    miningData.mining_start = null;
    miningData.mining_end = null;
    saveMiningData(miningData);
    if (miningInterval) clearInterval(miningInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    window.showToast(`✅ Намайнено ${(sharesCents/100).toFixed(2)} акций!`);
    updateUI();
}

// ===== УЛУЧШЕНИЕ УРОВНЯ =====
async function upgradeLevel() {
    const cost = 10 + (miningData.level - 1) * 3;
    const userSharesCents = window.currentUser.shares;
    if (userSharesCents < cost * 100) {
        window.showCustomModal('Ошибка', `Недостаточно акций! Нужно ${cost} акций`);
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
    window.showToast(`⬆️ Уровень повышен до ${miningData.level}!`);
    updateUI();
}

// ===== ОБНОВЛЕНИЕ UI =====
function updateUI() {
    const levelEl = document.getElementById('miningLevel');
    const totalEl = document.getElementById('totalMined');
    const minedEl = document.getElementById('minedAmount');
    const timerEl = document.getElementById('miningTimer');
    const startBtn = document.getElementById('startMiningBtn');
    const upgradeBtn = document.getElementById('upgradeLevelBtn');

    if (levelEl) levelEl.textContent = miningData.level;
    if (totalEl) totalEl.textContent = miningData.total_mined.toFixed(4);
    if (minedEl) minedEl.textContent = miningData.mined_amount.toFixed(4);

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
        const cost = 10 + (miningData.level - 1) * 3;
        upgradeBtn.textContent = `⬆️ Улучшить уровень (${cost} акций)`;
        const userSharesCents = window.currentUser.shares;
        upgradeBtn.disabled = (userSharesCents / 100) < cost;
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
}

// ===== ГЛАВНЫЙ РЕНДЕР =====
window.renderMiningTab = async function() {
    if (miningInterval) clearInterval(miningInterval);
    if (countdownInterval) clearInterval(countdownInterval);

    miningData = loadMiningData(); // перезагружаем из localStorage

    const html = `
        <div class="mining-container">
            <div class="mining-header">
                <h2>⛏️ Майнинг акций</h2>
                <p>Запустите майнинг на 12 часов – получайте акции в реальном времени!</p>
            </div>
            
            <div class="mining-stats">
                <div class="mining-stat">
                    <div class="mining-stat-value" id="miningLevel">${miningData.level}</div>
                    <div class="mining-stat-label">Уровень</div>
                </div>
                <div class="mining-stat">
                    <div class="mining-stat-value" id="totalMined">${miningData.total_mined.toFixed(4)}</div>
                    <div class="mining-stat-label">Всего намайнено</div>
                </div>
                <div class="mining-stat">
                    <div class="mining-stat-value" id="minedAmount">${miningData.mined_amount.toFixed(4)}</div>
                    <div class="mining-stat-label">В этой сессии</div>
                </div>
            </div>
            
            <div class="mining-timer">
                <div class="timer-label">⏳ Осталось до завершения</div>
                <div class="timer-value" id="miningTimer">--:--:--</div>
            </div>
            
            <button id="startMiningBtn" class="mining-btn primary">🚀 Начать майнинг (12ч)</button>
            <button id="upgradeLevelBtn" class="mining-btn secondary">⬆️ Улучшить уровень (${10 + (miningData.level - 1) * 3} акций)</button>
            
            <div class="mining-info">
                <div class="info-row">
                    <span>📈 Скорость майнинга</span>
                    <span>${(0.0002 * (1 + (miningData.level - 1) * 0.05)).toFixed(6)} акций/сек</span>
                </div>
                <div class="info-row">
                    <span>⚡ Максимум за сессию</span>
                    <span>0.2 акций</span>
                </div>
                <div class="info-row">
                    <span>🔄 Длительность сессии</span>
                    <span>12 часов</span>
                </div>
                <div class="info-row">
                    <span>🏆 Бонус уровня</span>
                    <span>+${((miningData.level - 1) * 5).toFixed(0)}% скорости</span>
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    document.getElementById('startMiningBtn').addEventListener('click', startMining);
    document.getElementById('upgradeLevelBtn').addEventListener('click', upgradeLevel);

    updateUI();
    if (miningData.mining_active) {
        startCountdown();
        startMiningProgress();
    }
};

// Остановка интервалов при уходе
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
