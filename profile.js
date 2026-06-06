// profile.js – финальная версия
// Шаг 1: выбор аватарки (эмодзи)
// Шаг 2: выбор фона аватарки (11 цветов + кастомный)
// Шаг 3: выбор цвета обводки (11 цветов + кастомный)
// Исправлено: текст под аватаркой, область клика только на аватарку

// ---------- Аватары ----------
const avatarEmojis = [
    '👤','😀','😎','🐱','🐶','🦊','🐼','⭐','🎮','⚽','🚀','💎','🌸','🔥','❤️','👍','🎉','🌟','🍕','🏆','🎨','📷','⚡','🔮'
];
const avatarAdjustments = {
    '🐱':-8,'🐶':-8,'🐼':-7,'🦊':-5,'⚽':-3,'💎':-3,'🌸':-3,'🔥':-3,'🎉':-3,'🌟':-3,'🍕':-3,'🏆':-3,
    '🎨':-3,'📷':-3,'⚡':-3,'🔮':-3,'🚀':-3,'🎮':-3
};
const avatarFontSizes = {
    '⚡':'56px','🔮':'56px','🎮':'56px','🚀':'56px','⭐':'56px','🌟':'56px','🔥':'56px','💎':'56px',
    '🎉':'56px','⚽':'56px','📷':'56px','🎨':'56px'
};
function getAvatarStyle(emoji) {
    const adjust = avatarAdjustments[emoji] || 0;
    const fontSize = avatarFontSizes[emoji] || '48px';
    return `transform: translateY(${adjust}px); font-size: ${fontSize};`;
}

// ---------- Фоны (для шага 2) ----------
const bgColors = [
    { name: 'Синий', value: '#2b6e9e' },
    { name: 'Фиолетовый', value: '#9b59b6' },
    { name: 'Оранжевый', value: '#e67e22' },
    { name: 'Зелёный', value: '#27ae60' },
    { name: 'Жёлтый', value: '#f1c40f' },
    { name: 'Красный', value: '#e74c3c' },
    { name: 'Бирюзовый', value: '#1abc9c' },
    { name: 'Лазурный', value: '#3498db' },
    { name: 'Тёмный', value: '#2c3e50' },
    { name: 'Розовый', value: '#ff9a9e' },
    { name: 'Лаванда', value: '#a18cd1' }
];

// ---------- Цвета обводки (для шага 3) ----------
const borderColors = [
    { name: 'Белый', value: '#ffffff' },
    { name: 'Чёрный', value: '#000000' },
    { name: 'Красный', value: '#ff0000' },
    { name: 'Зелёный', value: '#00ff00' },
    { name: 'Синий', value: '#0000ff' },
    { name: 'Жёлтый', value: '#ffff00' },
    { name: 'Фиолетовый', value: '#9b30ff' },
    { name: 'Оранжевый', value: '#ff8c00' },
    { name: 'Голубой', value: '#00ffff' },
    { name: 'Розовый', value: '#ff69b4' },
    { name: 'Серый', value: '#808080' }
];

function getBorderStyle(color) {
    return `border: 3px solid ${color}; box-shadow: 0 2px 8px rgba(0,0,0,0.2);`;
}

// ========== ФУНКЦИИ ДОСТИЖЕНИЙ ==========
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
    const modalHtml = `
        <div class="modal" id="achiSelectorModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeAchiSelector">&times;</span>
                <h3>Выберите достижение для слота ${slot+1}</h3>
                <div class="scrollable-content">
                    <div class="achievements-grid" id="achiGrid">${gridHtml}</div>
                </div>
                <div class="modal-buttons">
                    ${isSlotOccupied ? `<button id="clearSlotBtn" class="secondary">🗑️ Очистить слот</button>` : ''}
                    <button id="saveAchiSelection">Сохранить</button>
                </div>
            </div>
        </div>
    `;
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
            newSelectedIds[slot] = selectedId;
        }
        newSelectedIds = newSelectedIds.filter(id => id !== null);
        const saveArray = newSelectedIds;
        await updateUserCallback({ selected_achievements: saveArray });
        currentUser.selected_achievements = saveArray;
        modal.remove();
        await renderProfileTab();
    };
    document.querySelectorAll('#achiGrid .achievement-card').forEach(card => {
        card.addEventListener('click', () => {
            if (card.dataset.disabled === 'true') {
                showCustomModal('Недоступно', 'Это достижение уже используется в другом слоте. Сначала уберите его оттуда.');
                return;
            }
            document.querySelectorAll('#achiGrid .achievement-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });
}

// ========== ШАГ 1: выбор аватарки ==========
function showAvatarStep(currentUser, updateCallback, nextCallback, showCustomModal) {
    const currentAvatar = currentUser.avatar_url || '👤';
    const optionsHtml = avatarEmojis.map(emoji => {
        const isSelected = (emoji === currentAvatar);
        const style = getAvatarStyle(emoji);
        return `<div class="avatar-option ${isSelected ? 'selected' : ''}" data-avatar="${emoji}"><span class="avatar-emoji" style="${style}">${emoji}</span></div>`;
    }).join('');
    const previewEmojiStyle = getAvatarStyle(currentAvatar);
    const modalHtml = `
        <div class="modal" id="stepModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeModal">&times;</span>
                <h3>1/3 – Выберите аватар</h3>
                <div class="modal-preview">
                    <div class="avatar-circle" style="background: #2b6e9e;"><span class="avatar-emoji" style="${previewEmojiStyle}">${currentAvatar}</span></div>
                </div>
                <div class="scrollable-content">
                    <div class="avatars-grid">${optionsHtml}</div>
                </div>
                <div class="modal-buttons">
                    <button id="nextBtn" style="width:100%">Далее →</button>
                </div>
            </div>
        </div>
    `;
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
            if (preview) {
                preview.textContent = selectedAvatar;
                preview.setAttribute('style', getAvatarStyle(selectedAvatar));
            }
        });
    });
    document.getElementById('nextBtn').onclick = async () => {
        await updateCallback({ avatar_url: selectedAvatar });
        currentUser.avatar_url = selectedAvatar;
        modal.remove();
        nextCallback();
    };
}

