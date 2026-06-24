import { Router } from "express";
import prisma from "../db/client";

const router = Router();

// GET /brands - List of brands with promotion count
router.get("/", async (req, res) => {
  try {
    const brands = await prisma.brand.findMany({
      include: {
        _count: {
          select: { promotions: true },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    const brandsWithCount = brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      websiteUrl: brand.websiteUrl,
      hours: brand.hours,
      socialLinks: brand.socialLinks,
      sourceUrl: brand.sourceUrl,
      createdAt: brand.createdAt.toISOString(),
      updatedAt: brand.updatedAt.toISOString(),
      promotionCount: brand._count.promotions,
    }));

    res.json({ data: brandsWithCount });
  } catch (error) {
    const errorMsg = `Error fetching brands: ${error instanceof Error ? error.message : error}\n`;
    process.stderr.write(errorMsg);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch brands",
      statusCode: 500,
    });
  }
});

export default router;
