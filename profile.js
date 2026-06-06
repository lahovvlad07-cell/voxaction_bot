// profile.js - Все функции, связанные с профилем (без колокольчика)

const avatarEmojis = [
    '👤', '😀', '😎', '🐱', '🐶', '🦊', '🐼', '⭐', '🎮', '⚽',
    '🚀', '💎', '🌸', '🔥', '❤️', '👍', '🎉', '🌟', '🍕', '🏆',
    '🎨', '📷', '⚡', '🔮'
];

const avatarAdjustments = {
    '🐱': -8, '🐶': -8, '🐼': -7, '🦊': -5,
    '⚽': -3, '💎': -3, '🌸': -3, '🔥': -3,
    '🎉': -3, '🌟': -3, '🍕': -3, '🏆': -3,
    '🎨': -3, '📷': -3, '⚡': -3, '🔮': -3,
    '🚀': -3, '🎮': -3
};

const avatarFontSizes = {
    '⚡': '56px', '🔮': '56px', '🎮': '56px', '🚀': '56px',
    '⭐': '56px', '🌟': '56px', '🔥': '56px', '💎': '56px',
    '🎉': '56px', '⚽': '56px', '📷': '56px', '🎨': '56px'
};

const bgOptions = [
    { id: 'gradient1', name: 'Синий', class: 'bg-gradient1', isCustom: false },
    { id: 'gradient2', name: 'Фиолетовый', class: 'bg-gradient2', isCustom: false },
    { id: 'gradient3', name: 'Оранжевый', class: 'bg-gradient3', isCustom: false },
    { id: 'gradient4', name: 'Зелёный', class: 'bg-gradient4', isCustom: false },
    { id: 'gradient5', name: 'Жёлтый', class: 'bg-gradient5', isCustom: false },
    { id: 'gradient6', name: 'Красный', class: 'bg-gradient6', isCustom: false },
    { id: 'gradient7', name: 'Бирюзовый', class: 'bg-gradient7', isCustom: false },
    { id: 'gradient8', name: 'Лазурный', class: 'bg-gradient8', isCustom: false },
    { id: 'gradient9', name: 'Тёмный', class: 'bg-gradient9', isCustom: false },
    { id: 'gradient10', name: 'Розовый', class: 'bg-gradient10', isCustom: false },
    { id: 'gradient11', name: 'Лаванда', class: 'bg-gradient11', isCustom: false },
    { id: 'custom', name: '🎨 Свой цвет', class: '', isCustom: true }
];

function getAvatarStyle(emoji) {
    const adjust = avatarAdjustments[emoji] || 0;
    const fontSize = avatarFontSizes[emoji] || '48px';
    return `transform: translateY(${adjust}px); font-size: ${fontSize};`;
}

async function awardAvatarAchievement(supabase, userId, showCustomModal) {
    try {
        const { data: achData } = await supabase
            .from('achievements')
            .select('id')
            .eq('name', '🎨 Стилист')
            .single();
        if (!achData) return;
        const { data: existing } = await supabase
            .from('user_achievements')
            .select('achievement_id')
            .eq('user_id', userId)
            .eq('achievement_id', achData.id)
            .maybeSingle();
        if (!existing) {
            await supabase.from('user_achievements').insert({ user_id: userId, achievement_id: achData.id, earned_at: new Date().toISOString() });
            showCustomModal('🎉 Новое достижение!', 'Вы получили достижение "🎨 Стилист" за выбор аватарки или фона!');
        }
    } catch(e) { console.error(e); }
}

async function getNextAchievementsProgress(supabase, userId, currentUser, getUserStats, getAllAchievements, getEarnedAchievements) {
    const allAchievements = await getAllAchievements();
    const earned = await getEarnedAchievements();
    const earnedIds = new Set(earned.map(a => a.id));
    const ignoreNames = ['🌟 Первый шаг', '🎨 Стилист', '✅ Абсолютный чемпион'];
    const notEarned = allAchievements.filter(a => !earnedIds.has(a.id) && !ignoreNames.includes(a.name));
    if (notEarned.length === 0) return [];

    const tradesCount = (await getUserStats()).totalTrades;
    const sharesCents = currentUser.shares;
    const referralsCount = currentUser.referral_count || 0;
    const totalTopupCents = currentUser.total_topup || 0;

    const nextAchievements = [];
    for (let ach of notEarned) {
        let current = 0, needed = ach.condition_value;
        switch (ach.condition_type) {
            case 'trades_count': current = tradesCount; break;
            case 'shares_held': current = sharesCents; break;
            case 'referrals_count': current = referralsCount; break;
            case 'total_topup': current = totalTopupCents; break;
            default: continue;
        }
        if (current < needed) {
            nextAchievements.push({ ...ach, current, needed, progress: Math.min(100, (current / needed) * 100) });
        }
        if (nextAchievements.length >= 3) break;
    }
    return nextAchievements;
}

