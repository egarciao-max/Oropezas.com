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
    var page = document.body.dataset.page || 'index';

    // Show embedded fallback IMMEDIATELY so page is never blank
    if (page === 'index') {
        renderFeatured(EMBEDDED_ARTICLES[0]);
        renderGrid(EMBEDDED_ARTICLES.slice(1, 7));
    } else {
        renderGrid(EMBEDDED_ARTICLES);
    }

    // Then try API in background and update if successful
    try {
        var controller = new AbortController();
        var timeoutId = setTimeout(function() { controller.abort(); }, 4000);
        var response = await fetch(API_BASE + '/api/articles', { signal: controller.signal });
        clearTimeout(timeoutId);
        var data = await response.json();
        var articles = Array.isArray(data.articles) ? data.articles : [];

        if (articles.length > 0) {
            if (page === 'index') {
                renderFeatured(articles[0]);
                renderGrid(articles.slice(1, 7));
            } else {
                renderGrid(articles);
            }
        }
    } catch (error) {
        console.error('Error cargando artículos:', error);
        // Fallback articles already visible, no action needed
    }
}

function showNoArticles() {
    var featured = document.getElementById('featured-container');
    var grid = document.getElementById('articles-grid');
    if (featured) featured.innerHTML = '<p style="color:var(--gray-text);padding:2rem;text-align:center;">No hay artículos disponibles.</p>';
    if (grid) grid.innerHTML = '<p style="color:var(--gray-text);padding:2rem;text-align:center;">No hay artículos disponibles.</p>';
}

function showLoadError() {
    var featured = document.getElementById('featured-container');
    var grid = document.getElementById('articles-grid');
    var msg = '<p style="color:var(--gray-text);padding:2rem;text-align:center;">⚠️ No se pudieron cargar los artículos. Verifica tu conexión o intenta de nuevo más tarde.</p>';
    if (featured) featured.innerHTML = msg;
    if (grid) grid.innerHTML = msg;
}

document.addEventListener('DOMContentLoaded', loadArticles);

// ─── EMBEDDED FALLBACK ARTICLES (works offline) ───
const EMBEDDED_ARTICLES = [
  {
    slug: 'may-the-4th-mexico', title: 'May the 4th: Mexico Joins the Global Star Wars Day Celebration',
    excerpt: 'May 4th is recognized worldwide as Star Wars Day. Mexican fans participate in the global celebration through movie screenings, merchandise releases, and online community events.',
    category: 'Noticias', date: '2026-05-04', author: 'Redacción Oropezas',
    image: '', featuredImage: '',
    html: '<p><strong>May the 4th be with you.</strong> Every year on May 4th, millions of Star Wars fans across the globe celebrate the iconic franchise. The date was chosen for its phonetic similarity to the series\' famous greeting: "May the Force be with you."</p><h2>A Worldwide Celebration</h2><p>Star Wars Day began as an informal fan tradition and has grown into an officially recognized cultural event. Disney, which acquired Lucasfilm in 2012, now coordinates global marketing around the date, including special merchandise drops, streaming content releases, and themed events at Disney parks and retail locations.</p><p>In 2024, Disney+ released multiple Star Wars series episodes and exclusive bonus content on May 4th, a practice that has continued annually.</p><h2>Mexican Fans Participate</h2><p>Mexican fans connect to the global celebration primarily through digital platforms. Social media hashtags like #StarWarsDay and #MayThe4th trend nationwide as fans share collections, artwork, and viewing marathons.</p><p>Cinemex and Cinépolis, Mexico\'s largest cinema chains, have historically screened Star Wars films on or around May 4th at select locations. Retailers including Liverpool and Sanborns typically offer promotional discounts on Star Wars merchandise during the first week of May.</p><p>Convention centres in Mexico City, Guadalajara, and Monterrey occasionally schedule pop culture events near this date, though specific 2026 programming has not been widely announced.</p><p><em>Star Wars remains one of the highest-grossing film franchises in history, with a cumulative worldwide box office exceeding $10 billion across theatrical releases.</em></p>'
  },
  {
    slug: 'slp-inaugura-parque', title: 'San Luis Potosí Inaugura Nuevo Parque Urbano',
    excerpt: 'El gobierno estatal inauguró un nuevo parque urbano de 12 hectáreas en la zona norte de la capital potosina, con áreas verdes, canchas deportivas y un lago artificial.',
    category: 'Noticias', date: '2026-05-04', author: 'Redacción Oropezas',
    image: '', featuredImage: ''
  },
  {
    slug: 'tec-slp-nuevo-laboratorio', title: 'Tec de Monterrey Campus SLP Abre Laboratorio de IA',
    excerpt: 'El Instituto Tecnológico y de Estudios Superiores de Monterrey en San Luis Potosí inauguró un laboratorio de inteligencia artificial enfocado en investigación aplicada.',
    category: 'Tecnología', date: '2026-05-03', author: 'Tech Desk',
    image: '', featuredImage: ''
  },
  {
    slug: 'atletico-potosino-campeon', title: 'Atlético Potosino se Corona Campeón de la Liga Premier',
    excerpt: 'En un emocionante partido de final, el Atlético Potosino logró el campeonato tras vencer 2-1 al Real de Catorce en el Estadio Alfonso Lastras.',
    category: 'Deportes', date: '2026-05-02', author: 'Deportes Oropezas',
    image: '', featuredImage: ''
  },
  {
    slug: 'festival-cultural-zacatecas', title: 'Festival Internacional de Arte Contemporáneo Llega a la Zona Centro',
    excerpt: 'Más de 50 artistas nacionales e internacionales participarán en el festival que transformará las calles del centro histórico en galerías al aire libre.',
    category: 'Noticias', date: '2026-05-01', author: 'Cultura SLP',
    image: '', featuredImage: ''
  },
  {
    slug: 'inversion-automotriz-slp', title: 'Nueva Inversión Automotriz Generará 2,000 Empleos en SLP',
    excerpt: 'Una empresa alemana anunció la expansión de su planta de manufactura en el Parque Industrial de San Luis Potosí, con una inversión de 150 millones de dólares.',
    category: 'Noticias', date: '2026-04-30', author: 'Economía Oropezas',
    image: '', featuredImage: ''
  },
  {
    slug: 'alerta-calor-extremo', title: 'Protección Civil Emite Alerta por Calor Extremo en el Estado',
    excerpt: 'Se esperan temperaturas superiores a 40°C en la zona centro y media del estado. Se recomienda hidratación constante y evitar actividades al aire libre entre las 12:00 y 16:00 hrs.',
    category: 'Noticias', date: '2026-04-29', author: 'Protección Civil',
    image: '', featuredImage: ''
  }
];

function loadEmbeddedFallback() {
    var page = document.body.dataset.page || 'index';
    var articles = EMBEDDED_ARTICLES;
    if (page === 'index') {
        renderFeatured(articles[0]);
        renderGrid(articles.slice(1, 7));
    } else {
        renderGrid(articles);
    }
}
