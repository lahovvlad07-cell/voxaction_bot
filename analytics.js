// analytics.js – улучшенная версия в стиле других вкладок
window.renderAnalyticsTab = async function() {
    // Получаем данные объёмов за 30 дней (RPC)
    let volumeData = [];
    try {
        const volume = await window.supabase.rpc('get_volume_history', { days_limit: 30 });
        volumeData = volume.data || [];
    } catch(e) { console.warn('RPC get_volume_history не найден', e); }
    
    // Получаем последние сделки пользователя
    const { data: trades } = await window.supabase
        .from('trades')
        .select('*')
        .or(`seller_id.eq.${window.userId},buyer_id.eq.${window.userId}`)
        .order('created_at', { ascending: false })
        .limit(50);
    
    // HTML структура
    let html = `
        <div class="card">
            <h2>📊 Объёмы торгов (30 дней)</h2>
            <div style="height: 160px; margin: 16px 0;">
                <canvas id="volCanvas" style="width:100%; height:100%;"></canvas>
            </div>
            <p class="small-text">Объём в ⭐ за день</p>
        </div>
        <div class="card">
            <h2>📜 История сделок</h2>
            <div id="historyList" class="history-list"></div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;
    
    // Рисуем график объёмов, если есть данные
    if (volumeData && volumeData.length) {
        const canvas = document.getElementById('volCanvas');
        const ctx = canvas.getContext('2d');
        const w = canvas.clientWidth, h = 160;
        canvas.width = w; canvas.height = h;
        const maxVol = Math.max(...volumeData.map(v => v.total_amount / 100), 1);
        const barW = (w - 40) / volumeData.length - 2;
        ctx.fillStyle = '#2b6e9e';
        volumeData.forEach((v, i) => {
            const barH = (v.total_amount / 100 / maxVol) * (h - 30);
            ctx.fillRect(20 + i * (barW + 2), h - 15 - barH, barW, barH);
        });
    } else {
        // Если данных нет, показываем заглушку
        const canvas = document.getElementById('volCanvas');
        const ctx = canvas.getContext('2d');
        const w = canvas.clientWidth, h = 160;
        canvas.width = w; canvas.height = h;
        ctx.fillStyle = '#0f1320';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '12px sans-serif';
        ctx.fillText('Нет данных', w/2 - 30, h/2);
    }
    
    // Список сделок
    const historyDiv = document.getElementById('historyList');
    if (trades && trades.length) {
        historyDiv.innerHTML = trades.map(t => `
            <div class="history-item" style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span>${t.buyer_id === window.userId ? '🟢 Покупка' : '🔴 Продажа'} ${window.fromCents(t.amount)} шт. по ${window.fromCents(t.price_per_share)} ⭐</span>
                <span class="small-text">${new Date(t.created_at).toLocaleString()}</span>
            </div>
        `).join('');
    } else {
        historyDiv.innerHTML = '<div class="small-text" style="text-align:center; padding: 20px;">Нет сделок</div>';
    }
};
