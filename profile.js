// profile.js – исправленная версия с правильным предпросмотром и обновлением профиля

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

// ---------- Фоны ----------
const bgOptions = [
    { id:'gradient1', name:'Синий', class:'bg-gradient1', isCustom:false },
    { id:'gradient2', name:'Фиолетовый', class:'bg-gradient2', isCustom:false },
    { id:'gradient3', name:'Оранжевый', class:'bg-gradient3', isCustom:false },
    { id:'gradient4', name:'Зелёный', class:'bg-gradient4', isCustom:false },
    { id:'gradient5', name:'Жёлтый', class:'bg-gradient5', isCustom:false },
    { id:'gradient6', name:'Красный', class:'bg-gradient6', isCustom:false },
    { id:'gradient7', name:'Бирюзовый', class:'bg-gradient7', isCustom:false },
    { id:'gradient8', name:'Лазурный', class:'bg-gradient8', isCustom:false },
    { id:'gradient9', name:'Тёмный', class:'bg-gradient9', isCustom:false },
    { id:'gradient10', name:'Розовый', class:'bg-gradient10', isCustom:false },
    { id:'gradient11', name:'Лаванда', class:'bg-gradient11', isCustom:false },
    { id:'custom', name:'🎨 Свой цвет', class:'', isCustom:true }
];

// ---------- Обводки (3 варианта) ----------
const borderOptions = [
    { id:'standard', name:'Стандартная', price:0, defaultColor:'#ffffff' },
    { id:'gold', name:'Золотая', price:50, defaultColor:'#fbbf24' },
    { id:'neon', name:'Неоновая', price:30, defaultColor:'#2b6e9e' }
];

