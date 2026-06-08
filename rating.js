// rating.js – улучшенная версия (аватарки, сортировка, бесконечная прокрутка)
let allUsers = [];
let filteredUsers = [];
let currentSort = 'shares'; // shares, trades, referrals
let currentPage = 1;
const itemsPerPage = 20;
let isLoading = false;
let hasMore = true;
let currentSearchTerm = '';

async function fetchAllUsersWithStats() {
    // Получаем всех пользователей, не скрытых
    const { data: users, error: usersError } = await window.supabase
        .from('users')
        .select('id, username, shares, avatar_url, avatar_bg, avatar_border, hide_rating, referral_count')
        .eq('hide_rating', false)
        .order('shares', { ascending: false });
    if (usersError) throw usersError;

    // Получаем агрегированную статистику сделок одним запросом
    const userIds = users.map(u => u.id);
    if (userIds.length === 0) return [];
    const { data: trades, error: tradesError } = await window.supabase
        .from('trades')
        .select('buyer_id, seller_id, total_stars')
        .or(`buyer_id.in.(${userIds.join(',')}),seller_id.in.(${userIds.join(',')})`);
    if (tradesError) throw tradesError;

    // Агрегируем
    const statsMap = new Map();
    users.forEach(u => statsMap.set(u.id, { tradesCount: 0, volumeStars: 0 }));
    for (let t of trades) {
        if (statsMap.has(t.buyer_id)) {
            statsMap.get(t.buyer_id).tradesCount++;
            statsMap.get(t.buyer_id).volumeStars += t.total_stars / 100;
        }
        if (t.seller_id !== t.buyer_id && statsMap.has(t.seller_id)) {
            statsMap.get(t.seller_id).tradesCount++;
            statsMap.get(t.seller_id).volumeStars += t.total_stars / 100;
        }
    }

    return users.map(u => ({
        ...u,
        tradesCount: statsMap.get(u.id).tradesCount,
        volumeStars: statsMap.get(u.id).volumeStars
    }));
}

function applySortAndFilter() {
    let filtered = [...allUsers];
    if (currentSearchTerm.trim()) {
        const term = currentSearchTerm.toLowerCase();
        filtered = filtered.filter(u => u.username && u.username.toLowerCase().includes(term));
    }
    // Сортировка
    if (currentSort === 'shares') {
        filtered.sort((a, b) => b.shares - a.shares);
    } else if (currentSort === 'trades') {
        filtered.sort((a, b) => b.tradesCount - a.tradesCount);
    } else if (currentSort === 'referrals') {
        filtered.sort((a, b) => (b.referral_count || 0) - (a.referral_count || 0));
    }
    filteredUsers = filtered;
    hasMore = filteredUsers.length > itemsPerPage;
    currentPage = 1;
}

