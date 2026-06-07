window.renderReferralTab = async function() {
    const currentUser = window.currentUser;
    const activeCode = currentUser.referral_code;
    const fullLink = `https://t.me/VoxAction_Bot?start=${activeCode}`;
    const referralCount = currentUser.referral_count || 0;

    const bonusLevels = [
        { friends: 1, stars: 3 },
        { friends: 3, stars: 5 },
        { friends: 5, stars: 10 },
        { friends: 10, stars: 25 }
    ];

    // загружаем полученные бонусы
    let claimedFriends = [];
    try {
        const { data } = await window.supabase
            .from('referral_bonuses')
            .select('friends_required')
            .eq('user_id', window.userId);
        claimedFriends = data.map(b => b.friends_required);
    } catch(e) {}

    // следующий уровень
    let nextLevel = null;
    for (let l of bonusLevels) {
        if (!claimedFriends.includes(l.friends)) {
            nextLevel = l;
            break;
        }
    }
    const allCompleted = !nextLevel;
    const target = nextLevel ? nextLevel.friends : bonusLevels[bonusLevels.length-1].friends;
    const progressPercent = Math.min(100, (referralCount / target) * 100);
    const remaining = Math.max(0, target - referralCount);
    const rewardStars = nextLevel ? nextLevel.stars : 0;
    const canClaim = (referralCount >= target) && nextLevel !== null;

    // HTML
    let html = `
        <div class="card" style="overflow: visible !important;">
            <div class="referral-header">
                <h2>Приводи друзей и зарабатывай</h2>
                <p>Приглашай друзей, получай звёзды и бонусы</p>
            </div>
            <div class="stats-circles">
                <div class="stat-circle">
                    <div class="value">${referralCount}</div>
                    <div class="label">друзей</div>
                </div>
                <div class="stat-circle">
                    <div class="value">${window.fromCents(currentUser.stars_balance)}</div>
                    <div class="label">баланс ⭐</div>
                </div>
            </div>
    `;

    if (allCompleted) {
        html += `<div class="progress-block"><div class="all-bonuses-claimed">🎉 Все награды собраны! Спасибо, что с нами!</div></div>`;
    } else {
        html += `
            <div class="progress-block">
                <div class="progress-label">🎁 До следующей награды <strong>${rewardStars} ⭐</strong> осталось пригласить <strong>${remaining}</strong> друга(ей)</div>
                <div class="progress-bar"><div class="progress-fill" style="width: ${progressPercent}%;"></div></div>
                <div class="progress-stats">${referralCount} / ${target}</div>
                ${canClaim ? `<button class="claim-btn" data-friends="${target}" data-stars="${rewardStars}">🎁 Получить ${rewardStars} ⭐</button>` : ''}
            </div>
        `;
    }

    html += `
            <div class="invite-section">
                <div class="invite-link">${fullLink}</div>
                <div class="invite-buttons">
                    <button class="copy-btn" id="copyRefLinkBtn">📋 Копировать</button>
                    <button class="share-btn" id="shareRefLinkBtn">📤 Поделиться</button>
                </div>
            </div>
            <div class="bonus-stock-card">
                <div class="bonus-stock-icon">🎁</div>
                <div class="bonus-stock-text">
                    <strong>Бонус за пополнение друга:</strong> вы получите <strong>5 акций</strong>, а ваш друг — <strong>5 ⭐</strong>, когда он пополнит баланс от <strong>10 ⭐</strong>.
                </div>
            </div>
            <div class="referrals-toggle" id="referralsToggle">
                <span>👥 Приглашённые</span>
                <span class="badge">${referralCount}</span>
            </div>
            <div class="referrals-list-collapsible" id="referralsListCollapsible">
                <div id="referralsListContent"></div>
            </div>
            <div class="legend">
                ⭐ Звёзды начисляются автоматически за каждого приведённого друга (по достижении порога). 
                Бонусные акции за пополнение друга — после его первого пополнения от 10 ⭐.
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    // обработчики
    document.getElementById('copyRefLinkBtn')?.addEventListener('click', () => {
        navigator.clipboard.writeText(fullLink);
        window.showCustomModal('Скопировано', 'Ссылка скопирована');
    });
    document.getElementById('shareRefLinkBtn')?.addEventListener('click', () => {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(fullLink)}&text=${encodeURIComponent('Присоединяйся ко мне в VoxAction бирже! 🚀')}`;
        if (window.tg && window.tg.openTelegramLink) window.tg.openTelegramLink(shareUrl);
        else window.open(shareUrl, '_blank');
    });

    // аккордеон списка рефералов
    const toggleBtn = document.getElementById('referralsToggle');
    const collapsible = document.getElementById('referralsListCollapsible');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', async () => {
            collapsible.classList.toggle('open');
            if (collapsible.classList.contains('open') && !document.getElementById('referralsListContent').innerHTML) {
                const list = await window.getReferralsList();
                let content = '';
                if (list.length === 0) content = '<div style="padding:20px;text-align:center;">Нет приглашённых</div>';
                else {
                    content = list.map(r => `
                        <div class="referral-item">
                            <div style="display:flex; align-items:center; gap:10px;">
                                <span style="font-size:28px;">${r.avatarUrl}</span>
                                <div><strong>${escapeHtml(r.username)}</strong><br><span style="font-size:10px;color:#6b7280;">ID: ${r.userId}</span></div>
                            </div>
                            <div>${r.topupCompleted ? `<span class="status-success">✅ пополнил</span>` : `<span class="status-pending">⏳ ждём</span>`}</div>
                        </div>
                    `).join('');
                }
                document.getElementById('referralsListContent').innerHTML = content;
            }
        });
    }

    const claimBtn = document.querySelector('.claim-btn');
    if (claimBtn) {
        claimBtn.addEventListener('click', async () => {
            const friends = parseInt(claimBtn.dataset.friends);
            const stars = parseInt(claimBtn.dataset.stars);
            const result = await window.claimReferralBonus(friends, stars);
            if (result.ok) {
                window.showToast(`🎉 Получено ${stars} ⭐!`);
                const { user } = await window.getOrCreateUser();
                window.currentUser = user;
                await window.renderReferralTab();
            } else {
                window.showCustomModal('Ошибка', result.error || 'Не удалось получить');
            }
        });
    }
};

function escapeHtml(str) { if (!str) return ''; return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m])); }
