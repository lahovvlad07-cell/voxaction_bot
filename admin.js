// admin.js – расширенная админ-панель (статистика, управление админами, маркет-мейкер)

window.renderAdminTab = async function() {
    if (window.userId !== 6048486427) {
        document.getElementById('app').innerHTML = '<div class="card error">Доступ запрещён</div>';
        return;
    }

    try {
        // Загружаем данные
        const stats = await window.adminFetchStats();
        const usersData = await window.adminFetchUsers();
        const orders = await window.getActiveOrders();
        const admins = await getAdminsList();
        const marketMakerPrice = await getMarketMakerPrice();

        let html = `
            <div class="admin-container">
                <div class="card admin-card">
                    <h2>👑 Админ-панель</h2>
                    
                    <div class="admin-stats-grid">
                        <div class="admin-stat">
                            <div class="admin-stat-value">${stats.total_shares || 0}</div>
                            <div class="admin-stat-label">Акций в обращении</div>
                        </div>
                        <div class="admin-stat">
                            <div class="admin-stat-value">${stats.reserve || 0}</div>
                            <div class="admin-stat-label">Резерв</div>
                        </div>
                        <div class="admin-stat">
                            <div class="admin-stat-value">${usersData.users?.length || 0}</div>
                            <div class="admin-stat-label">Всего пользователей</div>
                        </div>
                        <div class="admin-stat">
                            <div class="admin-stat-value">${admins.length}</div>
                            <div class="admin-stat-label">Администраторов</div>
                        </div>
                    </div>
                    
                    <hr>
                    
                    <div class="admin-section">
                        <h3>📊 Управление акциями</h3>
                        <div class="admin-form-row">
                            <input type="number" id="targetUserId" placeholder="ID пользователя">
                            <input type="number" id="giveShares" placeholder="Количество акций">
                            <button id="giveSharesBtn" class="admin-btn primary">Выдать акции</button>
                        </div>
                        <div class="admin-form-row">
                            <input type="number" id="giveStars" placeholder="Количество Stars">
                            <button id="giveStarsBtn" class="admin-btn primary">Выдать Stars</button>
                        </div>
                    </div>
                    
                    <hr>
                    
                    <div class="admin-section">
                        <h3>🔄 Маркет-мейкер</h3>
                        <div class="admin-form-row">
                            <input type="number" id="marketMakerPrice" placeholder="Цена покупки (⭐)" value="${marketMakerPrice || 1}">
                            <button id="setMarketMakerBtn" class="admin-btn secondary">Установить цену</button>
                        </div>
                        <p class="admin-hint">Маркет-мейкер будет покупать акции у пользователей по указанной цене (в Stars).</p>
                    </div>
                    
                    <hr>
                    
                    <div class="admin-section">
                        <h3>👥 Управление администраторами</h3>
                        <div class="admin-form-row">
                            <input type="number" id="newAdminId" placeholder="ID пользователя">
                            <button id="addAdminBtn" class="admin-btn primary">➕ Добавить админа</button>
                            <button id="removeAdminBtn" class="admin-btn danger">➖ Убрать админа</button>
                        </div>
                        <div class="admin-list">
                            <h4>Текущие администраторы:</h4>
                            ${admins.length ? admins.map(a => `<div class="admin-item">${a.user_id}${a.user_id === 6048486427 ? ' (владелец)' : ''}</div>`).join('') : '<div class="admin-item">Нет администраторов</div>'}
                        </div>
                    </div>
                    
                    <hr>
                    
                    <div class="admin-section">
                        <h3>📋 Активные ордера</h3>
                        <div id="adminOrdersList"></div>
                    </div>
                    
                    <hr>
                    
                    <div class="admin-section">
                        <h3>👤 Пользователи</h3>
                        <div id="usersList" style="max-height:300px; overflow-y:auto;"></div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('app').innerHTML = html;

        // === Рендер ордеров ===
        const ordersDiv = document.getElementById('adminOrdersList');
        if (!orders.length) ordersDiv.innerHTML = '<p>Нет ордеров</p>';
        else {
            orders.forEach(order => {
                const div = document.createElement('div');
                div.className = 'order-item';
                div.innerHTML = `
                    <div>${window.fromCents(order.amount)} шт. по ${window.fromCents(order.price_per_share)} ⭐ (продавец ${order.seller_id})</div>
                    <button class="cancel-btn admin-btn danger" data-order-id="${order.id}">Отменить</button>
                `;
                ordersDiv.appendChild(div);
            });
        }
        document.querySelectorAll('.cancel-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const res = await fetch(`${window.BACKEND_URL}/admin/cancel-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ admin_id: window.userId, order_id: btn.dataset.orderId })
                });
                const data = await res.json();
                if (data.ok) {
                    window.showCustomModal('Успех', 'Ордер отменён');
                    window.renderAdminTab();
                } else window.showCustomModal('Ошибка', data.error);
            });
        });

        // === Рендер пользователей ===
        if (usersData.users) {
            document.getElementById('usersList').innerHTML = usersData.users.map(u =>
                `<div class="user-item">ID: ${u.id} | ${u.username || 'Аноним'} | Акций: ${window.fromCents(u.shares)} | Stars: ${window.fromCents(u.stars_balance)}</div>`
            ).join('');
        }

        // === Обработчики ===
        document.getElementById('giveSharesBtn').onclick = async () => {
            const target = parseInt(document.getElementById('targetUserId').value);
            const shares = parseInt(document.getElementById('giveShares').value);
            if (!target || !shares) { window.showCustomModal('Ошибка', 'Заполните поля'); return; }
            const res = await fetch(`${window.BACKEND_URL}/admin/add-shares`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_id: window.userId, target_id: target, shares })
            });
            const data = await res.json();
            if (data.ok) window.showCustomModal('Успех', 'Акции выданы');
            else window.showCustomModal('Ошибка', data.error);
        };

        document.getElementById('giveStarsBtn').onclick = async () => {
            const target = parseInt(document.getElementById('targetUserId').value);
            const stars = parseInt(document.getElementById('giveStars').value);
            if (!target || !stars) { window.showCustomModal('Ошибка', 'Заполните поля'); return; }
            const res = await fetch(`${window.BACKEND_URL}/admin/add-stars`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_id: window.userId, target_id: target, stars })
            });
            const data = await res.json();
            if (data.ok) window.showCustomModal('Успех', 'Stars выданы');
            else window.showCustomModal('Ошибка', data.error);
        };

        // === Управление админами ===
        document.getElementById('addAdminBtn').onclick = async () => {
            const newAdmin = parseInt(document.getElementById('newAdminId').value);
            if (!newAdmin) { window.showCustomModal('Ошибка', 'Введите ID пользователя'); return; }
            const res = await fetch(`${window.BACKEND_URL}/admin/add-admin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_id: window.userId, new_admin_id: newAdmin })
            });
            const data = await res.json();
            if (data.ok) { window.showCustomModal('Успех', 'Администратор добавлен'); window.renderAdminTab(); }
            else window.showCustomModal('Ошибка', data.error);
        };

        document.getElementById('removeAdminBtn').onclick = async () => {
            const adminToRemove = parseInt(document.getElementById('newAdminId').value);
            if (!adminToRemove) { window.showCustomModal('Ошибка', 'Введите ID пользователя'); return; }
            if (adminToRemove === 6048486427) { window.showCustomModal('Ошибка', 'Нельзя удалить владельца'); return; }
            const res = await fetch(`${window.BACKEND_URL}/admin/remove-admin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_id: window.userId, remove_admin_id: adminToRemove })
            });
            const data = await res.json();
            if (data.ok) { window.showCustomModal('Успех', 'Администратор удалён'); window.renderAdminTab(); }
            else window.showCustomModal('Ошибка', data.error);
        };

        // === Маркет-мейкер ===
        document.getElementById('setMarketMakerBtn').onclick = async () => {
            const price = parseFloat(document.getElementById('marketMakerPrice').value);
            if (!price || price < 1) { window.showCustomModal('Ошибка', 'Введите корректную цену (минимум 1)'); return; }
            const res = await fetch(`${window.BACKEND_URL}/admin/set-market-maker`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_id: window.userId, price })
            });
            const data = await res.json();
            if (data.ok) { window.showCustomModal('Успех', 'Цена маркет-мейкера установлена'); window.renderAdminTab(); }
            else window.showCustomModal('Ошибка', data.error);
        };

    } catch (e) {
        document.getElementById('app').innerHTML = `<div class="card error">${e.message}</div>`;
    }
};

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
async function getAdminsList() {
    try {
        const { data, error } = await window.supabase.from('admins').select('user_id');
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Ошибка загрузки админов', e);
        return [];
    }
}

async function getMarketMakerPrice() {
    try {
        const { data, error } = await window.supabase
            .from('settings')
            .select('value')
            .eq('key', 'market_maker_price')
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data ? parseFloat(data.value) : null;
    } catch (e) {
        console.error('Ошибка загрузки цены маркет-мейкера', e);
        return null;
    }
}
