window.renderReferralTab = async function() {
    const refCode = window.currentUser.referral_code;
    const fullLink = `https://t.me/VoxAction_Bot?start=${refCode || 'REF0000'}`;
    const shortLink = `t.me/VoxAction_Bot?start=${refCode || 'REF0000'}`; // для отображения
    const referralCount = window.currentUser.referral_count || 0;
    const earnedShares = window.currentUser.total_earned_shares ? (window.currentUser.total_earned_shares / 100).toFixed(2) : '0.00';

    // Заглушка прогресса (позже заменим реальными данными)
    const rewards = [
        { needed: 3, reward: '10 акций', achievement: 'Наставник' },
        { needed: 5, reward: '20 акций', achievement: 'Лидер' },
        { needed: 10, reward: '50 акций', achievement: 'Король рефералов' }
    ];
    const nextReward = rewards.find(r => referralCount < r.needed) || rewards[0];
    const progressPercent = (referralCount / nextReward.needed) * 100;

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
                    <span class="ref-link-text" id="refLinkText">${shortLink}</span>
                    <button class="copy-btn" id="copyRefLinkBtn">📋 Копировать</button>
                </div>
                <p class="hint-text">Нажмите, чтобы скопировать ссылку и поделиться с друзьями</p>
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
                    <span>${referralCount} / ${nextReward.needed} друзей</span>
                    <span>→ ${nextReward.reward} + достижение "${nextReward.achievement}"</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
                <div class="reward-next">Следующая награда после ${nextReward.needed} друзей</div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    document.getElementById('copyRefLinkBtn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(fullLink);
        window.showCustomModal('Скопировано', 'Реферальная ссылка скопирована в буфер обмена');
    });
};
