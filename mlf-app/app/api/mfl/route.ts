import { NextRequest, NextResponse } from 'next/server'
import { normalizeTeamData, MFLStandingsResponse } from '@/lib/mfl'
import { fetchWithRetry, getCacheKey, getFromCache, setCache, clearCache } from '@/lib/mfl-api'
import { scrapeDetailedScoring } from '@/lib/mfl-scraper'

// Cache duration: 5 minutes for standings data  
const CACHE_DURATION = 5 * 60 * 1000

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year') || '2024'
  const leagueId = searchParams.get('leagueId') || process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_ID || '46221'
  
  const cacheKey = getCacheKey('standings', { year, leagueId })
  clearCache(cacheKey)
  
  return NextResponse.json({ success: true, message: 'Cache cleared' })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = searchParams.get('year') || '2024'
  const leagueId = searchParams.get('leagueId') || process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_ID || '46221'
  
  // Create cache key
  const cacheKey = getCacheKey('standings', { year, leagueId })
  
  try {
    // Check cache first
    const cachedData = getFromCache(cacheKey)
    if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_DURATION) {
      console.log('Returning cached MFL data')
      return NextResponse.json(cachedData.data)
    }
    
    // Build MFL API URL  
    const baseUrl = process.env.MFL_API_BASE_URL || 'https://api.myfantasyleague.com'
    const apiUrl = `${baseUrl}/${year}/export?TYPE=standings&L=${leagueId}&JSON=1`
    
    // Get User-Agent from environment or use registered default
    const userAgent = process.env.MFL_USER_AGENT || 'dynasty-dashboard'
    
    console.log(`Fetching MFL standings: ${apiUrl}`)
    
    // Fetch standings data
    const standingsData = await fetchWithRetry(apiUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })
    
    // Fetch league data to get franchise names
    const leagueUrl = `${baseUrl}/${year}/export?TYPE=league&L=${leagueId}&JSON=1`
    console.log(`Fetching MFL league: ${leagueUrl}`)
    
    const leagueData = await fetchWithRetry(leagueUrl, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache'
      }
    })
    
    // Fetch detailed scoring data via web scraping
    console.log('Fetching detailed scoring data via web scraping...')
    let detailedScoring: unknown[] = []
    
    try {
      detailedScoring = await scrapeDetailedScoring(leagueId, parseInt(year))
      console.log(`Successfully scraped detailed scoring for ${detailedScoring.length} teams`)
    } catch (scrapingError) {
      console.warn('Failed to scrape detailed scoring data:', scrapingError)
      // Continue with API data only
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
    
    // Cache the result
    setCache(cacheKey, normalizedTeams)
    
    console.log(`Successfully fetched ${normalizedTeams.length} teams from MFL API`)
    
    return NextResponse.json(normalizedTeams, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
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
          'X-Cache-Status': 'STALE'
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