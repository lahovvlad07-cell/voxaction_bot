// stocks.js – вкладки внутри страницы, без модалок
window.renderStocksTab = async function(currentUser) {
    const userShares = currentUser?.shares ? window.fromCents(currentUser.shares) : '136.59';
    const userStars = currentUser?.stars_balance ? window.fromCents(currentUser.stars_balance) : '2.37';
    const currentPrice = '1.00';
    const marketCap = '225';
    const totalShares = '225.46';
    const avgPrice24h = '0.00';

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
            <div class="stocks-chart" id="stocksChartPlaceholder">
                📈 График появится после первых сделок
            </div>
            <div class="stocks-stats">
                <div class="stocks-stat"><div class="label">🏦 КАПИТАЛИЗАЦИЯ</div><div class="value">${marketCap} ⭐</div></div>
                <div class="stocks-stat"><div class="label">📦 ВСЕГО АКЦИЙ</div><div class="value">${totalShares}</div></div>
                <div class="stocks-stat"><div class="label">📈 СР. ЦЕНА 24Ч</div><div class="value">${avgPrice24h} ⭐</div></div>
            </div>
            <div class="stocks-tabs">
                <button class="stocks-tab-btn active" data-tab="orderbook">📖 Стакан</button>
                <button class="stocks-tab-btn" data-tab="sell">📈 Продать</button>
                <button class="stocks-tab-btn" data-tab="buy">🛒 Купить</button>
                <button class="stocks-tab-btn" data-tab="myorders">📌 Мои ордера</button>
                <button class="stocks-tab-btn" data-tab="history">🗂 История</button>
            </div>
            <div id="stocks-tab-orderbook" class="stocks-tab-content active">
                <div class="orderbook-panel">
                    <div class="orderbook-col">
                        <h4 style="color:#fbbf24;">💰 Продажа</h4>
                        <div class="orderbook-row"><span>—</span><span class="price-sell">—</span><span class="small-text">—</span></div>
                        <div class="empty-message">Нет заявок на продажу</div>
                    </div>
                    <div class="orderbook-col">
                        <h4 style="color:#4ade80;">🏦 Покупка</h4>
                        <div class="orderbook-row"><span>—</span><span class="price-buy">—</span><span class="small-text">—</span></div>
                        <div class="empty-message">Нет заявок на покупку</div>
                    </div>
                </div>
            </div>
            <div id="stocks-tab-sell" class="stocks-tab-content">
                <div class="stocks-form">
                    <div class="form-group">
                        <label>📦 Количество: <span id="sellAmountVal">0.01</span></label>
                        <input type="range" id="sellAmountSlider" min="0.01" max="1000" step="0.01" value="0.01">
                    </div>
                    <div class="form-group">
                        <label>⭐ Цена: <span id="sellPriceVal">1</span></label>
                        <input type="range" id="sellPriceSlider" min="1" max="100" step="0.1" value="1">
                    </div>
                    <button class="stocks-btn" id="sellBtnStub">Продать</button>
                    <button class="stocks-toggle-mode" id="toggleSellModeStub">✍️ Поля ввода</button>
                </div>
            </div>
            <div id="stocks-tab-buy" class="stocks-tab-content">
                <div class="stocks-form">
                    <div class="form-group">
                        <label>📦 Количество: <span id="buyAmountVal">0.01</span></label>
                        <input type="range" id="buyAmountSlider" min="0.01" max="1000" step="0.01" value="0.01">
                    </div>
                    <div class="form-group">
                        <label>⭐ Цена: <span id="buyPriceVal">1</span></label>
                        <input type="range" id="buyPriceSlider" min="1" max="100" step="0.1" value="1">
                    </div>
                    <button class="stocks-btn" id="buyLimitBtnStub">Купить</button>
                    <button class="stocks-toggle-mode" id="toggleBuyModeStub">✍️ Поля ввода</button>
                </div>
            </div>
            <div id="stocks-tab-myorders" class="stocks-tab-content">
                <div style="margin-bottom:24px;">
                    <h4 style="margin-bottom:12px;">📌 Мои ордера на продажу</h4>
                    <div class="order-card" style="justify-content:center;">Нет активных ордеров</div>
                    <button class="cancel-all-btn" id="cancelAllSellsStub">Отменить все</button>
                </div>
                <div>
                    <h4 style="margin-bottom:12px;">🛒 Мои заявки на покупку</h4>
                    <div class="order-card" style="justify-content:center;">Нет активных заявок</div>
                    <button class="cancel-all-btn" id="cancelAllBuysStub">Отменить все</button>
                </div>
            </div>
            <div id="stocks-tab-history" class="stocks-tab-content">
                <table class="history-table">
                    <thead>
                        <tr><th>Кол-во</th><th>Цена</th><th>Статус</th><th>Дата</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>1.00</td><td>1.00 ⭐</td><td class="status-cancelled">❌</td><td>09.06.2026, 02:23</td></tr>
                        <tr><td>1.00</td><td>1.00 ⭐</td><td class="status-cancelled">❌</td><td>09.06.2026, 02:23</td></tr>
                        <tr><td>1.10</td><td>2.10 ⭐</td><td class="status-cancelled">❌</td><td>09.06.2026, 02:22</td></tr>
                        <tr><td>1.00</td><td>1.00 ⭐</td><td class="status-cancelled">❌</td><td>08.06.2026, 23:53</td></tr>
                        <tr><td>11.57</td><td>16.00 ⭐</td><td class="status-cancelled">❌</td><td>08.06.2026, 23:48</td></tr>
                        <tr><td>126.78</td><td>100.00 ⭐</td><td class="status-cancelled">❌</td><td>08.06.2026, 22:55</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
        <div class="stocks-market-fixed">
            <button class="stocks-market-buy" id="marketBuyBtnStub">🚀 Рыночная покупка</button>
            <button class="stocks-market-sell" id="marketSellBtnStub">📉 Рыночная продажа</button>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    // Переключение вкладок
    const tabs = document.querySelectorAll('.stocks-tab-btn');
    const contents = {
        orderbook: document.getElementById('stocks-tab-orderbook'),
        sell: document.getElementById('stocks-tab-sell'),
        buy: document.getElementById('stocks-tab-buy'),
        myorders: document.getElementById('stocks-tab-myorders'),
        history: document.getElementById('stocks-tab-history')
    };
    tabs.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            tabs.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            Object.values(contents).forEach(content => content.classList.remove('active'));
            if (contents[tabId]) contents[tabId].classList.add('active');
        });
    });

    // Заглушка для всех активных кнопок
    const stubMsg = () => window.showCustomModal('В разработке', 'Функционал временно отключён для настройки визуала. Скоро всё заработает!');
    document.getElementById('marketBuyBtnStub').onclick = stubMsg;
    document.getElementById('marketSellBtnStub').onclick = stubMsg;
    document.getElementById('sellBtnStub')?.addEventListener('click', stubMsg);
    document.getElementById('buyLimitBtnStub')?.addEventListener('click', stubMsg);
    document.getElementById('cancelAllSellsStub')?.addEventListener('click', stubMsg);
    document.getElementById('cancelAllBuysStub')?.addEventListener('click', stubMsg);
    document.getElementById('toggleSellModeStub')?.addEventListener('click', stubMsg);
    document.getElementById('toggleBuyModeStub')?.addEventListener('click', stubMsg);

    // Слайдеры (только визуал)
    const sellSlider = document.getElementById('sellAmountSlider');
    const sellVal = document.getElementById('sellAmountVal');
    if (sellSlider) sellSlider.addEventListener('input', () => sellVal.innerText = sellSlider.value);
    const sellPriceSlider = document.getElementById('sellPriceSlider');
    const sellPriceVal = document.getElementById('sellPriceVal');
    if (sellPriceSlider) sellPriceSlider.addEventListener('input', () => sellPriceVal.innerText = sellPriceSlider.value);
    const buySlider = document.getElementById('buyAmountSlider');
    const buyVal = document.getElementById('buyAmountVal');
    if (buySlider) buySlider.addEventListener('input', () => buyVal.innerText = buySlider.value);
    const buyPriceSlider = document.getElementById('buyPriceSlider');
    const buyPriceVal = document.getElementById('buyPriceVal');
    if (buyPriceSlider) buyPriceSlider.addEventListener('input', () => buyPriceVal.innerText = buyPriceSlider.value);
};
