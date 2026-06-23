import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import promotionsRouter from "./routes/promotions";
import brandsRouter from "./routes/brands";
import scrapeRouter from "./routes/scrape";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/promotions", promotionsRouter);
app.use("/brands", brandsRouter);
app.use("/scrape", scrapeRouter);

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Promotions Aggregator API" });
});

// Error handling middleware
app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error(err.stack);
    res.status(500).json({
      error: "Internal Server Error",
      message: err.message,
      statusCode: 500,
    });
  },
);

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
});
