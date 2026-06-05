// main.js
(async () => {
    const tg = window.Telegram.WebApp;
    tg.ready(); tg.expand();
    window.userId = tg.initDataUnsafe?.user?.id;
    window.username = tg.initDataUnsafe?.user?.username || `user_${window.userId}`;
    if (!window.userId) { document.getElementById('app').innerHTML = '<div class="card" style="text-align:center;">Ошибка: запустите через Telegram</div>'; return; }
    if (window.userId === 6048486427) document.querySelector('.admin-tab').style.display = 'inline-flex';

    const { user, isNew } = await window.getOrCreateUser();
    window.currentUser = user;

    const savedColor = localStorage.getItem('custom_color') || '#2b6e9e';
    document.documentElement.style.setProperty('--accent', savedColor);

    // Проверка, что функция renderStocks существует
    if (typeof window.renderStocks === 'function') {
        await window.renderStocks();
    } else {
        console.error('renderStocks not defined');
        document.getElementById('app').innerHTML = '<div class="card error">Ошибка загрузки модуля stocks.js</div>';
    }

    let autoRefresh = null;
    function startAuto() {
        if (autoRefresh) clearInterval(autoRefresh);
        autoRefresh = setInterval(async () => {
            const active = document.querySelector('.tab.active');
            if (active && active.dataset.tab === 'stocks' && typeof window.renderStocks === 'function') {
                await window.refreshUser();
                await window.renderStocks();
            }
        }, 15000);
    }
    function stopAuto() { if (autoRefresh) clearInterval(autoRefresh); autoRefresh = null; }

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', async () => {
            const name = tab.dataset.tab;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            if (name === 'stocks') {
                startAuto();
                if (typeof window.renderStocks === 'function') await window.renderStocks();
            } else {
                stopAuto();
                if (name === 'profile' && typeof window.renderProfile === 'function') await window.renderProfile();
                else if (name === 'analytics' && typeof window.renderAnalytics === 'function') await window.renderAnalytics();
                else if (name === 'rating' && typeof window.renderRating === 'function') await window.renderRating();
                else if (name === 'wallet' && typeof window.renderWallet === 'function') await window.renderWallet();
                else if (name === 'referral' && typeof window.renderReferral === 'function') await window.renderReferral();
                else if (name === 'settings' && typeof window.renderSettings === 'function') await window.renderSettings();
                else if (name === 'admin' && typeof window.renderAdmin === 'function') await window.renderAdmin();
                else window.showModal('В разработке', 'Эта вкладка будет доступна позже');
            }
        });
    });

    window.setupRealtimeNotifications();
    await window.updateBellBadge();

    if (isNew) setTimeout(() => window.openAvatarSelector(), 500);
})();
