// main.js (полная версия с drag-to-scroll для меню)
(async () => {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    window.userId = tg.initDataUnsafe?.user?.id;
    window.username = tg.initDataUnsafe?.user?.username || `user_${window.userId}`;
    window.tg = tg;

    if (!window.userId) {
        document.getElementById('app').innerHTML = '<div class="card" style="text-align:center;">Ошибка: запустите через Telegram</div>';
        return;
    }

    // Показываем админ-вкладку для владельца
    if (window.userId === 6048486427) {
        const adminTab = document.querySelector('.admin-tab');
        if (adminTab) adminTab.style.display = 'inline-flex';
    }

    // Загружаем или создаём пользователя
    const { user, isNew } = await window.getOrCreateUser();
    window.currentUser = user;

    // Применяем сохранённый цвет акцента
    const savedColor = localStorage.getItem('custom_color') || '#2b6e9e';
    document.documentElement.style.setProperty('--accent', savedColor);

    // Рендерим начальную вкладку (Акции)
    await window.renderStocks();

    // Автообновление для вкладки акций (каждые 15 секунд)
    let autoRefresh = null;
    function startAutoRefresh() {
        if (autoRefresh) clearInterval(autoRefresh);
        autoRefresh = setInterval(async () => {
            const activeTab = document.querySelector('.tab.active');
            if (activeTab && activeTab.dataset.tab === 'stocks') {
                const { user: updatedUser } = await window.getOrCreateUser();
                window.currentUser = updatedUser;
                await window.renderStocks();
            }
        }, 15000);
    }
    function stopAutoRefresh() {
        if (autoRefresh) {
            clearInterval(autoRefresh);
            autoRefresh = null;
        }
    }

    // Переключение вкладок
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            const name = tab.dataset.tab;
            // Убираем активный класс со всех вкладок
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (name === 'stocks') {
                startAutoRefresh();
                await window.renderStocks();
            } else {
                stopAutoRefresh();
                switch (name) {
                    case 'profile': await window.renderProfile(); break;
                    case 'analytics': await window.renderAnalytics(); break;
                    case 'rating': await window.renderRating(); break;
                    case 'wallet': await window.renderWallet(); break;
                    case 'referral': await window.renderReferral(); break;
                    case 'settings': await window.renderSettings(); break;
                    case 'admin': await window.renderAdmin(); break;
                    default: break;
                }
            }
        });
    });

    // Уведомления в реальном времени
    window.setupRealtime();
    await window.updateBellBadge();

    // Если пользователь новый — через 0.5 сек предложим выбрать аватар
    if (isNew) {
        setTimeout(() => window.openAvatar(), 500);
    }

    // Запускаем автообновление для акций
    startAutoRefresh();

    // ----- Горизонтальный скролл для нижнего меню (drag-to-scroll) -----
    function initDragScroll() {
        const wrapper = document.querySelector('.tabs-wrapper');
        if (!wrapper) return;

        let isDown = false;
        let startX;
        let scrollLeft;

        wrapper.addEventListener('mousedown', (e) => {
            isDown = true;
            wrapper.style.cursor = 'grabbing';
            startX = e.pageX - wrapper.offsetLeft;
            scrollLeft = wrapper.scrollLeft;
            e.preventDefault(); // предотвращаем выделение текста
        });

        wrapper.addEventListener('mouseleave', () => {
            isDown = false;
            wrapper.style.cursor = 'grab';
        });

        wrapper.addEventListener('mouseup', () => {
            isDown = false;
            wrapper.style.cursor = 'grab';
        });

        wrapper.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - wrapper.offsetLeft;
            const walk = (x - startX) * 1.5; // скорость прокрутки
            wrapper.scrollLeft = scrollLeft - walk;
        });

        // Для сенсорных экранов (пальцем) — стандартный браузерный скролл работает,
        // но добавим пассивный режим, чтобы не конфликтовать.
        wrapper.addEventListener('touchstart', (e) => {
            // ничего не делаем, просто разрешаем нативный скролл
        }, { passive: true });
    }

    initDragScroll();
})();

// Вспомогательная функция для обновления данных пользователя (используется в stocks.js)
window.refreshUser = async () => {
    const { user } = await window.getOrCreateUser();
    window.currentUser = user;
};
