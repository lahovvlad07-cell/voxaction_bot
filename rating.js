// rating.js – никнейм слева, модалка как понравилось

let currentPage = 1;
const itemsPerPage = 10;
let allUsers = [];
let filteredUsers = [];
let totalPages = 1;
let currentSearchTerm = '';

async function fetchUserStats(userId) {
    try {
        const { data, error } = await window.supabase
            .from('trades')
            .select('amount, total_stars')
            .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`);
        if (error || !data) return { tradesCount: 0, volumeStars: 0 };
        const tradesCount = data.length;
        const volumeStars = data.reduce((sum, t) => sum + (t.total_stars / 100), 0);
        return { tradesCount, volumeStars };
    } catch (e) {
        return { tradesCount: 0, volumeStars: 0 };
    }
}

async function loadUsers() {
    const { data, error } = await window.supabase
        .from('users')
        .select('id, username, shares, avatar_url, avatar_bg, avatar_border, hide_rating, referral_count, selected_achievements')
        .eq('hide_rating', false)
        .order('shares', { ascending: false });
    if (error) throw error;

    const usersWithStats = [];
    for (const user of data) {
        const stats = await fetchUserStats(user.id);
        usersWithStats.push({
            ...user,
            tradesCount: stats.tradesCount,
            volumeStars: stats.volumeStars
        });
    }
    return usersWithStats;
}

function applyFilter() {
    if (!currentSearchTerm.trim()) {
        filteredUsers = [...allUsers];
    } else {
        const term = currentSearchTerm.toLowerCase();
        filteredUsers = allUsers.filter(u =>
            u.username && u.username.toLowerCase().includes(term)
        );
    }
    totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);
}

// Модалка профиля – просторная, со всеми данными
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

    const stats = await fetchUserStats(userId);
    const rank = filteredUsers.findIndex(u => u.id === userId) + 1;
    const rankText = rank > 0 ? `#${rank}` : '—';

    const avatarHtml = window.renderAvatarHtml
        ? window.renderAvatarHtml(user.avatar_url, user.avatar_bg, user.avatar_border, '80px')
        : `<div class="avatar-placeholder" style="width:80px; height:80px; background:#2b6e9e; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:48px;">${user.avatar_url || '👤'}</div>`;

    let achievementsHtml = '';
    if (user.selected_achievements && user.selected_achievements.length) {
        const { data: achievementsList } = await window.supabase
            .from('achievements')
            .select('id, icon')
            .in('id', user.selected_achievements.slice(0, 3));
        const achMap = new Map(achievementsList?.map(a => [a.id, a.icon]) || []);
        for (let i = 0; i < 3; i++) {
            const achId = user.selected_achievements[i];
            const icon = achMap.get(achId) || '❓';
            achievementsHtml += `<div class="achi-icon earned" title="Достижение">${icon}</div>`;
        }
    } else {
        for (let i = 0; i < 3; i++) achievementsHtml += `<div class="achi-icon">?</div>`;
    }

    const modalHtml = `
        <div class="modal" id="profileModal" style="display:flex;">
            <div class="modal-content" style="max-width: 360px; width: 90%;">
                <span class="close-modal" id="closeProfileModal">&times;</span>
                <div style="text-align: center; padding: 20px 0 10px;">
                    <div style="display: flex; justify-content: center;">${avatarHtml}</div>
                    <h3 style="margin: 14px 0 4px;">${escapeHtml(user.username)}</h3>
                    <div class="small-text">ID: ${user.id}</div>
                    <div class="small-text">📅 ${new Date(user.registered_at).toLocaleDateString()}</div>
                </div>
                <div class="achievement-icons" style="justify-content: center; gap: 16px; margin: 12px 0;">
                    ${achievementsHtml}
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; margin: 16px 0;">
                    <div class="stat-card" style="min-width: 90px;"><div class="stat-value">${window.fromCents(user.shares)}</div><div class="stat-label">Акций</div></div>
                    <div class="stat-card" style="min-width: 90px;"><div class="stat-value">${window.fromCents(user.stars_balance)}</div><div class="stat-label">Stars</div></div>
                    <div class="stat-card" style="min-width: 90px;"><div class="stat-value">${stats.tradesCount}</div><div class="stat-label">Сделок</div></div>
                    <div class="stat-card" style="min-width: 90px;"><div class="stat-value">${user.referral_count || 0}</div><div class="stat-label">Рефералов</div></div>
                </div>
                <div style="text-align: center; margin: 12px 0 8px;">
                    <div class="rank-card" style="background: rgba(0,0,0,0.3); border-radius: 40px; padding: 8px 16px; display: inline-block;">
                        ⚡ Рейтинг: ${rankText}
                    </div>
                </div>
                <div class="modal-buttons" style="margin-top: 20px;"><button id="closeProfileBtn">Закрыть</button></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('profileModal');
    document.getElementById('closeProfileModal').onclick = () => modal.remove();
    document.getElementById('closeProfileBtn').onclick = () => modal.remove();
}

function renderPage() {
    const container = document.getElementById('ratingListContainer');
    if (!container) return;

    const start = (currentPage - 1) * itemsPerPage;
    const pageUsers = filteredUsers.slice(start, start + itemsPerPage);

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

        const avatarHtml = window.renderAvatarHtml
            ? window.renderAvatarHtml(user.avatar_url, user.avatar_bg, user.avatar_border, '48px')
            : `<div class="avatar-placeholder">${user.avatar_url || '👤'}</div>`;

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
            <div class="rating-item ${currentUserClass}" data-user-id="${user.id}" style="animation: fadeInUp 0.2s ease forwards; animation-delay: ${i * 0.02}s;">
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

    const paginationDiv = document.getElementById('ratingPagination');
    if (totalPages > 1) {
        paginationDiv.innerHTML = `
            <div class="pagination-controls">
                <button class="pag-prev" ${currentPage === 1 ? 'disabled' : ''}>← Назад</button>
                <span class="pag-info">${currentPage} / ${totalPages}</span>
                <button class="pag-next" ${currentPage === totalPages ? 'disabled' : ''}>Вперёд →</button>
            </div>
        `;
        document.querySelector('.pag-prev')?.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderPage(); } });
        document.querySelector('.pag-next')?.addEventListener('click', () => { if (currentPage < totalPages) { currentPage++; renderPage(); } });
    } else {
        paginationDiv.innerHTML = '';
    }

    document.querySelectorAll('.rating-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.pag-prev') || e.target.closest('.pag-next')) return;
            const userId = parseInt(item.dataset.userId);
            if (userId === window.userId) document.querySelector('.tab[data-tab="profile"]').click();
            else showUserProfileModal(userId);
        });
    });
}

function updateMyRankCard() {
    const currentUserData = filteredUsers.find(u => u.id === window.userId);
    const myRankCard = document.getElementById('myRankCard');
    if (!myRankCard) return;
    if (currentUserData) {
        const rank = filteredUsers.findIndex(u => u.id === window.userId) + 1;
        const sharesFormatted = (currentUserData.shares / 100).toFixed(2);
        myRankCard.innerHTML = `
            <div class="my-rank-title">🎯 Ваше место</div>
            <div class="my-rank-details">
                <div class="my-rank-item">#<strong>${rank}</strong></div>
                <div class="my-rank-item">📊 <strong>${sharesFormatted}</strong></div>
                <div class="my-rank-item">🔄 <strong>${currentUserData.tradesCount}</strong></div>
                <div class="my-rank-item">👥 <strong>${currentUserData.referral_count || 0}</strong></div>
            </div>
        `;
    } else {
        myRankCard.innerHTML = `<div class="my-rank-title">❓ Пользователь не найден</div>`;
    }
}

window.renderRatingTab = async function() {
    try {
        document.getElementById('app').innerHTML = `
            <div class="card">
                <h2 class="rating-title">🏆 Рейтинг держателей акций</h2>
                <div class="rating-legend">
                    <span>📊 — акции</span>
                    <span>🔄 — сделки</span>
                    <span>👥 — рефералы</span>
                </div>
                <div class="search-container">
                    <input type="text" id="ratingSearchInput" placeholder="Поиск по имени..." class="search-input">
                </div>
                <div id="ratingListContainer">
                    ${Array(5).fill().map(() => `<div class="skeleton-item"><div class="skeleton-avatar"></div><div class="skeleton-line"></div></div>`).join('')}
                </div>
                <div id="ratingPagination"></div>
                <div id="myRankCard" class="my-rank-card"></div>
            </div>
        `;

        allUsers = await loadUsers();
        applyFilter();
        totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
        currentPage = 1;

        const searchInput = document.getElementById('ratingSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                currentSearchTerm = e.target.value;
                applyFilter();
                currentPage = 1;
                renderPage();
                updateMyRankCard();
            });
        }
        renderPage();
        updateMyRankCard();
    } catch (err) {
        console.error(err);
        document.getElementById('app').innerHTML = '<div class="card error">Ошибка загрузки рейтинга</div>';
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}
