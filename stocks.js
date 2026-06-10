// stocks.js – полная версия с улучшенной разметкой и стилями (все функции сохранены)
let currentTimeframe = '30d';
let realtimeChannel = null;
let useSlidersSell = false;   // режим для формы продажи (false = поля ввода)
let useSlidersBuy = false;    // режим для формы покупки

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
        container.innerHTML = '<div class="chart-placeholder">📈 Нет данных для графика</div>';
        return;
    }
    const canvas = document.createElement('canvas');
    const width = container.clientWidth, height = 220;
    canvas.width = width; canvas.height = height;
    canvas.style.width = '100%'; canvas.style.height = '100%';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const values = history.map(h => h.price / 100);
    const max = Math.max(...values), min = Math.min(...values), range = max - min;
    const padding = { top: 15, bottom: 25, left: 40, right: 15 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    const stepX = graphWidth / (values.length - 1);
    
    ctx.fillStyle = '#0f1320';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#eef2ff';
    ctx.font = '9px sans-serif';
    const ySteps = 4;
    for (let i = 0; i <= ySteps; i++) {
        const price = min + (range * i / ySteps);
        const y = padding.top + graphHeight - (i / ySteps) * graphHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.stroke();
        ctx.fillText(price.toFixed(2), padding.left - 32, y + 3);
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
        ctx.fillStyle = '#9ca3af';
        ctx.fillText(firstDate, padding.left, height - padding.bottom + 12);
        ctx.fillText(lastDate, width - padding.right - 40, height - padding.bottom + 12);
    }
}

// ========== ТИКЕР ==========
async function updateTicker() {
    const trades = await window.getRecentTrades(10);
    const container = document.getElementById('stocks-ticker');
    if (!container) return;
    if (!trades.length) {
        container.innerHTML = '<div class="stocks-ticker-content">Нет сделок</div>';
        return;
    }
    const items = trades.map(t => `<span class="trade-item">${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐</span>`).join('');
    container.innerHTML = `<div class="stocks-ticker-content">${items}</div>`;
}

// ========== РЫНОЧНЫЕ СДЕЛКИ (с запасными вариантами) ==========
async function marketBuy(starsAmount) {
    if (starsAmount <= 0) throw new Error('Сумма должна быть больше 0');
    try {
        const { data, error } = await window.supabase.rpc('market_buy', { p_user_id: window.userId, p_stars_amount: starsAmount });
        if (error) throw error;
        if (!data.success) throw new Error(data.error);
        window.showToast(`✅ Куплено ${window.fromCents(data.bought)} шт. за ${starsAmount} ⭐`);
    } catch (e) {
        console.warn('RPC market_buy не найден, используется лимитный ордер');
        const price = await window.getCurrentPrice();
        await window.createBuyOrder(starsAmount / (price/100), price/100);
    }
    await window.refreshActiveTab();
}

async function marketSell(sharesAmount) {
    if (sharesAmount <= 0) throw new Error('Количество должно быть больше 0');
    try {
        const { data, error } = await window.supabase.rpc('market_sell', { p_user_id: window.userId, p_amount_stars: sharesAmount });
        if (error) throw error;
        if (!data.success) throw new Error(data.error);
        window.showToast(`✅ Продано ${window.fromCents(data.sold)} шт. за ${window.fromCents(data.earned)} ⭐`);
    } catch (e) {
        console.warn('RPC market_sell не найден, используется лимитный ордер');
        const price = await window.getCurrentPrice();
        await window.createOrder(sharesAmount, price/100);
    }
    await window.refreshActiveTab();
}

