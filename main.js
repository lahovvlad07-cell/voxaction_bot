// main.js — исправленный drag-to-scroll для горизонтального меню
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

    if (window.userId === 6048486427) {
        const adminTab = document.querySelector('.admin-tab');
        if (adminTab) adminTab.style.display = 'inline-flex';
    }

    const { user, isNew } = await window.getOrCreateUser();
    window.currentUser = user;

    const savedColor = localStorage.getItem('custom_color') || '#2b6e9e';
    document.documentElement.style.setProperty('--accent', savedColor);

    await window.renderStocks();

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
        if (autoRefresh) clearInterval(autoRefresh);
        autoRefresh = null;
    }

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', async (e) => {
            // Если это был drag, не реагируем (флаг будет установлен ниже)
            if (e.defaultPrevented) return;
            const name = tab.dataset.tab;
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
                }
            }
        });
    });

    window.setupRealtime();
    await window.updateBellBadge();

    if (isNew) setTimeout(() => window.openAvatar(), 500);
    startAutoRefresh();

    // ---------- DRAG-TO-SCROLL С ПОРОГОМ И ЗАПРЕТОМ ВЫДЕЛЕНИЯ ----------
    const wrapper = document.querySelector('.tabs-wrapper');
    if (wrapper) {
        let startX = 0, startScrollLeft = 0;
        let isDragging = false;
        let hasMoved = false;
        let dragThreshold = 5; // минимальное перемещение для активации скролла

        wrapper.addEventListener('mousedown', (e) => {
            // Если кликнули на таб, не начинаем drag сразу, но запоминаем позицию
            startX = e.pageX - wrapper.offsetLeft;
            startScrollLeft = wrapper.scrollLeft;
            isDragging = true;
            hasMoved = false;
            wrapper.style.cursor = 'grabbing';
            e.preventDefault(); // запрещаем выделение текста
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const x = e.pageX - wrapper.offsetLeft;
            const deltaX = x - startX;
            if (!hasMoved && Math.abs(deltaX) > dragThreshold) {
                hasMoved = true;
            }
            if (hasMoved) {
                e.preventDefault();
                wrapper.scrollLeft = startScrollLeft - deltaX;
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDragging && !hasMoved) {
                // Если не было перемещения, значит это клик — эмулируем клик по табу
                // Но клик уже обрабатывается отдельно, ничего не делаем
            }
            isDragging = false;
            wrapper.style.cursor = 'grab';
        });

        wrapper.addEventListener('dragstart', (e) => e.preventDefault());
        wrapper.addEventListener('selectstart', (e) => e.preventDefault());
    }
})();

window.refreshUser = async () => {
    const { user } = await window.getOrCreateUser();
    window.currentUser = user;
};
