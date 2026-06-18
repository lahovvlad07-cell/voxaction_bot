// pvp.js – модуль PvP-дуэлей

window.renderPvpTab = async function() {
    const { user } = await window.getOrCreateUser();
    const activeDuels = await window.getActiveDuels();
    const userShares = window.fromCents(user.shares);

    const html = `
        <div class="card">
            <h2 style="text-align:center;">⚔️ PvP-дуэли</h2>
            <p style="text-align:center; color:#9ca3af;">Бросайте вызов другим игрокам и выигрывайте акции!</p>
            <div style="background:rgba(0,0,0,0.2); border-radius:16px; padding:16px; margin:12px 0;">
                <label>ID соперника:</label>
                <input type="number" id="pvpOpponent" placeholder="Введите ID" style="margin-top:8px;">
                <label>Ставка (акции):</label>
                <input type="number" id="pvpStake" placeholder="Сколько акций ставите" style="margin-top:8px;">
                <button id="pvpChallengeBtn" style="background:linear-gradient(135deg,#f97316,#ea580c);">Бросить вызов</button>
            </div>
            <hr style="border-color:rgba(255,255,255,0.1);">
            <h3>📋 Активные дуэли</h3>
            <div id="pvpList">
                ${activeDuels.map(d => {
                    const isChallenger = d.challenger_id === window.userId;
                    const opponentId = isChallenger ? d.opponent_id : d.challenger_id;
                    return `
                        <div style="background:rgba(0,0,0,0.3); border-radius:16px; padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                            <span>${isChallenger ? 'Вы' : `ID ${opponentId}`} ${isChallenger ? '→' : '←'} ${isChallenger ? `ID ${opponentId}` : 'Вы'}</span>
                            <span>Ставка: ${window.fromCents(d.stake)} акций</span>
                            ${!isChallenger ? `<button class="accept-duel-btn" data-id="${d.id}" style="background:#4ade80; color:#0a0e1a; padding:4px 16px; border-radius:20px; border:none; cursor:pointer;">Принять</button>` : '<span style="color:#fbbf24;">⏳ Ожидание</span>'}
                        </div>
                    `;
                }).join('')}
                ${!activeDuels.length ? '<p style="color:#9ca3af; text-align:center;">Нет активных дуэлей</p>' : ''}
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    document.getElementById('pvpChallengeBtn').onclick = async () => {
        const opponent = parseInt(document.getElementById('pvpOpponent').value);
        const stake = parseInt(document.getElementById('pvpStake').value);
        if (!opponent || !stake) {
            window.showCustomModal('Ошибка', 'Заполните все поля');
            return;
        }
        if (opponent === window.userId) {
            window.showCustomModal('Ошибка', 'Нельзя вызвать самого себя');
            return;
        }
        if (stake < 1) {
            window.showCustomModal('Ошибка', 'Ставка должна быть ≥ 1 акции');
            return;
        }
        if (user.shares < window.toCents(stake)) {
            window.showCustomModal('Ошибка', 'Недостаточно акций');
            return;
        }
        try {
            // Блокируем ставку (списываем с вызывающего)
            await window.supabase.rpc('add_shares', {
                user_id: window.userId,
                amount_cents: -window.toCents(stake)
            });
            await window.createDuel(opponent, window.toCents(stake));
            window.currentUser.shares -= window.toCents(stake);
            window.showToast('✅ Вызов отправлен!');
            window.renderPvpTab();
        } catch(e) {
            window.showCustomModal('Ошибка', e.message);
        }
    };

    document.querySelectorAll('.accept-duel-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const duelId = parseInt(btn.dataset.id);
            try {
                const winner = await window.acceptDuel(duelId);
                window.showToast(`🏆 Победитель: ${winner === window.userId ? 'Вы' : 'Соперник'}`);
                window.renderPvpTab();
            } catch(e) {
                window.showCustomModal('Ошибка', e.message);
            }
        });
    });
};
