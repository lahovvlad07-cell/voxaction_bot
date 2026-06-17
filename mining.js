// mining.js – система майнинга с запуском раз в 12 часов и прокачкой за акции

const MINING_DURATION = 6 * 60 * 60 * 1000; // 6 часов
const COOLDOWN_DURATION = 12 * 60 * 60 * 1000; // 12 часов
const BASE_REWARD = 0.05; // базовое кол-во акций за сессию
const UPGRADE_COST_MULTIPLIER = 1.5; // множитель стоимости улучшения
const MAX_LEVEL = 20;

// ===== ЗАГРУЗКА ДАННЫХ МАЙНИНГА =====
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
                    mining_level: 1,
                    mining_started_at: null,
                    mining_end_at: null,
                    mining_accumulated: 0,
                    last_claim_at: null
                })
                .select()
                .single();
            if (insertError) throw insertError;
            return newData;
        } else if (error) {
            throw error;
        } else {
            return data;
        }
    } catch(e) {
        console.error('Ошибка загрузки майнинга', e);
        return null;
    }
}

// ===== СОХРАНЕНИЕ =====
async function saveMiningData(data) {
    const { error } = await window.supabase
        .from('mining')
        .update({
            mining_level: data.mining_level,
            mining_started_at: data.mining_started_at,
            mining_end_at: data.mining_end_at,
            mining_accumulated: data.mining_accumulated,
            last_claim_at: data.last_claim_at
        })
        .eq('user_id', window.userId);
    if (error) console.error('Ошибка сохранения майнинга', error);
}

// ===== ЗАПУСК МАЙНИНГА =====
async function startMining() {
    const miningData = await loadMiningData();
    if (!miningData) return;

    const now = Date.now();
    // Проверяем, можно ли запустить (прошло 12 часов с последнего запуска)
    if (miningData.mining_started_at) {
        const elapsed = now - new Date(miningData.mining_started_at).getTime();
        if (elapsed < COOLDOWN_DURATION) {
            const remaining = COOLDOWN_DURATION - elapsed;
            const hours = Math.floor(remaining / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);
            window.showCustomModal('Ошибка', `Майнинг можно запустить через ${hours}ч ${minutes}мин`);
            return;
        }
    }

    // Проверяем, не идёт ли уже майнинг
    if (miningData.mining_end_at && new Date(miningData.mining_end_at).getTime() > now) {
        window.showCustomModal('Ошибка', 'Майнинг уже идёт! Дождитесь завершения.');
        return;
    }

    // Запускаем майнинг
    const startTime = now;
    const endTime = startTime + MINING_DURATION;
    miningData.mining_started_at = new Date(startTime).toISOString();
    miningData.mining_end_at = new Date(endTime).toISOString();
    miningData.mining_accumulated = 0;

    await saveMiningData(miningData);
    window.showToast('⛏️ Майнинг запущен!');
    renderMiningTab();
}

// ===== ЗАВЕРШЕНИЕ МАЙНИНГА (вызывается в цикле) =====
async function checkMiningCompletion() {
    const miningData = await loadMiningData();
    if (!miningData) return;
    if (!miningData.mining_end_at) return;

    const now = Date.now();
    const end = new Date(miningData.mining_end_at).getTime();
    if (now >= end) {
        // Майнинг завершён, начисляем награду
        const level = miningData.mining_level;
        const reward = BASE_REWARD * (1 + (level - 1) * 0.1); // +10% за уровень
        const rewardCents = Math.round(reward * 100);
        if (rewardCents > 0) {
            // Добавляем акции пользователю
            const { error } = await window.supabase
                .from('users')
                .update({ shares: window.supabase.raw(`shares + ${rewardCents}`) })
                .eq('id', window.userId);
            if (error) {
                console.error('Ошибка начисления акций', error);
            } else {
                window.showToast(`✅ Получено ${reward.toFixed(2)} акций за майнинг!`);
                // Обновляем currentUser
                if (window.currentUser) {
                    window.currentUser.shares += rewardCents;
                }
            }
        }
        // Сбрасываем данные майнинга
        miningData.mining_started_at = null;
        miningData.mining_end_at = null;
        miningData.mining_accumulated = 0;
        miningData.last_claim_at = new Date(now).toISOString();
        await saveMiningData(miningData);
        renderMiningTab();
        if (window.refreshActiveTab) window.refreshActiveTab();
    }
}

