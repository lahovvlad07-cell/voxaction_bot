// admin.js – обновлённая админка с эмиссией, управлением пользователями и ордерами

window.renderAdminTab = async function() {
    // Проверка прав
    if (window.userId !== 6048486427) {
        document.getElementById('app').innerHTML = '<div class="card error">Доступ запрещён</div>';
        return;
    }
    try {
        // Получаем статистику
        const stats = await fetch(`${window.BACKEND_URL}/admin/stats`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_id: window.userId })
        }).then(r => r.json());

        // Получаем список пользователей
        const usersData = await fetch(`${window.BACKEND_URL}/admin/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_id: window.userId })
        }).then(r => r.json());

        // Получаем активные ордера
        const orders = await window.getActiveOrders();

        // Получаем историю транзакций (последние 50)
        const { data: trades } = await window.supabase
            .from('trades')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        // HTML
        let html = `
            <div class="card admin-card">
                <h2>👑 Админ-панель</h2>
                
                <!-- Статистика -->
                <div class="admin-section">
                    <h3>📊 Статистика</h3>
                    <div class="admin-stats-grid">
                        <div class="admin-stat">
                            <span class="admin-stat-value">${stats.total_shares || 0}</span>
                            <span class="admin-stat-label">Акций в обращении</span>
                        </div>
                        <div class="admin-stat">
                            <span class="admin-stat-value">${stats.reserve || 0}</span>
                            <span class="admin-stat-label">Резерв</span>
                        </div>
                        <div class="admin-stat">
                            <span class="admin-stat-value">${stats.total_users || 0}</span>
                            <span class="admin-stat-label">Всего пользователей</span>
                        </div>
                        <div class="admin-stat">
                            <span class="admin-stat-value">${orders.length || 0}</span>
                            <span class="admin-stat-label">Активных ордеров</span>
                        </div>
                    </div>
                </div>

                <!-- Эмиссия акций -->
                <div class="admin-section">
                    <h3>🏦 Эмиссия акций</h3>
                    <div class="admin-form">
                        <input type="number" id="emitAmount" placeholder="Количество акций" min="1" step="1">
                        <input type="number" id="emitPrice" placeholder="Цена за 1 шт. (в Stars)" min="0.01" step="0.01">
                        <button id="emitBtn">💰 Выпустить акции</button>
                    </div>
                </div>

                <!-- Выдать акции/звёзды пользователю -->
                <div class="admin-section">
                    <h3>🎁 Выдать акции/звёзды</h3>
                    <div class="admin-form">
                        <input type="number" id="targetUserId" placeholder="ID пользователя">
                        <input type="number" id="giveShares" placeholder="Акции" min="1" step="1">
                        <button id="giveSharesBtn">Выдать акции</button>
                        <input type="number" id="giveStars" placeholder="Stars" min="1" step="1">
                        <button id="giveStarsBtn">Выдать Stars</button>
                    </div>
                </div>

                <!-- Список пользователей с поиском -->
                <div class="admin-section">
                    <h3>👥 Пользователи</h3>
                    <input type="text" id="userSearchInput" placeholder="Поиск по ID или имени..." class="admin-search">
                    <div id="usersList" class="admin-users-list"></div>
                </div>

                <!-- Активные ордера -->
                <div class="admin-section">
                    <h3>📋 Активные ордера</h3>
                    <div id="adminOrdersList" class="admin-orders-list"></div>
                </div>

                <!-- История транзакций -->
                <div class="admin-section">
                    <h3>📜 История транзакций (последние 50)</h3>
                    <div id="adminTradesList" class="admin-trades-list"></div>
                </div>
            </div>
        `;
        document.getElementById('app').innerHTML = html;

        // ---- Заполнение списка пользователей ----
        const usersList = document.getElementById('usersList');
        if (usersData.users) {
            renderUsers(usersData.users);
            // Поиск по пользователям
            document.getElementById('userSearchInput').addEventListener('input', function() {
                const term = this.value.toLowerCase();
                const filtered = usersData.users.filter(u => 
                    String(u.id).includes(term) || 
                    (u.username && u.username.toLowerCase().includes(term))
                );
                renderUsers(filtered);
            });
        }

        function renderUsers(users) {
            usersList.innerHTML = users.map(u => `
                <div class="admin-user-item">
                    <span class="admin-user-id">${u.id}</span>
                    <span class="admin-user-name">${u.username || 'Аноним'}</span>
                    <span class="admin-user-shares">${window.fromCents(u.shares)} акций</span>
                    <span class="admin-user-stars">${window.fromCents(u.stars_balance)} ⭐</span>
                </div>
            `).join('');
        }

        // ---- Заполнение ордеров ----
        const ordersDiv = document.getElementById('adminOrdersList');
        if (!orders.length) {
            ordersDiv.innerHTML = '<p class="empty-placeholder">Нет активных ордеров</p>';
        } else {
            ordersDiv.innerHTML = orders.map(order => `
                <div class="admin-order-item">
                    <span>${window.fromCents(order.amount)} шт. по ${window.fromCents(order.price_per_share)} ⭐ (продавец ${order.seller_id})</span>
                    <button class="cancel-order-btn" data-order-id="${order.id}">Отменить</button>
                </div>
            `).join('');
            document.querySelectorAll('.cancel-order-btn').forEach(btn => {
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
                    } else {
                        window.showCustomModal('Ошибка', data.error);
                    }
                });
            });
        }

        // ---- История транзакций ----
        const tradesDiv = document.getElementById('adminTradesList');
        if (trades && trades.length) {
            tradesDiv.innerHTML = trades.map(t => `
                <div class="admin-trade-item">
                    <span>${t.buyer_id} → ${t.seller_id}</span>
                    <span>${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐</span>
                    <span>${new Date(t.created_at).toLocaleString()}</span>
                </div>
            `).join('');
        } else {
            tradesDiv.innerHTML = '<p class="empty-placeholder">Нет транзакций</p>';
        }

        // ---- Обработчики кнопок ----
        document.getElementById('giveSharesBtn').onclick = async () => {
            const target = parseInt(document.getElementById('targetUserId').value);
            const shares = parseInt(document.getElementById('giveShares').value);
            if (!target || !shares) {
                window.showCustomModal('Ошибка', 'Заполните все поля');
                return;
            }
            const res = await fetch(`${window.BACKEND_URL}/admin/add-shares`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_id: window.userId, target_id: target, shares })
            });
            const data = await res.json();
            if (data.ok) {
                window.showCustomModal('Успех', 'Акции выданы');
                window.renderAdminTab();
            } else {
                window.showCustomModal('Ошибка', data.error);
            }
        };

        document.getElementById('giveStarsBtn').onclick = async () => {
            const target = parseInt(document.getElementById('targetUserId').value);
            const stars = parseInt(document.getElementById('giveStars').value);
            if (!target || !stars) {
                window.showCustomModal('Ошибка', 'Заполните все поля');
                return;
            }
            const res = await fetch(`${window.BACKEND_URL}/admin/add-stars`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_id: window.userId, target_id: target, stars })
            });
            const data = await res.json();
            if (data.ok) {
                window.showCustomModal('Успех', 'Stars выданы');
                window.renderAdminTab();
            } else {
                window.showCustomModal('Ошибка', data.error);
            }
        };

        document.getElementById('emitBtn').onclick = async () => {
            const amount = parseInt(document.getElementById('emitAmount').value);
            const price = parseFloat(document.getElementById('emitPrice').value);
            if (!amount || !price || amount <= 0 || price <= 0) {
                window.showCustomModal('Ошибка', 'Введите корректные количество и цену');
                return;
            }
            const res = await fetch(`${window.BACKEND_URL}/admin/emit-shares`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ admin_id: window.userId, amount, price })
            });
            const data = await res.json();
            if (data.ok) {
                window.showCustomModal('Успех', `Выпущено ${amount} акций по цене ${price} ⭐`);
                window.renderAdminTab();
            } else {
                window.showCustomModal('Ошибка', data.error);
            }
        };

    } catch(e) {
        document.getElementById('app').innerHTML = `<div class="card error">${e.message}</div>`;
    }
};
