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
  const promotionLinks: string[] = [];
  $("a[href*='/sales/']").each((_, element) => {
    const href = $(element).attr("href");
    if (href && href !== "/sales" && !href.includes("#")) {
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

      // Extract promotion details (selectors will need to be adjusted based on actual HTML structure)
      const name = $detail("h1").first().text().trim() || "Untitled Promotion";
      const description = $detail("p").first().text().trim() || null;
      const imageUrl = $detail("img").first().attr("src") || null;
      const fullImageUrl =
        imageUrl && !imageUrl.startsWith("http")
          ? `${baseUrl}${imageUrl}`
          : imageUrl;

      // Extract brand name and link
      const brandName =
        $detail("a[href*='/stores/']").first().text().trim() || "Unknown Brand";
      const brandHref = $detail("a[href*='/stores/']").first().attr("href");
      const brandSourceUrl =
        brandHref && !brandHref.startsWith("http")
          ? `${baseUrl}${brandHref}`
          : brandHref || null;

      // Extract dates (if available)
      const startDate = null; // Will need to parse from page if available
      const endDate = null; // Will need to parse from page if available

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
