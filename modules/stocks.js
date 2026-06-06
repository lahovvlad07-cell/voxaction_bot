// modules/stocks.js

import { fromCents } from './utils.js';

// Рисует график цены на canvas
export function drawCanvasChart(history, containerId = 'chart-container') {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    if (!history || history.length === 0) {
        container.innerHTML = '<p style="padding:20px; text-align:center;">Нет данных</p>';
        return;
    }
    const canvas = document.createElement('canvas');
    const width = container.clientWidth, height = 220;
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = '100%';
    canvas.style.height = 'auto';
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const values = history.map(h => h.price / 100);
    const max = Math.max(...values), min = Math.min(...values), range = max - min;
    const padding = { top: 20, bottom: 30, left: 40, right: 20 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;
    const stepX = graphWidth / (values.length - 1);
    ctx.fillStyle = '#0f1320';
    ctx.fillRect(0, 0, width, height);
    ctx.beginPath();
    ctx.strokeStyle = '#2b6e9e';
    ctx.lineWidth = 2;
    for (let i = 0; i < values.length; i++) {
        const x = padding.left + i * stepX;
        let y = (range === 0)
            ? padding.top + graphHeight / 2
            : padding.top + graphHeight - ((values[i] - min) / range) * graphHeight;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = '#eef2ff';
    ctx.font = '11px sans-serif';
    ctx.fillText(max.toFixed(2), padding.left - 30, padding.top + 10);
    ctx.fillText(min.toFixed(2), padding.left - 30, height - padding.bottom - 5);
    if (history.length) {
        const firstDate = new Date(history[0].created_at).toLocaleDateString();
        const lastDate = new Date(history[history.length - 1].created_at).toLocaleDateString();
        ctx.fillText(firstDate, padding.left, height - padding.bottom + 15);
        ctx.fillText(lastDate, width - padding.right - 40, height - padding.bottom + 15);
    }
}

// Рендер бегущей строки с последними сделками
export function renderTicker(trades, containerId = 'ticker') {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!trades || trades.length === 0) {
        container.innerHTML = '<div class="ticker-content">Нет сделок</div>';
        return;
    }
    const items = trades.map(t => `<span class="trade-item" style="margin-right:24px;">${fromCents(t.amount)} шт. по ${fromCents(t.price_per_share)} ⭐</span>`).join('');
    container.innerHTML = `<div class="ticker-content">${items}</div>`;
}