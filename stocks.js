// stocks.js – полностью переработанная биржевая вкладка
// Все данные реальные, никаких заглушек

// Добавляем метод получения активных заявок на покупку
window.getActiveBuyOrders = async function() {
    const { data, error } = await window.supabase
        .from('buy_orders')
        .select('*')
        .eq('status', 'active')
        .order('price_per_share', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
};

// Главный рендер
window.renderStocksTab = async function(currentUser) {
    // 1. Параллельно загружаем все данные
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
            // Группируем сделки по дням для графика
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

    // 2. HTML структура (минималистичная, но информативная)
    const html = `
        <div class="stocks-container">
            <!-- Верхние карточки баланса -->
            <div class="balance-row">
                <div class="balance-card"><div class="bal-label">📊 Акции</div><div class="bal-value">${userShares}</div></div>
                <div class="balance-card"><div class="bal-label">⭐ Stars</div><div class="bal-value">${userStars}</div></div>
                <div class="balance-card"><div class="bal-label">💰 Цена</div><div class="bal-value price">${currentPrice}</div></div>
            </div>

            <!-- Доп. статистика -->
            <div class="stats-row">
                <div class="stat-item"><span>🏦 Капитализация</span><strong>${marketCap} ⭐</strong></div>
                <div class="stat-item"><span>📦 Всего акций</span><strong>${totalShares}</strong></div>
                <div class="stat-item"><span>📈 Средняя 24ч</span><strong>${avgPrice24h} ⭐</strong></div>
            </div>

            <!-- Табы -->
            <div class="tabs-row">
                <button class="tab-btn active" data-tab="overview">📊 Обзор</button>
                <button class="tab-btn" data-tab="chart">📈 График</button>
                <button class="tab-btn" data-tab="orderbook">📖 Стакан</button>
                <button class="tab-btn" data-tab="orders">📋 Ордера</button>
                <button class="tab-btn" data-tab="myorders">📌 Мои ордера</button>
            </div>

            <!-- Содержимое табов -->
            <div id="tab-overview" class="tab-pane active">
                <div class="order-form-panel">
                    <h4>✍️ Создать лимитный ордер</h4>
                    <div class="type-switch">
                        <button id="orderTypeSell" class="type-opt active">Продать акции</button>
                        <button id="orderTypeBuy" class="type-opt">Купить акции</button>
                    </div>
                    <input type="number" id="orderAmount" placeholder="Количество (шт.)" step="0.01" min="0.01">
                    <input type="number" id="orderPrice" placeholder="Цена за 1 шт. (⭐)" step="0.01" min="0.01">
                    <button id="createOrderBtn">✅ Разместить ордер</button>
                    <div class="hint">После размещения ордер появится в стакане.</div>
                </div>
            </div>

            <div id="tab-chart" class="tab-pane">
                <canvas id="priceChart" width="600" height="200" style="width:100%; height:200px;"></canvas>
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

    // 3. Вспомогательные функции отрисовки
    function drawChart() {
        const canvas = document.getElementById('priceChart');
        if (!canvas || !priceHistory.length) {
            const ctx = canvas?.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#0f1320';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = '#9ca3af';
                ctx.font = '12px sans-serif';
                ctx.fillText('Нет данных для графика', 20, 100);
            }
            return;
        }
        const ctx = canvas.getContext('2d');
        const w = canvas.clientWidth;
        const h = 200;
        canvas.width = w;
        canvas.height = h;

        const prices = priceHistory.map(p => p.price);
        const maxP = Math.max(...prices, 0.01);
        const minP = Math.min(...prices, 0);
        const range = maxP - minP || 1;

        ctx.clearRect(0, 0, w, h);
        ctx.beginPath();
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        const step = w / (prices.length - 1);
        prices.forEach((price, i) => {
            const x = i * step;
            const y = h - 15 - ((price - minP) / range) * (h - 30);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        // Заливка
        ctx.lineTo(w, h - 15);
        ctx.lineTo(0, h - 15);
        ctx.fillStyle = 'rgba(96,165,250,0.2)';
        ctx.fill();
    }

    function renderOrderBook() {
        // Группировка sell
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
        // Группировка buy
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
        // Обработчики кнопок покупки
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
        // Мои продажи
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
        // Мои покупки
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
        // Обработчики отмены
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

    // 4. Переключение табов
    const tabs = document.querySelectorAll('.tab-btn');
    const panes = {
        overview: document.getElementById('tab-overview'),
        chart: document.getElementById('tab-chart'),
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
            if (target === 'chart') drawChart();
            if (target === 'orderbook') renderOrderBook();
            if (target === 'orders') renderActiveSellOrders();
            if (target === 'myorders') renderMyOrders();
        });
    });

    // 5. Форма лимитного ордера
    let orderType = 'sell';
    document.getElementById('orderTypeSell').onclick = () => {
        orderType = 'sell';
        document.getElementById('orderTypeSell').classList.add('active');
        document.getElementById('orderTypeBuy').classList.remove('active');
    };
    document.getElementById('orderTypeBuy').onclick = () => {
        orderType = 'buy';
        document.getElementById('orderTypeBuy').classList.add('active');
        document.getElementById('orderTypeSell').classList.remove('active');
    };
    document.getElementById('createOrderBtn').onclick = async () => {
        const amount = parseFloat(document.getElementById('orderAmount').value);
        const price = parseFloat(document.getElementById('orderPrice').value);
        if (isNaN(amount) || amount <= 0 || isNaN(price) || price <= 0) {
            window.showCustomModal('Ошибка', 'Введите корректные количество и цену');
            return;
        }
        try {
            if (orderType === 'sell') {
                await window.createOrder(amount, price);
                window.showToast('Ордер на продажу размещён');
            } else {
                await window.createBuyOrder(amount, price);
                window.showToast('Заявка на покупку размещена');
            }
            document.getElementById('orderAmount').value = '';
            document.getElementById('orderPrice').value = '';
            window.refreshActiveTab();
        } catch(e) {
            window.showCustomModal('Ошибка', e.message);
        }
    };

    // 6. Рыночные кнопки
    document.getElementById('marketBuyBtn').onclick = () => {
        const stars = parseFloat(prompt('Сумма в Stars для покупки:', '10'));
        if (!isNaN(stars) && stars > 0) window.marketBuy(stars).catch(e => window.showCustomModal('Ошибка', e.message));
    };
    document.getElementById('marketSellBtn').onclick = () => {
        const shares = parseFloat(prompt('Количество акций для продажи:', '1'));
        if (!isNaN(shares) && shares > 0) window.marketSell(shares).catch(e => window.showCustomModal('Ошибка', e.message));
    };

    // Первоначальная отрисовка активного таба (overview)
    drawChart();
    renderOrderBook();
    renderActiveSellOrders();
    renderMyOrders();
};
