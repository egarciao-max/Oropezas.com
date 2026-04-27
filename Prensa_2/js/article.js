const WORKER_API = 'https://oropezas.enriquegarciaoropeza.workers.dev';

function getSlugFromUrl() {
	return new URLSearchParams(window.location.search).get('slug');
}

function normalizeContentBlock(block) {
	if (typeof block === 'string') {
		return { html: `<p>${block}</p>` };
	}

	if (block && typeof block === 'object') {
		if (typeof block.html === 'string') {
			return { html: block.html };
		}

		if (typeof block.text === 'string') {
			return { html: `<p>${block.text}</p>` };
		}

		if (typeof block.content === 'string') {
			return { html: `<p>${block.content}</p>` };
		}
	}

	return null;
}

function appendHtmlBlock(container, html) {
	const wrapper = document.createElement('div');
	wrapper.innerHTML = html;
	Array.from(wrapper.childNodes).forEach((node) => {
		container.appendChild(node);
	});
}

async function fetchArticleBySlug(slug) {
	const response = await fetch(`${WORKER_API}/api/articles?slug=${encodeURIComponent(slug)}`);
	if (!response.ok) {
		throw new Error(`Error cargando artículo: ${response.status}`);
	}

	const data = await response.json();
	if (!Array.isArray(data.articles) || !data.articles.length) {
		return null;
	}

	const articleSummary = data.articles[0];
	const detailResponse = await fetch(`${WORKER_API}/api/article/${encodeURIComponent(slug)}`);
	if (!detailResponse.ok) {
		return articleSummary;
	}

	return detailResponse.json();
}

function renderArticle(article) {
	document.title = `${article.title || 'Artículo'} - Oropezas.com`;
	document.getElementById('article-category').textContent = article.category || '';
	document.getElementById('article-title').textContent = article.title || '';
	document.getElementById('article-date').textContent = article.date || '';
	document.getElementById('article-excerpt').textContent = article.excerpt || article.subtitle || '';

	const imageEl = document.getElementById('article-image');
	const featuredImage = article.featuredImage || article.image || '';
	if (featuredImage) {
		imageEl.src = featuredImage;
		imageEl.alt = article.title || 'Imagen del artículo';
		imageEl.style.display = 'block';
	} else {
		imageEl.style.display = 'none';
	}

	const videoEl = document.getElementById('article-video');
	const videoUrl = article.videoFile || article.videoEmbed || article.video;
	if (videoUrl) {
		if (article.videoEmbed) {
			videoEl.outerHTML = `<iframe id="article-video" class="featured-video" src="${article.videoEmbed}" frameborder="0" allowfullscreen style="display:block;width:100%;aspect-ratio:16/9;"></iframe>`;
		} else {
			videoEl.src = videoUrl;
			videoEl.style.display = 'block';
		}
	} else {
		videoEl.style.display = 'none';
	}

	const contentEl = document.getElementById('article-content');
	contentEl.innerHTML = '';

	if (Array.isArray(article.content) && article.content.length) {
		article.content.forEach((block) => {
			const normalized = normalizeContentBlock(block);
			if (!normalized) return;
			appendHtmlBlock(contentEl, normalized.html);
		});
		return;
	}

	if (article.html) {
		appendHtmlBlock(contentEl, article.html);
	}
}

async function loadArticle() {
	const slug = getSlugFromUrl();

	if (!slug) {
		document.getElementById('article-title').textContent = 'Artículo no encontrado';
		return;
	}

	try {
		const article = await fetchArticleBySlug(slug);
		if (!article) {
			document.getElementById('article-title').textContent = 'Artículo no encontrado';
			return;
		}

		renderArticle(article);
	} catch (error) {
		console.error('Error cargando artículo dinámico:', error);
		document.getElementById('article-title').textContent = 'Artículo no encontrado';
	}
}

loadArticle();
