// stocks.js – улучшенная биржа с карточками, модалкой покупки и графиком

let currentTimeframe = '30d';
let currentOrdersFilter = 'all';
let currentSortDir = 'asc';

// Функция для получения цены истории (вспомогательная)
window.fetchPriceHistoryForTimeframe = async function(currentTimeframe) {
    let startDate = new Date();
    if (currentTimeframe === '1d') startDate.setDate(startDate.getDate() - 1);
    else if (currentTimeframe === '7d') startDate.setDate(startDate.getDate() - 7);
    else startDate.setDate(startDate.getDate() - 30);
    const { data, error } = await window.supabase.from('price_history').select('price, created_at').gte('created_at', startDate.toISOString()).order('created_at', { ascending: true }).limit(100);
    if (error) throw new Error(error.message);
    return data || [];
};

// Отрисовка простого canvas графика или заглушки
function drawCanvasChart(history) {
    const container = document.getElementById('chart-container');
    if (!container) return;
    container.innerHTML = '';
    
    if (!history || history.length === 0) {
        container.innerHTML = '<div class="chart-placeholder">📈 Нет сделок. Будьте первым!</div>';
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
    const padding = { top: 15, bottom: 25, left: 35, right: 15 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    const stepX = graphWidth / (values.length - 1);
    
    ctx.fillStyle = '#0f1320';
    ctx.fillRect(0, 0, width, height);
    
    // Рисуем сетку
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
        const y = padding.top + (graphHeight / 4) * i;
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
        let y = (range === 0) ? padding.top + graphHeight/2 : padding.top + graphHeight - ((values[i] - min) / range) * graphHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // Подписи
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.fillText(max.toFixed(2), padding.left - 25, padding.top + 5);
    ctx.fillText(min.toFixed(2), padding.left - 25, height - padding.bottom - 5);
    if (history.length) {
        const firstDate = new Date(history[0].created_at).toLocaleDateString();
        const lastDate = new Date(history[history.length-1].created_at).toLocaleDateString();
        ctx.fillText(firstDate, padding.left, height - padding.bottom + 12);
        ctx.fillText(lastDate, width - padding.right - 40, height - padding.bottom + 12);
    }
}

// Бегущая строка последних сделок
function renderTicker(trades) {
    const container = document.getElementById('ticker');
    if (!container) return;
    if (!trades || trades.length === 0) {
        container.innerHTML = '<div class="ticker-content">Нет сделок</div>';
        return;
    }
    const items = trades.map(t => `<span class="trade-item">📊 ${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐</span>`).join('');
    container.innerHTML = `<div class="ticker-content">${items}</div>`;
}

// Загрузка ордеров с дополнительной информацией о продавце
async function loadOrdersWithSellers() {
    let orders = [];
    if (currentOrdersFilter === 'all') orders = await window.getActiveOrders();
    else orders = await window.getUserOrders();
    
    if (orders.length === 0) return [];
    
    // Получаем уникальные seller_id
    const sellerIds = [...new Set(orders.map(o => o.seller_id))];
    // Загружаем данные пользователей (username, avatar_url, avatar_bg, avatar_border)
    const { data: users } = await window.supabase
        .from('users')
        .select('id, username, avatar_url, avatar_bg, avatar_border')
        .in('id', sellerIds);
    const userMap = new Map();
    users?.forEach(u => userMap.set(u.id, u));
    
    // Добавляем seller_rating (можно оставить как есть)
    for (let o of orders) {
        o.seller_rating = await window.getSellerRating(o.seller_id);
        o.seller_info = userMap.get(o.seller_id) || { username: `user_${o.seller_id}`, avatar_url: '👤', avatar_bg: null, avatar_border: null };
    }
    return orders;
}

// Рендер списка ордеров с аватарками
function renderOrdersList(orders) {
    const ordersDiv = document.getElementById('ordersList');
    if (!ordersDiv) return;
    
    if (orders.length === 0) {
        ordersDiv.innerHTML = '<p class="empty-orders">Нет активных ордеров. Вы можете создать свой!</p>';
        return;
    }
    
    orders.sort((a,b) => currentSortDir === 'asc' ? a.price_per_share - b.price_per_share : b.price_per_share - a.price_per_share);
    
    ordersDiv.innerHTML = '';
    orders.forEach(order => {
        const isOwn = order.seller_id === window.userId;
        const seller = order.seller_info;
        const avatarHtml = window.renderAvatarHtml
            ? window.renderAvatarHtml(seller.avatar_url, seller.avatar_bg, seller.avatar_border, '36px')
            : `<div class="seller-avatar-placeholder">${seller.avatar_url || '👤'}</div>`;
        
        let ratingHtml = '';
        if (order.seller_rating) {
            const fullStars = Math.floor(order.seller_rating);
            const halfStar = order.seller_rating % 1 >= 0.5;
            ratingHtml = '<span class="stars">' + '★'.repeat(fullStars) + (halfStar ? '½' : '') + '</span>';
        }
        
        const card = document.createElement('div');
        card.className = 'order-card';
        card.innerHTML = `
            <div class="order-card-header">
                <div class="seller-info">
                    ${avatarHtml}
                    <span class="seller-name">${escapeHtml(seller.username)}</span>
                    ${ratingHtml ? `<span class="seller-rating">${ratingHtml}</span>` : ''}
                </div>
                ${!isOwn ? `<button class="buy-btn" data-order='${JSON.stringify(order)}'>Купить</button>` : `<button class="cancel-btn" data-order-id="${order.id}">Отменить</button>`}
            </div>
            <div class="order-details">
                <div class="order-price">${window.fromCents(order.price_per_share)} ⭐</div>
                <div class="order-amount">📦 ${window.fromCents(order.amount)} шт.</div>
            </div>
        `;
        ordersDiv.appendChild(card);
    });
    
    // Обработчики кнопок
    document.querySelectorAll('.buy-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const order = JSON.parse(btn.dataset.order);
            showBuyModal(order);
        });
    });
    document.querySelectorAll('.cancel-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm('Отменить ордер?')) {
                try {
                    await window.cancelOrder(parseInt(btn.dataset.orderId));
                    window.showToast('Ордер отменён');
                    await window.refreshAll();
                } catch (err) {
                    window.showCustomModal('Ошибка', err.message);
                }
            }
        });
    });
}

