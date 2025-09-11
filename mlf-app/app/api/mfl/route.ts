import { NextRequest, NextResponse } from 'next/server'
import { normalizeTeamData, MFLStandingsResponse, Team } from '@/lib/mfl'
import { fetchWithRetry, getCacheKey, getFromCache, setCache, clearCache } from '@/lib/mfl-api'
import { getOwnerName } from '@/lib/owner-mappings'
import { getCurrentYearString } from '@/lib/utils'
import { 
  fetchPlayerScores, 
  fetchPlayers, 
  fetchRosters, 
  fetchWeeklyResults,
  fetchYTDWeeklyResults,
  combinePlayerData,
  calculateOptimalLineup,
  calculatePositionPoints,
  LINEUP_REQUIREMENTS 
} from '@/lib/mfl-api-endpoints'
import { getOfficialTeamStats, hasOfficialData } from '@/lib/historical-data/2024-official-values'
import { getYearSpecificHeaders } from '@/lib/mfl-api-keys'
import { fetchHistoricalSeasonData, fetchLineupRequirements } from '@/lib/mfl-historical-service'
import { validateSeasonData, sanitizeTeamData, generateDataQualityReport } from '@/lib/mfl-data-validator'
import { scrapeLeagueStats } from '@/lib/mfl-web-scraper'
import { fetchAllWeeklyResults, calculateAccuratePositionTotals } from '@/lib/mfl-weekly-results'


// Cache duration: 5 minutes for standings data  
const CACHE_DURATION = 5 * 60 * 1000

// Function to parse weeks parameter like "1,2,3" or "1-14"
function parseWeeksParameter(weeksParam: string): number[] {
  const weeks: number[] = []
  const parts = weeksParam.split(',')
  
  for (const part of parts) {
    const trimmed = part.trim()
    if (trimmed.includes('-')) {
      // Handle range like "1-14"
      const [start, end] = trimmed.split('-').map(n => parseInt(n))
      if (!isNaN(start) && !isNaN(end) && start <= end) {
        for (let i = start; i <= end; i++) {
          if (!weeks.includes(i)) weeks.push(i)
        }
      }
    } else {
      // Handle single week
      const week = parseInt(trimmed)
      if (!isNaN(week) && !weeks.includes(week)) {
        weeks.push(week)
      }
    }
  }
  
  return weeks.sort((a, b) => a - b)
}

