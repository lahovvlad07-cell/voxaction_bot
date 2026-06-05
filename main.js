// main.js — добавлен drag-to-scroll для горизонтального меню
(async () => {
    const tg = window.Telegram.WebApp;
    tg.ready(); tg.expand();
    window.userId = tg.initDataUnsafe?.user?.id;
    window.username = tg.initDataUnsafe?.user?.username || `user_${window.userId}`;
    window.tg = tg;
    if (!window.userId) { document.getElementById('app').innerHTML = '<div class="card" style="text-align:center;">Ошибка: запустите через Telegram</div>'; return; }
    if (window.userId === 6048486427) document.querySelector('.admin-tab').style.display = 'inline-flex';

    const { user, isNew } = await window.getOrCreateUser();
    window.currentUser = user;

    const savedColor = localStorage.getItem('custom_color') || '#2b6e9e';
    document.documentElement.style.setProperty('--accent', savedColor);

    // Рендерим начальную вкладку (акции)
    await window.renderStocks();

    // Автообновление для вкладки акций
    let autoRefresh = null;
    function startAuto() {
        if (autoRefresh) clearInterval(autoRefresh);
        autoRefresh = setInterval(async () => {
            const active = document.querySelector('.tab.active');
            if (active && active.dataset.tab === 'stocks') {
                const { user: updatedUser } = await window.getOrCreateUser();
                window.currentUser = updatedUser;
                await window.renderStocks();
            }
        }, 15000);
    }
    function stopAuto() { if (autoRefresh) clearInterval(autoRefresh); autoRefresh = null; }

    // Переключение вкладок
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            const name = tab.dataset.tab;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            if (name === 'stocks') {
                startAuto();
                await window.renderStocks();
            } else {
                stopAuto();
                if (name === 'profile') await window.renderProfile();
                else if (name === 'analytics') await window.renderAnalytics();
                else if (name === 'rating') await window.renderRating();
                else if (name === 'wallet') await window.renderWallet();
                else if (name === 'referral') await window.renderReferral();
                else if (name === 'settings') await window.renderSettings();
                else if (name === 'admin') await window.renderAdmin();
            }
        });
    });

    // Уведомления
    window.setupRealtime();
    await window.updateBellBadge();

    // Если новый пользователь – открыть выбор аватарки через 0.5 сек
    if (isNew) {
        setTimeout(() => window.openAvatar(), 500);
    }

    // Старт автообновления для акций
    startAuto();

    // ---------- DRAG-TO-SCROLL ДЛЯ ГОРИЗОНТАЛЬНОГО МЕНЮ ----------
    function initDragScroll() {
        const wrapper = document.querySelector('.tabs-wrapper');
        if (!wrapper) return;
        let isDown = false;
        let startX, scrollLeft;
        wrapper.addEventListener('mousedown', (e) => {
            isDown = true;
            wrapper.style.cursor = 'grabbing';
            startX = e.pageX - wrapper.offsetLeft;
            scrollLeft = wrapper.scrollLeft;
            e.preventDefault();
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
            const walk = (x - startX) * 1.5;
            wrapper.scrollLeft = scrollLeft - walk;
        });
        // На случай, если браузер попытается выделить текст
        wrapper.addEventListener('dragstart', (e) => e.preventDefault());
        wrapper.addEventListener('selectstart', (e) => e.preventDefault());
    }
    initDragScroll();
})();

// Вспомогательная функция для обновления пользователя (используется в stocks.js)
window.refreshUser = async () => {
    const { user } = await window.getOrCreateUser();
    window.currentUser = user;
};
