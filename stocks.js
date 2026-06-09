// stocks.js – финальный, исправлено отображение цены, центрирование пустых сообщений
let currentTimeframe = '30d';
let realtimeChannel = null;

// Настройки типов ввода (localStorage)
function getInputMode(formId, defaultMode = 'slider') {
    const saved = localStorage.getItem(`input_mode_${formId}`);
    return saved === 'number' ? 'number' : defaultMode;
}
function setInputMode(formId, mode) {
    localStorage.setItem(`input_mode_${formId}`, mode);
}

// ========== График ==========
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
    const container = document.getElementById('chart-container');
    if (!container) return;
    container.innerHTML = '';
    if (!history || history.length === 0) {
        container.innerHTML = '<p class="chart-placeholder">Нет данных для графика. Появятся после первых сделок.</p>';
        return;
    }
    const canvas = document.createElement('canvas');
    const width = container.clientWidth, height = 240;
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

    // Tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
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

// ========== Тикер ==========
async function updateTicker() {
    const trades = await window.getRecentTrades(10);
    const container = document.getElementById('ticker');
    if (!container) return;
    if (!trades.length) { container.innerHTML = '<div class="ticker-content">Нет сделок</div>'; return; }
    const items = trades.map(t => `<span class="trade-item">${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐</span>`).join('');
    container.innerHTML = `<div class="ticker-content">${items}</div>`;
}

// ========== Рыночные операции ==========
function showMarketBuyModal(currentPrice) {
    const modalHtml = `
        <div class="modal market-modal" id="marketBuyModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeMarketBuyModal">&times;</span>
                <h3>🚀 Рыночная покупка</h3>
                <div class="current-price-info">Текущая цена: <strong>${currentPrice} ⭐</strong> за акцию</div>
                <input type="number" id="marketBuyStars" placeholder="Сумма в Stars (мин 1)" min="1" step="1">
                <div class="modal-buttons-row">
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
        try {
            await marketBuy(stars);
        } catch (err) {
            window.showCustomModal('Ошибка', err.message);
        }
    };
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

function showMarketSellModal(currentPrice, maxShares) {
    const modalHtml = `
        <div class="modal market-modal" id="marketSellModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeMarketSellModal">&times;</span>
                <h3>📉 Рыночная продажа</h3>
                <div class="current-price-info">Текущая цена: <strong>${currentPrice} ⭐</strong> за акцию</div>
                <input type="number" id="marketSellShares" placeholder="Количество акций (макс ${maxShares})" min="1" step="0.01">
                <div class="modal-buttons-row">
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
        try {
            await marketSell(shares);
        } catch (err) {
            if (!err.message.includes('Не удалось продать')) window.showCustomModal('Ошибка', err.message);
        }
    };
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

