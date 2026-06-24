# ASSUMPTIONS.md — Promotions Aggregator MVP

> This document records assumptions, interpretations, implementation challenges, and decisions made during development where the PRD was ambiguous or required judgment calls.

**Last Updated:** 2026-06-24

---

## 1. Implementation Challenges & Solutions

### 1.1 Image Extraction Bug — All Promotions Showing Same Image

**Challenge:**
During initial testing, all promotions displayed the same image despite having unique data for other fields.

**Root Cause:**
The scraper was attempting to extract images from promotion detail pages using selectors like `div.deal-detail-image img`. However, the detail pages either:

- Had inconsistent image placement
- Used different selectors than expected
- Or didn't include the primary promotion image at all

**Investigation:**
Examined the HTML structure of `sales_page.html` and discovered that each `div.deal-row` on the listing page already contained a unique image:

```html
<div class="deal-row">
  <div class="deal-image">
    <img src="https://cdn-files.eu.placewise.com/f/..." alt="..." />
  </div>
</div>
```

**Solution:**
Refactored `backend/src/scraper/scrapePromotions.ts` to:

1. Extract image URLs from the listing page during Pass 1 (alongside promotion links)
2. Store both `url` and `imageUrl` in the `promotionLinks` array
3. Use the listing page image instead of attempting to extract from detail pages

**Code Change:**

```typescript
// Before: Only extracted URLs
const promotionLinks: string[] = [];

// After: Extract both URL and image
const promotionLinks: Array<{ url: string; imageUrl: string | null }> = [];
$("div.deal-row").each((_, element) => {
  const $row = $(element);
  const href = $row.find("a[href^='/deals/']").attr("href");
  const imageUrl = $row.find("div.deal-image img").attr("src") || null;
  // ...
});
```

**Impact:**

- Each promotion now displays its correct, unique image
- Scraper is more reliable (listing page is more stable than detail pages)
- Reduced HTTP requests (no need to extract images from detail pages)

---

### 1.2 Frontend State Race Condition — Search Filter Breaking App

**Challenge:**
When users typed in the search filter, the application crashed with:

```
TypeError: Cannot read properties of undefined (reading 'page')
```

**Root Cause:**
The `handleFilterChange` function was using non-functional state updates:

```typescript
setPagination({ ...pagination, page: 1 });
```

This caused a race condition where:

1. `pagination` state might be in an intermediate/stale state
2. The spread operator `{ ...pagination }` could reference undefined values
3. The `useEffect` dependency on `pagination.page` would then fail

**Investigation:**

- Checked backend logs: API was returning 500 errors
- Examined frontend console: State update timing issue
- Reviewed React best practices: Functional updates prevent stale closures

**Solution:**

1. **Separated useEffect hooks:**

```typescript
// Before: Fetched brands on every filter/page change
useEffect(() => {
  fetchPromotions();
  fetchBrands();
}, [filters, pagination.page]);

// After: Fetch brands only once on mount
useEffect(() => {
  fetchBrands();
}, []);

useEffect(() => {
  fetchPromotions();
}, [filters, pagination.page]);
```

2. **Used functional state updates:**

```typescript
// Before: Direct state reference
setPagination({ ...pagination, page: 1 });

// After: Functional update
setPagination((prev) => ({ ...prev, page: 1 }));
```

3. **Added safety checks:**

```typescript
page: (pagination?.page || 1).toString(),
pageSize: (pagination?.pageSize || 20).toString(),
```

**Impact:**

- Search filter now works reliably
- No more race conditions
- Brands are only fetched once (performance improvement)
- More defensive code that handles edge cases

---

### 1.3 Next.js Image Configuration — CDN Hostname Not Whitelisted

**Challenge:**
After fixing the image extraction bug, images still wouldn't display. Next.js threw:

```
Error: Invalid src prop (...cdn-files.eu.placewise.com...) on `next/image`,
hostname "cdn-files.eu.placewise.com" is not configured under images in your `next.config.js`
```

**Root Cause:**
Next.js requires explicit whitelisting of external image domains for security. The `next.config.js` only included:

```javascript
remotePatterns: [
  {
    protocol: "https",
    hostname: "www.thepromenadeshopsatbriargate.com",
  },
];
```

But images were actually hosted on `cdn-files.eu.placewise.com` (a CDN).

**Solution:**
Added the CDN hostname to `frontend/next.config.js`:

```javascript
remotePatterns: [
  {
    protocol: "https",
    hostname: "www.thepromenadeshopsatbriargate.com",
  },
  {
    protocol: "https",
    hostname: "cdn-files.eu.placewise.com", // Added this
  },
];
```

**Impact:**

- Images now display correctly
- Next.js Image component can optimize CDN images
- Simple fix but critical for user experience

---

## 2. Key Design Decisions

### 2.1 Scraper Architecture — Three-Pass Enrichment

