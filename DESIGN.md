# DESIGN.md — Promotions Aggregator (Single-Mall MVP)

> Written before implementation and committed first, per the PRD requirement.
> Every decision here is filtered through one question: **does this help ship a working system in 6–8 hours?**

---

## 0. Guiding Principle

This is an MVP. The reviewer's ability to `git clone` → run one command → see a working app is the **single most important acceptance criterion**. Architectural sophistication that jeopardizes that outcome is a liability, not an asset. Every decision below optimises for: working software, reviewer experience, and honest trade-off documentation.

---

## 1. Stack Choice — Next.js Frontend + Express Backend

**Decision:** Separate Express.js backend (port 4000) and Next.js 14 (App Router) frontend (port 3000), both in TypeScript, run together from the repo root via `concurrently`.

```
mall_scrapper/
├── backend/                        # Express.js API server
│   ├── src/
│   │   ├── routes/
│   │   │   ├── promotions.ts       → GET /promotions, GET /promotions/:id
│   │   │   ├── brands.ts           → GET /brands
│   │   │   └── scrape.ts           → POST /scrape, GET /scrape/:jobId
│   │   ├── scraper/                → axios + cheerio scraping logic
│   │   ├── db/                     → Prisma client + helpers
│   │   ├── jobs/                   → In-process job state manager
│   │   └── index.ts
│   ├── prisma/
│   │   └── schema.prisma
│   └── package.json
├── frontend/                       # Next.js 14 UI
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            → Promotions list
│   │   │   └── layout.tsx
│   │   └── components/             → PromotionCard, BrandGroup, Filters, etc.
│   └── package.json
├── shared/
│   └── types/                      → Single source-of-truth TypeScript types
│       ├── promotion.ts
│       ├── brand.ts
│       ├── scrape.ts
│       └── api.ts
├── .env.example
├── package.json                    → Root: runs both apps via concurrently
└── README.md
```

**Why Next.js + Express (Option B) over a single Next.js app:**

- The PRD explicitly offers **bonus points** for "Next.js (frontend) + separate Express server (backend)"
- A dedicated Express server is a cleaner separation of concerns: the API layer is completely independent of the rendering layer, which mirrors how the PRD describes the data engineer and account manager personas touching different parts of the system
- Express route handlers are simpler to test and reason about in isolation than Next.js Route Handlers

**Why not a workspace monorepo (Turborepo / nx):**

- Workspace monorepos add `npm install` complexity, workspace linking, and build orchestration that can silently break on a clean machine
- `concurrently` in a root `package.json` achieves the same one-command startup with zero overhead
- The shared types are resolved via a simple relative import path — no build step, no symlinks

**The one-command rule is preserved:**

```bash
npm install && npm run dev
```

The root `package.json` installs all workspaces and starts both servers concurrently.

---

## 2. Database — SQLite + Prisma (in the backend)

**Decision:** SQLite (file-based) accessed via Prisma ORM, located inside `backend/`.

**Why SQLite over PostgreSQL:**

| Concern              | SQLite                                  | PostgreSQL                                   |
| -------------------- | --------------------------------------- | -------------------------------------------- |
| Reviewer setup       | Zero — it's just a file                 | Requires a running Postgres server or Docker |
| The one-command rule | ✅ Preserved                            | ❌ Requires a separate `docker-compose up`   |
| Docker dependency    | None                                    | Required for clean-machine portability       |
| Prisma support       | First-class                             | First-class                                  |
| MVP data scale       | More than sufficient                    | Overkill                                     |
| Migration path       | `prisma migrate` → swap provider string | Trivial Prisma config change                 |

**Trade-off accepted:** SQLite does not support concurrent writes well. For an async scrape job running alongside API reads, this is fine — the scraper is a single sequential writer and read queries don't block. In a production system this would be Postgres.

---

## 3. Scraping — axios + cheerio

**Decision:** `axios` for HTTP requests + `cheerio` for HTML parsing.

**Why not Playwright / Puppeteer:**

- The PRD states the site is _"mildly picky about HTTP clients (redirects, headers)"_ — **not** that it uses fingerprinting, JavaScript-rendered content, or requires a real browser
- Playwright downloads a 300 MB+ Chromium binary at install time — this directly threatens the reviewer experience on a clean machine
- The PRD explicitly says we are NOT trying to defeat advanced anti-bot

