# Claude.md — AI Assistant Context & Project Overview

> This file provides context for AI assistants (Claude, Cursor, Copilot, etc.) working on the Promotions Aggregator MVP.
> Last updated: 2026-06-23

---

## Project Summary

**Promotions Aggregator (Single-Mall MVP)** — A vertical slice of a production retail promotions scraping pipeline, scoped for 6–8 hour delivery.

**Core Function:**

- Scrapes promotions from https://www.thepromenadeshopsatbriargate.com/sales
- Enriches each promotion with brand-level metadata (website, hours, social links)
- Persists data in SQLite via Prisma ORM
- Exposes typed REST API endpoints
- Renders a filterable, paginated UI with group-by-brand view

---

## Architecture Overview

### Stack

- **Backend:** Express.js (TypeScript) on port 4000
- **Frontend:** Next.js 14 App Router (TypeScript) on port 3000
- **Database:** SQLite + Prisma ORM
- **Scraper:** axios + cheerio (no headless browser)
- **Shared Types:** `shared/types/` directory imported by both frontend and backend

### File Structure (from DESIGN.md)

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

---

## Key Design Decisions (from DESIGN.md)

### 1. Separate Express Backend + Next.js Frontend

- **Why:** PRD offers bonus points for this architecture; cleaner separation of concerns
- **One-command startup:** `npm install && npm run dev` (via `concurrently` in root package.json)

### 2. SQLite + Prisma (not PostgreSQL)

- **Why:** Zero reviewer setup friction; no Docker required; sufficient for MVP scale
- **Trade-off:** Limited concurrent write support (acceptable for single sequential scraper)

### 3. axios + cheerio (not Playwright/Puppeteer)

- **Why:** Site is "mildly picky" about headers/redirects, NOT JS-rendered; avoids 300MB+ Chromium download
- **Politeness:** Sequential requests, 1500ms delay between pages, 15s timeout, robots.txt check

### 4. Normalized Brand Schema

- **Why:** Brand metadata shared across many promotions; `GET /brands` is first-class endpoint
- **Deduplication:** `stableId = sha256(sourceUrl)` for promotions; Prisma `upsert` on re-scrape

### 5. Async Job Tracking in SQLite (not in-memory)

- **Why:** Survives server restarts; zero extra cost since SQLite already present
- **Flow:** `POST /scrape` → HTTP 202 + jobId → scraper runs async → `GET /scrape/:jobId` polls status

---

## Data Models (Prisma Schema)

### Brand

```prisma
model Brand {
  id          String      @id @default(cuid())
  name        String      @unique
  websiteUrl  String?
  hours       String?     // JSON string
  socialLinks String?     // JSON string
  sourceUrl   String?
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  promotions  Promotion[]
}
```

### Promotion

```prisma
model Promotion {
  id           String    @id @default(cuid())
  stableId     String    @unique   // sha256(sourceUrl)
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
```

### ScrapeJob

