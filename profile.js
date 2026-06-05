// profile.js — исправлен: горизонтальный скролл достижений, улучшенный выбор, чистый дизайн
window.renderProfile = async () => {
    const stats = await window.getUserStats();
    const earned = await window.getEarnedAchievements();
    const selectedIds = window.currentUser.selected_achievements || [];
    const icons = [];
    for(let i = 0; i < 3; i++) {
        const ach = earned.find(a => a.id === selectedIds[i]);
        icons.push(ach ? `<div class="achi-icon earned" data-slot="${i}" data-ach-id="${ach.id}">${ach.icon}</div>` : `<div class="achi-icon" data-slot="${i}">?</div>`);
    }
    const rank = await window.getUserRank();
    const rankHtml = rank ? `<div class="rank-card"><span>🔴 Рейтинг</span><span class="rank-number">#${rank}</span></div>` : '';
    
    // Ближайшие достижения — горизонтальный скролл
    const nextList = await window.getNextProgress();
    let nextHtml = '';
    if (nextList.length) {
        nextHtml = `<div class="next-achievements-wrapper"><div class="small-text section-title">📋 Ближайшие достижения:</div>
                    <div class="next-achievements horizontal-scroll">`;
        for(let a of nextList) {
            let cond = '';
            switch(a.condition_type){
                case 'trades_count': cond = `${a.cur}/${a.need} сделок`; break;
                case 'shares_held': cond = `${(a.cur/100).toFixed(2)}/${(a.need/100).toFixed(2)} акций`; break;
                case 'referrals_count': cond = `${a.cur}/${a.need} приглашений`; break;
                case 'total_topup': cond = `${(a.cur/100).toFixed(2)}/${(a.need/100).toFixed(2)} ⭐`; break;
            }
            nextHtml += `<div class="next-achievement-item">
                            <div class="next-achieve-icon">${a.icon}</div>
                            <div class="next-achieve-progress">
                                <div class="progress-label">${cond}</div>
                                <div class="progress-bar"><div class="progress-fill" style="width:${a.prog}%"></div></div>
                            </div>
                         </div>`;
        }
        nextHtml += `</div></div>`;
    }
    
    // Аватар и фон
    let avatarClass = 'avatar-circle';
    let avatarStyle = '';
    if (window.currentUser.avatar_bg && window.currentUser.avatar_bg.startsWith('#')) {
        avatarStyle = `background: ${window.currentUser.avatar_bg};`;
    } else {
        const found = window.bgOptions.find(b => b.id === window.currentUser.avatar_bg);
        avatarClass += found ? ` ${found.class}` : ' bg-gradient1';
    }
    const emojiStyle = window.getAvatarStyle(window.currentUser.avatar_url);
    const regDate = window.currentUser.registered_at ? new Date(window.currentUser.registered_at).toLocaleDateString() : 'неизвестно';
    
    const html = `<div class="card profile-card">
        <div class="bell-wrapper">
            <div class="notification-bell" id="notificationBell">🔔<span class="notification-badge" style="display:none">0</span></div>
        </div>
        <div class="profile-avatar" id="avatarClick">
            <div class="${avatarClass}" style="${avatarStyle}"><span class="avatar-emoji" style="${emojiStyle}">${window.currentUser.avatar_url}</span></div>
            <div class="small-text hint-text">Нажмите, чтобы сменить аватар и фон</div>
        </div>
        <p class="username">${window.currentUser.username}</p>
        <p class="small-text">ID: ${window.userId}</p>
        <p class="small-text">📅 Регистрация: ${regDate}</p>
        
        <div class="achievement-icons">${icons.join('')}</div>
        <div class="small-text hint-text">Нажмите на значок, чтобы выбрать/убрать достижение</div>
        
        <div class="stats-container">
            <div class="stats-row">
                <div class="stat-card"><div class="stat-value">${window.fromCents(window.currentUser.stars_balance)}</div><div class="stat-label">Stars</div></div>
                <div class="stat-card"><div class="stat-value">${window.fromCents(window.currentUser.shares)}</div><div class="stat-label">Акций</div></div>
            </div>
            <div class="stats-row">
                <div class="stat-card"><div class="stat-value">${stats.totalTrades}</div><div class="stat-label">Сделок</div></div>
                <div class="stat-card"><div class="stat-value">${stats.totalVolume.toFixed(2)}</div><div class="stat-label">Объём (⭐)</div></div>
            </div>
        </div>
        ${rankHtml}
        ${nextHtml}
    </div>`;
    
    document.getElementById('app').innerHTML = html;
    
    // Обработчики
    document.getElementById('avatarClick')?.addEventListener('click', window.openAvatar);
    document.getElementById('notificationBell')?.addEventListener('click', window.showNotificationsModal);
    document.querySelectorAll('.achi-icon').forEach(icon => {
        icon.addEventListener('click', async () => {
            const slot = parseInt(icon.dataset.slot);
            const curId = icon.dataset.achId ? parseInt(icon.dataset.achId) : null;
            await window.openAchievementSelector(slot, earned, selectedIds, curId);
        });
    });
    await window.updateBellBadge();
};