async function marketBuy(starsAmountStars) {
    if (starsAmountStars <= 0) throw new Error('Сумма должна быть больше 0');
    let remainingStarsCents = window.toCents(starsAmountStars);
    let totalBoughtSharesCents = 0, totalSpentCents = 0;
    while (remainingStarsCents > 0) {
        const { data: sellOrders, error } = await window.supabase.from('orders').select('*').eq('status', 'active').order('price_per_share', { ascending: true }).limit(1);
        if (error) throw new Error('Ошибка загрузки ордеров');
        if (!sellOrders.length) break;
        const order = sellOrders[0];
        const priceCents = order.price_per_share;
        const availableSharesCents = order.amount;
        let maxUnits = Math.floor(remainingStarsCents / priceCents);
        if (maxUnits <= 0) break;
        let buySharesCents = maxUnits * 100;
        if (buySharesCents > availableSharesCents) buySharesCents = availableSharesCents;
        const { error: tradeError } = await window.supabase.rpc('execute_trade_partial', { p_order_id: order.id, p_buyer_id: window.userId, p_buy_amount_cents: buySharesCents });
        if (tradeError) throw new Error(`Ошибка покупки: ${tradeError.message}`);
        const costCents = (buySharesCents / 100) * priceCents;
        remainingStarsCents -= costCents;
        totalBoughtSharesCents += buySharesCents;
        totalSpentCents += costCents;
        window.currentUser.shares += buySharesCents;
        window.currentUser.stars_balance -= costCents;
        await new Promise(r => setTimeout(r, 50));
    }
    if (totalBoughtSharesCents === 0) throw new Error('Не удалось купить ни одной акции');
    window.showToast(`✅ Куплено ${window.fromCents(totalBoughtSharesCents)} шт. за ${window.fromCents(totalSpentCents)} ⭐`);
    await window.refreshActiveTab();
}
async function marketSell(sharesAmountStars) {
    if (sharesAmountStars <= 0) throw new Error('Количество должно быть больше 0');
    const userShares = window.currentUser.shares;
    if (userShares < window.toCents(sharesAmountStars)) throw new Error('Недостаточно акций для продажи');
    try {
        const { data, error } = await window.supabase.rpc('market_sell', { p_user_id: window.userId, p_amount_stars: sharesAmountStars });
        if (error) throw new Error(error.message);
        if (!data.success) throw new Error(data.error);
        if (data.sold === 0) { window.showToast('❌ Не удалось продать ни одной акции (нет подходящих ордеров на покупку)'); return; }
        window.showToast(`✅ Продано ${window.fromCents(data.sold)} шт. за ${window.fromCents(data.earned)} ⭐`);
        await window.refreshActiveTab();
    } catch (err) {
        if (err.message.includes('нет ордеров') || err.message.includes('no orders')) window.showToast('❌ Не удалось продать ни одной акции (нет подходящих ордеров на покупку)');
        else window.showCustomModal('Ошибка', err.message);
    }
}

// ========== Стакан заявок ==========
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
    const sellDiv = document.getElementById('sellOrdersList');
    const buyDiv = document.getElementById('buyOrdersList');
    if (sellDiv) sellDiv.innerHTML = sellHtml || '<p class="empty-orders">Нет заявок на продажу</p>';
    if (buyDiv) buyDiv.innerHTML = buyHtml || '<p class="empty-orders">Нет заявок на покупку</p>';
}

// ========== История ордеров ==========
async function loadOrderHistory() {
    const { data, error } = await window.supabase.from('orders').select('*').eq('seller_id', window.userId).in('status', ['completed', 'cancelled']).order('created_at', { ascending: false }).limit(5);
    if (error) return [];
    return data || [];
}
function renderOrderHistory(orders) {
    const container = document.getElementById('orderHistoryList');
    if (!container) return;
    if (!orders.length) { container.innerHTML = '<p class="empty-orders">Нет завершённых ордеров</p>'; return; }
    const tableHtml = `<table class="history-table"><thead><tr><th>Кол-во (шт)</th><th>Цена (⭐)</th><th>Статус</th><th>Дата</th></tr></thead><tbody>${orders.map(o => `<tr><td>${window.fromCents(o.amount)}</td><td>${window.fromCents(o.price_per_share)}</td><td>${o.status === 'completed' ? '✅ Исполнен' : '❌ Отменён'}</td><td>${new Date(o.created_at).toLocaleString()}</td></tr>`).join('')}</tbody></table>`;
    container.innerHTML = tableHtml;
}

// ========== Ордера пользователя ==========
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

