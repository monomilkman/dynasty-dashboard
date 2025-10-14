import { NextRequest, NextResponse } from 'next/server'
import {
  analyzeLeagueTradeDepth,
  RosterPlayer,
  DepthAnalysisResult,
} from '@/lib/trade-depth-calculator'
import { fetchRosters, fetchPlayerScores, fetchPlayers } from '@/lib/mfl-api-endpoints'
import { getCurrentWeekForSeason, getTotalWeeksForYear } from '@/lib/season-config'
import { getOwnerName } from '@/lib/owner-mappings'
import { getCacheKey, getFromCache, setCache } from '@/lib/mfl-api'

const DEFAULT_LEAGUE_ID = '46221'
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '2025')
    const leagueId = searchParams.get('leagueId') || DEFAULT_LEAGUE_ID
    const franchiseId = searchParams.get('franchiseId') // Optional - for personalized view

    console.log(`[Trade Depth API] Fetching trade depth analysis for ${year}, league ${leagueId}`)

    // Check cache
    const cacheKey = getCacheKey('trade-depth', { year: year.toString(), leagueId, franchiseId: franchiseId || 'all' })
    const cached = getFromCache(cacheKey) as DepthAnalysisResult | null
    if (cached) {
      console.log('[Trade Depth API] Returning cached data')
      return NextResponse.json(cached)
    }

    // Step 1: Fetch all rosters
    console.log('[Trade Depth API] Fetching rosters...')
    const rostersResponse = await fetchRosters(year.toString(), leagueId)

    if (!rostersResponse.rosters?.franchise) {
      throw new Error('No roster data available')
    }

    const franchises = Array.isArray(rostersResponse.rosters.franchise)
      ? rostersResponse.rosters.franchise
      : [rostersResponse.rosters.franchise]

    // Step 2: Fetch player metadata (names, positions)
    console.log('[Trade Depth API] Fetching player metadata...')
    const playersResponse = await fetchPlayers(year.toString())
    const playerMap = new Map<string, { name: string; position: string }>()

    if (playersResponse.players?.player) {
      const players = Array.isArray(playersResponse.players.player)
        ? playersResponse.players.player
        : [playersResponse.players.player]

      players.forEach((p) => {
        playerMap.set(p.id, {
          name: p.name,
          position: p.position,
        })
      })
    }

    // Step 3: Fetch season-to-date player scores
    console.log('[Trade Depth API] Fetching YTD player scores...')
    const scoresResponse = await fetchPlayerScores(year.toString(), leagueId, 'YTD')
    const scoreMap = new Map<string, number>()

    if (scoresResponse.playerScores?.playerScore) {
      const scores = Array.isArray(scoresResponse.playerScores.playerScore)
        ? scoresResponse.playerScores.playerScore
        : [scoresResponse.playerScores.playerScore]

      scores.forEach((s) => {
        scoreMap.set(s.id, parseFloat(s.score) || 0)
      })
    }

    // Step 4: Calculate games played (weeks completed)
    const currentWeek = getCurrentWeekForSeason(year)
    const lastCompletedWeek = Math.max(1, currentWeek - 1)
    const gamesPlayed = lastCompletedWeek

    console.log(`[Trade Depth API] Season through week ${lastCompletedWeek} (${gamesPlayed} games)`)

    // Step 5: Build roster data for all teams
    const allRosters: Array<{
      franchiseId: string
      teamName: string
      manager: string
      roster: RosterPlayer[]
    }> = []

    for (const franchise of franchises) {
      const franchiseId = franchise.id
      const manager = getOwnerName(franchiseId, year) || 'Unknown'
      const teamName = `Team ${manager}` // Use manager name as team name

      // Parse player IDs from roster
      const playerIds = franchise.player
        ? franchise.player.map((p) => p.id)
        : []

      // Build roster with enriched player data
      const roster: RosterPlayer[] = playerIds
        .map((playerId: string) => {
          const playerInfo = playerMap.get(playerId)
          const totalPoints = scoreMap.get(playerId) || 0
          const seasonPPG = gamesPlayed > 0 ? totalPoints / gamesPlayed : 0

          if (!playerInfo) {
            console.warn(`[Trade Depth API] Missing player info for ${playerId}`)
            return null
          }

          // Normalize position codes
          let position = playerInfo.position.toUpperCase()
          if (position === 'PK') position = 'K'
          if (position === 'DE' || position === 'DT') position = 'DL'
          if (position === 'FS' || position === 'SS') position = 'S'

          // Filter out non-standard positions
          const validPositions = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S']
          if (!validPositions.includes(position)) {
            return null
          }

          return {
            id: playerId,
            name: playerInfo.name,
            position: position as RosterPlayer['position'],
            seasonPPG: Math.round(seasonPPG * 100) / 100,
            totalPoints: Math.round(totalPoints * 100) / 100,
            gamesPlayed,
            positionRank: 0, // Will be calculated in trade-depth-calculator
            isStartable: false, // Will be calculated in trade-depth-calculator
            starterOnTeamCount: 0, // Will be calculated in trade-depth-calculator
          }
        })
        .filter((p): p is RosterPlayer => p !== null)

      allRosters.push({
        franchiseId,
        teamName,
        manager,
        roster,
      })

      console.log(
        `[Trade Depth API] ${teamName} (${manager}): ${roster.length} players, ${playerIds.length} total IDs`
      )
    }

    // Step 6: Analyze trade depth
    console.log('[Trade Depth API] Analyzing trade depth...')
    const analysis = analyzeLeagueTradeDepth(allRosters, year, franchiseId || undefined)

    console.log('[Trade Depth API] Analysis complete')
    console.log(`  - Total teams: ${analysis.allTeams.length}`)
    console.log(`  - League averages calculated: ${Object.keys(analysis.leagueContext.positionAverages).length} positions`)
    if (analysis.yourTeamAnalysis) {
      console.log(`  - Your team: ${analysis.yourTeamAnalysis.teamName}`)
      console.log(`  - Trade matches found: ${analysis.tradeMatches?.length || 0}`)
    }

    // Cache the result
    setCache(cacheKey, analysis)

    return NextResponse.json(analysis)
  } catch (error) {
    console.error('[Trade Depth API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to analyze trade depth',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
