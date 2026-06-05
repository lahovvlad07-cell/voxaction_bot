// settings.js
window.renderSettings = async () => {
    const hide = window.currentUser.hide_rating || false;
    const color = localStorage.getItem('custom_color') || '#2b6e9e';
    const html = `<div class="card"><h2>⚙️ Настройки</h2><label><input type="checkbox" id="hideRating" ${hide?'checked':''}> Скрыть из рейтинга</label><br><br><div><strong>Уведомления от бота:</strong></div><label><input type="checkbox" id="notifyTrades" ${window.currentUser.notify_trades!==false?'checked':''}> О сделках</label><br><label><input type="checkbox" id="notifyTopup" ${window.currentUser.notify_topup!==false?'checked':''}> О пополнении</label><br><label><input type="checkbox" id="notifyReferral" ${window.currentUser.notify_referral!==false?'checked':''}> О рефералах</label><br><br><div><strong>Цвет акцента:</strong></div><input type="color" id="colorPicker" value="${color}" style="width:60px;padding:0"><button id="saveSettings">Сохранить</button></div>`;
    document.getElementById('app').innerHTML = html;
    document.getElementById('saveSettings').onclick = async () => {
        const newHide = document.getElementById('hideRating').checked;
        const newColor = document.getElementById('colorPicker').value;
        localStorage.setItem('custom_color', newColor);
        document.documentElement.style.setProperty('--accent', newColor);
        await window.supabase.from('users').update({
            hide_rating: newHide,
            notify_trades: document.getElementById('notifyTrades').checked,
            notify_topup: document.getElementById('notifyTopup').checked,
            notify_referral: document.getElementById('notifyReferral').checked
        }).eq('id', window.userId);
        window.currentUser.hide_rating = newHide;
        window.showModal('Успех', 'Настройки сохранены');
    };
};