// ========== ШАГ 2: выбор фона ==========
function showBackgroundStep(currentUser, updateCallback, nextCallback, backCallback, showCustomModal) {
    const currentBg = currentUser.avatar_bg || 'gradient1';
    
    let isCustomColor = false;
    let currentColorValue = null;
    if (currentBg && currentBg.startsWith('#')) {
        isCustomColor = true;
        currentColorValue = currentBg;
    } else {
        const mapping = {
            'gradient1': '#2b6e9e',
            'gradient2': '#9b59b6',
            'gradient3': '#e67e22',
            'gradient4': '#27ae60',
            'gradient5': '#f1c40f',
            'gradient6': '#e74c3c',
            'gradient7': '#1abc9c',
            'gradient8': '#3498db',
            'gradient9': '#2c3e50',
            'gradient10': '#ff9a9e',
            'gradient11': '#a18cd1'
        };
        currentColorValue = mapping[currentBg] || '#2b6e9e';
    }
    
    const colors = [
        ...bgColors,
        { name: '🎨 Свой цвет', value: 'custom', isPicker: true }
    ];
    
    const generateColorsHtml = () => {
        return colors.map(color => {
            if (color.isPicker) {
                const isSelected = isCustomColor;
                return `
                    <div class="color-option picker-option ${isSelected ? 'selected' : ''}" data-bg="custom" style="background: linear-gradient(135deg, #ff0000, #00ff00, #0000ff); display: flex; align-items: center; justify-content: center; font-size: 28px;">
                        🎨
                    </div>
                `;
            } else {
                const isSelected = (!isCustomColor && currentColorValue === color.value);
                return `
                    <div class="color-option ${isSelected ? 'selected' : ''}" data-bg="${color.value}" style="background: ${color.value}; border: 2px solid ${color.value === '#ffffff' ? '#ccc' : 'transparent'};">
                        ${isSelected ? '<span class="color-check">✓</span>' : ''}
                    </div>
                `;
            }
        }).join('');
    };
    
    const modalHtml = `
        <div class="modal" id="stepModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeModal">&times;</span>
                <h3>2/3 – Выберите фон аватарки</h3>
                <div class="modal-preview">
                    <div class="avatar-circle" style="background: ${currentColorValue};"><span class="avatar-emoji" style="${getAvatarStyle(currentUser.avatar_url)}">${currentUser.avatar_url}</span></div>
                </div>
                <div class="scrollable-content">
                    <div class="colors-grid" id="colorsGrid">
                        ${generateColorsHtml()}
                    </div>
                </div>
                <div class="modal-buttons">
                    <button id="backBtn" class="secondary">← Назад</button>
                    <button id="nextBtn">Далее →</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('stepModal');
    document.getElementById('closeModal').onclick = () => modal.remove();
    
    const updatePreview = (color) => {
        const previewCircle = modal.querySelector('.modal-preview .avatar-circle');
        previewCircle.style.background = color;
        previewCircle.classList.remove('bg-gradient1', 'bg-gradient2', 'bg-gradient3', 'bg-gradient4', 'bg-gradient5', 'bg-gradient6', 'bg-gradient7', 'bg-gradient8', 'bg-gradient9', 'bg-gradient10', 'bg-gradient11');
    };
    
    let selectedBgValue = currentColorValue;
    let isSelectedCustom = isCustomColor;
    updatePreview(selectedBgValue);
    
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const bgValue = opt.dataset.bg;
            if (bgValue === 'custom') {
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.value = selectedBgValue;
                colorInput.addEventListener('input', (e) => {
                    const newColor = e.target.value;
                    selectedBgValue = newColor;
                    isSelectedCustom = true;
                    updatePreview(selectedBgValue);
                    document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    document.querySelectorAll('.color-check').forEach(c => c.remove());
                });
                colorInput.click();
            } else {
                selectedBgValue = bgValue;
                isSelectedCustom = false;
                updatePreview(selectedBgValue);
                document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                document.querySelectorAll('.color-check').forEach(c => c.remove());
                opt.innerHTML = `<span class="color-check">✓</span>`;
            }
        });
    });
    
    document.getElementById('nextBtn').onclick = async () => {
        let saveBgValue;
        if (isSelectedCustom || !bgColors.some(c => c.value === selectedBgValue)) {
            saveBgValue = selectedBgValue;
        } else {
            const mapping = {
                '#2b6e9e': 'gradient1',
                '#9b59b6': 'gradient2',
                '#e67e22': 'gradient3',
                '#27ae60': 'gradient4',
                '#f1c40f': 'gradient5',
                '#e74c3c': 'gradient6',
                '#1abc9c': 'gradient7',
                '#3498db': 'gradient8',
                '#2c3e50': 'gradient9',
                '#ff9a9e': 'gradient10',
                '#a18cd1': 'gradient11'
            };
            saveBgValue = mapping[selectedBgValue] || 'gradient1';
        }
        await updateCallback({ avatar_bg: saveBgValue });
        currentUser.avatar_bg = saveBgValue;
        modal.remove();
        nextCallback();
    };
    document.getElementById('backBtn').onclick = () => {
        modal.remove();
        if (backCallback) backCallback();
    };
}

// ========== ШАГ 3: выбор цвета обводки ==========
async function showBorderColorStep(currentUser, updateCallback, nextCallback, backCallback, showCustomModal) {
    const currentColor = currentUser.avatar_border || '#ffffff';
    
    let bgClass = '';
    let bgStyleInline = '';
    if (currentUser.avatar_bg && currentUser.avatar_bg.startsWith('#')) {
        bgStyleInline = `background: ${currentUser.avatar_bg};`;
    } else {
        const found = bgColors.find(c => {
            const mapping = {
                '#2b6e9e': 'gradient1',
                '#9b59b6': 'gradient2',
                '#e67e22': 'gradient3',
                '#27ae60': 'gradient4',
                '#f1c40f': 'gradient5',
                '#e74c3c': 'gradient6',
                '#1abc9c': 'gradient7',
                '#3498db': 'gradient8',
                '#2c3e50': 'gradient9',
                '#ff9a9e': 'gradient10',
                '#a18cd1': 'gradient11'
            };
            return mapping[c.value] === currentUser.avatar_bg;
        });
        if (found) {
            bgStyleInline = `background: ${found.value};`;
        } else {
            bgStyleInline = `background: #2b6e9e;`;
        }
    }
    
    const colors = [
        ...borderColors,
        { name: '🎨 Свой цвет', value: 'custom', isPicker: true }
    ];
    
    const generateColorsHtml = () => {
        return colors.map(color => {
            if (color.isPicker) {
                const isSelected = (currentColor !== '#ffffff' && !borderColors.some(c => c.value === currentColor));
                return `
                    <div class="color-option picker-option ${isSelected ? 'selected' : ''}" data-color="custom" style="background: linear-gradient(135deg, #ff0000, #00ff00, #0000ff); display: flex; align-items: center; justify-content: center; font-size: 28px;">
                        🎨
                    </div>
                `;
            } else {
                const isSelected = (color.value === currentColor);
                return `
                    <div class="color-option ${isSelected ? 'selected' : ''}" data-color="${color.value}" style="background: ${color.value}; border: 2px solid ${color.value === '#ffffff' ? '#ccc' : 'transparent'};">
                        ${isSelected ? '<span class="color-check">✓</span>' : ''}
                    </div>
                `;
            }
        }).join('');
    };
    
    const modalHtml = `
        <div class="modal" id="borderModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeModal">&times;</span>
                <h3>3/3 – Выберите цвет обводки аватарки</h3>
                <div class="modal-preview">
                    <div class="avatar-circle" style="${bgStyleInline}"><span class="avatar-emoji" style="${getAvatarStyle(currentUser.avatar_url)}">${currentUser.avatar_url}</span></div>
                </div>
                <div class="scrollable-content">
                    <div class="colors-grid" id="colorsGrid">
                        ${generateColorsHtml()}
                    </div>
                </div>
                <div class="modal-buttons">
                    <button id="backBtn" class="secondary">← Назад</button>
                    <button id="nextBtn">Далее →</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('borderModal');
    document.getElementById('closeModal').onclick = () => modal.remove();
    
    const updatePreview = (color) => {
        const previewCircle = modal.querySelector('.modal-preview .avatar-circle');
        const style = getBorderStyle(color);
        const currentStyle = previewCircle.getAttribute('style') || '';
        const cleaned = currentStyle.replace(/border:[^;]+;?/g, '').replace(/box-shadow:[^;]+;?/g, '');
        previewCircle.setAttribute('style', cleaned + style);
    };
    
    let selectedColor = currentColor;
    updatePreview(selectedColor);
    
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.addEventListener('click', () => {
            const colorValue = opt.dataset.color;
            if (colorValue === 'custom') {
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.value = selectedColor === '#ffffff' ? '#ffffff' : (selectedColor.startsWith('#') ? selectedColor : '#ffffff');
                colorInput.addEventListener('input', (e) => {
                    const newColor = e.target.value;
                    selectedColor = newColor;
                    updatePreview(selectedColor);
                    document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
                    opt.classList.add('selected');
                    document.querySelectorAll('.color-check').forEach(c => c.remove());
                });
                colorInput.click();
            } else {
                selectedColor = colorValue;
                updatePreview(selectedColor);
                document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                document.querySelectorAll('.color-check').forEach(c => c.remove());
                if (!opt.querySelector('.color-check')) {
                    opt.innerHTML = `<span class="color-check">✓</span>`;
                }
            }
        });
    });
    
    document.getElementById('nextBtn').onclick = async () => {
        if (selectedColor !== currentColor) {
            await window.updateUserBorder(selectedColor);
            currentUser.avatar_border = selectedColor;
        }
        modal.remove();
        nextCallback();
    };
    document.getElementById('backBtn').onclick = () => {
        modal.remove();
        if (backCallback) backCallback();
    };
}

// ========== ЗАПУСК ПОЛНОЙ КАСТОМИЗАЦИИ ==========
async function startFullCustomization(currentUser, supabase, updateUserCallback, renderProfileTab, showCustomModal) {
    await new Promise(resolve => { showAvatarStep(currentUser, updateUserCallback, resolve, showCustomModal); });
    await new Promise(resolve => {
        showBackgroundStep(currentUser, updateUserCallback, 
            async () => { resolve(); },
            async () => {
                await new Promise(r => { showAvatarStep(currentUser, updateUserCallback, r, showCustomModal); });
                await new Promise(r2 => { showBackgroundStep(currentUser, updateUserCallback, r2, null, showCustomModal); });
                resolve();
            }, 
            showCustomModal
        );
    });
    await new Promise(resolve => {
        showBorderColorStep(currentUser, updateUserCallback,
            async () => { resolve(); },
            async () => {
                await new Promise(r => { showBackgroundStep(currentUser, updateUserCallback, r, null, showCustomModal); });
                await new Promise(r2 => { showBorderColorStep(currentUser, updateUserCallback, r2, null, showCustomModal); });
                resolve();
            },
            showCustomModal
        );
    });
    await renderProfileTab();
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
        const mapping = {
            'gradient1': '#2b6e9e',
            'gradient2': '#9b59b6',
            'gradient3': '#e67e22',
            'gradient4': '#27ae60',
            'gradient5': '#f1c40f',
            'gradient6': '#e74c3c',
            'gradient7': '#1abc9c',
            'gradient8': '#3498db',
            'gradient9': '#2c3e50',
            'gradient10': '#ff9a9e',
            'gradient11': '#a18cd1'
        };
        const bgColor = mapping[currentUser.avatar_bg] || '#2b6e9e';
        avatarStyle = `background: ${bgColor};`;
        avatarClass = 'avatar-circle';
    }
    const emojiStyle = getAvatarStyle(currentUser.avatar_url);
    const borderStyle = getBorderStyle(currentUser.avatar_border || '#ffffff');
    const registeredDate = currentUser.registered_at ? new Date(currentUser.registered_at).toLocaleDateString() : 'неизвестно';

    const html = `<div class="card" style="text-align: center; overflow: visible !important;">
        <div id="avatarClickWrapper">
            <div class="${avatarClass}" style="${avatarStyle}; ${borderStyle}"><span class="avatar-emoji" style="${emojiStyle}">${currentUser.avatar_url}</span></div>
            <div class="small-text">Нажмите на аватар для кастомизации</div>
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
    document.getElementById('avatarClickWrapper')?.addEventListener('click', () => {
        startFullCustomization(currentUser, supabase, updateUserCallback, renderProfileTabBound, showCustomModal);
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
