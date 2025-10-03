import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const MFL_API_BASE = 'https://api.myfantasyleague.com'
const LEAGUE_ID = '46221'
const REGULAR_SEASON_END_WEEK = 14

export interface ScheduleMatchup {
  franchise: Array<{
    id: string
    isHome: '0' | '1'
    score?: string
    result?: 'W' | 'L' | 'T' | string
    spread?: string
  }>
}

export interface ScheduleWeek {
  week: string
  matchup: ScheduleMatchup[]
}

export interface ScheduleResponse {
  schedule?: {
    weeklySchedule: ScheduleWeek[]
  }
  encoding?: string
  version?: string
}

export interface RemainingGame {
  week: number
  opponentId: string
  isHome: boolean
  opponentAvgPoints?: number
}

export interface TeamSchedule {
  franchiseId: string
  remainingGames: RemainingGame[]
  completedGames: number
  totalGames: number
}

export interface StrengthOfSchedule {
  franchiseId: string
  avgOpponentPoints: number
  remainingAvgOpponentPoints: number
  hardestOpponent: string
  easiestOpponent: string
}

/**
 * Fetches remaining schedule for all teams
 * Calculates strength of schedule metrics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()
    const currentWeek = parseInt(searchParams.get('currentWeek') || '1')

    console.log(`[Schedule API] Fetching schedule for year ${year}, current week ${currentWeek}`)

    const scheduleUrl = `${MFL_API_BASE}/${year}/export?TYPE=schedule&L=${LEAGUE_ID}&JSON=1`
    console.log(`[Schedule API] URL: ${scheduleUrl}`)

    const response = await fetch(scheduleUrl, {
      headers: {
        'User-Agent': 'dynasty-dashboard/1.0',
      },
    })

    if (response.status === 429) {
      console.log('[Schedule API] Rate limited, returning empty data')

      return NextResponse.json({
        schedules: [],
        strengthOfSchedule: [],
        source: 'fallback',
        message: 'Rate limited - unable to fetch schedule',
      })
    }

    if (!response.ok) {
      throw new Error(`MFL API returned ${response.status}: ${response.statusText}`)
    }

    const data: ScheduleResponse = await response.json()

    if (!data.schedule?.weeklySchedule) {
      console.error('[Schedule API] Invalid response structure:', data)
      throw new Error('Invalid schedule data structure')
    }

    const weeklySchedule = data.schedule.weeklySchedule
    console.log(`[Schedule API] Found ${weeklySchedule.length} weeks of schedule data`)

    // Build team schedules
    const teamSchedules: Record<string, TeamSchedule> = {}
    const teamPoints: Record<string, { total: number; count: number }> = {}

    // First pass: Calculate average points for each team (from completed games)
    weeklySchedule.forEach(week => {
      const weekNum = parseInt(week.week)

      // Only process completed weeks for averages
      if (weekNum >= currentWeek) return

      week.matchup.forEach(matchup => {
        matchup.franchise.forEach(team => {
          const score = parseFloat(team.score || '0')
          if (score > 0) {
            if (!teamPoints[team.id]) {
              teamPoints[team.id] = { total: 0, count: 0 }
            }
            teamPoints[team.id].total += score
            teamPoints[team.id].count += 1
          }
        })
      })
    })

    // Calculate averages
    const teamAvgPoints: Record<string, number> = {}
    Object.entries(teamPoints).forEach(([teamId, data]) => {
      teamAvgPoints[teamId] = data.count > 0 ? data.total / data.count : 0
    })

    console.log('[Schedule API] Calculated average points for teams:', Object.keys(teamAvgPoints).length)

    // Second pass: Build remaining schedules
    weeklySchedule.forEach(week => {
      const weekNum = parseInt(week.week)

      // Skip weeks beyond regular season
      if (weekNum > REGULAR_SEASON_END_WEEK) return

      week.matchup.forEach(matchup => {
        matchup.franchise.forEach((team, index) => {
          // Initialize team schedule if needed
          if (!teamSchedules[team.id]) {
            teamSchedules[team.id] = {
              franchiseId: team.id,
              remainingGames: [],
              completedGames: 0,
              totalGames: 0,
            }
          }

          // Get opponent (the other team in the matchup)
          const opponent = matchup.franchise[index === 0 ? 1 : 0]

          if (weekNum < currentWeek) {
            // Completed game
            teamSchedules[team.id].completedGames += 1
          } else {
            // Remaining game
            teamSchedules[team.id].remainingGames.push({
              week: weekNum,
              opponentId: opponent.id,
              isHome: team.isHome === '1',
              opponentAvgPoints: teamAvgPoints[opponent.id] || 0,
            })
          }

          teamSchedules[team.id].totalGames += 1
        })
      })
    })

    // Calculate strength of schedule metrics
    const strengthOfSchedule: StrengthOfSchedule[] = Object.values(teamSchedules).map(schedule => {
      const allOpponents = [...schedule.remainingGames.map(g => g.opponentId)]
      const remainingOpponents = schedule.remainingGames.map(g => ({
        id: g.opponentId,
        avg: g.opponentAvgPoints || 0,
      }))

      // Calculate average opponent strength
      const totalOpponentPoints = allOpponents.reduce(
        (sum, oppId) => sum + (teamAvgPoints[oppId] || 0),
        0
      )
      const avgOpponentPoints = allOpponents.length > 0 ? totalOpponentPoints / allOpponents.length : 0

      // Calculate remaining opponent strength
      const remainingTotal = remainingOpponents.reduce((sum, opp) => sum + opp.avg, 0)
      const remainingAvgOpponentPoints = remainingOpponents.length > 0 ? remainingTotal / remainingOpponents.length : 0

      // Find hardest and easiest remaining opponents
      const sortedOpponents = [...remainingOpponents].sort((a, b) => b.avg - a.avg)
      const hardestOpponent = sortedOpponents[0]?.id || ''
      const easiestOpponent = sortedOpponents[sortedOpponents.length - 1]?.id || ''

      return {
        franchiseId: schedule.franchiseId,
        avgOpponentPoints,
        remainingAvgOpponentPoints,
        hardestOpponent,
        easiestOpponent,
      }
    })

    console.log(`[Schedule API] Processed schedules for ${Object.keys(teamSchedules).length} teams`)
    console.log(`[Schedule API] Sample team schedule:`, Object.values(teamSchedules)[0])

    return NextResponse.json({
      schedules: Object.values(teamSchedules),
      strengthOfSchedule,
      teamAverages: teamAvgPoints,
      currentWeek,
      regularSeasonEndWeek: REGULAR_SEASON_END_WEEK,
      year,
      timestamp: Date.now(),
      source: 'mfl-api',
    })

  } catch (error) {
    console.error('[Schedule API] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to fetch schedule',
        details: error instanceof Error ? error.message : 'Unknown error',
        schedules: [],
        strengthOfSchedule: [],
      },
      { status: 500 }
    )
  }
}
