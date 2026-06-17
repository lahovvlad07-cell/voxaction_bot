// tutorial.js – система обучения по вкладкам

const tutorialSteps = [
    {
        tab: 'profile',
        title: '👤 Профиль',
        text: 'Здесь вы можете настроить свой аватар, посмотреть статистику, достижения и рейтинг. Нажмите на аватар, чтобы его изменить!',
        highlight: '.tab[data-tab="profile"]'
    },
    {
        tab: 'stocks',
        title: '📈 Акции',
        text: 'Основная вкладка! Здесь вы можете покупать и продавать акции, смотреть стакан, график цены и управлять своими ордерами.',
        highlight: '.tab[data-tab="stocks"]'
    },
    {
        tab: 'analytics',
        title: '📊 Аналитика',
        text: 'Полная статистика ваших сделок: объёмы торгов, динамика цены, активность по дням, крупнейшие сделки и последние операции.',
        highlight: '.tab[data-tab="analytics"]'
    },
    {
        tab: 'rating',
        title: '🏆 Рейтинг',
        text: 'Рейтинг всех участников по количеству акций. Ищите друзей, соревнуйтесь и поднимайтесь в топ!',
        highlight: '.tab[data-tab="rating"]'
    },
    {
        tab: 'wallet',
        title: '💳 Кошелёк',
        text: 'Пополняйте баланс Stars, выводите через подарки, смотрите лимиты и историю операций.',
        highlight: '.tab[data-tab="wallet"]'
    },
    {
        tab: 'referral',
        title: '🔗 Рефералка',
        text: 'Приглашайте друзей, получайте бонусы и звёзды за каждого нового участника!',
        highlight: '.tab[data-tab="referral"]'
    },
    {
        tab: 'mining',
        title: '⛏️ Заработок',
        text: 'Запускайте майнинг на 12 часов и получайте акции в реальном времени. Повышайте уровень, чтобы увеличить скорость!',
        highlight: '.tab[data-tab="mining"]'
    },
    {
        tab: 'news',
        title: '📰 Новости',
        text: 'Все важные обновления и анонсы проекта публикуются здесь. Следите за новостями!',
        highlight: '.tab[data-tab="news"]'
    }
];

let tutorialCurrentStep = 0;
let tutorialTotalSteps = tutorialSteps.length;

// ===== НАЧАТЬ ОБУЧЕНИЕ =====
window.startTutorial = async function() {
    const progress = await window.getTutorialProgress();
    if (progress.completed) return;
    tutorialCurrentStep = progress.current_step || 0;
    showTutorialStep(tutorialCurrentStep);
};

// ===== ПОКАЗАТЬ ШАГ =====
function showTutorialStep(step) {
    const modal = document.getElementById('tutorialModal');
    const title = document.getElementById('tutorialTitle');
    const body = document.getElementById('tutorialBody');
    const prevBtn = document.getElementById('tutorialPrevBtn');
    const nextBtn = document.getElementById('tutorialNextBtn');
    const skipBtn = document.getElementById('tutorialSkipBtn');

    if (step >= tutorialTotalSteps) {
        finishTutorial();
        return;
    }

    const data = tutorialSteps[step];
    modal.style.display = 'flex';
    title.textContent = `🎓 Обучение (${step+1}/${tutorialTotalSteps})`;
    body.innerHTML = `
        <div style="text-align:center; margin-bottom:12px;">
            <div style="font-size:48px; margin-bottom:8px;">${data.tab === 'profile' ? '👤' : 
                data.tab === 'stocks' ? '📈' : 
                data.tab === 'analytics' ? '📊' : 
                data.tab === 'rating' ? '🏆' : 
                data.tab === 'wallet' ? '💳' : 
                data.tab === 'referral' ? '🔗' : 
                data.tab === 'mining' ? '⛏️' : '📰'}</div>
            <div style="font-size:18px; font-weight:700; color:#eef2ff;">${data.title}</div>
            <div style="font-size:14px; color:#cbd5e1; margin-top:8px;">${data.text}</div>
            ${data.highlight ? `<div style="margin-top:12px; padding:8px; background:rgba(0,255,255,0.1); border-radius:12px; font-size:12px; color:#0ff;">👉 Нажмите на вкладку "${data.tab}" внизу</div>` : ''}
        </div>
    `;

    prevBtn.style.display = step === 0 ? 'none' : 'inline-block';
    nextBtn.textContent = step === tutorialTotalSteps - 1 ? '🏆 Завершить' : 'Далее →';

    // Обработчики (удаляем старые, чтобы не дублировались)
    const newNextBtn = nextBtn.cloneNode(true);
    nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
    const newPrevBtn = prevBtn.cloneNode(true);
    prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
    const newSkipBtn = skipBtn.cloneNode(true);
    skipBtn.parentNode.replaceChild(newSkipBtn, skipBtn);

    document.getElementById('tutorialNextBtn').onclick = async () => {
        // Если последний шаг – завершаем
        if (tutorialCurrentStep === tutorialTotalSteps - 1) {
            await finishTutorial();
            return;
        }
        tutorialCurrentStep++;
        await window.updateTutorialProgress(tutorialCurrentStep);
        // Подсвечиваем следующую вкладку
        const nextData = tutorialSteps[tutorialCurrentStep];
        if (nextData.highlight) {
            const el = document.querySelector(nextData.highlight);
            if (el) {
                el.style.boxShadow = '0 0 20px #0ff';
                setTimeout(() => el.style.boxShadow = '', 2000);
            }
        }
        showTutorialStep(tutorialCurrentStep);
    };

    document.getElementById('tutorialPrevBtn').onclick = () => {
        if (tutorialCurrentStep > 0) {
            tutorialCurrentStep--;
            showTutorialStep(tutorialCurrentStep);
        }
    };

    document.getElementById('tutorialSkipBtn').onclick = async () => {
        if (confirm('Пропустить обучение? Вы сможете пройти его позже в настройках.')) {
            await finishTutorial(true);
        }
    };

    document.getElementById('closeTutorialModal').onclick = async () => {
        await finishTutorial(true);
    };

    // Подсветка текущей вкладки
    const currentData = tutorialSteps[step];
    if (currentData.highlight) {
        const el = document.querySelector(currentData.highlight);
        if (el) {
            el.style.boxShadow = '0 0 20px #0ff';
            setTimeout(() => el.style.boxShadow = '', 2000);
        }
    }
}

