window.renderReferral = async () => {
    const refLink = `https://t.me/VoxAction_Bot?start=${window.currentUser.referral_code || 'REF0000'}`;
    const cnt = window.currentUser.referral_count || 0;
    const earned = cnt * 5;
    const html = `<div class="card"><h2>🔗 Реферальная программа</h2><div class="stats-row"><div class="stat-card"><div class="stat-value">${cnt}</div><div class="stat-label">Приглашено друзей</div></div><div class="stat-card"><div class="stat-value">${earned}</div><div class="stat-label">Заработано акций</div></div></div><h3>Ваша реферальная ссылка</h3><div class="small-text" style="background:rgba(0,0,0,.3);padding:8px;border-radius:20px;word-break:break-all">${refLink}</div><button id="copyRefLink">📋 Скопировать ссылку</button></div>`;
    document.getElementById('app').innerHTML = html;
    document.getElementById('copyRefLink')?.addEventListener('click', () => { navigator.clipboard.writeText(refLink); window.showModal('Скопировано', 'Ссылка скопирована'); });
};
