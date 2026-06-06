// modules/config.js

// Получаем объект Telegram WebApp (глобальный)
export const tg = window.Telegram.WebApp;

// Данные пользователя из Telegram
export const userId = tg.initDataUnsafe?.user?.id;
export const username = tg.initDataUnsafe?.user?.username || `user_${userId}`;

// URL бэкенда (для инвойсов и админ-команд)
export const BACKEND_URL = 'https://voxaction-bot-main.onrender.com';

// Проверка администратора (твой ID)
export const isAdmin = userId === 6048486427;

// Инициализация WebApp (разворачивание на весь экран)
export function initTelegram() {
    tg.ready();
    tg.expand();
}