**Decision:** Scrape in three sequential passes: listing → detail → brand

**Rationale:**

- **Pass 1 (Listing):** Get all promotion links and images in one request
- **Pass 2 (Detail):** Enrich each promotion with description, dates, brand link
- **Pass 3 (Brand):** Deduplicate brand URLs and scrape metadata once per brand

**Why not scrape everything from listing page?**

- Listing page only shows partial data (title, image, brand name)
- Detail pages have full descriptions, dates, and brand directory links
- Brand pages have hours, website, social links

**Why not scrape everything from detail pages?**

- Detail pages don't have brand metadata (hours, social links)
- Would require visiting brand pages anyway
- Listing page images are more reliable

**Trade-off:**

- More HTTP requests (listing + N details + M brands)
- But: More complete data, better deduplication, more maintainable

---

### 2.2 Deduplication Strategy — SHA-256 Hash of Source URL

**Decision:** Use `stableId = sha256(sourceUrl)` as the unique identifier for promotions.

**Rationale:**

- **Deterministic:** Same URL always produces same hash
- **Collision-resistant:** SHA-256 is cryptographically secure
- **URL-based:** Source URL is the canonical identifier for a promotion
- **Re-scrape friendly:** Prisma `upsert` by `stableId` updates existing records

**Why not use auto-increment ID?**

- Auto-increment IDs change on re-scrape (creates duplicates)
- Can't detect if a promotion already exists

**Why not use promotion name?**

- Names can change (e.g., "Summer Sale" → "Summer Sale 2026")
- Names might not be unique across brands

**Implementation:**

```typescript
const stableId = createHash("sha256").update(promoData.sourceUrl).digest("hex");

await prisma.promotion.upsert({
  where: { stableId },
  update: {
    /* fresh data */
  },
  create: {
    /* new promotion */
  },
});
```

**Impact:**

- No duplicates on re-scrape
- Existing promotions get updated with fresh data
- `createdAt` preserved, `updatedAt` refreshed
- `scrapedAt` shows last fetch time

---

### 2.3 UI Scrape Trigger — Simple Button vs Admin Panel

**Decision:** Implement a simple "Trigger Scrape" button in the main UI (Option 1) rather than a dedicated admin panel (Option 2).

**Context:**
The PRD doesn't explicitly require a UI for triggering scrapes (API endpoint is sufficient). However, for demo purposes and user experience, a UI control is valuable.

**Options Considered:**

**Option 1: Simple Button (Implemented)**

- Single button in header next to view mode toggles
- Shows status (idle, running, done, failed)
- Polls job status every 2 seconds
- Auto-refreshes promotions when complete
- Auto-dismisses success message after 5 seconds

**Option 2: Admin Panel (Future Enhancement)**

- Dedicated `/admin` page
- Scrape history table
- Real-time progress updates (WebSocket)
- Manual re-scrape of individual promotions
- Scheduled scraping (cron jobs)
- More detailed error logs

**Why Option 1?**

- **Time constraint:** 5 minutes to implement vs 30+ minutes
- **MVP scope:** Demonstrates functionality without over-engineering
- **Reviewer experience:** Easy to test without navigating to separate page
- **Sufficient:** Meets the need to trigger scrapes from UI

**Why not Option 2?**

- **Over-engineering:** Admin panel is overkill for MVP
- **Time:** Would consume significant development time
- **Complexity:** Adds routing, authentication concerns, more UI components

**Implementation:**

```typescript
const triggerScrape = async () => {
  setScrapeStatus("running");
  const response = await fetch(`${API_URL}/scrape`, { method: "POST" });
  const { jobId } = await response.json();

  // Poll for status every 2 seconds
  const pollInterval = setInterval(async () => {
    const statusData = await fetch(`${API_URL}/scrape/${jobId}`).then((r) =>
      r.json(),
    );
    if (statusData.status === "done") {
      clearInterval(pollInterval);
      fetchPromotions(); // Refresh data
      // Auto-dismiss after 5s
    }
  }, 2000);
};
```

**Future Enhancement:**
Option 2 (Admin Panel) is documented as a future enhancement in this file and would be the next logical step for a production system.

---

### 2.4 Missing Data Handling — Null Strategy

**Decision:** All optional fields are `null`, never `undefined` or `""` (empty string).

**Rationale:**

- **Consistency:** Consumers always encounter the key, never an absent property
- **Explicit:** `null` means "this field was not present on the source page"
- **Type safety:** TypeScript `string | null` forces explicit null-handling

**Examples:**

```typescript
// Scraper
const description = $detail("div.deal-detail-description").text().trim() || null;
const endDate = parseDate(endDateText) || null;
const socialLinks = extractSocialLinks($brand) || null;

// API Response
{
  "description": null,  // Not ""
  "endDate": null,      // Not undefined
  "socialLinks": null   // Not {}
}
```

