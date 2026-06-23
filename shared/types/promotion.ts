// Promotion-related types

export interface Promotion {
  id: string;
  stableId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  sourceUrl: string;
  sourcePortal: string;
  scrapedAt: string;
  brandId: string;
  brand?: {
    id: string;
    name: string;
    websiteUrl: string | null;
    hours: string | null;
    socialLinks: string | null;
    sourceUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PromotionListItem {
  id: string;
  stableId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  startDate: string | null;
  endDate: string | null;
  sourceUrl: string;
  sourcePortal: string;
  scrapedAt: string;
  brandId: string;
  brandName?: string;
}

export interface PromotionsResponse {
  data: Promotion[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface PromotionFilters {
  search?: string;
  brand?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}
