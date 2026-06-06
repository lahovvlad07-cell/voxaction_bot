// profile.js – финальная версия с 4 шагами кастомизации (аватар → фон → обводка → баннер)

// ---------- Баннеры (6 штук, пока 3 реальных) ----------
const bannerList = [
    'banners/1.jpg',   // готов
    'banners/2.jpg',   // готов
    'banners/3.jpg',   // готов
    'banners/3.jpg',   // временно (4)
    'banners/3.jpg',   // временно (5)
    'banners/3.jpg'    // временно (6)
];

// ---------- Аватары (эмодзи) ----------
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
function getAvatarStyle(emoji) {
    const adjust = avatarAdjustments[emoji] || 0;
    const fontSize = avatarFontSizes[emoji] || '48px';
    return `transform: translateY(${adjust}px); font-size: ${fontSize};`;
}

// ---------- Фоны для аватарки ----------
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

// ---------- Варианты обводки аватарки ----------
const borderOptions = [
    { id: 'default', name: 'Стандартная', style: '3px solid rgba(255,255,255,0.9)' },
    { id: 'thin',    name: 'Тонкая', style: '2px solid rgba(255,255,255,0.9)' },
    { id: 'thick',   name: 'Толстая', style: '5px solid rgba(255,255,255,0.9)' },
    { id: 'gold',    name: 'Золотая', style: '3px solid #fbbf24' },
    { id: 'neon',    name: 'Неоновая', style: '3px solid #2b6e9e; box-shadow: 0 0 10px #2b6e9e;' },
    { id: 'none',    name: 'Без обводки', style: 'none' }
];
function getBorderStyle(borderId) {
    const found = borderOptions.find(b => b.id === borderId);
    return found ? found.style : borderOptions[0].style;
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (достижения) ==========
async function awardAvatarAchievement(supabase, userId, showCustomModal) {
    try {
        const { data: achData } = await supabase.from('achievements').select('id').eq('name', '🎨 Стилист').single();
        if (!achData) return;
        const { data: existing } = await supabase.from('user_achievements').select('achievement_id').eq('user_id', userId).eq('achievement_id', achData.id).maybeSingle();
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

// ========== ШАГ 1: выбор аватарки ==========
async function selectAvatarStep(currentUser, updateUserCallback, showCustomModal, continueCallback) {
    const currentAvatar = currentUser.avatar_url || '👤';
    const optionsHtml = avatarEmojis.map(emoji => {
        const isSelected = (emoji === currentAvatar);
        const style = getAvatarStyle(emoji);
        return `<div class="avatar-option ${isSelected ? 'selected' : ''}" data-avatar="${emoji}"><span class="avatar-emoji" style="${style}">${emoji}</span></div>`;
    }).join('');
    const modalHtml = `
        <div class="modal" id="avatarModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeAvatarModal">&times;</span>
                <h3>1/4 – Выберите аватар</h3>
                <div class="avatars-grid">${optionsHtml}</div>
                <button id="nextToBgBtn">Далее → выбор фона</button>
            </div>
        </div>
    `;
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
        continueCallback();
    };
}

// ========== ШАГ 2: выбор фона ==========
async function selectBackgroundStep(currentUser, updateUserCallback, showCustomModal, continueCallback) {
    const currentBg = currentUser.avatar_bg || 'gradient1';
    let optionsHtml = '';
    for (let bg of bgOptions) {
        if (!bg.isCustom) {
            const isSelected = (currentBg === bg.id);
            optionsHtml += `<div class="bg-option ${bg.class} ${isSelected ? 'selected' : ''}" data-bg="${bg.id}" style="width:65px; height:65px; border-radius:50%; margin:0 auto;"></div>`;
        } else {
            const isCustomSelected = (currentBg && currentBg.startsWith('#'));
            optionsHtml += `<div class="custom-color-preview ${isCustomSelected ? 'selected' : ''}" data-bg="custom" style="background: ${isCustomSelected ? currentBg : '#2b6e9e'}; display: flex; align-items: center; justify-content: center;">🎨</div>`;
        }
    }
    const modalHtml = `
        <div class="modal" id="bgModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeBgModal">&times;</span>
                <h3>2/4 – Выберите фон аватарки</h3>
                <div class="bg-grid">${optionsHtml}</div>
                <button id="nextToBorderBtn">Далее → выбор обводки</button>
            </div>
        </div>
    `;
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
    document.getElementById('nextToBorderBtn').onclick = async () => {
        await updateUserCallback({ avatar_bg: selectedBgValue });
        currentUser.avatar_bg = selectedBgValue;
        document.getElementById('bgModal').remove();
        continueCallback();
    };
}

// ========== ШАГ 3: выбор обводки ==========
async function selectBorderStep(currentUser, updateUserCallback, showCustomModal, continueCallback) {
    const currentBorder = currentUser.avatar_border || 'default';
    const gridHtml = borderOptions.map(opt => {
        const isSelected = (opt.id === currentBorder);
        let previewStyle = '';
        if (opt.id === 'none') previewStyle = 'border: none;';
        else if (opt.id === 'neon') previewStyle = 'border: 3px solid #2b6e9e; box-shadow: 0 0 8px #2b6e9e;';
        else previewStyle = `border: ${opt.style};`;
        return `<div class="border-option ${isSelected ? 'selected' : ''}" data-border="${opt.id}" style="width:80px; height:80px; border-radius:50%; background: #2b6e9e; margin: 0 auto; ${previewStyle}"></div>
                <div class="border-label" style="text-align:center; font-size:12px; margin-top:6px;">${opt.name}</div>`;
    }).join('');
    const modalHtml = `
        <div class="modal" id="borderModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeBorderModal">&times;</span>
                <h3>3/4 – Выберите обводку аватарки</h3>
                <div class="border-grid" style="display:grid; grid-template-columns: repeat(2,1fr); gap:16px; margin:20px 0;">${gridHtml}</div>
                <button id="nextToBannerBtn">Далее → выбор баннера</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('closeBorderModal').onclick = () => document.getElementById('borderModal').remove();
    let selectedBorder = currentBorder;
    document.querySelectorAll('.border-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.border-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedBorder = opt.dataset.border;
        });
    });
    document.getElementById('nextToBannerBtn').onclick = async () => {
        await window.updateUserBorder(selectedBorder);
        currentUser.avatar_border = selectedBorder;
        document.getElementById('borderModal').remove();
        continueCallback();
    };
}

// ========== ШАГ 4: выбор баннера ==========
async function selectBannerStep(currentUser, supabase, renderProfileTab, showCustomModal) {
    const currentBannerId = currentUser.banner_id || 1;
    const gridHtml = bannerList.map((url, idx) => {
        const isSelected = (idx + 1 === currentBannerId);
        return `<div class="banner-option ${isSelected ? 'selected' : ''}" data-banner-id="${idx+1}" style="background-image: url(${url}); background-size: cover; background-position: center;"></div>`;
    }).join('');
    const modalHtml = `
        <div class="modal" id="bannerModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeBannerModal">&times;</span>
                <h3>4/4 – Выберите баннер профиля</h3>
                <div class="banner-grid" style="display:grid; grid-template-columns:repeat(2,1fr); gap:16px; margin:20px 0;">${gridHtml}</div>
                <button id="saveBannerBtn">Сохранить</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('bannerModal');
    document.getElementById('closeBannerModal').onclick = () => modal.remove();
    let selectedBannerId = currentBannerId;
    document.querySelectorAll('.banner-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.banner-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedBannerId = parseInt(opt.dataset.bannerId);
        });
    });
    document.getElementById('saveBannerBtn').onclick = async () => {
        await window.updateUserBanner(selectedBannerId);
        currentUser.banner_id = selectedBannerId;
        modal.remove();
        await renderProfileTab();
        showCustomModal('Готово', 'Баннер профиля обновлён');
    };
}

