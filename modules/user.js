// modules/user.js

import { supabase } from './supabaseClient.js';
import { userId, username } from './config.js';
import { ensureWelcomeAchievement } from './achievements.js';

export let currentUser = null;

export function setCurrentUser(user) {
    currentUser = user;
}

// Получить или создать пользователя в Supabase
export async function getOrCreateUser() {
    let { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

    if (error) throw new Error(`Ошибка запроса: ${error.message}`);

    if (!data) {
        const { data: newUser, error: insertError } = await supabase
            .from('users')
            .insert([{
                id: userId,
                username,
                shares: 0,
                stars_balance: 0,
                selected_achievements: [],
                avatar_url: '👤',
                avatar_bg: 'gradient1',
                registered_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (insertError) throw new Error(`Ошибка вставки: ${insertError.message}`);
        await ensureWelcomeAchievement(userId);
        return { user: newUser, isNew: true };
    }

    // Обновление недостающих полей (миграция)
    await ensureWelcomeAchievement(userId);
    let updated = false;
    if (!data.selected_achievements) {
        data.selected_achievements = [];
        updated = true;
    }
    if (!data.avatar_url) {
        data.avatar_url = '👤';
        updated = true;
    }
    if (!data.avatar_bg) {
        data.avatar_bg = 'gradient1';
        updated = true;
    }
    if (!data.registered_at) {
        data.registered_at = new Date().toISOString();
        updated = true;
    }
    if (updated) {
        await supabase.from('users').update({
            selected_achievements: data.selected_achievements,
            avatar_url: data.avatar_url,
            avatar_bg: data.avatar_bg,
            registered_at: data.registered_at
        }).eq('id', userId);
    }
    return { user: data, isNew: false };
}

// Обновить несколько полей пользователя
export async function updateUser(updates) {
    const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId);
    if (error) throw new Error(error.message);
    // Обновляем локального currentUser
    if (currentUser) {
        Object.assign(currentUser, updates);
    }
}

// Обновить одно поле
export async function updateUserField(field, value) {
    await updateUser({ [field]: value });
}