// stocks.js – стабильная версия с префиксами stocks- для классов
let currentTimeframe = '30d';
let realtimeChannel = null;

window.fetchPriceHistoryForTimeframe = async function(timeframe) {
    let startDate = new Date();
    if (timeframe === '1d') startDate.setDate(startDate.getDate() - 1);
    else if (timeframe === '7d') startDate.setDate(startDate.getDate() - 7);
    else startDate.setDate(startDate.getDate() - 30);
    const { data, error } = await window.supabase.from('price_history').select('price, created_at').gte('created_at', startDate.toISOString()).order('created_at', { ascending: true }).limit(100);
    if (error) throw new Error(error.message);
    return data || [];
};

function drawCanvasChartWithAxes(history) {
    const container = document.getElementById('stocks-chart-container');
    if (!container) return;
    container.innerHTML = '';
    if (!history || history.length === 0) { container.innerHTML = '<p class="stocks-chart-placeholder" style="text-align:center;">Нет данных для графика</p>'; return; }
    const canvas = document.createElement('canvas');
    const width = container.clientWidth, height = 200;
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
        ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.stroke();
        ctx.fillText(price.toFixed(2), padding.left - 35, y + 3);
    }
    ctx.beginPath(); ctx.strokeStyle = '#2b6e9e'; ctx.lineWidth = 2;
    for (let i = 0; i < values.length; i++) {
        const x = padding.left + i * stepX;
        let y = (range === 0) ? padding.top + graphHeight/2 : padding.top + graphHeight - ((values[i] - min) / range) * graphHeight;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
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

async function updateTicker() {
    const trades = await window.getRecentTrades(10);
    const container = document.getElementById('stocks-ticker');
    if (!container) return;
    if (!trades.length) { container.innerHTML = '<div class="stocks-ticker-content">Нет сделок</div>'; return; }
    const items = trades.map(t => `<span class="stocks-trade-item">${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐</span>`).join('');
    container.innerHTML = `<div class="stocks-ticker-content">${items}</div>`;
}

async function getAvgPriceChange() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 3600 * 1000);
    const { data: todayData } = await window.supabase.from('trades').select('amount, price_per_share').gte('created_at', dayAgo.toISOString());
    const { data: yesterdayData } = await window.supabase.from('trades').select('amount, price_per_share').lt('created_at', dayAgo.toISOString()).gte('created_at', twoDaysAgo.toISOString());
    function avgPrice(trades) {
        if (!trades.length) return 0;
        let totalAmount = 0, totalStars = 0;
        for (let t of trades) { totalAmount += t.amount; totalStars += t.amount * t.price_per_share; }
        return totalAmount ? totalStars / totalAmount / 100 : 0;
    }
    const todayAvg = avgPrice(todayData);
    const yesterdayAvg = avgPrice(yesterdayData);
    if (yesterdayAvg === 0) return { percent: 0, isPositive: false };
    const change = ((todayAvg - yesterdayAvg) / yesterdayAvg) * 100;
    return { percent: Math.abs(change).toFixed(2), isPositive: change >= 0 };
}

function showMarketBuyModal() {
    const currentPrice = (window.currentPriceCached / 100).toFixed(2);
    const modalHtml = `<div class="modal" id="marketBuyModal" style="display:flex;"><div class="modal-content"><span class="close-modal" id="closeMarketBuyModal">&times;</span><h3>🚀 Рыночная покупка</h3><div class="stocks-current-price-info">Текущая цена: <strong>${currentPrice} ⭐</strong> за акцию</div><input type="number" id="marketBuyStars" placeholder="Сумма в Stars (мин 1)" min="1" step="1"><div class="stocks-modal-buttons-row"><button id="confirmMarketBuyBtn">Купить</button><button id="cancelMarketBuyBtn">Отмена</button></div></div></div>`;
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
}

function showMarketSellModal() {
    const currentPrice = (window.currentPriceCached / 100).toFixed(2);
    const maxShares = window.fromCents(window.currentUser.shares);
    const modalHtml = `<div class="modal" id="marketSellModal" style="display:flex;"><div class="modal-content"><span class="close-modal" id="closeMarketSellModal">&times;</span><h3>📉 Рыночная продажа</h3><div class="stocks-current-price-info">Текущая цена: <strong>${currentPrice} ⭐</strong> за акцию</div><input type="number" id="marketSellShares" placeholder="Количество акций (макс ${maxShares})" min="0.01" step="0.01"><div class="stocks-modal-buttons-row"><button id="confirmMarketSellBtn">Продать</button><button id="cancelMarketSellBtn">Отмена</button></div></div></div>`;
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
}

