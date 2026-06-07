// rating.js – новая вкладка Рейтинг с аватарками, пагинацией, сортировкой, поиском и профилями

let currentRatingPage = 1;
const itemsPerPage = 10;
let allUsers = [];
let filteredUsers = [];
let currentSort = 'shares'; // shares, trades, volume, referrals
let sortOrder = 'desc';
let searchTerm = '';

// Функция загрузки списка пользователей (с дополнительной статистикой)
async function loadUsers() {
    const { data: users, error } = await window.supabase
        .from('users')
        .select('id, username, shares, avatar_url, avatar_bg, avatar_border, referral_count, hide_rating')
        .eq('hide_rating', false)
        .order('shares', { ascending: false });
    if (error) throw error;

    // Для каждого пользователя получим статистику сделок и объём
    const usersWithStats = await Promise.all(users.map(async (user) => {
        const { data: trades } = await window.supabase
            .from('trades')
            .select('amount, total_stars')
            .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`);
        const tradesCount = trades?.length || 0;
        const volume = trades?.reduce((sum, t) => sum + (t.total_stars / 100), 0) || 0;
        return { ...user, tradesCount, volume };
    }));
    return usersWithStats;
}

// Рендер списка (пагинация, сортировка, фильтрация)
function renderList() {
    let filtered = [...allUsers];
    if (searchTerm) {
        filtered = filtered.filter(u => u.username.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    // Сортировка
    filtered.sort((a, b) => {
        let aVal, bVal;
        switch (currentSort) {
            case 'shares': aVal = a.shares; bVal = b.shares; break;
            case 'trades': aVal = a.tradesCount; bVal = b.tradesCount; break;
            case 'volume': aVal = a.volume; bVal = b.volume; break;
            case 'referrals': aVal = a.referral_count || 0; bVal = b.referral_count || 0; break;
            default: aVal = a.shares; bVal = b.shares;
        }
        if (sortOrder === 'desc') return bVal - aVal;
        else return aVal - bVal;
    });
    filteredUsers = filtered;
    totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    if (currentRatingPage > totalPages) currentRatingPage = 1;
    renderPage();
}

// Рендер текущей страницы
function renderPage() {
    const start = (currentRatingPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageUsers = filteredUsers.slice(start, end);
    const container = document.getElementById('ratingListContainer');
    if (!container) return;

    let html = '';
    pageUsers.forEach((user, idx) => {
        const globalIndex = filteredUsers.indexOf(user);
        const place = globalIndex + 1;
        let medalHtml = '';
        if (place === 1) medalHtml = '<span class="medal gold">🥇</span>';
        else if (place === 2) medalHtml = '<span class="medal silver">🥈</span>';
        else if (place === 3) medalHtml = '<span class="medal bronze">🥉</span>';
        else medalHtml = `<span class="rank-number">${place}</span>`;

        const avatarHtml = window.renderAvatarHtml(user.avatar_url, user.avatar_bg, user.avatar_border, '52px');
        const sharesFormatted = (user.shares / 100).toFixed(2);
        const tradesCount = user.tradesCount;
        const volumeFormatted = user.volume.toFixed(2);
        const referrals = user.referral_count || 0;

        html += `
            <div class="rating-item" data-user-id="${user.id}">
                <div class="rating-rank">${medalHtml}</div>
                <div class="rating-avatar">${avatarHtml}</div>
                <div class="rating-info">
                    <div class="rating-username">${escapeHtml(user.username)}</div>
                    <div class="rating-stats">
                        <span>📊 ${sharesFormatted} акций</span>
                        <span>🔄 ${tradesCount} сделок</span>
                        <span>💎 ${volumeFormatted} ⭐</span>
                        <span>👥 ${referrals} реф.</span>
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;

    // Пагинация
    const paginationDiv = document.getElementById('ratingPagination');
    if (totalPages > 1) {
        paginationDiv.innerHTML = `
            <div class="pagination-controls">
                <button class="pag-prev" ${currentRatingPage === 1 ? 'disabled' : ''}>← Назад</button>
                <span class="pag-info">${currentRatingPage} / ${totalPages}</span>
                <button class="pag-next" ${currentRatingPage === totalPages ? 'disabled' : ''}>Вперёд →</button>
            </div>
        `;
        document.querySelector('.pag-prev')?.addEventListener('click', () => {
            if (currentRatingPage > 1) {
                currentRatingPage--;
                renderPage();
            }
        });
        document.querySelector('.pag-next')?.addEventListener('click', () => {
            if (currentRatingPage < totalPages) {
                currentRatingPage++;
                renderPage();
            }
        });
    } else {
        paginationDiv.innerHTML = '';
    }

    // Обработчики кликов
    document.querySelectorAll('.rating-item').forEach(item => {
        item.addEventListener('click', () => {
            const userId = parseInt(item.dataset.userId);
            if (userId === window.userId) {
                document.querySelector('.tab[data-tab="profile"]').click();
            } else {
                window.showUserProfile(userId);
            }
        });
    });
}

// Отрисовка всей вкладки (шапка, панель сортировки, поиск, список)
window.renderRatingTab = async function() {
    try {
        allUsers = await loadUsers();
        totalPages = 1;
        currentRatingPage = 1;
        renderList();

        let html = `
            <div class="card">
                <div class="rating-header">
                    <h2 class="rating-title">🏆 Рейтинг держателей акций</h2>
                    <div class="rating-controls">
                        <div class="sort-buttons">
                            <button class="sort-btn ${currentSort === 'shares' ? 'active' : ''}" data-sort="shares">По акциям</button>
                            <button class="sort-btn ${currentSort === 'trades' ? 'active' : ''}" data-sort="trades">По сделкам</button>
                            <button class="sort-btn ${currentSort === 'volume' ? 'active' : ''}" data-sort="volume">По объёму</button>
                            <button class="sort-btn ${currentSort === 'referrals' ? 'active' : ''}" data-sort="referrals">По рефералам</button>
                        </div>
                        <div class="order-buttons">
                            <button class="order-btn ${sortOrder === 'desc' ? 'active' : ''}" data-order="desc">↓ По убыванию</button>
                            <button class="order-btn ${sortOrder === 'asc' ? 'active' : ''}" data-order="asc">↑ По возрастанию</button>
                        </div>
                        <div class="search-box">
                            <input type="text" id="ratingSearchInput" placeholder="🔍 Поиск по имени..." value="${escapeHtml(searchTerm)}">
                        </div>
                    </div>
                </div>
                <div id="ratingListContainer"></div>
                <div id="ratingPagination"></div>
        `;
        const currentUserData = allUsers.find(u => u.id === window.userId);
        if (currentUserData && !currentUserData.hide_rating) {
            const rank = allUsers.findIndex(u => u.id === window.userId) + 1;
            const sharesFormatted = (currentUserData.shares / 100).toFixed(2);
            html += `
                <div class="my-rank-card">
                    <div class="my-rank-title">🎯 Ваше место</div>
                    <div class="my-rank-details">
                        <span class="my-rank-position">#${rank}</span>
                        <span class="my-rank-shares">📊 ${sharesFormatted} акций</span>
                    </div>
                </div>
            `;
        } else {
            html += `<div class="my-rank-card"><div class="my-rank-title">🔒 Вы не отображаетесь в рейтинге</div></div>`;
        }
        html += `</div>`;
        document.getElementById('app').innerHTML = html;

        // Привязка событий
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                currentSort = btn.dataset.sort;
                currentRatingPage = 1;
                renderList();
                renderRatingTab(); // обновим активные кнопки
            });
        });
        document.querySelectorAll('.order-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                sortOrder = btn.dataset.order;
                currentRatingPage = 1;
                renderList();
                renderRatingTab();
            });
        });
        const searchInput = document.getElementById('ratingSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                searchTerm = e.target.value;
                currentRatingPage = 1;
                renderList();
                renderRatingTab();
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
