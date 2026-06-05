// profile.js — современный профиль с прогресс-барами достижений
window.renderProfile = async () => {
    const stats = await window.getUserStats();
    const earned = await window.getEarnedAchievements(); // список заработанных достижений (из БД)
    const selectedIds = window.currentUser.selected_achievements || [];
    
    // Три слота для выбранных достижений (иконки)
    const icons = [];
    for(let i = 0; i < 3; i++) {
        const ach = earned.find(a => a.id === selectedIds[i]);
        icons.push(ach ? `<div class="achi-icon earned" data-slot="${i}" data-ach-id="${ach.id}">${ach.icon}</div>` : `<div class="achi-icon" data-slot="${i}">?</div>`);
    }
    
    // Рейтинг
    const rank = await window.getUserRank();
    const rankHtml = rank ? `<div class="rank-badge" style="background:rgba(0,0,0,0.4); border-radius:40px; padding:6px 16px; display:inline-block; margin:8px auto; color:#f97316; border:1px solid #f97316;">🔴 Рейтинг #${rank}</div>` : '';
    
    // ----- Достижения с прогресс-барами (три основных) -----
    const mainAchievements = [
        { name: 'Сделки', icon: '📈', type: 'trades_count', need: 1, desc: 'Совершить 1 сделку' },
        { name: 'Трейдер', icon: '🔄', type: 'trades_count', need: 10, desc: 'Совершить 10 сделок' },
        { name: 'Капиталист', icon: '🏦', type: 'shares_held', need: 10000, desc: 'Накопить 100 акций' } // 10000 центов = 100 акций
    ];
    
    // Текущие значения
    let currentTrades = stats.totalTrades;
    let currentShares = window.currentUser.shares / 100; // в штуках
    
    function getProgress(ach) {
        let cur = 0, need = ach.need;
        if (ach.type === 'trades_count') cur = currentTrades;
        else if (ach.type === 'shares_held') cur = currentShares;
        let percent = Math.min(100, (cur / need) * 100);
        let completed = cur >= need;
        return { cur, need, percent, completed };
    }
    
    let allCompleted = true;
    const achievementsWithProgress = mainAchievements.map(ach => {
        const prog = getProgress(ach);
        if (!prog.completed) allCompleted = false;
        return { ...ach, ...prog };
    });
    
    let achievementsHtml = '';
    if (allCompleted) {
        achievementsHtml = `
            <div class="achievement-big-complete">
                <div class="big-icon">🏆</div>
                <div class="big-title">Абсолютный чемпион</div>
                <div class="progress-bar big-bar"><div class="progress-fill" style="width:100%"></div></div>
                <div class="big-check">✅ Все достижения получены!</div>
            </div>
        `;
    } else {
        achievementsHtml = `<div class="achievements-list-vertical">`;
        for (let ach of achievementsWithProgress) {
            const checkMark = ach.completed ? '✅' : '❌';
            const curDisplay = ach.type === 'trades_count' ? Math.floor(ach.cur) : ach.cur.toFixed(2);
            const needDisplay = ach.type === 'trades_count' ? ach.need : ach.need.toFixed(2);
            const unit = ach.type === 'trades_count' ? 'сделок' : 'акций';
            achievementsHtml += `
                <div class="achievement-progress-item">
                    <div class="ach-progress-icon">${ach.icon}</div>
                    <div class="ach-progress-info">
                        <div class="ach-progress-name">${ach.name} ${checkMark}</div>
                        <div class="ach-progress-desc">${ach.desc}</div>
                        <div class="progress-bar"><div class="progress-fill" style="width:${ach.percent}%"></div></div>
                        <div class="ach-progress-stats">${curDisplay} / ${needDisplay} ${unit}</div>
                    </div>
                </div>
            `;
        }
        achievementsHtml += `</div>`;
    }
    
    // Аватар (временно статический, но можно расширить)
    let avatarClass = 'avatar-circle';
    let avatarBg = '';
    if (window.currentUser.avatar_bg) {
        if (window.currentUser.avatar_bg.startsWith('#')) avatarBg = `background: ${window.currentUser.avatar_bg};`;
        else avatarBg = ''; // можно добавить градиент
    }
    const regDate = window.currentUser.registered_at ? new Date(window.currentUser.registered_at).toLocaleDateString() : 'неизвестно';
    
    const html = `
        <div class="card profile-card" style="text-align:center;">
            <div class="profile-avatar" id="avatarClick">
                <div class="${avatarClass}" style="${avatarBg}"><span class="avatar-emoji">👤</span></div>
                <div class="small-text hint-text">Нажмите, чтобы сменить аватар и фон</div>
            </div>
            <p class="username">${window.currentUser.username}</p>
            <p class="small-text">ID: ${window.userId} | 📅 Регистрация: ${regDate}</p>
            <div class="selected-achievements-area">
                <div class="small-text" style="margin-bottom:8px;">Нажмите на значок, чтобы выбрать/убрать достижение</div>
                <div class="achievement-icons">${icons.join('')}</div>
            </div>
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
            <div class="achievements-progress-section">
                <div class="section-title">🏅 Прогресс достижений</div>
                ${achievementsHtml}
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    
    // Обработчики
    document.getElementById('avatarClick')?.addEventListener('click', () => {
        // Здесь можно открыть выбор аватара/фона (если реализовано в common.js)
        if (window.openAvatar) window.openAvatar();
        else window.showModal('Аватар', 'Изменить аватар можно позже');
    });
    
    // Клик по иконкам выбранных достижений (открыть модалку выбора)
    document.querySelectorAll('.achi-icon').forEach(icon => {
        icon.addEventListener('click', async () => {
            const slot = parseInt(icon.dataset.slot);
            const curId = icon.dataset.achId ? parseInt(icon.dataset.achId) : null;
            // Используем функцию из common.js (openAchievementSelector)
            if (window.openAchievementSelector) {
                await window.openAchievementSelector(slot, earned, selectedIds, curId);
            } else {
                window.showModal('Достижения', 'Функция выбора временно недоступна');
            }
        });
    });
};
