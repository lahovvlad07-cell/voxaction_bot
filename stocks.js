// stocks.js – компактный, с переключением режима ввода на лету

let currentTimeframe = '30d';
let currentChart = null;
let realtimeChannel = null;

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

function drawChart(history) {
    const container = document.getElementById('stocks-chart-container');
    if (!container) return;
    container.innerHTML = '';
    if (!history || history.length === 0) {
        container.innerHTML = '<div class="chart-placeholder" style="display:flex; align-items:center; justify-content:center; height:100%; color:#9ca3af;">📈 Нет данных</div>';
        return;
    }
    const canvas = document.createElement('canvas');
    const width = container.clientWidth, height = 160;
    canvas.width = width; canvas.height = height;
    canvas.style.width = '100%'; canvas.style.height = '100%';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const values = history.map(h => h.price / 100);
    const max = Math.max(...values), min = Math.min(...values), range = max - min;
    const padding = { top: 15, bottom: 20, left: 35, right: 15 };
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
        ctx.fillText(price.toFixed(2), padding.left - 30, y + 2);
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
    const trades = await window.getRecentTrades(8);
    const container = document.getElementById('stocks-ticker');
    if (!container) return;
    if (!trades.length) {
        container.innerHTML = '<div class="ticker-content">Нет сделок</div>';
        return;
    }
    const items = trades.map(t => `<span class="trade-item">${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐</span>`).join('');
    container.innerHTML = `<div class="ticker-content">${items}</div>`;
}

// ========== СТАКАН ==========
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
    const userIds = [...(sells?.map(s=>s.seller_id)||[]), ...(buys?.map(b=>b.buyer_id)||[])];
    let userMap = new Map();
    if (userIds.length) {
        const { data: users } = await window.supabase.from('users').select('id, username').in('id', userIds);
        users?.forEach(u => userMap.set(u.id, u.username));
    }
    const sellHtml = (sells||[]).map(s => `<div class="orderbook-row"><span>${window.fromCents(s.amount)}</span><span class="price-sell">${window.fromCents(s.price_per_share)}⭐</span><span class="small-text">${userMap.get(s.seller_id) || '?'}</span></div>`).join('');
    const buyHtml = (buys||[]).map(b => `<div class="orderbook-row"><span>${window.fromCents(b.amount)}</span><span class="price-buy">${window.fromCents(b.price_per_share)}⭐</span><span class="small-text">${userMap.get(b.buyer_id) || '?'}</span></div>`).join('');
    document.getElementById('sellOrdersList').innerHTML = sellHtml || '<div class="small-text">Нет заявок</div>';
    document.getElementById('buyOrdersList').innerHTML = buyHtml || '<div class="small-text">Нет заявок</div>';
}

// ========== МОИ ОРДЕРА ==========
async function loadMyOrders() {
    const orders = await window.getUserOrders();
    const html = orders.map(o => `
        <div class="order-card">
            <span>${window.fromCents(o.amount)} шт.</span>
            <span class="order-price">${window.fromCents(o.price_per_share)}⭐</span>
            <button class="cancel-btn-small" data-id="${o.id}">Отменить</button>
        </div>
    `).join('');
    document.getElementById('mySellOrdersList').innerHTML = html || '<div class="small-text">Нет активных ордеров</div>';
    document.querySelectorAll('.cancel-btn-small').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Отменить ордер?')) {
                await window.cancelOrder(btn.dataset.id);
                await window.renderStocksTab(window.currentUser);
            }
        };
    });
}

async function loadMyBuyOrders() {
    const { data } = await window.supabase.from('buy_orders').select('*').eq('buyer_id', window.userId).eq('status', 'active');
    const html = (data||[]).map(o => `
        <div class="order-card">
            <span>Куп. ${window.fromCents(o.amount)} шт.</span>
            <span class="order-price">${window.fromCents(o.price_per_share)}⭐</span>
            <button class="cancel-buy-btn" data-id="${o.id}">Отменить</button>
        </div>
    `).join('');
    document.getElementById('myBuyOrdersList').innerHTML = html || '<div class="small-text">Нет активных заявок</div>';
    document.querySelectorAll('.cancel-buy-btn').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Отменить заявку на покупку?')) {
                await window.cancelBuyOrder(btn.dataset.id);
                await window.renderStocksTab(window.currentUser);
            }
        };
    });
}

