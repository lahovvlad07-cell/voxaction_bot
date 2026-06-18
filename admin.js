// admin.js – полностью переработанная админ-панель (без бекенда, с модалками)

const OWNER_ID = 6048486427;

window.renderAdminTab = async function() {
    if (window.userId !== OWNER_ID) {
        document.getElementById('app').innerHTML = '<div class="card error">Доступ запрещён</div>';
        return;
    }

    try {
        // Инициализируем маркет-мейкера
        await window.initMarketMaker();

        // Загружаем все данные напрямую из Supabase
        const users = await window.adminGetAllUsers();
        const orders = await window.getActiveOrders();
        const newsList = await window.getNews();
        const adminsList = await window.getAdmins();
        const achievements = await window.getAllAchievements();
        const mmBalance = await window.getMarketMakerBalance();

        let html = `
            <div class="admin-container">
                <div class="admin-header">
                    <h2>👑 Админ-панель v2.0</h2>
                    <div class="admin-user-info">Владелец: ${window.currentUser?.username || window.userId}</div>
                </div>
                <div class="admin-nav">
                    <button class="admin-nav-btn active" data-tab="dashboard">📊 Главная</button>
                    <button class="admin-nav-btn" data-tab="users">👥 Пользователи</button>
                    <button class="admin-nav-btn" data-tab="orders">📋 Ордера</button>
                    <button class="admin-nav-btn" data-tab="news">📰 Новости</button>
                    <button class="admin-nav-btn" data-tab="admins">👑 Админы</button>
                    <button class="admin-nav-btn" data-tab="achievements">🏆 Достижения</button>
                    <button class="admin-nav-btn" data-tab="mm">🤖 Маркет-мейкер</button>
                    <button class="admin-nav-btn" data-tab="settings">⚙️ Настройки</button>
                </div>

                <!-- Главная -->
                <div id="admin-dashboard" class="admin-pane active">
                    <div class="stats-grid">
                        <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">${users.reduce((s,u) => s + u.shares, 0) / 100}</div><div class="stat-label">Акций в обращении</div></div>
                        <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-value">${users.length}</div><div class="stat-label">Пользователей</div></div>
                        <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-value">${orders.length}</div><div class="stat-label">Активных ордеров</div></div>
                        <div class="stat-card"><div class="stat-icon">🤖</div><div class="stat-value">${mmBalance.shares.toFixed(2)} / ${mmBalance.stars.toFixed(2)}</div><div class="stat-label">Маркет-мейкер (акции / звёзды)</div></div>
                    </div>
                    <div class="quick-actions">
                        <h3>⚡ Быстрые действия</h3>
                        <div class="quick-grid">
                            <button class="quick-btn" id="quickAddShares">➕ Выдать акции</button>
                            <button class="quick-btn" id="quickAddStars">⭐ Выдать Stars</button>
                            <button class="quick-btn" id="quickCreateNews">📰 Создать новость</button>
                            <button class="quick-btn" id="quickBroadcast">📢 Рассылка</button>
                            <button class="quick-btn" id="quickRunMM">🤖 Запустить маркет-мейкера</button>
                        </div>
                    </div>
                </div>

                <!-- Пользователи -->
                <div id="admin-users" class="admin-pane" style="display:none;">
                    <h3>👥 Управление пользователями</h3>
                    <div class="user-search">
                        <input type="text" id="userSearchInput" placeholder="Поиск по ID или имени..." style="margin-bottom:12px;">
                    </div>
                    <div id="usersList" style="max-height:400px; overflow-y:auto;"></div>
                </div>

                <!-- Ордера -->
                <div id="admin-orders" class="admin-pane" style="display:none;">
                    <h3>📋 Управление ордерами</h3>
                    <div id="adminOrdersList"></div>
                </div>

                <!-- Новости -->
                <div id="admin-news" class="admin-pane" style="display:none;">
                    <h3>📰 Управление новостями</h3>
                    <div id="newsListAdmin" style="margin-top:16px;"></div>
                </div>

                <!-- Админы -->
                <div id="admin-admins" class="admin-pane" style="display:none;">
                    <h3>👑 Управление администраторами</h3>
                    <input type="number" id="newAdminId" placeholder="ID нового админа" style="margin-bottom:8px;">
                    <button id="addAdminBtn" style="background:linear-gradient(135deg,#2b6e9e,#1a4c6e);">➕ Добавить админа</button>
                    <div id="adminsList" style="margin-top:16px;"></div>
                </div>

                <!-- Достижения -->
                <div id="admin-achievements" class="admin-pane" style="display:none;">
                    <h3>🏆 Управление достижениями</h3>
                    <div style="margin-bottom:16px;">
                        <input type="text" id="achName" placeholder="Название (с эмодзи)" style="margin-bottom:8px;">
                        <input type="text" id="achDesc" placeholder="Описание" style="margin-bottom:8px;">
                        <input type="text" id="achIcon" placeholder="Иконка (эмодзи)" style="margin-bottom:8px;">
                        <select id="achCondition" style="width:100%; padding:12px; background:#0a0f1a; border:1px solid rgba(0,255,255,0.3); border-radius:16px; color:white; margin-bottom:8px;">
                            <option value="none">Без условия</option>
                            <option value="trades_count">Количество сделок</option>
                            <option value="shares_held">Количество акций</option>
                            <option value="referrals_count">Количество рефералов</option>
                            <option value="total_topup">Сумма пополнения</option>
                            <option value="total_spent">Сумма трат</option>
                            <option value="total_earned">Сумма заработка</option>
                            <option value="total_volume">Общий объём</option>
                            <option value="stars_held">Баланс Stars</option>
                            <option value="days_active">Дней активности</option>
                        </select>
                        <input type="number" id="achValue" placeholder="Значение условия" style="margin-bottom:8px;">
                        <button id="createAchievementBtn" style="background:linear-gradient(135deg,#fbbf24,#f59e0b); color:#1e1e2f;">➕ Создать достижение</button>
                    </div>
                    <div id="achievementsListAdmin" style="max-height:300px; overflow-y:auto;"></div>
                </div>

                <!-- Маркет-мейкер -->
                <div id="admin-mm" class="admin-pane" style="display:none;">
                    <h3>🤖 Управление маркет-мейкером</h3>
                    <div style="margin-bottom:16px;">
                        <label>Баланс акций:</label>
                        <input type="number" id="mmShares" value="${mmBalance.shares}" style="margin-bottom:8px;">
                        <label>Баланс звёзд:</label>
                        <input type="number" id="mmStars" value="${mmBalance.stars}" style="margin-bottom:8px;">
                        <button id="setMMBudgetBtn" style="background:linear-gradient(135deg,#2b6e9e,#1a4c6e);">Установить бюджет</button>
                    </div>
                    <div>
                        <button id="runMMBtn" style="background:linear-gradient(135deg,#fbbf24,#f59e0b); color:#1e1e2f;">▶️ Запустить маркет-мейкера (однократно)</button>
                    </div>
                </div>

                <!-- Настройки -->
                <div id="admin-settings" class="admin-pane" style="display:none;">
                    <h3>⚙️ Настройки приложения</h3>
                    <div style="margin-bottom:16px;">
                        <label>Цена выкупа 1 акции (в ⭐):</label>
                        <input type="number" id="mmPriceInput" value="${await window.getSetting('market_maker_price') || 100}" style="margin-bottom:8px;">
                        <button id="saveMmPriceBtn" style="background:linear-gradient(135deg,#fbbf24,#f59e0b); color:#1e1e2f;">Сохранить</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('app').innerHTML = html;

        // ---- СТИЛИ (вставляем динамически) ----
        const style = document.createElement('style');
        style.textContent = `
            .admin-container { max-width: 900px; margin:0 auto; padding:0 16px 80px; }
            .admin-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px; }
            .admin-header h2 { font-size:24px; font-weight:800; background:linear-gradient(135deg,#fbbf24,#f59e0b); -webkit-background-clip:text; background-clip:text; color:transparent; }
            .admin-user-info { font-size:12px; color:#9ca3af; }
            .admin-nav { display:flex; flex-wrap:wrap; gap:6px; margin-bottom:16px; background:rgba(18,24,38,0.5); backdrop-filter:blur(8px); border-radius:20px; padding:8px; border:1px solid rgba(0,255,255,0.15); }
            .admin-nav-btn { padding:6px 14px; border-radius:30px; border:none; background:transparent; color:#9ca3af; cursor:pointer; font-size:13px; font-weight:500; transition:0.2s; white-space:nowrap; }
            .admin-nav-btn.active { background:linear-gradient(135deg,#2b6e9e,#1a4c6e); color:white; box-shadow:0 0 12px rgba(43,110,158,0.4); }
            .admin-nav-btn:hover:not(.active) { background:rgba(255,255,255,0.05); }
            .admin-pane { background:rgba(0,0,0,0.25); border-radius:20px; padding:16px; margin-top:12px; }
            .stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; margin-bottom:16px; }
            .stat-card { background:rgba(18,24,38,0.7); backdrop-filter:blur(8px); border-radius:20px; padding:16px 12px; text-align:center; border:1px solid rgba(56,189,248,0.2); }
            .stat-icon { font-size:28px; }
            .stat-value { font-size:22px; font-weight:800; background:linear-gradient(135deg,#eef2ff,#a5b4fc); -webkit-background-clip:text; background-clip:text; color:transparent; }
            .stat-label { font-size:10px; color:#9ca3af; margin-top:4px; }
            .quick-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:8px; }
            .quick-btn { padding:10px; border-radius:20px; border:none; background:rgba(255,255,255,0.05); color:#eef2ff; cursor:pointer; transition:0.2s; }
            .quick-btn:hover { background:rgba(255,255,255,0.12); }
            .user-item { padding:10px 12px; background:rgba(0,0,0,0.3); border-radius:16px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; }
            .user-item .actions { display:flex; gap:6px; flex-wrap:wrap; }
            .user-item button { padding:4px 12px; border-radius:20px; border:none; cursor:pointer; font-size:12px; }
            .user-item .ban-btn { background:rgba(255,0,0,0.2); color:#ff6b6b; border:1px solid #ff4444; }
            .user-item .edit-btn { background:rgba(0,255,255,0.15); color:#0ff; border:1px solid rgba(0,255,255,0.3); }
            @media (max-width:560px) { .admin-nav-btn { font-size:11px; padding:4px 10px; } .stat-value { font-size:18px; } }
        `;
        document.head.appendChild(style);

        // ---- НАВИГАЦИЯ ----
        document.querySelectorAll('.admin-nav-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                document.querySelectorAll('.admin-pane').forEach(p => p.style.display = 'none');
                document.getElementById('admin-' + this.dataset.tab).style.display = 'block';
            });
        });

        // ---- БЫСТРЫЕ ДЕЙСТВИЯ (с модалками) ----
        document.getElementById('quickAddShares').onclick = () => {
            showGiveModal('акций', async (target, amount) => {
                await window.adminAddSharesDirect(target, amount);
                window.showToast('✅ Акции выданы');
                window.renderAdminTab();
            });
        };
        document.getElementById('quickAddStars').onclick = () => {
            showGiveModal('звёзд', async (target, amount) => {
                await window.adminAddStarsDirect(target, amount);
                window.showToast('✅ Звёзды выданы');
                window.renderAdminTab();
            });
        };
        document.getElementById('quickCreateNews').onclick = () => {
            document.querySelector('.admin-nav-btn[data-tab="news"]').click();
        };
        document.getElementById('quickBroadcast').onclick = async () => {
            const message = prompt('Введите сообщение для рассылки:');
            if (!message) return;
            try {
                await window.adminBroadcast(message);
                window.showToast('📢 Рассылка отправлена всем пользователям');
            } catch(e) {
                window.showCustomModal('Ошибка', e.message);
            }
        };
        document.getElementById('quickRunMM').onclick = async () => {
            try {
                await window.runMarketMaker();
                window.showToast('🤖 Маркет-мейкер отработал');
            } catch(e) {
                window.showCustomModal('Ошибка', e.message);
            }
        };

        // ---- МОДАЛКА ВЫДАЧИ ----
        function showGiveModal(type, callback) {
            const modalHtml = `
                <div class="modal" id="giveModal" style="display:flex;">
                    <div class="modal-content" style="max-width: 360px;">
                        <span class="close-modal" id="closeGiveModal">&times;</span>
                        <h3>💰 Выдать ${type}</h3>
                        <div style="padding:16px 0;">
                            <input type="number" id="giveTargetId" placeholder="ID пользователя" style="margin-bottom:12px;">
                            <input type="number" id="giveAmount" placeholder="Количество" style="margin-bottom:12px;">
                            <button id="giveConfirmBtn" style="background:linear-gradient(135deg,#2b6e9e,#1a4c6e);">Выдать</button>
                        </div>
                    </div>
                </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            const modal = document.getElementById('giveModal');
            document.getElementById('closeGiveModal').onclick = () => modal.remove();
            document.getElementById('giveConfirmBtn').onclick = async () => {
                const target = parseInt(document.getElementById('giveTargetId').value);
                const amount = parseFloat(document.getElementById('giveAmount').value);
                if (!target || !amount || amount <= 0) {
                    window.showCustomModal('Ошибка', 'Введите корректные данные');
                    return;
                }
                modal.remove();
                await callback(target, amount);
            };
        }

        // ---- ПОЛЬЗОВАТЕЛИ ----
        async function renderUsers(filter = '') {
            const list = users;
            const filtered = filter ? list.filter(u => String(u.id).includes(filter) || (u.username || '').toLowerCase().includes(filter.toLowerCase())) : list;
            const container = document.getElementById('usersList');
            if (!filtered.length) {
                container.innerHTML = '<p style="color:#9ca3af;">Пользователи не найдены</p>';
                return;
            }
            container.innerHTML = filtered.map(u => `
                <div class="user-item">
                    <span>ID: ${u.id} | ${u.username || 'Аноним'} | Акций: ${window.fromCents(u.shares)} | Stars: ${window.fromCents(u.stars_balance)}</span>
                    <div class="actions">
                        <button class="edit-btn" data-id="${u.id}" onclick="window.editUser(${u.id})">✏️</button>
                        <button class="ban-btn" data-id="${u.id}" onclick="window.toggleBan(${u.id})">🚫</button>
                    </div>
                </div>
            `).join('');
        }
        renderUsers();
        document.getElementById('userSearchInput').addEventListener('input', (e) => renderUsers(e.target.value));

        // ---- ОРДЕРА ----
        const ordersDiv = document.getElementById('adminOrdersList');
        if (!orders.length) ordersDiv.innerHTML = '<p style="color:#9ca3af;">Нет ордеров</p>';
        else orders.forEach(order => {
            const div = document.createElement('div');
            div.className = 'order-item';
            div.style.cssText = 'background:rgba(0,0,0,0.3); border-radius:16px; padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';
            div.innerHTML = `
                <span>${window.fromCents(order.amount)} шт. по ${window.fromCents(order.price_per_share)} ⭐ (продавец ${order.seller_id})</span>
                <button class="cancel-btn" data-order-id="${order.id}" style="background:rgba(255,0,0,0.2); border:1px solid #ff4444; color:#ff6b6b; padding:4px 16px; border-radius:20px; cursor:pointer;">Отменить</button>
            `;
            ordersDiv.appendChild(div);
        });
        document.querySelectorAll('.cancel-btn').forEach(btn => btn.addEventListener('click', async () => {
            try {
                await window.adminCancelOrderDirect(parseInt(btn.dataset.orderId));
                window.showToast('Ордер отменён');
                window.renderAdminTab();
            } catch(e) {
                window.showCustomModal('Ошибка', e.message);
            }
        }));

        // ---- НОВОСТИ ----
        async function loadNewsAdmin() {
            const list = await window.getNews();
            const container = document.getElementById('newsListAdmin');
            if (!list.length) {
                container.innerHTML = '<p style="color:#9ca3af;">Нет новостей</p>';
                return;
            }
            container.innerHTML = list.map(n => `
                <div style="background:rgba(0,0,0,0.3); border-radius:16px; padding:12px; margin-bottom:12px;">
                    <div style="font-weight:700; font-size:16px; margin-bottom:4px;">${n.title}</div>
                    <div style="font-size:13px; color:#cbd5e1;">${n.content.substring(0,150)}${n.content.length > 150 ? '...' : ''}</div>
                    ${n.image_url ? `<img src="${n.image_url}" style="max-width:100%; max-height:150px; border-radius:12px; margin:8px 0; object-fit:cover;" onerror="this.style.display='none'">` : ''}
                    <button class="delete-news-btn" data-id="${n.id}" style="margin-top:8px; background:rgba(255,0,0,0.2); border:1px solid #ff4444; color:#ff6b6b; padding:4px 16px; border-radius:20px; cursor:pointer;">Удалить</button>
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

        // ---- АДМИНЫ ----
        async function loadAdmins() {
            const list = await window.getAdmins();
            const container = document.getElementById('adminsList');
            if (!list.length) {
                container.innerHTML = '<p style="color:#9ca3af;">Нет администраторов</p>';
                return;
            }
            container.innerHTML = list.map(a => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); border-radius:16px; padding:12px; margin-bottom:8px;">
                    <span>ID: ${a.user_id} (добавлен ${new Date(a.added_at).toLocaleDateString()})</span>
                    ${a.user_id !== OWNER_ID ? `<button class="remove-admin-btn" data-id="${a.user_id}" style="background:rgba(255,0,0,0.2); border:1px solid #ff4444; color:#ff6b6b; padding:4px 12px; border-radius:20px; cursor:pointer;">Удалить</button>` : '<span style="color:#fbbf24;">👑 Владелец</span>'}
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

        // ---- ДОСТИЖЕНИЯ ----
        async function loadAchievementsAdmin() {
            const list = await window.getAllAchievements();
            const container = document.getElementById('achievementsListAdmin');
            if (!list.length) {
                container.innerHTML = '<p style="color:#9ca3af;">Нет достижений</p>';
                return;
            }
            container.innerHTML = list.map(a => {
                // Убираем дублирование эмодзи: оставляем только то, что в названии (уже содержит иконку)
                const displayName = a.name;
                return `
                    <div style="background:rgba(0,0,0,0.3); border-radius:16px; padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <span>${displayName} (${a.condition_type}: ${a.condition_value})</span>
                        <button class="delete-ach-btn" data-id="${a.id}" style="background:rgba(255,0,0,0.2); border:1px solid #ff4444; color:#ff6b6b; padding:4px 12px; border-radius:20px; cursor:pointer;">Удалить</button>
                    </div>
                `;
            }).join('');
            document.querySelectorAll('.delete-ach-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Удалить достижение?')) return;
                    const { error } = await window.supabase.from('achievements').delete().eq('id', parseInt(btn.dataset.id));
                    if (error) { window.showCustomModal('Ошибка', error.message); return; }
                    window.showToast('Достижение удалено');
                    loadAchievementsAdmin();
                });
            });
        }
        loadAchievementsAdmin();

        document.getElementById('createAchievementBtn').onclick = async () => {
            const name = document.getElementById('achName').value.trim();
            const description = document.getElementById('achDesc').value.trim();
            const icon = document.getElementById('achIcon').value.trim() || '🏆';
            const condition_type = document.getElementById('achCondition').value;
            const condition_value = parseInt(document.getElementById('achValue').value) || 0;
            if (!name) { window.showCustomModal('Ошибка', 'Введите название'); return; }
            try {
                const { error } = await window.supabase.from('achievements').insert({
                    name, description, icon, condition_type, condition_value
                });
                if (error) throw error;
                window.showToast('Достижение создано');
                document.getElementById('achName').value = '';
                document.getElementById('achDesc').value = '';
                document.getElementById('achIcon').value = '';
                document.getElementById('achValue').value = '';
                loadAchievementsAdmin();
            } catch(e) {
                window.showCustomModal('Ошибка', e.message);
            }
        };

        // ---- МАРКЕТ-МЕЙКЕР ----
        document.getElementById('setMMBudgetBtn').onclick = async () => {
            const shares = parseFloat(document.getElementById('mmShares').value);
            const stars = parseFloat(document.getElementById('mmStars').value);
            if (isNaN(shares) || isNaN(stars) || shares < 0 || stars < 0) {
                window.showCustomModal('Ошибка', 'Введите корректные значения');
                return;
            }
            try {
                await window.setMarketMakerBudget(shares, stars);
                window.showToast('Бюджет маркет-мейкера обновлён');
                window.renderAdminTab();
            } catch(e) {
                window.showCustomModal('Ошибка', e.message);
            }
        };

        document.getElementById('runMMBtn').onclick = async () => {
            try {
                await window.runMarketMaker();
                window.showToast('🤖 Маркет-мейкер отработал');
                window.renderAdminTab();
            } catch(e) {
                window.showCustomModal('Ошибка', e.message);
            }
        };

        // ---- НАСТРОЙКИ ----
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

        // Глобальные функции для кнопок
        window.editUser = function(userId) {
            const shares = prompt('Введите новое количество акций (в штуках):');
            if (shares === null) return;
            const stars = prompt('Введите новое количество Stars:');
            if (stars === null) return;
            window.showCustomModal('Успех', 'Данные пользователя обновлены (заглушка)');
        };
        window.toggleBan = function(userId) {
            if (confirm('Забанить пользователя?')) {
                window.showCustomModal('Успех', 'Пользователь забанен (заглушка)');
            }
        };

    } catch(e) {
        document.getElementById('app').innerHTML = `<div class="card error">${e.message}</div>`;
        console.error(e);
    }
};
