// withdraw.js – модуль вывода средств

window.renderWithdrawTab = async function() {
    const { user } = await window.getOrCreateUser();
    const starsBalance = window.fromCents(user.stars_balance);
    const withdrawals = await window.getWithdrawals();

    const html = `
        <div class="card">
            <h2 style="text-align:center;">💸 Вывод Stars</h2>
            <p style="text-align:center; font-size:18px;">Баланс: <strong>${starsBalance} ⭐</strong></p>
            <div style="background:rgba(0,0,0,0.2); border-radius:16px; padding:16px; margin:12px 0;">
                <label>Сумма вывода (минимум 10 ⭐):</label>
                <input type="number" id="withdrawAmount" placeholder="Введите сумму" min="10" style="margin-top:8px;">
                <button id="withdrawBtn" style="background:linear-gradient(135deg,#2b6e9e,#1a4c6e);">Запросить вывод</button>
            </div>
            <hr style="border-color:rgba(255,255,255,0.1);">
            <h3>📋 История заявок</h3>
            <div id="withdrawHistory">
                ${withdrawals.map(w => `
                    <div style="background:rgba(0,0,0,0.3); border-radius:16px; padding:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                        <span>${window.fromCents(w.amount)} ⭐</span>
                        <span style="font-size:12px; color:${w.status === 'approved' ? '#4ade80' : w.status === 'rejected' ? '#f87171' : '#fbbf24'}">
                            ${w.status === 'pending' ? '⏳ На рассмотрении' : w.status === 'approved' ? '✅ Одобрен' : '❌ Отклонён'}
                        </span>
                        <span style="font-size:11px; color:#9ca3af;">${new Date(w.created_at).toLocaleDateString()}</span>
                    </div>
                `).join('')}
                ${!withdrawals.length ? '<p style="color:#9ca3af; text-align:center;">Нет заявок</p>' : ''}
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    document.getElementById('withdrawBtn').onclick = async () => {
        const amount = parseInt(document.getElementById('withdrawAmount').value);
        if (!amount || amount < 10) {
            window.showCustomModal('Ошибка', 'Минимальная сумма вывода – 10 ⭐');
            return;
        }
        if (amount > parseFloat(starsBalance)) {
            window.showCustomModal('Ошибка', 'Недостаточно Stars');
            return;
        }
        try {
            const amountCents = window.toCents(amount);
            // Списываем Stars
            await window.supabase.rpc('add_stars', {
                user_id: window.userId,
                amount_cents: -amountCents
            });
            // Создаём заявку
            await window.createWithdrawal(amountCents);
            window.currentUser.stars_balance -= amountCents;
            window.showToast('✅ Заявка на вывод отправлена');
            window.renderWithdrawTab();
        } catch(e) {
            window.showCustomModal('Ошибка', e.message);
        }
    };
};
