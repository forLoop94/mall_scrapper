import { Router } from "express";
import prisma from "../db/client";

const router = Router();

// GET /promotions - Paginated list with filters
router.get("/", async (req, res) => {
  try {
    const {
      search,
      brand,
      startDate,
      endDate,
      page = "1",
      pageSize = "20",
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const pageSizeNum = parseInt(pageSize as string, 10);
    const skip = (pageNum - 1) * pageSizeNum;

    // Build where clause
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: "insensitive" } },
        { description: { contains: search as string, mode: "insensitive" } },
        {
          brand: { name: { contains: search as string, mode: "insensitive" } },
        },
      ];
    }

    if (brand) {
      where.brand = { name: brand as string };
    }

    if (startDate || endDate) {
      where.AND = [];
      if (startDate) {
        where.AND.push({ startDate: { gte: new Date(startDate as string) } });
      }
      if (endDate) {
        where.AND.push({ endDate: { lte: new Date(endDate as string) } });
      }
    }

    // Get total count
    const total = await prisma.promotion.count({ where });

    // Get paginated results
    const promotions = await prisma.promotion.findMany({
      where,
      skip,
      take: pageSizeNum,
      include: {
        brand: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({
      data: promotions,
      pagination: {
        page: pageNum,
        pageSize: pageSizeNum,
        total,
        totalPages: Math.ceil(total / pageSizeNum),
      },
    });
  } catch (error) {
    console.error("Error fetching promotions:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch promotions",
      statusCode: 500,
    });
  }
});

// GET /promotions/:id - Single promotion by ID
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const promotion = await prisma.promotion.findUnique({
      where: { id },
      include: {
        brand: true,
      },
    });

    if (!promotion) {
      return res.status(404).json({
        error: "Not Found",
        message: "Promotion not found",
        statusCode: 404,
      });
    }

    res.json({ data: promotion });
  } catch (error) {
    console.error("Error fetching promotion:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch promotion",
      statusCode: 500,
    });
  }
});

export default router;
