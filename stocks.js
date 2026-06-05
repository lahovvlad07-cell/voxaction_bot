// stocks.js
let sellAmt='', sellPrice='', buyAmt='', buyPrice='';
let filterSell='all', filterBuy='all', sortSell='asc', sortBuy='desc', timeframe='30d';

async function getOrderbook() {
    const res = await fetch(`${window.BACKEND_URL}/get-orderbook`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user_id: window.userId }) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    return data;
}
async function createSell(amount, price) {
    const res = await fetch(`${window.BACKEND_URL}/create-sell-order`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user_id: window.userId, amount, price }) });
    return await res.json();
}
async function createBuy(amount, price) {
    const res = await fetch(`${window.BACKEND_URL}/create-buy-order`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user_id: window.userId, amount, price }) });
    return await res.json();
}
async function cancelOrd(orderId) {
    const res = await fetch(`${window.BACKEND_URL}/cancel-order`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user_id: window.userId, order_id: orderId }) });
    return await res.json();
}
async function cancelAll() {
    const res = await fetch(`${window.BACKEND_URL}/cancel-all-orders`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user_id: window.userId }) });
    return await res.json();
}
async function getCurrentPrice() {
    const { data } = await window.supabase.from('trades').select('amount,price_per_share').order('created_at',{ascending:false}).limit(50);
    if (!data || !data.length) return 100;
    let totalAmt=0,totalStars=0;
    for(let t of data){ totalAmt+=t.amount; totalStars+=t.amount*t.price_per_share; }
    return totalAmt>0 ? totalStars/totalAmt : 100;
}
async function getMarketCap() {
    const { data } = await window.supabase.from('users').select('shares');
    const totalShares = data.reduce((s,u)=>s+u.shares,0);
    const price = await getCurrentPrice();
    return { totalShares, price, cap: (totalShares/100)*(price/100) };
}
async function getPriceHistory() {
    let start = new Date();
    if (timeframe==='1d') start.setDate(start.getDate()-1);
    else if (timeframe==='7d') start.setDate(start.getDate()-7);
    else start.setDate(start.getDate()-30);
    const { data } = await window.supabase.from('price_history').select('price,created_at').gte('created_at',start.toISOString()).order('created_at',{ascending:true}).limit(100);
    return data || [];
}
function drawChart(hist) {
    const cont = document.getElementById('chart-container');
    if (!cont) return;
    cont.innerHTML = '';
    if (!hist.length) { cont.innerHTML = '<p style="padding:20px;text-align:center">Нет данных</p>'; return; }
    const canvas = document.createElement('canvas');
    const w = cont.clientWidth, h = 220;
    canvas.width = w; canvas.height = h;
    canvas.style.width = '100%'; canvas.style.height = 'auto';
    cont.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const vals = hist.map(h => h.price/100);
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
    const firstDate = new Date(hist[0].created_at).toLocaleDateString();
    const lastDate = new Date(hist[hist.length-1].created_at).toLocaleDateString();
    ctx.fillText(firstDate, pad.left, h-pad.bottom+15);
    ctx.fillText(lastDate, w-pad.right-40, h-pad.bottom+15);
}
function renderTicker(trades) {
    const cont = document.getElementById('ticker');
    if (!cont) return;
    if (!trades.length) { cont.innerHTML = '<div class="ticker-content">Нет сделок</div>'; return; }
    cont.innerHTML = `<div class="ticker-content">${trades.map(t => `<span style="margin-right:24px">${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐</span>`).join('')}</div>`;
}

async function renderStocks() {
    try {
        const ob = await getOrderbook();
        let sell = ob.sell || [], buy = ob.buy || [];
        if (filterSell === 'my') sell = sell.filter(o => o.seller_id === window.userId);
        if (filterBuy === 'my') buy = buy.filter(o => o.buyer_id === window.userId);
        if (sortSell === 'asc') sell.sort((a,b)=>a.price_per_share - b.price_per_share);
        else sell.sort((a,b)=>b.price_per_share - a.price_per_share);
        if (sortBuy === 'asc') buy.sort((a,b)=>a.price_per_share - b.price_per_share);
        else buy.sort((a,b)=>b.price_per_share - a.price_per_share);
        const bestAsk = sell.length ? sell[0].price_per_share/100 : null;
        const bestBid = buy.length ? buy[0].price_per_share/100 : null;
        const hist = await getPriceHistory();
        const recent = await (await window.supabase.from('trades').select('amount,price_per_share').order('created_at',{ascending:false}).limit(10)).data || [];
        const { totalShares, price, cap } = await getMarketCap();
        const html = `
            <div class="card"><div style="display:flex;justify-content:space-between"><div><p>📊 Акций: <strong>${window.fromCents(window.currentUser.shares)}</strong></p><p>⭐ Stars: <strong>${window.fromCents(window.currentUser.stars_balance)}</strong></p></div><div class="price">${(price/100).toFixed(2)} ⭐</div></div></div>
            <div class="card"><div class="info-panel"><div class="info-card"><div class="small-text">Рыночная капитализация</div><div class="price" style="font-size:20px">${Math.round(cap)} ⭐</div></div><div class="info-card"><div class="small-text">Всего акций</div><div class="price" style="font-size:20px">${(totalShares/100).toFixed(2)}</div></div></div>
            <div class="best-price"><span>📈 Лучшая цена продажи: ${bestAsk!==null?bestAsk.toFixed(2):'—'} ⭐</span><span>📉 Лучшая цена покупки: ${bestBid!==null?bestBid.toFixed(2):'—'} ⭐</span></div>
            <div style="display:flex;gap:8px;margin-bottom:12px"><button class="timeframe-btn ${timeframe==='1d'?'active':''}" data-tf="1d">1д</button><button class="timeframe-btn ${timeframe==='7d'?'active':''}" data-tf="7d">7д</button><button class="timeframe-btn ${timeframe==='30d'?'active':''}" data-tf="30d">30д</button><button id="refreshChart" style="margin-left:auto;width:auto;padding:6px 12px">🔄</button></div>
            <div id="chart-container" class="chart-container"></div><div id="ticker" class="ticker"></div></div>
            <div class="card"><h3>📈 Продать акции</h3><input type="number" id="sellAmount" step="0.01" min="1" placeholder="Количество (от 1)" value="${sellAmt}"><input type="number" id="sellPriceInput" step="0.01" min="1" placeholder="Цена (от 1 Star)" value="${sellPrice}"><button id="sellBtn">➕ Выставить ордер на продажу</button></div>
            <div class="card"><h3>📉 Купить акции</h3><input type="number" id="buyAmount" step="0.01" min="1" placeholder="Количество (от 1)" value="${buyAmt}"><input type="number" id="buyPriceInput" step="0.01" min="1" placeholder="Цена (от 1 Star)" value="${buyPrice}"><button id="buyBtn">➕ Выставить ордер на покупку</button></div>
            <div class="card"><div class="filter-bar"><span style="font-weight:bold">Продажа</span><button class="filter-btn ${filterSell==='all'?'active':''}" data-filter-sell="all">Все</button><button class="filter-btn ${filterSell==='my'?'active':''}" data-filter-sell="my">Мои</button><button class="sort-btn ${sortSell==='asc'?'active':''}" data-sort-sell="asc">↑ Цена</button><button class="sort-btn ${sortSell==='desc'?'active':''}" data-sort-sell="desc">↓ Цена</button></div>
            <div id="ordersSell" class="orders-container"></div>
            <div class="filter-bar" style="margin-top:16px"><span style="font-weight:bold">Покупка</span><button class="filter-btn ${filterBuy==='all'?'active':''}" data-filter-buy="all">Все</button><button class="filter-btn ${filterBuy==='my'?'active':''}" data-filter-buy="my">Мои</button><button class="sort-btn ${sortBuy==='asc'?'active':''}" data-sort-buy="asc">↑ Цена</button><button class="sort-btn ${sortBuy==='desc'?'active':''}" data-sort-buy="desc">↓ Цена</button></div>
            <div id="ordersBuy" class="orders-container"></div>
            <div class="filter-bar" style="margin-top:16px"><button id="cancelAllBtn" class="small" style="background:#f97316">❌ Отменить все мои ордера</button><button id="myTradesBtn" class="small">📜 Мои сделки</button></div></div>
        `;
        document.getElementById('app').innerHTML = html;
        drawChart(hist);
        renderTicker(recent);
        document.getElementById('sellAmount').value = sellAmt;
        document.getElementById('sellPriceInput').value = sellPrice;
        document.getElementById('buyAmount').value = buyAmt;
        document.getElementById('buyPriceInput').value = buyPrice;
        ['sellAmount','sellPriceInput','buyAmount','buyPriceInput'].forEach(id => {
            document.getElementById(id).addEventListener('input', e => {
                if(id==='sellAmount') sellAmt = e.target.value;
                if(id==='sellPriceInput') sellPrice = e.target.value;
                if(id==='buyAmount') buyAmt = e.target.value;
                if(id==='buyPriceInput') buyPrice = e.target.value;
            });
        });
        document.querySelectorAll('[data-filter-sell]').forEach(btn => btn.addEventListener('click', () => { filterSell = btn.dataset.filterSell; renderStocks(); }));
        document.querySelectorAll('[data-filter-buy]').forEach(btn => btn.addEventListener('click', () => { filterBuy = btn.dataset.filterBuy; renderStocks(); }));
        document.querySelectorAll('[data-sort-sell]').forEach(btn => btn.addEventListener('click', () => { sortSell = btn.dataset.sortSell; renderStocks(); }));
        document.querySelectorAll('[data-sort-buy]').forEach(btn => btn.addEventListener('click', () => { sortBuy = btn.dataset.sortBuy; renderStocks(); }));
        document.querySelectorAll('.timeframe-btn').forEach(btn => btn.addEventListener('click', () => { timeframe = btn.dataset.tf; renderStocks(); }));
        document.getElementById('refreshChart')?.addEventListener('click', () => renderStocks());
        document.getElementById('cancelAllBtn')?.addEventListener('click', async () => {
            if (confirm('Отменить все ваши активные ордера?')) {
                const res = await cancelAll();
                if (res.ok) window.toast(`Отменено ${res.cancelled} ордеров`);
                else window.showModal('Ошибка', res.error);
                await renderStocks();
            }
        });
        document.getElementById('myTradesBtn')?.addEventListener('click', async () => {
            const { data } = await window.supabase.from('trades').select('*').or(`seller_id.eq.${window.userId},buyer_id.eq.${window.userId}`).order('created_at',{ascending:false}).limit(100);
            if (!data || !data.length) { window.showModal('История сделок', 'У вас пока нет сделок'); return; }
            const list = data.map(t => `<div class="trade-item-row"><span><strong>${t.buyer_id===window.userId?'Покупка':'Продажа'}</strong> ${window.fromCents(t.amount)} шт.</span><span>по ${window.fromCents(t.price_per_share)} ⭐</span><span>${window.fromCents(t.total_stars)} ⭐</span><span class="small-text">${new Date(t.created_at).toLocaleString()}</span></div>`).join('');
            window.showModal('📜 Мои сделки', `<div class="trades-list">${list}</div>`);
        });
        document.getElementById('sellBtn')?.addEventListener('click', async () => {
            let a = parseFloat(document.getElementById('sellAmount').value);
            let p = parseFloat(document.getElementById('sellPriceInput').value);
            if (isNaN(a) || isNaN(p) || a<1 || p<1) { window.showModal('Ошибка', 'Введите количество не менее 1 и цену не менее 1'); return; }
            const res = await createSell(a, p);
            if (res.ok) {
                window.showModal('Успех', res.executed ? `Продано ${window.fromCents(res.executed)} акций мгновенно. Остаток ${window.fromCents(res.remaining)} выставлен.` : 'Ордер выставлен');
                sellAmt = ''; sellPrice = '';
                await window.refreshUser(); await renderStocks();
            } else window.showModal('Ошибка', res.error);
        });
        document.getElementById('buyBtn')?.addEventListener('click', async () => {
            let a = parseFloat(document.getElementById('buyAmount').value);
            let p = parseFloat(document.getElementById('buyPriceInput').value);
            if (isNaN(a) || isNaN(p) || a<1 || p<1) { window.showModal('Ошибка', 'Введите количество не менее 1 и цену не менее 1'); return; }
            const res = await createBuy(a, p);
            if (res.ok) {
                window.showModal('Успех', res.executed ? `Куплено ${window.fromCents(res.executed)} акций мгновенно. Остаток ${window.fromCents(res.remaining)} выставлен.` : 'Ордер выставлен');
                buyAmt = ''; buyPrice = '';
                await window.refreshUser(); await renderStocks();
            } else window.showModal('Ошибка', res.error);
        });
        const sellDiv = document.getElementById('ordersSell');
        sellDiv.innerHTML = '';
        if (!sell.length) sellDiv.innerHTML = '<p>Нет ордеров на продажу</p>';
        else sell.forEach(o => {
            const own = o.seller_id === window.userId;
            sellDiv.innerHTML += `<div class="order-row"><div><span>${window.fromCents(o.amount)} шт.</span> <span class="small-text">по ${window.fromCents(o.price_per_share)} ⭐</span><br><span class="small-text">Продавец: ...${String(o.seller_id).slice(-4)}</span></div>${own ? `<button class="cancel-order small" data-id="${o.id}">Отменить</button>` : ''}</div>`;
        });
        const buyDiv = document.getElementById('ordersBuy');
        buyDiv.innerHTML = '';
        if (!buy.length) buyDiv.innerHTML = '<p>Нет ордеров на покупку</p>';
        else buy.forEach(o => {
            const own = o.buyer_id === window.userId;
            buyDiv.innerHTML += `<div class="order-row"><div><span>${window.fromCents(o.amount)} шт.</span> <span class="small-text">по ${window.fromCents(o.price_per_share)} ⭐</span><br><span class="small-text">Покупатель: ...${String(o.buyer_id).slice(-4)}</span></div>${own ? `<button class="cancel-order small" data-id="${o.id}">Отменить</button>` : ''}</div>`;
        });
        document.querySelectorAll('.cancel-order').forEach(btn => btn.addEventListener('click', async () => {
            const id = parseInt(btn.dataset.id);
            if (confirm('Отменить ордер?')) {
                const res = await cancelOrd(id);
                if (res.ok) { window.toast('Ордер отменён'); await renderStocks(); }
                else window.showModal('Ошибка', res.error);
            }
        }));
    } catch(e) { document.getElementById('app').innerHTML = `<div class="card error">${e.message}</div>`; }
}

window.renderStocks = renderStocks;
