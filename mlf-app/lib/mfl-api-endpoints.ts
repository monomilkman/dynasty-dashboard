// MFL API Endpoint Utilities
// This file contains specific functions for each MFL API endpoint

import { fetchWithRetry } from './mfl-api'
import { getYearSpecificHeaders } from './mfl-api-keys'
import { 
  MFLPlayerScoresResponse, 
  MFLRosterResponse, 
  MFLWeeklyResultsResponse, 
  MFLPlayersResponse, 
  MFLLiveScoreResponse,
  Player,
  LineupRequirements 
} from './mfl'

// League lineup requirements (2024-2025 season)
export const LINEUP_REQUIREMENTS: LineupRequirements = {
  qb: 1,
  rb: 2,
  wr: 2,
  te: 1,
  offenseFlex: 1, // RB/WR/TE
  k: 1,
  dl: 2,
  lb: 3,
  cb: 2,
  s: 2,
  defenseFlex: 1, // DL/LB/CB/S
  total: 18
}

// Base configuration
const DEFAULT_LEAGUE_ID = '46221'
const DEFAULT_USER_AGENT = 'dynasty-dashboard'

// Get base API configuration
function getApiConfig() {
  const baseUrl = process.env.MFL_API_BASE_URL || 'https://api.myfantasyleague.com'
  const userAgent = process.env.MFL_USER_AGENT || DEFAULT_USER_AGENT
  
  return { baseUrl, userAgent }
}

