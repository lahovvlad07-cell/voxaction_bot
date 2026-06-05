// profile.js
window.renderProfile = async () => {
    const stats = await window.getUserStats();
    const earned = await window.getEarnedAchievements();
    const selectedIds = window.currentUser.selected_achievements || [];
    const icons = [];
    for (let i = 0; i < 3; i++) {
        const ach = earned.find(a => a.id === selectedIds[i]);
        icons.push(ach ? `<div class="achi-icon earned" data-slot="${i}" data-ach-id="${ach.id}" title="${ach.name}: ${ach.description}">${ach.icon}</div>` : `<div class="achi-icon" data-slot="${i}">?</div>`);
    }
    const rank = await window.getUserRank();
    const rankHtml = rank ? `<div class="rank-card"><span>🏆 Рейтинг</span><span style="font-size:20px;font-weight:bold">#${rank}</span></div>` : '';
    const nextList = await window.getNextProgress();
    let nextHtml = '';
    if (nextList.length) {
        nextHtml = `<div class="next-achievements"><div class="small-text" style="margin-bottom:8px">📋 Ближайшие достижения:</div>`;
        for (let a of nextList) {
            let cond = '';
            switch(a.condition_type){
                case 'trades_count': cond = `${a.cur}/${a.need} сделок`; break;
                case 'shares_held': cond = `${a.cur/100}/${a.need/100} акций`; break;
                case 'referrals_count': cond = `${a.cur}/${a.need} приглашений`; break;
                case 'total_topup': cond = `${a.cur/100}/${a.need/100} ⭐`; break;
            }
            nextHtml += `<div class="next-achievement-item"><div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:28px">${a.icon}</span><span class="small-text">${cond}</span></div><div class="progress-bar"><div class="progress-fill" style="width:${a.prog}%"></div></div></div>`;
        }
        nextHtml += `</div>`;
    }
    let avatarClass = 'avatar-circle';
    let avatarStyle = '';
    if (window.currentUser.avatar_bg && window.currentUser.avatar_bg.startsWith('#')) avatarStyle = `background:${window.currentUser.avatar_bg};`;
    else {
        const found = window.bgOptions.find(b => b.id === window.currentUser.avatar_bg);
        avatarClass += ` ${found ? found.class : 'bg-gradient1'}`;
    }
    const emojiStyle = window.getAvatarStyle(window.currentUser.avatar_url);
    const regDate = window.currentUser.registered_at ? new Date(window.currentUser.registered_at).toLocaleDateString() : 'неизвестно';
    const html = `<div class="card" style="text-align:center">
        <div style="position:absolute;top:12px;right:16px"><div class="notification-bell" id="notificationBell">🔔<span class="notification-badge" style="display:none">0</span></div></div>
        <div class="profile-avatar" id="avatarClick"><div class="${avatarClass}" style="${avatarStyle}"><span class="avatar-emoji" style="${emojiStyle}">${window.currentUser.avatar_url}</span></div><div class="small-text">Нажмите, чтобы сменить аватар и фон</div></div>
        <p style="font-size:20px;font-weight:bold">${window.currentUser.username}</p><p class="small-text">ID: ${window.userId}</p><p class="small-text">📅 Регистрация: ${regDate}</p>
        <div class="achievement-icons">${icons.join('')}</div><div class="small-text">Нажмите на значок, чтобы выбрать/убрать достижение</div>
        <div class="stats-container"><div class="stats-row"><div class="stat-card"><div class="stat-value">${window.fromCents(window.currentUser.stars_balance)}</div><div class="stat-label">Stars</div></div><div class="stat-card"><div class="stat-value">${window.fromCents(window.currentUser.shares)}</div><div class="stat-label">Акций</div></div></div><div class="stats-row"><div class="stat-card"><div class="stat-value">${stats.totalTrades}</div><div class="stat-label">Сделок</div></div><div class="stat-card"><div class="stat-value">${stats.totalVolume.toFixed(2)}</div><div class="stat-label">Объём (⭐)</div></div></div></div>
        ${rankHtml}${nextHtml}
    </div>`;
    document.getElementById('app').innerHTML = html;
    document.getElementById('avatarClick')?.addEventListener('click', window.openAvatarSelector);
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

window.openAchievementSelector = async (slot, earned, selectedIds, curId) => {
    if (!earned.length) { window.showModal('Достижения', 'У вас пока нет достижений'); return; }
    const other = selectedIds.filter((_,i) => i !== slot);
    const grid = earned.map(ach => {
        const isSel = (curId === ach.id);
        const disabled = other.includes(ach.id);
        return `<div class="achievement-card ${isSel?'selected':''} ${disabled?'disabled':''}" data-id="${ach.id}" style="background:rgba(0,0,0,.3);border-radius:18px;padding:10px;text-align:center;cursor:pointer;border:1px solid transparent;${disabled?'opacity:0.4':''}"><div class="achievement-icon" style="font-size:28px">${ach.icon}</div><div class="achievement-name" style="font-weight:600;font-size:13px">${ach.name}</div><div class="achievement-desc" style="font-size:10px;color:#9ca3af">${ach.description}</div><div class="achievement-date" style="font-size:10px;color:#9ca3af">🏅 Получено: ${new Date(ach.earned_at).toLocaleString()}</div></div>`;
    }).join('');
    const html = `<div class="modal" style="display:flex"><div class="modal-content"><span class="close-modal">&times;</span><h3>Выберите достижение для слота ${slot+1}</h3><div class="achievements-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:16px 0">${grid}</div>${curId ? '<button id="clearSlot" class="secondary">🗑️ Очистить слот</button>' : ''}<button id="saveSlot">Сохранить</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const m = document.body.lastElementChild;
    m.querySelector('.close-modal').onclick = () => m.remove();
    if (curId) m.querySelector('#clearSlot').onclick = async () => {
        let newSel = [...selectedIds];
        newSel[slot] = null;
        newSel = newSel.filter(v => v !== null);
        await window.supabase.from('users').update({ selected_achievements: newSel }).eq('id', window.userId);
        window.currentUser.selected_achievements = newSel;
        m.remove();
        await window.renderProfile();
    };
    m.querySelector('#saveSlot').onclick = async () => {
        const selected = m.querySelector('.achievement-card.selected:not(.disabled)');
        let newSel = [...selectedIds];
        if (selected) newSel[slot] = parseInt(selected.dataset.id);
        newSel = newSel.filter(v => v !== null && v !== undefined);
        await window.supabase.from('users').update({ selected_achievements: newSel }).eq('id', window.userId);
        window.currentUser.selected_achievements = newSel;
        m.remove();
        await window.renderProfile();
    };
    m.querySelectorAll('.achievement-card').forEach(card => {
        card.addEventListener('click', () => {
            if (card.classList.contains('disabled')) { window.showModal('Недоступно', 'Это достижение уже используется в другом слоте'); return; }
            m.querySelectorAll('.achievement-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });
};
