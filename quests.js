// quests.js – модуль квестов

window.renderQuestsTab = async function() {
    const quests = await window.getQuests();
    const user = window.currentUser;

    const html = `
        <div class="card">
            <h2 style="text-align:center;">📋 Квесты</h2>
            <p style="text-align:center; color:#9ca3af;">Выполняйте задания и получайте награды!</p>
            <div id="questsList">
                ${quests.map(async q => {
                    const progress = await window.getUserQuestProgress(q.id);
                    const current = progress ? progress.progress : 0;
                    const completed = progress ? progress.completed : false;
                    let conditionStr = '';
                    switch (q.condition_type) {
                        case 'trades_count': conditionStr = `Сделайте ${q.condition_value} сделок`; break;
                        case 'shares_held': conditionStr = `Владейте ${q.condition_value/100} акций`; break;
                        case 'referrals_count': conditionStr = `Пригласите ${q.condition_value} друзей`; break;
                        case 'total_topup': conditionStr = `Пополните на ${q.condition_value/100} ⭐`; break;
                        default: conditionStr = `${q.condition_type}: ${q.condition_value}`;
                    }
                    const progressPercent = Math.min(100, (current / q.condition_value) * 100);
                    return `
                        <div style="background:rgba(0,0,0,0.3); border-radius:16px; padding:16px; margin-bottom:12px; ${completed ? 'border:1px solid #4ade80;' : ''}">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <div style="font-weight:700; font-size:16px;">${q.name}</div>
                                <div style="font-size:12px; color:${completed ? '#4ade80' : '#fbbf24'};">
                                    ${completed ? '✅ Выполнен' : `${Math.round(progressPercent)}%`}
                                </div>
                            </div>
                            <div style="font-size:13px; color:#cbd5e1; margin:4px 0;">${q.description || conditionStr}</div>
                            ${!completed ? `
                                <div style="background:rgba(255,255,255,0.1); border-radius:10px; height:6px; margin:8px 0; overflow:hidden;">
                                    <div style="background:linear-gradient(90deg,#2b6e9e,#60a5fa); height:100%; width:${progressPercent}%; border-radius:10px;"></div>
                                </div>
                                <div style="font-size:11px; color:#9ca3af;">Прогресс: ${current} / ${q.condition_value}</div>
                            ` : ''}
                            <div style="font-size:12px; color:#9ca3af; margin-top:4px;">
                                🎁 Награда: ${q.reward_shares ? `${window.fromCents(q.reward_shares)} акций` : ''} ${q.reward_stars ? `${window.fromCents(q.reward_stars)} ⭐` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
                ${!quests.length ? '<p style="color:#9ca3af; text-align:center;">Нет активных квестов</p>' : ''}
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
};
