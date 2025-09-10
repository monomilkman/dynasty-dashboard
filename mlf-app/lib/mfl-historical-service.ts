// Enhanced MFL Historical Data Service
// Provides accurate data for historical seasons (2021-2024)

import { fetchWithRetry } from './mfl-api'
import { getYearSpecificHeaders } from './mfl-api-keys'
import { 
  MFLWeeklyResultsResponse,
  MFLPlayerScoresResponse,
  MFLPlayersResponse,
  MFLRosterResponse,
  Player,
  Team,
  LineupRequirements
} from './mfl'
import { calculatePositionPoints } from './mfl-api-endpoints'

interface HistoricalTeamData {
  franchiseId: string
  startersPoints: number
  benchPoints: number
  potentialPoints: number
  offensePoints: number
  defensePoints: number
  positionBreakdown: {
    qbPoints: number
    rbPoints: number
    wrPoints: number
    tePoints: number
    kPoints: number
    dlPoints: number
    lbPoints: number
    cbPoints: number
    sPoints: number
  }
  actualStarters: string[]
  actualBench: string[]
}

interface YTDWeekData {
  week: number
  matchup: Array<{
    franchise: Array<{
      id: string
      opt_pts?: string
      score?: string
      player?: Array<{
        id: string
        score: string
        status: 'starter' | 'nonstarter'
        shouldStart?: string
      }>
    }>
  }>
}

/**
 * Fetch and process complete historical data for a season
 */
export async function fetchHistoricalSeasonData(
  year: string,
  leagueId: string = '46221'
): Promise<Map<string, HistoricalTeamData>> {
  console.log(`*** FETCHING COMPLETE HISTORICAL DATA FOR ${year} ***`)
  
  const baseUrl = process.env.MFL_API_BASE_URL || 'https://api.myfantasyleague.com'
  const headers = getYearSpecificHeaders(parseInt(year))
  
  try {
    // First, fetch dynamic lineup requirements for this year
    console.log(`Fetching dynamic lineup requirements for ${year}`)
    const yearLineupRequirements = await fetchLineupRequirements(year, leagueId)
    if (yearLineupRequirements) {
      console.log(`Using ${year} lineup requirements:`, yearLineupRequirements)
    } else {
      console.log(`Using default lineup requirements for ${year}`)
    }
    
    // Fetch YTD weekly results - this contains the most complete data
    const ytdUrl = `${baseUrl}/${year}/export?TYPE=weeklyResults&L=${leagueId}&W=YTD&JSON=1`
    console.log(`Fetching YTD data: ${ytdUrl}`)
    
    const ytdResponse = await fetchWithRetry(ytdUrl, { headers }) as MFLWeeklyResultsResponse
    
    if (!ytdResponse?.allWeeklyResults?.weeklyResults) {
      console.error('No YTD weekly results found')
      return new Map()
    }
    
    // Also fetch player database for position information
    const playersUrl = `${baseUrl}/${year}/export?TYPE=players&JSON=1`
    const playersResponse = await fetchWithRetry(playersUrl, { headers }) as MFLPlayersResponse
    
    // Build player position lookup
    const playerPositions = new Map<string, string>()
    if (playersResponse.players?.player) {
      playersResponse.players.player.forEach(player => {
        playerPositions.set(player.id, player.position)
      })
    }
    
    console.log(`Processing ${ytdResponse.allWeeklyResults.weeklyResults.length} weeks of YTD data`)
    
    return parseYTDData(ytdResponse.allWeeklyResults.weeklyResults as YTDWeekData[], playerPositions)
    
  } catch (error) {
    console.error(`Error fetching historical data for ${year}:`, error)
    return new Map()
  }
}

/**
 * Parse YTD weekly results data to extract complete season stats
 */