async function openAvatarSelector(supabase, userId, currentUser, updateUserCallback, awardAvatarAchievement, openBackgroundSelector, showCustomModal) {
    const currentAvatar = currentUser.avatar_url || '👤';
    const optionsHtml = avatarEmojis.map(emoji => {
        const isSelected = (emoji === currentAvatar);
        const style = getAvatarStyle(emoji);
        return `<div class="avatar-option ${isSelected ? 'selected' : ''}" data-avatar="${emoji}"><span class="avatar-emoji" style="${style}">${emoji}</span></div>`;
    }).join('');
    const modalHtml = `<div class="modal" id="avatarModal" style="display:flex;"><div class="modal-content"><span class="close-modal" id="closeAvatarModal">&times;</span><h3>Выберите аватар</h3><div class="avatars-grid">${optionsHtml}</div><button id="nextToBgBtn">Далее → выбор фона</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('closeAvatarModal').onclick = () => document.getElementById('avatarModal').remove();
    let selectedAvatar = currentAvatar;
    document.querySelectorAll('.avatar-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedAvatar = opt.dataset.avatar;
        });
    });
    document.getElementById('nextToBgBtn').onclick = async () => {
        await updateUserCallback({ avatar_url: selectedAvatar });
        currentUser.avatar_url = selectedAvatar;
        document.getElementById('avatarModal').remove();
        await awardAvatarAchievement();
        await openBackgroundSelector();
    };
}

async function openBackgroundSelector(supabase, userId, currentUser, updateUserCallback, awardAvatarAchievement, renderProfileTab, showCustomModal) {
    const currentBg = currentUser.avatar_bg || 'gradient1';
    let optionsHtml = '';
    for (let bg of bgOptions) {
        if (!bg.isCustom) {
            const isSelected = (currentBg === bg.id);
            optionsHtml += `<div class="bg-option ${bg.class} ${isSelected ? 'selected' : ''}" data-bg="${bg.id}" style="width:65px; height:65px; border-radius:50%; margin:0 auto;"></div>`;
        } else {
            const isCustomSelected = (currentBg && currentBg.startsWith('#'));
            optionsHtml += `
                <div class="custom-color-preview ${isCustomSelected ? 'selected' : ''}" data-bg="custom" style="background: ${isCustomSelected ? currentBg : '#2b6e9e'}; display: flex; align-items: center; justify-content: center;">
                    🎨
                </div>
            `;
        }
    }
    const modalHtml = `<div class="modal" id="bgModal" style="display:flex;"><div class="modal-content"><span class="close-modal" id="closeBgModal">&times;</span><h3>Выберите фон аватарки</h3><div class="bg-grid">${optionsHtml}</div><button id="saveBgBtn">Сохранить</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('closeBgModal').onclick = () => document.getElementById('bgModal').remove();

    let selectedBgValue = currentBg;
    document.querySelectorAll('.bg-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.bg-option, .custom-color-preview').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedBgValue = opt.dataset.bg;
        });
    });
    const customDiv = document.querySelector('.custom-color-preview');
    if (customDiv) {
        customDiv.addEventListener('click', async () => {
            const colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.value = (selectedBgValue && selectedBgValue.startsWith('#')) ? selectedBgValue : '#2b6e9e';
            colorInput.addEventListener('input', (e) => {
                const newColor = e.target.value;
                customDiv.style.background = newColor;
                selectedBgValue = newColor;
                document.querySelectorAll('.bg-option, .custom-color-preview').forEach(o => o.classList.remove('selected'));
                customDiv.classList.add('selected');
            });
            colorInput.click();
        });
    }

    document.getElementById('saveBgBtn').onclick = async () => {
        await updateUserCallback({ avatar_bg: selectedBgValue });
        currentUser.avatar_bg = selectedBgValue;
        document.getElementById('bgModal').remove();
        await awardAvatarAchievement();
        await renderProfileTab();
    };
}

