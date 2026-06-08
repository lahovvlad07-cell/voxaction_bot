// api.js – финальная версия (все функции, включая get24hAvgPrice)
window.toCents = (v) => Math.round(parseFloat(v) * 100);
window.fromCents = (c) => (c / 100).toFixed(2);

// ========== ВЫДАЧА ДОСТИЖЕНИЙ (МОДАЛЬНОЕ ОКНО) ==========
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
        const { data: ach } = await window.supabase.from('achievements').select('name, icon, description').eq('id', achievementId).single();
        if (window.showCustomModal) {
            window.showCustomModal(`🏆 Новое достижение!`, `${ach.icon} ${ach.name}\n\n${ach.description}`);
        } else {
            alert(`🏆 Достижение: ${ach.icon} ${ach.name}`);
        }
        if (window.renderProfileTab) window.renderProfileTab();
    } catch(e) { console.error('Ошибка выдачи достижения', e); }
}

async function checkAllAchievements() {
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
        
        if (referredById) {
            try {
                await window.supabase.from('users').update({ stars_balance: 500 }).eq('id', window.userId);
                await window.supabase.from('referrals').insert({
                    referrer_id: referredById,
                    referred_id: window.userId,
                    registered_at: new Date().toISOString(),
                    topup_completed: false,
                    bonus_earned: false
                });
                await window.supabase.from('users').update({ referral_count: window.supabase.raw('referral_count + 1') }).eq('id', referredById);
                await window.supabase.from('notifications').insert({
                    user_id: referredById,
                    message: `🎉 Новый реферал! ${window.username} зарегистрировался по вашей ссылке.`,
                    type: 'notify_referral',
                    is_read: false
                });
            } catch(e) { console.error('Ошибка при обработке реферала', e); }
        }
        
        try {
            await awardAchievement(1);
        } catch(e) { console.error('Ошибка выдачи достижения', e); }
        
        return { user: newUser, isNew: true };
    }
    
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

