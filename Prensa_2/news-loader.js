// news-loader.js - Carga artículos dinámicamente desde el Worker
const API_BASE = 'https://oropezas.enriquegarciaoropeza.workers.dev';

async function loadArticles() {
  try {
    const page = document.body.dataset.page || 'index';
    const category = page === 'deportes' ? 'deportes' : null;

    let url = `${API_BASE}/api/articles`;
    if (category) url += `?category=${category}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.articles || !data.articles.length) {
      console.log('No hay artículos en el índice');
      return;
    }

    if (page === 'index') {
      renderFeatured(data.articles.filter(a => a.featured).slice(0, 2));
      renderLatest(data.articles.slice(0, 3));
    } else if (page === 'noticias') {
      renderGrid(data.articles);
    } else if (page === 'deportes') {
      renderGrid(data.articles.filter(a => a.category === 'deportes'));
    }
  } catch (e) {
    console.log('Error cargando artículos:', e);
  }
}

function renderFeatured(list) {
  const el = document.querySelector('.featured-section');
  if (!el || !list.length) return;
  
  el.innerHTML = list.map(a => `
    <article class="featured-article">
      <div class="featured-image">
        <img src="${a.image}" alt="${a.title}" loading="lazy" onerror="this.style.display='none'">
      </div>
      <div class="featured-content">
        <h1>${a.title}</h1>
        <p class="excerpt">${a.excerpt}</p>
        <div class="article-meta">
          <span>${formatDate(a.date)}</span>
          <span>${a.category}</span>
        </div>
        <a href="${a.url}" class="read-more">Leer más</a>
      </div>
    </article>
  `).join('');
}

function renderLatest(list) {
  const grid = document.querySelector('.news-grid');
  if (!grid) return;
  
  grid.innerHTML = list.map(a => `
    <article class="news-card">
      <div class="news-card-image">
        <img src="${a.image}" alt="" loading="lazy" onerror="this.style.display='none'">
      </div>
      <h3>${a.title}</h3>
      <p class="news-card-excerpt">${a.excerpt}</p>
      <p class="news-card-date">${formatDate(a.date)}</p>
      <a href="${a.url}" class="news-card-link">Leer más</a>
    </article>
  `).join('');
}

function renderGrid(list) {
  const grid = document.querySelector('.articles-grid');
  if (!grid) return;
  
  grid.innerHTML = list.map(a => `
    <article class="article-card">
      <div class="article-card-image">
        <img src="${a.image}" alt="" loading="lazy" onerror="this.style.display='none'">
      </div>
      <span class="article-card-category">${a.subcategory || a.category}</span>
      <h3>${a.title}</h3>
      <p class="article-card-excerpt">${a.excerpt}</p>
      <p class="article-card-date">${formatDate(a.date)}</p>
      <a href="${a.url}" class="article-card-link">Leer más</a>
    </article>
  `).join('');
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

document.addEventListener('DOMContentLoaded', loadArticles);