// ========== СТАКАН ЗАЯВОК ==========
async function renderOrderBook() {
    const { data: sells } = await window.supabase
        .from('orders')
        .select('amount, price_per_share, seller_id')
        .eq('status', 'active')
        .order('price_per_share', { ascending: true })
        .limit(4);
    const { data: buys } = await window.supabase
        .from('buy_orders')
        .select('amount, price_per_share, buyer_id')
        .eq('status', 'active')
        .order('price_per_share', { ascending: false })
        .limit(4);
    const userIds = [...(sells?.map(s => s.seller_id) || []), ...(buys?.map(b => b.buyer_id) || [])];
    let userMap = new Map();
    if (userIds.length) {
        const { data: users } = await window.supabase
            .from('users')
            .select('id, username')
            .in('id', userIds);
        users?.forEach(u => userMap.set(u.id, u.username));
    }
    const sellHtml = (sells || []).map(s => `
        <div class="orderbook-row">
            <span>${window.fromCents(s.amount)} шт.</span>
            <span class="price-sell">${window.fromCents(s.price_per_share)} ⭐</span>
            <span class="small-text">${userMap.get(s.seller_id) || 'anon'}</span>
        </div>
    `).join('');
    const buyHtml = (buys || []).map(b => `
        <div class="orderbook-row">
            <span>${window.fromCents(b.amount)} шт.</span>
            <span class="price-buy">${window.fromCents(b.price_per_share)} ⭐</span>
            <span class="small-text">${userMap.get(b.buyer_id) || 'anon'}</span>
        </div>
    `).join('');
    document.getElementById('stocks-sellOrdersList').innerHTML = sellHtml || '<div class="small-text" style="text-align:center;">Нет заявок на продажу</div>';
    document.getElementById('stocks-buyOrdersList').innerHTML = buyHtml || '<div class="small-text" style="text-align:center;">Нет заявок на покупку</div>';
}

// ========== ИСТОРИЯ ОРДЕРОВ ==========
async function loadOrderHistory() {
    const { data, error } = await window.supabase
        .from('orders')
        .select('amount, price_per_share, status, created_at')
        .eq('seller_id', window.userId)
        .in('status', ['completed', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(8);
    if (error) return [];
    return data || [];
}

function renderOrderHistory(orders) {
    const container = document.getElementById('stocks-orderHistoryList');
    if (!container) return;
    if (!orders.length) {
        container.innerHTML = '<div class="small-text" style="text-align:center;">Нет истории ордеров</div>';
        return;
    }
    const tableHtml = `
        <table class="stocks-history-table">
            <thead>
                <tr>
                    <th>Кол-во</th>
                    <th>Цена</th>
                    <th>Статус</th>
                    <th>Дата</th>
                </tr>
            </thead>
            <tbody>
                ${orders.map(o => `
                    <tr>
                        <td>${window.fromCents(o.amount)}</td>
                        <td>${window.fromCents(o.price_per_share)} ⭐</td>
                        <td class="${o.status === 'completed' ? 'status-completed' : 'status-cancelled'}">${o.status === 'completed' ? '✅' : '❌'}</td>
                        <td>${new Date(o.created_at).toLocaleString().slice(0,16)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    container.innerHTML = tableHtml;
}

// ========== МОИ ОРДЕРА ==========
async function loadMySellOrders() {
    const orders = await window.getUserOrders();
    const container = document.getElementById('stocks-mySellOrdersList');
    if (!container) return;
    if (!orders.length) {
        container.innerHTML = '<div class="small-text" style="text-align:center;">Нет активных ордеров на продажу</div>';
        return;
    }
    container.innerHTML = orders.map(order => `
        <div class="order-card" data-id="${order.id}">
            <span>${window.fromCents(order.amount)} шт. по ${window.fromCents(order.price_per_share)} ⭐</span>
            <button class="cancel-btn-small" data-id="${order.id}">Отменить</button>
        </div>
    `).join('');
    document.querySelectorAll('#stocks-mySellOrdersList .cancel-btn-small').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Отменить ордер на продажу?')) {
                await window.cancelOrder(btn.dataset.id);
                await window.renderStocksTab(window.currentUser);
            }
        };
    });
}