**Why not empty string `""`?**

- Empty string is ambiguous: Does it mean "no data" or "empty value"?
- `null` is explicit: "this data doesn't exist"

**Why not `undefined`?**

- `undefined` properties are omitted from JSON serialization
- Consumers can't distinguish between "field doesn't exist" and "field is null"
- TypeScript `string | undefined` allows accidental access without null checks

**Impact:**

- Consistent API responses
- Easier to debug (always see the field, even if null)
- Forces frontend to handle missing data explicitly

---

## 3. Assumptions & Interpretations

### 3.1 HTML Structure Stability

**Assumption:** The target site's HTML structure is relatively stable and uses consistent CSS selectors.

**Rationale:**

- The PRD does not specify handling for dynamic HTML structure changes
- Cheerio-based scraping requires predictable DOM selectors
- If the site changes its structure, selectors will need to be updated

**Mitigation:**

- Scraper logs warnings when expected elements are missing
- Missing data is set to `null` rather than crashing the job
- Individual record failures are tracked in `recordsFailed` count
- Scraper uses multiple fallback selectors where possible

**Example:**

```typescript
const imageUrl =
  $detail("div.deal-detail-image img").attr("src") || // Primary selector
  $detail("img").first().attr("src") || // Fallback
  null; // Graceful degradation
```

---

### 3.2 Re-scrape Behavior — Upsert vs Create New

**Assumption:** Re-running the scraper should update existing promotions, not create duplicates.

**Rationale:**

- The PRD mentions "re-scrape" scenarios
- Duplicate promotions would clutter the database and UI
- Users expect fresh data, not duplicates

**Implementation:**

- Prisma `upsert` by `stableId` (SHA-256 of sourceUrl)
- Existing promotions are updated with fresh data
- `createdAt` is preserved; `updatedAt` is refreshed
- `scrapedAt` timestamp shows when data was last fetched

**Trade-off:**

