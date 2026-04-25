// ==================== WORKER UNIFICADO - OROPEZAS.COM ====================
// Incluye: Chat con Gemini, Suscripciones, Contacto, Rastreador de sitio

// Dominios permitidos (CORS)
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

// Configuración
const CONFIG = {
  FROM_EMAIL: 'noreply@oropezas.com',
  ADMIN_EMAIL: ['enrique@oropezas.com','majo@oropezas.com'],
  SITE_URL: 'https://oropezas.com'
};

// ==================== MAIN HANDLER ====================
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
// ============================
// PUSH: GUARDAR SUSCRIPCIÓN
// ============================
if (url.pathname === "/api/push/subscribe" && req.method === "POST") {
  try {
    const subscription = await req.json();
    const id = crypto.randomUUID();

    await env.PUSH_SUBSCRIPTIONS.put(
      `sub:${id}`,
      JSON.stringify(subscription)
    );

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response("Error guardando sub", { status: 500 });
  }
}


// ============================
// PUSH: ENVIAR NOTIFICACIÓN
// ============================
if (url.pathname === "/api/push/send" && req.method === "POST") {
  try {
    const body = await req.json();

    const payload = JSON.stringify({
      title: body.title || "Oropezas",
      body: body.body || "Nueva noticia",
      url: body.url || "/"
    });

    const list = await env.PUSH_SUBSCRIPTIONS.list();

    for (const key of list.keys) {
      const subRaw = await env.PUSH_SUBSCRIPTIONS.get(key.name);
      if (!subRaw) continue;

      const sub = JSON.parse(subRaw);

      // 🔥 aquí mandamos el push
      await sendPush(sub, payload, env);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (e) {
    return new Response("Error push", { status: 500 });
  }
}
// ===== CREATE ARTICLE ENDPOINT =====
if (url.pathname === "/api/create-article" && request.method === "POST") {
  try {
    const apiKey = request.headers.get("x-api-key");

    if (apiKey !== env.ARTICLE_SECRET) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await request.json();

    const title = data.title?.trim();
    const content = data.content?.trim();
    const slug = data.slug?.trim();
    const category = data.category || "noticias";
    const date = data.date || new Date().toISOString();

    if (!title || !content || !slug) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Missing fields"
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 🔥 TEST MODE (no rompe nada)
    return new Response(JSON.stringify({
      ok: true,
      message: "Artículo recibido",
      article: { title, content, slug, category, date }
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      ok: false,
      error: "Invalid JSON",
      details: String(err)
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
  
    const origin = request.headers.get('Origin');
    
    // Obtener headers CORS
    const corsHeaders = getCorsHeaders(origin);
    
    // Manejar OPTIONS (preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    
    // Ruta: rastreo manual (POST /rastrear)
    if (request.method === 'POST' && url.pathname === '/rastrear') {
      ctx.waitUntil(crawlAndStore(env));
      return new Response(JSON.stringify({ success: true, message: 'Rastreo iniciado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Ruta: obtener estado (GET /estado)
    if (request.method === 'GET' && url.pathname === '/estado') {
      const ultimaActualizacion = await env.SITIO_CONTENIDO.get('ultima_actualizacion');
      const totalPaginas = await env.SITIO_CONTENIDO.get('total_paginas');
      return new Response(JSON.stringify({ 
        activo: true, 
        ultima_actualizacion: ultimaActualizacion || 'Nunca',
        total_paginas: totalPaginas || 0,
        mensaje: 'Bot funcionando correctamente'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // GET: respuesta simple con indexing automático
    if (request.method === 'GET' && url.pathname === '/') {
      const existeContenido = await env.SITIO_CONTENIDO.get('contenido_completo');
      if (!existeContenido) {
        ctx.waitUntil(crawlAndStore(env));
        return new Response('✅ Bot Oropezas.com activo. Indexando sitio...', {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
        });
      }
      return new Response('✅ Bot Oropezas.com activo. Sitio ya indexado. Usa POST para chatear.', {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
      });
    }
    
    // Ruta principal: POST del chat
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        
        // Acción: suscribir
        if (body.action === 'suscribir') {
          const result = await handleSubscribe(body.nombre, body.email, env);
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Acción: contactar
        if (body.action === 'contactar') {
          const result = await handleContact(body.nombre, body.email, body.mensaje, env);
          return new Response(JSON.stringify(result), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        // Mensaje de chat normal
        if (body.message) {
          const reply = await handleChatMessage(body.message, env);
          return new Response(JSON.stringify({ reply }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        
        return new Response(JSON.stringify({ error: 'Petición inválida' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
        
      } catch (error) {
        console.error('Error en fetch:', error);
        return new Response(JSON.stringify({ reply: 'Error en el servidor: ' + error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }
    
    // Fallback
    return new Response('Bot Oropezas.com activo', { status: 200, headers: corsHeaders });
  },
  
  // Cron trigger para rastreo automático (cada 24h)
  async scheduled(event, env, ctx) {
    console.log('🕐 Ejecutando rastreo programado...');
    await crawlAndStore(env);
  }
};

// ==================== FUNCIONES DE CORS ====================
function getCorsHeaders(origin) {
  let isAllowed = false;
  
  for (const allowed of ALLOWED_ORIGINS) {
    if (typeof allowed === 'string') {
      if (allowed.includes('*')) {
        const pattern = allowed.replace(/\./g, '\\.').replace(/\*/g, '.*');
        const regex = new RegExp(`^${pattern}$`);
        if (origin && regex.test(origin)) {
          isAllowed = true;
          break;
        }
      } else if (origin === allowed) {
        isAllowed = true;
        break;
      }
    } else if (allowed.test(origin)) {
      isAllowed = true;
      break;
    }
  }
  
  const allowOrigin = (isAllowed && origin) ? origin : 'https://oropezas.com';
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

// ==================== CHAT CON GEMINI ====================
async function handleChatMessage(message, env) {
  // Obtener contenido del sitio desde KV
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
    } catch (e) {
      console.error('Error parseando contenido:', e);
    }
  }
  
  // Detectar comandos especiales
  const suscribirMatch = message.match(/^SUSCRIBIR:\s*([^:]+):\s*(.+)$/i);
  if (suscribirMatch) {
    const nombre = suscribirMatch[1].trim();
    const email = suscribirMatch[2].trim();
    const result = await handleSubscribe(nombre, email, env);
    if (result.success) {
      return `✅ ¡Gracias ${nombre}! Te has suscrito correctamente a las noticias de Oropezas.com. Recibirás un correo de confirmación.`;
    } else {
      return `❌ ${result.error}`;
    }
  }
  
  const contactoMatch = message.match(/^CONTACTO:\s*([^:]+):\s*([^:]+):\s*(.+)$/is);
  if (contactoMatch) {
    const nombre = contactoMatch[1].trim();
    const email = contactoMatch[2].trim();
    const mensajeUsuario = contactoMatch[3].trim();
    const result = await handleContact(nombre, email, mensajeUsuario, env);
    if (result.success) {
      return `📧 Gracias ${nombre}, hemos recibido tu solicitud. Te contactaremos pronto a ${email}.`;
    } else {
      return `❌ ${result.error}`;
    }
  }
  
  // Si no hay contenido del sitio
  if (!sitioContenido) {
    return "El bot está indexando el contenido del sitio. Por favor espera unos minutos y vuelve a intentarlo. Mientras tanto, ¿te puedo ayudar a suscribirte (escribe: SUSCRIBIR:nombre:email) o contactar al equipo (escribe: CONTACTO:nombre:email:mensaje)?";
  }
  
  // Llamar a Gemini
  const GEMINI_API_KEY = env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    return "Error de configuración: API key de Gemini no encontrada. Contacta al administrador.";
  }
  
  const urlGemini = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;
  
  const systemInstruction = `
    Eres un asistente exclusivo del periódico Oropezas.com.
    Debes responder preguntas basándote ÚNICAMENTE en el contenido del sitio web que se te proporciona.
    NO uses conocimiento externo.
    Si la pregunta no puede ser respondida con el contenido del sitio o no está relacionada con el periódico, responde exactamente:
    "Te puedo ayudar en algo relacionado sobre el periódico Oropezas.com"
    
    También puedes sugerir a los usuarios que se suscriban (escribiendo SUSCRIBIR:nombre:email) 
    o que dejen un mensaje para contacto (escribiendo CONTACTO:nombre:email:mensaje).
    
    pero ten conideracion, clima, saludo, y si te dicen limon, eres gemini normal
    Contenido del sitio:
    ${contexto}
  `;
  
  const payload = {
    contents: [{ parts: [{ text: systemInstruction + "\n\nPregunta del usuario: " + message }] }],
    generationConfig: { temperature: 0.5, maxOutputTokens: 1200 }
  };
  
  try {
    const response = await fetch(urlGemini, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
      return data.candidates[0].content.parts[0].text;
    }
    
    if (data.error) {
      console.error('Error Gemini:', data.error);
      return 'Te puedo ayudar en algo relacionado sobre el periódico Oropezas.com';
    }
    
    return 'Te puedo ayudar en algo relacionado sobre el periódico Oropezas.com';
  } catch (error) {
    console.error('Error llamando a Gemini:', error);
    return 'Lo siento, hubo un error procesando tu mensaje. Intenta de nuevo.';
  }
}

// ==================== SUSCRIPCIONES ====================
async function handleSubscribe(nombre, email, env) {
  try {
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Email inválido' };
    }
    
    if (!nombre || nombre.length < 2) {
      return { success: false, error: 'Nombre inválido' };
    }
    
    // Guardar en KV
    let suscriptores = await env.SUSCRIPCIONES.get('lista', 'json');
    if (!suscriptores) suscriptores = [];
    
    if (suscriptores.find(s => s.email === email)) {
      return { success: false, error: 'Este email ya está suscrito' };
    }
    
    suscriptores.push({ 
      nombre: nombre, 
      email, 
      fecha: new Date().toISOString() 
    });
    await env.SUSCRIPCIONES.put('lista', JSON.stringify(suscriptores));
    
    // Enviar email de confirmación (no crítico)
    try {
      await sendEmail({
        to: email,
        from: 'suscrpicion@oropezas.com',
        subject: '✅ Suscripción confirmada - Oropezas.com',
        html: `
          <h2>¡Gracias por suscribirte a Oropezas.com!</h2>
          <p>Hola ${nombre},</p>
          <p>Te has suscrito correctamente para recibir notificaciones cuando haya nuevo contenido en nuestro periódico.</p>
          <p>Pronto recibirás nuestras novedades.</p>
          <br>
          <p>Saludos,<br>Equipo de Oropezas.com</p>
        `
      }, env);
    } catch (emailError) {
      console.error('Error enviando email de confirmación:', emailError);
    }
    
    return { success: true, message: 'Suscripción exitosa' };
  } catch (error) {
    console.error('Error en handleSubscribe:', error);
    return { success: false, error: error.message };
  }
}

// ==================== CONTACTO ====================
async function handleContact(nombre, email, mensaje, env) {
  try {
    if (!email || !email.includes('@')) {
      return { success: false, error: 'Email inválido' };
    }
    
    if (!nombre || nombre.length < 2) {
      return { success: false, error: 'Nombre inválido' };
    }
    
    if (!mensaje || mensaje.length < 5) {
      return { success: false, error: 'Mensaje demasiado corto' };
    }
    
    await sendEmail({
      to: CONFIG.ADMIN_EMAIL,
      from: 'noreply@oropezas.com',
      subject: `📩 Contacto desde el chat: ${nombre}`,
      html: `
        <h2>Nuevo mensaje de contacto</h2>
        <p><strong>Nombre:</strong> ${nombre}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Mensaje:</strong></p>
        <p>${mensaje.replace(/\n/g, '<br>')}</p>
        <hr>
        <p>Responder a: ${email}</p>
      `,
      reply_to: email
    }, env);
    
    return { success: true, message: 'Mensaje enviado correctamente' };
  } catch (error) {
    console.error('Error en handleContact:', error);
    return { success: false, error: error.message };
  }
}

// ==================== ENVÍO DE EMAILS CON RESEND ====================
async function sendEmail({ to, subject, html, reply_to, from }, env) {
  const RESEND_API_KEY = env.RESEND_API_KEY;
  
  // Si no hay API key, solo registrar
  if (!RESEND_API_KEY) {
    console.log('📧 [MODO DEMO] Email a:', to, 'Asunto:', subject);
    return { success: true, mock: true };
  }
  
  // Usar email de prueba de Resend si el dominio no está verificado
  const fromEmail = 'noreply@oropezas.com';
  
  const payload = {
    from: fromEmail,
    to: to,
    subject: subject,
    html: html
  };
  
  if (reply_to) {
    payload.reply_to = reply_to;
  }
  
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('Error Resend:', data);
      throw new Error(data.message || 'Error enviando email');
    }
    
    console.log('Email enviado:', data.id);
    return { success: true, id: data.id };
    
  } catch (error) {
    console.error('Error en sendEmail:', error);
    throw error;
  }
}

// ==================== RASTREADOR DEL SITIO (INDEXING) ====================
async function crawlAndStore(env) {
  const baseUrl = CONFIG.SITE_URL;
  const visited = new Set();
  const toVisit = [baseUrl];
  const allText = {};
  let pagesProcessed = 0;
  const MAX_PAGES = 50;
  
  console.log('🕷️ Iniciando rastreo de:', baseUrl);
  
  while (toVisit.length > 0 && pagesProcessed < MAX_PAGES) {
    const url = toVisit.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    
    // Saltar URLs del sistema
    if (url.includes('/cdn-cgi/') || 
        url.includes('/wp-json/') || 
        url.includes('/wp-admin/') ||
        url.includes('/wp-includes/') ||
        url.includes('/feed/') ||
        url.includes('/trackback/') ||
        url.match(/\.(jpg|jpeg|png|gif|webp|svg|pdf|css|js|xml|ico)$/i)) {
      console.log(`⏭️ Saltando: ${url}`);
      continue;
    }
    
    try {
      console.log(`📄 Rastreando: ${url} (${pagesProcessed + 1}/${MAX_PAGES})`);
      
      const response = await fetch(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (compatible; OropezasBot/1.0)' 
        }
      });
      
      if (!response.ok) {
        console.log(`⚠️ Error ${response.status} en ${url}`);
        continue;
      }
      
      const html = await response.text();
      const text = extractText(html);
      
      // Solo guardar si tiene contenido significativo
      if (text && text.length > 100) {
        allText[url] = text.substring(0, 5000);
        pagesProcessed++;
        console.log(`✅ Indexada: ${url} (${text.length} caracteres)`);
      }
      
      const links = extractLinks(html, baseUrl);
      console.log(`🔗 Encontrados ${links.length} enlaces válidos en ${url}`);
      
      for (const link of links) {
        if (!visited.has(link) && !toVisit.includes(link)) {
          toVisit.push(link);
        }
      }
      
    } catch (err) {
      console.error(`Error en ${url}: ${err.message}`);
    }
  }
  
  // Guardar resultados en KV
  await env.SITIO_CONTENIDO.put('contenido_completo', JSON.stringify(allText));
  await env.SITIO_CONTENIDO.put('ultima_actualizacion', new Date().toISOString());
  await env.SITIO_CONTENIDO.put('total_paginas', pagesProcessed.toString());
  
  console.log(`✅ Rastreo completado: ${pagesProcessed} páginas indexadas de ${visited.size} visitadas`);
}

function extractText(html) {
  // Primero eliminar etiquetas que no queremos
  let text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ');
  
  // Intentar extraer contenido principal
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    text = mainMatch[1];
  } else {
    const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (articleMatch) {
      text = articleMatch[1];
    }
  }
  
  // Eliminar etiquetas HTML restantes
  text = text.replace(/<[^>]+>/g, ' ');
  
  // Limpiar espacios y caracteres especiales
  text = text.replace(/\s+/g, ' ').trim();
  
  return text;
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  
  // Patrones a ignorar
  const ignorePatterns = [
    '/cdn-cgi/',
    '/wp-json/',
    '/wp-admin/',
    '/wp-includes/',
    '/wp-content/',
    '/feed/',
    '/trackback/',
    'javascript:',
    'mailto:',
    'tel:',
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.zip', '.rar', '.7z',
    '.mp3', '.mp4', '.avi',
    '.css', '.js', '.xml', '.json', '.ico'
  ];
  
  const hrefRegex = /href=["']([^"']*)["']/gi;
  let match;
  
  while ((match = hrefRegex.exec(html)) !== null) {
    let href = match[1];
    
    if (!href) continue;
    
    // Verificar si debe ser ignorado
    let shouldIgnore = false;
    for (const pattern of ignorePatterns) {
      if (href.includes(pattern)) {
        shouldIgnore = true;
        break;
      }
    }
    if (shouldIgnore) continue;
    
    // Convertir a URL absoluta
    if (href.startsWith('/')) {
      href = baseUrl + href;
    } else if (href.startsWith('./')) {
      href = baseUrl + href.substring(1);
    } else if (href.startsWith('../')) {
      continue; // Saltar rutas padres
    } else if (!href.startsWith('http')) {
      href = baseUrl + '/' + href;
    }
    
    // Solo enlaces del mismo dominio
    if (href.startsWith(baseUrl)) {
      // Limpiar URL
      href = href.split('#')[0].split('?')[0];
      // Normalizar
      if (href.endsWith('/')) href = href.slice(0, -1);
      if (href !== baseUrl && !href.endsWith('/')) {
        links.add(href);
      } else if (href === baseUrl) {
        links.add(href);
      }
    }
  }
  
  return Array.from(links);
}
async function sendPush(subscription, payload, env) {
  const endpoint = subscription.endpoint;

  // ⚠️ versión simple (funciona pero no perfecta)
  return fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: payload
  });
}