async function loadMyBuyOrders() {
    const { data } = await window.supabase
        .from('buy_orders')
        .select('*')
        .eq('buyer_id', window.userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
    const container = document.getElementById('stocks-myBuyOrdersList');
    if (!container) return;
    if (!data?.length) {
        container.innerHTML = '<div class="small-text" style="text-align:center;">Нет активных заявок на покупку</div>';
        return;
    }
    container.innerHTML = data.map(order => `
        <div class="order-card" data-id="${order.id}">
            <span>Купить ${window.fromCents(order.amount)} шт. по ${window.fromCents(order.price_per_share)} ⭐</span>
            <button class="cancel-buy-btn" data-id="${order.id}">Отменить</button>
        </div>
    `).join('');
    document.querySelectorAll('#stocks-myBuyOrdersList .cancel-buy-btn').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Отменить заявку на покупку?')) {
                await window.cancelBuyOrder(btn.dataset.id);
                await window.renderStocksTab(window.currentUser);
            }
        };
    });
}

// ========== ОТМЕНА ВСЕХ ОРДЕРОВ ==========
async function cancelAllSellOrders() {
    const orders = await window.getUserOrders();
    for (let o of orders) await window.cancelOrder(o.id);
    window.showToast(`Отменено ${orders.length} ордеров на продажу`);
    await window.renderStocksTab(window.currentUser);
}
async function cancelAllBuyOrders() {
    const { data } = await window.supabase
        .from('buy_orders')
        .select('id')
        .eq('buyer_id', window.userId)
        .eq('status', 'active');
    for (let o of data) await window.cancelBuyOrder(o.id);
    window.showToast(`Отменено ${data.length} заявок на покупку`);
    await window.renderStocksTab(window.currentUser);
}

