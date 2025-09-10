import { NextRequest, NextResponse } from 'next/server'
import { scrapeDetailedScoring } from '@/lib/mfl-scraper'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year') || '2024'
  const leagueId = searchParams.get('leagueId') || process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_ID || '46221'
  
  try {
    console.log(`Scraping detailed MFL scoring for league ${leagueId}, year ${year}`)
    const detailedScoring = await scrapeDetailedScoring(leagueId, parseInt(year))
    
    return NextResponse.json({ 
      success: true,
      count: detailedScoring.length,
      data: detailedScoring
    })
    
  } catch (error) {
    console.error('Error scraping detailed MFL scoring:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to scrape detailed MFL scoring',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}