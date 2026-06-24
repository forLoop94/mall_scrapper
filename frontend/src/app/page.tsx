"use client";

import { useState, useEffect } from "react";
import { Promotion, Brand } from "@shared/types";
import PromotionCard from "@/components/PromotionCard";
import BrandGroup from "@/components/BrandGroup";
import Filters from "@/components/Filters";
import Pagination from "@/components/Pagination";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function Home() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grouped">("list");
  const [filters, setFilters] = useState({
    search: "",
    brand: "",
    startDate: "",
    endDate: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  });
  const [scrapeStatus, setScrapeStatus] = useState<
    "idle" | "running" | "done" | "failed"
  >("idle");
  const [scrapeMessage, setScrapeMessage] = useState("");

  // Fetch brands only once on mount
  useEffect(() => {
    fetchBrands();
  }, []);

  // Fetch promotions when filters or page changes
  useEffect(() => {
    fetchPromotions();
  }, [filters, pagination.page]);

  const fetchPromotions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: (pagination?.page || 1).toString(),
        pageSize: (pagination?.pageSize || 20).toString(),
        ...(filters.search && { search: filters.search }),
        ...(filters.brand && { brand: filters.brand }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });

      const response = await fetch(`${API_URL}/promotions?${params}`);
      const data = await response.json();
      setPromotions(data.data);
      setPagination(data.pagination);
    } catch (error) {
      console.error("Error fetching promotions:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await fetch(`${API_URL}/brands`);
      const data = await response.json();
      setBrands(data.data);
    } catch (error) {
      console.error("Error fetching brands:", error);
    }
  };

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }));
  };

  const triggerScrape = async () => {
    setScrapeStatus("running");
    setScrapeMessage("Starting scrape...");

    try {
      // Trigger scrape
      const response = await fetch(`${API_URL}/scrape`, { method: "POST" });
      const data = await response.json();
      const jobId = data.jobId;

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`${API_URL}/scrape/${jobId}`);
          const statusData = await statusResponse.json();

          if (statusData.status === "done") {
            clearInterval(pollInterval);
            setScrapeStatus("done");
            setScrapeMessage(
              `✅ Successfully scraped ${statusData.summary.recordsFound} promotions!`,
            );
            // Refresh promotions
            fetchPromotions();
            fetchBrands();
            // Auto-dismiss after 5 seconds
            setTimeout(() => {
              setScrapeStatus("idle");
              setScrapeMessage("");
            }, 5000);
          } else if (statusData.status === "failed") {
            clearInterval(pollInterval);
            setScrapeStatus("failed");
            setScrapeMessage(
              `❌ Scrape failed: ${statusData.errorMessage || "Unknown error"}`,
            );
          } else {
            setScrapeMessage(`Scraping in progress...`);
          }
        } catch (error) {
          clearInterval(pollInterval);
          setScrapeStatus("failed");
          setScrapeMessage(`❌ Error checking status: ${error}`);
        }
      }, 2000);
    } catch (error) {
      setScrapeStatus("failed");
      setScrapeMessage(`❌ Failed to trigger scrape: ${error}`);
    }
  };

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Promotions Aggregator</h1>

        <Filters
          filters={filters}
          brands={brands}
          onFilterChange={handleFilterChange}
        />

        <div className="mb-6 flex gap-4 items-center flex-wrap">
          <button
            onClick={() => setViewMode("list")}
            className={`px-4 py-2 rounded ${
              viewMode === "list"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            List View
          </button>
          <button
            onClick={() => setViewMode("grouped")}
            className={`px-4 py-2 rounded ${
              viewMode === "grouped"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-700"
            }`}
          >
            Group by Brand
          </button>

          <div className="ml-auto flex gap-4 items-center">
            <button
              onClick={triggerScrape}
              disabled={scrapeStatus === "running"}
              className={`px-4 py-2 rounded font-medium ${
                scrapeStatus === "running"
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : scrapeStatus === "done"
                    ? "bg-green-600 text-white"
                    : scrapeStatus === "failed"
                      ? "bg-red-600 text-white"
                      : "bg-purple-600 text-white hover:bg-purple-700"
              }`}
            >
              {scrapeStatus === "running"
                ? "Scraping... 🔄"
                : scrapeStatus === "done"
                  ? "Scrape Complete ✅"
                  : scrapeStatus === "failed"
                    ? "Scrape Failed ❌"
                    : "Trigger Scrape"}
            </button>
            {scrapeMessage && (
              <span
                className={`text-sm ${
                  scrapeStatus === "done"
                    ? "text-green-600"
                    : scrapeStatus === "failed"
                      ? "text-red-600"
                      : "text-gray-600"
                }`}
              >
                {scrapeMessage}
              </span>
            )}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">Loading...</div>
        ) : viewMode === "list" ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {promotions.map((promo) => (
                <PromotionCard key={promo.id} promotion={promo} />
              ))}
            </div>
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
            />
          </>
        ) : (
          <div className="space-y-8">
            {brands
              .filter((brand) =>
                promotions.some((p) => p.brand?.name === brand.name),
              )
              .map((brand) => (
                <BrandGroup
                  key={brand.id}
                  brand={brand}
                  promotions={promotions.filter(
                    (p) => p.brand?.name === brand.name,
                  )}
                />
              ))}
          </div>
        )}
      </div>
    </main>
  );
}