// ========== Формы ==========
function renderSellForm() {
    const mode = getInputMode('sell', 'slider');
    const maxShares = window.fromCents(window.currentUser.shares);
    if (mode === 'slider') {
        return `
            <div class="sell-form">
                <div class="input-header">
                    <label>📦 Количество (акций)</label>
                    <button class="toggle-input-mode" data-form="sell" data-mode="number">⌨️ Поля</button>
                </div>
                <div><span id="sellAmountVal">1.00</span></div>
                <input type="range" id="sellAmountSlider" min="1" max="${maxShares}" step="0.01" value="1">
                <div class="input-header">
                    <label>⭐ Цена за акцию</label>
                </div>
                <div><span id="sellPriceVal">1.00</span></div>
                <input type="range" id="sellPriceSlider" min="1" max="100" step="0.1" value="1">
                <button id="sellBtn">➕ Выставить на продажу</button>
                <div class="hint">Минимум 1 акция, 1 Star</div>
            </div>
        `;
    } else {
        return `
            <div class="sell-form">
                <div class="input-header">
                    <label>📦 Количество (акций)</label>
                    <button class="toggle-input-mode" data-form="sell" data-mode="slider">🎚️ Слайдеры</button>
                </div>
                <input type="number" id="sellAmount" step="0.01" min="1" value="1" placeholder="Количество">
                <div class="input-header">
                    <label>⭐ Цена за акцию</label>
                </div>
                <input type="number" id="sellPrice" step="0.01" min="1" value="1" placeholder="Цена">
                <button id="sellBtn">➕ Выставить на продажу</button>
                <div class="hint">Минимум 1 акция, 1 Star</div>
            </div>
        `;
    }
}
function renderBuyLimitForm() {
    const mode = getInputMode('buy', 'slider');
    if (mode === 'slider') {
        return `
            <div class="sell-form">
                <div class="input-header">
                    <label>📦 Количество (акций)</label>
                    <button class="toggle-input-mode" data-form="buy" data-mode="number">⌨️ Поля</button>
                </div>
                <div><span id="buyAmountVal">1.00</span></div>
                <input type="range" id="buyAmountSlider" min="1" max="1000" step="0.01" value="1">
                <div class="input-header">
                    <label>⭐ Цена за акцию</label>
                </div>
                <div><span id="buyPriceVal">1.00</span></div>
                <input type="range" id="buyPriceSlider" min="1" max="100" step="0.1" value="1">
                <button id="buyLimitBtn">💰 Выставить заявку на покупку</button>
                <div class="hint">Минимум 1 акция, 1 Star</div>
            </div>
        `;
    } else {
        return `
            <div class="sell-form">
                <div class="input-header">
                    <label>📦 Количество (акций)</label>
                    <button class="toggle-input-mode" data-form="buy" data-mode="slider">🎚️ Слайдеры</button>
                </div>
                <input type="number" id="buyAmountLimit" step="0.01" min="1" value="1" placeholder="Количество">
                <div class="input-header">
                    <label>⭐ Цена за акцию</label>
                </div>
                <input type="number" id="buyPriceLimit" step="0.01" min="1" value="1" placeholder="Цена">
                <button id="buyLimitBtn">💰 Выставить заявку на покупку</button>
                <div class="hint">Минимум 1 акция, 1 Star</div>
            </div>
        `;
    }
}

// ========== Загрузка ордеров с продавцами ==========
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

