// tutorial.js – интерактивное обучение с подсветкой элементов и подсказками без модалок

let tutorialSteps = [];
let currentStepIndex = 0;
let tutorialActive = false;
let overlay = null;
let tooltip = null;
let currentHighlighted = null;

const TUTORIAL_KEY = 'tutorial_progress';

// Определяем шаги обучения
function initTutorialSteps() {
    tutorialSteps = [
        {
            id: 'profile_tab',
            title: '👤 Профиль',
            text: 'Начните с настройки профиля. Нажмите на вкладку «Профиль».',
            selector: '.tab[data-tab="profile"]',
            action: 'click',
            waitForTab: 'profile'
        },
        {
            id: 'avatar',
            title: '🖼️ Аватар',
            text: 'Нажмите на аватар, чтобы выбрать себе эмодзи, фон и цвет обводки.',
            selector: '#avatarClickWrapper .avatar-circle',
            action: 'click'
        },
        {
            id: 'achievement_slot',
            title: '🏆 Достижения',
            text: 'Нажмите на пустой слот, чтобы выбрать достижение для отображения в профиле.',
            selector: '.achi-icon[data-slot]:not(.earned)',
            action: 'click',
            optional: true
        },
        {
            id: 'stocks_tab',
            title: '📈 Акции',
            text: 'Теперь перейдите во вкладку «Акции», чтобы научиться торговать.',
            selector: '.tab[data-tab="stocks"]',
            action: 'click',
            waitForTab: 'stocks'
        },
        {
            id: 'sell_order',
            title: '📉 Продажа',
            text: 'Нажмите на кнопку «Продать», чтобы переключиться на форму продажи акций.',
            selector: '#orderTypeSell',
            action: 'click'
        },
        {
            id: 'mining_tab',
            title: '⛏️ Заработок',
            text: 'Откройте вкладку «Заработок», чтобы узнать, как добывать акции без вложений.',
            selector: '.tab[data-tab="mining"]',
            action: 'click',
            waitForTab: 'mining'
        },
        {
            id: 'start_mining',
            title: '🚀 Запуск майнинга',
            text: 'Нажмите «Начать майнинг», чтобы запустить добычу акций на 12 часов.',
            selector: '#startMiningBtn',
            action: 'click'
        },
        {
            id: 'final',
            title: '🎉 Поздравляем!',
            text: 'Вы прошли обучение! Получите достижение «Выпускник» и начинайте игру!',
            selector: null,
            action: null,
            isFinal: true
        }
    ];
}

// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
function getTutorialProgress() {
    try {
        const data = localStorage.getItem(TUTORIAL_KEY);
        return data ? JSON.parse(data) : { completed: false, step: 0 };
    } catch(e) { return { completed: false, step: 0 }; }
}

function saveTutorialProgress(step, completed = false) {
    localStorage.setItem(TUTORIAL_KEY, JSON.stringify({ step, completed }));
}

function createOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.id = 'tutorial-overlay';
    document.body.appendChild(overlay);
}

function removeOverlay() {
    if (overlay) {
        overlay.remove();
        overlay = null;
    }
}

function createTooltip(text, title = '') {
    if (tooltip) removeTooltip();
    tooltip = document.createElement('div');
    tooltip.id = 'tutorial-tooltip';
    let html = '';
    if (title) html += `<div class="tooltip-title">${title}</div>`;
    html += `<div class="tooltip-text">${text}</div>`;
    html += `<div class="tooltip-actions"><button id="tutorial-next-btn">Далее →</button></div>`;
    tooltip.innerHTML = html;
    document.body.appendChild(tooltip);
    
    // Показываем с небольшой задержкой
    setTimeout(() => { tooltip.classList.add('visible'); }, 100);
    
    // Кнопка "Далее" – переходим к следующему шагу
    document.getElementById('tutorial-next-btn').addEventListener('click', () => {
        nextStep();
    });
    
    return tooltip;
}

function removeTooltip() {
    if (tooltip) {
        tooltip.remove();
        tooltip = null;
    }
}

