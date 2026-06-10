// profile.js – полная версия (кастомизация аватара, слоты достижений, ближайшие достижения, справочник с сеткой)
const avatarEmojis = ['👤','😀','😎','👍','🐱','🐶','🦊','🐼','🍕','🍔','🍩','☕','💎','💰','🎲','🏆','🎁','🌟','🔥','❤️','🚀','🍀','👑','🎯'];
const bgColors = [
    { name: 'Синий', value: '#2b6e9e' }, { name: 'Фиолетовый', value: '#9b59b6' },
    { name: 'Оранжевый', value: '#e67e22' }, { name: 'Зелёный', value: '#27ae60' },
    { name: 'Жёлтый', value: '#f1c40f' }, { name: 'Красный', value: '#e74c3c' },
    { name: 'Бирюзовый', value: '#1abc9c' }, { name: 'Лазурный', value: '#3498db' },
    { name: 'Тёмный', value: '#2c3e50' }, { name: 'Розовый', value: '#ff9a9e' },
    { name: 'Лаванда', value: '#a18cd1' }
];
const borderColors = [
    { name: 'Белый', value: '#ffffff' }, { name: 'Чёрный', value: '#000000' },
    { name: 'Красный', value: '#ff0000' }, { name: 'Зелёный', value: '#00ff00' },
    { name: 'Синий', value: '#0000ff' }, { name: 'Жёлтый', value: '#ffff00' },
    { name: 'Фиолетовый', value: '#9b30ff' }, { name: 'Оранжевый', value: '#ff8c00' },
    { name: 'Голубой', value: '#00ffff' }, { name: 'Розовый', value: '#ff69b4' },
    { name: 'Серый', value: '#808080' }
];

function getAvatarStyle(emoji) {
    const special = { '🌟':'56px','🔥':'56px','💎':'56px','🎲':'56px','🎁':'56px' };
    return `font-size: ${special[emoji] || '48px'};`;
}

// ========== БЛИЖАЙШИЕ ДОСТИЖЕНИЯ (3 штуки) ==========
async function getNextAchievementsMixed(currentUser, getUserStats) {
    const { data: all } = await window.supabase.from('achievements').select('*').order('condition_value', { ascending: true });
    if (!all) return [];
    const { data: earned } = await window.supabase.from('user_achievements').select('achievement_id').eq('user_id', window.userId);
    const earnedIds = new Set(earned?.map(e => e.achievement_id) || []);
    const exclude = ['🌟 Первый шаг', '🎨 Стилист'];
    const notEarned = all.filter(a => !earnedIds.has(a.id) && !exclude.includes(a.name));
    if (notEarned.length === 0) return [];
    
    const stats = await getUserStats();
    const user = currentUser;
    
    const withProgress = notEarned.map(ach => {
        if (ach.condition_type === 'none') return null;
        let current = 0, needed = ach.condition_value;
        switch (ach.condition_type) {
            case 'trades_count': current = stats.totalTrades; break;
            case 'shares_held': current = user.shares; break;
            case 'referrals_count': current = user.referral_count || 0; break;
            case 'total_topup': current = user.total_topup || 0; break;
            case 'total_spent': current = user.total_spent || 0; break;
            case 'total_earned': current = user.total_earned || 0; break;
            case 'total_volume': current = user.total_volume || 0; break;
            case 'stars_held': current = user.stars_balance; break;
            case 'days_active': current = user.days_active || 0; break;
            case 'game_reaction': current = user.game_reaction_wins || 0; break;
            case 'game_tower': current = user.game_tower_wins || 0; break;
            case 'game_closest': current = user.game_closest_wins || 0; break;
            case 'game_typerace': current = user.game_typerace_wins || 0; break;
            case 'game_maze': current = user.game_maze_wins || 0; break;
            case 'game_ttt': current = user.game_ttt_wins || 0; break;
            case 'games_total': current = (user.game_reaction_wins||0)+(user.game_tower_wins||0)+(user.game_closest_wins||0)+(user.game_typerace_wins||0)+(user.game_maze_wins||0)+(user.game_ttt_wins||0); break;
            default: return null;
        }
        if (current < needed) return { ...ach, current, needed, progress: (current / needed) * 100 };
        return null;
    }).filter(a => a !== null);
    
    const byType = new Map();
    for (const ach of withProgress) {
        const t = ach.condition_type;
        if (!byType.has(t) || ach.needed < byType.get(t).needed) byType.set(t, ach);
    }
    const unique = Array.from(byType.values());
    unique.sort((a,b) => a.needed - b.needed);
    return unique.slice(0, 3);
}

