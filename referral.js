window.renderReferralTab = async function() {
    const currentUser = window.currentUser;
    const activeCode = currentUser.referral_code;
    const fullLink = `https://t.me/VoxAction_Bot?start=${activeCode}`;
    const referralCount = currentUser.referral_count || 0;

    // Бонусные уровни: [друзей, звёзд]
    const bonusLevels = [
        { friends: 1, stars: 3 },
        { friends: 3, stars: 5 },
        { friends: 5, stars: 10 },
        { friends: 10, stars: 25 }
    ];

    // Загружаем уже полученные бонусы (список friends_required)
    let claimedFriends = [];
    try {
        const { data } = await window.supabase
            .from('referral_bonuses')
            .select('friends_required')
            .eq('user_id', window.userId);
        claimedFriends = data.map(b => b.friends_required);
    } catch(e) { console.warn(e); }

    // Определяем текущий следующий неполученный уровень
    let nextLevel = null;
    for (let level of bonusLevels) {
        if (!claimedFriends.includes(level.friends)) {
            nextLevel = level;
            break;
        }
    }

    // Если все уровни получены – показываем финальное сообщение
    const allCompleted = !nextLevel;

    // Прогресс: сколько друзей до следующего уровня
    const current = referralCount;
    const target = nextLevel ? nextLevel.friends : bonusLevels[bonusLevels.length-1].friends;
    const progressPercent = Math.min(100, (current / target) * 100);
    const remaining = Math.max(0, target - current);
    const rewardStars = nextLevel ? nextLevel.stars : 0;

    // Проверяем, можно ли получить бонус прямо сейчас (прогресс 100% и ещё не получен)
    const canClaim = (current >= target) && nextLevel !== null;

    // HTML-структура
    let html = `
        <div class="card" style="overflow: visible !important;">
            <h2 class="referral-title">🔗 Реферальная система</h2>
            <div class="referral-stats">
                <div class="stat-block">
                    <div class="stat-number">${referralCount}</div>
                    <div class="stat-label">Приглашено друзей</div>
                </div>
                <div class="stat-block">
                    <div class="stat-number">${window.fromCents(currentUser.stars_balance)}</div>
                    <div class="stat-label">Ваш баланс ⭐</div>
                </div>
            </div>

            <div class="link-section">
                <div class="link-url" id="refLinkText">${fullLink}</div>
                <div class="link-buttons">
                    <button class="copy-btn" id="copyRefLinkBtn">📋 Копировать</button>
                    <button class="share-btn" id="shareRefLinkBtn">📤 Поделиться</button>
                </div>
                <div class="link-hint">Нажмите «Поделиться», чтобы отправить ссылку другу в Telegram</div>
            </div>

            <div class="bonus-card">
                <div class="bonus-icon">🎁</div>
                <div class="bonus-text">
                    <strong>Бонус за друга:</strong> вы получите <strong>5 акций</strong>, а ваш друг — <strong>5 ⭐</strong>,<br>
                    когда он пополнит баланс от <strong>10 ⭐</strong>.
                </div>
            </div>

            <button id="showReferralsListBtn" class="referral-list-btn">
                <span class="btn-icon">👥</span>
                <span class="btn-text">Приглашённые пользователи</span>
                <span class="badge-count">${referralCount}</span>
            </button>

            <div class="progress-card">
                <div class="progress-title">
                    <span class="trophy-icon">🏆</span>
                    Бонусы за приглашение друзей
                </div>
    `;

    if (allCompleted) {
        html += `<div class="all-bonuses-claimed">🎉 Вы получили все бонусы! Спасибо за активность!</div>`;
    } else {
        html += `
                <div class="next-bonus-info">
                    <div>🎯 Пригласите ещё <strong>${remaining}</strong> друга(ей), чтобы получить <strong>${rewardStars} ⭐</strong></div>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
                <div class="progress-stats">${current} / ${target}</div>
        `;
        if (canClaim) {
            html += `<button id="claimBonusBtn" class="claim-bonus-btn" data-friends="${target}" data-stars="${rewardStars}">🎁 Забрать ${rewardStars} ⭐</button>`;
        }
    }

    html += `
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    // Обработчики
    document.getElementById('copyRefLinkBtn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(fullLink);
        window.showCustomModal('Скопировано', 'Реферальная ссылка скопирована');
    });

    document.getElementById('shareRefLinkBtn')?.addEventListener('click', () => {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(fullLink)}&text=${encodeURIComponent('Присоединяйся ко мне в VoxAction бирже! 🚀')}`;
        if (window.tg && window.tg.openTelegramLink) {
            window.tg.openTelegramLink(shareUrl);
        } else {
            window.open(shareUrl, '_blank');
        }
    });

    document.getElementById('showReferralsListBtn')?.addEventListener('click', async () => {
        const referralsList = await window.getReferralsList();
        showReferralsModal(referralsList);
    });

    const claimBtn = document.getElementById('claimBonusBtn');
    if (claimBtn) {
        claimBtn.addEventListener('click', async () => {
            const friendsNeeded = parseInt(claimBtn.dataset.friends);
            const stars = parseInt(claimBtn.dataset.stars);
            const result = await window.claimReferralBonus(friendsNeeded, stars);
            if (result.ok) {
                window.showToast(`🎉 Получено ${stars} ⭐ за приглашение ${friendsNeeded} друга(ей)!`);
                // Обновляем пользователя и перерисовываем
                const { user } = await window.getOrCreateUser();
                window.currentUser = user;
                await window.renderReferralTab();
            } else {
                window.showCustomModal('Ошибка', result.error || 'Не удалось получить бонус');
            }
        });
    }
};

// showReferralsModal и escapeHtml (без изменений)
async function showReferralsModal(referrals) {
    let listHtml = '';
    if (referrals.length === 0) {
        listHtml = '<p style="text-align:center; padding:20px;">У вас пока нет приглашённых друзей</p>';
    } else {
        listHtml = referrals.map(r => `
            <div class="referral-item">
                <div class="referral-user">
                    <div class="referral-avatar" style="font-size:32px;">${r.avatarUrl}</div>
                    <div>
                        <div class="referral-username"><strong>${escapeHtml(r.username)}</strong></div>
                        <div class="referral-id">ID: ${r.userId}</div>
                        <div class="referral-date">${new Date(r.registeredAt).toLocaleDateString()}</div>
                    </div>
                </div>
                <div class="referral-status">
                    ${r.topupCompleted 
                        ? `<span class="status-success">✅ Пополнил на ${r.topupAmount} ⭐</span>` 
                        : `<span class="status-pending">⏳ Не пополнил</span>`}
                </div>
            </div>
        `).join('');
    }

    const modalHtml = `
        <div class="modal" id="referralsModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeReferralsModal">&times;</span>
                <h3>👥 Приглашённые пользователи</h3>
                <div class="scrollable-content">
                    <div class="referrals-list">${listHtml}</div>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById('closeReferralsModal').onclick = () => {
        document.getElementById('referralsModal').remove();
    };
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
