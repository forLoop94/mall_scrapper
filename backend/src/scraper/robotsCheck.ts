import axios from "axios";

interface RobotsCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if scraping is allowed according to robots.txt
 * @param baseUrl - The base URL of the site (e.g., "https://www.thepromenadeshopsatbriargate.com")
 * @param path - The path to check (e.g., "/sales")
 * @param userAgent - The user agent to check for (default: "*")
 * @returns Promise<RobotsCheckResult>
 */
export async function checkRobotsTxt(
  baseUrl: string,
  path: string,
  userAgent: string = "*",
): Promise<RobotsCheckResult> {
  try {
    const robotsUrl = `${baseUrl}/robots.txt`;
    console.log(`🤖 Checking robots.txt at ${robotsUrl}...`);

    const response = await axios.get(robotsUrl, {
      timeout: 10000,
      validateStatus: (status) => status === 200 || status === 404,
    });

    // If robots.txt doesn't exist (404), assume scraping is allowed
    if (response.status === 404) {
      console.log("  ℹ️  No robots.txt found - assuming scraping is allowed");
      return { allowed: true };
    }

    const robotsTxt = response.data;
    const rules = parseRobotsTxt(robotsTxt, userAgent);

    // Check if the path is disallowed
    const isDisallowed = rules.disallow.some((disallowedPath) => {
      // Handle wildcard patterns
      const pattern = disallowedPath
        .replace(/\*/g, ".*")
        .replace(/\?/g, "\\?")
        .replace(/\$/g, "\\$");
      const regex = new RegExp(`^${pattern}`);
      return regex.test(path);
    });

    if (isDisallowed) {
      // Check if there's a more specific allow rule
      const isAllowed = rules.allow.some((allowedPath) => {
        const pattern = allowedPath
          .replace(/\*/g, ".*")
          .replace(/\?/g, "\\?")
          .replace(/\$/g, "\\$");
        const regex = new RegExp(`^${pattern}`);
        return regex.test(path);
      });

      if (!isAllowed) {
        const reason = `Path "${path}" is disallowed by robots.txt for user-agent "${userAgent}"`;
        console.log(`  ❌ ${reason}`);
        return { allowed: false, reason };
      }
    }

    console.log(`  ✅ Path "${path}" is allowed by robots.txt`);
    return { allowed: true };
  } catch (error) {
    // If we can't fetch robots.txt due to network error, log warning but allow scraping
    console.warn(
      `  ⚠️  Failed to fetch robots.txt: ${error instanceof Error ? error.message : error}`,
    );
    console.warn("  ℹ️  Proceeding with scraping (assuming allowed)");
    return { allowed: true };
  }
}

/**
 * Parse robots.txt content for a specific user agent
 */
function parseRobotsTxt(
  content: string,
  targetUserAgent: string,
): { allow: string[]; disallow: string[] } {
  const lines = content.split("\n");
  const rules = { allow: [] as string[], disallow: [] as string[] };

  let currentUserAgent: string | null = null;
  let matchesUserAgent = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith("#")) continue;

    // Parse User-agent directive
    if (trimmed.toLowerCase().startsWith("user-agent:")) {
      currentUserAgent = trimmed.substring(11).trim();
      matchesUserAgent =
        currentUserAgent === targetUserAgent || currentUserAgent === "*";
      continue;
    }

    // Only process rules for matching user agent
    if (!matchesUserAgent) continue;

    // Parse Disallow directive
    if (trimmed.toLowerCase().startsWith("disallow:")) {
      const path = trimmed.substring(9).trim();
      if (path) rules.disallow.push(path);
      continue;
    }

    // Parse Allow directive
    if (trimmed.toLowerCase().startsWith("allow:")) {
      const path = trimmed.substring(6).trim();
      if (path) rules.allow.push(path);
      continue;
    }
  }

  return rules;
}