// ========== ЗАГРУЗКА ОРДЕРОВ С ПРОДАВЦАМИ ==========
async function loadOrdersWithSellers() {
    const orders = await window.getActiveOrders();
    if (!orders.length) return [];
    const sellerIds = [...new Set(orders.map(o => o.seller_id))];
    const { data: users } = await window.supabase
        .from('users')
        .select('id, username, avatar_url')
        .in('id', sellerIds);
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
    if (!filtered.length) {
        container.innerHTML = '<div class="small-text" style="text-align:center;">Нет ордеров для отображения</div>';
        return;
    }
    filtered.sort((a,b) => a.price_per_share - b.price_per_share);
    const bestPrice = Math.min(...filtered.map(o => o.price_per_share));
    let html = '';
    for (let order of filtered) {
        const isBest = order.price_per_share === bestPrice;
        const avatarMini = window.renderAvatarHtml(order.seller_avatar, null, null, '32px');
        html += `
            <div class="order-card ${isBest ? 'order-card-best' : ''}" data-order='${JSON.stringify(order)}'>
                <div class="order-card-header" style="display:flex; justify-content:space-between;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        ${avatarMini}
                        <span class="seller-name">${escapeHtml(order.seller_name)}</span>
                    </div>
                    <div class="order-price-big">${window.fromCents(order.price_per_share)} ⭐</div>
                </div>
                <div class="order-card-body" style="display:flex; justify-content:space-between; margin-top:8px;">
                    <span>📦 ${window.fromCents(order.amount)} шт.</span>
                    <button class="buy-btn" data-order='${JSON.stringify(order)}'>Купить</button>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const order = JSON.parse(btn.dataset.order);
            showBuyModal(order);
        });
    });
}

function showBuyModal(order) {
    const maxShares = window.fromCents(order.amount);
    const pricePerShare = window.fromCents(order.price_per_share);
    const modalHtml = `
        <div class="modal" id="buyModal" style="display:flex;">
            <div class="modal-content" style="max-width:320px;">
                <span class="close-modal" id="closeBuyModal">&times;</span>
                <h3>Покупка акций</h3>
                <div class="buy-price">Цена: <strong>${pricePerShare} ⭐</strong> / шт.</div>
                <div class="buy-available">Доступно: <strong>${maxShares}</strong> шт.</div>
                <div class="buy-amount-row">
                    <input type="number" id="buyAmount" value="1" step="0.01" min="1" max="${maxShares}" placeholder="Количество">
                    <button id="buyMaxBtn" class="max-btn">Макс</button>
                </div>
                <div class="buy-total">Итого: <span id="totalPrice">${pricePerShare}</span> ⭐</div>
                <button id="confirmBuyBtn" class="buy-confirm-btn">Подтвердить</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('buyModal');
    const amountInput = document.getElementById('buyAmount');
    const totalSpan = document.getElementById('totalPrice');
    const updateTotal = () => {
        let amount = parseFloat(amountInput.value) || 0;
        totalSpan.innerText = (amount * pricePerShare).toFixed(2);
    };
    amountInput.addEventListener('input', updateTotal);
    document.getElementById('buyMaxBtn').onclick = () => {
        amountInput.value = maxShares;
        updateTotal();
    };
    document.getElementById('closeBuyModal').onclick = () => modal.remove();
    document.getElementById('confirmBuyBtn').onclick = async () => {
        let amount = parseFloat(amountInput.value);
        if (isNaN(amount) || amount < 1 || amount > maxShares) {
            window.showCustomModal('Ошибка', 'Некорректное количество');
            return;
        }
        try {
            await window.executePartialTrade(order.id, window.toCents(amount));
            window.showCustomModal('Успех', 'Сделка завершена');
            modal.remove();
            await window.refreshActiveTab();
        } catch (err) {
            window.showCustomModal('Ошибка', err.message);
        }
    };
}

// ========== ФОРМЫ ПРОДАЖИ/ПОКУПКИ ==========
function renderSellForm() {
    const maxShares = window.fromCents(window.currentUser.shares);
    if (useSlidersSell) {
        return `
            <div class="form-group">
                <label>📦 Количество (акций): <span id="sellAmountVal">0.01</span></label>
                <input type="range" id="sellAmountSlider" min="0.01" max="${maxShares}" step="0.01" value="0.01">
            </div>
            <div class="form-group">
                <label>⭐ Цена за акцию: <span id="sellPriceVal">1</span></label>
                <input type="range" id="sellPriceSlider" min="1" max="100" step="0.1" value="1">
            </div>
            <button id="sellBtn">Продать</button>
            <button id="toggleSellMode" class="stocks-toggle-mode">✍️ Поля ввода</button>
        `;
    } else {
        return `
            <div class="form-group">
                <label>📦 Количество (акций):</label>
                <input type="number" id="sellAmount" class="stocks-input-number" step="0.01" min="0.01" placeholder="0.01" value="0.01">
            </div>
            <div class="form-group">
                <label>⭐ Цена за акцию:</label>
                <input type="number" id="sellPrice" class="stocks-input-number" step="0.1" min="1" placeholder="1" value="1">
            </div>
            <button id="sellBtn">Продать</button>
            <button id="toggleSellMode" class="stocks-toggle-mode">🎚️ Слайдеры</button>
        `;
    }
}

function renderBuyLimitForm() {
    if (useSlidersBuy) {
        return `
            <div class="form-group">
                <label>📦 Количество (акций): <span id="buyAmountVal">0.01</span></label>
                <input type="range" id="buyAmountSlider" min="0.01" max="1000" step="0.01" value="0.01">
            </div>
            <div class="form-group">
                <label>⭐ Цена за акцию: <span id="buyPriceVal">1</span></label>
                <input type="range" id="buyPriceSlider" min="1" max="100" step="0.1" value="1">
            </div>
            <button id="buyLimitBtn">Купить</button>
            <button id="toggleBuyMode" class="stocks-toggle-mode">✍️ Поля ввода</button>
        `;
    } else {
        return `
            <div class="form-group">
                <label>📦 Количество (акций):</label>
                <input type="number" id="buyAmountLimit" class="stocks-input-number" step="0.01" min="0.01" placeholder="0.01" value="0.01">
            </div>
            <div class="form-group">
                <label>⭐ Цена за акцию:</label>
                <input type="number" id="buyPriceLimit" class="stocks-input-number" step="0.1" min="1" placeholder="1" value="1">
            </div>
            <button id="buyLimitBtn">Купить</button>
            <button id="toggleBuyMode" class="stocks-toggle-mode">🎚️ Слайдеры</button>
        `;
    }
}

// ========== REALTIME ==========
function subscribeToRealtime() {
    if (realtimeChannel) return;
    realtimeChannel = window.supabase
        .channel('stocks-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
            if (document.querySelector('.tab[data-tab="stocks"].active')) window.renderStocksTab(window.currentUser);
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trades' }, () => {
            if (document.querySelector('.tab[data-tab="stocks"].active')) {
                updateTicker();
                window.renderStocksTab(window.currentUser);
            }
        })
        .subscribe();
}