function getBorderStyle(borderId, customColor = null) {
    const opt = borderOptions.find(b => b.id === borderId);
    if (!opt) return '';
    const color = customColor || opt.defaultColor;
    if (borderId === 'gold') return `border: 3px solid ${color}; box-shadow: 0 0 8px ${color};`;
    if (borderId === 'neon') return `border: 3px solid ${color}; box-shadow: 0 0 10px ${color};`;
    return `border: 3px solid ${color};`;
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
    let bgClass = '';
    if (currentBg && currentBg.startsWith('#')) bgClass = '';
    else {
        const found = bgOptions.find(b => b.id === currentBg);
        bgClass = found ? found.class : 'bg-gradient1';
    }
    const modalHtml = `
        <div class="modal" id="stepModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeModal">&times;</span>
                <h3>2/3 – Выберите фон аватарки</h3>
                <div class="modal-preview">
                    <div class="avatar-circle ${bgClass}" style="${currentBg && currentBg.startsWith('#') ? `background:${currentBg};` : ''}"><span class="avatar-emoji" style="${getAvatarStyle(currentUser.avatar_url)}">${currentUser.avatar_url}</span></div>
                </div>
                <div class="scrollable-content">
                    <div class="bg-grid">${optionsHtml}</div>
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
    let selectedBgValue = currentBg;
    const updatePreview = () => {
        const previewCircle = modal.querySelector('.modal-preview .avatar-circle');
        if (selectedBgValue && selectedBgValue.startsWith('#')) {
            previewCircle.style.background = selectedBgValue;
            previewCircle.className = 'avatar-circle';
        } else {
            previewCircle.style.background = '';
            const found = bgOptions.find(b => b.id === selectedBgValue);
            previewCircle.className = `avatar-circle ${found ? found.class : 'bg-gradient1'}`;
        }
    };
    document.querySelectorAll('.bg-option, .custom-color-preview').forEach(opt => {
        opt.addEventListener('click', () => {
            document.querySelectorAll('.bg-option, .custom-color-preview').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            if (opt.classList.contains('custom-color-preview')) {
                selectedBgValue = opt.dataset.bg;
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.value = selectedBgValue === 'custom' ? '#2b6e9e' : (selectedBgValue.startsWith('#') ? selectedBgValue : '#2b6e9e');
                colorInput.addEventListener('input', (e) => {
                    const newColor = e.target.value;
                    opt.style.background = newColor;
                    selectedBgValue = newColor;
                    updatePreview();
                });
                colorInput.click();
            } else {
                selectedBgValue = opt.dataset.bg;
                updatePreview();
            }
        });
    });
    document.getElementById('nextBtn').onclick = async () => {
        await updateCallback({ avatar_bg: selectedBgValue });
        currentUser.avatar_bg = selectedBgValue;
        modal.remove();
        nextCallback();
    };
    document.getElementById('backBtn').onclick = () => { modal.remove(); backCallback(); };
}

// ========== ШАГ 3: выбор обводки (исправленный) ==========
async function showBorderStep(currentUser, updateCallback, nextCallback, backCallback, showCustomModal) {
    const currentBorderId = currentUser.avatar_border || 'standard';
    // Функция получения стиля фона для превью (реальный фон пользователя)
    const getBgStyleForPreview = () => {
        if (currentUser.avatar_bg && currentUser.avatar_bg.startsWith('#')) {
            return `background: ${currentUser.avatar_bg};`;
        } else {
            const found = bgOptions.find(b => b.id === currentUser.avatar_bg);
            const bgClass = found ? found.class : 'bg-gradient1';
            return `background: ${bgClass};`;
        }
    };
    const bgStylePreview = getBgStyleForPreview();
    
    const generateOptionsHtml = () => {
        return borderOptions.map(opt => {
            const isCurrent = (opt.id === currentBorderId);
            const priceText = opt.price > 0 ? `${opt.price} ⭐` : 'Бесплатно';
            const previewStyle = getBorderStyle(opt.id, opt.defaultColor);
            return `
                <div class="border-option-item" data-border-id="${opt.id}" data-price="${opt.price}">
                    <div class="border-option-info">
                        <div class="border-option-preview" style="${previewStyle} background-color: #2b6e9e;"></div>
                        <div class="border-option-details">
                            <div class="border-option-name">${opt.name}</div>
                            <div class="border-option-price">${priceText}</div>
                        </div>
                    </div>
                    <div class="border-option-actions">
                        ${opt.id !== 'gold' ? `<input type="color" class="border-color-picker" value="${opt.defaultColor}" data-border="${opt.id}">` : ''}
                        <button class="border-select-btn" data-border="${opt.id}">${isCurrent ? '✓ Выбрано' : 'Выбрать'}</button>
                    </div>
                </div>
            `;
        }).join('');
    };
    
    const modalHtml = `
        <div class="modal" id="borderModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeModal">&times;</span>
                <h3>3/3 – Выберите обводку аватарки</h3>
                <div class="modal-preview">
                    <div class="avatar-circle" style="${bgStylePreview}"><span class="avatar-emoji" style="${getAvatarStyle(currentUser.avatar_url)}">${currentUser.avatar_url}</span></div>
                </div>
                <div class="scrollable-content">
                    <div class="border-options-container" id="borderOptionsContainer">
                        ${generateOptionsHtml()}
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
    
    // Обновление превью с учётом выбранной обводки и цвета
    const updatePreview = (borderId, customColor = null) => {
        const previewCircle = modal.querySelector('.modal-preview .avatar-circle');
        const style = getBorderStyle(borderId, customColor);
        const currentStyle = previewCircle.getAttribute('style') || '';
        // Удаляем старые border и box-shadow
        const cleaned = currentStyle.replace(/border:[^;]+;?/g, '').replace(/box-shadow:[^;]+;?/g, '');
        previewCircle.setAttribute('style', cleaned + style);
    };
    
    let selectedBorderId = currentBorderId;
    let selectedColor = borderOptions.find(b => b.id === currentBorderId)?.defaultColor;
    // Флаг, чтобы не списывать повторно при повторном выборе платной обводки
    let purchased = (currentBorderId !== 'standard');
    
    updatePreview(selectedBorderId, selectedColor);
    
    const selectButtons = modal.querySelectorAll('.border-select-btn');
    const updateButtonsState = () => {
        selectButtons.forEach(btn => {
            const borderId = btn.dataset.border;
            if (borderId === selectedBorderId) {
                btn.textContent = '✓ Выбрано';
            } else {
                btn.textContent = 'Выбрать';
            }
        });
    };
    
    selectButtons.forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const borderId = btn.dataset.border;
            const borderOpt = borderOptions.find(b => b.id === borderId);
            const price = borderOpt.price;
            let customColor = null;
            if (borderId !== 'gold') {
                const colorPicker = modal.querySelector(`.border-color-picker[data-border="${borderId}"]`);
                if (colorPicker) customColor = colorPicker.value;
            }
            if (borderId === selectedBorderId) return;
            // Проверка покупки (если платная и ещё не куплена)
            if (price > 0) {
                if (!purchased && borderId !== currentBorderId) {
                    try {
                        await window.purchaseBorder(borderId, price);
                        showCustomModal('Успех', `Обводка "${borderOpt.name}" приобретена!`);
                        purchased = true;
                        // Обновляем баланс в currentUser
                        const { data: userData } = await window.supabase.from('users').select('stars_balance').eq('id', window.userId).single();
                        if (userData) currentUser.stars_balance = userData.stars_balance;
                    } catch (err) {
                        showCustomModal('Ошибка', err.message);
                        return;
                    }
                } else {
                    await window.updateUserBorder(borderId);
                }
            } else {
                await window.updateUserBorder(borderId);
            }
            selectedBorderId = borderId;
            selectedColor = customColor || borderOpt.defaultColor;
            updatePreview(selectedBorderId, selectedColor);
            updateButtonsState();
        });
    });
    
    modal.querySelectorAll('.border-color-picker').forEach(picker => {
        picker.addEventListener('input', (e) => {
            const borderId = picker.dataset.border;
            const color = e.target.value;
            if (borderId === selectedBorderId) {
                updatePreview(borderId, color);
                selectedColor = color;
            }
        });
    });
    
    document.getElementById('nextBtn').onclick = async () => {
        if (selectedBorderId !== currentBorderId) {
            const borderOpt = borderOptions.find(b => b.id === selectedBorderId);
            const price = borderOpt.price;
            if (price > 0) {
                if (!purchased) {
                    try {
                        await window.purchaseBorder(selectedBorderId, price);
                    } catch (err) {
                        showCustomModal('Ошибка', err.message);
                        return;
                    }
                } else {
                    await window.updateUserBorder(selectedBorderId);
                }
            } else {
                await window.updateUserBorder(selectedBorderId);
            }
        }
        currentUser.avatar_border = selectedBorderId;
        modal.remove();
        // Переход к следующему шагу (вызовет resolve, затем renderProfileTab)
        nextCallback();
    };
    document.getElementById('backBtn').onclick = () => { modal.remove(); backCallback(); };
}

