// topup.js – модалка пополнения (гарантированно рабочий)
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
                    <button class="amount-preset" data-amount="300">300 ⭐</button>
                    <button class="amount-preset" data-amount="500">500 ⭐</button>
                </div>
                <div class="custom-amount">
                    <input type="number" id="customTopupAmount" placeholder="Своя сумма (10–500)" min="10" max="500" step="1">
                </div>
                <div id="topupFeeInfo" class="topup-fee"></div>
                <div class="topup-limit-info">⚠️ Максимум 500 ⭐ за 12 часов. Комиссия 5%.</div>
                <button id="confirmTopupBtnNew" class="topup-confirm-btn" disabled>Пополнить</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('topupModalNew');
    const customInput = document.getElementById('customTopupAmount');
    const feeInfo = document.getElementById('topupFeeInfo');
    const confirmBtn = document.getElementById('confirmTopupBtnNew');

    // === ФУНКЦИЯ ОБНОВЛЕНИЯ ===
    function updateFeeAndButton(amount) {
        if (!amount || amount < 10 || amount > 500) {
            feeInfo.innerHTML = `<div class="fee-row" style="color:#9ca3af;">Введите сумму от 10 до 500 ⭐</div>`;
            confirmBtn.disabled = true;
            return;
        }
        const fee = Math.floor(amount * 0.05);
        const receive = amount - fee;
        feeInfo.innerHTML = `
            <div class="fee-row">
                <span>💰 <strong>${amount} ⭐</strong></span>
                <span style="margin-left:16px;">📉 <strong>${fee} ⭐</strong></span>
                <span style="margin-left:16px;">✅ <strong style="color:#4ade80;">${receive} ⭐</strong></span>
            </div>
            <div class="fee-row" style="font-size:11px; color:#6b7280; margin-top:2px;">
                комиссия 5%
            </div>
        `;
        confirmBtn.disabled = false;
    }

    // === ОБРАБОТЧИК ПОЛЯ ===
    customInput.addEventListener('input', function(e) {
        const val = parseInt(this.value);
        if (!isNaN(val) && val >= 10 && val <= 500) {
            updateFeeAndButton(val);
        } else {
            feeInfo.innerHTML = `<div class="fee-row" style="color:#9ca3af;">Введите сумму от 10 до 500 ⭐</div>`;
            confirmBtn.disabled = true;
        }
    });

    // === ОБРАБОТЧИКИ ШАБЛОНОВ ===
    document.querySelectorAll('.amount-preset').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            // Снимаем выделение со всех
            document.querySelectorAll('.amount-preset').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            const amount = parseInt(this.dataset.amount);
            // Заполняем поле
            customInput.value = amount;
            // ВРУЧНУЮ ЗАПУСКАЕМ СОБЫТИЕ input, чтобы активировать кнопку и комиссию
            customInput.dispatchEvent(new Event('input'));
        });
    });

    // === ЗАКРЫТИЕ МОДАЛКИ ===
    const closeModal = () => modal.remove();
    document.getElementById('closeTopupModalNew').onclick = closeModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // === КНОПКА ПОПОЛНИТЬ ===
    confirmBtn.addEventListener('click', function() {
        const amount = parseInt(customInput.value);
        if (!amount || amount < 10 || amount > 500) {
            window.showCustomModal('Ошибка', 'Введите сумму от 10 до 500 ⭐');
            return;
        }
        const fee = Math.floor(amount * 0.05);
        const receive = amount - fee;

        const confirmHtml = `
            <div class="modal" id="confirmModal" style="display:flex;">
                <div class="modal-content confirm-modal">
                    <span class="close-modal" id="closeConfirmModal">&times;</span>
                    <h3>✅ Подтверждение пополнения</h3>
                    <div class="confirm-body">
                        <div class="confirm-row">
                            <span>💰 Сумма пополнения</span>
                            <strong>${amount} ⭐</strong>
                        </div>
                        <div class="confirm-row">
                            <span>📉 Комиссия (5%)</span>
                            <strong>${fee} ⭐</strong>
                        </div>
                        <div class="confirm-row highlight">
                            <span>✅ Вы получите</span>
                            <strong>${receive} ⭐</strong>
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button id="confirmCancelBtn" class="secondary">Отмена</button>
                        <button id="confirmOkBtn">Подтвердить</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', confirmHtml);

        const confirmModal = document.getElementById('confirmModal');
        const closeConfirm = () => confirmModal.remove();
        document.getElementById('closeConfirmModal').onclick = closeConfirm;
        confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) closeConfirm(); });
        document.getElementById('confirmCancelBtn').onclick = closeConfirm;

        document.getElementById('confirmOkBtn').onclick = async () => {
            closeConfirm();
            closeModal();
            try {
                const res = await window.createInvoice(amount);
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
    });
};

function initTopupModal() {
    // Новая модалка вызывается через window.showTopupModal
}