// ========== ЗАПУСК ПОЛНОЙ КАСТОМИЗАЦИИ ==========
async function startFullCustomization(currentUser, supabase, updateUserCallback, renderProfileTab, showCustomModal) {
    await new Promise(resolve => {
        selectAvatarStep(currentUser, updateUserCallback, showCustomModal, resolve);
    });
    await new Promise(resolve => {
        selectBackgroundStep(currentUser, updateUserCallback, showCustomModal, resolve);
    });
    await new Promise(resolve => {
        selectBorderStep(currentUser, updateUserCallback, showCustomModal, resolve);
    });
    await selectBannerStep(currentUser, supabase, renderProfileTab, showCustomModal);
}

// ========== ФУНКЦИЯ ВЫБОРА ДОСТИЖЕНИЙ ДЛЯ СЛОТА (без изменений, но должна быть) ==========
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

// ========== ОСНОВНОЙ РЕНДЕР ПРОФИЛЯ ==========
window.renderProfileTab = async function(
    currentUser, supabase, userId, fromCents, showCustomModal,
    getUserStats, getUserRank, getEarnedAchievements, getAllAchievements,
    updateBellBadge, showNotificationsModal
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
            nextHtml += `<div class="next-achievement-item"><div style="display:flex; justify-content:space-between;"><span style="font-size:28px;">${ach.icon}</span><span class="small-text">${conditionStr}</span></div><div class="progress-bar"><div class="progress-fill" style="width: ${ach.progress}%;"></div></div></div>`;
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
    const borderStyle = getBorderStyle(currentUser.avatar_border || 'default');
    
    const registeredDate = currentUser.registered_at ? new Date(currentUser.registered_at).toLocaleDateString() : 'неизвестно';
    const bannerId = currentUser.banner_id || 1;
    const bannerUrl = bannerList[bannerId - 1] || bannerList[0];

    const html = `<div class="card" style="text-align: center; overflow: visible !important;">
        <div class="profile-banner" style="background-image: url(${bannerUrl}); background-size: cover; background-position: center;">
            <div class="profile-banner-edit" id="editBannerBtn">🖌️ Сменить баннер</div>
        </div>
        <div class="profile-avatar" id="avatarClick">
            <div class="${avatarClass}" style="${avatarStyle}; ${borderStyle}"><span class="avatar-emoji" style="${emojiStyle}">${currentUser.avatar_url}</span></div>
            <div class="small-text">Нажмите, чтобы изменить аватар, фон, обводку и баннер</div>
        </div>
        <p style="font-size:20px; font-weight:bold; margin-top:8px;">${currentUser.username}</p>
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

    document.getElementById('avatarClick')?.addEventListener('click', () => {
        startFullCustomization(currentUser, supabase, updateUserCallback, renderProfileTabBound, showCustomModal);
    });
    document.getElementById('editBannerBtn')?.addEventListener('click', () => {
        selectBannerStep(currentUser, supabase, renderProfileTabBound, showCustomModal);
    });

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

    await updateBellBadge();
};
