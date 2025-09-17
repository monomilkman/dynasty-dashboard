import { NextRequest, NextResponse } from 'next/server'
import { fetchAllWeeklyResults, fetchPlayerMappings } from '@/lib/mfl-weekly-results'
import { getOwnerName } from '@/lib/owner-mappings'
import { getWeeksForProgression, getSeasonStatusDescription } from '@/lib/season-utils'
// Import the new unified data service
import { getWeeklyStats, calculateEfficiency, getPositionBreakdown } from '@/lib/mfl-data-service'

export interface WeeklyScore {
  week: number
  totalPoints: number
  startersPoints: number
  benchPoints: number
  offensePoints: number
  defensePoints: number
  potentialPoints: number
  efficiency: number        // (totalPoints / potentialPoints) * 100 rounded to 1 decimal
  qbPoints: number
  rbPoints: number
  wrPoints: number
  tePoints: number
  kPoints: number
  dlPoints: number
  lbPoints: number
  cbPoints: number
  sPoints: number
  cumulativeTotalPoints: number
}

export interface TeamProgression {
  franchiseId: string
  manager: string
  teamName: string
  year: number
  weeklyScores: WeeklyScore[]
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '2025')
    const leagueId = searchParams.get('leagueId') || process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_ID || '46221'
    const weeksParam = searchParams.get('weeks')
    const franchiseId = searchParams.get('franchiseId') // Optional: get data for specific team
    
    console.log(`[Weekly Progression API] Starting request for year=${year}, leagueId=${leagueId}, weeks=${weeksParam}, franchiseId=${franchiseId}`)

    // Parse weeks parameter using season-aware logic
    const requestedWeeks = weeksParam 
      ? weeksParam.split(',').map(w => parseInt(w.trim())).filter(w => w >= 1 && w <= 18)
      : undefined
    
    const weeksToInclude = getWeeksForProgression(year, requestedWeeks)
    const seasonStatus = getSeasonStatusDescription(year)

    console.log(`[Weekly Progression API] ${seasonStatus}`)
    console.log(`[Weekly Progression API] Including weeks: ${weeksToInclude.join(', ')}`)

    // Build authentication headers
    const userAgent = process.env.MFL_USER_AGENT || 'dynasty-dashboard'
    const apiKey = process.env.MFL_API_KEY
    
    const headers: Record<string, string> = {
      'User-Agent': userAgent,
      'Accept': 'application/json',
      'Cache-Control': 'no-cache'
    }
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`
    }

    // Fetch real weekly data from MFL API
    try {
      // Fetch team names from the main MFL API
      const teamNamesResponse = await fetch(`https://api.myfantasyleague.com/${year}/export?TYPE=league&L=${leagueId}&JSON=1`, {
        headers
      })
      
      const teamNamesData = await teamNamesResponse.json()
      const franchiseNames: { [key: string]: string } = {}
      
      if (teamNamesData?.league?.franchises?.franchise) {
        const franchises = Array.isArray(teamNamesData.league.franchises.franchise) 
          ? teamNamesData.league.franchises.franchise 
          : [teamNamesData.league.franchises.franchise]
        
        franchises.forEach((franchise: any) => {
          if (franchise.id && franchise.name) {
            franchiseNames[franchise.id] = franchise.name
          }
        })
      }

      // Use new unified data service (Step 2: Use MFL's provided fields)
      const progressionData: TeamProgression[] = []

      // Create data for specific franchise or all franchises
      const franchiseIds = franchiseId 
        ? [franchiseId] 
        : Array.from({ length: 12 }, (_, i) => (i + 1).toString().padStart(4, '0'))
      
      console.log(`[Weekly Progression API] Processing ${franchiseIds.length} franchises using MFL data service`)

      for (const fId of franchiseIds) {
        try {
          // Get weekly stats using MFL's provided fields (opt_pts, score, etc.)
          const weeklyStats = await getWeeklyStats(year, leagueId, weeksToInclude, fId)
          
          // Get position breakdown for all requested weeks (with correct parameter order)
          const positionBreakdown = await getPositionBreakdown(year, leagueId, fId, weeksToInclude)
          
          const weeklyScores: WeeklyScore[] = []
          let cumulativeTotal = 0
          
          // Process each week's data
          for (const week of weeksToInclude) {
            const weekData = weeklyStats.find(ws => ws.week === week)
            
            if (weekData) {
              cumulativeTotal += weekData.actualPoints
              
              // Use MFL's provided data when available, fallback to estimates
              const potentialPts = weekData.optimalPoints || weekData.actualPoints * 1.15
              
              weeklyScores.push({
                week,
                totalPoints: weekData.actualPoints,           // MFL's score field
                startersPoints: weekData.starterPoints,       // Calculated from starters
                benchPoints: weekData.benchPoints,            // Calculated from nonstarters
                offensePoints: weekData.actualPoints * 0.7,   // Estimate for now
                defensePoints: weekData.actualPoints * 0.3,   // Estimate for now
                potentialPoints: potentialPts,                // MFL's opt_pts or estimate
                efficiency: calculateEfficiency(weekData.actualPoints, potentialPts), // Weekly efficiency
                // Position breakdowns distributed across weeks
                qbPoints: (positionBreakdown[0]?.positionTotals?.QB || 0) / weeksToInclude.length,
                rbPoints: (positionBreakdown[0]?.positionTotals?.RB || 0) / weeksToInclude.length,
                wrPoints: (positionBreakdown[0]?.positionTotals?.WR || 0) / weeksToInclude.length,
                tePoints: (positionBreakdown[0]?.positionTotals?.TE || 0) / weeksToInclude.length,
                kPoints: (positionBreakdown[0]?.positionTotals?.K || 0) / weeksToInclude.length,
                dlPoints: (positionBreakdown[0]?.positionTotals?.DL || 0) / weeksToInclude.length,
                lbPoints: (positionBreakdown[0]?.positionTotals?.LB || 0) / weeksToInclude.length,
                cbPoints: (positionBreakdown[0]?.positionTotals?.CB || 0) / weeksToInclude.length,
                sPoints: (positionBreakdown[0]?.positionTotals?.S || 0) / weeksToInclude.length,
                cumulativeTotalPoints: cumulativeTotal
              })
            } else {
              // No data available for this week
              weeklyScores.push({
                week,
                totalPoints: 0,
                startersPoints: 0,
                benchPoints: 0,
                offensePoints: 0,
                defensePoints: 0,
                potentialPoints: 0,
                efficiency: 0,    // No efficiency when no data
                qbPoints: 0,
                rbPoints: 0,
                wrPoints: 0,
                tePoints: 0,
                kPoints: 0,
                dlPoints: 0,
                lbPoints: 0,
                cbPoints: 0,
                sPoints: 0,
                cumulativeTotalPoints: cumulativeTotal
              })
            }
          }

          progressionData.push({
            franchiseId: fId,
            manager: getOwnerName(fId, year),
            teamName: franchiseNames[fId] || `Team ${fId}`,
            year,
            weeklyScores
          })
          
        } catch (error) {
          console.error(`[Weekly Progression API] Error processing franchise ${fId}:`, error)
          
          // Add fallback data for failed franchise
          progressionData.push({
            franchiseId: fId,
            manager: getOwnerName(fId, year),
            teamName: franchiseNames[fId] || `Team ${fId}`,
            year,
            weeklyScores: weeksToInclude.map(week => ({
              week,
              totalPoints: 0,
              startersPoints: 0,
              benchPoints: 0,
              offensePoints: 0,
              defensePoints: 0,
              potentialPoints: 0,
              efficiency: 0,    // No efficiency for failed franchise
              qbPoints: 0,
              rbPoints: 0,
              wrPoints: 0,
              tePoints: 0,
              kPoints: 0,
              dlPoints: 0,
              lbPoints: 0,
              cbPoints: 0,
              sPoints: 0,
              cumulativeTotalPoints: 0
            }))
          })
        }
      }

      console.log(`[Weekly Progression API] Successfully generated progression data for ${progressionData.length} teams (${seasonStatus})`)
      return NextResponse.json(progressionData)

    } catch (error) {
      console.error('[Weekly Progression API] Error generating progression data:', error)
      
      // Return minimal fallback data
      const fallbackData: TeamProgression[] = [{
        franchiseId: '0001',
        manager: 'Sample Manager',
        teamName: 'Sample Team',
        year,
        weeklyScores: weeksToInclude.map(week => ({
          week,
          totalPoints: 0,
          startersPoints: 0,
          benchPoints: 0,
          offensePoints: 0,
          defensePoints: 0,
          potentialPoints: 0,
          efficiency: 0,    // No efficiency for fallback data
          qbPoints: 0,
          rbPoints: 0,
          wrPoints: 0,
          tePoints: 0,
          kPoints: 0,
          dlPoints: 0,
          lbPoints: 0,
          cbPoints: 0,
          sPoints: 0,
          cumulativeTotalPoints: 0
        }))
      }]

      return NextResponse.json(fallbackData)
    }

  } catch (error) {
    console.error('[Weekly Progression API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch weekly progression data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}