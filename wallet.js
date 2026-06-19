// wallet.js – с комиссией и лимитами вывода

window.renderWalletTab = async function() {
    const { user: freshUser } = await window.getOrCreateUser();
    window.currentUser = freshUser;
    
    const starsBalance = window.fromCents(freshUser.stars_balance);
    const sharesBalance = window.fromCents(freshUser.shares);
    
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
    const profitClass = profit >= 0 ? 'positive' : 'negative';
    const profitSign = profit >= 0 ? '+' : '';
    
    let topupLimitUsed = 0;
    let topupLimitRemaining = 500;
    try {
        const twelveHoursAgo = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
        const { data: topups } = await window.supabase
            .from('topup_history')
            .select('amount')
            .eq('user_id', window.userId)
            .gte('created_at', twelveHoursAgo);
        if (topups) {
            topupLimitUsed = topups.reduce((sum, t) => sum + t.amount, 0) / 100;
            topupLimitRemaining = Math.max(0, 500 - topupLimitUsed);
        }
    } catch(e) { console.warn('Ошибка загрузки лимита пополнений', e); }
    
    // Получаем резерв
    const reserve = await window.getReserve();
    
    const html = `
        <div class="wallet-container">
            <div class="wallet-balance-grid">
                <div class="wallet-balance-card stars">
                    <div class="wallet-balance-icon">⭐</div>
                    <div class="wallet-balance-value" id="walletStarsBalance">${starsBalance}</div>
                    <div class="wallet-balance-label">Stars</div>
                    <div class="wallet-balance-sub">доступно для пополнения</div>
                </div>
                <div class="wallet-balance-card shares">
                    <div class="wallet-balance-icon">📊</div>
                    <div class="wallet-balance-value">${sharesBalance}</div>
                    <div class="wallet-balance-label">Акции</div>
                    <div class="wallet-balance-sub">в вашем портфеле</div>
                </div>
            </div>
            
            <div class="wallet-limit-card">
                <div class="wallet-limit-header">
                    <span>📊 Лимит пополнения (12ч)</span>
                    <span class="wallet-limit-numbers">${topupLimitUsed.toFixed(0)} / 500 ⭐</span>
                </div>
                <div class="wallet-limit-bar">
                    <div class="wallet-limit-fill" style="width: ${(topupLimitUsed / 500) * 100}%;"></div>
                </div>
                <div class="wallet-limit-remaining">Осталось: <strong>${topupLimitRemaining.toFixed(0)} ⭐</strong></div>
            </div>
            
            <div class="wallet-stats-grid">
                <div class="wallet-stat-card">
                    <div class="wallet-stat-icon">💸</div>
                    <div class="wallet-stat-value">${totalSpent.toFixed(2)}</div>
                    <div class="wallet-stat-label">Потрачено</div>
                </div>
                <div class="wallet-stat-card">
                    <div class="wallet-stat-icon">💰</div>
                    <div class="wallet-stat-value">${totalEarned.toFixed(2)}</div>
                    <div class="wallet-stat-label">Заработано</div>
                </div>
                <div class="wallet-stat-card">
                    <div class="wallet-stat-icon">⚖️</div>
                    <div class="wallet-stat-value ${profitClass}">${profitSign}${profit.toFixed(2)}</div>
                    <div class="wallet-stat-label">Профит</div>
                </div>
            </div>
            
            <div class="wallet-actions">
                <button id="topupBtn" class="wallet-btn primary">💸 Пополнить Stars</button>
                <button id="withdrawBtn" class="wallet-btn secondary">💳 Вывести Stars</button>
            </div>
            
            <div class="wallet-info">
                <div class="wallet-info-icon">ℹ️</div>
                <div class="wallet-info-text">
                    Минимальная сумма пополнения — <strong>10 ⭐</strong>. Максимум <strong>500 ⭐ за 12 часов</strong>.<br>
                    Вывод: комиссия <strong>2%</strong>, суточный лимит <strong>200 ⭐</strong>.
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('app').innerHTML = html;
    
    document.getElementById('topupBtn').addEventListener('click', () => {
        if (window.showTopupModal) {
            window.showTopupModal(() => {
                window.renderWalletTab();
            });
        } else {
            console.warn('showTopupModal не определён');
        }
    });
    
    document.getElementById('withdrawBtn').addEventListener('click', async () => {
        // Получаем данные о лимите вывода
        const dailyLimit = 200;
        const today = new Date().toISOString().slice(0,10);
        const { data: withdrawals } = await window.supabase
            .from('withdrawals')
            .select('amount')
            .eq('user_id', window.userId)
            .gte('created_at', today);
        const totalToday = withdrawals.reduce((s, w) => s + w.amount / 100, 0);
        const available = dailyLimit - totalToday;
        
        const amount = parseFloat(prompt(
            `Введите сумму для вывода (комиссия 2%, суточный лимит ${dailyLimit} ⭐, осталось ${available.toFixed(2)} ⭐):`,
            "10"
        ));
        if (isNaN(amount) || amount < 1) return;
        try {
            const result = await window.withdrawWithFee(window.userId, amount);
            window.showToast(`✅ Заявка на вывод ${result.receive.toFixed(2)} ⭐ (комиссия ${result.fee} ⭐) отправлена`);
            window.renderWalletTab();
        } catch(e) {
            window.showCustomModal('Ошибка', e.message);
        }
    });
};
