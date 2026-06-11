// analytics.js – профессиональная аналитика (профит – цветной текст)
let currentPeriod = 30;

async function loadAnalyticsData() {
    document.getElementById('app').innerHTML = `
        <div class="analytics-container">
            <div class="analytics-stats">
                <div class="stat-card skeleton"><div class="skeleton-line"></div></div>
                <div class="stat-card skeleton"><div class="skeleton-line"></div></div>
                <div class="stat-card skeleton"><div class="skeleton-line"></div></div>
            </div>
            <div class="chart-card skeleton"><div class="skeleton-chart"></div></div>
            <div class="chart-card skeleton"><div class="skeleton-chart"></div></div>
            <div class="info-card skeleton"><div class="skeleton-list"></div></div>
        </div>
    `;
    
    try {
        // Объёмы за период
        let volumeData = [];
        try {
            const { data: vol } = await window.supabase.rpc('get_volume_history', { days_limit: currentPeriod });
            volumeData = vol || [];
        } catch(e) {
            console.warn('RPC get_volume_history не найден');
        }
        
        // Все сделки пользователя (без ограничений по дате, для топ-5 за всё время)
        const { data: allTrades } = await window.supabase
            .from('trades')
            .select('*')
            .or(`seller_id.eq.${window.userId},buyer_id.eq.${window.userId}`)
            .order('created_at', { ascending: false });
        
        // Сделки за период для графиков и статистики
        const periodDate = new Date();
        periodDate.setDate(periodDate.getDate() - currentPeriod);
        const tradesInPeriod = (allTrades || []).filter(t => new Date(t.created_at) >= periodDate);
        
        // Данные для графика цены (за период)
        let priceData = [];
        if (tradesInPeriod.length) {
            const days = {};
            tradesInPeriod.forEach(t => {
                const day = t.created_at.slice(0,10);
                if (!days[day]) days[day] = { sum: 0, count: 0 };
                days[day].sum += t.price_per_share;
                days[day].count++;
            });
            priceData = Object.entries(days).map(([date, { sum, count }]) => ({
                date,
                price: sum / count / 100
            }));
        }
        
        renderAnalytics(volumeData, priceData, allTrades || [], tradesInPeriod);
    } catch(e) {
        console.error(e);
        document.getElementById('app').innerHTML = '<div class="card error">Ошибка загрузки данных</div>';
    }
}

