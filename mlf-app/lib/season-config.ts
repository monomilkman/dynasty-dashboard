// NFL Season Configuration
// This file contains configurable settings for NFL seasons to ensure 
// the app works correctly across all historical, current, and future seasons

export interface NFLSeasonConfig {
  /** Total number of regular season weeks */
  regularSeasonWeeks: number
  /** Total number of weeks including playoffs */
  totalWeeks: number
  /** Month when NFL season typically starts (0-indexed, so 8 = September) */
  seasonStartMonth: number
  /** Day of month when NFL season typically starts */
  seasonStartDay: number
  /** Month when NFL season typically ends (0-indexed, so 1 = February) */
  seasonEndMonth: number
  /** Day of month when NFL season typically ends (after Super Bowl) */
  seasonEndDay: number
  /** Day of week when NFL season starts (0 = Sunday, 4 = Thursday) */
  seasonStartDayOfWeek: number
}

export interface YearSpecificSeasonConfig {
  /** Total number of regular season weeks for this year */
  regularSeasonWeeks: number
  /** Total number of weeks available in MFL for this year */
  totalWeeks: number
  /** Week number where regular season ends */
  regularSeasonEndWeek: number
  /** Fantasy playoff weeks */
  playoffWeeks: number[]
  /** Season status */
  seasonStatus: 'completed' | 'current' | 'future'
}

export const NFL_SEASON_CONFIG: NFLSeasonConfig = {
  regularSeasonWeeks: 17,
  totalWeeks: 18, // 17 regular season + 1 playoff week for most teams
  seasonStartMonth: 8, // September (0-indexed)
  seasonStartDay: 4,   // Typical first Thursday in September
  seasonEndMonth: 1,   // February (0-indexed)
  seasonEndDay: 15,    // Typical Super Bowl timeframe (mid-February)
  seasonStartDayOfWeek: 4 // Thursday (0 = Sunday)
}

/**
 * Historical NFL season start dates for reference
 * These can be used for more precise calculations if needed
 */
export const HISTORICAL_SEASON_STARTS: Record<number, Date> = {
  2025: new Date(2025, 8, 4),  // September 4, 2025 (Thursday)
  2024: new Date(2024, 8, 5),  // September 5, 2024 (Thursday)
  2023: new Date(2023, 8, 7),  // September 7, 2023 (Thursday)
  2022: new Date(2022, 8, 8),  // September 8, 2022 (Thursday)
  2021: new Date(2021, 8, 9),  // September 9, 2021 (Thursday)
}

/**
 * Year-specific season configurations
 * These define the exact week structure for each NFL season
 */
export const YEAR_SPECIFIC_CONFIGS: Record<number, YearSpecificSeasonConfig> = {
  2021: {
    regularSeasonWeeks: 17,
    totalWeeks: 22,  // Regular season + playoffs + toilet bowl
    regularSeasonEndWeek: 14,  // Fantasy regular season typically ends week 14
    playoffWeeks: [15, 16, 17, 18, 19, 20, 21, 22],
    seasonStatus: 'completed'
  },
  2022: {
    regularSeasonWeeks: 17,
    totalWeeks: 22,
    regularSeasonEndWeek: 14,
    playoffWeeks: [15, 16, 17, 18, 19, 20, 21, 22],
    seasonStatus: 'completed'
  },
  2023: {
    regularSeasonWeeks: 17,
    totalWeeks: 22,
    regularSeasonEndWeek: 14,
    playoffWeeks: [15, 16, 17, 18, 19, 20, 21, 22],
    seasonStatus: 'completed'
  },
  2024: {
    regularSeasonWeeks: 17,
    totalWeeks: 22,
    regularSeasonEndWeek: 14,
    playoffWeeks: [15, 16, 17, 18, 19, 20, 21, 22],
    seasonStatus: 'completed'
  },
  2025: {
    regularSeasonWeeks: 17,
    totalWeeks: 22,  // Will have full playoff/toilet bowl weeks when season completes
    regularSeasonEndWeek: 14,
    playoffWeeks: [15, 16, 17, 18, 19, 20, 21, 22],
    seasonStatus: 'current'
  }
}

/**
 * Get the approximate start date for any NFL season
 * Uses historical data if available, otherwise calculates based on standard pattern
 */
