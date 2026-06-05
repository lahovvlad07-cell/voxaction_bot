// stocks.js
let currentTimeframe = '30d';
let currentOrdersFilter = 'all';
let currentSortDir = 'asc';

window.getActiveOrders = async () => {
    const res = await fetch(`${window.BACKEND_URL}/get-active-orders`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user_id: window.userId }) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    return data.orders;
};
window.getUserOrders = async () => {
    const res = await fetch(`${window.BACKEND_URL}/get-user-orders`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user_id: window.userId }) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    return data.orders;
};
window.cancelOrder = async (orderId) => {
    const res = await fetch(`${window.BACKEND_URL}/cancel-order`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user_id: window.userId, order_id: orderId }) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    return true;
};
window.createSellOrder = async (amount, price) => {
    const res = await fetch(`${window.BACKEND_URL}/create-sell-order`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user_id: window.userId, amount, price }) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    return true;
};
window.executeTrade = async (orderId, amount) => {
    const res = await fetch(`${window.BACKEND_URL}/execute-trade`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user_id: window.userId, order_id: orderId, amount }) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    return true;
};
window.cancelAllOrders = async () => {
    const res = await fetch(`${window.BACKEND_URL}/cancel-all-orders`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user_id: window.userId }) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    return data.cancelled;
};
window.getPriceHistory = async () => {
    let start = new Date();
    if (currentTimeframe === '1d') start.setDate(start.getDate()-1);
    else if (currentTimeframe === '7d') start.setDate(start.getDate()-7);
    else start.setDate(start.getDate()-30);
    const { data } = await window.supabase.from('price_history').select('price,created_at').gte('created_at',start.toISOString()).order('created_at',{ascending:true}).limit(100);
    return data || [];
};
window.getRecentTrades = async (limit=10) => {
    const { data } = await window.supabase.from('trades').select('amount,price_per_share').order('created_at',{ascending:false}).limit(limit);
    return data || [];
};
window.getCurrentPrice = async () => {
    const { data } = await window.supabase.from('trades').select('amount,price_per_share').order('created_at',{ascending:false}).limit(50);
    if (!data || !data.length) return 100;
    let totalAmt=0,totalStars=0;
    for(let t of data){ totalAmt+=t.amount; totalStars+=t.amount*t.price_per_share; }
    return totalAmt>0 ? totalStars/totalAmt : 100;
};
window.getTotalMarketCap = async () => {
    const { data } = await window.supabase.from('users').select('shares');
    const totalSharesCents = data.reduce((s,u)=>s+u.shares,0);
    const price = await window.getCurrentPrice();
    return { totalShares: totalSharesCents, price, cap: (totalSharesCents/100)*(price/100) };
};
window.getSellerRating = async (sellerId) => {
    const { data } = await window.supabase.from('seller_ratings').select('rating').eq('seller_id', sellerId);
    if (!data || !data.length) return null;
    return data.reduce((s,r)=>s+r.rating,0)/data.length;
};
window.drawCanvasChart = (history) => {
    const cont = document.getElementById('chart-container');
    if (!cont) return;
    cont.innerHTML = '';
    if (!history.length) { cont.innerHTML = '<p style="padding:20px;text-align:center">Нет данных</p>'; return; }
    const canvas = document.createElement('canvas');
    const w = cont.clientWidth, h = 220;
    canvas.width = w; canvas.height = h;
    canvas.style.width = '100%'; canvas.style.height = 'auto';
    cont.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const vals = history.map(h => h.price/100);
    const max = Math.max(...vals), min = Math.min(...vals), range = max-min;
    const pad = { top:20, bottom:30, left:40, right:20 };
    const gw = w - pad.left - pad.right;
    const gh = h - pad.top - pad.bottom;
    const step = gw / (vals.length-1);
    ctx.fillStyle = '#0f1320';
    ctx.fillRect(0,0,w,h);
    ctx.beginPath(); ctx.strokeStyle = '#2b6e9e'; ctx.lineWidth = 2;
    for(let i=0;i<vals.length;i++) {
        const x = pad.left + i*step;
        let y = (range===0) ? pad.top+gh/2 : pad.top + gh - ((vals[i]-min)/range)*gh;
        if(i===0) ctx.moveTo(x,y);
        else ctx.lineTo(x,y);
    }
    ctx.stroke();
    ctx.fillStyle = '#eef2ff'; ctx.font='11px sans-serif';
    ctx.fillText(max.toFixed(2), pad.left-30, pad.top+10);
    ctx.fillText(min.toFixed(2), pad.left-30, h-pad.bottom-5);
    if(history.length) {
        const first = new Date(history[0].created_at).toLocaleDateString();
        const last = new Date(history[history.length-1].created_at).toLocaleDateString();
        ctx.fillText(first, pad.left, h-pad.bottom+15);
        ctx.fillText(last, w-pad.right-40, h-pad.bottom+15);
    }
};
window.renderTicker = (trades) => {
    const cont = document.getElementById('ticker');
    if (!cont) return;
    if (!trades.length) { cont.innerHTML = '<div class="ticker-content">Нет сделок</div>'; return; }
    cont.innerHTML = `<div class="ticker-content">${trades.map(t => `<span style="margin-right:24px">${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐</span>`).join('')}</div>`;
};
window.renderStocks = async () => {
    try {
        let orders = [];
        if (currentOrdersFilter === 'all') orders = await window.getActiveOrders();
        else orders = await window.getUserOrders();
        for (let o of orders) o.seller_rating = await window.getSellerRating(o.seller_id);
        if (currentSortDir === 'asc') orders.sort((a,b)=>a.price_per_share - b.price_per_share);
        else orders.sort((a,b)=>b.price_per_share - a.price_per_share);
        const hist = await window.getPriceHistory();
        const recent = await window.getRecentTrades(10);
        const { totalShares, price, cap } = await window.getTotalMarketCap();
        const html = `
            <div class="card"><div style="display:flex;justify-content:space-between"><div><p>📊 Акций: <strong>${window.fromCents(window.currentUser.shares)}</strong></p><p>⭐ Stars: <strong>${window.fromCents(window.currentUser.stars_balance)}</strong></p></div><div class="price">${(price/100).toFixed(2)} ⭐</div></div></div>
            <div class="card"><div class="info-panel"><div class="info-card"><div class="small-text">Рыночная капитализация</div><div class="price" style="font-size:20px">${Math.round(cap)} ⭐</div></div><div class="info-card"><div class="small-text">Всего акций</div><div class="price" style="font-size:20px">${(totalShares/100).toFixed(2)}</div></div></div>
            <div style="display:flex;gap:8px;margin-bottom:12px"><button class="timeframe-btn ${currentTimeframe==='1d'?'active':''}" data-tf="1d">1д</button><button class="timeframe-btn ${currentTimeframe==='7d'?'active':''}" data-tf="7d">7д</button><button class="timeframe-btn ${currentTimeframe==='30d'?'active':''}" data-tf="30d">30д</button><button id="refreshChart" style="margin-left:auto;width:auto;padding:6px 12px">🔄</button></div>
            <div id="chart-container" class="chart-container"></div><div id="ticker" class="ticker"></div></div>
            <div class="card"><h3>📈 Продать акции</h3><input type="number" id="sellAmount" step="0.01" min="1" placeholder="Количество (от 1)"><input type="number" id="sellPrice" step="0.01" min="1" placeholder="Цена (от 1 Star)"><button id="sellBtn">➕ Выставить</button></div>
            <div class="card"><div class="filter-bar"><button class="filter-btn ${currentOrdersFilter==='all'?'active':''}" data-filter="all">Все</button><button class="filter-btn ${currentOrdersFilter==='my'?'active':''}" data-filter="my">Мои</button><button class="sort-btn ${currentSortDir==='asc'?'active':''}" data-sort="asc">↑ Цена</button><button class="sort-btn ${currentSortDir==='desc'?'active':''}" data-sort="desc">↓ Цена</button><button id="cancelAllBtn" class="small" style="background:#f97316;margin-left:auto">❌ Отменить все</button></div>
            <h3>📋 Ордера на продажу</h3><div id="ordersList" class="orders-container"></div></div>
        `;
        document.getElementById('app').innerHTML = html;
        window.drawCanvasChart(hist);
        window.renderTicker(recent);
        document.querySelectorAll('.timeframe-btn').forEach(btn => btn.addEventListener('click', () => { currentTimeframe = btn.dataset.tf; window.renderStocks(); }));
        document.querySelectorAll('.filter-btn').forEach(btn => btn.addEventListener('click', () => { currentOrdersFilter = btn.dataset.filter; window.renderStocks(); }));
        document.querySelectorAll('.sort-btn').forEach(btn => btn.addEventListener('click', () => { currentSortDir = btn.dataset.sort; window.renderStocks(); }));
        document.getElementById('refreshChart')?.addEventListener('click', () => window.renderStocks());
        document.getElementById('cancelAllBtn')?.addEventListener('click', async () => {
            if (confirm('Отменить все ваши активные ордера?')) {
                const cnt = await window.cancelAllOrders();
                window.showToast(`Отменено ${cnt} ордеров`);
                await window.renderStocks();
            }
        });
        document.getElementById('sellBtn')?.addEventListener('click', async () => {
            let a = parseFloat(document.getElementById('sellAmount').value);
            let p = parseFloat(document.getElementById('sellPrice').value);
            if (isNaN(a) || isNaN(p) || a<1 || p<1) { window.showModal('Ошибка', 'Введите количество не менее 1 и цену не менее 1'); return; }
            try {
                await window.createSellOrder(a, p);
                window.showModal('Успех', 'Ордер создан');
                document.getElementById('sellAmount').value = '';
                document.getElementById('sellPrice').value = '';
                await window.refreshUser();
                await window.renderStocks();
            } catch(err) { window.showModal('Ошибка', err.message); }
        });
        const ordersDiv = document.getElementById('ordersList');
        if (!orders.length) ordersDiv.innerHTML = '<p>Нет ордеров</p>';
        else {
            orders.forEach(order => {
                const isOwn = order.seller_id === window.userId;
                const div = document.createElement('div'); div.className = 'order-row';
                div.innerHTML = `<div><span>${window.fromCents(order.amount)} шт.</span> <span class="small-text">по ${window.fromCents(order.price_per_share)} ⭐</span><br><span class="small-text">Продавец: ...${String(order.seller_id).slice(-4)}</span></div><div>${!isOwn ? `<button class="buy-btn" data-order='${JSON.stringify(order)}' style="width:auto;padding:6px 12px">Купить</button>` : `<button class="cancel-order" data-id="${order.id}" style="background:#f97316;width:auto;padding:6px 12px">Отменить</button>`}</div>`;
                ordersDiv.appendChild(div);
            });
            document.querySelectorAll('.buy-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const order = JSON.parse(btn.dataset.order);
                    const maxShares = window.fromCents(order.amount);
                    let buyAmt = prompt(`Введите количество (1-${maxShares}):`, maxShares);
                    if (!buyAmt) return;
                    buyAmt = parseFloat(buyAmt);
                    if (isNaN(buyAmt) || buyAmt<1 || buyAmt>maxShares) { window.showModal('Ошибка', 'Некорректное количество'); return; }
                    try {
                        await window.executeTrade(order.id, buyAmt);
                        window.showModal('Успех', 'Сделка завершена');
                        await window.refreshUser();
                        await window.renderStocks();
                    } catch(err) { window.showModal('Ошибка', err.message); }
                });
            });
            document.querySelectorAll('.cancel-order').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (confirm('Отменить ордер?')) {
                        try {
                            await window.cancelOrder(parseInt(btn.dataset.id));
                            window.showToast('Ордер отменён');
                            await window.renderStocks();
                        } catch(err) { window.showModal('Ошибка', err.message); }
                    }
                });
            });
        }
    } catch(e) { document.getElementById('app').innerHTML = `<div class="card error">${e.message}</div>`; }
};
