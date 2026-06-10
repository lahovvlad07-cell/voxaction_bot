// stocks.js – компактный главный экран, все функции в модалках (заглушки)
window.renderStocksTab = async function(currentUser) {
    // Демо-данные (позже заменятся реальными)
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
                <div class="stocks-stat"><div class="label">Капитализация</div><div class="value">${marketCap} ⭐</div></div>
                <div class="stocks-stat"><div class="label">Всего акций</div><div class="value">${totalShares}</div></div>
                <div class="stocks-stat"><div class="label">Ср. цена 24ч</div><div class="value">${avgPrice24h} ⭐</div></div>
            </div>
            <div class="stocks-grid">
                <button class="stocks-grid-btn" id="openOrderbookBtn">📖 Стакан</button>
                <button class="stocks-grid-btn" id="openSellFormBtn">📈 Продать</button>
                <button class="stocks-grid-btn" id="openBuyFormBtn">🛒 Купить</button>
                <button class="stocks-grid-btn" id="openMyOrdersBtn">📌 Мои ордера</button>
                <button class="stocks-grid-btn" id="openHistoryBtn">🗂 История</button>
            </div>
        </div>
        <div class="stocks-market-fixed">
            <button class="stocks-market-buy" id="marketBuyBtnStub">🚀 Рыночная покупка</button>
            <button class="stocks-market-sell" id="marketSellBtnStub">📉 Рыночная продажа</button>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    // Заглушка для всех активных кнопок (пока нет логики)
    const stubMsg = () => window.showCustomModal('В разработке', 'Функционал временно отключён для настройки визуала. Скоро всё заработает!');
    document.getElementById('marketBuyBtnStub').onclick = stubMsg;
    document.getElementById('marketSellBtnStub').onclick = stubMsg;

    // Универсальная функция открытия модалки
    function showModal(title, contentHtml) {
        const modalHtml = `
            <div class="modal stocks-modal" id="stocksModal" style="display:flex;">
                <div class="modal-content">
                    <span class="modal-close" id="closeModal">&times;</span>
                    <h3>${title}</h3>
                    <div class="modal-body">
                        ${contentHtml}
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('stocksModal');
        document.getElementById('closeModal').onclick = () => modal.remove();
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        return modal;
    }

    // Стакан заявок
    document.getElementById('openOrderbookBtn').onclick = () => {
        const content = `
            <div style="display:flex; gap:20px; flex-wrap:wrap;">
                <div style="flex:1;">
                    <h4 style="text-align:center; margin-bottom:16px;">💰 Продажа</h4>
                    <div class="orderbook-row"><span>—</span><span class="price-sell">—</span><span class="small-text">—</span></div>
                    <div class="small-text" style="text-align:center; margin-top:16px;">Нет заявок на продажу</div>
                </div>
                <div style="flex:1;">
                    <h4 style="text-align:center; margin-bottom:16px;">🏦 Покупка</h4>
                    <div class="orderbook-row"><span>—</span><span class="price-buy">—</span><span class="small-text">—</span></div>
                    <div class="small-text" style="text-align:center; margin-top:16px;">Нет заявок на покупку</div>
                </div>
            </div>
        `;
        showModal('Стакан заявок', content);
    };

    // Форма продажи
    document.getElementById('openSellFormBtn').onclick = () => {
        const content = `
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
        `;
        showModal('Продать акции', content);
        // Обработчики слайдеров (только для демонстрации)
        const sellSlider = document.getElementById('sellAmountSlider');
        const sellVal = document.getElementById('sellAmountVal');
        if (sellSlider) sellSlider.addEventListener('input', () => sellVal.innerText = sellSlider.value);
        const sellPriceSlider = document.getElementById('sellPriceSlider');
        const sellPriceVal = document.getElementById('sellPriceVal');
        if (sellPriceSlider) sellPriceSlider.addEventListener('input', () => sellPriceVal.innerText = sellPriceSlider.value);
        document.getElementById('sellBtnStub').onclick = stubMsg;
        document.getElementById('toggleSellModeStub').onclick = stubMsg;
    };

    // Форма покупки
    document.getElementById('openBuyFormBtn').onclick = () => {
        const content = `
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
        `;
        showModal('Купить (лимитная заявка)', content);
        const buySlider = document.getElementById('buyAmountSlider');
        const buyVal = document.getElementById('buyAmountVal');
        if (buySlider) buySlider.addEventListener('input', () => buyVal.innerText = buySlider.value);
        const buyPriceSlider = document.getElementById('buyPriceSlider');
        const buyPriceVal = document.getElementById('buyPriceVal');
        if (buyPriceSlider) buyPriceSlider.addEventListener('input', () => buyPriceVal.innerText = buyPriceSlider.value);
        document.getElementById('buyLimitBtnStub').onclick = stubMsg;
        document.getElementById('toggleBuyModeStub').onclick = stubMsg;
    };

    // Мои ордера
    document.getElementById('openMyOrdersBtn').onclick = () => {
        const content = `
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
        `;
        showModal('Мои ордера', content);
        document.getElementById('cancelAllSellsStub')?.addEventListener('click', stubMsg);
        document.getElementById('cancelAllBuysStub')?.addEventListener('click', stubMsg);
    };

    // История ордеров
    document.getElementById('openHistoryBtn').onclick = () => {
        const content = `
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
        `;
        showModal('История моих ордеров', content);
    };
};
