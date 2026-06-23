// Scrape job-related types

export type ScrapeJobStatus = "pending" | "running" | "done" | "failed";

export interface ScrapeJob {
  id: string;
  status: ScrapeJobStatus;
  startedAt: string | null;
  completedAt: string | null;
  recordsFound: number | null;
  recordsEnriched: number | null;
  recordsFailed: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface ScrapeJobSummary {
  recordsFound: number;
  recordsEnriched: number;
  recordsFailed: number;
}

export interface ScrapeJobResponse {
  id: string;
  status: ScrapeJobStatus;
  startedAt: string | null;
  completedAt: string | null;
  summary: ScrapeJobSummary | null;
  errorMessage: string | null;
}

export interface ScrapeInitiateResponse {
  jobId: string;
}
