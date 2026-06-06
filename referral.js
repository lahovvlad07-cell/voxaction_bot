window.renderReferralTab = async function() {
    const currentUser = window.currentUser;
    const activeCode = currentUser.custom_ref_code || currentUser.referral_code;
    const fullLink = `https://t.me/VoxAction_Bot?start=${activeCode}`;
    const referralCount = currentUser.referral_count || 0;
    const earnedShares = currentUser.total_earned_shares ? (currentUser.total_earned_shares / 100).toFixed(2) : '0.00';
    const hasCustomCode = !!currentUser.custom_ref_code;

    let html = `
        <div class="card">
            <h2 class="referral-title">🔗 Реферальная программа</h2>
            <div class="referral-stats">
                <div class="referral-stat-card">
                    <div class="referral-stat-value">${referralCount}</div>
                    <div class="referral-stat-label">Приглашено друзей</div>
                </div>
                <div class="referral-stat-card">
                    <div class="referral-stat-value">${earnedShares}</div>
                    <div class="referral-stat-label">Заработано акций</div>
                </div>
            </div>

            <div class="referral-link-block">
                <div class="ref-link-container">
                    <span class="ref-link-text" id="refLinkText">${fullLink}</span>
                    <button class="copy-btn" id="copyRefLinkBtn">📋 Копировать</button>
                    <button class="copy-btn share-btn" id="shareRefLinkBtn">📤 Поделиться</button>
                </div>
                <p class="hint-text">Нажмите «Поделиться», чтобы отправить ссылку другу в Telegram</p>
            </div>

            <div class="ref-code-editor">
                <h3>Ваш уникальный код</h3>
                <div class="code-input-group">
                    <span class="code-prefix">t.me/VoxAction_Bot?start=</span>
                    <input type="text" id="refCodeInput" value="${activeCode}" ${hasCustomCode ? 'disabled' : ''} placeholder="придумайте_код" maxlength="32">
                    ${!hasCustomCode ? `<button id="saveCodeBtn" class="save-code-btn">💾 Сохранить</button>` : '<span class="code-locked">🔒 Ваш уникальный код</span>'}
                </div>
                ${!hasCustomCode ? '<p class="hint-text">Используйте латиницу, цифры и символ подчёркивания (_). До 32 символов.</p>' : ''}
            </div>

            <div class="referral-bonus-card">
                <div class="bonus-icon">🎁</div>
                <div class="bonus-text">
                    <strong>Бонус за друга:</strong> вы получите <strong>5 акций</strong>, а ваш друг — <strong>5 ⭐</strong>,<br>
                    когда он пополнит баланс от <strong>10 ⭐</strong>.
                </div>
            </div>

            <div class="reward-progress-placeholder">
                <div class="reward-title">🏆 Достижения за приглашение друзей</div>
                <div class="reward-step">
                    <span>${referralCount} / 3 друзей</span>
                    <span>→ 10 акций + достижение "Наставник"</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(100, (referralCount / 3) * 100)}%;"></div>
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    // Копирование полной ссылки
    document.getElementById('copyRefLinkBtn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(fullLink);
        window.showCustomModal('Скопировано', 'Реферальная ссылка скопирована');
    });

    // Поделиться через Telegram
    document.getElementById('shareRefLinkBtn')?.addEventListener('click', () => {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(fullLink)}&text=${encodeURIComponent('Присоединяйся ко мне в VoxAction бирже! 🚀')}`;
        if (window.tg && window.tg.openTelegramLink) {
            window.tg.openTelegramLink(shareUrl);
        } else {
            window.open(shareUrl, '_blank');
        }
    });

    // Сохранение кастомного кода
    if (!hasCustomCode) {
        document.getElementById('saveCodeBtn')?.addEventListener('click', async () => {
            const newCode = document.getElementById('refCodeInput').value.trim().toLowerCase();
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
            try {
                await window.updateRefCode(newCode);
                window.showCustomModal('Успех', 'Ваш реферальный код обновлён!');
                await window.refreshAll();
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        });
    }
};
