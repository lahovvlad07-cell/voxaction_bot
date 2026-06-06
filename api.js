// api.js – полная версия с обновлённой реферальной системой (аватар и ID в списке)

async function ensureWelcomeAchievement(userId) {
    try {
        const { data: achData } = await window.supabase.from('achievements').select('id').eq('name', '🌟 Первый шаг').maybeSingle();
        if (!achData) return;
        const { data: existing } = await window.supabase.from('user_achievements').select('achievement_id').eq('user_id', userId).eq('achievement_id', achData.id).maybeSingle();
        if (!existing) {
            await window.supabase.from('user_achievements').insert({ user_id: userId, achievement_id: achData.id, earned_at: new Date().toISOString() });
        }
    } catch(e) { console.error(e); }
}

function generateReferralCode() {
    return 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

window.getOrCreateUser = async function() {
    let { data, error } = await window.supabase.from('users').select('*').eq('id', window.userId).maybeSingle();
    if (error) throw new Error(`Ошибка запроса: ${error.message}`);
    
    if (!data) {
        const avatarOptions = ['👤','😀','😎','🐱','🐶','🦊','🐼','⭐','🎮','⚽','🚀','💎','🌸','🔥','❤️','👍','🎉','🌟','🍕','🏆','🎨','📷','⚡','🔮'];
        const randomAvatar = avatarOptions[Math.floor(Math.random() * avatarOptions.length)];
        const bgOptions = ['gradient1','gradient2','gradient3','gradient4','gradient5','gradient6','gradient7','gradient8','gradient9','gradient10','gradient11'];
        const randomBg = bgOptions[Math.floor(Math.random() * bgOptions.length)];
        const borderOptions = ['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff69b4', '#00ffff', '#9b30ff'];
        const randomBorder = borderOptions[Math.floor(Math.random() * borderOptions.length)];
        
        let referralCode = generateReferralCode();
        let existingCode = await window.supabase.from('users').select('referral_code').eq('referral_code', referralCode).maybeSingle();
        while (existingCode.data) {
            referralCode = generateReferralCode();
            existingCode = await window.supabase.from('users').select('referral_code').eq('referral_code', referralCode).maybeSingle();
        }
        
        let referredById = null;
        const userCheck = await window.supabase.from('users').select('referred_by').eq('id', window.userId).maybeSingle();
        if (userCheck.data && userCheck.data.referred_by) {
            referredById = userCheck.data.referred_by;
        }
        
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
            notify_referral: true
        }]).select().single();
        
        if (insertError) throw new Error(`Ошибка вставки: ${insertError.message}`);
        
        if (referredById) {
            await window.supabase.from('users').update({ stars_balance: 500 }).eq('id', window.userId);
            await window.supabase.from('referrals').insert({
                referrer_id: referredById,
                referred_id: window.userId,
                registered_at: new Date().toISOString(),
                topup_completed: false,
                bonus_earned: false
            });
            const referrer = await window.supabase.from('users').select('referral_count').eq('id', referredById).single();
            if (referrer.data) {
                const newCount = (referrer.data.referral_count || 0) + 1;
                await window.supabase.from('users').update({ referral_count: newCount }).eq('id', referredById);
            }
            await window.supabase.from('notifications').insert({
                user_id: referredById,
                message: `🎉 Новый реферал! ${window.username} зарегистрировался по вашей ссылке.`,
                type: 'notify_referral',
                is_read: false
            });
        }
        
        await ensureWelcomeAchievement(window.userId);
        return { user: newUser, isNew: true };
    }
    
    await ensureWelcomeAchievement(window.userId);
    let updated = false;
    if (!data.selected_achievements) { data.selected_achievements = []; updated = true; }
    if (!data.avatar_url) { data.avatar_url = '👤'; updated = true; }
    if (!data.avatar_bg) { data.avatar_bg = 'gradient1'; updated = true; }
    if (!data.avatar_border) { data.avatar_border = '#ffffff'; updated = true; }
    if (!data.registered_at) { data.registered_at = new Date().toISOString(); updated = true; }
    if (!data.referral_code) {
        let newCode = generateReferralCode();
        let existing = await window.supabase.from('users').select('referral_code').eq('referral_code', newCode).maybeSingle();
        while (existing.data) {
            newCode = generateReferralCode();
            existing = await window.supabase.from('users').select('referral_code').eq('referral_code', newCode).maybeSingle();
        }
        data.referral_code = newCode;
        updated = true;
    }
    if (data.custom_ref_code === undefined) { data.custom_ref_code = null; updated = true; }
    if (data.total_earned_shares === undefined) { data.total_earned_shares = 0; updated = true; }
    if (data.referral_count === undefined) { data.referral_count = 0; updated = true; }
    if (data.hide_rating === undefined) { data.hide_rating = false; updated = true; }
    if (data.notify_trades === undefined) { data.notify_trades = true; updated = true; }
    if (data.notify_topup === undefined) { data.notify_topup = true; updated = true; }
    if (data.notify_referral === undefined) { data.notify_referral = true; updated = true; }
    
    if (updated) {
        await window.supabase.from('users').update({
            selected_achievements: data.selected_achievements,
            avatar_url: data.avatar_url,
            avatar_bg: data.avatar_bg,
            avatar_border: data.avatar_border,
            referral_code: data.referral_code,
            custom_ref_code: data.custom_ref_code,
            registered_at: data.registered_at,
            total_earned_shares: data.total_earned_shares,
            referral_count: data.referral_count,
            hide_rating: data.hide_rating,
            notify_trades: data.notify_trades,
            notify_topup: data.notify_topup,
            notify_referral: data.notify_referral
        }).eq('id', window.userId);
    }
    return { user: data, isNew: false };
};