// ========== Отрисовка списка ордеров ==========
function renderOrdersList(orders) {
    const container = document.getElementById('ordersList');
    if (!container) return;
    const filtered = orders.filter(o => o.seller_id !== window.userId);
    if (!filtered.length) { container.innerHTML = '<p class="empty-orders">Нет ордеров для отображения</p>'; return; }
    filtered.sort((a,b) => a.price_per_share - b.price_per_share);
    const bestPrice = Math.min(...filtered.map(o => o.price_per_share));
    let html = '';
    for (let order of filtered) {
        const isBest = order.price_per_share === bestPrice;
        const avatarMini = window.renderAvatarHtml(order.seller_avatar, null, null, '32px');
        html += `<div class="order-card ${isBest ? 'order-card-best' : ''}" data-order='${JSON.stringify(order)}'><div class="order-card-header"><div class="seller-info">${avatarMini}<span class="seller-name">${escapeHtml(order.seller_name)}</span>${order.seller_rating ? `<span class="stars-rating">${'★'.repeat(Math.floor(order.seller_rating))}</span>` : ''}</div><div class="order-price-big">${window.fromCents(order.price_per_share)} ⭐</div></div><div class="order-card-body"><span class="order-amount">📦 ${window.fromCents(order.amount)} шт.</span><button class="buy-btn">Купить</button></div></div>`;
    }
    container.innerHTML = html;
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const order = JSON.parse(btn.closest('.order-card').dataset.order);
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

function subscribeToRealtime() {
    if (realtimeChannel) return;
    realtimeChannel = window.supabase
        .channel('stocks-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { if (document.querySelector('.tab[data-tab="stocks"].active')) window.refreshActiveTab(); })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trades' }, () => { if (document.querySelector('.tab[data-tab="stocks"].active')) { updateTicker(); window.refreshActiveTab(); } })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${window.userId}` }, () => { if (document.querySelector('.tab[data-tab="stocks"].active')) window.refreshActiveTab(); })
        .subscribe();
}

// ========== ГЛАВНЫЙ РЕНДЕР ==========
window.renderStocksTab = async function(currentUser) {
    try {
        // Получаем данные о цене и капитализации
        const { totalShares, currentPrice, marketCap } = await window.getTotalMarketCap();
        const avg24h = await window.get24hAvgPrice();
        const priceFormatted = (currentPrice / 100).toFixed(2);
        
        const allOrders = await loadOrdersWithSellers();
        const myOrders = allOrders.filter(o => o.seller_id === window.userId);
        const myBuyOrders = await loadMyBuyOrders();
        const priceHistory = await window.fetchPriceHistoryForTimeframe(currentTimeframe);
        const orderHistory = await loadOrderHistory();

        const html = `
            <div class="card">
                <div class="balance-row">
                    <div class="balance-item"><div class="label">📊 Акций</div><div class="value">${window.fromCents(currentUser.shares)}</div></div>
                    <div class="balance-item"><div class="label">⭐ Stars</div><div class="value">${window.fromCents(currentUser.stars_balance)}</div></div>
                    <div class="balance-item price"><div class="label">💰 Текущая цена</div><div class="value">${priceFormatted} ⭐</div></div>
                </div>
                <div class="market-buttons">
                    <button id="marketBuyBtn" style="background: linear-gradient(135deg, #fbbf24, #f59e0b);">🚀 Рыночная покупка</button>
                    <button id="marketSellBtn" style="background: linear-gradient(135deg, #f97316, #ea580c);">📉 Рыночная продажа</button>
                </div>
                <div class="info-panel">
                    <div class="info-card"><div class="small-text">🏦 Рыночная капитализация</div><div class="price">${Math.round(marketCap)} ⭐</div></div>
                    <div class="info-card"><div class="small-text">📦 Всего акций</div><div class="price">${(totalShares/100).toFixed(2)}</div></div>
                    <div class="info-card"><div class="small-text">📈 Средняя цена (24ч)</div><div class="price">${avg24h.toFixed(2)} ⭐</div></div>
                </div>
                <div class="timeframe-buttons">
                    <button class="timeframe-btn ${currentTimeframe === '1d' ? 'active' : ''}" data-tf="1d">1д</button>
                    <button class="timeframe-btn ${currentTimeframe === '7d' ? 'active' : ''}" data-tf="7d">7д</button>
                    <button class="timeframe-btn ${currentTimeframe === '30d' ? 'active' : ''}" data-tf="30d">30д</button>
                    <button id="refreshChartBtn">🔄 Обновить</button>
                </div>
                <div id="chart-container" class="chart-container"></div>
                <div id="ticker" class="ticker"></div>
            </div>
            <div class="card">
                <h3>📖 Стакан заявок</h3>
                <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <div style="flex:1;"><h4 style="text-align:center;">💰 Продажа</h4><div id="sellOrdersList"></div></div>
                    <div style="flex:1;"><h4 style="text-align:center;">🏦 Покупка</h4><div id="buyOrdersList"></div></div>
                </div>
            </div>
            <div class="card"><h3>📈 Продать акции</h3>${renderSellForm()}</div>
            <div class="card"><h3>🛒 Купить акции (лимитная заявка)</h3>${renderBuyLimitForm()}</div>
            <div class="card accordion-section">
                <div class="accordion-header" data-target="mySellsList">
                    <div class="accordion-title">📌 Мои ордера на продажу <span class="order-count">(${myOrders.length})</span></div>
                    <div class="accordion-icon">▼</div>
                </div>
                <div id="mySellsList" class="accordion-content collapsed">
                    ${myOrders.length ? '<div id="myOrdersList"></div><button id="cancelAllSellsBtn" class="cancel-all-btn">✖ Отменить все продажи</button>' : '<p class="empty-orders" style="text-align:center;">Нет активных ордеров на продажу</p>'}
                </div>
            </div>
            <div class="card accordion-section">
                <div class="accordion-header" data-target="myBuysList">
                    <div class="accordion-title">🛒 Мои заявки на покупку <span class="order-count">(${myBuyOrders.length})</span></div>
                    <div class="accordion-icon">▼</div>
                </div>
                <div id="myBuysList" class="accordion-content collapsed">
                    ${myBuyOrders.length ? '<div id="myBuyOrdersList"></div><button id="cancelAllBuysBtn" class="cancel-all-btn">✖ Отменить все покупки</button>' : '<p class="empty-orders" style="text-align:center;">Нет активных заявок на покупку</p>'}
                </div>
            </div>
            <div class="card">
                <h3>📋 Ордера на продажу</h3>
                <div id="ordersList"></div>
            </div>
            <div class="card"><h3>🗂 История моих ордеров</h3><div id="orderHistoryList"></div></div>
        `;

        document.getElementById('app').innerHTML = html;

        drawCanvasChartWithAxes(priceHistory);
        await updateTicker();
        await renderOrderBook();
        renderOrderHistory(orderHistory);

        // Мои ордера на продажу
        if (myOrders.length) {
            const myDiv = document.getElementById('myOrdersList');
            myDiv.innerHTML = myOrders.map(order => `<div class="order-card my-order-card" data-order='${JSON.stringify(order)}'><div class="order-card-header"><div class="order-price-big">${window.fromCents(order.price_per_share)} ⭐</div><button class="cancel-btn-small" data-id="${order.id}">Отменить</button></div><div class="order-card-body"><span class="order-amount">📦 ${window.fromCents(order.amount)} шт.</span></div></div>`).join('');
            document.querySelectorAll('#myOrdersList .cancel-btn-small').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const order = JSON.parse(btn.closest('.order-card').dataset.order);
                    if (confirm('Отменить ордер на продажу?')) { try { await window.cancelOrder(order.id); window.showToast('Ордер на продажу отменён'); await window.refreshActiveTab(); } catch (err) { window.showCustomModal('Ошибка', err.message); } }
                });
            });
        }

        // Мои заявки на покупку
        if (myBuyOrders.length) {
            const buyDiv = document.getElementById('myBuyOrdersList');
            buyDiv.innerHTML = myBuyOrders.map(order => `<div class="order-card my-order-card" data-buy-order-id="${order.id}"><div class="order-card-header"><div class="order-price-big">${window.fromCents(order.price_per_share)} ⭐</div><button class="cancel-buy-btn" data-id="${order.id}">Отменить</button></div><div class="order-card-body"><span class="order-amount">📦 Купить ${window.fromCents(order.amount)} шт.</span></div></div>`).join('');
            document.querySelectorAll('#myBuyOrdersList .cancel-buy-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const orderId = parseInt(btn.dataset.id);
                    if (confirm('Отменить заявку на покупку?')) { try { await cancelBuyOrder(orderId); window.showToast('Заявка на покупку отменена'); await window.refreshActiveTab(); } catch (err) { window.showCustomModal('Ошибка', err.message); } }
                });
            });
        }

        document.getElementById('cancelAllSellsBtn')?.addEventListener('click', async () => { if (confirm('Отменить ВСЕ активные ордера на продажу?')) await cancelAllSellOrders(); });
        document.getElementById('cancelAllBuysBtn')?.addEventListener('click', async () => { if (confirm('Отменить ВСЕ активные заявки на покупку?')) await cancelAllBuyOrders(); });

        // Аккордеоны
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const targetId = header.dataset.target;
                const content = document.getElementById(targetId);
                const icon = header.querySelector('.accordion-icon');
                if (content.classList.contains('collapsed')) {
                    content.classList.remove('collapsed');
                    content.classList.add('expanded');
                    icon.innerHTML = '▲';
                } else {
                    content.classList.remove('expanded');
                    content.classList.add('collapsed');
                    icon.innerHTML = '▼';
                }
            });
        });

        renderOrdersList(allOrders);

        // Обработчики таймфреймов
        document.querySelectorAll('.timeframe-btn').forEach(btn => btn.addEventListener('click', async () => {
            currentTimeframe = btn.dataset.tf;
            await window.renderStocksTab(currentUser);
        }));
        document.getElementById('refreshChartBtn')?.addEventListener('click', async () => { await window.renderStocksTab(currentUser); });

        // Переключение режимов ввода
        document.querySelectorAll('.toggle-input-mode').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const form = btn.dataset.form;
                const mode = btn.dataset.mode;
                setInputMode(form, mode);
                window.renderStocksTab(currentUser);
            });
        });

        // Инициализация слайдеров (если они есть)
        const useSliders = (getInputMode('sell') === 'slider') || (getInputMode('buy') === 'slider');
        if (useSliders) {
            const sellAmountSlider = document.getElementById('sellAmountSlider');
            const sellAmountVal = document.getElementById('sellAmountVal');
            const sellPriceSlider = document.getElementById('sellPriceSlider');
            const sellPriceVal = document.getElementById('sellPriceVal');
            if (sellAmountSlider) {
                sellAmountSlider.addEventListener('input', () => { sellAmountVal.innerText = parseFloat(sellAmountSlider.value).toFixed(2); });
                sellPriceSlider.addEventListener('input', () => { sellPriceVal.innerText = parseFloat(sellPriceSlider.value).toFixed(2); });
            }
            const buyAmountSlider = document.getElementById('buyAmountSlider');
            const buyAmountVal = document.getElementById('buyAmountVal');
            const buyPriceSlider = document.getElementById('buyPriceSlider');
            const buyPriceVal = document.getElementById('buyPriceVal');
            if (buyAmountSlider) {
                buyAmountSlider.addEventListener('input', () => { buyAmountVal.innerText = parseFloat(buyAmountSlider.value).toFixed(2); });
                buyPriceSlider.addEventListener('input', () => { buyPriceVal.innerText = parseFloat(buyPriceSlider.value).toFixed(2); });
            }
        }

        // Кнопки создания ордеров
        document.getElementById('sellBtn')?.addEventListener('click', async () => {
            let amount, price;
            const mode = getInputMode('sell');
            if (mode === 'slider') {
                amount = parseFloat(document.getElementById('sellAmountSlider').value);
                price = parseFloat(document.getElementById('sellPriceSlider').value);
            } else {
                amount = parseFloat(document.getElementById('sellAmount').value);
                price = parseFloat(document.getElementById('sellPrice').value);
            }
            if (isNaN(amount) || amount < 1 || isNaN(price) || price < 1) { window.showCustomModal('Ошибка', 'Введите количество ≥1 и цену ≥1'); return; }
            try { await window.createOrder(amount, price); await window.refreshActiveTab(); } catch (err) { window.showCustomModal('Ошибка', err.message); }
        });
        document.getElementById('buyLimitBtn')?.addEventListener('click', async () => {
            let amount, price;
            const mode = getInputMode('buy');
            if (mode === 'slider') {
                amount = parseFloat(document.getElementById('buyAmountSlider').value);
                price = parseFloat(document.getElementById('buyPriceSlider').value);
            } else {
                amount = parseFloat(document.getElementById('buyAmountLimit').value);
                price = parseFloat(document.getElementById('buyPriceLimit').value);
            }
            if (isNaN(amount) || amount < 1 || isNaN(price) || price < 1) { window.showCustomModal('Ошибка', 'Введите количество ≥1 и цену ≥1'); return; }
            try { await window.createBuyOrder(amount, price); await window.refreshActiveTab(); } catch (err) { window.showCustomModal('Ошибка', err.message); }
        });

        // Модалки для рыночных операций с актуальной ценой
        document.getElementById('marketBuyBtn')?.addEventListener('click', () => showMarketBuyModal(priceFormatted));
        document.getElementById('marketSellBtn')?.addEventListener('click', () => {
            const maxShares = window.fromCents(currentUser.shares);
            showMarketSellModal(priceFormatted, maxShares);
        });

        subscribeToRealtime();
    } catch (err) {
        console.error(err);
        document.getElementById('app').innerHTML = `<div class="card error">${err.message}</div>`;
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}