**Why axios + cheerio is sufficient:**
The site's "pickiness" is header and redirect sensitivity — fully solvable with proper `axios` configuration:

```typescript
const client = axios.create({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
  },
  maxRedirects: 5,
  timeout: 15000,
});
```

If this proves insufficient during build (e.g., JS-rendered content that cheerio cannot parse), the fallback decision will be documented in `ASSUMPTIONS.md`.

### Scraping Flow — Three Passes

```
Pass 1 — Promotions listing page
  GET https://www.thepromenadeshopsatbriargate.com/sales
  → Extract: promo card elements → { name, imageUrl, sourceUrl, brandName (partial) }

Pass 2 — Promotion detail enrichment
  For each sourceUrl from Pass 1, GET the detail page
  → Extract: full description, startDate, endDate, brand name (confirmed), brand directory link

Pass 3 — Brand enrichment (deduplicated)
  Collect unique brand directory URLs from Pass 2
  One request per unique brand (not one per promotion)
  → Extract: websiteUrl, hours, socialLinks { instagram, facebook, tiktok, x, ... }
```

### Politeness Strategy

- **Sequential processing:** All pages scraped one at a time (concurrency = 1)
- **Delay between requests:** 1,500 ms minimum between navigations (configurable via `SCRAPER_DELAY_MS` env var, default `1500`)
- **Timeout per page:** 15s hard cap; timed-out records are logged and skipped
- **robots.txt:** Checked before first scrape; if the target path is disallowed, the job fails with a clear error

---

## 4. Schema Design

### Decision: Normalized Brands

Brands are a **separate Prisma model** with a one-to-many relationship to promotions.

**Why:**

- Brand metadata (hours, website, social links) is scraped once per brand, shared across many promotions
- `GET /brands` is a first-class API endpoint — a brands table makes it a simple Prisma `findMany`
- Denormalising would repeat `hours` and `socialLinks` JSON blobs across every promotion row — wasteful and inconsistent to update

**Trade-off:** Queries that join promotion + brand data use Prisma `include`. At MVP scale this is costless.

### Prisma Schema (condensed)

```prisma
model Brand {
  id          String      @id @default(cuid())
  name        String      @unique
  websiteUrl  String?
  hours       String?     // JSON string: e.g. { "Mon-Sat": "10am-9pm", "Sun": "11am-6pm" }
  socialLinks String?     // JSON string: e.g. { "instagram": "url", "facebook": "url" }
  sourceUrl   String?     // Brand's directory page on the mall site
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  promotions  Promotion[]
}

model Promotion {
  id           String    @id @default(cuid())
  stableId     String    @unique   // sha256(sourceUrl) — dedup key
  name         String
  description  String?
  imageUrl     String?
  startDate    DateTime?
  endDate      DateTime?
  sourceUrl    String
  sourcePortal String    @default("thepromenadeshopsatbriargate.com")
  scrapedAt    DateTime
  brandId      String
  brand        Brand     @relation(fields: [brandId], references: [id])
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
}

model ScrapeJob {
  id               String    @id @default(cuid())
  status           String    // 'pending' | 'running' | 'done' | 'failed'
  startedAt        DateTime?
  completedAt      DateTime?
  recordsFound     Int?
  recordsEnriched  Int?
  recordsFailed    Int?
  errorMessage     String?
  createdAt        DateTime  @default(now())
}
```

### Stable Identifier / Deduplication

`stableId = sha256(sourceUrl)` — a hex digest of the promotion's canonical URL.

- Deterministic: same URL always produces the same ID
- On re-scrape: Prisma `upsert` by `stableId` → updates fields, preserves `id` and `createdAt`
- No coordination needed; survives server restarts

### Missing Data Strategy

**Rule:** All optional fields are `null`, never `undefined` or `""`.

- `null` = "this field was not present on the source page"
- `null` (not `[]`) for absent social links — the scraper returns `null` for a missing socials block
- Every nullable field appears in API responses — consumers always encounter the key, never an absent property
- TypeScript: optional scraped values are typed `string | null`, not `string | undefined`, forcing explicit null-handling at call sites

---

## 5. Async Job Tracking

