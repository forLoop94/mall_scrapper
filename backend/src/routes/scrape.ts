import { Router } from "express";
import prisma from "../db/client";
import { runScraper } from "../scraper";

const router = Router();

// POST /scrape - Trigger async scrape
router.post("/", async (req, res) => {
  try {
    // Create a new scrape job
    const job = await prisma.scrapeJob.create({
      data: {
        status: "pending",
      },
    });

    // Start scraper asynchronously (don't await)
    runScraper(job.id).catch((error) => {
      console.error("Scraper error:", error);
    });

    // Return immediately with HTTP 202
    res.status(202).json({ jobId: job.id });
  } catch (error) {
    console.error("Error creating scrape job:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to create scrape job",
      statusCode: 500,
    });
  }
});

// GET /scrape/:jobId - Get scrape job status
router.get("/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.scrapeJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({
        error: "Not Found",
        message: "Scrape job not found",
        statusCode: 404,
      });
    }

    const response: any = {
      id: job.id,
      status: job.status,
      startedAt: job.startedAt ? job.startedAt.toISOString() : null,
      completedAt: job.completedAt ? job.completedAt.toISOString() : null,
      summary: null,
      errorMessage: job.errorMessage,
    };

    if (job.status === "done" || job.status === "failed") {
      response.summary = {
        recordsFound: job.recordsFound || 0,
        recordsEnriched: job.recordsEnriched || 0,
        recordsFailed: job.recordsFailed || 0,
      };
    }

    res.json(response);
  } catch (error) {
    console.error("Error fetching scrape job:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch scrape job",
      statusCode: 500,
    });
  }
});

export default router;
