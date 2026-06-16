// topup.js – надёжная модалка пополнения с ручным вводом и пресетами

window.showTopupModal = function(onSuccess) {
    // Удаляем старые модалки, если они есть
    document.querySelectorAll('#topupModalNew, #confirmModal').forEach(el => el.remove());

    // Создаём HTML модалки
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
                    <input type="text" id="customTopupAmount" inputmode="numeric" placeholder="Своя сумма (10–500)" value="">
                </div>
                <div id="topupFeeInfo" class="topup-fee">
                    <div class="fee-row" style="color:#9ca3af;">Введите сумму от 10 до 500 ⭐</div>
                </div>
                <div class="topup-limit-info">⚠️ Максимум 500 ⭐ за 12 часов. Комиссия 5%.</div>
                <button id="confirmTopupBtnNew" class="topup-confirm-btn" disabled>Пополнить</button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('topupModalNew');
    const input = document.getElementById('customTopupAmount');
    const feeInfo = document.getElementById('topupFeeInfo');
    const confirmBtn = document.getElementById('confirmTopupBtnNew');

    // === Вспомогательная функция для очистки ввода ===
    function sanitizeInput(value) {
        // Удаляем всё, кроме цифр
        return value.replace(/\D/g, '');
    }

    // === Функция обновления UI (вызывается при каждом изменении) ===
    function updateUI(rawValue) {
        // Очищаем от мусора
        const digits = sanitizeInput(rawValue);
        // Если пусто или 0 – показываем заглушку
        if (!digits || digits === '0') {
            feeInfo.innerHTML = `<div class="fee-row" style="color:#9ca3af;">Введите сумму от 10 до 500 ⭐</div>`;
            confirmBtn.disabled = true;
            return;
        }

        const amount = parseInt(digits, 10);
        // Проверяем диапазон
        if (amount < 10 || amount > 500) {
            feeInfo.innerHTML = `<div class="fee-row" style="color:#f87171;">Сумма должна быть от 10 до 500 ⭐</div>`;
            confirmBtn.disabled = true;
            return;
        }

        // Всё хорошо – считаем комиссию
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

    // === Обработчик ввода в поле ===
    input.addEventListener('input', function() {
        // Убираем всё, кроме цифр, и обновляем значение в поле
        const cleaned = sanitizeInput(this.value);
        if (this.value !== cleaned) {
            this.value = cleaned;
        }
        // Снимаем выделение с пресетов
        document.querySelectorAll('.amount-preset').forEach(b => b.classList.remove('selected'));
        // Обновляем интерфейс
        updateUI(cleaned);
    });

    // === Обработчики для пресетов ===
    document.querySelectorAll('.amount-preset').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            // Снимаем выделение со всех
            document.querySelectorAll('.amount-preset').forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            // Берём сумму из data-атрибута
            const amount = this.dataset.amount;
            // Заполняем поле (оно автоматически очистится от нецифровых)
            input.value = amount;
            // Принудительно вызываем обновление
            updateUI(amount);
        });
    });

    // === Закрытие модалки ===
    const closeModal = () => modal.remove();
    document.getElementById('closeTopupModalNew').onclick = closeModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    // === Кнопка "Пополнить" – открывает подтверждение ===
    confirmBtn.addEventListener('click', function() {
        const digits = sanitizeInput(input.value);
        if (!digits) return;
        const amount = parseInt(digits, 10);
        if (amount < 10 || amount > 500) {
            window.showCustomModal('Ошибка', 'Сумма должна быть от 10 до 500 ⭐');
            return;
        }

        const fee = Math.floor(amount * 0.05);
        const receive = amount - fee;

        // Показываем окно подтверждения
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
    // Функция-заглушка для совместимости (вызывается в index.html)
}
