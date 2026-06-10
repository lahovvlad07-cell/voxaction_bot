// wallet.js – профессиональный кошелёк
window.renderWalletTab = async function() {
    const currentUser = window.currentUser;
    // Получаем актуальные балансы (делим на 100)
    const starsBalance = window.fromCents(currentUser.stars_balance);
    const sharesBalance = window.fromCents(currentUser.shares);
    
    // Дополнительная статистика из сделок пользователя
    let totalSpent = 0;
    let totalEarned = 0;
    try {
        const { data: trades } = await window.supabase
            .from('trades')
            .select('buyer_id, seller_id, total_stars')
            .or(`seller_id.eq.${window.userId},buyer_id.eq.${window.userId}`);
        if (trades) {
            totalSpent = trades.filter(t => t.buyer_id === window.userId).reduce((s, t) => s + t.total_stars, 0);
            totalEarned = trades.filter(t => t.seller_id === window.userId).reduce((s, t) => s + t.total_stars, 0);
            totalSpent = totalSpent / 100;
            totalEarned = totalEarned / 100;
        }
    } catch(e) { console.warn(e); }
    
    const profit = totalEarned - totalSpent;
    
    const html = `
        <div class="wallet-container">
            <!-- Балансы -->
            <div class="balance-row">
                <div class="balance-card">
                    <div class="bal-label">⭐ Stars</div>
                    <div class="bal-value">${starsBalance}</div>
                </div>
                <div class="balance-card">
                    <div class="bal-label">📊 Акции</div>
                    <div class="bal-value">${sharesBalance}</div>
                </div>
            </div>
            
            <!-- Дополнительная статистика -->
            <div class="stats-row">
                <div class="stat-card">
                    <div class="stat-icon">💸</div>
                    <div class="stat-value">${totalSpent.toFixed(2)}</div>
                    <div class="stat-label">Потрачено</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">💰</div>
                    <div class="stat-value">${totalEarned.toFixed(2)}</div>
                    <div class="stat-label">Заработано</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon ${profit >= 0 ? 'positive' : 'negative'}">⚖️</div>
                    <div class="stat-value ${profit >= 0 ? 'positive' : 'negative'}">${profit.toFixed(2)}</div>
                    <div class="stat-label">Профит</div>
                </div>
            </div>
            
            <!-- Кнопки действий -->
            <div class="wallet-actions">
                <button id="topupBtn" class="wallet-btn primary">💸 Пополнить Stars</button>
                <button id="withdrawBtn" class="wallet-btn secondary">🎁 Вывести через подарки</button>
            </div>
            
            <div class="wallet-note">
                <span>ℹ️ Минимальная сумма пополнения — 100 ⭐. Комиссия 5%.</span>
            </div>
        </div>
    `;
    
    document.getElementById('app').innerHTML = html;
    
    // Обработчики кнопок
    document.getElementById('topupBtn').addEventListener('click', () => {
        const modal = document.getElementById('topupModal');
        if (modal) modal.style.display = 'flex';
        else console.warn('Модалка пополнения не найдена');
    });
    
    document.getElementById('withdrawBtn').addEventListener('click', () => {
        window.tg.openTelegramLink('https://t.me/VoxAction_Bot?start=withdraw_gifts');
    });
};