function renderPage() {
    const container = document.getElementById('ratingListContainer');
    if (!container) return;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageUsers = filteredUsers.slice(start, end);
    if (pageUsers.length === 0 && currentPage === 1) {
        container.innerHTML = '<div class="empty-rating">Нет пользователей</div>';
        return;
    }

    let html = '';
    for (let i = 0; i < pageUsers.length; i++) {
        const user = pageUsers[i];
        const globalIndex = filteredUsers.findIndex(u => u.id === user.id);
        const place = globalIndex + 1;

        let rankDisplay = '';
        if (place === 1) rankDisplay = '<span class="medal gold">🥇</span>';
        else if (place === 2) rankDisplay = '<span class="medal silver">🥈</span>';
        else if (place === 3) rankDisplay = '<span class="medal bronze">🥉</span>';
        else rankDisplay = `<span class="rank-number">${place}</span>`;

        const avatarHtml = window.renderAvatarHtml(user.avatar_url, user.avatar_bg, user.avatar_border, '48px');
        const sharesFormatted = (user.shares / 100).toFixed(2);
        const statsHtml = `
            <div class="rating-stats">
                <div class="rating-stat">📊 <span>${sharesFormatted}</span></div>
                <div class="rating-stat">🔄 <span>${user.tradesCount}</span></div>
                <div class="rating-stat">👥 <span>${user.referral_count || 0}</span></div>
            </div>
        `;
        const currentUserClass = (user.id === window.userId) ? 'current-user-row' : '';

        html += `
            <div class="rating-item ${currentUserClass}" data-user-id="${user.id}" data-username="${escapeHtml(user.username)}" data-shares="${user.shares}" data-trades="${user.tradesCount}" data-refs="${user.referral_count || 0}" data-avatar-url="${user.avatar_url}" data-avatar-bg="${user.avatar_bg}" data-avatar-border="${user.avatar_border}" style="animation: fadeInUp 0.2s ease forwards; animation-delay: ${i * 0.02}s;">
                <div class="rating-rank">${rankDisplay}</div>
                <div class="rating-avatar">${avatarHtml}</div>
                <div class="rating-info">
                    <div class="rating-username">${escapeHtml(user.username)}</div>
                    ${statsHtml}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;

    // Обработчики клика для открытия модалки профиля
    document.querySelectorAll('.rating-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.pag-prev') || e.target.closest('.pag-next')) return;
            const userId = parseInt(item.dataset.userId);
            if (userId === window.userId) {
                document.querySelector('.tab[data-tab="profile"]').click();
            } else {
                showUserProfileModal(userId);
            }
        });
    });
}

async function loadMore() {
    if (isLoading || !hasMore) return;
    isLoading = true;
    const nextPage = currentPage + 1;
    const start = (nextPage - 1) * itemsPerPage;
    if (start < filteredUsers.length) {
        currentPage = nextPage;
        renderPage();
    } else {
        hasMore = false;
    }
    isLoading = false;
}

// Модалка профиля (улучшенная, скрытый ID)
async function showUserProfileModal(userId) {
    const { data: user, error } = await window.supabase
        .from('users')
        .select('id, username, shares, stars_balance, avatar_url, avatar_bg, avatar_border, referral_count, registered_at, selected_achievements')
        .eq('id', userId)
        .single();
    if (error || !user) {
        window.showCustomModal('Ошибка', 'Не удалось загрузить профиль');
        return;
    }

    const stats = await window.getUserStatsForUser(userId);
    const rank = filteredUsers.findIndex(u => u.id === userId) + 1;
    const rankText = rank > 0 ? `#${rank}` : '—';
    const avatarHtml = window.renderAvatarHtml(user.avatar_url, user.avatar_bg, user.avatar_border, '80px');
    const hiddenId = `••• ${user.id.toString().slice(-4)}`;

    // Загружаем три выбранных достижения (если есть)
    let achievementsHtml = '';
    const selectedIds = user.selected_achievements || [];
    if (selectedIds.length) {
        const { data: achievementsList } = await window.supabase
            .from('achievements')
            .select('id, icon')
            .in('id', selectedIds.slice(0, 3));
        const achMap = new Map(achievementsList?.map(a => [a.id, a.icon]) || []);
        for (let i = 0; i < 3; i++) {
            const achId = selectedIds[i];
            const icon = achMap.get(achId) || '❓';
            achievementsHtml += `<div class="achi-icon earned" title="Достижение">${icon}</div>`;
        }
    } else {
        for (let i = 0; i < 3; i++) achievementsHtml += `<div class="achi-icon">?</div>`;
    }

    const modalHtml = `
        <div class="modal" id="profileModal" style="display:flex;">
            <div class="modal-content" style="max-width: 360px; width: 90%; max-height: 85vh; overflow-y: auto; padding-bottom: 20px;">
                <span class="close-modal" id="closeProfileModal">&times;</span>
                <div style="text-align: center; padding: 20px 0 10px;">
                    <div style="display: flex; justify-content: center;">${avatarHtml}</div>
                    <h3 style="margin: 14px 0 4px;">${escapeHtml(user.username)}</h3>
                    <div class="small-text">ID: ${hiddenId}</div>
                    <div class="small-text">📅 ${new Date(user.registered_at).toLocaleDateString()}</div>
                </div>
                <div class="achievement-icons" style="display: flex; justify-content: center; gap: 16px; margin: 12px 0; flex-wrap: wrap;">
                    ${achievementsHtml}
                </div>
                <div style="text-align: center; margin: 8px 0 12px;">
                    <div class="rank-card" style="background: rgba(0,0,0,0.3); border-radius: 40px; padding: 6px 12px; display: inline-block;">
                        ⚡ Рейтинг: ${rankText}
                    </div>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; margin: 16px 0;">
                    <div class="stat-card" style="min-width: 90px;"><div class="stat-value">${window.fromCents(user.shares)}</div><div class="stat-label">Акций</div></div>
                    <div class="stat-card" style="min-width: 90px;"><div class="stat-value">${window.fromCents(user.stars_balance)}</div><div class="stat-label">Stars</div></div>
                    <div class="stat-card" style="min-width: 90px;"><div class="stat-value">${stats.totalTrades}</div><div class="stat-label">Сделок</div></div>
                    <div class="stat-card" style="min-width: 90px;"><div class="stat-value">${user.referral_count || 0}</div><div class="stat-label">Рефералов</div></div>
                </div>
                <div class="modal-buttons" style="margin-top: 20px;"><button id="closeProfileBtn">Закрыть</button></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('profileModal');
    document.getElementById('closeProfileModal').onclick = () => modal.remove();
    document.getElementById('closeProfileBtn').onclick = () => modal.remove();
    // Закрытие по клику вне модалки
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

function updateMyRankCard() {
    const myCard = document.getElementById('myRankCard');
    if (!myCard) return;
    const currentUserData = filteredUsers.find(u => u.id === window.userId);
    if (!currentUserData) {
        myCard.innerHTML = `<div class="my-rank-card"><div class="my-rank-title">❌ Вы не найдены в рейтинге</div></div>`;
        return;
    }
    const rank = filteredUsers.findIndex(u => u.id === window.userId) + 1;
    const sharesFormatted = (currentUserData.shares / 100).toFixed(2);
    // Находим следующего пользователя впереди (с большим количеством акций)
    let nextUser = null;
    let diff = 0;
    if (rank > 1) {
        const nextIndex = rank - 2; // индекс в массиве filteredUsers (0-based)
        nextUser = filteredUsers[nextIndex];
        if (nextUser) {
            diff = nextUser.shares - currentUserData.shares;
        }
    }
    const progressPercent = nextUser ? (currentUserData.shares / nextUser.shares) * 100 : 100;
    const needShares = diff > 0 ? (diff / 100).toFixed(2) : 0;
    myCard.innerHTML = `
        <div class="my-rank-card">
            <div class="my-rank-title">🎯 Ваше место</div>
            <div class="my-rank-details">
                <div class="my-rank-item">#<strong>${rank}</strong></div>
                <div class="my-rank-item">📊 <strong>${sharesFormatted}</strong></div>
                <div class="my-rank-item">🔄 <strong>${currentUserData.tradesCount}</strong></div>
                <div class="my-rank-item">👥 <strong>${currentUserData.referral_count || 0}</strong></div>
            </div>
            ${nextUser ? `
                <div class="progress-to-next" style="margin-top: 12px;">
                    <div class="small-text">До места #${rank-1}: <strong>${needShares} акций</strong></div>
                    <div class="progress-bar"><div class="progress-fill" style="width: ${Math.min(100, progressPercent)}%;"></div></div>
                </div>
            ` : '<div class="small-text" style="margin-top: 8px;">🥇 Вы лидер!</div>'}
        </div>
    `;
}

// Бесконечная прокрутка
function setupInfiniteScroll() {
    const container = document.getElementById('ratingListContainer');
    if (!container) return;
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
            loadMore();
        }
    }, { threshold: 0.5, rootMargin: '100px' });
    const sentinel = document.createElement('div');
    sentinel.id = 'rating-sentinel';
    sentinel.style.height = '10px';
    container.parentNode.insertBefore(sentinel, container.nextSibling);
    observer.observe(sentinel);
}

window.renderRatingTab = async function() {
    try {
        document.getElementById('app').innerHTML = `
            <div class="card">
                <h2 class="rating-title">🏆 Рейтинг держателей акций</h2>
                <div class="sort-buttons">
                    <button class="sort-btn ${currentSort === 'shares' ? 'active' : ''}" data-sort="shares">📊 По акциям</button>
                    <button class="sort-btn ${currentSort === 'trades' ? 'active' : ''}" data-sort="trades">🔄 По сделкам</button>
                    <button class="sort-btn ${currentSort === 'referrals' ? 'active' : ''}" data-sort="referrals">👥 По рефералам</button>
                </div>
                <div class="search-container">
                    <input type="text" id="ratingSearchInput" placeholder="Поиск по имени..." class="search-input">
                </div>
                <div id="ratingListContainer">
                    <div class="skeleton-item"><div class="skeleton-avatar"></div><div class="skeleton-line"></div></div>
                    <div class="skeleton-item"><div class="skeleton-avatar"></div><div class="skeleton-line"></div></div>
                    <div class="skeleton-item"><div class="skeleton-avatar"></div><div class="skeleton-line"></div></div>
                </div>
                <div id="myRankCard"></div>
            </div>
        `;

        // Загружаем пользователей
        allUsers = await fetchAllUsersWithStats();
        applySortAndFilter();
        renderPage();
        updateMyRankCard();
        setupInfiniteScroll();

        // Обработчики сортировки
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                currentSort = btn.dataset.sort;
                document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                applySortAndFilter();
                renderPage();
                updateMyRankCard();
            });
        });

        // Поиск
        const searchInput = document.getElementById('ratingSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentSearchTerm = e.target.value;
                applySortAndFilter();
                renderPage();
                updateMyRankCard();
            });
        }
    } catch (err) {
        console.error(err);
        document.getElementById('app').innerHTML = '<div class="card error">Ошибка загрузки рейтинга</div>';
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}
