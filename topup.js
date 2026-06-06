// topup.js
let selectedAmount = null;

window.updateTopupFee = function(amount) {
    const fee = Math.floor(amount * 0.05);
    const receive = amount - fee;
    document.getElementById('topupFeeInfo').innerHTML = `💸 Вы платите: ${amount} ⭐<br>📉 Комиссия (5%): ${fee} ⭐<br>✅ Получите: ${receive} ⭐`;
};

function initTopupModal() {
    document.querySelectorAll('#topupModal .amount-btn').forEach(btn => btn.addEventListener('click', () => {
        document.querySelectorAll('#topupModal .amount-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        selectedAmount = parseInt(btn.dataset.amount);
        document.getElementById('customTopupAmount').value = selectedAmount;
        window.updateTopupFee(selectedAmount);
    }));
    document.getElementById('customTopupAmount')?.addEventListener('input', () => {
        let val = parseInt(document.getElementById('customTopupAmount').value);
        if (!isNaN(val) && val >= 1) {
            selectedAmount = val;
            document.querySelectorAll('#topupModal .amount-btn').forEach(b => b.classList.remove('selected'));
            window.updateTopupFee(selectedAmount);
        } else {
            document.getElementById('topupFeeInfo').innerHTML = '';
        }
    });
    document.getElementById('confirmTopupBtn')?.addEventListener('click', async () => {
        if (!selectedAmount || selectedAmount < 1) {
            window.showCustomModal('Ошибка', 'Выберите сумму');
            return;
        }
        document.getElementById('topupModal').style.display = 'none';
        try {
            const res = await fetch(`${window.BACKEND_URL}/create-invoice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: window.userId, amount: selectedAmount })
            });
            const data = await res.json();
            if (data.ok && data.invoice_link) {
                window.tg.openInvoice(data.invoice_link, (status) => {
                    if (status === 'paid') {
                        window.showCustomModal('Успех', 'Баланс пополнен');
                        window.refreshAll();
                    }
                });
            } else {
                window.showCustomModal('Ошибка', data.error || 'Не удалось создать счёт');
            }
        } catch (e) {
            window.showCustomModal('Ошибка', 'Соединение');
        }
    });
    document.getElementById('closeTopupModal')?.addEventListener('click', () => {
        document.getElementById('topupModal').style.display = 'none';
    });
}
