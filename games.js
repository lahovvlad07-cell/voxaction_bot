// games.js – улучшенная вкладка (стиль как у других)
window.renderGamesTab = async function() {
    const currentUser = window.currentUser;
    let botBudget = 100000;
    try {
        const { data } = await window.supabase.from('bot_budget').select('balance_cents').eq('id', 1).single();
        if (data) botBudget = data.balance_cents;
    } catch(e) {}
    
    const html = `
        <div class="card">
            <h2 style="text-align:center;">🎮 Мини-игры</h2>
            <p style="text-align:center; font-size:13px; color:#9ca3af;">Играйте против бота. Комиссия платформы 10%.</p>
            <div style="display: flex; flex-direction: column; gap: 12px; margin: 20px 0;">
                <button id="gameRpsBtn" style="background: linear-gradient(135deg,#2b6e9e,#1a4c6e);">✂️ Камень, ножницы, бумага</button>
                <button id="gameGuessBtn" style="background: linear-gradient(135deg,#2b6e9e,#1a4c6e);">🔢 Угадай число</button>
                <button id="gameTttBtn" style="background: linear-gradient(135deg,#2b6e9e,#1a4c6e);">❌⭕ Крестики-нолики 4x4</button>
            </div>
            <div style="background: rgba(0,0,0,0.2); border-radius: 20px; padding: 12px; margin-top: 16px;">
                <div style="display: flex; justify-content: space-between;">
                    <span>💰 Ваш баланс:</span>
                    <span><strong>${window.fromCents(currentUser.stars_balance)} ⭐</strong></span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 8px;">
                    <span>🎰 Банк игр бота:</span>
                    <span><strong>${window.fromCents(botBudget)} ⭐</strong></span>
                </div>
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    
    // Обработчики (заглушки – можно будет потом добавить полную логику)
    document.getElementById('gameRpsBtn').onclick = () => {
        window.showCustomModal('Камень, ножницы, бумага', 'Игра в разработке. Скоро появится!');
    };
    document.getElementById('gameGuessBtn').onclick = () => {
        window.showCustomModal('Угадай число', 'Игра в разработке. Скоро появится!');
    };
    document.getElementById('gameTttBtn').onclick = () => {
        window.showCustomModal('Крестики-нолики', 'Игра в разработке. Скоро появится!');
    };
};
