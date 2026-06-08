// games.js – упрощённая версия для проверки открытия вкладки
window.renderGamesTab = async function() {
    const html = `
        <div class="card">
            <h2 style="text-align:center;">🎮 Мини-игры</h2>
            <p style="text-align:center; font-size:13px;">Честные игры против бота. Комиссия 10%.</p>
            <div class="games-menu">
                <div class="game-card">
                    <div class="game-icon">✂️</div>
                    <div class="game-name">Камень, ножницы, бумага</div>
                    <div class="game-desc">Серия до 3 побед. Адаптивный ИИ.</div>
                    <button class="game-play-btn" data-game="rps">Играть</button>
                </div>
                <div class="game-card">
                    <div class="game-icon">🔢</div>
                    <div class="game-name">Угадай число</div>
                    <div class="game-desc">Угадай число от 1 до 100. 7 попыток.</div>
                    <button class="game-play-btn" data-game="guess">Играть</button>
                </div>
                <div class="game-card">
                    <div class="game-icon">❌⭕</div>
                    <div class="game-name">Крестики-нолики 4x4</div>
                    <div class="game-desc">Стратегия, адаптивная сложность.</div>
                    <button class="game-play-btn" data-game="ttt">Играть</button>
                </div>
            </div>
            <div class="games-info">
                <p>💰 Ваш баланс: <strong>${window.fromCents(window.currentUser?.stars_balance || 0)}</strong> ⭐</p>
                <p class="small-text">Максимальная ставка ограничена 5% бюджета бота.</p>
            </div>
            <div id="gameResult" style="margin-top:20px;"></div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    // Обработчики кнопок (пока только вывод сообщения)
    document.querySelectorAll('.game-play-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            window.showCustomModal('В разработке', 'Игровая логика будет добавлена позже. Сейчас можно только посмотреть интерфейс.');
        });
    });
};
