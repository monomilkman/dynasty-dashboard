import { NextRequest, NextResponse } from 'next/server'
import { fetchWeeklyResults } from '@/lib/mfl-weekly-results'
import { getOwnerName } from '@/lib/owner-mappings'
import { getTotalWeeksForYear } from '@/lib/season-config'

export interface MatchupResult {
  week: number
  franchiseId: string
  opponent: string
  score: number
  opponentScore: number
  result: 'W' | 'L' | 'T'
  isHomeTeam: boolean
}

export interface TeamMatchupSummary {
  franchiseId: string
  manager: string
  teamName: string
  wins: number
  losses: number
  ties: number
  pointsFor: number
  pointsAgainst: number
  winPercentage: number
  matchups: MatchupResult[]
  year: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = parseInt(searchParams.get('year') || '2025')
    const leagueId = searchParams.get('leagueId') || process.env.NEXT_PUBLIC_DEFAULT_LEAGUE_ID || '46221'
    const weeksParam = searchParams.get('weeks')
    
    console.log(`[Matchups API] Starting request for year=${year}, leagueId=${leagueId}, weeks=${weeksParam}`)

    // Parse weeks parameter (comma-separated list or empty for all weeks)
    const totalWeeks = getTotalWeeksForYear(year)
    let weeksToFetch: number[] = []
    if (weeksParam) {
      weeksToFetch = weeksParam.split(',').map(w => parseInt(w.trim())).filter(w => w >= 1 && w <= totalWeeks)
    } else {
      // Default to only Week 1 unless more are specified to avoid counting unplayed weeks
      // For current season, only include completed weeks
      weeksToFetch = [1] // Start with Week 1, user can select more weeks if needed
    }
    
    console.log(`[Matchups API] Year ${year} has ${totalWeeks} total weeks available`)

    console.log(`[Matchups API] Fetching weeks: ${weeksToFetch.join(', ')}`)

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

    // First, fetch team names from the main MFL API
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

    const teamMatchupData = new Map<string, TeamMatchupSummary>()

    // Fetch each week's results
    for (const week of weeksToFetch) {
      try {
        console.log(`[Matchups API] Fetching week ${week}...`)
        const weekResults = await fetchWeeklyResults(year, leagueId, week)
        
        if (!weekResults?.weeklyResults?.matchup) {
          console.warn(`[Matchups API] No matchup data for week ${week}`)
          continue
        }

        const matchups = Array.isArray(weekResults.weeklyResults.matchup) 
          ? weekResults.weeklyResults.matchup 
          : [weekResults.weeklyResults.matchup]

        // Process each matchup (head-to-head game)
        matchups.forEach((matchup) => {
          if (!matchup.franchise || !Array.isArray(matchup.franchise) || matchup.franchise.length !== 2) {
            console.warn(`[Matchups API] Week ${week}: Invalid matchup structure`, matchup)
            return
          }

          const [team1, team2] = matchup.franchise

          // Determine winner
          const team1Score = parseFloat(team1.score || '0')
          const team2Score = parseFloat(team2.score || '0')
          
          // Skip matchups that haven't been played (both scores are 0)
          if (team1Score === 0 && team2Score === 0) {
            console.log(`[Matchups API] Week ${week}: Skipping unplayed matchup between ${team1.id} and ${team2.id}`)
            return
          }
          
          let team1Result: 'W' | 'L' | 'T'
          let team2Result: 'W' | 'L' | 'T'
          
          if (team1Score > team2Score) {
            team1Result = 'W'
            team2Result = 'L'
          } else if (team2Score > team1Score) {
            team1Result = 'L'
            team2Result = 'W'
          } else {
            team1Result = 'T'
            team2Result = 'T'
          }

          // Initialize team data if not exists
          if (!teamMatchupData.has(team1.id)) {
            teamMatchupData.set(team1.id, {
              franchiseId: team1.id,
              manager: getOwnerName(team1.id, year),
              teamName: franchiseNames[team1.id] || `Team ${team1.id}`,
              wins: 0,
              losses: 0,
              ties: 0,
              pointsFor: 0,
              pointsAgainst: 0,
              winPercentage: 0,
              matchups: [],
              year
            })
          }

          if (!teamMatchupData.has(team2.id)) {
            teamMatchupData.set(team2.id, {
              franchiseId: team2.id,
              manager: getOwnerName(team2.id, year),
              teamName: franchiseNames[team2.id] || `Team ${team2.id}`,
              wins: 0,
              losses: 0,
              ties: 0,
              pointsFor: 0,
              pointsAgainst: 0,
              winPercentage: 0,
              matchups: [],
              year
            })
          }

          // Add matchup results
          const team1Data = teamMatchupData.get(team1.id)!
          const team2Data = teamMatchupData.get(team2.id)!

          // Team 1 matchup
          team1Data.matchups.push({
            week,
            franchiseId: team1.id,
            opponent: team2.id,
            score: team1Score,
            opponentScore: team2Score,
            result: team1Result,
            isHomeTeam: true // First team is typically home team
          })

          // Team 2 matchup
          team2Data.matchups.push({
            week,
            franchiseId: team2.id,
            opponent: team1.id,
            score: team2Score,
            opponentScore: team1Score,
            result: team2Result,
            isHomeTeam: false
          })

          // Update win/loss/tie records
          if (team1Result === 'W') {
            team1Data.wins++
            team2Data.losses++
          } else if (team1Result === 'L') {
            team1Data.losses++
            team2Data.wins++
          } else {
            team1Data.ties++
            team2Data.ties++
          }

          // Update points for/against
          team1Data.pointsFor += team1Score
          team1Data.pointsAgainst += team2Score
          team2Data.pointsFor += team2Score
          team2Data.pointsAgainst += team1Score
        })

        console.log(`[Matchups API] Successfully processed week ${week}`)
      } catch (error) {
        console.error(`[Matchups API] Error fetching week ${week}:`, error)
        // Continue with other weeks
      }
    }

    // Calculate win percentages and finalize data
    const finalResults: TeamMatchupSummary[] = Array.from(teamMatchupData.values()).map(team => {
      const totalGames = team.wins + team.losses + team.ties
      const winPercentage = totalGames > 0 ? team.wins / totalGames : 0
      
      return {
        ...team,
        winPercentage
      }
    })

    console.log(`[Matchups API] Successfully processed ${finalResults.length} teams for ${weeksToFetch.length} weeks`)

    // If we have no data (due to rate limiting or no games yet), return fallback data
    if (finalResults.length === 0) {
      console.log(`[Matchups API] No matchup data found, creating fallback data for all teams`)
      
      // Create entries for all 12 teams with zero stats
      const fallbackResults: TeamMatchupSummary[] = []
      
      for (let i = 1; i <= 12; i++) {
        const franchiseId = i.toString().padStart(4, '0')
        fallbackResults.push({
          franchiseId,
          manager: getOwnerName(franchiseId, year),
          teamName: franchiseNames[franchiseId] || `Team ${franchiseId}`,
          wins: 0,
          losses: 0,
          ties: weeksToFetch.length, // Show ties for all weeks requested since no games are complete yet
          pointsFor: 0,
          pointsAgainst: 0,
          winPercentage: 0,
          matchups: [],
          year
        })
      }
      
      return NextResponse.json(fallbackResults)
    }

    return NextResponse.json(finalResults)

  } catch (error) {
    console.error('[Matchups API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch matchup data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}