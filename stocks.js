// stocks.js - Все функции, связанные с биржей

let currentTimeframe = '30d';
let currentOrdersFilter = 'all';
let currentSortDir = 'asc';

function drawCanvasChart(history) {
    const container = document.getElementById('chart-container');
    if (!container) return;
    container.innerHTML = '';
    if (!history || history.length === 0) { 
        container.innerHTML = '<p style="padding:20px; text-align:center;">Нет данных</p>'; 
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
        let y = (range === 0) 
            ? padding.top + graphHeight/2 
            : padding.top + graphHeight - ((values[i] - min) / range) * graphHeight;
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
    const items = trades.map(t => `<span class="trade-item" style="margin-right:24px;">${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐</span>`).join('');
    container.innerHTML = `<div class="ticker-content">${items}</div>`;
}

window.renderStocksTab = async function(currentUser) {
    try {
        let orders = [];
        if (currentOrdersFilter === 'all') orders = await window.getActiveOrders();
        else orders = await window.getUserOrders();
        for (let o of orders) o.seller_rating = await window.getSellerRating(o.seller_id);
        orders.sort((a,b) => currentSortDir === 'asc' ? a.price_per_share - b.price_per_share : b.price_per_share - a.price_per_share);
        
        const priceHistory = await window.fetchPriceHistoryForTimeframe(currentTimeframe);
        const recentTrades = await window.getRecentTrades(10);
        const { totalShares, currentPrice, marketCap } = await window.getTotalMarketCap();
        
        const html = `
            <div class="card"><div style="display:flex; justify-content:space-between;"><div><p>📊 Акций: <strong>${window.fromCents(currentUser.shares)}</strong></p><p>⭐ Stars: <strong>${window.fromCents(currentUser.stars_balance)}</strong></p></div><div class="price">${(currentPrice/100).toFixed(2)} ⭐</div></div></div>
            <div class="card"><div class="info-panel"><div class="info-card"><div class="small-text">Рыночная капитализация</div><div class="price" style="font-size:20px;">${Math.round(marketCap)} ⭐</div></div><div class="info-card"><div class="small-text">Всего акций</div><div class="price" style="font-size:20px;">${(totalShares/100).toFixed(2)}</div></div></div>
            <div style="display:flex; gap:8px; margin-bottom:12px;"><button class="timeframe-btn ${currentTimeframe === '1d' ? 'active' : ''}" data-tf="1d">1д</button><button class="timeframe-btn ${currentTimeframe === '7d' ? 'active' : ''}" data-tf="7d">7д</button><button class="timeframe-btn ${currentTimeframe === '30d' ? 'active' : ''}" data-tf="30d">30д</button></div>
            <div id="chart-container" class="chart-container"></div><div id="ticker" class="ticker"></div></div>
            <div class="card"><h3>📈 Продать акции</h3><input type="number" id="sellAmount" step="0.01" min="1" placeholder="Количество (от 1)"><input type="number" id="sellPrice" step="0.01" min="1" placeholder="Цена (от 1 Star)"><button id="sellBtn">➕ Выставить</button></div>
            <div class="card"><div class="filter-bar"><button class="filter-btn ${currentOrdersFilter === 'all' ? 'active' : ''}" data-filter="all">Все</button><button class="filter-btn ${currentOrdersFilter === 'my' ? 'active' : ''}" data-filter="my">Мои</button><button class="sort-btn ${currentSortDir === 'asc' ? 'active' : ''}" data-sort="asc">↑ Цена</button><button class="sort-btn ${currentSortDir === 'desc' ? 'active' : ''}" data-sort="desc">↓ Цена</button></div>
            <h3>📋 Ордера на продажу</h3><div id="ordersList"></div></div>
        `;
        document.getElementById('app').innerHTML = html;
        drawCanvasChart(priceHistory);
        renderTicker(recentTrades);
        
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
        
        const ordersDiv = document.getElementById('ordersList');
        if (orders.length === 0) ordersDiv.innerHTML = '<p>Нет ордеров</p>';
        else {
            orders.forEach(order => {
                const isOwn = order.seller_id === window.userId;
                let ratingHtml = order.seller_rating ? `<span class="stars-rating" style="color:#fbbf24;">${'★'.repeat(Math.floor(order.seller_rating))}${order.seller_rating%1>=0.5?'½':''}</span>` : '';
                const div = document.createElement('div'); div.className = 'order-item';
                div.innerHTML = `<div><div>${window.fromCents(order.amount)} шт. по ${window.fromCents(order.price_per_share)} ⭐</div><div class="small-text">Продавец: ${order.seller_id} ${ratingHtml}</div></div><div>${!isOwn ? `<button class="buy-btn" data-order='${JSON.stringify(order)}' style="width:auto; padding:6px 16px;">Купить</button>` : `<button class="cancel-btn" data-order-id="${order.id}" style="background:#f97316; width:auto; padding:6px 16px;">Отменить</button>`}</div>`;
                ordersDiv.appendChild(div);
            });
            document.querySelectorAll('.buy-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const order = JSON.parse(btn.dataset.order);
                    const maxShares = window.fromCents(order.amount);
                    let buyAmount = prompt(`Введите количество (от 1 до ${maxShares}):`, maxShares);
                    if (!buyAmount) return;
                    buyAmount = parseFloat(buyAmount);
                    if (isNaN(buyAmount) || buyAmount < 1 || buyAmount > maxShares) { 
                        window.showCustomModal('Ошибка', 'Некорректное количество'); 
                        return; 
                    }
                    try {
                        await window.executePartialTrade(order.id, window.toCents(buyAmount));
                        window.showCustomModal('Успех', 'Сделка завершена');
                        await window.refreshAll();
                    } catch (err) { 
                        window.showCustomModal('Ошибка', err.message); 
                    }
                });
            });
            document.querySelectorAll('.cancel-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (confirm('Отменить ордер?')) {
                        try { 
                            await window.cancelOrder(parseInt(btn.dataset.orderId)); 
                            window.showCustomModal('Успех', 'Ордер отменён'); 
                            await window.refreshAll(); 
                        } catch (err) { 
                            window.showCustomModal('Ошибка', err.message); 
                        }
                    }
                });
            });
        }
        document.getElementById('sellBtn')?.addEventListener('click', async () => {
            let amount = parseFloat(document.getElementById('sellAmount').value);
            let price = parseFloat(document.getElementById('sellPrice').value);
            if (isNaN(amount) || isNaN(price) || amount < 1 || price < 1) { 
                window.showCustomModal('Ошибка', 'Введите количество не менее 1 и цену не менее 1'); 
                return; 
            }
            try { 
                await window.createOrder(amount, price); 
                window.showCustomModal('Успех', 'Ордер создан'); 
                await window.refreshAll(); 
            } catch (err) { 
                window.showCustomModal('Ошибка', err.message); 
            }
        });
    } catch (err) { 
        document.getElementById('app').innerHTML = `<div class="card error">${err.message}</div>`; 
    }
};

window.refreshAll = async function() {
    const result = await window.getOrCreateUser();
    window.currentUser = result.user;
    await window.renderStocksTab(window.currentUser);
};

window.fetchPriceHistoryForTimeframe = async function(currentTimeframe) {
    let startDate = new Date();
    if (currentTimeframe === '1d') startDate.setDate(startDate.getDate() - 1);
    else if (currentTimeframe === '7d') startDate.setDate(startDate.getDate() - 7);
    else startDate.setDate(startDate.getDate() - 30);
    const { data, error } = await window.supabase.from('price_history').select('price, created_at').gte('created_at', startDate.toISOString()).order('created_at', { ascending: true }).limit(100);
    if (error) throw new Error(error.message);
    return data || [];
};
