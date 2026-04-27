const API_BASE = 'https://oropezas.enriquegarciaoropeza.workers.dev';

function getArticleUrl(article) {
	if (article.slug) {
		return `article.html?slug=${article.slug}`;
	}

	if (article.url && article.url.includes('slug=')) {
		return article.url;
	}

	return '#';
}

function getImageUrl(article) {
	return article.featuredImage || article.image || '';
}

function escapeHtml(value) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function formatDate(dateStr) {
	if (!dateStr) return '';
	const date = new Date(dateStr);
	if (Number.isNaN(date.getTime())) return dateStr;
	return date.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function fetchArticles() {
	const page = document.body.dataset.page || 'index';
	const params = new URLSearchParams();

	if (page === 'index' || page === 'noticias') {
		params.set('category', 'noticias');
	}

	if (page === 'deportes') {
		params.set('category', 'deportes');
	}

	const response = await fetch(`${API_BASE}/api/articles?${params.toString()}`);
	if (!response.ok) {
		throw new Error(`Error cargando artículos: ${response.status}`);
	}

	return response.json();
}

function renderFeatured(article) {
	const sections = Array.from(document.querySelectorAll('.featured-section'));
	const container = sections[0];
	if (!container || !article) return;

	sections.slice(1).forEach((section) => section.remove());

	const imageUrl = getImageUrl(article);
	container.innerHTML = `
		<article class="featured-article">
			<div class="featured-image">
				${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(article.title)}" loading="lazy">` : ''}
			</div>
			<div class="featured-content">
				<h1>${escapeHtml(article.title)}</h1>
				<p class="excerpt">${escapeHtml(article.excerpt || '')}</p>
				<div class="article-meta">
					<span>${escapeHtml(formatDate(article.date))}</span>
					<span>${escapeHtml(article.category || 'noticias')}</span>
				</div>
				<a href="${escapeHtml(getArticleUrl(article))}" class="read-more">Leer más</a>
			</div>
		</article>
	`;
}

function renderLatest(list) {
	const grid = document.querySelector('.news-grid');
	if (!grid) return;

	grid.innerHTML = list.map((article) => {
		const imageUrl = getImageUrl(article);
		return `
			<article class="news-card">
				<div class="news-card-image">
					${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(article.title)}" loading="lazy">` : ''}
				</div>
				<h3>${escapeHtml(article.title)}</h3>
				<p class="news-card-excerpt">${escapeHtml(article.excerpt || '')}</p>
				<p class="news-card-date">${escapeHtml(formatDate(article.date))}</p>
				<a href="${escapeHtml(getArticleUrl(article))}" class="news-card-link">Leer más</a>
			</article>
		`;
	}).join('');
}

function renderGrid(list) {
	const grid = document.querySelector('.articles-grid');
	if (!grid) return;

	grid.innerHTML = list.map((article) => {
		const imageUrl = getImageUrl(article);
		return `
			<article class="article-card">
				<div class="article-card-image">
					${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(article.title)}" loading="lazy">` : ''}
				</div>
				<span class="article-card-category">${escapeHtml(article.subcategory || article.category || 'noticias')}</span>
				<h3>${escapeHtml(article.title)}</h3>
				<p class="article-card-excerpt">${escapeHtml(article.excerpt || '')}</p>
				<p class="article-card-date">${escapeHtml(formatDate(article.date))}</p>
				<a href="${escapeHtml(getArticleUrl(article))}" class="article-card-link">Leer más</a>
			</article>
		`;
	}).join('');
}

async function loadArticles() {
	try {
		const page = document.body.dataset.page || 'index';
		const data = await fetchArticles();
		const articles = Array.isArray(data.articles) ? data.articles : [];
		const pagination = document.querySelector('.pagination');

		if (!articles.length) return;

		if (page === 'index') {
			renderFeatured(articles[0]);
			renderLatest(articles.slice(1, 4));
			return;
		}

		if (page === 'noticias' || page === 'deportes') {
			if (pagination) {
				pagination.style.display = 'none';
			}
			renderGrid(articles);
		}
	} catch (error) {
		console.error('Error cargando artículos dinámicos:', error);
	}
}

document.addEventListener('DOMContentLoaded', loadArticles);
