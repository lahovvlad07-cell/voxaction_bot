// wallet.js – полностью переработанный кошелёк с онлайн-обновлением
window.renderWalletTab = async function() {
    // Загружаем актуальные данные пользователя
    const { user: freshUser } = await window.getOrCreateUser();
    window.currentUser = freshUser;
    
    const starsBalance = window.fromCents(freshUser.stars_balance);
    const sharesBalance = window.fromCents(freshUser.shares);
    
    // Статистика по сделкам
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
    
    // ---- ЛИМИТ ПОПОЛНЕНИЯ ЗА 12 ЧАСОВ ----
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
    
    // ---- ИСТОРИЯ ОПЕРАЦИЙ (последние 5) ----
    let recentOperations = [];
    try {
        const { data: ops } = await window.supabase
            .from('topup_history')
            .select('amount, created_at, type')
            .eq('user_id', window.userId)
            .order('created_at', { ascending: false })
            .limit(5);
        if (ops) recentOperations = ops;
    } catch(e) { console.warn('Ошибка загрузки истории', e); }
    
    const html = `
        <div class="wallet-container">
            <!-- Карточки баланса с неоном -->
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
            
            <!-- Прогресс-бар лимита пополнения -->
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
            
            <!-- Статистика -->
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
            
            <!-- Кнопки действий -->
            <div class="wallet-actions">
                <button id="topupBtn" class="wallet-btn primary">💸 Пополнить Stars</button>
                <button id="withdrawBtn" class="wallet-btn secondary">🎁 Вывести через подарки</button>
            </div>
            
            <!-- История операций -->
            <div class="wallet-history">
                <div class="wallet-history-title">📜 Последние операции</div>
                <div class="wallet-history-list">
                    ${recentOperations.length ? recentOperations.map(op => `
                        <div class="wallet-history-item">
                            <span class="wallet-history-type ${op.type === 'topup' ? 'topup' : 'withdraw'}">
                                ${op.type === 'topup' ? '⬆ Пополнение' : '⬇ Вывод'}
                            </span>
                            <span class="wallet-history-amount">${(op.amount / 100).toFixed(2)} ⭐</span>
                            <span class="wallet-history-date">${new Date(op.created_at).toLocaleDateString()}</span>
                        </div>
                    `).join('') : '<div class="wallet-history-empty">Нет операций</div>'}
                </div>
            </div>
            
            <!-- Информация о лимитах -->
            <div class="wallet-info">
                <div class="wallet-info-icon">ℹ️</div>
                <div class="wallet-info-text">
                    Минимальная сумма пополнения — <strong>100 ⭐</strong>. Максимум <strong>500 ⭐ за 12 часов</strong>. Комиссия 5%.
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('app').innerHTML = html;
    
    // ---- ОБРАБОТЧИК ПОПОЛНЕНИЯ с обновлением ----
    document.getElementById('topupBtn').addEventListener('click', () => {
        if (window.showTopupModal) {
            window.showTopupModal(() => {
                // Callback после успешного пополнения
                window.renderWalletTab();
            });
        } else {
            console.warn('showTopupModal не определён');
        }
    });
    
    document.getElementById('withdrawBtn').addEventListener('click', () => {
        window.tg.openTelegramLink('https://t.me/VoxAction_Bot?start=withdraw_gifts');
    });
};
