// mining.js – майнинг с правильной скоростью, кнопкой "Забрать", улучшениями и визуализацией

const MINING_KEY = 'mining_data_v2';

const BASE_RATE = 0.2 / (12 * 3600); // 0.00000463 акций/сек (0.2 за 12 часов)
const MAX_PER_SESSION = 0.2;
const CLAIM_THRESHOLD = 0.1;

// Уровни улучшений: каждый уровень увеличивает скорость на 10%, цену в акциях и лимит
const UPGRADE_COST_BASE = 2; // начальная цена в акциях
const UPGRADE_COST_MULTIPLIER = 1.5; // множитель цены за уровень

function getDefaultMiningData() {
    return {
        mining_active: false,
        mining_start: null,
        mining_end: null,
        mined_amount: 0,       // накоплено за текущую сессию
        total_mined: 0,        // всего намайнено за всё время
        level: 1,              // уровень ускорения (влияет на скорость)
        limit_level: 1,        // уровень лимита (влияет на maxPerSession)
        claimed_this_session: 0, // сколько уже забрали в этой сессии (чтобы не превысить лимит)
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
        // Проверяем активную сессию
        if (data.mining_active && data.mining_end) {
            const now = Date.now();
            if (now > data.mining_end) {
                // Сессия истекла – завершаем
                data.mining_active = false;
                data.mined_amount = 0;
                data.mining_start = null;
                data.mining_end = null;
                data.claimed_this_session = 0;
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

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ РАСЧЁТОВ =====
function getCurrentSpeed(data) {
    // Базовая скорость * (1 + (level-1)*0.1)
    const speedMultiplier = 1 + (data.level - 1) * 0.1;
    return BASE_RATE * speedMultiplier;
}

function getCurrentMaxPerSession(data) {
    // Базовый лимит * (1 + (limit_level-1)*0.25)
    const limitMultiplier = 1 + (data.limit_level - 1) * 0.25;
    return MAX_PER_SESSION * limitMultiplier;
}

function getUpgradeCost(level) {
    // Стоимость улучшения уровня (для speed или limit)
    return Math.round(UPGRADE_COST_BASE * Math.pow(UPGRADE_COST_MULTIPLIER, level - 1) * 100) / 100;
}

function getNextLevelSpeed(level) {
    return BASE_RATE * (1 + level * 0.1);
}

function getNextLevelLimit(limitLevel) {
    return MAX_PER_SESSION * (1 + limitLevel * 0.25);
}

// ===== НАЧАТЬ МАЙНИНГ =====
async function startMining() {
    if (miningData.mining_active) {
        window.showCustomModal('Уже майнинг', 'Подождите окончания текущей сессии');
        return;
    }
    // Сбрасываем накопленное и счётчик забора
    miningData.mined_amount = 0;
    miningData.claimed_this_session = 0;
    const now = Date.now();
    const end = now + 12 * 3600 * 1000;
    miningData.mining_active = true;
    miningData.mining_start = now;
    miningData.mining_end = end;
    saveMiningData(miningData);
    window.showToast('⛏️ Майнинг запущен!');
    updateUI();
    startCountdown();
    startMiningProgress();
}

// ===== ЗАБРАТЬ НАМАЙНЕННОЕ =====
async function claimMined() {
    if (!miningData.mining_active) {
        window.showCustomModal('Ошибка', 'Майнинг не активен');
        return;
    }
    const currentMax = getCurrentMaxPerSession(miningData);
    // Сколько можно забрать сейчас
    const available = miningData.mined_amount;
    if (available < CLAIM_THRESHOLD) {
        window.showCustomModal('Ошибка', `Нужно намайнить минимум ${CLAIM_THRESHOLD.toFixed(4)} акций, чтобы забрать`);
        return;
    }
    // Проверяем, не превысили ли лимит за сессию (учитываем уже забранное)
    const alreadyClaimed = miningData.claimed_this_session || 0;
    const canClaim = Math.min(available, currentMax - alreadyClaimed);
    if (canClaim <= 0) {
        window.showCustomModal('Ошибка', 'Вы достигли лимита за сессию');
        return;
    }
    // Начисляем акции
    const sharesCents = Math.round(canClaim * 100);
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
        miningData.total_mined += canClaim;
        miningData.claimed_this_session = (miningData.claimed_this_session || 0) + canClaim;
        // Уменьшаем накопленное (забираем)
        miningData.mined_amount -= canClaim;
        saveMiningData(miningData);
        window.showToast(`✅ Забрано ${canClaim.toFixed(4)} акций!`);
        updateUI();
        if (window.refreshActiveTab) window.refreshActiveTab();
    }
}

// ===== УЛУЧШЕНИЕ СКОРОСТИ =====
async function upgradeSpeed() {
    const cost = getUpgradeCost(miningData.level);
    const userSharesCents = window.currentUser.shares;
    if (userSharesCents < cost * 100) {
        window.showCustomModal('Ошибка', `Недостаточно акций! Нужно ${cost.toFixed(2)} акций`);
        return;
    }
    const costCents = Math.round(cost * 100);
    await window.supabase
        .from('users')
        .update({ shares: window.supabase.raw(`shares - ${costCents}`) })
        .eq('id', window.userId);
    window.currentUser.shares -= costCents;
    miningData.level += 1;
    saveMiningData(miningData);
    window.showToast(`⬆️ Скорость повышена до ${miningData.level} уровня!`);
    updateUI();
}

// ===== УЛУЧШЕНИЕ ЛИМИТА =====
async function upgradeLimit() {
    const cost = getUpgradeCost(miningData.limit_level);
    const userSharesCents = window.currentUser.shares;
    if (userSharesCents < cost * 100) {
        window.showCustomModal('Ошибка', `Недостаточно акций! Нужно ${cost.toFixed(2)} акций`);
        return;
    }
    const costCents = Math.round(cost * 100);
    await window.supabase
        .from('users')
        .update({ shares: window.supabase.raw(`shares - ${costCents}`) })
        .eq('id', window.userId);
    window.currentUser.shares -= costCents;
    miningData.limit_level += 1;
    saveMiningData(miningData);
    window.showToast(`⬆️ Лимит повышен до ${miningData.limit_level} уровня!`);
    updateUI();
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
            // Не завершаем автоматически, даём пользователю возможность забрать остаток
            // Но можно показать, что сессия завершена
            updateUI();
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
        const start = miningData.mining_start;
        if (now >= end) {
            // Сессия завершена, но не останавливаем майнинг, просто перестаём начислять
            // Можно остановить, но оставить возможность забрать
            updateUI();
            return;
        }
        // Рассчитываем накопленное с начала сессии до текущего момента
        const elapsedSeconds = (now - start) / 1000;
        const speed = getCurrentSpeed(miningData);
        const theoretical = elapsedSeconds * speed;
        const maxPerSession = getCurrentMaxPerSession(miningData);
        const newAmount = Math.min(theoretical, maxPerSession);
        // Обновляем mined_amount (но не уменьшаем, если уже забрали часть)
        // Так как мы храним mined_amount как текущее невыведенное, а claimed_this_session уже выведено,
        // то totalEarned = elapsedSeconds * speed, но мы можем вывести только maxPerSession.
        // Однако мы уже вывели часть (claimed_this_session), значит доступно для вывода = totalEarned - claimed_this_session
        const totalEarned = Math.min(elapsedSeconds * speed, maxPerSession);
        const available = Math.max(0, totalEarned - (miningData.claimed_this_session || 0));
        miningData.mined_amount = available;
        // Обновляем UI
        const minedEl = document.getElementById('minedAmount');
        if (minedEl) minedEl.textContent = miningData.mined_amount.toFixed(4);
        // Кнопка забрать
        const claimBtn = document.getElementById('claimMinedBtn');
        if (claimBtn) {
            if (miningData.mined_amount >= CLAIM_THRESHOLD) {
                claimBtn.disabled = false;
                claimBtn.style.opacity = '1';
            } else {
                claimBtn.disabled = true;
                claimBtn.style.opacity = '0.5';
            }
        }
        // Обновляем информацию о следующем улучшении
        updateUpgradeInfo();
    }, 1000);
}

// ===== ИНФОРМАЦИЯ О СЛЕДУЮЩЕМ УЛУЧШЕНИИ =====
function updateUpgradeInfo() {
    // Информация о следующем улучшении скорости
    const speedLevel = miningData.level;
    const nextSpeedLevel = speedLevel + 1;
    const currentSpeed = getCurrentSpeed(miningData);
    const nextSpeed = getNextLevelSpeed(speedLevel);
    const speedCost = getUpgradeCost(nextSpeedLevel);
    const speedEl = document.getElementById('speedUpgradeInfo');
    if (speedEl) {
        speedEl.innerHTML = `
            <div class="upgrade-info-item">
                <span class="upgrade-label">Скорость</span>
                <span class="upgrade-current">${(currentSpeed * 3600 * 12).toFixed(4)} за сессию</span>
                <span class="upgrade-arrow">→</span>
                <span class="upgrade-next">${(nextSpeed * 3600 * 12).toFixed(4)}</span>
                <span class="upgrade-cost">💰 ${speedCost.toFixed(2)} акций</span>
            </div>
        `;
    }
    // Информация о следующем улучшении лимита
    const limitLevel = miningData.limit_level;
    const nextLimitLevel = limitLevel + 1;
    const currentLimit = getCurrentMaxPerSession(miningData);
    const nextLimit = getNextLevelLimit(limitLevel);
    const limitCost = getUpgradeCost(nextLimitLevel);
    const limitEl = document.getElementById('limitUpgradeInfo');
    if (limitEl) {
        limitEl.innerHTML = `
            <div class="upgrade-info-item">
                <span class="upgrade-label">Лимит сессии</span>
                <span class="upgrade-current">${currentLimit.toFixed(4)}</span>
                <span class="upgrade-arrow">→</span>
                <span class="upgrade-next">${nextLimit.toFixed(4)}</span>
                <span class="upgrade-cost">💰 ${limitCost.toFixed(2)} акций</span>
            </div>
        `;
    }
}

// ===== ОБНОВЛЕНИЕ UI =====
function updateUI() {
    const levelEl = document.getElementById('miningLevel');
    const totalEl = document.getElementById('totalMined');
    const minedEl = document.getElementById('minedAmount');
    const timerEl = document.getElementById('miningTimer');
    const startBtn = document.getElementById('startMiningBtn');
    const claimBtn = document.getElementById('claimMinedBtn');
    const speedUpgradeBtn = document.getElementById('upgradeSpeedBtn');
    const limitUpgradeBtn = document.getElementById('upgradeLimitBtn');

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

    if (claimBtn) {
        if (miningData.mining_active && miningData.mined_amount >= CLAIM_THRESHOLD) {
            claimBtn.disabled = false;
            claimBtn.style.opacity = '1';
            claimBtn.textContent = `🎁 Забрать (${miningData.mined_amount.toFixed(4)})`;
        } else {
            claimBtn.disabled = true;
            claimBtn.style.opacity = '0.5';
            claimBtn.textContent = `🎁 Забрать (${CLAIM_THRESHOLD.toFixed(4)} мин)`;
        }
    }

    // Кнопки улучшений
    if (speedUpgradeBtn) {
        const cost = getUpgradeCost(miningData.level + 1);
        const userSharesCents = window.currentUser.shares;
        speedUpgradeBtn.disabled = (userSharesCents / 100) < cost;
        speedUpgradeBtn.textContent = `⚡ Улучшить скорость (${cost.toFixed(2)} акций)`;
    }
    if (limitUpgradeBtn) {
        const cost = getUpgradeCost(miningData.limit_level + 1);
        const userSharesCents = window.currentUser.shares;
        limitUpgradeBtn.disabled = (userSharesCents / 100) < cost;
        limitUpgradeBtn.textContent = `📈 Улучшить лимит (${cost.toFixed(2)} акций)`;
    }

    // Таймер
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

    // Информация об улучшениях
    updateUpgradeInfo();
}

// ===== ГЛАВНЫЙ РЕНДЕР =====
window.renderMiningTab = async function() {
    if (miningInterval) clearInterval(miningInterval);
    if (countdownInterval) clearInterval(countdownInterval);

    miningData = loadMiningData();

    const speed = getCurrentSpeed(miningData);
    const maxPerSession = getCurrentMaxPerSession(miningData);

    const html = `
        <div class="mining-container">
            <div class="mining-header">
                <h2>⛏️ Майнинг акций</h2>
                <p>Запустите майнинг на 12 часов – получайте акции в реальном времени!</p>
            </div>
            
            <div class="mining-stats">
                <div class="mining-stat">
                    <div class="mining-stat-value" id="miningLevel">${miningData.level}</div>
                    <div class="mining-stat-label">Уровень скорости</div>
                </div>
                <div class="mining-stat">
                    <div class="mining-stat-value" id="totalMined">${miningData.total_mined.toFixed(4)}</div>
                    <div class="mining-stat-label">Всего намайнено</div>
                </div>
                <div class="mining-stat">
                    <div class="mining-stat-value" id="minedAmount">${miningData.mined_amount.toFixed(4)}</div>
                    <div class="mining-stat-label">Доступно к забору</div>
                </div>
            </div>
            
            <div class="mining-timer">
                <div class="timer-label">⏳ Осталось до завершения</div>
                <div class="timer-value" id="miningTimer">--:--:--</div>
            </div>
            
            <button id="startMiningBtn" class="mining-btn primary">🚀 Начать майнинг (12ч)</button>
            <button id="claimMinedBtn" class="mining-btn claim" disabled>🎁 Забрать (${CLAIM_THRESHOLD.toFixed(4)} мин)</button>
            
            <div class="mining-upgrades">
                <div class="upgrade-section">
                    <div class="upgrade-title">⚡ Скорость майнинга</div>
                    <div id="speedUpgradeInfo" class="upgrade-info"></div>
                    <button id="upgradeSpeedBtn" class="mining-btn secondary">⚡ Улучшить скорость (${getUpgradeCost(miningData.level + 1).toFixed(2)} акций)</button>
                </div>
                <div class="upgrade-section">
                    <div class="upgrade-title">📈 Лимит за сессию</div>
                    <div id="limitUpgradeInfo" class="upgrade-info"></div>
                    <button id="upgradeLimitBtn" class="mining-btn secondary">📈 Улучшить лимит (${getUpgradeCost(miningData.limit_level + 1).toFixed(2)} акций)</button>
                </div>
            </div>
            
            <div class="mining-info">
                <div class="info-row">
                    <span>📈 Текущая скорость</span>
                    <span>${(speed * 3600).toFixed(6)} акций/час (${(speed * 3600 * 12).toFixed(4)} за сессию)</span>
                </div>
                <div class="info-row">
                    <span>⚡ Лимит сессии</span>
                    <span>${maxPerSession.toFixed(4)} акций</span>
                </div>
                <div class="info-row">
                    <span>🔄 Длительность сессии</span>
                    <span>12 часов</span>
                </div>
                <div class="info-row">
                    <span>🎯 Минимум для забора</span>
                    <span>${CLAIM_THRESHOLD.toFixed(4)} акций</span>
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    document.getElementById('startMiningBtn').addEventListener('click', startMining);
    document.getElementById('claimMinedBtn').addEventListener('click', claimMined);
    document.getElementById('upgradeSpeedBtn').addEventListener('click', upgradeSpeed);
    document.getElementById('upgradeLimitBtn').addEventListener('click', upgradeLimit);

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
