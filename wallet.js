// wallet.js – улучшенный кошелёк
window.renderWalletTab = async function() {
    const currentUser = window.currentUser;
    const starsBalance = window.fromCents(currentUser.stars_balance);
    const sharesBalance = window.fromCents(currentUser.shares);
    
    const html = `
        <div class="card">
            <h2>💳 Кошелёк</h2>
            <div style="background: rgba(0,0,0,0.2); border-radius: 28px; padding: 20px; margin: 16px 0; text-align: center;">
                <div style="font-size: 48px; font-weight: 800; background: linear-gradient(135deg, #fbbf24, #f59e0b); background-clip: text; -webkit-background-clip: text; color: transparent;">${starsBalance}</div>
                <div class="small-text">Stars (⭐)</div>
            </div>
            <div style="background: rgba(0,0,0,0.2); border-radius: 28px; padding: 20px; margin: 16px 0; text-align: center;">
                <div style="font-size: 32px; font-weight: 800;">${sharesBalance}</div>
                <div class="small-text">Акций</div>
            </div>
            <button id="topupBtn" style="background: linear-gradient(135deg, #2b6e9e, #1a4c6e);">💸 Пополнить Stars</button>
            <button id="withdrawGiftsBtn" style="margin-top: 12px; background: rgba(255,255,255,0.1);">🎁 Вывести через подарки</button>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    
    document.getElementById('topupBtn')?.addEventListener('click', () => {
        document.getElementById('topupModal').style.display = 'flex';
        if (window.updateTopupFee) window.updateTopupFee(0);
    });
    document.getElementById('withdrawGiftsBtn')?.addEventListener('click', () => {
        window.tg.openTelegramLink('https://t.me/VoxAction_Bot?start=withdraw_gifts');
    });
};
