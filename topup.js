// topup.js – с вызовом refreshActiveTab после оплаты
let selectedAmount = null;

window.updateTopupFee = function(amount) {
    const fee = Math.floor(amount * 0.05);
    const receive = amount - fee;
    const feeInfo = document.getElementById('topupFeeInfo');
    if (feeInfo) {
        feeInfo.innerHTML = `💸 Вы платите: ${amount} ⭐<br>📉 Комиссия (5%): ${fee} ⭐<br>✅ Получите: ${receive} ⭐`;
    }
};

function initTopupModal() {
    const modal = document.getElementById('topupModal');
    if (!modal) return;
    
    const amountBtns = document.querySelectorAll('#topupModal .amount-btn');
    amountBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            amountBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAmount = parseInt(btn.dataset.amount);
            const customInput = document.getElementById('customTopupAmount');
            if (customInput) customInput.value = selectedAmount;
            window.updateTopupFee(selectedAmount);
        });
    });
    
    const customInput = document.getElementById('customTopupAmount');
    if (customInput) {
        customInput.addEventListener('input', () => {
            let val = parseInt(customInput.value);
            if (!isNaN(val) && val >= 1) {
                selectedAmount = val;
                amountBtns.forEach(b => b.classList.remove('selected'));
                window.updateTopupFee(selectedAmount);
            } else {
                const feeInfo = document.getElementById('topupFeeInfo');
                if (feeInfo) feeInfo.innerHTML = '';
            }
        });
    }
    
    const confirmBtn = document.getElementById('confirmTopupBtn');
    if (confirmBtn) {
        confirmBtn.addEventListener('click', async () => {
            if (!selectedAmount || selectedAmount < 1) {
                window.showCustomModal('Ошибка', 'Выберите сумму');
                return;
            }
            modal.style.display = 'none';
            try {
                const res = await window.createInvoice(selectedAmount);
                if (res.ok && res.invoice_link) {
                    window.tg.openInvoice(res.invoice_link, async (status) => {
                        if (status === 'paid') {
                            window.showCustomModal('Успех', 'Баланс пополнен');
                            await window.refreshActiveTab(); // автообновление
                        }
                    });
                } else {
                    window.showCustomModal('Ошибка', res.error || 'Не удалось создать счёт');
                }
            } catch(e) {
                window.showCustomModal('Ошибка', 'Соединение');
            }
        });
    }
    
    const closeBtn = document.getElementById('closeTopupModal');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
}