// ========== СМЕНА НИКНЕЙМА (РАСШИРЕННАЯ ФИЛЬТРАЦИЯ) ==========
window.updateUsername = async function(newUsername) {
    if (!newUsername || newUsername.trim().length < 3) {
        throw new Error('Никнейм должен содержать минимум 3 символа');
    }
    if (newUsername.length > 20) {
        throw new Error('Никнейм не может быть длиннее 20 символов');
    }
    if (!/^[a-zA-Z0-9_-]+$/.test(newUsername)) {
        throw new Error('Никнейм может содержать только латинские буквы, цифры, _ и -');
    }

    let normalized = newUsername.toLowerCase();
    normalized = normalized.replace(/0/g, 'o').replace(/1/g, 'i').replace(/2/g, 'z').replace(/3/g, 'e')
        .replace(/4/g, 'a').replace(/5/g, 's').replace(/6/g, 'g').replace(/7/g, 't')
        .replace(/8/g, 'b').replace(/9/g, 'g').replace(/\$/g, 's').replace(/@/g, 'a').replace(/\+/g, 't');

    const forbiddenWords = [
        'blya','blyat','ebat','ebal','ebuch','eblan','pizda','pizdec','pizduk','huy','huylo','hueta','huinya',
        'pidor','pidaras','pidr','pedik','pedal','gondon','gandon','mudak','mudilo','mudack','mudozvon','svoloch',
        'suka','sukin','sukablya','tvar','tvarina','gnida','gnilida','shluha','shluh','prostitutka','kurva','kuryok',
        'kurok','lopuh','loh','lox','loch','chmo','chmok','chmonya','olen','baran','kozel','svinya','petuh','durak',
        'duren','dolboeb','dolbaeb','dolboyob','dolboyeb','rak','rakovina','zhopa','zhopnik','zadnica','shmarovoz',
        'shmaruhoz','pischa','pizd','piz','pizdets','huyak','huyata','khuy','khui','khnya','hnya','yob','yoba','yoban',
        'yobat','yobt','yop','yopt','yopta','perehot','perehod','nahuy','nahui','pohuy','pohui','huyovo','huyota','huil',
        'huilo','huilam','huilom','gavno','govno','gavnyuk','govnuk','srat','srano','sral','srak','srach','zrit','zral',
        'zralnya','peder','pederast','pederasty','pedofil','pedo','pedophile','incest','insest','inkest','nympho','nymphoman',
        'zoophile','zoophil','bestial','bestiality','perv','pervert','izvrash','izvraschen','sodom','sodomit','sodomite','bugger',
        'fuck','fucking','fucker','fuk','fuq','fkc','phuck','fcuk','shet','sht','shat','shit','shitting','shitty','shite',
        'bullshit','horseshit','bitch','bitching','bitches','bich','bch','btch','cunt','cunting','cunts','kunt','dick',
        'dickhead','dickweed','dickhole','dickface','dicknose','diq','dyck','pussy','pusy','puss','pussie','puzi',
        'nigger','nigga','niggar','niga','niger','neger','nig','nigg','faggot','fag','fagg','fagot','fagit','faget',
        'faggo','fagga','retard','retarded','retart','retad','retrd','moron','moronic','stupid','stoopid','dumbass',
        'dumass','dumb','dum','whore','whoring','hoar','hore','ho','slut','slutty','slutt','bastard','bastrd','bastid',
        'wanker','wank','wanksta','twat','twatted','twatface','cock','cocksucker','cocksuk','coksucker','motherfucker',
        'mothafucka','muthafucka','motherfuck','mofo','douchebag','douche','douch','shithead','shitbag','shitface','fuckface',
        'asshole','asswipe','asshat','assface','assole','ass','arse','arsehole','arsewipe','bollocks','balls','ballbag','dickweed',
        'dicknose','prick','prk','prickhead','turd','turdman','turdburglar','crap','crappy','crapface','piss','pissed','pisser',
        'pissface','screw','screwed','screwup','loser','noob','noobish','churka','churkan','hach','hachik','khach','khachik',
        'niger','nigeria','negro','nigerian','arab','arap','arapka','zhid','zhidov','zhidovsk','jew','jewish','kike','gypsy',
        'cygan','cyganka','tsygan','tsyganok','tsyg','mongol','mongoloid','viet','vietcong','kambodzha','kambodzhec','kambodzhe',
        'kambodz','amerikos','pindos','pendos','libeh','liberal','liberast','homik','homo','homosek','homosexual','gay','gey',
        'lesba','lesbian','trany','transvestite','tranny','gender','genderqueer','feminist','femik','femi','siyons','siyona',
        'siyonsk','sion','sionist','nazi','hitler','fascist','fashist','fash','stalin','lenin','kommunist','communist','soviet',
        'sovok','sovkov','sovetsk','rusnya','russkie','katsap','kacap','ukrop','ukri','ukrov','hohol','hohly','hohl','banderlog',
        'bandera','pnk','pnx','ebal','ebra','ebre','ebrei','evrei','evrey','zhyd','jood','joop','joden','natsik','natsi','nazik',
        'gestapo','gepapo','schutz','ss','waffen','fat','fatass','faty','fatto','tolst','tolsy','tolsty','thick','thickass','pig',
        'piggy','swine','cow','cowy','cowlike','obese','obez','obezn','ugly','ugli','uglyface','uglo','zombie','zombi','mutant',
        'freak','freaks','abomination','ugliness','uglification','weak','weakling','spineless','faint','faintheart','fail','failure'
    ];

    for (let word of forbiddenWords) {
        if (normalized.includes(word)) {
            throw new Error('Никнейм содержит запрещённые слова');
        }
    }

    const russianBad = /(хуй|хyi|хyй|пидор|пидр|пидар|гандон|шлюха|ебат|ебал|пизд|сука|бля|бляд|даун|дебил|лох|мудак|долбоеб|чмо|олень|козел|свинья|петух|рaк|урод|сволочь|тварь|гнида)/i;
    if (russianBad.test(newUsername)) {
        throw new Error('Никнейм содержит запрещённые символы');
    }

    const { data: user } = await window.supabase
        .from('users')
        .select('username')
        .eq('id', window.userId)
        .single();
    if (!user) throw new Error('Пользователь не найден');
    if (user.username === newUsername) {
        return { success: true, message: 'Никнейм не изменён' };
    }

    const { error } = await window.supabase
        .from('users')
        .update({ username: newUsername, last_username_change: new Date().toISOString() })
        .eq('id', window.userId);
    if (error) throw new Error(error.message);

    if (window.currentUser) window.currentUser.username = newUsername;
    return { success: true, message: 'Никнейм успешно изменён!' };
};

// ========== ОБНОВЛЕНИЕ ТЕКУЩЕЙ ВКЛАДКИ (ДЛЯ РЕАЛЬНОГО ВРЕМЕНИ) ==========
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
        case 'stocks':
            if (window.renderStocksTab) await window.renderStocksTab(window.currentUser);
            break;
        case 'analytics':
            if (window.renderAnalyticsTab) await window.renderAnalyticsTab();
            break;
        case 'rating':
            if (window.renderRatingTab) await window.renderRatingTab();
            break;
        case 'wallet':
            if (window.renderWalletTab) await window.renderWalletTab();
            break;
        case 'referral':
            if (window.renderReferralTab) await window.renderReferralTab();
            break;
        case 'admin':
            if (window.renderAdminTab) await window.renderAdminTab();
            break;
    }
};

// ========== СРЕДНЕВЗВЕШЕННАЯ ЦЕНА ЗА 24 ЧАСА ==========
window.get24hAvgPrice = async function() {
    const oneDayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data, error } = await window.supabase
        .from('trades')
        .select('amount, price_per_share')
        .gte('created_at', oneDayAgo);
    if (error || !data || data.length === 0) return 0;
    let totalAmount = 0, totalStars = 0;
    for (let t of data) {
        totalAmount += t.amount;
        totalStars += t.amount * t.price_per_share;
    }
    return totalAmount ? totalStars / totalAmount / 100 : 0;
};