// Function to aggregate weekly data for selected weeks
async function aggregateWeeklyData(year: string, leagueId: string, weeks: number[]): Promise<Team[]> {
  const baseUrl = process.env.MFL_API_BASE_URL || 'https://api.myfantasyleague.com'
  
  // Get franchise names from league data
  const leagueUrl = `${baseUrl}/${year}/export?TYPE=league&L=${leagueId}&JSON=1`
  const headers = getYearSpecificHeaders(parseInt(year), process.env.MFL_USER_AGENT || 'dynasty-dashboard')
  const leagueResponse = await fetchWithRetry(leagueUrl, { headers })
  
  const franchiseNames: { [key: string]: string } = {}
  const leagueData = (leagueResponse as any)?.league
  if (leagueData?.franchises?.franchise) {
    const franchises = Array.isArray(leagueData.franchises.franchise) 
      ? leagueData.franchises.franchise 
      : [leagueData.franchises.franchise]
    
    franchises.forEach((f: any) => {
      if (f.id) {
        franchiseNames[f.id] = f.name || `Team ${f.id}`
      }
    })
  }
  
  // Fetch weekly results for all specified weeks
  const teamStats: { [franchiseId: string]: {
    startersPoints: number
    benchPoints: number
    offensePoints: number
    defensePoints: number
    totalPoints: number
    potentialPoints: number
    qbPoints: number
    rbPoints: number
    wrPoints: number
    tePoints: number
    kPoints: number
    dlPoints: number
    lbPoints: number
    cbPoints: number
    sPoints: number
    wins: number
    losses: number
    ties: number
    pointsFor: number
    pointsAgainst: number
  }} = {}
  
  // Fetch data for each week and aggregate
  for (const week of weeks) {
    try {
      const weeklyUrl = `${baseUrl}/${year}/export?TYPE=weeklyResults&L=${leagueId}&W=${week}&JSON=1`
      const weeklyData = await fetchWithRetry(weeklyUrl, { headers })
      
      if ((weeklyData as any)?.weeklyResults?.matchup) {
        const matchups = Array.isArray((weeklyData as any).weeklyResults.matchup) 
          ? (weeklyData as any).weeklyResults.matchup 
          : [(weeklyData as any).weeklyResults.matchup]
        
        // Process each matchup
        for (const matchup of matchups) {
          if (!Array.isArray(matchup.franchise) || matchup.franchise.length !== 2) continue
          
          const [team1, team2] = matchup.franchise
          
          // Process both teams in the matchup
          for (const team of [team1, team2]) {
            const franchiseId = team.id
            if (!teamStats[franchiseId]) {
              teamStats[franchiseId] = {
                startersPoints: 0, benchPoints: 0, offensePoints: 0, defensePoints: 0,
                totalPoints: 0, potentialPoints: 0, qbPoints: 0, rbPoints: 0, wrPoints: 0,
                tePoints: 0, kPoints: 0, dlPoints: 0, lbPoints: 0, cbPoints: 0, sPoints: 0,
                wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0
              }
            }
            
            const teamScore = parseFloat(team.score) || 0
            const opponentScore = parseFloat(team1 === team ? team2.score : team1.score) || 0
            
            // Aggregate team stats
            teamStats[franchiseId].startersPoints += teamScore
            teamStats[franchiseId].totalPoints += teamScore
            teamStats[franchiseId].pointsFor += teamScore
            teamStats[franchiseId].pointsAgainst += opponentScore
            
            // Track wins/losses/ties
            if (teamScore > opponentScore) {
              teamStats[franchiseId].wins += 1
            } else if (teamScore < opponentScore) {
              teamStats[franchiseId].losses += 1
            } else {
              teamStats[franchiseId].ties += 1
            }
            
            // Process individual players for this week
            if (team.player) {
              const players = Array.isArray(team.player) ? team.player : [team.player]
              
              // Get player names
              const playerDatabase = await fetchPlayers(year)
              const playerNames = new Map<string, { name: string; position: string }>()
              
              playerDatabase.players?.player.forEach((player: any) => {
                playerNames.set(player.id, { 
                  name: player.name, 
                  position: player.position 
                })
              })
              
              // Convert to Player objects for optimal lineup calculation
              const teamPlayers = players.map((player: any) => {
                const playerInfo = playerNames.get(player.id)
                return {
                  id: player.id,
                  name: playerInfo?.name || `Player ${player.id}`,
                  team: franchiseId,
                  position: playerInfo?.position || 'UNK',
                  score: parseFloat(player.score) || 0,
                  status: (player.status === 'starter' ? 'starter' : 'bench') as 'starter' | 'bench'
                }
              })
              
              // Calculate optimal lineup for this week
              const optimalLineup = calculateOptimalLineup(teamPlayers, LINEUP_REQUIREMENTS)
              const weekOptimalScore = optimalLineup.reduce((sum, p) => sum + p.score, 0)
              
              teamStats[franchiseId].potentialPoints += weekOptimalScore
              
              // Aggregate position points and bench points
              for (const player of teamPlayers) {
                if (player.status === 'bench') {
                  teamStats[franchiseId].benchPoints += player.score
                }
                
                // Position-specific aggregation
                switch (player.position) {
                  case 'QB':
                    teamStats[franchiseId].qbPoints += player.score
                    teamStats[franchiseId].offensePoints += player.score
                    break
                  case 'RB':
                    teamStats[franchiseId].rbPoints += player.score
                    teamStats[franchiseId].offensePoints += player.score
                    break
                  case 'WR':
                    teamStats[franchiseId].wrPoints += player.score
                    teamStats[franchiseId].offensePoints += player.score
                    break
                  case 'TE':
                    teamStats[franchiseId].tePoints += player.score
                    teamStats[franchiseId].offensePoints += player.score
                    break
                  case 'K':
                  case 'PK':
                    teamStats[franchiseId].kPoints += player.score
                    teamStats[franchiseId].offensePoints += player.score
                    break
                  case 'DL':
                  case 'DE':
                  case 'DT':
                    teamStats[franchiseId].dlPoints += player.score
                    teamStats[franchiseId].defensePoints += player.score
                    break
                  case 'LB':
                    teamStats[franchiseId].lbPoints += player.score
                    teamStats[franchiseId].defensePoints += player.score
                    break
                  case 'CB':
                    teamStats[franchiseId].cbPoints += player.score
                    teamStats[franchiseId].defensePoints += player.score
                    break
                  case 'S':
                    teamStats[franchiseId].sPoints += player.score
                    teamStats[franchiseId].defensePoints += player.score
                    break
                }
              }
            }
          }
        }
      }
    } catch (weekError) {
      console.warn(`Failed to fetch week ${week} data:`, weekError)
    }
  }
  
  // Convert to Team objects
  return Object.keys(teamStats).map(franchiseId => {
    const stats = teamStats[franchiseId]
    return {
      id: franchiseId,
      manager: getOwnerName(franchiseId, parseInt(year)),
      teamName: franchiseNames[franchiseId] || `Team ${franchiseId}`,
      year: parseInt(year),
      ...stats,
      winPercentage: stats.wins + stats.losses + stats.ties > 0 
        ? stats.wins / (stats.wins + stats.losses + stats.ties) 
        : 0,
      offenseFlexPoints: 0, // Could calculate if needed
      defenseFlexPoints: 0  // Could calculate if needed
    } as Team
  }).sort((a, b) => b.totalPoints - a.totalPoints)
}

