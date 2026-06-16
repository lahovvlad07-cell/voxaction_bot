// settings.js – настройки (без игр)
async function renderSettingsTab() {
    const currentUser = window.currentUser;
    const hideRating = currentUser.hide_rating || false;
    const useSliders = window.getUseSliders ? window.getUseSliders() : true;
    const notifyTrades = currentUser.notify_trades !== false;
    const notifyTopup = currentUser.notify_topup !== false;
    const notifyReferral = currentUser.notify_referral !== false;
    
    const html = `
        <div class="settings-container">
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
            
            <button id="saveAllSettingsBtn" class="save-settings-btn">💾 Сохранить все настройки</button>
        </div>
    `;
    
    document.getElementById('app').innerHTML = html;
    
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
        
        window.showCustomModal('Успех', 'Настройки сохранены');
    });
}

window.renderSettingsTab = renderSettingsTab;
