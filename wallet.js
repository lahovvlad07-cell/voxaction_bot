// wallet.js
window.renderWalletTab = async function() {
    document.getElementById('app').innerHTML = `<div class="card"><h2>💳 Кошелёк</h2><p>⭐ Баланс: <strong>${window.fromCents(window.currentUser.stars_balance)}</strong></p><p>📊 Акций: <strong>${window.fromCents(window.currentUser.shares)}</strong></p><hr><button id="topupBtn">💸 Пополнить Stars</button><button id="withdrawGiftsBtn" style="margin-top:12px;">🎁 Вывести через подарки</button></div>`;
    document.getElementById('topupBtn')?.addEventListener('click', () => { document.getElementById('topupModal').style.display = 'flex'; if(window.updateTopupFee) window.updateTopupFee(0); });
    document.getElementById('withdrawGiftsBtn')?.addEventListener('click', () => { window.tg.openTelegramLink('https://t.me/VoxAction_Bot?start=withdraw_gifts'); });
};
