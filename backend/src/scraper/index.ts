import prisma from "../db/client";
import { scrapePromotions } from "./scrapePromotions";
import { scrapeBrands } from "./scrapeBrands";
import { checkRobotsTxt } from "./robotsCheck";
import { createHash } from "crypto";

export async function runScraper(jobId: string): Promise<void> {
  try {
    // Update job status to running
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: "running",
        startedAt: new Date(),
      },
    });

    // Check robots.txt before scraping
    const baseUrl = "https://www.thepromenadeshopsatbriargate.com";
    const robotsCheck = await checkRobotsTxt(baseUrl, "/sales");

    if (!robotsCheck.allowed) {
      throw new Error(
        robotsCheck.reason ||
          "Scraping is disallowed by robots.txt for the /sales path",
      );
    }

    let recordsFound = 0;
    let recordsEnriched = 0;
    let recordsFailed = 0;

    // Pass 1 & 2: Scrape promotions (listing + detail pages)
    const promotionsData = await scrapePromotions();
    recordsFound = promotionsData.length;

    // Pass 3: Scrape brand metadata (deduplicated)
    const uniqueBrandUrls = [
      ...new Set(promotionsData.map((p) => p.brandSourceUrl).filter(Boolean)),
    ] as string[];

    const brandsData = await scrapeBrands(uniqueBrandUrls);

    // Persist to database
    for (const promoData of promotionsData) {
      try {
        // Find or create brand
        const brandData = brandsData.find(
          (b) => b.sourceUrl === promoData.brandSourceUrl,
        );

        let brand = await prisma.brand.findUnique({
          where: { name: promoData.brandName },
        });

        if (!brand) {
          brand = await prisma.brand.create({
            data: {
              name: promoData.brandName,
              websiteUrl: brandData?.websiteUrl || null,
              hours: brandData?.hours || null,
              socialLinks: brandData?.socialLinks || null,
              sourceUrl: promoData.brandSourceUrl || null,
            },
          });
        } else if (brandData) {
          // Update brand metadata if we have new data
          brand = await prisma.brand.update({
            where: { id: brand.id },
            data: {
              websiteUrl: brandData.websiteUrl || brand.websiteUrl,
              hours: brandData.hours || brand.hours,
              socialLinks: brandData.socialLinks || brand.socialLinks,
              sourceUrl: promoData.brandSourceUrl || brand.sourceUrl,
            },
          });
        }

        // Create stable ID from source URL
        const stableId = createHash("sha256")
          .update(promoData.sourceUrl)
          .digest("hex");

        // Upsert promotion
        await prisma.promotion.upsert({
          where: { stableId },
          update: {
            name: promoData.name,
            description: promoData.description,
            imageUrl: promoData.imageUrl,
            startDate: promoData.startDate,
            endDate: promoData.endDate,
            scrapedAt: new Date(),
          },
          create: {
            stableId,
            name: promoData.name,
            description: promoData.description,
            imageUrl: promoData.imageUrl,
            startDate: promoData.startDate,
            endDate: promoData.endDate,
            sourceUrl: promoData.sourceUrl,
            sourcePortal: "thepromenadeshopsatbriargate.com",
            scrapedAt: new Date(),
            brandId: brand.id,
          },
        });

        recordsEnriched++;
      } catch (error) {
        console.error("Error persisting promotion:", error);
        recordsFailed++;
      }
    }

    // Update job status to done
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: "done",
        completedAt: new Date(),
        recordsFound,
        recordsEnriched,
        recordsFailed,
      },
    });
  } catch (error) {
    console.error("Scraper failed:", error);

    // Update job status to failed
    await prisma.scrapeJob.update({
      where: { id: jobId },
      data: {
        status: "failed",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
}
