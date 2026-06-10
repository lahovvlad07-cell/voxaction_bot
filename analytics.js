// analytics.js – расширенная аналитика (график цены, объёмы, топ сделок, дни недели)
window.renderAnalyticsTab = async function() {
    // ---- Загрузка данных ----
    // 1. Объёмы за 30 дней
    let volumeData = [];
    try {
        const { data } = await window.supabase.rpc('get_volume_history', { days_limit: 30 });
        volumeData = data || [];
    } catch(e) { console.warn('RPC get_volume_history не найден', e); }

    // 2. Сделки пользователя (для истории и статистики)
    const { data: trades, error } = await window.supabase
        .from('trades')
        .select('*')
        .or(`seller_id.eq.${window.userId},buyer_id.eq.${window.userId}`)
        .order('created_at', { ascending: false })
        .limit(100);
    
    if (error) console.warn('Ошибка загрузки сделок', error);

    // 3. Дополнительные агрегации (если сделок нет – показываем заглушки)
    const hasTrades = trades && trades.length > 0;
    
    // ---- Общая статистика ----
    let totalVolumeStars = 0;
    let totalSpentStars = 0;      // сколько звёзд потрачено на покупки
    let totalEarnedStars = 0;     // сколько звёзд получено от продаж
    let avgPricePerShare = 0;     // средняя цена за 1 акцию по всем сделкам пользователя
    let totalSharesCount = 0;     // общее количество купленных+проданных акций (в штуках)
    
    if (hasTrades) {
        totalVolumeStars = trades.reduce((sum, t) => sum + (t.total_stars / 100), 0);
        totalSpentStars = trades.filter(t => t.buyer_id === window.userId).reduce((sum, t) => sum + (t.total_stars / 100), 0);
        totalEarnedStars = trades.filter(t => t.seller_id === window.userId).reduce((sum, t) => sum + (t.total_stars / 100), 0);
        totalSharesCount = trades.reduce((sum, t) => sum + (t.amount / 100), 0);
        if (totalSharesCount > 0) avgPricePerShare = totalVolumeStars / totalSharesCount;
    }

    // ---- Топ-3 крупнейших сделок (по total_stars) ----
    const topTrades = hasTrades ? [...trades].sort((a,b) => b.total_stars - a.total_stars).slice(0,3) : [];

    // ---- Статистика по дням недели ----
    const weekdays = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const weekdayCount = [0,0,0,0,0,0,0];
    if (hasTrades) {
        trades.forEach(t => {
            const wd = new Date(t.created_at).getDay();
            weekdayCount[wd]++;
        });
    }
    const maxWeekdayIndex = weekdayCount.indexOf(Math.max(...weekdayCount));
    const bestWeekday = maxWeekdayIndex !== -1 ? weekdays[maxWeekdayIndex] : '—';
    const bestWeekdayCount = weekdayCount[maxWeekdayIndex] || 0;

    // ---- График цены акции за 30 дней (средняя цена за день из trades) ----
    let priceHistory = [];
    if (hasTrades) {
        const { data: allTrades } = await window.supabase
            .from('trades')
            .select('price_per_share, created_at')
            .order('created_at', { ascending: true })
            .limit(1000);
        if (allTrades && allTrades.length) {
            const days = {};
            allTrades.forEach(t => {
                const day = t.created_at.slice(0,10);
                if (!days[day]) days[day] = { sum: 0, count: 0 };
                days[day].sum += t.price_per_share;
                days[day].count++;
            });
            const last30 = Object.entries(days).slice(-30);
            priceHistory = last30.map(([date, { sum, count }]) => ({
                date,
                price: sum / count / 100
            }));
        }
    }

    // ---- HTML ----
    const html = `
        <div class="analytics-container">
            <!-- Верхняя статистика -->
            <div class="analytics-stats">
                <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-value">${trades?.length || 0}</div><div class="stat-label">Сделок</div></div>
                <div class="stat-card"><div class="stat-icon">⭐</div><div class="stat-value">${totalVolumeStars.toFixed(2)}</div><div class="stat-label">Объём</div></div>
                <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-value">${avgPricePerShare.toFixed(2)}</div><div class="stat-label">Ср. цена</div></div>
            </div>

            <!-- Блок доходов/расходов (если есть сделки) -->
            ${hasTrades ? `
            <div class="analytics-stats">
                <div class="stat-card"><div class="stat-icon">💸</div><div class="stat-value">${totalSpentStars.toFixed(2)}</div><div class="stat-label">Потрачено</div></div>
                <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">${totalEarnedStars.toFixed(2)}</div><div class="stat-label">Заработано</div></div>
                <div class="stat-card"><div class="stat-icon">⚖️</div><div class="stat-value">${(totalEarnedStars - totalSpentStars).toFixed(2)}</div><div class="stat-label">Профит</div></div>
            </div>
            ` : ''}

            <!-- График объёмов за 30 дней -->
            <div class="chart-card">
                <h3>📊 Объёмы торгов за 30 дней</h3>
                <div class="chart-wrapper"><canvas id="volumeChartCanvas" width="600" height="180" style="width:100%; height:180px;"></canvas></div>
                <div class="chart-note">Объём в ⭐ за день</div>
            </div>

            <!-- График цены акции за 30 дней (если есть данные) -->
            ${priceHistory.length ? `
            <div class="chart-card">
                <h3>📈 Динамика цены акции (30 дней)</h3>
                <div class="chart-wrapper"><canvas id="priceChartCanvas" width="600" height="180" style="width:100%; height:180px;"></canvas></div>
                <div class="chart-note">Средняя цена за день, ⭐</div>
            </div>
            ` : ''}

            <!-- Статистика по дням недели -->
            <div class="info-card">
                <h3>📅 Активность по дням</h3>
                <div class="weekday-stats">
                    ${weekdays.map((day, i) => `
                        <div class="weekday-item">
                            <span>${day}</span>
                            <div class="weekday-bar"><div class="weekday-fill" style="width: ${hasTrades ? (weekdayCount[i] / Math.max(...weekdayCount) * 100) : 0}%;"></div></div>
                            <span class="weekday-count">${weekdayCount[i]}</span>
                        </div>
                    `).join('')}
                </div>
                ${bestWeekdayCount > 0 ? `<div class="weekday-best">🏆 Больше всего сделок в <strong>${bestWeekday}</strong> (${bestWeekdayCount})</div>` : '<div class="weekday-best">Нет данных</div>'}
            </div>

            <!-- Топ-3 крупнейших сделок -->
            ${topTrades.length ? `
            <div class="info-card">
                <h3>🏆 Топ-3 крупнейших сделок</h3>
                <div class="top-trades-list">
                    ${topTrades.map(t => {
                        const isBuy = t.buyer_id === window.userId;
                        const amountStars = window.fromCents(t.amount);
                        const priceStars = window.fromCents(t.price_per_share);
                        const totalStars = t.total_stars / 100;
                        return `
                            <div class="top-trade-item">
                                <div class="top-trade-type ${isBuy ? 'buy' : 'sell'}">${isBuy ? '🟢 Покупка' : '🔴 Продажа'}</div>
                                <div class="top-trade-details">${amountStars} шт. по ${priceStars} ⭐ → ${totalStars.toFixed(2)} ⭐</div>
                                <div class="top-trade-date">${new Date(t.created_at).toLocaleDateString()}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}

            <!-- История сделок (последние 20) -->
            <div class="history-card">
                <h3>📜 Последние сделки</h3>
                <div class="history-list" id="historyList">
                    ${hasTrades ? trades.slice(0,20).map(t => `
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

    // ---- Рисуем график объёмов ----
    const volumeCanvas = document.getElementById('volumeChartCanvas');
    if (volumeCanvas && volumeData.length) {
        const ctx = volumeCanvas.getContext('2d');
        const w = volumeCanvas.clientWidth;
        const h = 180;
        volumeCanvas.width = w;
        volumeCanvas.height = h;
        const volumes = volumeData.map(v => v.total_amount / 100);
        const maxVol = Math.max(...volumes, 1);
        const barWidth = (w - 60) / volumeData.length - 2;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#2b6e9e';
        volumeData.forEach((v, i) => {
            const barH = (volumes[i] / maxVol) * (h - 35);
            const x = 30 + i * (barWidth + 2);
            const y = h - 20 - barH;
            ctx.fillRect(x, y, barWidth, barH);
        });
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px sans-serif';
        ctx.fillText('0', 10, h - 15);
        ctx.fillText(maxVol.toFixed(0), 10, 25);
        ctx.fillText('дни', w - 30, h - 5);
    } else if (volumeCanvas) {
        const ctx = volumeCanvas.getContext('2d');
        ctx.fillStyle = '#0f1320';
        ctx.fillRect(0, 0, volumeCanvas.width, volumeCanvas.height);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px sans-serif';
        ctx.fillText('Нет данных', volumeCanvas.width/2 - 40, 90);
    }

    // ---- Рисуем график цены (линия) ----
    const priceCanvas = document.getElementById('priceChartCanvas');
    if (priceCanvas && priceHistory.length) {
        const ctx = priceCanvas.getContext('2d');
        const w = priceCanvas.clientWidth;
        const h = 180;
        priceCanvas.width = w;
        priceCanvas.height = h;
        const prices = priceHistory.map(p => p.price);
        const maxP = Math.max(...prices, 0.01);
        const minP = Math.min(...prices, 0);
        const range = maxP - minP || 1;
        ctx.clearRect(0, 0, w, h);
        ctx.beginPath();
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2;
        const step = w / (prices.length - 1);
        prices.forEach((price, i) => {
            const x = i * step;
            const y = h - 15 - ((price - minP) / range) * (h - 30);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px sans-serif';
        ctx.fillText(minP.toFixed(2), 5, h - 10);
        ctx.fillText(maxP.toFixed(2), 5, 15);
    } else if (priceCanvas) {
        const ctx = priceCanvas.getContext('2d');
        ctx.fillStyle = '#0f1320';
        ctx.fillRect(0, 0, priceCanvas.width, priceCanvas.height);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px sans-serif';
        ctx.fillText('Нет данных для графика цены', priceCanvas.width/2 - 80, 90);
    }
};
