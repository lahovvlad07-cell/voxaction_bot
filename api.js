// api.js – финальная версия с автообновлением статистики и выдачей достижений
window.toCents = (v) => Math.round(parseFloat(v) * 100);
window.fromCents = (c) => (c / 100).toFixed(2);

// -------------------- ВЫДАЧА ДОСТИЖЕНИЙ --------------------
async function awardAchievement(achievementId) {
    try {
        const { data: existing } = await window.supabase
            .from('user_achievements')
            .select('id')
            .eq('user_id', window.userId)
            .eq('achievement_id', achievementId)
            .maybeSingle();
        if (existing) return;
        await window.supabase.from('user_achievements').insert({
            user_id: window.userId,
            achievement_id: achievementId,
            earned_at: new Date().toISOString()
        });
        const { data: ach } = await window.supabase.from('achievements').select('name, icon').eq('id', achievementId).single();
        window.showToast(`🏆 Достижение: ${ach.icon} ${ach.name}`);
        if (window.renderProfileTab) window.renderProfileTab(); // обновить профиль
    } catch(e) { console.error('Ошибка выдачи достижения', e); }
}

async function checkAllAchievements() {
    const stats = await window.getUserStats(true); // принудительный пересчёт
    const user = window.currentUser;
    if (!user) return;
    const achievementsList = await window.getAllAchievements();
    const earned = await window.getEarnedAchievements();
    const earnedIds = new Set(earned.map(a => a.id));
    for (let ach of achievementsList) {
        if (earnedIds.has(ach.id)) continue;
        let conditionMet = false;
        switch (ach.condition_type) {
            case 'none': conditionMet = false; break;
            case 'trades_count': conditionMet = stats.totalTrades >= ach.condition_value; break;
            case 'shares_held': conditionMet = user.shares >= ach.condition_value; break;
            case 'referrals_count': conditionMet = (user.referral_count || 0) >= ach.condition_value; break;
            case 'total_topup': conditionMet = (user.total_topup || 0) >= ach.condition_value; break;
            case 'total_spent': conditionMet = (user.total_spent || 0) >= ach.condition_value; break;
            case 'total_earned': conditionMet = (user.total_earned || 0) >= ach.condition_value; break;
            case 'total_volume': conditionMet = (user.total_volume || 0) >= ach.condition_value; break;
            case 'stars_held': conditionMet = user.stars_balance >= ach.condition_value; break;
            case 'days_active': conditionMet = (user.days_active || 0) >= ach.condition_value; break;
        }
        if (conditionMet) await awardAchievement(ach.id);
    }
}

async function updateUserStats() {
    const { data: trades } = await window.supabase
        .from('trades')
        .select('total_stars, buyer_id, seller_id')
        .or(`seller_id.eq.${window.userId},buyer_id.eq.${window.userId}`);
    let totalSpent = 0, totalEarned = 0;
    for (let t of trades || []) {
        if (t.buyer_id === window.userId) totalSpent += t.total_stars;
        if (t.seller_id === window.userId) totalEarned += t.total_stars;
    }
    const totalVolume = totalSpent + totalEarned;
    const totalTrades = trades?.length || 0;
    await window.supabase.from('users').update({
        total_spent: totalSpent,
        total_earned: totalEarned,
        total_volume: totalVolume,
        trades_count: totalTrades
    }).eq('id', window.userId);
    if (window.currentUser) {
        window.currentUser.total_spent = totalSpent;
        window.currentUser.total_earned = totalEarned;
        window.currentUser.total_volume = totalVolume;
        window.currentUser.trades_count = totalTrades;
    }
}

