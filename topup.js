// topup.js – модалка пополнения с ограничением 500 ⭐ за 12 часов
window.showTopupModal = function() {
    const modalHtml = `
        <div class="modal" id="topupModalNew" style="display:flex;">
            <div class="modal-content topup-modal">
                <span class="close-modal" id="closeTopupModalNew">&times;</span>
                <h3>💸 Пополнение Stars</h3>
                <div class="topup-amount-buttons">
                    <button class="amount-preset" data-amount="100">100 ⭐</button>
                    <button class="amount-preset" data-amount="200">200 ⭐</button>
                    <button class="amount-preset" data-amount="300">300 ⭐</button>
                    <button class="amount-preset" data-amount="400">400 ⭐</button>
                    <button class="amount-preset" data-amount="500">500 ⭐</button>
                </div>
                <div class="custom-amount">
                    <input type="number" id="customTopupAmount" placeholder="Своя сумма (100–500)" min="100" max="500" step="1">
                </div>
                <div id="topupFeeInfo" class="topup-fee"></div>
                <div class="topup-limit-info">⚠️ Максимум 500 ⭐ за 12 часов. Комиссия 5%.</div>
                <button id="confirmTopupBtnNew" class="topup-confirm-btn">Пополнить</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('topupModalNew');
    let selectedAmount = null;
    
    const updateFee = (amount) => {
        if (!amount || amount < 100) {
            document.getElementById('topupFeeInfo').innerHTML = '';
            return;
        }
        const fee = Math.floor(amount * 0.05);
        const receive = amount - fee;
        document.getElementById('topupFeeInfo').innerHTML = `
            <div class="fee-row">💰 Сумма: ${amount} ⭐</div>
            <div class="fee-row">📉 Комиссия (5%): ${fee} ⭐</div>
            <div class="fee-row highlight">✅ Вы получите: ${receive} ⭐</div>
        `;
    };
    
    document.querySelectorAll('.amount-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.amount-preset').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAmount = parseInt(btn.dataset.amount);
            const customInput = document.getElementById('customTopupAmount');
            if (customInput) customInput.value = selectedAmount;
            updateFee(selectedAmount);
        });
    });
    
    const customInput = document.getElementById('customTopupAmount');
    if (customInput) {
        customInput.addEventListener('input', () => {
            let val = parseInt(customInput.value);
            if (!isNaN(val) && val >= 100 && val <= 500) {
                selectedAmount = val;
                document.querySelectorAll('.amount-preset').forEach(b => b.classList.remove('selected'));
                updateFee(selectedAmount);
            } else {
                document.getElementById('topupFeeInfo').innerHTML = '<div class="fee-row error">Сумма должна быть от 100 до 500 ⭐</div>';
                selectedAmount = null;
            }
        });
    }
    
    const closeModal = () => modal.remove();
    document.getElementById('closeTopupModalNew').onclick = closeModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    
    document.getElementById('confirmTopupBtnNew').onclick = async () => {
        if (!selectedAmount || selectedAmount < 100 || selectedAmount > 500) {
            window.showCustomModal('Ошибка', 'Введите сумму от 100 до 500 ⭐');
            return;
        }
        closeModal();
        try {
            const res = await window.createInvoice(selectedAmount);
            if (res.ok && res.invoice_link) {
                window.tg.openInvoice(res.invoice_link, (status) => {
                    if (status === 'paid') {
                        window.showCustomModal('Успех', 'Баланс пополнен!');
                        if (window.refreshActiveTab) window.refreshActiveTab();
                    }
                });
            } else {
                window.showCustomModal('Ошибка', res.error || 'Не удалось создать счёт');
            }
        } catch(e) {
            window.showCustomModal('Ошибка', 'Соединение не удалось');
        }
    };
};

// Инициализация старой модалки (если нужна совместимость) – можно оставить пустую
function initTopupModal() {
    // Новая модалка вызывается через window.showTopupModal, старая не используется
}