function positionTooltip(element, tooltipEl) {
    if (!element || !tooltipEl) return;
    const rect = element.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();
    const spacing = 12;
    let left = rect.left + rect.width/2 - tooltipRect.width/2;
    let top = rect.bottom + spacing;
    // Проверяем, чтобы не выходило за экран
    if (top + tooltipRect.height > window.innerHeight) {
        top = rect.top - tooltipRect.height - spacing;
    }
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - tooltipRect.width - 10;
    }
    tooltipEl.style.left = left + 'px';
    tooltipEl.style.top = top + 'px';
}

function highlightElement(element) {
    if (currentHighlighted) unhighlightElement(currentHighlighted);
    if (!element) return;
    element.classList.add('tutorial-highlight');
    currentHighlighted = element;
}

function unhighlightElement(element) {
    if (!element) return;
    element.classList.remove('tutorial-highlight');
    if (currentHighlighted === element) currentHighlighted = null;
}

// ===== ОСНОВНАЯ ЛОГИКА =====
function findElement(selector) {
    if (!selector) return null;
    try {
        return document.querySelector(selector);
    } catch(e) { return null; }
}

function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
        const el = findElement(selector);
        if (el) { resolve(el); return; }
        const observer = new MutationObserver(() => {
            const el2 = findElement(selector);
            if (el2) {
                observer.disconnect();
                resolve(el2);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}

function waitForTab(tabName, timeout = 5000) {
    return new Promise((resolve) => {
        const checkTab = () => {
            const activeTab = document.querySelector('.tab.active');
            if (activeTab && activeTab.dataset.tab === tabName) {
                resolve(true);
                return true;
            }
            return false;
        };
        if (checkTab()) return;
        const observer = new MutationObserver(() => {
            if (checkTab()) {
                observer.disconnect();
                resolve(true);
            }
        });
        observer.observe(document.body, { attributes: true, attributeFilter: ['class'], subtree: true });
        setTimeout(() => {
            observer.disconnect();
            resolve(false);
        }, timeout);
    });
}

async function showStep(index) {
    if (!tutorialSteps || index >= tutorialSteps.length) {
        finishTutorial();
        return;
    }
    const step = tutorialSteps[index];
    if (!step) return;
    
    // Если шаг финальный – показываем поздравление (тост) и выдаём достижение
    if (step.isFinal) {
        removeOverlay();
        removeTooltip();
        window.showToast('🎉 Обучение пройдено! Награда: достижение «Выпускник»! 🎓');
        // Выдаём достижение
        (async () => {
            const { data: ach } = await window.supabase.from('achievements').select('id').eq('name', '🎓 Выпускник').single();
            if (ach) {
                await window.awardAchievement(ach.id);
            }
        })();
        saveTutorialProgress(index, true);
        tutorialActive = false;
        return;
    }
    
    // Если шаг опциональный – проверяем наличие элемента
    if (step.optional && step.selector) {
        const el = findElement(step.selector);
        if (!el) {
            // Пропускаем опциональный шаг
            nextStep();
            return;
        }
    }
    
    // Если нужно ждать открытия вкладки – подсвечиваем таб и ждём клика
    if (step.waitForTab) {
        const tabEl = findElement(step.selector);
        if (tabEl) {
            createOverlay();
            const tooltipEl = createTooltip(step.text, step.title);
            highlightElement(tabEl);
            positionTooltip(tabEl, tooltipEl);
            
            // Добавляем обработчик клика для перехода к следующему шагу
            const clickHandler = () => {
                tabEl.removeEventListener('click', clickHandler);
                unhighlightElement(tabEl);
                removeTooltip();
                removeOverlay();
                // Ждём, пока вкладка откроется
                setTimeout(async () => {
                    await waitForTab(step.waitForTab);
                    nextStep();
                }, 300);
            };
            tabEl.addEventListener('click', clickHandler);
            
            // Также обрабатываем кнопку "Далее" (пропуск)
            const nextBtn = document.getElementById('tutorial-next-btn');
            if (nextBtn) {
                nextBtn.onclick = () => {
                    tabEl.removeEventListener('click', clickHandler);
                    unhighlightElement(tabEl);
                    removeTooltip();
                    removeOverlay();
                    nextStep();
                };
            }
        } else {
            // Если таба нет – ждём
            setTimeout(() => {
                removeTooltip();
                removeOverlay();
                nextStep();
            }, 3000);
        }
        return;
    }
    
    // Обычный шаг с действием (клик)
    if (step.selector) {
        const el = findElement(step.selector);
        if (!el) {
            // Элемент не найден – возможно, его нужно подождать
            const elPromise = waitForElement(step.selector);
            elPromise.then((foundEl) => {
                if (foundEl) {
                    showStep(index); // повторяем шаг
                } else {
                    // Если не найден – пропускаем
                    nextStep();
                }
            });
            return;
        }
        createOverlay();
        const tooltipEl = createTooltip(step.text, step.title);
        highlightElement(el);
        positionTooltip(el, tooltipEl);
        
        if (step.action === 'click') {
            // Ждём клика по элементу
            const clickHandler = () => {
                el.removeEventListener('click', clickHandler);
                unhighlightElement(el);
                removeTooltip();
                removeOverlay();
                setTimeout(() => {
                    nextStep();
                }, 300);
            };
            el.addEventListener('click', clickHandler);
            
            // Кнопка "Далее" – пропускаем шаг
            const nextBtn = document.getElementById('tutorial-next-btn');
            if (nextBtn) {
                nextBtn.onclick = () => {
                    el.removeEventListener('click', clickHandler);
                    unhighlightElement(el);
                    removeTooltip();
                    removeOverlay();
                    nextStep();
                };
            }
        }
    } else {
        // Шаг без селектора – просто показываем текст и кнопку
        createOverlay();
        const tooltipEl = createTooltip(step.text, step.title);
        tooltipEl.style.left = '50%';
        tooltipEl.style.top = '50%';
        tooltipEl.style.transform = 'translate(-50%, -50%)';
        tooltipEl.style.maxWidth = '400px';
        // Кнопка "Далее" уже есть в tooltip
    }
}

function nextStep() {
    currentStepIndex++;
    saveTutorialProgress(currentStepIndex);
    // Убираем предыдущие выделения
    if (currentHighlighted) {
        unhighlightElement(currentHighlighted);
        currentHighlighted = null;
    }
    removeTooltip();
    removeOverlay();
    // Запускаем следующий шаг
    setTimeout(() => {
        showStep(currentStepIndex);
    }, 300);
}

function finishTutorial() {
    removeTooltip();
    removeOverlay();
    if (currentHighlighted) unhighlightElement(currentHighlighted);
    tutorialActive = false;
    saveTutorialProgress(tutorialSteps.length, true);
    // Выдаём достижение, если ещё не выдано
    (async () => {
        const { data: ach } = await window.supabase.from('achievements').select('id').eq('name', '🎓 Выпускник').single();
        if (ach) {
            await window.awardAchievement(ach.id);
        }
    })();
}

// ===== ЗАПУСК ОБУЧЕНИЯ =====
window.startTutorial = async function() {
    const progress = getTutorialProgress();
    if (progress.completed) return;
    if (tutorialActive) return;
    
    // Инициализируем шаги
    initTutorialSteps();
    currentStepIndex = progress.step || 0;
    if (currentStepIndex >= tutorialSteps.length) {
        finishTutorial();
        return;
    }
    
    tutorialActive = true;
    // Ждём, пока загрузится интерфейс
    await new Promise(resolve => setTimeout(resolve, 800));
    showStep(currentStepIndex);
};

window.forceStartTutorial = function() {
    localStorage.removeItem(TUTORIAL_KEY);
    window.startTutorial();
};

// Очистка при переключении вкладок
document.addEventListener('visibilitychange', () => {
    if (document.hidden && tutorialActive) {
        removeTooltip();
        removeOverlay();
        if (currentHighlighted) unhighlightElement(currentHighlighted);
    }
});