// ===== УЛУЧШЕНИЕ УРОВНЯ =====
async function upgradeMiningLevel() {
    const miningData = await loadMiningData();
    if (!miningData) return;
    if (miningData.mining_level >= MAX_LEVEL) {
        window.showCustomModal('Ошибка', 'Максимальный уровень достигнут!');
        return;
    }
    const currentLevel = miningData.mining_level;
    const cost = Math.round(currentLevel * 0.5 * 100) / 100; // стоимость в акциях: 0.5 * уровень
    const costCents = Math.round(cost * 100);
    // Проверяем, есть ли у пользователя столько акций
    const user = window.currentUser;
    if (!user || user.shares < costCents) {
        window.showCustomModal('Ошибка', `Недостаточно акций! Нужно ${cost.toFixed(2)} акций.`);
        return;
    }
    // Списываем акции
    const { error: updateError } = await window.supabase
        .from('users')
        .update({ shares: window.supabase.raw(`shares - ${costCents}`) })
        .eq('id', window.userId);
    if (updateError) {
        console.error('Ошибка списания акций', updateError);
        window.showCustomModal('Ошибка', 'Не удалось списать акции');
        return;
    }
    // Повышаем уровень майнинга
    miningData.mining_level += 1;
    await saveMiningData(miningData);
    // Обновляем currentUser
    if (window.currentUser) {
        window.currentUser.shares -= costCents;
    }
    window.showToast(`⬆️ Уровень майнинга повышен до ${miningData.mining_level}!`);
    renderMiningTab();
}

