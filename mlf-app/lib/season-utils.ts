// Season Utility Functions
// Provides dynamic season detection and data strategy functions

import { 
  isSeasonComplete, 
  getCurrentNFLSeason, 
  getDataStrategy, 
  getCurrentWeekForSeason,
  getTotalWeeksForYear,
  DataStrategy 
} from './season-config'

/**
 * Determine the appropriate week parameter for MFL API calls
 * @param year - The NFL season year
 * @returns Either a week number (string) or 'YTD' for completed seasons
 */
export function getWeekParameter(year: number): string {
  const strategy = getDataStrategy(year)
  
  if (strategy.useYTD) {
    return 'YTD'
  } else if (strategy.currentWeek) {
    return strategy.currentWeek.toString()
  } else {
    return '1' // Default to week 1 for future seasons
  }
}

/**
 * Check if we should use weekly lineup data or YTD aggregated data
 * @param year - The NFL season year
 * @returns true if should use weekly lineup data, false if should use YTD
 */
export function shouldUseWeeklyLineupData(year: number): boolean {
  const strategy = getDataStrategy(year)
  return !strategy.useYTD && strategy.dataType === 'current'
}

/**
 * Get the appropriate weeks array for weekly progression API
 * @param year - The NFL season year
 * @param requestedWeeks - Weeks requested by the user (optional)
 * @returns Array of week numbers to fetch
 */
export function getWeeksForProgression(year: number, requestedWeeks?: number[]): number[] {
  const strategy = getDataStrategy(year)
  
  const totalWeeks = getTotalWeeksForYear(year)
  
  if (requestedWeeks && requestedWeeks.length > 0) {
    // User specified weeks - validate they make sense for this season
    if (strategy.dataType === 'completed') {
      // For completed seasons, allow all weeks up to total available
      return requestedWeeks.filter(w => w >= 1 && w <= totalWeeks)
    } else if (strategy.dataType === 'current') {
      // For current season, only allow weeks up to current week
      const currentWeek = strategy.currentWeek || 1
      return requestedWeeks.filter(w => w >= 1 && w <= currentWeek)
    } else {
      // Future season - only week 1
      return [1]
    }
  }
  
  // Default weeks based on season status
  if (strategy.dataType === 'completed') {
    // All available weeks for completed seasons
    return Array.from({ length: totalWeeks }, (_, i) => i + 1)
  } else if (strategy.dataType === 'current') {
    // Weeks 1 through current week
    const currentWeek = strategy.currentWeek || 1
    return Array.from({ length: currentWeek }, (_, i) => i + 1)
  } else {
    // Future season - just week 1
    return [1]
  }
}

/**
 * Validate that a requested year is reasonable
 * @param year - The year to validate
 * @returns true if year is valid
 */
export function isValidNFLYear(year: number): boolean {
  const currentYear = new Date().getFullYear()
  
  // Allow years from 2000 to 5 years in the future
  return year >= 2000 && year <= currentYear + 5
}

/**
 * Get a human-readable description of the season status
 * @param year - The NFL season year
 * @returns Description string
 */
export function getSeasonStatusDescription(year: number): string {
  const strategy = getDataStrategy(year)
  const currentNFLSeason = getCurrentNFLSeason()
  
  switch (strategy.dataType) {
    case 'completed':
      return `${year} season (completed)`
    case 'current':
      return `${year} season (current - week ${strategy.currentWeek})`
    case 'future':
      return `${year} season (future)`
    default:
      return `${year} season`
  }
}

/**
 * Log debugging information about season strategy
 * @param year - The NFL season year
 */
export function logSeasonStrategy(year: number): void {
  const strategy = getDataStrategy(year)
  const weekParam = getWeekParameter(year)
  
  console.log(`[Season Strategy] ${year}: ${JSON.stringify({
    ...strategy,
    weekParameter: weekParam,
    useWeeklyLineup: shouldUseWeeklyLineupData(year)
  })}`)
}