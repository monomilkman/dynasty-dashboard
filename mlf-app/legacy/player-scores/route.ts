import { NextRequest, NextResponse } from 'next/server'
import { getCacheKey, getFromCache, setCache } from '@/lib/mfl-api'
import { getCurrentYearString } from '@/lib/utils'
import { 
  fetchPlayerScores, 
  fetchPlayers, 
  fetchRosters, 
  combinePlayerData,
  calculateOptimalLineup,
  calculatePositionPoints,
  LINEUP_REQUIREMENTS 
} from '@/lib/mfl-api-endpoints'

// Cache duration: 5 minutes during games, 1 hour after games
const CACHE_DURATION = 5 * 60 * 1000

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year') || getCurrentYearString()
  const leagueId = searchParams.get('leagueId') || process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_ID || '46221'
  const week = searchParams.get('week') || 'YTD'
  const franchiseId = searchParams.get('franchiseId') // Optional: get specific team
  
  // Create cache key
  const cacheKey = getCacheKey('player-scores', { year, leagueId, week, franchiseId })
  
  try {
    // Check cache first
    const cachedData = getFromCache(cacheKey)
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
      console.log('Returning cached player scores data')
      return NextResponse.json(cachedData.data, { headers: getCorsHeaders() })
    }
    
    console.log(`Fetching player scores for year: ${year}, week: ${week}, franchise: ${franchiseId || 'all'}`)
    
    // Fetch all required data in parallel
    const [playerScores, playerDatabase, rosters] = await Promise.all([
      fetchPlayerScores(year, leagueId, week),
      fetchPlayers(year),
      fetchRosters(year, leagueId, franchiseId)
    ])
    
    // Combine player data
    const combinedPlayers = combinePlayerData(playerScores, playerDatabase, rosters)
    
    // Group players by franchise
    const franchiseData: { [franchiseId: string]: any } = {}
    
    // Group players by their franchise
    combinedPlayers.forEach(player => {
      if (!franchiseData[player.team]) {
        franchiseData[player.team] = {
          franchiseId: player.team,
          players: [],
          starters: [],
          bench: [],
          ir: [],
          taxi: [],
          totalPoints: 0,
          startersPoints: 0,
          benchPoints: 0,
          potentialPoints: 0,
          positionBreakdown: {}
        }
      }
      franchiseData[player.team].players.push(player)
    })
    
    // Calculate lineup optimizations and statistics for each franchise
    Object.keys(franchiseData).forEach(franchiseId => {
      const franchise = franchiseData[franchiseId]
      const players = franchise.players
      
      // Separate players by status
      franchise.starters = players.filter((p: any) => p.status === 'starter')
      franchise.bench = players.filter((p: any) => p.status === 'bench')
      franchise.ir = players.filter((p: any) => p.status === 'ir')
      franchise.taxi = players.filter((p: any) => p.status === 'taxi')
      
      // Calculate optimal lineup
      const optimalLineup = calculateOptimalLineup(players, LINEUP_REQUIREMENTS)
      franchise.optimalLineup = optimalLineup
      
      // Calculate points
      franchise.totalPoints = players.reduce((sum: number, p: any) => sum + p.score, 0)
      franchise.startersPoints = franchise.starters.reduce((sum: number, p: any) => sum + p.score, 0)
      franchise.benchPoints = franchise.bench.reduce((sum: number, p: any) => sum + p.score, 0)
      franchise.potentialPoints = optimalLineup.reduce((sum: number, p: any) => sum + p.score, 0)
      
      // Calculate position breakdown
      franchise.positionBreakdown = calculatePositionPoints(players)
      
      // Calculate efficiency
      franchise.efficiency = franchise.potentialPoints > 0 
        ? (franchise.startersPoints / franchise.potentialPoints) * 100 
        : 0
    })
    
    // If specific franchise requested, return only that franchise
    const responseData = franchiseId 
      ? franchiseData[franchiseId] || null
      : franchiseData
    
    if (!responseData) {
      return NextResponse.json(
        { error: 'Franchise not found', franchiseId }, 
        { status: 404, headers: getCorsHeaders() }
      )
    }
    
    // Cache the results
    setCache(cacheKey, responseData)
    
    console.log(`Successfully processed player scores for ${Object.keys(franchiseData).length} franchises`)
    
    return NextResponse.json(responseData, { headers: getCorsHeaders() })
    
  } catch (error) {
    console.error('Error fetching player scores:', error)
    
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
        error: 'Failed to fetch player scores',
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