// ===== РЕНДЕР ВКЛАДКИ =====
window.renderMiningTab = async function() {
    const miningData = await loadMiningData();
    if (!miningData) {
        document.getElementById('app').innerHTML = '<div class="card error">Ошибка загрузки данных</div>';
        return;
    }

    const user = window.currentUser;
    const now = Date.now();

    // Проверяем, завершился ли майнинг (если время вышло)
    await checkMiningCompletion();
    // Перезагружаем данные после проверки, так как они могли измениться
    const freshData = await loadMiningData();
    if (freshData) {
        Object.assign(miningData, freshData);
    }

    // Вычисляем статус майнинга
    let miningStatus = 'Готов к запуску';
    let canStart = true;
    let timeRemaining = 0;
    let progressPercent = 0;
    let reward = 0;

    const level = miningData.mining_level;
    const baseReward = BASE_REWARD * (1 + (level - 1) * 0.1);

    if (miningData.mining_end_at) {
        const end = new Date(miningData.mining_end_at).getTime();
        if (now < end) {
            // Майнинг идёт
            miningStatus = '⛏️ Идёт майнинг...';
            canStart = false;
            timeRemaining = end - now;
            const totalDuration = MINING_DURATION;
            const elapsed = totalDuration - timeRemaining;
            progressPercent = (elapsed / totalDuration) * 100;
            // Награда накапливается пропорционально
            const rewardSoFar = baseReward * (elapsed / totalDuration);
            reward = Math.min(rewardSoFar, baseReward);
        } else {
            // Майнинг завершён, но ещё не начислена награда (закроется при следующей проверке)
            // Принудительно завершим
            await checkMiningCompletion();
            // Перезагрузим данные
            const reloaded = await loadMiningData();
            if (reloaded) {
                Object.assign(miningData, reloaded);
            }
            // После завершения обновим статус
            miningStatus = 'Готов к запуску';
            canStart = true;
        }
    } else {
        // Проверяем кд
        if (miningData.last_claim_at) {
            const lastClaim = new Date(miningData.last_claim_at).getTime();
            const elapsedSinceClaim = now - lastClaim;
            if (elapsedSinceClaim < COOLDOWN_DURATION) {
                const remaining = COOLDOWN_DURATION - elapsedSinceClaim;
                const hours = Math.floor(remaining / 3600000);
                const minutes = Math.floor((remaining % 3600000) / 60000);
                miningStatus = `⏳ Доступен через ${hours}ч ${minutes}мин`;
                canStart = false;
            }
        }
    }

    // Стоимость улучшения
    const upgradeCost = Math.round(miningData.mining_level * 0.5 * 100) / 100;
    const canUpgrade = (user && user.shares >= Math.round(upgradeCost * 100)) && miningData.mining_level < MAX_LEVEL;

    const html = `
        <div class="mining-container">
            <div class="mining-header">
                <h2>⛏️ Майнинг акций</h2>
                <p>Запускайте майнинг раз в 12 часов и получайте акции пассивно.</p>
            </div>

            <div class="mining-stats">
                <div class="mining-stat">
                    <div class="mining-stat-value">${miningData.mining_level}</div>
                    <div class="mining-stat-label">Уровень</div>
                </div>
                <div class="mining-stat">
                    <div class="mining-stat-value">${baseReward.toFixed(2)}</div>
                    <div class="mining-stat-label">Награда</div>
                </div>
                <div class="mining-stat">
                    <div class="mining-stat-value">${canStart ? '✅' : '⏳'}</div>
                    <div class="mining-stat-label">Статус</div>
                </div>
            </div>

            <div class="mining-status-card">
                <div class="mining-status-text">${miningStatus}</div>
                ${miningData.mining_end_at && now < new Date(miningData.mining_end_at).getTime() ? `
                    <div class="mining-progress-bar">
                        <div class="mining-progress-fill" style="width: ${Math.min(100, progressPercent)}%;"></div>
                    </div>
                    <div class="mining-progress-info">
                        <span>Добыто: ${reward.toFixed(2)} / ${baseReward.toFixed(2)} акций</span>
                        <span>${Math.floor(timeRemaining / 60000)} мин</span>
                    </div>
                ` : ''}
            </div>

            <div class="mining-actions">
                <button id="startMiningBtn" class="mining-btn primary" ${!canStart ? 'disabled' : ''}>
                    ${canStart ? '🚀 Начать майнинг' : '⏳ Ожидание'}
                </button>
                <button id="upgradeMiningBtn" class="mining-btn secondary" ${!canUpgrade ? 'disabled' : ''}>
                    ⬆️ Улучшить (${upgradeCost.toFixed(2)} акций)
                </button>
            </div>

            <div class="mining-info">
                <div class="info-row">
                    <span>⏱️ Длительность майнинга</span>
                    <span>6 часов</span>
                </div>
                <div class="info-row">
                    <span>🔄 Кулдаун</span>
                    <span>12 часов</span>
                </div>
                <div class="info-row">
                    <span>📈 Бонус за уровень</span>
                    <span>+10% за уровень</span>
                </div>
                <div class="info-row">
                    <span>💰 Стоимость улучшения</span>
                    <span>${upgradeCost.toFixed(2)} акций</span>
                </div>
            </div>
        </div>
    `;

    document.getElementById('app').innerHTML = html;

    // Обработчики
    document.getElementById('startMiningBtn')?.addEventListener('click', startMining);
    document.getElementById('upgradeMiningBtn')?.addEventListener('click', upgradeMiningLevel);

    // Обновление каждые 10 секунд (для таймера и прогресса)
    if (window.miningInterval) clearInterval(window.miningInterval);
    window.miningInterval = setInterval(() => {
        const activeTab = document.querySelector('.tab.active');
        if (activeTab && activeTab.dataset.tab === 'mining') {
            renderMiningTab();
        } else {
            clearInterval(window.miningInterval);
        }
    }, 10000);
};

// Очистка интервала при переключении вкладок
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.miningInterval) {
        clearInterval(window.miningInterval);
        window.miningInterval = null;
    }
});
