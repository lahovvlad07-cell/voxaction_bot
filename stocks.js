// stocks.js – стабильная версия, не конфликтует с другими вкладками
let currentTimeframe = '30d';
let realtimeChannel = null;

function getInputMode(formId, defaultMode = 'slider') {
    const saved = localStorage.getItem(`input_mode_${formId}`);
    return saved === 'number' ? 'number' : defaultMode;
}
function setInputMode(formId, mode) {
    localStorage.setItem(`input_mode_${formId}`, mode);
}

// ========== ГРАФИК ==========
window.fetchPriceHistoryForTimeframe = async function(timeframe) {
    let startDate = new Date();
    if (timeframe === '1d') startDate.setDate(startDate.getDate() - 1);
    else if (timeframe === '7d') startDate.setDate(startDate.getDate() - 7);
    else startDate.setDate(startDate.getDate() - 30);
    const { data, error } = await window.supabase
        .from('price_history')
        .select('price, created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })
        .limit(100);
    if (error) throw new Error(error.message);
    return data || [];
};

function drawCanvasChartWithAxes(history) {
    const container = document.getElementById('stocks-chart-container');
    if (!container) return;
    container.innerHTML = '';
    if (!history || history.length === 0) {
        container.innerHTML = '<p class="stocks-chart-placeholder">Нет данных для графика. Появятся после первых сделок.</p>';
        return;
    }
    const canvas = document.createElement('canvas');
    const width = container.clientWidth, height = 220;
    canvas.width = width; canvas.height = height;
    canvas.style.width = '100%'; canvas.style.height = 'auto';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const values = history.map(h => h.price / 100);
    const max = Math.max(...values), min = Math.min(...values), range = max - min;
    const padding = { top: 20, bottom: 30, left: 45, right: 20 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    const stepX = graphWidth / (values.length - 1);
    
    ctx.fillStyle = '#0f1320';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#eef2ff';
    ctx.font = '10px sans-serif';
    const ySteps = 5;
    for (let i = 0; i <= ySteps; i++) {
        const price = min + (range * i / ySteps);
        const y = padding.top + graphHeight - (i / ySteps) * graphHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.stroke();
        ctx.fillText(price.toFixed(2), padding.left - 35, y + 3);
    }
    ctx.beginPath();
    ctx.strokeStyle = '#2b6e9e';
    ctx.lineWidth = 2;
    for (let i = 0; i < values.length; i++) {
        const x = padding.left + i * stepX;
        let y = (range === 0) ? padding.top + graphHeight/2 : padding.top + graphHeight - ((values[i] - min) / range) * graphHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    if (history.length) {
        const firstDate = new Date(history[0].created_at).toLocaleDateString();
        const lastDate = new Date(history[history.length-1].created_at).toLocaleDateString();
        const midIndex = Math.floor(history.length/2);
        const midDate = new Date(history[midIndex].created_at).toLocaleDateString();
        ctx.fillStyle = '#9ca3af';
        ctx.fillText(firstDate, padding.left, height - padding.bottom + 15);
        ctx.fillText(midDate, padding.left + graphWidth/2 - 20, height - padding.bottom + 15);
        ctx.fillText(lastDate, width - padding.right - 40, height - padding.bottom + 15);
    }

    const tooltip = document.createElement('div');
    tooltip.className = 'stocks-chart-tooltip';
    tooltip.style.display = 'none';
    container.appendChild(tooltip);
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        let minDist = Infinity, idx = -1;
        for (let i = 0; i < values.length; i++) {
            const x = padding.left + i * stepX;
            const dist = Math.abs(mouseX - x);
            if (dist < minDist && dist < 20) { minDist = dist; idx = i; }
        }
        if (idx !== -1) {
            const price = values[idx].toFixed(2);
            const date = new Date(history[idx].created_at).toLocaleString();
            tooltip.style.display = 'block';
            tooltip.innerHTML = `💰 ${price} ⭐<br>📅 ${date}`;
            tooltip.style.left = (padding.left + idx * stepX + 15) + 'px';
            tooltip.style.top = (padding.top + graphHeight - ((values[idx] - min) / range) * graphHeight - 30) + 'px';
        } else tooltip.style.display = 'none';
    });
    canvas.addEventListener('mouseleave', () => tooltip.style.display = 'none');
}

// ========== ТИКЕР ==========
async function updateTicker() {
    const trades = await window.getRecentTrades(10);
    const container = document.getElementById('stocks-ticker');
    if (!container) return;
    if (!trades.length) { container.innerHTML = '<div class="stocks-ticker-content">Нет сделок</div>'; return; }
    const items = trades.map(t => `<span class="stocks-trade-item">${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐</span>`).join('');
    container.innerHTML = `<div class="stocks-ticker-content">${items}</div>`;
}

// ========== ПРОЦЕНТ ИЗМЕНЕНИЯ СРЕДНЕЙ ЦЕНЫ ==========
async function getAvgPriceChange() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 3600 * 1000);
    const { data: todayData } = await window.supabase
        .from('trades')
        .select('amount, price_per_share')
        .gte('created_at', dayAgo.toISOString());
    const { data: yesterdayData } = await window.supabase
        .from('trades')
        .select('amount, price_per_share')
        .lt('created_at', dayAgo.toISOString())
        .gte('created_at', twoDaysAgo.toISOString());
    
    function avgPrice(trades) {
        if (!trades.length) return 0;
        let totalAmount = 0, totalStars = 0;
        for (let t of trades) {
            totalAmount += t.amount;
            totalStars += t.amount * t.price_per_share;
        }
        return totalAmount ? totalStars / totalAmount / 100 : 0;
    }
    const todayAvg = avgPrice(todayData);
    const yesterdayAvg = avgPrice(yesterdayData);
    if (yesterdayAvg === 0) return { percent: 0, isPositive: false };
    const change = ((todayAvg - yesterdayAvg) / yesterdayAvg) * 100;
    return { percent: Math.abs(change).toFixed(2), isPositive: change >= 0 };
}

