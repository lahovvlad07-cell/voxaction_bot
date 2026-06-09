// stocks.js – финальная, чистая, с единым стилем и исправлениями
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

function drawChart(history) {
    const container = document.getElementById('stocks-chart-container');
    if (!container) return;
    container.innerHTML = '';
    if (!history || history.length === 0) {
        container.innerHTML = '<div class="chart-placeholder" style="display:flex; align-items:center; justify-content:center; height:100%; color:#9ca3af;">📈 Нет данных для графика</div>';
        return;
    }
    const canvas = document.createElement('canvas');
    const width = container.clientWidth, height = 200;
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

async function updateTicker() {
    const trades = await window.getRecentTrades(10);
    const container = document.getElementById('stocks-ticker');
    if (!container) return;
    if (!trades.length) {
        container.innerHTML = '<div class="ticker-content">Нет сделок</div>';
        return;
    }
    const items = trades.map(t => `<span class="trade-item">${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐</span>`).join('');
    container.innerHTML = `<div class="ticker-content">${items}</div>`;
}

// Рыночные сделки
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

async function renderOrderBook() {
    const { data: sells } = await window.supabase.from('orders').select('amount, price_per_share, seller_id').eq('status', 'active').order('price_per_share', { ascending: true }).limit(4);
    const { data: buys } = await window.supabase.from('buy_orders').select('amount, price_per_share, buyer_id').eq('status', 'active').order('price_per_share', { ascending: false }).limit(4);
    const userIds = [...(sells?.map(s=>s.seller_id)||[]), ...(buys?.map(b=>b.buyer_id)||[])];
    let userMap = new Map();
    if (userIds.length) {
        const { data: users } = await window.supabase.from('users').select('id, username').in('id', userIds);
        users?.forEach(u => userMap.set(u.id, u.username));
    }
    const sellHtml = (sells||[]).map(s => `<div class="orderbook-row"><span>${window.fromCents(s.amount)} шт.</span><span class="price-sell">${window.fromCents(s.price_per_share)} ⭐</span><span class="small-text">${userMap.get(s.seller_id) || 'anon'}</span></div>`).join('');
    const buyHtml = (buys||[]).map(b => `<div class="orderbook-row"><span>${window.fromCents(b.amount)} шт.</span><span class="price-buy">${window.fromCents(b.price_per_share)} ⭐</span><span class="small-text">${userMap.get(b.buyer_id) || 'anon'}</span></div>`).join('');
    const sellDiv = document.getElementById('sellOrdersList');
    const buyDiv = document.getElementById('buyOrdersList');
    if (sellDiv) sellDiv.innerHTML = sellHtml || '<div class="small-text" style="text-align:center;">Нет заявок на продажу</div>';
    if (buyDiv) buyDiv.innerHTML = buyHtml || '<div class="small-text" style="text-align:center;">Нет заявок на покупку</div>';
}

async function loadMyOrders() {
    const orders = await window.getUserOrders();
    const container = document.getElementById('mySellOrdersList');
    if (!container) return;
    if (!orders.length) {
        container.innerHTML = '<div class="small-text" style="text-align:center;">Нет активных ордеров</div>';
        return;
    }
    const html = orders.map(o => `<div class="order-card"><span>${window.fromCents(o.amount)} шт.</span><span class="price-sell">${window.fromCents(o.price_per_share)} ⭐</span><button class="cancel-btn-small" data-id="${o.id}">Отменить</button></div>`).join('');
    container.innerHTML = html;
    document.querySelectorAll('#mySellOrdersList .cancel-btn-small').forEach(btn => {
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
    const container = document.getElementById('myBuyOrdersList');
    if (!container) return;
    if (!data?.length) {
        container.innerHTML = '<div class="small-text" style="text-align:center;">Нет активных заявок</div>';
        return;
    }
    const html = data.map(o => `<div class="order-card"><span>Купить ${window.fromCents(o.amount)} шт.</span><span class="price-buy">${window.fromCents(o.price_per_share)} ⭐</span><button class="cancel-buy-btn" data-id="${o.id}">Отменить</button></div>`).join('');
    container.innerHTML = html;
    document.querySelectorAll('#myBuyOrdersList .cancel-buy-btn').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Отменить заявку?')) {
                await window.cancelBuyOrder(btn.dataset.id);
                await window.renderStocksTab(window.currentUser);
            }
        };
    });
}

