// common.js – общие функции для всего приложения

const SUPABASE_URL = "https://gsutnhhklidxmewdkcvk.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzdXRuaGhrbGlkeG1ld2RrY3ZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NzA2MTEsImV4cCI6MjA5NjE0NjYxMX0.XEtyJVT0BfmEgAAsGagPHRdHhmCgrtWEbtzov0c3EXc";
const BACKEND_URL = 'https://voxaction-bot-main.onrender.com'; // ЗАМЕНИТЕ НА ВАШ URL

window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
window.BACKEND_URL = BACKEND_URL;

// Конвертеры
window.toCents = (v) => Math.round(parseFloat(v) * 100);
window.fromCents = (c) => (c / 100).toFixed(2);

// Кастомное модальное окно
window.showModal = (title, msg) => {
    const html = `<div class="modal" style="display:flex;"><div class="modal-content"><span class="close-modal">&times;</span><h3>${title}</h3><p style="margin:20px 0;text-align:center">${msg}</p><button id="modalOk">OK</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const m = document.body.lastElementChild;
    m.querySelector('.close-modal').onclick = () => m.remove();
    m.querySelector('#modalOk').onclick = () => m.remove();
};

// Уведомление (тост)
window.showToast = (msg) => {
    const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 5000);
};

// ----- Пользователь и достижения -----
async function getOrCreateUser() {
    let { data, error } = await window.supabase.from('users').select('*').eq('id', window.userId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) {
        const { data: newUser, error: insErr } = await window.supabase.from('users').insert([{
            id: window.userId, username: window.username, shares: 0, stars_balance: 0, selected_achievements: [],
            avatar_url: '👤', avatar_bg: 'gradient1', registered_at: new Date().toISOString()
        }]).select().single();
        if (insErr) throw new Error(insErr.message);
        const { data: welcome } = await window.supabase.from('achievements').select('id').eq('name', '🌟 Первый шаг').maybeSingle();
        if (welcome) {
            await window.supabase.from('user_achievements').insert({ user_id: window.userId, achievement_id: welcome.id, earned_at: new Date().toISOString() });
        }
        return { user: newUser, isNew: true };
    }
    if (!data.selected_achievements) data.selected_achievements = [];
    if (!data.avatar_url) data.avatar_url = '👤';
    if (!data.avatar_bg) data.avatar_bg = 'gradient1';
    if (!data.registered_at) {
        await window.supabase.from('users').update({ registered_at: new Date().toISOString() }).eq('id', window.userId);
        data.registered_at = new Date().toISOString();
    }
    return { user: data, isNew: false };
}
window.getOrCreateUser = getOrCreateUser;

async function getEarnedAchievements() {
    const { data } = await window.supabase.from('user_achievements').select('achievement_id, earned_at, achievements(*)').eq('user_id', window.userId);
    if (!data) return [];
    const unique = new Map();
    for (const ua of data) {
        if (!unique.has(ua.achievement_id)) {
            unique.set(ua.achievement_id, { ...ua.achievements, earned_at: ua.earned_at });
        }
    }
    return Array.from(unique.values());
}
window.getEarnedAchievements = getEarnedAchievements;

async function getAllAchievements() {
    const { data } = await window.supabase.from('achievements').select('*');
    return data || [];
}
window.getAllAchievements = getAllAchievements;

async function getUserStats() {
    const { data } = await window.supabase.from('trades').select('amount, total_stars').or(`seller_id.eq.${window.userId},buyer_id.eq.${window.userId}`);
    if (!data) return { totalTrades: 0, totalVolume: 0 };
    return { totalTrades: data.length, totalVolume: data.reduce((s,t) => s + t.total_stars/100, 0) };
}
window.getUserStats = getUserStats;

async function getLeaderboard() {
    const { data } = await window.supabase.from('users').select('username, shares, id').eq('hide_rating', false).order('shares', { ascending: false });
    return data || [];
}
window.getLeaderboard = getLeaderboard;

async function getUserRank() {
    const leaders = await getLeaderboard();
    const idx = leaders.findIndex(u => u.id === window.userId);
    return idx !== -1 ? idx + 1 : null;
}
window.getUserRank = getUserRank;

async function getNextProgress() {
    const all = await getAllAchievements();
    const earned = await getEarnedAchievements();
    const earnedIds = new Set(earned.map(a => a.id));
    const ignore = ['🌟 Первый шаг', '🎨 Стилист', '✅ Абсолютный чемпион'];
    const notEarned = all.filter(a => !earnedIds.has(a.id) && !ignore.includes(a.name));
    if (!notEarned.length) return [];
    const stats = await getUserStats();
    const trades = stats.totalTrades;
    const shares = window.currentUser.shares;
    const refs = window.currentUser.referral_count || 0;
    const topup = window.currentUser.total_topup || 0;
    const next = [];
    for (let ach of notEarned) {
        let cur = 0, need = ach.condition_value;
        switch (ach.condition_type) {
            case 'trades_count': cur = trades; break;
            case 'shares_held': cur = shares; break;
            case 'referrals_count': cur = refs; break;
            case 'total_topup': cur = topup; break;
            default: continue;
        }
        if (cur < need) {
            next.push({ ...ach, cur, need, prog: Math.min(100, (cur / need) * 100) });
        }
        if (next.length >= 3) break;
    }
    return next;
}
window.getNextProgress = getNextProgress;

// ----- Аватарки и фон -----
const avatars = ['👤','😀','😎','🐱','🐶','🦊','🐼','⭐','🎮','⚽','🚀','💎','🌸','🔥','❤️','👍','🎉','🌟','🍕','🏆','🎨','📷','⚡','🔮'];
const adj = { '🐱':-8,'🐶':-8,'🐼':-7,'🦊':-5,'⚽':-3,'💎':-3,'🌸':-3,'🔥':-3,'🎉':-3,'🌟':-3,'🍕':-3,'🏆':-3,'🎨':-3,'📷':-3,'⚡':-3,'🔮':-3,'🚀':-3,'🎮':-3 };
const fontSize = { '⚡':'56px','🔮':'56px','🎮':'56px','🚀':'56px','⭐':'56px','🌟':'56px','🔥':'56px','💎':'56px','🎉':'56px','⚽':'56px','📷':'56px','🎨':'56px' };
window.getAvatarStyle = (emoji) => {
    const adjust = adj[emoji] || 0;
    const fs = fontSize[emoji] || '48px';
    return `transform: translateY(${adjust}px); font-size: ${fs};`;
};
const bgOptions = [
    { id:'gradient1', class:'bg-gradient1' },{ id:'gradient2', class:'bg-gradient2' },{ id:'gradient3', class:'bg-gradient3' },
    { id:'gradient4', class:'bg-gradient4' },{ id:'gradient5', class:'bg-gradient5' },{ id:'gradient6', class:'bg-gradient6' },
    { id:'gradient7', class:'bg-gradient7' },{ id:'gradient8', class:'bg-gradient8' },{ id:'gradient9', class:'bg-gradient9' },
    { id:'gradient10', class:'bg-gradient10' },{ id:'gradient11', class:'bg-gradient11' },{ id:'custom', name:'Свой цвет' }
];
window.bgOptions = bgOptions;

// ----- Уведомления (Realtime) -----
let notifChan = null;
async function getUnreadCount() {
    const { count } = await window.supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', window.userId).eq('is_read', false);
    return count || 0;
}
window.getUnreadCount = getUnreadCount;

async function updateBellBadge() {
    const badge = document.querySelector('.notification-badge');
    if (badge) {
        const unread = await getUnreadCount();
        if (unread > 0) { badge.textContent = unread > 9 ? '9+' : unread; badge.style.display = 'flex'; }
        else badge.style.display = 'none';
    }
}
window.updateBellBadge = updateBellBadge;

function setupRealtime() {
    if (notifChan) return;
    notifChan = window.supabase.channel('notif').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${window.userId}` }, payload => {
        window.showToast(`🔔 ${payload.new.message}`);
        updateBellBadge();
    }).subscribe();
}
window.setupRealtime = setupRealtime;