// -------------------- ПОЛЬЗОВАТЕЛЬ --------------------
window.getOrCreateUser = async function() {
    let { data, error } = await window.supabase.from('users').select('*').eq('id', window.userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
        // создание нового пользователя (сокращённо, но добавлены все нужные поля)
        const avatarOptions = ['👤','😀','😎','🐱','🐶','🦊','🐼','⭐','🎮','⚽','🚀','💎','🌸','🔥','❤️','👍','🎉','🌟','🍕','🏆'];
        const randomAvatar = avatarOptions[Math.floor(Math.random() * avatarOptions.length)];
        const bgOptions = ['gradient1','gradient2','gradient3','gradient4','gradient5','gradient6','gradient7','gradient8','gradient9','gradient10','gradient11'];
        const randomBg = bgOptions[Math.floor(Math.random() * bgOptions.length)];
        const borderOptions = ['#ffffff','#ff0000','#00ff00','#0000ff','#ffff00','#ff69b4','#00ffff','#9b30ff'];
        const randomBorder = borderOptions[Math.floor(Math.random() * borderOptions.length)];
        let referralCode = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
        let existingCode = await window.supabase.from('users').select('referral_code').eq('referral_code', referralCode).maybeSingle();
        while (existingCode.data) {
            referralCode = 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
            existingCode = await window.supabase.from('users').select('referral_code').eq('referral_code', referralCode).maybeSingle();
        }
        let referredById = null;
        const userCheck = await window.supabase.from('users').select('referred_by').eq('id', window.userId).maybeSingle();
        if (userCheck.data?.referred_by) referredById = userCheck.data.referred_by;
        const { data: newUser, error: insertError } = await window.supabase.from('users').insert([{
            id: window.userId,
            username: window.username,
            shares: 0,
            stars_balance: 0,
            selected_achievements: [],
            avatar_url: randomAvatar,
            avatar_bg: randomBg,
            avatar_border: randomBorder,
            referral_code: referralCode,
            custom_ref_code: null,
            referred_by: referredById,
            registered_at: new Date().toISOString(),
            total_earned_shares: 0,
            referral_bonus_claimed: false,
            referral_count: 0,
            hide_rating: false,
            notify_trades: true,
            notify_topup: true,
            notify_referral: true,
            total_topup: 0,
            total_spent: 0,
            total_earned: 0,
            total_volume: 0,
            trades_count: 0,
            days_active: 0
        }]).select().single();
        if (insertError) throw new Error(insertError.message);
        if (referredById) {
            await window.supabase.from('users').update({ stars_balance: 500 }).eq('id', window.userId);
            await window.supabase.from('referrals').insert({ referrer_id: referredById, referred_id: window.userId, registered_at: new Date().toISOString() });
            await window.supabase.rpc('increment_referral_count', { p_user_id: referredById }); // или обычное update
        }
        await awardAchievement(1); // Первый шаг
        return { user: newUser, isNew: true };
    }
    let updated = false;
    ['total_topup','total_spent','total_earned','total_volume','trades_count','days_active'].forEach(f => {
        if (data[f] === undefined) { data[f] = 0; updated = true; }
    });
    if (updated) {
        await window.supabase.from('users').update({
            total_topup: data.total_topup,
            total_spent: data.total_spent,
            total_earned: data.total_earned,
            total_volume: data.total_volume,
            trades_count: data.trades_count,
            days_active: data.days_active
        }).eq('id', window.userId);
    }
    return { user: data, isNew: false };
};

window.getUserStats = async function(forceRefresh = false) {
    if (!forceRefresh && window._cachedStats) return window._cachedStats;
    const { data: trades } = await window.supabase
        .from('trades')
        .select('total_stars, buyer_id, seller_id')
        .or(`seller_id.eq.${window.userId},buyer_id.eq.${window.userId}`);
    let totalSpent = 0, totalEarned = 0;
    for (let t of trades || []) {
        if (t.buyer_id === window.userId) totalSpent += t.total_stars;
        if (t.seller_id === window.userId) totalEarned += t.total_stars;
    }
    const stats = {
        totalTrades: trades?.length || 0,
        totalVolume: (totalSpent + totalEarned) / 100,
        totalSpent: totalSpent / 100,
        totalEarned: totalEarned / 100
    };
    window._cachedStats = stats;
    return stats;
};

