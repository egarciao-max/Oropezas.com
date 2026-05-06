# AGENTS.md — Oropezas.com + Kelowna.Oropezas.com

> Documento de arquitectura y convenciones para agentes de código. El proyecto está completamente en español; código, comentarios y contenido usan español como idioma principal.

---

## Resumen del proyecto

**Oropezas.com** es un periódico digital con dos ediciones:
1. **Oropezas.com** — Noticias locales de San Luis Potosí, México
2. **Kelowna.Oropezas.com** — Noticias locales de Kelowna, BC, Canadá

Ambos sitios comparten un único backend Cloudflare Worker y un único repositorio GitHub.

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | HTML5, CSS3, JavaScript vanilla (ES6+) |
| Frontend hosting | Cloudflare Pages |
| Backend runtime | Cloudflare Workers (V8 isolate) |
| Backend framework | Ninguno — JavaScript vanilla con ES modules |
| AI | Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct` para texto, `@cf/black-forest-labs/flux-1-schnell` para imágenes) |
| Imágenes | Cloudflare R2 (bucket `OROPEZAS_MEDIA`) |
| Email | Resend API |
| Notificaciones push | Web Push |
| Persistencia | Cloudflare KV (`OROPEZAS_KV`, `SITIO_CONTENIDO`, `SUSCRIPCIONES`, `PUSH_SUBSCRIPTIONS`, `OROPEZAS_FOROS`) |
| Auth | Google Identity Services (OAuth 2.0 TokenClient + renderButton fallback) |
| Monetización | Google AdSense (pub-8411594357975477) |
| Deploy CLI | Wrangler v3.90.0 (via GitHub Actions) |

---

## Estructura de directorios

```
.
├── Prensa_2/                 # Frontend estático (Cloudflare Pages)
│   ├── index.html              # Oropezas México — página de inicio
│   ├── noticias.html           # Listado de noticias
│   ├── deportes.html           # Sección deportes
│   ├── about.html              # Acerca de
│   ├── contacto.html           # Contacto (con CEO banner)
│   ├── article.html            # Renderizador de artículos (?slug=)
│   ├── article-template.html   # Plantilla base
│   ├── navbar.html             # Navegación reutilizable
│   ├── footer.html             # Pie reutilizable
│   ├── styles.css              # Hoja de estilos principal
│   ├── news-loader.js          # Carga artículos con fallback offline
│   ├── auth.js                 # Google Sign-In + gestión de sesión
│   ├── adsense.js              # Cookie consent + AdSense loader
│   ├── robots.txt              # Permite Googlebot y Mediapartners-Google
│   ├── ads.txt                 # AdSense publisher ID
│   ├── privacidad.html         # Política de privacidad (con sección AdSense)
│   ├── terminos.html           # Términos de uso
│   ├── js/
│   │   └── article.js          # Carga artículos JSON dinámicos
│   ├── kelowna/                # Kelowna (lowercase) — mirror de /Kelowna/
│   │   ├── index.html
│   │   ├── article.html
│   │   ├── contacto.html         # Con CEO banner: Marty Strikwerda
│   │   ├── about.html
│   │   ├── main.js               # Loader de navbar/footer
│   │   ├── kelowna-articles.js   # Artículos embebidos offline
│   │   └── navbar.html           # Navbar con botón 🇲🇽 Oropezas
│   └── Kelowna/                # Kelowna (uppercase) — para Cloudflare Pages
│       ├── index.html
│       ├── article.html
│       ├── contacto.html
│       ├── about.html
│       ├── main.js
│       ├── kelowna-articles.js
│       └── navbar.html
│
├── oropezas/                 # Backend Cloudflare Worker
│   ├── src/
│   │   └── worker.js           # Único archivo backend (~2500 líneas)
│   ├── package.json
│   ├── wrangler.jsonc          # Configuración deploy, KV, R2, AI
│   ├── .prettierrc
│   └── .editorconfig
│
├── .github/workflows/
│   └── deploy.yml              # GitHub Actions: deploy worker en push a main
│
├── README.md
└── AGENTS.md                 # Este archivo
```

---

## Dos sitios, un backend

| Sitio | URL | Contenido |
|-------|-----|-----------|
| Oropezas México | `https://oropezas.com` | Artículos de SLP, botón 🇨🇦 Kelowna |
| Kelowna | `https://oropezas.com/kelowna/` o `/Kelowna/` | Artículos de Kelowna, botón 🇲🇽 Oropezas |

Ambos sitíos cargan navbar/footer dinámicamente y comparten `auth.js`, `adsense.js`, y el mismo Worker.

---

## Endpoints del Worker

