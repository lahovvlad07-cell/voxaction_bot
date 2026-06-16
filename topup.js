// topup.js – полностью переработанная модалка с уникальными id

window.showTopupModal = function(onSuccess) {
    // Удаляем все старые модалки пополнения
    document.querySelectorAll('#topupModal, #topupModalNew, #confirmModal').forEach(el => el.remove());

    // Создаём модалку с уникальными id
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
                    <input type="text" id="topupAmountInput" inputmode="numeric" placeholder="Своя сумма (10–500)" value="">
                </div>
                <div id="topupFeeDisplay" class="topup-fee">
                    <div class="fee-row" style="color:#9ca3af;">Введите сумму от 10 до 500 ⭐</div>
                </div>
                <div class="topup-limit-info">⚠️ Максимум 500 ⭐ за 12 часов. Комиссия 5%.</div>
                <button id="topupConfirmAction" class="topup-confirm-btn" disabled>Пополнить</button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('topupModalNew');
    const input = document.getElementById('topupAmountInput');
    const feeDisplay = document.getElementById('topupFeeDisplay');
    const confirmBtn = document.getElementById('topupConfirmAction');

    // === Очистка от нецифровых символов ===
    function sanitize(value) {
        return value.replace(/\D/g, '');
    }

    // === Обновление интерфейса ===
    function updateUI(rawValue) {
        const digits = sanitize(rawValue);
        if (!digits || digits === '0') {
            feeDisplay.innerHTML = `<div class="fee-row" style="color:#9ca3af;">Введите сумму от 10 до 500 ⭐</div>`;
            confirmBtn.disabled = true;
            return;
        }

        const amount = parseInt(digits, 10);
        if (amount < 10 || amount > 500) {
            feeDisplay.innerHTML = `<div class="fee-row" style="color:#f87171;">Сумма должна быть от 10 до 500 ⭐</div>`;
            confirmBtn.disabled = true;
            return;
        }

        const fee = Math.floor(amount * 0.05);
        const receive = amount - fee;
        feeDisplay.innerHTML = `
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

    // === Событие ввода ===
    input.addEventListener('input', function() {
        const cleaned = sanitize(this.value);
        if (this.value !== cleaned) this.value = cleaned;
        // Снимаем выделение с пресетов
        document.querySelectorAll('.amount-preset').forEach(b => b.classList.remove('selected'));
        updateUI(cleaned);
    });

    // === Клик по пресетам ===
    document.querySelectorAll('.amount-preset').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('.amount-preset').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            const amount = this.dataset.amount;
            input.value = amount;
            updateUI(amount);
        });
    });

    // === Закрытие модалки ===
    const closeModal = () => modal.remove();
    document.getElementById('closeTopupModalNew').onclick = closeModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // === Кнопка "Пополнить" → подтверждение ===
    confirmBtn.addEventListener('click', function() {
        const digits = sanitize(input.value);
        if (!digits) return;
        const amount = parseInt(digits, 10);
        if (amount < 10 || amount > 500) {
            window.showCustomModal('Ошибка', 'Сумма должна быть от 10 до 500 ⭐');
            return;
        }

        const fee = Math.floor(amount * 0.05);
        const receive = amount - fee;

        // Окно подтверждения
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

// Заглушка для совместимости с index.html
function initTopupModal() {}
