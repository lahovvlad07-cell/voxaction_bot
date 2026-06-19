// admin.js – с резервом и управлением выводами

const OWNER_ID = 6048486427;

window.renderAdminTab = async function() {
    if (window.userId !== OWNER_ID) {
        document.getElementById('app').innerHTML = '<div class="card error">Доступ запрещён</div>';
        return;
    }

    try {
        await window.initMarketMaker();
        const users = await window.adminGetAllUsers();
        const orders = await window.getActiveOrders();
        const newsList = await window.getNews();
        const adminsList = await window.getAdmins();
        const achievements = await window.getAllAchievements();
        const mmBalance = await window.getMarketMakerBalance();
        const reserve = await window.getReserve();
        const withdrawals = await window.supabase
            .from('withdrawals')
            .select('*')
            .order('created_at', { ascending: false });

        const withdrawalsData = withdrawals.data || [];

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
                    <button class="admin-nav-btn" data-tab="withdrawals">💸 Выводы</button>
                    <button class="admin-nav-btn" data-tab="settings">⚙️ Настройки</button>
                </div>

                <div id="admin-dashboard" class="admin-pane active">
                    <div class="stats-grid">
                        <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">${users.reduce((s,u) => s + u.shares, 0) / 100}</div><div class="stat-label">Акций</div></div>
                        <div class="stat-card"><div class="stat-icon">👥</div><div class="stat-value">${users.length}</div><div class="stat-label">Пользователей</div></div>
                        <div class="stat-card"><div class="stat-icon">📋</div><div class="stat-value">${orders.length}</div><div class="stat-label">Активных ордеров</div></div>
                        <div class="stat-card"><div class="stat-icon">🏦</div><div class="stat-value">${(reserve.amount / 100).toFixed(2)}</div><div class="stat-label">Резерв (⭐)</div></div>
                        <div class="stat-card"><div class="stat-icon">💸</div><div class="stat-value">${withdrawalsData.filter(w => w.status === 'pending').length}</div><div class="stat-label">Заявок на вывод</div></div>
                    </div>
                    <div class="quick-actions">
                        <h3>⚡ Быстрые действия</h3>
                        <div class="quick-grid">
                            <button class="quick-btn" id="quickAddShares">➕ Выдать акции</button>
                            <button class="quick-btn" id="quickAddStars">⭐ Выдать Stars</button>
                            <button class="quick-btn" id="quickCreateNews">📰 Создать новость</button>
                            <button class="quick-btn" id="quickBroadcast">📢 Рассылка</button>
                        </div>
                    </div>
                </div>

                <div id="admin-users" class="admin-pane" style="display:none;">
                    <h3>👥 Управление пользователями</h3>
                    <div class="user-search">
                        <input type="text" id="userSearchInput" placeholder="Поиск по ID или имени...">
                    </div>
                    <div id="usersList" style="max-height:400px; overflow-y:auto;"></div>
                </div>

                <div id="admin-orders" class="admin-pane" style="display:none;">
                    <h3>📋 Управление ордерами</h3>
                    <div id="adminOrdersList"></div>
                </div>

                <div id="admin-news" class="admin-pane" style="display:none;">
                    <h3>📰 Управление новостями</h3>
                    <div id="newsListAdmin"></div>
                </div>

                <div id="admin-admins" class="admin-pane" style="display:none;">
                    <h3>👑 Управление администраторами</h3>
                    <input type="number" id="newAdminId" placeholder="ID нового админа">
                    <button id="addAdminBtn">➕ Добавить админа</button>
                    <div id="adminsList"></div>
                </div>

                <div id="admin-achievements" class="admin-pane" style="display:none;">
                    <h3>🏆 Управление достижениями</h3>
                    <div style="margin-bottom:16px;">
                        <input type="text" id="achName" placeholder="Название (с эмодзи)">
                        <input type="text" id="achDesc" placeholder="Описание">
                        <input type="text" id="achIcon" placeholder="Иконка (эмодзи)">
                        <select id="achCondition">
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
                        <input type="number" id="achValue" placeholder="Значение условия">
                        <button id="createAchievementBtn">➕ Создать достижение</button>
                    </div>
                    <div id="achievementsListAdmin"></div>
                </div>

                <div id="admin-mm" class="admin-pane" style="display:none;">
                    <h3>🤖 Маркет-мейкер</h3>
                    <div style="margin-bottom:16px;">
                        <p><strong>Баланс акций:</strong> <span id="mmSharesDisplay">${mmBalance.shares.toFixed(2)}</span></p>
                        <p><strong>Баланс звёзд:</strong> <span id="mmStarsDisplay">${mmBalance.stars.toFixed(2)}</span></p>
                    </div>
                    <div>
                        <button id="runMMBtn">▶️ Запустить маркет-мейкера</button>
                        <p style="font-size:12px; color:#9ca3af; margin-top:8px;">Автоматический запуск каждые 5 минут</p>
                    </div>
                </div>

                <div id="admin-withdrawals" class="admin-pane" style="display:none;">
                    <h3>💸 Управление выводами</h3>
                    <div id="withdrawalsList"></div>
                </div>

                <div id="admin-settings" class="admin-pane" style="display:none;">
                    <h3>⚙️ Настройки приложения</h3>
                    <div style="margin-bottom:16px;">
                        <label>Цена выкупа 1 акции (в ⭐):</label>
                        <input type="number" id="mmPriceInput" value="${await window.getSetting('market_maker_price') || 100}">
                        <button id="saveMmPriceBtn">Сохранить</button>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('app').innerHTML = html;

        // ---- НАВИГАЦИЯ ----
        document.querySelectorAll('.admin-nav-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                document.querySelectorAll('.admin-pane').forEach(p => p.style.display = 'none');
                document.getElementById('admin-' + this.dataset.tab).style.display = 'block';
            });
        });

        // ---- БЫСТРЫЕ ДЕЙСТВИЯ ----
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
                window.showToast('📢 Рассылка отправлена');
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
                            <input type="number" id="giveTargetId" placeholder="ID пользователя">
                            <input type="number" id="giveAmount" placeholder="Количество">
                            <button id="giveConfirmBtn">Выдать</button>
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
                <button class="cancel-btn" data-order-id="${order.id}">Отменить</button>
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
                    <button class="delete-news-btn" data-id="${n.id}">Удалить</button>
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
                    ${a.user_id !== OWNER_ID ? `<button class="remove-admin-btn" data-id="${a.user_id}">Удалить</button>` : '<span style="color:#fbbf24;">👑 Владелец</span>'}
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
                const displayName = a.name;
                return `
                    <div style="background:rgba(0,0,0,0.3); border-radius:16px; padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                        <span>${displayName} (${a.condition_type}: ${a.condition_value})</span>
                        <button class="delete-ach-btn" data-id="${a.id}">Удалить</button>
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

        // ---- ВЫВОДЫ ----
        const withdrawalsContainer = document.getElementById('withdrawalsList');
        if (!withdrawalsData.length) {
            withdrawalsContainer.innerHTML = '<p style="color:#9ca3af;">Нет заявок на вывод</p>';
        } else {
            withdrawalsContainer.innerHTML = withdrawalsData.map(w => `
                <div style="background:rgba(0,0,0,0.3); border-radius:16px; padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                    <span>ID: ${w.user_id} | ${window.fromCents(w.amount)} ⭐ (комиссия ${window.fromCents(w.fee || 0)} ⭐) | ${w.status}</span>
                    ${w.status === 'pending' ? `
                        <div>
                            <button class="approve-withdrawal" data-id="${w.id}">✅ Одобрить</button>
                            <button class="reject-withdrawal" data-id="${w.id}">❌ Отклонить</button>
                        </div>
                    ` : ''}
                </div>
            `).join('');
        }

        document.querySelectorAll('.approve-withdrawal').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = parseInt(this.dataset.id);
                if (!confirm('Одобрить вывод?')) return;
                await window.supabase.from('withdrawals').update({ status: 'approved' }).eq('id', id);
                window.showToast('Вывод одобрен');
                window.renderAdminTab();
            });
        });
        document.querySelectorAll('.reject-withdrawal').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = parseInt(this.dataset.id);
                if (!confirm('Отклонить вывод?')) return;
                const { data: w } = await window.supabase.from('withdrawals').select('user_id, amount').eq('id', id).single();
                if (w) {
                    await window.supabase.from('users').update({
                        stars_balance: window.supabase.raw(`stars_balance + ${w.amount}`)
                    }).eq('id', w.user_id);
                }
                await window.supabase.from('withdrawals').update({ status: 'rejected' }).eq('id', id);
                window.showToast('Вывод отклонён, Stars возвращены');
                window.renderAdminTab();
            });
        });

        // ---- МАРКЕТ-МЕЙКЕР ----
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

        // Глобальные функции
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
