import { NextRequest, NextResponse } from 'next/server'
import { fetchWeeklyResults } from '@/lib/mfl-weekly-results'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') || '2025')
  const week = parseInt(searchParams.get('week') || '1')
  const leagueId = searchParams.get('leagueId') || process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_ID || '46221'

  try {
    const data = await fetchWeeklyResults(year, leagueId, week)
    return NextResponse.json(data)
  } catch (error) {
    console.error(`[Weekly Results API] Error fetching week ${week}:`, error)
    return NextResponse.json(
      { error: `Failed to fetch weekly results for week ${week}` },
      { status: 500 }
    )
  }
}
