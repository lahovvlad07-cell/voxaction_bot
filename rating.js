// rating.js – рейтинг с аватарками, медалями и просмотром профиля

window.renderRatingTab = async function() {
    const currentUserId = window.userId;
    if (!currentUserId) return;
    
    try {
        // Получаем всех пользователей, не скрытых из рейтинга
        const { data: allUsers, error } = await window.supabase
            .from('users')
            .select('id, username, shares, avatar_url, avatar_bg, avatar_border, stars_balance, registered_at')
            .eq('hide_rating', false)
            .order('shares', { ascending: false });
        
        if (error) throw error;
        
        // Топ-100
        const topUsers = allUsers.slice(0, 100);
        
        // Находим место текущего пользователя
        let currentUserRank = null;
        const currentUserData = allUsers.find(u => u.id === currentUserId);
        if (currentUserData) {
            currentUserRank = allUsers.findIndex(u => u.id === currentUserId) + 1;
        }
        
        let html = `<div class="card"><h2 class="rating-title">🏆 Рейтинг держателей акций</h2>`;
        
        if (topUsers.length === 0) {
            html += '<p class="no-data">Нет данных</p>';
        } else {
            html += `<div class="rating-list">`;
            for (let i = 0; i < topUsers.length; i++) {
                const user = topUsers[i];
                const place = i + 1;
                
                // Медальки или номер
                let medalHtml = '';
                if (place === 1) medalHtml = '<span class="medal gold">🥇</span>';
                else if (place === 2) medalHtml = '<span class="medal silver">🥈</span>';
                else if (place === 3) medalHtml = '<span class="medal bronze">🥉</span>';
                else medalHtml = `<span class="rank-number">${place}</span>`;
                
                const avatar = user.avatar_url || '👤';
                const sharesFormatted = window.fromCents(user.shares);
                const username = escapeHtml(user.username);
                
                html += `
                    <div class="rating-item" data-user-id="${user.id}">
                        <div class="rating-rank">${medalHtml}</div>
                        <div class="rating-avatar">${avatar}</div>
                        <div class="rating-info">
                            <div class="rating-username">${username}</div>
                            <div class="rating-shares">📊 ${sharesFormatted} акций</div>
                        </div>
                    </div>
                `;
            }
            html += `</div>`;
        }
        
        // Блок "Ваше место"
        if (currentUserRank && currentUserData) {
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
        } else if (currentUserId && !currentUserData) {
            html += `<div class="my-rank-card"><div class="my-rank-title">🔒 Вы не отображаетесь в рейтинге</div></div>`;
        }
        
        html += `</div>`;
        document.getElementById('app').innerHTML = html;
        
        // Обработчики кликов
        document.querySelectorAll('.rating-item').forEach(item => {
            item.addEventListener('click', async (e) => {
                e.stopPropagation();
                const userId = parseInt(item.dataset.userId);
                if (userId && userId !== currentUserId) {
                    await showUserProfileModal(userId);
                } else if (userId === currentUserId) {
                    window.showCustomModal('Это вы', 'Ваш профиль можно редактировать на вкладке "Профиль".');
                }
            });
        });
        
    } catch (err) {
        console.error(err);
        document.getElementById('app').innerHTML = '<div class="card error">Ошибка загрузки рейтинга</div>';
    }
};

// Показ профиля пользователя (модалка)
async function showUserProfileModal(userId) {
    try {
        const { data: user, error } = await window.supabase
            .from('users')
            .select('id, username, avatar_url, avatar_bg, avatar_border, shares, stars_balance, registered_at')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        
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
        
        // Стили для аватара
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
        
        const modalHtml = `
            <div class="modal" id="userProfileModal" style="display:flex;">
                <div class="modal-content">
                    <span class="close-modal" id="closeProfileModal">&times;</span>
                    <h3>👤 Профиль пользователя</h3>
                    <div style="text-align:center; padding: 16px;">
                        <div class="avatar-circle" style="${bgStyle} ${borderStyle} width:88px; height:88px; display:flex; align-items:center; justify-content:center; margin:0 auto;">
                            <span class="avatar-emoji" style="font-size:48px; line-height:1;">${user.avatar_url}</span>
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
    } catch (err) {
        console.error(err);
        window.showCustomModal('Ошибка', 'Не удалось загрузить профиль');
    }
}

// Вспомогательная функция
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
