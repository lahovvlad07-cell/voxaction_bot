// wallet.js – кошелёк с выводом Stars

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
                <button id="withdrawBtn" class="wallet-btn secondary">💸 Вывод Stars</button>
            </div>
            
            <div style="margin-top:16px; border-top:1px solid rgba(255,255,255,0.1); padding-top:16px;">
                <h3 style="text-align:center; font-size:16px; margin-bottom:12px;">📋 История выводов</h3>
                <div id="withdrawHistory"></div>
            </div>
            
            <div class="wallet-info">
                <div class="wallet-info-icon">ℹ️</div>
                <div class="wallet-info-text">
                    Минимальная сумма пополнения — <strong>10 ⭐</strong>. Максимум <strong>500 ⭐ за 12 часов</strong>. Комиссия 5%.
                    <br>Минимальная сумма вывода — <strong>10 ⭐</strong>.
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
        const amount = parseInt(prompt('Введите сумму для вывода (минимум 10 ⭐):', '10'));
        if (!amount || amount < 10) {
            window.showCustomModal('Ошибка', 'Минимальная сумма вывода – 10 ⭐');
            return;
        }
        try {
            await window.createWithdrawal(amount);
            window.showToast('✅ Заявка на вывод отправлена');
            window.renderWalletTab();
        } catch(e) {
            window.showCustomModal('Ошибка', e.message);
        }
    });
    
    async function loadWithdrawHistory() {
        const list = await window.getWithdrawals();
        const container = document.getElementById('withdrawHistory');
        if (!list.length) {
            container.innerHTML = '<p style="color:#9ca3af; font-size:13px;">Нет заявок</p>';
            return;
        }
        container.innerHTML = list.map(w => `
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span>${window.fromCents(w.amount)} ⭐</span>
                <span style="color:${w.status === 'pending' ? '#fbbf24' : w.status === 'approved' ? '#4ade80' : '#f87171'}">${w.status === 'pending' ? '⏳ На рассмотрении' : w.status === 'approved' ? '✅ Одобрен' : '❌ Отклонён'}</span>
            </div>
        `).join('');
    }
    loadWithdrawHistory();
};
