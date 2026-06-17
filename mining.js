// mining.js – простая система майнинга (нажать – майнить 12 часов)

let miningInterval = null;
let countdownInterval = null;
let miningData = null;

// ===== ЗАГРУЗКА ДАННЫХ =====
async function loadMiningData() {
    try {
        const { data, error } = await window.supabase
            .from('mining')
            .select('*')
            .eq('user_id', window.userId)
            .single();
        
        if (error && error.code === 'PGRST116') {
            // Нет записи – создаём
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
                    last_update: new Date().toISOString()
                })
                .select()
                .single();
            if (insertError) throw insertError;
            miningData = newData;
        } else if (error) {
            throw error;
        } else {
            miningData = data;
            // Проверяем, не истекла ли активная сессия
            if (miningData.mining_active && miningData.mining_end) {
                const now = new Date();
                const end = new Date(miningData.mining_end);
                if (now > end) {
                    // Сессия истекла – завершаем
                    miningData.mining_active = false;
                    await saveMiningData();
                }
            }
        }
        return miningData;
    } catch(e) {
        console.error('Ошибка загрузки майнинга', e);
        return null;
    }
}

// ===== СОХРАНЕНИЕ =====
async function saveMiningData() {
    if (!miningData) return;
    const { error } = await window.supabase
        .from('mining')
        .update({
            mining_active: miningData.mining_active,
            mining_start: miningData.mining_start,
            mining_end: miningData.mining_end,
            mined_amount: miningData.mined_amount,
            total_mined: miningData.total_mined,
            level: miningData.level,
            last_update: new Date().toISOString()
        })
        .eq('user_id', window.userId);
    if (error) console.error('Ошибка сохранения майнинга', error);
}

// ===== НАЧАТЬ МАЙНИНГ =====
async function startMining() {
    if (!miningData) return;
    if (miningData.mining_active) {
        window.showCustomModal('Уже майнинг', 'Подождите окончания текущей сессии');
        return;
    }
    // Проверяем, не прошло ли 12 часов с последней сессии (можно разрешить сразу)
    // Начинаем сессию
    const now = new Date();
    const end = new Date(now.getTime() + 12 * 3600 * 1000); // +12 часов
    miningData.mining_active = true;
    miningData.mining_start = now.toISOString();
    miningData.mining_end = end.toISOString();
    miningData.mined_amount = 0;
    await saveMiningData();
    window.showToast('⛏️ Майнинг запущен!');
    updateUI();
    startCountdown();
}

