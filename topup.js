// topup.js – модалка пополнения с живым расчётом комиссии
window.showTopupModal = function(onSuccess) {
    const modalHtml = `
        <div class="modal" id="topupModalNew" style="display:flex;">
            <div class="modal-content topup-modal">
                <span class="close-modal" id="closeTopupModalNew">&times;</span>
                <h3>💸 Пополнение Stars</h3>
                <div class="topup-amount-buttons">
                    <button class="amount-preset" data-amount="10">10 ⭐</button>
                    <button class="amount-preset" data-amount="50">50 ⭐</button>
                    <button class="amount-preset" data-amount="100">100 ⭐</button>
                    <button class="amount-preset" data-amount="200">200 ⭐</button>
                    <button class="amount-preset" data-amount="500">500 ⭐</button>
                </div>
                <div class="custom-amount">
                    <input type="number" id="customTopupAmount" placeholder="Своя сумма (10–500)" min="10" max="500" step="1">
                </div>
                <div id="topupFeeInfo" class="topup-fee">
                    <div class="fee-row">💳 Введите сумму для расчёта</div>
                </div>
                <div class="topup-limit-info">⚠️ Максимум 500 ⭐ за 12 часов. Комиссия 5%.</div>
                <button id="confirmTopupBtnNew" class="topup-confirm-btn" disabled>Пополнить</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('topupModalNew');
    let selectedAmount = null;
    const feeInfo = document.getElementById('topupFeeInfo');
    const confirmBtn = document.getElementById('confirmTopupBtnNew');
    const customInput = document.getElementById('customTopupAmount');
    
    // Функция обновления информации о комиссии
    function updateFee(amount) {
        if (!amount || amount < 10 || amount > 500) {
            feeInfo.innerHTML = `
                <div class="fee-row">💳 Введите сумму от 10 до 500 ⭐</div>
            `;
            confirmBtn.disabled = true;
            return;
        }
        const fee = Math.floor(amount * 0.05);
        const receive = amount - fee;
        feeInfo.innerHTML = `
            <div class="fee-row">💰 Сумма пополнения: <strong>${amount} ⭐</strong></div>
            <div class="fee-row">📉 Комиссия (5%): <strong>${fee} ⭐</strong></div>
            <div class="fee-row highlight">✅ Вы получите: <strong>${receive} ⭐</strong></div>
        `;
        confirmBtn.disabled = false;
    }
    
    // Обработчики кнопок выбора суммы
    document.querySelectorAll('.amount-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.amount-preset').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAmount = parseInt(btn.dataset.amount);
            if (customInput) customInput.value = selectedAmount;
            updateFee(selectedAmount);
        });
    });
    
    // Обработчик ввода своей суммы
    if (customInput) {
        customInput.addEventListener('input', () => {
            // Снимаем выделение с кнопок
            document.querySelectorAll('.amount-preset').forEach(b => b.classList.remove('selected'));
            let val = parseInt(customInput.value);
            if (!isNaN(val) && val >= 10 && val <= 500) {
                selectedAmount = val;
                updateFee(selectedAmount);
            } else {
                selectedAmount = null;
                feeInfo.innerHTML = `
                    <div class="fee-row">💳 Введите сумму от 10 до 500 ⭐</div>
                `;
                confirmBtn.disabled = true;
            }
        });
    }
    
    // Закрытие модалки
    const closeModal = () => modal.remove();
    document.getElementById('closeTopupModalNew').onclick = closeModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    
    // Кнопка подтверждения
    document.getElementById('confirmTopupBtnNew').onclick = async () => {
        if (!selectedAmount || selectedAmount < 10 || selectedAmount > 500) {
            window.showCustomModal('Ошибка', 'Введите сумму от 10 до 500 ⭐');
            return;
        }
        closeModal();
        try {
            const res = await window.createInvoice(selectedAmount);
            if (res.ok && res.invoice_link) {
                window.tg.openInvoice(res.invoice_link, (status) => {
                    if (status === 'paid') {
                        window.showCustomModal('Успех', 'Баланс пополнен!');
                        if (typeof onSuccess === 'function') onSuccess();
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

function initTopupModal() {
    // Новая модалка вызывается через window.showTopupModal
}
