// Deployed via GitHub Actions — 2026-05-04
// src/worker.js - OROPEZAS.COM + KELOWNA.OROPEZAS.COM WORKER UNIFICADO
// Chat + Suscripciones + Contacto + Rastreador + Push + AI AGENTS
// AI: Cloudflare Workers AI (Llama 3.1 + Flux-1 Schnell)
// Images: Flux-1 via @cf/black-forest-labs/flux-1-schnell (SDXL fallback)



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

// ─── Cloudflare AI Helper ────────────────────────────────────
async function runAI(prompt, env, opts = {}) {
  const model = opts.model || '@cf/meta/llama-3.1-8b-instruct';
  const maxTokens = opts.maxTokens || 4096;
  const messages = opts.system
    ? [{ role: 'system', content: opts.system }, { role: 'user', content: prompt }]
    : [{ role: 'user', content: prompt }];
  try {
    const response = await env.AI.run(model, { messages, max_tokens: maxTokens });
    return response.response || '';
  } catch (e) {
    console.error('Cloudflare AI error:', e.message);
    throw e;
  }
}

async function generateImageWithAI(prompt, env) {
  try {
    const response = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', {
      prompt: prompt,
    });
    return { bytes: response, mimeType: 'image/png' };
  } catch (e) {
    // Fallback to Stable Diffusion if Flux-1 is unavailable
    console.warn('[AI] Flux-1 unavailable, falling back to SDXL:', e.message);
    try {
      const fallback = await env.AI.run('@cf/stabilityai/stable-diffusion-xl-base-1.0', {
        prompt: prompt,
      });
      return { bytes: fallback, mimeType: 'image/png' };
    } catch (e2) {
      console.error('[AI] Image generation failed:', e2.message);
      throw e2;
    }
  }
}