**Decision:** Job state stored in the **SQLite `ScrapeJob` table** (not in-memory).

**Why not in-memory:**

- An in-memory `Map<jobId, status>` is lost on any server restart (including `nodemon` hot-reloads during development)
- SQLite is already present — zero extra cost to persist jobs there

**Flow:**

1. `POST /scrape` → inserts `ScrapeJob { status: 'pending' }`, returns `{ jobId }` with HTTP 202 immediately
2. Express server kicks off the scraper as an unawaited async function (no child process — the Express process handles sequential scraping without blocking the event loop for API reads)
3. Scraper updates the row: `'running'` on start, `'done'` or `'failed'` on finish, with `recordsFound`, `recordsEnriched`, `recordsFailed` counts
4. `GET /scrape/:jobId` → reads the row and returns current state

**Partial failure handling:** Individual record failures increment `recordsFailed` and are logged to stderr. The job only moves to `'failed'` if the listing page itself is unreachable. Partial data is always committed.

---

## 6. Shared Types

A root `shared/types/` directory exports TypeScript interfaces imported by both the Express backend and the Next.js frontend — one source of truth, zero build tooling overhead.

```
shared/types/
  promotion.ts    → Promotion, PromotionListItem, PromotionsResponse
  brand.ts        → Brand, BrandWithPromotions, BrandsResponse
  scrape.ts       → ScrapeJob, ScrapeJobStatus, ScrapeJobSummary
  api.ts          → PaginatedResponse<T>, ApiError
```

Both `backend/src/**` and `frontend/src/**` import from `../../shared/types/*` via relative paths (or via `tsconfig.json` path aliases). No build step or symlink required.

---

## 7. API Response Shape (Key Endpoints)

```ts
// GET /promotions?search=&brand=&startDate=&endDate=&page=1&pageSize=20
{
  data: Promotion[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

// GET /promotions/:id
{ data: Promotion }

// GET /brands
{ data: BrandWithPromotions[] }  // includes promotionCount

// POST /scrape → HTTP 202
{ jobId: string }

// GET /scrape/:jobId
{
  id: string;
  status: 'pending' | 'running' | 'done' | 'failed';
  startedAt: string | null;
  completedAt: string | null;
  summary: { recordsFound: number; recordsEnriched: number; recordsFailed: number } | null;
  errorMessage: string | null;
}
```

---

## 8. What Was Cut and Why

| Feature                        | Cut? | Reason                                            | What I'd add with more time                 |
| ------------------------------ | ---- | ------------------------------------------------- | ------------------------------------------- |
| Docker / docker-compose        | Yes  | SQLite removes the need; adds reviewer friction   | Add when switching to Postgres              |
| Unit / integration tests       | Yes  | Time constraint (6–8 hrs)                         | Vitest for scraper parsers + route handlers |
| Detail page click-through (UI) | Yes  | PRD marks it as bonus only                        | `/promotions/[id]` Next.js page             |
| Playwright for scraping        | Yes  | 300 MB install; overkill for this site            | Only if axios+cheerio proves insufficient   |
| Cursor-based pagination        | No   | Page-number pagination used (simpler, sufficient) | Cursor for large datasets                   |
| Rate limit on API              | Yes  | Not required locally                              | `express-rate-limit` middleware             |

---

## 9. Anticipated Failure Modes

| Failure                                          | Detection                                    | Recovery                                                     |
| ------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------ |
| Listing page unreachable                         | `axios` throws network/HTTP error            | Job → `'failed'`, error logged, existing DB data untouched   |
| Detail page 404 / timeout                        | Caught per-record in try/catch               | Record skipped, `recordsFailed++`, logged to stderr          |
| Brand directory page missing social links        | DOM element absent                           | `socialLinks = null` — documented in ASSUMPTIONS.md          |
| Promo has no end date                            | Date element absent                          | `endDate = null`                                             |
| Re-scrape creates duplicate                      | `stableId` already in DB                     | Prisma `upsert` — updates fields, no new row created         |
| Site HTML structure changes                      | Cheerio selectors return empty string / null | Scraper logs a warning per field, null-fills, does not crash |
| SQLite write during concurrent scrape + API read | SQLite serialises writes                     | Reads proceed; scraper writes queue naturally                |