// ========== ФУНКЦИИ ДЛЯ СПРАВОЧНИКА (КОМПАКТНАЯ СЕТКА) ==========
function getConditionText(ach) {
    if (ach.condition_type === 'none') return '';
    let val = ach.condition_value;
    switch (ach.condition_type) {
        case 'trades_count': return `${val} сделок`;
        case 'shares_held': return `${val/100} акций`;
        case 'referrals_count': return `${val} друзей`;
        case 'total_topup': return `${val/100} ⭐ пополнено`;
        case 'total_spent': return `${val/100} ⭐ потрачено`;
        case 'total_earned': return `${val/100} ⭐ заработано`;
        case 'total_volume': return `${val/100} ⭐ объём`;
        case 'stars_held': return `${val/100} ⭐ на балансе`;
        case 'days_active': return `${val} дней`;
        case 'game_reaction': return `Победить в "Нажми быстрее"`;
        case 'game_tower': return `Победить в "Башня"`;
        case 'game_closest': return `Победить в "Ближе к цели"`;
        case 'game_typerace': return `Победить в "Скоростной набор"`;
        case 'game_maze': return `Победить в "Лабиринт"`;
        case 'game_ttt': return `Победить бота в крестики-нолики`;
        case 'games_total': return `Победить в любой игре`;
        default: return '';
    }
}

async function getAllAchievementsByCategory() {
    const { data: all } = await window.supabase.from('achievements').select('*').order('condition_value', { ascending: true });
    if (!all) return {};
    const { data: earned } = await window.supabase.from('user_achievements').select('achievement_id').eq('user_id', window.userId);
    const earnedIds = new Set(earned?.map(e => e.achievement_id) || []);
    const groups = {
        'Сделки': [],
        'Акции': [],
        'Рефералы': [],
        'Финансы': [],
        'Игры': [],
        'Дни': []
    };
    for (const ach of all) {
        if (ach.name === '🌟 Первый шаг' || ach.name === '🎨 Стилист') continue;
        let category = '';
        if (ach.condition_type === 'trades_count') category = 'Сделки';
        else if (ach.condition_type === 'shares_held') category = 'Акции';
        else if (ach.condition_type === 'referrals_count') category = 'Рефералы';
        else if (['total_topup', 'total_spent', 'total_earned', 'total_volume', 'stars_held'].includes(ach.condition_type)) category = 'Финансы';
        else if (ach.condition_type.startsWith('game_') || ach.condition_type === 'games_total') category = 'Игры';
        else if (ach.condition_type === 'days_active') category = 'Дни';
        else continue;
        groups[category].push({ ...ach, earned: earnedIds.has(ach.id) });
    }
    return groups;
}

