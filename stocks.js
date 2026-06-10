// stocks.js – полная версия с графиком ВСЕГДА вверху
// График отображается постоянно, табы переключают только дополнительный контент

// ---- Режим ввода (поля / слайдеры) ----
function getInputMode() {
    return localStorage.getItem('stock_input_mode') === 'slider' ? 'slider' : 'field';
}

function setInputMode(mode) {
    localStorage.setItem('stock_input_mode', mode);
}

function renderInputControls(amountContainer, priceContainer, mode, currentAmount = 1, currentPrice = 1) {
    if (mode === 'slider') {
        amountContainer.innerHTML = `
            <input type="range" id="orderAmountSlider" min="0.1" max="1000" step="0.1" value="${currentAmount}">
            <div class="slider-value">${currentAmount.toFixed(2)} шт.</div>
        `;
        priceContainer.innerHTML = `
            <input type="range" id="orderPriceSlider" min="0.1" max="10" step="0.01" value="${currentPrice}">
            <div class="slider-value">${currentPrice.toFixed(2)} ⭐</div>
        `;
        const amountSlider = document.getElementById('orderAmountSlider');
        const priceSlider = document.getElementById('orderPriceSlider');
        if (amountSlider) {
            amountSlider.oninput = () => {
                const val = parseFloat(amountSlider.value);
                amountSlider.nextElementSibling.innerText = val.toFixed(2) + ' шт.';
                if (document.getElementById('orderAmount')) document.getElementById('orderAmount').value = val;
            };
        }
        if (priceSlider) {
            priceSlider.oninput = () => {
                const val = parseFloat(priceSlider.value);
                priceSlider.nextElementSibling.innerText = val.toFixed(2) + ' ⭐';
                if (document.getElementById('orderPrice')) document.getElementById('orderPrice').value = val;
            };
        }
    } else {
        amountContainer.innerHTML = `<input type="number" id="orderAmount" placeholder="Количество (шт.)" step="0.01" min="0.01" value="${currentAmount}">`;
        priceContainer.innerHTML = `<input type="number" id="orderPrice" placeholder="Цена за 1 шт. (⭐)" step="0.01" min="0.01" value="${currentPrice}">`;
    }
}

// ---- Получение заявок на покупку (если ещё нет) ----
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

