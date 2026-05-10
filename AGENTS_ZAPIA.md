# Oropezas.com + Kelowna.oropezas.com — Zapia Agent Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE PAGES                          │
│  ┌─────────────┐  ┌──────────────────────────────────────────┐ │
│  │ oropezas.com│  │  kelowna.oropezas.com                    │ │
│  │ (Prensa_2/) │  │  (Prensa_2/kelowna/)                     │ │
│  │             │  │  (Prensa_2/Kelowna/)                     │ │
│  └──────┬──────┘  └────────────────────┬─────────────────────┘ │
│         │                              │                        │
│         └──────────┬───────────────────┘                        │
│                    │                                             │
│  ┌─────────────────▼──────────────────────────────────────────┐ │
│  │              SHARED ASSETS                                  │ │
│  │  auth.js | news-loader.js | adsense.js | styles.css        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     CLOUDFLARE WORKER                            │
│              oropezas.enriquegarciaoropeza.workers.dev          │
├─────────────────────────────────────────────────────────────────┤
│  Auth    │ /api/auth/google     (Firebase + Google OAuth)       │
│  Articles│ /api/articles        (D1 primary, KV fallback)       │
│          │ /api/article/:slug   (D1 primary, KV fallback)       │
│  Media   │ /api/media/*         (R2 bucket: oropezas-media)     │
│  AI      │ /api/agent/*         (Llama 3.1 + Flux-1)            │
│  Forums  │ /api/foros/*         (KV: OROPEZAS_FOROS)            │
│  Chat    │ /api/chat/webhook    (Google Chat bot)               │
│  Push    │ /api/push/*          (KV: PUSH_SUBSCRIPTIONS)        │
│  Stripe  │ /api/stripe/*        (DISABLED)                      │
│  Users   │ /api/user/profile    (Firestore primary, KV fallback) │
│          │ /api/user/update     (Firestore + KV)                │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
   ┌────────────┐    ┌──────────────┐    ┌──────────────┐
   │  D1 SQLite │    │  Firestore   │    │  Cloudflare  │
   │  Articles  │    │  Users       │    │  Workers AI  │
   │  (DB)      │    │  (REST API)  │    │  (AI)        │
   └────────────┘    └──────────────┘    └──────────────┘
          │                   │                   │
   ┌────────────┐    ┌──────────────┐    ┌──────────────┐
   │  Cloudflare│    │  Firebase    │    │  Cloudflare  │
   │  R2        │    │  Project:    │    │  KV (cache)  │
   │  Images    │    │  oropezascom │    │  fallback    │
   └────────────┘    └──────────────┘    └──────────────┘
```

---

## Data Stores

### D1 SQLite — Articles Only

| Table     | Purpose    | Fields |
|-----------|-----------|--------|
| `articles`| News articles | `id`, `title`, `slug`, `excerpt`, `html`, `category`, `date`, `author`, `site` ('main' or 'kelowna'), `status`, `featured_image`, `image`, `tags`, `featured`, `created_at`, `updated_at` |

**Why**: D1 provides fast SQL queries for article listings (ORDER BY date, LIMIT, category filters).

**Binding**: `env.DB`

### Firestore — Users Only

| Collection | Purpose | Fields |
|-----------|---------|--------|
| `users`   | User profiles | `uid`, `email`, `name`, `picture`, `role` ('user', 'ceo', 'publisher', 'ai'), `title`, `bio`, `joinedAt`, `lastLogin` |

**Why**: Firestore is the source of truth for user data. Firebase Auth handles Google Sign-In, and Firestore stores extended profiles.

**Project**: `oropezascom`

**Access**: Firestore REST API (`firestore.googleapis.com/v1/projects/oropezascom/...`)

### Cloudflare KV — Legacy Fallback

| Namespace      | Purpose |
|---------------|---------|
| `OROPEZAS_KV` | Articles index, user profiles (fallback), individual articles |
| `OROPEZAS_FOROS` | Forum threads and replies |
| `PUSH_SUBSCRIPTIONS` | Web Push subscriptions |
| `SUSCRIPCIONES` | Email subscribers |
| `SITIO_CONTENIDO` | Site content snippets |

### Cloudflare R2 — Images

| Bucket | Purpose |
|--------|---------|
| `oropezas-media` | Article images, media uploads |

---

## Authentication Flow

### Three-Token Support

The `/api/auth/google` endpoint accepts three token types, tried in order:

1. **`firebaseToken`** — Firebase Auth ID token (preferred, new method)
   - Verified via `identitytoolkit.googleapis.com/v1/accounts:lookup`
   - Requires `env.FIREBASE_API_KEY`
   
2. **`idToken`** — Google Identity Services JWT (legacy GIS method)
   - Decoded locally (base64 JWT payload), no signature verification
   
3. **`accessToken`** — Google OAuth2 access token (legacy TokenClient method)
   - Verified via `googleapis.com/oauth2/v3/userinfo`

### User Resolution Priority

1. Check Firestore (`/users/{uid}`) — primary source of truth
2. If not found, check KV (`user:{uid}`) — migration fallback
3. If not found anywhere, create new user with `role: 'user'`

### User Save Strategy

1. Save to Firestore (via REST PATCH) — async, non-blocking
2. Save to KV (`user:{uid}`) — async, non-blocking (redundancy)

### Response Format

```json
{
  "success": true,
  "user": {
    "uid": "google-sub-or-firebase-uid",
    "email": "user@example.com",
    "name": "User Name",
    "picture": "https://...",
    "role": "user",
    "title": "",
    "bio": ""
  }
}
```

---

## API Endpoints

### Auth
| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `/api/auth/google` | POST | `{firebaseToken? \| idToken? \| accessToken?}` | Sign in, returns user profile |

### Articles (D1 Primary, KV Fallback)
| Endpoint | Method | Query/Body | Description |
|----------|--------|-----------|-------------|
| `/api/articles` | GET | `?site=main\|kelowna`, `?category=`, `?featured=true` | List articles |
| `/api/article/:slug` | GET | — | Get single article by slug |

### Media
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/media/:key` | GET/HEAD | Serve image from R2 bucket |

### Users (Firestore Primary, KV Fallback)
| Endpoint | Method | Query/Body | Description |
|----------|--------|-----------|-------------|
| `/api/user/profile?uid=` | GET | — | Get user profile |
| `/api/user/update` | POST | `{uid, token, title?, bio?, displayName?}` | Update profile |

### AI Agents (Requires `x-api-key` header)
| Endpoint | Method | Body | Description |
|----------|--------|------|-------------|
| `/api/agent/write` | POST | `{topic, category, tone, length}` | Write article draft |
| `/api/agent/publish` | POST | `{draftId}` | Publish draft |
| `/api/agent/blast` | POST | `{articleId, channels}` | Email/push blast |
| `/api/agent/auto-publish` | POST | `{topic, category, autoBlast?}` | Write + publish |
| `/api/agent/generate-image` | POST | `{articleId\|draftId, prompt}` | Generate image |
| `/api/agent/upload-media` | POST | FormData `{file, key}` | Upload to R2 |
| `/api/agent/dashboard` | GET | — | System stats |

### Forums
| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/foros/threads` | GET | — | List threads |
| `/api/foros/threads` | POST | Token | Create thread |
| `/api/foros/threads/:id` | GET | — | Get thread + replies |
| `/api/foros/threads/:id/replies` | POST | Token | Create reply |

### Other
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat/webhook` | POST | Google Chat bot webhook |
| `/api/push/subscribe` | POST | Register push subscription |
| `/api/push/send` | POST | Send push notification |

---

## Firebase Configuration

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

**Environment variable in Worker**: `FIREBASE_API_KEY`

### Firestore REST API Patterns

**Get user**: `GET firestore.googleapis.com/v1/projects/oropezascom/databases/(default)/documents/users/{uid}`

**Save user**: `PATCH firestore.googleapis.com/v1/projects/oropezascom/databases/(default)/documents/users/{uid}` with `{ fields: { ... } }`

**Verify Firebase token**: `POST identitytoolkit.googleapis.com/v1/accounts:lookup?key={apiKey}` with `{ idToken }`

---

## Frontend Files (Prensa_2/)

| File | Purpose | Used By |
|------|---------|---------|
| `index.html` | Main Oropezas site | oropezas.com |
| `auth.js` | Auth UI + Google Sign-In | All pages |
| `news-loader.js` | Article rendering (main) | index.html |
| `adsense.js` | Cookie consent + AdSense | All pages |
| `styles.css` | Shared styles | All pages |
| `article.html` | Article detail page | oropezas.com |
| `chatbot.js` | AI chat widget | All pages |
| `kelowna/index.html` | Kelowna site | kelowna.oropezas.com |
| `kelowna/kelowna-articles.js` | Article rendering (Kelowna) | kelowna/index.html |

### Auth Frontend (auth.js)

Current auth flow uses Google Identity Services (GIS) TokenClient popup:
- Loads `accounts.google.com/gsi/client`
- Uses `google.accounts.oauth2.initTokenClient()` + `requestAccessToken()`
- Sends `accessToken` to `/api/auth/google`
- Stores user in `localStorage` key `oropezas_user_v3`

**Future**: Will be replaced with Firebase Auth SDK (GoogleAuthProvider).

---

## Deployment

### Command
```bash
cd /mnt/agents/output/app/oropezas
wrangler deploy
```

### Wrangler Config
- **Name**: `oropezas`
- **Entry**: `src/worker.js`
- **Bindings**: KV (5), R2 (1), D1 (1), AI (1)

### D1 Database Setup
```bash
wrangler d1 create oropezas-db
# Copy the database_id into wrangler.jsonc
```

### Environment Variables to Set
```bash
wrangler secret put FIREBASE_API_KEY
# Value: AIzaSyCy7ZzxAc830KyA7TejjE5X5coPDCsokqw

wrangler secret put API_KEY
# Value: <your agent API key>

wrangler secret put GOOGLE_CHAT_SECRET
# Value: <your Google Chat webhook secret>
```

---

## Key Decisions

1. **D1 for articles, Firestore for users**: Articles need fast SQL queries (ORDER BY, LIMIT, category filters). Users need flexible schema and Firebase Auth integration.

2. **Three-token auth support**: Firebase tokens (new), Google ID tokens (legacy GIS), and OAuth access tokens (legacy TokenClient) are all accepted for backward compatibility during migration.

3. **Firestore via REST API**: The Worker calls Firestore directly via REST rather than using Firebase Admin SDK, because the Worker runs on Cloudflare's edge (not Node.js).

4. **KV as fallback**: All Firestore reads have KV fallback. All writes go to both Firestore and KV. This ensures zero downtime during the migration.

---

## Rules for Zapia Agents

1. **Never hallucinate articles, events, or people.** Only write about verified facts.
2. **Use D1 for article queries.** Use the `env.DB.prepare()` API with SQL.
3. **Use Firestore for user data.** Use the `fsGetUser()` / `fsSaveUser()` helpers.
4. **All AI endpoints require `x-api-key` header.** Check `validarApiKeyAgente()`.
5. **Images go to R2.** Use `env.OROPEZAS_MEDIA.put()` and `getMediaUrl()`.
6. **Keep the Worker as a single file.** `src/worker.js` is the only backend file.
