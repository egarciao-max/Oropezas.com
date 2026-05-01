const API_BASE = 'https://oropezas.enriquegarciaoropeza.workers.dev';

function getArticleUrl(article) {
    const slug = article.slug || (article.url && article.url.split('slug=')[1]);
    return slug ? `article.html?slug=${slug}` : '#';
}

function getImageUrl(article) {
    if (article.featuredImage) return article.featuredImage;
    if (article.image) return article.image;
    if (article.slug) return `${API_BASE}/api/media/articles/noticias/${article.slug}.jpg`;
    return 'https://via.placeholder.com/800x450?text=Oropezas.com';
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function(m) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        var d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch(e) { return dateStr; }
}

function renderFeatured(article) {
    var container = document.getElementById('featured-container');
    if (!container || !article) return;

    container.innerHTML =
        '<article class="featured-article">' +
            '<div class="featured-image">' +
                '<a href="' + getArticleUrl(article) + '">' +
                    '<img src="' + getImageUrl(article) + '" alt="' + escapeHtml(article.title) + '"' +
                    ' onerror="this.src=\'https://via.placeholder.com/800x450?text=Oropezas.com\'"' +
                    ' style="width:100%;height:100%;object-fit:cover;border-radius:2px;">' +
                '</a>' +
            '</div>' +
            '<div class="featured-content">' +
                '<span class="news-tag">' + escapeHtml(article.category || 'Noticias') + '</span>' +
                '<a href="' + getArticleUrl(article) + '" style="text-decoration:none;color:inherit;">' +
                    '<h1>' + escapeHtml(article.title) + '</h1>' +
                '</a>' +
                '<p class="excerpt">' + escapeHtml(article.excerpt || article.subtitle || '') + '</p>' +
                '<div class="article-meta">' +
                    '<span>' + formatDate(article.date) + '</span>' +
                    '<span>' + escapeHtml(article.category || '') + '</span>' +
                '</div>' +
                '<a href="' + getArticleUrl(article) + '" class="read-more">Leer más</a>' +
            '</div>' +
        '</article>';
}

function renderGrid(articles) {
    var container = document.getElementById('articles-grid');
    if (!container) return;

    if (!articles.length) {
        container.innerHTML = '<p style="color:var(--gray-text)">No hay artículos disponibles.</p>';
        return;
    }

    container.innerHTML = articles.map(function(article, index) {
        return '<article class="news-card" style="animation-delay:' + (0.1 * index) + 's">' +
            '<div class="news-card-image">' +
                '<a href="' + getArticleUrl(article) + '">' +
                    '<img src="' + getImageUrl(article) + '" alt="' + escapeHtml(article.title) + '"' +
                    ' onerror="this.src=\'https://via.placeholder.com/400x225?text=Oropezas.com\'"' +
                    ' style="width:100%;height:100%;object-fit:cover;">' +
                '</a>' +
            '</div>' +
            '<h3>' + escapeHtml(article.title) + '</h3>' +
            '<p class="news-card-excerpt">' + escapeHtml(article.excerpt || article.subtitle || '') + '</p>' +
            '<p class="news-card-date">' + formatDate(article.date) + '</p>' +
            '<a href="' + getArticleUrl(article) + '" class="news-card-link">Leer más</a>' +
        '</article>';
    }).join('');
}

async function loadArticles() {
    try {
        var page = document.body.dataset.page || 'index';
        var response = await fetch(API_BASE + '/api/articles');
        var data = await response.json();
        var articles = Array.isArray(data.articles) ? data.articles : [];

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
