// settings.js – исправленный

async function renderSettingsTab() {
    const existing = document.getElementById('settingsModal');
    if (existing) existing.remove();

    const currentUser = window.currentUser;
    const hideRating = currentUser.hide_rating || false;
    const useSliders = window.getUseSliders ? window.getUseSliders() : false;
    const notifyTrades = currentUser.notify_trades !== false;
    const notifyTopup = currentUser.notify_topup !== false;
    const notifyReferral = currentUser.notify_referral !== false;
    const disableAnimations = localStorage.getItem('disable_animations') === 'true';
    const hideBalance = localStorage.getItem('hide_balance') === 'true';
    const fontSize = localStorage.getItem('font_size') || 'medium';
    const theme = localStorage.getItem('app_theme') || 'blue';
    const autoUpdate = localStorage.getItem('auto_update') !== 'false';

    const modalHtml = `
        <div class="modal" id="settingsModal" style="display:flex;">
            <div class="modal-content settings-modal">
                <span class="close-modal" id="closeSettingsModal">&times;</span>
                <h3>⚙️ Настройки</h3>
                <div class="settings-body scrollable">
                    <div class="settings-section">
                        <div class="settings-section-title">🎨 Внешний вид</div>
                        <div class="setting-item">
                            <span class="setting-label">Тема</span>
                            <div class="theme-selector">
                                <button class="theme-option ${theme === 'blue' ? 'active' : ''}" data-theme="blue" style="background: #2b6e9e;"></button>
                                <button class="theme-option ${theme === 'purple' ? 'active' : ''}" data-theme="purple" style="background: #7c3aed;"></button>
                                <button class="theme-option ${theme === 'green' ? 'active' : ''}" data-theme="green" style="background: #059669;"></button>
                                <button class="theme-option ${theme === 'gold' ? 'active' : ''}" data-theme="gold" style="background: #d97706;"></button>
                            </div>
                        </div>
                        <div class="setting-item">
                            <span class="setting-label">Размер шрифта</span>
                            <div class="font-size-selector">
                                <button class="font-option ${fontSize === 'small' ? 'active' : ''}" data-size="small">Aa</button>
                                <button class="font-option ${fontSize === 'medium' ? 'active' : ''}" data-size="medium">Aa</button>
                                <button class="font-option ${fontSize === 'large' ? 'active' : ''}" data-size="large">Aa</button>
                            </div>
                        </div>
                        <label class="setting-item">
                            <input type="checkbox" id="hideBalanceCheckbox" ${hideBalance ? 'checked' : ''}>
                            <span>Скрыть баланс на главной</span>
                        </label>
                        <label class="setting-item">
                            <input type="checkbox" id="disableAnimationsCheckbox" ${disableAnimations ? 'checked' : ''}>
                            <span>🚀 Отключить анимации (экономия трафика)</span>
                        </label>
                    </div>

                    <div class="settings-section">
                        <div class="settings-section-title">📱 Общие</div>
                        <label class="setting-item">
                            <input type="checkbox" id="hideRatingCheckbox" ${hideRating ? 'checked' : ''}>
                            <span>Скрыть из рейтинга</span>
                        </label>
                        <label class="setting-item">
                            <input type="checkbox" id="useSlidersCheckbox" ${useSliders ? 'checked' : ''}>
                            <span>Использовать слайдеры в формах продажи/покупки</span>
                        </label>
                        <label class="setting-item">
                            <input type="checkbox" id="autoUpdateCheckbox" ${autoUpdate ? 'checked' : ''}>
                            <span>Автообновление данных (каждые 10 сек)</span>
                        </label>
                    </div>

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
                        <label class="setting-item">
                            <input type="checkbox" id="notifyAchievementCheckbox" checked disabled>
                            <span>О достижениях (всегда включено)</span>
                        </label>
                    </div>

                    <div class="settings-section">
                        <div class="settings-section-title">ℹ️ О приложении</div>
                        <div class="app-info">
                            <div class="info-row"><span>Версия</span><span>v2.0.0</span></div>
                            <div class="info-row"><span>Разработчик</span><span>VoxAction Team</span></div>
                            <div class="info-row"><span>Сайт</span><span><a href="#" style="color:#0ff;">voxaction.com</a></span></div>
                        </div>
                    </div>

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

    document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
        const hideRating = document.getElementById('hideRatingCheckbox').checked;
        const useSliders = document.getElementById('useSlidersCheckbox').checked;
        const disableAnimations = document.getElementById('disableAnimationsCheckbox').checked;
        const hideBalance = document.getElementById('hideBalanceCheckbox').checked;
        const autoUpdate = document.getElementById('autoUpdateCheckbox').checked;
        const notifyTrades = document.getElementById('notifyTradesCheckbox').checked;
        const notifyTopup = document.getElementById('notifyTopupCheckbox').checked;
        const notifyReferral = document.getElementById('notifyReferralCheckbox').checked;

        const activeTheme = document.querySelector('.theme-option.active');
        const theme = activeTheme ? activeTheme.dataset.theme : 'blue';
        const activeFont = document.querySelector('.font-option.active');
        const fontSize = activeFont ? activeFont.dataset.size : 'medium';

        if (window.setUseSliders) window.setUseSliders(useSliders);
        localStorage.setItem('disable_animations', disableAnimations ? 'true' : 'false');
        localStorage.setItem('hide_balance', hideBalance ? 'true' : 'false');
        localStorage.setItem('auto_update', autoUpdate ? 'true' : 'false');
        localStorage.setItem('app_theme', theme);
        localStorage.setItem('font_size', fontSize);

        applyTheme(theme);
        applyFontSize(fontSize);

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

        if (disableAnimations) {
            document.body.classList.add('animations-off');
        } else {
            document.body.classList.remove('animations-off');
        }

        window.showCustomModal('Успех', 'Настройки сохранены');
        closeModal();
        if (window.refreshActiveTab) window.refreshActiveTab();
    });

    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    document.querySelectorAll('.font-option').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.font-option').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        });
    });

    applyTheme(theme);
    applyFontSize(fontSize);
    if (disableAnimations) document.body.classList.add('animations-off');
    else document.body.classList.remove('animations-off');
}

function applyTheme(theme) {
    const root = document.documentElement;
    const themes = {
        blue: { primary: '#2b6e9e', accent: '#0ff' },
        purple: { primary: '#7c3aed', accent: '#a78bfa' },
        green: { primary: '#059669', accent: '#34d399' },
        gold: { primary: '#d97706', accent: '#fbbf24' }
    };
    const t = themes[theme] || themes.blue;
    root.style.setProperty('--primary-color', t.primary);
    root.style.setProperty('--accent-color', t.accent);
}

function applyFontSize(size) {
    const root = document.documentElement;
    const sizes = {
        small: '14px',
        medium: '16px',
        large: '18px'
    };
    root.style.setProperty('--base-font-size', sizes[size] || '16px');
    document.body.style.fontSize = sizes[size] || '16px';
}

window.renderSettingsTab = renderSettingsTab;
