// referral.js – упрощённая рефералка с бонусом за пополнение

window.renderReferralTab = async function() {
    const currentUser = window.currentUser;
    let referralCount = currentUser.referral_count || 0;
    let totalEarnedShares = 0;

    // Загружаем список рефералов и считаем, сколько пополнили
    async function loadReferralData() {
        const list = await window.getReferralsList();
        const topups = list.filter(r => r.topupCompleted);
        referralCount = list.length;
        // За каждое пополнение друзьями даём 3 акции
        totalEarnedShares = topups.length * 3;
        return { list, topups };
    }

    const { list: fullReferralsList, topups } = await loadReferralData();

    let currentPage = 1;
    const itemsPerPage = 10;
    let totalPages = Math.ceil(fullReferralsList.length / itemsPerPage);

    async function loadReferralsPage(page) {
        const start = (page - 1) * itemsPerPage;
        const end = start + itemsPerPage;
        const pageItems = fullReferralsList.slice(start, end);
        const container = document.getElementById('referralsListContent');
        if (!container) return;

        if (fullReferralsList.length === 0) {
            container.innerHTML = `
                <div class="empty-referrals-message">
                    <div class="empty-text">Вы пока никого не пригласили</div>
                    <button id="copyInviteEmptyBtn">📋 Скопировать ссылку</button>
                </div>
            `;
            document.getElementById('copyInviteEmptyBtn')?.addEventListener('click', () => {
                const code = currentUser.custom_ref_code || '';
                if (code) {
                    const link = `https://t.me/VoxAction_Bot?start=${code}`;
                    navigator.clipboard.writeText(link);
                    window.showCustomModal('Скопировано', 'Ссылка скопирована');
                } else {
                    window.showCustomModal('Ошибка', 'Сначала установите код');
                }
            });
            document.getElementById('referralsPagination')?.remove();
            return;
        }

        let html = '';
        for (let r of pageItems) {
            html += `
                <div class="referral-item">
                    <div class="referral-user-info">
                        <div class="referral-avatar-wrapper">${r.avatarUrl}</div>
                        <div class="referral-details">
                            <div class="referral-name">${escapeHtml(r.username)}</div>
                            <div class="referral-id">ID: ${r.userId}</div>
                            <div class="referral-date">${new Date(r.registeredAt).toLocaleDateString()}</div>
                        </div>
                    </div>
                    <div class="referral-status-badge">
                        ${r.topupCompleted ? '<span class="status-success">✅ Пополнил (бонус начислен)</span>' : '<span class="status-pending">⏳ Ожидает пополнения на 10 ⭐</span>'}
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;

        let paginationHtml = '';
        if (totalPages > 1) {
            paginationHtml = `
                <div class="pagination-controls">
                    <button class="pag-prev" ${page === 1 ? 'disabled' : ''}>← Назад</button>
                    <span class="pag-info">${page} / ${totalPages}</span>
                    <button class="pag-next" ${page === totalPages ? 'disabled' : ''}>Вперёд →</button>
                </div>
            `;
        }
        let pagContainer = document.getElementById('referralsPagination');
        if (!pagContainer) {
            const wrapper = document.getElementById('referralsListCollapsible');
            if (wrapper && !wrapper.querySelector('#referralsPagination')) {
                const div = document.createElement('div');
                div.id = 'referralsPagination';
                wrapper.appendChild(div);
                pagContainer = div;
            }
        }
        if (pagContainer) pagContainer.innerHTML = paginationHtml;

        document.querySelectorAll('.pag-prev').forEach(btn => {
            btn.onclick = () => { if (currentPage > 1) { currentPage--; loadReferralsPage(currentPage); } };
        });
        document.querySelectorAll('.pag-next').forEach(btn => {
            btn.onclick = () => { if (currentPage < totalPages) { currentPage++; loadReferralsPage(currentPage); } };
        });
    }

    const customCode = currentUser.custom_ref_code || '';
    const inviteLink = customCode ? `https://t.me/VoxAction_Bot?start=${customCode}` : '';

    let html = `
        <div class="card" style="overflow: visible !important;">
            <div class="referral-header">
                <h2>Приводи друзей и зарабатывай</h2>
                <p>Приглашай друзей, получай бонусы, когда они пополняют баланс</p>
            </div>
            <div class="stats-circles">
                <div class="stat-circle">
                    <div class="value">${referralCount}</div>
                    <div class="label">друзей</div>
                </div>
                <div class="stat-circle">
                    <div class="value">${totalEarnedShares}</div>
                    <div class="label">акций получено</div>
                </div>
                <div class="stat-circle">
                    <div class="value">${topups.length}</div>
                    <div class="label">пополнили</div>
                </div>
            </div>
            <div class="progress-block">
                <div class="progress-label">🎯 Бонус за каждого друга, пополнившего баланс на <strong>10 ⭐</strong> — <strong>3 акции</strong></div>
                <div style="font-size:14px; color:#9ca3af; margin-top:8px;">
                    ${topups.length} из ${referralCount} друзей уже пополнили
                </div>
            </div>
            <div class="invite-section">
                <div class="invite-link" id="refLinkText" style="cursor:pointer;">${inviteLink || 'Установите свой код'}</div>
                <div class="custom-code-section">
                    <input type="text" id="customCodeInput" placeholder="Ваш уникальный код" value="${escapeHtml(customCode)}" maxlength="32">
                    <button id="saveCustomCodeBtn">${customCode ? 'Изменить код' : 'Сохранить код'}</button>
                </div>
                <div class="invite-buttons">
                    <button class="copy-btn" id="copyRefLinkBtn">📋 Копировать ссылку</button>
                    <button class="share-btn" id="shareRefLinkBtn">📤 Поделиться</button>
                </div>
                <div class="link-hint">Код может содержать латиницу, цифры и символ подчёркивания (_)</div>
            </div>
            <div class="referrals-toggle" id="referralsToggle">
                <span class="btn-icon">👥</span>
                <span class="label-text">Приглашённые</span>
                <span class="badge">${referralCount}</span>
            </div>
            <div class="referrals-list-collapsible" id="referralsListCollapsible">
                <div id="referralsListContent"></div>
                <div id="referralsPagination"></div>
            </div>
            <div class="bonus-stock-card">
                <div class="bonus-stock-icon">🎁</div>
                <div class="bonus-stock-text">
                    <strong>Как получить бонус?</strong> Пригласите друга, и когда он пополнит баланс на <strong>10 ⭐</strong>, вы автоматически получите <strong>3 акции</strong>.
                </div>
            </div>
            <div class="legend">
                ⭐ Бонус начисляется только после пополнения друга. Акции зачисляются на ваш баланс автоматически.
            </div>
        </div>
    `;
    document.getElementById('app').innerHTML = html;

    // --- Обработчики ---
    const fullLinkSpan = document.getElementById('refLinkText');
    const copyBtn = document.getElementById('copyRefLinkBtn');
    const shareBtn = document.getElementById('shareRefLinkBtn');
    const saveCodeBtn = document.getElementById('saveCustomCodeBtn');
    const customInput = document.getElementById('customCodeInput');

    function updateLink() {
        let code = customInput.value.trim().toLowerCase();
        if (code === '') {
            fullLinkSpan.innerText = 'Сначала установите код';
            fullLinkSpan.style.opacity = '0.6';
            return;
        }
        fullLinkSpan.innerText = `https://t.me/VoxAction_Bot?start=${code}`;
        fullLinkSpan.style.opacity = '1';
    }
    customInput.addEventListener('input', updateLink);
    updateLink();

    fullLinkSpan.addEventListener('click', () => {
        const linkText = fullLinkSpan.innerText;
        if (linkText && !linkText.includes('Сначала установите код')) {
            navigator.clipboard.writeText(linkText);
            const original = fullLinkSpan.innerText;
            fullLinkSpan.innerText = '✅ Скопировано!';
            setTimeout(() => { fullLinkSpan.innerText = original; }, 2000);
        }
    });

    saveCodeBtn.addEventListener('click', async () => {
        let newCode = customInput.value.trim().toLowerCase();
        if (!newCode) {
            window.showCustomModal('Ошибка', 'Код не может быть пустым');
            return;
        }
        if (!/^[a-z0-9_]+$/.test(newCode)) {
            window.showCustomModal('Ошибка', 'Только латиница, цифры и _');
            return;
        }
        const res = await fetch(`${window.BACKEND_URL}/update-ref-code`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: window.userId, custom_code: newCode })
        });
        const data = await res.json();
        if (data.ok) {
            window.currentUser.custom_ref_code = newCode;
            window.showCustomModal('Успех', 'Реферальный код сохранён!');
            saveCodeBtn.textContent = 'Изменить код';
            updateLink();
        } else {
            if (data.error && (data.error.includes('уже занят') || data.error.includes('already'))) {
                window.showCustomModal('Ошибка', 'Этот код уже занят');
            } else {
                window.showCustomModal('Ошибка', data.error || 'Этот код уже занят');
            }
        }
    });

    copyBtn.addEventListener('click', () => {
        const linkText = fullLinkSpan.innerText;
        if (linkText && !linkText.includes('Сначала установите код')) {
            navigator.clipboard.writeText(linkText);
            const original = copyBtn.innerText;
            copyBtn.innerText = '✅ Скопировано!';
            setTimeout(() => { copyBtn.innerText = original; }, 2000);
        } else {
            window.showCustomModal('Ошибка', 'Установите код сначала');
        }
    });

    shareBtn.addEventListener('click', () => {
        const linkText = fullLinkSpan.innerText;
        if (linkText && !linkText.includes('Сначала установите код')) {
            const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(linkText)}&text=${encodeURIComponent('Присоединяйся ко мне в VoxAction бирже! 🚀')}`;
            if (window.tg && window.tg.openTelegramLink) window.tg.openTelegramLink(shareUrl);
            else window.open(shareUrl, '_blank');
        } else {
            window.showCustomModal('Ошибка', 'Установите код сначала');
        }
    });

    const toggleBtn = document.getElementById('referralsToggle');
    const collapsible = document.getElementById('referralsListCollapsible');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', async () => {
            collapsible.classList.toggle('open');
            if (collapsible.classList.contains('open') && !document.getElementById('referralsListContent').innerHTML) {
                currentPage = 1;
                await loadReferralsPage(1);
            }
        });
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}