// ========== РЫНОЧНЫЕ ОПЕРАЦИИ (МОДАЛКИ) ==========
function showMarketBuyModal() {
    const currentPrice = (window.currentPriceCached / 100).toFixed(2);
    const modalHtml = `
        <div class="modal stocks-market-modal" id="marketBuyModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeMarketBuyModal">&times;</span>
                <h3>🚀 Рыночная покупка</h3>
                <div class="stocks-current-price-info">Текущая цена: <strong>${currentPrice} ⭐</strong> за акцию</div>
                <input type="number" id="marketBuyStars" placeholder="Сумма в Stars (мин 1)" min="1" step="1">
                <div class="stocks-modal-buttons-row">
                    <button id="confirmMarketBuyBtn" class="buy-confirm-btn">Купить</button>
                    <button id="cancelMarketBuyBtn" class="secondary">Отмена</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('marketBuyModal');
    document.getElementById('closeMarketBuyModal').onclick = () => modal.remove();
    document.getElementById('cancelMarketBuyBtn').onclick = () => modal.remove();
    document.getElementById('confirmMarketBuyBtn').onclick = async () => {
        const stars = parseFloat(document.getElementById('marketBuyStars').value);
        if (isNaN(stars) || stars < 1) { window.showCustomModal('Ошибка', 'Введите сумму от 1 ⭐'); return; }
        modal.remove();
        try { await marketBuy(stars); } catch (err) { window.showCustomModal('Ошибка', err.message); }
    };
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function showMarketSellModal() {
    const currentPrice = (window.currentPriceCached / 100).toFixed(2);
    const maxShares = window.fromCents(window.currentUser.shares);
    const modalHtml = `
        <div class="modal stocks-market-modal" id="marketSellModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeMarketSellModal">&times;</span>
                <h3>📉 Рыночная продажа</h3>
                <div class="stocks-current-price-info">Текущая цена: <strong>${currentPrice} ⭐</strong> за акцию</div>
                <input type="number" id="marketSellShares" placeholder="Количество акций (макс ${maxShares})" min="0.01" step="0.01">
                <div class="stocks-modal-buttons-row">
                    <button id="confirmMarketSellBtn" class="buy-confirm-btn">Продать</button>
                    <button id="cancelMarketSellBtn" class="secondary">Отмена</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('marketSellModal');
    document.getElementById('closeMarketSellModal').onclick = () => modal.remove();
    document.getElementById('cancelMarketSellBtn').onclick = () => modal.remove();
    document.getElementById('confirmMarketSellBtn').onclick = async () => {
        const shares = parseFloat(document.getElementById('marketSellShares').value);
        if (isNaN(shares) || shares < 0.01) { window.showCustomModal('Ошибка', 'Введите количество от 0.01'); return; }
        if (shares > parseFloat(maxShares)) { window.showCustomModal('Ошибка', `У вас только ${maxShares} акций`); return; }
        modal.remove();
        try { await marketSell(shares); } catch (err) { if (!err.message.includes('Не удалось продать')) window.showCustomModal('Ошибка', err.message); }
    };
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

async function marketBuy(starsAmountStars) { /* ... код из предыдущей стабильной версии ... */ }
async function marketSell(sharesAmountStars) { /* ... код из предыдущей стабильной версии ... */ }

// ========== СТАКАН ЗАЯВОК ==========
async function renderOrderBook() {
    const { data: sellsRaw } = await window.supabase.from('orders').select('amount, price_per_share, seller_id').eq('status', 'active').order('price_per_share', { ascending: true }).limit(3);
    const { data: buysRaw } = await window.supabase.from('buy_orders').select('amount, price_per_share, buyer_id').eq('status', 'active').order('price_per_share', { ascending: false }).limit(3);
    const userIds = [...(sellsRaw?.map(s => s.seller_id) || []), ...(buysRaw?.map(b => b.buyer_id) || [])];
    let userMap = new Map();
    if (userIds.length) {
        const { data: users } = await window.supabase.from('users').select('id, username').in('id', userIds);
        users?.forEach(u => userMap.set(u.id, u.username));
    }
    const sells = (sellsRaw || []).map(s => ({ ...s, username: userMap.get(s.seller_id) || `user_${s.seller_id}` }));
    const buys = (buysRaw || []).map(b => ({ ...b, username: userMap.get(b.buyer_id) || `user_${b.buyer_id}` }));
    const bestSellPrice = sells.length ? sells[0].price_per_share : null;
    const bestBuyPrice = buys.length ? buys[0].price_per_share : null;
    const sellHtml = sells.map(s => `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05); ${s.price_per_share === bestSellPrice ? 'background:rgba(239,68,68,0.15);' : ''}"><span>${window.fromCents(s.amount)} шт.</span><span style="color:#fbbf24;">${window.fromCents(s.price_per_share)} ⭐</span><span class="small-text">${escapeHtml(s.username)}</span></div>`).join('');
    const buyHtml = buys.map(b => `<div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05); ${b.price_per_share === bestBuyPrice ? 'background:rgba(34,197,94,0.15);' : ''}"><span>${window.fromCents(b.amount)} шт.</span><span style="color:#4ade80;">${window.fromCents(b.price_per_share)} ⭐</span><span class="small-text">${escapeHtml(b.username)}</span></div>`).join('');
    const sellDiv = document.getElementById('stocks-sellOrdersList');
    const buyDiv = document.getElementById('stocks-buyOrdersList');
    if (sellDiv) sellDiv.innerHTML = sellHtml || '<p class="stocks-empty-orders" style="text-align:center;">Нет заявок на продажу</p>';
    if (buyDiv) buyDiv.innerHTML = buyHtml || '<p class="stocks-empty-orders" style="text-align:center;">Нет заявок на покупку</p>';
}

// ========== ИСТОРИЯ ОРДЕРОВ ==========
async function loadOrderHistory() {
    const { data, error } = await window.supabase.from('orders').select('*').eq('seller_id', window.userId).in('status', ['completed', 'cancelled']).order('created_at', { ascending: false }).limit(5);
    if (error) return [];
    return data || [];
}
function renderOrderHistory(orders) {
    const container = document.getElementById('stocks-orderHistoryList');
    if (!container) return;
    if (!orders.length) { container.innerHTML = '<p class="stocks-empty-orders" style="text-align:center;">Нет завершённых ордеров</p>'; return; }
    const tableHtml = `<table class="stocks-history-table"><thead><tr><th>Кол-во (шт)</th><th>Цена (⭐)</th><th>Статус</th><th>Дата</th></tr></thead><tbody>${orders.map(o => `<tr><td>${window.fromCents(o.amount)}</td><td>${window.fromCents(o.price_per_share)}</td><td>${o.status === 'completed' ? '✅ Исполнен' : '❌ Отменён'}</td><td>${new Date(o.created_at).toLocaleString()}</td></tr>`).join('')}</tbody></table>`;
    container.innerHTML = tableHtml;
}

async function loadMyBuyOrders() { /* ... */ }
async function cancelAllSellOrders() { /* ... */ }
async function cancelAllBuyOrders() { /* ... */ }
async function cancelBuyOrder(buyOrderId) { /* ... */ }

function renderSellForm() { /* ... использует классы stocks-... */ }
function renderBuyLimitForm() { /* ... */ }
async function loadOrdersWithSellers() { /* ... */ }
function renderOrdersList(orders) { /* ... */ }
function showBuyModal(order) { /* ... */ }
function subscribeToRealtime() { /* ... */ }

// ========== ГЛАВНЫЙ РЕНДЕР ==========
window.renderStocksTab = async function(currentUser) {
    try {
        let currentPrice = 100;
        try {
            const priceData = await window.getTotalMarketCap();
            if (priceData && priceData.currentPrice && !isNaN(priceData.currentPrice)) {
                currentPrice = priceData.currentPrice;
            }
        } catch(e) { console.warn('Ошибка получения цены, используем 1.00'); }
        window.currentPriceCached = currentPrice;
        
        const allOrders = await loadOrdersWithSellers();
        const myOrders = allOrders.filter(o => o.seller_id === window.userId);
        const myBuyOrders = await loadMyBuyOrders();
        const priceHistory = await window.fetchPriceHistoryForTimeframe(currentTimeframe);
        const { totalShares, marketCap } = await window.getTotalMarketCap();
        const avg24h = await window.get24hAvgPrice();
        const orderHistory = await loadOrderHistory();
        const priceChange = await getAvgPriceChange();

        const html = `
            <div class="stocks-balance-row">
                <div class="stocks-balance-item"><div class="label">📊 Акций</div><div class="value">${window.fromCents(currentUser.shares)}</div></div>
                <div class="stocks-balance-item"><div class="label">⭐ Stars</div><div class="value">${window.fromCents(currentUser.stars_balance)}</div></div>
                <div class="stocks-balance-item price"><div class="label">💰 Цена</div><div class="value">${(currentPrice/100).toFixed(2)} ⭐</div></div>
            </div>
            <div class="stocks-market-buttons">
                <button id="stocksMarketBuyBtn" style="background: linear-gradient(135deg, #fbbf24, #f59e0b);">🚀 Рыночная покупка</button>
                <button id="stocksMarketSellBtn" style="background: linear-gradient(135deg, #f97316, #ea580c);">📉 Рыночная продажа</button>
            </div>
            <div class="stocks-info-panel">
                <div class="stocks-info-card"><div class="small-text">🏦 Рыночная капитализация</div><div class="price">${Math.round(marketCap)} ⭐</div></div>
                <div class="stocks-info-card"><div class="small-text">📦 Всего акций</div><div class="price">${(totalShares/100).toFixed(2)}</div></div>
                <div class="stocks-info-card"><div class="small-text">📈 Средняя цена (24ч)</div><div class="price">${avg24h.toFixed(2)} ⭐</div><div class="stocks-change ${priceChange.isPositive ? 'stocks-change-positive' : 'stocks-change-negative'}">${priceChange.isPositive ? '▲' : '▼'} ${priceChange.percent}%</div></div>
            </div>
            <div class="stocks-timeframe-buttons">
                <button class="stocks-timeframe-btn ${currentTimeframe === '1d' ? 'active' : ''}" data-tf="1d">1д</button>
                <button class="stocks-timeframe-btn ${currentTimeframe === '7d' ? 'active' : ''}" data-tf="7d">7д</button>
                <button class="stocks-timeframe-btn ${currentTimeframe === '30d' ? 'active' : ''}" data-tf="30d">30д</button>
                <button class="stocks-refresh-btn" id="stocksRefreshChartBtn">🔄 Обновить</button>
            </div>
            <div id="stocks-chart-container" class="stocks-chart-container"></div>
            <div id="stocks-ticker" class="stocks-ticker"></div>
            <div class="stocks-order-book-section">
                <h3>📖 Стакан заявок</h3>
                <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <div style="flex:1;"><h4 style="text-align:center;">💰 Продажа</h4><div id="stocks-sellOrdersList"></div></div>
                    <div style="flex:1;"><h4 style="text-align:center;">🏦 Покупка</h4><div id="stocks-buyOrdersList"></div></div>
                </div>
            </div>
            <div class="stocks-sell-form-wrapper"><h3>📈 Продать акции</h3>${renderSellForm()}</div>
            <div class="stocks-buy-form-wrapper"><h3>🛒 Купить акции (лимитная заявка)</h3>${renderBuyLimitForm()}</div>
            <div class="stocks-accordion-section">
                <div class="stocks-accordion-header" data-target="mySellsList">
                    <div class="stocks-accordion-title">📌 Мои ордера на продажу <span class="stocks-order-count">(${myOrders.length})</span></div>
                    <div class="stocks-accordion-icon">▼</div>
                </div>
                <div id="mySellsList" class="stocks-accordion-content collapsed">
                    ${myOrders.length ? '<div id="stocks-myOrdersList"></div><button id="cancelAllSellsBtn" class="stocks-cancel-all-btn">✖ Отменить все продажи</button>' : '<p class="stocks-empty-orders" style="text-align:center;">Нет активных ордеров на продажу</p>'}
                </div>
            </div>
            <div class="stocks-accordion-section">
                <div class="stocks-accordion-header" data-target="myBuysList">
                    <div class="stocks-accordion-title">🛒 Мои заявки на покупку <span class="stocks-order-count">(${myBuyOrders.length})</span></div>
                    <div class="stocks-accordion-icon">▼</div>
                </div>
                <div id="myBuysList" class="stocks-accordion-content collapsed">
                    ${myBuyOrders.length ? '<div id="stocks-myBuyOrdersList"></div><button id="cancelAllBuysBtn" class="stocks-cancel-all-btn">✖ Отменить все покупки</button>' : '<p class="stocks-empty-orders" style="text-align:center;">Нет активных заявок на покупку</p>'}
                </div>
            </div>
            <div class="stocks-orders-list-wrapper">
                <h3>📋 Ордера на продажу</h3>
                <div id="stocks-ordersList"></div>
            </div>
            <div class="stocks-history-wrapper">
                <h3>🗂 История моих ордеров</h3>
                <div id="stocks-orderHistoryList"></div>
            </div>
        `;

        document.getElementById('app').innerHTML = html;

        drawCanvasChartWithAxes(priceHistory);
        await updateTicker();
        await renderOrderBook();
        renderOrderHistory(orderHistory);

        // Мои ордера на продажу
        if (myOrders.length) {
            const myDiv = document.getElementById('stocks-myOrdersList');
            myDiv.innerHTML = myOrders.map(order => `<div class="stocks-order-card stocks-my-order-card" data-order='${JSON.stringify(order)}'><div class="stocks-order-card-header"><div class="stocks-order-price-big">${window.fromCents(order.price_per_share)} ⭐</div><button class="stocks-cancel-btn-small" data-id="${order.id}">Отменить</button></div><div class="stocks-order-card-body"><span class="stocks-order-amount">📦 ${window.fromCents(order.amount)} шт.</span></div></div>`).join('');
            document.querySelectorAll('#stocks-myOrdersList .stocks-cancel-btn-small').forEach(btn => { /* ... */ });
        }
        // ... остальные обработчики аналогично

        // Кнопки рыночных операций
        document.getElementById('stocksMarketBuyBtn')?.addEventListener('click', showMarketBuyModal);
        document.getElementById('stocksMarketSellBtn')?.addEventListener('click', showMarketSellModal);
        // ... остальные обработчики (аккордеоны, таймфреймы, переключение режимов, слайдеры и т.д.)

        subscribeToRealtime();
    } catch (err) {
        console.error(err);
        document.getElementById('app').innerHTML = `<div class="card error">${err.message}</div>`;
    }
};

function escapeHtml(str) { /* ... */ }