async function openAchievementSelectorForSlot(slot, earnedAchievements, currentSelectedIds, currentSlotAchievementId, updateUserCallback, currentUser, renderProfileTab, showCustomModal, supabase, userId) {
    if (!earnedAchievements.length) {
        showCustomModal('Достижения', 'У вас пока нет заработанных достижений.\nСовершайте сделки, пополняйте баланс и приглашайте друзей!');
        return;
    }
    const otherSelected = currentSelectedIds.filter((_, idx) => idx !== slot);
    const isSlotOccupied = currentSlotAchievementId !== null;
    const gridHtml = earnedAchievements.map(ach => {
        const isSelected = (currentSlotAchievementId === ach.id);
        const isUsedElsewhere = otherSelected.includes(ach.id);
        const disabledClass = isUsedElsewhere ? 'disabled' : '';
        const selectedClass = isSelected ? 'selected' : '';
        const earnedDate = ach.earned_at ? new Date(ach.earned_at).toLocaleString() : 'дата не указана';
        let conditionText = '';
        const hideCondition = ach.name === '🌟 Первый шаг' || ach.name === '🎨 Стилист' || ach.name === '✅ Абсолютный чемпион';
        if (!hideCondition && ach.condition_type !== 'all_achievements') {
            switch(ach.condition_type) {
                case 'trades_count': conditionText = `📊 Сделок: ${ach.condition_value}`; break;
                case 'shares_held': conditionText = `📈 Акций: ${ach.condition_value/100}`; break;
                case 'referrals_count': conditionText = `👥 Приглашений: ${ach.condition_value}`; break;
                case 'total_topup': conditionText = `💰 Пополнено: ${ach.condition_value/100} ⭐`; break;
            }
        }
        return `<div class="achievement-card ${selectedClass} ${disabledClass}" data-ach-id="${ach.id}" data-disabled="${isUsedElsewhere}"><div class="achievement-icon">${ach.icon}</div><div class="achievement-name">${ach.name}</div><div class="achievement-desc">${ach.description}</div>${conditionText ? `<div class="achievement-condition">${conditionText}</div>` : ''}<div class="achievement-date">🏅 Получено: ${earnedDate}</div></div>`;
    }).join('');
    const modalHtml = `<div class="modal" id="achiSelectorModal" style="display:flex;"><div class="modal-content"><span class="close-modal" id="closeAchiSelector">&times;</span><h3>Выберите достижение для слота ${slot+1}</h3><div class="achievements-grid" id="achiGrid">${gridHtml}</div>${isSlotOccupied ? `<button id="clearSlotBtn" class="secondary">🗑️ Очистить слот</button>` : ''}<button id="saveAchiSelection">Сохранить</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('closeAchiSelector').onclick = () => document.getElementById('achiSelectorModal').remove();
    if (isSlotOccupied) {
        document.getElementById('clearSlotBtn').onclick = async () => {
            let newSelectedIds = [...currentSelectedIds];
            newSelectedIds[slot] = null;
            newSelectedIds = newSelectedIds.filter(id => id !== null && id !== undefined);
            await updateUserCallback({ selected_achievements: newSelectedIds });
            currentUser.selected_achievements = newSelectedIds;
            document.getElementById('achiSelectorModal').remove();
            await renderProfileTab();
        };
    }
    document.getElementById('saveAchiSelection').onclick = async () => {
        const selectedCard = document.querySelector('#achiGrid .achievement-card.selected:not(.disabled)');
        let newSelectedIds = [...currentSelectedIds];
        if (selectedCard) {
            const selectedId = parseInt(selectedCard.dataset.achId);
            newSelectedIds[slot] = selectedId;
        }
        newSelectedIds = newSelectedIds.filter(id => id !== null && id !== undefined);
        while (newSelectedIds.length < 3) newSelectedIds.push(null);
        const saveArray = newSelectedIds.filter(v => v !== null);
        await updateUserCallback({ selected_achievements: saveArray });
        currentUser.selected_achievements = saveArray;
        document.getElementById('achiSelectorModal').remove();
        await renderProfileTab();
    };
    document.querySelectorAll('#achiGrid .achievement-card').forEach(card => {
        card.addEventListener('click', () => {
            if (card.dataset.disabled === 'true') { showCustomModal('Недоступно', 'Это достижение уже используется в другом слоте. Сначала уберите его оттуда.'); return; }
            document.querySelectorAll('#achiGrid .achievement-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });
}

window.renderProfileTab = async function(
    currentUser,
    supabase,
    userId,
    fromCents,
    showCustomModal,
    getUserStats,
    getUserRank,
    getEarnedAchievements,
    getAllAchievements,
    updateBellBadge,
    showNotificationsModal
) {
    const stats = await getUserStats();
    const earnedAchievements = await getEarnedAchievements();
    const selectedIds = currentUser.selected_achievements || [];
    const iconsHtml = [];
    for (let i = 0; i < 3; i++) {
        const achId = selectedIds[i];
        const ach = earnedAchievements.find(a => a.id === achId);
        iconsHtml.push(ach ? `<div class="achi-icon earned" data-slot="${i}" data-ach-id="${ach.id}" title="${ach.name}: ${ach.description}">${ach.icon}</div>` : `<div class="achi-icon" data-slot="${i}">?</div>`);
    }
    const rank = await getUserRank();
    const rankHtml = rank ? `<div class="rank-card"><span>🏆 Рейтинг</span><span style="font-size:20px; font-weight:bold;">#${rank}</span></div>` : '';

    const nextAchievements = await getNextAchievementsProgress(supabase, userId, currentUser, getUserStats, getAllAchievements, getEarnedAchievements);
    let nextHtml = '';
    if (nextAchievements.length > 0) {
        nextHtml = `<div class="next-achievements"><div class="small-text" style="margin-bottom:8px;">📋 Ближайшие достижения:</div>`;
        for (let ach of nextAchievements) {
            let conditionStr = '';
            switch (ach.condition_type) {
                case 'trades_count': conditionStr = `${ach.current}/${ach.needed} сделок`; break;
                case 'shares_held': conditionStr = `${ach.current/100}/${ach.needed/100} акций`; break;
                case 'referrals_count': conditionStr = `${ach.current}/${ach.needed} приглашений`; break;
                case 'total_topup': conditionStr = `${ach.current/100}/${ach.needed/100} ⭐`; break;
            }
            nextHtml += `
                <div class="next-achievement-item">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:28px;">${ach.icon}</span>
                        <span class="small-text">${conditionStr}</span>
                    </div>
                    <div class="progress-bar"><div class="progress-fill" style="width: ${ach.progress}%;"></div></div>
                </div>
            `;
        }
        nextHtml += `</div>`;
    }

    let avatarClass = 'avatar-circle';
    let avatarStyle = '';
    if (currentUser.avatar_bg && currentUser.avatar_bg.startsWith('#')) {
        avatarStyle = `background: ${currentUser.avatar_bg};`;
    } else {
        const found = bgOptions.find(b => b.id === currentUser.avatar_bg);
        avatarClass += ` ${found ? found.class : 'bg-gradient1'}`;
    }
    const emojiStyle = getAvatarStyle(currentUser.avatar_url);
    const registeredDate = currentUser.registered_at ? new Date(currentUser.registered_at).toLocaleDateString() : 'неизвестно';

    // ВАЖНО: убрали блок с колокольчиком
    const html = `<div class="card" style="text-align: center;">
        <div class="profile-avatar" id="avatarClick">
            <div class="${avatarClass}" style="${avatarStyle}"><span class="avatar-emoji" style="${emojiStyle}">${currentUser.avatar_url}</span></div>
            <div class="small-text">Нажмите, чтобы сменить аватар и фон</div>
        </div>
        <p style="font-size:20px; font-weight:bold;">${currentUser.username}</p>
        <p class="small-text">ID: ${userId}</p>
        <p class="small-text">📅 Регистрация: ${registeredDate}</p>
        <div class="achievement-icons">${iconsHtml.join('')}</div>
        <div class="small-text">Нажмите на значок, чтобы выбрать/убрать достижение</div>
        <div class="stats-container">
            <div class="stats-row">
                <div class="stat-card"><div class="stat-value">${fromCents(currentUser.stars_balance)}</div><div class="stat-label">Stars</div></div>
                <div class="stat-card"><div class="stat-value">${fromCents(currentUser.shares)}</div><div class="stat-label">Акций</div></div>
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

    const updateUserCallback = async (updates) => {
        await supabase.from('users').update(updates).eq('id', userId);
        Object.assign(currentUser, updates);
    };

    const renderProfileTabBound = async () => {
        await window.renderProfileTab(
            currentUser, supabase, userId, fromCents, showCustomModal,
            getUserStats, getUserRank, getEarnedAchievements, getAllAchievements,
            updateBellBadge, showNotificationsModal
        );
    };

    const awardAvatarAchievementBound = () => awardAvatarAchievement(supabase, userId, showCustomModal);
    const openBackgroundSelectorBound = () => openBackgroundSelector(
        supabase, userId, currentUser, updateUserCallback,
        awardAvatarAchievementBound, renderProfileTabBound, showCustomModal
    );
    const openAvatarSelectorBound = () => openAvatarSelector(
        supabase, userId, currentUser, updateUserCallback,
        awardAvatarAchievementBound, openBackgroundSelectorBound, showCustomModal
    );

    document.getElementById('avatarClick')?.addEventListener('click', openAvatarSelectorBound);

    document.querySelectorAll('.achi-icon').forEach(icon => {
        icon.addEventListener('click', async () => {
            const slot = parseInt(icon.dataset.slot);
            const currentAchId = icon.dataset.achId ? parseInt(icon.dataset.achId) : null;
            await openAchievementSelectorForSlot(
                slot, earnedAchievements, selectedIds, currentAchId,
                updateUserCallback, currentUser, renderProfileTabBound,
                showCustomModal, supabase, userId
            );
        });
    });

    // Колокольчик не обновляем, это делает хедер
    // Но нужно вызвать updateBellBadge всё равно для бейджа в хедере
    await updateBellBadge();
};
