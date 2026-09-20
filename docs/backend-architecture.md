# InnovativeSTEMHub API — Architecture Plan

Status: **planning only — nothing in this document is implemented yet.**
Owner: Brandon (backend, TypeScript, hosted on Render)
Consumer: the Angular frontend in this repo (to be re-pointed at this API once it exists)

This is the design for a standalone backend service that takes over three jobs currently split between the Angular app and Firebase directly:

1. Emailing the contact form to Dr. Mutende's inbox.
2. Backing her admin console (home photo, current research, books & reads, blog posts, comment moderation).
3. Serving the public content those admin actions produce (blog, research, reading list, home photo).

It replaces the Firebase-direct approach from `docs/`-adjacent work so far (Firestore + Firebase Auth + Firebase Storage called straight from the browser). Firebase is dropped entirely once this ships — Postgres holds the data, Redis is the cache/session/rate-limit layer, and object storage is S3-compatible.

---

## 1. Technology stack

| Concern | Choice | Why |
|---|---|---|
| Language/runtime | TypeScript on Node.js 22 LTS | matches the stated requirement |
| Framework | **NestJS** (Express adapter) | DI, modules, guards, pipes, interceptors map directly onto auth/validation/caching/response-shaping; `@nestjs/swagger` generates a live OpenAPI doc from the same decorators used in this plan, so the spec and the code can't drift apart |
| ORM / DB access | **Prisma** | type-safe queries and migrations, first-class TS inference, plays well with NestJS via a `PrismaService` |
| Database | **PostgreSQL** (Render managed Postgres) | structured content (posts, comments, research, library) with real relations (comments → posts) — a better fit than a document store now that there's a real backend layer |
| Cache / rate limit / sessions | **Redis** (Render Key-Value, or Upstash if preferred) | see §5 |
| Object storage | **Cloudflare R2** (S3-compatible) | photo + blog cover uploads; no egress fees; `@aws-sdk/client-s3` works against it unmodified. AWS S3 is a drop-in alternative if preferred |
| Transactional email | **Resend** | contact-form → inbox email; SendGrid/Postmark are equivalent alternatives if there's an existing account |
| Validation | `class-validator` / `class-transformer` DTOs | idiomatic NestJS, integrates with Swagger generation |
| Auth | Custom JWT (access + refresh), **not** Firebase Auth | single admin account, no need for a third-party identity provider once there's a real backend and DB |

Nothing here is a hard requirement of the others — Fastify instead of Express, or TypeORM instead of Prisma, wouldn't change any endpoint or payload in this document. This is just the recommended default.

---

## 2. High-level architecture

```
                         ┌─────────────────────────┐
                         │   Angular frontend       │
                         │  innovativestemhub.com   │
                         │   (GitHub Pages)         │
                         └────────────┬─────────────┘
                                      │ HTTPS, fetch/HttpClient
                                      │ credentials: include (refresh cookie)
                                      ▼
                         ┌─────────────────────────┐
                         │  api.innovativestemhub.com│
                         │   NestJS API (Render)    │
                         │  ┌─────────────────────┐ │
                         │  │ Guards / Interceptors│ │
                         │  │ (auth, cache, rate-  │ │
                         │  │  limit, response     │ │
                         │  │  envelope)           │ │
                         │  └─────────┬───────────┘ │
                         └────────────┼─────────────┘
                        ┌─────────────┼──────────────┬───────────────┐
                        ▼             ▼              ▼               ▼
                ┌──────────────┐ ┌──────────┐ ┌──────────────┐ ┌───────────┐
                │  PostgreSQL  │ │  Redis   │ │ Cloudflare R2│ │  Resend   │
                │ (Render DB)  │ │ (cache,  │ │ (photo/cover │ │ (contact- │
                │              │ │ rate     │ │  uploads)    │ │  form     │
                │              │ │ limit,   │ │              │ │  email)   │
                │              │ │ sessions)│ │              │ │           │
                └──────────────┘ └──────────┘ └──────────────┘ └───────────┘
```

Same-site subdomains (`innovativestemhub.com` and `api.innovativestemhub.com`) are deliberate — it lets the refresh-token cookie use `SameSite=Lax` instead of `SameSite=None`, which is both simpler and safer than a cross-site cookie. See §7.

---

## 3. Data model (Prisma schema, conceptually)

