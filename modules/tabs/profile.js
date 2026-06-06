// modules/tabs/profile.js

import { userId } from '../config.js';
import { fromCents } from '../utils.js';
import { getUserStats, getUserRank, getEarnedAchievements, getNextAchievementsProgress } from '../api.js';
import { bgOptions, getAvatarStyle, openAvatarSelector } from '../avatar.js';
import { openAchievementSelectorForSlot } from '../achievementSelect.js';
import { showNotificationsModal, updateBellBadge } from '../notifications.js';
import { currentUser } from '../user.js';

export async function renderProfileTab() {
    const stats = await getUserStats();
    const earnedAchievements = await getEarnedAchievements(userId);
    const selectedIds = currentUser.selected_achievements || [];

    const iconsHtml = [];
    for (let i = 0; i < 3; i++) {
        const achId = selectedIds[i];
        const ach = earnedAchievements.find(a => a.id === achId);
        iconsHtml.push(ach
            ? `<div class="achi-icon earned" data-slot="${i}" data-ach-id="${ach.id}" title="${ach.name}: ${ach.description}">${ach.icon}</div>`
            : `<div class="achi-icon" data-slot="${i}">?</div>`
        );
    }

    const rank = await getUserRank();
    const rankHtml = rank ? `<div class="rank-card"><span>🏆 Рейтинг</span><span style="font-size:20px; font-weight:bold;">#${rank}</span></div>` : '';

    const nextAchievements = await getNextAchievementsProgress(userId, currentUser);
    let nextHtml = '';
    if (nextAchievements.length > 0) {
        nextHtml = `<div class="next-achievements"><div class="small-text" style="margin-bottom:8px;">📋 Ближайшие достижения:</div>`;
        for (let ach of nextAchievements) {
            let conditionStr = '';
            switch (ach.condition_type) {
                case 'trades_count': conditionStr = `${ach.current}/${ach.needed} сделок`; break;
                case 'shares_held': conditionStr = `${ach.current / 100}/${ach.needed / 100} акций`; break;
                case 'referrals_count': conditionStr = `${ach.current}/${ach.needed} приглашений`; break;
                case 'total_topup': conditionStr = `${ach.current / 100}/${ach.needed / 100} ⭐`; break;
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

    const html = `
        <div class="card" style="text-align: center;">
            <div class="profile-header">
                <div class="profile-avatar" id="avatarClick">
                    <div class="${avatarClass}" style="${avatarStyle}">
                        <span class="avatar-emoji" style="${emojiStyle}">${currentUser.avatar_url}</span>
                    </div>
                    <div class="small-text">Нажмите, чтобы сменить аватар и фон</div>
                </div>
                <div class="notification-bell" id="notificationBell">
                    🔔
                    <span class="notification-badge" style="display:none;">0</span>
                </div>
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
        </div>
    `;

    document.getElementById('app').innerHTML = html;

    document.getElementById('avatarClick')?.addEventListener('click', openAvatarSelector);
    document.getElementById('notificationBell')?.addEventListener('click', showNotificationsModal);

    document.querySelectorAll('.achi-icon').forEach(icon => {
        icon.addEventListener('click', async () => {
            const slot = parseInt(icon.dataset.slot);
            const currentAchId = icon.dataset.achId ? parseInt(icon.dataset.achId) : null;
            await openAchievementSelectorForSlot(slot, earnedAchievements, selectedIds, currentAchId);
        });
    });

    await updateBellBadge();
}