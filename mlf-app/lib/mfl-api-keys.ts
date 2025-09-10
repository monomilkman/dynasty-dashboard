// Year-specific MFL API Key Management
// Different years may require different API keys for accurate historical data access

export interface YearlyApiKeys {
  [year: number]: string
}

// Year-specific API key mapping - loaded from environment variables
// These keys provide access to accurate historical data for each specific season
export const YEARLY_API_KEYS: YearlyApiKeys = {
  2025: process.env.MFL_API_KEY_2025 || '', // 2025 season key
  2024: process.env.MFL_API_KEY_2024 || '', // 2024 season key  
  2023: process.env.MFL_API_KEY_2023 || '', // 2023 season key
  2022: process.env.MFL_API_KEY_2022 || '', // 2022 season key
  2021: process.env.MFL_API_KEY_2021 || '', // 2021 season key
}

/**
 * Get the appropriate API key for a specific year
 * @param year - The NFL season year
 * @returns The API key for that year, or the default key if none specified
 */
export function getApiKeyForYear(year: number): string {
  const apiKey = YEARLY_API_KEYS[year] || YEARLY_API_KEYS[2025] // Default to 2025 key
  
  console.log(`Using API key for year ${year}: ${apiKey.substring(0, 10)}... (${YEARLY_API_KEYS[year] ? 'year-specific' : 'default'})`)
  return apiKey
}

/**
 * Generate year-specific authentication headers
 * @param year - The NFL season year  
 * @param userAgent - User agent string
 * @returns Headers object with year-appropriate API key
 */
export function getYearSpecificHeaders(year: number, userAgent: string = 'dynasty-dashboard'): Record<string, string> {
  const apiKey = getApiKeyForYear(year)
  
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept': 'application/json',
    'Cache-Control': 'no-cache'
  }
  
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
    console.log(`Year ${year}: Using API key authentication`)
  } else {
    console.warn(`Year ${year}: No API key available`)
  }
  
  return headers
}

/**
 * Check if we have a specific API key configured for a year
 * @param year - The NFL season year
 * @returns True if a year-specific key is configured
 */
export function hasYearSpecificKey(year: number): boolean {
  const envKey = `MFL_API_KEY_${year}`
  return !!process.env[envKey] && process.env[envKey] !== ''
}