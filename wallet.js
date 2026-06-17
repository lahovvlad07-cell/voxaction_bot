// wallet.js – кошелёк с кнопкой "Последние операции" по центру, загружает 10 последних пополнений
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
                <button id="withdrawBtn" class="wallet-btn secondary">🎁 Вывести через подарки</button>
            </div>
            
            <!-- Кнопка "Последние операции" по центру -->
            <div style="display: flex; justify-content: center; margin: 20px 0 12px;">
                <button id="toggleHistoryBtn" class="wallet-btn secondary" style="width: auto; padding: 10px 24px; border-radius: 40px; background: rgba(255,255,255,0.05); border: 1px solid rgba(0,255,255,0.3); color: #0ff; font-size: 14px; cursor: pointer;">
                    📜 Последние операции
                </button>
            </div>
            <div id="walletHistoryContainer" style="display: none; margin-bottom: 20px;">
                <div class="wallet-history-list" id="walletHistoryList"></div>
            </div>
            
            <div class="wallet-info">
                <div class="wallet-info-icon">ℹ️</div>
                <div class="wallet-info-text">
                    Минимальная сумма пополнения — <strong>10 ⭐</strong>. Максимум <strong>500 ⭐ за 12 часов</strong>. Комиссия 5%.
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
    
    document.getElementById('withdrawBtn').addEventListener('click', () => {
        window.tg.openTelegramLink('https://t.me/VoxAction_Bot?start=withdraw_gifts');
    });
    
    // Обработчик для кнопки "Последние операции"
    const toggleBtn = document.getElementById('toggleHistoryBtn');
    const historyContainer = document.getElementById('walletHistoryContainer');
    const historyList = document.getElementById('walletHistoryList');
    let historyLoaded = false;
    
    toggleBtn.addEventListener('click', async () => {
        if (historyContainer.style.display === 'none') {
            if (!historyLoaded) {
                try {
                    const { data: ops } = await window.supabase
                        .from('topup_history')
                        .select('amount, created_at, type')
                        .eq('user_id', window.userId)
                        .order('created_at', { ascending: false })
                        .limit(10);
                    if (ops && ops.length) {
                        historyList.innerHTML = ops.map(op => `
                            <div class="wallet-history-item">
                                <span class="wallet-history-type ${op.type === 'topup' ? 'topup' : 'withdraw'}">
                                    ${op.type === 'topup' ? '⬆ Пополнение' : '⬇ Вывод'}
                                </span>
                                <span class="wallet-history-amount">${(op.amount / 100).toFixed(2)} ⭐</span>
                                <span class="wallet-history-date">${new Date(op.created_at).toLocaleDateString()}</span>
                            </div>
                        `).join('');
                    } else {
                        historyList.innerHTML = '<div class="wallet-history-empty">Нет операций</div>';
                    }
                } catch(e) {
                    console.warn('Ошибка загрузки истории', e);
                    historyList.innerHTML = '<div class="wallet-history-empty">Ошибка загрузки</div>';
                }
                historyLoaded = true;
            }
            historyContainer.style.display = 'block';
            toggleBtn.textContent = '🔼 Скрыть операции';
        } else {
            historyContainer.style.display = 'none';
            toggleBtn.textContent = '📜 Последние операции';
        }
    });
};
