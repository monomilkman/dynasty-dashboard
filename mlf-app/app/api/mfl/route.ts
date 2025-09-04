import { NextRequest, NextResponse } from 'next/server'
import { normalizeTeamData } from '@/lib/mfl'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year') || '2024'
  const leagueId = searchParams.get('leagueId') || '46221'

  try {
    const response = await fetch(
      `https://www45.myfantasyleague.com/${year}/export?TYPE=standings&L=${leagueId}&JSON=1`,
      { 
        headers: {
          'User-Agent': 'MFL-App/1.0',
        },
        // Add cache control for development
        cache: 'no-store'
      }
    )

    if (!response.ok) {
      throw new Error(`MFL API responded with status: ${response.status}`)
    }

    const data = await response.json()
    
    // Normalize the data using our helper
    const normalizedTeams = normalizeTeamData(data, parseInt(year))

    return NextResponse.json(normalizedTeams)
  } catch (error) {
    console.error('Error fetching MFL data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch MyFantasyLeague data' },
      { status: 500 }
    )
  }
}