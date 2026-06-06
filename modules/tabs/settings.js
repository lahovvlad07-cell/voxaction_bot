// modules/tabs/settings.js

import { currentUser, updateUser } from '../user.js';
import { showCustomModal } from '../utils.js';

export async function renderSettingsTab() {
    const hideRating = currentUser.hide_rating || false;
    const customColor = localStorage.getItem('custom_color') || '#2b6e9e';
    const notifyTrades = currentUser.notify_trades ?? true;
    const notifyTopup = currentUser.notify_topup ?? true;
    const notifyReferral = currentUser.notify_referral ?? true;

    const html = `
        <div class="card">
            <h2>⚙️ Настройки</h2>
            <label><input type="checkbox" id="hideRatingCheckbox" ${hideRating ? 'checked' : ''}> Скрыть из рейтинга</label><br><br>
            <div><strong>Уведомления от бота:</strong></div>
            <label><input type="checkbox" id="notifyTradesCheckbox" ${notifyTrades ? 'checked' : ''}> О сделках</label><br>
            <label><input type="checkbox" id="notifyTopupCheckbox" ${notifyTopup ? 'checked' : ''}> О пополнении</label><br>
            <label><input type="checkbox" id="notifyReferralCheckbox" ${notifyReferral ? 'checked' : ''}> О рефералах</label><br><br>
            <div><strong>Цвет акцента:</strong></div>
            <input type="color" id="colorPicker" value="${customColor}" style="width:60px; padding:0;">
            <button id="saveSettings">Сохранить</button>
        </div>
    `;

    document.getElementById('app').innerHTML = html;

    document.getElementById('colorPicker').addEventListener('input', (e) => {
        document.documentElement.style.setProperty('--accent', e.target.value);
    });

    document.getElementById('saveSettings').onclick = async () => {
        const newHide = document.getElementById('hideRatingCheckbox').checked;
        const newColor = document.getElementById('colorPicker').value;
        localStorage.setItem('custom_color', newColor);
        document.documentElement.style.setProperty('--accent', newColor);
        await updateUser({
            hide_rating: newHide,
            notify_trades: document.getElementById('notifyTradesCheckbox').checked,
            notify_topup: document.getElementById('notifyTopupCheckbox').checked,
            notify_referral: document.getElementById('notifyReferralCheckbox').checked
        });
        currentUser.hide_rating = newHide;
        showCustomModal('Успех', 'Настройки сохранены');
    };
}