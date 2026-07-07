import axios from "axios";
import * as cheerio from "cheerio";
import { delay, parseDate, excelSerialToDate } from "./utils";

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

  // Extract promotion links and images from listing page
  // Each promotion is in a div.deal-row with an <a href="/deals/ID/">
  const promotionLinks: Array<{ url: string; imageUrl: string | null }> = [];
  $("div.deal-row").each((_, element) => {
    const $row = $(element);
    const href = $row.find("a[href^='/deals/']").attr("href");
    const imageUrl = $row.find("div.deal-image img").attr("src") || null;

    if (href) {
      const fullUrl = href.startsWith("http") ? href : `${baseUrl}${href}`;
      // Check if URL already exists
      if (!promotionLinks.some((p) => p.url === fullUrl)) {
        promotionLinks.push({ url: fullUrl, imageUrl });
      }
    }
  });

  console.log(`📋 Found ${promotionLinks.length} promotion links`);

  // Pass 2: Scrape each promotion detail page
  for (const promoData of promotionLinks) {
    const promoUrl = promoData.url;
    const listingImageUrl = promoData.imageUrl;

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

      // Use image from listing page (already has unique image per promotion)
      const fullImageUrl = listingImageUrl;

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

      // Extract dates from multiple sources
      // 1. Try to get from listing page data attributes (Excel serial format)
      // 2. Try to get from detail page text (e.g., "Ends 6/30")

      let startDate: Date | null = null;
      let endDate: Date | null = null;

      // Find the deal-row element in the original listing page for this promotion
      // Use .closest() to traverse up to the deal-row parent (more robust than .parent().parent())
      const dealRow = $(
        `div.deal-row a[href="${promoUrl.replace(baseUrl, "")}"]`,
      ).closest("div.deal-row");

      if (dealRow.length > 0) {
        const dataStart = dealRow.attr("data-start");
        const dataEnd = dealRow.attr("data-end");

        if (dataStart) {
          startDate = excelSerialToDate(parseFloat(dataStart));
        }
        if (dataEnd) {
          endDate = excelSerialToDate(parseFloat(dataEnd));
        }
      }

      // If no dates from data attributes, try to parse from detail page text
      if (!endDate) {
        const endDateText = $detail("div.minor.motice").first().text().trim();
        if (endDateText) {
          endDate = parseDate(endDateText);
        }
      }

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
      const errorMsg = `Failed to scrape ${promoUrl}: ${error instanceof Error ? error.message : error}\n`;
      process.stderr.write(`  ✗ ${errorMsg}`);
    }
  }

  console.log(`✅ Successfully scraped ${promotions.length} promotions`);
  return promotions;
}
