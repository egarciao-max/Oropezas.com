const API_BASE = 'https://oropezas.enriquegarciaoropeza.workers.dev';

function getArticleUrl(article) {
    const slug = article.slug || (article.url && article.url.split('slug=')[1]);
    return slug ? `article.html?slug=${slug}` : '#';
}

function getImageUrl(article) {
    if (article.featuredImage && article.featuredImage !== '/LOGO.jpeg' && article.featuredImage !== '') return article.featuredImage;
    if (article.image && article.image !== '/LOGO.jpeg' && article.image !== '') return article.image;
    return '';
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

    var imgUrl = getImageUrl(article);
    var imgHtml;
    if (imgUrl) {
        imgHtml = '<div class="featured-image" style="position:relative;overflow:hidden;"><a href="' + getArticleUrl(article) + '">' +
            '<img src="' + imgUrl + '" alt="' + escapeHtml(article.title) + '"' +
            ' onerror="this.style.display=\'none\';this.parentElement.parentElement.style.background=\'linear-gradient(135deg,#c41e3a 0%,#8b0000 100%)\';this.parentElement.parentElement.innerHTML=\'<div style=display:flex;align-items:center;justify-content:center;height:100%;color:#fff;font-size:1.2rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;padding:2rem;>' + escapeHtml(article.category || 'Noticias') + '</div>\';"' +
            ' style="width:100%;height:100%;object-fit:cover;border-radius:2px;display:block;">' +
          '</a></div>';
    } else {
        imgHtml = '<div class="featured-image" style="background:linear-gradient(135deg,#c41e3a 0%,#8b0000 100%);display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.2rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;text-align:center;padding:2rem;">' + escapeHtml(article.category || 'Noticias') + '</div>';
    }

    container.innerHTML =
        '<article class="featured-article">' +
            imgHtml +
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
        var imgUrl = getImageUrl(article);
        var imgHtml;
        if (imgUrl) {
            imgHtml = '<a href="' + getArticleUrl(article) + '" style="display:block;width:100%;height:100%;">' +
                '<img src="' + imgUrl + '" alt="' + escapeHtml(article.title) + '"' +
                ' onerror="this.style.display=\'none\';this.parentElement.innerHTML=\'<div style=width:100%;height:100%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.75rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;>' + escapeHtml(article.category || 'Noticias') + '</div>\';"' +
                ' style="width:100%;height:100%;object-fit:cover;display:block;">' +
              '</a>';
        } else {
            imgHtml = '<div style="width:100%;height:100%;background:var(--primary);display:flex;align-items:center;justify-content:center;color:#fff;font-size:0.75rem;font-weight:700;letter-spacing:1px;text-transform:uppercase;">' + escapeHtml(article.category || 'Noticias') + '</div>';
        }
        return '<article class="news-card" style="animation-delay:' + (0.1 * index) + 's">' +
            '<div class="news-card-image">' + imgHtml + '</div>' +
            '<h3>' + escapeHtml(article.title) + '</h3>' +
            '<p class="news-card-excerpt">' + escapeHtml(article.excerpt || article.subtitle || '') + '</p>' +
            '<p class="news-card-date">' + formatDate(article.date) + '</p>' +
            '<a href="' + getArticleUrl(article) + '" class="news-card-link">Leer más</a>' +
        '</article>';
    }).join('');
}

function loadArticles() {
    var page = document.body.dataset.page || 'index';

    // Show embedded articles directly — no API dependency
    if (page === 'index') {
        renderFeatured(EMBEDDED_ARTICLES[0]);
        renderGrid(EMBEDDED_ARTICLES.slice(1, 7));
    } else {
        renderGrid(EMBEDDED_ARTICLES);
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadArticles);
} else {
    loadArticles();
}