```prisma
model Admin {
  id           String   @id @default(uuid())
  email        String   @unique
  passwordHash String
  name         String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}

model ResearchItem {
  id        String   @id @default(uuid())
  title     String
  year      String
  url       String?
  summary   String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum LibraryItemType {
  BOOK
  READ
}

model LibraryItem {
  id        String          @id @default(uuid())
  title     String
  author    String?
  type      LibraryItemType
  url       String?
  note      String?
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
}

enum PostStatus {
  DRAFT
  PUBLISHED
}

model BlogPost {
  id             String     @id @default(uuid())
  title          String
  slug           String     @unique
  excerpt        String
  content        String     @db.Text // Markdown
  coverImageUrl  String?
  status         PostStatus @default(DRAFT)
  publishedAt    DateTime?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt
  comments       Comment[]
}

enum CommentStatus {
  PENDING
  APPROVED
  REJECTED
}

model Comment {
  id        String        @id @default(uuid())
  postId    String
  post      BlogPost      @relation(fields: [postId], references: [id], onDelete: Cascade)
  name      String
  body      String        @db.Text
  status    CommentStatus @default(PENDING)
  ipHash    String        // sha256 of submitter IP, for abuse review — never the raw IP
  createdAt DateTime      @default(now())

  @@index([postId, status])
}

enum ContactStatus {
  SENT
  FAILED
}

model ContactMessage {
  id            String        @id @default(uuid())
  name          String
  email         String
  message       String        @db.Text
  emailStatus   ContactStatus
  createdAt     DateTime      @default(now())
}

model SiteSetting {
  key       String   @id
  value     String
  updatedAt DateTime @updatedAt
}
```

`SiteSetting` is a generic key/value table so the home photo (`key = "home_photo_url"`) doesn't need its own table, and future single-value settings (e.g. a site-wide announcement) reuse it without a migration.

No table for refresh tokens or rate-limit counters — both live in Redis (§5). If Redis is ever wiped, the only consequence is every admin session needs to log in again; no user-facing data is lost.

---

## 4. Redis usage

Three distinct jobs, three key prefixes, so eviction/inspection never gets confused:

### 4.1 Response cache (`cache:*`)

Cache-aside on the read-heavy public GET endpoints. Every write to the underlying resource deletes the relevant key(s) — no reliance on TTL alone for correctness, TTL is just a safety net.

| Cache key | Populated by | TTL | Invalidated on |
|---|---|---|---|
| `cache:research:list` | `GET /research` | 5 min | any research create/update/delete |
| `cache:library:list` | `GET /library` | 5 min | any library create/update/delete |
| `cache:blog:list:published:{page}:{limit}` | `GET /blog/posts` (public) | 2 min | any post create/update/delete |
| `cache:blog:post:{slug}` | `GET /blog/posts/:slug` | 5 min | that post's update/delete |
| `cache:blog:comments:{postId}:{page}` | `GET /blog/posts/:slug/comments` | 1 min | approve/reject/delete on a comment for that post |
| `cache:site:settings` | `GET /site/settings` | 10 min | `PUT /site/settings/home-photo` |

Admin-authenticated requests (e.g. `GET /blog/posts` with `status=draft`) never hit the cache — only the anonymous/public shape is cached, since it's the one requested identically by every visitor.

### 4.2 Rate limiting (`ratelimit:*`)

Fixed-window counters, `INCR` + `EXPIRE`, enforced by a Nest guard before the handler runs:

| Endpoint | Limit | Window | Key |
|---|---|---|---|
| `POST /auth/login` | 5 attempts | 15 min | `ratelimit:login:{ip}` |
| `POST /contact` | 3 submissions | 10 min | `ratelimit:contact:{ip}` |
| `POST /blog/posts/:slug/comments` | 5 submissions | 60 min | `ratelimit:comment:{ip}` |
| Everything else (default) | 100 requests | 1 min | `ratelimit:default:{ip}` |

Every response includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and, once exceeded, `Retry-After`. A 429 uses the standard error envelope (§6.4) with `code: "RATE_LIMITED"`.

### 4.3 Session store (`session:*`)

Access tokens are short-lived JWTs (15 min) and never touch Redis — they're stateless, verified by signature alone. Refresh tokens are opaque random strings, and Redis is their source of truth:

