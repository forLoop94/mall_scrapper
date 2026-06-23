import { Brand } from "@shared/types";

interface FiltersProps {
  filters: {
    search: string;
    brand: string;
    startDate: string;
    endDate: string;
  };
  brands: Brand[];
  onFilterChange: (filters: FiltersProps["filters"]) => void;
}

export default function Filters({
  filters,
  brands,
  onFilterChange,
}: FiltersProps) {
  const handleChange = (
    field: keyof FiltersProps["filters"],
    value: string,
  ) => {
    onFilterChange({ ...filters, [field]: value });
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <h2 className="text-xl font-semibold mb-4">Filters</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Search</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => handleChange("search", e.target.value)}
            placeholder="Search promotions..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Brand</label>
          <select
            value={filters.brand}
            onChange={(e) => handleChange("brand", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Brands</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.name}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">Start Date</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleChange("startDate", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2">End Date</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleChange("endDate", e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
}
