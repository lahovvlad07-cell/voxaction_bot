// modules/ui.js

import { tg, userId, BACKEND_URL } from './config.js';
import { showCustomModal } from './utils.js';
import { createInvoice } from './api.js';
import { refreshAll } from './tabs/stocksTab.js'; // потребуется экспорт refreshAll из stocksTab

// Инициализация перетаскивания табов (drag-to-scroll)
export function initTabDrag() {
    const tabsWrapper = document.querySelector('.tabs-wrapper');
    if (!tabsWrapper) return;
    let isDown = false, startX, scrollLeft;
    tabsWrapper.addEventListener('mousedown', (e) => {
        isDown = true;
        startX = e.pageX - tabsWrapper.offsetLeft;
        scrollLeft = tabsWrapper.scrollLeft;
        tabsWrapper.style.cursor = 'grabbing';
    });
    window.addEventListener('mouseup', () => {
        isDown = false;
        tabsWrapper.style.cursor = 'grab';
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - tabsWrapper.offsetLeft;
        const walk = (x - startX) * 2;
        tabsWrapper.scrollLeft = scrollLeft - walk;
    });
}

// Инициализация модалки пополнения (обработчики кнопок)
export function initTopupModal() {
    let selectedAmount = null;
    const modal = document.getElementById('topupModal');
    if (!modal) return;

    const updateTopupFee = (amount) => {
        const fee = Math.floor(amount * 0.05);
        const receive = amount - fee;
        const feeInfo = document.getElementById('topupFeeInfo');
        if (feeInfo) {
            feeInfo.innerHTML = `💸 Вы платите: ${amount} ⭐<br>📉 Комиссия (5%): ${fee} ⭐<br>✅ Получите: ${receive} ⭐`;
        }
    };

    const amountBtns = document.querySelectorAll('#topupModal .amount-btn');
    amountBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            amountBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            selectedAmount = parseInt(btn.dataset.amount);
            const customInput = document.getElementById('customTopupAmount');
            if (customInput) customInput.value = selectedAmount;
            updateTopupFee(selectedAmount);
        });
    });

    const customInput = document.getElementById('customTopupAmount');
    if (customInput) {
        customInput.addEventListener('input', () => {
            let val = parseInt(customInput.value);
            if (!isNaN(val) && val >= 1) {
                selectedAmount = val;
                amountBtns.forEach(b => b.classList.remove('selected'));
                updateTopupFee(selectedAmount);
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
                showCustomModal('Ошибка', 'Выберите сумму');
                return;
            }
            modal.style.display = 'none';
            try {
                const data = await createInvoice(selectedAmount);
                if (data.ok && data.invoice_link) {
                    tg.openInvoice(data.invoice_link, (status) => {
                        if (status === 'paid') {
                            showCustomModal('Успех', 'Баланс пополнен');
                            if (typeof refreshAll === 'function') refreshAll();
                        }
                    });
                } else {
                    showCustomModal('Ошибка', data.error || 'Не удалось создать счёт');
                }
            } catch (e) {
                showCustomModal('Ошибка', 'Соединение');
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