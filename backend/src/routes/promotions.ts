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
        { name: { contains: search as string } },
        { description: { contains: search as string } },
        {
          brand: { name: { contains: search as string } },
        },
      ];
    }

    if (brand) {
      where.brand = { name: brand as string };
    }

    if (startDate || endDate) {
      where.AND = [];
      if (startDate) {
        const start = new Date(startDate as string);
        if (isNaN(start.getTime())) {
          return res.status(400).json({
            error: "Bad Request",
            message: "Invalid startDate format. Please use YYYY-MM-DD.",
            statusCode: 400,
          });
        }
        where.AND.push({ endDate: { gte: start } });
      }
      if (endDate) {
        const end = new Date(endDate as string);
        if (isNaN(end.getTime())) {
          return res.status(400).json({
            error: "Bad Request",
            message: "Invalid endDate format. Please use YYYY-MM-DD.",
            statusCode: 400,
          });
        }
        where.AND.push({ startDate: { lte: end } });
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
    const errorMsg = `Error fetching promotions: ${error instanceof Error ? error.message : error}\n`;
    process.stderr.write(errorMsg);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch promotions",
      statusCode: 500,
      data: [],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 0,
        totalPages: 0,
      },
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
    const errorMsg = `Error fetching promotion: ${error instanceof Error ? error.message : error}\n`;
    process.stderr.write(errorMsg);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch promotion",
      statusCode: 500,
    });
  }
});

export default router;