async function showNotificationsModal() {
    const { data } = await window.supabase.from('notifications').select('*').eq('user_id', window.userId).order('created_at', { ascending: false });
    if (!data || !data.length) { window.showModal('Уведомления', 'Нет уведомлений'); return; }
    const list = data.map(n => `<div class="notification-item ${!n.is_read ? 'unread' : ''}" style="padding:12px;border-bottom:1px solid rgba(255,255,255,.1);display:flex;justify-content:space-between"><span>${n.message}</span><span class="small-text">${new Date(n.created_at).toLocaleString()}</span><button class="mark-read" data-id="${n.id}" style="background:none;border:none;color:#9ca3af">✓</button></div>`).join('');
    window.showModal('🔔 Уведомления', `<div style="max-height:400px;overflow-y:auto">${list}</div>`);
    document.querySelectorAll('.mark-read').forEach(btn => btn.addEventListener('click', async () => {
        await window.supabase.from('notifications').update({ is_read: true }).eq('id', parseInt(btn.dataset.id));
        showNotificationsModal();
    }));
}
window.showNotificationsModal = showNotificationsModal;

// ----- Функции для модалки выбора достижений -----
window.openAchievementSelector = async (slot, earned, selectedIds, curId) => {
    if (!earned.length) { window.showModal('Достижения', 'У вас пока нет достижений'); return; }
    const other = selectedIds.filter((_,i) => i !== slot);
    const grid = earned.map(ach => {
        const isSel = (curId === ach.id);
        const disabled = other.includes(ach.id);
        return `<div class="achievement-card ${isSel?'selected':''} ${disabled?'disabled':''}" data-id="${ach.id}" style="background:rgba(0,0,0,.3);border-radius:18px;padding:10px;text-align:center;cursor:pointer;border:1px solid transparent;${disabled?'opacity:0.4':''}"><div class="achievement-icon" style="font-size:28px">${ach.icon}</div><div class="achievement-name" style="font-weight:600;font-size:13px">${ach.name}</div><div class="achievement-desc" style="font-size:10px;color:#9ca3af">${ach.description}</div><div class="achievement-date" style="font-size:10px;color:#9ca3af">🏅 Получено: ${new Date(ach.earned_at).toLocaleString()}</div></div>`;
    }).join('');
    const html = `<div class="modal" style="display:flex"><div class="modal-content"><span class="close-modal">&times;</span><h3>Выберите достижение для слота ${slot+1}</h3><div class="achievements-grid" style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:16px 0">${grid}</div>${curId ? '<button id="clearSlot" class="secondary">🗑️ Очистить слот</button>' : ''}<button id="saveSlot">Сохранить</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const m = document.body.lastElementChild;
    m.querySelector('.close-modal').onclick = () => m.remove();
    if (curId) m.querySelector('#clearSlot').onclick = async () => {
        let newSel = [...selectedIds];
        newSel[slot] = null;
        newSel = newSel.filter(v => v !== null);
        await window.supabase.from('users').update({ selected_achievements: newSel }).eq('id', window.userId);
        window.currentUser.selected_achievements = newSel;
        m.remove();
        await window.renderProfile();
    };
    m.querySelector('#saveSlot').onclick = async () => {
        const selected = m.querySelector('.achievement-card.selected:not(.disabled)');
        let newSel = [...selectedIds];
        if (selected) newSel[slot] = parseInt(selected.dataset.id);
        newSel = newSel.filter(v => v !== null && v !== undefined);
        await window.supabase.from('users').update({ selected_achievements: newSel }).eq('id', window.userId);
        window.currentUser.selected_achievements = newSel;
        m.remove();
        await window.renderProfile();
    };
    m.querySelectorAll('.achievement-card').forEach(card => {
        card.addEventListener('click', () => {
            if (card.classList.contains('disabled')) { window.showModal('Недоступно', 'Это достижение уже используется в другом слоте'); return; }
            m.querySelectorAll('.achievement-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });
};

// ----- Аватарка и фон (модалки) -----
window.openAvatar = async () => {
    const cur = window.currentUser.avatar_url || '👤';
    const opts = avatars.map(e => `<div class="avatar-option ${e===cur?'selected':''}" data-avatar="${e}"><span class="avatar-emoji" style="${window.getAvatarStyle(e)}">${e}</span></div>`).join('');
    const html = `<div class="modal" style="display:flex"><div class="modal-content"><span class="close-modal">&times;</span><h3>Выберите аватар</h3><div class="avatars-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0">${opts}</div><button id="nextBgBtn">Далее → выбор фона</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const m = document.body.lastElementChild;
    m.querySelector('.close-modal').onclick = () => m.remove();
    let selected = cur;
    m.querySelectorAll('.avatar-option').forEach(opt => opt.addEventListener('click', () => {
        m.querySelectorAll('.avatar-option').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selected = opt.dataset.avatar;
    }));
    m.querySelector('#nextBgBtn').onclick = async () => {
        await window.supabase.from('users').update({ avatar_url: selected }).eq('id', window.userId);
        window.currentUser.avatar_url = selected;
        m.remove();
        await window.openBg();
        await window.awardStylist();
    };
};
window.openBg = async () => {
    const cur = window.currentUser.avatar_bg || 'gradient1';
    const opts = bgOptions.map(b => {
        if (b.id !== 'custom') return `<div class="bg-option ${b.class} ${cur===b.id?'selected':''}" data-bg="${b.id}"></div>`;
        else return `<div class="custom-color-preview ${cur.startsWith('#')?'selected':''}" data-bg="custom" style="background:${cur.startsWith('#')?cur:'#2b6e9e'}">🎨</div>`;
    }).join('');
    const html = `<div class="modal" style="display:flex"><div class="modal-content"><span class="close-modal">&times;</span><h3>Выберите фон аватарки</h3><div class="bg-grid" style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0">${opts}</div><button id="saveBgBtn">Сохранить</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    const m = document.body.lastElementChild;
    m.querySelector('.close-modal').onclick = () => m.remove();
    let selected = cur;
    m.querySelectorAll('.bg-option').forEach(opt => opt.addEventListener('click', () => {
        m.querySelectorAll('.bg-option, .custom-color-preview').forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        selected = opt.dataset.bg;
    }));
    const custom = m.querySelector('.custom-color-preview');
    if (custom) {
        custom.addEventListener('click', () => {
            const input = document.createElement('input'); input.type = 'color';
            input.value = (selected && selected.startsWith('#')) ? selected : '#2b6e9e';
            input.addEventListener('input', e => {
                custom.style.background = e.target.value;
                selected = e.target.value;
                m.querySelectorAll('.bg-option, .custom-color-preview').forEach(o => o.classList.remove('selected'));
                custom.classList.add('selected');
            });
            input.click();
        });
    }
    m.querySelector('#saveBgBtn').onclick = async () => {
        await window.supabase.from('users').update({ avatar_bg: selected }).eq('id', window.userId);
        window.currentUser.avatar_bg = selected;
        m.remove();
        await window.renderProfile();
        await window.awardStylist();
    };
};
window.awardStylist = async () => {
    try {
        const { data: ach } = await window.supabase.from('achievements').select('id').eq('name', '🎨 Стилист').single();
        if (!ach) return;
        const { data: existing } = await window.supabase
            .from('user_achievements')
            .select('id')
            .eq('user_id', window.userId)
            .eq('achievement_id', ach.id)
            .maybeSingle();
        if (!existing) {
            await window.supabase.from('user_achievements').insert({ user_id: window.userId, achievement_id: ach.id, earned_at: new Date().toISOString() });
            await fetch(`${BACKEND_URL}/send-notification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: window.userId, message: '🎨 Вы получили достижение "🎨 Стилист" за выбор аватарки или фона!', type: 'notify_trades' })
            }).catch(e=>console.warn);
            window.showModal('🎉 Новое достижение!', 'Вы получили "🎨 Стилист" за выбор аватарки или фона!');
        }
    } catch(e) { console.error(e); }
};
