// rating.js – улучшенный рейтинг с аватарками, медалями и просмотром профиля

window.renderRatingTab = async function() {
    const currentUserId = window.userId;
    
    // Получаем всех пользователей, не скрытых из рейтинга, сортируем по акциям (убывание)
    const { data: allUsers, error } = await window.supabase
        .from('users')
        .select('id, username, shares, avatar_url')
        .eq('hide_rating', false)
        .order('shares', { ascending: false });
    
    if (error) {
        console.error(error);
        document.getElementById('app').innerHTML = '<div class="card error">Ошибка загрузки рейтинга</div>';
        return;
    }
    
    // Берём топ-100
    const topUsers = allUsers.slice(0, 100);
    
    // Находим место текущего пользователя среди всех (не только топ-100)
    let currentUserRank = null;
    if (currentUserId) {
        const idx = allUsers.findIndex(u => u.id === currentUserId);
        if (idx !== -1) currentUserRank = idx + 1;
    }
    
    // Рендерим список
    let html = `<div class="card"><h2 class="rating-title">🏆 Рейтинг держателей акций</h2>`;
    
    if (topUsers.length === 0) {
        html += '<p class="no-data">Нет данных</p>';
    } else {
        html += `<div class="rating-list">`;
        topUsers.forEach((user, index) => {
            const place = index + 1;
            let medalHtml = '';
            if (place === 1) medalHtml = '<span class="medal gold">🥇</span>';
            else if (place === 2) medalHtml = '<span class="medal silver">🥈</span>';
            else if (place === 3) medalHtml = '<span class="medal bronze">🥉</span>';
            else medalHtml = `<span class="rank-number">${place}</span>`;
            
            const avatar = user.avatar_url || '👤';
            const sharesFormatted = window.fromCents(user.shares);
            
            html += `
                <div class="rating-item" data-user-id="${user.id}">
                    <div class="rating-rank">${medalHtml}</div>
                    <div class="rating-avatar">${avatar}</div>
                    <div class="rating-info">
                        <div class="rating-username">${escapeHtml(user.username)}</div>
                        <div class="rating-shares">📊 ${sharesFormatted} акций</div>
                    </div>
                </div>
            `;
        });
        html += `</div>`;
    }
    
    // Собственный ранг (если пользователь в рейтинге)
    if (currentUserRank) {
        const currentUserData = allUsers.find(u => u.id === currentUserId);
        if (currentUserData) {
            const sharesFormatted = window.fromCents(currentUserData.shares);
            html += `
                <div class="my-rank-card">
                    <div class="my-rank-title">🎯 Ваше место</div>
                    <div class="my-rank-details">
                        <span class="my-rank-position">#${currentUserRank}</span>
                        <span class="my-rank-shares">📊 ${sharesFormatted} акций</span>
                    </div>
                </div>
            `;
        }
    } else if (currentUserId) {
        // Пользователь скрыл себя из рейтинга или ещё нет акций
        html += `<div class="my-rank-card"><div class="my-rank-title">🔒 Вы не отображаетесь в рейтинге</div></div>`;
    }
    
    html += `</div>`;
    document.getElementById('app').innerHTML = html;
    
    // Добавляем обработчики кликов на элементы рейтинга
    document.querySelectorAll('.rating-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.stopPropagation();
            const userId = parseInt(item.dataset.userId);
            if (userId && userId !== window.userId) {
                await showUserProfileModal(userId);
            } else if (userId === window.userId) {
                window.showCustomModal('Это вы', 'Это ваш профиль. Перейдите на вкладку "Профиль" для редактирования.');
            }
        });
    });
};

// Функция для отображения модалки с чужим профилем
async function showUserProfileModal(userId) {
    // Получаем данные пользователя
    const { data: user, error } = await window.supabase
        .from('users')
        .select('id, username, avatar_url, avatar_bg, avatar_border, shares, stars_balance, registered_at')
        .eq('id', userId)
        .single();
    
    if (error || !user) {
        window.showCustomModal('Ошибка', 'Не удалось загрузить профиль');
        return;
    }
    
    // Получаем статистику сделок
    const { data: trades, error: tradesError } = await window.supabase
        .from('trades')
        .select('amount, total_stars')
        .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`);
    
    let totalTrades = 0;
    let totalVolume = 0;
    if (trades && !tradesError) {
        totalTrades = trades.length;
        totalVolume = trades.reduce((sum, t) => sum + (t.total_stars / 100), 0).toFixed(2);
    }
    
    // Формируем стили аватара
    let bgStyle = '';
    if (user.avatar_bg && user.avatar_bg.startsWith('#')) {
        bgStyle = `background: ${user.avatar_bg};`;
    } else {
        const mapping = {
            'gradient1': '#2b6e9e', 'gradient2': '#9b59b6', 'gradient3': '#e67e22',
            'gradient4': '#27ae60', 'gradient5': '#f1c40f', 'gradient6': '#e74c3c',
            'gradient7': '#1abc9c', 'gradient8': '#3498db', 'gradient9': '#2c3e50',
            'gradient10': '#ff9a9e', 'gradient11': '#a18cd1'
        };
        bgStyle = `background: ${mapping[user.avatar_bg] || '#2b6e9e'};`;
    }
    const borderStyle = user.avatar_border ? `border: 3px solid ${user.avatar_border};` : '';
    const avatarEmojiStyle = `font-size: 48px; line-height: 1;`;
    
    const modalHtml = `
        <div class="modal" id="userProfileModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeProfileModal">&times;</span>
                <h3>👤 Профиль пользователя</h3>
                <div style="text-align:center; padding: 16px;">
                    <div class="avatar-circle" style="${bgStyle} ${borderStyle} width:88px; height:88px; display:flex; align-items:center; justify-content:center; margin:0 auto;">
                        <span class="avatar-emoji" style="${avatarEmojiStyle}">${user.avatar_url}</span>
                    </div>
                    <p style="font-size:20px; font-weight:bold; margin-top:8px;">${escapeHtml(user.username)}</p>
                    <p class="small-text">ID: ${user.id}</p>
                    <p class="small-text">📅 Регистрация: ${new Date(user.registered_at).toLocaleDateString()}</p>
                    <div class="stats-container" style="margin-top:16px;">
                        <div class="stats-row">
                            <div class="stat-card"><div class="stat-value">${window.fromCents(user.stars_balance)}</div><div class="stat-label">Stars</div></div>
                            <div class="stat-card"><div class="stat-value">${window.fromCents(user.shares)}</div><div class="stat-label">Акций</div></div>
                        </div>
                        <div class="stats-row">
                            <div class="stat-card"><div class="stat-value">${totalTrades}</div><div class="stat-label">Сделок</div></div>
                            <div class="stat-card"><div class="stat-value">${totalVolume}</div><div class="stat-label">Объём (⭐)</div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('closeProfileModal').onclick = () => {
        document.getElementById('userProfileModal').remove();
    };
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
