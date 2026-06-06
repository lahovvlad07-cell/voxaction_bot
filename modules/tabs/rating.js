// modules/tabs/rating.js

import { getLeaderboard } from '../api.js';
import { fromCents } from '../utils.js';

export async function renderRatingTab() {
    const leaders = await getLeaderboard();
    let html = `<div class="card"><h2>🏆 Рейтинг держателей акций</h2>`;
    if (!leaders.length) {
        html += '<p>Нет данных</p>';
    } else {
        leaders.forEach((u, i) => {
            html += `<div class="leaderboard-item">
                        <div class="rank">${i + 1}</div>
                        <div class="user-name">${u.username || 'Аноним'}</div>
                        <div class="user-shares">${fromCents(u.shares)} акций</div>
                    </div>`;
        });
    }
    html += `</div>`;
    document.getElementById('app').innerHTML = html;
}