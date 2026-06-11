// wallet.js – профессиональный кошелёк (профит – только цвет)
window.renderWalletTab = async function() {
    const currentUser = window.currentUser;
    const starsBalance = window.fromCents(currentUser.stars_balance);
    const sharesBalance = window.fromCents(currentUser.shares);
    
    let totalSpent = 0;
    let totalEarned = 0;
    try {
        const { data: trades } = await window.supabase
            .from('trades')
            .select('buyer_id, seller_id, total_stars')
            .or(`seller_id.eq.${window.userId},buyer_id.eq.${window.userId}`);
        if (trades) {
            totalSpent = trades.filter(t => t.buyer_id === window.userId).reduce((s, t) => s + t.total_stars, 0) / 100;
            totalEarned = trades.filter(t => t.seller_id === window.userId).reduce((s, t) => s + t.total_stars, 0) / 100;
        }
    } catch(e) { console.warn(e); }
    
    const profit = totalEarned - totalSpent;
    const profitClass = profit >= 0 ? 'positive-text' : 'negative-text';
    const profitSign = profit >= 0 ? '+' : '';
    
    const html = `
        <div class="wallet-container">
            <div class="wallet-stats">
                <div class="wallet-balance-card">
                    <div class="wallet-balance-icon">⭐</div>
                    <div class="wallet-balance-value">${starsBalance}</div>
                    <div class="wallet-balance-label">Stars</div>
                </div>
                <div class="wallet-balance-card">
                    <div class="wallet-balance-icon">📊</div>
                    <div class="wallet-balance-value">${sharesBalance}</div>
                    <div class="wallet-balance-label">Акции</div>
                </div>
            </div>
            
            <div class="wallet-stats">
                <div class="stat-card"><div class="stat-icon">💸</div><div class="stat-value">${totalSpent.toFixed(2)}</div><div class="stat-label">Потрачено</div></div>
                <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">${totalEarned.toFixed(2)}</div><div class="stat-label">Заработано</div></div>
                <div class="stat-card"><div class="stat-icon">⚖️</div><div class="stat-value ${profitClass}">${profitSign}${profit.toFixed(2)}</div><div class="stat-label">Профит</div></div>
            </div>
            
            <div class="wallet-actions">
                <button id="topupBtn" class="wallet-btn primary">💸 Пополнить Stars</button>
                <button id="withdrawBtn" class="wallet-btn secondary">🎁 Вывести через подарки</button>
            </div>
            
            <div class="wallet-note">
                <span>ℹ️ Минимальная сумма пополнения — 100 ⭐. Максимум <strong>500 ⭐ за 12 часов</strong>. Комиссия 5%.</span>
            </div>
        </div>
    `;
    
    document.getElementById('app').innerHTML = html;
    
    document.getElementById('topupBtn').addEventListener('click', () => {
        if (window.showTopupModal) window.showTopupModal();
        else console.warn('showTopupModal не определён');
    });
    
    document.getElementById('withdrawBtn').addEventListener('click', () => {
        window.tg.openTelegramLink('https://t.me/VoxAction_Bot?start=withdraw_gifts');
    });
};
