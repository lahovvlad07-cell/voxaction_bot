// stocks.js – улучшенная разметка с новыми стилями
// Все бизнес-функции (getActiveOrders, cancelOrder, createOrder, marketBuy и т.д.) остаются без изменений.
// Этот код отвечает только за рендер вкладки.

window.renderStocksTab = async function(currentUser) {
    try {
        // Получаем данные (предполагается, что эти функции уже определены)
        const allOrders = await loadOrdersWithSellers();      // ваша функция
        const myOrders = allOrders.filter(o => o.seller_id === window.userId);
        const myBuyOrders = await loadMyBuyOrders();          // ваша функция
        const priceHistory = await window.fetchPriceHistoryForTimeframe(currentTimeframe);
        const { totalShares, currentPrice, marketCap } = await window.getTotalMarketCap();
        const avg24h = await window.get24hAvgPrice();
        const orderHistory = await loadOrderHistory();        // ваша функция

        // Формы (слайдеры или поля)
        const sellFormHtml = renderSellForm();   // ваша функция
        const buyFormHtml = renderBuyLimitForm(); // ваша функция

        const html = `
            <div class="stocks-card">
                <!-- Баланс -->
                <div class="stocks-balance-row">
                    <div class="stocks-balance-card">
                        <div class="stocks-balance-icon">📊</div>
                        <div class="stocks-balance-label">Акций</div>
                        <div class="stocks-balance-value">${window.fromCents(currentUser.shares)}</div>
                    </div>
                    <div class="stocks-balance-card">
                        <div class="stocks-balance-icon">⭐</div>
                        <div class="stocks-balance-label">Stars</div>
                        <div class="stocks-balance-value">${window.fromCents(currentUser.stars_balance)}</div>
                    </div>
                    <div class="stocks-balance-card">
                        <div class="stocks-balance-icon">📈</div>
                        <div class="stocks-balance-label">Цена</div>
                        <div class="stocks-balance-value price">${(currentPrice/100).toFixed(2)} ⭐</div>
                    </div>
                </div>

                <!-- Инфо панель -->
                <div class="stocks-info-row">
                    <div class="stocks-info-card">
                        <div class="stocks-info-label">🏦 Капитализация</div>
                        <div class="stocks-info-value">${Math.round(marketCap)} ⭐</div>
                    </div>
                    <div class="stocks-info-card">
                        <div class="stocks-info-label">📦 Всего акций</div>
                        <div class="stocks-info-value">${(totalShares/100).toFixed(2)}</div>
                    </div>
                    <div class="stocks-info-card">
                        <div class="stocks-info-label">📈 Средняя цена (24ч)</div>
                        <div class="stocks-info-value">${avg24h.toFixed(2)} ⭐</div>
                    </div>
                </div>

                <!-- Таймфреймы -->
                <div class="stocks-timeframe">
                    <button class="stocks-timeframe-btn ${currentTimeframe === '1d' ? 'active' : ''}" data-tf="1d">1д</button>
                    <button class="stocks-timeframe-btn ${currentTimeframe === '7d' ? 'active' : ''}" data-tf="7d">7д</button>
                    <button class="stocks-timeframe-btn ${currentTimeframe === '30d' ? 'active' : ''}" data-tf="30d">30д</button>
                    <button class="stocks-refresh-btn" id="stocksRefreshChartBtn">🔄 Обновить</button>
                </div>

                <!-- График -->
                <div id="stocks-chart-container" class="stocks-chart"></div>
                <div id="stocks-ticker" class="stocks-ticker"></div>

                <!-- Стакан заявок -->
                <div class="stocks-orderbook">
                    <div class="stocks-orderbook-col">
                        <h4>💰 Продажа</h4>
                        <div id="stocks-sellOrdersList"></div>
                    </div>
                    <div class="stocks-orderbook-col">
                        <h4>🏦 Покупка</h4>
                        <div id="stocks-buyOrdersList"></div>
                    </div>
                </div>

                <!-- Формы продажи/покупки -->
                <div class="stocks-form">
                    <h3>📈 Продать акции</h3>
                    ${sellFormHtml}
                </div>
                <div class="stocks-form">
                    <h3>🛒 Купить (лимитная заявка)</h3>
                    ${buyFormHtml}
                </div>

                <!-- Мои ордера на продажу -->
                <div class="stocks-section-header">
                    <h3>📌 Мои ордера на продажу (${myOrders.length})</h3>
                    <button id="stocks-cancelAllSellsBtn" class="cancel-all-btn">Отменить все</button>
                </div>
                <div id="stocks-mySellOrdersList"></div>

                <!-- Мои заявки на покупку -->
                <div class="stocks-section-header">
                    <h3>🛒 Мои заявки на покупку (${myBuyOrders.length})</h3>
                    <button id="stocks-cancelAllBuysBtn" class="cancel-all-btn">Отменить все</button>
                </div>
                <div id="stocks-myBuyOrdersList"></div>

                <!-- Список всех ордеров на продажу -->
                <h3>📋 Ордера на продажу</h3>
                <div id="stocks-ordersList"></div>

                <!-- История ордеров -->
                <h3>🗂 История моих ордеров</h3>
                <div id="stocks-orderHistoryList"></div>
            </div>

            <!-- Фиксированные кнопки рыночных операций -->
            <div class="market-buttons-fixed">
                <button id="stocksMarketBuyBtn">🚀 Рыночная покупка</button>
                <button id="stocksMarketSellBtn">📉 Рыночная продажа</button>
            </div>
        `;

        document.getElementById('app').innerHTML = html;

        // Вызов функций отрисовки (они должны быть определены)
        drawCanvasChartWithAxes(priceHistory);
        await updateTicker();
        await renderOrderBook();
        renderOrderHistory(orderHistory);
        await loadMySellOrders();    // заполнение #stocks-mySellOrdersList
        await loadMyBuyOrders();     // заполнение #stocks-myBuyOrdersList
        renderOrdersList(allOrders);  // заполнение #stocks-ordersList

        // Обработчики
        document.getElementById('stocks-cancelAllSellsBtn').onclick = async () => {
            if (confirm('Отменить все ваши ордера на продажу?')) {
                await cancelAllSellOrders();
                await window.renderStocksTab(currentUser);
            }
        };
        document.getElementById('stocks-cancelAllBuysBtn').onclick = async () => {
            if (confirm('Отменить все заявки на покупку?')) {
                await cancelAllBuyOrders();
                await window.renderStocksTab(currentUser);
            }
        };
        document.querySelectorAll('.stocks-timeframe-btn').forEach(btn => {
            btn.onclick = async () => {
                currentTimeframe = btn.dataset.tf;
                await window.renderStocksTab(currentUser);
            };
        });
        document.getElementById('stocksRefreshChartBtn').onclick = async () => {
            await window.renderStocksTab(currentUser);
        };
        document.getElementById('stocksMarketBuyBtn').onclick = async () => {
            const stars = parseFloat(prompt('Сколько ⭐ потратить?', '100'));
            if (isNaN(stars) || stars <= 0) return;
            try {
                await marketBuy(stars);
                await window.renderStocksTab(currentUser);
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        };
        document.getElementById('stocksMarketSellBtn').onclick = async () => {
            const shares = parseFloat(prompt('Сколько акций продать?', '1'));
            if (isNaN(shares) || shares <= 0) return;
            try {
                await marketSell(shares);
                await window.renderStocksTab(currentUser);
            } catch (err) {
                window.showCustomModal('Ошибка', err.message);
            }
        };

        // Здесь также нужно добавить обработчики для sellBtn, buyLimitBtn, переключения режимов
        // Они уже есть в вашем коде. Просто убедитесь, что ID элементов совпадают.
        // Например, для sellBtn: document.getElementById('sellBtn') – он должен быть внутри формы.
    } catch (err) {
        console.error(err);
        document.getElementById('app').innerHTML = `<div class="card error">${err.message}</div>`;
    }
};
