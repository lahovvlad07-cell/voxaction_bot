// stocks.js – адаптивная биржа, красиво на телефоне

let currentTimeframe = '30d';
let currentOrdersFilter = 'all';
let currentSortDir = 'asc';

// Получение истории цен
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

// Отрисовка графика или заглушки
function drawCanvasChart(history) {
    const container = document.getElementById('chart-container');
    if (!container) return;
    container.innerHTML = '';
    if (!history || history.length < 2) {
        container.innerHTML = '<div class="chart-placeholder">📈 Нет данных для графика</div>';
        return;
    }
    const canvas = document.createElement('canvas');
    const width = container.clientWidth;
    const height = 160;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const values = history.map(h => h.price / 100);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    const padding = { top: 8, bottom: 20, left: 30, right: 10 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    const stepX = graphWidth / (values.length - 1);
    
    ctx.fillStyle = '#0f1320';
    ctx.fillRect(0, 0, width, height);
    
    // Сетка
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 3; i++) {
        const y = padding.top + (graphHeight / 3) * i;
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
    }
    
    // Линия цены
    ctx.beginPath();
    ctx.strokeStyle = '#2b6e9e';
    ctx.lineWidth = 2;
    for (let i = 0; i < values.length; i++) {
        const x = padding.left + i * stepX;
        let y = (range === 0) 
            ? padding.top + graphHeight / 2 
            : padding.top + graphHeight - ((values[i] - min) / range) * graphHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Подписи
    ctx.fillStyle = '#9ca3af';
    ctx.font = '9px sans-serif';
    ctx.fillText(max.toFixed(2), padding.left - 22, padding.top + 4);
    ctx.fillText(min.toFixed(2), padding.left - 22, height - padding.bottom - 2);
    if (history.length) {
        const firstDate = new Date(history[0].created_at).toLocaleDateString();
        const lastDate = new Date(history[history.length-1].created_at).toLocaleDateString();
        ctx.fillText(firstDate, padding.left, height - padding.bottom + 10);
        ctx.fillText(lastDate, width - padding.right - 35, height - padding.bottom + 10);
    }
}

// Бегущая строка
function renderTicker(trades) {
    const container = document.getElementById('ticker');
    if (!container) return;
    if (!trades || trades.length === 0) {
        container.innerHTML = '<div class="ticker-content">Нет сделок</div>';
        return;
    }
    const items = trades.map(t => `<span>📊 ${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐</span>`).join('');
    container.innerHTML = `<div class="ticker-content">${items}</div>`;
}

// Загрузка ордеров с именами продавцов (без аватарок для простоты на телефоне)
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

// Рендер списка ордеров
function renderOrdersList(orders) {
    const container = document.getElementById('ordersList');
    if (!container) return;
    if (orders.length === 0) {
        container.innerHTML = '<p class="empty-orders">Нет активных ордеров</p>';
        return;
    }
    orders.sort((a,b) => currentSortDir === 'asc' ? a.price_per_share - b.price_per_share : b.price_per_share - a.price_per_share);
    container.innerHTML = orders.map(order => {
        const isOwn = order.seller_id === window.userId;
        let ratingHtml = '';
        if (order.seller_rating) {
            const stars = Math.floor(order.seller_rating);
            ratingHtml = `<span class="stars">${'★'.repeat(stars)}</span>`;
        }
        return `
            <div class="order-card" data-order='${JSON.stringify(order)}'>
                <div class="order-header">
                    <div class="seller">
                        <span class="seller-name">${escapeHtml(order.seller_name)}</span>
                        ${ratingHtml ? `<span class="seller-rating">${ratingHtml}</span>` : ''}
                    </div>
                    ${!isOwn ? `<button class="buy-btn">Купить</button>` : `<button class="cancel-btn" data-id="${order.id}">Отменить</button>`}
                </div>
                <div class="order-body">
                    <span class="order-price">${window.fromCents(order.price_per_share)} ⭐</span>
                    <span class="order-amount">📦 ${window.fromCents(order.amount)} шт.</span>
                </div>
            </div>
        `;
    }).join('');
    
    // Обработчики
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

// Модалка покупки
function showBuyModal(order) {
    const maxShares = window.fromCents(order.amount);
    const modalHtml = `
        <div class="modal" id="buyModal" style="display:flex;">
            <div class="modal-content" style="max-width: 280px;">
                <span class="close-modal" id="closeBuyModal">&times;</span>
                <h3>Покупка</h3>
                <p>Цена: ${window.fromCents(order.price_per_share)} ⭐</p>
                <p>Доступно: ${maxShares} шт.</p>
                <input type="number" id="buyAmount" placeholder="Количество" step="0.01" min="1" max="${maxShares}" value="1">
                <div style="margin: 10px 0;">Итого: <span id="totalPrice">0</span> ⭐</div>
                <button id="confirmBuyBtn">Купить</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('buyModal');
    const amountInput = document.getElementById('buyAmount');
    const totalSpan = document.getElementById('totalPrice');
    const updateTotal = () => {
        let amount = parseFloat(amountInput.value) || 0;
        let total = (amount * (order.price_per_share / 100)).toFixed(2);
        totalSpan.innerText = total;
    };
    amountInput.addEventListener('input', updateTotal);
    updateTotal();
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

// Основной рендер
window.renderStocksTab = async function(currentUser) {
    try {
        const [orders, priceHistory, recentTrades, marketData] = await Promise.all([
            loadOrdersWithSellers(),
            window.fetchPriceHistoryForTimeframe(currentTimeframe),
            window.getRecentTrades(15),
            window.getTotalMarketCap()
        ]);
        const { totalShares, currentPrice, marketCap } = marketData;
        const sharesFormatted = window.fromCents(currentUser.shares);
        const starsFormatted = window.fromCents(currentUser.stars_balance);
        const currentPriceFormatted = (currentPrice / 100).toFixed(2);
        
        const html = `
            <div class="card">
                <div class="stats-mini">
                    <div><span>📊</span> ${sharesFormatted}</div>
                    <div><span>⭐</span> ${starsFormatted}</div>
                    <div><span>💰</span> ${currentPriceFormatted}</div>
                </div>
                <div class="info-row">
                    <div>Капитализация: <strong>${Math.round(marketCap)} ⭐</strong></div>
                    <div>Всего акций: <strong>${window.fromCents(totalShares)}</strong></div>
                </div>
                <div class="timeframe">
                    <button class="tf ${currentTimeframe === '1d' ? 'active' : ''}" data-tf="1d">1д</button>
                    <button class="tf ${currentTimeframe === '7d' ? 'active' : ''}" data-tf="7d">7д</button>
                    <button class="tf ${currentTimeframe === '30d' ? 'active' : ''}" data-tf="30d">30д</button>
                </div>
                <div id="chart-container" class="chart"></div>
                <div id="ticker" class="ticker"></div>
            </div>
            <div class="card">
                <h3>Продать акции</h3>
                <div class="sell-row">
                    <input type="number" id="sellAmount" placeholder="Кол-во (≥1)">
                    <input type="number" id="sellPrice" placeholder="Цена (≥1 ⭐)">
                    <button id="sellBtn">Выставить</button>
                </div>
            </div>
            <div class="card">
                <div class="filters">
                    <button class="filter ${currentOrdersFilter === 'all' ? 'active' : ''}" data-filter="all">Все</button>
                    <button class="filter ${currentOrdersFilter === 'my' ? 'active' : ''}" data-filter="my">Мои</button>
                    <button class="sort ${currentSortDir === 'asc' ? 'active' : ''}" data-sort="asc">↑ Цена</button>
                    <button class="sort ${currentSortDir === 'desc' ? 'active' : ''}" data-sort="desc">↓ Цена</button>
                </div>
                <h3>Ордера на продажу</h3>
                <div id="ordersList"></div>
            </div>
        `;
        document.getElementById('app').innerHTML = html;
        
        drawCanvasChart(priceHistory);
        renderTicker(recentTrades);
        renderOrdersList(orders);
        
        // Обработчики
        document.querySelectorAll('.tf').forEach(btn => {
            btn.addEventListener('click', () => {
                currentTimeframe = btn.dataset.tf;
                window.renderStocksTab(currentUser);
            });
        });
        document.querySelectorAll('.filter').forEach(btn => {
            btn.addEventListener('click', () => {
                currentOrdersFilter = btn.dataset.filter;
                window.renderStocksTab(currentUser);
            });
        });
        document.querySelectorAll('.sort').forEach(btn => {
            btn.addEventListener('click', () => {
                currentSortDir = btn.dataset.sort;
                window.renderStocksTab(currentUser);
            });
        });
        document.getElementById('sellBtn')?.addEventListener('click', async () => {
            let amount = parseFloat(document.getElementById('sellAmount').value);
            let price = parseFloat(document.getElementById('sellPrice').value);
            if (isNaN(amount) || amount < 1 || isNaN(price) || price < 1) {
                window.showCustomModal('Ошибка', 'Количество и цена должны быть ≥1');
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
        document.getElementById('app').innerHTML = `<div class="card error">Ошибка: ${err.message}</div>`;
    }
};

window.refreshAll = async function() {
    const res = await window.getOrCreateUser();
    window.currentUser = res.user;
    await window.renderStocksTab(window.currentUser);
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}
