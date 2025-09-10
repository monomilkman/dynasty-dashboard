import { NextRequest, NextResponse } from 'next/server'
import { fetchAllWeeklyResults, calculateAccuratePositionTotals } from '@/lib/mfl-weekly-results'
import { getCacheKey, getFromCache, setCache, clearCache } from '@/lib/mfl-api'
import { getCurrentYearString } from '@/lib/utils'
import { getTotalWeeksForYear } from '@/lib/season-config'
import { getOwnerName } from '@/lib/owner-mappings'

// Define position totals interface
interface PositionTotals {
  QB: number
  RB: number
  WR: number
  TE: number
  K: number
  DL: number
  LB: number
  CB: number
  S: number
  'O-Flex': number
  'D-Flex': number
}

interface TeamPositionalData {
  franchiseId: string
  teamName: string
  manager: string
  year: number
  positionTotals: PositionTotals
}

interface LeaguePositionalData {
  teams: TeamPositionalData[]
  leagueSettings: {
    year: number
    rosterRequirements: {
      QB: number
      RB: number
      WR: number
      TE: number
      'O-Flex': number
      K: number
      DL: number
      LB: number
      CB: number
      S: number
      'D-Flex': number
    }
  }
  positionRankings: {
    [position: string]: {
      franchiseId: string
      teamName: string
      points: number
      rank: number
    }[]
  }
  weeklyLineups?: any[]
}

