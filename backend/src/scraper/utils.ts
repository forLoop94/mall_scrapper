// Utility functions for scraper

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function parseDate(dateString: string | null): Date | null {
  if (!dateString) return null;

  try {
    // Handle various date formats
    // Format 1: "Ends 6/30" or "Ends Tomorrow" or "Ends Sunday"
    // Format 2: "6/30" or "6/30/2026"

    const cleaned = dateString.trim();

    // Remove "Ends " prefix if present
    const dateOnly = cleaned.replace(/^Ends\s+/i, "");

    // Handle relative dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (/tomorrow/i.test(dateOnly)) {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    }

    if (/today/i.test(dateOnly)) {
      return today;
    }

    // Handle day names (e.g., "Sunday", "Monday")
    const dayNames = [
      "sunday",
      "monday",
      "tuesday",
      "wednesday",
      "thursday",
      "friday",
      "saturday",
    ];
    const lowerDate = dateOnly.toLowerCase();
    const dayIndex = dayNames.findIndex((day) => lowerDate.includes(day));

    if (dayIndex !== -1) {
      const targetDay = dayIndex;
      const currentDay = today.getDay();
      let daysUntil = targetDay - currentDay;
      if (daysUntil <= 0) daysUntil += 7; // Next occurrence

      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + daysUntil);
      return targetDate;
    }

    // Handle M/D or M/D/YYYY format
    if (/^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(dateOnly)) {
      const parts = dateOnly.split("/");
      const month = parseInt(parts[0], 10) - 1; // 0-indexed
      const day = parseInt(parts[1], 10);
      let year = today.getFullYear();

      if (parts[2]) {
        year = parseInt(parts[2], 10);
        if (year < 100) year += 2000; // Handle 2-digit years
      } else {
        // If month/day has passed this year, assume next year
        const testDate = new Date(year, month, day);
        if (testDate < today) {
          year++;
        }
      }

      return new Date(year, month, day);
    }

    // Fallback: try standard Date parsing
    const date = new Date(dateOnly);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}

// Convert Excel serial date to JavaScript Date
export function excelSerialToDate(serial: number): Date | null {
  try {
    // Excel serial date: days since 1900-01-01 (with leap year bug)
    const excelEpoch = new Date(1899, 11, 30); // Dec 30, 1899
    const date = new Date(excelEpoch.getTime() + serial * 24 * 60 * 60 * 1000);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}
