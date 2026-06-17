// tutorial.js – интерактивное обучение с подсветкой элементов, без модалок

let tutorialSteps = [];
let currentStepIndex = 0;
let tutorialActive = false;
let targetElement = null;
let overlay = null;
let tooltip = null;

const TUTORIAL_KEY = 'tutorial_progress';

// Определяем шаги обучения (для каждой вкладки)
function initTutorialSteps() {
    tutorialSteps = [
        {
            id: 'profile_tab',
            title: '👤 Профиль',
            text: 'Начните с настройки профиля. Нажмите на вкладку «Профиль».',
            selector: '.tab[data-tab="profile"]',
            action: 'click',
            waitForTab: 'profile',
            // После открытия вкладки профиля сразу показываем следующий шаг
        },
        {
            id: 'avatar',
            title: '🖼️ Аватар',
            text: 'Нажмите на аватар, чтобы выбрать эмодзи, фон и цвет обводки.',
            selector: '#avatarClickWrapper',
            action: 'click',
            // После клика по аватарке откроется модалка, мы не ждём её закрытия, просто переходим дальше
        },
        {
            id: 'achievement_slot',
            title: '🏆 Достижения',
            text: 'Нажмите на пустой слот достижения, чтобы выбрать одно из полученных достижений.',
            selector: '.achi-icon[data-slot]:not(.earned)',
            action: 'click',
            optional: true, // если нет пустых слотов – пропускаем
        },
        {
            id: 'stocks_tab',
            title: '📈 Акции',
            text: 'Теперь перейдите во вкладку «Акции», чтобы научиться торговать.',
            selector: '.tab[data-tab="stocks"]',
            action: 'click',
            waitForTab: 'stocks',
        },
        {
            id: 'order_type',
            title: '📉 Продажа или покупка',
            text: 'Нажмите на кнопку «Продать» или «Купить», чтобы выбрать тип ордера.',
            selector: '.type-opt',
            action: 'click',
            // Можно подсветить любую из кнопок, но для простоты подсветим обе
        },
        {
            id: 'create_order',
            title: '📝 Создание ордера',
            text: 'Заполните количество и цену, затем нажмите «Разместить ордер». (можете пропустить)',
            selector: '#createOrderBtn',
            action: 'click',
            optional: true,
        },
        {
            id: 'mining_tab',
            title: '⛏️ Заработок',
            text: 'Перейдите во вкладку «Заработок», чтобы узнать о майнинге.',
            selector: '.tab[data-tab="mining"]',
            action: 'click',
            waitForTab: 'mining',
        },
        {
            id: 'start_mining',
            title: '🚀 Запуск майнинга',
            text: 'Нажмите «Начать майнинг», чтобы запустить добычу акций на 12 часов.',
            selector: '#startMiningBtn',
            action: 'click',
        },
        {
            id: 'final',
            title: '🎉 Поздравляем!',
            text: 'Вы прошли обучение! Награда: достижение «Выпускник» 🎓',
            selector: null,
            action: null,
            isFinal: true,
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
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 9999;
        pointer-events: none;
        transition: background 0.3s;
        backdrop-filter: blur(2px);
    `;
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
    tooltip.style.cssText = `
        position: fixed;
        background: #1a1f2e;
        color: #eef2ff;
        padding: 16px 20px;
        border-radius: 16px;
        max-width: 340px;
        z-index: 10000;
        box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        border: 1px solid #0ff;
        pointer-events: auto;
        font-size: 14px;
        line-height: 1.5;
        transition: opacity 0.3s;
        opacity: 0;
        font-family: 'Inter', system-ui, sans-serif;
    `;
    let html = '';
    if (title) html += `<div style="font-weight:700; font-size:18px; margin-bottom:8px; color:#0ff;">${title}</div>`;
    html += `<div>${text}</div>`;
    // Кнопка "Пропустить" и "Далее"
    html += `
        <div style="margin-top:12px; display:flex; gap:10px; justify-content:flex-end;">
            <button id="tutorial-skip-btn" style="background:transparent; border:1px solid #9ca3af; color:#9ca3af; padding:4px 14px; border-radius:20px; cursor:pointer; font-size:12px;">Пропустить</button>
            <button id="tutorial-next-btn" style="background:#2b6e9e; border:none; color:white; padding:6px 18px; border-radius:30px; cursor:pointer; font-weight:600; font-size:14px;">Далее →</button>
        </div>
    `;
    tooltip.innerHTML = html;
    document.body.appendChild(tooltip);
    
    // Кнопка "Далее" – переходим к следующему шагу
    document.getElementById('tutorial-next-btn').addEventListener('click', () => {
        // Если текущий шаг ещё не выполнен (например, не кликнули по элементу), всё равно переходим
        nextStep();
    });
    // Кнопка "Пропустить" – пропускаем все оставшиеся шаги и завершаем обучение
    document.getElementById('tutorial-skip-btn').addEventListener('click', () => {
        finishTutorial();
    });
    
    // Показываем с небольшой задержкой
    setTimeout(() => { tooltip.style.opacity = '1'; }, 100);
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
    if (!element) return;
    // Создаём подсветку вокруг элемента
    element.style.outline = '3px solid #0ff';
    element.style.outlineOffset = '4px';
    element.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.6)';
    element.style.zIndex = '10001';
    element.style.position = 'relative';
    element.classList.add('tutorial-highlight');
}

function unhighlightElement(element) {
    if (!element) return;
    element.style.outline = '';
    element.style.outlineOffset = '';
    element.style.boxShadow = '';
    element.style.zIndex = '';
    element.classList.remove('tutorial-highlight');
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
    
    // Если шаг финальный – показываем поздравление
    if (step.isFinal) {
        removeOverlay();
        removeTooltip();
        // Показываем простое сообщение (без модалки, через toast или custom modal)
        window.showCustomModal('🎉 Обучение пройдено!', 'Вы успешно освоили основные возможности приложения. Награда: достижение «Выпускник»! 🎓');
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
    
    // Если нужно ждать открытия вкладки – сначала показываем подсказку, потом ждём
    if (step.waitForTab) {
        // Показываем подсказку с объяснением
        createOverlay();
        const tooltipEl = createTooltip(step.text, step.title);
        // Подсвечиваем таб
        const tabEl = findElement(step.selector);
        if (tabEl) {
            highlightElement(tabEl);
            positionTooltip(tabEl, tooltipEl);
            // Добавляем обработчик клика для автоматического перехода
            const clickHandler = () => {
                tabEl.removeEventListener('click', clickHandler);
                // Ждём, пока вкладка откроется
                setTimeout(async () => {
                    unhighlightElement(tabEl);
                    removeTooltip();
                    removeOverlay();
                    await waitForTab(step.waitForTab);
                    // После открытия вкладки переходим к следующему шагу
                    nextStep();
                }, 500);
            };
            tabEl.addEventListener('click', clickHandler);
            // Также добавляем возможность перехода по кнопке "Далее" (уже есть в tooltip)
        } else {
            // Если таба нет – просто ждём или переходим дальше
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
                // Небольшая задержка перед переходом
                setTimeout(() => {
                    nextStep();
                }, 300);
            };
            el.addEventListener('click', clickHandler);
            // Также можно разрешить переход по кнопке "Далее" (она уже есть в tooltip)
        }
    } else {
        // Шаг без селектора – просто показываем текст и кнопку
        createOverlay();
        const tooltipEl = createTooltip(step.text, step.title);
        // Располагаем по центру
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
    document.querySelectorAll('.tutorial-highlight').forEach(el => unhighlightElement(el));
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
    document.querySelectorAll('.tutorial-highlight').forEach(el => unhighlightElement(el));
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
    // Если шаг уже пройден больше чем количество шагов – завершаем
    if (currentStepIndex >= tutorialSteps.length) {
        finishTutorial();
        return;
    }
    
    tutorialActive = true;
    // Ждём, пока загрузится интерфейс
    await new Promise(resolve => setTimeout(resolve, 1000));
    showStep(currentStepIndex);
};

// Функция для принудительного запуска (если нужно)
window.forceStartTutorial = function() {
    localStorage.removeItem(TUTORIAL_KEY);
    window.startTutorial();
};

// Очистка при переключении вкладок – чтобы не было конфликтов
document.addEventListener('visibilitychange', () => {
    if (document.hidden && tutorialActive) {
        // Скрываем подсказки, если вкладка неактивна
        removeTooltip();
        removeOverlay();
        document.querySelectorAll('.tutorial-highlight').forEach(el => unhighlightElement(el));
    }
});

// Если пользователь кликнул вне области подсказки – не закрываем её, только по кнопкам