- `session:{refreshTokenId} → { adminId, issuedAt }`, TTL 30 days.
- Refresh **rotates**: each `POST /auth/refresh` deletes the old key and writes a new one, so a stolen-and-reused refresh token is detectable (the legitimate client's next refresh will fail because its token was already rotated out from under it).
- `POST /auth/logout` deletes the key outright — this is the only way to actually revoke a session before its access token expires, which is the whole reason refresh tokens live in Redis instead of also being stateless JWTs.

---

## 5. API conventions

- Base URL: `https://api.innovativestemhub.com/api/v1`
- All request/response bodies are `application/json` (uploads are the one exception — see §6.5).
- Auth: `Authorization: Bearer <accessToken>` header. No API keys, no query-string tokens.
- Every response — success or error — uses the same envelope:

**Success:**
```json
{
  "success": true,
  "data": { },
  "meta": null
}
```

`data` is `null` for actions with no return payload (e.g. delete), an object for single resources, or an array for lists. `meta` carries pagination and is `null` everywhere else.

**Paginated success:**
```json
{
  "success": true,
  "data": [ ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 47,
    "totalPages": 3
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": [
      { "field": "email", "issue": "must be a valid email address" }
    ]
  }
}
```

`details` is omitted (not `null` — the key is absent) when there's nothing field-level to report, e.g. a 404.

### Standard error codes

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | request body/query failed DTO validation |
| 401 | `UNAUTHENTICATED` | missing or invalid access token |
| 401 | `INVALID_CREDENTIALS` | login email/password didn't match |
| 403 | `FORBIDDEN` | valid token, insufficient rights (reserved for future roles beyond the single admin) |
| 404 | `NOT_FOUND` | resource doesn't exist |
| 409 | `CONFLICT` | e.g. slug collision that couldn't be auto-resolved |
| 422 | `UNPROCESSABLE` | well-formed but semantically invalid (e.g. publishing a post with empty content) |
| 429 | `RATE_LIMITED` | see §4.2 |
| 500 | `INTERNAL_ERROR` | unhandled — logged server-side with a request id, generic message returned to the client |

### Pagination

Query params `?page=1&limit=20` on every list endpoint. `limit` caps at 50 server-side regardless of what's requested.

---

## 6. Endpoints

Grouped by resource. "Auth" column: **Public** (no header needed), **Admin** (valid Bearer token required).

### 6.1 Health

#### `GET /api/v1/health` — Public
Liveness probe for Render.

```json
// 200
{ "success": true, "data": { "status": "ok", "uptime": 134523 } }
```

#### `GET /api/v1/health/ready` — Public
Readiness probe — checks Postgres and Redis connectivity.

```json
// 200
{
  "success": true,
  "data": { "status": "ready", "postgres": "ok", "redis": "ok" }
}
```
```json
// 503
{
  "success": false,
  "error": { "code": "NOT_READY", "message": "Redis connection failed." }
}
```

---

### 6.2 Auth

#### `POST /api/v1/auth/login` — Public (rate-limited, §4.2)

Request:
```json
{
  "email": "rmutende@kibu.ac.ke",
  "password": "correct-horse-battery-staple"
}
```

Response — sets `refreshToken` as an `HttpOnly; Secure; SameSite=Lax; Path=/api/v1/auth` cookie; body carries only the access token:
```json
// 200
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 900,
    "admin": {
      "id": "5b1e...",
      "email": "rmutende@kibu.ac.ke",
      "name": "Dr. Rose Atieno Mutende"
    }
  }
}
```
```json
// 401
{ "success": false, "error": { "code": "INVALID_CREDENTIALS", "message": "Email or password is incorrect." } }
```

#### `POST /api/v1/auth/refresh` — Public (requires the refresh cookie)

No request body — reads the cookie. Rotates it (§4.3).

```json
// 200
{ "success": true, "data": { "accessToken": "eyJ...", "expiresIn": 900 } }
```
```json
// 401
{ "success": false, "error": { "code": "UNAUTHENTICATED", "message": "Session expired. Please sign in again." } }
```

#### `POST /api/v1/auth/logout` — Admin

Deletes the Redis session and clears the cookie.

```json
// 200
{ "success": true, "data": null }
```

#### `GET /api/v1/auth/me` — Admin

```json
// 200
{
  "success": true,
  "data": { "id": "5b1e...", "email": "rmutende@kibu.ac.ke", "name": "Dr. Rose Atieno Mutende" }
}
```

There is deliberately no `POST /auth/register` — the single admin row is created by a one-off seed script (`npm run seed:admin`, reads `ADMIN_EMAIL`/`ADMIN_PASSWORD` from the environment), not an API call. Nothing on the public internet should be able to create an admin account.

---

### 6.3 Site settings (home photo)

#### `GET /api/v1/site/settings` — Public, cached (§4.1)

```json
// 200
{ "success": true, "data": { "homePhotoUrl": "https://cdn.innovativestemhub.com/site/home-photo-1732.jpg" } }
```

#### `PUT /api/v1/site/settings/home-photo` — Admin

Request (the URL comes from the upload flow in §6.4):
```json
{ "photoUrl": "https://cdn.innovativestemhub.com/site/home-photo-1732.jpg" }
```

```json
// 200
{ "success": true, "data": { "homePhotoUrl": "https://cdn.innovativestemhub.com/site/home-photo-1732.jpg" } }
```

---

### 6.4 Uploads

#### `POST /api/v1/uploads/presign` — Admin

Request:
```json
{
  "fileName": "portrait.jpg",
  "contentType": "image/jpeg",
  "purpose": "home-photo"
}
```
`purpose` is `"home-photo" | "blog-cover"` — it only decides the storage key prefix (`site/` vs `blog/`) and the max-size check (10 MB for photos, enforced both client-side and by the presigned policy).

```json
// 200
{
  "success": true,
  "data": {
    "uploadUrl": "https://<bucket>.r2.cloudflarestorage.com/site/home-photo-1732.jpg?X-Amz-...",
    "publicUrl": "https://cdn.innovativestemhub.com/site/home-photo-1732.jpg",
    "objectKey": "site/home-photo-1732.jpg",
    "expiresIn": 300
  }
}
```

The admin UI then does a plain `PUT` of the raw file bytes to `uploadUrl` (not through this API), and only sends `publicUrl` onward to `PUT /site/settings/home-photo` or `POST /blog/posts`. Large binaries never pass through the NestJS process.

*Pragmatic MVP alternative:* if presigned uploads feel like too much to stand up first, `POST /api/v1/uploads` accepting `multipart/form-data` and proxying to R2 server-side is a fine v1 substitute — same response shape (`publicUrl`, `objectKey`), swap the implementation later without touching any other endpoint.

---

### 6.5 Research

#### `GET /api/v1/research` — Public, cached, paginated

```json
// 200
{
  "success": true,
  "data": [
    {
      "id": "b7e1...",
      "title": "Blended Learning Outcomes in Kenyan STEM Classrooms",
      "year": "2025",
      "url": "https://doi.org/10.xxxx/xxxxx",
      "summary": "A study of Moodle-based blended learning adoption across three counties.",
      "createdAt": "2025-11-02T09:15:00.000Z",
      "updatedAt": "2025-11-02T09:15:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

#### `POST /api/v1/research` — Admin

Request:
```json
{
  "title": "Blended Learning Outcomes in Kenyan STEM Classrooms",
  "year": "2025",
  "url": "https://doi.org/10.xxxx/xxxxx",
  "summary": "A study of Moodle-based blended learning adoption across three counties."
}
```
`url` and `summary` are optional. Validation: `title` 3–200 chars, `year` matches `^[0-9]{4}$`.

```json
// 201
{ "success": true, "data": { "id": "b7e1...", "title": "...", "year": "2025", "url": "...", "summary": "...", "createdAt": "...", "updatedAt": "..." } }
```

#### `PATCH /api/v1/research/:id` — Admin

Request (any subset of the create fields):
```json
{ "summary": "Updated summary after peer review." }
```
```json
// 200
{ "success": true, "data": { "id": "b7e1...", "...": "full updated resource" } }
```
```json
// 404
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Research item not found." } }
```

#### `DELETE /api/v1/research/:id` — Admin

```json
// 200
{ "success": true, "data": null }
```

---

### 6.6 Library (books & reads)

Identical shape to Research.

#### `GET /api/v1/library` — Public, cached, paginated

```json
// 200
{
  "success": true,
  "data": [
    {
      "id": "c2af...",
      "title": "How People Learn II",
      "author": "National Academies of Sciences",
      "type": "book",
      "url": "https://doi.org/10.17226/24783",
      "note": "Re-reading the chapter on transfer of learning for the Term 2 workshop.",
      "createdAt": "2026-01-14T07:40:00.000Z",
      "updatedAt": "2026-01-14T07:40:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

#### `POST /api/v1/library` — Admin

```json
{
  "title": "How People Learn II",
  "author": "National Academies of Sciences",
  "type": "book",
  "url": "https://doi.org/10.17226/24783",
  "note": "Re-reading the chapter on transfer of learning for the Term 2 workshop."
}
```
`type` is `"book" | "read"`; `author`, `url`, `note` optional.

```json
// 201
{ "success": true, "data": { "id": "c2af...", "...": "as above" } }
```

#### `PATCH /api/v1/library/:id` — Admin
#### `DELETE /api/v1/library/:id` — Admin

Same request/response pattern as Research (§6.5).

---

### 6.7 Blog posts

#### `GET /api/v1/blog/posts` — Public or Admin, cached (public shape only), paginated

Public (no `Authorization` header, or a non-admin one): only `status: "published"`, list items omit `content`.

```
GET /api/v1/blog/posts?page=1&limit=10
```
```json
// 200
{
  "success": true,
  "data": [
    {
      "id": "f01a...",
      "title": "What Three Terms of Blended Learning Taught Me",
      "slug": "what-three-terms-of-blended-learning-taught-me",
      "excerpt": "Notes from rolling out Moodle across five schools in Bungoma.",
      "coverImageUrl": "https://cdn.innovativestemhub.com/blog/cover-1729.jpg",
      "status": "published",
      "publishedAt": "2026-02-01T06:00:00.000Z",
      "createdAt": "2026-01-30T10:12:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

Admin (valid Bearer token), optionally `?status=draft|published`, defaults to all statuses:
```
GET /api/v1/blog/posts?status=draft
Authorization: Bearer eyJ...
```
Same shape, includes `"status": "draft"` items too.

#### `GET /api/v1/blog/posts/:slug` — Public (published only) or Admin (any status)

```json
// 200
{
  "success": true,
  "data": {
    "id": "f01a...",
    "title": "What Three Terms of Blended Learning Taught Me",
    "slug": "what-three-terms-of-blended-learning-taught-me",
    "excerpt": "Notes from rolling out Moodle across five schools in Bungoma.",
    "content": "## It started with one laptop cart\n\nIn Term 1 we...",
    "coverImageUrl": "https://cdn.innovativestemhub.com/blog/cover-1729.jpg",
    "status": "published",
    "publishedAt": "2026-02-01T06:00:00.000Z",
    "createdAt": "2026-01-30T10:12:00.000Z",
    "updatedAt": "2026-02-01T06:00:00.000Z"
  }
}
```
```json
// 404 — either it doesn't exist, or it's a draft and the caller isn't an admin
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Post not found." } }
```

`content` is raw Markdown — the frontend renders it (`marked`), same as the current Firebase-backed design. The API stays presentation-agnostic.

#### `POST /api/v1/blog/posts` — Admin

Request:
```json
{
  "title": "What Three Terms of Blended Learning Taught Me",
  "excerpt": "Notes from rolling out Moodle across five schools in Bungoma.",
  "content": "## It started with one laptop cart\n\nIn Term 1 we...",
  "coverImageUrl": "https://cdn.innovativestemhub.com/blog/cover-1729.jpg",
  "status": "draft"
}
```
`slug` is generated server-side from `title` (kebab-cased, deduplicated with a numeric suffix on collision) and returned in the response — it's never client-supplied. `coverImageUrl` optional. `status` defaults to `"draft"` if omitted.

```json
// 201
{ "success": true, "data": { "id": "f01a...", "slug": "what-three-terms-of-blended-learning-taught-me", "...": "full resource" } }
```

#### `PATCH /api/v1/blog/posts/:id` — Admin

Any subset of `title`, `excerpt`, `content`, `coverImageUrl`, `status`. Setting `status` to `"published"` for the first time stamps `publishedAt`; it isn't reset by later edits or by unpublishing/republishing.

```json
{ "status": "published" }
```
```json
// 200
{ "success": true, "data": { "id": "f01a...", "status": "published", "publishedAt": "2026-02-01T06:00:00.000Z", "...": "rest of resource" } }
```

#### `DELETE /api/v1/blog/posts/:id` — Admin

Cascades to that post's comments (see the Prisma `onDelete: Cascade` in §3).

```json
// 200
{ "success": true, "data": null }
```

---

### 6.8 Comments

#### `GET /api/v1/blog/posts/:slug/comments` — Public, cached, paginated

Approved only.

```json
// 200
{
  "success": true,
  "data": [
    {
      "id": "9d2c...",
      "name": "Grace W.",
      "body": "This mirrors what we saw in our own rollout — thank you for writing it up.",
      "createdAt": "2026-02-02T14:03:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

#### `POST /api/v1/blog/posts/:slug/comments` — Public (rate-limited, §4.2)

Request:
```json
{
  "name": "Grace W.",
  "body": "This mirrors what we saw in our own rollout — thank you for writing it up."
}
```
Validation: `name` 2–100 chars, `body` 3–2000 chars. The submitter's IP is hashed (never stored raw) for abuse pattern review, not exposed via any API response.

```json
// 201
{
  "success": true,
  "data": { "id": "9d2c...", "status": "pending" },
  "message": "Thanks — your comment is awaiting a quick review and will appear once approved."
}
```
`message` is a rare, deliberate exception to the plain envelope: a couple of write endpoints where the frontend wants user-facing copy without hardcoding it — kept optional and only ever additive to `data`.

```json
// 404
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Post not found." } }
```

#### `GET /api/v1/comments?status=pending` — Admin, paginated

Moderation queue across every post — joins the parent post's title/slug so the admin UI doesn't need a second round trip.

```
GET /api/v1/comments?status=pending&page=1&limit=20
Authorization: Bearer eyJ...
```
```json
// 200
{
  "success": true,
  "data": [
    {
      "id": "9d2c...",
      "name": "Grace W.",
      "body": "This mirrors what we saw in our own rollout — thank you for writing it up.",
      "status": "pending",
      "createdAt": "2026-02-02T14:03:00.000Z",
      "post": { "id": "f01a...", "title": "What Three Terms of Blended Learning Taught Me", "slug": "what-three-terms-of-blended-learning-taught-me" }
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

#### `PATCH /api/v1/comments/:id/approve` — Admin

```json
// 200
{ "success": true, "data": { "id": "9d2c...", "status": "approved" } }
```

#### `PATCH /api/v1/comments/:id/reject` — Admin

Marks it rejected (kept for the record) rather than deleting — useful for spotting repeat spam patterns later.

```json
// 200
{ "success": true, "data": { "id": "9d2c...", "status": "rejected" } }
```

#### `DELETE /api/v1/comments/:id` — Admin

Permanent removal, for when even keeping a rejected record isn't wanted.

```json
// 200
{ "success": true, "data": null }
```

---

### 6.9 Contact

#### `POST /api/v1/contact` — Public (rate-limited, §4.2)

Request:
```json
{
  "name": "James Otieno",
  "email": "james.otieno@example.com",
  "message": "I'd like to invite you to speak at our county STEM teachers' forum in March."
}
```
Validation: `name` 2–100 chars, `email` valid format, `message` 10–5000 chars.

The handler persists a `ContactMessage` row and sends the email to Dr. Mutende's inbox synchronously via Resend (typically well under a second) before responding; on provider failure it retries once, then still returns success to the sender (the message is safely in Postgres either way) while flagging `emailStatus: "failed"` internally for follow-up. This is the one place the plan intentionally keeps things simple rather than adding a queue — see §9 for when that trade-off should be revisited.

```json
// 202
{
  "success": true,
  "data": { "id": "3fa4...", "status": "sent" },
  "message": "Thanks for reaching out — I'll get back to you soon."
}
```
```json
// 429
{
  "success": false,
  "error": { "code": "RATE_LIMITED", "message": "Too many messages sent. Please try again later." }
}
```

---

## 7. Security

- **CORS**: explicit allowlist (`https://innovativestemhub.com`, `http://localhost:4200` in dev) with `credentials: true`. No wildcard origin — required anyway once cookies are involved.
- **Cookies**: refresh token is `HttpOnly`, `Secure`, `SameSite=Lax`, scoped to `Path=/api/v1/auth` — inaccessible to any frontend JavaScript (mitigates XSS token theft) and, being same-site (§2), doesn't need the weaker `SameSite=None`.
- **Passwords**: `argon2id` hashing (via `argon2` npm package), never `bcrypt` with a low cost factor and never reversible encryption.
- **Headers**: `helmet` defaults (HSTS, no-sniff, frame-deny, etc.).
- **Input validation**: every request body validated by a DTO before it reaches a handler; unknown fields stripped (`whitelist: true` in Nest's `ValidationPipe`), not silently accepted.
- **IP handling**: only ever stored hashed (comments) or not at all (contact); raw IPs appear solely in rate-limit Redis keys, which expire.
- **Secrets**: all via Render environment variables, never committed — see §8.2.

---

## 8. Deployment on Render

### 8.1 Services

| Service | Type | Notes |
|---|---|---|
| `stemhub-api` | Web Service (Node) | the NestJS app; auto-deploy on push to the backend repo's `main` |
| `stemhub-db` | Managed PostgreSQL | Render's own Postgres add-on |
| `stemhub-redis` | Managed Redis (or Upstash) | if Render's own Redis offering doesn't fit, Upstash's free tier is a drop-in `ioredis`-compatible alternative |

No background worker service in v1 — see §9 for when to add one.

### 8.2 Environment variables

```
NODE_ENV=production
PORT=3000

DATABASE_URL=postgresql://...
REDIS_URL=redis://...

JWT_ACCESS_SECRET=...
ACCESS_TOKEN_TTL_SECONDS=900
REFRESH_TOKEN_TTL_SECONDS=2592000

ADMIN_EMAIL=rmutende@kibu.ac.ke      # used only by the one-off seed script
ADMIN_PASSWORD=...                    # used only by the one-off seed script

RESEND_API_KEY=...
CONTACT_INBOX_EMAIL=rmutende@kibu.ac.ke

R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=innovativestemhub
R2_PUBLIC_BASE_URL=https://cdn.innovativestemhub.com

CORS_ORIGINS=https://innovativestemhub.com,http://localhost:4200
```

### 8.3 Custom domain

`api.innovativestemhub.com` as a CNAME to the Render service, alongside the existing apex/`gh-pages` CNAME for the frontend (see the frontend's own GitHub Pages deploy). Both live under the same registrable domain, which is what makes the §7 cookie setup work cleanly.

---

## 9. Phased rollout

**v1 (this plan, as written above)** covers every endpoint the frontend currently needs.

Things deliberately deferred, and the trigger for revisiting each:

- **Async email queue (BullMQ + a Render background worker)** — revisit if Resend's synchronous call ever meaningfully slows down `POST /contact`, or once "notify Dr. Mutende by email when a new comment needs review" is wanted (a natural second queue consumer once the first exists).
- **Search** over blog posts/research — revisit once there are enough posts that the plain list endpoints stop being sufficient (Postgres full-text search is the first stop, not a separate search service).
- **Multiple admin accounts / roles** — the `Admin` table and JWT structure both already generalize to this; nothing in §6 assumes a single row, it's just the only one seeded today.
- **Presigned uploads vs. proxied multipart** (§6.4) — start with whichever is faster to build; the response shape doesn't change either way, so switching later doesn't touch the frontend.

---

## 10. Suggested project structure

```
stemhub-api/
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── common/
│   │   ├── envelope.interceptor.ts     # wraps every response in { success, data, meta }
│   │   ├── http-exception.filter.ts    # wraps every error in { success:false, error }
│   │   ├── rate-limit.guard.ts
│   │   └── redis.module.ts
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── jwt-access.strategy.ts
│   │   └── dto/{login.dto.ts}
│   ├── site-settings/
│   ├── uploads/
│   ├── research/
│   ├── library/
│   ├── blog-posts/
│   ├── comments/
│   └── contact/
├── scripts/
│   └── seed-admin.ts
├── .env.example
└── package.json
```

Each resource folder follows the same `*.module.ts` / `*.controller.ts` / `*.service.ts` / `dto/` shape — Research and Library in particular are close to copy-paste of each other, which is fine at this size; if a third near-identical resource shows up later, that's the signal to factor out a shared generic module, not before.

---

## 11. What changes on the frontend (next step, not part of this plan)

Once this API exists, the Angular app's `core/firebase.ts`, `core/auth.ts`, and `core/content.ts` get replaced by a single `core/api.ts` built on `HttpClient` with `withCredentials: true` (for the refresh cookie), plus an access-token held in a service-level signal (never `localStorage` — kept in memory only, refreshed via `/auth/refresh` on page load). Every call site that currently does `await import('../../core/content')` swaps to the equivalent typed method on that client; the lazy-loading pattern itself doesn't change. `firestore.rules`, `storage.rules`, and `firestore.indexes.json` in this repo are deleted once the cutover is done — Postgres row-level access is enforced by the API, not by client-visible rules.