function parseYTDData(
  ytdWeeks: YTDWeekData[], 
  playerPositions: Map<string, string>
): Map<string, HistoricalTeamData> {
  
  const teamsData = new Map<string, HistoricalTeamData>()
  const franchiseIds = new Set<string>()
  
  console.log('*** PARSING YTD DATA ***')
  
  // First pass: collect all franchise IDs
  ytdWeeks.forEach((week, weekIndex) => {
    if (week?.matchup) {
      const matchups = Array.isArray(week.matchup) ? week.matchup : [week.matchup]
      matchups.forEach(matchup => {
        if (matchup?.franchise) {
          const franchises = Array.isArray(matchup.franchise) ? matchup.franchise : [matchup.franchise]
          franchises.forEach(franchise => {
            if (franchise.id) {
              franchiseIds.add(franchise.id)
            }
          })
        }
      })
    }
  })
  
  console.log(`Found franchise IDs: ${Array.from(franchiseIds).sort().join(', ')}`)
  
  // Initialize team data for each franchise
  franchiseIds.forEach(fId => {
    teamsData.set(fId, {
      franchiseId: fId,
      startersPoints: 0,
      benchPoints: 0,
      potentialPoints: 0,
      offensePoints: 0,
      defensePoints: 0,
      positionBreakdown: {
        qbPoints: 0,
        rbPoints: 0,
        wrPoints: 0,
        tePoints: 0,
        kPoints: 0,
        dlPoints: 0,
        lbPoints: 0,
        cbPoints: 0,
        sPoints: 0
      },
      actualStarters: [],
      actualBench: []
    })
  })
  
  // Second pass: aggregate data across all weeks
  ytdWeeks.forEach((week, weekIndex) => {
    if (week?.matchup) {
      const matchups = Array.isArray(week.matchup) ? week.matchup : [week.matchup]
      
      matchups.forEach(matchup => {
        if (matchup?.franchise) {
          const franchises = Array.isArray(matchup.franchise) ? matchup.franchise : [matchup.franchise]
          
          franchises.forEach(franchise => {
            if (!franchise.id || !teamsData.has(franchise.id)) return
            
            const teamData = teamsData.get(franchise.id)!
            
            // Add potential points (official MFL calculation)
            if (franchise.opt_pts) {
              teamData.potentialPoints += parseFloat(franchise.opt_pts) || 0
            }
            
            // Process player data
            if (franchise.player && Array.isArray(franchise.player)) {
              franchise.player.forEach(player => {
                const playerScore = parseFloat(player.score) || 0
                const position = playerPositions.get(player.id) || 'UNKNOWN'
                
                if (player.status === 'starter') {
                  teamData.startersPoints += playerScore
                  if (!teamData.actualStarters.includes(player.id)) {
                    teamData.actualStarters.push(player.id)
                  }
                  
                  // Add to position totals
                  addToPositionBreakdown(teamData.positionBreakdown, position, playerScore)
                  
                  // Add to offense/defense totals
                  if (isOffensePosition(position)) {
                    teamData.offensePoints += playerScore
                  } else if (isDefensePosition(position)) {
                    teamData.defensePoints += playerScore
                  }
                  
                } else if (player.status === 'nonstarter') {
                  teamData.benchPoints += playerScore
                  if (!teamData.actualBench.includes(player.id)) {
                    teamData.actualBench.push(player.id)
                  }
                }
              })
            }
          })
        }
      })
    }
  })
  
  // Log results for verification
  teamsData.forEach((teamData, franchiseId) => {
    console.log(`Historical data for ${franchiseId}: S=${teamData.startersPoints.toFixed(2)}, B=${teamData.benchPoints.toFixed(2)}, P=${teamData.potentialPoints.toFixed(2)}, O=${teamData.offensePoints.toFixed(2)}, D=${teamData.defensePoints.toFixed(2)}`)
    console.log(`  Starters: ${teamData.actualStarters.length}, Bench: ${teamData.actualBench.length}`)
  })
  
  return teamsData
}

/**
 * Add player score to appropriate position breakdown
 */
function addToPositionBreakdown(
  breakdown: HistoricalTeamData['positionBreakdown'], 
  position: string, 
  points: number
) {
  switch (position.toUpperCase()) {
    case 'QB':
      breakdown.qbPoints += points
      break
    case 'RB':
      breakdown.rbPoints += points
      break
    case 'WR':
      breakdown.wrPoints += points
      break
    case 'TE':
      breakdown.tePoints += points
      break
    case 'K':
    case 'PK':
      breakdown.kPoints += points
      break
    case 'DL':
    case 'DE':
    case 'DT':
      breakdown.dlPoints += points
      break
    case 'LB':
      breakdown.lbPoints += points
      break
    case 'CB':
      breakdown.cbPoints += points
      break
    case 'S':
      breakdown.sPoints += points
      break
  }
}

/**
 * Check if position is offense
 */
