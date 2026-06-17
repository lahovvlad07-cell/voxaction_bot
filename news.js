// news.js – вкладка новостей проекта (просмотр, админ-панель для публикации)

// ===== ЗАГРУЗКА НОВОСТЕЙ =====
async function loadNews() {
    try {
        const { data, error } = await window.supabase
            .from('news')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        return data || [];
    } catch (e) {
        console.error('Ошибка загрузки новостей', e);
        return [];
    }
}

// ===== ПУБЛИКАЦИЯ НОВОСТИ (только для админов) =====
async function publishNews(title, content, imageUrl = null) {
    try {
        const { data, error } = await window.supabase
            .from('news')
            .insert({
                title: title,
                content: content,
                image_url: imageUrl,
                author_id: window.userId,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        if (error) throw error;
        return data;
    } catch (e) {
        console.error('Ошибка публикации новости', e);
        throw e;
    }
}

// ===== УДАЛЕНИЕ НОВОСТИ (только для админов) =====
async function deleteNews(newsId) {
    try {
        const { error } = await window.supabase
            .from('news')
            .delete()
            .eq('id', newsId);
        if (error) throw error;
        return true;
    } catch (e) {
        console.error('Ошибка удаления новости', e);
        throw e;
    }
}

// ===== ПРОВЕРКА, ЯВЛЯЕТСЯ ЛИ ПОЛЬЗОВАТЕЛЬ АДМИНОМ =====
async function isUserAdmin(userId) {
    try {
        const { data, error } = await window.supabase
            .from('admins')
            .select('user_id')
            .eq('user_id', userId)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        return !!data;
    } catch (e) {
        console.error('Ошибка проверки админа', e);
        return false;
    }
}

// ===== МОДАЛКА ДЛЯ СОЗДАНИЯ НОВОСТИ =====
function showCreateNewsModal(callback) {
    const modalHtml = `
        <div class="modal" id="createNewsModal" style="display:flex;">
            <div class="modal-content" style="max-width: 500px;">
                <span class="close-modal" id="closeCreateNewsModal">&times;</span>
                <h3>✍️ Создать новость</h3>
                <div style="padding: 16px 0;">
                    <input type="text" id="newsTitleInput" placeholder="Заголовок новости" style="margin-bottom:12px;">
                    <textarea id="newsContentInput" placeholder="Текст новости (можно использовать Emoji)" rows="5" style="width:100%; padding:12px; background:#0a0f1a; border:1px solid #0ff; border-radius:16px; color:#fff; resize:vertical; margin-bottom:12px;"></textarea>
                    <input type="text" id="newsImageInput" placeholder="Ссылка на картинку (необязательно)" style="margin-bottom:12px;">
                    <button id="publishNewsBtn" class="primary">📤 Опубликовать</button>
                </div>
                <div class="modal-buttons">
                    <button id="cancelCreateNews" class="secondary">Отмена</button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('createNewsModal');
    const closeModal = () => modal.remove();
    document.getElementById('closeCreateNewsModal').onclick = closeModal;
    document.getElementById('cancelCreateNews').onclick = closeModal;
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    document.getElementById('publishNewsBtn').onclick = async () => {
        const title = document.getElementById('newsTitleInput').value.trim();
        const content = document.getElementById('newsContentInput').value.trim();
        const imageUrl = document.getElementById('newsImageInput').value.trim() || null;
        if (!title || !content) {
            window.showCustomModal('Ошибка', 'Заполните заголовок и текст новости');
            return;
        }
        try {
            await publishNews(title, content, imageUrl);
            window.showToast('✅ Новость опубликована!');
            closeModal();
            if (callback) callback();
        } catch (e) {
            window.showCustomModal('Ошибка', e.message);
        }
    };
}

// ===== ГЛАВНЫЙ РЕНДЕР =====
window.renderNewsTab = async function() {
    const news = await loadNews();
    const isAdmin = await isUserAdmin(window.userId);

    let html = `
        <div class="news-container">
            <div class="news-header">
                <h2>📰 Новости проекта</h2>
                <p>Будьте в курсе последних обновлений!</p>
            </div>
    `;

    if (isAdmin) {
        html += `
            <button id="createNewsBtn" class="news-btn primary" style="margin-bottom:20px;">✍️ Создать новость</button>
        `;
    }

    if (!news.length) {
        html += `
            <div class="news-empty">
                <span style="font-size:48px;">📭</span>
                <p>Новостей пока нет. Следите за обновлениями!</p>
            </div>
        `;
    } else {
        html += `<div class="news-list">`;
        for (const item of news) {
            const date = new Date(item.created_at).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            html += `
                <div class="news-card">
                    ${item.image_url ? `<img src="${item.image_url}" alt="Новость" class="news-image" onerror="this.style.display='none'">` : ''}
                    <div class="news-content">
                        <h3 class="news-title">${escapeHtml(item.title)}</h3>
                        <p class="news-text">${escapeHtml(item.content)}</p>
                        <div class="news-meta">
                            <span class="news-date">${date}</span>
                            ${isAdmin ? `<button class="delete-news-btn" data-id="${item.id}">🗑️</button>` : ''}
                        </div>
                    </div>
                </div>
            `;
        }
        html += `</div>`;
    }

    html += `</div>`;
    document.getElementById('app').innerHTML = html;

    // Обработчики
    if (isAdmin) {
        document.getElementById('createNewsBtn').addEventListener('click', () => {
            showCreateNewsModal(() => window.renderNewsTab());
        });
        document.querySelectorAll('.delete-news-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = parseInt(btn.dataset.id);
                if (confirm('Удалить эту новость?')) {
                    try {
                        await deleteNews(id);
                        window.showToast('🗑️ Новость удалена');
                        window.renderNewsTab();
                    } catch (e) {
                        window.showCustomModal('Ошибка', e.message);
                    }
                }
            });
        });
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[m]);
}
