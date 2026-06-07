window.renderReferralTab = async function() {
    const currentUser = window.currentUser;
    const activeCode = currentUser.referral_code;
    const fullLink = `https://t.me/VoxAction_Bot?start=${activeCode}`;
    const referralCount = currentUser.referral_count || 0;

    // Список бонусов: сколько друзей -> сколько звёзд
    const bonusLevels = [
        { friends: 1, stars: 3 },
        { friends: 3, stars: 5 },
        { friends: 5, stars: 10 },
        { friends: 10, stars: 25 }
    ];

    // Загружаем полученные бонусы пользователя (если есть)
    let claimedBonuses = [];
    try {
        const { data } = await window.supabase
            .from('referral_bonuses')
            .select('friends_required')
            .eq('user_id', window.userId);
        claimedBonuses = data.map(b => b.friends_required);
    } catch(e) { console.warn(e); }

    // Функция начисления бонуса
    window.claimReferralBonus = async (friendsNeeded, stars) => {
        const res = await fetch(`${window.BACKEND_URL}/claim-referral-bonus`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: window.userId, friends_needed: friendsNeeded, stars: stars })
        });
        const data = await res.json();
        if (data.ok) {
            window.showToast(`🎉 Получено ${stars} ⭐ за приглашение ${friendsNeeded} друга(ей)!`);
            // Обновляем данные пользователя
            const { user } = await window.getOrCreateUser();
            window.currentUser = user;
            await window.renderReferralTab();
        } else {
            window.showCustomModal('Ошибка', data.error || 'Не удалось получить бонус');
        }
    };

    // Генерируем HTML бонусов
    let bonusesHtml = '';
    for (let level of bonusLevels) {
        const reached = referralCount >= level.friends;
        const alreadyClaimed = claimedBonuses.includes(level.friends);
        let status = '';
        let actionButton = '';

        if (!reached) {
            status = '🔒 Недоступно';
            actionButton = `<button class="bonus-claim-btn disabled" disabled>Недоступно</button>`;
        } else if (alreadyClaimed) {
            status = '✅ Получено';
            actionButton = `<span class="bonus-claimed-badge">✅ Получено</span>`;
        } else {
            status = '🎁 Доступно';
            actionButton = `<button class="bonus-claim-btn" data-friends="${level.friends}" data-stars="${level.stars}">Забрать ${level.stars} ⭐</button>`;
        }

        bonusesHtml += `
            <div class="bonus-level-card">
                <div class="bonus-level-icon">🎯</div>
                <div class="bonus-level-info">
                    <div class="bonus-level-title">${level.friends} друг(ей)</div>
                    <div class="bonus-level-reward">🏆 ${level.stars} ⭐</div>
                    <div class="bonus-level-status">${status}</div>
                </div>
                <div class="bonus-level-action">
                    ${actionButton}
                </div>
            </div>
        `;
    }

    const nextMilestone = bonusLevels.find(l => referralCount < l.friends)?.friends || 10;
    const progressPercent = Math.min(100, (referralCount / nextMilestone) * 100);
    const remaining = nextMilestone - referralCount;

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

            <!-- Новый блок: бонусы за достижение количества друзей -->
            <div class="progress-card">
                <div class="progress-title">
                    <span class="trophy-icon">🏆</span>
                    Бонусы за приглашение друзей
                </div>
                <div class="bonus-levels-list">
                    ${bonusesHtml}
                </div>
                <div class="progress-info" style="margin-top: 16px;">
                    <span>Следующая награда: <strong>${remaining}</strong> друг(ей) → ${bonusLevels.find(l => l.friends === nextMilestone)?.stars} ⭐</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
                <div class="progress-stats">${referralCount} / ${nextMilestone}</div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

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

    // Обработчики кнопок получения бонусов
    document.querySelectorAll('.bonus-claim-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const friends = parseInt(btn.dataset.friends);
            const stars = parseInt(btn.dataset.stars);
            await window.claimReferralBonus(friends, stars);
        });
    });
};

// showReferralsModal и escapeHtml остаются без изменений
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
