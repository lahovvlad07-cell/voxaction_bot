// stocks.js – улучшенная версия с рыночной покупкой, стаканом, автообновлением и графиком с осями

let currentTimeframe = '30d';
let currentOrdersFilter = 'all';
let currentSortDir = 'asc';
let refreshInterval = null;
let ordersChannel = null;
let tradesChannel = null;
let usersChannel = null;

// ========== Функции для работы с графиком (улучшенные) ==========
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
        container.innerHTML = '<p class="chart-placeholder">Нет данных для графика</p>';
        return;
    }
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
    
    // Фон
    ctx.fillStyle = '#0f1320';
    ctx.fillRect(0, 0, width, height);
    
    // Рисуем сетку и метки оси Y
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
    
    // Рисуем линию цены
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
    
    // Подписи дат (первая, последняя и средняя)
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
}

// ========== Тикер ==========
function renderTicker(trades) {
    const container = document.getElementById('ticker');
    if (!container) return;
    if (!trades || trades.length === 0) {
        container.innerHTML = '<div class="ticker-content">Нет сделок</div>';
        return;
    }
    const items = trades.map(t => `<span class="trade-item">${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐</span>`).join('');
    container.innerHTML = `<div class="ticker-content">${items}</div>`;
}

async function updateTicker() {
    const recentTrades = await window.getRecentTrades(10);
    renderTicker(recentTrades);
}

// ========== Рыночная покупка ==========
async function marketBuy(starsAmount) {
    if (starsAmount <= 0) throw new Error('Сумма должна быть больше 0');
    const { data: sellOrders, error } = await window.supabase
        .from('orders')
        .select('*')
        .eq('status', 'active')
        .order('price_per_share', { ascending: true });
    if (error) throw new Error('Ошибка загрузки ордеров');
    if (!sellOrders.length) throw new Error('Нет ордеров на продажу');

    let remainingStars = window.toCents(starsAmount);
    let totalBoughtShares = 0;
    let totalSpent = 0;

    for (let order of sellOrders) {
        if (remainingStars <= 0) break;
        const price = order.price_per_share;
        const availableShares = order.amount;
        const maxSharesFromStars = Math.floor(remainingStars / price);
        const buyShares = Math.min(availableShares, maxSharesFromStars);
        if (buyShares <= 0) continue;

        const { error: tradeError } = await window.supabase.rpc('execute_trade_partial', {
            p_order_id: order.id,
            p_buyer_id: window.userId,
            p_buy_amount: buyShares
        });
        if (tradeError) throw new Error(`Ошибка при покупке: ${tradeError.message}`);

        const cost = buyShares * price;
        remainingStars -= cost;
        totalBoughtShares += buyShares;
        totalSpent += cost;
    }

    if (totalBoughtShares === 0) throw new Error('Недостаточно ликвидности для покупки');
    window.showToast(`✅ Куплено ${window.fromCents(totalBoughtShares)} шт. за ${window.fromCents(totalSpent)} ⭐`);
    await window.refreshAll();
}

// ========== Стакан (Order Book) ==========
async function renderOrderBook() {
    // Получаем sell-ордера
    const { data: sells } = await window.supabase
        .from('orders')
        .select('amount, price_per_share, seller_id, users(username)')
        .eq('status', 'active')
        .order('price_per_share', { ascending: true })
        .limit(10);
    // Получаем buy-ордера
    const { data: buys } = await window.supabase
        .from('buy_orders')
        .select('amount, price_per_share, buyer_id, users(username)')
        .eq('status', 'active')
        .order('price_per_share', { ascending: false })
        .limit(10);

    const sellHtml = sells?.map(s => `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
            <span>${window.fromCents(s.amount)} шт.</span>
            <span style="color:#fbbf24;">${window.fromCents(s.price_per_share)} ⭐</span>
            <span class="small-text">${s.users?.username || s.seller_id}</span>
        </div>
    `).join('') || '<p class="small-text">Нет заявок на продажу</p>';
    const buyHtml = buys?.map(b => `
        <div style="display: flex; justify-content: space-between; padding: 6px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
            <span>${window.fromCents(b.amount)} шт.</span>
            <span style="color:#4ade80;">${window.fromCents(b.price_per_share)} ⭐</span>
            <span class="small-text">${b.users?.username || b.buyer_id}</span>
        </div>
    `).join('') || '<p class="small-text">Нет заявок на покупку</p>';

    const buyDiv = document.getElementById('buyOrdersList');
    const sellDiv = document.getElementById('sellOrdersList');
    if (buyDiv) buyDiv.innerHTML = buyHtml;
    if (sellDiv) sellDiv.innerHTML = sellHtml;
}