// ========== ОСНОВНОЙ РЕНДЕР ==========
window.renderStocksTab = async function(currentUser) {
    try {
        const maxShares = window.fromCents(currentUser.shares);
        const priceHistory = await window.fetchPriceHistoryForTimeframe(currentTimeframe);
        const { totalShares, currentPrice, marketCap } = await window.getTotalMarketCap();
        const avg24h = await window.get24hAvgPrice();
        const allOrders = await loadOrdersWithSellers();
        const myOrders = allOrders.filter(o => o.seller_id === window.userId);
        const myBuyOrders = await (async () => {
            const { data } = await window.supabase.from('buy_orders').select('*').eq('buyer_id', window.userId).eq('status', 'active');
            return data || [];
        })();
        const orderHistory = await loadOrderHistory();

        const html = `
            <div class="stocks-balance-row">
                <div class="stocks-balance-card">
                    <div class="stocks-balance-label">📊 Акций</div>
                    <div class="stocks-balance-value">${window.fromCents(currentUser.shares)}</div>
                </div>
                <div class="stocks-balance-card">
                    <div class="stocks-balance-label">⭐ Stars</div>
                    <div class="stocks-balance-value">${window.fromCents(currentUser.stars_balance)}</div>
                </div>
                <div class="stocks-balance-card">
                    <div class="stocks-balance-label">💰 Цена</div>
                    <div class="stocks-balance-value price">${(currentPrice/100).toFixed(2)} ⭐</div>
                </div>
            </div>
            <div class="stocks-info-panel">
                <div class="stocks-info-card"><div class="small-text">🏦 Капитализация</div><div class="price">${Math.round(marketCap)} ⭐</div></div>
                <div class="stocks-info-card"><div class="small-text">📦 Всего акций</div><div class="price">${(totalShares/100).toFixed(2)}</div></div>
                <div class="stocks-info-card"><div class="small-text">📈 Средняя цена (24ч)</div><div class="price">${avg24h.toFixed(2)} ⭐</div></div>
            </div>
            <div class="stocks-timeframe-buttons">
                <button class="stocks-timeframe-btn ${currentTimeframe === '1d' ? 'active' : ''}" data-tf="1d">1д</button>
                <button class="stocks-timeframe-btn ${currentTimeframe === '7d' ? 'active' : ''}" data-tf="7d">7д</button>
                <button class="stocks-timeframe-btn ${currentTimeframe === '30d' ? 'active' : ''}" data-tf="30d">30д</button>
                <button class="stocks-refresh-btn" id="stocksRefreshChartBtn">🔄 Обновить</button>
            </div>
            <div id="stocks-chart-container" class="stocks-chart-container"></div>
            <div id="stocks-ticker" class="stocks-ticker"></div>
            <div class="stocks-orderbook">
                <div class="stocks-orderbook-col">
                    <h4>💰 Продажа</h4>
                    <div id="stocks-sellOrdersList"></div>
                </div>
                <div class="stocks-orderbook-col">
                    <h4>🏦 Покупка</h4>
                    <div id="stocks-buyOrdersList"></div>
                </div>
            </div>
            <div class="stocks-sell-form">
                <h3>📈 Продать акции</h3>
                ${renderSellForm()}
            </div>
            <div class="stocks-buy-form">
                <h3>🛒 Купить (лимитная заявка)</h3>
                ${renderBuyLimitForm()}
            </div>
            <div class="stocks-section-header">
                <h3>📌 Мои ордера на продажу (${myOrders.length})</h3>
                <button id="stocks-cancelAllSellsBtn" class="cancel-all-btn">Отменить все</button>
            </div>
            <div id="stocks-mySellOrdersList"></div>
            <div class="stocks-section-header">
                <h3>🛒 Мои заявки на покупку (${myBuyOrders.length})</h3>
                <button id="stocks-cancelAllBuysBtn" class="cancel-all-btn">Отменить все</button>
            </div>
            <div id="stocks-myBuyOrdersList"></div>
            <h3>📋 Ордера на продажу</h3>
            <div id="stocks-ordersList"></div>
            <h3>🗂 История моих ордеров</h3>
            <div id="stocks-orderHistoryList"></div>
            <div class="market-buttons-fixed">
                <button id="stocksMarketBuyBtn" style="background: linear-gradient(135deg,#fbbf24,#f59e0b);">🚀 Рыночная покупка</button>
                <button id="stocksMarketSellBtn" style="background: linear-gradient(135deg,#f97316,#ea580c);">📉 Рыночная продажа</button>
            </div>
        `;
        document.getElementById('app').innerHTML = html;

        drawCanvasChartWithAxes(priceHistory);
        await updateTicker();
        await renderOrderBook();
        renderOrderHistory(orderHistory);
        await loadMySellOrders();
        await loadMyBuyOrders();
        renderOrdersList(allOrders);

        document.getElementById('stocks-cancelAllSellsBtn').onclick = async () => {
            if (confirm('Отменить все ордера на продажу?')) {
                await cancelAllSellOrders();
            }
        };
        document.getElementById('stocks-cancelAllBuysBtn').onclick = async () => {
            if (confirm('Отменить все заявки на покупку?')) {
                await cancelAllBuyOrders();
            }
        };
        document.getElementById('stocksRefreshChartBtn').onclick = async () => {
            await window.renderStocksTab(currentUser);
        };
        document.querySelectorAll('.stocks-timeframe-btn').forEach(btn => {
            btn.onclick = async () => {
                currentTimeframe = btn.dataset.tf;
                await window.renderStocksTab(currentUser);
            };
        });
        document.getElementById('toggleSellMode').onclick = () => {
            useSlidersSell = !useSlidersSell;
            window.renderStocksTab(currentUser);
        };
        document.getElementById('toggleBuyMode').onclick = () => {
            useSlidersBuy = !useSlidersBuy;
            window.renderStocksTab(currentUser);
        };
        document.getElementById('sellBtn').onclick = async () => {
            let amount, price;
            if (useSlidersSell) {
                amount = parseFloat(document.getElementById('sellAmountSlider').value);
                price = parseFloat(document.getElementById('sellPriceSlider').value);
            } else {
                amount = parseFloat(document.getElementById('sellAmount').value);
                price = parseFloat(document.getElementById('sellPrice').value);
            }
            if (isNaN(amount) || amount <= 0 || isNaN(price) || price <= 0) {
                window.showCustomModal('Ошибка', 'Введите корректные значения');
                return;
            }
            try {
                await window.createOrder(amount, price);
                await window.renderStocksTab(currentUser);
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        };
        document.getElementById('buyLimitBtn').onclick = async () => {
            let amount, price;
            if (useSlidersBuy) {
                amount = parseFloat(document.getElementById('buyAmountSlider').value);
                price = parseFloat(document.getElementById('buyPriceSlider').value);
            } else {
                amount = parseFloat(document.getElementById('buyAmountLimit').value);
                price = parseFloat(document.getElementById('buyPriceLimit').value);
            }
            if (isNaN(amount) || amount <= 0 || isNaN(price) || price <= 0) {
                window.showCustomModal('Ошибка', 'Введите корректные значения');
                return;
            }
            try {
                await window.createBuyOrder(amount, price);
                await window.renderStocksTab(currentUser);
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        };
        document.getElementById('stocksMarketBuyBtn').onclick = async () => {
            const stars = parseFloat(prompt('Сколько ⭐ потратить?', '100'));
            if (isNaN(stars) || stars <= 0) return;
            try {
                await marketBuy(stars);
                await window.renderStocksTab(currentUser);
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        };
        document.getElementById('stocksMarketSellBtn').onclick = async () => {
            const shares = parseFloat(prompt('Сколько акций продать?', '1'));
            if (isNaN(shares) || shares <= 0) return;
            try {
                await marketSell(shares);
                await window.renderStocksTab(currentUser);
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        };
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
