// news.js – вкладка новостей с редактором для админов

window.renderNewsTab = async function() {
    try {
        const news = await window.getNews();
        const isAdmin = await window.isAdmin(window.userId);
        let html = `
            <div class="card">
                <h2 style="text-align:center; margin-bottom:16px;">📰 Новости проекта</h2>
        `;
        if (isAdmin) {
            html += `
                <div style="margin-bottom:20px; background:rgba(0,0,0,0.3); border-radius:20px; padding:16px;">
                    <h3 style="text-align:center;">✍️ Создать новость</h3>
                    <input type="text" id="newsTitle" placeholder="Заголовок" style="margin-bottom:8px; text-align:center; font-size:18px; font-weight:bold;">
                    <div style="display:flex; gap:8px; margin-bottom:8px; flex-wrap:wrap; justify-content:center;">
                        <button class="format-btn" data-tag="b" style="padding:4px 12px; border-radius:20px; background:rgba(255,255,255,0.1); border:none; color:white; cursor:pointer; font-weight:bold;">B</button>
                        <button class="format-btn" data-tag="i" style="padding:4px 12px; border-radius:20px; background:rgba(255,255,255,0.1); border:none; color:white; cursor:pointer; font-style:italic;">I</button>
                        <button class="format-btn" data-tag="u" style="padding:4px 12px; border-radius:20px; background:rgba(255,255,255,0.1); border:none; color:white; cursor:pointer; text-decoration:underline;">U</button>
                        <button class="format-btn" data-tag="center" style="padding:4px 12px; border-radius:20px; background:rgba(255,255,255,0.1); border:none; color:white; cursor:pointer; text-align:center;">≡</button>
                    </div>
                    <textarea id="newsContent" placeholder="Содержание новости" rows="6" style="width:100%; padding:12px; background:#0a0f1a; border:1px solid rgba(0,255,255,0.3); border-radius:16px; color:white; resize:vertical;"></textarea>
                    <input type="file" id="newsImageFile" accept="image/*" style="margin:8px 0;">
                    <button id="createNewsBtn" style="background:linear-gradient(135deg,#2b6e9e,#1a4c6e);">📤 Опубликовать</button>
                </div>
            `;
        }
        html += `<div id="newsContainer">`;
        if (!news.length) {
            html += `<p style="text-align:center; color:#9ca3af;">Пока нет новостей</p>`;
        } else {
            news.forEach(n => {
                html += `
                    <div style="background:rgba(0,0,0,0.3); border-radius:20px; padding:16px; margin-bottom:16px; border:1px solid rgba(0,255,255,0.1);">
                        ${n.image_url ? `<img src="${n.image_url}" style="width:100%; max-height:200px; object-fit:cover; border-radius:12px; margin-bottom:12px;" onerror="this.style.display='none'">` : ''}
                        <div style="font-size:20px; font-weight:700; text-align:center; color:#eef2ff;">${n.title}</div>
                        <div style="font-size:14px; color:#cbd5e1; margin:8px 0;">${n.content}</div>
                        <div style="font-size:11px; color:#9ca3af; margin-top:8px;">📅 ${new Date(n.created_at).toLocaleString()}</div>
                    </div>
                `;
            });
        }
        html += `</div></div>`;
        document.getElementById('app').innerHTML = html;

        // Форматирование текста для админов
        document.querySelectorAll('.format-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const tag = this.dataset.tag;
                const textarea = document.getElementById('newsContent');
                if (!textarea) return;
                const start = textarea.selectionStart;
                const end = textarea.selectionEnd;
                const selected = textarea.value.substring(start, end);
                let wrapped = '';
                if (tag === 'center') {
                    wrapped = `<div style="text-align:center;">${selected}</div>`;
                } else {
                    wrapped = `<${tag}>${selected}</${tag}>`;
                }
                textarea.value = textarea.value.substring(0, start) + wrapped + textarea.value.substring(end);
                textarea.focus();
            });
        });

        // Создание новости (только для админов)
        document.getElementById('createNewsBtn')?.addEventListener('click', async () => {
            const title = document.getElementById('newsTitle').value.trim();
            const content = document.getElementById('newsContent').value.trim();
            const fileInput = document.getElementById('newsImageFile');
            if (!title || !content) {
                window.showCustomModal('Ошибка', 'Заполните заголовок и содержание');
                return;
            }
            let imageBase64 = null;
            if (fileInput.files && fileInput.files[0]) {
                const reader = new FileReader();
                imageBase64 = await new Promise((resolve) => {
                    reader.onload = (e) => resolve(e.target.result);
                    reader.readAsDataURL(fileInput.files[0]);
                });
            }
            try {
                await window.createNews(title, content, imageBase64 || null);
                window.showToast('Новость создана!');
                document.getElementById('newsTitle').value = '';
                document.getElementById('newsContent').value = '';
                document.getElementById('newsImageFile').value = '';
                window.renderNewsTab();
            } catch(e) {
                window.showCustomModal('Ошибка', e.message);
            }
        });

    } catch(e) {
        document.getElementById('app').innerHTML = `<div class="card error">Ошибка загрузки новостей</div>`;
        console.error(e);
    }
};