// ========== Создание buy-ордера ==========
async function createBuyOrder(amount, price) {
    const amountCents = window.toCents(amount);
    const priceCents = window.toCents(price);
    if (amountCents < 100) throw new Error('Минимум 1 акция');
    if (priceCents < 100) throw new Error('Минимум 1 Star');
    const { data, error } = await window.supabase.rpc('create_buy_order', {
        p_user_id: window.userId,
        p_amount: amountCents,
        p_price: priceCents
    });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    window.showToast('✅ Заявка на покупку создана');
    await window.refreshAll();
}

// ========== Мои последние сделки ==========
async function loadMyRecentTrades() {
    const { data } = await window.supabase
        .from('trades')
        .select('amount, price_per_share, created_at, seller_id, buyer_id')
        .or(`seller_id.eq.${window.userId},buyer_id.eq.${window.userId}`)
        .order('created_at', { ascending: false })
        .limit(5);
    const container = document.getElementById('myRecentTrades');
    if (!container) return;
    if (!data || data.length === 0) {
        container.innerHTML = '<p class="small-text">Нет сделок</p>';
        return;
    }
    const html = data.map(t => {
        const type = t.buyer_id === window.userId ? 'Покупка' : 'Продажа';
        const time = new Date(t.created_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
        return `<div style="display: flex; justify-content: space-between; font-size:13px; padding:4px 0;">${type} ${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐ <span class="small-text">${time}</span></div>`;
    }).join('');
    container.innerHTML = html;
}

// ========== Загрузка ордеров с именами продавцов ==========
async function loadOrdersWithSellers() {
    let orders = [];
    if (currentOrdersFilter === 'all') orders = await window.getActiveOrders();
    else orders = await window.getUserOrders();
    if (orders.length === 0) return [];
    const sellerIds = [...new Set(orders.map(o => o.seller_id))];
    const { data: users } = await window.supabase
        .from('users')
        .select('id, username, avatar_url')
        .in('id', sellerIds);
    const userMap = new Map();
    users?.forEach(u => userMap.set(u.id, u));
    for (let o of orders) {
        const user = userMap.get(o.seller_id);
        o.seller_name = user?.username || `user_${o.seller_id}`;
        o.seller_avatar = user?.avatar_url || '👤';
        o.seller_rating = await window.getSellerRating(o.seller_id);
    }
    return orders;
}

// ========== Отрисовка списка ордеров (с пагинацией не перегружаем) ==========
function renderOrdersList(orders) {
    const container = document.getElementById('ordersList');
    if (!container) return;
    if (orders.length === 0) {
        container.innerHTML = '<p class="empty-orders">Нет активных ордеров</p>';
        return;
    }
    orders.sort((a,b) => currentSortDir === 'asc' ? a.price_per_share - b.price_per_share : b.price_per_share - a.price_per_share);
    const bestPrice = Math.min(...orders.map(o => o.price_per_share));
    container.innerHTML = orders.map(order => {
        const isOwn = order.seller_id === window.userId;
        let ratingHtml = '';
        if (order.seller_rating) {
            const fullStars = Math.floor(order.seller_rating);
            ratingHtml = `<span class="stars-rating">${'★'.repeat(fullStars)}${order.seller_rating % 1 >= 0.5 ? '½' : ''}</span>`;
        }
        const isBest = (!isOwn && order.price_per_share === bestPrice);
        const bestClass = isBest ? 'order-card-best' : '';
        const avatarMini = window.renderAvatarHtml ? window.renderAvatarHtml(order.seller_avatar, null, null, '32px') : '';
        return `
            <div class="order-card ${bestClass}" data-order='${JSON.stringify(order)}'>
                <div class="order-card-header">
                    <div class="seller-info">
                        ${avatarMini}
                        <span class="seller-name">${order.seller_id === window.userId ? 'Вы' : escapeHtml(order.seller_name)}</span>
                        ${ratingHtml ? `<span class="seller-rating">${ratingHtml}</span>` : ''}
                    </div>
                    <div class="order-price-big">${window.fromCents(order.price_per_share)} ⭐</div>
                </div>
                <div class="order-card-body">
                    <span class="order-amount">📦 ${window.fromCents(order.amount)} шт.</span>
                    ${!isOwn ? `<button class="buy-btn">Купить</button>` : `<button class="cancel-btn" data-id="${order.id}">Отменить</button>`}
                </div>
            </div>
        `;
    }).join('');
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = btn.closest('.order-card');
            const order = JSON.parse(card.dataset.order);
            showBuyModal(order);
        });
    });
    document.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            if (confirm('Отменить ордер?')) {
                try {
                    await window.cancelOrder(parseInt(btn.dataset.id));
                    window.showToast('Ордер отменён');
                    await window.refreshAll();
                } catch (err) {
                    window.showCustomModal('Ошибка', err.message);
                }
            }
        });
    });
}

