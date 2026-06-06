window.renderReferralTab = async function() {
    const refCode = window.currentUser.referral_code;
    const refLink = `https://t.me/VoxAction_Bot?start=${refCode || 'REF0000'}`;
    const referralCount = window.currentUser.referral_count || 0;
    const earnedShares = window.currentUser.total_earned_shares ? (window.currentUser.total_earned_shares / 100).toFixed(2) : '0.00';

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
                    <span class="ref-link-text">${refLink}</span>
                    <button class="copy-btn" id="copyRefLink">📋</button>
                </div>
                <p class="small-text hint-text">Нажмите на ссылку, чтобы скопировать</p>
            </div>

            <div class="referral-bonus-card">
                <div class="bonus-icon">🎁</div>
                <div class="bonus-text">
                    <strong>Бонус за друга:</strong> вы получите <strong>5 акций</strong>, а ваш друг — <strong>5 ⭐</strong>,<br>
                    когда он пополнит баланс от <strong>10 ⭐</strong>.
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    document.getElementById('copyRefLink')?.addEventListener('click', () => {
        navigator.clipboard.writeText(refLink);
        window.showCustomModal('Скопировано', 'Реферальная ссылка скопирована');
    });
};