async function marketBuy(starsAmountStars) { /* ... сохраните реализацию из предыдущей стабильной версии ... */ }
async function marketSell(sharesAmountStars) { /* ... сохраните ... */ }

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
    if (sellDiv) sellDiv.innerHTML = sellHtml || '<p class="stocks-empty-orders">Нет заявок на продажу</p>';
    if (buyDiv) buyDiv.innerHTML = buyHtml || '<p class="stocks-empty-orders">Нет заявок на покупку</p>';
}

async function loadOrderHistory() {
    const { data, error } = await window.supabase.from('orders').select('*').eq('seller_id', window.userId).in('status', ['completed', 'cancelled']).order('created_at', { ascending: false }).limit(5);
    if (error) return [];
    return data || [];
}
function renderOrderHistory(orders) {
    const container = document.getElementById('stocks-orderHistoryList');
    if (!container) return;
    if (!orders.length) { container.innerHTML = '<p class="stocks-empty-orders">Нет завершённых ордеров</p>'; return; }
    const tableHtml = `<table class="stocks-history-table"><thead><tr><th>Кол-во (шт)</th><th>Цена (⭐)</th><th>Статус</th><th>Дата</th></tr></thead><tbody>${orders.map(o => `<tr><td>${window.fromCents(o.amount)}</td><td>${window.fromCents(o.price_per_share)}</td><td>${o.status === 'completed' ? '✅ Исполнен' : '❌ Отменён'}</td><td>${new Date(o.created_at).toLocaleString()}</td></tr>`).join('')}</tbody></table>`;
    container.innerHTML = tableHtml;
}