| Método | Ruta | Descripción | Protegido |
|--------|------|-------------|-----------|
| `POST` | `/api/agent/write` | Genera borrador de artículo con Llama 3.1 | — |
| `POST` | `/api/agent/publish` | Publica borrador como artículo en KV | — |
| `POST` | `/api/agent/auto-publish` | Genera + publica automáticamente | — |
| `POST` | `/api/agent/blast` | Envía artículo a suscriptores | — |
| `POST` | `/api/agent/generate-image` | Genera imagen con Flux-1, guarda en R2 | `x-api-key` |
| `GET`  | `/api/agent/dashboard` | Estadísticas de borradores/publicados | — |
| `GET`  | `/api/articles` | Lista artículos. Query `?site=kelowna` filtra por ciudad | — |
| `GET`  | `/api/article/:slug` | Devuelve artículo por slug | — |
| `POST` | `/api/auth/google` | Valida token Google (idToken o accessToken) | — |
| `POST` | `/api/create-article` | Crea artículo con formato completo, guarda en KV | `x-api-key` |
| `POST` | `/api/subscribe` | Suscripción newsletter (nombre + email) | — |
| `POST` | `/api/push/subscribe` | Guarda suscripción push | — |
| `POST` | `/api/push/send` | Envía notificación push | — |
| `POST` | `/api/chat/webhook` | Webhook Google Chat | — |
| `GET`  | `/api/media/:key` | Sirve imágenes desde R2 | — |
| `POST` | `/` | Chatbot (campo `message` + `site`) | — |
| `POST` | `/` | Newsletter (`action: 'suscribir'`) | — |
| `POST` | `/` | Contacto (`action: 'contactar'`) | — |
| `GET`  | `/` | Estado del bot / indexación | — |

---

## Almacenamiento (KV + R2)

### KV Namespaces

| Binding | Propósito |
|---------|-----------|
| `PUSH_SUBSCRIPTIONS` | Datos de suscripciones push |
| `SITIO_CONTENIDO` | Texto rastreado del sitio para contexto del chatbot |
| `SUSCRIPCIONES` | Lista de suscriptores de email |
| `OROPEZAS_KV` | Artículos (`article:${id}`), índices (`articles_index`, `kelowna_articles_index`), usuarios (`user:${uid}`), borradores |
| `OROPEZAS_FOROS` | Datos de foros |

### R2 Bucket

| Binding | Propósito |
|---------|-----------|
| `OROPEZAS_MEDIA` | Imágenes generadas por IA y subidas. Estructura: `articles/{category}/{slug}.png` |

---

## Formatos de artículo

### Worker espera (API y KV)

```json
{
  "id": "article-1234567890-abc123",
  "title": "Título del artículo",
  "slug": "url-friendly-slug",
  "excerpt": "Resumen corto para tarjetas",
  "html": "<p>Contenido HTML completo...</p>",
  "content": [{"html": "<p>Bloque 1</p>"}, {"html": "<p>Bloque 2</p>"}],
  "category": "noticias",
  "date": "2026-05-05",
  "author": "Redacción Oropezas",
  "site": "main",
  "status": "published",
  "featuredImage": "https://.../image.png",
  "image": "https://.../image.png",
  "tags": ["tag1", "tag2"]
}
```

### Frontend espera (embedded fallback)

```javascript
{
  slug: 'url-slug',
  title: 'Título',
  excerpt: 'Resumen',
  category: 'Noticias',
  date: '2026-05-05',
  author: 'Autor',
  image: 'https://.../img.jpg',
  featuredImage: 'https://.../img.jpg',
  html: '<p>HTML...</p>'  // opcional, para article.html
}
```

**Campos obligatorios para que el frontend renderice:** `slug`, `title`, `excerpt`, `category`, `date`, `image`/`featuredImage`.

---

## Autenticación (Google OAuth)

### Frontend (`auth.js`)

- **Método principal:** `google.accounts.oauth2.initTokenClient().requestAccessToken()` — popup OAuth, funciona con cookies de terceros bloqueadas.
- **Fallback:** `google.accounts.id.renderButton()` — botón oficial de Google en iframe.
- **Timeout de seguridad:** Si el popup no abre en 6s (iOS Safari), muestra error con botón "Reintentar".
- **Client ID:** `233406003665-phh7pcmg6gr23fdlsfjb5db90avi9vrb.apps.googleusercontent.com`

### Backend (`/api/auth/google`)

Acepta dos métodos:
1. **ID Token** (JWT): `{ idToken: "..." }` — validado con `decodeGoogleToken()` (verificación local de firma JWT)
2. **Access Token** (OAuth popup): `{ accessToken: "..." }` — validado llamando `https://www.googleapis.com/oauth2/v3/userinfo`

