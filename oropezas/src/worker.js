// src/worker.js - OROPEZAS.COM WORKER UNIFICADO
// Chat + Suscripciones + Contacto + Rastreador + Push + AI AGENTS

const ALLOWED_ORIGINS = [
  'https://oropezas.com',
  'https://www.oropezas.com',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5500',
  'http://localhost:8000',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8000',
  'https://oropezas.pages.dev',
  /^https:\/\/[a-zA-Z0-9-]+\.oropezas\.pages\.dev$/,
  /^https:\/\/[a-zA-Z0-9-]+\.oropezas\.com$/
];

const CONFIG = {
  FROM_EMAIL: 'noreply@oropezas.com',
  ADMIN_EMAIL: ['enrique@oropezas.com', 'majo@oropezas.com'],
  SITE_URL: 'https://oropezas.com',
  WORKER_URL: 'https://oropezas.enriquegarciaoropeza.workers.dev'
};

function extraerTextoGemini(geminiData) {
  return geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function parsearArticuloGemini(texto) {
  if (!texto) return null;
  try {
    const jsonMatch = texto.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (e) {
    return null;
  }
}

function esRutaImagenValida(valor) {
  if (!valor || typeof valor !== 'string') return false;
  const normalizado = valor.trim();
  if (!normalizado) return false;
  return (
    normalizado.startsWith('http://') ||
    normalizado.startsWith('https://') ||
    normalizado.startsWith('/') ||
    normalizado.includes('/') ||
    /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(normalizado)
  );
}

function slugify(texto) {
  return (texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 60);
}

function getFolderByCategory(category) {
  return category === 'deportes' ? 'SLPOPEN2026' :
         category === 'tecnologia' ? 'tecnologia' : 'noticias';
}

function getMimeExtension(mimeType) {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/jpeg') return 'jpg';
  return 'bin';
}

function getContentTypeByKey(key) {
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.webp')) return 'image/webp';
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getMediaUrl(key) {
  return `${CONFIG.WORKER_URL}/api/media/${key}`;
}

function extraerKeyMediaDesdeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  if (url.startsWith(`${CONFIG.WORKER_URL}/api/media/`)) {
    return url.replace(`${CONFIG.WORKER_URL}/api/media/`, '');
  }
  if (url.startsWith('/api/media/')) {
    return url.replace('/api/media/', '');
  }
  return null;
}

function construirArticuloNormalizado(article, { topic, category, textoGemini = '' }) {
  const title = article?.title?.trim() || topic;
  const slug = slugify(title) || `articulo-${Date.now()}`;
  const folder = getFolderByCategory(category);
  const fallbackHtml = `<p>Oropezas AI generó un borrador inicial sobre ${title}.</p><p>Este contenido requiere revisión editorial antes de su difusión final.</p>`;
  const html = article?.html?.trim() && article.html.trim() !== '{}' ? article.html : fallbackHtml;
  const excerptBase = article?.excerpt?.trim() && article.excerpt.trim() !== '{}' ?
    article.excerpt.trim() :
    `Borrador inicial sobre ${title} para revisión editorial.`;
  const tags = Array.isArray(article?.tags) && article.tags.length ? article.tags : [category];
  const suggestedImage = esRutaImagenValida(article?.suggestedImage) ? article.suggestedImage : `${folder}/FOTOS/${slug}.jpg`;
  const featuredImage = esRutaImagenValida(article?.featuredImage) ? article.featuredImage :
    esRutaImagenValida(article?.image) ? article.image :
    suggestedImage;
  const subtitle = article?.subtitle?.trim() || 'Generado por Oropezas AI';
  const content = Array.isArray(article?.content) && article.content.length ? article.content : htmlToContentBlocks(html);

  return {
    ...article,
    title,
    subtitle,
    excerpt: excerptBase,
    html,
    tags,
    category,
    content,
    suggestedImage,
    featuredImage,
    image: featuredImage,
    folder
  };
}

async function generarImagenConNanoBanana(article, env, { slug, category }) {
  if (!env.OROPEZAS_MEDIA) {
    throw new Error('Binding OROPEZAS_MEDIA no configurado');
  }

  const model = env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image-preview';
  const prompt = `Genera una imagen periodística editorial fotorrealista, horizontal 16:9, alta calidad, sin texto, sin marcas de agua, para una nota de Oropezas.com.
Tema: ${article.title}
Categoría: ${category}
Resumen: ${article.excerpt}
Contexto: ${article.subtitle || 'Noticias de San Luis Potosí'}
Estilo: fotografía documental, iluminación natural, composición limpia, apta para portada de periódico digital local.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE']
        }
      })
    }
  );

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.message || 'Error generando imagen con Gemini');
  }

  const imagePart = data?.candidates?.[0]?.content?.parts?.find((part) => part.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error('Nano Banana 2 no devolvió imagen');
  }

  const mimeType = imagePart.inlineData.mimeType || 'image/png';
  const extension = getMimeExtension(mimeType);
  const key = `articles/${category}/${slug}.${extension}`;
  const bytes = base64ToUint8Array(imagePart.inlineData.data);

  await env.OROPEZAS_MEDIA.put(key, bytes, {
    httpMetadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000, immutable'
    },
    customMetadata: {
      model,
      slug,
      category,
      generatedAt: new Date().toISOString()
    }
  });

  return {
    key,
    url: getMediaUrl(key),
    mimeType,
    model
  };
}

async function resolverImagenArticulo(article, env, { slug, category }) {
  const featuredKey = extraerKeyMediaDesdeUrl(article?.featuredImage);
  if (featuredKey) {
    return { key: featuredKey, url: getMediaUrl(featuredKey), generated: false, model: article?.imageModel || null };
  }
  const imageKey = extraerKeyMediaDesdeUrl(article?.image);
  if (imageKey) {
    return { key: imageKey, url: getMediaUrl(imageKey), generated: false, model: article?.imageModel || null };
  }
  if (article?.imageKey) {
    return { key: article.imageKey, url: getMediaUrl(article.imageKey), generated: false, model: article?.imageModel || null };
  }
  return generarImagenConNanoBanana(article, env, { slug, category });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ============================================================
    // AI AGENTS - NUEVOS ENDPOINTS
    // ============================================================

    if (url.pathname === '/api/agent/write' && request.method === 'POST') {
      return handleAgentWrite(request, env, corsHeaders);
    }
    if (url.pathname === '/api/agent/publish' && request.method === 'POST') {
      return handleAgentPublish(request, env, corsHeaders);
    }
    if (url.pathname === '/api/agent/blast' && request.method === 'POST') {
      return handleAgentBlast(request, env, corsHeaders);
    }
    if (url.pathname === '/api/agent/generate-image' && request.method === 'POST') {
      return handleAgentGenerateImage(request, env, corsHeaders);
    }
    if (url.pathname === '/api/agent/dashboard' && request.method === 'GET') {
      return handleAgentDashboard(request, env, corsHeaders);
    }
    if (url.pathname === '/api/agent/auto-publish' && request.method === 'POST') {
      return handleAgentAutoPublish(request, env, corsHeaders);
    }
    if (url.pathname.startsWith('/api/article/') && request.method === 'GET') {
      return handleGetArticleBySlug(request, env, corsHeaders);
    }
    if (url.pathname === '/api/chat/webhook' && request.method === 'POST') {
      return handleChatWebhook(request, env, corsHeaders);
    }
    if (url.pathname === '/api/articles' && request.method === 'GET') {
      return handleGetArticles(request, env, corsHeaders);
    }
    if (url.pathname.startsWith('/api/media/') && (request.method === 'GET' || request.method === 'HEAD')) {
      return handleGetMedia(request, env, corsHeaders);
    }

    // ============================================================
    // ENDPOINTS EXISTENTES (SIN CAMBIOS)
    // ============================================================

    if (url.pathname === '/api/push/subscribe' && request.method === 'POST') {
      try {
        const subscription = await request.json();
        const id = crypto.randomUUID();
        await env.PUSH_SUBSCRIPTIONS.put(`sub:${id}`, JSON.stringify(subscription));
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response('Error guardando sub', { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === '/api/push/send' && request.method === 'POST') {
      try {
        const body = await request.json();
        const payload = JSON.stringify({
          title: body.title || 'Oropezas',
          body: body.body || 'Nueva noticia',
          url: body.url || '/'
        });
        const list = await env.PUSH_SUBSCRIPTIONS.list();
        for (const key of list.keys) {
          const subRaw = await env.PUSH_SUBSCRIPTIONS.get(key.name);
          if (!subRaw) continue;
          await sendPush(JSON.parse(subRaw), payload, env);
        }
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response('Error push', { status: 500, headers: corsHeaders });
      }
    }

    if (url.pathname === '/api/create-article' && request.method === 'POST') {
      try {
        const data = await request.json();
        const { title, content, slug, category = 'noticias', date = new Date().toISOString() } = data;
        if (!title || !content || !slug) {
          return new Response(JSON.stringify({ ok: false, error: 'Missing fields' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({
          ok: true, message: 'Artículo recibido',
          article: { title, content, slug, category, date }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (err) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON', details: String(err) }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (request.method === 'POST' && url.pathname === '/rastrear') {
      ctx.waitUntil(crawlAndStore(env));
      return new Response(JSON.stringify({ success: true, message: 'Rastreo iniciado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'GET' && url.pathname === '/estado') {
      const ultimaActualizacion = await env.SITIO_CONTENIDO.get('ultima_actualizacion');
      const totalPaginas = await env.SITIO_CONTENIDO.get('total_paginas');
      return new Response(JSON.stringify({
        activo: true,
        ultima_actualizacion: ultimaActualizacion || 'Nunca',
        total_paginas: totalPaginas || 0,
        mensaje: 'Bot funcionando correctamente'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (request.method === 'GET' && url.pathname === '/') {
      const existeContenido = await env.SITIO_CONTENIDO.get('contenido_completo');
      if (!existeContenido) {
        ctx.waitUntil(crawlAndStore(env));
        return new Response('✅ Bot Oropezas.com activo. Indexando sitio...', {
          status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
      return new Response('✅ Bot Oropezas.com activo. Sitio ya indexado.', {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }

    if (request.method === 'POST') {
      try {
        const body = await request.json();
        if (body.action === 'suscribir') {
          const result = await handleSubscribe(body.nombre, body.email, env);
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        if (body.action === 'contactar') {
          const result = await handleContact(body.nombre, body.email, body.mensaje, env);
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        if (body.message) {
          const reply = await handleChatMessage(body.message, env);
          return new Response(JSON.stringify({ reply }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        return new Response(JSON.stringify({ error: 'Petición inválida' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ reply: 'Error: ' + error.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Bot Oropezas.com activo', { status: 200, headers: corsHeaders });
  },

  async scheduled(event, env, ctx) {
    console.log('🕐 Rastreo programado...');
    await crawlAndStore(env);
  }
};

// ============================================================
// AI AGENTS
// ============================================================

async function handleAgentWrite(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { topic, category = 'noticias', tone = 'periodístico', length = 'medio' } = body;

    if (!topic || topic.length < 5) {
      return new Response(JSON.stringify({ success: false, error: 'Tema requerido (mín 5 chars)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const wordCount = length === 'corto' ? 300 : length === 'largo' ? 1000 : 600;

    const prompt = `Eres periodista experto de San Luis Potosí para Oropezas.com.
Escribe artículo sobre: "${topic}"
Tono: ${tone}
Longitud: ~${wordCount} palabras
Estructura: Titular llamativo, subtítulo, fecha hoy, 4-6 párrafos, 1 cita blockquote
Categoría: ${category}
HTML permitido: <p>, <h2>, <blockquote>, <ul>, <li>, <strong>
NO uses markdown.
Incluye excerpt de máximo 2 líneas al final.

IMPORTANTE: Genera también un array "content" con bloques del artículo:
[{"type":"paragraph","html":"<p>...</p>","text":"..."},{"type":"heading","html":"<h2>...</h2>","text":"..."}]

FORMATO JSON:
{"title":"...","subtitle":"...","excerpt":"...","html":"<p>...</p>","tags":["tag1","tag2"],"suggestedImage":"...","content":[...]}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
        })
      }
    );

    const geminiData = await geminiRes.json();
    const text = extraerTextoGemini(geminiData);
    const article = construirArticuloNormalizado(parsearArticuloGemini(text), { topic, category, textoGemini: text });

    const draftId = `draft-${Date.now()}`;
    await env.OROPEZAS_KV.put(draftId, JSON.stringify({
      ...article, topic,
      createdAt: new Date().toISOString(),
      status: 'draft'
    }));

    return new Response(JSON.stringify({
      success: true,
      draftId,
      article: {
        title: article.title,
        subtitle: article.subtitle,
        excerpt: article.excerpt,
        tags: article.tags,
        suggestedImage: article.suggestedImage
      },
      nextStep: 'POST /api/agent/publish con {draftId, approved: true}'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleAgentPublish(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { draftId, approved = false, autoPublish = false, customEdits = {} } = body;

    if (!draftId) {
      return new Response(JSON.stringify({ success: false, error: 'draftId requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const draftRaw = await env.OROPEZAS_KV.get(draftId);
    if (!draftRaw) {
      return new Response(JSON.stringify({ success: false, error: 'Borrador no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const draft = JSON.parse(draftRaw);

    if (!approved && !autoPublish) {
      return new Response(JSON.stringify({
        success: false,
        status: 'draft',
        draftId,
        preview: {
          title: draft.title,
          excerpt: draft.excerpt,
          html: draft.html?.substring(0, 500) + '...'
        },
        message: 'Usa approved: true o autoPublish: true para publicar'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const article = construirArticuloNormalizado({ ...draft, ...customEdits }, {
      topic: draft.topic || draft.title,
      category: customEdits.category || draft.category || 'noticias'
    });

    const slug = slugify(article.title);

    const date = new Date().toISOString().split('T')[0];
    const folder = article.folder || getFolderByCategory(article.category);
    const url = `article.html?slug=${slug}`;
    const id = `${slug}-${Date.now().toString(36)}`;
    const content = article.content;
    const imageAsset = await resolverImagenArticulo(article, env, { slug, category: article.category });
    const featuredImage = imageAsset.url;

    const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${article.title} - OROPEZAS.COM</title>
  <meta name="description" content="${article.excerpt}">
  <link rel="stylesheet" href="/styles.css">
</head>
<body data-page="article">
  <header></header>
  <main>
    <section class="article-page">
      <div class="container">
        <article class="article-content-wrap">
          <p class="news-tag">${article.category}</p>
          <h1>${article.title}</h1>
          <p class="news-date">${date}</p>
          <p class="article-excerpt">${article.subtitle || article.excerpt}</p>
          ${featuredImage ? `<img class="featured-image" src="${featuredImage}" alt="${article.title}" loading="lazy">` : ''}
          <div class="article-body">
            ${article.html}
          </div>
          ${article.tags ? `<div class="article-tags" style="margin-top:2rem;padding-top:1rem;border-top:1px solid #eee;">${article.tags.map(t => `<span style="background:#f5f5f5;padding:4px 12px;border-radius:20px;font-size:0.8rem;margin-right:8px;">${t}</span>`).join('')}</div>` : ''}
        </article>
      </div>
    </section>
  </main>
  <footer></footer>
  <script src="/main.js"></script>
</body>
</html>`;

    await env.OROPEZAS_KV.put(`article:${id}`, JSON.stringify({
      ...article, id, url, slug, date, folder,
      featuredImage,
      image: featuredImage,
      imageKey: imageAsset.key,
      imageModel: imageAsset.model || null,
      content,
      legacyHtml: htmlContent,
      publishedAt: new Date().toISOString(),
      status: 'published'
    }));

    let indexData = { articles: [], lastUpdated: '' };
    const indexRaw = await env.OROPEZAS_KV.get('articles_index');
    if (indexRaw) indexData = JSON.parse(indexRaw);

    indexData.articles.unshift({
      id, title: article.title, excerpt: article.excerpt,
      category: article.category, subcategory: article.category,
      date, image: featuredImage,
      url, slug, featured: false, tags: article.tags || [article.category],
      author: 'Oropezas AI', status: 'published'
    });

    if (indexData.articles.length > 100) {
      indexData.articles = indexData.articles.slice(0, 100);
    }
    indexData.lastUpdated = new Date().toISOString();
    await env.OROPEZAS_KV.put('articles_index', JSON.stringify(indexData));

    return new Response(JSON.stringify({
      success: true,
      id,
      url,
      date,
      folder,
      message: 'Artículo publicado',
      instructions: [
        `1. Copia el HTML a: ${url}`,
        `2. Sube imagen a: ${folder}/FOTOS/${slug}.jpg`,
        `3. Artículo ya está en: /api/articles`
      ],
      html: htmlContent
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleAgentBlast(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { articleId, channels = ['email'], testMode = false } = body;

    if (!articleId) {
      return new Response(JSON.stringify({ success: false, error: 'articleId requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const articleRaw = await env.OROPEZAS_KV.get(`article:${articleId}`);
    if (!articleRaw) {
      return new Response(JSON.stringify({ success: false, error: 'Artículo no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const article = JSON.parse(articleRaw);
    const results = {};

    if (channels.includes('email')) {
      let suscriptores = await env.SUSCRIPCIONES.get('lista', 'json') || [];
      if (testMode) suscriptores = [{ email: CONFIG.ADMIN_EMAIL[0], nombre: 'Admin' }];

      const emailPromises = suscriptores.map(async (sub) => {
        try {
          await sendEmail({
            to: sub.email,
            from: 'news@oropezas.com',
            subject: `🔥 ${article.title}`,
            html: `<div style="max-width:600px;margin:0 auto;font-family:system-ui;">
              <h1 style="color:#000;">${article.title}</h1>
              <p style="color:#666;font-size:1.1rem;">${article.excerpt}</p>
              ${article.image ? `<img src="https://oropezas.com/${article.image}" style="width:100%;border-radius:8px;margin:1rem 0;">` : ''}
              <div style="margin:2rem 0;">
                <a href="https://oropezas.com/${article.url}" style="background:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:4px;display:inline-block;">Leer artículo completo →</a>
              </div>
              <hr style="border:none;border-top:1px solid #eee;">
              <p style="color:#999;font-size:0.8rem;">Oropezas.com - Noticias de San Luis Potosí<br><a href="https://oropezas.com">Visitar sitio</a></p>
            </div>`
          }, env);
          return { email: sub.email, status: 'sent' };
        } catch (e) {
          return { email: sub.email, status: 'failed', error: e.message };
        }
      });

      results.email = await Promise.all(emailPromises);
      results.emailSent = results.email.filter(r => r.status === 'sent').length;
    }

    if (channels.includes('push')) {
      const list = await env.PUSH_SUBSCRIPTIONS.list();
      const payload = JSON.stringify({
        title: article.title,
        body: article.excerpt.substring(0, 100),
        url: article.url,
        icon: '/LOGO.jpeg'
      });

      const pushPromises = list.keys.map(async (key) => {
        const subRaw = await env.PUSH_SUBSCRIPTIONS.get(key.name);
        if (!subRaw) return { status: 'skipped' };
        try {
          await sendPush(JSON.parse(subRaw), payload, env);
          return { status: 'sent' };
        } catch (e) {
          return { status: 'failed', error: e.message };
        }
      });

      results.push = await Promise.all(pushPromises);
      results.pushSent = results.push.filter(r => r.status === 'sent').length;
    }

    return new Response(JSON.stringify({
      success: true,
      articleId,
      testMode,
      channels,
      results,
      summary: {
        emailSent: results.emailSent || 0,
        pushSent: results.pushSent || 0
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleAgentDashboard(request, env, corsHeaders) {
  try {
    const draftsList = await env.OROPEZAS_KV.list({ prefix: 'draft-' });
    const articlesList = await env.OROPEZAS_KV.list({ prefix: 'article:' });
    const subs = await env.SUSCRIPCIONES.get('lista', 'json') || [];
    const pushList = await env.PUSH_SUBSCRIPTIONS.list();

    let lastArticle = null;
    if (articlesList.keys.length > 0) {
      const lastKey = articlesList.keys[articlesList.keys.length - 1];
      const lastRaw = await env.OROPEZAS_KV.get(lastKey.name);
      if (lastRaw) {
        const last = JSON.parse(lastRaw);
        lastArticle = { title: last.title, date: last.date, url: last.url };
      }
    }

    return new Response(JSON.stringify({
      success: true,
      agents: {
        writer: { status: 'active', drafts: draftsList.keys.length },
        publisher: { status: 'active', published: articlesList.keys.length },
        blast: { status: 'active' }
      },
      audience: {
        subscribers: subs.length,
        pushSubscriptions: pushList.keys.length
      },
      lastArticle,
      endpoints: {
        write: 'POST /api/agent/write',
        publish: 'POST /api/agent/publish',
        blast: 'POST /api/agent/blast',
        articles: 'GET /api/articles',
        dashboard: 'GET /api/agent/dashboard'
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleGetArticles(request, env, corsHeaders) {
  try {
    const indexRaw = await env.OROPEZAS_KV.get('articles_index');
    if (!indexRaw) {
      return new Response(JSON.stringify({
        lastUpdated: new Date().toISOString(),
        articles: []
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const data = JSON.parse(indexRaw);
    let articles = data.articles || [];

    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');
    const category = url.searchParams.get('category');
    const featured = url.searchParams.get('featured');

    if (slug) {
      articles = articles.filter((a) => {
        if (a.slug === slug) return true;
        return typeof a.url === 'string' && a.url.includes(`slug=${slug}`);
      });
    }
    if (category) articles = articles.filter(a => a.category === category);
    if (featured === 'true') articles = articles.filter(a => a.featured);

    return new Response(JSON.stringify({
      lastUpdated: data.lastUpdated,
      total: articles.length,
      articles
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleAgentGenerateImage(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const articleId = body.articleId?.trim();
    const draftId = body.draftId?.trim();
    const prompt = body.prompt?.trim();
    const category = body.category?.trim() || 'noticias';
    const slugBase = body.slug?.trim() || prompt || articleId || draftId || `imagen-${Date.now()}`;

    let article = null;
    if (articleId) {
      const raw = await env.OROPEZAS_KV.get(`article:${articleId}`);
      if (!raw) {
        return new Response(JSON.stringify({ success: false, error: 'Artículo no encontrado' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      article = JSON.parse(raw);
    } else if (draftId) {
      const raw = await env.OROPEZAS_KV.get(draftId);
      if (!raw) {
        return new Response(JSON.stringify({ success: false, error: 'Borrador no encontrado' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      article = JSON.parse(raw);
    } else if (prompt) {
      article = construirArticuloNormalizado({
        title: prompt,
        excerpt: body.excerpt || `Imagen editorial para ${prompt}.`,
        subtitle: body.subtitle || 'Generado por Oropezas AI'
      }, { topic: prompt, category });
    } else {
      return new Response(JSON.stringify({ success: false, error: 'articleId, draftId o prompt requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const slug = slugify(article.slug || slugBase || article.title);
    const imageAsset = await generarImagenConNanoBanana(article, env, { slug, category: article.category || category });

    if (articleId) {
      article.featuredImage = imageAsset.url;
      article.image = imageAsset.url;
      article.imageKey = imageAsset.key;
      article.imageModel = imageAsset.model || null;
      await env.OROPEZAS_KV.put(`article:${articleId}`, JSON.stringify(article));

      const indexRaw = await env.OROPEZAS_KV.get('articles_index');
      if (indexRaw) {
        const indexData = JSON.parse(indexRaw);
        indexData.articles = (indexData.articles || []).map((item) =>
          item.id === articleId ? { ...item, image: imageAsset.url } : item
        );
        indexData.lastUpdated = new Date().toISOString();
        await env.OROPEZAS_KV.put('articles_index', JSON.stringify(indexData));
      }
    }

    return new Response(JSON.stringify({
      success: true,
      slug,
      image: imageAsset.url,
      key: imageAsset.key,
      model: imageAsset.model || null
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleGetMedia(request, env, corsHeaders) {
  try {
    if (!env.OROPEZAS_MEDIA) {
      return new Response(JSON.stringify({ success: false, error: 'R2 no configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const key = decodeURIComponent(new URL(request.url).pathname.replace('/api/media/', '').trim());
    if (!key) {
      return new Response(JSON.stringify({ success: false, error: 'Key requerida' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const object = await env.OROPEZAS_MEDIA.get(key);
    if (!object) {
      return new Response(JSON.stringify({ success: false, error: 'Archivo no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const headers = new Headers(corsHeaders);
    headers.set('Content-Type', object.httpMetadata?.contentType || getContentTypeByKey(key));
    headers.set('Cache-Control', object.httpMetadata?.cacheControl || 'public, max-age=31536000, immutable');
    headers.set('ETag', object.httpEtag);

    return new Response(request.method === 'HEAD' ? null : object.body, {
      headers
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ============================================================
// FUNCIONES EXISTENTES (SIN CAMBIOS)
// ============================================================

function getCorsHeaders(origin) {
  let isAllowed = false;
  for (const allowed of ALLOWED_ORIGINS) {
    if (typeof allowed === 'string') {
      if (allowed.includes('*')) {
        const pattern = allowed.replace(/\./g, '\\.').replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        if (origin && regex.test(origin)) { isAllowed = true; break; }
      } else if (origin === allowed) { isAllowed = true; break; }
    } else if (allowed.test(origin)) { isAllowed = true; break; }
  }
  const allowOrigin = (isAllowed && origin) ? origin : 'https://oropezas.com';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

async function handleChatMessage(message, env) {
  let sitioContenido = await env.SITIO_CONTENIDO.get('contenido_completo');
  let contexto = '';
  if (sitioContenido) {
    try {
      const contenidoObj = JSON.parse(sitioContenido);
      let count = 0;
      for (const [url, texto] of Object.entries(contenidoObj)) {
        if (count >= 10) break;
        contexto += `[Página: ${url}]\n${texto.substring(0, 2000)}\n\n`;
        count++;
      }
      if (contexto.length > 40000) contexto = contexto.substring(0, 40000);
    } catch (e) { console.error('Error parseando contenido:', e); }
  }

  const suscribirMatch = message.match(/^SUSCRIBIR:\s*([^:]+):\s*(.+)$/i);
  if (suscribirMatch) {
    const nombre = suscribirMatch[1].trim();
    const email = suscribirMatch[2].trim();
    const result = await handleSubscribe(nombre, email, env);
    if (result.success) {
      return `✅ ¡Gracias ${nombre}! Te has suscrito correctamente.`;
    } else { return `❌ ${result.error}`; }
  }

  const contactoMatch = message.match(/^CONTACTO:\s*([^:]+):\s*([^:]+):\s*(.+)$/is);
  if (contactoMatch) {
    const nombre = contactoMatch[1].trim();
    const email = contactoMatch[2].trim();
    const mensajeUsuario = contactoMatch[3].trim();
    const result = await handleContact(nombre, email, mensajeUsuario, env);
    if (result.success) {
      return `📧 Gracias ${nombre}, hemos recibido tu solicitud.`;
    } else { return `❌ ${result.error}`; }
  }

  if (!sitioContenido) {
    return "El bot está indexando el contenido. Espera unos minutos.";
  }

  const GEMINI_API_KEY = env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return "Error: API key de Gemini no encontrada.";
  }

  const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;

  const systemInstruction = `Eres asistente exclusivo de Oropezas.com.
Responde ÚNICAMENTE con contenido del sitio.
Si no puedes responder, di exactamente: "Te puedo ayudar en algo relacionado sobre el periódico Oropezas.com"
Considera clima, saludos, y si dicen "limon" eres Gemini normal.
Contenido: ${contexto}`;

  try {
    const response = await fetch(urlGemini, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemInstruction + "\n\nPregunta: " + message }] }],
        generationConfig: { temperature: 0.5, maxOutputTokens: 1200 }
      })
    });
    const data = await response.json();
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
    return 'Te puedo ayudar en algo relacionado sobre el periódico Oropezas.com';
  } catch (error) {
    return 'Lo siento, hubo un error. Intenta de nuevo.';
  }
}

async function handleSubscribe(nombre, email, env) {
  try {
    if (!email?.includes('@')) return { success: false, error: 'Email inválido' };
    if (!nombre || nombre.length < 2) return { success: false, error: 'Nombre inválido' };

    let suscriptores = await env.SUSCRIPCIONES.get('lista', 'json') || [];
    if (suscriptores.find(s => s.email === email)) {
      return { success: false, error: 'Email ya suscrito' };
    }

    suscriptores.push({ nombre, email, fecha: new Date().toISOString() });
    await env.SUSCRIPCIONES.put('lista', JSON.stringify(suscriptores));

    try {
      await sendEmail({
        to: email,
        from: 'suscripcion@oropezas.com',
        subject: '✅ Suscripción confirmada - Oropezas.com',
        html: `<h2>¡Gracias por suscribirte!</h2><p>Hola ${nombre},</p><p>Te has suscrito correctamente.</p><p>Saludos,<br>Equipo Oropezas.com</p>`
      }, env);
    } catch (e) { console.error('Error email confirmación:', e); }

    return { success: true, message: 'Suscripción exitosa' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function handleContact(nombre, email, mensaje, env) {
  try {
    if (!email?.includes('@')) return { success: false, error: 'Email inválido' };
    if (!nombre || nombre.length < 2) return { success: false, error: 'Nombre inválido' };
    if (!mensaje || mensaje.length < 5) return { success: false, error: 'Mensaje muy corto' };

    await sendEmail({
      to: CONFIG.ADMIN_EMAIL,
      from: 'noreply@oropezas.com',
      subject: `📩 Contacto: ${nombre}`,
      html: `<h2>Nuevo mensaje</h2><p><strong>Nombre:</strong> ${nombre}</p><p><strong>Email:</strong> ${email}</p><p><strong>Mensaje:</strong></p><p>${mensaje.replace(/\n/g, '<br>')}</p><hr><p>Responder a: ${email}</p>`,
      reply_to: email
    }, env);

    return { success: true, message: 'Mensaje enviado' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function sendEmail({ to, subject, html, reply_to, from }, env) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    console.log('📧 [MODO DEMO] Email a:', to);
    return { success: true, mock: true };
  }

  const payload = {
    from: from || 'noreply@oropezas.com',
    to: Array.isArray(to) ? to : [to],
    subject,
    html
  };
  if (reply_to) payload.reply_to = reply_to;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Error enviando email');
    return { success: true, id: data.id };
  } catch (error) {
    console.error('Error sendEmail:', error);
    throw error;
  }
}

async function crawlAndStore(env) {
  const baseUrl = CONFIG.SITE_URL;
  const visited = new Set();
  const toVisit = [baseUrl];
  const allText = {};
  let pagesProcessed = 0;
  const MAX_PAGES = 50;

  while (toVisit.length > 0 && pagesProcessed < MAX_PAGES) {
    const url = toVisit.shift();
    if (visited.has(url)) continue;
    visited.add(url);

    if (url.includes('/cdn-cgi/') || url.includes('/wp-') ||
        url.match(/\.(jpg|jpeg|png|gif|webp|svg|pdf|css|js|xml|ico)$/i)) continue;

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OropezasBot/1.0)' }
      });
      if (!response.ok) continue;

      const html = await response.text();
      const text = extractText(html);

      if (text?.length > 100) {
        allText[url] = text.substring(0, 5000);
        pagesProcessed++;
      }

      const links = extractLinks(html, baseUrl);
      for (const link of links) {
        if (!visited.has(link) && !toVisit.includes(link)) toVisit.push(link);
      }
    } catch (err) { console.error(`Error ${url}:`, err.message); }
  }

  await env.SITIO_CONTENIDO.put('contenido_completo', JSON.stringify(allText));
  await env.SITIO_CONTENIDO.put('ultima_actualizacion', new Date().toISOString());
  await env.SITIO_CONTENIDO.put('total_paginas', pagesProcessed.toString());
}

function extractText(html) {
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ');

  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  text = mainMatch ? mainMatch[1] : text;

  text = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text;
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  const ignorePatterns = ['/cdn-cgi/', '/wp-', 'javascript:', 'mailto:', 'tel:',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.css', '.js', '.xml', '.ico'];

  const hrefRegex = /href=["']([^"']*)["']/gi;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    let href = match[1];
    if (!href) continue;

    let shouldIgnore = false;
    for (const pattern of ignorePatterns) {
      if (href.includes(pattern)) { shouldIgnore = true; break; }
    }
    if (shouldIgnore) continue;

    if (href.startsWith('/')) href = baseUrl + href;
    else if (href.startsWith('./')) href = baseUrl + href.substring(1);
    else if (!href.startsWith('http')) href = baseUrl + '/' + href;

    if (href.startsWith(baseUrl)) {
      href = href.split('#')[0].split('?')[0];
      if (href.endsWith('/')) href = href.slice(0, -1);
      links.add(href);
    }
  }
  return Array.from(links);
}

async function sendPush(subscription, payload, env) {
  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload
  });
}
async function handleAgentAutoPublish(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { topic, category = 'noticias', tone = 'periodístico', length = 'medio', autoBlast = false } = body;

    if (!topic || topic.length < 5) {
      return new Response(JSON.stringify({ success: false, error: 'Tema requerido (mín 5 chars)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const wordCount = length === 'corto' ? 300 : length === 'largo' ? 1000 : 600;

    const prompt = `Eres periodista experto de San Luis Potosí para Oropezas.com.
Escribe artículo sobre: "${topic}"
Tono: ${tone}
Longitud: ~${wordCount} palabras
Estructura: Titular llamativo, subtítulo, fecha hoy, 4-6 párrafos, 1 cita blockquote
Categoría: ${category}
HTML permitido: <p>, <h2>, <blockquote>, <ul>, <li>, <strong>
NO uses markdown.
Incluye excerpt de máximo 2 líneas al final.

IMPORTANTE: Genera también un array "content" con bloques del artículo:
[{"type":"paragraph","html":"<p>...</p>","text":"..."},{"type":"heading","html":"<h2>...</h2>","text":"..."}]

FORMATO JSON:
{"title":"...","subtitle":"...","excerpt":"...","html":"<p>...</p>","tags":["tag1","tag2"],"suggestedImage":"...","content":[...]}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 4096 }
        })
      }
    );

    const geminiData = await geminiRes.json();
    const text = extraerTextoGemini(geminiData);
    const article = construirArticuloNormalizado(parsearArticuloGemini(text), { topic, category, textoGemini: text });

    const slug = slugify(article.title);

    const date = new Date().toISOString().split('T')[0];
    const folder = article.folder || getFolderByCategory(article.category);
    const url = `article.html?slug=${slug}`;
    const id = `${slug}-${Date.now().toString(36)}`;
    const imageAsset = await resolverImagenArticulo(article, env, { slug, category: article.category });
    const featuredImage = imageAsset.url;

    await env.OROPEZAS_KV.put(`article:${id}`, JSON.stringify({
      ...article, id, url, slug, date, folder,
      featuredImage,
      image: featuredImage,
      imageKey: imageAsset.key,
      imageModel: imageAsset.model || null,
      publishedAt: new Date().toISOString(),
      status: 'published'
    }));

    let indexData = { articles: [], lastUpdated: '' };
    const indexRaw = await env.OROPEZAS_KV.get('articles_index');
    if (indexRaw) indexData = JSON.parse(indexRaw);

    indexData.articles.unshift({
      id, title: article.title, excerpt: article.excerpt,
      category: article.category, subcategory: article.category,
      date, image: featuredImage,
      url, slug, featured: false, tags: article.tags || [article.category],
      author: 'Oropezas AI', status: 'published'
    });

    if (indexData.articles.length > 100) {
      indexData.articles = indexData.articles.slice(0, 100);
    }
    indexData.lastUpdated = new Date().toISOString();
    await env.OROPEZAS_KV.put('articles_index', JSON.stringify(indexData));

    let blastResult = null;
    if (autoBlast) {
      try {
        const blastBody = JSON.stringify({ articleId: id, channels: ['email', 'push'], testMode: false });
        const blastReq = new Request('https://dummy', { method: 'POST', body: blastBody });
        const blastRes = await handleAgentBlast(blastReq, env, corsHeaders);
        blastResult = JSON.parse(await blastRes.text());
      } catch (e) { blastResult = { error: e.message }; }
    }

    return new Response(JSON.stringify({
      success: true,
      id,
      url,
      date,
      folder,
      slug,
      message: 'Artículo publicado automáticamente',
      blast: blastResult,
      article: {
        title: article.title,
        excerpt: article.excerpt,
        featuredImage,
        tags: article.tags
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleGetArticleBySlug(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const slug = url.pathname.replace('/api/article/', '').trim();

    if (!slug) {
      return new Response(JSON.stringify({ success: false, error: 'Slug requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const indexRaw = await env.OROPEZAS_KV.get('articles_index');
    if (indexRaw) {
      const indexData = JSON.parse(indexRaw);
      const articleIndex = (indexData.articles || []).find((item) => {
        if (item.slug === slug) return true;
        return typeof item.url === 'string' && item.url.includes(`slug=${slug}`);
      });

      if (articleIndex?.id) {
        const raw = await env.OROPEZAS_KV.get(`article:${articleIndex.id}`);
        if (raw) {
          return new Response(raw, {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    let cursor;
    do {
      const list = await env.OROPEZAS_KV.list({ prefix: 'article:', cursor });
      for (const key of list.keys) {
        const raw = await env.OROPEZAS_KV.get(key.name);
        if (!raw) continue;
        const article = JSON.parse(raw);
        if (article.slug === slug) {
          return new Response(JSON.stringify(article), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
      cursor = list.list_complete ? undefined : list.cursor;
    } while (cursor);

    return new Response(JSON.stringify({ success: false, error: 'Artículo no encontrado' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleChatWebhook(request, env, corsHeaders) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const expected = `Bearer ${env.GOOGLE_CHAT_SECRET || ''}`;
    if (authHeader !== expected) {
      return new Response(JSON.stringify({ text: '⛔ No autorizado' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const text = (body.message?.text || '').trim();
    const sender = body.message?.sender?.displayName || 'Usuario';

    const commandMatch = text.match(/^\/(\w+)(?:\s+(.*))?$/);
    if (!commandMatch) {
      return new Response(JSON.stringify({
        text: `Hola ${sender}. Usa /ayuda para ver los comandos disponibles.`
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const [, command, args = ''] = commandMatch;

    if (command === 'ayuda') {
      return new Response(JSON.stringify({
        text: `*Comandos disponibles:*
/publicar <tema> — Genera y publica un artículo automáticamente
/borrador <tema> — Genera un borrador sin publicar
/estado — Muestra estadísticas del sistema
/blast <articleId> — Envía blast de un artículo
/ayuda — Muestra esta ayuda`
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (command === 'estado') {
      const draftsList = await env.OROPEZAS_KV.list({ prefix: 'draft-' });
      const articlesList = await env.OROPEZAS_KV.list({ prefix: 'article:' });
      const subs = await env.SUSCRIPCIONES.get('lista', 'json') || [];
      const pushList = await env.PUSH_SUBSCRIPTIONS.list();
      return new Response(JSON.stringify({
        text: `📊 *Estado Oropezas.com*
Borradores: ${draftsList.keys.length}
Publicados: ${articlesList.keys.length}
Suscriptores email: ${subs.length}
Suscriptores push: ${pushList.keys.length}`
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (command === 'borrador') {
      if (!args || args.length < 5) {
        return new Response(JSON.stringify({ text: '❌ Escribe un tema. Ejemplo: /borrador Nueva carretera en SLP' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const fakeReq = new Request('https://dummy', {
        method: 'POST',
        body: JSON.stringify({ topic: args, category: 'noticias', tone: 'periodístico', length: 'medio' })
      });
      const res = await handleAgentWrite(fakeReq, env, corsHeaders);
      const data = JSON.parse(await res.text());
      if (data.success) {
        return new Response(JSON.stringify({
          text: `✅ Borrador generado: *${data.article.title}*
ID: \`${data.draftId}\`
Usa /publicar con el draftId si quieres publicarlo (aún no implementado por comando).`
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ text: `❌ Error: ${data.error}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (command === 'publicar') {
      if (!args || args.length < 5) {
        return new Response(JSON.stringify({ text: '❌ Escribe un tema. Ejemplo: /publicar Resultados del torneo de tenis' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const fakeReq = new Request('https://dummy', {
        method: 'POST',
        body: JSON.stringify({ topic: args, category: 'noticias', tone: 'periodístico', length: 'medio', autoBlast: false })
      });
      const res = await handleAgentAutoPublish(fakeReq, env, corsHeaders);
      const data = JSON.parse(await res.text());
      if (data.success) {
        return new Response(JSON.stringify({
          text: `🚀 *Artículo publicado automáticamente*
*Título:* ${data.article.title}
*URL:* https://oropezas.com/${data.url}
*Categoría:* ${data.folder}
*ID:* \`${data.id}\``
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ text: `❌ Error: ${data.error}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (command === 'blast') {
      if (!args) {
        return new Response(JSON.stringify({ text: '❌ Escribe el articleId. Ejemplo: /blast slug-abc123' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const articleId = args.trim().split(' ')[0];
      const fakeReq = new Request('https://dummy', {
        method: 'POST',
        body: JSON.stringify({ articleId, channels: ['email', 'push'], testMode: false })
      });
      const res = await handleAgentBlast(fakeReq, env, corsHeaders);
      const data = JSON.parse(await res.text());
      if (data.success) {
        return new Response(JSON.stringify({
          text: `📢 *Blast enviado*
Email: ${data.summary?.emailSent || 0}
Push: ${data.summary?.pushSent || 0}`
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ text: `❌ Error: ${data.error}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ text: '❓ Comando no reconocido. Usa /ayuda.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ text: '❌ Error interno: ' + error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

function htmlToContentBlocks(html) {
  const blocks = [];
  const headingRegex = /<h2[^>]*>(.*?)<\/h2>/gi;
  const paragraphRegex = /<p[^>]*>(.*?)<\/p>/gi;
  const blockquoteRegex = /<blockquote[^>]*>(.*?)<\/blockquote>/gi;
  const listRegex = /<ul[^>]*>(.*?)<\/ul>/gi;

  let match;
  const found = [];

  while ((match = headingRegex.exec(html)) !== null) {
    found.push({ index: match.index, type: 'heading', html: match[0], text: match[1].replace(/<[^>]+>/g, '') });
  }
  while ((match = paragraphRegex.exec(html)) !== null) {
    found.push({ index: match.index, type: 'paragraph', html: match[0], text: match[1].replace(/<[^>]+>/g, '') });
  }
  while ((match = blockquoteRegex.exec(html)) !== null) {
    found.push({ index: match.index, type: 'blockquote', html: match[0], text: match[1].replace(/<[^>]+>/g, '') });
  }
  while ((match = listRegex.exec(html)) !== null) {
    found.push({ index: match.index, type: 'list', html: match[0], text: match[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() });
  }

  found.sort((a, b) => a.index - b.index);
  return found.length ? found.map(f => ({ type: f.type, html: f.html, text: f.text })) : [{ type: 'paragraph', html: `<p>${html}</p>`, text: html.replace(/<[^>]+>/g, '') }];
}
