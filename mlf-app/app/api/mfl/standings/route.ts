import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const MFL_API_BASE = 'https://api.myfantasyleague.com'
const LEAGUE_ID = '46221'

export interface StandingsFranchise {
  id: string
  name?: string       // Team Name (optional, used in historical backfill)
  pa: string          // Points Against
  avgpf: string       // Average Points For
  h2ht: string        // Head-to-Head Ties
  avgpa: string       // Average Points Against
  divwlt: string      // Division Win-Loss-Tie (e.g., "1-0-0")
  h2hw: string        // Head-to-Head Wins
  h2hl: string        // Head-to-Head Losses
  h2hpct: string      // Head-to-Head Winning Percentage
  h2hwlt: string      // Head-to-Head Win-Loss-Tie
  pf: string          // Points For
  strk: string        // Current Streak (e.g., "W1", "L2")
}

export interface StandingsResponse {
  leagueStandings?: {
    franchise: StandingsFranchise[]
  }
  encoding?: string
  version?: string
}

/**
 * Fetches current league standings with records and points
 * Returns standings data needed for playoff calculations
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    console.log(`[Standings API] Fetching standings for year ${year}`)

    const standingsUrl = `${MFL_API_BASE}/${year}/export?TYPE=leagueStandings&L=${LEAGUE_ID}&JSON=1`
    console.log(`[Standings API] URL: ${standingsUrl}`)

    const response = await fetch(standingsUrl, {
      headers: {
        'User-Agent': 'dynasty-dashboard/1.0',
      },
    })

    if (response.status === 429) {
      console.log('[Standings API] Rate limited, returning fallback data')

      // Return sample data structure for development
      return NextResponse.json({
        leagueStandings: {
          franchise: [
            {
              id: '0001',
              pf: '0.00',
              pa: '0.00',
              avgpf: '0.00',
              avgpa: '0.00',
              h2hw: '0',
              h2hl: '0',
              h2ht: '0',
              h2hwlt: '0-0-0',
              h2hpct: '.000',
              divwlt: '0-0-0',
              strk: 'N/A',
            },
          ],
        },
        source: 'fallback',
        message: 'Rate limited - using fallback data',
      })
    }

    if (!response.ok) {
      throw new Error(`MFL API returned ${response.status}: ${response.statusText}`)
    }

    const data: StandingsResponse = await response.json()

    if (!data.leagueStandings?.franchise) {
      console.error('[Standings API] Invalid response structure:', data)
      throw new Error('Invalid standings data structure')
    }

    console.log(`[Standings API] Successfully fetched ${data.leagueStandings.franchise.length} teams`)

    // Enhance the data with calculated fields
    const enhancedStandings = data.leagueStandings.franchise.map(team => {
      const wins = parseInt(team.h2hw) || 0
      const losses = parseInt(team.h2hl) || 0
      const ties = parseInt(team.h2ht) || 0
      const totalGames = wins + losses + ties
      const pf = parseFloat(team.pf) || 0
      const pa = parseFloat(team.pa) || 0

      // Parse division record
      const divRecordParts = team.divwlt.split('-')
      const divWins = parseInt(divRecordParts[0]) || 0
      const divLosses = parseInt(divRecordParts[1]) || 0
      const divTies = parseInt(divRecordParts[2]) || 0

      return {
        ...team,
        // Add calculated fields
        wins,
        losses,
        ties,
        totalGames,
        pointsFor: pf,
        pointsAgainst: pa,
        winPercentage: totalGames > 0 ? (wins + ties * 0.5) / totalGames : 0,
        divisionWins: divWins,
        divisionLosses: divLosses,
        divisionTies: divTies,
        divisionWinPercentage: (divWins + divLosses + divTies) > 0
          ? (divWins + divTies * 0.5) / (divWins + divLosses + divTies)
          : 0,
      }
    })

    // Sort by win percentage (descending), then by points for (descending)
    enhancedStandings.sort((a, b) => {
      if (a.winPercentage !== b.winPercentage) {
        return b.winPercentage - a.winPercentage
      }
      return b.pointsFor - a.pointsFor
    })

    return NextResponse.json({
      leagueStandings: {
        franchise: enhancedStandings,
      },
      year,
      timestamp: Date.now(),
      source: 'mfl-api',
    })

  } catch (error) {
    console.error('[Standings API] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch standings',
        details: error instanceof Error ? error.message : 'Unknown error',
        leagueStandings: {
          franchise: [],
        },
      },
      { status: 500 }
    )
  }
}
