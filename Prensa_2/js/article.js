const WORKER_API = 'https://oropezas.enriquegarciaoropeza.workers.dev';

function getSlugFromUrl() { return new URLSearchParams(window.location.search).get('slug'); }
function getParam(key) { return new URLSearchParams(window.location.search).get(key); }

function normalizeContentBlock(block) {
    if (typeof block === 'string') return { html: `<p>${block}</p>` };
    if (block && typeof block === 'object') {
        if (typeof block.html === 'string') return { html: block.html };
        if (typeof block.text === 'string') return { html: `<p>${block.text}</p>` };
        if (typeof block.content === 'string') return { html: `<p>${block.content}</p>` };
    }
    return null;
}
function appendHtmlBlock(container, html) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    Array.from(wrapper.childNodes).forEach((node) => { container.appendChild(node); });
}
async function fetchArticleBySlug(slug) {
    const response = await fetch(`${WORKER_API}/api/articles?slug=${encodeURIComponent(slug)}`);
    if (!response.ok) throw new Error(`Error: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.articles) || !data.articles.length) return null;
    const summary = data.articles[0];
    const detailRes = await fetch(`${WORKER_API}/api/article/${encodeURIComponent(slug)}`);
    return detailRes.ok ? detailRes.json() : summary;
}
function renderAuthor(article) {
    const info = article.authorInfo;
    if (!info) return;
    const profileUrl = info.profileUrl || ('account.html?uid=' + (info.uid || ''));
    // TOP
    const topWrap = document.getElementById('article-author-top');
    if (topWrap) {
        topWrap.style.display = 'block';
        document.getElementById('article-author-top-link').href = profileUrl;
        const av = document.getElementById('article-author-top-avatar');
        av.src = info.picture || '';
        av.onerror = function() { this.style.display='none'; };
        const topNameEl = document.getElementById('article-author-top-name');
        topNameEl.textContent = info.name || '';
        if (info.verified) {
          const vspan = document.createElement('span');
          vspan.innerHTML = ' <i class="bi bi-patch-check-fill" style="color:#1d9bf0;font-size:.85em;" title="' + (info.verifiedLabel||'Verificado') + '"></i>';
          topNameEl.appendChild(vspan);
        }
        document.getElementById('article-author-top-title').textContent = info.title || (info.role === 'ai' ? 'Official AI' : '');
    }
    // BOTTOM
    const botWrap = document.getElementById('article-author-bottom');
    if (botWrap) {
        botWrap.style.display = 'block';
        document.getElementById('article-author-bottom-link').href = profileUrl;
        const av2 = document.getElementById('article-author-bottom-avatar');
        av2.src = info.picture || '';
        av2.onerror = function() { this.style.display='none'; };
        const botNameEl = document.getElementById('article-author-bottom-name');
        botNameEl.textContent = info.name || '';
        if (info.verified) {
          const vspan2 = document.createElement('span');
          vspan2.innerHTML = ' <i class="bi bi-patch-check-fill" style="color:#1d9bf0;font-size:.9em;" title="' + (info.verifiedLabel||'Verificado') + '"></i>';
          botNameEl.appendChild(vspan2);
        }
        document.getElementById('article-author-bottom-title').textContent = info.title || (info.role === 'ai' ? 'Official AI' : '');
        if (info.uid) {
            fetch(WORKER_API + '/api/user/profile?uid=' + encodeURIComponent(info.uid))
                .then(r => r.json()).then(u => {
                    if (u && u.bio) document.getElementById('article-author-bottom-bio').textContent = u.bio;
                }).catch(() => {});
        }
    }
}

// ── RENDER ───────────────────────────────────────────────────────────────────

function renderArticle(article) {
    document.title = `${article.title || 'Artículo'} - Oropezas.com`;
    const categoryEl = document.getElementById('article-category');
    if (categoryEl) categoryEl.textContent = article.category || 'Noticia';
    const titleEl = document.getElementById('article-title');
    if (titleEl) titleEl.textContent = article.title || '';
    const dateEl = document.getElementById('article-date');
    if (dateEl) dateEl.textContent = article.date || '';
    const excerptEl = document.getElementById('article-excerpt');
    if (excerptEl) excerptEl.textContent = article.excerpt || article.subtitle || '';
    renderAuthor(article);
    const imageEl = document.getElementById('article-image');
    if (imageEl) {
        const imgUrl = article.featuredImage || article.image || `${WORKER_API}/api/media/articles/noticias/${article.slug}.jpg`;
        imageEl.src = imgUrl;
        imageEl.alt = article.title || '';
        imageEl.style.display = 'block';
        imageEl.onerror = () => imageEl.style.display = 'none';
    }

    const contentEl = document.getElementById('article-content');
    if (contentEl) {
        contentEl.innerHTML = '';
        if (Array.isArray(article.content)) {
            article.content.forEach(block => {
                const normalized = normalizeContentBlock(block);
                if (normalized) appendHtmlBlock(contentEl, normalized.html);
            });
        } else if (article.html) {
            appendHtmlBlock(contentEl, article.html);
        } else if (article.body) {
             appendHtmlBlock(contentEl, `<p>${article.body}</p>`);
        }
    }
}

async function loadArticle() {
    const slug = getSlugFromUrl();
    if (!slug) return;
    try {
        const article = await fetchArticleBySlug(slug);
        if (!article) return;
        renderArticle(article);
    } catch (error) { console.error('Error:', error); }
}
loadArticle();