// ─── Seed Kelowna Articles ──────────────────────────────────
const KELOWNA_SEED_ARTICLES = [
  {
    id: 'kelowna-seed-7', title: 'Kelowna Granted Early Exemption from BC Short-Term Rental Regulations',
    slug: 'kelowna-may-the-4th',
    excerpt: 'Kelowna becomes the only BC community able to implement a tailored local approach to short-term rentals starting June 1, following an early exemption granted April 17.',
    html: '<p><strong>Kelowna has received an early exemption from British Columbia\'s short-term rental regulations,</strong> making it the only community in the province able to implement a tailored local approach ahead of the November deadline. Mayor Tom Dyas announced the details in an op-ed published May 4, 2026.</p><p>The exemption, granted April 17, allows short-term rentals to resume starting June 1 — but only in specific areas of the city. This approach aims to support tourism while protecting neighbourhood housing supply.</p><h2>Why This Matters</h2><p>In 2023, when the province introduced new short-term rental rules, Kelowna had more than 2,600 short-term rentals, 1,400 of which were unlicensed. These unlicensed rentals disrupted neighbourhoods, increased bylaw workload, and affected housing availability.</p><p>Since then, Kelowna\'s housing situation has improved significantly. Four years ago, the vacancy rate was below 1%. Today, it exceeds 5%. The city surpassed provincial housing targets by building nearly 3,500 homes in 2024 and more than 4,000 in 2025.</p><h2>Upcoming Events</h2><p>The timing is significant for Kelowna\'s summer season. The city is preparing to host major events including the Memorial Cup, BC Lions games, the Canadian Elite Basketball League, and the BC Summer Games — with an estimated combined economic impact of more than $90 million.</p><p>Property tax notices for 2026 will be mailed starting May 23. The city\'s $1.1-billion budget, approved last month, includes a 4.4% tax increase for the average homeowner — about $115 per year.</p><p><em>Full details on short-term rentals are available at kelowna.ca.</em></p>',
    category: 'noticias', tags: ['housing', 'tourism'],
    featured: true, status: 'published', author: 'Kelowna News Team',
    site: 'kelowna', date: '2026-05-04', folder: 'noticias',
    featuredImage: 'https://oropezas.enriquegarciaoropeza.workers.dev/api/media/articles/noticias/may-the-4th-2026.png',
    image: 'https://oropezas.enriquegarciaoropeza.workers.dev/api/media/articles/noticias/may-the-4th-2026.png',
  },
  {
    id: 'kelowna-seed-1', title: 'Kelowna Residents Rally to Save Beloved Orchard from Development',
    slug: 'kelowna-residents-rally-save-orchard',
    excerpt: 'Hundreds of Kelowna residents have gathered signatures to save the iconic Johnson Family Orchard, a staple of the community for over five decades.',
    html: '<p>Hundreds of Kelowna residents have gathered signatures to save the iconic Johnson Family Orchard, a staple of the community for over five decades. The orchard, located on the corner of Highway 97 and Clement Avenue, has been threatened by a proposed commercial development project.</p><h2>Community Response</h2><p>Local residents organized a peaceful demonstration last Saturday, drawing over 300 participants. "This orchard is part of our heritage," said organizer Maria Santos.</p><blockquote>"This orchard is part of our heritage. We can\'t let another piece of Kelowna\'s history disappear."</blockquote><p>The petition has already collected over 2,000 signatures and continues to grow.</p>',
    category: 'noticias', tags: ['community', 'development', 'heritage'],
    featured: true, status: 'published', author: 'Kelowna News Team',
    site: 'kelowna', date: '2026-05-02', folder: 'noticias',
    featuredImage: '/LOGO.jpeg', image: '/LOGO.jpeg',
  },
  {
    id: 'kelowna-seed-2', title: 'Okanagan Lake Water Levels Rise After Spring Melt',
    slug: 'okanagan-lake-water-levels-rise',
    excerpt: 'Recent warm weather has caused rapid snowmelt in the surrounding mountains, leading to rising water levels in Okanagan Lake.',
    html: '<p>Recent warm weather has caused rapid snowmelt in the surrounding mountains, leading to rising water levels in Okanagan Lake. The Central Okanagan Regional District has issued safety warnings for shoreline areas.</p><h2>Safety Precautions</h2><p>Residents are advised to secure boats and docks, and avoid low-lying shoreline areas during peak times.</p><p>"We monitor the situation closely," said regional district spokesperson Tom Williams.</p>',
    category: 'noticias', tags: ['environment', 'safety'],
    status: 'published', author: 'Kelowna News Team',
    site: 'kelowna', date: '2026-05-01', folder: 'noticias',
    featuredImage: '/LOGO.jpeg', image: '/LOGO.jpeg',
  },
  {
    id: 'kelowna-seed-3', title: 'New Tech Hub Opens in Downtown Kelowna, Promising 200 Jobs',
    slug: 'new-tech-hub-downtown-kelowna',
    excerpt: 'A new technology innovation hub officially opened its doors in downtown Kelowna this week, bringing with it the promise of up to 200 high-paying jobs.',
    html: '<p>A new technology innovation hub officially opened its doors in downtown Kelowna this week, bringing with it the promise of up to 200 high-paying jobs over the next three years. The Okanagan Innovation Centre, located on Bernard Avenue, spans 45,000 square feet.</p><h2>Economic Impact</h2><p>Mayor Tom Dyas was present at the ribbon-cutting ceremony. "This is a significant milestone for Kelowna\'s growing tech sector," Dyas said.</p><p>The centre will house 15-20 startups and established companies, with shared amenities including conference facilities, a prototyping lab, and co-working spaces.</p>',
    category: 'tecnologia', tags: ['technology', 'jobs', 'economy'],
    status: 'published', author: 'Tech Reporter',
    site: 'kelowna', date: '2026-04-30', folder: 'noticias',
    featuredImage: '/LOGO.jpeg', image: '/LOGO.jpeg',
  },
  {
    id: 'kelowna-seed-4', title: 'Summer Festival Season Kicks Off in the Okanagan',
    slug: 'summer-festival-season-okanagan',
    excerpt: 'The Okanagan Valley is gearing up for another spectacular summer festival season, with over 40 major events scheduled between May and September.',
    html: '<p>The Okanagan Valley is gearing up for another spectacular summer festival season, with over 40 major events scheduled between May and September. From wine tastings to music festivals, there\'s something for everyone.</p><h2>Notable Events</h2><ul><li><strong>May 15-18:</strong> Okanagan Wine Festival - Over 100 wineries participating</li><li><strong>June 20-22:</strong> Centre of Gravity Music Festival</li><li><strong>July 4-6:</strong> Kelowna Folk Festival - Three days of folk and roots music</li><li><strong>August 15-17:</strong> Peachland Arts & Crafts Fair</li></ul>',
    category: 'noticias', tags: ['events', 'summer', 'tourism'],
    status: 'published', author: 'Events Coordinator',
    site: 'kelowna', date: '2026-04-28', folder: 'noticias',
    featuredImage: '/LOGO.jpeg', image: '/LOGO.jpeg',
  },
  {
    id: 'kelowna-seed-5', title: 'Kelowna Rockets Advance to WHL Conference Finals',
    slug: 'kelowna-rockets-conference-finals',
    excerpt: 'The Kelowna Rockets punched their ticket to the WHL Western Conference Finals with a thrilling 3-2 overtime victory against the Victoria Royals.',
    html: '<p>The Kelowna Rockets punched their ticket to the WHL Western Conference Finals with a thrilling 3-2 overtime victory against the Victoria Royals last night at Prospera Place. Forward Jake Mitchell scored the game-winner just 2:14 into the extra period.</p><h2>Game Highlights</h2><p>The Rockets fell behind early, trailing 2-0 after the first period. Coach Kris Mallette\'s halftime adjustments proved crucial as Kelowna stormed back.</p><blockquote>"These guys never quit. Down two goals, they kept battling. That\'s the character of this team."</blockquote><p>The Rockets will face the Kamloops Blazers in the conference finals, with Game 1 scheduled for Friday night.</p>',
    category: 'deportes', tags: ['sports', 'hockey', 'playoffs'],
    status: 'published', author: 'Sports Desk',
    site: 'kelowna', date: '2026-04-27', folder: 'noticias',
    featuredImage: '/LOGO.jpeg', image: '/LOGO.jpeg',
  },
  {
    id: 'kelowna-seed-6', title: 'Local Brewery Wins National Craft Beer Award',
    slug: 'local-brewery-national-award',
    excerpt: 'Kelowna\'s own BNA Brewing Company has won gold at the prestigious Canadian Brewing Awards for their signature Nucklehead IPA.',
    html: '<p>Kelowna\'s own BNA Brewing Company has won gold at the prestigious Canadian Brewing Awards for their signature Nucklehead IPA. The competition, held in Toronto, featured over 250 breweries from across Canada.</p><h2>A Recognition of Quality</h2><p>BNA founder Dave McAnerin expressed his excitement: "This award is a testament to our team\'s dedication to craft and quality."</p><p>The Nucklehead IPA, named after a local hiking trail, features notes of citrus and pine with a balanced bitterness that has made it a local favorite.</p>',
    category: 'noticias', tags: ['food', 'local', 'awards'],
    status: 'published', author: 'Lifestyle Editor',
    site: 'kelowna', date: '2026-04-25', folder: 'noticias',
    featuredImage: '/LOGO.jpeg', image: '/LOGO.jpeg',
  },
];

async function seedKelownaArticles(env) {
  try {
    const existingRaw = await env.OROPEZAS_KV.get('kelowna_articles_index');
    let existing = [];
    if (existingRaw) {
      const parsed = JSON.parse(existingRaw);
      existing = parsed.articles || [];
    }

    // Merge new seed articles that don't exist yet
    const existingIds = new Set(existing.map(a => a.id));
    const newArticles = [];
    for (const article of KELOWNA_SEED_ARTICLES) {
      if (!existingIds.has(article.id)) {
        await env.OROPEZAS_KV.put(`article:${article.id}`, JSON.stringify(article));
        newArticles.push(article);
      }
    }

    if (newArticles.length > 0) {
      const merged = [...newArticles, ...existing];
      await env.OROPEZAS_KV.put('kelowna_articles_index', JSON.stringify({
        articles: merged,
        lastUpdated: new Date().toISOString(),
      }));
      console.log(`Kelowna articles: added ${newArticles.length} new articles`);
    }
  } catch (e) {
    console.error('Error seeding Kelowna articles:', e);
  }
}