// ========== ИСТОРИЯ ЗАВЕРШЁННЫХ ОРДЕРОВ (опционально, но в stocks.js уже есть) ==========
window.getCompletedOrders = async function(limit = 10) {
    const { data, error } = await window.supabase
        .from('orders')
        .select('*')
        .eq('seller_id', window.userId)
        .in('status', ['completed', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw new Error(error.message);
    return data || [];
};

// ========== ОРДЕРА И СДЕЛКИ ==========
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

// ========== РЕЙТИНГ И ДОСТИЖЕНИЯ ==========
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

// ========== КАСТОМИЗАЦИЯ ==========
window.updateUserBorder = async (color) => {
    const { error } = await window.supabase.from('users').update({ avatar_border: color }).eq('id', window.userId);
    if (error) throw new Error(error.message);
    if (window.currentUser) window.currentUser.avatar_border = color;
    return true;
};

// ========== АДМИНКА ==========
window.adminFetchStats = async () => fetch(`${window.BACKEND_URL}/admin/stats`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId }) }).then(r=>r.json());
window.adminFetchUsers = async () => fetch(`${window.BACKEND_URL}/admin/users`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId }) }).then(r=>r.json());
window.adminCancelOrder = async (orderId) => fetch(`${window.BACKEND_URL}/admin/cancel-order`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId, order_id: orderId }) }).then(r=>r.json());
window.adminAddShares = async (targetId, shares) => fetch(`${window.BACKEND_URL}/admin/add-shares`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId, target_id: targetId, shares }) }).then(r=>r.json());
window.adminAddStars = async (targetId, stars) => fetch(`${window.BACKEND_URL}/admin/add-stars`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ admin_id: window.userId, target_id: targetId, stars }) }).then(r=>r.json());
window.createInvoice = async (amount) => fetch(`${window.BACKEND_URL}/create-invoice`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ user_id: window.userId, amount }) }).then(r=>r.json());

// ========== РЕФЕРАЛЫ ==========
window.getReferralsList = async function() {
    const { data, error } = await window.supabase
        .from('referrals')
        .select(`referred_id, registered_at, topup_completed, topup_amount_cents, bonus_earned, users:referred_id (username, avatar_url, id)`)
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

window.claimReferralBonus = async (friendsNeeded, stars) => {
    const response = await fetch(`${window.BACKEND_URL}/claim-referral-bonus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: window.userId, friends_needed: friendsNeeded, stars: stars })
    });
    return response.json();
};

// ========== ПРОСМОТР ПРОФИЛЕЙ ДРУГИХ ПОЛЬЗОВАТЕЛЕЙ ==========
window.getEarnedAchievementsForUser = async (userId) => {
    const { data, error } = await window.supabase
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
};

window.getUserStatsForUser = async (userId) => {
    const { data, error } = await window.supabase
        .from('trades')
        .select('amount, total_stars')
        .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`);
    if (error) return { totalTrades: 0, totalVolume: 0 };
    return {
        totalTrades: data.length,
        totalVolume: data.reduce((s,t) => s + t.total_stars/100, 0)
    };
};

window.getUserRankForUser = async (userId) => {
    const { data, error } = await window.supabase
        .from('users')
        .select('id, shares')
        .eq('hide_rating', false)
        .order('shares', { ascending: false });
    if (error) return null;
    const idx = data.findIndex(u => u.id === userId);
    if (idx === -1) return null;
    return idx + 1;
};

// ========== РЕНДЕР МИНИ-АВАТАРА ==========
window.renderAvatarHtml = function(avatarUrl, avatarBg, avatarBorder, size = '52px') {
    let bgColor = avatarBg;
    if (avatarBg && !avatarBg.startsWith('#')) {
        const mapping = {
            'gradient1': '#2b6e9e', 'gradient2': '#9b59b6', 'gradient3': '#e67e22',
            'gradient4': '#27ae60', 'gradient5': '#f1c40f', 'gradient6': '#e74c3c',
            'gradient7': '#1abc9c', 'gradient8': '#3498db', 'gradient9': '#2c3e50',
            'gradient10': '#ff9a9e', 'gradient11': '#a18cd1'
        };
        bgColor = mapping[avatarBg] || '#2b6e9e';
    } else if (!avatarBg) {
        bgColor = '#2b6e9e';
    }
    const borderColor = avatarBorder || '#ffffff';
    const emoji = avatarUrl || '👤';
    let fontSize = '32px';
    if (size === '52px') fontSize = '32px';
    else if (size === '40px') fontSize = '24px';
    else if (size === '36px') fontSize = '22px';
    else fontSize = `calc(${size} * 0.6)`;
    return `<div class="mini-avatar" style="width:${size}; height:${size}; background:${bgColor}; border:2px solid ${borderColor}; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:${fontSize}; box-shadow:0 2px 6px rgba(0,0,0,0.3); flex-shrink:0;"><span>${emoji}</span></div>`;
};
