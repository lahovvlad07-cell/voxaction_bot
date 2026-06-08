// stocks.js – финальная версия (модалка, мои ордера, карточки, адаптив)

let currentTimeframe = '30d';
let currentOrdersFilter = 'all';
let currentSortDir = 'asc';

window.fetchPriceHistoryForTimeframe = async function(currentTimeframe) {
    let startDate = new Date();
    if (currentTimeframe === '1d') startDate.setDate(startDate.getDate() - 1);
    else if (currentTimeframe === '7d') startDate.setDate(startDate.getDate() - 7);
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

function drawCanvasChart(history) {
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
    const padding = { top: 20, bottom: 30, left: 40, right: 20 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    const stepX = graphWidth / (values.length - 1);
    ctx.fillStyle = '#0f1320';
    ctx.fillRect(0, 0, width, height);
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
    ctx.fillStyle = '#eef2ff';
    ctx.font = '11px sans-serif';
    ctx.fillText(max.toFixed(2), padding.left - 30, padding.top + 10);
    ctx.fillText(min.toFixed(2), padding.left - 30, height - padding.bottom - 5);
    if (history.length) {
        const firstDate = new Date(history[0].created_at).toLocaleDateString();
        const lastDate = new Date(history[history.length-1].created_at).toLocaleDateString();
        ctx.fillText(firstDate, padding.left, height - padding.bottom + 15);
        ctx.fillText(lastDate, width - padding.right - 40, height - padding.bottom + 15);
    }
}

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

async function loadOrdersWithSellers() {
    let orders = [];
    if (currentOrdersFilter === 'all') orders = await window.getActiveOrders();
    else orders = await window.getUserOrders();
    if (orders.length === 0) return [];
    const sellerIds = [...new Set(orders.map(o => o.seller_id))];
    const { data: users } = await window.supabase
        .from('users')
        .select('id, username')
        .in('id', sellerIds);
    const userMap = new Map();
    users?.forEach(u => userMap.set(u.id, u.username));
    for (let o of orders) {
        o.seller_name = userMap.get(o.seller_id) || `user_${o.seller_id}`;
        o.seller_rating = await window.getSellerRating(o.seller_id);
    }
    return orders;
}

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
        return `
            <div class="order-card ${bestClass}" data-order='${JSON.stringify(order)}'>
                <div class="order-card-header">
                    <div class="seller-info">
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
                    window.refreshAll();
                } catch (err) {
                    window.showCustomModal('Ошибка', err.message);
                }
            }
        });
    });
}

window.renderStocksTab = async function(currentUser) {
    try {
        let allOrders = await loadOrdersWithSellers();
        const myOrders = allOrders.filter(o => o.seller_id === window.userId);
        const otherOrders = allOrders.filter(o => o.seller_id !== window.userId);
        let displayOrders = [];
        if (currentOrdersFilter === 'all') displayOrders = [...myOrders, ...otherOrders];
        else if (currentOrdersFilter === 'my') displayOrders = myOrders;
        else displayOrders = otherOrders;
        displayOrders.sort((a,b) => currentSortDir === 'asc' ? a.price_per_share - b.price_per_share : b.price_per_share - a.price_per_share);
        
        const priceHistory = await window.fetchPriceHistoryForTimeframe(currentTimeframe);
        const recentTrades = await window.getRecentTrades(10);
        const { totalShares, currentPrice, marketCap } = await window.getTotalMarketCap();
        
        const html = `
            <div class="card">
                <div class="balance-row">
                    <div class="balance-item">📊 Акций: <strong>${window.fromCents(currentUser.shares)}</strong></div>
                    <div class="balance-item">⭐ Stars: <strong>${window.fromCents(currentUser.stars_balance)}</strong></div>
                    <div class="balance-item price">💰 ${(currentPrice/100).toFixed(2)} ⭐</div>
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
                <h3>📈 Продать акции</h3>
                <div class="sell-form">
                    <input type="number" id="sellAmount" step="0.01" min="1" placeholder="Количество (от 1)">
                    <input type="number" id="sellPrice" step="0.01" min="1" placeholder="Цена (от 1 Star)">
                    <button id="sellBtn">➕ Выставить</button>
                </div>
            </div>
            ${myOrders.length > 0 ? `
            <div class="card">
                <h3>📌 Мои ордера</h3>
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
        `;
        document.getElementById('app').innerHTML = html;
        
        drawCanvasChart(priceHistory);
        renderTicker(recentTrades);
        
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
                window.showToast('Ордер создан');
                window.refreshAll();
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        });
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