// ─── MAIN SITE SEED ARTICLES ──────────────────────────────
const MAIN_SEED_ARTICLES = [
  {
    id: 'main-seed-hondius', title: '🚨 MV Hondius: Brote de Hantavirus en Crucero de Expedición',
    slug: 'hondius-hantavirus-outbreak-2026',
    excerpt: 'El crucero MV Hondius está varado frente a Cabo Verde tras un brote de hantavirus que ha dejado tres muertos, dos casos confirmados y cinco sospechosos entre 147 personas a bordo.',
    html: '<p><strong>🚨 Última Hora:</strong> El <strong>MV Hondius</strong>, un crucero de expedición de bandera holandesa operado por <em>Oceanwide Expeditions</em>, está actualmente anclado frente a <strong>Cabo Verde</strong> en el océano Atlántico tras un mortal brote de <strong>hantavirus</strong> — una rara enfermedad transmitida por roedores que ha dejado tres muertos y al barco varado.</p><h2>Las Cifras</h2><table style="width:100%;border-collapse:collapse;margin:1rem 0;"><tr style="background:#f5f5f5;"><th style="padding:8px;text-align:left;border:1px solid #ddd;">Métrica</th><th style="padding:8px;text-align:left;border:1px solid #ddd;">Cantidad</th></tr><tr><td style="padding:8px;border:1px solid #ddd;">Total a bordo</td><td style="padding:8px;border:1px solid #ddd;">147 (88 pasajeros + 59 tripulantes)</td></tr><tr style="background:#f9f9f9;"><td style="padding:8px;border:1px solid #ddd;">Casos confirmados</td><td style="padding:8px;border:1px solid #ddd;">2</td></tr><tr><td style="padding:8px;border:1px solid #ddd;">Casos sospechosos</td><td style="padding:8px;border:1px solid #ddd;">5</td></tr><tr style="background:#f9f9f9;"><td style="padding:8px;border:1px solid #ddd;">Muertes</td><td style="padding:8px;border:1px solid #ddd;">3</td></tr><tr><td style="padding:8px;border:1px solid #ddd;">En estado crítico</td><td style="padding:8px;border:1px solid #ddd;">1 (UCI, Johannesburgo)</td></tr><tr style="background:#f9f9f9;"><td style="padding:8px;border:1px solid #ddd;">Nacionalidades</td><td style="padding:8px;border:1px solid #ddd;">23</td></tr></table><h2>Cronología del Brote</h2><p>El Hondius zarpó de <strong>Ushuaia, Argentina</strong> el 1 de abril de 2026 para una expedición de varias semanas llamada <em>"Atlantic Odyssey"</em>. El viaje incluyó paradas en la Antártida continental, Georgia del Sur, Isla Nightingale, Tristán da Cunha, Santa Elena y la Isla de la Ascensión.</p><ul><li><strong>6 de abril:</strong> Un hombre holandés de 70 años desarrolla síntomas</li><li><strong>11 de abril:</strong> El holandés muere a bordo — primera víctima mortal</li><li><strong>26 de abril:</strong> Su esposa de 69 años muere en Johannesburgo tras desplomarse en el aeropuerto. Su sangre posteriormente da positivo para hantavirus</li><li><strong>27 de abril:</strong> Un hombre británico es evacuado a Sudáfrica; ahora en UCI con hantavirus confirmado</li><li><strong>2 de mayo:</strong> Muere un nacional alemán — tercera víctima mortal confirmada</li></ul><h2>Por Qué Esto es Sin Precedentes</h2><p>El hantavirus es <strong>extremadamente raro en cruceros</strong>. A diferencia del norovirus — que causa más de 18 brotes anuales en cruceros — el hantavirus es transmitido por roedores, generalmente a través del contacto con excrementos, orina o saliva de roedores infectados.</p><p>Sin embargo, el <strong>virus Andes</strong> — endémico de Argentina y Chile — es la única cepa de hantavirus conocida por transmitirse de persona a persona a través de contacto cercano (compartir cama, alimentos, etc.). Dado que el crucero partió de Argentina, los expertos sospechan que esta cepa podría estar involucrada, lo que hace el brote aún más preocupante.</p><blockquote>"Mi conjetura es que vamos a aprender mucho de esto" — Angela Luis, investigadora de hantavirus</blockquote><h2>Varados en Alta Mar</h2><p>Las autoridades de <strong>Cabo Verde</strong> han rechazado dejar atracar al barco, citando preocupaciones de salud pública. Equipos médicos han sido enviados a la embarcación, pero dos tripulantes enfermos necesitan atención urgente. El barco ahora considera navegar hacia <strong>Las Palmas o Tenerife</strong> en las Islas Canarias para el desembarco.</p><p>Se ha aconsejado a los pasajeros permanecer en sus camarotes y practicar el distanciamiento físico. La <strong>OMS</strong> dice que el riesgo para la población mundial es bajo y no se necesitan restricciones de viaje, pero una respuesta multilateral está en marcha involucrando a Cabo Verde, los Países Bajos, España, Sudáfrica, el Reino Unido y Argentina.</p><hr><h2>🇺🇸 English Version</h2><p><strong>🚨 Breaking:</strong> The <strong>MV Hondius</strong>, a Dutch-flagged expedition cruise ship operated by <em>Oceanwide Expeditions</em>, is currently anchored off <strong>Cape Verde</strong> in the Atlantic Ocean after a deadly outbreak of <strong>hantavirus</strong> — a rare rodent-borne illness that has left three people dead and the vessel stranded.</p><h3>The Numbers</h3><ul><li><strong>Total on board:</strong> 147 (88 passengers + 59 crew)</li><li><strong>Confirmed cases:</strong> 2</li><li><strong>Suspected cases:</strong> 5</li><li><strong>Deaths:</strong> 3</li><li><strong>In critical condition:</strong> 1 (ICU, Johannesburg)</li><li><strong>Nationalities represented:</strong> 23</li></ul><h3>Timeline</h3><ul><li><strong>April 6:</strong> A 70-year-old Dutch man develops symptoms</li><li><strong>April 11:</strong> The Dutch man dies on board — first fatality</li><li><strong>April 26:</strong> His 69-year-old wife dies in Johannesburg after collapsing at the airport. Her blood later tests positive for hantavirus</li><li><strong>April 27:</strong> A British man is evacuated to South Africa; now in ICU with confirmed hantavirus</li><li><strong>May 2:</strong> A German national dies — third confirmed fatality</li></ul><h3>Why This Is Unprecedented</h3><p>Hantavirus is <strong>extremely rare on cruise ships</strong>. Unlike norovirus — which causes 18+ cruise outbreaks annually — hantavirus is rodent-borne, typically spread through contact with infected rodent droppings, urine, or saliva.</p><p>However, the <strong>Andes virus</strong> — endemic to Argentina and Chile — is the only hantavirus strain known to spread person-to-person through close contact. Since the cruise originated in Argentina, experts suspect this strain may be involved, making the outbreak even more concerning.</p><h3>Stranded at Sea</h3><p>Cape Verde authorities have refused to let the ship dock, citing public health concerns. The ship is now considering sailing to <strong>Las Palmas or Tenerife</strong> in the Canary Islands for disembarkation. The WHO says the risk to the global population is low and no travel restrictions are needed.</p><hr><p><em>Sources: The Guardian, Euronews | Publicado: 5 de mayo de 2026</em></p>',
    category: 'Noticias', tags: ['internacional', 'salud'],
    featured: true, status: 'published', author: 'Redacción Oropezas',
    site: 'main', date: '2026-05-05', folder: 'noticias',
    featuredImage: '/LOGO.jpeg', image: '/LOGO.jpeg',
  },
];

