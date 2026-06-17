// mining.js – вкладка с тапалкой (заработок монет)

// ===== КОНСТАНТЫ =====
const MAX_ENERGY = 100;
const ENERGY_REGEN_INTERVAL = 5000; // 5 секунд на 1 энергию
const BASE_REWARD = 0.01; // монет за тап (0.01 = 1 цент звезды)
const CONVERSION_RATE = 100; // 100 монет = 1 Star

// ===== ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ =====
let miningData = null;
let energyInterval = null;
let passiveInterval = null;
let isTabActive = true;

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
                    coins: 0,
                    energy: MAX_ENERGY,
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
        }
        
        // Обновляем энергию (восстановление за время отсутствия)
        if (miningData) {
            await syncEnergy();
        }
        
        return miningData;
    } catch(e) {
        console.error('Ошибка загрузки майнинга', e);
        return null;
    }
}

// ===== СИНХРОНИЗАЦИЯ ЭНЕРГИИ =====
async function syncEnergy() {
    if (!miningData) return;
    const now = new Date();
    const lastUpdate = new Date(miningData.last_update);
    const diffMs = now - lastUpdate;
    const regenUnits = Math.floor(diffMs / ENERGY_REGEN_INTERVAL);
    if (regenUnits > 0) {
        const newEnergy = Math.min(MAX_ENERGY + (miningData.level * 10), miningData.energy + regenUnits);
        miningData.energy = Math.min(MAX_ENERGY + (miningData.level * 10), newEnergy);
        miningData.last_update = now.toISOString();
        await saveMiningData();
    }
    updateUI();
}

// ===== СОХРАНЕНИЕ =====
async function saveMiningData() {
    if (!miningData) return;
    const { error } = await window.supabase
        .from('mining')
        .update({
            coins: miningData.coins,
            energy: miningData.energy,
            level: miningData.level,
            last_update: miningData.last_update
        })
        .eq('user_id', window.userId);
    if (error) console.error('Ошибка сохранения майнинга', error);
}

// ===== ТАП =====
async function handleTap() {
    if (!miningData) return;
    const maxEnergy = MAX_ENERGY + (miningData.level * 10);
    if (miningData.energy < 1) {
        window.showToast('⛔ Недостаточно энергии! Подождите.');
        return;
    }
    
    // Тратим энергию
    miningData.energy -= 1;
    // Начисляем монеты (база + бонус за уровень)
    const reward = BASE_REWARD + (miningData.level * 0.005);
    miningData.coins += reward;
    miningData.last_update = new Date().toISOString();
    
    // Анимация тапа
    const tapBtn = document.getElementById('tapButton');
    if (tapBtn) {
        tapBtn.style.transform = 'scale(0.92)';
        setTimeout(() => tapBtn.style.transform = 'scale(1)', 100);
    }
    
    // Показываем всплывающую монетку
    showFloatingCoin(reward);
    
    // Сохраняем (не каждую секунду, а раз в 3 секунды)
    if (Math.random() < 0.3) {
        await saveMiningData();
    }
    updateUI();
}

