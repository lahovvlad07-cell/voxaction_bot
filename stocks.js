// stocks.js – полностью исправленная версия со всеми фиксами

// ---- Режим ввода ----
function getInputMode() {
    return localStorage.getItem('stock_input_mode') === 'slider' ? 'slider' : 'field';
}
function setInputMode(mode) {
    localStorage.setItem('stock_input_mode', mode);
}

function renderInputControls(amountContainer, priceContainer, mode, curAmount = 1, curPrice = 1) {
    if (mode === 'slider') {
        amountContainer.innerHTML = `
            <input type="range" id="orderAmountSlider" min="1" max="1000" step="1" value="${curAmount}">
            <div class="slider-value">${curAmount} шт.</div>
        `;
        priceContainer.innerHTML = `
            <input type="range" id="orderPriceSlider" min="1" max="10" step="0.1" value="${curPrice}">
            <div class="slider-value">${curPrice.toFixed(1)} ⭐</div>
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
        amountContainer.innerHTML = `<input type="number" id="orderAmount" placeholder="Количество (шт.)" step="1" min="1" value="${curAmount}">`;
        priceContainer.innerHTML = `<input type="number" id="orderPrice" placeholder="Цена за 1 шт. (⭐)" step="0.1" min="1" value="${curPrice}">`;
    }
}

// ---- Получение заявок на покупку ----
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

// ---- Модальное окно для рыночных сделок ----
function showMarketModal(type, callback) {
    const modalHtml = `
        <div class="modal" id="marketModal" style="display:flex;">
            <div class="modal-content" style="max-width: 300px;">
                <span class="close-modal" id="closeMarketModal">&times;</span>
                <h3>${type === 'buy' ? '🚀 Рыночная покупка' : '📉 Рыночная продажа'}</h3>
                <input type="number" id="marketAmount" placeholder="${type === 'buy' ? 'Сумма в Stars' : 'Количество акций'}" step="${type === 'buy' ? '1' : '1'}" min="1" style="margin: 16px 0;">
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

// ---- ГЛАВНЫЙ РЕНДЕР ----
window.renderStocksTab = async function(currentUser) {
    // Загрузка данных
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
    
    // Цена: прочерк (белый) пока нет сделок, после сделок – жёлтый градиент
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
    
    // Проценты средней цены за 24ч
    let avgPercentText = '0%';
    let avgPercentClass = '';
    if (avgPrice24hCents >= 100 && currentPriceCents >= 100 && currentPriceCents > 100) {
        const percent = ((currentPriceCents - avgPrice24hCents) / avgPrice24hCents) * 100;
        avgPercentText = (percent >= 0 ? `+${percent.toFixed(2)}%` : `${percent.toFixed(2)}%`);
        avgPercentClass = percent >= 0 ? 'positive' : 'negative';
    }

    // HTML
    const html = `
        <div class="stocks-container">
            <div class="balance-row">
                <div class="balance-card">
                    <div class="bal-label">📊 Акции</div>
                    <div class="bal-value">${userShares}</div>
                </div>
                <div class="balance-card">
                    <div class="bal-label">⭐ Stars</div>
                    <div class="bal-value">${userStars}</div>
                </div>
                <div class="balance-card">
                    <div class="bal-label">💰 Цена</div>
                    <div class="bal-value ${hasPrice ? 'price-active' : 'price-placeholder'}">${showPrice}</div>
                </div>
            </div>

            <div class="chart-container-main">
                <canvas id="mainPriceChart" width="600" height="160" style="width:100%; height:160px;"></canvas>
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
                    <div class="stat-label">Ср. цена (24ч)</div>
                    <div class="stat-value ${avgPercentClass}">${avgPercentText}</div>
                </div>
            </div>

            <div class="tabs-row">
                <button class="tab-btn active" data-tab="orderform">✍️ Новый ордер</button>
                <button class="tab-btn" data-tab="orderbook">📖 Стакан</button>
                <button class="tab-btn" data-tab="orders">📋 Ордера</button>
                <button class="tab-btn" data-tab="myorders">📌 Мои ордера</button>
            </div>

            <div id="tab-orderform" class="tab-pane active">
                <div class="order-form-panel">
                    <div class="type-switch">
                        <button id="orderTypeSell" class="type-opt active">📉 Продать акции</button>
                        <button id="orderTypeBuy" class="type-opt">📈 Купить акции</button>
                    </div>
                    <div class="input-mode-switch">
                        <span class="mode-label">🎛️ Режим:</span>
                        <div class="mode-buttons">
                            <button id="modeFieldBtn" class="mode-btn active">📝 Поля</button>
                            <button id="modeSliderBtn" class="mode-btn">🎚️ Слайдеры</button>
                        </div>
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
                        <h4>💰 Продажа (лучшие цены)</h4>
                        <div id="sellBookList" class="orderbook-list"></div>
                    </div>
                    <div class="orderbook-col">
                        <h4>🏦 Покупка (лучшие цены)</h4>
                        <div id="buyBookList" class="orderbook-list"></div>
                    </div>
                </div>
            </div>

            <div id="tab-orders" class="tab-pane">
                <div class="section-header">📋 Активные ордера на продажу</div>
                <div id="activeSellOrdersList" class="orders-container"></div>
            </div>

            <div id="tab-myorders" class="tab-pane">
                <div class="my-orders-block">
                    <div class="section-header">📌 Мои ордера на продажу</div>
                    <div id="mySellOrdersList" class="orders-container"></div>
                </div>
                <div class="my-orders-block">
                    <div class="section-header">🛒 Мои заявки на покупку</div>
                    <div id="myBuyOrdersList" class="orders-container"></div>
                </div>
            </div>
        </div>

        <div class="market-buttons">
            <button id="marketBuyBtn" class="market-btn buy">🚀 Рыночная покупка</button>
            <button id="marketSellBtn" class="market-btn sell">📉 Рыночная продажа</button>
        </div>
    `;

    document.getElementById('app').innerHTML = html;

    // ---- ГРАФИК с корректной отрисовкой ----
    function drawMainChart() {
        const canvas = document.getElementById('mainPriceChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.clientWidth;
        const h = 160;
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
            const y = h - 12 - ((price - minP) / range) * (h - 24);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.lineTo(w, h - 12);
        ctx.lineTo(0, h - 12);
        ctx.fillStyle = 'rgba(0, 255, 255, 0.1)';
        ctx.fill();
    }
    // Принудительная перерисовка после загрузки и при изменении размера
    setTimeout(drawMainChart, 50);
    window.addEventListener('resize', () => setTimeout(drawMainChart, 50));

    // ---- СТАКАН (ТОП‑5) ----
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
            .slice(0, 5);

        const buyMap = new Map();
        activeBuyOrders.forEach(o => {
            const price = o.price_per_share / 100;
            const amount = o.amount / 100;
            buyMap.set(price, (buyMap.get(price) || 0) + amount);
        });
        const buyBook = Array.from(buyMap.entries())
            .map(([p, a]) => ({ price: p, amount: a }))
            .sort((a,b) => b.price - a.price)
            .slice(0, 5);

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

    // ---- АКТИВНЫЕ ОРДЕРА (чужие, исключая свои) ----
    function renderActiveSellOrders() {
        const container = document.getElementById('activeSellOrdersList');
        if (!container) return;
        const foreignOrders = activeSellOrders.filter(o => o.seller_id !== window.userId);
        if (!foreignOrders.length) {
            container.innerHTML = '<div class="empty-placeholder">Нет активных ордеров</div>';
            return;
        }
        const html = foreignOrders.map(order => {
            const price = order.price_per_share / 100;
            const amount = order.amount / 100;
            return `
                <div class="order-item" data-id="${order.id}">
                    <div class="order-info">
                        <span>📦 ${amount.toFixed(2)} шт.</span>
                        <span>⭐ ${price.toFixed(2)}</span>
                        <span class="order-seller">👤 продавец: ${order.seller_id}</span>
                    </div>
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
                    window.showToast(`✅ Куплено ${amount.toFixed(2)} шт. по ${price.toFixed(2)} ⭐`, 2000);
                    window.refreshActiveTab();
                } catch(e) {
                    window.showCustomModal('Ошибка', e.message);
                }
            });
        });
    }

    // ---- МОИ ОРДЕРА (продажа и покупка) ----
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
                    if (type === 'sell') {
                        await window.cancelOrder(id);
                    } else {
                        await window.cancelBuyOrder(id);
                    }
                    window.showToast('Ордер отменён', 2000);
                    window.refreshActiveTab();
                } catch(e) {
                    window.showCustomModal('Ошибка', e.message);
                }
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
            if (target === 'orderform') drawMainChart(); // перерисовать график при возврате
        });
    });

    // ---- ЛИМИТНЫЙ ОРДЕР с проверкой баланса ----
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
        let curAmount = 1, curPriceVal = 1;
        if (getInputMode() === 'slider') {
            const aS = document.getElementById('orderAmountSlider');
            if (aS) curAmount = parseFloat(aS.value);
            const pS = document.getElementById('orderPriceSlider');
            if (pS) curPriceVal = parseFloat(pS.value);
        } else {
            const aN = document.getElementById('orderAmount');
            if (aN) curAmount = parseFloat(aN.value) || 1;
            const pN = document.getElementById('orderPrice');
            if (pN) curPriceVal = parseFloat(pN.value) || 1;
        }
        renderInputControls(amountContainer, priceContainer, mode, curAmount, curPriceVal);
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
        if (isNaN(amount) || amount < 1 || isNaN(price) || price < 1) {
            window.showCustomModal('Ошибка', 'Введите корректные количество и цену (минимум 1)');
            return;
        }
        
        // Проверка баланса
        const freshUser = await window.getOrCreateUser();
        const userSharesCents = freshUser.user.shares;
        const userStarsCents = freshUser.user.stars_balance;
        
        if (currentOrderType === 'sell') {
            const neededSharesCents = window.toCents(amount);
            if (userSharesCents < neededSharesCents) {
                window.showCustomModal('Ошибка', `Недостаточно акций. Доступно: ${window.fromCents(userSharesCents)}`);
                return;
            }
        } else { // buy
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
                window.showToast('Ордер на продажу размещён', 2000);
            } else {
                await window.createBuyOrder(amount, price);
                window.showToast('Заявка на покупку размещена', 2000);
            }
            // Очистка полей
            if (getInputMode() === 'slider') {
                if (document.getElementById('orderAmountSlider')) document.getElementById('orderAmountSlider').value = 1;
                if (document.getElementById('orderPriceSlider')) document.getElementById('orderPriceSlider').value = 1;
                if (document.querySelector('#amountControl .slider-value')) document.querySelector('#amountControl .slider-value').innerText = '1 шт.';
                if (document.querySelector('#priceControl .slider-value')) document.querySelector('#priceControl .slider-value').innerText = '1.0 ⭐';
            } else {
                if (document.getElementById('orderAmount')) document.getElementById('orderAmount').value = '';
                if (document.getElementById('orderPrice')) document.getElementById('orderPrice').value = '';
            }
            window.refreshActiveTab();
        } catch(e) {
            window.showCustomModal('Ошибка', e.message);
        }
    };

    // ---- РЫНОЧНЫЕ СДЕЛКИ (модальные окна + проверка наличия ордеров) ----
    document.getElementById('marketBuyBtn').onclick = () => {
        if (!activeSellOrders.length) {
            window.showCustomModal('Рыночная покупка', 'Нет доступных сделок для покупки');
            return;
        }
        showMarketModal('buy', async (stars) => {
            try {
                await window.marketBuy(stars);
                window.showToast(`Рыночная покупка на ${stars} ⭐ выполнена`, 2000);
                window.refreshActiveTab();
            } catch(e) {
                window.showCustomModal('Ошибка', e.message);
            }
        });
    };
    document.getElementById('marketSellBtn').onclick = () => {
        if (!activeBuyOrders.length) {
            window.showCustomModal('Рыночная продажа', 'Нет подходящих ордеров на покупку');
            return;
        }
        showMarketModal('sell', async (shares) => {
            try {
                await window.marketSell(shares);
                window.showToast(`Продано ${shares} акций по рыночной цене`, 2000);
                window.refreshActiveTab();
            } catch(e) {
                window.showCustomModal('Ошибка', e.message);
            }
        });
    };

    // ---- Отрисовка начального состояния ----
    drawMainChart();
    renderOrderBook();
    renderActiveSellOrders();
    renderMyOrders();
};

// Переопределяем window.showToast для короткого времени (2 секунды)
const originalShowToast = window.showToast;
window.showToast = function(message, duration = 2000) {
    if (originalShowToast) {
        // Если оригинальная функция уже есть, используем её, но с задержкой
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    } else {
        // fallback
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerText = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }
};
