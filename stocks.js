// stocks.js – финальная версия с линией вкладок (График, Стакан, Ордера, Мои ордера)
window.renderStocksTab = async function(currentUser) {
    // Демо-данные
    const userShares = currentUser?.shares ? window.fromCents(currentUser.shares) : '136.59';
    const userStars = currentUser?.stars_balance ? window.fromCents(currentUser.stars_balance) : '2.37';
    const currentPrice = '1.00';
    const marketCap = '225';
    const totalShares = '225.46';
    const avgPrice24h = '0.00';

    // Мок-ордера для отображения
    const allOrders = [
        { id: 1, amount: 50, price: 1.15, seller: "user123" },
        { id: 2, amount: 30, price: 1.12, seller: "crypto_fan" },
        { id: 3, amount: 100, price: 1.08, seller: "investor" }
    ];
    const mySellOrders = [
        { id: 101, amount: 20, price: 1.20, type: "sell" },
        { id: 102, amount: 15, price: 1.18, type: "sell" }
    ];
    const myBuyOrders = [
        { id: 201, amount: 40, price: 1.10, type: "buy" }
    ];

    const html = `
        <div class="stocks-container">
            <div class="stocks-balance">
                <div class="stocks-balance-card">
                    <div class="stocks-balance-label">📊 Акций</div>
                    <div class="stocks-balance-value">${userShares}</div>
                </div>
                <div class="stocks-balance-card">
                    <div class="stocks-balance-label">⭐ Stars</div>
                    <div class="stocks-balance-value">${userStars}</div>
                </div>
                <div class="stocks-balance-card">
                    <div class="stocks-balance-label">💰 Цена</div>
                    <div class="stocks-balance-value price">${currentPrice}</div>
                </div>
            </div>
            <div class="stocks-stats">
                <div class="stocks-stat"><div class="label">🏦 КАПИТАЛИЗАЦИЯ</div><div class="value">${marketCap} ⭐</div></div>
                <div class="stocks-stat"><div class="label">📦 ВСЕГО АКЦИЙ</div><div class="value">${totalShares}</div></div>
                <div class="stocks-stat"><div class="label">📈 СР. ЦЕНА 24Ч</div><div class="value">${avgPrice24h} ⭐</div></div>
            </div>
            <div class="stocks-tabs">
                <div class="stocks-tab active" data-tab="chart">📈 График</div>
                <div class="stocks-tab" data-tab="orderbook">📖 Стакан</div>
                <div class="stocks-tab" data-tab="orders">📋 Ордера</div>
                <div class="stocks-tab" data-tab="myorders">📌 Мои ордера</div>
            </div>
            <div id="stocks-tab-chart" class="stocks-tab-content active">
                <div class="stocks-chart" id="stocksChartPlaceholder">
                    📈 График появится после первых сделок
                </div>
            </div>
            <div id="stocks-tab-orderbook" class="stocks-tab-content">
                <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <div style="flex:1;">
                        <h4 style="text-align:center; margin-bottom:16px; color:#fbbf24;">💰 Продажа</h4>
                        <div class="orderbook-row"><span>—</span><span class="price-sell">—</span><span class="small-text">—</span></div>
                        <div class="small-text" style="text-align:center; margin-top:20px; color:#9ca3af;">Нет заявок на продажу</div>
                    </div>
                    <div style="flex:1;">
                        <h4 style="text-align:center; margin-bottom:16px; color:#4ade80;">🏦 Покупка</h4>
                        <div class="orderbook-row"><span>—</span><span class="price-buy">—</span><span class="small-text">—</span></div>
                        <div class="small-text" style="text-align:center; margin-top:20px; color:#9ca3af;">Нет заявок на покупку</div>
                    </div>
                </div>
            </div>
            <div id="stocks-tab-orders" class="stocks-tab-content">
                <div class="orders-list">
                    ${allOrders.map(order => `
                        <div class="order-card" data-order-id="${order.id}">
                            <div class="order-info">
                                <span class="order-amount">📦 ${order.amount} шт.</span>
                                <span class="order-price">⭐ ${order.price.toFixed(2)}</span>
                                <span class="order-seller">👤 продавец: ${order.seller}</span>
                            </div>
                            <button class="buy-order-btn" data-id="${order.id}">Купить</button>
                        </div>
                    `).join('')}
                </div>
            </div>
            <div id="stocks-tab-myorders" class="stocks-tab-content">
                <div class="my-orders-section">
                    <h4>📌 Мои ордера на продажу</h4>
                    ${mySellOrders.length ? mySellOrders.map(order => `
                        <div class="my-order-card" data-id="${order.id}">
                            <div class="my-order-info">
                                <span>📦 ${order.amount} шт.</span>
                                <span class="my-order-price">⭐ ${order.price.toFixed(2)}</span>
                            </div>
                            <button class="cancel-order-btn" data-id="${order.id}">Отменить</button>
                        </div>
                    `).join('') : '<div class="empty-msg">Нет активных ордеров на продажу</div>'}
                    ${mySellOrders.length ? '<button class="cancel-all-btn" id="cancelAllSellsBtn">Отменить все продажи</button>' : ''}
                </div>
                <div class="my-orders-section">
                    <h4>🛒 Мои заявки на покупку</h4>
                    ${myBuyOrders.length ? myBuyOrders.map(order => `
                        <div class="my-order-card" data-id="${order.id}">
                            <div class="my-order-info">
                                <span>📦 Купить ${order.amount} шт.</span>
                                <span class="my-order-price">⭐ ${order.price.toFixed(2)}</span>
                            </div>
                            <button class="cancel-order-btn" data-id="${order.id}">Отменить</button>
                        </div>
                    `).join('') : '<div class="empty-msg">Нет активных заявок на покупку</div>'}
                    ${myBuyOrders.length ? '<button class="cancel-all-btn" id="cancelAllBuysBtn">Отменить все покупки</button>' : ''}
                </div>
            </div>
        </div>
        <div class="stocks-market-fixed">
            <button class="stocks-market-buy" id="marketBuyBtn">🚀 Рыночная покупка</button>
            <button class="stocks-market-sell" id="marketSellBtn">📉 Рыночная продажа</button>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    // Заглушка для рыночных кнопок (позже заменим на реальные)
    const stubMsg = () => window.showCustomModal('В разработке', 'Функционал временно отключён для настройки визуала. Скоро всё заработает!');
    document.getElementById('marketBuyBtn').onclick = stubMsg;
    document.getElementById('marketSellBtn').onclick = stubMsg;

    // Переключение вкладок
    const tabs = document.querySelectorAll('.stocks-tab');
    const contents = {
        chart: document.getElementById('stocks-tab-chart'),
        orderbook: document.getElementById('stocks-tab-orderbook'),
        orders: document.getElementById('stocks-tab-orders'),
        myorders: document.getElementById('stocks-tab-myorders')
    };
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            Object.values(contents).forEach(content => content.classList.remove('active'));
            if (contents[target]) contents[target].classList.add('active');
        });
    });

    // Кнопки "Купить" в ордерах (заглушки)
    document.querySelectorAll('.buy-order-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            stubMsg();
        });
    });
    // Кнопки отмены ордеров (заглушки)
    document.querySelectorAll('.cancel-order-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            stubMsg();
        });
    });
    document.getElementById('cancelAllSellsBtn')?.addEventListener('click', stubMsg);
    document.getElementById('cancelAllBuysBtn')?.addEventListener('click', stubMsg);
};