// ===== ВСПЛЫВАЮЩАЯ МОНЕТКА =====
function showFloatingCoin(amount) {
    const el = document.createElement('div');
    el.className = 'floating-coin';
    el.textContent = `+${amount.toFixed(2)}`;
    const container = document.getElementById('tapButton');
    if (!container) return;
    const rect = container.getBoundingClientRect();
    el.style.left = (rect.left + rect.width/2 - 20) + 'px';
    el.style.top = (rect.top - 20) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

// ===== КОНВЕРТАЦИЯ МОНЕТ В STARS =====
async function convertCoinsToStars(amount) {
    if (!miningData || miningData.coins < amount) {
        window.showCustomModal('Ошибка', 'Недостаточно монет');
        return;
    }
    const stars = amount / CONVERSION_RATE;
    if (stars < 0.01) {
        window.showCustomModal('Ошибка', 'Минимум 1 монета = 0.01 ⭐');
        return;
    }
    // Подтверждение
    const confirmHtml = `
        <div class="modal" id="confirmModal" style="display:flex;">
            <div class="modal-content confirm-modal">
                <span class="close-modal" id="closeConfirmModal">&times;</span>
                <h3>✅ Конвертация</h3>
                <div class="confirm-body">
                    <div class="confirm-row">
                        <span>💰 Монет</span>
                        <strong>${amount.toFixed(2)}</strong>
                    </div>
                    <div class="confirm-row highlight">
                        <span>⭐ Получите</span>
                        <strong>${stars.toFixed(2)} ⭐</strong>
                    </div>
                </div>
                <div class="modal-buttons">
                    <button id="confirmCancelBtn" class="secondary">Отмена</button>
                    <button id="confirmOkBtn">Подтвердить</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', confirmHtml);
    const modal = document.getElementById('confirmModal');
    const closeConfirm = () => modal.remove();
    document.getElementById('closeConfirmModal').onclick = closeConfirm;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeConfirm(); });
    document.getElementById('confirmCancelBtn').onclick = closeConfirm;
    
    document.getElementById('confirmOkBtn').onclick = async () => {
        closeConfirm();
        // Списываем монеты, добавляем Stars
        miningData.coins -= amount;
        await saveMiningData();
        // Добавляем Stars в основную таблицу
        const starsCents = Math.round(stars * 100);
        const { error } = await window.supabase
            .from('users')
            .update({ stars_balance: window.supabase.raw(`stars_balance + ${starsCents}`) })
            .eq('id', window.userId);
        if (error) {
            console.error('Ошибка добавления Stars', error);
            window.showCustomModal('Ошибка', 'Не удалось зачислить Stars');
            return;
        }
        window.currentUser.stars_balance += starsCents;
        window.showToast(`✅ Конвертировано ${stars.toFixed(2)} ⭐`);
        updateUI();
        if (window.refreshActiveTab) window.refreshActiveTab();
    };
}

// ===== УЛУЧШЕНИЕ УРОВНЯ =====
async function upgradeLevel() {
    const cost = (miningData.level + 1) * 5; // стоимость в монетах
    if (miningData.coins < cost) {
        window.showCustomModal('Ошибка', `Недостаточно монет! Нужно ${cost.toFixed(2)}`);
        return;
    }
    miningData.coins -= cost;
    miningData.level += 1;
    // Восстанавливаем энергию на 20% от максимума при повышении уровня
    const maxEnergy = MAX_ENERGY + (miningData.level * 10);
    miningData.energy = Math.min(maxEnergy, miningData.energy + maxEnergy * 0.2);
    await saveMiningData();
    window.showToast(`⬆️ Уровень повышен до ${miningData.level}!`);
    updateUI();
}

// ===== ОБНОВЛЕНИЕ UI =====
function updateUI() {
    if (!miningData) return;
    document.getElementById('miningCoins').textContent = miningData.coins.toFixed(2);
    document.getElementById('miningLevel').textContent = miningData.level;
    const maxEnergy = MAX_ENERGY + (miningData.level * 10);
    document.getElementById('miningEnergy').textContent = Math.floor(miningData.energy);
    document.getElementById('miningMaxEnergy').textContent = maxEnergy;
    const energyPercent = (miningData.energy / maxEnergy) * 100;
    document.getElementById('energyFill').style.width = Math.min(100, energyPercent) + '%';
    document.getElementById('miningReward').textContent = (BASE_REWARD + (miningData.level * 0.005)).toFixed(3);
    // Кнопка улучшения
    const upgradeBtn = document.getElementById('upgradeLevelBtn');
    if (upgradeBtn) {
        const cost = (miningData.level + 1) * 5;
        upgradeBtn.textContent = `⬆️ Улучшить (${cost.toFixed(2)} монет)`;
        upgradeBtn.disabled = miningData.coins < cost;
    }
    // Доход за уровень
    const passiveIncome = (miningData.level * 0.05);
    document.getElementById('passiveIncome').textContent = passiveIncome.toFixed(2);
}

// ===== ПАССИВНЫЙ ДОХОД =====
async function passiveIncomeTick() {
    if (!miningData || !isTabActive) return;
    const income = miningData.level * 0.05; // монет в минуту
    miningData.coins += income / 60; // каждые 10 секунд
    miningData.last_update = new Date().toISOString();
    updateUI();
    // Сохраняем раз в 30 секунд
    if (Math.random() < 0.3) {
        await saveMiningData();
    }
}

// ===== ГЛАВНЫЙ РЕНДЕР =====
window.renderMiningTab = async function() {
    // Останавливаем старые интервалы
    if (energyInterval) clearInterval(energyInterval);
    if (passiveInterval) clearInterval(passiveInterval);
    
    await loadMiningData();
    if (!miningData) {
        document.getElementById('app').innerHTML = '<div class="card error">Ошибка загрузки данных</div>';
        return;
    }
    
    const html = `
        <div class="mining-container">
            <div class="mining-header">
                <h2>⛏️ Майнинг монет</h2>
                <p>Тапайте, чтобы зарабатывать монеты! Конвертируйте их в Stars.</p>
            </div>
            
            <div class="mining-stats">
                <div class="mining-stat">
                    <div class="mining-stat-value" id="miningCoins">${miningData.coins.toFixed(2)}</div>
                    <div class="mining-stat-label">Монет</div>
                </div>
                <div class="mining-stat">
                    <div class="mining-stat-value">${miningData.level}</div>
                    <div class="mining-stat-label">Уровень</div>
                </div>
                <div class="mining-stat">
                    <div class="mining-stat-value" id="miningReward">${(BASE_REWARD + (miningData.level * 0.005)).toFixed(3)}</div>
                    <div class="mining-stat-label">За тап</div>
                </div>
            </div>
            
            <div class="energy-bar-container">
                <div class="energy-label">
                    <span>⚡ Энергия</span>
                    <span id="miningEnergy">${Math.floor(miningData.energy)}</span>
                    <span>/</span>
                    <span id="miningMaxEnergy">${MAX_ENERGY + (miningData.level * 10)}</span>
                </div>
                <div class="energy-bar">
                    <div class="energy-fill" id="energyFill" style="width: ${(miningData.energy / (MAX_ENERGY + (miningData.level * 10))) * 100}%;"></div>
                </div>
            </div>
            
            <button id="tapButton" class="tap-button">🪙</button>
            
            <div class="mining-actions">
                <button id="convertBtn" class="mining-btn primary">💰 Конвертировать монеты в Stars</button>
                <button id="upgradeLevelBtn" class="mining-btn secondary">⬆️ Улучшить (${(miningData.level + 1) * 5} монет)</button>
            </div>
            
            <div class="mining-info">
                <div class="info-row">
                    <span>📊 Пассивный доход/мин</span>
                    <span id="passiveIncome">${(miningData.level * 0.05).toFixed(2)} монет</span>
                </div>
                <div class="info-row">
                    <span>💱 Курс конвертации</span>
                    <span>${CONVERSION_RATE} монет = 1 ⭐</span>
                </div>
                <div class="info-row">
                    <span>⚡ Восстановление</span>
                    <span>1 энергия / 5 сек</span>
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    
    // Обработчики
    document.getElementById('tapButton').addEventListener('click', handleTap);
    document.getElementById('convertBtn').addEventListener('click', () => {
        const amount = prompt('Сколько монет конвертировать?', '10');
        if (!amount) return;
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            window.showCustomModal('Ошибка', 'Введите положительное число');
            return;
        }
        convertCoinsToStars(val);
    });
    document.getElementById('upgradeLevelBtn').addEventListener('click', upgradeLevel);
    
    updateUI();
    
    // Интервал восстановления энергии (каждые 5 секунд)
    energyInterval = setInterval(async () => {
        if (!isTabActive) return;
        const maxEnergy = MAX_ENERGY + (miningData.level * 10);
        if (miningData.energy < maxEnergy) {
            miningData.energy = Math.min(maxEnergy, miningData.energy + 1);
            miningData.last_update = new Date().toISOString();
            updateUI();
            // Сохраняем не каждую секунду, а раз в 30 секунд
            if (Math.random() < 0.1) {
                await saveMiningData();
            }
        }
    }, ENERGY_REGEN_INTERVAL);
    
    // Пассивный доход (каждые 10 секунд)
    passiveInterval = setInterval(() => {
        passiveIncomeTick();
    }, 10000);
};

// Остановка интервалов при уходе с вкладки
document.addEventListener('visibilitychange', () => {
    isTabActive = !document.hidden;
    if (!isTabActive && (energyInterval || passiveInterval)) {
        clearInterval(energyInterval);
        clearInterval(passiveInterval);
        energyInterval = null;
        passiveInterval = null;
    } else if (isTabActive && window.renderMiningTab) {
        // Перезапускаем, если вкладка майнинга активна
        const activeTab = document.querySelector('.tab.active');
        if (activeTab && activeTab.dataset.tab === 'mining') {
            window.renderMiningTab();
        }
    }
});