// ---- ГЛАВНЫЙ РЕНДЕР ----
window.renderStocksTab = async function(currentUser) {
    // 1. Загрузка всех данных параллельно
    const [
        userSharesCents,
        userStarsCents,
        currentPriceCents,
        marketCapData,
        avgPrice24hCents,
        activeSellOrders,
        activeBuyOrders,
        mySellOrders,
        myBuyOrders,
        priceHistory
    ] = await Promise.all([
        currentUser.shares,
        currentUser.stars_balance,
        window.getCurrentPrice(),
        window.getTotalMarketCap(),
        window.get24hAvgPrice(),
        window.getActiveOrders(),
        window.getActiveBuyOrders(),
        window.getUserOrders(),
        (async () => {
            const { data } = await window.supabase
                .from('buy_orders')
                .select('*')
                .eq('buyer_id', window.userId)
                .eq('status', 'active');
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

    const userShares = window.fromCents(userSharesCents);
    const userStars = window.fromCents(userStarsCents);
    const currentPrice = (currentPriceCents / 100).toFixed(2);
    const marketCap = marketCapData.marketCap.toFixed(2);
    const totalShares = (marketCapData.totalShares / 100).toFixed(2);
    const avgPrice24h = (avgPrice24hCents / 100).toFixed(2);

    // 2. HTML-структура (график вверху, табы ниже)
    const html = `
        <div class="stocks-container">
            <!-- Баланс + статистика в одну строку -->
            <div class="balance-row">
                <div class="balance-card"><div class="bal-label">📊 Акции</div><div class="bal-value">${userShares}</div></div>
                <div class="balance-card"><div class="bal-label">⭐ Stars</div><div class="bal-value">${userStars}</div></div>
                <div class="balance-card"><div class="bal-label">💰 Цена</div><div class="bal-value price">${currentPrice}</div></div>
            </div>

            <div class="stats-row">
                <div class="stat-card">
                    <div class="stat-icon">🏦</div>
                    <div class="stat-label">Капитализация</div>
                    <div class="stat-value">${marketCap} ⭐</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📦</div>
                    <div class="stat-label">Всего акций</div>
                    <div class="stat-value">${totalShares}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">📈</div>
                    <div class="stat-label">Средняя цена (24ч)</div>
                    <div class="stat-value">${avgPrice24h} ⭐</div>
                </div>
            </div>

            <!-- ГРАФИК – всегда виден -->
            <div class="chart-container-main">
                <canvas id="mainPriceChart" width="600" height="180" style="width:100%; height:180px;"></canvas>
            </div>

            <!-- Табы -->
            <div class="tabs-row">
                <button class="tab-btn active" data-tab="overview">📊 Обзор</button>
                <button class="tab-btn" data-tab="orderbook">📖 Стакан</button>
                <button class="tab-btn" data-tab="orders">📋 Ордера</button>
                <button class="tab-btn" data-tab="myorders">📌 Мои ордера</button>
            </div>

            <!-- Контент табов -->
            <div id="tab-overview" class="tab-pane active">
                <div class="order-form-panel">
                    <h4>✍️ Создать лимитный ордер</h4>
                    <div class="type-switch">
                        <button id="orderTypeSell" class="type-opt active">📉 Продать акции</button>
                        <button id="orderTypeBuy" class="type-opt">📈 Купить акции</button>
                    </div>
                    <div class="input-mode-switch">
                        <span>📝 Режим ввода:</span>
                        <button id="modeFieldBtn" class="mode-btn active">Поля</button>
                        <button id="modeSliderBtn" class="mode-btn">Слайдеры</button>
                    </div>
                    <div id="amountControl" class="control-group"></div>
                    <div id="priceControl" class="control-group"></div>
                    <button id="createOrderBtn">✅ Разместить ордер</button>
                    <div class="hint">После размещения ордер появится в стакане.</div>
                </div>
            </div>

            <div id="tab-orderbook" class="tab-pane">
                <div class="orderbook-split">
                    <div class="orderbook-col">
                        <h4>💰 Продажа</h4>
                        <div id="sellBookList" class="orderbook-list"></div>
                    </div>
                    <div class="orderbook-col">
                        <h4>🏦 Покупка</h4>
                        <div id="buyBookList" class="orderbook-list"></div>
                    </div>
                </div>
            </div>

            <div id="tab-orders" class="tab-pane">
                <h4>📋 Активные ордера на продажу</h4>
                <div id="activeSellOrdersList" class="orders-container"></div>
            </div>

            <div id="tab-myorders" class="tab-pane">
                <div class="my-orders-block">
                    <h4>📌 Мои ордера на продажу</h4>
                    <div id="mySellOrdersList" class="orders-container"></div>
                </div>
                <div class="my-orders-block">
                    <h4>🛒 Мои заявки на покупку</h4>
                    <div id="myBuyOrdersList" class="orders-container"></div>
                </div>
            </div>
        </div>

        <!-- Фиксированные рыночные кнопки -->
        <div class="market-buttons">
            <button id="marketBuyBtn" class="market-btn buy">🚀 Рыночная покупка</button>
            <button id="marketSellBtn" class="market-btn sell">📉 Рыночная продажа</button>
        </div>
    `;

    document.getElementById('app').innerHTML = html;

    // ---- Дальше будут функции отрисовки и обработчики (продолжение во 2й части) ----
        // ---- Функция отрисовки ГЛАВНОГО графика (всегда виден) ----
    function drawMainChart() {
        const canvas = document.getElementById('mainPriceChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.clientWidth;
        const h = 180;
        canvas.width = w;
        canvas.height = h;

        if (!priceHistory.length) {
            ctx.fillStyle = '#0f1320';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#9ca3af';
            ctx.font = '12px sans-serif';
            ctx.fillText('Нет данных для графика', w/2 - 60, h/2);
            return;
        }

        const prices = priceHistory.map(p => p.price);
        const maxP = Math.max(...prices, 0.01);
        const minP = Math.min(...prices, 0);
        const range = maxP - minP || 1;

        ctx.clearRect(0, 0, w, h);
        ctx.beginPath();
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2;
        const step = w / (prices.length - 1);
        prices.forEach((price, i) => {
            const x = i * step;
            const y = h - 15 - ((price - minP) / range) * (h - 30);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.lineTo(w, h - 15);
        ctx.lineTo(0, h - 15);
        ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.fill();
    }

    // ---- Функции для стакана, ордеров ----
    function renderOrderBook() {
        const sellMap = new Map();
        activeSellOrders.forEach(o => {
            const price = o.price_per_share / 100;
            const amount = o.amount / 100;
            sellMap.set(price, (sellMap.get(price) || 0) + amount);
        });
        const sellBook = Array.from(sellMap.entries())
            .map(([p, a]) => ({ price: p, amount: a }))
            .sort((a,b) => a.price - b.price)
            .slice(0, 8);

        const buyMap = new Map();
        activeBuyOrders.forEach(o => {
            const price = o.price_per_share / 100;
            const amount = o.amount / 100;
            buyMap.set(price, (buyMap.get(price) || 0) + amount);
        });
        const buyBook = Array.from(buyMap.entries())
            .map(([p, a]) => ({ price: p, amount: a }))
            .sort((a,b) => b.price - a.price)
            .slice(0, 8);

        const sellHtml = sellBook.map(b => `
            <div class="orderbook-row">
                <span>${b.amount.toFixed(2)} шт.</span>
                <span class="price-sell">${b.price.toFixed(2)} ⭐</span>
            </div>
        `).join('');
        const buyHtml = buyBook.map(b => `
            <div class="orderbook-row">
                <span>${b.amount.toFixed(2)} шт.</span>
                <span class="price-buy">${b.price.toFixed(2)} ⭐</span>
            </div>
        `).join('');

        document.getElementById('sellBookList').innerHTML = sellHtml || '<div class="empty-placeholder">Нет ордеров</div>';
        document.getElementById('buyBookList').innerHTML = buyHtml || '<div class="empty-placeholder">Нет заявок</div>';
    }

    function renderActiveSellOrders() {
        const container = document.getElementById('activeSellOrdersList');
        if (!container) return;
        if (!activeSellOrders.length) {
            container.innerHTML = '<div class="empty-placeholder">Нет активных ордеров</div>';
            return;
        }
        const html = activeSellOrders.map(order => {
            const price = order.price_per_share / 100;
            const amount = order.amount / 100;
            return `
                <div class="order-item" data-id="${order.id}">
                    <div>📦 ${amount.toFixed(2)} шт. по ${price.toFixed(2)} ⭐</div>
                    <div class="order-seller">👤 продавец: ${order.seller_id}</div>
                    <button class="buy-order-btn" data-id="${order.id}" data-price="${price}" data-amount="${amount}">Купить</button>
                </div>
            `;
        }).join('');
        container.innerHTML = html;
        document.querySelectorAll('.buy-order-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const orderId = parseInt(btn.dataset.id);
                const maxAmount = parseFloat(btn.dataset.amount);
                const price = parseFloat(btn.dataset.price);
                const amount = parseFloat(prompt(`Введите количество (макс. ${maxAmount.toFixed(2)} шт.)`, "1"));
                if (isNaN(amount) || amount <= 0 || amount > maxAmount) {
                    window.showCustomModal('Ошибка', 'Некорректное количество');
                    return;
                }
                try {
                    await window.executePartialTrade(orderId, window.toCents(amount));
                    window.showToast(`✅ Куплено ${amount.toFixed(2)} шт. по ${price.toFixed(2)} ⭐`);
                    window.refreshActiveTab();
                } catch(e) {
                    window.showCustomModal('Ошибка', e.message);
                }
            });
        });
    }

    function renderMyOrders() {
        const sellContainer = document.getElementById('mySellOrdersList');
        if (sellContainer) {
            if (!mySellOrders.length) {
                sellContainer.innerHTML = '<div class="empty-placeholder">Нет активных ордеров</div>';
            } else {
                sellContainer.innerHTML = mySellOrders.map(order => `
                    <div class="my-order-item">
                        <span>📦 ${(order.amount/100).toFixed(2)} шт. по ${(order.price_per_share/100).toFixed(2)} ⭐</span>
                        <button class="cancel-order-btn" data-id="${order.id}" data-type="sell">Отменить</button>
                    </div>
                `).join('');
            }
        }
        const buyContainer = document.getElementById('myBuyOrdersList');
        if (buyContainer) {
            if (!myBuyOrders.length) {
                buyContainer.innerHTML = '<div class="empty-placeholder">Нет активных заявок</div>';
            } else {
                buyContainer.innerHTML = myBuyOrders.map(order => `
                    <div class="my-order-item">
                        <span>🛒 Купить ${(order.amount/100).toFixed(2)} шт. по ${(order.price_per_share/100).toFixed(2)} ⭐</span>
                        <button class="cancel-order-btn" data-id="${order.id}" data-type="buy">Отменить</button>
                    </div>
                `).join('');
            }
        }
        document.querySelectorAll('.cancel-order-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                const type = btn.dataset.type;
                try {
                    if (type === 'sell') await window.cancelOrder(id);
                    else await window.cancelBuyOrder(id);
                    window.showToast('Ордер отменён');
                    window.refreshActiveTab();
                } catch(e) {
                    window.showCustomModal('Ошибка', e.message);
                }
            });
        });
    }

    // ---- Переключение табов (без вкладки "График", он всегда виден) ----
    const tabs = document.querySelectorAll('.tab-btn');
    const panes = {
        overview: document.getElementById('tab-overview'),
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
        });
    });

    // ---- Логика лимитного ордера с переключением режимов ----
    let currentOrderType = 'sell';
    document.getElementById('orderTypeSell').onclick = () => {
        currentOrderType = 'sell';
        document.getElementById('orderTypeSell').classList.add('active');
        document.getElementById('orderTypeBuy').classList.remove('active');
    };
    document.getElementById('orderTypeBuy').onclick = () => {
        currentOrderType = 'buy';
        document.getElementById('orderTypeBuy').classList.add('active');
        document.getElementById('orderTypeSell').classList.remove('active');
    };

    const amountContainer = document.getElementById('amountControl');
    const priceContainer = document.getElementById('priceControl');
    const modeField = document.getElementById('modeFieldBtn');
    const modeSlider = document.getElementById('modeSliderBtn');

    function refreshInputMode(mode) {
        setInputMode(mode);
        if (mode === 'field') {
            modeField.classList.add('active');
            modeSlider.classList.remove('active');
        } else {
            modeSlider.classList.add('active');
            modeField.classList.remove('active');
        }
        let currentAmount = 1, currentPrice = 1;
        if (getInputMode() === 'slider') {
            const existingSlider = document.getElementById('orderAmountSlider');
            if (existingSlider) currentAmount = parseFloat(existingSlider.value);
            const existingPriceSlider = document.getElementById('orderPriceSlider');
            if (existingPriceSlider) currentPrice = parseFloat(existingPriceSlider.value);
        } else {
            const existingAmount = document.getElementById('orderAmount');
            if (existingAmount) currentAmount = parseFloat(existingAmount.value) || 1;
            const existingPrice = document.getElementById('orderPrice');
            if (existingPrice) currentPrice = parseFloat(existingPrice.value) || 1;
        }
        renderInputControls(amountContainer, priceContainer, mode, currentAmount, currentPrice);
    }

    modeField.onclick = () => refreshInputMode('field');
    modeSlider.onclick = () => refreshInputMode('slider');
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
        if (isNaN(amount) || amount <= 0 || isNaN(price) || price <= 0) {
            window.showCustomModal('Ошибка', 'Введите корректные количество и цену');
            return;
        }
        try {
            if (currentOrderType === 'sell') {
                await window.createOrder(amount, price);
                window.showToast('Ордер на продажу размещён');
            } else {
                await window.createBuyOrder(amount, price);
                window.showToast('Заявка на покупку размещена');
            }
            if (getInputMode() === 'slider') {
                if (document.getElementById('orderAmountSlider')) document.getElementById('orderAmountSlider').value = 1;
                if (document.getElementById('orderPriceSlider')) document.getElementById('orderPriceSlider').value = 1;
                if (document.querySelector('#amountControl .slider-value')) document.querySelector('#amountControl .slider-value').innerText = '1.00 шт.';
                if (document.querySelector('#priceControl .slider-value')) document.querySelector('#priceControl .slider-value').innerText = '1.00 ⭐';
            } else {
                if (document.getElementById('orderAmount')) document.getElementById('orderAmount').value = '';
                if (document.getElementById('orderPrice')) document.getElementById('orderPrice').value = '';
            }
            window.refreshActiveTab();
        } catch(e) {
            window.showCustomModal('Ошибка', e.message);
        }
    };

    // ---- Рыночные кнопки ----
    document.getElementById('marketBuyBtn').onclick = () => {
        const stars = parseFloat(prompt('Сумма в Stars для покупки:', '10'));
        if (!isNaN(stars) && stars > 0) window.marketBuy(stars).catch(e => window.showCustomModal('Ошибка', e.message));
    };
    document.getElementById('marketSellBtn').onclick = () => {
        const shares = parseFloat(prompt('Количество акций для продажи:', '1'));
        if (!isNaN(shares) && shares > 0) window.marketSell(shares).catch(e => window.showCustomModal('Ошибка', e.message));
    };

    // ---- Первоначальная отрисовка ----
    drawMainChart();          // график всегда рисуется
    renderOrderBook();       // стакан (для вкладки)
    renderActiveSellOrders();// ордера
    renderMyOrders();        // мои ордера
};
