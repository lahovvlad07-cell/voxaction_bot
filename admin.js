// admin.js – полная админ-панель

window.renderAdminTab = async function() {
    if (window.userId !== 6048486427) { 
        document.getElementById('app').innerHTML = '<div class="card error">Доступ запрещён</div>'; 
        return; 
    }

    try {
        const stats = await window.adminFetchStats();
        const usersData = await window.adminFetchUsers();
        const orders = await window.getActiveOrders();
        const newsList = await window.getNews();
        const adminsList = await window.getAdmins();
        const mmPrice = await window.getMarketMakerPrice();

        let html = `
            <div class="card">
                <h2>👑 Админ-панель</h2>
                <div class="admin-tabs">
                    <button class="admin-tab-btn active" data-tab="stats">📊 Статистика</button>
                    <button class="admin-tab-btn" data-tab="orders">📋 Ордера</button>
                    <button class="admin-tab-btn" data-tab="users">👥 Пользователи</button>
                    <button class="admin-tab-btn" data-tab="news">📰 Новости</button>
                    <button class="admin-tab-btn" data-tab="admins">👑 Админы</button>
                    <button class="admin-tab-btn" data-tab="settings">⚙️ Настройки</button>
                </div>
                <div id="admin-stats" class="admin-pane active">
                    <h3>Статистика</h3>
                    <p>Акций в обращении: ${stats.total_shares || 0}</p>
                    <p>Резерв: ${stats.reserve || 0}</p>
                    <hr>
                    <h3>Выдать акции/звёзды</h3>
                    <input type="number" id="targetUserId" placeholder="ID пользователя">
                    <input type="number" id="giveShares" placeholder="Кол-во акций (в штуках)">
                    <button id="giveSharesBtn">Выдать акции</button>
                    <input type="number" id="giveStars" placeholder="Кол-во Stars">
                    <button id="giveStarsBtn">Выдать Stars</button>
                </div>
                <div id="admin-orders" class="admin-pane" style="display:none;">
                    <h3>Активные ордера</h3>
                    <div id="adminOrdersList"></div>
                </div>
                <div id="admin-users" class="admin-pane" style="display:none;">
                    <h3>Пользователи</h3>
                    <div id="usersList" style="max-height:300px; overflow-y:auto;"></div>
                </div>
                <div id="admin-news" class="admin-pane" style="display:none;">
                    <h3>Управление новостями</h3>
                    <input type="text" id="newsTitle" placeholder="Заголовок">
                    <textarea id="newsContent" placeholder="Содержание новости" rows="4"></textarea>
                    <input type="text" id="newsImage" placeholder="Ссылка на картинку (опционально)">
                    <button id="createNewsBtn">➕ Создать новость</button>
                    <div id="newsListAdmin" style="margin-top:16px;"></div>
                </div>
                <div id="admin-admins" class="admin-pane" style="display:none;">
                    <h3>Управление администраторами</h3>
                    <input type="number" id="newAdminId" placeholder="ID нового админа">
                    <button id="addAdminBtn">➕ Добавить админа</button>
                    <div id="adminsList" style="margin-top:16px;"></div>
                </div>
                <div id="admin-settings" class="admin-pane" style="display:none;">
                    <h3>Настройки маркет-мейкера</h3>
                    <label>Цена выкупа 1 акции (в ⭐):</label>
                    <input type="number" id="mmPriceInput" value="${mmPrice}">
                    <button id="saveMmPriceBtn">Сохранить</button>
                </div>
            </div>
        `;
        document.getElementById('app').innerHTML = html;

        // Переключение вкладок админки
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                document.querySelectorAll('.admin-pane').forEach(p => p.style.display = 'none');
                document.getElementById('admin-' + this.dataset.tab).style.display = 'block';
            });
        });

        // Ордера
        const ordersDiv = document.getElementById('adminOrdersList');
        if (!orders.length) ordersDiv.innerHTML = '<p>Нет ордеров</p>';
        else orders.forEach(order => {
            const div = document.createElement('div');
            div.className = 'order-item';
            div.innerHTML = `
                <div>${window.fromCents(order.amount)} шт. по ${window.fromCents(order.price_per_share)} ⭐ (продавец ${order.seller_id})</div>
                <button class="cancel-btn" data-order-id="${order.id}">Отменить</button>
            `;
            ordersDiv.appendChild(div);
        });
        document.querySelectorAll('.cancel-btn').forEach(btn => btn.addEventListener('click', async () => {
            const res = await window.adminCancelOrder(btn.dataset.orderId);
            if(res.ok) { window.showCustomModal('Успех','Ордер отменён'); window.renderAdminTab(); }
            else window.showCustomModal('Ошибка',res.error);
        }));

        // Пользователи
        if(usersData.users) {
            document.getElementById('usersList').innerHTML = usersData.users.map(u => 
                `<div>ID: ${u.id} | ${u.username||'Аноним'} | Акций: ${window.fromCents(u.shares)} | Stars: ${window.fromCents(u.stars_balance)}</div>`
            ).join('');
        }

        // Выдать акции/звёзды
        document.getElementById('giveSharesBtn').onclick = async () => {
            const target = parseInt(document.getElementById('targetUserId').value);
            const shares = parseInt(document.getElementById('giveShares').value);
            if(!target||!shares) { window.showCustomModal('Ошибка','Заполните поля'); return; }
            const res = await window.adminAddShares(target, shares);
            if(res.ok) window.showCustomModal('Успех','Акции выданы');
            else window.showCustomModal('Ошибка',res.error);
        };
        document.getElementById('giveStarsBtn').onclick = async () => {
            const target = parseInt(document.getElementById('targetUserId').value);
            const stars = parseInt(document.getElementById('giveStars').value);
            if(!target||!stars) { window.showCustomModal('Ошибка','Заполните поля'); return; }
            const res = await window.adminAddStars(target, stars);
            if(res.ok) window.showCustomModal('Успех','Stars выданы');
            else window.showCustomModal('Ошибка',res.error);
        };

        // Новости
        async function loadNewsAdmin() {
            const list = await window.getNews();
            const container = document.getElementById('newsListAdmin');
            if (!list.length) {
                container.innerHTML = '<p>Нет новостей</p>';
                return;
            }
            container.innerHTML = list.map(n => `
                <div style="background:rgba(0,0,0,0.3); border-radius:16px; padding:12px; margin-bottom:12px;">
                    <div style="font-weight:700;">${n.title}</div>
                    <div style="font-size:13px; color:#9ca3af;">${n.content.substring(0,100)}...</div>
                    <button class="delete-news-btn" data-id="${n.id}" style="margin-top:8px; background:rgba(255,0,0,0.2); border:1px solid #ff4444; color:#ff6b6b;">Удалить</button>
                </div>
            `).join('');
            document.querySelectorAll('.delete-news-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Удалить новость?')) return;
                    await window.deleteNews(parseInt(btn.dataset.id));
                    window.showToast('Новость удалена');
                    loadNewsAdmin();
                });
            });
        }
        loadNewsAdmin();

        document.getElementById('createNewsBtn').onclick = async () => {
            const title = document.getElementById('newsTitle').value.trim();
            const content = document.getElementById('newsContent').value.trim();
            const image = document.getElementById('newsImage').value.trim();
            if (!title || !content) {
                window.showCustomModal('Ошибка', 'Заполните заголовок и содержание');
                return;
            }
            try {
                await window.createNews(title, content, image || null);
                window.showToast('Новость создана!');
                document.getElementById('newsTitle').value = '';
                document.getElementById('newsContent').value = '';
                document.getElementById('newsImage').value = '';
                loadNewsAdmin();
            } catch(e) {
                window.showCustomModal('Ошибка', e.message);
            }
        };

        // Админы
        async function loadAdmins() {
            const list = await window.getAdmins();
            const container = document.getElementById('adminsList');
            if (!list.length) {
                container.innerHTML = '<p>Нет администраторов</p>';
                return;
            }
            container.innerHTML = list.map(a => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); border-radius:16px; padding:12px; margin-bottom:8px;">
                    <span>ID: ${a.user_id} (добавлен ${new Date(a.added_at).toLocaleDateString()})</span>
                    ${a.user_id !== 6048486427 ? `<button class="remove-admin-btn" data-id="${a.user_id}" style="background:rgba(255,0,0,0.2); border:1px solid #ff4444; color:#ff6b6b; padding:4px 12px; border-radius:20px;">Удалить</button>` : '<span style="color:#fbbf24;">👑 Владелец</span>'}
                </div>
            `).join('');
            document.querySelectorAll('.remove-admin-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Удалить админа?')) return;
                    await window.removeAdmin(parseInt(btn.dataset.id));
                    window.showToast('Админ удалён');
                    loadAdmins();
                });
            });
        }
        loadAdmins();

        document.getElementById('addAdminBtn').onclick = async () => {
            const id = parseInt(document.getElementById('newAdminId').value);
            if (!id) { window.showCustomModal('Ошибка', 'Введите ID'); return; }
            try {
                await window.addAdmin(id);
                window.showToast('Админ добавлен');
                document.getElementById('newAdminId').value = '';
                loadAdmins();
            } catch(e) {
                window.showCustomModal('Ошибка', e.message);
            }
        };

        // Настройки маркет-мейкера
        document.getElementById('saveMmPriceBtn').onclick = async () => {
            const price = parseFloat(document.getElementById('mmPriceInput').value);
            if (!price || price < 1) {
                window.showCustomModal('Ошибка', 'Введите цену >= 1');
                return;
            }
            try {
                await window.setSetting('market_maker_price', String(price));
                window.showToast('Цена сохранена');
            } catch(e) {
                window.showCustomModal('Ошибка', e.message);
            }
        };

    } catch(e) {
        document.getElementById('app').innerHTML = `<div class="card error">${e.message}</div>`;
    }
};
