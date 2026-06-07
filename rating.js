// rating.js – улучшенный рейтинг с медалями, аватарками и количеством акций

window.renderRatingTab = async function() {
    try {
        // Получаем пользователей, не скрытых из рейтинга, сортируем по акциям
        const { data: users, error } = await window.supabase
            .from('users')
            .select('id, username, shares, avatar_url')
            .eq('hide_rating', false)
            .order('shares', { ascending: false })
            .limit(100);
        
        if (error) throw error;
        
        let html = `<div class="card"><h2 class="rating-title">🏆 Рейтинг держателей акций</h2>`;
        
        if (!users || users.length === 0) {
            html += `<p class="no-data">Нет данных</p>`;
        } else {
            html += `<div class="rating-list">`;
            users.forEach((user, index) => {
                const place = index + 1;
                let medalHtml = '';
                if (place === 1) medalHtml = '<span class="medal gold">🥇</span>';
                else if (place === 2) medalHtml = '<span class="medal silver">🥈</span>';
                else if (place === 3) medalHtml = '<span class="medal bronze">🥉</span>';
                else medalHtml = `<span class="rank-number">${place}</span>`;
                
                const avatar = user.avatar_url || '👤';
                const sharesFormatted = (user.shares / 100).toFixed(2);
                
                html += `
                    <div class="rating-item">
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
        
        // Показываем место текущего пользователя (если он в списке)
        const currentUserId = window.userId;
        const currentUserData = users?.find(u => u.id === currentUserId);
        if (currentUserData) {
            const rank = users.findIndex(u => u.id === currentUserId) + 1;
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
        
    } catch (err) {
        console.error(err);
        document.getElementById('app').innerHTML = '<div class="card error">Ошибка загрузки рейтинга</div>';
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