function showBuyModal(order) {
    const maxShares = window.fromCents(order.amount);
    const pricePerShare = window.fromCents(order.price_per_share);
    const modalHtml = `
        <div class="modal" id="buyModal" style="display:flex;">
            <div class="modal-content" style="max-width: 320px;">
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
        let total = (amount * pricePerShare).toFixed(2);
        totalSpan.innerText = total;
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
            window.refreshAll();
        } catch (err) {
            window.showCustomModal('Ошибка', err.message);
        }
    };
}

// ========== Подписка на реальное время ==========
function subscribeToRealtimeUpdates() {
    if (ordersChannel) return;
    ordersChannel = window.supabase
        .channel('orders-updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
            if (document.querySelector('.tab[data-tab="stocks"].active')) {
                window.refreshAll();
            }
        })
        .subscribe();
    tradesChannel = window.supabase
        .channel('trades-updates')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trades' }, () => {
            if (document.querySelector('.tab[data-tab="stocks"].active')) {
                updateTicker();
                loadMyRecentTrades();
            }
        })
        .subscribe();
    usersChannel = window.supabase
        .channel('users-updates')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${window.userId}` }, () => {
            if (document.querySelector('.tab[data-tab="stocks"].active')) {
                window.refreshAll();
            }
        })
        .subscribe();
}

