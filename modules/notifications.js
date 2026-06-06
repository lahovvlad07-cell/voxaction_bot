// modules/notifications.js

import { supabase } from './supabaseClient.js';
import { userId } from './config.js';
import { showToast, showCustomModal } from './utils.js';

let notificationsChannel = null;

// Загрузить все уведомления пользователя
export async function loadNotifications() {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
    if (error) return [];
    return data;
}

// Получить количество непрочитанных
export async function getUnreadCount() {
    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
    if (error) return 0;
    return count || 0;
}

// Отметить одно уведомление как прочитанное
export async function markNotificationRead(notifId) {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
    await updateBellBadge();
}

// Удалить уведомление
export async function deleteNotification(notifId) {
    await supabase.from('notifications').delete().eq('id', notifId);
    await updateBellBadge();
    if (window.notificationsModalOpen) await showNotificationsModal();
}

// Отметить все как прочитанные
export async function markAllRead() {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    await updateBellBadge();
    if (window.notificationsModalOpen) await showNotificationsModal();
}

// Обновить бейдж у колокольчика
export async function updateBellBadge() {
    const unread = await getUnreadCount();
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        if (unread > 0) {
            badge.textContent = unread > 9 ? '9+' : unread;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }
}

// Показать модалку со списком уведомлений
export async function showNotificationsModal() {
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
                <div class="notifications-list">${listHtml || '<p style="text-align:center; padding:20px;">Нет уведомлений</p>'}</div>
                ${notifications.length ? '<button id="markAllReadBtn" class="secondary">Отметить все прочитанными</button>' : ''}
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
            await markAllRead();
            document.getElementById('notificationsModal').remove();
            window.notificationsModalOpen = false;
            await showNotificationsModal();
        });
    }
    document.querySelectorAll('.mark-read').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = parseInt(btn.dataset.id);
            await markNotificationRead(id);
            document.getElementById('notificationsModal').remove();
            window.notificationsModalOpen = false;
            await showNotificationsModal();
        });
    });
    document.querySelectorAll('.delete-notif').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = parseInt(btn.dataset.id);
            await deleteNotification(id);
            document.getElementById('notificationsModal').remove();
            window.notificationsModalOpen = false;
            await showNotificationsModal();
        });
    });
}

// Подписка на новые уведомления в реальном времени
export function setupRealtimeNotifications() {
    if (notificationsChannel) return;
    notificationsChannel = supabase
        .channel('notifications-channel')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`
        }, (payload) => {
            const newNotif = payload.new;
            showToast(`🔔 ${newNotif.message}`);
            updateBellBadge();
        })
        .subscribe();
}