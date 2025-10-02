/**
 * MFL Weekly Results API Integration
 * Fetches official lineup data from MFL's weeklyResults endpoint
 */

import { getTotalWeeksForYear, getCurrentWeekForSeason } from './season-config'

export interface WeeklyMatchup {
  franchise: WeeklyFranchise[]
}

export interface WeeklyFranchise {
  id: string
  starters: string // comma-separated player IDs
  score: string
  player: WeeklyPlayer[]
}

export interface WeeklyPlayer {
  id: string
  status: 'starter' | 'nonstarter'
  score: string
  shouldStart?: string
}

export interface WeeklyResultsResponse {
  encoding: string
  weeklyResults: {
    week: string
    matchup: WeeklyMatchup[]
  }
}

export interface PlayerMapping {
  id: string
  position: string
  name: string
  status?: string
}

export interface WeeklyLineup {
  week: number
  franchiseId: string
  starterIds: string[]
  starterData: Array<{
    id: string
    position: string
    score: number
    name: string
  }>
  benchIds: string[]
  benchData: Array<{
    id: string
    position: string
    score: number
    name: string
  }>
  // MFL native optimal data (if available)
  optimalPoints?: number
  shouldStartIds?: string[]
}

/**
 * Fetch weekly results for a specific week with retry logic
 */