// Cache duration: Much longer to avoid frequent API calls
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000 // 7 days for old seasons
const CURRENT_WEEK_CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours during active games (increased from 1 hour)

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

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year') || getCurrentYearString()
  const leagueId = searchParams.get('leagueId') || process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_ID || '46221'
  
  const cacheKey = getCacheKey('positions', { year, leagueId })
  clearCache(cacheKey)
  
  return NextResponse.json({ success: true, message: 'Positional data cache cleared' })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year') || getCurrentYearString()
  const leagueId = searchParams.get('leagueId') || process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_ID || '46221'
  const forceRefresh = searchParams.get('refresh') === 'true'
  const weeksParam = searchParams.get('weeks') // Comma-separated week numbers
  const managersParam = searchParams.get('managers') // Comma-separated manager names
  const franchiseIdsParam = searchParams.get('franchiseIds') // Comma-separated franchise IDs
  
  // Parse weeks filter using dynamic total weeks
  const totalWeeks = getTotalWeeksForYear(parseInt(year))
  let weekFilter: number[] | undefined
  if (weeksParam) {
    weekFilter = weeksParam.split(',').map(w => parseInt(w.trim())).filter(w => !isNaN(w) && w >= 1 && w <= totalWeeks)
  }
  
  // Parse manager filter
  let managerFilter: string[] | undefined
  if (managersParam) {
    managerFilter = managersParam.split(',').map(m => m.trim()).filter(m => m.length > 0)
  }
  
  // Parse franchise ID filter
  let franchiseFilter: string[] | undefined
  if (franchiseIdsParam) {
    franchiseFilter = franchiseIdsParam.split(',').map(f => f.trim()).filter(f => f.length > 0)
  }
  
  console.log(`[Positions API] Year ${year} has ${totalWeeks} total weeks available`)
  if (managerFilter) {
    console.log(`[Positions API] Filtering by managers: ${managerFilter.join(', ')}`)
  }
  if (franchiseFilter) {
    console.log(`[Positions API] Filtering by franchise IDs: ${franchiseFilter.join(', ')}`)
  }
  
  // Create cache key (include weeks and managers in cache key for different filtered results)
  const cacheKeyData = { 
    year, 
    leagueId, 
    weeks: weekFilter?.join(',') || 'all',
    managers: managerFilter?.join(',') || 'all',
    franchises: franchiseFilter?.join(',') || 'all'
  }
  const cacheKey = getCacheKey('positions', cacheKeyData)
  
  try {
    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cachedData = getFromCache(cacheKey)
      if (cachedData) {
        // Determine appropriate cache duration based on season status
        const isCurrentSeason = parseInt(year) === new Date().getFullYear()
        const cacheDuration = isCurrentSeason ? CURRENT_WEEK_CACHE_DURATION : CACHE_DURATION
        
        if ((Date.now() - cachedData.timestamp) < cacheDuration) {
          console.log('Returning cached positional data')
          return NextResponse.json(cachedData.data, {
            headers: {
              ...getCorsHeaders(),
              'X-Cache-Status': 'HIT',
              'X-Cache-Age': String(Date.now() - cachedData.timestamp)
            }
          })
        }
      }
    }

    // For week filtering, check if we have cached full season data that we can filter from
    if (weekFilter && !forceRefresh) {
      const fullSeasonCacheKey = getCacheKey('positions', { year, leagueId, weeks: 'all' })
      const fullSeasonData = getFromCache(fullSeasonCacheKey)
      
      if (fullSeasonData && fullSeasonData.data && (fullSeasonData.data as any).weeklyLineups) {
        console.log(`Using cached full season data to filter for weeks ${weekFilter.join(',')}`)
        
        // Re-calculate position totals for the requested weeks only
        const filteredData = { ...fullSeasonData.data } as any
        filteredData.teams = filteredData.teams.map((team: any) => ({
          ...team,
          positionTotals: calculateAccuratePositionTotals(
            (fullSeasonData.data as any).weeklyLineups,
            team.franchiseId,
            weekFilter
          )
        }))
        
        // Recalculate position rankings with the filtered data
        const positionKeys = ['QB', 'RB', 'WR', 'TE', 'O-Flex', 'K', 'DL', 'LB', 'CB', 'S', 'D-Flex']
        const positionRankings: any = {}
        
        for (const position of positionKeys) {
          const teamRankings = filteredData.teams
            .map((team: any) => ({
              franchiseId: team.franchiseId,
              points: team.positionTotals[position] || 0,
              teamName: team.teamName
            }))
            .sort((a: any, b: any) => b.points - a.points)
            .map((team: any, index: number) => ({
              ...team,
              rank: index + 1
            }))
          
          positionRankings[position] = teamRankings
        }
        
        filteredData.positionRankings = positionRankings
        
        // Cache this filtered result
        setCache(cacheKey, filteredData)
        
        return NextResponse.json({
          ...filteredData,
          metadata: {
            ...filteredData.metadata,
            filteredFrom: 'cached-full-season',
            weekFilter: weekFilter.join(','),
            processedAt: new Date().toISOString()
          }
        }, {
          headers: {
            ...getCorsHeaders(),
            'X-Cache-Status': 'FILTERED',
            'X-Week-Filter': weekFilter.join(',')
          }
        })
      }
    }

    console.log(`Fetching fresh positional data for league ${leagueId}, year ${year}`)
    
    // Fetch fresh data using MFL API
    const startTime = Date.now()
    const positionalData: LeaguePositionalData = await fetchPositionalDataFromAPI(
      leagueId, 
      parseInt(year), 
      weekFilter, 
      managerFilter,
      franchiseFilter
    )
    const processingTime = Date.now() - startTime
    
    console.log(`Positional data processing completed in ${processingTime}ms`)
    
    // Validate that we got meaningful data
    const teamsWithData = positionalData.teams.filter(team => 
      Object.values(team.positionTotals).some(total => total > 0)
    )
    if (teamsWithData.length === 0) {
      throw new Error('No positional data could be calculated from MFL API')
    }
    
    // Cache the results
    setCache(cacheKey, positionalData)
    
    // Return the data with metadata
    const response = {
      ...positionalData,
      metadata: {
        processedAt: new Date().toISOString(),
        processingTimeMs: processingTime,
        teamsProcessed: positionalData.teams.length,
        teamsWithData: teamsWithData.length,
        version: '2.0'
      }
    }
    
    return NextResponse.json(response, {
      headers: {
        ...getCorsHeaders(),
        'X-Cache-Status': 'MISS',
        'X-Processing-Time': String(processingTime)
      }
    })
    
  } catch (error) {
    console.error('Error in positional data endpoint:', error)
    
    // Try to return cached data if available (any cache, even very stale)
    const cachedData = getFromCache(cacheKey)
    if (cachedData) {
      console.log('Returning stale cached data due to error')
      return NextResponse.json({
        ...(cachedData.data as any),
        error: 'Fresh data unavailable due to API rate limiting, showing cached results',
        details: error instanceof Error ? error.message : 'Unknown error',
        cacheAge: Date.now() - cachedData.timestamp
      }, {
        headers: {
          ...getCorsHeaders(),
          'X-Cache-Status': 'ERROR-FALLBACK',
          'X-Cache-Age': String(Date.now() - cachedData.timestamp)
        }
      })
    }
    
    // Also check for any cached "all weeks" data if we're filtering
    if (weekFilter) {
      const fullSeasonCacheKey = getCacheKey('positions', { year, leagueId, weeks: 'all' })
      const fullSeasonData = getFromCache(fullSeasonCacheKey)
      if (fullSeasonData) {
        console.log('Returning stale full season data and filtering client-side due to API limits')
        return NextResponse.json({
          ...(fullSeasonData.data as any),
          error: 'Week filtering unavailable due to API limits, showing full season data',
          details: error instanceof Error ? error.message : 'Unknown error',
          cacheAge: Date.now() - fullSeasonData.timestamp
        }, {
          headers: {
            ...getCorsHeaders(),
            'X-Cache-Status': 'ERROR-FALLBACK-FULL-SEASON',
            'X-Cache-Age': String(Date.now() - fullSeasonData.timestamp)
          }
        })
      }
    }
    
    // Return error response
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json({
      error: 'Failed to fetch positional data',
      details: errorMessage,
      timestamp: new Date().toISOString()
    }, { 
      status: 500,
      headers: getCorsHeaders()
    })
  }
}