// ─── EMBEDDED FALLBACK ARTICLES (works offline) ───
const EMBEDDED_ARTICLES = [
  {
    slug: 'hondius-hantavirus-outbreak-2026', title: '🚨 MV Hondius: Brote de Hantavirus en Crucero de Expedición',
    excerpt: 'El crucero MV Hondius está varado frente a Cabo Verde tras un brote de hantavirus que ha dejado tres muertos, dos casos confirmados y cinco sospechosos entre 147 personas a bordo.',
    category: 'Noticias', date: '2026-05-05', author: 'Redacción Oropezas',
    image: '/LOGO.jpeg', featuredImage: '/LOGO.jpeg',
    html: '<p><strong>🚨 Última Hora:</strong> El <strong>MV Hondius</strong>, un crucero de expedición de bandera holandesa operado por <em>Oceanwide Expeditions</em>, está actualmente anclado frente a <strong>Cabo Verde</strong> en el océano Atlántico tras un mortal brote de <strong>hantavirus</strong> — una rara enfermedad transmitida por roedores que ha dejado tres muertos y al barco varado.</p><h2>Las Cifras</h2><ul><li><strong>Total a bordo:</strong> 147 (88 pasajeros + 59 tripulantes)</li><li><strong>Casos confirmados:</strong> 2</li><li><strong>Casos sospechosos:</strong> 5</li><li><strong>Muertes:</strong> 3</li><li><strong>En estado crítico:</strong> 1 (UCI, Johannesburgo)</li><li><strong>Nacionalidades:</strong> 23</li></ul><h2>Cronología del Brote</h2><ul><li><strong>6 de abril:</strong> Un hombre holandés de 70 años desarrolla síntomas</li><li><strong>11 de abril:</strong> El holandés muere a bordo — primera víctima mortal</li><li><strong>26 de abril:</strong> Su esposa de 69 años muere en Johannesburgo tras desplomarse en el aeropuerto</li><li><strong>27 de abril:</strong> Un hombre británico es evacuado a Sudáfrica; ahora en UCI con hantavirus confirmado</li><li><strong>2 de mayo:</strong> Muere un nacional alemán — tercera víctima mortal confirmada</li></ul><h2>Por Qué Esto es Sin Precedentes</h2><p>El hantavirus es <strong>extremadamente raro en cruceros</strong>. A diferencia del norovirus — que causa más de 18 brotes anuales en cruceros — el hantavirus es transmitido por roedores, generalmente a través del contacto con excrementos, orina o saliva de roedores infectados.</p><p>Sin embargo, el <strong>virus Andes</strong> — endémico de Argentina y Chile — es la única cepa de hantavirus conocida por transmitirse de persona a persona a través de contacto cercano. Dado que el crucero partió de Argentina, los expertos sospechan que esta cepa podría estar involucrada.</p><h2>Varados en Alta Mar</h2><p>Las autoridades de <strong>Cabo Verde</strong> han rechazado dejar atracar al barco, citando preocupaciones de salud pública. El barco ahora considera navegar hacia <strong>Las Palmas o Tenerife</strong> en las Islas Canarias para el desembarco.</p><hr><p><em>Sources: The Guardian, Euronews | Publicado: 5 de mayo de 2026</em></p>'
  },
  {
    slug: 'may-the-4th-mexico', title: 'San Luis Potosí Leads Northeast Mexico in Federal Tourism Plan 2030',
    excerpt: 'San Luis Potosí has been designated as the lead state for Mexico\'s Northeast region under the Federal Tourism Plan 2030, positioning the state for major tourism infrastructure investment.',
    category: 'Noticias', date: '2026-05-04', author: 'Redacción Oropezas',
    image: 'https://oropezas.enriquegarciaoropeza.workers.dev/api/media/articles/noticias/may-the-4th-2026.png', featuredImage: 'https://oropezas.enriquegarciaoropeza.workers.dev/api/media/articles/noticias/may-the-4th-2026.png',
    html: '<p><strong>San Luis Potosí has been selected to lead Mexico\'s Northeast region</strong> under the federal government\'s Tourism Plan 2030, a strategic initiative announced by federal tourism authorities. The designation positions the state to receive priority funding for tourism infrastructure over the next five years.</p><h2>Federal Tourism Plan 2030</h2><p>The plan is part of a broader federal strategy to diversify Mexico\'s tourism economy beyond traditional beach destinations. States designated as regional leaders receive accelerated funding for road improvements, hospitality training programs, and international marketing campaigns.</p><p>San Luis Potosí\'s selection reflects its growing importance as a cultural and historical destination, home to UNESCO World Heritage sites including the historic centre of San Luis Potosí city and the Franciscan missions of the Sierra Gorda.</p><h2>Worldskills Mexico Coming to SLP</h2><p>Separately, San Luis Potosí is preparing to host Worldskills Mexico, a national technical skills competition for young professionals. The four-day event will feature competitions in categories including industrial mechanics, culinary arts, web design, and robotics.</p><p>The competition is expected to draw participants from across Mexico and generate significant economic activity for local hotels and restaurants.</p><h2>Other State Updates</h2><p>The National Electoral Institute has opened registration for citizen participation in the 2027 electoral process. State congress is also conducting technical working sessions on reforms to the Organic Law of the Judicial Branch.</p><p>Meanwhile, concerns continue about Highway 57 on the San Luis Potosí–Matehuala section, where road conditions have drawn attention from both state officials and federal transportation authorities.</p><p><em>Temperatures in San Luis Potosí today are approximately 28°C with clear skies.</em></p>'
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