async function loadOrderHistory() {
    const { data } = await window.supabase.from('orders').select('amount, price_per_share, status, created_at').eq('seller_id', window.userId).in('status', ['completed', 'cancelled']).order('created_at', { ascending: false }).limit(8);
    const container = document.getElementById('orderHistoryList');
    if (!container) return;
    if (!data?.length) {
        container.innerHTML = '<div class="small-text" style="text-align:center;">Нет истории ордеров</div>';
        return;
    }
    const tableHtml = `
        <table class="history-table">
            <thead><tr><th>Кол-во</th><th>Цена</th><th>Статус</th><th>Дата</th></tr></thead>
            <tbody>
                ${data.map(o => `<tr><td>${window.fromCents(o.amount)}</td><td>${window.fromCents(o.price_per_share)} ⭐</td><td class="${o.status === 'completed' ? 'status-completed' : 'status-cancelled'}">${o.status === 'completed' ? '✅' : '❌'}</td><td>${new Date(o.created_at).toLocaleString().slice(0,16)}</td></tr>`).join('')}
            </tbody>
        </table>
    `;
    container.innerHTML = tableHtml;
}

function renderSellForm(useSliders, maxShares) {
    if (useSliders) {
        return `
            <div class="slider-group"><label>Количество акций: <span id="sellAmountVal">0.01</span></label><input type="range" id="sellAmountSlider" min="0.01" max="${maxShares}" step="0.01" value="0.01"></div>
            <div class="slider-group"><label>Цена (⭐): <span id="sellPriceVal">1</span></label><input type="range" id="sellPriceSlider" min="1" max="100" step="0.1" value="1"></div>
            <button id="sellBtn">Продать</button>
        `;
    } else {
        return `
            <div class="form-row"><label>Количество:</label><input type="number" id="sellAmount" step="0.01" min="0.01" placeholder="0.01" value="0.01"></div>
            <div class="form-row"><label>Цена (⭐):</label><input type="number" id="sellPrice" step="0.1" min="1" placeholder="1" value="1"></div>
            <button id="sellBtn">Продать</button>
        `;
    }
}

function renderBuyForm(useSliders) {
    if (useSliders) {
        return `
            <div class="slider-group"><label>Количество акций: <span id="buyAmountVal">0.01</span></label><input type="range" id="buyAmountSlider" min="0.01" max="1000" step="0.01" value="0.01"></div>
            <div class="slider-group"><label>Цена (⭐): <span id="buyPriceVal">1</span></label><input type="range" id="buyPriceSlider" min="1" max="100" step="0.1" value="1"></div>
            <button id="buyLimitBtn">Купить</button>
        `;
    } else {
        return `
            <div class="form-row"><label>Количество:</label><input type="number" id="buyAmountLimit" step="0.01" min="0.01" placeholder="0.01" value="0.01"></div>
            <div class="form-row"><label>Цена (⭐):</label><input type="number" id="buyPriceLimit" step="0.1" min="1" placeholder="1" value="1"></div>
            <button id="buyLimitBtn">Купить</button>
        `;
    }
}

