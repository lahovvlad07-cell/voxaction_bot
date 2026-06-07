// rating.js – улучшенный рейтинг с аватарами, пагинацией и просмотром профиля + тестовая кнопка

let currentRatingPage = 1;
const ratingItemsPerPage = 10;
let fullRatingList = [];
let totalRatingPages = 0;

async function loadRatingPage(page) {
    const container = document.getElementById('ratingListContainer');
    if (!container) return;

    const start = (page - 1) * ratingItemsPerPage;
    const end = start + ratingItemsPerPage;
    const pageUsers = fullRatingList.slice(start, end);

    let html = '';
    for (let i = 0; i < pageUsers.length; i++) {
        const user = pageUsers[i];
        const idx = fullRatingList.indexOf(user);
        const place = idx + 1;
        let medalHtml = '';
        if (place === 1) medalHtml = '<span class="medal gold">🥇</span>';
        else if (place === 2) medalHtml = '<span class="medal silver">🥈</span>';
        else if (place === 3) medalHtml = '<span class="medal bronze">🥉</span>';
        else medalHtml = `<span class="rank-number">${place}</span>`;

        const avatarHtml = window.renderAvatarHtml(user.avatar_url, user.avatar_bg, user.avatar_border, '48px');
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
    if (totalRatingPages > 1) {
        paginationDiv.innerHTML = `
            <div class="pagination-controls">
                <button class="pag-prev" ${page === 1 ? 'disabled' : ''}>← Назад</button>
                <span class="pag-info">${page} / ${totalRatingPages}</span>
                <button class="pag-next" ${page === totalRatingPages ? 'disabled' : ''}>Вперёд →</button>
            </div>
        `;
        document.querySelector('.pag-prev')?.addEventListener('click', () => {
            if (currentRatingPage > 1) {
                currentRatingPage--;
                loadRatingPage(currentRatingPage);
            }
        });
        document.querySelector('.pag-next')?.addEventListener('click', () => {
            if (currentRatingPage < totalRatingPages) {
                currentRatingPage++;
                loadRatingPage(currentRatingPage);
            }
        });
    } else {
        paginationDiv.innerHTML = '';
    }

    document.querySelectorAll('.rating-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
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
        const { data: users, error } = await window.supabase
            .from('users')
            .select('id, username, shares, avatar_url, avatar_bg, avatar_border')
            .eq('hide_rating', false)
            .order('shares', { ascending: false })
            .limit(100);
        if (error) throw error;

        fullRatingList = users || [];
        totalRatingPages = Math.ceil(fullRatingList.length / ratingItemsPerPage);
        currentRatingPage = 1;

        let html = `
            <div class="card">
                <h2 class="rating-title">🏆 Рейтинг держателей акций</h2>
                <div id="ratingListContainer"></div>
                <div id="ratingPagination"></div>
        `;
        const currentUserId = window.userId;
        const currentUserData = fullRatingList.find(u => u.id === currentUserId);
        if (currentUserData) {
            const rank = fullRatingList.findIndex(u => u.id === currentUserId) + 1;
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
        } else if (currentUserId) {
            html += `<div class="my-rank-card"><div class="my-rank-title">🔒 Вы не отображаетесь в рейтинге</div></div>`;
        }
        html += `</div>`;
        document.getElementById('app').innerHTML = html;

        await loadRatingPage(1);
    } catch (err) {
        console.error(err);
        document.getElementById('app').innerHTML = '<div class="card error">Ошибка загрузки рейтинга</div>';
    }
};

window.renderAvatarHtml = function(avatarUrl, avatarBg, avatarBorder, size = '48px') {
    const emoji = avatarUrl || '👤';
    const adjustments = {
        '🐱':-8,'🐶':-8,'🐼':-7,'🦊':-5,'⚽':-3,'💎':-3,'🌸':-3,'🔥':-3,'🎉':-3,'🌟':-3,'🍕':-3,'🏆':-3,
        '🎨':-3,'📷':-3,'⚡':-3,'🔮':-3,'🚀':-3,'🎮':-3
    };
    const fontSizeMap = {
        '⚡':'56px','🔮':'56px','🎮':'56px','🚀':'56px','⭐':'56px','🌟':'56px','🔥':'56px','💎':'56px',
        '🎉':'56px','⚽':'56px','📷':'56px','🎨':'56px'
    };
    const adjust = adjustments[emoji] || 0;
    const fontSize = fontSizeMap[emoji] || (parseInt(size) * 0.8) + 'px';
    const emojiStyle = `transform: translateY(${adjust}px); font-size: ${fontSize}; line-height: 1; display: inline-block;`;

    let bgStyle = '';
    if (avatarBg && avatarBg.startsWith('#')) {
        bgStyle = `background: ${avatarBg};`;
    } else {
        const mapping = {
            'gradient1': '#2b6e9e', 'gradient2': '#9b59b6', 'gradient3': '#e67e22',
            'gradient4': '#27ae60', 'gradient5': '#f1c40f', 'gradient6': '#e74c3c',
            'gradient7': '#1abc9c', 'gradient8': '#3498db', 'gradient9': '#2c3e50',
            'gradient10': '#ff9a9e', 'gradient11': '#a18cd1'
        };
        bgStyle = `background: ${mapping[avatarBg] || '#2b6e9e'};`;
    }
    const borderStyle = `border: 3px solid ${avatarBorder || '#ffffff'}; box-shadow: 0 2px 6px rgba(0,0,0,0.2);`;

    return `<div class="avatar-circle" style="width: ${size}; height: ${size}; ${bgStyle} ${borderStyle} display: inline-flex; align-items: center; justify-content: center; border-radius: 50%;"><span class="avatar-emoji" style="${emojiStyle}">${emoji}</span></div>`;
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}

window.showUserProfile = async function(userId) {
    try {
        const { data: userData, error: userError } = await window.supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        if (userError) throw userError;

        const earnedAchievements = await window.getEarnedAchievementsForUser(userId);
        const selectedIds = userData.selected_achievements || [];
        const stats = await window.getUserStatsForUser(userId);
        const rank = await window.getUserRankForUser(userId);
        const avatarHtml = window.renderAvatarHtml(userData.avatar_url, userData.avatar_bg, userData.avatar_border, '88px');

        let iconsHtml = '';
        for (let i = 0; i < 3; i++) {
            const achId = selectedIds[i];
            const ach = earnedAchievements.find(a => a.id === achId);
            if (ach) {
                iconsHtml += `<div class="achi-icon earned" title="${ach.name}: ${ach.description}">${ach.icon}</div>`;
            } else {
                iconsHtml += `<div class="achi-icon">?</div>`;
            }
        }

        const registeredDate = userData.registered_at ? new Date(userData.registered_at).toLocaleDateString() : 'неизвестно';

        const html = `
            <div class="card" style="text-align: center;">
                <div style="margin-bottom: 8px;">${avatarHtml}</div>
                <p style="font-size:20px; font-weight:bold; margin-top:8px;">${escapeHtml(userData.username)}</p>
                <p class="small-text">ID: ${userId}</p>
                <p class="small-text">📅 Регистрация: ${registeredDate}</p>
                <div class="achievement-icons">${iconsHtml}</div>
                <div class="stats-container">
                    <div class="stats-row">
                        <div class="stat-card"><div class="stat-value">${window.fromCents(userData.stars_balance)}</div><div class="stat-label">Stars</div></div>
                        <div class="stat-card"><div class="stat-value">${window.fromCents(userData.shares)}</div><div class="stat-label">Акций</div></div>
                    </div>
                    <div class="stats-row">
                        <div class="stat-card"><div class="stat-value">${stats.totalTrades}</div><div class="stat-label">Сделок</div></div>
                        <div class="stat-card"><div class="stat-value">${stats.totalVolume.toFixed(2)}</div><div class="stat-label">Объём (⭐)</div></div>
                    </div>
                </div>
                ${rank ? `<div class="rank-card"><span>🏆 Рейтинг</span><span style="font-size:20px; font-weight:bold;">#${rank}</span></div>` : ''}
                <button id="backToRatingBtn" class="secondary" style="margin-top: 16px;">← Назад к рейтингу</button>
            </div>
        `;
        document.getElementById('app').innerHTML = html;
        document.getElementById('backToRatingBtn').addEventListener('click', () => {
            window.renderRatingTab();
        });
    } catch (err) {
        console.error(err);
        window.showCustomModal('Ошибка', 'Не удалось загрузить профиль пользователя');
        window.renderRatingTab();
    }
};

// ===== ВРЕМЕННАЯ ТЕСТОВАЯ КНОПКА (удалить после проверки) =====
setTimeout(() => {
    const testBtn = document.createElement('button');
    testBtn.innerText = '🧪 Тест (новый rating.js)';
    testBtn.style.position = 'fixed';
    testBtn.style.bottom = '80px';
    testBtn.style.right = '10px';
    testBtn.style.zIndex = '9999';
    testBtn.style.background = '#ff4444';
    testBtn.style.color = 'white';
    testBtn.style.padding = '8px 12px';
    testBtn.style.borderRadius = '40px';
    testBtn.style.fontSize = '12px';
    testBtn.style.border = 'none';
    testBtn.style.cursor = 'pointer';
    testBtn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    testBtn.onclick = () => alert('✅ Новый rating.js работает!');
    document.body.appendChild(testBtn);
}, 2000);
