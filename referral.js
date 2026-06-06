// referral.js
window.renderReferralTab = async function() {
    const refCode = window.currentUser.referral_code;
    const refLink = `https://t.me/VoxAction_Bot?start=${refCode || 'REF0000'}`;
    const referralCount = window.currentUser.referral_count || 0;
    const earnedShares = referralCount * 5;
    const html = `<div class="card"><h2>🔗 Реферальная программа</h2><div class="stats-row"><div class="stat-card"><div class="stat-value">${referralCount}</div><div class="stat-label">Приглашено друзей</div></div><div class="stat-card"><div class="stat-value">${earnedShares}</div><div class="stat-label">Заработано акций</div></div></div><h3>Ваша реферальная ссылка</h3><div class="small-text" style="background:rgba(0,0,0,0.3); padding:8px; border-radius:20px; word-break:break-all;">${refLink}</div><p class="small-text">Приглашайте друзей – они получат бонус, а вы 5 акций, когда он пополнит на 10 ⭐.</p><button id="copyRefLink">📋 Скопировать ссылку</button></div>`;
    document.getElementById('app').innerHTML = html;
    document.getElementById('copyRefLink')?.addEventListener('click', () => { navigator.clipboard.writeText(refLink); window.showCustomModal('Скопировано', 'Реферальная ссылка скопирована в буфер обмена'); });
};
