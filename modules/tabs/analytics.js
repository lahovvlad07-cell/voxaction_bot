// modules/tabs/analytics.js

import { userId } from '../config.js';
import { fromCents } from '../utils.js';
import { supabase } from '../supabaseClient.js';

export async function renderAnalyticsTab() {
    const volume = await supabase.rpc('get_volume_history', { days_limit: 30 });
    const { data: trades } = await supabase
        .from('trades')
        .select('*')
        .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);

    let html = `
        <div class="card">
            <h2>📊 Объёмы торгов</h2>
            <canvas id="volCanvas" style="width:100%; height:130px;"></canvas>
            <p class="small-text">Объём за 30 дней</p>
        </div>
        <div class="card">
            <h2>📜 История сделок</h2>
            <div id="historyList"></div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    if (volume.data && volume.data.length) {
        const canvas = document.getElementById('volCanvas');
        const ctx = canvas.getContext('2d');
        const w = canvas.clientWidth, h = 130;
        canvas.width = w;
        canvas.height = h;
        const maxVol = Math.max(...volume.data.map(v => v.total_amount / 100));
        const barW = (w - 40) / volume.data.length - 2;
        ctx.fillStyle = '#2b6e9e';
        volume.data.forEach((v, i) => {
            const barH = (v.total_amount / 100 / maxVol) * (h - 20);
            ctx.fillRect(20 + i * (barW + 2), h - 10 - barH, barW, barH);
        });
    }

    const historyDiv = document.getElementById('historyList');
    if (trades && trades.length) {
        historyDiv.innerHTML = trades.map(t => `
            <div class="history-item">
                <span>${t.buyer_id === userId ? 'Покупка' : 'Продажа'} ${fromCents(t.amount)} шт. по ${fromCents(t.price_per_share)} ⭐</span>
                <span class="small-text">${new Date(t.created_at).toLocaleString()}</span>
            </div>
        `).join('');
    } else {
        historyDiv.innerHTML = '<p>Нет сделок</p>';
    }
}