async function showAchievementsGuide(currentUser, getUserStats) {
    const groups = await getAllAchievementsByCategory();
    const stats = await getUserStats();
    const user = currentUser;
    
    function getCurrentProgress(ach) {
        if (ach.earned) return ach.condition_value;
        switch (ach.condition_type) {
            case 'trades_count': return stats.totalTrades;
            case 'shares_held': return user.shares;
            case 'referrals_count': return user.referral_count || 0;
            case 'total_topup': return user.total_topup || 0;
            case 'total_spent': return user.total_spent || 0;
            case 'total_earned': return user.total_earned || 0;
            case 'total_volume': return user.total_volume || 0;
            case 'stars_held': return user.stars_balance;
            case 'days_active': return user.days_active || 0;
            case 'game_reaction': return user.game_reaction_wins || 0;
            case 'game_tower': return user.game_tower_wins || 0;
            case 'game_closest': return user.game_closest_wins || 0;
            case 'game_typerace': return user.game_typerace_wins || 0;
            case 'game_maze': return user.game_maze_wins || 0;
            case 'game_ttt': return user.game_ttt_wins || 0;
            case 'games_total': return (user.game_reaction_wins||0)+(user.game_tower_wins||0)+(user.game_closest_wins||0)+(user.game_typerace_wins||0)+(user.game_maze_wins||0)+(user.game_ttt_wins||0);
            default: return 0;
        }
    }
    
    const categoryOrder = ['Сделки', 'Акции', 'Рефералы', 'Финансы', 'Игры', 'Дни'];
    let allCategoriesHtml = '';
    for (const cat of categoryOrder) {
        const items = groups[cat] || [];
        if (items.length === 0) continue;
        const itemsHtml = items.map(ach => {
            const isCompleted = ach.earned;
            const needed = ach.condition_value;
            const current = getCurrentProgress(ach);
            let progressPercent = 0;
            let progressDisplay = '';
            if (!isCompleted && needed > 0) {
                progressPercent = Math.min(100, (current / needed) * 100);
                if (ach.condition_type === 'shares_held' || ach.condition_type === 'total_topup' || ach.condition_type === 'total_spent' || ach.condition_type === 'total_earned' || ach.condition_type === 'total_volume' || ach.condition_type === 'stars_held') {
                    progressDisplay = `${(current/100).toFixed(1)}/${(needed/100).toFixed(1)}`;
                } else {
                    progressDisplay = `${current}/${needed}`;
                }
            } else if (isCompleted) {
                progressPercent = 100;
            }
            let displayIcon = ach.icon;
            if (ach.name === '❌⭕ Стратег') displayIcon = '❌';
            return `
                <div class="guide-card">
                    <div class="guide-card-icon">${displayIcon}</div>
                    <div class="guide-card-info">
                        <div class="guide-card-title">${ach.name}</div>
                        <div class="guide-card-condition">${getConditionText(ach)}</div>
                        ${!isCompleted ? `
                            <div class="guide-card-progress-bar"><div class="guide-card-progress-fill" style="width: ${progressPercent}%;"></div></div>
                            <div class="guide-card-progress-text">${progressDisplay}</div>
                        ` : '<div class="guide-card-completed">✅ Получено</div>'}
                    </div>
                </div>
            `;
        }).join('');
        allCategoriesHtml += `
            <div class="guide-category">
                <div class="guide-category-header">${cat}</div>
                <div class="guide-category-grid">${itemsHtml}</div>
            </div>
        `;
    }
    
    if (!allCategoriesHtml) {
        allCategoriesHtml = '<div class="guide-empty">Нет достижений</div>';
    }
    
    const modalHtml = `
        <div class="modal" id="guideModal" style="display:flex;">
            <div class="modal-content guide-modal-content">
                <span class="close-modal" id="closeGuideModal">&times;</span>
                <h3>🏆 Справочник достижений</h3>
                <div class="guide-list">${allCategoriesHtml}</div>
                <div class="modal-buttons"><button id="closeGuideBtn">Закрыть</button></div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('guideModal');
    document.getElementById('closeGuideModal').onclick = () => modal.remove();
    document.getElementById('closeGuideBtn').onclick = () => modal.remove();
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

// ========== КАСТОМИЗАЦИЯ АВАТАРА И ВЫБОР ДОСТИЖЕНИЙ ==========
async function awardStylistAchievement() {
    const { data: ach } = await window.supabase.from('achievements').select('id').eq('name', '🎨 Стилист').single();
    if (ach) await window.awardAchievement(ach.id);
}

async function openAchievementSelectorForSlot(slot, earnedAchievements, currentSelectedIds, currentSlotAchievementId, updateUserCallback, currentUser, renderProfileTab, showCustomModal) {
    const otherSelected = currentSelectedIds.filter((_, idx) => idx !== slot);
    const isSlotOccupied = currentSlotAchievementId !== null;
    const gridHtml = earnedAchievements.map(ach => {
        const isSelected = (currentSlotAchievementId === ach.id);
        const isUsedElsewhere = otherSelected.includes(ach.id);
        const disabledClass = isUsedElsewhere ? 'disabled' : '';
        const selectedClass = isSelected ? 'selected' : '';
        const earnedDate = ach.earned_at ? new Date(ach.earned_at).toLocaleString() : 'дата не указана';
        let conditionText = '';
        const hideCondition = ach.name === '🌟 Первый шаг' || ach.name === '🎨 Стилист';
        if (!hideCondition && ach.condition_type !== 'none') {
            switch(ach.condition_type) {
                case 'trades_count': conditionText = `📊 Сделок: ${ach.condition_value}`; break;
                case 'shares_held': conditionText = `📈 Акций: ${ach.condition_value/100}`; break;
                case 'referrals_count': conditionText = `👥 Приглашений: ${ach.condition_value}`; break;
                case 'total_topup': conditionText = `💰 Пополнено: ${ach.condition_value/100} ⭐`; break;
                case 'total_spent': conditionText = `💸 Потрачено: ${ach.condition_value/100} ⭐`; break;
                case 'total_earned': conditionText = `💵 Заработано: ${ach.condition_value/100} ⭐`; break;
            }
        }
        return `<div class="achievement-card ${selectedClass} ${disabledClass}" data-ach-id="${ach.id}" data-disabled="${isUsedElsewhere}">
            <div class="achievement-name">${ach.name}</div>
            <div class="achievement-desc">${ach.description}</div>
            ${conditionText ? `<div class="achievement-condition">${conditionText}</div>` : ''}
            <div class="achievement-date">🏅 Получено: ${earnedDate}</div>
        </div>`;
    }).join('');
    const modalHtml = `<div class="modal" id="achiSelectorModal" style="display:flex;"><div class="modal-content"><span class="close-modal" id="closeAchiSelector">&times;</span><h3>Выберите достижение</h3><div class="small-text" style="margin-bottom: 10px; text-align: center;">слот ${slot+1}</div><div class="scrollable-content"><div class="achievements-grid" id="achiGrid">${gridHtml}</div></div><div class="modal-buttons">${isSlotOccupied ? `<button id="clearSlotBtn" class="secondary">🗑️ Очистить слот</button>` : ''}<button id="saveAchiSelection">Сохранить</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('achiSelectorModal');
    document.getElementById('closeAchiSelector').onclick = () => modal.remove();
    if (isSlotOccupied) {
        document.getElementById('clearSlotBtn').onclick = async () => {
            let newSelectedIds = [...currentSelectedIds];
            newSelectedIds[slot] = null;
            newSelectedIds = newSelectedIds.filter(id => id !== null);
            await updateUserCallback({ selected_achievements: newSelectedIds });
            currentUser.selected_achievements = newSelectedIds;
            modal.remove();
            await renderProfileTab();
        };
    }
    document.getElementById('saveAchiSelection').onclick = async () => {
        const selectedCard = document.querySelector('#achiGrid .achievement-card.selected:not(.disabled)');
        let newSelectedIds = [...currentSelectedIds];
        if (selectedCard) {
            const selectedId = parseInt(selectedCard.dataset.achId);
            if (newSelectedIds.includes(selectedId)) { showCustomModal('Ошибка', 'Это достижение уже используется в другом слоте'); return; }
            newSelectedIds[slot] = selectedId;
        }
        newSelectedIds = [...new Set(newSelectedIds.filter(id => id !== null))];
        await updateUserCallback({ selected_achievements: newSelectedIds });
        currentUser.selected_achievements = newSelectedIds;
        modal.remove();
        await renderProfileTab();
    };
    document.querySelectorAll('#achiGrid .achievement-card').forEach(card => {
        card.addEventListener('click', () => {
            if (card.dataset.disabled === 'true') { showCustomModal('Недоступно', 'Это достижение уже используется в другом слоте'); return; }
            document.querySelectorAll('#achiGrid .achievement-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });
}

function showAvatarStep(currentUser, updateCallback, nextCallback, showCustomModal) {
    const currentAvatar = currentUser.avatar_url || '👤';
    const optionsHtml = avatarEmojis.map(emoji => {
        const style = getAvatarStyle(emoji);
        return `<div class="avatar-option ${emoji === currentAvatar ? 'selected' : ''}" data-avatar="${emoji}"><span class="avatar-emoji" style="${style}">${emoji}</span></div>`;
    }).join('');
    const previewStyle = getAvatarStyle(currentAvatar);
    const modalHtml = `<div class="modal" id="stepModal" style="display:flex;"><div class="modal-content"><span class="close-modal" id="closeModal">&times;</span><h3>1/3 – Выберите аватар</h3><div class="modal-preview" style="display:flex; justify-content:center; margin:20px 0;"><div class="avatar-circle" style="background:#2b6e9e; width:88px; height:88px; display:flex; align-items:center; justify-content:center; border-radius:50%;"><span class="avatar-emoji" style="${previewStyle}">${currentAvatar}</span></div></div><div class="scrollable-content"><div class="avatars-grid" style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px;">${optionsHtml}</div></div><div class="modal-buttons"><button id="nextBtn" style="width:100%">Далее →</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('stepModal');
    document.getElementById('closeModal').onclick = () => modal.remove();
    let selectedAvatar = currentAvatar;
    document.querySelectorAll('.avatar-option').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            selectedAvatar = opt.dataset.avatar;
            const preview = modal.querySelector('.modal-preview .avatar-emoji');
            if (preview) { preview.textContent = selectedAvatar; preview.setAttribute('style', getAvatarStyle(selectedAvatar)); }
        });
    });
    document.getElementById('nextBtn').onclick = async () => { await updateCallback({ avatar_url: selectedAvatar }); currentUser.avatar_url = selectedAvatar; modal.remove(); nextCallback(); };
}

function showBackgroundStep(currentUser, updateCallback, nextCallback, backCallback, showCustomModal) {
    const currentBg = currentUser.avatar_bg || 'gradient1';
    let isCustomColor = false, currentColorValue = null;
    if (currentBg && currentBg.startsWith('#')) { isCustomColor = true; currentColorValue = currentBg; }
    else { const mapping = { 'gradient1':'#2b6e9e','gradient2':'#9b59b6','gradient3':'#e67e22','gradient4':'#27ae60','gradient5':'#f1c40f','gradient6':'#e74c3c','gradient7':'#1abc9c','gradient8':'#3498db','gradient9':'#2c3e50','gradient10':'#ff9a9e','gradient11':'#a18cd1' }; currentColorValue = mapping[currentBg] || '#2b6e9e'; }
    const colors = [...bgColors, { name: '🎨 Свой цвет', value: 'custom', isPicker: true }];
    const generateColorsHtml = () => colors.map(color => {
        if (color.isPicker) return `<div class="color-option picker-option ${isCustomColor ? 'selected' : ''}" data-bg="custom" style="background: linear-gradient(135deg, #ff0000, #00ff00, #0000ff); display: flex; align-items: center; justify-content: center; font-size: 28px;">🎨</div>`;
        const isSelected = (!isCustomColor && currentColorValue === color.value);
        return `<div class="color-option ${isSelected ? 'selected' : ''}" data-bg="${color.value}" style="background: ${color.value}; border: 2px solid ${color.value === '#ffffff' ? '#ccc' : 'transparent'};">${isSelected ? '<span class="color-check">✓</span>' : ''}</div>`;
    }).join('');
    const modalHtml = `<div class="modal" id="stepModal" style="display:flex;"><div class="modal-content"><span class="close-modal" id="closeModal">&times;</span><h3>2/3 – Выберите фон аватарки</h3><div class="modal-preview" style="display:flex; justify-content:center; margin:20px 0;"><div class="avatar-circle" style="background: ${currentColorValue}; width:88px; height:88px; display:flex; align-items:center; justify-content:center; border-radius:50%;"><span class="avatar-emoji" style="${getAvatarStyle(currentUser.avatar_url)}">${currentUser.avatar_url}</span></div></div><div class="scrollable-content"><div class="colors-grid" id="colorsGrid" style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px;">${generateColorsHtml()}</div></div><div class="modal-buttons"><button id="backBtn" class="secondary">← Назад</button><button id="nextBtn">Далее →</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('stepModal');
    document.getElementById('closeModal').onclick = () => modal.remove();
    const updatePreview = (color) => { const previewCircle = modal.querySelector('.modal-preview .avatar-circle'); previewCircle.style.background = color; };
    let selectedBgValue = currentColorValue, isSelectedCustom = isCustomColor;
    updatePreview(selectedBgValue);
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const bgValue = opt.dataset.bg;
            if (bgValue === 'custom') {
                const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.value = selectedBgValue;
                colorInput.addEventListener('input', (e) => { const newColor = e.target.value; selectedBgValue = newColor; isSelectedCustom = true; updatePreview(selectedBgValue); document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected')); opt.classList.add('selected'); document.querySelectorAll('.color-check').forEach(c => c.remove()); });
                colorInput.click();
            } else { selectedBgValue = bgValue; isSelectedCustom = false; updatePreview(selectedBgValue); document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected')); opt.classList.add('selected'); document.querySelectorAll('.color-check').forEach(c => c.remove()); opt.innerHTML = `<span class="color-check">✓</span>`; }
        });
    });
    document.getElementById('nextBtn').onclick = async () => {
        let saveBgValue;
        if (isSelectedCustom || !bgColors.some(c => c.value === selectedBgValue)) saveBgValue = selectedBgValue;
        else { const mapping = { '#2b6e9e':'gradient1','#9b59b6':'gradient2','#e67e22':'gradient3','#27ae60':'gradient4','#f1c40f':'gradient5','#e74c3c':'gradient6','#1abc9c':'gradient7','#3498db':'gradient8','#2c3e50':'gradient9','#ff9a9e':'gradient10','#a18cd1':'gradient11' }; saveBgValue = mapping[selectedBgValue] || 'gradient1'; }
        await updateCallback({ avatar_bg: saveBgValue }); currentUser.avatar_bg = saveBgValue; modal.remove(); nextCallback();
    };
    document.getElementById('backBtn').onclick = () => { modal.remove(); if (backCallback) backCallback(); };
}

async function showBorderColorStep(currentUser, updateCallback, nextCallback, backCallback, showCustomModal) {
    const currentColor = currentUser.avatar_border || '#ffffff';
    let bgStyleInline = '';
    if (currentUser.avatar_bg && currentUser.avatar_bg.startsWith('#')) bgStyleInline = `background: ${currentUser.avatar_bg};`;
    else { const found = bgColors.find(c => { const mapping = { '#2b6e9e':'gradient1','#9b59b6':'gradient2','#e67e22':'gradient3','#27ae60':'gradient4','#f1c40f':'gradient5','#e74c3c':'gradient6','#1abc9c':'gradient7','#3498db':'gradient8','#2c3e50':'gradient9','#ff9a9e':'gradient10','#a18cd1':'gradient11' }; return mapping[c.value] === currentUser.avatar_bg; }); if (found) bgStyleInline = `background: ${found.value};`; else bgStyleInline = `background: #2b6e9e;`; }
    const colors = [...borderColors, { name: '🎨 Свой цвет', value: 'custom', isPicker: true }];
    const generateColorsHtml = () => colors.map(color => {
        if (color.isPicker) return `<div class="color-option picker-option ${(currentColor !== '#ffffff' && !borderColors.some(c => c.value === currentColor)) ? 'selected' : ''}" data-color="custom" style="background: linear-gradient(135deg, #ff0000, #00ff00, #0000ff); display: flex; align-items: center; justify-content: center; font-size: 28px;">🎨</div>`;
        const isSelected = (color.value === currentColor);
        return `<div class="color-option ${isSelected ? 'selected' : ''}" data-color="${color.value}" style="background: ${color.value}; border: 2px solid ${color.value === '#ffffff' ? '#ccc' : 'transparent'};">${isSelected ? '<span class="color-check">✓</span>' : ''}</div>`;
    }).join('');
    const modalHtml = `<div class="modal" id="borderModal" style="display:flex;"><div class="modal-content"><span class="close-modal" id="closeModal">&times;</span><h3>3/3 – Выберите цвет обводки аватарки</h3><div class="modal-preview" style="display:flex; justify-content:center; margin:20px 0;"><div class="avatar-circle" style="${bgStyleInline}; width:88px; height:88px; display:flex; align-items:center; justify-content:center; border-radius:50%;"><span class="avatar-emoji" style="${getAvatarStyle(currentUser.avatar_url)}">${currentUser.avatar_url}</span></div></div><div class="scrollable-content"><div class="colors-grid" id="colorsGrid" style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px;">${generateColorsHtml()}</div></div><div class="modal-buttons"><button id="backBtn" class="secondary">← Назад</button><button id="nextBtn">Далее →</button></div></div></div>`;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('borderModal');
    document.getElementById('closeModal').onclick = () => modal.remove();
    const updatePreview = (color) => { const previewCircle = modal.querySelector('.modal-preview .avatar-circle'); const style = `border: 3px solid ${color}; box-shadow: 0 2px 8px rgba(0,0,0,0.2);`; const currentStyle = previewCircle.getAttribute('style') || ''; const cleaned = currentStyle.replace(/border:[^;]+;?/g, '').replace(/box-shadow:[^;]+;?/g, ''); previewCircle.setAttribute('style', cleaned + style); };
    let selectedColor = currentColor; updatePreview(selectedColor);
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const colorValue = opt.dataset.color;
            if (colorValue === 'custom') {
                const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.value = selectedColor === '#ffffff' ? '#ffffff' : (selectedColor.startsWith('#') ? selectedColor : '#ffffff');
                colorInput.addEventListener('input', (e) => { const newColor = e.target.value; selectedColor = newColor; updatePreview(selectedColor); document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected')); opt.classList.add('selected'); document.querySelectorAll('.color-check').forEach(c => c.remove()); });
                colorInput.click();
            } else { selectedColor = colorValue; updatePreview(selectedColor); document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected')); opt.classList.add('selected'); document.querySelectorAll('.color-check').forEach(c => c.remove()); if (!opt.querySelector('.color-check')) opt.innerHTML = `<span class="color-check">✓</span>`; }
        });
    });
    document.getElementById('nextBtn').onclick = async () => { if (selectedColor !== currentColor) await window.updateUserBorder(selectedColor); currentUser.avatar_border = selectedColor; modal.remove(); nextCallback(); };
    document.getElementById('backBtn').onclick = () => { modal.remove(); if (backCallback) backCallback(); };
}

async function startFullCustomization(currentUser, supabase, updateUserCallback, renderProfileTab, showCustomModal) {
    await new Promise(resolve => { showAvatarStep(currentUser, updateUserCallback, resolve, showCustomModal); });
    await new Promise(resolve => { showBackgroundStep(currentUser, updateUserCallback, async () => resolve(), async () => { await new Promise(r => showAvatarStep(currentUser, updateUserCallback, r, showCustomModal)); await new Promise(r2 => showBackgroundStep(currentUser, updateUserCallback, r2, null, showCustomModal)); resolve(); }, showCustomModal); });
    await new Promise(resolve => { showBorderColorStep(currentUser, updateUserCallback, async () => resolve(), async () => { await new Promise(r => showBackgroundStep(currentUser, updateUserCallback, r, null, showCustomModal)); await new Promise(r2 => showBorderColorStep(currentUser, updateUserCallback, r2, null, showCustomModal)); resolve(); }, showCustomModal); });
    await awardStylistAchievement(); await renderProfileTab();
}

// ========== ГЛАВНЫЙ РЕНДЕР ПРОФИЛЯ ==========
window.renderProfileTab = async function(currentUser, supabase, userId, fromCents, showCustomModal, getUserStats, getUserRank, getEarnedAchievements, getAllAchievements, updateBellBadge, showNotificationsModal) {
    if (window.checkAllAchievements) await window.checkAllAchievements();
    const stats = await getUserStats();
    const earnedAchievements = await getEarnedAchievements();
    let selectedIds = currentUser.selected_achievements || [];
    selectedIds = [...new Set(selectedIds)];
    const iconsHtml = [];
    for (let i = 0; i < 3; i++) {
        const ach = earnedAchievements.find(a => a.id === selectedIds[i]);
        iconsHtml.push(ach ? `<div class="achi-icon earned" data-slot="${i}" data-ach-id="${ach.id}" title="${ach.name}: ${ach.description}">${ach.icon}</div>` : `<div class="achi-icon" data-slot="${i}">?</div>`);
    }
    const rank = await getUserRank();
    const rankHtml = rank ? `<div class="rank-card"><span>🏆 Рейтинг</span><span style="font-size:20px; font-weight:bold;">#${rank}</span></div>` : '';
    
    const nextAchievements = await getNextAchievementsMixed(currentUser, getUserStats);
    let nextHtml = '';
    if (nextAchievements.length) {
        nextHtml = `<div class="next-achievements"><div class="small-text" style="margin-bottom:8px;">📋 Ближайшие достижения:</div>`;
        for (const ach of nextAchievements) {
            let conditionStr = getConditionText(ach);
            if (!conditionStr) continue;
            const percent = (ach.current / ach.needed) * 100;
            let progressDisplay = '';
            if (ach.condition_type === 'shares_held' || ach.condition_type === 'total_topup' || ach.condition_type === 'total_spent' || ach.condition_type === 'total_earned' || ach.condition_type === 'total_volume' || ach.condition_type === 'stars_held') {
                progressDisplay = `${(ach.current/100).toFixed(2)}/${(ach.needed/100).toFixed(2)}`;
            } else {
                progressDisplay = `${ach.current}/${ach.needed}`;
            }
            nextHtml += `
                <div class="next-achievement-item">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span class="next-achievement-icon">${ach.icon}</span>
                        <span class="next-achievement-text">${conditionStr}</span>
                        <span class="next-achievement-count">${progressDisplay}</span>
                    </div>
                    <div class="progress-bar"><div class="progress-fill" style="width: ${percent}%;"></div></div>
                </div>
            `;
        }
        nextHtml += `<button id="showGuideBtn" class="guide-button">🏆 Справочник достижений</button></div>`;
    } else {
        nextHtml = `<div class="next-achievements" style="text-align:center;"><span style="font-size:48px;">✅</span><br><span class="small-text">Все достижения получены!</span></div>`;
    }
    
    const avatarUrl = currentUser.avatar_url || '👤';
    const avatarBg = currentUser.avatar_bg && currentUser.avatar_bg.startsWith('#') ? currentUser.avatar_bg : ({ gradient1:'#2b6e9e', gradient2:'#9b59b6', gradient3:'#e67e22', gradient4:'#27ae60', gradient5:'#f1c40f', gradient6:'#e74c3c', gradient7:'#1abc9c', gradient8:'#3498db', gradient9:'#2c3e50', gradient10:'#ff9a9e', gradient11:'#a18cd1' }[currentUser.avatar_bg] || '#2b6e9e');
    const avatarBorder = currentUser.avatar_border || '#ffffff';
    const emojiStyle = getAvatarStyle(avatarUrl);
    const registeredDate = currentUser.registered_at ? new Date(currentUser.registered_at).toLocaleDateString() : 'неизвестно';
    const starsDisplay = fromCents(currentUser.stars_balance);
    const volumeDisplay = stats.totalVolume.toFixed(2);
    const sharesDisplay = fromCents(currentUser.shares);
    const html = `<div class="card" style="text-align: center; overflow: visible !important;"><div id="avatarClickWrapper"><div class="avatar-circle" style="background: ${avatarBg}; border: 3px solid ${avatarBorder};"><span class="avatar-emoji" style="${emojiStyle}">${avatarUrl}</span></div><div class="small-text">Нажмите на аватар для кастомизации</div></div><p style="font-size:20px; font-weight:bold; margin-top:8px;">${currentUser.username}</p><p class="small-text">ID: ${userId}</p><p class="small-text">📅 Регистрация: ${registeredDate}</p><div class="achievement-icons">${iconsHtml.join('')}</div><div class="small-text">Нажмите на значок, чтобы выбрать/убрать достижение</div><div class="stats-container"><div class="stats-row"><div class="stat-card"><div class="stat-value">${starsDisplay}</div><div class="stat-label">Stars</div></div><div class="stat-card"><div class="stat-value">${stats.totalTrades}</div><div class="stat-label">Сделок</div></div></div><div class="stats-row"><div class="stat-card"><div class="stat-value">${volumeDisplay}</div><div class="stat-label">Объём (⭐)</div></div><div class="stat-card"><div class="stat-value">${sharesDisplay}</div><div class="stat-label">Акций</div></div></div></div>${rankHtml}${nextHtml}</div>`;
    document.getElementById('app').innerHTML = html;
    document.getElementById('showGuideBtn')?.addEventListener('click', () => showAchievementsGuide(currentUser, getUserStats));
    const updateUserCallback = async (updates) => { await supabase.from('users').update(updates).eq('id', userId); Object.assign(currentUser, updates); };
    const renderProfileTabBound = async () => { await window.renderProfileTab(currentUser, supabase, userId, fromCents, showCustomModal, getUserStats, getUserRank, getEarnedAchievements, getAllAchievements, updateBellBadge, showNotificationsModal); };
    document.getElementById('avatarClickWrapper')?.addEventListener('click', () => { startFullCustomization(currentUser, supabase, updateUserCallback, renderProfileTabBound, showCustomModal); });
    document.querySelectorAll('.achi-icon').forEach(icon => { icon.addEventListener('click', async () => { const slot = parseInt(icon.dataset.slot); const currentAchId = icon.dataset.achId ? parseInt(icon.dataset.achId) : null; await openAchievementSelectorForSlot(slot, earnedAchievements, selectedIds, currentAchId, updateUserCallback, currentUser, renderProfileTabBound, showCustomModal); }); });
    await updateBellBadge();
};
