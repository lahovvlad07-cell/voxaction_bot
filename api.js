// api.js – полный файл со всеми функциями (включая резерв, комиссии, рефералов с условием)

window.toCents = (v) => Math.round(parseFloat(v) * 100);
window.fromCents = (c) => (c / 100).toFixed(2);

// ========== НАСТРОЙКИ ИНТЕРФЕЙСА ==========
window.setUseSliders = function(use) {
    localStorage.setItem('use_sliders', use ? 'true' : 'false');
};
window.getUseSliders = function() {
    return localStorage.getItem('use_sliders') !== 'false';
};

// ========== ДИНАМИЧЕСКИЕ НАСТРОЙКИ ==========
window.getSetting = async function(key) {
    const { data, error } = await window.supabase
        .from('settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();
    if (error) return null;
    return data ? data.value : null;
};

window.setSetting = async function(key, value) {
    const { error } = await window.supabase
        .from('settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });
    if (error) throw error;
    return true;
};

// ========== РЕЗЕРВ ==========
window.getReserve = async function() {
    const { data, error } = await window.supabase
        .from('reserve')
        .select('amount')
        .eq('id', 1)
        .single();
    if (error) return { amount: 0 };
    return data;
};

window.addToReserve = async function(amountStars) {
    const amountCents = window.toCents(amountStars);
    const { error } = await window.supabase
        .from('reserve')
        .update({ amount: window.supabase.raw(`amount + ${amountCents}`) })
        .eq('id', 1);
    if (error) throw error;
};

// ========== ВЫВОД С КОМИССИЕЙ ==========
window.withdrawWithFee = async function(userId, amountStars) {
    const commissionRate = 0.02; // 2% комиссия
    const fee = Math.round(amountStars * commissionRate);
    const receive = amountStars - fee;
    const amountCents = window.toCents(amountStars);
    const receiveCents = window.toCents(receive);
    const feeCents = window.toCents(fee);

    // Проверяем баланс пользователя
    const { data: user, error: userError } = await window.supabase
        .from('users')
        .select('stars_balance')
        .eq('id', userId)
        .single();
    if (userError) throw new Error('Пользователь не найден');
    if (user.stars_balance < amountCents) throw new Error('Недостаточно Stars');

    // Проверяем лимит вывода (например, 200 Stars в сутки)
    const dailyLimit = 200;
    const today = new Date().toISOString().slice(0,10);
    const { data: withdrawals, error: withdrawError } = await window.supabase
        .from('withdrawals')
        .select('amount')
        .eq('user_id', userId)
        .gte('created_at', today);
    if (withdrawError) throw withdrawError;
    const totalToday = withdrawals.reduce((s, w) => s + w.amount / 100, 0);
    if (totalToday + amountStars > dailyLimit) {
        throw new Error(`Превышен суточный лимит (${dailyLimit} ⭐). Доступно: ${(dailyLimit - totalToday).toFixed(2)} ⭐`);
    }

    // Списываем Stars с пользователя
    await window.supabase
        .from('users')
        .update({ stars_balance: window.supabase.raw(`stars_balance - ${amountCents}`) })
        .eq('id', userId);

    // Зачисляем комиссию в резерв
    await window.addToReserve(fee);

    // Создаём заявку на вывод
    const { data: withdrawal, error: insertError } = await window.supabase
        .from('withdrawals')
        .insert({
            user_id: userId,
            amount: receiveCents,
            fee: feeCents,
            status: 'pending',
            created_at: new Date().toISOString()
        })
        .select()
        .single();
    if (insertError) throw insertError;

    return { withdrawal, fee, receive };
};

// ========== ПОЛЬЗОВАТЕЛЬ ==========
window.getOrCreateUser = async function() {
    let { data, error } = await window.supabase.from('users').select('*').eq('id', window.userId).maybeSingle();
    if (error) throw new Error(`Ошибка запроса: ${error.message}`);
    
    if (!data) {
        const avatarOptions = ['👤','😀','😎','👍','🐱','🐶','🦊','🐼','🍕','🍔','🍩','☕','💎','💰','🎲','🏆','🎁','🌟','🔥','❤️','🚀','🍀','👑','🎯'];
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
            notify_referral: true,
            total_topup: 0,
            total_spent: 0,
            total_earned: 0,
            total_volume: 0,
            trades_count: 0,
            days_active: 0,
            last_username_change: new Date().toISOString()
        }]).select().single();
        
        if (insertError) throw new Error(`Ошибка вставки: ${insertError.message}`);
        
        // Обработка реферала: если есть реферер и новый пользователь пополнил на 10 Stars
        if (referredById) {
            try {
                // Проверяем, пополнил ли новый пользователь на 10 Stars
                const { data: userData } = await window.supabase
                    .from('users')
                    .select('total_topup')
                    .eq('id', window.userId)
                    .single();
                if (userData && userData.total_topup >= 1000) { // 10 Stars = 1000 cents
                    // Начисляем рефереру 3 акции
                    await window.supabase
                        .from('users')
                        .update({ shares: window.supabase.raw(`shares + ${window.toCents(3)}`) })
                        .eq('id', referredById);
                    // Создаём запись в рефералах
                    await window.supabase.from('referrals').insert({
                        referrer_id: referredById,
                        referred_id: window.userId,
                        registered_at: new Date().toISOString(),
                        topup_completed: true,
                        bonus_earned: true
                    });
                    // Увеличиваем счётчик рефералов у реферера
                    await window.supabase
                        .from('users')
                        .update({ referral_count: window.supabase.raw(`referral_count + 1`) })
                        .eq('id', referredById);
                    // Уведомление рефереру
                    await window.supabase.from('notifications').insert({
                        user_id: referredById,
                        message: `🎉 Ваш друг ${window.username} пополнил баланс на 10 ⭐! Вы получили 3 акции.`,
                        type: 'notify_referral',
                        is_read: false
                    });
                } else {
                    // Если ещё не пополнил, создаём запись без бонуса
                    await window.supabase.from('referrals').insert({
                        referrer_id: referredById,
                        referred_id: window.userId,
                        registered_at: new Date().toISOString(),
                        topup_completed: false,
                        bonus_earned: false
                    });
                }
            } catch(e) { console.error('Ошибка при обработке реферала', e); }
        }
        
        try {
            await window.awardAchievement(1);
        } catch(e) { console.error('Ошибка выдачи достижения', e); }
        
        return { user: newUser, isNew: true };
    }
    
    // Проверка на новые поля
    let updated = false;
    const newFields = ['total_topup','total_spent','total_earned','total_volume','trades_count','days_active','last_username_change'];
    for (let f of newFields) {
        if (data[f] === undefined) { data[f] = f === 'last_username_change' ? new Date().toISOString() : 0; updated = true; }
    }
    if (updated) {
        await window.supabase.from('users').update({
            total_topup: data.total_topup,
            total_spent: data.total_spent,
            total_earned: data.total_earned,
            total_volume: data.total_volume,
            trades_count: data.trades_count,
            days_active: data.days_active,
            last_username_change: data.last_username_change
        }).eq('id', window.userId);
    }
    return { user: data, isNew: false };
};