// ===== ЗАВЕРШИТЬ ОБУЧЕНИЕ =====
async function finishTutorial(skipped = false) {
    const modal = document.getElementById('tutorialModal');
    modal.style.display = 'none';
    await window.updateTutorialProgress(0, true);
    if (!skipped) {
        // Выдаём достижение за прохождение обучения
        await window.awardTutorialAchievement();
        window.showCustomModal('🎓 Поздравляем!', 'Вы успешно прошли обучение и получили достижение "🎓 Выпускник"!');
    }
    // Сбрасываем подсветку
    document.querySelectorAll('.tab').forEach(el => el.style.boxShadow = '');
}

// ===== ПОКАЗАТЬ МОДАЛКУ ОНБОРДИНГА (ВЫБОР АВАТАРКИ) =====
window.showOnboardingModal = async function() {
    const modal = document.getElementById('onboardingModal');
    const container = document.getElementById('onboardingAvatars');
    const confirmBtn = document.getElementById('onboardingConfirmBtn');

    const avatars = ['👤','😀','😎','👍','🐱','🐶','🦊','🐼','🍕','🍔','🍩','☕','💎','💰','🎲','🏆','🎁','🌟','🔥','❤️','🚀','🍀','👑','🎯'];
    let selectedAvatar = null;

    container.innerHTML = avatars.map(a => `
        <div class="avatar-option" data-avatar="${a}" style="font-size:40px; cursor:pointer; padding:8px; border-radius:50%; transition:0.2s; background:rgba(255,255,255,0.05);">
            ${a}
        </div>
    `).join('');

    document.querySelectorAll('#onboardingAvatars .avatar-option').forEach(el => {
        el.addEventListener('click', function() {
            document.querySelectorAll('#onboardingAvatars .avatar-option').forEach(e => e.style.border = 'none');
            this.style.border = '2px solid #0ff';
            selectedAvatar = this.dataset.avatar;
            confirmBtn.disabled = false;
        });
    });

    confirmBtn.onclick = async () => {
        if (!selectedAvatar) return;
        // Сохраняем аватар
        await window.supabase
            .from('users')
            .update({ avatar_url: selectedAvatar, onboarding_completed: true })
            .eq('id', window.userId);
        window.currentUser.avatar_url = selectedAvatar;
        modal.style.display = 'none';
        // Показываем обучение через секунду
        setTimeout(() => window.startTutorial(), 500);
        if (window.renderProfileTab) {
            await window.renderProfileTab(
                window.currentUser, window.supabase, window.userId, window.fromCents, window.showCustomModal,
                window.getUserStats, window.getUserRank, window.getEarnedAchievements, window.getAllAchievements,
                window.updateBellBadge, window.showNotificationsModal
            );
        }
    };

    modal.style.display = 'flex';
};