// ===== ОСТАНОВИТЬ МАЙНИНГ (завершить сессию) =====
async function stopMining() {
    if (!miningData || !miningData.mining_active) return;
    miningData.mining_active = false;
    miningData.mined_amount = 0;
    miningData.mining_start = null;
    miningData.mining_end = null;
    await saveMiningData();
    if (miningInterval) clearInterval(miningInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    updateUI();
}

// ===== ТАЙМЕР ОБРАТНОГО ОТСЧЁТА =====
function startCountdown() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        if (!miningData || !miningData.mining_active) {
            clearInterval(countdownInterval);
            return;
        }
        const now = new Date();
        const end = new Date(miningData.mining_end);
        if (now >= end) {
            // Сессия завершена
            clearInterval(countdownInterval);
            finishMining();
            return;
        }
        const diff = end - now;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        document.getElementById('miningTimer').textContent = 
            `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }, 1000);
}

// ===== ЗАВЕРШЕНИЕ МАЙНИНГА =====
async function finishMining() {
    if (!miningData) return;
    // Начисляем намайненное (mined_amount) пользователю в акции
    const sharesCents = Math.round(miningData.mined_amount * 100);
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
        // Добавляем в total_mined
        miningData.total_mined += miningData.mined_amount;
    }
    miningData.mining_active = false;
    miningData.mined_amount = 0;
    miningData.mining_start = null;
    miningData.mining_end = null;
    await saveMiningData();
    if (miningInterval) clearInterval(miningInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    window.showToast(`✅ Намайнено ${miningData.mined_amount.toFixed(4)} акций!`);
    miningData.mined_amount = 0;
    updateUI();
}

// ===== ОБНОВЛЕНИЕ В РЕАЛЬНОМ ВРЕМЕНИ (каждую секунду) =====
function startMiningProgress() {
    if (miningInterval) clearInterval(miningInterval);
    miningInterval = setInterval(async () => {
        if (!miningData || !miningData.mining_active) {
            clearInterval(miningInterval);
            return;
        }
        const now = new Date();
        const end = new Date(miningData.mining_end);
        if (now >= end) {
            clearInterval(miningInterval);
            finishMining();
            return;
        }
        // Скорость майнинга зависит от уровня
        const baseRate = 0.0002; // базовая скорость за секунду
        const rate = baseRate * (1 + (miningData.level - 1) * 0.05); // +5% за уровень
        // Начисляем за прошедшую секунду (но не более 0.2 за сессию)
        const maxPerSession = 0.2;
        const elapsedSeconds = (now - new Date(miningData.mining_start)) / 1000;
        const theoretical = elapsedSeconds * rate;
        const maxAllowed = Math.min(theoretical, maxPerSession);
        // Но не уменьшаем уже начисленное
        const newAmount = Math.min(maxAllowed, maxPerSession);
        miningData.mined_amount = newAmount;
        // Обновляем отображение
        document.getElementById('minedAmount').textContent = miningData.mined_amount.toFixed(4);
    }, 1000);
}

// ===== УЛУЧШЕНИЕ УРОВНЯ =====
async function upgradeLevel() {
    if (!miningData) return;
    const cost = Math.floor(10 + (miningData.level - 1) * 3); // стоимость в акциях (целых)
    // Проверяем акции пользователя
    const userSharesCents = window.currentUser.shares;
    const userShares = userSharesCents / 100;
    if (userShares < cost) {
        window.showCustomModal('Ошибка', `Недостаточно акций! Нужно ${cost.toFixed(2)} акций`);
        return;
    }
    // Списываем акции
    const costCents = cost * 100;
    await window.supabase
        .from('users')
        .update({ shares: window.supabase.raw(`shares - ${costCents}`) })
        .eq('id', window.userId);
    window.currentUser.shares -= costCents;
    // Повышаем уровень
    miningData.level += 1;
    await saveMiningData();
    window.showToast(`⬆️ Уровень повышен до ${miningData.level}!`);
    updateUI();
}

// ===== ОБНОВЛЕНИЕ UI =====
function updateUI() {
    if (!miningData) return;
    document.getElementById('miningLevel').textContent = miningData.level;
    document.getElementById('totalMined').textContent = miningData.total_mined.toFixed(4);
    document.getElementById('minedAmount').textContent = miningData.mined_amount.toFixed(4);
    // Кнопка начала
    const startBtn = document.getElementById('startMiningBtn');
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
    // Кнопка улучшения
    const upgradeBtn = document.getElementById('upgradeLevelBtn');
    if (upgradeBtn) {
        const cost = 10 + (miningData.level - 1) * 3;
        upgradeBtn.textContent = `⬆️ Улучшить уровень (${cost} акций)`;
        const userSharesCents = window.currentUser.shares;
        upgradeBtn.disabled = (userSharesCents / 100) < cost;
    }
    // Таймер
    if (miningData.mining_active && miningData.mining_end) {
        const now = new Date();
        const end = new Date(miningData.mining_end);
        if (now < end) {
            const diff = end - now;
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            document.getElementById('miningTimer').textContent = 
                `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
            document.getElementById('miningTimer').textContent = '00:00:00';
        }
    } else {
        document.getElementById('miningTimer').textContent = '--:--:--';
    }
}

// ===== ГЛАВНЫЙ РЕНДЕР =====
window.renderMiningTab = async function() {
    // Останавливаем старые интервалы
    if (miningInterval) clearInterval(miningInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    
    await loadMiningData();
    if (!miningData) {
        document.getElementById('app').innerHTML = '<div class="card error">Ошибка загрузки данных</div>';
        return;
    }
    
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
    
    // Обработчики
    document.getElementById('startMiningBtn').addEventListener('click', startMining);
    document.getElementById('upgradeLevelBtn').addEventListener('click', upgradeLevel);
    
    // Запускаем обновление
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
        // Если вкладка активна, перезапускаем обновление
        if (!document.hidden && miningData) {
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
