// analytics.js
window.renderAnalytics = async () => {
    const vol = await window.supabase.rpc('get_volume_history', { days_limit: 30 });
    let html = `<div class="card"><h2>📊 Объёмы торгов</h2><canvas id="volCanvas" style="width:100%;height:130px"></canvas><p class="small-text">Объём за 30 дней</p></div>`;
    document.getElementById('app').innerHTML = html;
    if (vol.data && vol.data.length) {
        const canvas = document.getElementById('volCanvas');
        const ctx = canvas.getContext('2d');
        const w = canvas.clientWidth, h = 130;
        canvas.width = w; canvas.height = h;
        const maxVol = Math.max(...vol.data.map(v=>v.total_amount/100));
        const barW = (w-40)/vol.data.length - 2;
        ctx.fillStyle = '#2b6e9e';
        vol.data.forEach((v,i) => {
            const barH = (v.total_amount/100 / maxVol) * (h-20);
            ctx.fillRect(20 + i*(barW+2), h-10-barH, barW, barH);
        });
    }
};