// ========== ИСТОРИЯ ОРДЕРОВ ==========
async function loadOrderHistory() {
    const { data } = await window.supabase
        .from('orders')
        .select('amount, price_per_share, status, created_at')
        .eq('seller_id', window.userId)
        .in('status', ['completed', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(8);
    if (!data?.length) {
        document.getElementById('orderHistoryList').innerHTML = '<div class="small-text">Нет истории</div>';
        return;
    }
    const rows = data.map(o => `
        <tr>
            <td>${window.fromCents(o.amount)}</td>
            <td>${window.fromCents(o.price_per_share)}⭐</td>
            <td>${o.status === 'completed' ? '✅' : '❌'}</td>
            <td class="small-text">${new Date(o.created_at).toLocaleString()}</td>
        </tr>
    `).join('');
    document.getElementById('orderHistoryList').innerHTML = `<div class="scrollable-history"><table class="history-table"><thead><tr><th>Кол-во</th><th>Цена</th><th>Статус</th><th>Дата</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

// ========== ФОРМЫ С ПЕРЕКЛЮЧЕНИЕМ ==========
let useSlidersLocal = window.getUseSliders();

function renderSellForm() {
    const maxShares = window.fromCents(window.currentUser.shares);
    if (useSlidersLocal) {
        return `
            <div class="sell-form">
                <div class="slider-group">
                    <label>Количество: <span id="sellAmountVal">0.01</span></label>
                    <input type="range" id="sellAmountSlider" min="0.01" max="${maxShares}" step="0.01" value="0.01">
                </div>
                <div class="slider-group">
                    <label>Цена: <span id="sellPriceVal">1</span>⭐</label>
                    <input type="range" id="sellPriceSlider" min="1" max="100" step="0.1" value="1">
                </div>
                <button id="sellBtn">Продать</button>
                <button class="toggle-mode" id="toggleSellMode">✍️ Ручной ввод</button>
            </div>
        `;
    } else {
        return `
            <div class="sell-form">
                <div class="input-row">
                    <label>Количество (шт):</label>
                    <input type="number" id="sellAmount" step="0.01" min="0.01" placeholder="0.01">
                </div>
                <div class="input-row">
                    <label>Цена (⭐):</label>
                    <input type="number" id="sellPrice" step="0.1" min="1" placeholder="1">
                </div>
                <button id="sellBtn">Продать</button>
                <button class="toggle-mode" id="toggleSellMode">🎚️ Слайдеры</button>
            </div>
        `;
    }
}

function renderBuyForm() {
    if (useSlidersLocal) {
        return `
            <div class="buy-limit-form">
                <div class="slider-group">
                    <label>Количество: <span id="buyAmountVal">0.01</span></label>
                    <input type="range" id="buyAmountSlider" min="0.01" max="1000" step="0.01" value="0.01">
                </div>
                <div class="slider-group">
                    <label>Цена: <span id="buyPriceVal">1</span>⭐</label>
                    <input type="range" id="buyPriceSlider" min="1" max="100" step="0.1" value="1">
                </div>
                <button id="buyLimitBtn">Купить</button>
                <button class="toggle-mode" id="toggleBuyMode">✍️ Ручной ввод</button>
            </div>
        `;
    } else {
        return `
            <div class="buy-limit-form">
                <div class="input-row">
                    <label>Количество (шт):</label>
                    <input type="number" id="buyAmountLimit" step="0.01" min="0.01" placeholder="0.01">
                </div>
                <div class="input-row">
                    <label>Цена (⭐):</label>
                    <input type="number" id="buyPriceLimit" step="0.1" min="1" placeholder="1">
                </div>
                <button id="buyLimitBtn">Купить</button>
                <button class="toggle-mode" id="toggleBuyMode">🎚️ Слайдеры</button>
            </div>
        `;
    }
}

// ========== ОСНОВНОЙ РЕНДЕР ==========
window.renderStocksTab = async function(currentUser) {
    try {
        const priceHistory = await window.fetchPriceHistoryForTimeframe(currentTimeframe);
        const { totalShares, currentPrice, marketCap } = await window.getTotalMarketCap();
        const avg24h = await window.get24hAvgPrice();
        
        const html = `
            <div class="card">
                <div class="balance-scroll">
                    <div class="balance-row">
                        <div class="balance-item"><div class="label">📊 Акций</div><div class="value">${window.fromCents(currentUser.shares)}</div></div>
                        <div class="balance-item"><div class="label">⭐ Stars</div><div class="value">${window.fromCents(currentUser.stars_balance)}</div></div>
                        <div class="balance-item"><div class="label">💰 Цена</div><div class="value">${(currentPrice/100).toFixed(2)}⭐</div></div>
                    </div>
                </div>
                <div class="market-buttons">
                    <button id="marketBuyBtn" style="background:linear-gradient(135deg,#fbbf24,#f59e0b);">🚀 Рынок</button>
                    <button id="marketSellBtn" style="background:linear-gradient(135deg,#f97316,#ea580c);">📉 Рынок</button>
                </div>
                <div class="info-panel">
                    <div class="info-card"><div class="small-text">Капитал.</div><div class="price">${Math.round(marketCap)}⭐</div></div>
                    <div class="info-card"><div class="small-text">Всего акций</div><div class="price">${(totalShares/100).toFixed(0)}</div></div>
                    <div class="info-card"><div class="small-text">Ср. цена 24ч</div><div class="price">${avg24h.toFixed(2)}⭐</div></div>
                </div>
                <div class="timeframe-buttons">
                    <button class="timeframe-btn ${currentTimeframe === '1d' ? 'active' : ''}" data-tf="1d">1д</button>
                    <button class="timeframe-btn ${currentTimeframe === '7d' ? 'active' : ''}" data-tf="7d">7д</button>
                    <button class="timeframe-btn ${currentTimeframe === '30d' ? 'active' : ''}" data-tf="30d">30д</button>
                    <button id="refreshChartBtn" style="background:rgba(255,255,255,0.1); padding:6px 12px;">🔄</button>
                </div>
                <div id="stocks-chart-container" class="chart-container"></div>
                <div id="stocks-ticker" class="ticker"></div>
            </div>
            <div class="card">
                <div class="orderbook">
                    <div class="orderbook-column"><h4>📉 Продажа</h4><div id="sellOrdersList"></div></div>
                    <div class="orderbook-column"><h4>📈 Покупка</h4><div id="buyOrdersList"></div></div>
                </div>
            </div>
            <div class="card">
                <h3>📈 Продать акции</h3>
                <div id="sellFormContainer">${renderSellForm()}</div>
            </div>
            <div class="card">
                <h3>🛒 Купить (лимит)</h3>
                <div id="buyFormContainer">${renderBuyForm()}</div>
            </div>
            <div class="card my-orders-section">
                <div class="section-header"><h4>📌 Мои ордера на продажу</h4><button id="cancelAllSellsBtn" class="cancel-all-btn">Отменить все</button></div>
                <div id="mySellOrdersList"></div>
            </div>
            <div class="card my-orders-section">
                <div class="section-header"><h4>🛒 Мои заявки на покупку</h4><button id="cancelAllBuysBtn" class="cancel-all-btn">Отменить все</button></div>
                <div id="myBuyOrdersList"></div>
            </div>
            <div class="card">
                <h4>🗂 История ордеров</h4>
                <div id="orderHistoryList"></div>
            </div>
        `;
        document.getElementById('app').innerHTML = html;
        
        drawChart(priceHistory);
        await updateTicker();
        await renderOrderBook();
        await loadMyOrders();
        await loadMyBuyOrders();
        await loadOrderHistory();
        
        // Обработчики переключения режима
        const toggleSell = document.getElementById('toggleSellMode');
        if (toggleSell) toggleSell.onclick = () => {
            useSlidersLocal = !useSlidersLocal;
            window.setUseSliders(useSlidersLocal);
            window.renderStocksTab(window.currentUser);
        };
        const toggleBuy = document.getElementById('toggleBuyMode');
        if (toggleBuy) toggleBuy.onclick = () => {
            useSlidersLocal = !useSlidersLocal;
            window.setUseSliders(useSlidersLocal);
            window.renderStocksTab(window.currentUser);
        };
        
        // Обработчики кнопок времени
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.onclick = async () => {
                currentTimeframe = btn.dataset.tf;
                await window.renderStocksTab(window.currentUser);
            };
        });
        document.getElementById('refreshChartBtn').onclick = async () => {
            await window.renderStocksTab(window.currentUser);
        };
        
        // Продажа
        document.getElementById('sellBtn').onclick = async () => {
            let amount, price;
            if (useSlidersLocal) {
                amount = parseFloat(document.getElementById('sellAmountSlider').value);
                price = parseFloat(document.getElementById('sellPriceSlider').value);
            } else {
                amount = parseFloat(document.getElementById('sellAmount').value);
                price = parseFloat(document.getElementById('sellPrice').value);
            }
            if (isNaN(amount) || amount < 0.01 || isNaN(price) || price < 1) {
                window.showCustomModal('Ошибка', 'Введите корректные значения');
                return;
            }
            try {
                await window.createOrder(amount, price);
                await window.renderStocksTab(window.currentUser);
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        };
        // Покупка лимит
        document.getElementById('buyLimitBtn').onclick = async () => {
            let amount, price;
            if (useSlidersLocal) {
                amount = parseFloat(document.getElementById('buyAmountSlider').value);
                price = parseFloat(document.getElementById('buyPriceSlider').value);
            } else {
                amount = parseFloat(document.getElementById('buyAmountLimit').value);
                price = parseFloat(document.getElementById('buyPriceLimit').value);
            }
            if (isNaN(amount) || amount < 0.01 || isNaN(price) || price < 1) {
                window.showCustomModal('Ошибка', 'Введите корректные значения');
                return;
            }
            try {
                await window.createBuyOrder(amount, price);
                await window.renderStocksTab(window.currentUser);
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        };
        // Рыночные
        document.getElementById('marketBuyBtn').onclick = async () => {
            const stars = parseFloat(prompt('Сумма в ⭐:', '100'));
            if (isNaN(stars) || stars <= 0) return;
            try {
                await window.marketBuy(stars);
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        };
        document.getElementById('marketSellBtn').onclick = async () => {
            const shares = parseFloat(prompt('Количество акций:', '1'));
            if (isNaN(shares) || shares <= 0) return;
            try {
                await window.marketSell(shares);
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        };
        // Отмена всех
        document.getElementById('cancelAllSellsBtn').onclick = async () => {
            if (confirm('Отменить все ваши ордера на продажу?')) {
                const orders = await window.getUserOrders();
                for (let o of orders) await window.cancelOrder(o.id);
                window.showToast(`Отменено ${orders.length} ордеров`);
                await window.renderStocksTab(window.currentUser);
            }
        };
        document.getElementById('cancelAllBuysBtn').onclick = async () => {
            if (confirm('Отменить все заявки на покупку?')) {
                const { data } = await window.supabase.from('buy_orders').select('id').eq('buyer_id', window.userId).eq('status', 'active');
                for (let o of data) await window.cancelBuyOrder(o.id);
                window.showToast(`Отменено ${data.length} заявок`);
                await window.renderStocksTab(window.currentUser);
            }
        };
        
        // Обновление значений слайдеров
        if (useSlidersLocal) {
            const sellAmountSlider = document.getElementById('sellAmountSlider');
            const sellAmountVal = document.getElementById('sellAmountVal');
            const sellPriceSlider = document.getElementById('sellPriceSlider');
            const sellPriceVal = document.getElementById('sellPriceVal');
            if (sellAmountSlider) {
                sellAmountSlider.oninput = () => { sellAmountVal.innerText = sellAmountSlider.value; };
                sellPriceSlider.oninput = () => { sellPriceVal.innerText = sellPriceSlider.value; };
            }
            const buyAmountSlider = document.getElementById('buyAmountSlider');
            const buyAmountVal = document.getElementById('buyAmountVal');
            const buyPriceSlider = document.getElementById('buyPriceSlider');
            const buyPriceVal = document.getElementById('buyPriceVal');
            if (buyAmountSlider) {
                buyAmountSlider.oninput = () => { buyAmountVal.innerText = buyAmountSlider.value; };
                buyPriceSlider.oninput = () => { buyPriceVal.innerText = buyPriceSlider.value; };
            }
        }
        
        // Realtime
        if (realtimeChannel) window.supabase.removeChannel(realtimeChannel);
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
    } catch (err) {
        console.error(err);
        document.getElementById('app').innerHTML = `<div class="card error">${err.message}</div>`;
    }
};
