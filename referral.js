// referral.js – улучшенная вёрстка
window.renderReferralTab = async function() {
    const refCode = window.currentUser.referral_code;
    const refLink = `https://t.me/VoxAction_Bot?start=${refCode || 'REF0000'}`;
    const referralCount = window.currentUser.referral_count || 0;
    const earnedShares = window.currentUser.total_earned_shares ? (window.currentUser.total_earned_shares / 100).toFixed(2) : '0.00';
    
    const referralsList = await window.getReferralsList();
    const progress = await window.getReferralRewardsProgress(referralCount);
    
    let html = `
        <div class="card">
            <h2 style="text-align:center;">🔗 Реферальная программа</h2>
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
                <h3>Ваша реферальная ссылка</h3>
                <div class="ref-link-container">
                    <span class="ref-link-text">${refLink}</span>
                    <button class="copy-btn" id="copyRefLink">📋</button>
                </div>
                <p class="small-text">Приглашайте друзей – они получат <strong>5 ⭐</strong> бонусом, а вы <strong>5 акций</strong>, когда он пополнит на 10 ⭐.</p>
            </div>
    `;
    
    if (progress) {
        html += `
            <div class="reward-progress">
                <div class="reward-title">🎁 Следующая награда</div>
                <div class="progress-label">Пригласите ${progress.needed} друзей → получите ${progress.rewardShares} акций и достижение "${progress.achievementName}"</div>
                <div class="progress-bar"><div class="progress-fill" style="width: ${Math.min(100, progress.progress)}%;"></div></div>
                <div class="progress-stats">${progress.current} / ${progress.needed}</div>
            </div>
        `;
    } else {
        html += `<div class="reward-progress" style="text-align:center;"><span>🏆 Все реферальные награды получены!</span></div>`;
    }
    
    html += `<button id="showReferralsListBtn" class="secondary">👥 Показать приглашённых друзей (${referralsList.length})</button>`;
    html += `</div>`;
    
    document.getElementById('app').innerHTML = html;
    
    document.getElementById('copyRefLink')?.addEventListener('click', () => {
        navigator.clipboard.writeText(refLink);
        window.showCustomModal('Скопировано', 'Реферальная ссылка скопирована');
    });
    
    document.getElementById('showReferralsListBtn')?.addEventListener('click', () => {
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
                <div>
                    <strong>${escapeHtml(r.username)}</strong><br>
                    <span class="small-text">${new Date(r.registeredAt).toLocaleDateString()}</span>
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
