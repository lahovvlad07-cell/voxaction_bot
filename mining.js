// mining.js – вкладка "Заработок" (пассивный майнинг с запуском раз в 12 часов)

// ===== КОНСТАНТЫ =====
const SESSION_DURATION = 12 * 3600 * 1000; // 12 часов в миллисекундах
const BASE_REWARD = 0.05; // базовое количество акций за сессию
const COOLDOWN_MS = 12 * 3600 * 1000; // 12 часов между сессиями

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let miningData = null;
let progressInterval = null;
let isTabActive = true;
let currentUser = window.currentUser;

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
                    coins: 0, // накопленные акции (виртуальные)
                    level: 1,
                    last_session_start: null,
                    session_active: false,
                    session_progress: 0 // 0-100%
                })
                .select()
                .single();
            if (insertError) throw insertError;
            miningData = newData;
        } else if (error) {
            throw error;
        } else {
            miningData = data;
        }
        
        // Проверяем активную сессию
        if (miningData.session_active && miningData.last_session_start) {
            const elapsed = Date.now() - new Date(miningData.last_session_start).getTime();
            if (elapsed >= SESSION_DURATION) {
                // Сессия завершена – начисляем награду
                await finishMiningSession();
            } else {
                // Сессия активна – обновляем прогресс
                miningData.session_progress = Math.min(100, (elapsed / SESSION_DURATION) * 100);
            }
        }
        
        return miningData;
    } catch(e) {
        console.error('Ошибка загрузки майнинга', e);
        return null;
    }
}

// ===== ЗАВЕРШЕНИЕ СЕССИИ =====
async function finishMiningSession() {
    if (!miningData) return;
    // Рассчитываем награду в акциях
    const reward = BASE_REWARD * (1 + (miningData.level - 1) * 0.1); // +10% за уровень
    const rewardCents = Math.round(reward * 100);
    
    // Добавляем акции пользователю
    const { error } = await window.supabase
        .from('users')
        .update({ shares: window.supabase.raw(`shares + ${rewardCents}`) })
        .eq('id', window.userId);
    if (error) {
        console.error('Ошибка начисления акций', error);
        return;
    }
    
    // Обновляем локального пользователя
    if (window.currentUser) {
        window.currentUser.shares += rewardCents;
    }
    
    // Сбрасываем сессию
    miningData.session_active = false;
    miningData.session_progress = 0;
    miningData.last_session_start = null;
    miningData.coins += reward; // сохраняем историю накопленных монет (для статистики)
    await saveMiningData();
    
    window.showToast(`✅ Добыто ${reward.toFixed(2)} акций!`);
    if (window.refreshActiveTab) window.refreshActiveTab();
}

// ===== СОХРАНЕНИЕ =====
async function saveMiningData() {
    if (!miningData) return;
    const { error } = await window.supabase
        .from('mining')
        .update({
            coins: miningData.coins,
            level: miningData.level,
            last_session_start: miningData.last_session_start,
            session_active: miningData.session_active,
            session_progress: miningData.session_progress
        })
        .eq('user_id', window.userId);
    if (error) console.error('Ошибка сохранения майнинга', error);
}

// ===== ЗАПУСК СЕССИИ =====
async function startMiningSession() {
    if (!miningData) return;
    
    // Проверяем, можно ли начать
    if (miningData.session_active) {
        window.showCustomModal('Уже идёт', 'Сессия майнинга уже активна!');
        return;
    }
    
    // Проверяем кд (12 часов с последнего старта)
    if (miningData.last_session_start) {
        const elapsed = Date.now() - new Date(miningData.last_session_start).getTime();
        if (elapsed < COOLDOWN_MS) {
            const remaining = COOLDOWN_MS - elapsed;
            const hours = Math.floor(remaining / (3600 * 1000));
            const minutes = Math.floor((remaining % (3600 * 1000)) / (60 * 1000));
            window.showCustomModal('Ожидание', `Следующий майнинг доступен через ${hours} ч ${minutes} мин`);
            return;
        }
    }
    
    // Запускаем сессию
    miningData.session_active = true;
    miningData.session_progress = 0;
    miningData.last_session_start = new Date().toISOString();
    await saveMiningData();
    
    window.showToast('⛏️ Майнинг начат! Возвращайтесь через 12 часов.');
    updateUI();
}