function isOffensePosition(position: string): boolean {
  const offensePositions = ['QB', 'RB', 'WR', 'TE', 'K', 'PK']
  return offensePositions.includes(position.toUpperCase())
}

/**
 * Check if position is defense
 */
function isDefensePosition(position: string): boolean {
  const defensePositions = ['DL', 'DE', 'DT', 'LB', 'CB', 'S']
  return defensePositions.includes(position.toUpperCase())
}

/**
 * Fetch dynamic lineup requirements for a specific year
 */
export async function fetchLineupRequirements(
  year: string,
  leagueId: string = '46221'
): Promise<LineupRequirements | null> {
  const baseUrl = process.env.MFL_API_BASE_URL || 'https://api.myfantasyleague.com'
  const headers = getYearSpecificHeaders(parseInt(year))
  
  try {
    const leagueUrl = `${baseUrl}/${year}/export?TYPE=league&L=${leagueId}&JSON=1`
    const response = await fetchWithRetry(leagueUrl, { headers })
    
    if (response?.league?.starters) {
      return parseLineupRequirements(response.league.starters)
    }
    
    console.warn(`No lineup requirements found for ${year}, using defaults`)
    return null
    
  } catch (error) {
    console.error(`Error fetching lineup requirements for ${year}:`, error)
    return null
  }
}

/**
 * Parse lineup requirements from MFL API response
 */
function parseLineupRequirements(startersConfig: any): LineupRequirements {
  console.log('Parsing lineup requirements from:', startersConfig)
  
  // Default requirements (2024-2025 season structure)
  const defaults: LineupRequirements = {
    qb: 1,
    rb: 2,
    wr: 2,
    te: 1,
    offenseFlex: 1,
    k: 1,
    dl: 2,
    lb: 3,
    cb: 2,
    s: 2,
    defenseFlex: 1,
    total: 18
  }
  
  // If no config provided, return defaults
  if (!startersConfig) {
    console.log('No starter config provided, using defaults')
    return defaults
  }
  
  try {
    // MFL API returns starter requirements as a string like "QB,RB,RB,WR,WR,TE,FLEX,K,DL,DL,LB,LB,LB,CB,CB,S,S,FLEX"
    // Or as an object with position counts
    
    let positionCounts = { ...defaults }
    
    if (typeof startersConfig === 'string') {
      // Parse comma-separated position list
      const positions = startersConfig.split(',').map(p => p.trim().toUpperCase())
      
      // Reset counts and count positions
      positionCounts = {
        qb: 0, rb: 0, wr: 0, te: 0, offenseFlex: 0, k: 0,
        dl: 0, lb: 0, cb: 0, s: 0, defenseFlex: 0, total: positions.length
      }
      
      positions.forEach(pos => {
        switch (pos) {
          case 'QB': positionCounts.qb++; break
          case 'RB': positionCounts.rb++; break
          case 'WR': positionCounts.wr++; break
          case 'TE': positionCounts.te++; break
          case 'K': case 'PK': positionCounts.k++; break
          case 'DL': case 'DE': case 'DT': positionCounts.dl++; break
          case 'LB': positionCounts.lb++; break
          case 'CB': positionCounts.cb++; break
          case 'S': positionCounts.s++; break
          case 'FLEX': 
            // Try to determine if this is offense or defense flex based on context
            // For now, assume first flex is offense, second is defense
            if (positionCounts.offenseFlex === 0) {
              positionCounts.offenseFlex++
            } else {
              positionCounts.defenseFlex++
            }
            break
        }
      })
      
      console.log(`Parsed ${positions.length} positions:`, positionCounts)
      
    } else if (typeof startersConfig === 'object') {
      // Handle object format if API returns structured data
      console.log('Starter config is object format:', startersConfig)
      // This would need to be implemented based on actual MFL API structure
    }
    
    // Validate the parsed requirements
    const totalPositions = Object.values(positionCounts).reduce((sum: number, count: number) => 
      typeof count === 'number' ? sum + count : sum, 0) - positionCounts.total
    
    if (totalPositions > 0 && totalPositions < 25) { // Reasonable range
      console.log(`Successfully parsed lineup requirements: ${totalPositions} total positions`)
      return positionCounts
    } else {
      console.warn(`Parsed lineup requirements seem invalid (${totalPositions} positions), using defaults`)
      return defaults
    }
    
  } catch (error) {
    console.error('Error parsing lineup requirements:', error)
    return defaults
  }
}