Ambos crean/guardan perfil de usuario en KV (`user:${uid}`).

---

## Generación de imágenes

### Endpoint: `POST /api/agent/generate-image`

Headers requeridos:
- `Content-Type: application/json`
- `x-api-key: QuiqueyMau2025@`

Body:
```json
{
  "prompt": "Descripción de la imagen en inglés",
  "category": "noticias",
  "slug": "article-slug",
  "excerpt": "Descripción corta"
}
```

Proceso:
1. Llama Cloudflare Workers AI con modelo `@cf/black-forest-labs/flux-1-schnell`
2. Guarda bytes de imagen en R2: `articles/{category}/{slug}.png`
3. Devuelve URL pública: `https://oropezas.enriquegarciaoropeza.workers.dev/api/media/articles/{category}/{slug}.png`

---

## Google AdSense

- **Publisher ID:** `pub-8411594357975477`
- **ads.txt:** `google.com, pub-8411594357975477, DIRECT, f08c47fec0942fa0`
- **Formatos activos:**
  - In-article (fluid) — slot `6024521903`
  - Auto-relaxed — slot `7501255101`
  - Auto (responsive) — slot `6188173433`
- **Cookie consent:** Banner GDPR/CCPA en `adsense.js`. Usuario debe clic "Aceptar" antes de cargar ads.
- **AMP auto-ads:** `<amp-auto-ads type="adsense" data-ad-client="ca-pub-8411594357975477">` en todas las páginas.

---

## Chatbot

- **Mensaje de bienvenida:** "Hola, soy tu asistente de noticias de [Oropezas.com / Kelowna.Oropezas.com]"
- **Sistema de prompts:** Incluye descripción explícita del sitio como "periódico digital, NO tienda" para evitar alucinaciones.
- **Fallback sin IA:** Si la cuota de neurons de Cloudflare AI se agota, busca palabras clave en el contenido indexado y devuelve fragmentos relevantes.
- **Contexto limitado:** Máximo 8000 caracteres del sitio indexado para no exceder el límite de tokens.

---

## Secrets del Worker

Configurar en Cloudflare Dashboard → Workers → Variables and Secrets:

| Secret | Propósito |
|--------|-----------|
| `API_KEY` | Protege `/api/agent/generate-image` (valor: `QuiqueyMau2025@`) |
| `GEMINI_API_KEY` | Ya no se usa — migrado a Cloudflare Workers AI |
| `RESEND_API_KEY` | Envío de emails |
| `ARTICLE_SECRET` | Protección legacy (puede removerse) |
| `GOOGLE_CHAT_SECRET` | Autenticar webhooks de Google Chat |

---

## Comandos de build y deploy

### Backend (`oropezas/`)

```bash
cd oropezas
npm install
npm run dev        # Desarrollo local (Wrangler dev)
npm run deploy     # Deploy manual
```

Deploy automático vía GitHub Actions en cada push a `main`.

### Frontend (`Prensa_2/`)

Deploy automático vía Cloudflare Pages conectado al mismo repo GitHub.

---

## Convenciones de código

- **Indentación:** Tabulaciones (tabs)
- **Comillas:** Simples
- **Punto y coma:** Sí
- **Ancho de línea:** 140 caracteres
- **Idioma:** Español para todo (código, comentarios, mensajes de error)
- **Respuestas JSON:** Campo `success` (booleano) + `error` (string) en errores

---

## Notas para agentes

- **Dos sitios, un repo:** Cualquier cambio en `Prensa_2/kelowna/` debe copiarse a `Prensa_2/Kelowna/` (uppercase) para que Cloudflare Pages sirva ambas rutas.
- **Cache-busting:** Los archivos JS compartidos (`auth.js`, `news-loader.js`, `adsense.js`, `kelowna-articles.js`) usan `?v=N` en los `<script>` para forzar recarga en navegadores.
- **No modularizar el Worker:** Intencionalmente un solo archivo `worker.js`. Si se divide, agregar bundler (esbuild).
- **Chatbot duplicado:** El código del chat está inline en cada HTML. Extraer a `chat.js` sería ideal.
- **Fallback offline:** `news-loader.js` y `kelowna-articles.js` tienen artículos embebidos para que el sitio funcione aunque el Worker falle.
- **CEO Kelowna:** Marty Strikwerda aparece solo en `contacto.html` de Kelowna (no en navbar).
- **Imágenes en R2:** Las URLs públicas usan el Worker como proxy: `/api/media/{key}`. No exponer R2 directamente.