```prisma
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

---

## API Endpoints (Functional Requirements)

| Endpoint          | Method | Description                                                                                |
| ----------------- | ------ | ------------------------------------------------------------------------------------------ |
| `/promotions`     | GET    | Paginated list with filters: `search`, `startDate`, `endDate`, `brand`, `page`, `pageSize` |
| `/promotions/:id` | GET    | Single promotion by ID                                                                     |
| `/brands`         | GET    | List of brands with `{ name, promotionCount, ...metadata }`                                |
| `/scrape`         | POST   | Trigger async scrape → returns `{ jobId }` with HTTP 202                                   |
| `/scrape/:jobId`  | GET    | Poll scrape job status + summary                                                           |

---

## Scraping Flow (Three Passes)

1. **Pass 1 — Promotions Listing**
   - GET `/sales` page
   - Extract: name, imageUrl, sourceUrl, brandName (partial)

2. **Pass 2 — Promotion Detail Enrichment**
   - For each sourceUrl, GET detail page
   - Extract: description, startDate, endDate, brand directory link

3. **Pass 3 — Brand Enrichment (deduplicated)**
   - Collect unique brand URLs from Pass 2
   - One request per unique brand
   - Extract: websiteUrl, hours, socialLinks

**Politeness:**

- Sequential processing (concurrency = 1)
- 1500ms delay between requests (configurable via `SCRAPER_DELAY_MS`)
- 15s timeout per page
- robots.txt check before first scrape

---

## Missing Data Strategy

**Rule:** All optional fields are `null`, never `undefined` or `""`.

- `null` = "this field was not present on the source page"
- Every nullable field appears in API responses
- TypeScript: optional values typed as `string | null`, forcing explicit null-handling

---

## Shared Types Location

All TypeScript interfaces live in `shared/types/`:

- `promotion.ts` → Promotion, PromotionListItem, PromotionsResponse
- `brand.ts` → Brand, BrandWithPromotions, BrandsResponse
- `scrape.ts` → ScrapeJob, ScrapeJobStatus, ScrapeJobSummary
- `api.ts` → PaginatedResponse<T>, ApiError

Both backend and frontend import via relative paths: `../../shared/types/*`

---

## What Was Cut (Time Constraints)

| Feature                | Reason                             | Would Add With More Time        |
| ---------------------- | ---------------------------------- | ------------------------------- |
| Docker/docker-compose  | SQLite removes need; adds friction | Add when switching to Postgres  |
| Unit/integration tests | 6–8 hour time limit                | Vitest for scraper + routes     |
| Detail page UI         | PRD marks as bonus only            | `/promotions/[id]` Next.js page |
| Playwright scraping    | 300MB install; overkill            | Only if axios+cheerio fails     |

---

## Anticipated Failure Modes

| Failure                  | Recovery                                  |
| ------------------------ | ----------------------------------------- |
| Listing page unreachable | Job → `'failed'`, existing DB untouched   |
| Detail page 404/timeout  | Record skipped, `recordsFailed++`, logged |
| Missing social links     | `socialLinks = null`                      |
| No end date              | `endDate = null`                          |
| Re-scrape duplicate      | Prisma `upsert` by `stableId`             |
| HTML structure changes   | Null-fill, log warning, don't crash       |

---

## Development Commands

```bash
# Install all dependencies (root + backend + frontend)
npm install

# Run both servers concurrently
npm run dev

# Backend only (port 4000)
cd backend && npm run dev

# Frontend only (port 3000)
cd frontend && npm run dev

# Prisma migrations
cd backend && npx prisma migrate dev

# Prisma Studio (DB GUI)
cd backend && npx prisma studio
```

---

## Environment Variables

See `.env.example` at repo root. Key vars:

- `DATABASE_URL` — SQLite file path (default: `file:./dev.db`)
- `SCRAPER_DELAY_MS` — Delay between requests (default: `1500`)
- `PORT` — Backend port (default: `4000`)
- `NEXT_PUBLIC_API_URL` — Frontend API base URL (default: `http://localhost:4000`)

---

## Acceptance Criteria Checklist

- [ ] `git clone && <one or two commands>` brings up the full stack
- [ ] Brand-level fields populated where source provides them
- [ ] All records conform to schema; missing data handled consistently
- [ ] All FR-\* endpoints exist and return schema-compliant responses
- [ ] `POST /scrape` returns promptly (HTTP 202); job status queryable
- [ ] UI renders, supports group-by-brand, filters, and paginates
- [ ] README.md, DESIGN.md, ASSUMPTIONS.md all exist and are useful

---

## PRD Context

**Target Portal:** https://www.thepromenadeshopsatbriargate.com/sales

**Evaluation Criteria:**

1. Working software (does it run from README?)
2. TypeScript hygiene (meaningful types, not `any`)
3. Decisions and trade-offs (visible in DESIGN.md and code)
4. Communication (ASSUMPTIONS.md quality, README clarity)
5. Iteration honesty (commit history shows work, not one squashed commit)

---

## Notes for AI Assistants

- **Guiding Principle:** Working software > architectural sophistication. The reviewer's ability to `git clone` → run → see working app is paramount.
- **No `any` types:** Use explicit types; if unavoidable, document why in code comments.
- **Commit often:** Show iteration, failed attempts, refactors — don't squash.
- **Document ambiguities:** If PRD is unclear, document interpretation in ASSUMPTIONS.md.
- **Politeness matters:** Scraper must respect rate limits and robots.txt.
- **Partial failure is OK:** Log errors, skip records, don't crash the job.

---

## Quick Reference: Tech Stack Versions

- **Node.js:** 18+ (LTS)
- **TypeScript:** 5.x
- **Express:** 4.x
- **Next.js:** 14.x (App Router)
- **Prisma:** 5.x
- **axios:** 1.x
- **cheerio:** 1.x

---

## Useful Links

- [PRD: takehome-brief.pdf](../takehome-brief.pdf)
- [Design Doc: DESIGN.md](../DESIGN.md)
- [Target Site: Promenade Shops Sales](https://www.thepromenadeshopsatbriargate.com/sales)

---

**End of Claude.md**
