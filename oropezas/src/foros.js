
// ═══════════════════════════════════════════════════════════════
// MÓDULO FOROS — Oropezas.com
// Moderación automática con Cloudflare AI (llama-3.1-8b-instruct)
// ═══════════════════════════════════════════════════════════════

const FOUNDER_EMAIL = 'enrique@oropezas.com';
const FOROS_INDEX_KEY = 'foros:index';

// ─── Moderación con Cloudflare AI ────────────────────────────
async function moderarContenido(text, env) {
  try {
    const prompt = `Eres el moderador de un periódico digital mexicano llamado Oropezas.com. 
Analiza el siguiente mensaje de usuario y determina si debe ser aprobado o rechazado.

RECHAZA si contiene: insultos graves, discurso de odio, spam, contenido sexual explícito, 
amenazas, desinformación evidente, o lenguaje extremadamente ofensivo.

APRUEBA si es: opinión legítima (aunque crítica), debate político respetuoso, 
preguntas, comentarios sobre noticias, críticas constructivas.

Responde ÚNICAMENTE con un JSON: {"approved": true} o {"approved": false, "reason": "motivo breve en español"}

Mensaje a moderar:
"""
${text.slice(0, 1000)}
"""`;

    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 100,
    });

    const raw = response.response || '';
    const match = raw.match(/\{[^}]+\}/);
    if (match) {
      const result = JSON.parse(match[0]);
      return result;
    }
    return { approved: true }; // si falla el parsing, aprobamos por defecto
  } catch (e) {
    console.error('Error en moderación AI:', e.message);
    return { approved: true }; // si falla la IA, aprobamos por defecto
  }
}

