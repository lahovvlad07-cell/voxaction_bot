// modules/api.js

import { supabase } from './supabaseClient.js';
import { userId, BACKEND_URL } from './config.js';
import { toCents } from './utils.js';

// === Ордера и торги ===
export async function getActiveOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('status', 'active')
        .order('price_per_share', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
}

export async function getUserOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('seller_id', userId)
        .eq('status', 'active');
    if (error) throw new Error(error.message);
    return data || [];
}

export async function cancelOrder(orderId) {
    const { data, error } = await supabase.rpc('cancel_order', {
        p_order_id: orderId,
        p_user_id: userId
    });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    return true;
}

export async function createOrder(amount, price, currentUser) {
    const amountCents = toCents(amount);
    const priceCents = toCents(price);
    if (amountCents < 100) throw new Error('Минимум 1 акция');
    if (priceCents < 100) throw new Error('Минимум 1 Star');
    const { data, error } = await supabase.rpc('create_sell_order', {
        p_user_id: userId,
        p_amount: amountCents,
        p_price: priceCents
    });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    currentUser.shares -= amountCents;
    return true;
}

export async function executePartialTrade(orderId, buyAmountCents) {
    const { data, error } = await supabase.rpc('execute_trade_partial', {
        p_order_id: orderId,
        p_buyer_id: userId,
        p_buy_amount: buyAmountCents
    });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    return true;
}

export async function getRecentTrades(limit = 10) {
    const { data, error } = await supabase
        .from('trades')
        .select('amount, price_per_share')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
}

export async function getPriceHistory() {
    const { data, error } = await supabase
        .from('price_history')
        .select('price, created_at')
        .order('created_at', { ascending: true })
        .limit(100);
    if (error) throw new Error(error.message);
    return data || [];
}

export async function getCurrentPrice() {
    const { data, error } = await supabase
        .from('trades')
        .select('amount, price_per_share')
        .order('created_at', { ascending: false })
        .limit(50);
    if (error || !data || data.length === 0) return 100;
    let totalAmount = 0, totalStars = 0;
    for (let trade of data) {
        totalAmount += trade.amount;
        totalStars += trade.amount * trade.price_per_share;
    }
    return totalAmount > 0 ? totalStars / totalAmount : 100;
}

export async function getTotalMarketCap() {
    const { data, error } = await supabase.from('users').select('shares');
    if (error) throw new Error(error.message);
    const totalSharesCents = data.reduce((s, u) => s + u.shares, 0);
    const currentPriceCents = await getCurrentPrice();
    const marketCapStars = (totalSharesCents / 100) * (currentPriceCents / 100);
    return { totalShares: totalSharesCents, currentPrice: currentPriceCents, marketCap: marketCapStars };
}

export async function getLeaderboard() {
    const { data, error } = await supabase
        .from('users')
        .select('username, shares, id')
        .eq('hide_rating', false)
        .order('shares', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
}

export async function getUserRank() {
    const leaders = await getLeaderboard();
    const idx = leaders.findIndex(u => u.id === userId);
    if (idx === -1) return null;
    return idx + 1;
}

export async function getUserStats() {
    const { data, error } = await supabase
        .from('trades')
        .select('amount, total_stars')
        .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`);
    if (error) return { totalTrades: 0, totalVolume: 0 };
    return {
        totalTrades: data.length,
        totalVolume: data.reduce((s, t) => s + t.total_stars / 100, 0)
    };
}

export async function getSellerRating(sellerId) {
    const { data, error } = await supabase
        .from('seller_ratings')
        .select('rating')
        .eq('seller_id', sellerId);
    if (error || !data.length) return null;
    return data.reduce((s, r) => s + r.rating, 0) / data.length;
}

export async function fetchPriceHistoryForTimeframe(timeframe = '30d') {
    let startDate = new Date();
    if (timeframe === '1d') startDate.setDate(startDate.getDate() - 1);
    else if (timeframe === '7d') startDate.setDate(startDate.getDate() - 7);
    else startDate.setDate(startDate.getDate() - 30);
    const { data, error } = await supabase
        .from('price_history')
        .select('price, created_at')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true })
        .limit(100);
    if (error) throw new Error(error.message);
    return data || [];
}

export async function getVolumeHistory(days = 30) {
    const { data, error } = await supabase.rpc('get_volume_history', { days_limit: days });
    return { data, error };
}

// === Достижения (базовые запросы) ===
export async function getAllAchievements() {
    const { data, error } = await supabase.from('achievements').select('*');
    if (error) return [];
    return data;
}

export async function getEarnedAchievements(userId) {
    const { data, error } = await supabase
        .from('user_achievements')
        .select('achievement_id, earned_at, achievements(id, name, description, icon, condition_type, condition_value)')
        .eq('user_id', userId);
    if (error) return [];
    return data.map(ua => ({
        id: ua.achievements.id,
        name: ua.achievements.name,
        description: ua.achievements.description,
        icon: ua.achievements.icon,
        earned_at: ua.earned_at,
        condition_type: ua.achievements.condition_type,
        condition_value: ua.achievements.condition_value
    }));
}

// === Админские функции (через бэкенд) ===
export async function adminFetchStats() {
    const res = await fetch(`${BACKEND_URL}/admin/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: userId })
    });
    return res.json();
}

export async function adminFetchUsers() {
    const res = await fetch(`${BACKEND_URL}/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: userId })
    });
    return res.json();
}

export async function adminCancelOrder(orderId) {
    const res = await fetch(`${BACKEND_URL}/admin/cancel-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: userId, order_id: orderId })
    });
    return res.json();
}

export async function adminAddShares(targetId, shares) {
    const res = await fetch(`${BACKEND_URL}/admin/add-shares`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: userId, target_id: targetId, shares })
    });
    return res.json();
}

export async function adminAddStars(targetId, stars) {
    const res = await fetch(`${BACKEND_URL}/admin/add-stars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ admin_id: userId, target_id: targetId, stars })
    });
    return res.json();
}

export async function createInvoice(amount) {
    const res = await fetch(`${BACKEND_URL}/create-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, amount })
    });
    return res.json();
}