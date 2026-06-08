// rating.js – финальная улучшенная версия

let currentPage = 1;
const itemsPerPage = 10;
let allUsers = [];
let filteredUsers = [];
let totalPages = 1;
let currentSearchTerm = '';
let maxShares = 0; // для прогресс-бара

// Загрузка статистики по сделкам для одного пользователя
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
        console.warn(e);
        return { tradesCount: 0, volumeStars: 0 };
    }
}

// Загрузка всех пользователей
async function loadUsers() {
    const { data, error } = await window.supabase
        .from('users')
        .select('id, username, shares, avatar_url, avatar_bg, avatar_border, hide_rating, referral_count')
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
            (u.username && u.username.toLowerCase().includes(term)) ||
            u.id.toString().includes(term)
        );
    }
    totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);
}

function renderPage() {
    const container = document.getElementById('ratingListContainer');
    if (!container) return;

    const start = (currentPage - 1) * itemsPerPage;
    const pageUsers = filteredUsers.slice(start, start + itemsPerPage);

    // Вычисляем максимальное количество акций для прогресс-бара (среди отфильтрованных)
    maxShares = filteredUsers.length > 0 ? Math.max(...filteredUsers.map(u => u.shares)) : 0;

    let html = '';
    for (let i = 0; i < pageUsers.length; i++) {
        const user = pageUsers[i];
        const globalIndex = filteredUsers.findIndex(u => u.id === user.id);
        const place = globalIndex + 1;

        // Медали для топ-3
        let rankDisplay = '';
        if (place === 1) rankDisplay = '<span class="medal gold">🥇</span>';
        else if (place === 2) rankDisplay = '<span class="medal silver">🥈</span>';
        else if (place === 3) rankDisplay = '<span class="medal bronze">🥉</span>';
        else rankDisplay = `<span class="rank-number">${place}</span>`;

        // Аватарка
        const avatarHtml = window.renderAvatarHtml
            ? window.renderAvatarHtml(user.avatar_url, user.avatar_bg, user.avatar_border, '52px')
            : `<div class="avatar-placeholder">${user.avatar_url || '👤'}</div>`;

        const sharesFormatted = (user.shares / 100).toFixed(2);
        const volumeFormatted = user.volumeStars.toFixed(2);
        
        // Прогресс-бар (процент от лидера)
        let progressPercent = 0;
        if (maxShares > 0) {
            progressPercent = (user.shares / maxShares) * 100;
        }
        const progressBarHtml = maxShares > 0 && user.shares > 0 ? `
            <div class="progress-bar-container">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
                <div class="progress-label">${progressPercent.toFixed(0)}% от лидера</div>
            </div>
        ` : '';

        const statsHtml = `
            <div class="rating-stats">
                <span class="rating-stat">🔄 ${user.tradesCount}</span>
                <span class="rating-stat">📊 ${volumeFormatted}</span>
                <span class="rating-stat">👥 ${user.referral_count || 0}</span>
            </div>
        `;

        const currentUserClass = (user.id === window.userId) ? 'current-user-row' : '';
        const animationDelay = i * 0.03;

        html += `
            <div class="rating-item ${currentUserClass}" data-user-id="${user.id}" style="animation: fadeInUp 0.3s ease forwards; animation-delay: ${animationDelay}s;">
                <div class="rating-rank">${rankDisplay}</div>
                <div class="rating-avatar">${avatarHtml}</div>
                <div class="rating-info">
                    <div class="rating-username">${escapeHtml(user.username)}</div>
                    <div class="rating-shares">📊 ${sharesFormatted} акций</div>
                    ${statsHtml}
                    ${progressBarHtml}
                </div>
            </div>
        `;
    }
    container.innerHTML = html;

    // Пагинация
    const paginationDiv = document.getElementById('ratingPagination');
    if (totalPages > 1) {
        paginationDiv.innerHTML = `
            <div class="pagination-controls">
                <button class="pag-prev" ${currentPage === 1 ? 'disabled' : ''}>← Назад</button>
                <span class="pag-info">${currentPage} / ${totalPages}</span>
                <button class="pag-next" ${currentPage === totalPages ? 'disabled' : ''}>Вперёд →</button>
            </div>
        `;
        const prevBtn = document.querySelector('.pag-prev');
        const nextBtn = document.querySelector('.pag-next');
        if (prevBtn) prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderPage(); } };
        if (nextBtn) nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderPage(); } };
    } else {
        paginationDiv.innerHTML = '';
    }

    // Клик по строке – открыть профиль
    document.querySelectorAll('.rating-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.pag-prev') || e.target.closest('.pag-next')) return;
            const userId = parseInt(item.dataset.userId);
            if (userId === window.userId) {
                document.querySelector('.tab[data-tab="profile"]').click();
            } else {
                if (typeof window.showUserProfile === 'function') {
                    window.showUserProfile(userId);
                } else {
                    window.showCustomModal('Информация', 'Просмотр профиля будет доступен позже');
                }
            }
        });
    });
}