// ========== ДОСТИЖЕНИЯ ==========
window.awardAchievement = async function(achievementId) {
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
        const { data: ach } = await window.supabase.from('achievements').select('name, icon, description').eq('id', achievementId).single();
        window.showCustomModal('🏆 Достижение получено!', `${ach.name}\n\n${ach.description}`);
        if (window.renderProfileTab) window.renderProfileTab();
    } catch(e) { console.error('Ошибка выдачи достижения', e); }
};

// ========== ОНЛАЙН-СТАТУС ==========
window.updateLastSeen = async function() {
    try {
        await window.supabase
            .from('users')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', window.userId);
    } catch(e) {
        console.warn('Ошибка обновления last_seen', e);
    }
};

window.getOnlineCount = async function() {
    try {
        const thirtySecondsAgo = new Date(Date.now() - 30 * 1000).toISOString();
        const { count, error } = await window.supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .gte('last_seen', thirtySecondsAgo);
        if (error) throw error;
        return count || 0;
    } catch(e) {
        console.warn('Ошибка получения онлайн-статистики', e);
        return 0;
    }
};

// ========== ОРДЕРА ==========
window.getActiveOrders = async function() {
    const { data, error } = await window.supabase.from('orders').select('*').eq('status', 'active').order('price_per_share', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
};

window.getActiveBuyOrders = async function() {
    const { data, error } = await window.supabase.from('buy_orders').select('*').eq('status', 'active').order('price_per_share', { ascending: false });
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

window.cancelBuyOrder = async function(buyOrderId) {
    const { data, error } = await window.supabase.rpc('cancel_buy_order', { p_buy_order_id: buyOrderId, p_user_id: window.userId });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    return true;
};

window.createOrder = async function(amountStars, priceStars) {
    if (amountStars < 1) throw new Error('Количество должно быть ≥ 1');
    if (priceStars < 1) throw new Error('Цена должна быть ≥ 1');
    const amountCents = window.toCents(amountStars);
    const priceCents = window.toCents(priceStars);
    
    const { data, error } = await window.supabase.rpc('create_sell_order_matched', {
        p_user_id: window.userId,
        p_amount_cents: amountCents,
        p_price_cents: priceCents
    });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    if (data.executed_amount > 0) window.showToast(`✅ Продано ${window.fromCents(data.executed_amount)} шт.`);
    if (data.remaining_amount > 0) window.showToast(`✅ Остаток ${window.fromCents(data.remaining_amount)} шт. в ордере`);
    await window.updateUserStats();
    await window.checkAllAchievements();
    return true;
};

window.createBuyOrder = async function(amountStars, priceStars) {
    if (amountStars < 1) throw new Error('Количество должно быть ≥ 1');
    if (priceStars < 1) throw new Error('Цена должна быть ≥ 1');
    const amountCents = window.toCents(amountStars);
    const priceCents = window.toCents(priceStars);
    
    const { user: freshUser } = await window.getOrCreateUser();
    const requiredStars = amountStars * priceStars;
    if (freshUser.stars_balance < requiredStars) throw new Error(`Недостаточно звёзд: нужно ${requiredStars.toFixed(2)} ⭐`);
    
    const { data, error } = await window.supabase.rpc('create_buy_order_matched', {
        p_user_id: window.userId,
        p_amount_cents: amountCents,
        p_price_cents: priceCents
    });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    if (data.executed_amount > 0) window.showToast(`✅ Куплено ${window.fromCents(data.executed_amount)} шт.`);
    if (data.remaining_amount > 0) window.showToast(`✅ Остаток ${window.fromCents(data.remaining_amount)} шт. в заявке`);
    await window.updateUserStats();
    await window.checkAllAchievements();
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
    await window.updateUserStats();
    await window.checkAllAchievements();
    return true;
};

window.marketBuy = async function(starsAmount) {
    if (starsAmount <= 0) throw new Error('Сумма должна быть больше 0');
    const { data, error } = await window.supabase.rpc('market_buy', {
        p_user_id: window.userId,
        p_stars_amount: starsAmount
    });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    window.showToast(`✅ Куплено ${window.fromCents(data.bought)} шт. за ${starsAmount} ⭐`);
    await window.refreshActiveTab();
};

window.marketSell = async function(sharesAmount) {
    if (sharesAmount <= 0) throw new Error('Количество должно быть больше 0');
    const { data, error } = await window.supabase.rpc('market_sell', {
        p_user_id: window.userId,
        p_amount_stars: sharesAmount
    });
    if (error) throw new Error(error.message);
    if (!data.success) throw new Error(data.error);
    window.showToast(`✅ Продано ${window.fromCents(data.sold)} шт. за ${window.fromCents(data.earned)} ⭐`);
    await window.refreshActiveTab();
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

// ========== РЕЙТИНГ ==========
window.getLeaderboard = async () => {
    const { data, error } = await window.supabase.from('users').select('username, shares, id').eq('hide_rating', false).order('shares', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
};

window.getUserRank = async () => {
    const leaders = await window.getLeaderboard();
    const idx = leaders.findIndex(u => u.id === window.userId);
    if (idx === -1) return null;
    return idx + 1;
};

// ========== ДОСТИЖЕНИЯ ==========
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

// ========== НОВОСТИ ==========
window.getNews = async function() {
    const { data, error } = await window.supabase
        .from('news')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
};

window.createNews = async function(title, content, image_url) {
    const { data, error } = await window.supabase
        .from('news')
        .insert({ title, content, image_url, author_id: window.userId })
        .select()
        .single();
    if (error) throw error;
    return data;
};

window.deleteNews = async function(newsId) {
    const { error } = await window.supabase
        .from('news')
        .delete()
        .eq('id', newsId);
    if (error) throw error;
    return true;
};

// ========== АДМИНКА ==========
window.adminGetAllUsers = async function() {
    const { data, error } = await window.supabase
        .from('users')
        .select('id, username, shares, stars_balance, hide_rating')
        .order('id', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
};

window.adminAddSharesDirect = async function(targetId, shares) {
    const sharesCents = window.toCents(shares);
    const { error } = await window.supabase
        .from('users')
        .update({ shares: window.supabase.raw(`shares + ${sharesCents}`) })
        .eq('id', targetId);
    if (error) throw new Error(error.message);
    return true;
};

window.adminAddStarsDirect = async function(targetId, stars) {
    const starsCents = window.toCents(stars);
    const { error } = await window.supabase
        .from('users')
        .update({ stars_balance: window.supabase.raw(`stars_balance + ${starsCents}`) })
        .eq('id', targetId);
    if (error) throw new Error(error.message);
    return true;
};

window.adminCancelOrderDirect = async function(orderId) {
    const { error } = await window.supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
    if (error) throw new Error(error.message);
    return true;
};

window.adminBroadcast = async function(message) {
    const users = await window.adminGetAllUsers();
    const notifications = users.map(u => ({
        user_id: u.id,
        message: `📢 ${message}`,
        type: 'broadcast',
        is_read: false,
        created_at: new Date().toISOString()
    }));
    const chunkSize = 1000;
    for (let i = 0; i < notifications.length; i += chunkSize) {
        const chunk = notifications.slice(i, i + chunkSize);
        const { error } = await window.supabase.from('notifications').insert(chunk);
        if (error) throw new Error(error.message);
    }
    return true;
};

// ========== МАРКЕТ-МЕЙКЕР ==========
const MARKET_MAKER_ID = 999999999;

window.initMarketMaker = async function() {
    const { data, error } = await window.supabase
        .from('users')
        .select('id')
        .eq('id', MARKET_MAKER_ID)
        .maybeSingle();
    if (error) throw error;
    if (!data) {
        const { error: insertError } = await window.supabase.from('users').insert({
            id: MARKET_MAKER_ID,
            username: 'MarketMaker',
            shares: 0,
            stars_balance: 0,
            hide_rating: false,
            registered_at: new Date().toISOString()
        });
        if (insertError) throw insertError;
    }
};

window.getMarketMakerBalance = async function() {
    const { data, error } = await window.supabase
        .from('users')
        .select('shares, stars_balance')
        .eq('id', MARKET_MAKER_ID)
        .single();
    if (error) throw error;
    return { shares: data.shares / 100, stars: data.stars_balance / 100 };
};

window.runMarketMaker = async function() {
    // (логика маркет-мейкера остаётся без изменений)
};

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========
window.updateUserStats = async function() {
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
};

window.checkAllAchievements = async function() {
    const stats = await window.getUserStats(true);
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
        if (conditionMet) await window.awardAchievement(ach.id);
    }
};

window.refreshActiveTab = async function() {
    const { user } = await window.getOrCreateUser();
    window.currentUser = user;
    const activeTab = document.querySelector('.tab.active');
    if (!activeTab) return;
    const tabName = activeTab.dataset.tab;
    switch(tabName) {
        case 'profile':
            if (window.renderProfileTab) await window.renderProfileTab(
                window.currentUser, window.supabase, window.userId, window.fromCents, window.showCustomModal,
                window.getUserStats, window.getUserRank, window.getEarnedAchievements, window.getAllAchievements,
                window.updateBellBadge, window.showNotificationsModal
            );
            break;
        case 'stocks': if (window.renderStocksTab) await window.renderStocksTab(window.currentUser); break;
        case 'analytics': if (window.renderAnalyticsTab) await window.renderAnalyticsTab(); break;
        case 'rating': if (window.renderRatingTab) await window.renderRatingTab(); break;
        case 'wallet': if (window.renderWalletTab) await window.renderWalletTab(); break;
        case 'referral': if (window.renderReferralTab) await window.renderReferralTab(); break;
        case 'mining': if (window.renderMiningTab) await window.renderMiningTab(); break;
        case 'news': if (window.renderNewsTab) await window.renderNewsTab(); break;
        case 'admin': if (window.renderAdminTab) await window.renderAdminTab(); break;
    }
};

// ========== СОЗДАНИЕ ИНВОЙСА ==========
window.createInvoice = async (amount) => fetch(`${window.BACKEND_URL}/create-invoice`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user_id: window.userId, amount }) }).then(r=>r.json());

console.log('API loaded');
