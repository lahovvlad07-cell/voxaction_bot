// notifications.js – полная версия (уведомления, бейдж, реалтайм)

let notificationsChannel = null;

async function loadNotifications() {
    const { data, error } = await window.supabase.from('notifications').select('*').eq('user_id', window.userId).order('created_at', { ascending: false });
    if (error) return [];
    return data;
}

async function getUnreadCount() {
    const { count, error } = await window.supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', window.userId).eq('is_read', false);
    if (error) return 0;
    return count || 0;
}

window.markNotificationRead = async function(notifId) {
    await window.supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
    await window.updateBellBadge();
};

window.deleteNotification = async function(notifId) {
    await window.supabase.from('notifications').delete().eq('id', notifId);
    await window.updateBellBadge();
    if (window.notificationsModalOpen) await window.showNotificationsModal();
};

window.markAllRead = async function() {
    await window.supabase.from('notifications').update({ is_read: true }).eq('user_id', window.userId).eq('is_read', false);
    await window.updateBellBadge();
    if (window.notificationsModalOpen) await window.showNotificationsModal();
};

window.updateBellBadge = async function() {
    const unread = await getUnreadCount();
    const badge = document.getElementById('headerNotificationBadge');
    if (badge) {
        if (unread > 0) {
            badge.textContent = unread > 9 ? '9+' : unread;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
};

window.showNotificationsModal = async function() {
    const notifications = await loadNotifications();
    const listHtml = notifications.map(n => `
        <div class="notification-item ${!n.is_read ? 'unread' : ''}" data-id="${n.id}">
            <div class="notification-message">${n.message}</div>
            <div class="notification-time">${new Date(n.created_at).toLocaleString()}</div>
            <div class="notification-actions">
                ${!n.is_read ? `<button class="mark-read" data-id="${n.id}">✓</button>` : ''}
                <button class="delete-notif" data-id="${n.id}">🗑️</button>
            </div>
        </div>
    `).join('');
    const modalHtml = `
        <div class="modal" id="notificationsModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeNotifModal">&times;</span>
                <h3>🔔 Уведомления</h3>
                <div class="scrollable-content">
                    <div class="notifications-list">${listHtml || '<p style="text-align:center; padding:20px;">Нет уведомлений</p>'}</div>
                </div>
                ${notifications.length ? '<div class="modal-buttons"><button id="markAllReadBtn" class="secondary">Отметить все прочитанными</button></div>' : ''}
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    window.notificationsModalOpen = true;
    document.getElementById('closeNotifModal').onclick = () => {
        document.getElementById('notificationsModal').remove();
        window.notificationsModalOpen = false;
    };
    if (notifications.length) {
        document.getElementById('markAllReadBtn')?.addEventListener('click', async () => {
            await window.markAllRead();
            document.getElementById('notificationsModal').remove();
            window.notificationsModalOpen = false;
            await window.showNotificationsModal();
        });
    }
    document.querySelectorAll('.mark-read').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = parseInt(btn.dataset.id);
            await window.markNotificationRead(id);
            document.getElementById('notificationsModal').remove();
            window.notificationsModalOpen = false;
            await window.showNotificationsModal();
        });
    });
    document.querySelectorAll('.delete-notif').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = parseInt(btn.dataset.id);
            await window.deleteNotification(id);
            document.getElementById('notificationsModal').remove();
            window.notificationsModalOpen = false;
            await window.showNotificationsModal();
        });
    });
};

function setupRealtimeNotifications() {
    if (notificationsChannel) return;
    notificationsChannel = window.supabase
        .channel('notifications-channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${window.userId}` }, (payload) => {
            const newNotif = payload.new;
            window.showToast(`🔔 ${newNotif.message}`);
            window.updateBellBadge();
        })
        .subscribe();
}