// ========== Основной рендер ==========
window.renderStocksTab = async function(currentUser) {
    try {
        // Загружаем данные
        let allOrders = await loadOrdersWithSellers();
        const myOrders = allOrders.filter(o => o.seller_id === window.userId);
        const otherOrders = allOrders.filter(o => o.seller_id !== window.userId);
        let displayOrders = [];
        if (currentOrdersFilter === 'all') displayOrders = [...myOrders, ...otherOrders];
        else if (currentOrdersFilter === 'my') displayOrders = myOrders;
        else displayOrders = otherOrders;
        
        const priceHistory = await window.fetchPriceHistoryForTimeframe(currentTimeframe);
        const { totalShares, currentPrice, marketCap } = await window.getTotalMarketCap();
        
        const html = `
            <div class="card">
                <div class="balance-row">
                    <div class="balance-item">📊 Акций: <strong>${window.fromCents(currentUser.shares)}</strong></div>
                    <div class="balance-item">⭐ Stars: <strong>${window.fromCents(currentUser.stars_balance)}</strong></div>
                    <div class="balance-item price">💰 ${(currentPrice/100).toFixed(2)} ⭐</div>
                </div>
                <div class="balance-row" style="margin-top:8px;">
                    <button id="marketBuyBtn" style="background: linear-gradient(135deg, #fbbf24, #f59e0b);">🚀 Рыночная покупка</button>
                </div>
                <div class="info-panel">
                    <div class="info-card"><div class="small-text">Рыночная капитализация</div><div class="price" style="font-size:20px;">${Math.round(marketCap)} ⭐</div></div>
                    <div class="info-card"><div class="small-text">Всего акций</div><div class="price" style="font-size:20px;">${(totalShares/100).toFixed(2)}</div></div>
                </div>
                <div class="timeframe-buttons">
                    <button class="timeframe-btn ${currentTimeframe === '1d' ? 'active' : ''}" data-tf="1d">1д</button>
                    <button class="timeframe-btn ${currentTimeframe === '7d' ? 'active' : ''}" data-tf="7d">7д</button>
                    <button class="timeframe-btn ${currentTimeframe === '30d' ? 'active' : ''}" data-tf="30d">30д</button>
                </div>
                <div id="chart-container" class="chart-container"></div>
                <div id="ticker" class="ticker"></div>
            </div>
            <div class="card">
                <h3>📖 Стакан заявок</h3>
                <div style="display: flex; gap: 20px; flex-wrap: wrap;">
                    <div style="flex:1;">
                        <h4>💰 Продажа (лучшие цены)</h4>
                        <div id="sellOrdersList" style="max-height: 200px; overflow-y: auto;"></div>
                    </div>
                    <div style="flex:1;">
                        <h4>🏦 Покупка (лучшие цены)</h4>
                        <div id="buyOrdersList" style="max-height: 200px; overflow-y: auto;"></div>
                    </div>
                </div>
            </div>
            <div class="card">
                <h3>📈 Продать акции</h3>
                <div class="sell-form">
                    <input type="number" id="sellAmount" step="0.01" min="1" placeholder="Количество (от 1)">
                    <input type="number" id="sellPrice" step="0.01" min="1" placeholder="Цена (от 1 Star)">
                    <button id="sellBtn">➕ Выставить на продажу</button>
                </div>
            </div>
            <div class="card">
                <h3>🛒 Купить акции (лимитная заявка)</h3>
                <div class="sell-form">
                    <input type="number" id="buyAmountLimit" step="0.01" min="1" placeholder="Количество (от 1)">
                    <input type="number" id="buyPriceLimit" step="0.01" min="1" placeholder="Цена (от 1 Star)">
                    <button id="buyLimitBtn">💰 Выставить заявку на покупку</button>
                </div>
            </div>
            ${myOrders.length > 0 ? `
            <div class="card">
                <h3>📌 Мои ордера на продажу</h3>
                <div id="myOrdersList"></div>
            </div>
            ` : ''}
            <div class="card">
                <div class="filter-bar">
                    <button class="filter-btn ${currentOrdersFilter === 'all' ? 'active' : ''}" data-filter="all">Все</button>
                    <button class="filter-btn ${currentOrdersFilter === 'my' ? 'active' : ''}" data-filter="my">Мои</button>
                    <button class="sort-btn ${currentSortDir === 'asc' ? 'active' : ''}" data-sort="asc">↑ Цена</button>
                    <button class="sort-btn ${currentSortDir === 'desc' ? 'active' : ''}" data-sort="desc">↓ Цена</button>
                </div>
                <h3>📋 Ордера на продажу</h3>
                <div id="ordersList"></div>
            </div>
            <div class="card">
                <h3>📜 Мои последние сделки</h3>
                <div id="myRecentTrades"></div>
            </div>
        `;
        document.getElementById('app').innerHTML = html;
        
        // Отрисовка графиков
        drawCanvasChartWithAxes(priceHistory);
        await updateTicker();
        await renderOrderBook();
        await loadMyRecentTrades();
        
        // Мои ордера
        if (myOrders.length > 0) {
            const myOrdersDiv = document.getElementById('myOrdersList');
            if (myOrdersDiv) {
                myOrdersDiv.innerHTML = myOrders.map(order => `
                    <div class="order-card my-order-card" data-order='${JSON.stringify(order)}'>
                        <div class="order-card-header">
                            <div class="order-price-big">${window.fromCents(order.price_per_share)} ⭐</div>
                            <button class="cancel-btn-small" data-id="${order.id}">Отменить</button>
                        </div>
                        <div class="order-card-body">
                            <span class="order-amount">📦 ${window.fromCents(order.amount)} шт.</span>
                        </div>
                    </div>
                `).join('');
                document.querySelectorAll('#myOrdersList .cancel-btn-small').forEach(btn => {
                    btn.addEventListener('click', async (e) => {
                        const card = btn.closest('.order-card');
                        const order = JSON.parse(card.dataset.order);
                        if (confirm('Отменить ордер?')) {
                            try {
                                await window.cancelOrder(order.id);
                                window.showToast('Ордер отменён');
                                window.refreshAll();
                            } catch (err) {
                                window.showCustomModal('Ошибка', err.message);
                            }
                        }
                    });
                });
            }
        }
        
        renderOrdersList(displayOrders);
        
        // Обработчики событий
        document.querySelectorAll('.timeframe-btn').forEach(btn => btn.addEventListener('click', async () => {
            currentTimeframe = btn.dataset.tf;
            await window.renderStocksTab(currentUser);
        }));
        document.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', () => {
            currentOrdersFilter = btn.dataset.filter;
            window.renderStocksTab(currentUser);
        }));
        document.querySelectorAll('.sort-btn').forEach(btn => btn.addEventListener('click', () => {
            currentSortDir = btn.dataset.sort;
            window.renderStocksTab(currentUser);
        }));
        
        document.getElementById('sellBtn')?.addEventListener('click', async () => {
            let amount = parseFloat(document.getElementById('sellAmount').value);
            let price = parseFloat(document.getElementById('sellPrice').value);
            if (isNaN(amount) || amount < 1 || isNaN(price) || price < 1) {
                window.showCustomModal('Ошибка', 'Введите количество ≥1 и цену ≥1');
                return;
            }
            try {
                await window.createOrder(amount, price);
                window.showToast('Ордер на продажу создан');
                window.refreshAll();
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        });
        
        document.getElementById('buyLimitBtn')?.addEventListener('click', async () => {
            let amount = parseFloat(document.getElementById('buyAmountLimit').value);
            let price = parseFloat(document.getElementById('buyPriceLimit').value);
            if (isNaN(amount) || amount < 1 || isNaN(price) || price < 1) {
                window.showCustomModal('Ошибка', 'Введите количество ≥1 и цену ≥1');
                return;
            }
            try {
                await createBuyOrder(amount, price);
                window.refreshAll();
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        });
        
        document.getElementById('marketBuyBtn')?.addEventListener('click', async () => {
            const amount = parseFloat(prompt('Сколько ⭐ потратить на покупку?', '100'));
            if (isNaN(amount) || amount <= 0) return;
            try {
                await marketBuy(amount);
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        });
        
        // Подписываемся на обновления в реальном времени (один раз)
        subscribeToRealtimeUpdates();
    } catch (err) {
        console.error(err);
        document.getElementById('app').innerHTML = `<div class="card error">${err.message}</div>`;
    }
};

window.refreshAll = async function() {
    const result = await window.getOrCreateUser();
    window.currentUser = result.user;
    await window.renderStocksTab(window.currentUser);
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}
