// modules/achievementSelect.js

import { supabase } from './supabaseClient.js';
import { userId } from './config.js';
import { showCustomModal } from './utils.js';
import { currentUser, setCurrentUser } from './user.js';
import { renderProfileTab } from './tabs/profile.js';

// Открыть модалку выбора достижения для конкретного слота (0-2)
export async function openAchievementSelectorForSlot(slot, earnedAchievements, currentSelectedIds, currentSlotAchievementId) {
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
            switch (ach.condition_type) {
                case 'trades_count': conditionText = `📊 Сделок: ${ach.condition_value}`; break;
                case 'shares_held': conditionText = `📈 Акций: ${ach.condition_value / 100}`; break;
                case 'referrals_count': conditionText = `👥 Приглашений: ${ach.condition_value}`; break;
                case 'total_topup': conditionText = `💰 Пополнено: ${ach.condition_value / 100} ⭐`; break;
            }
        }
        return `<div class="achievement-card ${selectedClass} ${disabledClass}" data-ach-id="${ach.id}" data-disabled="${isUsedElsewhere}">
            <div class="achievement-icon">${ach.icon}</div>
            <div class="achievement-name">${ach.name}</div>
            <div class="achievement-desc">${ach.description}</div>
            ${conditionText ? `<div class="achievement-condition">${conditionText}</div>` : ''}
            <div class="achievement-date">🏅 Получено: ${earnedDate}</div>
        </div>`;
    }).join('');

    const modalHtml = `
        <div class="modal" id="achiSelectorModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeAchiSelector">&times;</span>
                <h3>Выберите достижение для слота ${slot + 1}</h3>
                <div class="achievements-grid" id="achiGrid">${gridHtml}</div>
                ${isSlotOccupied ? `<button id="clearSlotBtn" class="secondary">🗑️ Очистить слот</button>` : ''}
                <button id="saveAchiSelection">Сохранить</button>
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
            newSelectedIds = newSelectedIds.filter(id => id !== null && id !== undefined);
            await supabase.from('users').update({ selected_achievements: newSelectedIds }).eq('id', userId);
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
        newSelectedIds = newSelectedIds.filter(id => id !== null && id !== undefined);
        // сохраняем только не-null значения
        const saveArray = newSelectedIds.filter(v => v !== null);
        await supabase.from('users').update({ selected_achievements: saveArray }).eq('id', userId);
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