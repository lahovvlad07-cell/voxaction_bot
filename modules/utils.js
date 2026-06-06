// modules/utils.js

// Конвертация в центы (умножение на 100 и округление)
export function toCents(v) {
    return Math.round(parseFloat(v) * 100);
}

// Конвертация из центов в обычное число с двумя знаками
export function fromCents(c) {
    return (c / 100).toFixed(2);
}

// Показ кастомного модального окна (alert-подобное)
export function showCustomModal(title, message) {
    const modalHtml = `
        <div class="modal" id="customMessageModal" style="display:flex;">
            <div class="modal-content">
                <span class="close-modal" id="closeCustomModal">&times;</span>
                <h3>${title}</h3>
                <p style="margin: 20px 0; text-align: center;">${message}</p>
                <button id="customModalOkBtn">OK</button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('customMessageModal');
    document.getElementById('closeCustomModal').onclick = () => modal.remove();
    document.getElementById('customModalOkBtn').onclick = () => modal.remove();
}

// Всплывающее уведомление (toast)
export function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
}