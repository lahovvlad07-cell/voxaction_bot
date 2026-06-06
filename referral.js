window.renderReferralTab = async function() {
    const currentUser = window.currentUser;
    const activeCode = currentUser.referral_code;
    const fullLink = `https://t.me/VoxAction_Bot?start=${activeCode}`;
    const referralCount = currentUser.referral_count || 0;
    const earnedShares = currentUser.total_earned_shares ? (currentUser.total_earned_shares / 100).toFixed(2) : '0.00';

    // Заглушка прогресса
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

            <div class="link-section">
                <div class="link-url" id="refLinkText">${fullLink}</div>
                <div class="link-buttons">
                    <button class="copy-btn" id="copyRefLinkBtn">📋 Копировать</button>
                    <button class="share-btn" id="shareRefLinkBtn">📤 Поделиться</button>
                </div>
                <div class="link-hint">Нажмите «Поделиться», чтобы отправить ссылку другу в Telegram</div>
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

            <button id="showReferralsListBtn" class="secondary" style="margin-top:16px;">👥 Показать приглашённых друзей (${referralCount})</button>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    document.getElementById('copyRefLinkBtn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(fullLink);
        window.showCustomModal('Скопировано', 'Реферальная ссылка скопирована');
    });

    document.getElementById('shareRefLinkBtn')?.addEventListener('click', () => {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(fullLink)}&text=${encodeURIComponent('Присоединяйся ко мне в VoxAction бирже! 🚀')}`;
        if (window.tg && window.tg.openTelegramLink) {
            window.tg.openTelegramLink(shareUrl);
        } else {
            window.open(shareUrl, '_blank');
        }
    });

    // Обработчик кнопки "Показать приглашённых"
    document.getElementById('showReferralsListBtn')?.addEventListener('click', async () => {
        const referralsList = await window.getReferralsList();
        showReferralsModal(referralsList);
    });
};

async function showReferralsModal(referrals) {
    let listHtml = '';
    if (referrals.length === 0) {
        listHtml = '<p style="text-align:center; padding:20px;">У вас пока нет приглашённых друзей</p>';
    } else {
        listHtml = referrals.map(r => `
            <div class="referral-item">
                <div class="referral-user">
                    <span class="referral-avatar">👤</span>
                    <div>
                        <div class="referral-username"><strong>${escapeHtml(r.username)}</strong></div>
                        <div class="referral-date">${new Date(r.registeredAt).toLocaleDateString()}</div>
                    </div>
                </div>
                <div class="referral-status">
                    ${r.topupCompleted 
                        ? `<span class="status-success">✅ Пополнил на ${r.topupAmount} ⭐</span>` 
                        : `<span class="status-pending">⏳ Не пополнил</span>`}
                </div>
            </div>
        `).join('');
    }

    const modalHtml = `
        <div class="modal" id="referralsModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeReferralsModal">&times;</span>
                <h3>👥 Приглашённые друзья</h3>
                <div class="scrollable-content">
                    <div class="referrals-list">${listHtml}</div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('closeReferralsModal').onclick = () => {
        document.getElementById('referralsModal').remove();
    };
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
