# THE OROPEZAS BIBLE
## Complete Technical Reference for the AI Agent Team
### Oropezas.com + Kelowna.oropezas.com — Unified Full-Stack Platform

---

## TABLE OF CONTENTS

1. [Architecture Overview](#1-architecture-overview)
2. [Token Types & Authentication](#2-token-types--authentication)
3. [Data Stores](#3-data-stores)
4. [Worker.js — Complete Function Reference](#4-workerjs--complete-function-reference)
5. [API Endpoints — Every Route](#5-api-endpoints--every-route)
6. [Frontend Files & Auth Flow](#6-frontend-files--auth-flow)
7. [AI Agent System](#7-ai-agent-system)
8. [Forum System](#8-forum-system)
9. [Push Notifications](#9-push-notifications)
10. [Image Generation & Media](#10-image-generation--media)
11. [Stripe Paywall (Disabled)](#11-stripe-paywall-disabled)
12. [Deployment & Environment](#12-deployment--environment)
13. [Debugging & Troubleshooting](#13-debugging--troubleshooting)
14. [Rules for AI Agents](#14-rules-for-ai-agents)

---

## 1. ARCHITECTURE OVERVIEW

### 1.1 System Architecture

```
                    USER BROWSER
                         │
                         ▼
            ┌────────────────────────┐
            │   Cloudflare Pages     │
            │   (Static HTML/CSS/JS) │
            │                        │
            │  Prensa_2/             │
            │  ├── index.html        │
            │  ├── article.html      │
            │  ├── auth.js           │
            │  ├── news-loader.js    │
            │  ├── chatbot.js        │
            │  ├── adsense.js        │
            │  ├── kelowna/          │
            │  └── Kelowna/          │
            └──────────┬─────────────┘
                       │
                       ▼
            ┌────────────────────────┐
            │   Cloudflare Worker    │
            │   (src/worker.js)      │
            │   ~2820 lines          │
            │                        │
            │  REST API server       │
            │  AI inference          │
            │  Auth verification     │
            │  Forum moderation      │
            └──────────┬─────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
    ┌─────────┐ ┌──────────┐ ┌──────────┐
    │   D1    │ │ Firestore│ │   R2     │
    │ SQLite  │ │  (Users) │ │ (Images) │
    │(Articles│ │          │ │          │
    └─────────┘ └──────────┘ └──────────┘
          │            │            │
          ▼            ▼            ▼
    ┌─────────┐ ┌──────────┐ ┌──────────┐
    │   KV    │ │ Firebase │ │Cloudflare│
    │(Legacy) │ │  Auth    │ │Workers AI│
    └─────────┘ └──────────┘ └──────────┘
```

### 1.2 Domains & Routing

| Domain | Content | Path |
|--------|---------|------|
| `oropezas.com` | Main site | `Prensa_2/index.html` |
| `kelowna.oropezas.com` | Kelowna site | `Prensa_2/kelowna/index.html` |
| Worker API | Backend | `oropezas.enriquegarciaoropeza.workers.dev` |

### 1.3 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML5 + CSS3 + JS (ES modules) |
| Backend | Cloudflare Worker (single file: `src/worker.js`) |
| Database (Articles) | Cloudflare D1 (SQLite) |
| Database (Users) | Firebase Firestore (via REST API) |
| Auth | Firebase Auth + Google OAuth (3-token support) |
| Images | Cloudflare R2 (`oropezas-media` bucket) |
| AI | Cloudflare Workers AI (`@cf/meta/llama-3.1-8b-instruct`, `@cf/black-forest-labs/flux-1-schnell`) |
| Cache/Legacy | Cloudflare KV (5 namespaces) |
| Email | Cloudflare Email Workers / Resend |
| Payments | Stripe (disabled) |
| Ads | Google AdSense (`pub-8411594357975477`) |

---

## 2. TOKEN TYPES & AUTHENTICATION

### 2.1 Three-Token Architecture

The system accepts THREE types of tokens. Priority order:

```
firebaseToken (NEW — preferred)
    ↓
idToken (legacy GIS)
    ↓
accessToken (legacy TokenClient)
```

### 2.2 Token Type 1: Firebase ID Token

**What it is**: A JWT issued by Firebase Auth when a user signs in with Google via Firebase.

**Format**: `eyJhbG...` (base64-encoded JWT, typically 800-1200 characters)

**How it's obtained**:
```javascript
// Frontend (auth.js)
import { signInWithPopup, GoogleAuthProvider, getAuth } from 'firebase/auth';
const auth = getAuth();
const result = await signInWithPopup(auth, new GoogleAuthProvider());
const firebaseToken = await result.user.getIdToken();
```

**How it's verified (backend)**:
```javascript
// worker.js — verifyFirebaseToken(idToken, env)
// POST to: https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={FIREBASE_API_KEY}
// Body: { idToken }
// Returns: { users: [{ localId, email, displayName, photoUrl }] }
```

**Verification flow**:
1. Worker receives `{ firebaseToken }` in POST body
2. Calls Firebase Auth REST API `accounts:lookup` with the token
3. Firebase validates the token signature and expiry
4. Returns user record with `localId` (used as `sub`/UID)
5. Worker resolves `{ sub, email, name, picture }`

**Lifetime**: 1 hour (Firebase auto-refreshes on frontend)

**Used by**: `auth.js` frontend, forum API calls via `getToken()`

### 2.3 Token Type 2: Google ID Token (JWT)

**What it is**: A JWT issued by Google Identity Services (GIS) `google.accounts.id.prompt()` or One Tap sign-in.

**Format**: `eyJhbG...` (base64-encoded JWT, typically 1000-1500 characters)

**How it's obtained** (legacy — not used anymore):
```javascript
// Old method (no longer active)
google.accounts.id.initialize({ client_id: CLIENT_ID, callback: handler });
```

**How it's verified (backend)**:
```javascript
// worker.js — decodeGoogleToken(token)
// NO signature verification — only base64 decode + expiry check
function decodeGoogleToken(token) {
  const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
  if (payload.exp * 1000 < Date.now()) return null;
  return payload; // { sub, email, name, picture, exp, iss, aud }
}
```

**Why no signature verification**: Workers run on the edge without access to Google's public keys. The signature is implicitly trusted because the token came from Google's domain. For higher security, use Firebase tokens (Type 1) which ARE verified server-side.

**Lifetime**: Typically 1-2 hours

### 2.4 Token Type 3: Google OAuth2 Access Token

**What it is**: An opaque access token from Google OAuth2 flow (TokenClient).

**Format**: `ya29.a0AfB...` (opaque string, ~150 characters)

**How it's obtained** (legacy — not used anymore):
```javascript
// Old method (no longer active)
const tokenClient = google.accounts.oauth2.initTokenClient({ client_id, scope, callback });
tokenClient.requestAccessToken();
```

**How it's verified (backend)**:
```javascript
// worker.js — calls Google userinfo endpoint
const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo?access_token=' + accessToken);
const userData = await userRes.json(); // { sub, email, name, picture }
```

**Lifetime**: 1 hour

### 2.5 API Key (for AI Agents)

**What it is**: A secret key for AI agent endpoints. Completely separate from user auth.

**Where it's stored**: `env.API_KEY` (Cloudflare secret)

**How it's validated**:
```javascript
// worker.js — validarApiKeyAgente(request, env, corsHeaders)
const apiKey = request.headers.get('x-api-key');
if (apiKey !== env.API_KEY) return 401 Unauthorized;
```

**Required headers for ALL agent endpoints**:
```
x-api-key: {env.API_KEY}
Content-Type: application/json
```

**Used by**: `/api/agent/write`, `/api/agent/publish`, `/api/agent/blast`, `/api/agent/upload-media`, `/api/agent/generate-image`, `/api/agent/delete`

### 2.6 Token Comparison Table

| Property | Firebase Token | Google ID Token | Access Token | API Key |
|----------|---------------|-----------------|--------------|---------|
| **Format** | JWT | JWT | Opaque string | Random string |
| **Length** | ~800-1200 chars | ~1000-1500 chars | ~150 chars | ~32-64 chars |
| **Verified?** | YES (Firebase REST) | NO (decode only) | YES (Google API) | Direct compare |
| **Contains** | Full Firebase user | Google profile | Nothing (needs lookup) | Secret |
| **Issuer** | `https://securetoken.google.com` | `https://accounts.google.com` | Google OAuth2 | Oropezas |
| **Header** | POST body `firebaseToken` | POST body `idToken` | POST body `accessToken` | `x-api-key` |
| **Status** | **ACTIVE (preferred)** | Legacy support | Legacy support | Always active |

---

## 3. DATA STORES

### 3.1 D1 SQLite — Articles Only

**Binding name**: `env.DB`

**Database name**: `oropezas-db`

**Purpose**: Stores ALL news articles for both sites (main + kelowna)

#### Schema

```sql
CREATE TABLE articles (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  excerpt         TEXT,
  html            TEXT,           -- Full HTML content
  category        TEXT DEFAULT 'noticias',
  date            TEXT,           -- YYYY-MM-DD
  author          TEXT DEFAULT 'Redaccion Oropezas',
  site            TEXT DEFAULT 'main',   -- 'main' or 'kelowna'
  status          TEXT DEFAULT 'published',
  featured_image  TEXT,
  image           TEXT,
  tags            TEXT,           -- JSON string
  featured        INTEGER DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Key Operations

| Operation | Function | SQL |
|-----------|----------|-----|
| Init tables | `d1Init(env)` | `CREATE TABLE IF NOT EXISTS articles` |
| List articles | `d1GetArticles(env, site, limit)` | `SELECT ... WHERE site = ? AND status = "published" ORDER BY date DESC LIMIT ?` |
| Get by slug | `d1GetArticleBySlug(env, slug)` | `SELECT ... WHERE slug = ? LIMIT 1` |
| Upsert | `d1SaveArticle(env, article)` | `UPDATE ... WHERE slug=?` OR `INSERT OR IGNORE` |
| Seed if empty | `d1SeedIfEmpty(env, articles, site)` | `SELECT COUNT(*) ...` then insert all |
| Generic query | `d1Query(env, sql, params)` | Any SQL with parameter binding |

#### Site Filter

- `site = 'main'` → Oropezas.com articles
- `site = 'kelowna'` → Kelowna.oropezas.com articles

### 3.2 Firebase Firestore — Users Only

**Project ID**: `oropezascom`

**Base URL**: `https://firestore.googleapis.com/v1/projects/oropezascom/databases/(default)/documents`

**Collection**: `users`

**Purpose**: Stores ALL user profiles. Source of truth for authentication and user data.

#### Document Structure (Firestore format)

```javascript
// Firestore document at /users/{uid}
{
  name: "projects/oropezascom/databases/(default)/documents/users/{uid}",
  fields: {
    uid:        { stringValue: "firebase-uid-123" },
    email:      { stringValue: "user@gmail.com" },
    name:       { stringValue: "John Doe" },
    picture:    { stringValue: "https://lh3.googleusercontent.com/..." },
    role:       { stringValue: "user" },     // 'user', 'ceo', 'publisher', 'ai', 'admin'
    title:      { stringValue: "" },
    bio:        { stringValue: "" },
    joinedAt:   { timestampValue: "2026-05-12T10:00:00Z" },
    lastLogin:  { timestampValue: "2026-05-12T10:00:00Z" }
  }
}
```

#### Key Operations

| Operation | Function | REST Method |
|-----------|----------|-------------|
| Get user | `fsGetUser(uid, env)` | `GET /users/{uid}` |
| Save user | `fsSaveUser(user, env)` | `PATCH /users/{uid}` |
| Convert doc | `fsDocToUser(doc)` | (helper) |

**Firestore access is PUBLIC** (Firestore security rules allow reads). The Worker does NOT use Firebase Admin SDK — it calls Firestore REST API directly.

### 3.3 Cloudflare KV — Legacy + Fallback

**Namespace bindings**:

| Binding | Namespace ID | Purpose |
|---------|-------------|---------|
| `OROPEZAS_KV` | `f0ab30b6391b4cabacb0a87eadf634cd` | Articles index, user profiles (fallback) |
| `OROPEZAS_FOROS` | `397ecdc4e9594651afc51086fff53650` | Forum threads and replies |
| `PUSH_SUBSCRIPTIONS` | `5ee21fa253174c329a4c76e3e2e50ebd` | Web Push subscriptions |
| `SUSCRIPCIONES` | `0088df5b6f2a4a7d84d4729c4a1317d5` | Email subscribers |
| `SITIO_CONTENIDO` | `c1c418f6f2134cec9e89727bddc7fef5` | Site crawler content |

#### KV Key Patterns

```
# Articles
articles_index              → { articles: [...], lastUpdated: "..." }
kelowna_articles_index      → { articles: [...], lastUpdated: "..." }
article:{articleId}         → { full article object }

# Users (fallback)
user:{uid}                  → { uid, email, name, picture, role, ... }

# Forum
foros:index                 → [ thread summaries ]
foros:thread:{threadId}     → { thread, replies: [...] }

# Push
sub:{uuid}                  → PushSubscription object

# Subscriptions
lista                       → [ { nombre, email, fecha } ]

# Site crawler
contenido_completo          → Crawled site HTML
ultima_actualizacion        → ISO timestamp
total_paginas               → Number
```

### 3.4 Cloudflare R2 — Images

**Binding**: `OROPEZAS_MEDIA`

**Bucket name**: `oropezas-media`

**Public URL pattern**: `https://media.oropezas.com/{key}` (via `getMediaUrl()`)

**Purpose**: Stores article images, media uploads, generated images

**Key patterns**:
```
noticias/{slug}-{timestamp}.png     # Article featured images
noticias/{slug}-{timestamp}.webp    # WebP variants
media/upload-{timestamp}-{rand}     # User uploads
```

### 3.5 Data Flow Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   FRONTEND  │     │   WORKER    │     │   D1 (SQL)  │
│             │────▶│             │────▶│  articles   │
│  auth.js    │◀────│  /api/auth  │◀────│  (primary)  │
│             │     │  /api/user  │     └─────────────┘
└─────────────┘     │             │            │
                    │             │     ┌──────┴──────┐
                    │             │     ▼             ▼
                    │             │  ┌─────┐     ┌──────────┐
                    │             │  │  KV │     │ Firestore│
                    │             │  │(fbk)│     │  (users) │
                    │             │  └─────┘     └──────────┘
                    │             │
                    │             │     ┌─────────────┐
                    │             └────▶│  R2 (images)│
                    │                   └─────────────┘
                    │
                    └────▶ AI (Cloudflare Workers AI)
```

---

## 4. WORKER.JS — COMPLETE FUNCTION REFERENCE

### 4.1 Exported Default Handler

```javascript
export default {
  async fetch(request, env, ctx) { ... }
}
```

**Parameters**:
- `request` — Incoming HTTP Request object
- `env` — Environment bindings (KV, D1, R2, AI, secrets)
- `ctx` — Execution context (`ctx.waitUntil()` for background tasks)

**Initialization order on EVERY request**:
1. `ctx.waitUntil(d1Init(env))` — Create D1 tables if not exist (async, non-blocking)
2. `ctx.waitUntil(seedKelownaArticlesD1(env))` — Seed Kelowna articles if empty (async)
3. `ctx.waitUntil(seedMainArticlesD1(env))` — Seed main articles if empty (async)
4. Route matching via `url.pathname`
5. CORS headers from `getCorsHeaders(origin)`

### 4.2 Forum Module

#### `moderarContenido(text, env)`

**Purpose**: AI-powered content moderation for forum posts.

**How it works**:
1. Sends text to `@cf/meta/llama-3.1-8b-instruct`
2. Prompt instructs the model to act as a Mexican newspaper moderator
3. Model returns JSON: `{ approved: true }` or `{ approved: false, reason: "..." }`
4. If parsing fails → defaults to approved

**Returns**: `{ approved: boolean, reason?: string }`

**Used by**: `handleCreateThread`, `handleCreateReply`

#### `getIndex(env)` → `Promise<Array>`

**Purpose**: Get forum threads index from KV.

**KV key**: `foros:index`

**Returns**: Array of thread summary objects, or empty array

#### `saveIndex(index, env)` → `Promise<void>`

**Purpose**: Save forum threads index to KV.

**KV key**: `foros:index`

#### `generateId()` → `string`

**Purpose**: Generate unique IDs for threads, replies, articles.

**Algorithm**: `Date.now().toString(36) + Math.random().toString(36).slice(2, 7)`

**Example output**: `m2n5p8k3f9a`

#### `runAI(prompt, env, opts)` → `Promise<string>`

**Purpose**: Send a prompt to Cloudflare Workers AI.

**Parameters**:
- `prompt` — User prompt text
- `env` — Worker env (uses `env.AI`)
- `opts.model` — Default: `'@cf/meta/llama-3.1-8b-instruct'`
- `opts.maxTokens` — Default: `4096`
- `opts.system` — Optional system prompt

**Returns**: Generated text string

**Error handling**: Logs error and throws

#### `generateImageWithAI(prompt, env)` → `Promise<{ bytes, mimeType }>`

**Purpose**: Generate an image using Cloudflare Workers AI.

**Models tried in order**:
1. `@cf/black-forest-labs/flux-1-schnell` (primary)
2. Fallback models if first fails

**Parameters**:
- `prompt` — Image description
- `env` — Worker env (uses `env.AI`)

**Returns**: `{ bytes: ArrayBuffer|ReadableStream, mimeType: 'image/png'|'image/webp' }`

**Normalization**: Handles multiple response formats (ReadableStream, base64 JSON, Response object)

#### `seedKelownaArticles(env)` → `Promise<void>`

**Purpose**: Seed Kelowna articles into KV if articles_index doesn't exist.

**Seeds**: 7 Kelowna articles (tech, events, sports, lifestyle, Star Wars Day, etc.)

**Used by**: Entry point on every request (background via `ctx.waitUntil`)

#### `seedMainArticles(env)` → `Promise<void>`

**Purpose**: Seed main (Oropezas) articles into KV if articles_index doesn't exist.

**Seeds**: Multiple articles (May 4th Mexico, Hondius, etc.)

**Logic**: Compares seed articles against existing index. Adds new, updates changed.

**Used by**: Entry point on every request (background via `ctx.waitUntil`)

### 4.3 D1 Database Functions

#### `d1Init(env)` → `Promise<void>`

**Purpose**: Initialize D1 database tables.

**Creates**:
```sql
CREATE TABLE IF NOT EXISTS articles (...)
```

**Note**: Does NOT create users table. Users are in Firestore.

**Called**: On EVERY request via `ctx.waitUntil()` (idempotent — safe to call repeatedly)

#### `d1Query(env, sql, params)` → `Promise<{ results: Array }>`

**Purpose**: Generic D1 query executor.

**Parameters**:
- `env` — Worker env (needs `env.DB`)
- `sql` — SQL string with `?` placeholders
- `params` — Array of values to bind

**Returns**: `{ results: [...] }` or `{ results: [] }` on error

**Error handling**: Logs error, returns empty results (never throws)

#### `d1GetArticles(env, site, limit)` → `Promise<Array>`

**Purpose**: Get published articles for a site from D1.

**SQL**:
```sql
SELECT id, title, slug, excerpt, html, category, date, author, site, status, featured_image, image, tags, featured, created_at
FROM articles
WHERE site = ? AND status = "published"
ORDER BY date DESC, id DESC
LIMIT ?
```

**Parameters**:
- `site` — `'main'` or `'kelowna'`
- `limit` — Max articles (default: 50)

#### `d1GetArticleBySlug(env, slug)` → `Promise<object|null>`

**Purpose**: Get single article by slug from D1.

**SQL**:
```sql
SELECT * FROM articles WHERE slug = ? LIMIT 1
```

**Returns**: Article object or `null`

#### `d1SaveArticle(env, article)` → `Promise<article>`

**Purpose**: Upsert article into D1.

**Logic**:
1. Check if article exists: `d1GetArticleBySlug(env, article.slug)`
2. If exists → `UPDATE ... WHERE slug = ?`
3. If new → `INSERT OR IGNORE INTO articles (...)`

**Note**: `tags` are JSON-stringified before storage.

#### `d1SeedIfEmpty(env, articles, site)` → `Promise<void>`

**Purpose**: Seed articles if none exist for the site.

**Logic**:
1. `SELECT COUNT(*) as c FROM articles WHERE site = ?`
2. If count > 0 → do nothing
3. If empty → call `d1SaveArticle()` for each article

### 4.4 Firestore Functions

#### `fsGetUser(uid, env)` → `Promise<object|null>`

**Purpose**: Get user from Firestore by UID.

**HTTP**: `GET https://firestore.googleapis.com/v1/projects/oropezascom/databases/(default)/documents/users/{uid}`

**Returns**: `{ uid, email, name, picture, role, title, bio, joinedAt, lastLogin }` or `null`

**Error handling**: Returns `null` on any error (404, network, etc.)

#### `fsSaveUser(user, env)` → `Promise<void>`

**Purpose**: Save/update user in Firestore.

**HTTP**: `PATCH https://firestore.googleapis.com/v1/projects/oropezascom/databases/(default)/documents/users/{uid}`

**Body**:
```json
{
  "fields": {
    "uid": { "stringValue": "..." },
    "email": { "stringValue": "..." },
    "name": { "stringValue": "..." },
    "picture": { "stringValue": "..." },
    "role": { "stringValue": "user" },
    "title": { "stringValue": "" },
    "bio": { "stringValue": "" },
    "lastLogin": { "timestampValue": "2026-05-12T10:00:00Z" }
  }
}
```

**Logic**:
1. Check if user exists (sets `joinedAt` only for new users)
2. PATCH document to Firestore

#### `fsDocToUser(doc)` → `object|null`

**Purpose**: Convert Firestore document format to plain JS object.

**Input**: Firestore document with `fields: { field: { stringValue: "..." } }`

**Output**: `{ uid, email, name, picture, role, title, bio, joinedAt, lastLogin }`

### 4.5 Token Verification Functions

#### `verifyFirebaseToken(idToken, env)` → `Promise<object|null>`

**Purpose**: Verify a Firebase ID token via Firebase Auth REST API.

**Endpoint**: `POST https://identitytoolkit.googleapis.com/v1/accounts:lookup?key={env.FIREBASE_API_KEY}`

**Body**: `{ idToken }`

**Returns**: `{ sub, email, name, picture }` or `null`

**Process**:
1. POST token to Firebase
2. Firebase validates signature, expiry, issuer
3. Returns user array: `[{ localId, email, displayName, photoUrl, ... }]`
4. Maps to `{ sub: localId, email, name: displayName, picture: photoUrl }`

#### `verifyAnyToken(token)` → `object|null`

**Purpose**: Decode any JWT (Google ID token format).

**Process**:
1. Base64-decode JWT payload section
2. Check expiry: `payload.exp * 1000 < Date.now()`
3. Return payload or `null`

**Note**: This does NOT verify the signature. It only decodes and checks expiry. Use `verifyFirebaseToken()` for verified tokens.

#### `decodeGoogleToken(token)` → `object|null`

**Purpose**: Same as `verifyAnyToken()`. Decode-only Google JWT verification.

**Process**:
1. Split token by `.`, take middle section (payload)
2. Replace URL-safe base64 chars: `-` → `+`, `_` → `/`
3. `atob()` decode, `JSON.parse()`
4. Check expiry
5. Return payload

### 4.6 Seed Functions

#### `seedKelownaArticlesD1(env)` → `Promise<void>`

**Purpose**: Seed Kelowna articles into D1 if empty.

**Seeds**: Array of 7 Kelowna article objects

**Featured articles**: Star Wars Day Kelowna, technology article

**Called**: Entry point on every request (background, non-blocking)

#### `seedMainArticlesD1(env)` → `Promise<void>`

**Purpose**: Seed main site articles into D1 if empty.

**Seeds**: Array of main article objects (May 4th Mexico, Hondius, etc.)

**Called**: Entry point on every request (background, non-blocking)

### 4.7 Forum Route Handler

#### `handleForosRoutes(pathname, request, env, corsHeaders)` → `Promise<Response|null>`

**Purpose**: Router for forum endpoints. Returns `null` if no match.

**Routes handled**:
| Pathname | Method | Handler |
|----------|--------|---------|
| `/api/foros/threads` | GET | `handleGetThreads` |
| `/api/foros/threads` | POST | `handleCreateThread` |
| `/api/foros/threads/:id` | GET | `handleGetThread` |
| `/api/foros/threads/:id/replies` | POST | `handleCreateReply` |

#### `handleGetThreads(env, corsHeaders)` → `Response`

**Purpose**: List all forum threads.

**Process**:
1. Get index from KV: `getIndex(env)`
2. Sort by `createdAt` descending
3. Return `{ success: true, threads: [...] }`

#### `handleCreateThread(request, env, corsHeaders)` → `Response`

**Purpose**: Create a new forum thread.

**Body**: `{ title, body, category, authorId, authorName, authorEmail, authorPicture, token }`

**Auth**: Requires `token`. Tries `verifyFirebaseToken()` first, then `decodeGoogleToken()`. Must match `authorEmail`.

**Validation**:
- Title >= 5 chars
- Body >= 10 chars
- Token valid and email matches

**Moderation**: AI moderation via `moderarContenido()`

**Thread object**:
```javascript
{
  id, title, body, category,
  authorId, authorName, authorEmail, authorPicture,
  createdAt, views: 0,
  isFounder: authorEmail === FOUNDER_EMAIL,
  replies: []
}
```

**KV storage**: Key `foros:thread:{id}`

**Index update**: Appends to `foros:index`

#### `handleGetThread(threadId, env, corsHeaders)` → `Response`

**Purpose**: Get single thread with replies.

**KV key**: `foros:thread:{threadId}`

**Side effect**: Increments view counter

**Returns**: `{ success: true, thread, replies: [...] }`

#### `handleCreateReply(threadId, request, env, corsHeaders)` → `Response`

**Purpose**: Reply to a forum thread.

**Body**: `{ body, authorId, authorName, authorEmail, authorPicture, token }`

**Auth**: Same as `handleCreateThread` (Firebase token or Google token)

**Validation**: Body >= 5 chars

**Moderation**: AI moderation

**Reply object**:
```javascript
{
  id, body, authorId, authorName, authorEmail, authorPicture,
  createdAt, isFounder: authorEmail === FOUNDER_EMAIL
}
```

### 4.8 Utility Functions

#### `extraerTextoAI(aiResponse)` → `string`

**Purpose**: Extract text from AI response (supports Cloudflare AI format).

**Input**: Cloudflare AI response object or string

**Output**: Plain text string

#### `parsearArticuloGemini(texto)` → `object|null`

**Purpose**: Extract JSON article object from AI-generated text.

**Process**: Finds `{...}` block and `JSON.parse()` it.

#### `esRutaImagenValida(valor)` → `boolean`

**Purpose**: Check if a string is a valid image path.

**Valid patterns**:
- Starts with `http://` or `https://`
- Starts with `/`
- Contains `/`
- Ends with `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.avif`

#### `slugify(texto)` → `string`

**Purpose**: Convert text to URL-friendly slug.

**Process**: lowercase → normalize accents → remove special chars → spaces to hyphens → truncate to 60 chars

**Example**: `"May the 4th: Mexico Joins!"` → `"may-the-4th-mexico-joins"`

#### `getFolderByCategory(category)` → `string`

**Purpose**: Map category to folder name.

| Category | Folder |
|----------|--------|
| `deportes` | `SLPOPEN2026` |
| `tecnologia` | `tecnologia` |
| anything else | `noticias` |

#### `getMimeExtension(mimeType)` → `string`

**Purpose**: Get file extension from MIME type.

#### `getContentTypeByKey(key)` → `string`

**Purpose**: Guess MIME type from filename extension.

#### `base64ToUint8Array(base64)` → `Uint8Array`

**Purpose**: Convert base64 string to byte array.

#### `getMediaUrl(key)` → `string`

**Purpose**: Build public URL for R2 media.

**Returns**: `https://media.oropezas.com/{key}`

### 4.9 AI Agent Functions

#### `validarApiKeyAgente(request, env, corsHeaders)` → `Response|null`

**Purpose**: Validate AI agent API key.

**Header**: `x-api-key`

**Expected**: Must match `env.API_KEY`

**Returns**: `null` if valid, `401 Response` if invalid

**Used by**: ALL `/api/agent/*` endpoints

#### `construirArticuloNormalizado(article, options)` → `object`

**Purpose**: Normalize an article object to standard format.

**Parameters**:
- `article` — Raw article data
- `options.topic` — Topic/fallback title
- `options.category` — Category
- `options.textoGemini` — AI-generated text (used as HTML if none provided)

**Returns**: Normalized article with all required fields

#### `generarImagenConNanoBanana(article, env, options)` → `Promise<object>`

**Purpose**: Generate article image using Cloudflare Workers AI.

**Process**:
1. Build image prompt from article title + excerpt
2. Call `generateImageWithAI()`
3. Upload result to R2
4. Return `{ key, url, generated: true, model }`

#### `resolverImagenArticulo(article, env, options)` → `Promise<object>`

**Purpose**: Resolve final image for an article.

**Logic**:
1. If article has `imageKey` → return existing R2 URL
2. If article has `image` URL → use it
3. Otherwise → generate new image via `generarImagenConNanoBanana()`

#### `handleAgentWrite(request, env, corsHeaders)` → `Response`

**Purpose**: Write an article draft using AI.

**Body**: `{ topic, category, tone, length }`

**API key required**: Yes (`x-api-key`)

**Process**:
1. Validate API key
2. Build AI prompt with topic, category, tone
3. Call `runAI()` with `@cf/meta/llama-3.1-8b-instruct`
4. Parse JSON response
5. Normalize article
6. Generate image
7. Save draft to KV with key `draft-{timestamp}`
8. Return `{ success: true, article, draftId }`

#### `handleAgentPublish(request, env, corsHeaders)` → `Response`

**Purpose**: Publish a draft article.

**Body**: `{ draftId }`

**Process**:
1. Get draft from KV
2. Save to D1 via `d1SaveArticle()`
3. Update KV article index
4. Return `{ success: true, article, url }`

#### `handleAgentBlast(request, env, corsHeaders)` → `Response`

**Purpose**: Send email/push blast for an article.

**Body**: `{ articleId, channels: ['email', 'push'], testMode }`

**Process**:
1. Get article from KV
2. If `channels` includes `'email'` → send to all subscribers
3. If `channels` includes `'push'` → send push notifications
4. Return `{ success: true, summary: { emailSent, pushSent } }`

#### `handleAgentDashboard(request, env, corsHeaders)` → `Response`

**Purpose**: Get system statistics.

**Returns**: `{ success: true, stats: { articles, subscribers, pushes, drafts } }`

#### `handleAgentUploadMedia(request, env, corsHeaders)` → `Response`

**Purpose**: Upload media file to R2.

**Body**: FormData with `file` and `key`

**API key required**: Yes

**Process**:
1. Extract file and key from FormData
2. Convert to Uint8Array
3. Upload to R2: `env.OROPEZAS_MEDIA.put(key, bytes, { httpMetadata })`
4. Return `{ success: true, url, key }`

#### `handleAgentGenerateImage(request, env, corsHeaders)` → `Response`

**Purpose**: Generate image for an existing article.

**Body**: `{ articleId?, draftId?, prompt }`

**API key required**: Yes

**Process**:
1. Resolve article (from KV or draft)
2. Call `generateImageWithAI()` with prompt
3. Upload to R2
4. Update article with new image key

#### `handleAgentAutoPublish(request, env, corsHeaders)` → `Response`

**Purpose**: Write + publish in one step.

**Body**: `{ topic, category, tone, length, autoBlast? }`

**Process**:
1. Calls `handleAgentWrite` logic
2. Immediately publishes
3. Optionally sends blast
4. Return `{ success: true, article, id, url }`

#### `handleAgentDelete(request, env, corsHeaders)` → `Response`

**Purpose**: Delete an article.

**Body**: `{ articleId?, slug? }`

**API key required**: Yes

**Process**:
1. Delete from KV: `article:{articleId}`
2. Remove from articles_index

### 4.10 Article & Media Handlers

#### `handleGetArticles(request, env, corsHeaders)` → `Response`

**Purpose**: List articles.

**Query params**:
- `?site=main|kelowna` — Filter by site
- `?slug=` — Filter by slug (exact)
- `?category=` — Filter by category
- `?featured=true` — Only featured articles

**Logic**:
1. Try D1 first: build dynamic SQL with filters
2. If D1 returns results → return them
3. Fallback to KV: `articles_index` or `kelowna_articles_index`

#### `handleGetArticleBySlug(request, env, corsHeaders)` → `Response`

**Purpose**: Get single article by slug.

**Path**: `/api/article/{slug}`

**Logic**:
1. Check KV `articles_index` for slug match
2. If found, get full article from KV by ID
3. If not in index, scan all `article:*` keys in KV
4. Return article JSON or 404

#### `handleGetMedia(request, env, corsHeaders)` → `Response`

**Purpose**: Serve media from R2.

**Path**: `/api/media/{key}`

**Process**:
1. Extract key from URL path
2. Get object from R2: `env.OROPEZAS_MEDIA.get(key)`
3. Return with proper Content-Type

### 4.11 CORS & Communication

#### `getCorsHeaders(origin)` → `object`

**Purpose**: Generate CORS headers for cross-origin requests.

**Allowed origins** (from `ALLOWED_ORIGINS` array):
- `https://oropezas.com`
- `https://www.oropezas.com`
- `https://kelowna.oropezas.com`
- `https://www.kelowna.oropezas.com`
- `http://localhost:3000`, `:5000`, `:5500`, `:8000`
- `http://127.0.0.1:5500`, `:3000`, `:8000`
- `https://oropezas.pages.dev`
- `https://kelowna-oropezas.pages.dev`
- Any `*.oropezas.pages.dev` subdomain
- Any `*.oropezas.com` subdomain

**Returns**: `{ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,Authorization,x-api-key', 'Access-Control-Allow-Credentials': 'true' }`

#### `handleChatMessage(message, env, site)` → `Promise<string>`

**Purpose**: Process a chat message and return AI response.

**System prompt**: Configured to act as Oropezas news assistant. Must NOT hallucinate. Must NOT invent quotes, people, or events. Must only use verified facts.

**Model**: `@cf/meta/llama-3.1-8b-instruct`

#### `handleChatWebhook(request, env, corsHeaders)` → `Response`

**Purpose**: Google Chat webhook endpoint.

**Auth**: `Authorization: Bearer {env.GOOGLE_CHAT_SECRET}`

**Commands**:
- `/ayuda` — Show help
- `/estado` — System stats
- `/borrador <tema>` — Generate draft
- `/publicar <tema>` — Auto-publish
- `/blast <articleId>` — Send blast

### 4.12 Subscription & Contact

#### `handleSubscribe(nombre, email, env)` → `Promise<object>`

**Purpose**: Subscribe email to newsletter.

**KV key**: `lista` (in `SUSCRIPCIONES` namespace)

**Data stored**: `{ nombre, email, fecha: ISOString }`

**Returns**: `{ success: true, message }` or `{ success: false, error }`

#### `handleContact(nombre, email, mensaje, env)` → `Promise<object>`

**Purpose**: Process contact form submission.

**Sends**: Email to `enrique@oropezas.com` via `sendEmail()`

#### `sendEmail({ to, subject, html, reply_to, from }, env)` → `Promise<object>`

**Purpose**: Send email via Cloudflare Email Workers.

**Parameters**:
- `to` — Recipient email
- `subject` — Email subject
- `html` — HTML body
- `reply_to` — Reply-to address
- `from` — Sender (default: `noreply@oropezas.com`)

### 4.13 Web Push

#### `sendPush(subscription, payload, env)` → `Promise<void>`

**Purpose**: Send web push notification.

**Parameters**:
- `subscription` — PushSubscription object
- `payload` — JSON string with `{ title, body, url }`
- `env` — Worker env

**Uses**: VAPID keys from `env.VAPID_PUBLIC_KEY` / `env.VAPID_PRIVATE_KEY`

### 4.14 Stripe (Disabled)

#### `handleStripeCheckout(request, env, corsHeaders)` → `Response`

**Purpose**: Create Stripe Checkout session.

**Status**: Temporarily disabled (returns 503)

**Logic** (when enabled):
1. Get article from KV
2. Build Stripe Checkout Session via REST API
3. Return `{ success: true, checkoutUrl, sessionId }`

#### `handleStripeWebhook(request, env, corsHeaders)` → `Response`

**Purpose**: Process Stripe webhook events.

**Verifies**: Stripe signature using Web Crypto API HMAC-SHA256

**On `checkout.session.completed`**: Grants access via KV keys

#### `verifyStripeSignature(payload, sigHeader, secret)` → `Promise<boolean>`

**Purpose**: Verify Stripe webhook signature.

**Algorithm**: HMAC-SHA256 of `{timestamp}.{payload}` compared against `v1` signature

#### `handleStripeAccess(request, env, corsHeaders)` → `Response`

**Purpose**: Check if user has paid access to premium article.

**Query params**: `?session_id=&email=&article_id=`

**KV keys checked**:
- `stripe:access:session:{sessionId}`
- `stripe:access:email:{email}:{articleId}`

### 4.15 User Profile

#### `handleGetUserProfile(request, env, corsHeaders)` → `Response`

**Purpose**: Get user profile.

**Query**: `?uid={uid}`

**Resolution**:
1. Try Firestore: `fsGetUser(uid, env)`
2. Fallback to KV: `user:{uid}`

**Returns**: `{ uid, name, displayName, picture, role, title, bio, verified, verifiedLabel, joinedAt }`

#### `handleUpdateUserProfile(request, env, corsHeaders)` → `Response`

**Purpose**: Update user profile.

**Body**: `{ uid, token, title?, bio?, displayName? }`

**Auth**: Token must match UID (Firebase or Google token)

**Writes**: Both Firestore AND KV

#### `handleDashboardPublish(request, env, corsHeaders)` → `Response`

**Purpose**: Publish from dashboard (requires `ceo` or `publisher` role).

**Body**: Any article fields

**Auth**: Google ID token in `Authorization: Bearer` header

**Role check**: User must have `role === 'ceo'` or `role === 'publisher'`

### 4.16 Content Utilities

#### `htmlToContentBlocks(html)` → `Array`

**Purpose**: Parse HTML into structured content blocks.

**Extracts**: `<h2>`, `<p>`, `<blockquote>`, `<ul>` elements

**Returns**: `[{ type, html, text }, ...]` sorted by document order

#### `handleSetPremium(request, env, corsHeaders)` → `Response`

**Purpose**: Mark article as premium (paywalled).

**Body**: `{ articleId, premium: true/false, price: 2900 }`

---

## 5. API ENDPOINTS — EVERY ROUTE

### 5.1 Complete Endpoint Table

| Method | Path | Auth | Handler | Description |
|--------|------|------|---------|-------------|
| POST | `/api/auth/google` | Token in body | Inline | Sign in with Google/Firebase |
| GET | `/api/articles` | None | `handleGetArticles` | List articles |
| GET | `/api/article/:slug` | None | `handleGetArticleBySlug` | Get article by slug |
| GET | `/api/user/profile` | None (uid in query) | `handleGetUserProfile` | Get user profile |
| POST | `/api/user/update` | Token in body | `handleUpdateUserProfile` | Update profile |
| POST | `/api/agent/write` | `x-api-key` | `handleAgentWrite` | AI write draft |
| POST | `/api/agent/publish` | `x-api-key` | `handleAgentPublish` | Publish draft |
| POST | `/api/agent/blast` | `x-api-key` | `handleAgentBlast` | Email/push blast |
| POST | `/api/agent/upload-media` | `x-api-key` | `handleAgentUploadMedia` | Upload to R2 |
| POST | `/api/agent/generate-image` | `x-api-key` | `handleAgentGenerateImage` | Generate image |
| GET | `/api/agent/dashboard` | None | `handleAgentDashboard` | System stats |
| POST | `/api/agent/auto-publish` | `x-api-key` | `handleAgentAutoPublish` | Write + publish |
| POST | `/api/agent/set-premium` | `x-api-key` | `handleSetPremium` | Set paywall |
| POST | `/api/agent/delete` | `x-api-key` | `handleAgentDelete` | Delete article |
| GET | `/api/media/:key` | None | `handleGetMedia` | Serve R2 media |
| POST | `/api/chat/webhook` | `Authorization: Bearer` | `handleChatWebhook` | Google Chat bot |
| POST | `/api/push/subscribe` | None | Inline | Register push sub |
| POST | `/api/push/send` | None | Inline | Send push notification |
| POST | `/api/create-article` | None | Inline | Direct article creation |
| POST | `/api/dashboard/publish` | `Authorization: Bearer` | `handleDashboardPublish` | CEO/publisher publish |
| GET | `/api/foros/threads` | None | `handleGetThreads` | List forum threads |
| POST | `/api/foros/threads` | Token in body | `handleCreateThread` | Create thread |
| GET | `/api/foros/threads/:id` | None | `handleGetThread` | Get thread |
| POST | `/api/foros/threads/:id/replies` | Token in body | `handleCreateReply` | Create reply |
| POST | `/api/stripe/*` | N/A | Inline | **DISABLED** (503) |
| POST | `/rastrear` | None | `crawlAndStore` | Trigger site crawl |
| GET | `/estado` | None | Inline | Worker status |
| GET | `/` | None | Inline | Worker health check |

### 5.2 Auth Endpoint (`POST /api/auth/google`)

**Request body** (try ONE of these):
```json
// Method 1: Firebase (preferred)
{ "firebaseToken": "eyJhbG..." }

// Method 2: Google ID Token
{ "idToken": "eyJhbG..." }

// Method 3: Access Token
{ "accessToken": "ya29.a0AfB..." }
```

**Response (success)**:
```json
{
  "success": true,
  "user": {
    "uid": "firebase-uid-123",
    "email": "user@gmail.com",
    "name": "John Doe",
    "picture": "https://lh3.googleusercontent.com/...",
    "role": "user",
    "title": "",
    "bio": ""
  }
}
```

**Response (error)**:
```json
{ "success": false, "error": "Token inválido o expirado" }
```

**Backend logic**:
1. Try `verifyFirebaseToken(body.firebaseToken, env)`
2. Fallback to `decodeGoogleToken(body.idToken)`
3. Fallback to Google userinfo API with `body.accessToken`
4. Resolve user: Firestore → KV → create new
5. Save: async Firestore + KV

### 5.3 Articles Endpoint (`GET /api/articles`)

**Query parameters**:
```
?site=main|kelowna     # Required — which site
?category=noticias      # Optional — filter by category
?slug=article-slug      # Optional — exact slug match
?featured=true          # Optional — only featured
```

**Response (D1 path)**:
```json
{
  "articles": [
    {
      "id": 1,
      "title": "Article Title",
      "slug": "article-slug",
      "excerpt": "Brief description...",
      "category": "noticias",
      "date": "2026-05-12",
      "author": "Redaccion Oropezas",
      "site": "main",
      "status": "published",
      "image": "noticias/slug-123.png",
      "featuredImage": "noticias/slug-123.png",
      "featured": 1,
      "tags": "[\"culture\"]",
      "created_at": "2026-05-12T10:00:00Z"
    }
  ]
}
```

**Priority**: D1 → KV fallback

### 5.4 AI Agent Endpoints

**ALL agent endpoints require**:
```
Header: x-api-key: {your-api-key}
Header: Content-Type: application/json
```

#### Write Draft (`POST /api/agent/write`)
```json
{
  "topic": "New highway construction in San Luis Potosi",
  "category": "noticias",
  "tone": "periodistico",
  "length": "medio"
}
```

**Response**:
```json
{
  "success": true,
  "article": {
    "title": "...",
    "excerpt": "...",
    "html": "<p>...</p>",
    "slug": "...",
    "category": "noticias",
    "image": "https://media.oropezas.com/noticias/..."
  },
  "draftId": "draft-1715500000000"
}
```

#### Publish (`POST /api/agent/publish`)
```json
{ "draftId": "draft-1715500000000" }
```

#### Auto-Publish (`POST /api/agent/auto-publish`)
```json
{
  "topic": "Election results 2026",
  "category": "noticias",
  "autoBlast": false
}
```

#### Blast (`POST /api/agent/blast`)
```json
{
  "articleId": "article-123",
  "channels": ["email", "push"],
  "testMode": false
}
```

---

## 6. FRONTEND FILES & AUTH FLOW

### 6.1 File Inventory

| File | Type | Purpose | Auth Integration |
|------|------|---------|-----------------|
| `index.html` | Main page | Oropezas.com homepage | `auth.js` module |
| `article.html` | Detail | Article reader page | `auth.js` module |
| `auth.js` | Module | **Firebase Auth 5.0** | Self-contained |
| `news-loader.js` | Script | Article rendering | No auth |
| `chatbot.js` | Script | AI chat widget | No auth |
| `adsense.js` | Script | Cookie consent + AdSense | No auth |
| `main.js` | Script | Main site logic | No auth |
| `contacto.html` | Page | Contact form | `auth.js` |
| `about.html` | Page | About page | `auth.js` |
| `account.html` | Page | User account | `auth.js` |
| `noticias.html` | Page | News listing | `auth.js` |
| `deportes.html` | Page | Sports section | `auth.js` |
| `foros.html` | Page | Forums listing | `auth.js` |
| `foro-hilo.html` | Page | Forum thread | `auth.js` |
| `kelowna/index.html` | Page | Kelowna homepage | `auth.js` |
| `kelowna/article.html` | Page | Kelowna article | `auth.js` |
| `kelowna/contacto.html` | Page | Kelowna contact | `auth.js` |
| `kelowna/account.html` | Page | Kelowna account | `auth.js` |
| `kelowna/noticias.html` | Page | Kelowna news | `auth.js` |

### 6.2 auth.js — Complete Architecture

**Type**: ES Module (`<script type="module">`)

**Imports**:
```javascript
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js';
```

**Firebase version**: 11.6.1 (loaded from Google CDN)

**Module scope**:
- `app` — Firebase app instance
- `auth` — Firebase auth instance

**Global object**: `window.OROPEZAS_AUTH`

#### auth.js — `init()`

**Purpose**: Initialize authentication system.

**Flow**:
1. Set `initialized = true`
2. Load cached user from `localStorage` (key: `oropezas_user_v3`)
3. Set up navbar observer (`_watchNavbarDynamic()`)
4. Update UI (`_updateUI()`)
5. Subscribe to `onAuthStateChanged(auth, callback)`
6. On Firebase auth change → `_syncWithBackend(firebaseUser)`

#### auth.js — `_syncWithBackend(firebaseUser)`

**Purpose**: Sync Firebase user with Oropezas backend.

**Flow**:
1. Get Firebase ID token: `await firebaseUser.getIdToken(true)`
2. POST to `/api/auth/google` with `{ firebaseToken }`
3. Backend verifies token, resolves user from Firestore/KV
4. Save returned user to `this.currentUser`
5. Save to `localStorage` (key: `oropezas_user_v3`)
6. Update UI

**Error handling**: If backend fails, falls back to Firebase user data directly.

#### auth.js — `_startGoogleSignIn()`

**Purpose**: Trigger Google sign-in popup.

**Flow**:
1. Create `new GoogleAuthProvider()`
2. Set `provider.setCustomParameters({ prompt: 'select_account' })`
3. Show "Signing in..." spinner in modal
4. Call `signInWithPopup(auth, provider)`
5. On success → `_syncWithBackend(result.user)`
6. On error → show error message:
   - `auth/popup-closed-by-user` → "Sign-in cancelled"
   - `auth/popup-blocked` → "Popup was blocked"
   - `auth/network-request-failed` → "Network error"

#### auth.js — `logout()`

**Purpose**: Sign out user.

**Flow**:
1. `await signOut(auth)` — Firebase sign out
2. `localStorage.removeItem('oropezas_user_v3')`
3. `sessionStorage.removeItem('oropezas_user_v3')`
4. Clear `this.currentUser`
5. Update UI

#### auth.js — `getToken()`

**Purpose**: Get current Firebase ID token for API calls.

**Used by**: Forum post/reply (to include `token` in request body)

**Returns**: Firebase ID token string or `null`

#### auth.js — UI Functions

- `_updateUI()` — Show/hide login button, avatar, admin controls based on auth state
- `openLoginModal()` — Create and show login modal with Google button
- `closeLoginModal()` — Hide modal
- `toggleUserMenu()` — Toggle user dropdown menu
- `_showAuthError(msg)` — Show error in modal with retry button
- `_watchNavbarDynamic()` — MutationObserver for dynamic navbar injection

### 6.3 Auth State Diagram

```
┌──────────┐     ┌─────────────────┐     ┌──────────────┐
│  Page    │────▶│  auth.init()    │────▶│ localStorage │
│  Load    │     │                 │     │   check      │
└──────────┘     └─────────────────┘     └──────┬───────┘
                                                │
                              ┌─────────────────┼─────────────────┐
                              ▼                 ▼                 ▼
                        ┌─────────┐      ┌──────────┐      ┌──────────┐
                        │ Cached  │      │ Firebase │      │  No user │
                        │  user   │      │  user    │      │          │
                        └────┬────┘      └────┬─────┘      └────┬─────┘
                             │                │                 │
                             ▼                ▼                 ▼
                        ┌─────────┐      ┌──────────┐      ┌──────────┐
                        │ Show UI │      │ _syncWith│      │ Show     │
                        │ directly│      │ Backend  │      │ Login Btn│
                        └─────────┘      └────┬─────┘      └──────────┘
                                              │
                                              ▼
                                        ┌──────────┐
                                        │ Firestore│
                                        │  + KV    │
                                        └────┬─────┘
                                             │
                                             ▼
                                        ┌──────────┐
                                        │  Save to │
                                        │  Storage │
                                        └──────────┘
```

---

## 7. AI AGENT SYSTEM

### 7.1 AI Models

| Model | Binding | Purpose |
|-------|---------|---------|
| `@cf/meta/llama-3.1-8b-instruct` | `env.AI` | Text generation (articles, chat, moderation) |
| `@cf/black-forest-labs/flux-1-schnell` | `env.AI` | Image generation |

### 7.2 Article Generation Pipeline

```
1. Agent calls POST /api/agent/write
   ├── Validate API key
   ├── Build prompt: topic + category + tone + guidelines
   ├── Call Llama 3.1 (max 4096 tokens)
   ├── Parse JSON from response
   ├── Normalize article
   ├── Generate image (Flux-1)
   ├── Upload image to R2
   ├── Save draft to KV
   └── Return { article, draftId }

2. Agent calls POST /api/agent/publish
   ├── Get draft from KV
   ├── Save to D1 (articles table)
   ├── Update KV articles_index
   └── Return { article, url }

3. (Optional) POST /api/agent/blast
   ├── Get article
   ├── Send emails to subscribers
   ├── Send push notifications
   └── Return { summary }
```

### 7.3 AI Prompt Template (Write)

```
Eres un periodista profesional mexicano escribiendo para Oropezas.com,
un periódico digital de San Luis Potosí.

Tema: {topic}
Categoría: {category}
Tono: {tone}

REGLAS ESTRICTAS:
- NO inventes personas, citas, eventos o datos
- Usa SOLO hechos verificables
- Escribe en español mexicano profesional
- Estructura: título, subtítulo, introducción, 2-3 secciones, conclusión
- Longitud: {length}
- Incluye SEO keywords naturales
- Devuelve resultado como JSON:
  {"title": "...", "excerpt": "...", "html": "<p>...</p>", "slug": "...", "category": "..."}
```

### 7.4 Moderation Prompt

```
Eres el moderador de un periódico digital mexicano llamado Oropezas.com.
Analiza el siguiente mensaje y determina si debe ser aprobado.

RECHAZA si: insultos graves, discurso de odio, spam, contenido sexual explícito, amenazas
APRUEBA si: opinión legítima, debate político respetuoso, preguntas, comentarios sobre noticias

Responde ÚNICAMENTE con JSON: {"approved": true} o {"approved": false, "reason": "..."}
```

---

## 8. FORUM SYSTEM

### 8.1 Data Model

**Thread** (stored in KV as `foros:thread:{id}`):
```javascript
{
  thread: {
    id, title, body, category,
    authorId, authorName, authorEmail, authorPicture,
    createdAt, views,
    isFounder: boolean
  },
  replies: [
    { id, body, authorId, authorName, authorEmail, authorPicture, createdAt, isFounder }
  ]
}
```

**Index** (stored in KV as `foros:index`):
```javascript
[
  { id, title, body, category, authorName, authorEmail, createdAt, replyCount, views }
]
```

### 8.2 Forum API Usage

**List threads**:
```javascript
const res = await fetch('/api/foros/threads');
const data = await res.json(); // { success: true, threads: [...] }
```

**Create thread** (requires auth):
```javascript
const token = await OROPEZAS_AUTH.getToken();
const res = await fetch('/api/foros/threads', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'Thread Title',
    body: 'Thread content...',
    category: 'comunidad',
    authorId: user.uid,
    authorName: user.name,
    authorEmail: user.email,
    authorPicture: user.picture,
    token  // Firebase ID token
  })
});
```

**Create reply** (requires auth):
```javascript
const res = await fetch(`/api/foros/threads/${threadId}/replies`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    body: 'Reply content...',
    authorId, authorName, authorEmail, authorPicture,
    token  // Firebase ID token
  })
});
```

---

## 9. PUSH NOTIFICATIONS

### 9.1 Subscription Flow

```
1. Frontend: Check Notification.permission
2. If granted:
   a. Get service worker registration
   b. Subscribe with pushManager
   c. Send subscription to POST /api/push/subscribe
3. Backend stores subscription in KV: PUSH_SUBSCRIPTIONS
   Key: sub:{uuid}
   Value: PushSubscription JSON
```

### 9.2 Sending Push

```javascript
// Backend
POST /api/push/send
Body: { title: "Breaking News", body: "Article excerpt...", url: "/article.html?slug=..." }

// Backend loops through all subscriptions and sends
```

---

## 10. IMAGE GENERATION & MEDIA

### 10.1 Image Generation Flow

```
1. Article needs image
2. Build prompt from article title + excerpt
3. Call @cf/black-forest-labs/flux-1-schnell
4. Normalize response (handles multiple formats)
5. Upload to R2: env.OROPEZAS_MEDIA.put(key, bytes)
6. Return: { key, url: "https://media.oropezas.com/{key}", generated: true }
```

### 10.2 Media Serving

**Public URL**: `https://media.oropezas.com/{key}`

**API URL**: `https://oropezas.enriquegarciaoropeza.workers.dev/api/media/{key}`

**R2 bucket**: `oropezas-media`

### 10.3 Image Fallback Strategy

If D1 article has `image` field → use that URL
If no image → generate via AI
If AI fails → placeholder (no image)

---

## 11. STRIPE PAYWALL (DISABLED)

### 11.1 Status

**ALL Stripe endpoints return 503**:
```json
{ "success": false, "error": "Pagos temporalmente desactivados" }
```

### 11.2 When Re-enabled

1. Set `STRIPE_SECRET_KEY` secret
2. Set `STRIPE_WEBHOOK_SECRET` secret
3. Remove 503 block from `/api/stripe/*` route
4. Implement frontend paywall UI

---

## 12. DEPLOYMENT & ENVIRONMENT

### 12.1 Wrangler Configuration

```json
{
  "name": "oropezas",
  "main": "src/worker.js",
  "workers_dev": true,
  "compatibility_date": "2026-04-07",
  "triggers": { "crons": ["0 */23 * * *"] },
  "kv_namespaces": [
    { "binding": "PUSH_SUBSCRIPTIONS", "id": "5ee21fa253174c329a4c76e3e2e50ebd" },
    { "binding": "SITIO_CONTENIDO", "id": "c1c418f6f2134cec9e89727bddc7fef5" },
    { "binding": "SUSCRIPCIONES", "id": "0088df5b6f2a4a7d84d4729c4a1317d5" },
    { "binding": "OROPEZAS_KV", "id": "f0ab30b6391b4cabacb0a87eadf634cd" },
    { "binding": "OROPEZAS_FOROS", "id": "397ecdc4e9594651afc51086fff53650" }
  ],
  "r2_buckets": [
    { "bucket_name": "oropezas-media", "binding": "OROPEZAS_MEDIA" }
  ],
  "ai": { "binding": "AI" },
  "d1_databases": [
    { "binding": "DB", "database_name": "oropezas-db", "database_id": "00000000-0000-0000-0000-000000000000" }
  ]
}
```

### 12.2 Required Secrets

| Secret | Description | Set Command |
|--------|-------------|-------------|
| `API_KEY` | AI agent API key | `wrangler secret put API_KEY` |
| `FIREBASE_API_KEY` | Firebase Auth API key | `wrangler secret put FIREBASE_API_KEY` |
| `GOOGLE_CHAT_SECRET` | Google Chat webhook secret | `wrangler secret put GOOGLE_CHAT_SECRET` |
| `STRIPE_SECRET_KEY` | Stripe (optional) | `wrangler secret put STRIPE_SECRET_KEY` |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook (optional) | `wrangler secret put STRIPE_WEBHOOK_SECRET` |
| `VAPID_PUBLIC_KEY` | Web Push public key | `wrangler secret put VAPID_PUBLIC_KEY` |
| `VAPID_PRIVATE_KEY` | Web Push private key | `wrangler secret put VAPID_PRIVATE_KEY` |

### 12.3 D1 Database Setup

```bash
# Create database
wrangler d1 create oropezas-db

# Copy database_id from output into wrangler.jsonc

# Run migrations (if needed)
wrangler d1 execute oropezas-db --file=./schema.sql
```

### 12.4 Deploy Command

```bash
cd oropezas
wrangler deploy
```

### 12.5 Git Push (Frontend)

```bash
git add -A
git commit -m "description"
git push origin main
```

### 12.6 Firebase Project Setup

**Project**: `oropezascom`

**Required Firebase configuration**:
1. Enable Authentication → Google sign-in provider
2. Set authorized domains: `oropezas.com`, `kelowna.oropezas.com`, `localhost`
3. Firestore: Create database in native mode
4. Firestore rules: Allow reads, authenticated writes

---

## 13. DEBUGGING & TROUBLESHOOTING

### 13.1 Common Issues

| Issue | Cause | Fix |
|-------|-------|-----|
| Articles not loading | D1 not seeded | Articles load from KV fallback automatically |
| Auth not working | `type="module"` missing on script tag | Verify `<script src="auth.js" type="module">` |
| Firebase popup blocked | Browser popup blocker | User must allow popups for the domain |
| CORS errors | Origin not in ALLOWED_ORIGINS | Add domain to `ALLOWED_ORIGINS` array in worker.js |
| Images 404 | R2 key mismatch | Check `getMediaUrl()` output matches R2 object key |
| AI agent 401 | Wrong API key | Verify `x-api-key` header matches `env.API_KEY` |
| Forum auth fail | Token expired | Re-login, token auto-refreshes every hour |
| Green debug box | auth.js debug overlay | Removed in v5.0, check console for `[AUTH]` logs |

### 13.2 Worker Logs

```bash
# Stream worker logs
wrangler tail

# With grep for specific patterns
wrangler tail | grep "\[AUTH\]"
wrangler tail | grep "\[D1\]"
wrangler tail | grep "\[FS\]"
```

### 13.3 KV Inspection

```bash
# List KV keys
wrangler kv:key list --namespace-id=f0ab30b6391b4cabacb0a87eadf634cd

# Get specific key
wrangler kv:key get "user:123" --namespace-id=f0ab30b6391b4cabacb0a87eadf634cd

# List D1 tables
wrangler d1 execute oropezas-db --command="SELECT name FROM sqlite_master WHERE type='table'"

# Count articles
wrangler d1 execute oropezas-db --command="SELECT COUNT(*) FROM articles"

# List articles
wrangler d1 execute oropezas-db --command="SELECT slug, title, site, date FROM articles ORDER BY date DESC"
```

### 13.4 Frontend Debugging

**Auth debug logs** (browser console):
```
[AUTH] Auth init started (Firebase)
[AUTH] Loaded cached user: user@email.com
[AUTH] Firebase user detected: user@email.com
[AUTH] Got Firebase ID token, syncing with backend...
[AUTH] Backend sync: {"success": true, "has_user": true}
```

**Error patterns**:
```
[AUTH] Sign-in error: auth/popup-closed-by-user — User closed popup
[AUTH] Sign-in error: auth/popup-blocked — Browser blocked popup
[AUTH] Sign-in error: auth/network-request-failed — No internet
[AUTH] Backend sync failed: ... — Worker error
```

---

## 14. RULES FOR AI AGENTS

### 14.1 The Golden Rules

1. **NEVER HALLUCINATE**. Do not invent people, quotes, events, dates, or statistics. Only use verified facts.
2. **Use D1 for articles**. All article queries go through `env.DB.prepare()` SQL.
3. **Use Firestore for users**. User data goes through `fsGetUser()` / `fsSaveUser()`.
4. **AI endpoints require `x-api-key`**. Every `/api/agent/*` call must include the API key header.
5. **Images go to R2**. Use `env.OROPEZAS_MEDIA.put()` and `getMediaUrl()`.
6. **Keep the Worker as a single file**. `src/worker.js` is the ONLY backend file.
7. **Verify before publishing**. Check facts, dates, and names before publishing articles.
8. **Respect the KV fallback**. When D1 fails, always fall back to KV. Never crash.
9. **Use proper Spanish**. Write in professional Mexican Spanish for all content.
10. **No paywall content**. Stripe is disabled. Do not attempt to use premium features.

### 14.2 Code Patterns for Agents

**Query articles**:
```javascript
// D1 primary
const { results } = await env.DB.prepare(
  'SELECT * FROM articles WHERE site = ? AND status = "published" ORDER BY date DESC LIMIT ?'
).bind('main', 10).all();

// KV fallback
const indexRaw = await env.OROPEZAS_KV.get('articles_index');
const articles = indexRaw ? JSON.parse(indexRaw).articles : [];
```

**Save article**:
```javascript
await d1SaveArticle(env, {
  title: '...',
  slug: '...',
  excerpt: '...',
  html: '<p>...</p>',
  category: 'noticias',
  date: '2026-05-12',
  site: 'main',
  featured: false
});
```

**Get user**:
```javascript
// Firestore primary
const user = await fsGetUser(uid, env);

// KV fallback
const raw = await env.OROPEZAS_KV.get(`user:${uid}`);
const user = raw ? JSON.parse(raw) : null;
```

**Generate image**:
```javascript
const result = await generarImagenConNanoBanana(article, env, { slug, category });
// Returns: { key, url, generated: true, model }
```

**Call AI**:
```javascript
const text = await runAI(prompt, env, {
  model: '@cf/meta/llama-3.1-8b-instruct',
  maxTokens: 4096,
  system: 'You are a professional journalist...'
});
```

### 14.3 File Change Permissions

| File | Can Modify | Notes |
|------|-----------|-------|
| `src/worker.js` | YES | Single backend file, ~2820 lines |
| `Prensa_2/auth.js` | YES | Firebase Auth module |
| `Prensa_2/news-loader.js` | YES | Article rendering |
| `Prensa_2/*.html` | CAREFUL | Script tags must stay `type="module"` for auth.js |
| `wrangler.jsonc` | YES | Config changes |
| `Prensa_2/adsense.js` | NO | AdSense integration is finalized |
| `Prensa_2/chatbot.js` | YES | Chat widget |
| `AGENTS_ZAPIA.md` | NO | This file is documentation |

---

## APPENDIX A: FIREBASE CONFIG

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyCy7ZzxAc830KyA7TejjE5X5coPDCsokqw",
  authDomain: "oropezascom.firebaseapp.com",
  projectId: "oropezascom",
  storageBucket: "oropezascom.firebasestorage.app",
  messagingSenderId: "2029662532",
  appId: "1:2029662532:web:61f3b1c79d1c322819e711",
  measurementId: "G-0YZ2M6T744"
};
```

## APPENDIX B: WORKER ENVIRONMENT VARIABLES

| Variable | Type | Required | Description |
|----------|------|----------|-------------|
| `DB` | D1 | YES | Articles database |
| `AI` | AI | YES | Cloudflare Workers AI |
| `OROPEZAS_KV` | KV | YES | Articles + users cache |
| `OROPEZAS_FOROS` | KV | YES | Forum data |
| `OROPEZAS_MEDIA` | R2 | YES | Image storage |
| `PUSH_SUBSCRIPTIONS` | KV | YES | Push notification subs |
| `SUSCRIPCIONES` | KV | YES | Email subscribers |
| `SITIO_CONTENIDO` | KV | YES | Site crawler data |
| `API_KEY` | Secret | YES | AI agent auth |
| `FIREBASE_API_KEY` | Secret | YES | Firebase token verification |
| `GOOGLE_CHAT_SECRET` | Secret | No | Chat webhook |
| `STRIPE_SECRET_KEY` | Secret | No | Payments (disabled) |
| `STRIPE_WEBHOOK_SECRET` | Secret | No | Stripe webhook |
| `VAPID_PUBLIC_KEY` | Secret | No | Push notifications |
| `VAPID_PRIVATE_KEY` | Secret | No | Push notifications |

## APPENDIX C: ADSENSE CONFIG

```
Publisher ID: pub-8411594357975477
ads.txt: google.com, pub-8411594357975477, DIRECT, f08c47fec0942fa0
```

Cookie consent banner required for EU/California compliance.

---

*End of Bible. Updated 2026-05-12.*
*Version: 5.0 — Firebase Auth + D1 Articles + Firestore Users*
