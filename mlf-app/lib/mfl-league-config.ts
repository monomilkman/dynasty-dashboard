// MFL League Configuration Service
// Fetches dynamic season settings from the MFL API

import { fetchWithRetry } from './mfl-api'
import { getYearSpecificHeaders } from './mfl-api-keys'
import { getYearConfig, YearSpecificSeasonConfig } from './season-config'

export interface MFLLeagueConfig {
  lastRegularSeasonWeek?: number
  playoffWeek?: number
  h2hWeeks?: number[]
  totalWeeks?: number
}

/**
 * Fetch league configuration from MFL API
 * This attempts to get the actual season structure from MFL
 */
export async function fetchMFLLeagueConfig(
  year: string,
  leagueId: string = '46221'
): Promise<MFLLeagueConfig | null> {
  
  const baseUrl = process.env.MFL_API_BASE_URL || 'https://api.myfantasyleague.com'
  const headers = getYearSpecificHeaders(parseInt(year))
  
  try {
    // Fetch league configuration
    const leagueUrl = `${baseUrl}/${year}/export?TYPE=league&L=${leagueId}&JSON=1`
    console.log(`Fetching league config for season structure: ${leagueUrl}`)
    
    const response = await fetchWithRetry(leagueUrl, { headers })
    
    if ((response as any)?.league) {
      const league = (response as any).league
      
      // Extract season structure information
      const config: MFLLeagueConfig = {}
      
      // Look for regular season end week
      if (league.lastRegularSeasonWeek) {
        config.lastRegularSeasonWeek = parseInt(league.lastRegularSeasonWeek)
      }
      
      // Look for playoff start week
      if (league.playoffWeek) {
        config.playoffWeek = parseInt(league.playoffWeek)
      }
      
      // Look for head-to-head weeks array
      if (league.h2hWeeks) {
        config.h2hWeeks = Array.isArray(league.h2hWeeks) 
          ? league.h2hWeeks.map((w: any) => parseInt(w))
          : [parseInt(league.h2hWeeks)]
      }
      
      console.log(`Retrieved MFL league config for ${year}:`, config)
      return config
    }
    
    console.warn(`No league configuration found in MFL API response for ${year}`)
    return null
    
  } catch (error) {
    console.error(`Error fetching MFL league config for ${year}:`, error)
    return null
  }
}

/**
 * Get enhanced season configuration combining static config with MFL API data
 */
export async function getEnhancedSeasonConfig(
  year: number,
  leagueId: string = '46221'
): Promise<YearSpecificSeasonConfig> {
  
  // Start with static configuration
  const staticConfig = getYearConfig(year)
  
  // For completed seasons, try to get actual MFL data
  if (staticConfig.seasonStatus === 'completed') {
    try {
      const mflConfig = await fetchMFLLeagueConfig(year.toString(), leagueId)
      
      if (mflConfig) {
        // Merge MFL data with static config
        const enhancedConfig = { ...staticConfig }
        
        if (mflConfig.lastRegularSeasonWeek) {
          enhancedConfig.regularSeasonEndWeek = mflConfig.lastRegularSeasonWeek
        }
        
        if (mflConfig.h2hWeeks && mflConfig.h2hWeeks.length > 0) {
          // Use actual h2h weeks to determine total available weeks
          const maxWeek = Math.max(...mflConfig.h2hWeeks)
          // Add a buffer for playoff/toilet bowl weeks beyond regular season
          enhancedConfig.totalWeeks = Math.max(maxWeek + 8, staticConfig.totalWeeks)
        }
        
        console.log(`Enhanced ${year} config with MFL data:`, enhancedConfig)
        return enhancedConfig
      }
    } catch (error) {
      console.warn(`Could not enhance ${year} config with MFL data, using static:`, error)
    }
  }
  
  console.log(`Using static config for ${year}:`, staticConfig)
  return staticConfig
}

/**
 * Get total weeks for a year, with MFL API enhancement
 */
export async function getEnhancedTotalWeeks(
  year: number, 
  leagueId: string = '46221'
): Promise<number> {
  const config = await getEnhancedSeasonConfig(year, leagueId)
  return config.totalWeeks
}

/**
 * Get regular season end week for a year, with MFL API enhancement
 */
export async function getEnhancedRegularSeasonEndWeek(
  year: number,
  leagueId: string = '46221'
): Promise<number> {
  const config = await getEnhancedSeasonConfig(year, leagueId)
  return config.regularSeasonEndWeek
}

/**
 * Cache for enhanced configurations to avoid repeated API calls
 */
const configCache = new Map<string, { config: YearSpecificSeasonConfig, timestamp: number }>()
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour

/**
 * Get cached enhanced season configuration
 */
export async function getCachedEnhancedSeasonConfig(
  year: number,
  leagueId: string = '46221'
): Promise<YearSpecificSeasonConfig> {
  
  const cacheKey = `${year}-${leagueId}`
  const cached = configCache.get(cacheKey)
  
  // Return cached version if available and fresh
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
    return cached.config
  }
  
  // Fetch new config
  const config = await getEnhancedSeasonConfig(year, leagueId)
  
  // Cache the result
  configCache.set(cacheKey, {
    config,
    timestamp: Date.now()
  })
  
  return config
}