// ===== УЛУЧШЕНИЕ УРОВНЯ (за акции) =====
async function upgradeLevel() {
    const cost = miningData.level * 5; // стоимость в акциях (1 уровень = 5 акций)
    if (!window.currentUser || window.currentUser.shares < cost * 100) {
        window.showCustomModal('Ошибка', `Недостаточно акций! Нужно ${cost.toFixed(2)} акций`);
        return;
    }
    
    // Списываем акции
    const costCents = Math.round(cost * 100);
    const { error } = await window.supabase
        .from('users')
        .update({ shares: window.supabase.raw(`shares - ${costCents}`) })
        .eq('id', window.userId);
    if (error) {
        console.error('Ошибка списания акций', error);
        return;
    }
    
    // Обновляем локального пользователя
    if (window.currentUser) {
        window.currentUser.shares -= costCents;
    }
    
    miningData.level += 1;
    await saveMiningData();
    window.showToast(`⬆️ Уровень повышен до ${miningData.level}! Добыча +10%`);
    updateUI();
}

// ===== ОБНОВЛЕНИЕ UI =====
function updateUI() {
    if (!miningData) return;
    const elCoins = document.getElementById('miningCoins');
    const elLevel = document.getElementById('miningLevel');
    const elProgress = document.getElementById('miningProgress');
    const elProgressBar = document.getElementById('miningProgressBar');
    const elStatus = document.getElementById('miningStatus');
    const elStartBtn = document.getElementById('startMiningBtn');
    const elUpgradeBtn = document.getElementById('upgradeLevelBtn');
    const elReward = document.getElementById('miningReward');
    
    if (elCoins) elCoins.textContent = miningData.coins.toFixed(2);
    if (elLevel) elLevel.textContent = miningData.level;
    if (elReward) {
        const reward = BASE_REWARD * (1 + (miningData.level - 1) * 0.1);
        elReward.textContent = reward.toFixed(3);
    }
    
    // Прогресс и статус
    if (miningData.session_active) {
        if (elProgress) elProgress.textContent = `${Math.floor(miningData.session_progress)}%`;
        if (elProgressBar) elProgressBar.style.width = miningData.session_progress + '%';
        if (elStatus) {
            const elapsed = Date.now() - new Date(miningData.last_session_start).getTime();
            const remaining = SESSION_DURATION - elapsed;
            const hours = Math.floor(remaining / (3600 * 1000));
            const minutes = Math.floor((remaining % (3600 * 1000)) / (60 * 1000));
            elStatus.textContent = `⏳ Осталось: ${hours} ч ${minutes} мин`;
            elStatus.style.color = '#fbbf24';
        }
        if (elStartBtn) {
            elStartBtn.disabled = true;
            elStartBtn.textContent = '⛏️ Идёт майнинг...';
        }
        // Запускаем обновление прогресса
        if (!progressInterval) {
            progressInterval = setInterval(() => {
                if (!miningData || !miningData.session_active) return;
                const elapsed = Date.now() - new Date(miningData.last_session_start).getTime();
                if (elapsed >= SESSION_DURATION) {
                    clearInterval(progressInterval);
                    progressInterval = null;
                    finishMiningSession();
                    updateUI();
                    return;
                }
                miningData.session_progress = Math.min(100, (elapsed / SESSION_DURATION) * 100);
                updateUI();
            }, 1000);
        }
    } else {
        if (elProgress) elProgress.textContent = '0%';
        if (elProgressBar) elProgressBar.style.width = '0%';
        if (elStatus) {
            // Проверяем, когда можно начать
            if (miningData.last_session_start) {
                const elapsed = Date.now() - new Date(miningData.last_session_start).getTime();
                if (elapsed < COOLDOWN_MS) {
                    const remaining = COOLDOWN_MS - elapsed;
                    const hours = Math.floor(remaining / (3600 * 1000));
                    const minutes = Math.floor((remaining % (3600 * 1000)) / (60 * 1000));
                    elStatus.textContent = `⏳ Доступен через: ${hours} ч ${minutes} мин`;
                    elStatus.style.color = '#9ca3af';
                } else {
                    elStatus.textContent = '✅ Готов к запуску!';
                    elStatus.style.color = '#4ade80';
                }
            } else {
                elStatus.textContent = '✅ Готов к запуску!';
                elStatus.style.color = '#4ade80';
            }
        }
        if (elStartBtn) {
            elStartBtn.disabled = false;
            elStartBtn.textContent = '⛏️ Начать майнинг (12ч)';
        }
        if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
    }
    
    // Кнопка улучшения
    if (elUpgradeBtn) {
        const cost = miningData.level * 5;
        elUpgradeBtn.textContent = `⬆️ Улучшить (${cost.toFixed(2)} акций)`;
        const hasEnough = window.currentUser && window.currentUser.shares >= cost * 100;
        elUpgradeBtn.disabled = !hasEnough || miningData.session_active;
    }
}

