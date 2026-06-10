// stocks.js – временная версия только для визуала (заглушки)
// Позже сюда вернётся полная логика, структура классов сохранена.

window.renderStocksTab = async function(currentUser) {
    // Мокап данных для отображения
    const userShares = currentUser?.shares ? window.fromCents(currentUser.shares) : '136.59';
    const userStars = currentUser?.stars_balance ? window.fromCents(currentUser.stars_balance) : '2.37';
    const currentPrice = '1.00';
    const marketCap = '225';
    const totalShares = '225.46';
    const avgPrice24h = '0.00';

    const html = `
        <div class="stocks-balance-grid">
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
        <div class="stocks-info-grid">
            <div class="stocks-info-card"><div class="small-text">🏦 Капитализация</div><div class="price">${marketCap} ⭐</div></div>
            <div class="stocks-info-card"><div class="small-text">📦 Всего акций</div><div class="price">${totalShares}</div></div>
            <div class="stocks-info-card"><div class="small-text">📈 Средняя цена (24ч)</div><div class="price">${avgPrice24h} ⭐</div></div>
        </div>
        <div class="stocks-timeframe">
            <button class="stocks-timeframe-btn active">1д</button>
            <button class="stocks-timeframe-btn">7д</button>
            <button class="stocks-timeframe-btn">30д</button>
            <button class="stocks-refresh-btn">🔄 Обновить</button>
        </div>
        <div class="stocks-chart">
            📈 График появится после первых сделок
        </div>
        <div class="stocks-ticker">
            <div class="stocks-ticker-content">Нет сделок</div>
        </div>
        <div class="stocks-orderbook">
            <div class="stocks-orderbook-col">
                <h4>💰 Продажа</h4>
                <div class="orderbook-row"><span>—</span><span class="price-sell">—</span><span class="small-text">—</span></div>
                <div class="small-text" style="text-align:center; margin-top:8px;">Нет заявок на продажу</div>
            </div>
            <div class="stocks-orderbook-col">
                <h4>🏦 Покупка</h4>
                <div class="orderbook-row"><span>—</span><span class="price-buy">—</span><span class="small-text">—</span></div>
                <div class="small-text" style="text-align:center; margin-top:8px;">Нет заявок на покупку</div>
            </div>
        </div>
        <div class="stocks-form">
            <h3>📈 Продать акции</h3>
            <div class="form-group">
                <label>📦 Количество: <span id="sellAmountVal">0.01</span></label>
                <input type="range" id="sellAmountSlider" min="0.01" max="1000" step="0.01" value="0.01">
            </div>
            <div class="form-group">
                <label>⭐ Цена: <span id="sellPriceVal">1</span></label>
                <input type="range" id="sellPriceSlider" min="1" max="100" step="0.1" value="1">
            </div>
            <button class="stocks-btn" id="sellBtnStub">Продать (заглушка)</button>
            <button class="stocks-toggle-mode" id="toggleSellModeStub">✍️ Поля ввода (заглушка)</button>
        </div>
        <div class="stocks-form">
            <h3>🛒 Купить (лимитная заявка)</h3>
            <div class="form-group">
                <label>📦 Количество: <span id="buyAmountVal">0.01</span></label>
                <input type="range" id="buyAmountSlider" min="0.01" max="1000" step="0.01" value="0.01">
            </div>
            <div class="form-group">
                <label>⭐ Цена: <span id="buyPriceVal">1</span></label>
                <input type="range" id="buyPriceSlider" min="1" max="100" step="0.1" value="1">
            </div>
            <button class="stocks-btn" id="buyLimitBtnStub">Купить (заглушка)</button>
            <button class="stocks-toggle-mode" id="toggleBuyModeStub">✍️ Поля ввода (заглушка)</button>
        </div>
        <div class="stocks-section-header">
            <h3>📌 Мои ордера на продажу (0)</h3>
            <button class="cancel-all-btn" id="cancelAllSellsStub">Отменить все</button>
        </div>
        <div class="order-card" style="justify-content:center;">Нет активных ордеров</div>
        <div class="stocks-section-header">
            <h3>🛒 Мои заявки на покупку (0)</h3>
            <button class="cancel-all-btn" id="cancelAllBuysStub">Отменить все</button>
        </div>
        <div class="order-card" style="justify-content:center;">Нет активных заявок</div>
        <h3>📋 Ордера на продажу</h3>
        <div class="small-text" style="text-align:center; padding:20px;">Нет ордеров для отображения</div>
        <h3>🗂 История моих ордеров</h3>
        <table class="stocks-history-table">
            <thead><tr><th>Кол-во</th><th>Цена</th><th>Статус</th><th>Дата</th></tr></thead>
            <tbody>
                <tr><td>1.00</td><td>1.00 ⭐</td><td class="status-cancelled">❌</td><td>09.06.2026, 02:23</td></tr>
                <tr><td>1.00</td><td>1.00 ⭐</td><td class="status-cancelled">❌</td><td>09.06.2026, 02:23</td></tr>
                <tr><td>1.10</td><td>2.10 ⭐</td><td class="status-cancelled">❌</td><td>09.06.2026, 02:22</td></tr>
                <tr><td>1.00</td><td>1.00 ⭐</td><td class="status-cancelled">❌</td><td>08.06.2026, 23:53</td></tr>
                <tr><td>11.57</td><td>16.00 ⭐</td><td class="status-cancelled">❌</td><td>08.06.2026, 23:48</td></tr>
            </tbody>
        </table>
        <div class="stocks-market-fixed">
            <button class="stocks-market-buy" id="marketBuyStub">🚀 Рыночная покупка</button>
            <button class="stocks-market-sell" id="marketSellStub">📉 Рыночная продажа</button>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    // Все кнопки – заглушки, показывают сообщение
    const showStubMsg = () => window.showCustomModal('Временное ограничение', 'Функционал временно отключён для настройки визуала. Скоро всё заработает!');
    document.querySelectorAll('.stocks-btn, .stocks-toggle-mode, .cancel-all-btn, #marketBuyStub, #marketSellStub, .stocks-timeframe-btn, .stocks-refresh-btn').forEach(btn => {
        btn.addEventListener('click', showStubMsg);
    });
    // Слайдеры работают (меняют значения), но без отправки
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