async function seedMainArticles(env) {
  try {
    const existingRaw = await env.OROPEZAS_KV.get('articles_index');
    let existing = [];
    if (existingRaw) {
      const parsed = JSON.parse(existingRaw);
      existing = parsed.articles || [];
    }

    const existingSlugs = new Set(existing.map(a => a.slug));
    const newArticles = [];
    for (const article of MAIN_SEED_ARTICLES) {
      if (!existingSlugs.has(article.slug)) {
        await env.OROPEZAS_KV.put(`article:${article.slug}`, JSON.stringify(article));
        newArticles.push(article);
      }
    }

    if (newArticles.length > 0) {
      const merged = [...newArticles, ...existing];
      await env.OROPEZAS_KV.put('articles_index', JSON.stringify({
        articles: merged,
        lastUpdated: new Date().toISOString(),
      }));
      console.log(`Main articles: added ${newArticles.length} new articles`);
    }
  } catch (e) {
    console.error('Error seeding main articles:', e);
  }
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
async function handleForosRoutes(pathname, request, env, corsHeaders) {
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


const ALLOWED_ORIGINS = [
  'https://oropezas.com',
  'https://www.oropezas.com',
  'https://kelowna.oropezas.com',
  'https://www.kelowna.oropezas.com',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:5500',
  'http://localhost:8000',
  'http://127.0.0.1:5500',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8000',
  'https://oropezas.pages.dev',
  'https://kelowna-oropezas.pages.dev',
  /^https:\/\/[a-zA-Z0-9-]+\.oropezas\.pages\.dev$/,
  /^https:\/\/[a-zA-Z0-9-]+\.oropezas\.com$/
];

const CONFIG = {
  FROM_EMAIL: 'noreply@oropezas.com',
  ADMIN_EMAIL: ['enrique@oropezas.com', 'majo@oropezas.com'],
  SITE_URL: 'https://oropezas.com',
  WORKER_URL: 'https://oropezas.enriquegarciaoropeza.workers.dev'
};

function extraerTextoAI(aiResponse) {
  // Extract text from AI response (supports both Cloudflare AI and legacy Gemini format)
  if (typeof aiResponse === 'string') return aiResponse;
  return aiResponse?.candidates?.[0]?.content?.parts?.[0]?.text || aiResponse || '';
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

function validarApiKeyAgente(request, env, corsHeaders) {
  const apiKey = request.headers.get('x-api-key');
  if (!env.API_KEY || apiKey !== env.API_KEY) {
    return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  return null;
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
  // Sanitize title: if it's too long (>200 chars) it likely contains article body — use topic as fallback
  const rawTitle = article?.title?.trim() || topic;
  const title = rawTitle && rawTitle.length <= 200 ? rawTitle : topic;
  const slug = slugify(title) || `articulo-${Date.now()}`;
  const folder = getFolderByCategory(category);
  // Better fallback HTML: use subtitle if available, not a generic "draft" message
  const subtitle = article?.subtitle?.trim() || '';
  const fallbackHtml = subtitle ? `<p>${subtitle}</p>` : `<p>${topic}</p>`;
  const html = article?.html?.trim() && article.html.trim() !== '{}' ? article.html : fallbackHtml;
  // Better excerpt: never use "Borrador inicial..." as excerpt
  const rawExcerpt = article?.excerpt?.trim();
  const isBadExcerpt = !rawExcerpt || rawExcerpt === '{}' || rawExcerpt.startsWith('Borrador inicial') || rawExcerpt === title || rawExcerpt === topic;
  // For excerpt fallback: try to extract first real sentence from the html body
  let excerptFallback = topic.substring(0, 160);
  if (isBadExcerpt && article?.html && article.html.trim() && article.html !== '{}') {
    const htmlText = (article.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const firstSentence = htmlText.split(/[.!?]/)[0];
    if (firstSentence && firstSentence.length > 40 &&
        !firstSentence.includes('Oropezas AI') && !firstSentence.includes('requiere')) {
      excerptFallback = firstSentence.trim().substring(0, 200);
    }
  }
  const excerptBase = isBadExcerpt ? excerptFallback : rawExcerpt;
  const tags = Array.isArray(article?.tags) && article.tags.length ? article.tags : [category];
  const suggestedImage = esRutaImagenValida(article?.suggestedImage) ? article.suggestedImage : `${folder}/FOTOS/${slug}.jpg`;
  const featuredImage = esRutaImagenValida(article?.featuredImage) ? article.featuredImage :
    esRutaImagenValida(article?.image) ? article.image :
    suggestedImage;
  const displaySubtitle = subtitle || 'Generado por Oropezas AI';
  const content = Array.isArray(article?.content) && article.content.length ? article.content : htmlToContentBlocks(html);

  return {
    ...article,
    title,
    subtitle: displaySubtitle,
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

  const prompt = `Editorial photojournalism, horizontal 16:9, high quality, no text, no watermarks, for a local newspaper.
Topic: ${article.title}
Category: ${category}
Summary: ${article.excerpt}
Context: ${article.subtitle || 'Local news'}
Style: documentary photography, natural lighting, clean composition, suitable for digital newspaper cover.`;

  const imageResult = await generateImageWithAI(prompt, env);
  const mimeType = imageResult.mimeType || 'image/png';
  const extension = getMimeExtension(mimeType);
  const key = `articles/${category}/${slug}.${extension}`;
  const bytes = imageResult.bytes;
  const imageModel = 'flux-1-schnell';

  await env.OROPEZAS_MEDIA.put(key, bytes, {
    httpMetadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000, immutable'
    },
    customMetadata: {
      model: imageModel,
      slug,
      category,
      generatedAt: new Date().toISOString()
    }
  });

  return {
    key,
    url: getMediaUrl(key),
    mimeType,
    model: imageModel
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
    // Seed Kelowna articles in background (don't block requests)
    ctx.waitUntil(seedKelownaArticles(env).catch(() => {}));
    ctx.waitUntil(seedMainArticles(env).catch(() => {}));

    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    const corsHeaders = getCorsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ============================================================
    // AI AGENTS - NUEVOS ENDPOINTS
    // ============================================================

    if (url.pathname.startsWith('/api/agent/')) {
      const authError = validarApiKeyAgente(request, env, corsHeaders);
      if (authError) return authError;
    }

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
      const authError = validarApiKeyAgente(request, env, corsHeaders);
      if (authError) return authError;
      return handleAgentGenerateImage(request, env, corsHeaders);
    }
    if (url.pathname === '/api/agent/dashboard' && request.method === 'GET') {
      return handleAgentDashboard(request, env, corsHeaders);
    }
    if (url.pathname === '/api/agent/auto-publish' && request.method === 'POST') {
      return handleAgentAutoPublish(request, env, corsHeaders);
    }
    if (url.pathname === '/api/agent/set-premium' && request.method === 'POST') {
      return handleSetPremium(request, env, corsHeaders);
    }
    if (url.pathname.startsWith('/api/article/') && request.method === 'GET') {
      return handleGetArticleBySlug(request, env, corsHeaders);
    }
    if (url.pathname === '/api/user/profile' && request.method === 'GET') {
      return handleGetUserProfile(request, env, corsHeaders);
    }
    if (url.pathname === '/api/user/update' && request.method === 'POST') {
      return handleUpdateUserProfile(request, env, corsHeaders);
    }
    if (url.pathname === '/api/dashboard/publish' && request.method === 'POST') {
      return handleDashboardPublish(request, env, corsHeaders);
    }
    if (url.pathname === '/api/agent/delete' && request.method === 'POST') {
      return handleAgentDelete(request, env, corsHeaders);
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
    // STRIPE PAYWALL — DESACTIVADO TEMPORALMENTE
    // ============================================================
    if (url.pathname.startsWith('/api/stripe/')) {
      return new Response(JSON.stringify({ success: false, error: 'Pagos temporalmente desactivados' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ============================================================
    // FOROS
    // ============================================================
    const forosRes = await handleForosRoutes(url.pathname, request, env, corsHeaders);
    if (forosRes) return forosRes;

    // ============================================================
    // AUTH GOOGLE
    // ============================================================
    if (url.pathname === '/api/auth/google' && request.method === 'POST') {
      try {
        const body = await request.json();
        let payload = null;

        // ─── Method 1: ID Token (JWT from GIS renderButton/prompt) ───
        if (body.idToken) {
          payload = decodeGoogleToken(body.idToken);
        }
        // ─── Method 2: Access Token (from GIS TokenClient popup) ───
        else if (body.accessToken) {
          try {
            const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo?access_token=' + encodeURIComponent(body.accessToken));
            if (userRes.ok) {
              const userData = await userRes.json();
              payload = {
                sub:   userData.sub,
                email: userData.email,
                name:  userData.name,
                picture: userData.picture,
              };
            }
          } catch (e) { console.error('[AUTH] Userinfo fetch failed:', e); }
        }

        if (!payload || !payload.sub) {
          return new Response(JSON.stringify({ success: false, error: 'Token inválido o expirado' }), {
            status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const uid = payload.sub;
        // Load or create user profile from KV
        let userProfile = null;
        const rawProfile = await env.OROPEZAS_KV.get(`user:${uid}`);
        if (rawProfile) {
          userProfile = JSON.parse(rawProfile);
          // Refresh name/picture from Google token
          userProfile.name    = payload.name    || userProfile.name;
          userProfile.picture = payload.picture || userProfile.picture;
          userProfile.lastLogin = new Date().toISOString();
        } else {
          // New user — create with default role 'user'
          userProfile = {
            uid,
            email:     payload.email   || '',
            name:      payload.name    || '',
            picture:   payload.picture || '',
            role:      'user',
            title:     '',
            bio:       '',
            joinedAt:  new Date().toISOString(),
            lastLogin: new Date().toISOString(),
          };
        }
        // Save updated profile
        await env.OROPEZAS_KV.put(`user:${uid}`, JSON.stringify(userProfile));
        return new Response(JSON.stringify({
          success: true,
          user: {
            uid:     userProfile.uid,
            email:   userProfile.email,
            name:    userProfile.name,
            picture: userProfile.picture,
            role:    userProfile.role,
            title:   userProfile.title  || '',
            bio:     userProfile.bio    || '',
          }
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: 'Error procesando token' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ============================================================
    // ENDPOINTS EXISTENTES (SIN CAMBIOS)
    // ============================================================

    // ─── Newsletter subscription ────────────────────────────
    if (url.pathname === '/api/subscribe' && request.method === 'POST') {
      try {
        const body = await request.json();
        const nombre = body.nombre?.trim();
        const email = body.email?.trim();
        if (!email?.includes('@')) {
          return new Response(JSON.stringify({ success: false, error: 'Email inválido' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        const result = await handleSubscribe(nombre, email, env);
        return new Response(JSON.stringify(result), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: 'Error processing request' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

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
          const reply = await handleChatMessage(body.message, env, body.site);
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
Escribe un artículo periodístico completo sobre: "${topic}"

REGLAS ESTRICTAS:
- "title": titular periodístico corto y llamativo (máximo 90 caracteres). NO incluyas el cuerpo del artículo aquí.
- "subtitle": subtítulo complementario (máximo 120 caracteres)
- "excerpt": resumen de 1-2 oraciones del artículo (máximo 180 caracteres). NO uses "Borrador inicial" ni frases genéricas.
- "html": el cuerpo completo del artículo en HTML (~${wordCount} palabras), con etiquetas <p>, <h2>, <blockquote>, <ul>, <li>, <strong>. SIN markdown.
- "tags": array de 2-4 etiquetas relevantes
- "content": array de bloques [{type:"paragraph"|"heading"|"blockquote", html:"...", text:"..."}]
- Tono: ${tone}. Categoría: ${category}.

RESPONDE ÚNICAMENTE con este JSON válido (sin texto extra, sin markdown):
{"title":"...","subtitle":"...","excerpt":"...","html":"...","tags":["tag1","tag2"],"content":[{"type":"paragraph","html":"<p>...</p>","text":"..."}]}`;

    const aiText = await runAI(prompt, env, { maxTokens: 4096 });
    const article = construirArticuloNormalizado(parsearArticuloGemini(aiText), { topic, category, textoGemini: aiText });

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
    const { draftId, approved = false, autoPublish = false, customEdits = {}, premium = false, premiumPrice = 2900, site = 'oropezas' } = body;

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
      ...article, id, url, slug, date, folder, site,
      featuredImage,
      image: featuredImage,
      imageKey: imageAsset.key,
      imageModel: imageAsset.model || null,
      content,
      legacyHtml: htmlContent,
      publishedAt: new Date().toISOString(),
      status: 'published',
      premium: premium || false,
      premiumPrice: premium ? premiumPrice : null,
    }));

    let indexData = { articles: [], lastUpdated: '' };
    const indexRaw = await env.OROPEZAS_KV.get('articles_index');
    if (indexRaw) indexData = JSON.parse(indexRaw);

    indexData.articles.unshift({
      id, title: article.title, excerpt: article.excerpt,
      category: article.category, subcategory: article.category,
      date, image: featuredImage,
      url, slug, featured: false, tags: article.tags || [article.category],
      author: 'Oropezas AI', status: 'published', site,
      premium: premium || false,
      premiumPrice: premium ? premiumPrice : null,
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
    const site = url.searchParams.get('site');

    // Filter by site - Kelowna reads from its own index
    if (site === 'kelowna') {
      try {
        const kelownaData = await env.OROPEZAS_KV.get('kelowna_articles_index');
        if (kelownaData) {
          const parsed = JSON.parse(kelownaData);
          articles = parsed.articles || [];
        } else {
          articles = [];
        }
      } catch {
        articles = [];
      }
    }

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
    'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
    'Access-Control-Max-Age': '86400'
  };
}

async function handleChatMessage(message, env, site) {
  const isKelowna = site === 'kelowna';
  const kvKey = isKelowna ? 'kelowna_contenido' : 'contenido_completo';
  let sitioContenido = await env.SITIO_CONTENIDO.get(kvKey);
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
      if (contexto.length > 8000) contexto = contexto.substring(0, 8000);
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
    return isKelowna
      ? "The bot is indexing Kelowna content. Please try again in a few minutes."
      : "El bot está indexando el contenido. Espera unos minutos.";
  }

  const siteName = isKelowna ? 'Kelowna.Oropezas.com' : 'Oropezas.com';
  const siteDesc = isKelowna
    ? 'Kelowna.Oropezas.com is a local news website covering events and stories from Kelowna, BC, Canada. It is NOT a store.'
    : 'Oropezas.com is a local news website covering events and stories from San Luis Potosi, Mexico. It is NOT a store.';
  const systemPrompt = `You are the exclusive assistant of ${siteName}.
${siteDesc}
You answer questions about local news, events, weather, and general greetings.
If you cannot answer from the content below, say exactly: "I can help you with something related to ${siteName}"
If the user says "lemon" you become a normal AI assistant.
Content: ${contexto}`;

  const userPrompt = isKelowna ? message : `Pregunta: ${message}`;

  try {
    const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 256,
    });
    return response.response || `I can help you with something related to ${siteName}`;
  } catch (error) {
    console.error('[AI CHAT ERROR]', error);
    const errMsg = error.message || '';
    // Fallback: search indexed content for keywords
    const keywords = message.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const lines = contexto.split('\n');
    const matches = [];
    for (const line of lines) {
      const lower = line.toLowerCase();
      if (keywords.some(k => lower.includes(k))) {
        matches.push(line);
        if (matches.length >= 5) break;
      }
    }
    if (matches.length > 0) {
      const result = matches.join('\n\n');
      return isKelowna
        ? `(AI offline - searching content)\n\n${result.substring(0, 1000)}`
        : `(IA sin cuota - buscando en contenido)\n\n${result.substring(0, 1000)}`;
    }
    if (errMsg.includes('neuron') || errMsg.includes('quota') || errMsg.includes('limit')) {
      return isKelowna
        ? 'AI quota temporarily exceeded. Please try again in a few minutes.'
        : 'Cuota de IA excedida temporalmente. Intenta de nuevo en unos minutos.';
    }
    return isKelowna
      ? `Sorry, error: ${errMsg || 'unknown'}`
      : `Lo siento, error: ${errMsg || 'desconocido'}`;
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
    const { topic, category = 'noticias', tone = 'periodístico', length = 'medio', autoBlast = false, premium = false, premiumPrice = 2900, site = 'oropezas' } = body;

    if (!topic || topic.length < 5) {
      return new Response(JSON.stringify({ success: false, error: 'Tema requerido (mín 5 chars)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const wordCount = length === 'corto' ? 300 : length === 'largo' ? 1000 : 600;

    const prompt = `Eres periodista experto de San Luis Potosí para Oropezas.com.
Escribe un artículo periodístico completo sobre: "${topic}"

REGLAS ESTRICTAS:
- "title": titular periodístico corto y llamativo (máximo 90 caracteres). NO incluyas el cuerpo del artículo aquí.
- "subtitle": subtítulo complementario (máximo 120 caracteres)
- "excerpt": resumen de 1-2 oraciones del artículo (máximo 180 caracteres). NO uses "Borrador inicial" ni frases genéricas.
- "html": el cuerpo completo del artículo en HTML (~${wordCount} palabras), con etiquetas <p>, <h2>, <blockquote>, <ul>, <li>, <strong>. SIN markdown.
- "tags": array de 2-4 etiquetas relevantes
- "content": array de bloques [{type:"paragraph"|"heading"|"blockquote", html:"...", text:"..."}]
- Tono: ${tone}. Categoría: ${category}.

RESPONDE ÚNICAMENTE con este JSON válido (sin texto extra, sin markdown):
{"title":"...","subtitle":"...","excerpt":"...","html":"...","tags":["tag1","tag2"],"content":[{"type":"paragraph","html":"<p>...</p>","text":"..."}]}`;

    const aiText = await runAI(prompt, env, { maxTokens: 4096 });
    const article = construirArticuloNormalizado(parsearArticuloGemini(aiText), { topic, category, textoGemini: aiText });

    const slug = slugify(article.title);

    const date = new Date().toISOString().split('T')[0];
    const folder = article.folder || getFolderByCategory(article.category);
    const url = `article.html?slug=${slug}`;
    const id = `${slug}-${Date.now().toString(36)}`;
    const imageAsset = await resolverImagenArticulo(article, env, { slug, category: article.category });
    const featuredImage = imageAsset.url;

    await env.OROPEZAS_KV.put(`article:${id}`, JSON.stringify({
      ...article, id, url, slug, date, folder, site,
      featuredImage,
      image: featuredImage,
      imageKey: imageAsset.key,
      imageModel: imageAsset.model || null,
      publishedAt: new Date().toISOString(),
      status: 'published',
      premium: premium || false,
      premiumPrice: premium ? premiumPrice : null,
    }));

    let indexData = { articles: [], lastUpdated: '' };
    const indexRaw = await env.OROPEZAS_KV.get('articles_index');
    if (indexRaw) indexData = JSON.parse(indexRaw);

    indexData.articles.unshift({
      id, title: article.title, excerpt: article.excerpt,
      category: article.category, subcategory: article.category,
      date, image: featuredImage,
      url, slug, featured: false, tags: article.tags || [article.category],
      author: 'Oropezas AI', status: 'published', site,
      premium: premium || false,
      premiumPrice: premium ? premiumPrice : null,
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

// ═══════════════════════════════════════════════════════════════
// PAYWALL — Stripe Integration
// ═══════════════════════════════════════════════════════════════

// Mark an article as premium (requires API key)
async function handleSetPremium(request, env, corsHeaders) {
  try {
    const { articleId, premium = true, price = 2900 } = await request.json();
    if (!articleId) {
      return new Response(JSON.stringify({ success: false, error: 'articleId requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const raw = await env.OROPEZAS_KV.get(`article:${articleId}`);
    if (!raw) {
      return new Response(JSON.stringify({ success: false, error: 'Artículo no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const article = JSON.parse(raw);
    article.premium = premium;
    article.premiumPrice = price; // price in cents (e.g. 2900 = $29 MXN)
    await env.OROPEZAS_KV.put(`article:${articleId}`, JSON.stringify(article));

    // Also update articles_index
    const indexRaw = await env.OROPEZAS_KV.get('articles_index');
    if (indexRaw) {
      const indexData = JSON.parse(indexRaw);
      indexData.articles = indexData.articles.map(a =>
        a.id === articleId ? { ...a, premium, premiumPrice: price } : a
      );
      indexData.lastUpdated = new Date().toISOString();
      await env.OROPEZAS_KV.put('articles_index', JSON.stringify(indexData));
    }

    return new Response(JSON.stringify({
      success: true,
      articleId,
      premium,
      premiumPrice: price,
      message: premium ? `Artículo marcado como premium ($${(price/100).toFixed(2)})` : 'Artículo marcado como gratuito'
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Create a Stripe Checkout Session for a premium article
async function handleStripeCheckout(request, env, corsHeaders) {
  try {
    const { articleId, articleSlug, articleTitle, email } = await request.json();
    if (!articleId && !articleSlug) {
      return new Response(JSON.stringify({ success: false, error: 'articleId o articleSlug requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const stripeKey = env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      return new Response(JSON.stringify({ success: false, error: 'Stripe no configurado' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Resolve article
    let article = null;
    if (articleId) {
      const raw = await env.OROPEZAS_KV.get(`article:${articleId}`);
      if (raw) article = JSON.parse(raw);
    } else {
      // lookup by slug in index
      const indexRaw = await env.OROPEZAS_KV.get('articles_index');
      if (indexRaw) {
        const indexData = JSON.parse(indexRaw);
        const indexEntry = indexData.articles.find(a => a.slug === articleSlug);
        if (indexEntry) {
          const raw = await env.OROPEZAS_KV.get(`article:${indexEntry.id}`);
          if (raw) article = JSON.parse(raw);
        }
      }
    }

    if (!article) {
      return new Response(JSON.stringify({ success: false, error: 'Artículo no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!article.premium) {
      return new Response(JSON.stringify({ success: false, error: 'Este artículo no es premium' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const price = article.premiumPrice || 2900;
    const title = article.title || articleTitle || 'Artículo Premium';
    const slug = article.slug || articleSlug;
    const id = article.id || articleId;
    const siteUrl = CONFIG.SITE_URL;

    // Build Stripe Checkout Session via REST API
    const params = new URLSearchParams();
    params.append('mode', 'payment');
    params.append('payment_method_types[]', 'card');
    params.append('line_items[0][price_data][currency]', 'mxn');
    params.append('line_items[0][price_data][unit_amount]', String(price));
    params.append('line_items[0][price_data][product_data][name]', title);
    params.append('line_items[0][price_data][product_data][description]', 'Artículo de alto valor — Oropezas.com');
    if (article.image) {
      params.append('line_items[0][price_data][product_data][images][]', article.image);
    }
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${siteUrl}/article.html?slug=${slug}&paid=1&session_id={CHECKOUT_SESSION_ID}`);
    params.append('cancel_url', `${siteUrl}/article.html?slug=${slug}`);
    params.append('metadata[articleId]', id);
    params.append('metadata[articleSlug]', slug);
    if (email) params.append('customer_email', email);

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ success: false, error: session.error?.message || 'Stripe error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Stripe webhook — called by Stripe when payment completes
async function handleStripeWebhook(request, env, corsHeaders) {
  try {
    const payload = await request.text();
    const sig = request.headers.get('stripe-signature');
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;

    // Verify Stripe signature if webhook secret is configured
    if (webhookSecret && sig) {
      const valid = await verifyStripeSignature(payload, sig, webhookSecret);
      if (!valid) {
        return new Response(JSON.stringify({ error: 'Invalid signature' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const event = JSON.parse(payload);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.payment_status === 'paid') {
        const articleId = session.metadata?.articleId;
        const articleSlug = session.metadata?.articleSlug;
        const sessionId = session.id;
        const email = session.customer_details?.email || session.customer_email || null;

        // Grant access: store by sessionId and optionally by email
        const accessRecord = {
          articleId,
          articleSlug,
          sessionId,
          email,
          paidAt: new Date().toISOString(),
          amountTotal: session.amount_total,
          currency: session.currency,
        };

        // Store by sessionId (used by frontend on return)
        await env.OROPEZAS_KV.put(
          `stripe:access:session:${sessionId}`,
          JSON.stringify(accessRecord),
          { expirationTtl: 60 * 60 * 24 * 365 } // 1 year
        );

        // Store by email + articleId for repeat access
        if (email) {
          const emailKey = `stripe:access:email:${email}:${articleId}`;
          await env.OROPEZAS_KV.put(emailKey, JSON.stringify(accessRecord), {
            expirationTtl: 60 * 60 * 24 * 365
          });
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Check if a session/email has access to a premium article
async function handleStripeAccess(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session_id');
    const email = url.searchParams.get('email');
    const articleId = url.searchParams.get('article_id');

    let hasAccess = false;
    let record = null;

    if (sessionId) {
      const raw = await env.OROPEZAS_KV.get(`stripe:access:session:${sessionId}`);
      if (raw) {
        record = JSON.parse(raw);
        // Verify it matches the requested article
        if (!articleId || record.articleId === articleId || record.articleSlug === articleId) {
          hasAccess = true;
        }
      }
    }

    if (!hasAccess && email && articleId) {
      const raw = await env.OROPEZAS_KV.get(`stripe:access:email:${email}:${articleId}`);
      if (raw) {
        record = JSON.parse(raw);
        hasAccess = true;
      }
    }

    return new Response(JSON.stringify({ hasAccess, record: hasAccess ? record : null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// Minimal Stripe webhook signature verification using Web Crypto API
async function verifyStripeSignature(payload, sigHeader, secret) {
  try {
    const parts = sigHeader.split(',').reduce((acc, part) => {
      const [k, v] = part.split('=');
      acc[k.trim()] = v.trim();
      return acc;
    }, {});
    const timestamp = parts['t'];
    const v1 = parts['v1'];
    if (!timestamp || !v1) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(signedPayload));
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex === v1;
  } catch (e) {
    return false;
  }
}

// ── USER PROFILE ─────────────────────────────────────────────────────────────

async function handleGetUserProfile(request, env, corsHeaders) {
  try {
    const url = new URL(request.url);
    const uid = url.searchParams.get('uid');
    if (!uid) {
      return new Response(JSON.stringify({ error: 'uid requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const raw = await env.OROPEZAS_KV.get(`user:${uid}`);
    if (!raw) {
      return new Response(JSON.stringify({ error: 'Usuario no encontrado' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const user = JSON.parse(raw);
    const isVerified = user.verified || user.role === 'ceo' || user.role === 'publisher' || user.role === 'ai';
    const verifiedLabel = user.verifiedLabel || (
      user.role === 'ceo' ? 'Fundador' :
      user.role === 'publisher' ? 'Publisher' :
      user.role === 'ai' ? 'Official AI' : ''
    );
    return new Response(JSON.stringify({
      uid:           user.uid,
      name:          user.name          || '',
      displayName:   user.displayName   || user.name || '',
      picture:       user.picture       || '',
      role:          user.role          || 'user',
      title:         user.title         || '',
      bio:           user.bio           || '',
      verified:      isVerified,
      verifiedLabel: verifiedLabel,
      joinedAt:      user.joinedAt      || '',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function handleUpdateUserProfile(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { uid, token, title, bio, displayName } = body;
    if (!uid || !token) {
      return new Response(JSON.stringify({ success: false, error: 'uid y token requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const payload = decodeGoogleToken(token);
    if (!payload || payload.sub !== uid) {
      return new Response(JSON.stringify({ success: false, error: 'Token invalido' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const raw = await env.OROPEZAS_KV.get(`user:${uid}`);
    const user = raw ? JSON.parse(raw) : { uid, role: 'user' };
    if (title       !== undefined) user.title       = String(title).substring(0, 100);
    if (bio         !== undefined) user.bio         = String(bio).substring(0, 500);
    if (displayName !== undefined) user.displayName = String(displayName).substring(0, 80);
    await env.OROPEZAS_KV.put(`user:${uid}`, JSON.stringify(user));
    return new Response(JSON.stringify({ success: true, user }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ── DASHBOARD PUBLISH (frontend alias, requires valid Google token + ceo/publisher role) ──

async function handleDashboardPublish(request, env, corsHeaders) {
  try {
    const authHeader = request.headers.get('Authorization') || '';
    const token = authHeader.replace('Bearer ', '').trim();
    const payload = token ? decodeGoogleToken(token) : null;
    if (!payload) {
      return new Response(JSON.stringify({ success: false, error: 'Autenticacion requerida' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const rawUser = await env.OROPEZAS_KV.get(`user:${payload.sub}`);
    const user = rawUser ? JSON.parse(rawUser) : null;
    if (!user || !['ceo', 'publisher'].includes(user.role)) {
      return new Response(JSON.stringify({ success: false, error: 'Sin permisos para publicar' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const body = await request.json();
    const fakeReq = new Request(
      request.url.replace('/api/dashboard/publish', '/api/agent/auto-publish'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': env.API_KEY },
        body: JSON.stringify({ ...body, autoPublish: true })
      }
    );
    return handleAgentAutoPublish(fakeReq, env, corsHeaders);
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

// ── AGENT DELETE ─────────────────────────────────────────────────────────────

async function handleAgentDelete(request, env, corsHeaders) {
  const authErr = validarApiKeyAgente(request, env, corsHeaders);
  if (authErr) return authErr;
  try {
    const { articleId, slug } = await request.json();
    if (!articleId && !slug) {
      return new Response(JSON.stringify({ success: false, error: 'articleId o slug requerido' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    // Remove from KV
    if (articleId) {
      await env.OROPEZAS_KV.delete(`article:${articleId}`);
    }
    // Update articles_index
    const rawIdx = await env.OROPEZAS_KV.get('articles_index');
    if (rawIdx) {
      const idx = JSON.parse(rawIdx);
      const before = (idx.articles || []).length;
      idx.articles = (idx.articles || []).filter(a =>
        (articleId ? a.id !== articleId : true) && (slug ? a.slug !== slug : true)
      );
      if (idx.articles.length !== before) {
        await env.OROPEZAS_KV.put('articles_index', JSON.stringify(idx));
      }
    }
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
// Deploy trigger: 2026-05-04T00:58:38Z

// FIXED: Removed stray Z character that caused ReferenceError
