// modules/avatar.js

import { supabase } from './supabaseClient.js';
import { userId, tg } from './config.js';
import { showCustomModal } from './utils.js';
import { awardAvatarAchievement } from './achievements.js';
import { currentUser, setCurrentUser, updateUserField } from './user.js';
import { renderProfileTab } from './tabs/profile.js';

// Список доступных аватаров (эмодзи)
export const avatarEmojis = [
    '👤', '😀', '😎', '🐱', '🐶', '🦊', '🐼', '⭐', '🎮', '⚽',
    '🚀', '💎', '🌸', '🔥', '❤️', '👍', '🎉', '🌟', '🍕', '🏆',
    '🎨', '📷', '⚡', '🔮'
];

// Коррекция положения для некоторых эмодзи
export const avatarAdjustments = {
    '🐱': -8, '🐶': -8, '🐼': -7, '🦊': -5,
    '⚽': -3, '💎': -3, '🌸': -3, '🔥': -3,
    '🎉': -3, '🌟': -3, '🍕': -3, '🏆': -3,
    '🎨': -3, '📷': -3, '⚡': -3, '🔮': -3,
    '🚀': -3, '🎮': -3
};

// Размер шрифта для некоторых эмодзи
export const avatarFontSizes = {
    '⚡': '56px', '🔮': '56px', '🎮': '56px', '🚀': '56px',
    '⭐': '56px', '🌟': '56px', '🔥': '56px', '💎': '56px',
    '🎉': '56px', '⚽': '56px', '📷': '56px', '🎨': '56px'
};

// Функция для получения inline-стиля аватара
export function getAvatarStyle(emoji) {
    const adjust = avatarAdjustments[emoji] || 0;
    const fontSize = avatarFontSizes[emoji] || '48px';
    return `transform: translateY(${adjust}px); font-size: ${fontSize};`;
}

// Доступные фоны аватарки
export const bgOptions = [
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

// Открыть модалку выбора аватара
export async function openAvatarSelector() {
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
                <h3>Выберите аватар</h3>
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
        await updateUserField('avatar_url', selectedAvatar);
        currentUser.avatar_url = selectedAvatar;
        document.getElementById('avatarModal').remove();
        await awardAvatarAchievement();   // выдаём достижение за выбор аватарки
        await openBackgroundSelector();
    };
}

// Открыть модалку выбора фона аватарки
export async function openBackgroundSelector() {
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
    const modalHtml = `
        <div class="modal" id="bgModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeBgModal">&times;</span>
                <h3>Выберите фон аватарки</h3>
                <div class="bg-grid">${optionsHtml}</div>
                <button id="saveBgBtn">Сохранить</button>
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

    document.getElementById('saveBgBtn').onclick = async () => {
        await updateUserField('avatar_bg', selectedBgValue);
        currentUser.avatar_bg = selectedBgValue;
        document.getElementById('bgModal').remove();
        await awardAvatarAchievement();
        await renderProfileTab();
    };
}