function renderAnalytics(volumeData, priceData, allTrades, tradesInPeriod) {
    const totalTrades = allTrades.length;
    const totalVolumeStars = allTrades.reduce((sum, t) => sum + t.total_stars / 100, 0);
    const avgPrice = allTrades.length ? (allTrades.reduce((sum, t) => sum + t.price_per_share / 100, 0) / allTrades.length) : 0;
    const spent = allTrades.filter(t => t.buyer_id === window.userId).reduce((s, t) => s + t.total_stars / 100, 0);
    const earned = allTrades.filter(t => t.seller_id === window.userId).reduce((s, t) => s + t.total_stars / 100, 0);
    const profit = earned - spent;
    
    // Топ-5 крупнейших сделок за всё время (по total_stars)
    const topTrades = [...allTrades].sort((a,b) => b.total_stars - a.total_stars).slice(0,5);
    
    // Последние 20 сделок
    const recentTrades = allTrades.slice(0,20);
    
    // Активность по дням недели (за всё время)
    const weekdays = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    const weekdayCount = [0,0,0,0,0,0,0];
    allTrades.forEach(t => {
        const wd = new Date(t.created_at).getDay();
        weekdayCount[wd]++;
    });
    const maxCount = Math.max(...weekdayCount, 1);
    
    const profitClass = profit >= 0 ? 'positive-text' : 'negative-text';
    const profitSign = profit >= 0 ? '+' : '';
    
    const html = `
        <div class="analytics-container">
            <div class="analytics-stats">
                <div class="stat-card"><div class="stat-icon">📊</div><div class="stat-value">${totalTrades}</div><div class="stat-label">Сделок</div></div>
                <div class="stat-card"><div class="stat-icon">⭐</div><div class="stat-value">${totalVolumeStars.toFixed(2)}</div><div class="stat-label">Объём</div></div>
                <div class="stat-card"><div class="stat-icon">📈</div><div class="stat-value">${avgPrice.toFixed(2)}</div><div class="stat-label">Ср. цена</div></div>
            </div>
            <div class="analytics-stats">
                <div class="stat-card"><div class="stat-icon">💸</div><div class="stat-value">${spent.toFixed(2)}</div><div class="stat-label">Потрачено</div></div>
                <div class="stat-card"><div class="stat-icon">💰</div><div class="stat-value">${earned.toFixed(2)}</div><div class="stat-label">Заработано</div></div>
                <div class="stat-card"><div class="stat-icon">⚖️</div><div class="stat-value ${profitClass}">${profitSign}${profit.toFixed(2)}</div><div class="stat-label">Профит</div></div>
            </div>
            
            <div class="period-switch">
                <button class="period-btn ${currentPeriod === 7 ? 'active' : ''}" data-period="7">7 дней</button>
                <button class="period-btn ${currentPeriod === 30 ? 'active' : ''}" data-period="30">30 дней</button>
                <button class="period-btn ${currentPeriod === 90 ? 'active' : ''}" data-period="90">90 дней</button>
            </div>
            
            <div class="chart-card">
                <h3>📊 Объёмы торгов</h3>
                <div class="chart-wrapper"><canvas id="volumeCanvas" width="600" height="200" style="width:100%; height:200px;"></canvas></div>
                <div class="chart-note">⭐ за день</div>
            </div>
            
            ${priceData.length ? `
            <div class="chart-card">
                <h3>📈 Динамика цены (линия) и SMA 7</h3>
                <div class="chart-wrapper"><canvas id="priceCanvas" width="600" height="200" style="width:100%; height:200px;"></canvas></div>
            </div>
            ` : ''}
            
            <div class="info-card">
                <h3>📅 Активность по дням</h3>
                <div class="weekday-stats">
                    ${weekdays.map((day, i) => `
                        <div class="weekday-item">
                            <span>${day}</span>
                            <div class="weekday-bar"><div class="weekday-fill" style="width: ${(weekdayCount[i]/maxCount)*100}%;"></div></div>
                            <span class="weekday-count">${weekdayCount[i]}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
            
            <div class="info-card">
                <h3>🏆 Крупнейшие сделки (топ-5 за всё время)</h3>
                <div class="top-trades-list">
                    ${topTrades.map(t => {
                        const isBuy = t.buyer_id === window.userId;
                        return `
                            <div class="top-trade-item">
                                <div class="top-trade-type ${isBuy ? 'buy' : 'sell'}">${isBuy ? '🟢 Покупка' : '🔴 Продажа'}</div>
                                <div class="top-trade-details">${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐ → ${(t.total_stars/100).toFixed(2)} ⭐</div>
                                <div class="top-trade-date">${new Date(t.created_at).toLocaleDateString()}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
                ${!topTrades.length ? '<div class="empty-history">Нет сделок</div>' : ''}
            </div>
            
            <div class="history-card">
                <h3>📜 Последние сделки (20 шт.)</h3>
                <div class="history-list">
                    ${recentTrades.map(t => `
                        <div class="history-item">
                            <div class="history-type ${t.buyer_id === window.userId ? 'buy' : 'sell'}">${t.buyer_id === window.userId ? '🟢 Покупка' : '🔴 Продажа'}</div>
                            <div class="history-details">${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐</div>
                            <div class="history-date">${new Date(t.created_at).toLocaleString()}</div>
                        </div>
                    `).join('')}
                    ${!recentTrades.length ? '<div class="empty-history">Нет сделок</div>' : ''}
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('app').innerHTML = html;
    
    drawVolumeChart(volumeData);
    if (priceData.length) drawPriceChart(priceData);
    
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentPeriod = parseInt(btn.dataset.period);
            loadAnalyticsData();
        });
    });
}

function drawVolumeChart(volumeData) {
    const canvas = document.getElementById('volumeCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.clientWidth;
    const h = 200;
    canvas.width = w;
    canvas.height = h;
    
    if (!volumeData.length) {
        ctx.fillStyle = '#0f1320';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px sans-serif';
        ctx.fillText('Нет данных', w/2 - 40, h/2);
        return;
    }
    
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
}

function drawPriceChart(priceData) {
    const canvas = document.getElementById('priceCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.clientWidth;
    const h = 200;
    canvas.width = w;
    canvas.height = h;
    
    if (!priceData.length) return;
    
    const prices = priceData.map(p => p.price);
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
    
    // SMA 7
    if (prices.length >= 7) {
        const sma = [];
        for (let i = 6; i < prices.length; i++) {
            const sum = prices.slice(i-6, i+1).reduce((a,b) => a+b, 0);
            sma.push(sum / 7);
        }
        ctx.beginPath();
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        const smaStep = w / (sma.length - 1);
        sma.forEach((val, i) => {
            const x = (i + 6) * step;
            const y = h - 15 - ((val - minP) / range) * (h - 30);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
    }
    
    ctx.fillStyle = '#9ca3af';
    ctx.font = '10px sans-serif';
    ctx.fillText(minP.toFixed(2), 5, h - 10);
    ctx.fillText(maxP.toFixed(2), 5, 15);
    ctx.fillText('SMA 7 (жёлтая)', w - 70, 20);
}

window.renderAnalyticsTab = loadAnalyticsData;