// Обновлённая функция getReferralsList – теперь возвращает аватар и ID
window.getReferralsList = async function() {
    const { data, error } = await window.supabase
        .from('referrals')
        .select(`
            referred_id,
            registered_at,
            topup_completed,
            topup_amount_cents,
            bonus_earned,
            users:referred_id (username, avatar_url, id)
        `)
        .eq('referrer_id', window.userId)
        .order('registered_at', { ascending: false });
    if (error) return [];
    return data.map(r => ({
        userId: r.referred_id,
        username: r.users?.username || `user_${r.referred_id}`,
        avatarUrl: r.users?.avatar_url || '👤',
        registeredAt: r.registered_at,
        topupCompleted: r.topup_completed,
        topupAmount: r.topup_amount_cents ? r.topup_amount_cents / 100 : 0,
        bonusEarned: r.bonus_earned
    }));
};

window.getReferralRewardsProgress = async function(referralCount) {
    const rewards = [
        { count: 3, shares: 1000, achievement: '🤝 Наставник' },
        { count: 5, shares: 2000, achievement: '🌟 Лидер' },
        { count: 10, shares: 5000, achievement: '👑 Король рефералов' }
    ];
    const earnedAchievements = await window.getEarnedAchievements();
    const earnedNames = new Set(earnedAchievements.map(a => a.name));
    const nextReward = rewards.find(r => referralCount < r.count && !earnedNames.has(r.achievement));
    if (!nextReward) return null;
    return {
        needed: nextReward.count,
        current: referralCount,
        rewardShares: nextReward.shares / 100,
        achievementName: nextReward.achievement,
        progress: (referralCount / nextReward.count) * 100
    };
};

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

window.createOrder = async function(amount, price) {
    const amountCents = window.toCents(amount), priceCents = window.toCents(price);
    if (amountCents < 100) throw new Error('Минимум 1 акция');
    if (priceCents < 100) throw new Error('Минимум 1 Star');
    const { data, error } = await window.supabase.rpc('create_sell_order', { p_user_id: window.userId, p_amount: amountCents, p_price: priceCents });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    window.currentUser.shares -= amountCents;
    return true;
};

