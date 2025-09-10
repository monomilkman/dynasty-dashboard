import { NextRequest, NextResponse } from 'next/server'
import { getCacheKey, getFromCache, setCache } from '@/lib/mfl-api'
import { getCurrentYearString } from '@/lib/utils'
import { fetchWeeklyResults, fetchPlayers, fetchRosters, calculateOptimalLineup, LINEUP_REQUIREMENTS } from '@/lib/mfl-api-endpoints'
import { Player } from '@/lib/mfl'

// Cache duration: 1 hour for completed weeks, 5 minutes for current week
const CACHE_DURATION = 60 * 60 * 1000 // 1 hour
const CURRENT_WEEK_CACHE = 5 * 60 * 1000 // 5 minutes

// CORS headers helper
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
      ? 'https://your-app-domain.vercel.app' 
      : '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders()
  })
}

interface MatchupResult {
  week: number
  franchiseId: string
  opponentId: string
  franchiseScore: number
  opponentScore: number
  result: 'win' | 'loss' | 'tie'
  margin: number
  players: Array<{
    id: string
    name: string
    position: string
    score: number
    shouldStart: boolean
    gameSecondsRemaining?: number
    status?: string
  }>
  // Optimal lineup calculations
  optimalScore?: number
  efficiency?: number
  optimalLineup?: Player[]
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year') || getCurrentYearString()
  const leagueId = searchParams.get('leagueId') || process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_ID || '46221'
  const week = searchParams.get('week') // If not provided, return all weeks
  const franchiseId = searchParams.get('franchiseId') // Optional: get specific team's results
  
  // Determine if this is current week (use shorter cache)
  const currentWeek = getCurrentWeek()
  const weekNum = week ? parseInt(week) : null
  const isCurrentWeek = weekNum === currentWeek
  const cacheTime = isCurrentWeek ? CURRENT_WEEK_CACHE : CACHE_DURATION
  
  // Create cache key
  const cacheKey = getCacheKey('weekly-results', { 
    year, 
    leagueId, 
    week: week || 'all',
    ...(franchiseId && { franchiseId })
  })
  