// Модальное окно покупки
function showBuyModal(order) {
    const maxShares = window.fromCents(order.amount);
    const modalHtml = `
        <div class="modal" id="buyModal" style="display:flex;">
            <div class="modal-content" style="max-width: 300px;">
                <span class="close-modal" id="closeBuyModal">&times;</span>
                <h3>Покупка акций</h3>
                <p>Цена: ${window.fromCents(order.price_per_share)} ⭐</p>
                <p>Доступно: ${maxShares} шт.</p>
                <input type="number" id="buyAmount" placeholder="Количество" step="0.01" min="1" max="${maxShares}" value="${maxShares}">
                <div style="margin: 10px 0;">Итого: <span id="totalPrice">0</span> ⭐</div>
                <button id="confirmBuyBtn">Подтвердить</button>
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
            await window.refreshAll();
        } catch (err) {
            window.showCustomModal('Ошибка', err.message);
        }
    };
}

// Основная функция рендеринга вкладки
window.renderStocksTab = async function(currentUser) {
    try {
        // Параллельно загружаем данные
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
        
        let html = `
            <div class="card" style="margin-bottom: 12px;">
                <div class="balance-row">
                    <div class="balance-item"><span class="balance-label">📊 Акций</span><span class="balance-value">${sharesFormatted}</span></div>
                    <div class="balance-item"><span class="balance-label">⭐ Stars</span><span class="balance-value">${starsFormatted}</span></div>
                    <div class="balance-item"><span class="balance-label">💰 Цена</span><span class="balance-value price">${currentPriceFormatted}</span></div>
                </div>
                <div class="info-panel">
                    <div class="info-card"><div class="small-text">Рыночная капитализация</div><div class="price" style="font-size:18px;">${Math.round(marketCap)} ⭐</div></div>
                    <div class="info-card"><div class="small-text">Всего акций</div><div class="price" style="font-size:18px;">${window.fromCents(totalShares)}</div></div>
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
                    <input type="number" id="sellAmount" placeholder="Количество (от 1)" step="0.01" min="1">
                    <input type="number" id="sellPrice" placeholder="Цена (от 1 Star)" step="0.01" min="1">
                    <button id="sellBtn">➕ Выставить ордер</button>
                </div>
            </div>
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
        renderOrdersList(orders);
        
        // Обработчики
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                currentTimeframe = btn.dataset.tf;
                await window.renderStocksTab(currentUser);
            });
        });
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentOrdersFilter = btn.dataset.filter;
                window.renderStocksTab(currentUser);
            });
        });
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentSortDir = btn.dataset.sort;
                window.renderStocksTab(currentUser);
            });
        });
        
        const sellBtn = document.getElementById('sellBtn');
        if (sellBtn) {
            sellBtn.addEventListener('click', async () => {
                let amount = parseFloat(document.getElementById('sellAmount').value);
                let price = parseFloat(document.getElementById('sellPrice').value);
                if (isNaN(amount) || amount < 1 || isNaN(price) || price < 1) {
                    window.showCustomModal('Ошибка', 'Введите количество ≥1 и цену ≥1');
                    return;
                }
                try {
                    await window.createOrder(amount, price);
                    window.showToast('Ордер создан');
                    await window.refreshAll();
                } catch (err) {
                    window.showCustomModal('Ошибка', err.message);
                }
            });
        }
    } catch (err) {
        console.error(err);
        document.getElementById('app').innerHTML = `<div class="card error">Ошибка загрузки биржи: ${err.message}</div>`;
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
