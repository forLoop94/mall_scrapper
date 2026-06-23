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

interface BrandData {
  sourceUrl: string;
  websiteUrl: string | null;
  hours: string | null;
  socialLinks: string | null;
}

export async function scrapeBrands(brandUrls: string[]): Promise<BrandData[]> {
  const brands: BrandData[] = [];

  console.log(`🏢 Scraping ${brandUrls.length} brand pages...`);

  for (const brandUrl of brandUrls) {
    try {
      await delay(SCRAPER_DELAY_MS);

      console.log(`  → Scraping brand: ${brandUrl}`);
      const response = await axiosClient.get(brandUrl);
      const $ = cheerio.load(response.data);

      // Extract brand website (selectors will need to be adjusted based on actual HTML structure)
      const websiteUrl =
        $("a[href*='http']")
          .filter((_, el) => {
            const href = $(el).attr("href") || "";
            return (
              !href.includes("thepromenadeshopsatbriargate.com") &&
              !href.includes("facebook.com") &&
              !href.includes("instagram.com") &&
              !href.includes("twitter.com") &&
              !href.includes("tiktok.com")
            );
          })
          .first()
          .attr("href") || null;

      // Extract hours
      const hoursText = $("*:contains('Hours')").parent().text().trim() || null;

      // Extract social links
      const socialLinks: any = {};
      $("a[href*='facebook.com']").each((_, el) => {
        socialLinks.facebook = $(el).attr("href");
      });
      $("a[href*='instagram.com']").each((_, el) => {
        socialLinks.instagram = $(el).attr("href");
      });
      $("a[href*='twitter.com'], a[href*='x.com']").each((_, el) => {
        socialLinks.x = $(el).attr("href");
      });
      $("a[href*='tiktok.com']").each((_, el) => {
        socialLinks.tiktok = $(el).attr("href");
      });

      const socialLinksJson =
        Object.keys(socialLinks).length > 0
          ? JSON.stringify(socialLinks)
          : null;

      brands.push({
        sourceUrl: brandUrl,
        websiteUrl,
        hours: hoursText,
        socialLinks: socialLinksJson,
      });
    } catch (error) {
      console.error(
        `  ✗ Failed to scrape brand ${brandUrl}:`,
        error instanceof Error ? error.message : error,
      );

      // Add placeholder with null values
      brands.push({
        sourceUrl: brandUrl,
        websiteUrl: null,
        hours: null,
        socialLinks: null,
      });
    }
  }

  console.log(`✅ Successfully scraped ${brands.length} brands`);
  return brands;
}
