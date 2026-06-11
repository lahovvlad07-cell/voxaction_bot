// games.js – только визуальная вкладка Игры (без геймплея)
window.renderGamesTab = async function() {
    const currentUser = window.currentUser;
    const balance = window.fromCents(currentUser.stars_balance);
    
    const games = [
        { id: 'reaction', name: 'Нажми быстрее', icon: '⚡', desc: 'Проверь свою реакцию', color: '#fbbf24' },
        { id: 'tower', name: 'Башня', icon: '🏗️', desc: 'Строй и забирай выигрыш', color: '#60a5fa' },
        { id: 'closest', name: 'Ближе к цели', icon: '🎯', desc: 'Угадай число', color: '#4ade80' },
        { id: 'typerace', name: 'Скоростной набор', icon: '⌨️', desc: 'Печатай быстрее бота', color: '#f472b6' },
        { id: 'maze', name: 'Лабиринт', icon: '🧩', desc: 'Найди выход', color: '#a78bfa' },
        { id: 'ttt', name: 'Крестики-нолики', icon: '❌', desc: 'Сразись с ботом', color: '#f97316' }
    ];
    
    const html = `
        <div class="games-container">
            <div class="games-header">
                <div class="games-balance">
                    <span class="games-balance-label">💰 Баланс</span>
                    <span class="games-balance-value">${balance} ⭐</span>
                </div>
                <div class="games-info">🎲 Честные игры против бота. Комиссия 10%. Мин. ставка 1 ⭐.</div>
            </div>
            <div class="games-grid">
                ${games.map(game => `
                    <div class="game-card" data-game="${game.id}">
                        <div class="game-card-icon" style="background: ${game.color}20; border-color: ${game.color};">${game.icon}</div>
                        <div class="game-card-title">${game.name}</div>
                        <div class="game-card-desc">${game.desc}</div>
                        <button class="game-card-btn">Играть →</button>
                    </div>
                `).join('')}
            </div>
            <div class="games-rules">
                <div class="rules-title">📜 Правила</div>
                <div class="rules-list">
                    <div>• Каждая игра имеет минимальную ставку <strong>1 ⭐</strong></div>
                    <div>• Комиссия платформы — <strong>10%</strong> от выигрыша</div>
                    <div>• Часовой лимит чистого выигрыша/проигрыша — настраивается в <strong>Настройках</strong></div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('app').innerHTML = html;
    
    // Все кнопки "Играть" показывают заглушку (игры будут добавлены позже)
    document.querySelectorAll('.game-card-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            window.showCustomModal('В разработке', 'Геймплей скоро будет добавлен!');
        });
    });
};