// Function to get current NFL week based on 2025 season schedule (estimate only)
function getCurrentWeek(): number {
  const now = new Date()
  
  // 2025 NFL season start date (Thursday, September 4, 2025)
  const seasonStart = new Date(2025, 8, 4) // Month 8 = September (0-indexed), year 2025
  
  if (now < seasonStart) {
    return 1 // Preseason/before season starts
  }
  
  // Calculate estimated week based on calendar
  const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
  const estimatedWeek = weeksSinceStart + 1
  
  // Cap at Week 17 (regular season) + playoffs
  return Math.max(1, Math.min(18, estimatedWeek))
}

// Cache for latest available week detection (5-minute cache during season)
const weekDetectionCache = new Map<string, { week: number; timestamp: number }>()
const WEEK_DETECTION_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Permanent solution: Smart week detection that actually checks what data exists
async function getLatestAvailableWeek(year: string, leagueId: string): Promise<number> {
  const cacheKey = `${year}-${leagueId}`
  
  // Check cache first
  const cached = weekDetectionCache.get(cacheKey)
  if (cached && (Date.now() - cached.timestamp) < WEEK_DETECTION_CACHE_DURATION) {
    console.log(`Using cached latest week: Week ${cached.week}`)
    return cached.week
  }
  
  console.log(`Detecting latest available week for ${year} season...`)
  
  // Start from estimated week and check up to one week ahead
  const estimatedWeek = getCurrentWeek()
  const maxCheckWeek = Math.min(estimatedWeek + 1, 18)
  
  // Check weeks from highest to lowest to find latest available
  for (let week = maxCheckWeek; week >= 1; week--) {
    try {
      console.log(`Checking Week ${week} for data availability...`)
      const playerScores = await fetchPlayerScores(year, leagueId, week.toString())
      
      if (playerScores?.playerScores?.playerScore && playerScores.playerScores.playerScore.length > 0) {
        console.log(`✓ Week ${week} has ${playerScores.playerScores.playerScore.length} player scores - using this week`)
        
        // Cache the result
        weekDetectionCache.set(cacheKey, { week, timestamp: Date.now() })
        return week
      } else {
        console.log(`✗ Week ${week} has no player score data`)
      }
    } catch (error) {
      console.log(`✗ Week ${week} fetch failed:`, error instanceof Error ? error.message : error)
    }
  }
  
  console.log(`No weeks found with data, defaulting to Week 1`)
  
  // Cache Week 1 as fallback
  weekDetectionCache.set(cacheKey, { week: 1, timestamp: Date.now() })
  return 1
}

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
  
  const cacheKey = getCacheKey('standings', { year, leagueId })
  clearCache(cacheKey)
  
  return NextResponse.json({ success: true, message: 'Cache cleared' })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year') || getCurrentYearString()
  const leagueId = searchParams.get('leagueId') || process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_ID || '46221'
  const weeksParam = searchParams.get('weeks') // Comma-separated weeks like "1,2,3" or "1-14"
  
  // Parse weeks parameter
  let selectedWeeks: number[] | undefined
  if (weeksParam) {
    selectedWeeks = parseWeeksParameter(weeksParam)
    console.log(`Week filtering requested for ${year}: weeks ${selectedWeeks.join(',')}`)
  }
  
  // Determine season type early for API decisions
  const isHistoricalSeason = parseInt(year) < 2025
  console.log(`Processing ${year}: ${isHistoricalSeason ? 'Historical' : 'Current'} season`)
  
  // Create cache key (include weeks for filtered requests)
  const cacheKey = getCacheKey('standings', { 
    year, 
    leagueId, 
    weeks: selectedWeeks ? selectedWeeks.join(',') : 'all' 
  })
  
  try {
    // Check cache first
    const cachedData = getFromCache(cacheKey)
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
      console.log('Returning cached MFL data')
      return NextResponse.json(cachedData.data)
    }
    
    // If week filtering is requested, use weekly aggregation instead of YTD data
    if (selectedWeeks && selectedWeeks.length > 0) {
      console.log(`Week filtering requested: aggregating data for weeks ${selectedWeeks.join(',')}`)
      const aggregatedData = await aggregateWeeklyData(year, leagueId, selectedWeeks)
      
      // Cache the aggregated result
      setCache(cacheKey, aggregatedData)
      
      return NextResponse.json(aggregatedData)
    }
    
    // Build MFL API URL with enhanced standings data for historical seasons
    const baseUrl = process.env.MFL_API_BASE_URL || 'https://api.myfantasyleague.com'
    const standingsParams = isHistoricalSeason ? '&ALL=1' : '' // Get enhanced data for historical seasons
    const apiUrl = `${baseUrl}/${year}/export?TYPE=standings&L=${leagueId}&JSON=1${standingsParams}`
    
    console.log(`Fetching MFL standings: ${apiUrl}`)
    
    // Use year-specific authentication for maximum historical data accuracy
    const headers = getYearSpecificHeaders(parseInt(year), process.env.MFL_USER_AGENT || 'dynasty-dashboard')
    
    // Fetch standings data
    const standingsData = await fetchWithRetry(apiUrl, { headers })
    
    // Fetch league data to get franchise names (using same year-specific headers)
    const leagueUrl = `${baseUrl}/${year}/export?TYPE=league&L=${leagueId}&JSON=1`
    console.log(`Fetching MFL league: ${leagueUrl}`)
    
    const leagueData = await fetchWithRetry(leagueUrl, { headers })
    
    // Fetch detailed scoring data via MFL API
    console.log('Fetching detailed scoring data via MFL API...')
    let detailedScoring: unknown[] = []
    
    // Historical data storage
    let historicalTeamsData = new Map<string, any>()
    
    try {
      let combinedPlayers: any[] = []
      let weeklyLineupData: any[] = []
      let weeklyLineupMap = new Map<string, Map<string, boolean>>()
      
      if (isHistoricalSeason) {
        // Use enhanced historical service for accurate data
        console.log(`*** USING ENHANCED HISTORICAL SERVICE FOR ${year} ***`)
        historicalTeamsData = await fetchHistoricalSeasonData(year, leagueId)
        
        // Still need basic player/roster data for compatibility
        const [playerScores, playerDatabase, rosters] = await Promise.all([
          fetchPlayerScores(year, leagueId, 'YTD'),
          fetchPlayers(year),
          fetchRosters(year, leagueId)
        ])
        
        combinedPlayers = combinePlayerData(playerScores, playerDatabase, rosters)
        
      } else {
        // Current season logic (2025+) - Use EXACT same approach as positions API
        console.log(`*** USING EXACT POSITIONS API APPROACH FOR CURRENT SEASON ${year} ***`)
        
        // Get weekly lineup data directly (same as positions API)
        const weeklyLineups = await fetchAllWeeklyResults(parseInt(year), leagueId)
        console.log(`Fetched ${weeklyLineups.length} weekly lineups from official MFL data`)
        
        // Store the weekly lineup data to use for position calculations
        weeklyLineupData = weeklyLineups
      }
      
      // Historical seasons are now handled by the new service
      console.log(`Historical data fetched successfully for ${historicalTeamsData.size} teams`)
      
      // Group players by franchise and calculate detailed stats (skip for current season using positions method)
      const franchiseData: { [franchiseId: string]: any } = {}
      
      if (combinedPlayers.length > 0) {
        combinedPlayers.forEach(player => {
          if (!franchiseData[player.team]) {
            franchiseData[player.team] = {
              franchiseId: player.team,
              players: []
            }
          }
          franchiseData[player.team].players.push(player)
        })
      }
      
      
      // Calculate detailed scoring for each franchise
      if (isHistoricalSeason) {
        // For historical seasons, use the enhanced service data
        detailedScoring = Array.from(historicalTeamsData.keys()).map(franchiseId => {
          console.log(`*** PROCESSING HISTORICAL FRANCHISE ${franchiseId} ***`)
          const historicalData = historicalTeamsData.get(franchiseId)
          
          if (!historicalData) {
            console.warn(`No historical data found for franchise ${franchiseId}`)
            return null
          }
          
          const team = {
            franchiseId,
            teamName: `Team ${franchiseId}`, // Will be replaced with actual name from league data
            startersPoints: historicalData.startersPoints,
            benchPoints: historicalData.benchPoints,
            offensePoints: historicalData.offensePoints,
            defensePoints: historicalData.defensePoints,
            totalPoints: historicalData.startersPoints, // MFL total points = starter points
            potentialPoints: historicalData.potentialPoints,
            qbPoints: historicalData.positionBreakdown.qbPoints,
            rbPoints: historicalData.positionBreakdown.rbPoints,
            wrPoints: historicalData.positionBreakdown.wrPoints,
            tePoints: historicalData.positionBreakdown.tePoints,
            kPoints: historicalData.positionBreakdown.kPoints,
            dlPoints: historicalData.positionBreakdown.dlPoints,
            lbPoints: historicalData.positionBreakdown.lbPoints,
            cbPoints: historicalData.positionBreakdown.cbPoints,
            sPoints: historicalData.positionBreakdown.sPoints,
            offenseFlexPoints: 0, // Calculate from flex players if needed
            defenseFlexPoints: 0  // Calculate from flex players if needed
          }
          
          console.log(`Historical franchise ${franchiseId} scoring: S=${team.startersPoints}, B=${team.benchPoints}, O=${team.offensePoints}, D=${team.defensePoints}, P=${team.potentialPoints}`)
          return team
        }).filter(Boolean)
        
      } else {
        // Current season processing (2025+) - use EXACT same approach as positions API
        // Get all franchise IDs from the weekly lineup data
        const franchiseIds = [...new Set(weeklyLineupData.map(lineup => lineup.franchiseId))]
        console.log(`Found ${franchiseIds.length} franchises from weekly lineups: ${franchiseIds.join(', ')}`)
        
        detailedScoring = franchiseIds.map(franchiseId => {
          console.log(`*** PROCESSING FRANCHISE ${franchiseId} USING POSITIONS API METHOD ***`)
          
          // Use the EXACT same function as positions API
          const positionTotals = calculateAccuratePositionTotals(weeklyLineupData, franchiseId)
          
          // Calculate totals from position data (like positions API does)
          const offensePoints = positionTotals.QB + positionTotals.RB + positionTotals.WR + positionTotals.TE + positionTotals['O-Flex'] + positionTotals.K
          const defensePoints = positionTotals.DL + positionTotals.LB + positionTotals.CB + positionTotals.S + positionTotals['D-Flex']
          const startersPoints = offensePoints + defensePoints
          
          // For now, set bench and potential points based on the positions data
          // This will be more accurate than trying to calculate separately
          const benchPoints = 0 // Will need to calculate separately if needed
          const potentialPoints = startersPoints // For now, use same as starters
          
          console.log(`Franchise ${franchiseId} scoring (positions method): Starters=${startersPoints}, Offense=${offensePoints}, Defense=${defensePoints}`)
          
          // Create data structure matching what normalizeTeamData expects
          const validatedData = {
            franchiseId,
            teamName: `Team ${franchiseId}`, // Will be replaced with actual name from league data
            startersPoints,
            benchPoints,
            offensePoints,
            defensePoints,
            totalPoints: startersPoints, // MFL total points = starter points
            potentialPoints,
            qbPoints: positionTotals.QB,
            rbPoints: positionTotals.RB,
            wrPoints: positionTotals.WR,
            tePoints: positionTotals.TE,
            kPoints: positionTotals.K,
            dlPoints: positionTotals.DL,
            lbPoints: positionTotals.LB,
            cbPoints: positionTotals.CB,
            sPoints: positionTotals.S,
            offenseFlexPoints: positionTotals['O-Flex'] || 0,
            defenseFlexPoints: positionTotals['D-Flex'] || 0
          }
          
          // Validate that we have reasonable data for a completed week
          if (year === '2025' && validatedData.startersPoints === 0 && validatedData.benchPoints === 0) {
            console.warn(`Franchise ${franchiseId}: All points are zero - this may indicate missing data`)
          }
          
          // Ensure potential points is at least as high as starters points
          if (validatedData.potentialPoints < validatedData.startersPoints) {
            console.warn(`Franchise ${franchiseId}: Potential points (${validatedData.potentialPoints}) lower than starters (${validatedData.startersPoints}) - adjusting`)
            validatedData.potentialPoints = Math.max(validatedData.potentialPoints, validatedData.startersPoints)
          }
          
          return validatedData
        }).filter(Boolean)
      }
      
      console.log(`Successfully calculated detailed scoring for ${detailedScoring.length} teams via MFL API`)
    } catch (apiError) {
      console.warn('Failed to fetch detailed scoring via API:', apiError)
      // Continue with basic standings data only
      detailedScoring = []
    }
    
    // Debug logging for API responses
    console.log('Standings API response structure:', Object.keys(standingsData as object))
    console.log('League API response structure:', Object.keys(leagueData as object))
    
    // Combine the data
    const data = {
      standings: standingsData,
      league: leagueData,
      detailedScoring: detailedScoring
    }
    
    console.log('Combined data structure:', Object.keys(data))
    
    // Normalize the data using our helper
    const normalizedTeams = normalizeTeamData(data as MFLStandingsResponse, parseInt(year))
    
    // Validate and sanitize the data before returning
    console.log(`*** DATA VALIDATION FOR ${year} ***`)
    const validation = validateSeasonData(normalizedTeams, parseInt(year))
    
    if (!validation.isValid) {
      console.error(`Data validation failed for ${year}:`, validation.errors)
      
      // Attempt fallback data sources if validation fails
      if (isHistoricalSeason) {
        console.log('Attempting web scraping fallback for historical data...')
        const scrapedData = await scrapeLeagueStats(year, leagueId)
        
        if (scrapedData.size > 0) {
          console.log(`Scraped data available for ${scrapedData.size} teams`)
          // In a full implementation, we would merge scraped data here
        }
      }
    }
    
    // Sanitize all team data to prevent display issues
    const sanitizedTeams = normalizedTeams.map(team => sanitizeTeamData(team))
    
    // Generate data quality report
    const qualityReport = generateDataQualityReport(sanitizedTeams, parseInt(year))
    console.log(qualityReport)
    
    // Cache the result
    setCache(cacheKey, sanitizedTeams)
    
    console.log(`Successfully fetched and validated ${sanitizedTeams.length} teams from MFL API`)
    
    return NextResponse.json(sanitizedTeams, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Data-Quality': validation.isValid ? 'VALID' : 'INVALID',
        'X-Data-Errors': validation.errors.length.toString(),
        'X-Data-Warnings': validation.warnings.length.toString(),
        ...getCorsHeaders()
      }
    })
    
  } catch (error) {
    console.error('Error fetching MFL data:', error)
    
    // Return cached data if available, even if stale
    const cachedData = getFromCache(cacheKey)
    if (cachedData) {
      console.log('Returning stale cached data due to API error')
      return NextResponse.json(cachedData.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=60',
          'X-Cache-Status': 'STALE',
          ...getCorsHeaders()
        }
      })
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const statusCode = error instanceof Error && error.message.includes('429') ? 429 : 500
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch MyFantasyLeague data',
        details: errorMessage,
        timestamp: new Date().toISOString()
      },
      { status: statusCode }
    )
  }
}