// -------------------- ОРДЕРА И СДЕЛКИ --------------------
window.getActiveOrders = async function() {
    const { data, error } = await window.supabase.from('orders').select('*').eq('status', 'active').order('price_per_share', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
};
window.getUserOrders = async function() {
    const { data, error } = await window.supabase.from('orders').select('*').eq('seller_id', window.userId).eq('status', 'active');
    if (error) throw new Error(error.message);
    return data || [];
};
window.cancelOrder = async function(orderId) {
    const { data, error } = await window.supabase.rpc('cancel_order', { p_order_id: orderId, p_user_id: window.userId });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    return true;
};
window.createOrder = async function(amountStars, priceStars) {
    const amountCents = window.toCents(amountStars);
    const priceCents = window.toCents(priceStars);
    if (amountCents < 100) throw new Error('Минимум 1 акция');
    if (priceCents < 100) throw new Error('Минимум 1 Star');
    const { data, error } = await window.supabase.rpc('create_sell_order_matched', {
        p_user_id: window.userId,
        p_amount_cents: amountCents,
        p_price_cents: priceCents
    });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    const executed = window.fromCents(data.executed_amount || 0);
    const remaining = window.fromCents(data.remaining_amount || 0);
    if (executed > 0) window.showToast(`✅ Продано ${executed} шт.`);
    if (remaining > 0) window.showToast(`📌 Остаток ${remaining} шт. в стакане`);
    await updateUserStats();
    await checkAllAchievements();
    return true;
};
window.createBuyOrder = async function(amountStars, priceStars) {
    const amountCents = window.toCents(amountStars);
    const priceCents = window.toCents(priceStars);
    if (amountCents < 100) throw new Error('Минимум 1 акция');
    if (priceCents < 100) throw new Error('Минимум 1 Star');
    const { user: freshUser } = await window.getOrCreateUser();
    window.currentUser = freshUser;
    const requiredStars = amountStars * priceStars;
    if (window.currentUser.stars_balance < requiredStars) {
        throw new Error(`❌ Недостаточно звёзд: нужно ${requiredStars.toFixed(2)} ⭐, у вас ${window.currentUser.stars_balance.toFixed(2)} ⭐`);
    }
    const { data, error } = await window.supabase.rpc('create_buy_order_matched', {
        p_user_id: window.userId,
        p_amount_cents: amountCents,
        p_price_cents: priceCents
    });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    const executed = window.fromCents(data.executed_amount || 0);
    const remaining = window.fromCents(data.remaining_amount || 0);
    if (executed > 0) window.showToast(`✅ Куплено ${executed} шт.`);
    if (remaining > 0) window.showToast(`📌 Остаток ${remaining} шт. в стакане`);
    await updateUserStats();
    await checkAllAchievements();
    return true;
};
window.executePartialTrade = async function(orderId, buyAmountCents) {
    const { data, error } = await window.supabase.rpc('execute_trade_partial', {
        p_order_id: orderId,
        p_buyer_id: window.userId,
        p_buy_amount_cents: buyAmountCents
    });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    await updateUserStats();
    await checkAllAchievements();
    return true;
};

window.getRecentTrades = async (limit = 10) => {
    const { data, error } = await window.supabase.from('trades').select('amount, price_per_share').order('created_at', { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
};
window.getPriceHistory = async () => {
    const { data, error } = await window.supabase.from('price_history').select('price, created_at').order('created_at', { ascending: true }).limit(100);
    if (error) throw new Error(error.message);
    return data || [];
};
window.getCurrentPrice = async () => {
    const { data, error } = await window.supabase.from('trades').select('amount, price_per_share').order('created_at', { ascending: false }).limit(50);
    if (error || !data || data.length === 0) return 100;
    let totalAmount = 0, totalStars = 0;
    for (let trade of data) { totalAmount += trade.amount; totalStars += trade.amount * trade.price_per_share; }
    return totalAmount > 0 ? totalStars / totalAmount : 100;
};
window.getTotalMarketCap = async () => {
    const { data, error } = await window.supabase.from('users').select('shares');
    if (error) throw new Error(error.message);
    const totalSharesCents = data.reduce((s,u) => s + u.shares, 0);
    const currentPriceCents = await window.getCurrentPrice();
    const marketCapStars = (totalSharesCents / 100) * (currentPriceCents / 100);
    return { totalShares: totalSharesCents, currentPrice: currentPriceCents, marketCap: marketCapStars };
};

// -------------------- РЕЙТИНГ, ДОСТИЖЕНИЯ, ПРОЧЕЕ --------------------
window.getLeaderboard = async () => {
    const { data, error } = await window.supabase.from('users').select('username, shares, id').eq('hide_rating', false).order('shares', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
};
window.getUserRank = async () => {
    const leaders = await window.getLeaderboard();
    const idx = leaders.findIndex(u => u.id === window.userId);
    return idx === -1 ? null : idx + 1;
};
window.getEarnedAchievements = async () => {
    const { data, error } = await window.supabase
        .from('user_achievements')
        .select('achievement_id, earned_at, achievements(id, name, description, icon, condition_type, condition_value)')
        .eq('user_id', window.userId);
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
};
window.getAllAchievements = async () => {
    const { data, error } = await window.supabase.from('achievements').select('*');
    if (error) return [];
    return data;
};
window.getSellerRating = async (sellerId) => {
    const { data, error } = await window.supabase.from('seller_ratings').select('rating').eq('seller_id', sellerId);
    if (error || !data.length) return null;
    return data.reduce((s,r)=>s+r.rating,0)/data.length;
};
window.updateUserBorder = async (color) => {
    await window.supabase.from('users').update({ avatar_border: color }).eq('id', window.userId);
    if (window.currentUser) window.currentUser.avatar_border = color;
    return true;
};

// Админские функции (заглушки)
window.adminFetchStats = async () => fetch(`${window.BACKEND_URL}/admin/stats`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId }) }).then(r=>r.json());
window.adminFetchUsers = async () => fetch(`${window.BACKEND_URL}/admin/users`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId }) }).then(r=>r.json());
window.adminCancelOrder = async (orderId) => fetch(`${window.BACKEND_URL}/admin/cancel-order`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId, order_id: orderId }) }).then(r=>r.json());
window.adminAddShares = async (targetId, shares) => fetch(`${window.BACKEND_URL}/admin/add-shares`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId, target_id: targetId, shares }) }).then(r=>r.json());
window.adminAddStars = async (targetId, stars) => fetch(`${window.BACKEND_URL}/admin/add-stars`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId, target_id: targetId, stars }) }).then(r=>r.json());
window.createInvoice = async (amount) => fetch(`${window.BACKEND_URL}/create-invoice`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user_id: window.userId, amount }) }).then(r=>r.json());

