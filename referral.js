// referral.js – улучшенная версия

window.renderReferralTab = async function() {
    const refCode = window.currentUser.referral_code;
    const refLink = `https://t.me/VoxAction_Bot?start=${refCode || 'REF0000'}`;
    const referralCount = window.currentUser.referral_count || 0;
    const earnedShares = window.currentUser.total_earned_shares ? window.currentUser.total_earned_shares / 100 : 0;
    
    // Получаем список рефералов
    const referralsList = await window.getReferralsList();
    const progress = await window.getReferralRewardsProgress(referralCount);
    
    // Формируем HTML
    let html = `
        <div class="card">
            <h2>🔗 Реферальная программа</h2>
            <div class="stats-row">
                <div class="stat-card">
                    <div class="stat-value">${referralCount}</div>
                    <div class="stat-label">Приглашено друзей</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${earnedShares.toFixed(2)}</div>
                    <div class="stat-label">Заработано акций</div>
                </div>
            </div>
            
            <div class="referral-link-block">
                <h3>Ваша реферальная ссылка</h3>
                <div class="ref-link-container">
                    <span class="ref-link-text">${refLink}</span>
                    <button id="copyRefLink" class="copy-btn">📋</button>
                </div>
                <p class="small-text">Приглашайте друзей – они получат <strong>5 ⭐</strong> бонусом, а вы <strong>5 акций</strong>, когда он пополнит на 10 ⭐.</p>
            </div>
    `;
    
    // Прогресс до следующей награды
    if (progress) {
        html += `
            <div class="reward-progress">
                <h3>🎁 Следующая награда за рефералов</h3>
                <div class="progress-label">Пригласите ${progress.needed} друзей → получите ${progress.rewardShares} акций и достижение "${progress.achievementName}"</div>
                <div class="progress-bar"><div class="progress-fill" style="width: ${progress.progress}%;"></div></div>
                <div class="progress-stats">${progress.current} / ${progress.needed}</div>
            </div>
        `;
    } else {
        html += `<div class="reward-progress"><p class="small-text">🏆 Все реферальные награды получены!</p></div>`;
    }
    
    // Кнопка показа списка друзей
    html += `<button id="showReferralsListBtn" class="secondary">👥 Показать приглашённых друзей (${referralsList.length})</button>`;
    html += `</div>`; // закрываем card
    
    document.getElementById('app').innerHTML = html;
    
    // Копирование ссылки
    document.getElementById('copyRefLink')?.addEventListener('click', () => {
        navigator.clipboard.writeText(refLink);
        window.showCustomModal('Скопировано', 'Реферальная ссылка скопирована в буфер обмена');
    });
    
    // Модалка со списком рефералов
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