// Helper endpoint to check cache status
export async function HEAD(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year') || getCurrentYearString()
  const leagueId = searchParams.get('leagueId') || process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_ID || '46221'
  
  const cacheKey = getCacheKey('positions', { year, leagueId })
  const cachedData = getFromCache(cacheKey)
  
  if (cachedData) {
    const age = Date.now() - cachedData.timestamp
    const isCurrentSeason = parseInt(year) === new Date().getFullYear()
    const cacheDuration = isCurrentSeason ? CURRENT_WEEK_CACHE_DURATION : CACHE_DURATION
    const isStale = age > cacheDuration
    
    return new Response(null, {
      status: 200,
      headers: {
        ...getCorsHeaders(),
        'X-Cache-Status': isStale ? 'STALE' : 'FRESH',
        'X-Cache-Age': String(age),
        'X-Cache-Max-Age': String(cacheDuration),
        'X-Teams-Count': String((cachedData.data as any).teams?.length || 0)
      }
    })
  }
  
  return new Response(null, {
    status: 404,
    headers: {
      ...getCorsHeaders(),
      'X-Cache-Status': 'MISS'
    }
  })
}

/**
 * Fetch positional data using MFL API (instead of web scraping)
 */
async function fetchPositionalDataFromAPI(
  leagueId: string, 
  year: number,
  weekFilter?: number[],
  managerFilter?: string[],
  franchiseFilter?: string[]
): Promise<LeaguePositionalData> {
  console.log(`Fetching positional data for league ${leagueId}, year ${year}`)
  
  if (managerFilter && managerFilter.length > 0) {
    console.log(`Applying manager filter: ${managerFilter.join(', ')}`)
  }
  if (franchiseFilter && franchiseFilter.length > 0) {
    console.log(`Applying franchise filter: ${franchiseFilter.join(', ')}`)
  }
  
  // First, get all weekly lineups from MFL API
  const weeklyLineups = await fetchAllWeeklyResults(year, leagueId)
  
  if (weeklyLineups.length === 0) {
    throw new Error('No weekly lineup data available from MFL API')
  }
  
  // Get all franchise IDs from the lineup data
  const franchiseIds = [...new Set(weeklyLineups.map(lineup => lineup.franchiseId))]
  console.log(`Found ${franchiseIds.length} franchises: ${franchiseIds.join(', ')}`)
  
  // Get team names from MFL API
  const teamNames = await fetchTeamNames(leagueId, year)
  
  // Calculate position totals for each team
  let teams: TeamPositionalData[] = franchiseIds.map(franchiseId => {
    const positionTotals = calculateAccuratePositionTotals(weeklyLineups, franchiseId, weekFilter)
    
    return {
      franchiseId,
      teamName: teamNames[franchiseId] || `Team ${franchiseId}`,
      manager: getOwnerName(franchiseId, year),
      year,
      positionTotals
    }
  })
  
  // Apply manager/franchise filtering if specified
  if (franchiseFilter && franchiseFilter.length > 0) {
    teams = teams.filter(team => franchiseFilter.includes(team.franchiseId))
    console.log(`Filtered to ${teams.length} teams by franchise IDs: ${franchiseFilter.join(', ')}`)
  } else if (managerFilter && managerFilter.length > 0) {
    teams = teams.filter(team => managerFilter.includes(team.manager))
    console.log(`Filtered to ${teams.length} teams by managers: ${managerFilter.join(', ')}`)
  }
  
  // Handle case where no teams match the filter
  if ((managerFilter && managerFilter.length > 0) || (franchiseFilter && franchiseFilter.length > 0)) {
    if (teams.length === 0) {
      console.log('No teams match the applied filters, returning empty dataset')
      return {
        teams: [],
        leagueSettings: {
          year,
          rosterRequirements: {
            QB: 1, RB: 2, WR: 2, TE: 1, 'O-Flex': 1, K: 1,
            DL: 2, LB: 3, CB: 2, S: 2, 'D-Flex': 1
          }
        },
        positionRankings: {},
        weeklyLineups: weekFilter ? weeklyLineups.filter(lineup => 
          weekFilter.includes(lineup.week)
        ) : weeklyLineups
      }
    }
  }
  
  // Calculate position rankings
  const positionRankings = calculatePositionRankings(teams)
  
  // Define roster requirements by year
  const rosterRequirements = {
    QB: 1, RB: 2, WR: 2, TE: 1, 'O-Flex': 1, K: 1,
    DL: 2, LB: 3, CB: 2, S: 2, 'D-Flex': 1
  }
  
  return {
    teams,
    leagueSettings: {
      year,
      rosterRequirements
    },
    positionRankings,
    weeklyLineups: weekFilter ? weeklyLineups.filter(lineup => 
      weekFilter.includes(lineup.week)
    ) : weeklyLineups
  }
}