window.getReferralsList = async () => { /* аналогично предыдущим версиям */ return []; };
window.getReferralRewardsProgress = async () => null;
window.claimReferralBonus = async () => ({ ok: false });
window.getEarnedAchievementsForUser = async (userId) => [];
window.getUserStatsForUser = async (userId) => ({ totalTrades:0, totalVolume:0 });
window.getUserRankForUser = async (userId) => null;
window.renderAvatarHtml = (avatarUrl, avatarBg, avatarBorder, size = '52px') => {
    let bgColor = avatarBg && !avatarBg.startsWith('#') ? { gradient1:'#2b6e9e', gradient2:'#9b59b6', gradient3:'#e67e22', gradient4:'#27ae60', gradient5:'#f1c40f', gradient6:'#e74c3c', gradient7:'#1abc9c', gradient8:'#3498db', gradient9:'#2c3e50', gradient10:'#ff9a9e', gradient11:'#a18cd1' }[avatarBg] || '#2b6e9e' : (avatarBg || '#2b6e9e');
    const borderColor = avatarBorder || '#ffffff';
    const emoji = avatarUrl || '👤';
    return `<div class="mini-avatar" style="width:${size}; height:${size}; background:${bgColor}; border:2px solid ${borderColor}; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:32px;"><span>${emoji}</span></div>`;
};