function updateMyRankCard() {
    const currentUserData = filteredUsers.find(u => u.id === window.userId);
    const myRankCard = document.querySelector('.my-rank-card');
    if (!myRankCard) return;
    if (currentUserData) {
        const rank = filteredUsers.findIndex(u => u.id === window.userId) + 1;
        const sharesFormatted = (currentUserData.shares / 100).toFixed(2);
        myRankCard.innerHTML = `
            <div class="my-rank-title">🎯 Ваше место</div>
            <div class="my-rank-details">
                <span class="my-rank-position">#${rank}</span>
                <span class="my-rank-shares">📊 ${sharesFormatted} акций</span>
                <span class="my-rank-volume">📈 ${currentUserData.volumeStars.toFixed(2)} ⭐</span>
            </div>
        `;
    } else {
        myRankCard.innerHTML = `<div class="my-rank-title">🔒 Вы не отображаетесь в рейтинге</div>`;
    }
}

// Кнопка "Наверх"
function initScrollToTop() {
    const btn = document.getElementById('scrollToTopBtn');
    if (!btn) return;
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            btn.style.display = 'flex';
        } else {
            btn.style.display = 'none';
        }
    });
    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

window.renderRatingTab = async function() {
    try {
        // Показываем скелетон
        document.getElementById('app').innerHTML = `
            <div class="card">
                <h2 class="rating-title">🏆 Рейтинг держателей акций</h2>
                <div class="search-container">
                    <input type="text" id="ratingSearchInput" placeholder="Поиск по имени или ID..." class="search-input">
                </div>
                <div id="ratingListContainer">
                    ${Array(5).fill().map(() => `
                        <div class="skeleton-item">
                            <div class="skeleton-avatar"></div>
                            <div class="skeleton-line"></div>
                        </div>
                    `).join('')}
                </div>
                <div id="ratingPagination"></div>
                <button id="scrollToTopBtn" class="scroll-top-btn" style="display: none;">↑ Наверх</button>
            </div>
        `;

        allUsers = await loadUsers();
        applyFilter();
        totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
        currentPage = 1;

        let html = `
            <div class="card">
                <h2 class="rating-title">🏆 Рейтинг держателей акций</h2>
                <div class="search-container">
                    <input type="text" id="ratingSearchInput" placeholder="Поиск по имени или ID..." class="search-input">
                </div>
                <div id="ratingListContainer"></div>
                <div id="ratingPagination"></div>
        `;
        const currentUserData = filteredUsers.find(u => u.id === window.userId);
        if (currentUserData) {
            const rank = filteredUsers.findIndex(u => u.id === window.userId) + 1;
            const sharesFormatted = (currentUserData.shares / 100).toFixed(2);
            html += `
                <div class="my-rank-card">
                    <div class="my-rank-title">🎯 Ваше место</div>
                    <div class="my-rank-details">
                        <span class="my-rank-position">#${rank}</span>
                        <span class="my-rank-shares">📊 ${sharesFormatted} акций</span>
                        <span class="my-rank-volume">📈 ${currentUserData.volumeStars.toFixed(2)} ⭐</span>
                    </div>
                </div>
            `;
        } else if (window.userId) {
            html += `<div class="my-rank-card"><div class="my-rank-title">🔒 Вы не отображаетесь в рейтинге</div></div>`;
        }
        html += `<button id="scrollToTopBtn" class="scroll-top-btn" style="display: none;">↑ Наверх</button></div>`;
        document.getElementById('app').innerHTML = html;

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
        initScrollToTop();
    } catch (err) {
        console.error(err);
        document.getElementById('app').innerHTML = '<div class="card error">Ошибка загрузки рейтинга</div>';
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}