export async function fetchWeeklyResults(year: number, leagueId: string, week: number, retryCount = 0): Promise<WeeklyResultsResponse> {
  const url = `https://api.myfantasyleague.com/${year}/export?TYPE=weeklyResults&L=${leagueId}&W=${week}&JSON=1`
  const MAX_RETRIES = 2
  const RETRY_DELAY = 5000 // 5 seconds
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MFL-Dashboard/1.0'
      }
    })
    
    // Handle rate limiting with exponential backoff
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const delayMs = RETRY_DELAY * Math.pow(2, retryCount) // Exponential backoff
      console.log(`Rate limited on week ${week}, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      await delay(delayMs)
      return fetchWeeklyResults(year, leagueId, week, retryCount + 1)
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch weekly results for week ${week}: ${response.status}`)
    }
    
    return response.json()
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delayMs = RETRY_DELAY * Math.pow(2, retryCount)
      console.log(`Error fetching week ${week}, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error)
      await delay(delayMs)
      return fetchWeeklyResults(year, leagueId, week, retryCount + 1)
    }
    throw error
  }
}

/**
 * Rate-limited fetch with delay
 */
async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch all weekly results for the season with rate limiting
 */
export async function fetchAllWeeklyResults(year: number, leagueId: string): Promise<WeeklyLineup[]> {
  console.log(`Fetching all weekly results for league ${leagueId}, year ${year}`)

  // Determine how many weeks to fetch based on current season status
  let maxWeeksToFetch: number
  const currentYear = new Date().getFullYear()

  if (year === currentYear) {
    // For current season, dynamically detect the last completed week
    // getCurrentWeekForSeason returns the current week, so subtract 1 for last completed
    const currentWeek = getCurrentWeekForSeason(year)
    maxWeeksToFetch = Math.max(1, currentWeek - 1) // Ensure at least week 1
    console.log(`${year} current season: fetching completed weeks 1-${maxWeeksToFetch}`)
  } else {
    // For historical seasons, get all weeks
    maxWeeksToFetch = getTotalWeeksForYear(year)
    console.log(`Historical season ${year}: fetching all ${maxWeeksToFetch} weeks`)
  }

  // Fetch weeks one at a time with very conservative delays to avoid 429 errors
  const weeklyData: any[] = []
  const DELAY_MS = 3000 // 3 second delay between each individual week request

  for (let week = 1; week <= maxWeeksToFetch; week++) {
    console.log(`Fetching week ${week} (with 3s delay)...`)
    
    try {
      const weekResult = await fetchWeeklyResults(year, leagueId, week)
      weeklyData.push(weekResult)
      console.log(`Successfully fetched week ${week}`)
      
      // Add delay between each week (except for the last week)
      if (week < maxWeeksToFetch) {
        console.log(`Waiting ${DELAY_MS}ms before next request...`)
        await delay(DELAY_MS)
      }
    } catch (error) {
      console.error(`Error fetching week ${week}:`, error)
      // For now, continue with partial data rather than failing completely
      if (error instanceof Error && error.message.includes('429')) {
        console.log(`Rate limited on week ${week}, continuing with partial data`)
        break // Stop fetching more weeks to avoid further rate limiting
      }
      throw error
    }
  }
  
  console.log(`Successfully fetched ${weeklyData.length} out of ${maxWeeksToFetch} weeks`)
  if (weeklyData.length === 0) {
    throw new Error('No weekly data could be fetched due to rate limiting')
  }
  
  // Also need player mappings to get positions
  const playerMappings = await fetchPlayerMappings(year, leagueId)
  
  // Process all weeks into lineups
  const allLineups: WeeklyLineup[] = []
  
  weeklyData.forEach((weekData, weekIndex) => {
    const week = weekIndex + 1
    
    // Handle different response structures between regular season and playoffs
    let franchisesToProcess: any[] = []
    
    if (weekData.weeklyResults.franchise) {
      // Playoff format: franchises directly under weeklyResults.franchise
      franchisesToProcess = Array.isArray(weekData.weeklyResults.franchise)
        ? weekData.weeklyResults.franchise
        : [weekData.weeklyResults.franchise]
      
      console.log(`Week ${week}: Processing ${franchisesToProcess.length} franchises from playoff format`)
    } else if (weekData.weeklyResults.matchup) {
      // Regular season format: franchises nested under matchups
      const matchups = Array.isArray(weekData.weeklyResults.matchup) 
        ? weekData.weeklyResults.matchup  // Regular season: array of matchups
        : [weekData.weeklyResults.matchup] // Single matchup object
      
      matchups.forEach((matchup: any) => {
        // Handle case where matchup might be the franchise container directly
        const franchises = matchup.franchise || [matchup]
        franchisesToProcess.push(...franchises)
      })
      
      console.log(`Week ${week}: Processing ${franchisesToProcess.length} franchises from regular season format`)
    } else {
      console.warn(`Week ${week}: No franchise data found in response`)
      return
    }
    
    // Process all franchises regardless of format
    franchisesToProcess.forEach(franchise => {
      if (!franchise.id || !franchise.player) {
        console.warn(`Week ${week}: Franchise missing required data:`, franchise)
        return
      }

      // Extract starter IDs from starters field (fallback)
      const starterIds = franchise.starters ? franchise.starters.split(',').filter((id: any) => id.trim()) : []

      // Process ALL players in the franchise (starters + bench)
      const allPlayers = franchise.player || []
      const starterData: any[] = []
      const benchData: any[] = []
      const benchIds: string[] = []
      const shouldStartIds: string[] = []

      allPlayers.forEach((player: any) => {
        const mapping = playerMappings.find((m: any) => m.id === player.id)
        const playerData = {
          id: player.id,
          position: mapping?.position || 'UNKNOWN',
          score: parseFloat(player.score || '0'),
          name: mapping?.name || `Player ${player.id}`
        }

        // Check MFL's shouldStart field for optimal lineup
        if (player.shouldStart === '1') {
          shouldStartIds.push(player.id)
        }

        // Categorize as starter or bench based on status or starter list
        const isStarter = player.status === 'starter' || starterIds.includes(player.id)

        if (isStarter) {
          starterData.push(playerData)
        } else {
          benchData.push(playerData)
          benchIds.push(player.id)
        }
      })

      // Look for MFL's native optimal points
      const optimalPoints = franchise.opt_pts ? parseFloat(franchise.opt_pts) : undefined

      console.log(`Week ${week} - Franchise ${franchise.id}: ${starterData.length} starters, ${benchData.length} bench, ${shouldStartIds.length} shouldStart, optPts=${optimalPoints || 'N/A'}`)

      allLineups.push({
        week,
        franchiseId: franchise.id,
        starterIds,
        starterData,
        benchIds,
        benchData,
        optimalPoints,
        shouldStartIds
      })
    })
  })
  
  console.log(`Successfully processed ${allLineups.length} weekly lineups`)
  return allLineups
}

/**
 * Fetch player mappings (ID to position/name) with retry logic
 * Enhanced with IR/Taxi filtering and better caching
 */
export async function fetchPlayerMappings(year: number, leagueId: string, retryCount = 0): Promise<PlayerMapping[]> {
  const url = `https://api.myfantasyleague.com/${year}/export?TYPE=players&L=${leagueId}&JSON=1`
  const MAX_RETRIES = 2
  const RETRY_DELAY = 5000 // 5 seconds
  
  try {
    console.log(`Fetching player mappings: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'MFL-Dashboard/1.0'
      }
    })
    
    // Handle rate limiting with exponential backoff
    if (response.status === 429 && retryCount < MAX_RETRIES) {
      const delayMs = RETRY_DELAY * Math.pow(2, retryCount)
      console.log(`Rate limited on player mappings, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`)
      await delay(delayMs)
      return fetchPlayerMappings(year, leagueId, retryCount + 1)
    }
    
    if (!response.ok) {
      throw new Error(`Failed to fetch player mappings: ${response.status}`)
    }
    
    const data = await response.json()
    
    // The players API returns different structure - need to check actual format
    if (data.players && data.players.player) {
      return data.players.player
        .filter((player: any) => {
          // Filter out IR/Taxi/Inactive players if status is available
          if (player.status) {
            const status = player.status.toLowerCase()
            return !['injured_reserve', 'ir', 'taxi', 'taxi_squad', 'inactive'].includes(status)
          }
          // If no status field, include all players (will be filtered by starter status later)
          return true
        })
        .map((player: any) => ({
          id: player.id,
          position: normalizePlayerPosition(player.position),
          name: player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim(),
          status: player.status || 'active'
        }))
    }
    
    return []
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      const delayMs = RETRY_DELAY * Math.pow(2, retryCount)
      console.log(`Error fetching player mappings, retrying in ${delayMs}ms (attempt ${retryCount + 1}/${MAX_RETRIES}):`, error)
      await delay(delayMs)
      return fetchPlayerMappings(year, leagueId, retryCount + 1)
    }
    throw error
  }
}

/**
 * Normalize player position codes for consistency
 */
function normalizePlayerPosition(position: string): string {
  if (!position) return 'UNKNOWN'
  
  const positionMap: Record<string, string> = {
    'PK': 'PK',  // Keep as PK for now, gets converted to K in calculations
    'DE': 'DL',
    'DT': 'DL',
    'NT': 'DL',  // Nose Tackle -> Defensive Line
    'OLB': 'LB',
    'MLB': 'LB',
    'ILB': 'LB',
    'FS': 'S',   // Free Safety -> Safety
    'SS': 'S'    // Strong Safety -> Safety
  }
  
  return positionMap[position.toUpperCase()] || position.toUpperCase()
}

/**
 * Calculate accurate position totals using official weekly lineup data
 */
export function calculateAccuratePositionTotals(
  weeklyLineups: WeeklyLineup[], 
  franchiseId: string,
  weekFilter?: number[] // Optional array of weeks to include (empty array or undefined = all weeks)
) {
  let franchiseLineups = weeklyLineups.filter(lineup => lineup.franchiseId === franchiseId)
  
  // Apply week filter if provided and not empty
  if (weekFilter && weekFilter.length > 0) {
    franchiseLineups = franchiseLineups.filter(lineup => weekFilter.includes(lineup.week))
  }
  
  const totals = {
    QB: 0, RB: 0, WR: 0, TE: 0, 'O-Flex': 0, K: 0,
    DL: 0, LB: 0, CB: 0, S: 0, 'D-Flex': 0
  }
  
  franchiseLineups.forEach(lineup => {
    // Group starters by position
    const startersByPos = {
      QB: lineup.starterData.filter(p => p.position === 'QB'),
      RB: lineup.starterData.filter(p => p.position === 'RB'), 
      WR: lineup.starterData.filter(p => p.position === 'WR'),
      TE: lineup.starterData.filter(p => p.position === 'TE'),
      K: lineup.starterData.filter(p => p.position === 'PK'), // PK = Kicker
      DL: lineup.starterData.filter(p => ['DT', 'DE', 'DL'].includes(p.position)),
      LB: lineup.starterData.filter(p => p.position === 'LB'),
      CB: lineup.starterData.filter(p => p.position === 'CB'),
      S: lineup.starterData.filter(p => p.position === 'S')
    }
    
    // Sort by score (highest first)
    const sortByScore = (a: any, b: any) => b.score - a.score
    
    // Add required position points (best performers)
    totals.QB += startersByPos.QB.sort(sortByScore).slice(0, 1).reduce((sum, p) => sum + p.score, 0)
    totals.RB += startersByPos.RB.sort(sortByScore).slice(0, 2).reduce((sum, p) => sum + p.score, 0)
    totals.WR += startersByPos.WR.sort(sortByScore).slice(0, 2).reduce((sum, p) => sum + p.score, 0)
    totals.TE += startersByPos.TE.sort(sortByScore).slice(0, 1).reduce((sum, p) => sum + p.score, 0)
    totals.K += startersByPos.K.sort(sortByScore).slice(0, 1).reduce((sum, p) => sum + p.score, 0)
    totals.DL += startersByPos.DL.sort(sortByScore).slice(0, 2).reduce((sum, p) => sum + p.score, 0)
    totals.LB += startersByPos.LB.sort(sortByScore).slice(0, 3).reduce((sum, p) => sum + p.score, 0)
    totals.CB += startersByPos.CB.sort(sortByScore).slice(0, 2).reduce((sum, p) => sum + p.score, 0)
    totals.S += startersByPos.S.sort(sortByScore).slice(0, 2).reduce((sum, p) => sum + p.score, 0)
    
    // Calculate flex positions (remaining players after required spots filled)
    const oFlexCandidates = [
      ...startersByPos.RB.sort(sortByScore).slice(2), // Extra RBs
      ...startersByPos.WR.sort(sortByScore).slice(2), // Extra WRs
      ...startersByPos.TE.sort(sortByScore).slice(1)  // Extra TEs
    ].sort(sortByScore)
    
    const dFlexCandidates = [
      ...startersByPos.DL.sort(sortByScore).slice(2), // Extra DLs
      ...startersByPos.LB.sort(sortByScore).slice(3), // Extra LBs
      ...startersByPos.CB.sort(sortByScore).slice(2), // Extra CBs
      ...startersByPos.S.sort(sortByScore).slice(2)   // Extra Ss
    ].sort(sortByScore)
    
    // Add best flex player
    totals['O-Flex'] += oFlexCandidates.slice(0, 1).reduce((sum, p) => sum + p.score, 0)
    totals['D-Flex'] += dFlexCandidates.slice(0, 1).reduce((sum, p) => sum + p.score, 0)
  })
  
  // Round all totals to 2 decimal places
  Object.keys(totals).forEach(key => {
    totals[key as keyof typeof totals] = Math.round(totals[key as keyof typeof totals] * 100) / 100
  })
  
  return totals
}