// rating.js – красивый рейтинг с аватарками, медалями, пагинацией и просмотром профиля

let currentPage = 1;
const itemsPerPage = 10;
let allUsers = [];
let totalPages = 1;

// Загрузка списка пользователей
async function loadUsers() {
    const { data, error } = await window.supabase
        .from('users')
        .select('id, username, shares, avatar_url, avatar_bg, avatar_border, hide_rating')
        .eq('hide_rating', false)
        .order('shares', { ascending: false });
    if (error) throw error;
    return data;
}

// Отрисовка текущей страницы
function renderPage() {
    const container = document.getElementById('ratingListContainer');
    if (!container) return;

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageUsers = allUsers.slice(start, end);

    let html = '';
    for (let i = 0; i < pageUsers.length; i++) {
        const user = pageUsers[i];
        const idx = allUsers.indexOf(user);
        const place = idx + 1;

        // Медали для топ-3
        let rankDisplay = '';
        if (place === 1) rankDisplay = '<span class="medal gold">🥇</span>';
        else if (place === 2) rankDisplay = '<span class="medal silver">🥈</span>';
        else if (place === 3) rankDisplay = '<span class="medal bronze">🥉</span>';
        else rankDisplay = `<span class="rank-number">${place}</span>`;

        // Аватарка с фоном и обводкой
        const avatarHtml = window.renderAvatarHtml
            ? window.renderAvatarHtml(user.avatar_url, user.avatar_bg, user.avatar_border, '52px')
            : `<div class="avatar-placeholder">${user.avatar_url || '👤'}</div>`;

        const sharesFormatted = (user.shares / 100).toFixed(2);

        html += `
            <div class="rating-item" data-user-id="${user.id}">
                <div class="rating-rank">${rankDisplay}</div>
                <div class="rating-avatar">${avatarHtml}</div>
                <div class="rating-info">
                    <div class="rating-username">${escapeHtml(user.username)}</div>
                    <div class="rating-shares">📊 ${sharesFormatted} акций</div>
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
        document.querySelector('.pag-prev')?.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                renderPage();
            }
        });
        document.querySelector('.pag-next')?.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderPage();
            }
        });
    } else {
        paginationDiv.innerHTML = '';
    }

    // Кликабельность строк
    document.querySelectorAll('.rating-item').forEach(item => {
        item.addEventListener('click', () => {
            const userId = parseInt(item.dataset.userId);
            if (userId === window.userId) {
                // Переход на свой профиль
                document.querySelector('.tab[data-tab="profile"]').click();
            } else {
                // Показ чужого профиля (если функция существует)
                if (typeof window.showUserProfile === 'function') {
                    window.showUserProfile(userId);
                } else {
                    window.showCustomModal('Информация', 'Просмотр профиля будет доступен позже');
                }
            }
        });
    });
}

// Основная функция рендеринга вкладки
window.renderRatingTab = async function() {
    try {
        allUsers = await loadUsers();
        totalPages = Math.ceil(allUsers.length / itemsPerPage);
        currentPage = 1;

        let html = `
            <div class="card">
                <h2 class="rating-title">🏆 Рейтинг держателей акций</h2>
                <div id="ratingListContainer"></div>
                <div id="ratingPagination"></div>
        `;

        // Карточка «Ваше место»
        const currentUserData = allUsers.find(u => u.id === window.userId);
        if (currentUserData) {
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
        } else if (window.userId) {
            html += `<div class="my-rank-card"><div class="my-rank-title">🔒 Вы не отображаетесь в рейтинге</div></div>`;
        }

        html += `</div>`;
        document.getElementById('app').innerHTML = html;
        renderPage();
    } catch (err) {
        console.error(err);
        document.getElementById('app').innerHTML = '<div class="card error">Ошибка загрузки рейтинга</div>';
    }
};

// Вспомогательная функция для экранирования HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}
