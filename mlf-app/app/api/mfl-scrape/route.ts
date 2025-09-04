import { NextRequest, NextResponse } from 'next/server'
import { analyzeMLFPage } from '@/lib/mfl-scraper'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year') || '2024'
  const leagueId = searchParams.get('leagueId') || process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_ID || '46221'
  
  try {
    console.log(`Analyzing MFL page structure for league ${leagueId}, year ${year}`)
    await analyzeMLFPage(leagueId, parseInt(year))
    
    return NextResponse.json({ 
      success: true, 
      message: 'Check server logs for HTML structure analysis',
      url: `https://www45.myfantasyleague.com/${year}/options?L=${leagueId}&O=118`
    })
    
  } catch (error) {
    console.error('Error analyzing MFL page:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze MFL page',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}