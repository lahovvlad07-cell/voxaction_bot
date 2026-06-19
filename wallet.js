// wallet.js – полностью переработанный кошелёк с выводом, комиссией и лимитами

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

    // ===== ВЫВОД: лимит и комиссия =====
    const dailyUsed = await window.getDailyWithdrawUsed();
    const dailyRemaining = Math.max(0, 500 - dailyUsed);
    const feePercent = 2; // 2%
    
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

            <!-- ===== НОВЫЙ БЛОК ВЫВОДА ===== -->
            <div id="withdrawSection" style="display:none; margin-top:16px; padding:16px; background:rgba(0,0,0,0.3); border-radius:20px;">
                <h3 style="text-align:center; font-size:16px; margin-bottom:8px;">💸 Вывод Stars</h3>
                <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin-bottom:8px;">
                    <button class="withdraw-preset" data-amount="10">10 ⭐</button>
                    <button class="withdraw-preset" data-amount="50">50 ⭐</button>
                    <button class="withdraw-preset" data-amount="100">100 ⭐</button>
                    <button class="withdraw-preset" data-amount="200">200 ⭐</button>
                </div>
                <input type="number" id="withdrawAmountInput" placeholder="Сумма (минимум 10 ⭐)" min="10" style="margin-bottom:8px;">
                <div style="font-size:13px; color:#9ca3af; margin-bottom:8px;">
                    <span>Комиссия: <strong id="withdrawFeeDisplay">0 ⭐</strong> (${feePercent}%)</span>
                    <span style="margin-left:16px;">Вы получите: <strong id="withdrawReceiveDisplay">0 ⭐</strong></span>
                </div>
                <div style="font-size:12px; color:#9ca3af; margin-bottom:8px;">
                    Суточный лимит: <strong>${dailyRemaining.toFixed(2)} ⭐</strong> из 500 ⭐
                </div>
                <button id="withdrawConfirmBtn" style="background:linear-gradient(135deg,#f97316,#ea580c);">Запросить вывод</button>
                <div id="withdrawHistory" style="margin-top:12px;"></div>
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
    
    // ===== КНОПКИ =====
    document.getElementById('topupBtn').addEventListener('click', () => {
        if (window.showTopupModal) {
            window.showTopupModal(() => {
                window.renderWalletTab();
            });
        }
    });

    // Показать/скрыть секцию вывода
    let withdrawVisible = false;
    document.getElementById('withdrawBtn').addEventListener('click', () => {
        withdrawVisible = !withdrawVisible;
        document.getElementById('withdrawSection').style.display = withdrawVisible ? 'block' : 'none';
        if (withdrawVisible) loadWithdrawHistory();
    });

    // ===== ПРЕСЕТЫ ВЫВОДА =====
    document.querySelectorAll('.withdraw-preset').forEach(btn => {
        btn.addEventListener('click', function() {
            const amount = parseInt(this.dataset.amount);
            document.getElementById('withdrawAmountInput').value = amount;
            updateWithdrawFee(amount);
        });
    });

    // ===== РАСЧЁТ КОМИССИИ =====
    function updateWithdrawFee(amount) {
        if (!amount || amount < 10) {
            document.getElementById('withdrawFeeDisplay').textContent = '0 ⭐';
            document.getElementById('withdrawReceiveDisplay').textContent = '0 ⭐';
            return;
        }
        const fee = Math.floor(amount * feePercent / 100);
        const receive = amount - fee;
        document.getElementById('withdrawFeeDisplay').textContent = fee + ' ⭐';
        document.getElementById('withdrawReceiveDisplay').textContent = receive + ' ⭐';
    }

    document.getElementById('withdrawAmountInput').addEventListener('input', function() {
        const val = parseFloat(this.value);
        updateWithdrawFee(val);
    });

    // ===== КНОПКА ВЫВОДА =====
    document.getElementById('withdrawConfirmBtn').addEventListener('click', async () => {
        const amount = parseFloat(document.getElementById('withdrawAmountInput').value);
        if (!amount || amount < 10) {
            window.showCustomModal('Ошибка', 'Минимальная сумма вывода – 10 ⭐');
            return;
        }
        try {
            const result = await window.createWithdrawal(amount);
            window.showToast(`✅ Заявка на вывод создана! Вы получите ${result.receive} ⭐ (комиссия ${result.fee} ⭐)`);
            document.getElementById('withdrawAmountInput').value = '';
            updateWithdrawFee(0);
            window.renderWalletTab();
        } catch(e) {
            window.showCustomModal('Ошибка', e.message);
        }
    });

    // ===== ИСТОРИЯ ВЫВОДОВ =====
    async function loadWithdrawHistory() {
        const list = await window.getWithdrawals();
        const container = document.getElementById('withdrawHistory');
        if (!list.length) {
            container.innerHTML = '<p style="color:#9ca3af; font-size:13px;">Нет заявок</p>';
            return;
        }
        container.innerHTML = list.map(w => `
            <div style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span>${window.fromCents(w.amount)} ⭐ (комиссия ${window.fromCents(w.fee)} ⭐)</span>
                <span style="color:${w.status === 'pending' ? '#fbbf24' : w.status === 'approved' ? '#4ade80' : '#f87171'}">${w.status === 'pending' ? '⏳ На рассмотрении' : w.status === 'approved' ? '✅ Одобрен' : '❌ Отклонён'}</span>
            </div>
        `).join('');
    }
    // Загружаем историю, если секция открыта
    if (withdrawVisible) loadWithdrawHistory();
};
