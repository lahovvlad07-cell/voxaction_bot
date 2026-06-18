// stocks.js – финальная версия с профессиональным графиком, компактными ордерами, модалкой покупки, автообновлением

// Определяем глобальную функцию getActiveBuyOrders, если её нет
if (!window.getActiveBuyOrders) {
    window.getActiveBuyOrders = async function() {
        const { data, error } = await window.supabase
            .from('buy_orders')
            .select('*')
            .eq('status', 'active')
            .order('price_per_share', { ascending: false });
        if (error) throw new Error(error.message);
        return data || [];
    };
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
let updateInterval = null;
let isTabActive = true;

function showUpdateIndicator() {
    let dot = document.getElementById('updateDot');
    if (!dot) {
        dot = document.createElement('div');
        dot.id = 'updateDot';
        dot.style.cssText = 'display:inline-block; width:10px; height:10px; background:#4ade80; border-radius:50%; margin-left:8px; animation:pulse-dot 1.5s infinite; vertical-align:middle;';
        const header = document.querySelector('.balance-row');
        if (header) header.appendChild(dot);
    }
}

function hideUpdateIndicator() {
    const dot = document.getElementById('updateDot');
    if (dot) dot.remove();
}

function groupOrdersByPrice(orders, type) {
    const map = new Map();
    orders.forEach(o => {
        const price = o.price_per_share / 100;
        const amount = o.amount / 100;
        map.set(price, (map.get(price) || 0) + amount);
    });
    const sorted = Array.from(map.entries()).map(([price, amount]) => ({ price, amount }));
    return type === 'sell' ? sorted.sort((a, b) => a.price - b.price) : sorted.sort((a, b) => b.price - a.price);
}

// ===== МОДАЛКА ПОКУПКИ (симметричная) =====
function showBuyModal(orderId, maxAmount, price, callback) {
    const modalHtml = `
        <div class="modal" id="buyModal" style="display:flex;">
            <div class="modal-content" style="max-width: 360px;">
                <span class="close-modal" id="closeBuyModal">&times;</span>
                <h3>📈 Покупка акций</h3>
                <div style="padding: 16px 0;">
                    <div style="display:flex; justify-content:space-between; font-size:14px; color:#9ca3af; margin-bottom:12px;">
                        <span>Цена за 1 шт.</span>
                        <span style="color:#0ff; font-weight:bold;">${price.toFixed(2)} ⭐</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; font-size:14px; color:#9ca3af; margin-bottom:16px;">
                        <span>Доступно</span>
                        <span style="color:#4ade80; font-weight:bold;">${maxAmount.toFixed(2)} шт.</span>
                    </div>
                    <input type="number" id="buyAmountInput" placeholder="Введите количество (шт.)" step="0.01" min="0.01" max="${maxAmount}" style="margin-bottom:12px; width:100%; padding:12px; background:#0a0f1a; border:1px solid #0ff; border-radius:40px; color:#fff; font-size:16px; text-align:center;">
                    <div style="display:flex; gap:12px; margin-bottom:12px;">
                        <button id="buyConfirmBtn" style="flex:1; padding:12px; border-radius:40px; background:linear-gradient(135deg,#00c6ff,#0072ff); border:none; color:white; font-weight:bold; cursor:pointer;">Купить</button>
                        <button id="buyAllBtn" style="flex:1; padding:12px; border-radius:40px; background:rgba(255,255,255,0.05); border:1px solid rgba(0,255,255,0.3); color:#0ff; font-weight:bold; cursor:pointer;">Всё</button>
                    </div>
                </div>
                <div style="text-align:center;">
                    <button id="cancelBuyModal" style="padding:8px 24px; border-radius:40px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); color:#9ca3af; cursor:pointer;">Отмена</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('buyModal');
    const input = document.getElementById('buyAmountInput');
    const confirmBtn = document.getElementById('buyConfirmBtn');
    const buyAllBtn = document.getElementById('buyAllBtn');
    const cancelBtn = document.getElementById('cancelBuyModal');
    const closeBtn = document.getElementById('closeBuyModal');

    const closeModal = () => modal.remove();
    closeBtn.onclick = closeModal;
    cancelBtn.onclick = closeModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    buyAllBtn.onclick = () => {
        input.value = maxAmount;
        input.dispatchEvent(new Event('input'));
    };

    confirmBtn.onclick = () => {
        const amount = parseFloat(input.value);
        if (isNaN(amount) || amount <= 0 || amount > maxAmount) {
            window.showCustomModal('Ошибка', `Введите количество от 0.01 до ${maxAmount.toFixed(2)}`);
            return;
        }
        closeModal();
        callback(orderId, amount);
    };
}

// ===== ГЛАВНЫЙ РЕНДЕР =====
window.renderStocksTab = async function(currentUser) {
    if (updateInterval) clearInterval(updateInterval);

    function getInputMode() {
        return localStorage.getItem('stock_input_mode') === 'slider' ? 'slider' : 'field';
    }

    function renderInputControls(amountContainer, priceContainer, mode, curAmount = '', curPrice = '') {
        if (mode === 'slider') {
            amountContainer.innerHTML = `
                <input type="range" id="orderAmountSlider" min="1" max="1000" step="1" value="${curAmount || 1}">
                <div class="slider-value">${curAmount || 1} шт.</div>
            `;
            priceContainer.innerHTML = `
                <input type="range" id="orderPriceSlider" min="1" max="10" step="0.1" value="${curPrice || 1}">
                <div class="slider-value">${(curPrice || 1).toFixed(1)} ⭐</div>
            `;
            const aS = document.getElementById('orderAmountSlider');
            const pS = document.getElementById('orderPriceSlider');
            if (aS) aS.oninput = () => {
                const v = parseInt(aS.value);
                aS.nextElementSibling.innerText = v + ' шт.';
                if (document.getElementById('orderAmount')) document.getElementById('orderAmount').value = v;
            };
            if (pS) pS.oninput = () => {
                const v = parseFloat(pS.value).toFixed(1);
                pS.nextElementSibling.innerText = v + ' ⭐';
                if (document.getElementById('orderPrice')) document.getElementById('orderPrice').value = v;
            };
        } else {
            amountContainer.innerHTML = `<input type="number" id="orderAmount" placeholder="Количество (шт.)" step="1" min="1" value="">`;
            priceContainer.innerHTML = `<input type="number" id="orderPrice" placeholder="Цена за 1 шт. (⭐)" step="0.1" min="1" value="">`;
        }
    }

    function showMarketModal(type, callback) {
        const modalHtml = `
            <div class="modal" id="marketModal" style="display:flex;">
                <div class="modal-content" style="max-width: 300px;">
                    <span class="close-modal" id="closeMarketModal">&times;</span>
                    <h3>${type === 'buy' ? '🚀 Рыночная покупка' : '📉 Рыночная продажа'}</h3>
                    <input type="number" id="marketAmount" placeholder="${type === 'buy' ? 'Сумма в Stars' : 'Количество акций'}" step="1" min="1" style="margin: 16px 0;">
                    <div class="modal-buttons">
                        <button id="marketCancelBtn" class="secondary">Отмена</button>
                        <button id="marketConfirmBtn">${type === 'buy' ? 'Купить' : 'Продать'}</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('marketModal');
        document.getElementById('closeMarketModal').onclick = () => modal.remove();
        document.getElementById('marketCancelBtn').onclick = () => modal.remove();
        document.getElementById('marketConfirmBtn').onclick = () => {
            const val = parseFloat(document.getElementById('marketAmount').value);
            if (!isNaN(val) && val >= 1) {
                modal.remove();
                callback(val);
            } else {
                window.showCustomModal('Ошибка', 'Введите корректное значение (минимум 1)');
            }
        };
    }

    // Получение данных
    const hideBalance = localStorage.getItem('hide_balance') === 'true';
    const userShares = hideBalance ? '***' : window.fromCents(currentUser.shares);
    const userStars = hideBalance ? '***' : window.fromCents(currentUser.stars_balance);
    
    const [
        currentPriceCents,
        marketCapData,
        avgPrice24hCents,
        activeSellOrders,
        activeBuyOrders,
        mySellOrders,
        myBuyOrders,
        priceHistory
    ] = await Promise.all([
        window.getCurrentPrice(),
        window.getTotalMarketCap(),
        window.get24hAvgPrice(),
        window.getActiveOrders(),
        window.getActiveBuyOrders(),
        window.getUserOrders(),
        (async () => {
            const { data } = await window.supabase.from('buy_orders').select('*').eq('buyer_id', window.userId).eq('status', 'active');
            return data || [];
        })(),
        (async () => {
            const { data: trades } = await window.supabase
                .from('trades')
                .select('price_per_share, created_at')
                .order('created_at', { ascending: true })
                .limit(500);
            if (!trades || trades.length === 0) return [];
            const days = {};
            trades.forEach(t => {
                const day = t.created_at.slice(0,10);
                if (!days[day]) days[day] = { sum: 0, count: 0 };
                days[day].sum += t.price_per_share;
                days[day].count++;
            });
            return Object.entries(days).map(([date, { sum, count }]) => ({
                date,
                price: sum / count / 100
            }));
        })()
    ]);

    // Цена
    let showPrice = '—';
    let hasPrice = false;
    if (priceHistory.length > 0 && currentPriceCents && currentPriceCents >= 100) {
        showPrice = (currentPriceCents / 100).toFixed(2);
        hasPrice = true;
    } else if (currentPriceCents && currentPriceCents > 100) {
        showPrice = (currentPriceCents / 100).toFixed(2);
        hasPrice = true;
    }
    
    const marketCap = marketCapData.marketCap.toFixed(2);
    const totalShares = (marketCapData.totalShares / 100).toFixed(2);
    
    let avgPercentText = '0%';
    let avgPercentClass = '';
    if (avgPrice24hCents >= 100 && currentPriceCents >= 100 && currentPriceCents > 100) {
        const percent = ((currentPriceCents - avgPrice24hCents) / avgPrice24hCents) * 100;
        avgPercentText = (percent >= 0 ? `+${percent.toFixed(2)}%` : `${percent.toFixed(2)}%`);
        avgPercentClass = percent >= 0 ? 'positive' : 'negative';
    }

    // ---- HTML (без вкладки "История") ----
    const html = `
        <div class="stocks-container">
            <!-- Баланс и цена -->
            <div class="balance-row">
                <div class="balance-card"><div class="bal-label">📊 Акции</div><div class="bal-value">${userShares}</div></div>
                <div class="balance-card"><div class="bal-label">⭐ Stars</div><div class="bal-value">${userStars}</div></div>
                <div class="balance-card"><div class="bal-label">💰 Цена</div><div class="bal-value ${hasPrice ? 'price-active' : 'price-placeholder'}">${showPrice}</div></div>
            </div>
            
            <!-- График (увеличенный с тултипом) -->
            <div class="chart-container-main" style="height:200px; position:relative;">
                <canvas id="mainPriceChart" width="600" height="200" style="width:100%; height:200px;"></canvas>
                <div class="chart-tooltip" id="chartTooltip"><span class="price"></span></div>
            </div>
            
            <!-- Статистика -->
            <div class="stats-row">
                <div class="stat-card"><div class="stat-icon">🏦</div><div class="stat-label">Капитализация</div><div class="stat-value">${marketCap} ⭐</div></div>
                <div class="stat-card"><div class="stat-icon">📦</div><div class="stat-label">Всего акций</div><div class="stat-value">${totalShares}</div></div>
                <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-label">Ср. цена (24ч)</div><div class="stat-value ${avgPercentClass}">${avgPercentText}</div></div>
            </div>
            
            <!-- Табы -->
            <div class="tabs-row">
                <button class="tab-btn active" data-tab="orderform"><span class="tab-icon">✍️</span><span class="tab-label">Новый ордер</span></button>
                <button class="tab-btn" data-tab="orderbook"><span class="tab-icon">📖</span><span class="tab-label">Стакан</span></button>
                <button class="tab-btn" data-tab="orders"><span class="tab-icon">📋</span><span class="tab-label">Ордера</span></button>
                <button class="tab-btn" data-tab="myorders"><span class="tab-icon">📌</span><span class="tab-label">Мои ордера</span></button>
            </div>
            
            <!-- Панели -->
            <div id="tab-orderform" class="tab-pane active">
                <div class="order-form-panel">
                    <div class="type-switch">
                        <button id="orderTypeSell" class="type-opt active">📉 Продать</button>
                        <button id="orderTypeBuy" class="type-opt">📈 Купить</button>
                    </div>
                    <div id="amountControl" class="control-group"></div>
                    <div id="priceControl" class="control-group"></div>
                    <button id="createOrderBtn">✅ Разместить ордер</button>
                    <div class="hint">Лучшие предложения появятся в стакане после размещения ордера.</div>
                </div>
            </div>
            <div id="tab-orderbook" class="tab-pane">
                <div class="orderbook-split">
                    <div class="orderbook-col">
                        <div class="orderbook-title">💰 Продажа</div>
                        <div id="sellBookList" class="orderbook-list"></div>
                    </div>
                    <div class="orderbook-col">
                        <div class="orderbook-title">🏦 Покупка</div>
                        <div id="buyBookList" class="orderbook-list"></div>
                    </div>
                </div>
            </div>
            <div id="tab-orders" class="tab-pane">
                <div class="section-header">📋 Активные ордера на продажу</div>
                <div id="activeSellOrdersList" class="orders-container"></div>
            </div>
            <div id="tab-myorders" class="tab-pane">
                <div class="my-orders-block"><div class="section-header">📌 Мои ордера на продажу</div><div id="mySellOrdersList" class="orders-container"></div></div>
                <div class="my-orders-block"><div class="section-header">🛒 Мои заявки на покупку</div><div id="myBuyOrdersList" class="orders-container"></div></div>
            </div>
        </div>
        <div class="market-buttons">
            <button id="marketBuyBtn" class="market-btn buy">🚀 Рыночная покупка</button>
            <button id="marketSellBtn" class="market-btn sell">📉 Рыночная продажа</button>
        </div>
    `;

    document.getElementById('app').innerHTML = html;

    // ---- ГРАФИК (профессиональный с тултипом) ----
    function drawMainChart() {
        const canvas = document.getElementById('mainPriceChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.clientWidth;
        const h = 200;
        canvas.width = w;
        canvas.height = h;

        if (!priceHistory.length) {
            ctx.fillStyle = '#0f1320';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#9ca3af';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Нет данных для графика', w/2, h/2);
            return;
        }

        const prices = priceHistory.map(p => p.price);
        const maxP = Math.max(...prices, 0.01);
        const minP = Math.min(...prices, 0);
        const range = maxP - minP || 1;
        const padding = { top: 10, bottom: 20, left: 35, right: 10 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;

        ctx.clearRect(0, 0, w, h);
        
        // Сетка (горизонтальные линии)
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 0.5;
        const steps = 5;
        for (let i = 0; i <= steps; i++) {
            const y = padding.top + (chartH / steps) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();
            // Подписи цен
            const price = maxP - (range / steps) * i;
            ctx.fillStyle = '#9ca3af';
            ctx.font = '9px sans-serif';
            ctx.textAlign = 'right';
            ctx.fillText(price.toFixed(2), padding.left - 5, y + 3);
        }

        // Линия цены (сглаженная)
        ctx.beginPath();
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2;
        const step = chartW / (prices.length - 1);
        ctx.moveTo(padding.left, padding.top + chartH - ((prices[0] - minP) / range) * chartH);
        for (let i = 1; i < prices.length; i++) {
            const x = padding.left + i * step;
            const y = padding.top + chartH - ((prices[i] - minP) / range) * chartH;
            ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Заливка под линией
        const lastX = padding.left + (prices.length - 1) * step;
        ctx.lineTo(lastX, padding.top + chartH);
        ctx.lineTo(padding.left, padding.top + chartH);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.fill();

        // Интерактивность (tooltip при наведении)
        canvas.onmousemove = function(e) {
            const rect = this.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const index = Math.round((mouseX - padding.left) / step);
            if (index < 0 || index >= prices.length) {
                document.getElementById('chartTooltip').classList.remove('visible');
                return;
            }
            const price = prices[index];
            const tooltip = document.getElementById('chartTooltip');
            tooltip.innerHTML = `<span class="price">${price.toFixed(2)} ⭐</span>`;
            tooltip.style.left = Math.min(Math.max(mouseX, 30), w - 30) + 'px';
            tooltip.classList.add('visible');
        };
        canvas.onmouseleave = function() {
            document.getElementById('chartTooltip').classList.remove('visible');
        };
    }
    setTimeout(drawMainChart, 50);
    window.addEventListener('resize', () => setTimeout(drawMainChart, 50));

    // ---- СТАКАН С ВИЗУАЛЬНЫМИ БАРАМИ ----
    function renderOrderBook() {
        const sellBook = groupOrdersByPrice(activeSellOrders, 'sell').slice(0, 10);
        const buyBook = groupOrdersByPrice(activeBuyOrders, 'buy').slice(0, 10);
        const maxSellVolume = sellBook.length ? Math.max(...sellBook.map(b => b.amount)) : 1;
        const maxBuyVolume = buyBook.length ? Math.max(...buyBook.map(b => b.amount)) : 1;

        document.getElementById('sellBookList').innerHTML = sellBook.length ? sellBook.map(b => `
            <div class="orderbook-row" style="position:relative; padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.05);">
                <div style="position:absolute; right:0; top:0; height:100%; background:rgba(255,100,100,0.15); width:${(b.amount/maxSellVolume)*70}%; z-index:0;"></div>
                <span style="position:relative; z-index:1;">${b.amount.toFixed(2)} шт.</span>
                <span class="price-sell" style="position:relative; z-index:1;">${b.price.toFixed(2)} ⭐</span>
            </div>
        `).join('') : '<div class="empty-placeholder">Нет ордеров</div>';

        document.getElementById('buyBookList').innerHTML = buyBook.length ? buyBook.map(b => `
            <div class="orderbook-row" style="position:relative; padding:6px 12px; border-bottom:1px solid rgba(255,255,255,0.05);">
                <div style="position:absolute; left:0; top:0; height:100%; background:rgba(100,255,100,0.15); width:${(b.amount/maxBuyVolume)*70}%; z-index:0;"></div>
                <span style="position:relative; z-index:1;">${b.amount.toFixed(2)} шт.</span>
                <span class="price-buy" style="position:relative; z-index:1;">${b.price.toFixed(2)} ⭐</span>
            </div>
        `).join('') : '<div class="empty-placeholder">Нет заявок</div>';
    }

    // ---- АКТИВНЫЕ ОРДЕРА (чужие) с кнопкой "Купить" ----
    function renderActiveSellOrders() {
        const container = document.getElementById('activeSellOrdersList');
        if (!container) return;
        const foreignOrders = activeSellOrders.filter(o => o.seller_id !== window.userId);
        if (!foreignOrders.length) { container.innerHTML = '<div class="empty-placeholder">Нет активных ордеров</div>'; return; }
        container.innerHTML = foreignOrders.map(order => {
            const price = order.price_per_share / 100;
            const amount = order.amount / 100;
            const sellerId = order.seller_id;
            return `
                <div class="order-item">
                    <div class="order-info-compact">
                        <span class="order-seller-full">👤 ${sellerId}</span>
                        <span class="order-amount">${amount.toFixed(2)} шт.</span>
                        <span class="order-price">${price.toFixed(2)} ⭐</span>
                    </div>
                    <button class="buy-order-btn" data-id="${order.id}" data-price="${price}" data-amount="${amount}">Купить</button>
                </div>
            `;
        }).join('');

        document.querySelectorAll('.buy-order-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const orderId = parseInt(this.dataset.id);
                const maxAmount = parseFloat(this.dataset.amount);
                const price = parseFloat(this.dataset.price);
                showBuyModal(orderId, maxAmount, price, async (id, amount) => {
                    try {
                        await window.executePartialTrade(id, window.toCents(amount));
                        window.showToast(`✅ Куплено ${amount.toFixed(2)} шт. по ${price.toFixed(2)} ⭐`, 2000);
                        window.refreshActiveTab();
                    } catch(e) {
                        window.showCustomModal('Ошибка', e.message);
                    }
                });
            });
        });
    }

    // ---- МОИ ОРДЕРА ----
    function renderMyOrders() {
        const sellContainer = document.getElementById('mySellOrdersList');
        if (sellContainer) {
            if (!mySellOrders.length) sellContainer.innerHTML = '<div class="empty-placeholder">Нет активных ордеров</div>';
            else sellContainer.innerHTML = mySellOrders.map(order => `<div class="my-order-item"><span>📦 ${(order.amount/100).toFixed(2)} шт. по ${(order.price_per_share/100).toFixed(2)} ⭐</span><button class="cancel-order-btn" data-id="${order.id}" data-type="sell">Отменить</button></div>`).join('');
        }
        const buyContainer = document.getElementById('myBuyOrdersList');
        if (buyContainer) {
            if (!myBuyOrders.length) buyContainer.innerHTML = '<div class="empty-placeholder">Нет активных заявок</div>';
            else buyContainer.innerHTML = myBuyOrders.map(order => `<div class="my-order-item"><span>🛒 Купить ${(order.amount/100).toFixed(2)} шт. по ${(order.price_per_share/100).toFixed(2)} ⭐</span><button class="cancel-order-btn" data-id="${order.id}" data-type="buy">Отменить</button></div>`).join('');
        }
        document.querySelectorAll('.cancel-order-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const type = btn.dataset.type;
                try {
                    if (type === 'sell') await window.cancelOrder(id);
                    else await window.cancelBuyOrder(id);
                    window.showToast('Ордер отменён', 2000);
                    window.refreshActiveTab();
                } catch(e) { window.showCustomModal('Ошибка', e.message); }
            });
        });
    }

    // ---- ПЕРЕКЛЮЧЕНИЕ ТАБОВ ----
    const tabs = document.querySelectorAll('.tab-btn');
    const panes = {
        orderform: document.getElementById('tab-orderform'),
        orderbook: document.getElementById('tab-orderbook'),
        orders: document.getElementById('tab-orders'),
        myorders: document.getElementById('tab-myorders')
    };
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            Object.values(panes).forEach(p => p.classList.remove('active'));
            panes[target].classList.add('active');
            if (target === 'orderbook') renderOrderBook();
            if (target === 'orders') renderActiveSellOrders();
            if (target === 'myorders') renderMyOrders();
            if (target === 'orderform') drawMainChart();
        });
    });

    // ---- ФОРМА ОРДЕРА ----
    let currentOrderType = 'sell';
    document.getElementById('orderTypeSell').onclick = () => { currentOrderType = 'sell'; document.getElementById('orderTypeSell').classList.add('active'); document.getElementById('orderTypeBuy').classList.remove('active'); };
    document.getElementById('orderTypeBuy').onclick = () => { currentOrderType = 'buy'; document.getElementById('orderTypeBuy').classList.add('active'); document.getElementById('orderTypeSell').classList.remove('active'); };

    const amountContainer = document.getElementById('amountControl');
    const priceContainer = document.getElementById('priceControl');

    function refreshInputMode(mode) {
        let curAmount = '', curPrice = '';
        if (mode === 'slider') {
            curAmount = 1;
            curPrice = 1;
        }
        renderInputControls(amountContainer, priceContainer, mode, curAmount, curPrice);
    }
    refreshInputMode(getInputMode());

    document.getElementById('createOrderBtn').onclick = async () => {
        let amount, price;
        if (getInputMode() === 'slider') {
            amount = parseFloat(document.getElementById('orderAmountSlider')?.value);
            price = parseFloat(document.getElementById('orderPriceSlider')?.value);
        } else {
            amount = parseFloat(document.getElementById('orderAmount')?.value);
            price = parseFloat(document.getElementById('orderPrice')?.value);
        }
        if (isNaN(amount) || amount < 1 || isNaN(price) || price < 1) {
            window.showCustomModal('Ошибка', 'Введите корректные количество и цену (минимум 1)');
            return;
        }
        const freshUser = await window.getOrCreateUser();
        const userSharesCents = freshUser.user.shares;
        const userStarsCents = freshUser.user.stars_balance;
        if (currentOrderType === 'sell') {
            const neededSharesCents = window.toCents(amount);
            if (userSharesCents < neededSharesCents) {
                window.showCustomModal('Ошибка', `Недостаточно акций. Доступно: ${window.fromCents(userSharesCents)}`);
                return;
            }
        } else {
            const totalPriceStars = amount * price;
            const neededStarsCents = window.toCents(totalPriceStars);
            if (userStarsCents < neededStarsCents) {
                window.showCustomModal('Ошибка', `Недостаточно Stars. Доступно: ${window.fromCents(userStarsCents)} ⭐`);
                return;
            }
        }
        try {
            if (currentOrderType === 'sell') {
                await window.createOrder(amount, price);
                window.showToast(`✅ Ордер на продажу ${amount} шт. по ${price} ⭐ размещён`, 2500);
            } else {
                await window.createBuyOrder(amount, price);
                window.showToast(`✅ Заявка на покупку ${amount} шт. по ${price} ⭐ размещена`, 2500);
            }
            if (getInputMode() === 'slider') {
                document.getElementById('orderAmountSlider').value = 1;
                document.getElementById('orderPriceSlider').value = 1;
                document.querySelector('#amountControl .slider-value').innerText = '1 шт.';
                document.querySelector('#priceControl .slider-value').innerText = '1.0 ⭐';
            } else {
                document.getElementById('orderAmount').value = '';
                document.getElementById('orderPrice').value = '';
            }
            window.refreshActiveTab();
        } catch(e) {
            window.showCustomModal('Ошибка', e.message);
        }
    };

    // ---- РЫНОЧНЫЕ СДЕЛКИ ----
    document.getElementById('marketBuyBtn').onclick = () => {
        const foreignOrders = activeSellOrders.filter(o => o.seller_id !== window.userId);
        if (!foreignOrders.length) {
            window.showCustomModal('Рыночная покупка', 'Нет доступных сделок для покупки');
            return;
        }
        showMarketModal('buy', async (stars) => {
            try {
                await window.marketBuy(stars);
                window.showToast(`✅ Рыночная покупка на ${stars} ⭐ выполнена`, 2500);
                window.refreshActiveTab();
            } catch(e) {
                window.showCustomModal('Ошибка', e.message);
            }
        });
    };
    document.getElementById('marketSellBtn').onclick = () => {
        const foreignBuyOrders = activeBuyOrders.filter(o => o.buyer_id !== window.userId);
        if (!foreignBuyOrders.length) {
            window.showCustomModal('Рыночная продажа', 'Нет подходящих ордеров на покупку');
            return;
        }
        showMarketModal('sell', async (shares) => {
            try {
                await window.marketSell(shares);
                window.showToast(`✅ Продано ${shares} акций по рыночной цене`, 2500);
                window.refreshActiveTab();
            } catch(e) {
                window.showCustomModal('Ошибка', e.message);
            }
        });
    };

    // ---- АВТООБНОВЛЕНИЕ (каждые 10 секунд) ----
    showUpdateIndicator();
    updateInterval = setInterval(async () => {
        if (!isTabActive) return;
        try {
            const newPrice = await window.getCurrentPrice();
            const newSellOrders = await window.getActiveOrders();
            const newBuyOrders = await window.getActiveBuyOrders();
            
            // Обновляем цену на карточке
            const priceEl = document.querySelector('.balance-card .bal-value.price-active, .balance-card .bal-value.price-placeholder');
            if (priceEl && newPrice && newPrice > 100) {
                priceEl.textContent = (newPrice / 100).toFixed(2);
                priceEl.className = 'bal-value price-active';
            }
            
            // Обновляем стакан, если активен
            const activeTab = document.querySelector('.tab-btn.active');
            if (activeTab && activeTab.dataset.tab === 'orderbook') {
                activeSellOrders.length = 0;
                activeSellOrders.push(...newSellOrders);
                activeBuyOrders.length = 0;
                activeBuyOrders.push(...newBuyOrders);
                renderOrderBook();
            }
            
            // Обновляем ордера, если активны
            if (activeTab && activeTab.dataset.tab === 'orders') {
                activeSellOrders.length = 0;
                activeSellOrders.push(...newSellOrders);
                renderActiveSellOrders();
            }
            
            // Мигаем индикатором
            const dot = document.getElementById('updateDot');
            if (dot) {
                dot.style.background = '#fbbf24';
                setTimeout(() => dot.style.background = '#4ade80', 300);
            }
        } catch(e) {
            console.warn('Auto-update error:', e);
        }
    }, 10000);

    // ---- ЗАВЕРШЕНИЕ ----
    drawMainChart();
    renderOrderBook();
    renderActiveSellOrders();
    renderMyOrders();
};

// Остановка автообновления при уходе с вкладки
document.addEventListener('visibilitychange', () => {
    isTabActive = !document.hidden;
    if (!isTabActive && updateInterval) {
        hideUpdateIndicator();
    } else if (isTabActive) {
        showUpdateIndicator();
    }
});

window.showToast = function(message, duration = 2500) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
};
