import { Brand, Promotion } from "@shared/types";
import PromotionCard from "./PromotionCard";

interface BrandGroupProps {
  brand: Brand;
  promotions: Promotion[];
}

export default function BrandGroup({ brand, promotions }: BrandGroupProps) {
  const socialLinks = brand.socialLinks ? JSON.parse(brand.socialLinks) : null;

  return (
    <div className="border-2 border-gray-200 rounded-lg p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-3">{brand.name}</h2>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          {brand.websiteUrl && (
            <a
              href={brand.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              🌐 Website
            </a>
          )}
          {brand.hours && <span>🕒 {brand.hours}</span>}
          {socialLinks && (
            <div className="flex gap-3">
              {socialLinks.instagram && (
                <a
                  href={socialLinks.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Instagram
                </a>
              )}
              {socialLinks.facebook && (
                <a
                  href={socialLinks.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  Facebook
                </a>
              )}
              {socialLinks.x && (
                <a
                  href={socialLinks.x}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  X
                </a>
              )}
              {socialLinks.tiktok && (
                <a
                  href={socialLinks.tiktok}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  TikTok
                </a>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {promotions.map((promo) => (
          <PromotionCard key={promo.id} promotion={promo} />
        ))}
      </div>
    </div>
  );
}
