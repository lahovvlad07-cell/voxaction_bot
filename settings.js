// settings.js – настройки с группировкой
async function renderSettingsTab() {
    // Получаем текущие лимиты игр пользователя
    const { data: limitsData } = await window.supabase
        .from('user_game_limits')
        .select('game_limits')
        .eq('user_id', window.userId)
        .single();
    const gameLimits = limitsData?.game_limits || {};
    
    // Список игр с их ID и названиями
    const games = [
        { id: 'reaction', name: '⚡ Нажми быстрее', default: 100 },
        { id: 'tower', name: '🏗️ Башня', default: 100 },
        { id: 'closest', name: '🎯 Ближе к цели', default: 100 },
        { id: 'typerace', name: '⌨️ Скоростной набор', default: 100 },
        { id: 'maze', name: '🧩 Лабиринт', default: 100 },
        { id: 'ttt', name: '❌⭕ Крестики-нолики', default: 100 }
    ];
    
    // Текущие значения
    const currentUser = window.currentUser;
    const hideRating = currentUser.hide_rating || false;
    const useSliders = window.getUseSliders ? window.getUseSliders() : true;
    const notifyTrades = currentUser.notify_trades !== false;
    const notifyTopup = currentUser.notify_topup !== false;
    const notifyReferral = currentUser.notify_referral !== false;
    
    const html = `
        <div class="settings-container">
            <!-- Часовые лимиты игр -->
            <div class="settings-card">
                <h3>🎮 Часовые лимиты игр</h3>
                <p class="settings-note">Максимальный чистый выигрыш/проигрыш за час (⭐). Можно только понижать.</p>
                <div class="games-limits-list">
                    ${games.map(game => {
                        const current = gameLimits[game.id] !== undefined ? gameLimits[game.id] : game.default;
                        return `
                            <div class="game-limit-item">
                                <div class="game-limit-header">
                                    <span class="game-name">${game.name}</span>
                                    <span class="game-limit-value" id="val_${game.id}">${current}</span>
                                </div>
                                <input type="range" id="limit_${game.id}" class="limit-slider" min="10" max="100" step="5" value="${current}">
                                <button class="save-limit-btn" data-game="${game.id}">Сохранить</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            
            <!-- Общие настройки -->
            <div class="settings-card">
                <h3>⚙️ Общие настройки</h3>
                <div class="setting-item">
                    <label class="setting-label">
                        <input type="checkbox" id="hideRatingCheckbox" ${hideRating ? 'checked' : ''}>
                        <span>Скрыть из рейтинга</span>
                    </label>
                </div>
                <div class="setting-item">
                    <label class="setting-label">
                        <input type="checkbox" id="useSlidersCheckbox" ${useSliders ? 'checked' : ''}>
                        <span>Использовать слайдеры в формах продажи/покупки</span>
                    </label>
                </div>
            </div>
            
            <!-- Уведомления -->
            <div class="settings-card">
                <h3>🔔 Уведомления</h3>
                <div class="setting-item">
                    <label class="setting-label">
                        <input type="checkbox" id="notifyTradesCheckbox" ${notifyTrades ? 'checked' : ''}>
                        <span>О сделках</span>
                    </label>
                </div>
                <div class="setting-item">
                    <label class="setting-label">
                        <input type="checkbox" id="notifyTopupCheckbox" ${notifyTopup ? 'checked' : ''}>
                        <span>О пополнении</span>
                    </label>
                </div>
                <div class="setting-item">
                    <label class="setting-label">
                        <input type="checkbox" id="notifyReferralCheckbox" ${notifyReferral ? 'checked' : ''}>
                        <span>О рефералах</span>
                    </label>
                </div>
            </div>
            
            <!-- Кнопка сохранения -->
            <button id="saveAllSettingsBtn" class="save-settings-btn">💾 Сохранить все настройки</button>
        </div>
    `;
    
    document.getElementById('app').innerHTML = html;
    
    // Обработчики слайдеров и кнопок сохранения лимитов
    games.forEach(game => {
        const slider = document.getElementById(`limit_${game.id}`);
        const valueSpan = document.getElementById(`val_${game.id}`);
        if (slider && valueSpan) {
            slider.addEventListener('input', (e) => {
                valueSpan.textContent = e.target.value;
            });
            const btn = document.querySelector(`.save-limit-btn[data-game="${game.id}"]`);
            if (btn) {
                btn.addEventListener('click', async () => {
                    const newVal = parseInt(slider.value);
                    const oldVal = gameLimits[game.id] !== undefined ? gameLimits[game.id] : game.default;
                    if (newVal > oldVal) {
                        window.showCustomModal('Ошибка', 'Нельзя повысить лимит, только понизить');
                        return;
                    }
                    try {
                        const limits = { ...gameLimits, [game.id]: newVal };
                        await window.supabase
                            .from('user_game_limits')
                            .upsert({ user_id: window.userId, game_limits: limits });
                        window.showCustomModal('Успех', `Лимит для "${game.name}" установлен на ${newVal} ⭐`);
                        // Обновляем отображение
                        gameLimits[game.id] = newVal;
                    } catch(e) {
                        window.showCustomModal('Ошибка', e.message);
                    }
                });
            }
        }
    });
    
    // Сохранение общих настроек
    document.getElementById('saveAllSettingsBtn').addEventListener('click', async () => {
        const hideRating = document.getElementById('hideRatingCheckbox').checked;
        const useSliders = document.getElementById('useSlidersCheckbox').checked;
        const notifyTrades = document.getElementById('notifyTradesCheckbox').checked;
        const notifyTopup = document.getElementById('notifyTopupCheckbox').checked;
        const notifyReferral = document.getElementById('notifyReferralCheckbox').checked;
        
        if (window.setUseSliders) window.setUseSliders(useSliders);
        
        await window.supabase.from('users').update({
            hide_rating: hideRating,
            notify_trades: notifyTrades,
            notify_topup: notifyTopup,
            notify_referral: notifyReferral
        }).eq('id', window.userId);
        
        window.currentUser.hide_rating = hideRating;
        window.currentUser.notify_trades = notifyTrades;
        window.currentUser.notify_topup = notifyTopup;
        window.currentUser.notify_referral = notifyReferral;
        
        window.showCustomModal('Успех', 'Общие настройки сохранены');
    });
}

// Переопределяем функцию в window (если она была в index.html)
window.renderSettingsTab = renderSettingsTab;
