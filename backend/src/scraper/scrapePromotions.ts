import axios from "axios";
import * as cheerio from "cheerio";
import { delay } from "./utils";

const SCRAPER_DELAY_MS = parseInt(process.env.SCRAPER_DELAY_MS || "1500", 10);
const SCRAPER_TIMEOUT_MS = parseInt(
  process.env.SCRAPER_TIMEOUT_MS || "15000",
  10,
);

const axiosClient = axios.create({
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
  },
  maxRedirects: 5,
  timeout: SCRAPER_TIMEOUT_MS,
});

interface PromotionData {
  name: string;
  description: string | null;
  imageUrl: string | null;
  startDate: Date | null;
  endDate: Date | null;
  sourceUrl: string;
  brandName: string;
  brandSourceUrl: string | null;
}

export async function scrapePromotions(): Promise<PromotionData[]> {
  const promotions: PromotionData[] = [];
  const baseUrl = "https://www.thepromenadeshopsatbriargate.com";
  const listingUrl = `${baseUrl}/sales`;

  console.log("🔍 Scraping promotions listing page...");

  // Pass 1: Get listing page
  const listingResponse = await axiosClient.get(listingUrl);
  const $ = cheerio.load(listingResponse.data);

  // Extract promotion links from listing page
  // Each promotion is in a div.deal-row with an <a href="/deals/ID/">
  const promotionLinks: string[] = [];
  $("div.deal-row a[href^='/deals/']").each((_, element) => {
    const href = $(element).attr("href");
    if (href) {
      const fullUrl = href.startsWith("http") ? href : `${baseUrl}${href}`;
      if (!promotionLinks.includes(fullUrl)) {
        promotionLinks.push(fullUrl);
      }
    }
  });

  console.log(`📋 Found ${promotionLinks.length} promotion links`);

  // Pass 2: Scrape each promotion detail page
  for (const promoUrl of promotionLinks) {
    try {
      await delay(SCRAPER_DELAY_MS);

      console.log(`  → Scraping: ${promoUrl}`);
      const detailResponse = await axiosClient.get(promoUrl);
      const $detail = cheerio.load(detailResponse.data);

      // Extract promotion details using actual selectors from the website
      const name =
        $detail("h1.head1").first().text().trim() || "Untitled Promotion";

      // Description is in div.deal-detail-description
      const description =
        $detail("div.deal-detail-description").first().text().trim() || null;

      // Image is in the deal detail page
      const imageUrl =
        $detail("div.deal-detail-image img").first().attr("src") ||
        $detail("img").first().attr("src") ||
        null;
      const fullImageUrl =
        imageUrl && !imageUrl.startsWith("http")
          ? `${baseUrl}${imageUrl}`
          : imageUrl;

      // Extract brand name and link - brand link is <a class="store-link" href="/stores/ID-name/">
      const brandName =
        $detail("a.store-link").first().text().trim() ||
        $detail("a[href^='/stores/']").first().text().trim() ||
        "Unknown Brand";
      const brandHref =
        $detail("a.store-link").first().attr("href") ||
        $detail("a[href^='/stores/']").first().attr("href");
      const brandSourceUrl =
        brandHref && !brandHref.startsWith("http")
          ? `${baseUrl}${brandHref}`
          : brandHref || null;

      // Extract dates - dates are in the listing page data attributes or detail page
      // For now, set to null - will be implemented in date parsing task
      const startDate = null;
      const endDate = null;

      promotions.push({
        name,
        description,
        imageUrl: fullImageUrl,
        startDate,
        endDate,
        sourceUrl: promoUrl,
        brandName,
        brandSourceUrl,
      });
    } catch (error) {
      console.error(
        `  ✗ Failed to scrape ${promoUrl}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log(`✅ Successfully scraped ${promotions.length} promotions`);
  return promotions;
}
