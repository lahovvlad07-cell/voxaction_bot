// main.js

import { tg, initTelegram, userId, isAdmin } from './modules/config.js';
import { getOrCreateUser, setCurrentUser } from './modules/user.js';
import { setupRealtimeNotifications, updateBellBadge } from './modules/notifications.js';
import { renderStocksTab } from './modules/tabs/stocksTab.js';
import { renderProfileTab } from './modules/tabs/profile.js';
import { renderAnalyticsTab } from './modules/tabs/analytics.js';
import { renderRatingTab } from './modules/tabs/rating.js';
import { renderWalletTab } from './modules/tabs/wallet.js';
import { renderReferralTab } from './modules/tabs/referral.js';
import { renderSettingsTab } from './modules/tabs/settings.js';
import { renderAdminTab } from './modules/tabs/admin.js';
import { initTabDrag, initTopupModal } from './modules/ui.js';
import { openAvatarSelector } from './modules/avatar.js';

(async () => {
    initTelegram(); // вызывает tg.ready() и tg.expand()

    if (!userId) {
        document.getElementById('app').innerHTML = '<div class="card" style="text-align:center;">Ошибка: запустите через Telegram</div>';
        return;
    }

    if (isAdmin) {
        const adminTab = document.querySelector('.admin-tab');
        if (adminTab) adminTab.style.display = 'inline-flex';
    }

    // Получаем или создаём пользователя
    const { user, isNew } = await getOrCreateUser(userId);
    setCurrentUser(user);

    // Применяем сохранённый цвет акцента
    const savedColor = localStorage.getItem('custom_color') || '#2b6e9e';
    document.documentElement.style.setProperty('--accent', savedColor);

    // Стартовая вкладка — акции
    await renderStocksTab();

    // Если новый пользователь — сразу предложить выбрать аватар
    if (isNew) {
        setTimeout(() => openAvatarSelector(), 500);
    }

    // Настройка уведомлений в реальном времени
    setupRealtimeNotifications();
    await updateBellBadge();

    // Инициализация перетаскивания табов и модалки пополнения
    initTabDrag();
    initTopupModal();

    // Переключение вкладок
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            const tabName = tab.dataset.tab;
            if (!tabName) return;

            // Обновляем активный класс
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Рендерим выбранную вкладку
            switch (tabName) {
                case 'profile':
                    await renderProfileTab();
                    break;
                case 'stocks':
                    await renderStocksTab();
                    break;
                case 'analytics':
                    await renderAnalyticsTab();
                    break;
                case 'rating':
                    await renderRatingTab();
                    break;
                case 'wallet':
                    await renderWalletTab();
                    break;
                case 'referral':
                    await renderReferralTab();
                    break;
                case 'settings':
                    await renderSettingsTab();
                    break;
                case 'admin':
                    await renderAdminTab();
                    break;
                default:
                    console.warn('Неизвестная вкладка:', tabName);
            }
        });
    });
})();