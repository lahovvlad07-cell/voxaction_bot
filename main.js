// main.js (с drag-to-scroll для горизонтального меню)
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
        if (autoRefresh) {
            clearInterval(autoRefresh);
            autoRefresh = null;
        }
    }

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', async () => {
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
                    default: break;
                }
            }
        });
    });

    window.setupRealtime();
    await window.updateBellBadge();

    if (isNew) {
        setTimeout(() => window.openAvatar(), 500);
    }
    startAutoRefresh();

    // ---------- DRAG-TO-SCROLL ДЛЯ ГОРИЗОНТАЛЬНОГО МЕНЮ ----------
    function initHorizontalDragScroll() {
        const wrapper = document.querySelector('.tabs-wrapper');
        if (!wrapper) return;

        let isDragging = false;
        let startX, startScrollLeft;

        wrapper.addEventListener('mousedown', (e) => {
            isDragging = true;
            wrapper.style.cursor = 'grabbing';
            startX = e.pageX - wrapper.offsetLeft;
            startScrollLeft = wrapper.scrollLeft;
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.pageX - wrapper.offsetLeft;
            const walk = (x - startX) * 1.2; // скорость прокрутки
            wrapper.scrollLeft = startScrollLeft - walk;
        });

        window.addEventListener('mouseup', () => {
            isDragging = false;
            wrapper.style.cursor = 'grab';
        });

        wrapper.addEventListener('dragstart', (e) => e.preventDefault());
        wrapper.addEventListener('selectstart', (e) => e.preventDefault());
    }

    initHorizontalDragScroll();
})();

window.refreshUser = async () => {
    const { user } = await window.getOrCreateUser();
    window.currentUser = user;
};