/**
 * Fetch team names from MFL API
 */
async function fetchTeamNames(leagueId: string, year: number): Promise<Record<string, string>> {
  try {
    const leagueUrl = `https://api.myfantasyleague.com/${year}/export?TYPE=league&L=${leagueId}&JSON=1`
    const response = await fetch(leagueUrl, {
      headers: {
        'User-Agent': 'MFL-Dashboard/1.0'
      }
    })
    
    if (!response.ok) {
      console.warn(`Failed to fetch league data: ${response.status}`)
      return {}
    }
    
    const data = await response.json()
    const teamNames: Record<string, string> = {}
    
    // Extract franchise data from league info
    if (data.league && data.league.franchises && data.league.franchises.franchise) {
      const franchises = Array.isArray(data.league.franchises.franchise) 
        ? data.league.franchises.franchise 
        : [data.league.franchises.franchise]
      
      franchises.forEach((franchise: any) => {
        if (franchise.id && franchise.name) {
          teamNames[franchise.id] = franchise.name
        }
      })
    }
    
    return teamNames
  } catch (error) {
    console.error('Error fetching team names:', error)
    return {}
  }
}

/**
 * Calculate rankings for each position
 */
function calculatePositionRankings(teams: TeamPositionalData[]): LeaguePositionalData['positionRankings'] {
  const positions: (keyof PositionTotals)[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S', 'O-Flex', 'D-Flex']
  const rankings: LeaguePositionalData['positionRankings'] = {}
  
  positions.forEach(position => {
    const positionData = teams.map(team => ({
      franchiseId: team.franchiseId,
      teamName: team.teamName,
      points: team.positionTotals[position]
    })).sort((a, b) => b.points - a.points)
    
    rankings[position] = positionData.map((team, index) => ({
      ...team,
      rank: index + 1
    }))
  })
  
  return rankings
}