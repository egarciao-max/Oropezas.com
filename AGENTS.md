# AGENTS.md — Oropezas.com

> Este documento describe la arquitectura, convenciones y procesos del proyecto Oropezas.com para agentes de código. El proyecto está completamente en español; código, comentarios y contenido usan español como idioma principal.

---

## Resumen del proyecto

**Oropezas.com** es un periódico digital enfocado en noticias locales de San Luis Potosí, México. El repositorio contiene dos componentes principales:

1. **`Prensa_2/`** — Sitio web estático (frontend). Páginas HTML planas con CSS y JavaScript vanilla. No usa frameworks de frontend ni herramientas de build.
2. **`oropezas/`** — Backend API desplegado como Cloudflare Worker. Un único archivo JavaScript (`src/worker.js`) que expone endpoints REST, integra inteligencia artificial (Google Gemini), envío de correos (Resend), notificaciones push y almacena datos en Cloudflare KV.

---

## Stack tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | HTML5, CSS3, JavaScript vanilla (ES6+) |
| Backend runtime | Cloudflare Workers (V8 isolate) |
| Backend framework | Ninguno — JavaScript vanilla con ES modules |
| Bundler / build | Ninguno en ambas partes |
| Deploy CLI | Wrangler v4.85.0 |
| AI | Google Gemini API (`generativelanguage.googleapis.com`) |
| Email | Resend API |
| Notificaciones push | Web Push (básico, `fetch` al endpoint de suscripción) |
| Persistencia | Cloudflare KV |

---

## Estructura de directorios

```
.
├── Prensa_2/                 # Frontend estático
│   ├── index.html              # Página de inicio
│   ├── noticias.html           # Listado de noticias
│   ├── deportes.html           # Sección deportes
│   ├── about.html              # Acerca de
│   ├── contacto.html           # Contacto
│   ├── article.html            # Renderizador de artículos dinámicos (por ?slug=)
│   ├── article-template.html   # Plantilla base de artículo estático
│   ├── navbar.html             # Componente reutilizable de navegación
│   ├── footer.html             # Componente reutilizable de pie
│   ├── styles.css              # Hoja de estilos principal (~813 líneas)
│   ├── js/
│   │   └── article.js          # Carga artículos JSON dinámicos
│   ├── data/articles/          # Artículos en JSON para carga dinámica
│   ├── SLPOPEN2026/            # Artículos estáticos del torneo de tenis + fotos/videos
│   ├── tecnologia/             # Artículos estáticos de tecnología
│   └── ... (páginas legales, etc.)
│
├── oropezas/                 # Backend Cloudflare Worker
│   ├── src/
│   │   └── worker.js           # Único archivo de la aplicación backend (~851 líneas)
│   ├── package.json
│   ├── wrangler.jsonc          # Configuración de deploy y KV namespaces
│   ├── .prettierrc
│   └── .editorconfig
│
├── README.md
└── AGENTS.md                 # Este archivo
```

---

## Organización del código

### Frontend (`Prensa_2/`)

- **Páginas estáticas**: Cada sección es un archivo `.html` independiente. No hay routing dinámico.
- **Componentes reutilizables**: `navbar.html` y `footer.html` se inyectan vía `fetch()` en runtime desde los scripts de cada página (código inline en los HTML).
- **Sistema de artículos híbrido**:
  - **Estáticos**: Archivos `.html` completos en subdirectorios (`SLPOPEN2026/`, `tecnologia/`).
  - **Dinámicos**: Archivos JSON en `data/articles/`. `article.html` + `js/article.js` los renderizan usando el query parameter `?slug=`.
- **Chatbot embebido**: Código HTML/CSS/JS del chatbot "Oropezas AI" está duplicado inline en casi todas las páginas. Consume el Worker en `oropezas.enriquegarciaoropeza.workers.dev`.

### Backend (`oropezas/src/worker.js`)

El Worker es un único archivo que maneja todas las rutas. No hay división en módulos.

Endpoints principales:

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/agent/write` | Genera borrador de artículo con Gemini |
| `POST` | `/api/agent/publish` | Publica borrador como artículo (guarda en KV como JSON) |
| `POST` | `/api/agent/auto-publish` | Genera y publica un artículo automáticamente en un solo paso |
| `POST` | `/api/agent/blast` | Envía artículo a suscriptores por email o push |
| `GET`  | `/api/agent/dashboard` | Estadísticas de borradores, publicados y audiencia |
| `GET`  | `/api/articles` | Lista artículos publicados (con filtros `?category=` y `?featured=true`) |
| `GET`  | `/api/article/:slug` | Devuelve un artículo publicado por su slug (JSON) |
| `POST` | `/api/chat/webhook` | Webhook de Google Chat API para comandos de voz/remotos |
| `POST` | `/api/push/subscribe` | Guarda suscripción push en KV |
| `POST` | `/api/push/send` | Envía notificación push a todas las suscripciones |
| `POST` | `/api/create-article` | Endpoint protegido con `x-api-key` para crear artículos |
| `POST` | `/rastrear` | Inicia rastreo del sitio (indexación para el chatbot) |
| `GET`  | `/estado` | Estado del bot y última indexación |
| `POST` | `/` | Chatbot, suscripciones y contacto (diferenciados por campo `action` o `message`) |
| `GET`  | `/` | Estado del bot y verificación de indexación |

Además, tiene un **trigger CRON** configurado en `wrangler.jsonc` que ejecuta `crawlAndStore` cada 23 horas para reindexar el sitio.

Namespaces de KV configurados en `wrangler.jsonc`:

| Binding | Propósito |
|---------|-----------|
| `PUSH_SUBSCRIPTIONS` | Datos de suscripciones push |
| `SITIO_CONTENIDO` | Texto rastreado del sitio para contexto del chatbot |
| `SUSCRIPCIONES` | Lista de suscriptores de email |
| `OROPEZAS_KV` | Borradores, artículos publicados e índice de artículos (referenciado en código, no en config) |

Secrets esperados en el entorno del Worker (no en `wrangler.jsonc`, se configuran vía dashboard o `wrangler secret`):
- `GEMINI_API_KEY`
- `RESEND_API_KEY`
- `ARTICLE_SECRET`
- `GOOGLE_CHAT_SECRET` (para autenticar webhooks de Google Chat)

---

## Comandos de build, desarrollo y deploy

### Backend (`oropezas/`)

```bash
cd oropezas

