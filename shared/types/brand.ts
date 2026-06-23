// Brand-related types

export interface Brand {
  id: string;
  name: string;
  websiteUrl: string | null;
  hours: string | null; // JSON string: e.g. { "Mon-Sat": "10am-9pm", "Sun": "11am-6pm" }
  socialLinks: string | null; // JSON string: e.g. { "instagram": "url", "facebook": "url" }
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrandWithPromotions extends Brand {
  promotionCount: number;
  promotions?: PromotionListItem[];
}

export interface BrandsResponse {
  data: BrandWithPromotions[];
}

// Reference PromotionListItem from promotion.ts to avoid duplication
import type { PromotionListItem } from "./promotion";
export type { PromotionListItem };
