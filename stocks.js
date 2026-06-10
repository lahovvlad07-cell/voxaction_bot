// stocks.js – полностью переработанная вкладка биржи
// Функции получения ордеров на покупку (добавляем в window)
window.getActiveBuyOrders = async function() {
    const { data, error } = await window.supabase
        .from('buy_orders')
        .select('*')
        .eq('status', 'active')
        .order('price_per_share', { ascending: false }); // самые дорогие сверху
    if (error) throw new Error(error.message);
    return data || [];
};

window.renderStocksTab = async function(currentUser) {
    // 1. Загрузка всех данных параллельно
    const [
        userSharesCents,
        userStarsCents,
        currentPriceCents,
        marketCapData,
        avgPrice24hCents,
        activeOrders,
        buyOrders,
        userSellOrders,
        userBuyOrders,
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
            const { data } = await window.supabase.from('buy_orders').select('*').eq('buyer_id', window.userId).eq('status', 'active');
            return data || [];
        })(),
        (async () => {
            // Группируем сделки по дням для графика
            const { data: trades } = await window.supabase
                .from('trades')
                .select('price_per_share, created_at')
                .order('created_at', { ascending: true })
                .limit(1000);
            if (!trades) return [];
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
    const marketCap = (marketCapData.marketCap).toFixed(2);
    const totalShares = (marketCapData.totalShares / 100).toFixed(2);
    const avgPrice24h = (avgPrice24hCents / 100).toFixed(2);

    // 2. HTML-структура
    const html = `
        <div class="stocks-container">
            <!-- Баланс и цена -->
            <div class="stocks-balance">
                <div class="balance-card">
                    <div class="balance-label">📊 Акции</div>
                    <div class="balance-value">${userShares}</div>
                </div>
                <div class="balance-card">
                    <div class="balance-label">⭐ Stars</div>
                    <div class="balance-value">${userStars}</div>
                </div>
                <div class="balance-card">
                    <div class="balance-label">💰 Текущая цена</div>
                    <div class="balance-value price">${currentPrice}</div>
                </div>
            </div>

            <!-- Доп. статистика -->
            <div class="stats-row">
                <div class="stat-card">
                    <div class="stat-label">🏦 Капитализация</div>
                    <div class="stat-number">${marketCap} ⭐</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">📦 Всего акций</div>
                    <div class="stat-number">${totalShares}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">📈 Средняя цена 24ч</div>
                    <div class="stat-number">${avgPrice24h} ⭐</div>
                </div>
            </div>

            <!-- Табы -->
            <div class="stocks-tabs">
                <div class="tab-btn active" data-tab="overview">📊 Обзор</div>
                <div class="tab-btn" data-tab="chart">📈 График</div>
                <div class="tab-btn" data-tab="orderbook">📖 Стакан</div>
                <div class="tab-btn" data-tab="orders">📋 Ордера</div>
                <div class="tab-btn" data-tab="myorders">📌 Мои ордера</div>
            </div>

            <!-- Контент табов -->
            <div id="tab-overview" class="tab-content active">
                <div class="create-order-panel">
                    <h4>➕ Создать лимитный ордер</h4>
                    <div class="order-type-switch">
                        <button id="orderTypeSell" class="type-btn active">Продать акции</button>
                        <button id="orderTypeBuy" class="type-btn">Купить акции</button>
                    </div>
                    <div class="order-form">
                        <input type="number" id="orderAmount" placeholder="Количество (шт.)" step="0.01" min="0.01">
                        <input type="number" id="orderPrice" placeholder="Цена за 1 шт. (⭐)" step="0.01" min="0.01">
                        <button id="createOrderBtn">✅ Разместить ордер</button>
                    </div>
                    <div class="small-text hint">После размещения ордер появится в стакане и будет ждать встречной заявки.</div>
                </div>
            </div>

            <div id="tab-chart" class="tab-content">
                <div class="chart-container">
                    <canvas id="priceChartCanvas" width="600" height="200" style="width:100%; height:200px;"></canvas>
                </div>
            </div>

            <div id="tab-orderbook" class="tab-content">
                <div class="orderbook-grid">
                    <div class="orderbook-sell">
                        <h4>💰 Продажа</h4>
                        <div id="sellOrdersList" class="orderbook-list"></div>
                    </div>
                    <div class="orderbook-buy">
                        <h4>🏦 Покупка</h4>
                        <div id="buyOrdersList" class="orderbook-list"></div>
                    </div>
                </div>
            </div>

            <div id="tab-orders" class="tab-content">
                <h4>📋 Активные ордера на продажу</h4>
                <div id="activeOrdersList" class="orders-list"></div>
            </div>

            <div id="tab-myorders" class="tab-content">
                <div class="my-orders-section">
                    <h4>📌 Мои ордера на продажу</h4>
                    <div id="mySellOrdersList" class="my-orders-list"></div>
                </div>
                <div class="my-orders-section">
                    <h4>🛒 Мои заявки на покупку</h4>
                    <div id="myBuyOrdersList" class="my-orders-list"></div>
                </div>
            </div>
        </div>

        <!-- Фиксированные рыночные кнопки -->
        <div class="market-fixed-buttons">
            <button id="marketBuyBtn" class="market-buy">🚀 Рыночная покупка</button>
            <button id="marketSellBtn" class="market-sell">📉 Рыночная продажа</button>
        </div>
    `;

    document.getElementById('app').innerHTML = html;

    // 3. Отрисовка графиков и списков
    function drawPriceChart() {
        const canvas = document.getElementById('priceChartCanvas');
        if (!canvas || !priceHistory.length) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.clientWidth;
        const h = 200;
        canvas.width = w;
        canvas.height = h;

        const prices = priceHistory.map(p => p.price);
        const maxPrice = Math.max(...prices, 0.01);
        const minPrice = Math.min(...prices, 0);
        const range = maxPrice - minPrice || 1;

        ctx.clearRect(0, 0, w, h);
        ctx.beginPath();
        ctx.strokeStyle = '#2b6e9e';
        ctx.lineWidth = 2;
        const step = w / (prices.length - 1);
        prices.forEach((price, i) => {
            const x = i * step;
            const y = h - 20 - ((price - minPrice) / range) * (h - 40);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Заполнение под графиком
        ctx.lineTo(w, h - 20);
        ctx.lineTo(0, h - 20);
        ctx.fillStyle = 'rgba(43,110,158,0.2)';
        ctx.fill();
    }

    function renderOrderbook() {
        // Группируем ордера на продажу по цене
        const sellMap = new Map();
        activeOrders.forEach(order => {
            const price = order.price_per_share / 100;
            const amount = order.amount / 100;
            sellMap.set(price, (sellMap.get(price) || 0) + amount);
        });
        const sellBook = Array.from(sellMap.entries())
            .map(([price, amount]) => ({ price, amount }))
            .sort((a,b) => a.price - b.price)
            .slice(0, 10);

        // Группируем заявки на покупку
        const buyMap = new Map();
        buyOrders.forEach(order => {
            const price = order.price_per_share / 100;
            const amount = order.amount / 100;
            buyMap.set(price, (buyMap.get(price) || 0) + amount);
        });
        const buyBook = Array.from(buyMap.entries())
            .map(([price, amount]) => ({ price, amount }))
            .sort((a,b) => b.price - a.price)
            .slice(0, 10);

        const sellHtml = sellBook.map(item => `
            <div class="orderbook-row">
                <span>${item.amount.toFixed(2)} шт.</span>
                <span class="price-sell">${item.price.toFixed(2)} ⭐</span>
            </div>
        `).join('') || '<div class="empty-msg">Нет ордеров на продажу</div>';

        const buyHtml = buyBook.map(item => `
            <div class="orderbook-row">
                <span>${item.amount.toFixed(2)} шт.</span>
                <span class="price-buy">${item.price.toFixed(2)} ⭐</span>
            </div>
        `).join('') || '<div class="empty-msg">Нет заявок на покупку</div>';

        document.getElementById('sellOrdersList').innerHTML = sellHtml;
        document.getElementById('buyOrdersList').innerHTML = buyHtml;
    }

    function renderActiveOrders() {
        const container = document.getElementById('activeOrdersList');
        if (!container) return;
        if (!activeOrders.length) {
            container.innerHTML = '<div class="empty-msg">Нет активных ордеров</div>';
            return;
        }
        const html = activeOrders.map(order => {
            const price = order.price_per_share / 100;
            const amount = order.amount / 100;
            return `
                <div class="order-card" data-id="${order.id}">
                    <div class="order-info">
                        <span>📦 ${amount.toFixed(2)} шт.</span>
                        <span class="order-price">⭐ ${price.toFixed(2)}</span>
                        <span class="order-seller">👤 продавец: ${order.seller_id}</span>
                    </div>
                    <button class="buy-from-order-btn" data-id="${order.id}" data-price="${price}" data-amount="${amount}">Купить</button>
                </div>
            `;
        }).join('');
        container.innerHTML = html;
        // Обработчики кнопок покупки
        document.querySelectorAll('.buy-from-order-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const orderId = parseInt(btn.dataset.id);
                const maxAmount = parseFloat(btn.dataset.amount);
                const price = parseFloat(btn.dataset.price);
                showBuyFromOrderModal(orderId, maxAmount, price);
            });
        });
    }

    function renderMyOrders() {
        // Мои продажи
        const sellContainer = document.getElementById('mySellOrdersList');
        if (sellContainer) {
            if (!userSellOrders.length) {
                sellContainer.innerHTML = '<div class="empty-msg">Нет активных ордеров на продажу</div>';
            } else {
                sellContainer.innerHTML = userSellOrders.map(order => `
                    <div class="my-order-card" data-id="${order.id}">
                        <div>📦 ${(order.amount/100).toFixed(2)} шт.</div>
                        <div>⭐ ${(order.price_per_share/100).toFixed(2)}</div>
                        <button class="cancel-sell-btn" data-id="${order.id}">Отменить</button>
                    </div>
                `).join('');
                document.querySelectorAll('.cancel-sell-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = parseInt(btn.dataset.id);
                        try {
                            await window.cancelOrder(id);
                            window.showToast('Ордер отменён');
                            window.refreshActiveTab();
                        } catch(e) {
                            window.showCustomModal('Ошибка', e.message);
                        }
                    });
                });
            }
        }
        // Мои покупки
        const buyContainer = document.getElementById('myBuyOrdersList');
        if (buyContainer) {
            if (!userBuyOrders.length) {
                buyContainer.innerHTML = '<div class="empty-msg">Нет активных заявок на покупку</div>';
            } else {
                buyContainer.innerHTML = userBuyOrders.map(order => `
                    <div class="my-order-card" data-id="${order.id}">
                        <div>🛒 Купить ${(order.amount/100).toFixed(2)} шт.</div>
                        <div>⭐ ${(order.price_per_share/100).toFixed(2)}</div>
                        <button class="cancel-buy-btn" data-id="${order.id}">Отменить</button>
                    </div>
                `).join('');
                document.querySelectorAll('.cancel-buy-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = parseInt(btn.dataset.id);
                        try {
                            await window.cancelBuyOrder(id);
                            window.showToast('Заявка отменена');
                            window.refreshActiveTab();
                        } catch(e) {
                            window.showCustomModal('Ошибка', e.message);
                        }
                    });
                });
            }
        }
    }

    async function showBuyFromOrderModal(orderId, maxAmount, price) {
        const amountStars = parseFloat(prompt(`Введите количество акций для покупки (до ${maxAmount.toFixed(2)} шт.)`, "1"));
        if (isNaN(amountStars) || amountStars <= 0 || amountStars > maxAmount) {
            window.showCustomModal('Ошибка', 'Некорректное количество');
            return;
        }
        try {
            await window.executePartialTrade(orderId, window.toCents(amountStars));
            window.showToast(`✅ Куплено ${amountStars.toFixed(2)} шт. по ${price.toFixed(2)} ⭐`);
            window.refreshActiveTab();
        } catch(e) {
            window.showCustomModal('Ошибка', e.message);
        }
    }

    // 4. Переключение табов
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = {
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
            Object.values(contents).forEach(c => c.classList.remove('active'));
            contents[target].classList.add('active');
            if (target === 'chart') drawPriceChart();
            if (target === 'orderbook') renderOrderbook();
            if (target === 'orders') renderActiveOrders();
            if (target === 'myorders') renderMyOrders();
        });
    });

    // 5. Форма создания ордера
    let currentOrderType = 'sell'; // sell / buy
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
    document.getElementById('createOrderBtn').onclick = async () => {
        const amount = parseFloat(document.getElementById('orderAmount').value);
        const price = parseFloat(document.getElementById('orderPrice').value);
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
            document.getElementById('orderAmount').value = '';
            document.getElementById('orderPrice').value = '';
            window.refreshActiveTab();
        } catch(e) {
            window.showCustomModal('Ошибка', e.message);
        }
    };

    // 6. Рыночные кнопки
    document.getElementById('marketBuyBtn').onclick = () => {
        const stars = parseFloat(prompt('Сколько звёзд потратить на покупку?', '10'));
        if (isNaN(stars) || stars <= 0) return;
        window.marketBuy(stars).catch(e => window.showCustomModal('Ошибка', e.message));
    };
    document.getElementById('marketSellBtn').onclick = () => {
        const shares = parseFloat(prompt('Сколько акций продать?', '1'));
        if (isNaN(shares) || shares <= 0) return;
        window.marketSell(shares).catch(e => window.showCustomModal('Ошибка', e.message));
    };

    // Первоначальная отрисовка активного таба (по умолчанию overview)
    drawPriceChart();
    renderOrderbook();
    renderActiveOrders();
    renderMyOrders();
};