  try {
    // Check cache first
    const cachedData = getFromCache(cacheKey)
    if (cachedData && (Date.now() - cachedData.timestamp) < cacheTime) {
      console.log('Returning cached weekly results data')
      return NextResponse.json(cachedData.data, { headers: getCorsHeaders() })
    }
    
    // Fetch player database for names
    const playerDatabase = await fetchPlayers(year)
    const playerNames = new Map<string, { name: string; position: string }>()
    
    playerDatabase.players?.player.forEach(player => {
      playerNames.set(player.id, { 
        name: player.name, 
        position: player.position 
      })
    })
    
    let weeklyResults: MatchupResult[] = []
    
    if (week) {
      // Fetch specific week
      const results = await fetchSingleWeek(year, leagueId, week, playerNames)
      weeklyResults = results
    } else {
      // Fetch all weeks (1-17)
      console.log(`Fetching all weekly results for ${year}`)
      
      const allWeekResults = await Promise.all(
        Array.from({ length: 17 }, (_, i) => i + 1).map(async (weekNum) => {
          try {
            return await fetchSingleWeek(year, leagueId, weekNum.toString(), playerNames)
          } catch (error) {
            console.warn(`Failed to fetch week ${weekNum}:`, error)
            return []
          }
        })
      )
      
      weeklyResults = allWeekResults.flat()
    }
    
    // Filter by franchise if requested
    let responseData = weeklyResults
    if (franchiseId) {
      responseData = weeklyResults.filter(result => 
        result.franchiseId === franchiseId || result.opponentId === franchiseId
      )
    }
    
    // Group results by week for easier consumption
    const groupedResults: { [week: number]: MatchupResult[] } = {}
    responseData.forEach(result => {
      if (!groupedResults[result.week]) {
        groupedResults[result.week] = []
      }
      groupedResults[result.week].push(result)
    })
    
    const finalResponse = {
      year: parseInt(year),
      leagueId,
      franchiseId,
      totalResults: responseData.length,
      weeks: Object.keys(groupedResults).map(Number).sort(),
      results: week ? responseData : groupedResults
    }
    
    // Cache the results
    setCache(cacheKey, finalResponse)
    
    console.log(`Successfully fetched weekly results: ${responseData.length} total results`)
    
    return NextResponse.json(finalResponse, { headers: getCorsHeaders() })
    
  } catch (error) {
    console.error('Error fetching weekly results:', error)
    
    // Try to return cached data as fallback
    const cachedData = getFromCache(cacheKey)
    if (cachedData) {
      console.log('Returning stale cached data due to error')
      return NextResponse.json(cachedData.data, { 
        headers: { 
          ...getCorsHeaders(),
          'X-Cache-Status': 'stale'
        } 
      })
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json(
      { 
        error: 'Failed to fetch weekly results',
        details: errorMessage,
        year,
        leagueId,
        week
      }, 
      { 
        status: 500,
        headers: getCorsHeaders()
      }
    )
  }
}

async function fetchSingleWeek(
  year: string, 
  leagueId: string, 
  week: string, 
  playerNames: Map<string, { name: string; position: string }>
): Promise<MatchupResult[]> {
  const weekData = await fetchWeeklyResults(year, leagueId, week)
  const results: MatchupResult[] = []
  
  if (!weekData.weeklyResults?.matchup) {
    console.warn(`No matchup data found for week ${week}`)
    return results
  }
  
  weekData.weeklyResults.matchup.forEach(matchup => {
    if (!Array.isArray(matchup.franchise) || matchup.franchise.length !== 2) {
      console.warn(`Invalid matchup structure in week ${week}`)
      return
    }
    
    const [team1, team2] = matchup.franchise
    
    // Create results for both teams
    const team1Score = parseFloat(team1.score) || 0
    const team2Score = parseFloat(team2.score) || 0
    const margin = Math.abs(team1Score - team2Score)
    
    let team1Result: 'win' | 'loss' | 'tie' = 'tie'
    let team2Result: 'win' | 'loss' | 'tie' = 'tie'
    
    if (team1Score > team2Score) {
      team1Result = 'win'
      team2Result = 'loss'
    } else if (team2Score > team1Score) {
      team1Result = 'loss'
      team2Result = 'win'
    }
    
    // Convert team 1 players to Player objects for optimal lineup calculation
    const team1Players: Player[] = (team1.player || []).map(player => {
      const playerInfo = playerNames.get(player.id)
      return {
        id: player.id,
        name: playerInfo?.name || `Player ${player.id}`,
        team: team1.id,
        position: playerInfo?.position || 'UNK',
        score: parseFloat(player.score) || 0,
        status: (player.status === 'starter' ? 'starter' : 'bench') as Player['status']
      }
    })

    // Calculate optimal lineup for team 1
    const team1OptimalLineup = calculateOptimalLineup(team1Players, LINEUP_REQUIREMENTS)
    const team1OptimalScore = team1OptimalLineup.reduce((sum, p) => sum + p.score, 0)
    const team1Efficiency = team1OptimalScore > 0 ? (team1Score / team1OptimalScore) * 100 : 0

    // Process team 1
    results.push({
      week: parseInt(week),
      franchiseId: team1.id,
      opponentId: team2.id,
      franchiseScore: team1Score,
      opponentScore: team2Score,
      result: team1Result,
      margin: margin,
      players: team1Players.map(player => ({
        id: player.id,
        name: player.name,
        position: player.position,
        score: player.score,
        shouldStart: team1OptimalLineup.some(op => op.id === player.id),
        status: player.status
      })),
      optimalScore: team1OptimalScore,
      efficiency: team1Efficiency,
      optimalLineup: team1OptimalLineup
    })
    
    // Convert team 2 players to Player objects for optimal lineup calculation
    const team2Players: Player[] = (team2.player || []).map(player => {
      const playerInfo = playerNames.get(player.id)
      return {
        id: player.id,
        name: playerInfo?.name || `Player ${player.id}`,
        team: team2.id,
        position: playerInfo?.position || 'UNK',
        score: parseFloat(player.score) || 0,
        status: (player.status === 'starter' ? 'starter' : 'bench') as Player['status']
      }
    })

    // Calculate optimal lineup for team 2
    const team2OptimalLineup = calculateOptimalLineup(team2Players, LINEUP_REQUIREMENTS)
    const team2OptimalScore = team2OptimalLineup.reduce((sum, p) => sum + p.score, 0)
    const team2Efficiency = team2OptimalScore > 0 ? (team2Score / team2OptimalScore) * 100 : 0

    // Process team 2
    results.push({
      week: parseInt(week),
      franchiseId: team2.id,
      opponentId: team1.id,
      franchiseScore: team2Score,
      opponentScore: team1Score,
      result: team2Result,
      margin: margin,
      players: team2Players.map(player => ({
        id: player.id,
        name: player.name,
        position: player.position,
        score: player.score,
        shouldStart: team2OptimalLineup.some(op => op.id === player.id),
        status: player.status
      })),
      optimalScore: team2OptimalScore,
      efficiency: team2Efficiency,
      optimalLineup: team2OptimalLineup
    })
  })
  
  return results
}

// Simple function to get current week (would be better to calculate based on NFL schedule)
function getCurrentWeek(year: number = new Date().getFullYear()): number {
  // Import dynamically to avoid circular dependencies
  const { getCurrentWeekForSeason } = require('@/lib/season-config')
  return getCurrentWeekForSeason(year)
}