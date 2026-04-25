function getSlugFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("slug");
}

function normalizeContentBlock(block) {
  if (typeof block === "string") {
    return { type: "paragraph", text: block };
  }

  if (block && typeof block === "object") {
    if (typeof block.text === "string") {
      return { type: block.type || "paragraph", text: block.text };
    }

    if (typeof block.content === "string") {
      return { type: block.type || "paragraph", text: block.content };
    }
  }

  return null;
}

async function loadArticle() {
  const slug = getSlugFromUrl();

  if (!slug) {
    document.getElementById("article-title").textContent = "Artículo no encontrado";
    return;
  }

  try {
    const response = await fetch(`/data/articles/${slug}.json`);

    if (!response.ok) {
      throw new Error("No se pudo cargar el artículo");
    }

    const article = await response.json();

    document.title = `${article.title} - Oropezas.com`;

    document.getElementById("article-category").textContent = article.category || "";
    document.getElementById("article-title").textContent = article.title || "";
    document.getElementById("article-date").textContent = article.date || "";
    document.getElementById("article-excerpt").textContent = article.excerpt || "";

    const imageEl = document.getElementById("article-image");
    if (article.image) {
      imageEl.src = article.image;
      imageEl.alt = article.title || "Imagen del artículo";
      imageEl.style.display = "block";
    } else {
      imageEl.style.display = "none";
    }

    const videoEl = document.getElementById("article-video");
    if (article.video) {
      videoEl.src = article.video;
      videoEl.style.display = "block";
    } else {
      videoEl.style.display = "none";
    }

    const contentEl = document.getElementById("article-content");
    contentEl.innerHTML = "";

    if (Array.isArray(article.content)) {
      article.content.forEach(block => {
        const normalized = normalizeContentBlock(block);
        if (!normalized || !normalized.text) return;

        if (normalized.type === "heading") {
          const h2 = document.createElement("h2");
          h2.textContent = normalized.text;
          contentEl.appendChild(h2);
        } else {
          const p = document.createElement("p");
          p.textContent = normalized.text;
          contentEl.appendChild(p);
        }
      });
    } else if (typeof article.content === "string") {
      const p = document.createElement("p");
      p.textContent = article.content;
      contentEl.appendChild(p);
    }

  } catch (error) {
    document.getElementById("article-title").textContent = "Error al cargar el artículo";
    document.getElementById("article-excerpt").textContent = "";
    console.error(error);
  }
}

loadArticle();