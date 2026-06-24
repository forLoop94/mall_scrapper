# Promotions Aggregator MVP

> A vertical slice of a production retail promotions scraping pipeline, built to demonstrate end-to-end data engineering and full-stack development.

**Target Portal:** [The Promenade Shops at Briargate - Sales](https://www.thepromenadeshopsatbriargate.com/sales)

---

## 🚀 Quick Start

**Prerequisites:** Node.js 18+ (LTS recommended)

```bash
# Clone the repository
git clone git@github.com:forLoop94/mall_scrapper.git
cd mall_scrapper

# Install all dependencies (root + backend + frontend)
npm run install:all

# Generate Prisma client
npm run prisma:generate

# Start both servers
npm run dev
```

**That's it!** The application will start:

- **Backend API:** http://localhost:4000
- **Frontend UI:** http://localhost:3000

Open http://localhost:3000 in your browser to see the UI.

> **Note:** If you prefer to install manually, run:
>
> ```bash
> npm install
> cd backend && npm install && cd ..
> cd frontend && npm install && cd ..
> npm run prisma:generate
> npm run dev
> ```

---

## 📋 What This Does

This application:

1. **Scrapes** promotions from a shopping mall's website
2. **Enriches** each promotion with brand-level metadata (website, hours, social links)
3. **Stores** data in a SQLite database via Prisma ORM
4. **Exposes** a REST API with filtering, pagination, and search
5. **Renders** a responsive UI with group-by-brand view, filters, and pagination

---

## 🏗️ Architecture

### Stack

- **Backend:** Express.js (TypeScript) on port 4000
- **Frontend:** Next.js 14 App Router (TypeScript) on port 3000
- **Database:** SQLite + Prisma ORM
- **Scraper:** axios + cheerio (no headless browser required)
- **Shared Types:** TypeScript interfaces shared between frontend and backend

### Project Structure

```
mall_scrapper/
├── backend/                        # Express.js API server
│   ├── src/
│   │   ├── routes/                 # API endpoints
│   │   │   ├── promotions.ts       → GET /promotions, GET /promotions/:id
│   │   │   ├── brands.ts           → GET /brands
│   │   │   └── scrape.ts           → POST /scrape, GET /scrape/:jobId
│   │   ├── scraper/                # Scraping logic (axios + cheerio)
│   │   │   ├── index.ts            → Main scraper orchestration
│   │   │   ├── robotsCheck.ts      → robots.txt compliance
│   │   │   ├── scrapeBrands.ts     → Brand metadata extraction
│   │   │   ├── scrapePromotions.ts → Promotion detail extraction
│   │   │   └── utils.ts            → Shared utilities
│   │   ├── db/
│   │   │   └── client.ts           → Prisma client singleton
│   │   └── index.ts                → Express server entry point
│   ├── prisma/
│   │   ├── schema.prisma           → Database schema
│   │   ├── dev.db                  → SQLite database file
│   │   └── migrations/             → Prisma migrations
│   └── package.json
├── frontend/                       # Next.js 14 UI
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx            → Main promotions list page
│   │   │   ├── layout.tsx          → Root layout
│   │   │   └── globals.css         → Global styles
│   │   └── components/
│   │       ├── PromotionCard.tsx   → Individual promotion card
│   │       ├── BrandGroup.tsx      → Group-by-brand view
│   │       ├── Filters.tsx         → Search and filter controls
│   │       └── Pagination.tsx      → Page navigation
│   └── package.json
├── shared/
│   └── types/                      # Shared TypeScript types
│       ├── promotion.ts
│       ├── brand.ts
│       ├── scrape.ts
│       ├── api.ts
│       └── index.ts
├── package.json                    # Root: runs both apps via concurrently
├── DESIGN.md                       # Architectural decisions and trade-offs
└── README.md                       # This file
```

---

## 📖 Detailed Setup

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

# Return to root
cd ..
```

**Or use the convenience script:**

```bash
npm run install:all
```

### 2. Environment Variables

The repository includes `.env.example` files. Copy them to create your `.env` files:

**Backend (`backend/.env`):**

```env
DATABASE_URL="file:./prisma/dev.db"
PORT=4000
SCRAPER_DELAY_MS=1500
```

**Frontend (`frontend/.env`):**

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

> **Note:** These are the default values. The application should work out of the box without changes.

### 3. Database Setup

The database is already set up with migrations. If you need to reset or regenerate:

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Open Prisma Studio (database GUI)
cd backend && npx prisma studio
```

### 4. Run the Application

```bash
# Run both backend and frontend concurrently
npm run dev

# Or run them separately:
npm run dev:backend   # Backend only (port 4000)
npm run dev:frontend  # Frontend only (port 3000)
```

---

## 🔌 API Documentation

### Base URL

```
http://localhost:4000
```

### Endpoints

#### 1. **GET /promotions**

Retrieve paginated list of promotions with optional filters.

**Query Parameters:**

- `search` (string, optional) - Search in promotion name or description
- `brand` (string, optional) - Filter by brand name
- `startDate` (ISO 8601 date, optional) - Filter promotions starting after this date
- `endDate` (ISO 8601 date, optional) - Filter promotions ending before this date
- `page` (number, default: 1) - Page number
- `pageSize` (number, default: 20) - Items per page

**Example Request:**

```bash
curl "http://localhost:4000/promotions?search=sale&brand=Nike&page=1&pageSize=10"
```

**Example Response:**

```json
{
  "data": [
    {
      "id": "clx123abc",
      "stableId": "sha256hash",
      "name": "Summer Sale",
      "description": "Get 50% off all items",
      "imageUrl": "https://example.com/image.jpg",
      "startDate": "2026-06-01T00:00:00.000Z",
      "endDate": "2026-06-30T23:59:59.000Z",
      "sourceUrl": "https://thepromenadeshopsatbriargate.com/sales/summer-sale",
      "sourcePortal": "thepromenadeshopsatbriargate.com",
      "scrapedAt": "2026-06-23T12:00:00.000Z",
      "brandId": "clx456def",
      "brand": {
        "id": "clx456def",
        "name": "Nike",
        "websiteUrl": "https://www.nike.com",
        "hours": "{\"Mon-Sat\":\"10am-9pm\",\"Sun\":\"11am-6pm\"}",
        "socialLinks": "{\"instagram\":\"https://instagram.com/nike\"}",
        "sourceUrl": "https://thepromenadeshopsatbriargate.com/stores/nike"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

#### 2. **GET /promotions/:id**

Retrieve a single promotion by ID.

**Example Request:**

```bash
curl "http://localhost:4000/promotions/clx123abc"
```

**Example Response:**

```json
{
  "data": {
    "id": "clx123abc",
    "name": "Summer Sale",
    "description": "Get 50% off all items",
    "imageUrl": "https://example.com/image.jpg",
    "startDate": "2026-06-01T00:00:00.000Z",
    "endDate": "2026-06-30T23:59:59.000Z",
    "sourceUrl": "https://thepromenadeshopsatbriargate.com/sales/summer-sale",
    "brand": {
      "id": "clx456def",
      "name": "Nike",
      "websiteUrl": "https://www.nike.com"
    }
  }
}
```

#### 3. **GET /brands**

Retrieve all brands with promotion counts.

**Example Request:**

```bash
curl "http://localhost:4000/brands"
```

**Example Response:**

```json
{
  "data": [
    {
      "id": "clx456def",
      "name": "Nike",
      "websiteUrl": "https://www.nike.com",
      "hours": "{\"Mon-Sat\":\"10am-9pm\",\"Sun\":\"11am-6pm\"}",
      "socialLinks": "{\"instagram\":\"https://instagram.com/nike\"}",
      "sourceUrl": "https://thepromenadeshopsatbriargate.com/stores/nike",
      "promotionCount": 3
    }
  ]
}
```

#### 4. **POST /scrape**

Trigger an asynchronous scrape job.

**Example Request:**

```bash
curl -X POST "http://localhost:4000/scrape"
```

**Example Response (HTTP 202 Accepted):**

```json
{
  "jobId": "clx789ghi"
}
```

#### 5. **GET /scrape/:jobId**

Poll the status of a scrape job.

**Example Request:**

```bash
curl "http://localhost:4000/scrape/clx789ghi"
```

**Example Response (Running):**

```json
{
  "id": "clx789ghi",
  "status": "running",
  "startedAt": "2026-06-23T12:00:00.000Z",
  "completedAt": null,
  "summary": null,
  "errorMessage": null
}
```

**Example Response (Completed):**

```json
{
  "id": "clx789ghi",
  "status": "done",
  "startedAt": "2026-06-23T12:00:00.000Z",
  "completedAt": "2026-06-23T12:05:30.000Z",
  "summary": {
    "recordsFound": 42,
    "recordsEnriched": 40,
    "recordsFailed": 2
  },
  "errorMessage": null
}
```

---

## 🎯 Usage Guide

### 1. Trigger a Scrape

**Via API:**

```bash
curl -X POST http://localhost:4000/scrape
```

**Via Frontend:**

- Open http://localhost:3000
- Click the "Trigger Scrape" button (if implemented in UI)

### 2. Check Scrape Status

```bash
# Replace <jobId> with the ID returned from POST /scrape
curl http://localhost:4000/scrape/<jobId>
```

### 3. View Promotions

**Via Frontend:**

- Open http://localhost:3000
- Use filters to search by brand, date range, or keywords
- Toggle between list view and group-by-brand view
- Navigate pages using pagination controls

**Via API:**

```bash
# Get all promotions
curl http://localhost:4000/promotions

# Search for "sale"
curl "http://localhost:4000/promotions?search=sale"

# Filter by brand
curl "http://localhost:4000/promotions?brand=Nike"

# Filter by date range
curl "http://localhost:4000/promotions?startDate=2026-06-01&endDate=2026-06-30"
```

---

## 🛠️ Development

### Useful Commands

```bash
# Run both servers
npm run dev

# Run backend only
npm run dev:backend

# Run frontend only
npm run dev:frontend

# Build for production
npm run build

# Prisma commands
cd backend
npx prisma studio          # Open database GUI
npx prisma migrate dev     # Create new migration
npx prisma generate        # Regenerate Prisma client
npx prisma db push         # Push schema changes without migration
```

### Environment Variables Reference

**Backend (`backend/.env`):**

- `DATABASE_URL` - SQLite database file path (default: `file:./prisma/dev.db`)
- `PORT` - Backend server port (default: `4000`)
- `SCRAPER_DELAY_MS` - Delay between scraper requests in milliseconds (default: `1500`)

**Frontend (`frontend/.env`):**

- `NEXT_PUBLIC_API_URL` - Backend API base URL (default: `http://localhost:4000`)

---

## 🐛 Troubleshooting

### Port Already in Use

If you see `EADDRINUSE` errors:

**Backend (port 4000):**

```bash
# Windows
netstat -ano | findstr :4000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:4000 | xargs kill -9
```

**Frontend (port 3000):**

```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:3000 | xargs kill -9
```

### Database Issues

**Reset the database:**

```bash
cd backend
rm prisma/dev.db
npx prisma migrate reset
npx prisma generate
```

### Scraper Fails

**Check robots.txt compliance:**
The scraper checks robots.txt before scraping. If the target site disallows scraping, the job will fail with an error message.

**Increase delay between requests:**

```bash
# In backend/.env
SCRAPER_DELAY_MS=3000  # Increase to 3 seconds
```

### Frontend Can't Connect to Backend

**Verify backend is running:**

```bash
curl http://localhost:4000/promotions
```

**Check frontend environment variable:**

```bash
# In frontend/.env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## 📚 Additional Documentation

- **[DESIGN.md](./DESIGN.md)** - Detailed architectural decisions, trade-offs, and design rationale
- **[ASSUMPTIONS.md](./ASSUMPTIONS.md)** - Assumptions made during development and PRD interpretations
- **[takehome-brief.pdf](./takehome-brief.pdf)** - Original project requirements

---

## 🏛️ Design Principles

This project was built with the following principles:

1. **Reviewer Experience First** - One command to run, zero configuration required
2. **Working Software > Sophistication** - Pragmatic choices that prioritize functionality
3. **Honest Trade-offs** - Every decision documented with clear reasoning
4. **Politeness** - Respects robots.txt, rate limits, and sequential scraping
5. **Type Safety** - Meaningful TypeScript types throughout, no `any` abuse

---

## 📝 Key Features

✅ **Async Job Tracking** - Scrape jobs run in background, queryable via API  
✅ **Deduplication** - Stable IDs prevent duplicate promotions on re-scrape  
✅ **Normalized Schema** - Brands stored separately, shared across promotions  
✅ **Politeness** - 1.5s delay between requests, robots.txt compliance  
✅ **Partial Failure Handling** - Individual record failures don't crash the job  
✅ **Responsive UI** - Works on mobile, tablet, and desktop  
✅ **Group-by-Brand View** - See all promotions organized by brand  
✅ **Advanced Filtering** - Search, date range, brand filters with pagination

---

## 🚧 Known Limitations (MVP Scope)

- **No authentication** - API is open, no user management
- **No rate limiting** - API endpoints are unprotected
- **No tests** - Time constraint; would add Vitest for unit/integration tests
- **SQLite concurrency** - Limited concurrent write support (fine for MVP)
- **No detail page UI** - Promotions list only (PRD marked as bonus)

See [DESIGN.md](./DESIGN.md) for full list of intentional cuts and future enhancements.

---

## 📄 License

ISC

---

## 🙏 Acknowledgments

Built as a take-home assessment to demonstrate:

- Full-stack TypeScript development
- Web scraping with politeness and ethics
- REST API design
- Database modeling with Prisma
- Modern React/Next.js patterns
- Clear technical communication

**Target Site:** [The Promenade Shops at Briargate](https://www.thepromenadeshopsatbriargate.com/sales)
