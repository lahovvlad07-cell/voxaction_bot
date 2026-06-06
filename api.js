// api.js – полная версия со случайными начальными параметрами, реферальным кодом и updateUserBorder

// ---------- Вспомогательные функции ----------
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

// Генерация уникального реферального кода
function generateReferralCode() {
    return 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ---------- Пользователи (случайные начальные параметры + реферальный код) ----------
window.getOrCreateUser = async function() {
    let { data, error } = await window.supabase.from('users').select('*').eq('id', window.userId).maybeSingle();
    if (error) throw new Error(`Ошибка запроса: ${error.message}`);
    if (!data) {
        // Случайные значения для нового пользователя
        const avatarOptions = ['👤','😀','😎','🐱','🐶','🦊','🐼','⭐','🎮','⚽','🚀','💎','🌸','🔥','❤️','👍','🎉','🌟','🍕','🏆','🎨','📷','⚡','🔮'];
        const randomAvatar = avatarOptions[Math.floor(Math.random() * avatarOptions.length)];
        const bgOptions = ['gradient1','gradient2','gradient3','gradient4','gradient5','gradient6','gradient7','gradient8','gradient9','gradient10','gradient11'];
        const randomBg = bgOptions[Math.floor(Math.random() * bgOptions.length)];
        const borderOptions = ['standard','gold','neon','none'];
        const randomBorder = borderOptions[Math.floor(Math.random() * borderOptions.length)];
        
        // Генерация уникального реферального кода
        let referralCode = generateReferralCode();
        let existingCode = await window.supabase.from('users').select('referral_code').eq('referral_code', referralCode).maybeSingle();
        while (existingCode.data) {
            referralCode = generateReferralCode();
            existingCode = await window.supabase.from('users').select('referral_code').eq('referral_code', referralCode).maybeSingle();
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
            registered_at: new Date().toISOString()
        }]).select().single();
        if (insertError) throw new Error(`Ошибка вставки: ${insertError.message}`);
        await ensureWelcomeAchievement(window.userId);
        return { user: newUser, isNew: true };
    }
    await ensureWelcomeAchievement(window.userId);
    let updated = false;
    if (!data.selected_achievements) { data.selected_achievements = []; updated = true; }
    if (!data.avatar_url) { data.avatar_url = '👤'; updated = true; }
    if (!data.avatar_bg) { data.avatar_bg = 'gradient1'; updated = true; }
    if (!data.avatar_border) { data.avatar_border = 'standard'; updated = true; }
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
    if (updated) {
        await window.supabase.from('users').update({
            selected_achievements: data.selected_achievements,
            avatar_url: data.avatar_url,
            avatar_bg: data.avatar_bg,
            avatar_border: data.avatar_border,
            referral_code: data.referral_code,
            registered_at: data.registered_at
        }).eq('id', window.userId);
    }
    return { user: data, isNew: false };
};

// ---------------------- Ордера и торги (основные функции) ----------------------
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

// ---------------------- Функция обновления цвета обводки ----------------------
window.updateUserBorder = async function(color) {
    const { error } = await window.supabase.from('users').update({ avatar_border: color }).eq('id', window.userId);
    if (error) throw new Error(error.message);
    if (window.currentUser) window.currentUser.avatar_border = color;
    return true;
};

// ---------------------- Админские и вспомогательные функции ----------------------
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
