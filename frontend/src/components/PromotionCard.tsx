import { Promotion } from "@shared/types";
import Image from "next/image";

interface PromotionCardProps {
  promotion: Promotion;
}

export default function PromotionCard({ promotion }: PromotionCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      {promotion.imageUrl && (
        <div className="relative h-48 w-full">
          <Image
            src={promotion.imageUrl}
            alt={promotion.name}
            fill
            className="object-cover"
          />
        </div>
      )}
      <div className="p-4">
        <h3 className="text-xl font-semibold mb-2">{promotion.name}</h3>
        {promotion.brand && (
          <p className="text-sm text-gray-600 mb-2">{promotion.brand.name}</p>
        )}
        {promotion.description && (
          <p className="text-gray-700 mb-3 line-clamp-3">
            {promotion.description}
          </p>
        )}
        {promotion.endDate && (
          <p className="text-sm text-gray-500 mb-3">
            Ends: {new Date(promotion.endDate).toLocaleDateString()}
          </p>
        )}
        <a
          href={promotion.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-sm"
        >
          View Details →
        </a>
      </div>
    </div>
  );
}
