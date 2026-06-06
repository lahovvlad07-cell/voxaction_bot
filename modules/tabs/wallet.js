// modules/tabs/wallet.js

import { currentUser } from '../user.js';
import { fromCents } from '../utils.js';
import { tg } from '../config.js';

export async function renderWalletTab() {
    const html = `
        <div class="card">
            <h2>💳 Кошелёк</h2>
            <p>⭐ Баланс: <strong>${fromCents(currentUser.stars_balance)}</strong></p>
            <p>📊 Акций: <strong>${fromCents(currentUser.shares)}</strong></p>
            <hr>
            <button id="topupBtn">💸 Пополнить Stars</button>
            <button id="withdrawGiftsBtn" style="margin-top:12px;">🎁 Вывести через подарки</button>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    document.getElementById('topupBtn')?.addEventListener('click', () => {
        document.getElementById('topupModal').style.display = 'flex';
    });

    document.getElementById('withdrawGiftsBtn')?.addEventListener('click', () => {
        tg.openTelegramLink('https://t.me/VoxAction_Bot?start=withdraw_gifts');
    });
}