// Year-specific request headers for accurate historical data
function getRequestHeaders(year?: string) {
  const { userAgent } = getApiConfig()
  
  if (year) {
    // Use year-specific authentication for maximum accuracy
    return getYearSpecificHeaders(parseInt(year), userAgent)
  }
  
  // Fallback to default API key
  const apiKey = process.env.MFL_API_KEY
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    'Accept': 'application/json',
    'Cache-Control': 'no-cache'
  }
  
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`
  }
  
  return headers
}

/**
 * Fetch player scores for a specific week
 * @param year - Season year 
 * @param leagueId - League ID
 * @param week - Week number or "YTD" for year-to-date
 * @returns Player scores data
 */
export async function fetchPlayerScores(
  year: string, 
  leagueId: string = DEFAULT_LEAGUE_ID, 
  week: string | number = 'YTD'
): Promise<MFLPlayerScoresResponse> {
  const { baseUrl } = getApiConfig()
  const url = `${baseUrl}/${year}/export?TYPE=playerScores&L=${leagueId}&W=${week}&JSON=1`
  
  console.log(`Fetching player scores: ${url}`)
  
  const response = await fetchWithRetry(url, {
    headers: getRequestHeaders(year)
  })
  
  return response as MFLPlayerScoresResponse
}

/**
 * Fetch team rosters 
 * @param year - Season year
 * @param leagueId - League ID 
 * @param franchiseId - Specific franchise ID (optional)
 * @returns Roster data
 */
export async function fetchRosters(
  year: string, 
  leagueId: string = DEFAULT_LEAGUE_ID, 
  franchiseId?: string
): Promise<MFLRosterResponse> {
  const { baseUrl } = getApiConfig()
  let url = `${baseUrl}/${year}/export?TYPE=rosters&L=${leagueId}&JSON=1`
  
  if (franchiseId) {
    url += `&FRANCHISE=${franchiseId}`
  }
  
  console.log(`Fetching rosters: ${url}`)
  
  const response = await fetchWithRetry(url, {
    headers: getRequestHeaders(year)
  })
  
  return response as MFLRosterResponse
}

/**
 * Fetch weekly results with player data
 * @param year - Season year
 * @param leagueId - League ID
 * @param week - Week number
 * @returns Weekly results with player scores
 */
export async function fetchWeeklyResults(
  year: string, 
  leagueId: string = DEFAULT_LEAGUE_ID, 
  week: string | number
): Promise<MFLWeeklyResultsResponse> {
  const { baseUrl } = getApiConfig()
  const url = `${baseUrl}/${year}/export?TYPE=weeklyResults&L=${leagueId}&W=${week}&JSON=1`
  
  console.log(`Fetching weekly results: ${url}`)
  
  const response = await fetchWithRetry(url, {
    headers: getRequestHeaders(year)
  })
  
  return response as MFLWeeklyResultsResponse
}

/**
 * Fetch year-to-date weekly results for historical seasons
 * This provides complete season aggregated starter/non-starter data
 * @param year - Season year
 * @param leagueId - League ID
 * @returns YTD weekly results with complete season breakdowns
 */
export async function fetchYTDWeeklyResults(
  year: string, 
  leagueId: string = DEFAULT_LEAGUE_ID
): Promise<MFLWeeklyResultsResponse> {
  const { baseUrl } = getApiConfig()
  const url = `${baseUrl}/${year}/export?TYPE=weeklyResults&L=${leagueId}&W=YTD&JSON=1`
  
  console.log(`Fetching YTD weekly results: ${url}`)
  
  const response = await fetchWithRetry(url, {
    headers: getRequestHeaders(year)
  })
  
  return response as MFLWeeklyResultsResponse
}

/**
 * Fetch player database
 * @param year - Season year
 * @returns Player database
 */
export async function fetchPlayers(year: string): Promise<MFLPlayersResponse> {
  const { baseUrl } = getApiConfig()
  const url = `${baseUrl}/${year}/export?TYPE=players&JSON=1`
  
  console.log(`Fetching players: ${url}`)
  
  const response = await fetchWithRetry(url, {
    headers: getRequestHeaders(year)
  })
  
  return response as MFLPlayersResponse
}

/**
 * Fetch live scoring data
 * @param year - Season year
 * @param leagueId - League ID
 * @param week - Week number (optional, defaults to current)
 * @returns Live scoring data
 */
export async function fetchLiveScoring(
  year: string, 
  leagueId: string = DEFAULT_LEAGUE_ID, 
  week?: string | number
): Promise<MFLLiveScoreResponse> {
  const { baseUrl } = getApiConfig()
  let url = `${baseUrl}/${year}/export?TYPE=liveScoring&L=${leagueId}&JSON=1`
  
  if (week) {
    url += `&W=${week}`
  }
  
  console.log(`Fetching live scoring: ${url}`)
  
  const response = await fetchWithRetry(url, {
    headers: getRequestHeaders(year)
  })
  
  return response as MFLLiveScoreResponse
}

/**
 * Combine player data from multiple sources to create full player objects
 * @param playerScores - Player scores from API
 * @param playerDatabase - Player names/info from database
 * @param rosterData - Roster/status info
 * @returns Combined player data
 */
export function combinePlayerData(
  playerScores: MFLPlayerScoresResponse,
  playerDatabase: MFLPlayersResponse,
  rosterData: MFLRosterResponse
): Player[] {
  // Create lookup maps
  const playerInfoMap = new Map<string, { name: string; team: string; position: string }>()
  const rosterStatusMap = new Map<string, { franchiseId: string; status: string }>()
  
  // Build player info lookup
  const playerList = playerDatabase.players?.player
  if (Array.isArray(playerList)) {
    playerList.forEach(player => {
      playerInfoMap.set(player.id, {
        name: player.name,
        team: player.team,
        position: player.position
      })
    })
  }
  
  // Build roster status lookup
  const franchiseList = rosterData.rosters?.franchise
  if (Array.isArray(franchiseList)) {
    // Multiple franchises
    franchiseList.forEach(franchise => {
      const players = Array.isArray((franchise as any).player) ? (franchise as any).player : [(franchise as any).player].filter(Boolean)
      players.forEach((player: any) => {
        rosterStatusMap.set(player.id, {
          franchiseId: (franchise as any).id,
          status: player.status || 'active'
        })
      })
    })
  } else if (franchiseList) {
    // Single franchise
    const franchise = franchiseList
    const players = Array.isArray((franchise as any).player) ? (franchise as any).player : [(franchise as any).player].filter(Boolean)
    players.forEach((player: any) => {
      rosterStatusMap.set(player.id, {
        franchiseId: (franchise as any).id,
        status: player.status || 'active'
      })
    })
  }
  
  // Combine all data
  const players: Player[] = []
  
  const scoreList = playerScores.playerScores?.playerScore
  if (Array.isArray(scoreList)) {
    scoreList.forEach(scoreData => {
    const playerInfo = playerInfoMap.get(scoreData.id)
    const rosterInfo = rosterStatusMap.get(scoreData.id)
    
    if (playerInfo && rosterInfo) {
      // Determine status
      let status: Player['status'] = 'bench'
      if (rosterInfo.status === 'INJURED_RESERVE') {
        status = 'ir'
      } else if (rosterInfo.status === 'TAXI_SQUAD') {
        status = 'taxi'
      }
      
      players.push({
        id: scoreData.id,
        name: playerInfo.name,
        team: rosterInfo.franchiseId,
        position: playerInfo.position,
        score: parseFloat(scoreData.score) || 0,
        status
      })
    }
    })
  }
  
  return players
}

/**
 * Calculate optimal lineup based on league requirements
 * @param players - Array of players for a team
 * @param requirements - Lineup requirements
 * @returns Optimal starting lineup
 */
export function calculateOptimalLineup(
  players: Player[],
  requirements: LineupRequirements = LINEUP_REQUIREMENTS
): Player[] {
  // Filter out IR and taxi players
  const availablePlayers = players.filter(p => p.status !== 'ir' && p.status !== 'taxi')
  
  // Sort by score (highest first)
  availablePlayers.sort((a, b) => b.score - a.score)
  
  const lineup: Player[] = []
  const remaining = [...availablePlayers]
  
  // Fill required positions
  function fillPosition(position: string, count: number) {
    const positionPlayers = remaining.filter(p => p.position === position)
    const selected = positionPlayers.slice(0, count)
    
    selected.forEach(player => {
      lineup.push({ ...player, status: 'starter' })
      const index = remaining.indexOf(player)
      if (index > -1) remaining.splice(index, 1)
    })
  }
  
  // Fill required positions
  fillPosition('QB', requirements.qb)
  fillPosition('RB', requirements.rb)
  fillPosition('WR', requirements.wr)
  fillPosition('TE', requirements.te)
  
  // Fill kicker position (MFL uses 'PK', not 'K')
  function fillKicker(count: number) {
    const kickers = remaining.filter(p => ['K', 'PK'].includes(p.position))
    const selected = kickers.slice(0, count)
    
    selected.forEach(player => {
      lineup.push({ ...player, status: 'starter' })
      const index = remaining.indexOf(player)
      if (index > -1) remaining.splice(index, 1)
    })
  }
  fillKicker(requirements.k)
  
  // Fill defensive line positions (MFL uses 'DE' and 'DT', not 'DL')
  function fillDefensiveLine(count: number) {
    const defensiveLinemen = remaining.filter(p => ['DL', 'DE', 'DT'].includes(p.position))
    defensiveLinemen.sort((a, b) => b.score - a.score) // Sort by score within position
    const selected = defensiveLinemen.slice(0, count)
    
    selected.forEach(player => {
      lineup.push({ ...player, status: 'starter' })
      const index = remaining.indexOf(player)
      if (index > -1) remaining.splice(index, 1)
    })
  }
  fillDefensiveLine(requirements.dl)
  
  fillPosition('LB', requirements.lb)
  fillPosition('CB', requirements.cb)
  fillPosition('S', requirements.s)
  
  // Fill flex positions (take highest remaining)
  // Offense flex (RB/WR/TE)
  const offenseFlexCandidates = remaining.filter(p => 
    ['RB', 'WR', 'TE'].includes(p.position)
  ).slice(0, requirements.offenseFlex)
  
  offenseFlexCandidates.forEach(player => {
    lineup.push({ ...player, status: 'starter' })
    const index = remaining.indexOf(player)
    if (index > -1) remaining.splice(index, 1)
  })
  
  // Defense flex (DL/LB/CB/S) - MFL uses DE/DT instead of DL
  const defenseFlexCandidates = remaining.filter(p => 
    ['DL', 'DE', 'DT', 'LB', 'CB', 'S'].includes(p.position)
  ).slice(0, requirements.defenseFlex)
  
  defenseFlexCandidates.forEach(player => {
    lineup.push({ ...player, status: 'starter' })
    const index = remaining.indexOf(player)
    if (index > -1) remaining.splice(index, 1)
  })
  
  return lineup
}

/**
 * Calculate points by position for a set of players
 * @param players - Players to analyze
 * @returns Points breakdown by position
 */
export function calculatePositionPoints(players: Player[]): {
  qbPoints: number
  rbPoints: number  
  wrPoints: number
  tePoints: number
  kPoints: number
  dlPoints: number
  lbPoints: number
  cbPoints: number
  sPoints: number
  offensePoints: number
  defensePoints: number
  offenseFlexPoints: number
  defenseFlexPoints: number
} {
  const positions = {
    qbPoints: 0,
    rbPoints: 0,
    wrPoints: 0,
    tePoints: 0,
    kPoints: 0,
    dlPoints: 0,
    lbPoints: 0,
    cbPoints: 0,
    sPoints: 0,
    offensePoints: 0,
    defensePoints: 0,
    offenseFlexPoints: 0,
    defenseFlexPoints: 0
  }
  
  players.forEach(player => {
    const points = player.score
    
    switch (player.position) {
      case 'QB':
        positions.qbPoints += points
        positions.offensePoints += points
        break
      case 'RB':
        positions.rbPoints += points
        positions.offensePoints += points
        break
      case 'WR':
        positions.wrPoints += points
        positions.offensePoints += points
        break
      case 'TE':
        positions.tePoints += points
        positions.offensePoints += points
        break
      case 'K':
      case 'PK': // MFL uses PK instead of K
        positions.kPoints += points
        positions.offensePoints += points
        break
      case 'DL':
      case 'DE': // MFL uses DE (defensive end)
      case 'DT': // MFL uses DT (defensive tackle)
        positions.dlPoints += points
        positions.defensePoints += points
        break
      case 'LB':
        positions.lbPoints += points
        positions.defensePoints += points
        break
      case 'CB':
        positions.cbPoints += points
        positions.defensePoints += points
        break
      case 'S':
        positions.sPoints += points
        positions.defensePoints += points
        break
    }
  })
  
  return positions
}