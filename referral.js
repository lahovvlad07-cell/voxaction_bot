// referral.js – только кастомный код, без отображения полной ссылки
window.renderReferralTab = async function() {
    const currentUser = window.currentUser;
    const activeCode = currentUser.custom_ref_code || currentUser.referral_code;
    const referralCount = currentUser.referral_count || 0;
    const earnedShares = currentUser.total_earned_shares ? (currentUser.total_earned_shares / 100).toFixed(2) : '0.00';

    // Прогресс до следующей награды (заглушка)
    const nextMilestone = 3;
    const progressPercent = Math.min(100, (referralCount / nextMilestone) * 100);
    const remaining = nextMilestone - referralCount;

    let html = `
        <div class="card">
            <h2 class="referral-title">🔗 Реферальная программа</h2>
            
            <div class="referral-stats">
                <div class="stat-block">
                    <div class="stat-number">${referralCount}</div>
                    <div class="stat-label">Приглашено друзей</div>
                </div>
                <div class="stat-block">
                    <div class="stat-number">${earnedShares}</div>
                    <div class="stat-label">Заработано акций</div>
                </div>
            </div>

            <div class="custom-code-section">
                <h3>Ваш уникальный код</h3>
                <div class="code-input-group">
                    <span class="code-prefix">t.me/VoxAction_Bot?start=</span>
                    <input type="text" id="refCodeInput" value="${activeCode}" placeholder="придумайте_код" maxlength="32">
                    <button id="saveCodeBtn" class="save-code-btn">💾 Сохранить</button>
                </div>
                <p class="hint-text">Используйте латиницу, цифры и символ подчёркивания (_). До 32 символов.</p>
                <div class="preview-link">Ваша ссылка: <strong>t.me/VoxAction_Bot?start=${activeCode}</strong></div>
            </div>

            <div class="bonus-card">
                <div class="bonus-icon">🎁</div>
                <div class="bonus-text">
                    <strong>Бонус за друга:</strong> вы получите <strong>5 акций</strong>, а ваш друг — <strong>5 ⭐</strong>,<br>
                    когда он пополнит баланс от <strong>10 ⭐</strong>.
                </div>
            </div>

            <div class="progress-card">
                <div class="progress-title">🏆 Достижения за приглашение друзей</div>
                <div class="progress-info">
                    <span>Пригласите ещё <strong>${remaining}</strong> друга(ей)</span>
                    <span>→ 10 акций + достижение "Наставник"</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
                <div class="progress-stats">${referralCount} / ${nextMilestone}</div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    const inputField = document.getElementById('refCodeInput');
    const saveBtn = document.getElementById('saveCodeBtn');

    saveBtn?.addEventListener('click', async () => {
        const newCode = inputField.value.trim().toLowerCase();
        if (!newCode) {
            window.showCustomModal('Ошибка', 'Код не может быть пустым');
            return;
        }
        if (!/^[a-z0-9_]+$/.test(newCode)) {
            window.showCustomModal('Ошибка', 'Используйте только латиницу, цифры и символ подчёркивания (_)');
            return;
        }
        if (newCode.length > 32) {
            window.showCustomModal('Ошибка', 'Код не должен превышать 32 символа');
            return;
        }
        if (newCode === (window.currentUser.custom_ref_code || window.currentUser.referral_code)) {
            window.showCustomModal('Внимание', 'Этот код уже используется');
            return;
        }
        try {
            await window.updateRefCode(newCode);
            window.showCustomModal('Успех', 'Ваш реферальный код обновлён!');
            await window.refreshAll();
        } catch (err) {
            window.showCustomModal('Ошибка', err.message);
        }
    });
};
