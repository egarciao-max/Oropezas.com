const API_BASE = 'https://oropezas.enriquegarciaoropeza.workers.dev';

function getArticleUrl(article) {
    const slug = article.slug || (article.url && article.url.split('slug=')[1]);
    return slug ? `article.html?slug=${slug}` : '#';
}

function getImageUrl(article) {
    if (article.featuredImage) return article.featuredImage;
    if (article.image) return article.image;
    // Fallback based on slug if it's a dynamic article
    if (article.slug) return `${API_BASE}/api/media/articles/noticias/${article.slug}.jpg`;
    return 'https://via.placeholder.com/800x450?text=Oropezas.com';
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    })[m]);
}

function renderFeatured(article) {
    const container = document.getElementById('featured-container');
    if (!container || !article) return;

    container.innerHTML = `
        <article class="featured-article">
            <div class="featured-image">
                <a href="${getArticleUrl(article)}">
                    <img src="${getImageUrl(article)}" alt="${escapeHtml(article.title)}" onerror="this.src='https://via.placeholder.com/800x450?text=Oropezas.com'">
                </a>
            </div>
            <div class="featured-content">
                <span class="news-tag">${escapeHtml(article.category || 'Noticia')}</span>
                <a href="${getArticleUrl(article)}" style="text-decoration:none; color:inherit;">
                    <h1>${escapeHtml(article.title)}</h1>
                </a>
                <p class="subtitle">${escapeHtml(article.subtitle || article.excerpt || '')}</p>
                <div class="article-meta">
                    <span>${escapeHtml(article.date || '')}</span>
                </div>
                <a href="${getArticleUrl(article)}" class="read-more">Leer más</a>
            </div>
        </article>
    `;
}

function renderGrid(articles) {
    const container = document.getElementById('articles-grid');
    if (!container) return;

    container.innerHTML = articles.map((article, index) => `
        <article class="article-card" style="animation-delay: ${0.1 * index}s">
            <div class="article-card-image">
                <a href="${getArticleUrl(article)}">
                    <img src="${getImageUrl(article)}" alt="${escapeHtml(article.title)}" onerror="this.src='https://via.placeholder.com/400x225?text=Oropezas.com'">
                </a>
            </div>
            <div class="article-card-content">
                <span class="news-tag">${escapeHtml(article.category || 'Noticia')}</span>
                <h3>${escapeHtml(article.title)}</h3>
                <p class="article-card-excerpt">${escapeHtml(article.excerpt || article.subtitle || '')}</p>
                <div class="article-card-date">${escapeHtml(article.date || '')}</div>
                <a href="${getArticleUrl(article)}" class="article-card-link">Leer más</a>
            </div>
        </article>
    `).join('');
}

async function loadArticles() {
    try {
        const page = document.body.dataset.page || 'index';
        const response = await fetch(`${API_BASE}/api/articles`);
        const data = await response.json();
        const articles = Array.isArray(data.articles) ? data.articles : [];

        if (!articles.length) return;

        if (page === 'index') {
            renderFeatured(articles[0]);
            renderGrid(articles.slice(1, 7));
        } else {
            renderGrid(articles);
        }
    } catch (error) {
        console.error('Error cargando artículos:', error);
    }
}

document.addEventListener('DOMContentLoaded', loadArticles);