window.executePartialTrade = async function(orderId, buyAmountCents) {
    const { data, error } = await window.supabase.rpc('execute_trade_partial', { p_order_id: orderId, p_buyer_id: window.userId, p_buy_amount: buyAmountCents });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    return true;
};

window.getRecentTrades = async function(limit = 10) {
    const { data, error } = await window.supabase.from('trades').select('amount, price_per_share').order('created_at', { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
};

window.getPriceHistory = async function() {
    const { data, error } = await window.supabase.from('price_history').select('price, created_at').order('created_at', { ascending: true }).limit(100);
    if (error) throw new Error(error.message);
    return data || [];
};

window.getCurrentPrice = async function() {
    const { data, error } = await window.supabase.from('trades').select('amount, price_per_share').order('created_at', { ascending: false }).limit(50);
    if (error || !data || data.length === 0) return 100;
    let totalAmount = 0, totalStars = 0;
    for (let trade of data) { totalAmount += trade.amount; totalStars += trade.amount * trade.price_per_share; }
    return totalAmount > 0 ? totalStars / totalAmount : 100;
};

window.getTotalMarketCap = async function() {
    const { data, error } = await window.supabase.from('users').select('shares');
    if (error) throw new Error(error.message);
    const totalSharesCents = data.reduce((s,u) => s + u.shares, 0);
    const currentPriceCents = await window.getCurrentPrice();
    const marketCapStars = (totalSharesCents / 100) * (currentPriceCents / 100);
    return { totalShares: totalSharesCents, currentPrice: currentPriceCents, marketCap: marketCapStars };
};

window.getLeaderboard = async function() {
    const { data, error } = await window.supabase.from('users').select('username, shares, id').eq('hide_rating', false).order('shares', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
};

window.getUserRank = async function() {
    const leaders = await window.getLeaderboard();
    const idx = leaders.findIndex(u => u.id === window.userId);
    if (idx === -1) return null;
    return idx + 1;
};

window.getUserStats = async function() {
    const { data, error } = await window.supabase.from('trades').select('amount, total_stars').or(`seller_id.eq.${window.userId},buyer_id.eq.${window.userId}`);
    if (error) return { totalTrades: 0, totalVolume: 0 };
    return { totalTrades: data.length, totalVolume: data.reduce((s,t) => s + t.total_stars/100, 0) };
};

window.getEarnedAchievements = async function() {
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

window.getAllAchievements = async function() {
    const { data, error } = await window.supabase.from('achievements').select('*');
    if (error) return [];
    return data;
};

window.getSellerRating = async function(sellerId) {
    const { data, error } = await window.supabase.from('seller_ratings').select('rating').eq('seller_id', sellerId);
    if (error || !data.length) return null;
    return data.reduce((s,r)=>s+r.rating,0)/data.length;
};

window.updateUserBorder = async function(color) {
    const { error } = await window.supabase.from('users').update({ avatar_border: color }).eq('id', window.userId);
    if (error) throw new Error(error.message);
    if (window.currentUser) window.currentUser.avatar_border = color;
    return true;
};

window.adminFetchStats = async function() {
    const res = await fetch(`${window.BACKEND_URL}/admin/stats`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId }) });
    return res.json();
};
window.adminFetchUsers = async function() {
    const res = await fetch(`${window.BACKEND_URL}/admin/users`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId }) });
    return res.json();
};
window.adminCancelOrder = async function(orderId) {
    const res = await fetch(`${window.BACKEND_URL}/admin/cancel-order`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId, order_id: orderId }) });
    return res.json();
};
window.adminAddShares = async function(targetId, shares) {
    const res = await fetch(`${window.BACKEND_URL}/admin/add-shares`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId, target_id: targetId, shares }) });
    return res.json();
};
window.adminAddStars = async function(targetId, stars) {
    const res = await fetch(`${window.BACKEND_URL}/admin/add-stars`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId, target_id: targetId, stars }) });
    return res.json();
};
window.createInvoice = async function(amount) {
    const res = await fetch(`${window.BACKEND_URL}/create-invoice`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user_id: window.userId, amount }) });
    return res.json();
};