- Historical data is overwritten (can't track changes over time)
- Production system might keep promotion history in a separate table

---

### 3.3 Promotion Uniqueness — Source URL as Canonical ID

**Assumption:** A promotion's `sourceUrl` is a stable, unique identifier.

**Rationale:**

- URLs are canonical identifiers on the web
- The same promotion should always have the same URL
- Re-scraping should update existing promotions, not create duplicates

**Why not use promotion name?**

- Names can change (e.g., "Summer Sale" → "Summer Sale 2026")
- Names might not be unique across brands
- Names are user-facing, not system identifiers

**Why not use auto-increment ID?**

- Auto-increment IDs change on re-scrape
- Can't detect if a promotion already exists without complex matching logic

---

### 3.4 Brand Uniqueness — Name as Natural Key

**Assumption:** Brand names are unique within the mall.

**Rationale:**

- A mall typically has one location per brand (e.g., one "Nike" store)
- Brand name is a natural unique key
- The PRD does not mention handling multiple locations of the same brand

**Implementation:**

- `Brand.name` has a `@unique` constraint in Prisma schema
- If a brand already exists, it is reused (not duplicated)
- Brand metadata is updated on re-scrape if the source page has changed

**Trade-off:**

- If a mall has multiple locations of the same brand (e.g., "Nike - North Wing" and "Nike - South Wing"), this would need to be handled differently
- Production system might use `name + location` as composite key

---

### 3.5 Missing Dates — Nullable Date Fields

**Assumption:** Promotions may not always have explicit start/end dates.

**Rationale:**

- Some promotions are "ongoing" or "while supplies last"
- The PRD does not specify how to handle missing dates
- Nullable date fields are more honest than inventing dates

**Implementation:**

- `startDate` and `endDate` are nullable in the schema
- If dates are not found on the detail page, they are set to `null`
- API consumers can filter by date or show "No end date" in the UI

**Example:**

```typescript
let endDate: Date | null = null;
const endDateText = $detail("div.minor.motice").text().trim();
if (endDateText) {
  endDate = parseDate(endDateText); // Returns Date | null
}
```

---

### 3.6 Social Media Links — Optional Brand Metadata

**Assumption:** Social media links (Instagram, Facebook, TikTok, X/Twitter) are optional and may not be present for all brands.

**Rationale:**

- Not all brands maintain social media presence
- The PRD does not specify these as required fields
- Sample data suggests these are "nice to have" enrichments

**Implementation:**

- `socialLinks` field is nullable in the database schema
- If no social links are found, `socialLinks = null` (not an empty object)
- Stored as JSON string: `{"instagram": "url", "facebook": "url"}` when present

**Example:**

```typescript
const socialLinks = extractSocialLinks($brand); // Returns object | null
brand.socialLinks = socialLinks ? JSON.stringify(socialLinks) : null;
```

---

## 4. What Was Cut (Time Constraints)

| Feature                   | Reason                            | Would Add With More Time        |
| ------------------------- | --------------------------------- | ------------------------------- |
| Unit/integration tests    | 6–8 hour time limit               | Vitest for scraper + routes     |
| Admin panel (Option 2)    | Over-engineering for MVP          | Dedicated `/admin` page         |
| Detail page UI            | PRD marks as bonus only           | `/promotions/[id]` Next.js page |
| Real-time scrape progress | Complexity (WebSocket required)   | WebSocket for live updates      |
| Scrape scheduling         | Out of MVP scope                  | Cron jobs for automated scrapes |
| Error retry logic         | Time constraint                   | Exponential backoff for retries |
| Rate limiting on API      | Not required locally              | `express-rate-limit` middleware |
| Cursor-based pagination   | Page-number pagination sufficient | Cursor for large datasets       |
| Docker/docker-compose     | SQLite removes need               | Add when switching to Postgres  |

---

## 5. Future Enhancements (Out of Scope for MVP)

If this were a production system, the following would be added:

### 5.1 Admin Panel (Option 2)

- Dedicated `/admin` page for scrape management
- Scrape history table showing all past jobs
- Real-time progress updates using WebSocket
- Manual re-scrape of individual promotions
- Scheduled scraping with cron jobs
- More detailed error logs and debugging tools

### 5.2 Advanced Features

- **Authentication & Authorization:** JWT-based auth, role-based access control
- **Rate Limiting:** Protect API endpoints from abuse
- **Caching:** Redis for frequently accessed data
- **Job Queue:** Bull/BullMQ for scraper jobs with retry logic
- **Monitoring:** Sentry for error tracking, Prometheus for metrics
- **Logging:** Structured logging with Winston or Pino
- **Tests:** Unit tests (Vitest), integration tests, e2e tests (Playwright)
- **CI/CD:** GitHub Actions for automated testing and deployment
- **Docker:** Containerization for consistent deployment
- **PostgreSQL:** Replace SQLite for production-grade concurrency and scalability

### 5.3 Scraper Enhancements

- **Parallel scraping:** Controlled concurrency (e.g., 3 concurrent requests)
- **Retry logic:** Exponential backoff for failed requests
- **Change detection:** Only update promotions that have changed
- **Historical tracking:** Keep promotion history in separate table
- **Incremental scraping:** Only scrape new/updated promotions

### 5.4 UI Enhancements

- **Promotion detail page:** Dedicated page for each promotion
- **Advanced filters:** Price range, category, location
- **Sorting:** By date, popularity, brand
- **Favorites:** Save promotions for later
- **Notifications:** Alert users when new promotions match their interests

---

## 6. Anticipated Failure Modes

| Failure                  | Detection                         | Recovery                                  |
| ------------------------ | --------------------------------- | ----------------------------------------- |
| Listing page unreachable | `axios` throws network/HTTP error | Job → `'failed'`, existing DB untouched   |
| Detail page 404/timeout  | Caught per-record in try/catch    | Record skipped, `recordsFailed++`, logged |
| Missing social links     | DOM element absent                | `socialLinks = null`                      |
| No end date              | Date element absent               | `endDate = null`                          |
| Re-scrape duplicate      | `stableId` already in DB          | Prisma `upsert` — updates, no new row     |
| HTML structure changes   | Cheerio selectors return null     | Null-fill, log warning, don't crash       |
| Image CDN down           | Next.js Image component fails     | Show placeholder or alt text              |
| Database locked          | SQLite write during read          | Retry with exponential backoff            |

---

## 7. Lessons Learned

### 7.1 Start with the Listing Page

**Lesson:** Always examine the listing page first for data extraction opportunities.

**Why:** Listing pages often contain more reliable, structured data than detail pages. In this project, images were more consistently available on the listing page than detail pages.

### 7.2 Use Functional State Updates in React

**Lesson:** Always use functional state updates when the new state depends on the previous state.

**Why:** Prevents race conditions and stale closures. `setPagination(prev => ({ ...prev, page: 1 }))` is safer than `setPagination({ ...pagination, page: 1 })`.

### 7.3 Separate Concerns in useEffect

**Lesson:** Don't fetch unrelated data in the same `useEffect` hook.

**Why:** Brands don't change when filters change, so fetching them on every filter change is wasteful. Separate hooks improve performance and clarity.

### 7.4 Whitelist External Domains Early

**Lesson:** When using Next.js Image component with external images, configure `remotePatterns` early.

**Why:** Saves debugging time. Next.js won't load external images without explicit whitelisting.

### 7.5 Document Assumptions as You Go

**Lesson:** Write ASSUMPTIONS.md incrementally, not at the end.

**Why:** Easier to remember the "why" behind decisions when they're fresh. This document would have been harder to write without notes from the development process.

---

**End of ASSUMPTIONS.md**
