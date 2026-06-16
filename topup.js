// topup.js – модалка пополнения с рабочими кнопками и отображением комиссии
window.showTopupModal = function(onSuccess) {
    const modalHtml = `
        <div class="modal" id="topupModalNew" style="display:flex;">
            <div class="modal-content topup-modal">
                <span class="close-modal" id="closeTopupModalNew">&times;</span>
                <h3>💸 Пополнение Stars</h3>
                
                <!-- Кнопки быстрого выбора -->
                <div class="topup-amount-buttons">
                    <button class="amount-preset" data-amount="10">10 ⭐</button>
                    <button class="amount-preset" data-amount="50">50 ⭐</button>
                    <button class="amount-preset" data-amount="100">100 ⭐</button>
                    <button class="amount-preset" data-amount="200">200 ⭐</button>
                    <button class="amount-preset" data-amount="500">500 ⭐</button>
                </div>
                
                <!-- Своя сумма -->
                <div class="custom-amount">
                    <input type="number" id="customTopupAmount" placeholder="Своя сумма (10–500)" min="10" max="500" step="1">
                </div>
                
                <!-- Блок с итогом (комиссия + получение) -->
                <div id="topupResult" class="topup-result" style="display:none;">
                    <div class="topup-result-row">
                        <span>💰 Сумма</span>
                        <span id="resultAmount">0 ⭐</span>
                    </div>
                    <div class="topup-result-row">
                        <span>📉 Комиссия (5%)</span>
                        <span id="resultFee">0 ⭐</span>
                    </div>
                    <div class="topup-result-row highlight">
                        <span>✅ Вы получите</span>
                        <span id="resultReceive">0 ⭐</span>
                    </div>
                </div>
                
                <div class="topup-limit-info">⚠️ Максимум 500 ⭐ за 12 часов. Комиссия 5%.</div>
                <button id="confirmTopupBtnNew" class="topup-confirm-btn">Пополнить</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    
    const modal = document.getElementById('topupModalNew');
    let selectedAmount = null;
    
    // Функция обновления итога
    function updateResult(amount) {
        const resultBlock = document.getElementById('topupResult');
        if (!amount || amount < 10) {
            resultBlock.style.display = 'none';
            return;
        }
        const fee = Math.floor(amount * 0.05);
        const receive = amount - fee;
        document.getElementById('resultAmount').textContent = amount + ' ⭐';
        document.getElementById('resultFee').textContent = fee + ' ⭐';
        document.getElementById('resultReceive').textContent = receive + ' ⭐';
        resultBlock.style.display = 'block';
    }
    
    // Обработчики для кнопок
    document.querySelectorAll('.amount-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.amount-preset').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            const amount = parseInt(btn.dataset.amount);
            selectedAmount = amount;
            const customInput = document.getElementById('customTopupAmount');
            if (customInput) customInput.value = amount;
            updateResult(amount);
        });
    });
    
    // Обработчик для своего поля
    const customInput = document.getElementById('customTopupAmount');
    if (customInput) {
        customInput.addEventListener('input', () => {
            let val = parseInt(customInput.value);
            if (!isNaN(val) && val >= 10 && val <= 500) {
                selectedAmount = val;
                document.querySelectorAll('.amount-preset').forEach(b => b.classList.remove('selected'));
                updateResult(val);
            } else {
                document.getElementById('topupResult').style.display = 'none';
                selectedAmount = null;
            }
        });
    }
    
    // Закрытие
    const closeModal = () => modal.remove();
    document.getElementById('closeTopupModalNew').onclick = closeModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    
    // Подтверждение
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
