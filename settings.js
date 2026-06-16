// settings.js – модалка с настройками (открывается по шестерёнке)
async function renderSettingsTab() {
    // Удаляем старую модалку, если она есть
    const existing = document.getElementById('settingsModal');
    if (existing) existing.remove();
    
    const currentUser = window.currentUser;
    const hideRating = currentUser.hide_rating || false;
    const useSliders = window.getUseSliders ? window.getUseSliders() : true;
    const notifyTrades = currentUser.notify_trades !== false;
    const notifyTopup = currentUser.notify_topup !== false;
    const notifyReferral = currentUser.notify_referral !== false;
    
    const modalHtml = `
        <div class="modal" id="settingsModal" style="display:flex;">
            <div class="modal-content settings-modal">
                <span class="close-modal" id="closeSettingsModal">&times;</span>
                <h3>⚙️ Настройки</h3>
                <div class="settings-body">
                    <!-- Общие настройки -->
                    <div class="settings-section">
                        <div class="settings-section-title">Общие</div>
                        <label class="setting-item">
                            <input type="checkbox" id="hideRatingCheckbox" ${hideRating ? 'checked' : ''}>
                            <span>Скрыть из рейтинга</span>
                        </label>
                        <label class="setting-item">
                            <input type="checkbox" id="useSlidersCheckbox" ${useSliders ? 'checked' : ''}>
                            <span>Использовать слайдеры в формах продажи/покупки</span>
                        </label>
                    </div>
                    
                    <!-- Уведомления -->
                    <div class="settings-section">
                        <div class="settings-section-title">🔔 Уведомления</div>
                        <label class="setting-item">
                            <input type="checkbox" id="notifyTradesCheckbox" ${notifyTrades ? 'checked' : ''}>
                            <span>О сделках</span>
                        </label>
                        <label class="setting-item">
                            <input type="checkbox" id="notifyTopupCheckbox" ${notifyTopup ? 'checked' : ''}>
                            <span>О пополнении</span>
                        </label>
                        <label class="setting-item">
                            <input type="checkbox" id="notifyReferralCheckbox" ${notifyReferral ? 'checked' : ''}>
                            <span>О рефералах</span>
                        </label>
                    </div>
                    
                    <!-- Дополнительно -->
                    <div class="settings-section">
                        <div class="settings-section-title">🛠️ Дополнительно</div>
                        <button id="clearCacheBtn" class="settings-action-btn">🗑️ Очистить кэш</button>
                        <div class="settings-hint">Сбросит сохранённые настройки интерфейса</div>
                    </div>
                    
                    <button id="saveSettingsBtn" class="save-settings-btn">💾 Сохранить настройки</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('settingsModal');
    const closeModal = () => modal.remove();
    document.getElementById('closeSettingsModal').onclick = closeModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    
    // Сохранение настроек
    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
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
        
        window.showCustomModal('Успех', 'Настройки сохранены');
        closeModal();
    });
    
    // Очистка кэша
    document.getElementById('clearCacheBtn').addEventListener('click', () => {
        if (confirm('Очистить кэш интерфейса? (будут сброшены настройки слайдеров)')) {
            localStorage.clear();
            window.showCustomModal('Успех', 'Кэш очищен. Перезагрузите страницу.');
        }
    });
}

window.renderSettingsTab = renderSettingsTab;