export function getSeasonStartDate(year: number): Date {
  // Use historical data if we have it
  if (HISTORICAL_SEASON_STARTS[year]) {
    return HISTORICAL_SEASON_STARTS[year]
  }
  
  // Calculate based on standard pattern: first Thursday in September
  const september1 = new Date(year, NFL_SEASON_CONFIG.seasonStartMonth, 1)
  const firstThursday = new Date(september1)
  
  // Find the first Thursday in September
  const dayOfWeek = september1.getDay() // 0 = Sunday, 1 = Monday, etc.
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7 // 4 = Thursday
  firstThursday.setDate(1 + daysUntilThursday)
  
  return firstThursday
}

/**
 * Get the approximate end date for any NFL season
 * Super Bowl is typically held in mid-February
 */
export function getSeasonEndDate(year: number): Date {
  // Super Bowl is typically in February of the following calendar year
  return new Date(year + 1, NFL_SEASON_CONFIG.seasonEndMonth, NFL_SEASON_CONFIG.seasonEndDay)
}

/**
 * Determine if a given NFL season is complete
 */
export function isSeasonComplete(year: number): boolean {
  const now = new Date()
  const seasonEnd = getSeasonEndDate(year)
  
  // Season is complete if we're past the end date
  return now > seasonEnd
}

/**
 * Get the current NFL season year based on the current date
 */
export function getCurrentNFLSeason(): number {
  const now = new Date()
  const currentCalendarYear = now.getFullYear()
  
  // NFL season spans two calendar years (e.g., 2024 season runs Sept 2024 - Feb 2025)
  // If we're before September, we're still in the previous NFL season
  if (now.getMonth() < NFL_SEASON_CONFIG.seasonStartMonth) {
    return currentCalendarYear - 1
  }
  
  return currentCalendarYear
}

/**
 * Data strategy for different types of seasons
 */
export interface DataStrategy {
  useYTD: boolean
  dataType: 'completed' | 'current' | 'future'
  currentWeek?: number
}

/**
 * Get the appropriate data fetching strategy for a given season
 */
export function getDataStrategy(year: number): DataStrategy {
  const currentNFLSeason = getCurrentNFLSeason()
  
  if (year < currentNFLSeason) {
    // Historical/completed season
    return {
      useYTD: true,
      dataType: 'completed'
    }
  } else if (year === currentNFLSeason) {
    // Current season - use live data
    const currentWeek = getCurrentWeekForSeason(year)
    return {
      useYTD: false,
      dataType: 'current',
      currentWeek
    }
  } else {
    // Future season
    return {
      useYTD: false,
      dataType: 'future',
      currentWeek: 1
    }
  }
}

/**
 * Get year-specific season configuration
 */
export function getYearConfig(year: number): YearSpecificSeasonConfig {
  return YEAR_SPECIFIC_CONFIGS[year] || {
    regularSeasonWeeks: 17,
    totalWeeks: 22,
    regularSeasonEndWeek: 14,
    playoffWeeks: [15, 16, 17, 18, 19, 20, 21, 22],
    seasonStatus: 'future'
  }
}

/**
 * Get total weeks available for a specific year
 */
export function getTotalWeeksForYear(year: number): number {
  return getYearConfig(year).totalWeeks
}

/**
 * Get regular season end week for a specific year
 */
export function getRegularSeasonEndWeek(year: number): number {
  return getYearConfig(year).regularSeasonEndWeek
}

/**
 * Check if a week is in the fantasy playoffs for a given year
 */
export function isPlayoffWeek(year: number, week: number): boolean {
  return getYearConfig(year).playoffWeeks.includes(week)
}

/**
 * Get weeks by category for a specific year
 */
export function getWeeksByCategory(year: number) {
  const config = getYearConfig(year)
  const regularSeasonWeeks = Array.from({ length: config.regularSeasonEndWeek }, (_, i) => i + 1)
  
  return {
    regularSeason: regularSeasonWeeks,
    playoffs: config.playoffWeeks,
    allWeeks: Array.from({ length: config.totalWeeks }, (_, i) => i + 1)
  }
}

/**
 * Get the current NFL week for any season
 */
export function getCurrentWeekForSeason(year: number): number {
  const now = new Date()
  const seasonStart = getSeasonStartDate(year)
  
  // If we're before the season starts, return week 1
  if (now < seasonStart) {
    return 1
  }
  
  // Calculate weeks since season start
  const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
  const currentWeek = weeksSinceStart + 1
  
  // Cap at total weeks using year-specific config
  const totalWeeks = getTotalWeeksForYear(year)
  return Math.max(1, Math.min(totalWeeks, currentWeek))
}