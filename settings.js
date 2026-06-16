// settings.js – модалка с настройками (открывается по шестерёнке)
async function renderSettingsTab() {
    const existing = document.getElementById('settingsModal');
    if (existing) existing.remove();
    
    const currentUser = window.currentUser;
    const hideRating = currentUser.hide_rating || false;
    const useSliders = window.getUseSliders ? window.getUseSliders() : false; // по умолчанию false
    const notifyTrades = currentUser.notify_trades !== false;
    const notifyTopup = currentUser.notify_topup !== false;
    const notifyReferral = currentUser.notify_referral !== false;
    const disableAnimations = localStorage.getItem('disable_animations') === 'true';
    
    const modalHtml = `
        <div class="modal" id="settingsModal" style="display:flex;">
            <div class="modal-content settings-modal">
                <span class="close-modal" id="closeSettingsModal">&times;</span>
                <h3>⚙️ Настройки</h3>
                <div class="settings-body scrollable">
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
                        <label class="setting-item">
                            <input type="checkbox" id="disableAnimationsCheckbox" ${disableAnimations ? 'checked' : ''}>
                            <span>🚀 Отключить анимации (экономия трафика)</span>
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
                    
                    <!-- Кнопка сохранения – минималистичная (водяной знак) -->
                    <button id="saveSettingsBtn" class="save-settings-btn subtle">💾 Сохранить настройки</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('settingsModal');
    const closeModal = () => modal.remove();
    document.getElementById('closeSettingsModal').onclick = closeModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    
    // ---- СОХРАНЕНИЕ ----
    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
        const hideRating = document.getElementById('hideRatingCheckbox').checked;
        const useSliders = document.getElementById('useSlidersCheckbox').checked;
        const disableAnimations = document.getElementById('disableAnimationsCheckbox').checked;
        const notifyTrades = document.getElementById('notifyTradesCheckbox').checked;
        const notifyTopup = document.getElementById('notifyTopupCheckbox').checked;
        const notifyReferral = document.getElementById('notifyReferralCheckbox').checked;
        
        if (window.setUseSliders) window.setUseSliders(useSliders);
        localStorage.setItem('disable_animations', disableAnimations ? 'true' : 'false');
        
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
        
        // Применяем отключение анимаций
        if (disableAnimations) {
            document.body.classList.add('animations-off');
        } else {
            document.body.classList.remove('animations-off');
        }
        
        window.showCustomModal('Успех', 'Настройки сохранены');
        closeModal();
    });
    
    // При открытии модалки применяем текущее состояние анимаций
    if (disableAnimations) {
        document.body.classList.add('animations-off');
    } else {
        document.body.classList.remove('animations-off');
    }
}

window.renderSettingsTab = renderSettingsTab;
