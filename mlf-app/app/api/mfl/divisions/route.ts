import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const MFL_API_BASE = 'https://api.myfantasyleague.com'
const LEAGUE_ID = '46221'

export interface Division {
  id: string
  name: string
}

export interface Franchise {
  id: string
  name: string
  owner_name: string
  division: string
  logo?: string
  icon?: string
}

export interface LeagueResponse {
  league?: {
    divisions?: {
      division: Division[]
      count?: string
    }
    franchises?: {
      franchise: Franchise[]
      count?: string
    }
  }
  encoding?: string
  version?: string
}

export interface DivisionsData {
  divisions: Division[]
  franchises: Franchise[]
  divisionMap: Record<string, string> // franchiseId -> divisionId
  divisionNames: Record<string, string> // divisionId -> divisionName
  divisionTeams: Record<string, string[]> // divisionId -> franchiseId[]
}

/**
 * Fetches league division structure and franchise assignments
 * Returns division names and which teams belong to each division
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    console.log(`[Divisions API] Fetching divisions for year ${year}`)

    const leagueUrl = `${MFL_API_BASE}/${year}/export?TYPE=league&L=${LEAGUE_ID}&JSON=1`
    console.log(`[Divisions API] URL: ${leagueUrl}`)

    const response = await fetch(leagueUrl, {
      headers: {
        'User-Agent': 'dynasty-dashboard/1.0',
      },
    })

    if (response.status === 429) {
      console.log('[Divisions API] Rate limited, returning fallback data')

      // Return sample division structure from data-samples
      return NextResponse.json({
        divisions: [
          { id: '00', name: 'Slayer Division' },
          { id: '01', name: 'Toxic Division' },
          { id: '02', name: 'Maniac Division' },
        ],
        franchises: [],
        divisionMap: {},
        divisionNames: {
          '00': 'Slayer Division',
          '01': 'Toxic Division',
          '02': 'Maniac Division',
        },
        divisionTeams: {
          '00': [],
          '01': [],
          '02': [],
        },
        source: 'fallback',
        message: 'Rate limited - using fallback data',
      })
    }

    if (!response.ok) {
      throw new Error(`MFL API returned ${response.status}: ${response.statusText}`)
    }

    const data: LeagueResponse = await response.json()

    if (!data.league) {
      console.error('[Divisions API] Invalid response structure:', data)
      throw new Error('Invalid league data structure')
    }

    // Extract divisions
    const divisions: Division[] = data.league.divisions?.division || []
    console.log(`[Divisions API] Found ${divisions.length} divisions`)

    // Extract franchises
    const franchises: Franchise[] = data.league.franchises?.franchise || []
    console.log(`[Divisions API] Found ${franchises.length} franchises`)

    // Create division mapping structures
    const divisionMap: Record<string, string> = {}
    const divisionNames: Record<string, string> = {}
    const divisionTeams: Record<string, string[]> = {}

    // Build division names lookup
    divisions.forEach(div => {
      divisionNames[div.id] = div.name
      divisionTeams[div.id] = []
    })

    // Build franchise -> division mapping and division -> teams mapping
    franchises.forEach(franchise => {
      divisionMap[franchise.id] = franchise.division
      if (divisionTeams[franchise.division]) {
        divisionTeams[franchise.division].push(franchise.id)
      } else {
        // Handle case where division doesn't exist in divisions list
        divisionTeams[franchise.division] = [franchise.id]
        if (!divisionNames[franchise.division]) {
          divisionNames[franchise.division] = `Division ${franchise.division}`
        }
      }
    })

    console.log('[Divisions API] Division structure:', {
      divisionCount: divisions.length,
      franchiseCount: franchises.length,
      teamsPerDivision: Object.entries(divisionTeams).map(([div, teams]) => ({
        division: divisionNames[div],
        teamCount: teams.length,
      })),
    })

    const result: DivisionsData = {
      divisions,
      franchises,
      divisionMap,
      divisionNames,
      divisionTeams,
    }

    return NextResponse.json({
      ...result,
      year,
      timestamp: Date.now(),
      source: 'mfl-api',
    })

  } catch (error) {
    console.error('[Divisions API] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch divisions',
        details: error instanceof Error ? error.message : 'Unknown error',
        divisions: [],
        franchises: [],
        divisionMap: {},
        divisionNames: {},
        divisionTeams: {},
      },
      { status: 500 }
    )
  }
}