// ========== ОСНОВНОЙ РЕНДЕР ==========
window.renderStocksTab = async function(currentUser) {
    try {
        const maxShares = window.fromCents(currentUser.shares);
        const priceHistory = await window.fetchPriceHistoryForTimeframe(currentTimeframe);
        const { totalShares, currentPrice, marketCap } = await window.getTotalMarketCap();
        const avg24h = await window.get24hAvgPrice();
        
        const html = `
            <div class="stocks-content">
                <div class="balance-row">
                    <div class="balance-item"><div class="label">📊 Акций</div><div class="value">${window.fromCents(currentUser.shares)}</div></div>
                    <div class="balance-item"><div class="label">⭐ Stars</div><div class="value">${window.fromCents(currentUser.stars_balance)}</div></div>
                    <div class="balance-item price"><div class="label">💰 Цена</div><div class="value">${(currentPrice/100).toFixed(2)} ⭐</div></div>
                </div>
                <div class="info-panel">
                    <div class="info-card"><div class="small-text">Капитал.</div><div class="price">${Math.round(marketCap)} ⭐</div></div>
                    <div class="info-card"><div class="small-text">Всего акций</div><div class="price">${(totalShares/100).toFixed(2)}</div></div>
                    <div class="info-card"><div class="small-text">Ср. цена 24ч</div><div class="price">${avg24h.toFixed(2)} ⭐</div></div>
                </div>
                <div class="timeframe-buttons">
                    <button class="timeframe-btn ${currentTimeframe === '1d' ? 'active' : ''}" data-tf="1d">1д</button>
                    <button class="timeframe-btn ${currentTimeframe === '7d' ? 'active' : ''}" data-tf="7d">7д</button>
                    <button class="timeframe-btn ${currentTimeframe === '30d' ? 'active' : ''}" data-tf="30d">30д</button>
                    <button id="refreshChartBtn">🔄 Обновить</button>
                </div>
                <div id="stocks-chart-container" class="chart-container"></div>
                <div id="stocks-ticker" class="ticker"></div>
                <div class="orderbook">
                    <div class="orderbook-column"><h4>Продажа</h4><div id="sellOrdersList"></div></div>
                    <div class="orderbook-column"><h4>Покупка</h4><div id="buyOrdersList"></div></div>
                </div>
                <div class="sell-form">
                    <h3>Продать акции</h3>
                    ${renderSellForm(useSlidersSell, maxShares)}
                    <button id="toggleSellMode" class="toggle-mode-btn">✍️ ${useSlidersSell ? 'Поля ввода' : 'Ручной ввод'}</button>
                </div>
                <div class="buy-limit-form">
                    <h3>Купить (лимит)</h3>
                    ${renderBuyForm(useSlidersBuy)}
                    <button id="toggleBuyMode" class="toggle-mode-btn">✍️ ${useSlidersBuy ? 'Поля ввода' : 'Ручной ввод'}</button>
                </div>
                <div class="section-header"><h3>Мои ордера на продажу</h3><button id="cancelAllSellsBtn" class="cancel-all-btn">Отменить все</button></div>
                <div id="mySellOrdersList"></div>
                <div class="section-header"><h3>Мои заявки на покупку</h3><button id="cancelAllBuysBtn" class="cancel-all-btn">Отменить все</button></div>
                <div id="myBuyOrdersList"></div>
                <div class="section-header"><h3>История ордеров</h3></div>
                <div id="orderHistoryList"></div>
            </div>
            <div class="market-buttons-fixed">
                <button id="marketBuyBtn" style="background: linear-gradient(135deg,#fbbf24,#f59e0b);">🚀 Рыночная покупка</button>
                <button id="marketSellBtn" style="background: linear-gradient(135deg,#f97316,#ea580c);">📉 Рыночная продажа</button>
            </div>
        `;
        document.getElementById('app').innerHTML = html;
        
        drawChart(priceHistory);
        await updateTicker();
        await renderOrderBook();
        await loadMyOrders();
        await loadMyBuyOrders();
        await loadOrderHistory();
        
        // Обработчики таймфреймов
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.onclick = async () => { currentTimeframe = btn.dataset.tf; await window.renderStocksTab(currentUser); };
        });
        document.getElementById('refreshChartBtn').onclick = async () => { await window.renderStocksTab(currentUser); };
        
        // Инициализация слайдеров (если активны)
        if (useSlidersSell) {
            const sellSlider = document.getElementById('sellAmountSlider');
            const sellVal = document.getElementById('sellAmountVal');
            const sellPriceSlider = document.getElementById('sellPriceSlider');
            const sellPriceVal = document.getElementById('sellPriceVal');
            if (sellSlider) sellSlider.oninput = () => sellVal.innerText = sellSlider.value;
            if (sellPriceSlider) sellPriceSlider.oninput = () => sellPriceVal.innerText = sellPriceSlider.value;
        }
        if (useSlidersBuy) {
            const buySlider = document.getElementById('buyAmountSlider');
            const buyVal = document.getElementById('buyAmountVal');
            const buyPriceSlider = document.getElementById('buyPriceSlider');
            const buyPriceVal = document.getElementById('buyPriceVal');
            if (buySlider) buySlider.oninput = () => buyVal.innerText = buySlider.value;
            if (buyPriceSlider) buyPriceSlider.oninput = () => buyPriceVal.innerText = buyPriceSlider.value;
        }
        
        // Переключение режимов
        document.getElementById('toggleSellMode').onclick = () => {
            useSlidersSell = !useSlidersSell;
            window.renderStocksTab(currentUser);
        };
        document.getElementById('toggleBuyMode').onclick = () => {
            useSlidersBuy = !useSlidersBuy;
            window.renderStocksTab(currentUser);
        };
        
        // Кнопки продажи/покупки
        document.getElementById('sellBtn').onclick = async () => {
            let amount, price;
            if (useSlidersSell) {
                amount = parseFloat(document.getElementById('sellAmountSlider').value);
                price = parseFloat(document.getElementById('sellPriceSlider').value);
            } else {
                amount = parseFloat(document.getElementById('sellAmount').value);
                price = parseFloat(document.getElementById('sellPrice').value);
            }
            if (isNaN(amount) || amount <= 0 || isNaN(price) || price <= 0) return window.showCustomModal('Ошибка', 'Введите корректные значения');
            try { await window.createOrder(amount, price); await window.renderStocksTab(currentUser); } catch (err) { window.showCustomModal('Ошибка', err.message); }
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
            if (isNaN(amount) || amount <= 0 || isNaN(price) || price <= 0) return window.showCustomModal('Ошибка', 'Введите корректные значения');
            try { await window.createBuyOrder(amount, price); await window.renderStocksTab(currentUser); } catch (err) { window.showCustomModal('Ошибка', err.message); }
        };
        
        // Рыночные кнопки (через модалку или prompt)
        document.getElementById('marketBuyBtn').onclick = async () => {
            const stars = parseFloat(prompt('Сколько ⭐ потратить?', '100'));
            if (isNaN(stars) || stars <= 0) return;
            try { await marketBuy(stars); } catch (err) { window.showCustomModal('Ошибка', err.message); }
        };
        document.getElementById('marketSellBtn').onclick = async () => {
            const shares = parseFloat(prompt('Сколько акций продать?', '1'));
            if (isNaN(shares) || shares <= 0) return;
            try { await marketSell(shares); } catch (err) { window.showCustomModal('Ошибка', err.message); }
        };
        
        // Отмена всех ордеров
        document.getElementById('cancelAllSellsBtn').onclick = async () => {
            if (confirm('Отменить все ваши ордера на продажу?')) {
                const orders = await window.getUserOrders();
                for (let o of orders) await window.cancelOrder(o.id);
                window.showToast(`Отменено ${orders.length} ордеров`);
                await window.renderStocksTab(currentUser);
            }
        };
        document.getElementById('cancelAllBuysBtn').onclick = async () => {
            if (confirm('Отменить все заявки на покупку?')) {
                const { data } = await window.supabase.from('buy_orders').select('id').eq('buyer_id', window.userId).eq('status', 'active');
                for (let o of data) await window.cancelBuyOrder(o.id);
                window.showToast(`Отменено ${data.length} заявок`);
                await window.renderStocksTab(currentUser);
            }
        };
        
        // Realtime
        if (realtimeChannel) window.supabase.removeChannel(realtimeChannel);
        realtimeChannel = window.supabase.channel('stocks-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { if (document.querySelector('.tab[data-tab="stocks"].active')) window.renderStocksTab(currentUser); })
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'trades' }, () => { if (document.querySelector('.tab[data-tab="stocks"].active')) { updateTicker(); window.renderStocksTab(currentUser); } })
            .subscribe();
    } catch (err) {
        console.error(err);
        document.getElementById('app').innerHTML = `<div class="card error">${err.message}</div>`;
    }
};
