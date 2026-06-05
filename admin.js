// admin.js
window.renderAdmin = async () => {
    if (window.userId !== 6048486427) { document.getElementById('app').innerHTML = '<div class="card error">Доступ запрещён</div>'; return; }
    try {
        const stats = await fetch(`${window.BACKEND_URL}/admin/stats`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId }) }).then(r=>r.json());
        const usersData = await fetch(`${window.BACKEND_URL}/admin/users`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId }) }).then(r=>r.json());
        const orders = await window.getActiveOrders();
        let html = `<div class="card"><h2>👑 Админ-панель</h2><h3>Статистика</h3><p>Акций в обращении: ${stats.total_shares || 0}</p><p>Резерв: ${stats.reserve || 0}</p><hr><h3>Выдать акции/звёзды</h3><input type="number" id="targetUserId" placeholder="ID"><input type="number" id="giveShares" placeholder="Акции"><button id="giveSharesBtn">Выдать акции</button><input type="number" id="giveStars" placeholder="Stars"><button id="giveStarsBtn">Выдать Stars</button><hr><h3>Активные ордера</h3><div id="adminOrdersList"></div><hr><h3>Пользователи</h3><div id="usersList" style="max-height:300px; overflow-y:auto;"></div></div>`;
        document.getElementById('app').innerHTML = html;
        const ordersDiv = document.getElementById('adminOrdersList');
        ordersDiv.innerHTML = '';
        if (orders.length) orders.forEach(o => ordersDiv.innerHTML += `<div class="order-item"><div>${window.fromCents(o.amount)} шт. по ${window.fromCents(o.price_per_share)} ⭐ (продавец ${o.seller_id})</div><button class="cancel-btn" data-id="${o.id}">Отменить</button></div>`);
        document.querySelectorAll('.cancel-btn').forEach(btn => btn.addEventListener('click', async () => {
            const res = await fetch(`${window.BACKEND_URL}/admin/cancel-order`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId, order_id: btn.dataset.id }) });
            const data = await res.json();
            if(data.ok) { window.showModal('Успех','Ордер отменён'); window.renderAdmin(); } else window.showModal('Ошибка',data.error);
        }));
        if(usersData.users) document.getElementById('usersList').innerHTML = usersData.users.map(u => `<div>ID: ${u.id} | ${u.username||'Аноним'} | Акций: ${window.fromCents(u.shares)} | Stars: ${window.fromCents(u.stars_balance)}</div>`).join('');
        document.getElementById('giveSharesBtn').onclick = async () => {
            const target = parseInt(document.getElementById('targetUserId').value);
            const shares = parseInt(document.getElementById('giveShares').value);
            if(!target||!shares) { window.showModal('Ошибка','Заполните поля'); return; }
            const res = await fetch(`${window.BACKEND_URL}/admin/add-shares`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId, target_id: target, shares }) });
            const data = await res.json();
            if(data.ok) window.showModal('Успех','Акции выданы'); else window.showModal('Ошибка',data.error);
        };
        document.getElementById('giveStarsBtn').onclick = async () => {
            const target = parseInt(document.getElementById('targetUserId').value);
            const stars = parseInt(document.getElementById('giveStars').value);
            if(!target||!stars) { window.showModal('Ошибка','Заполните поля'); return; }
            const res = await fetch(`${window.BACKEND_URL}/admin/add-stars`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId, target_id: target, stars }) });
            const data = await res.json();
            if(data.ok) window.showModal('Успех','Stars выданы'); else window.showModal('Ошибка',data.error);
        };
    } catch(e) { document.getElementById('app').innerHTML = `<div class="card error">${e.message}</div>`; }
};