// ===== ГЛАВНЫЙ РЕНДЕР =====
window.renderMiningTab = async function() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    
    currentUser = window.currentUser;
    await loadMiningData();
    if (!miningData) {
        document.getElementById('app').innerHTML = '<div class="card error">Ошибка загрузки данных</div>';
        return;
    }
    
    const reward = BASE_REWARD * (1 + (miningData.level - 1) * 0.1);
    const sharesDisplay = window.currentUser ? window.fromCents(window.currentUser.shares) : '0.00';
    
    const html = `
        <div class="mining-container">
            <div class="mining-header">
                <h2>⛏️ Пассивный майнинг</h2>
                <p>Запустите сессию майнинга на 12 часов и получайте акции в реальном времени!</p>
            </div>
            
            <div class="mining-stats">
                <div class="mining-stat">
                    <div class="mining-stat-value" id="miningCoins">${miningData.coins.toFixed(2)}</div>
                    <div class="mining-stat-label">Всего добыто</div>
                </div>
                <div class="mining-stat">
                    <div class="mining-stat-value">${miningData.level}</div>
                    <div class="mining-stat-label">Уровень</div>
                </div>
                <div class="mining-stat">
                    <div class="mining-stat-value" id="miningReward">${reward.toFixed(3)}</div>
                    <div class="mining-stat-label">За сессию</div>
                </div>
                <div class="mining-stat">
                    <div class="mining-stat-value">${sharesDisplay}</div>
                    <div class="mining-stat-label">Ваши акции</div>
                </div>
            </div>
            
            <div class="mining-progress-container">
                <div class="progress-header">
                    <span>Прогресс сессии</span>
                    <span id="miningProgress">0%</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" id="miningProgressBar" style="width: 0%;"></div>
                </div>
                <div class="progress-status" id="miningStatus">✅ Готов к запуску!</div>
            </div>
            
            <button id="startMiningBtn" class="mining-btn primary">⛏️ Начать майнинг (12ч)</button>
            
            <div class="mining-info">
                <div class="info-row">
                    <span>⏱️ Длительность сессии</span>
                    <span>12 часов</span>
                </div>
                <div class="info-row">
                    <span>📈 Базовая награда</span>
                    <span>${BASE_REWARD.toFixed(2)} акций</span>
                </div>
                <div class="info-row">
                    <span>⬆️ Бонус за уровень</span>
                    <span>+10% за уровень</span>
                </div>
                <div class="info-row">
                    <span>💡 Как работает</span>
                    <span>Запускаете → 12ч майнинга → получаете акции</span>
                </div>
            </div>
            
            <div class="mining-actions">
                <button id="upgradeLevelBtn" class="mining-btn secondary">⬆️ Улучшить (${(miningData.level * 5).toFixed(2)} акций)</button>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    
    // Обработчики
    document.getElementById('startMiningBtn').addEventListener('click', startMiningSession);
    document.getElementById('upgradeLevelBtn').addEventListener('click', upgradeLevel);
    
    updateUI();
};

// Остановка интервалов при уходе с вкладки
document.addEventListener('visibilitychange', () => {
    isTabActive = !document.hidden;
    if (!isTabActive && progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    } else if (isTabActive) {
        const activeTab = document.querySelector('.tab.active');
        if (activeTab && activeTab.dataset.tab === 'mining') {
            window.renderMiningTab();
        }
    }
});