// ========== ЗАПУСК ПОЛНОЙ КАСТОМИЗАЦИИ ==========
async function startFullCustomization(currentUser, supabase, updateUserCallback, renderProfileTab, showCustomModal) {
    // Шаг 1
    await new Promise(resolve => {
        showAvatarStep(currentUser, updateUserCallback, resolve, showCustomModal);
    });
    // Шаг 2
    await new Promise(resolve => {
        showBackgroundStep(currentUser, updateUserCallback, async () => {
            resolve();
        }, async () => {
            await new Promise(r => { showAvatarStep(currentUser, updateUserCallback, r, showCustomModal); });
            await new Promise(r2 => { showBackgroundStep(currentUser, updateUserCallback, r2, null, showCustomModal); });
            resolve();
        }, showCustomModal);
    });
    // Шаг 3
    await new Promise(resolve => {
        showBorderStep(currentUser, updateUserCallback, async () => {
            resolve();
        }, async () => {
            await new Promise(r => { showBackgroundStep(currentUser, updateUserCallback, r, null, showCustomModal); });
            await new Promise(r2 => { showBorderStep(currentUser, updateUserCallback, r2, null, showCustomModal); });
            resolve();
        }, showCustomModal);
    });
    // Принудительно перерисовываем профиль после всех шагов
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
        const found = bgOptions.find(b => b.id === currentUser.avatar_bg);
        avatarClass += ` ${found ? found.class : 'bg-gradient1'}`;
    }
    const emojiStyle = getAvatarStyle(currentUser.avatar_url);
    // Пока без пользовательского цвета, только стандартные
    const borderStyle = getBorderStyle(currentUser.avatar_border);
    const registeredDate = currentUser.registered_at ? new Date(currentUser.registered_at).toLocaleDateString() : 'неизвестно';

    const html = `<div class="card" style="text-align: center; overflow: visible !important;">
        <div id="avatarClickWrapper">
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