async function loadMyBuyOrders() {
    const { data, error } = await window.supabase.from('buy_orders').select('*').eq('buyer_id', window.userId).eq('status', 'active').order('created_at', { ascending: false });
    if (error) return [];
    return data || [];
}
async function cancelAllSellOrders() {
    const { data: orders, error } = await window.supabase.from('orders').select('id').eq('seller_id', window.userId).eq('status', 'active');
    if (error) throw new Error(error.message);
    if (!orders.length) { window.showToast('У вас нет активных ордеров на продажу'); return; }
    for (let order of orders) await window.cancelOrder(order.id);
    window.showToast(`✅ Отменено ${orders.length} ордеров на продажу`);
    await window.refreshActiveTab();
}
async function cancelAllBuyOrders() {
    const { data: orders, error } = await window.supabase.from('buy_orders').select('id').eq('buyer_id', window.userId).eq('status', 'active');
    if (error) throw new Error(error.message);
    if (!orders.length) { window.showToast('У вас нет активных заявок на покупку'); return; }
    for (let order of orders) await window.cancelBuyOrder(order.id);
    window.showToast(`✅ Отменено ${orders.length} заявок на покупку`);
    await window.refreshActiveTab();
}
async function cancelBuyOrder(buyOrderId) {
    const { data, error } = await window.supabase.rpc('cancel_buy_order', { p_buy_order_id: buyOrderId, p_user_id: window.userId });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    return true;
}
function renderSellForm() {
    return `<div><input type="number" id="stocks-sellAmount" step="0.01" min="1" placeholder="Количество (от 1)"><input type="number" id="stocks-sellPrice" step="0.01" min="1" placeholder="Цена (от 1 Star)"><button id="stocks-sellBtn">➕ Выставить на продажу</button></div>`;
}
function renderBuyLimitForm() {
    return `<div><input type="number" id="stocks-buyAmountLimit" step="0.01" min="1" placeholder="Количество (от 1)"><input type="number" id="stocks-buyPriceLimit" step="0.01" min="1" placeholder="Цена (от 1 Star)"><button id="stocks-buyLimitBtn">💰 Выставить заявку на покупку</button></div>`;
}
async function loadOrdersWithSellers() {
    const orders = await window.getActiveOrders();
    if (!orders.length) return [];
    const sellerIds = [...new Set(orders.map(o => o.seller_id))];
    const { data: users } = await window.supabase.from('users').select('id, username, avatar_url').in('id', sellerIds);
    const userMap = new Map(users?.map(u => [u.id, u]) || []);
    for (let o of orders) {
        const user = userMap.get(o.seller_id);
        o.seller_name = user?.username || `user_${o.seller_id}`;
        o.seller_avatar = user?.avatar_url || '👤';
        o.seller_rating = await window.getSellerRating(o.seller_id);
    }
    return orders;
}
function renderOrdersList(orders) {
    const container = document.getElementById('stocks-ordersList');
    if (!container) return;
    const filtered = orders.filter(o => o.seller_id !== window.userId);
    if (!filtered.length) { container.innerHTML = '<p class="stocks-empty-orders">Нет ордеров для отображения</p>'; return; }
    filtered.sort((a,b) => a.price_per_share - b.price_per_share);
    const bestPrice = Math.min(...filtered.map(o => o.price_per_share));
    let html = '';
    for (let order of filtered) {
        const isBest = order.price_per_share === bestPrice;
        const avatarMini = window.renderAvatarHtml(order.seller_avatar, null, null, '32px');
        html += `<div class="stocks-order-card ${isBest ? 'stocks-order-card-best' : ''}" data-order='${JSON.stringify(order)}'><div class="stocks-order-card-header"><div class="stocks-seller-info">${avatarMini}<span class="stocks-seller-name">${escapeHtml(order.seller_name)}</span>${order.seller_rating ? `<span class="stars-rating">${'★'.repeat(Math.floor(order.seller_rating))}</span>` : ''}</div><div class="stocks-order-price-big">${window.fromCents(order.price_per_share)} ⭐</div></div><div class="stocks-order-card-body"><span class="stocks-order-amount">📦 ${window.fromCents(order.amount)} шт.</span><button class="stocks-buy-btn">Купить</button></div></div>`;
    }
    container.innerHTML = html;
    document.querySelectorAll('.stocks-buy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const order = JSON.parse(btn.closest('.stocks-order-card').dataset.order);
            showBuyModal(order);
        });
    });
}
function showBuyModal(order) {
    const maxShares = window.fromCents(order.amount);
    const pricePerShare = window.fromCents(order.price_per_share);
    const modalHtml = `<div class="modal" id="buyModal" style="display:flex;"><div class="modal-content" style="max-width:320px;"><span class="close-modal" id="closeBuyModal">&times;</span><h3>Покупка акций</h3><div class="buy-price">Цена: <strong>${pricePerShare} ⭐</strong> / шт.</div><div class="buy-available">Доступно: <strong>${maxShares}</strong> шт.</div><div class="buy-amount-row"><input type="number" id="buyAmount" value="1" step="0.01" min="1" max="${maxShares}" placeholder="Количество"><button id="buyMaxBtn" class="max-btn">Макс</button></div><div class="buy-total">Итого: <span id="totalPrice">${pricePerShare}</span> ⭐</div><button id="confirmBuyBtn" class="buy-confirm-btn">Подтвердить</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('buyModal');
    const amountInput = document.getElementById('buyAmount');
    const totalSpan = document.getElementById('totalPrice');
    const updateTotal = () => { let amount = parseFloat(amountInput.value) || 0; totalSpan.innerText = (amount * pricePerShare).toFixed(2); };
    amountInput.addEventListener('input', updateTotal);
    document.getElementById('buyMaxBtn').onclick = () => { amountInput.value = maxShares; updateTotal(); };
    document.getElementById('closeBuyModal').onclick = () => modal.remove();
    document.getElementById('confirmBuyBtn').onclick = async () => {
        let amount = parseFloat(amountInput.value);
        if (isNaN(amount) || amount < 1 || amount > maxShares) { window.showCustomModal('Ошибка', 'Некорректное количество'); return; }
        try {
            await window.executePartialTrade(order.id, window.toCents(amount));
            window.showCustomModal('Успех', 'Сделка завершена');
            modal.remove();
            await window.refreshActiveTab();
        } catch (err) { window.showCustomModal('Ошибка', err.message); }
    };
}
function subscribeToRealtime() { /* ... без изменений ... */ }

window.renderStocksTab = async function(currentUser) {
    try {
        let currentPrice = 100;
        try {
            const priceData = await window.getTotalMarketCap();
            if (priceData && priceData.currentPrice && !isNaN(priceData.currentPrice)) currentPrice = priceData.currentPrice;
        } catch(e) {}
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
                <div class="stocks-balance-item"><div class="label">💰 Цена</div><div class="value">${(currentPrice/100).toFixed(2)} ⭐</div></div>
            </div>
            <div class="stocks-market-buttons">
                <button id="stocksMarketBuyBtn">🚀 Рыночная покупка</button>
                <button id="stocksMarketSellBtn">📉 Рыночная продажа</button>
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
            <div><h3>📖 Стакан заявок</h3><div id="stocks-sellOrdersList"></div><div id="stocks-buyOrdersList"></div></div>
            <div><h3>📈 Продать акции</h3>${renderSellForm()}</div>
            <div><h3>🛒 Купить акции (лимитная заявка)</h3>${renderBuyLimitForm()}</div>
            <div><h3>📌 Мои ордера на продажу (${myOrders.length})</h3><div id="stocks-myOrdersList"></div>${myOrders.length ? '<button id="stocks-cancelAllSellsBtn" class="stocks-cancel-all-btn">✖ Отменить все продажи</button>' : ''}</div>
            <div><h3>🛒 Мои заявки на покупку (${myBuyOrders.length})</h3><div id="stocks-myBuyOrdersList"></div>${myBuyOrders.length ? '<button id="stocks-cancelAllBuysBtn" class="stocks-cancel-all-btn">✖ Отменить все покупки</button>' : ''}</div>
            <div><h3>📋 Ордера на продажу</h3><div id="stocks-ordersList"></div></div>
            <div><h3>🗂 История моих ордеров</h3><div id="stocks-orderHistoryList"></div></div>
        `;
        document.getElementById('app').innerHTML = html;

        drawCanvasChartWithAxes(priceHistory);
        await updateTicker();
        await renderOrderBook();
        renderOrderHistory(orderHistory);

        if (myOrders.length) {
            const myDiv = document.getElementById('stocks-myOrdersList');
            myDiv.innerHTML = myOrders.map(order => `<div class="stocks-order-card"><div>${window.fromCents(order.amount)} шт. по ${window.fromCents(order.price_per_share)} ⭐</div><button class="stocks-cancel-btn-small" data-id="${order.id}">Отменить</button></div>`).join('');
            document.querySelectorAll('.stocks-cancel-btn-small').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (confirm('Отменить ордер на продажу?')) { await window.cancelOrder(btn.dataset.id); await window.renderStocksTab(currentUser); }
                });
            });
        }
        if (myBuyOrders.length) {
            const buyDiv = document.getElementById('stocks-myBuyOrdersList');
            buyDiv.innerHTML = myBuyOrders.map(order => `<div class="stocks-order-card"><div>Купить ${window.fromCents(order.amount)} шт. по ${window.fromCents(order.price_per_share)} ⭐</div><button class="stocks-cancel-buy-btn" data-id="${order.id}">Отменить</button></div>`).join('');
            document.querySelectorAll('.stocks-cancel-buy-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (confirm('Отменить заявку на покупку?')) { await cancelBuyOrder(btn.dataset.id); await window.renderStocksTab(currentUser); }
                });
            });
        }
        document.getElementById('stocks-cancelAllSellsBtn')?.addEventListener('click', async () => { if (confirm('Отменить все продажи?')) await cancelAllSellOrders(); });
        document.getElementById('stocks-cancelAllBuysBtn')?.addEventListener('click', async () => { if (confirm('Отменить все покупки?')) await cancelAllBuyOrders(); });

        renderOrdersList(allOrders);

        document.querySelectorAll('.stocks-timeframe-btn').forEach(btn => btn.addEventListener('click', async () => {
            currentTimeframe = btn.dataset.tf;
            await window.renderStocksTab(currentUser);
        }));
        document.getElementById('stocksRefreshChartBtn')?.addEventListener('click', async () => { await window.renderStocksTab(currentUser); });
        document.getElementById('stocks-sellBtn')?.addEventListener('click', async () => {
            let amount = parseFloat(document.getElementById('stocks-sellAmount').value);
            let price = parseFloat(document.getElementById('stocks-sellPrice').value);
            if (isNaN(amount) || amount < 1 || isNaN(price) || price < 1) { window.showCustomModal('Ошибка', 'Введите количество ≥1 и цену ≥1'); return; }
            try { await window.createOrder(amount, price); await window.renderStocksTab(currentUser); } catch(e) { window.showCustomModal('Ошибка', e.message); }
        });
        document.getElementById('stocks-buyLimitBtn')?.addEventListener('click', async () => {
            let amount = parseFloat(document.getElementById('stocks-buyAmountLimit').value);
            let price = parseFloat(document.getElementById('stocks-buyPriceLimit').value);
            if (isNaN(amount) || amount < 1 || isNaN(price) || price < 1) { window.showCustomModal('Ошибка', 'Введите количество ≥1 и цену ≥1'); return; }
            try { await window.createBuyOrder(amount, price); await window.renderStocksTab(currentUser); } catch(e) { window.showCustomModal('Ошибка', e.message); }
        });
        document.getElementById('stocksMarketBuyBtn')?.addEventListener('click', showMarketBuyModal);
        document.getElementById('stocksMarketSellBtn')?.addEventListener('click', showMarketSellModal);
        subscribeToRealtime();
    } catch(e) {
        document.getElementById('app').innerHTML = `<div class="card error">${e.message}</div>`;
    }
};
function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]); }
