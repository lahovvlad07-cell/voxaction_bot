// analytics.js – финальная версия (график объёмов + история сделок)
window.renderAnalyticsTab = async function() {
    // 1. Получаем данные объёмов за 30 дней (RPC)
    let volumeData = [];
    try {
        const { data, error } = await window.supabase.rpc('get_volume_history', { days_limit: 30 });
        if (error) throw error;
        volumeData = data || [];
    } catch(e) {
        console.warn('RPC get_volume_history не найден или ошибка', e);
        volumeData = [];
    }

    // 2. Получаем последние 50 сделок пользователя
    const { data: trades, error: tradesError } = await window.supabase
        .from('trades')
        .select('*')
        .or(`seller_id.eq.${window.userId},buyer_id.eq.${window.userId}`)
        .order('created_at', { ascending: false })
        .limit(50);

    if (tradesError) console.warn('Ошибка загрузки сделок', tradesError);

    // 3. Общая статистика
    let totalVolumeStars = 0;
    let tradesCount = trades?.length || 0;
    if (trades) {
        totalVolumeStars = trades.reduce((sum, t) => sum + (t.total_stars / 100), 0);
    }

    // 4. HTML
    const html = `
        <div class="analytics-container">
            <!-- Статистика -->
            <div class="analytics-stats">
                <div class="stat-card">
                    <div class="stat-icon">📊</div>
                    <div class="stat-value">${tradesCount}</div>
                    <div class="stat-label">Всего сделок</div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon">⭐</div>
                    <div class="stat-value">${totalVolumeStars.toFixed(2)}</div>
                    <div class="stat-label">Общий объём</div>
                </div>
            </div>

            <!-- График объёмов -->
            <div class="chart-card">
                <h3>📈 Объёмы торгов за 30 дней</h3>
                <div class="chart-wrapper">
                    <canvas id="volumeChartCanvas" width="600" height="200" style="width:100%; height:200px;"></canvas>
                </div>
                <div class="chart-note">Объём в ⭐ за день</div>
            </div>

            <!-- История сделок -->
            <div class="history-card">
                <h3>📜 История сделок</h3>
                <div class="history-list" id="historyList">
                    ${trades && trades.length ? trades.map(t => `
                        <div class="history-item">
                            <div class="history-type ${t.buyer_id === window.userId ? 'buy' : 'sell'}">
                                ${t.buyer_id === window.userId ? '🟢 Покупка' : '🔴 Продажа'}
                            </div>
                            <div class="history-details">
                                <span>${window.fromCents(t.amount)} шт.</span>
                                <span>по ${window.fromCents(t.price_per_share)} ⭐</span>
                            </div>
                            <div class="history-date">${new Date(t.created_at).toLocaleString()}</div>
                        </div>
                    `).join('') : '<div class="empty-history">Нет сделок</div>'}
                </div>
            </div>
        </div>
    `;

    document.getElementById('app').innerHTML = html;

    // 5. Отрисовка графика (столбцы)
    const canvas = document.getElementById('volumeChartCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const w = canvas.clientWidth;
    const h = 200;
    canvas.width = w;
    canvas.height = h;

    if (!volumeData || volumeData.length === 0) {
        ctx.fillStyle = '#0f1320';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px sans-serif';
        ctx.fillText('Нет данных для графика', w/2 - 60, h/2);
        return;
    }

    // Преобразуем total_amount из центов в звёзды
    const volumes = volumeData.map(v => v.total_amount / 100);
    const maxVolume = Math.max(...volumes, 1);
    const barWidth = (w - 60) / volumeData.length - 2;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#2b6e9e';

    volumeData.forEach((v, i) => {
        const barHeight = (volumes[i] / maxVolume) * (h - 40);
        const x = 30 + i * (barWidth + 2);
        const y = h - 20 - barHeight;
        ctx.fillRect(x, y, barWidth, barHeight);
    });

    // Оси и подписи
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.fillText('0', 10, h - 15);
    ctx.fillText(maxVolume.toFixed(0), 10, 25);
    ctx.fillText('дни', w - 30, h - 5);
};
