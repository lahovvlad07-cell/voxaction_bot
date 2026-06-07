// rating.js – простой и надёжный рейтинг с аватарками и пагинацией

let currentPage = 1;
const itemsPerPage = 10;
let allUsers = [];
let totalPages = 1;

// Простая функция для отображения аватарки (чтобы не зависеть от других файлов)
function renderAvatarSimple(avatarUrl, avatarBg, avatarBorder, size = '52px') {
    const emoji = avatarUrl || '👤';
    let bgColor = '#2b6e9e';
    if (avatarBg) {
        if (avatarBg.startsWith('#')) bgColor = avatarBg;
        else {
            const map = {
                'gradient1': '#2b6e9e', 'gradient2': '#9b59b6', 'gradient3': '#e67e22',
                'gradient4': '#27ae60', 'gradient5': '#f1c40f', 'gradient6': '#e74c3c',
                'gradient7': '#1abc9c', 'gradient8': '#3498db', 'gradient9': '#2c3e50',
                'gradient10': '#ff9a9e', 'gradient11': '#a18cd1'
            };
            bgColor = map[avatarBg] || '#2b6e9e';
        }
    }
    const border = avatarBorder || '#ffffff';
    const fontSize = parseInt(size) * 0.7 + 'px';
    return `<div class="avatar-circle" style="width: ${size}; height: ${size}; background: ${bgColor}; border: 3px solid ${border}; display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;"><span class="avatar-emoji" style="font-size: ${fontSize};">${emoji}</span></div>`;
}

async function loadUsers() {
    const { data, error } = await window.supabase
        .from('users')
        .select('id, username, shares, avatar_url, avatar_bg, avatar_border, hide_rating')
        .eq('hide_rating', false)
        .order('shares', { ascending: false });
    if (error) throw error;
    return data;
}

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
        let medalHtml = '';
        if (place === 1) medalHtml = '<span class="medal gold">🥇</span>';
        else if (place === 2) medalHtml = '<span class="medal silver">🥈</span>';
        else if (place === 3) medalHtml = '<span class="medal bronze">🥉</span>';
        else medalHtml = `<span class="rank-number">${place}</span>`;

        const avatarHtml = renderAvatarSimple(user.avatar_url, user.avatar_bg, user.avatar_border, '52px');
        const sharesFormatted = (user.shares / 100).toFixed(2);

        html += `
            <div class="rating-item" data-user-id="${user.id}">
                <div class="rating-rank">${medalHtml}</div>
                <div class="rating-avatar">${avatarHtml}</div>
                <div class="rating-info">
                    <div class="rating-username">${escapeHtml(user.username)}</div>
                    <div class="rating-shares">📊 ${sharesFormatted} акций</div>
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

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}

// Для совместимости с другими файлами, если требуется
if (!window.renderAvatarHtml) window.renderAvatarHtml = renderAvatarSimple;