// ─── Helpers KV ──────────────────────────────────────────────
async function getIndex(env) {
  const raw = await env.OROPEZAS_FOROS.get(FOROS_INDEX_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveIndex(index, env) {
  await env.OROPEZAS_FOROS.put(FOROS_INDEX_KEY, JSON.stringify(index));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── Verificar token Google (básico — solo decodifica sin verificar firma) ──
function decodeGoogleToken(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// ─── GET /api/foros/threads ───────────────────────────────────
async function handleGetThreads(env, corsHeaders) {
  const index = await getIndex(env);
  // Ordenar por fecha desc
  const sorted = [...index].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return new Response(JSON.stringify({ success: true, threads: sorted }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── POST /api/foros/threads ──────────────────────────────────
async function handleCreateThread(request, env, corsHeaders) {
  const body = await request.json();
  const { title, body: text, category, authorId, authorName, authorEmail, authorPicture, token } = body;

  // Validar sesión
  if (!token) {
    return new Response(JSON.stringify({ success: false, error: 'No autenticado' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const payload = decodeGoogleToken(token);
  if (!payload || payload.email !== authorEmail) {
    return new Response(JSON.stringify({ success: false, error: 'Token inválido' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!title || title.length < 5 || !text || text.length < 10) {
    return new Response(JSON.stringify({ success: false, error: 'Título o mensaje demasiado corto' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Moderación IA (título + cuerpo)
  const modResult = await moderarContenido(`${title}\n\n${text}`, env);
  if (!modResult.approved) {
    return new Response(JSON.stringify({ success: false, moderated: true, reason: modResult.reason || 'Contenido inapropiado' }), {
      status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const id = generateId();
  const thread = {
    id,
    title: title.slice(0, 120),
    body: text.slice(0, 2000),
    category: category || 'comunidad',
    authorId,
    authorName,
    authorEmail,
    authorPicture: authorPicture || null,
    createdAt: new Date().toISOString(),
    replyCount: 0,
    views: 0,
    isFounder: authorEmail === FOUNDER_EMAIL,
  };

  // Guardar hilo completo
  await env.OROPEZAS_FOROS.put(`foros:thread:${id}`, JSON.stringify({ thread, replies: [] }));

  // Actualizar índice
  const index = await getIndex(env);
  index.unshift({
    id: thread.id,
    title: thread.title,
    body: thread.body,
    category: thread.category,
    authorId: thread.authorId,
    authorName: thread.authorName,
    authorEmail: thread.authorEmail,
    authorPicture: thread.authorPicture,
    createdAt: thread.createdAt,
    replyCount: 0,
    views: 0,
    isFounder: thread.isFounder,
  });
  await saveIndex(index, env);

  return new Response(JSON.stringify({ success: true, thread }), {
    status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── GET /api/foros/threads/:id ───────────────────────────────
async function handleGetThread(threadId, env, corsHeaders) {
  const raw = await env.OROPEZAS_FOROS.get(`foros:thread:${threadId}`);
  if (!raw) {
    return new Response(JSON.stringify({ success: false, error: 'Hilo no encontrado' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const data = JSON.parse(raw);

  // Incrementar vistas
  data.thread.views = (data.thread.views || 0) + 1;
  await env.OROPEZAS_FOROS.put(`foros:thread:${threadId}`, JSON.stringify(data));

  return new Response(JSON.stringify({ success: true, thread: data.thread, replies: data.replies || [] }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── POST /api/foros/threads/:id/replies ─────────────────────
async function handleCreateReply(threadId, request, env, corsHeaders) {
  const body = await request.json();
  const { body: text, authorId, authorName, authorEmail, authorPicture, token } = body;

  // Validar sesión
  if (!token) {
    return new Response(JSON.stringify({ success: false, error: 'No autenticado' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const payload = decodeGoogleToken(token);
  if (!payload || payload.email !== authorEmail) {
    return new Response(JSON.stringify({ success: false, error: 'Token inválido' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (!text || text.length < 5) {
    return new Response(JSON.stringify({ success: false, error: 'Respuesta demasiado corta' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Moderación IA
  const modResult = await moderarContenido(text, env);
  if (!modResult.approved) {
    return new Response(JSON.stringify({ success: false, moderated: true, reason: modResult.reason || 'Contenido inapropiado' }), {
      status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const raw = await env.OROPEZAS_FOROS.get(`foros:thread:${threadId}`);
  if (!raw) {
    return new Response(JSON.stringify({ success: false, error: 'Hilo no encontrado' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const data = JSON.parse(raw);
  const reply = {
    id: generateId(),
    body: text.slice(0, 2000),
    authorId,
    authorName,
    authorEmail,
    authorPicture: authorPicture || null,
    createdAt: new Date().toISOString(),
    isFounder: authorEmail === FOUNDER_EMAIL,
  };

  data.replies = data.replies || [];
  data.replies.push(reply);
  data.thread.replyCount = data.replies.length;

  await env.OROPEZAS_FOROS.put(`foros:thread:${threadId}`, JSON.stringify(data));

  // Actualizar replyCount en el índice
  const index = await getIndex(env);
  const idx = index.findIndex(t => t.id === threadId);
  if (idx !== -1) {
    index[idx].replyCount = data.thread.replyCount;
    await saveIndex(index, env);
  }

  return new Response(JSON.stringify({ success: true, reply }), {
    status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Router principal de foros ────────────────────────────────
export async function handleForosRoutes(pathname, request, env, corsHeaders) {
  const method = request.method;

  // GET /api/foros/threads
  if (pathname === '/api/foros/threads' && method === 'GET') {
    return handleGetThreads(env, corsHeaders);
  }

  // POST /api/foros/threads
  if (pathname === '/api/foros/threads' && method === 'POST') {
    return handleCreateThread(request, env, corsHeaders);
  }

  // GET /api/foros/threads/:id
  const threadMatch = pathname.match(/^\/api\/foros\/threads\/([^/]+)$/);
  if (threadMatch && method === 'GET') {
    return handleGetThread(threadMatch[1], env, corsHeaders);
  }

  // POST /api/foros/threads/:id/replies
  const replyMatch = pathname.match(/^\/api\/foros\/threads\/([^/]+)\/replies$/);
  if (replyMatch && method === 'POST') {
    return handleCreateReply(replyMatch[1], request, env, corsHeaders);
  }

  return null; // no match
}
