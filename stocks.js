// stocks.js – простая версия с модалками (заглушки)
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
                <div class="stocks-balance-card"><div class="stocks-balance-label">📊 Акций</div><div class="stocks-balance-value">${userShares}</div></div>
                <div class="stocks-balance-card"><div class="stocks-balance-label">⭐ Stars</div><div class="stocks-balance-value">${userStars}</div></div>
                <div class="stocks-balance-card"><div class="stocks-balance-label">💰 Цена</div><div class="stocks-balance-value price">${currentPrice}</div></div>
            </div>
            <div class="stocks-stats">
                <div class="stocks-stat"><div class="label">🏦 Капитализация</div><div class="value">${marketCap} ⭐</div></div>
                <div class="stocks-stat"><div class="label">📦 Всего акций</div><div class="value">${totalShares}</div></div>
                <div class="stocks-stat"><div class="label">📈 Ср. цена 24ч</div><div class="value">${avgPrice24h} ⭐</div></div>
            </div>
            <div class="stocks-chart" id="stocksChartPlaceholder">📈 График появится после первых сделок</div>
            <div class="stocks-actions">
                <button class="stocks-action-btn" id="openOrderbookBtn">📖 Стакан</button>
                <button class="stocks-action-btn" id="openSellFormBtn">📈 Продать</button>
                <button class="stocks-action-btn" id="openBuyFormBtn">🛒 Купить</button>
                <button class="stocks-action-btn" id="openMyOrdersBtn">📌 Мои ордера</button>
            </div>
        </div>
        <div class="stocks-market-fixed">
            <button class="stocks-market-buy" id="marketBuyBtn">🚀 Рыночная покупка</button>
            <button class="stocks-market-sell" id="marketSellBtn">📉 Рыночная продажа</button>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    const stubMsg = () => window.showCustomModal('В разработке', 'Функционал временно отключён для настройки визуала. Скоро всё заработает!');
    document.getElementById('marketBuyBtn').onclick = stubMsg;
    document.getElementById('marketSellBtn').onclick = stubMsg;

    function showModal(title, contentHtml) {
        const modalHtml = `
            <div class="modal stocks-modal" id="stocksModal" style="display:flex;">
                <div class="modal-content">
                    <span class="modal-close" id="closeModal">&times;</span>
                    <h3>${title}</h3>
                    <div class="modal-body">${contentHtml}</div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
        const modal = document.getElementById('stocksModal');
        document.getElementById('closeModal').onclick = () => modal.remove();
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    }

    document.getElementById('openOrderbookBtn').onclick = () => {
        showModal('Стакан заявок', `
            <div style="display:flex; gap:20px; flex-wrap:wrap;">
                <div style="flex:1;"><h4 style="text-align:center;">💰 Продажа</h4><div class="small-text" style="text-align:center;">Нет заявок</div></div>
                <div style="flex:1;"><h4 style="text-align:center;">🏦 Покупка</h4><div class="small-text" style="text-align:center;">Нет заявок</div></div>
            </div>
        `);
    };
    document.getElementById('openSellFormBtn').onclick = () => {
        showModal('Продать акции', `
            <div class="form-group"><label>📦 Количество: <span id="sellAmountVal">0.01</span></label><input type="range" id="sellAmountSlider" min="0.01" max="1000" step="0.01" value="0.01"></div>
            <div class="form-group"><label>⭐ Цена: <span id="sellPriceVal">1</span></label><input type="range" id="sellPriceSlider" min="1" max="100" step="0.1" value="1"></div>
            <button class="stocks-btn" id="sellBtnStub">Продать</button>
            <button class="stocks-toggle-mode" id="toggleSellModeStub">✍️ Поля ввода</button>
        `);
        const sellSlider = document.getElementById('sellAmountSlider');
        if (sellSlider) sellSlider.oninput = () => document.getElementById('sellAmountVal').innerText = sellSlider.value;
        const sellPriceSlider = document.getElementById('sellPriceSlider');
        if (sellPriceSlider) sellPriceSlider.oninput = () => document.getElementById('sellPriceVal').innerText = sellPriceSlider.value;
        document.getElementById('sellBtnStub').onclick = stubMsg;
        document.getElementById('toggleSellModeStub').onclick = stubMsg;
    };
    document.getElementById('openBuyFormBtn').onclick = () => {
        showModal('Купить (лимитная заявка)', `
            <div class="form-group"><label>📦 Количество: <span id="buyAmountVal">0.01</span></label><input type="range" id="buyAmountSlider" min="0.01" max="1000" step="0.01" value="0.01"></div>
            <div class="form-group"><label>⭐ Цена: <span id="buyPriceVal">1</span></label><input type="range" id="buyPriceSlider" min="1" max="100" step="0.1" value="1"></div>
            <button class="stocks-btn" id="buyLimitBtnStub">Купить</button>
            <button class="stocks-toggle-mode" id="toggleBuyModeStub">✍️ Поля ввода</button>
        `);
        const buySlider = document.getElementById('buyAmountSlider');
        if (buySlider) buySlider.oninput = () => document.getElementById('buyAmountVal').innerText = buySlider.value;
        const buyPriceSlider = document.getElementById('buyPriceSlider');
        if (buyPriceSlider) buyPriceSlider.oninput = () => document.getElementById('buyPriceVal').innerText = buyPriceSlider.value;
        document.getElementById('buyLimitBtnStub').onclick = stubMsg;
        document.getElementById('toggleBuyModeStub').onclick = stubMsg;
    };
    document.getElementById('openMyOrdersBtn').onclick = () => {
        showModal('Мои ордера', `
            <div style="margin-bottom:16px;"><h4>📌 Мои ордера на продажу</h4><div class="order-card" style="justify-content:center;">Нет активных ордеров</div><button class="cancel-all-btn">Отменить все</button></div>
            <div><h4>🛒 Мои заявки на покупку</h4><div class="order-card" style="justify-content:center;">Нет активных заявок</div><button class="cancel-all-btn">Отменить все</button></div>
        `);
        document.querySelectorAll('.cancel-all-btn').forEach(btn => btn.onclick = stubMsg);
    };
};