# Instalar dependencias
npm install

# Servidor de desarrollo local (Wrangler dev)
npm run dev
# o
npm start

# Desplegar a Cloudflare Workers
npm run deploy
```

- **No hay paso de build**: `src/worker.js` se despliega tal cual.
- **No hay scripts de test, lint ni formato** definidos en `package.json`.

### Frontend (`Prensa_2/`)

- **Sin proceso de build**: Son archivos estáticos listos para servirse.
- Se despliega como archivos estáticos en cualquier CDN o hosting estático (Cloudflare Pages, etc.).

---

## Guía de estilo de código

Configuración definida en `.prettierrc` y `.editorconfig` (ubicados en `oropezas/`, aplicables al proyecto):

- **Indentación**: Tabulaciones (tabs), no espacios.
- **Comillas simples**: `singleQuote: true`
- **Punto y coma**: `semi: true`
- **Ancho de línea**: `printWidth: 140`
- **Fin de línea**: LF (`\n`)
- **Charset**: UTF-8
- **Eliminar espacios al final de línea**: sí
- **Insertar nueva línea al final del archivo**: sí
- **Archivos `.yml`**: usan espacios en lugar de tabs.

Convenciones observadas en el código:
- Variables y funciones en español (ej. `handleAgentWrite`, `handleSubscribe`, `crawlAndStore`, `suscriptores`).
- Constantes de configuración en mayúsculas (ej. `ALLOWED_ORIGINS`, `CONFIG`).
- Respuestas HTTP en formato JSON con campo `success` booleano.
- Comentarios en español.

---

## Instrucciones de testing

**No hay infraestructura de testing.**
- No hay frameworks de test instalados (Jest, Vitest, Mocha, etc.).
- No hay archivos de test.
- No hay configuración de CI/CD visible.

Para verificar cambios se recomienda:
1. Ejecutar `npm run dev` en `oropezas/` y probar los endpoints manualmente.
2. Servir `Prensa_2/` con un servidor local estático (Live Server, `python -m http.server`, etc.) y verificar la integración con el Worker.

---

## Consideraciones de seguridad

- **CORS**: El Worker valida el origen contra una lista blanca (`ALLOWED_ORIGINS`). Incluye dominios de producción, `localhost` y `*.oropezas.pages.dev`.
- **API key de artículos**: El endpoint `/api/create-article` requiere el header `x-api-key` que debe coincidir con el secret `ARTICLE_SECRET`.
- **Secrets**: Las claves de API (`GEMINI_API_KEY`, `RESEND_API_KEY`, `ARTICLE_SECRET`) deben configurarse como secrets del Worker, nunca hardcodeadas en el código.
- **Email de admin**: `CONFIG.ADMIN_EMAIL` está hardcodeado en `worker.js` (`enrique@oropezas.com`, `majo@oropezas.com`).
- **Rastreo del sitio**: `crawlAndStore` solo rastrea URLs bajo `https://oropezas.com` y limita a 50 páginas. Ignora archivos estáticos (`css`, `js`, `jpg`, etc.) y rutas de Cloudflare (`/cdn-cgi/`).

---

## Notas para agentes de código

- **Idioma**: Todo el contenido, comentarios y respuestas de la API están en español. Mantén el español para cualquier nuevo código, comentarios o mensajes de error.
- **No modularizar sin necesidad**: El Worker está intencionalmente en un solo archivo. Si se decide dividirlo, considérese que Wrangler no tiene bundler configurado; habría que agregar uno (ej. esbuild) o importar módulos nativamente.
- **Duplicación en frontend**: El widget del chatbot está copiado en múltiples archivos HTML. Si se modifica, hay que actualizar todas las páginas o extraerlo a un componente reutilizable.
- **Sistema de artículos migrado a JSON**: El Worker ahora publica artículos como JSON puro (no como páginas HTML completas). Los artículos nuevos se renderizan dinámicamente en `article.html?slug=`. Los artículos estáticos antiguos (HTML) siguen funcionando por compatibilidad.
- **Google Chat API**: El Worker expone `/api/chat/webhook` para recibir comandos de Google Chat (`/publicar`, `/borrador`, `/estado`, `/blast`, `/ayuda`). Requiere configurar la URL del webhook en el panel de Google Chat.
- **Imágenes de artículos**: El Worker sugiere rutas de imagen como `${folder}/FOTOS/${slug}.jpg`, pero no gestiona el almacenamiento de imágenes. Las imágenes deben subirse manualmente al frontend.
