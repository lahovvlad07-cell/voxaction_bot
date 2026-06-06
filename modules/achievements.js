// modules/achievements.js

import { supabase } from './supabaseClient.js';
import { showCustomModal } from './utils.js';
import { getAllAchievements, getEarnedAchievements, getUserStats } from './api.js';
import { currentUser } from './user.js';

// Выдача достижения "Первый шаг" при регистрации
export async function ensureWelcomeAchievement(userId) {
    try {
        const { data: achData } = await supabase
            .from('achievements')
            .select('id')
            .eq('name', '🌟 Первый шаг')
            .maybeSingle();
        if (!achData) return;
        const { data: existing } = await supabase
            .from('user_achievements')
            .select('achievement_id')
            .eq('user_id', userId)
            .eq('achievement_id', achData.id)
            .maybeSingle();
        if (!existing) {
            await supabase.from('user_achievements').insert({
                user_id: userId,
                achievement_id: achData.id,
                earned_at: new Date().toISOString()
            });
        }
    } catch (e) {
        console.error(e);
    }
}

// Выдача достижения за выбор аватарки/фона (Стилист)
export async function awardAvatarAchievement() {
    try {
        const { data: achData } = await supabase
            .from('achievements')
            .select('id')
            .eq('name', '🎨 Стилист')
            .single();
        if (!achData) return;
        const { data: existing } = await supabase
            .from('user_achievements')
            .select('achievement_id')
            .eq('user_id', userId)
            .eq('achievement_id', achData.id)
            .maybeSingle();
        if (!existing) {
            await supabase.from('user_achievements').insert({
                user_id: userId,
                achievement_id: achData.id,
                earned_at: new Date().toISOString()
            });
            showCustomModal('🎉 Новое достижение!', 'Вы получили достижение "🎨 Стилист" за выбор аватарки или фона!');
        }
    } catch (e) {
        console.error(e);
    }
}

// Получить прогресс по следующим (незаработанным) достижениям (макс. 3)
export async function getNextAchievementsProgress(userId, userData) {
    const allAchievements = await getAllAchievements();
    const earned = await getEarnedAchievements(userId);
    const earnedIds = new Set(earned.map(a => a.id));
    const ignoreNames = ['🌟 Первый шаг', '🎨 Стилист', '✅ Абсолютный чемпион'];
    const notEarned = allAchievements.filter(a => !earnedIds.has(a.id) && !ignoreNames.includes(a.name));
    if (notEarned.length === 0) return [];

    const tradesCount = (await getUserStats()).totalTrades;
    const sharesCents = userData.shares;
    const referralsCount = userData.referral_count || 0;
    const totalTopupCents = userData.total_topup || 0;

    const nextAchievements = [];
    for (let ach of notEarned) {
        let current = 0, needed = ach.condition_value;
        switch (ach.condition_type) {
            case 'trades_count': current = tradesCount; break;
            case 'shares_held': current = sharesCents; break;
            case 'referrals_count': current = referralsCount; break;
            case 'total_topup': current = totalTopupCents; break;
            default: continue;
        }
        if (current < needed) {
            nextAchievements.push({
                ...ach,
                current,
                needed,
                progress: Math.min(100, (current / needed) * 100)
            });
        }
        if (nextAchievements.length >= 3) break;
    }
    return nextAchievements;
}