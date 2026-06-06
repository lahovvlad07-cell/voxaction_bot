// modules/tabs/stocksTab.js

import { userId } from '../config.js';
import { toCents, fromCents, showCustomModal } from '../utils.js';
import { currentUser, setCurrentUser, getOrCreateUser } from '../user.js';
import { getActiveOrders, getUserOrders, getSellerRating, cancelOrder, createOrder, executePartialTrade, getRecentTrades, getTotalMarketCap, fetchPriceHistoryForTimeframe } from '../api.js';
import { drawCanvasChart, renderTicker } from '../stocks.js';

let currentTimeframe = '30d';
let currentOrdersFilter = 'all';
let currentSortDir = 'asc';

export async function renderStocksTab() {
    try {
        let orders = [];
        if (currentOrdersFilter === 'all') orders = await getActiveOrders();
        else orders = await getUserOrders();

        for (let o of orders) o.seller_rating = await getSellerRating(o.seller_id);
        orders.sort((a, b) => currentSortDir === 'asc' ? a.price_per_share - b.price_per_share : b.price_per_share - a.price_per_share);

        const priceHistory = await fetchPriceHistoryForTimeframe(currentTimeframe);
        const recentTrades = await getRecentTrades(10);
        const { totalShares, currentPrice, marketCap } = await getTotalMarketCap();

        const html = `
            <div class="card"><div style="display:flex; justify-content:space-between;"><div><p>📊 Акций: <strong>${fromCents(currentUser.shares)}</strong></p><p>⭐ Stars: <strong>${fromCents(currentUser.stars_balance)}</strong></p></div><div class="price">${(currentPrice / 100).toFixed(2)} ⭐</div></div></div>
            <div class="card"><div class="info-panel"><div class="info-card"><div class="small-text">Рыночная капитализация</div><div class="price" style="font-size:20px;">${Math.round(marketCap)} ⭐</div></div><div class="info-card"><div class="small-text">Всего акций</div><div class="price" style="font-size:20px;">${(totalShares / 100).toFixed(2)}</div></div></div>
            <div style="display:flex; gap:8px; margin-bottom:12px;"><button class="timeframe-btn ${currentTimeframe === '1d' ? 'active' : ''}" data-tf="1d">1д</button><button class="timeframe-btn ${currentTimeframe === '7d' ? 'active' : ''}" data-tf="7d">7д</button><button class="timeframe-btn ${currentTimeframe === '30d' ? 'active' : ''}" data-tf="30d">30д</button></div>
            <div id="chart-container" class="chart-container"></div><div id="ticker" class="ticker"></div></div>
            <div class="card"><h3>📈 Продать акции</h3><input type="number" id="sellAmount" step="0.01" min="1" placeholder="Количество (от 1)"><input type="number" id="sellPrice" step="0.01" min="1" placeholder="Цена (от 1 Star)"><button id="sellBtn">➕ Выставить</button></div>
            <div class="card"><div class="filter-bar"><button class="filter-btn ${currentOrdersFilter === 'all' ? 'active' : ''}" data-filter="all">Все</button><button class="filter-btn ${currentOrdersFilter === 'my' ? 'active' : ''}" data-filter="my">Мои</button><button class="sort-btn ${currentSortDir === 'asc' ? 'active' : ''}" data-sort="asc">↑ Цена</button><button class="sort-btn ${currentSortDir === 'desc' ? 'active' : ''}" data-sort="desc">↓ Цена</button></div>
            <h3>📋 Ордера на продажу</h3><div id="ordersList"></div></div>
        `;
        document.getElementById('app').innerHTML = html;

        drawCanvasChart(priceHistory, 'chart-container');
        renderTicker(recentTrades, 'ticker');

        // Обработчики кнопок таймфреймов
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                currentTimeframe = btn.dataset.tf;
                await renderStocksTab();
            });
        });
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentOrdersFilter = btn.dataset.filter;
                renderStocksTab();
            });
        });
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentSortDir = btn.dataset.sort;
                renderStocksTab();
            });
        });

        const ordersDiv = document.getElementById('ordersList');
        if (orders.length === 0) {
            ordersDiv.innerHTML = '<p>Нет ордеров</p>';
        } else {
            orders.forEach(order => {
                const isOwn = order.seller_id === userId;
                let ratingHtml = order.seller_rating ? `<span class="stars-rating" style="color:#fbbf24;">${'★'.repeat(Math.floor(order.seller_rating))}${order.seller_rating % 1 >= 0.5 ? '½' : ''}</span>` : '';
                const div = document.createElement('div');
                div.className = 'order-item';
                div.innerHTML = `<div><div>${fromCents(order.amount)} шт. по ${fromCents(order.price_per_share)} ⭐</div><div class="small-text">Продавец: ${order.seller_id} ${ratingHtml}</div></div><div>${!isOwn ? `<button class="buy-btn" data-order='${JSON.stringify(order)}' style="width:auto; padding:6px 16px;">Купить</button>` : `<button class="cancel-btn" data-order-id="${order.id}" style="background:#f97316; width:auto; padding:6px 16px;">Отменить</button>`}</div>`;
                ordersDiv.appendChild(div);
            });

            document.querySelectorAll('.buy-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const order = JSON.parse(btn.dataset.order);
                    const maxShares = fromCents(order.amount);
                    let buyAmount = prompt(`Введите количество (от 1 до ${maxShares}):`, maxShares);
                    if (!buyAmount) return;
                    buyAmount = parseFloat(buyAmount);
                    if (isNaN(buyAmount) || buyAmount < 1 || buyAmount > maxShares) {
                        showCustomModal('Ошибка', 'Некорректное количество');
                        return;
                    }
                    try {
                        await executePartialTrade(order.id, toCents(buyAmount));
                        showCustomModal('Успех', 'Сделка завершена');
                        await refreshAll();
                    } catch (err) {
                        showCustomModal('Ошибка', err.message);
                    }
                });
            });

            document.querySelectorAll('.cancel-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (confirm('Отменить ордер?')) {
                        try {
                            await cancelOrder(parseInt(btn.dataset.orderId));
                            showCustomModal('Успех', 'Ордер отменён');
                            await refreshAll();
                        } catch (err) {
                            showCustomModal('Ошибка', err.message);
                        }
                    }
                });
            });
        }

        document.getElementById('sellBtn')?.addEventListener('click', async () => {
            let amount = parseFloat(document.getElementById('sellAmount').value);
            let price = parseFloat(document.getElementById('sellPrice').value);
            if (isNaN(amount) || isNaN(price) || amount < 1 || price < 1) {
                showCustomModal('Ошибка', 'Введите количество не менее 1 и цену не менее 1');
                return;
            }
            try {
                await createOrder(amount, price, currentUser);
                showCustomModal('Успех', 'Ордер создан');
                await refreshAll();
            } catch (err) {
                showCustomModal('Ошибка', err.message);
            }
        });
    } catch (err) {
        document.getElementById('app').innerHTML = `<div class="card error">${err.message}</div>`;
    }
}

export async function refreshAll() {
    const result = await getOrCreateUser();
    setCurrentUser(result.user);
    await renderStocksTab();
}