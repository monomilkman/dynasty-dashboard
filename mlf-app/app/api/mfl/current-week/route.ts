import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const MFL_API_BASE = 'https://api.myfantasyleague.com'
const LEAGUE_ID = '46221'

interface CalendarEvent {
  id: string
  type: string
  start_time: string
  end_time: string
  title: string
  happens: string
}

interface CalendarResponse {
  calendar?: {
    event?: CalendarEvent[]
  }
}

interface WeeklyResultsResponse {
  weeklyResults?: {
    week?: string
    matchup?: unknown[]
  }
}

/**
 * Detects the current fantasy football week based on calendar events and weekly results
 *
 * Strategy:
 * 1. Check calendar.json for WAIVER_BBID events with "happens" field
 * 2. Find the most recent waiver period that has occurred
 * 3. Fallback: Check weeklyresults.json for latest completed week
 * 4. Default: Return week 1 if no data available
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || new Date().getFullYear().toString()

    console.log(`[Current Week API] Detecting current week for year ${year}`)

    // Fetch calendar data
    const calendarUrl = `${MFL_API_BASE}/${year}/export?TYPE=calendar&L=${LEAGUE_ID}&JSON=1`
    console.log(`[Current Week API] Fetching calendar: ${calendarUrl}`)

    const calendarResponse = await fetch(calendarUrl)

    if (calendarResponse.status === 429) {
      // Rate limited - return default current week estimate
      const now = new Date()
      const seasonStart = new Date(`${year}-09-01`) // Approximate season start
      const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
      const estimatedWeek = Math.max(1, Math.min(17, weeksSinceStart + 1))

      console.log(`[Current Week API] Rate limited, estimating week ${estimatedWeek}`)

      return NextResponse.json({
        currentWeek: estimatedWeek,
        source: 'estimated',
        message: 'Rate limited - using date-based estimate'
      })
    }

    const calendarData: CalendarResponse = await calendarResponse.json()

    // Method 1: Parse calendar events for waiver periods with "happens" field
    if (calendarData.calendar?.event) {
      const events = Array.isArray(calendarData.calendar.event)
        ? calendarData.calendar.event
        : [calendarData.calendar.event]

      // Find WAIVER_BBID events that have "happens" field (indicates the week)
      const waiverEvents = events.filter(event =>
        event.type === 'WAIVER_BBID' && event.happens
      )

      if (waiverEvents.length > 0) {
        const now = Math.floor(Date.now() / 1000) // Current Unix timestamp

        // Find the most recent waiver event that has passed
        const recentWaivers = waiverEvents
          .filter(event => parseInt(event.start_time) <= now)
          .sort((a, b) => parseInt(b.start_time) - parseInt(a.start_time))

        if (recentWaivers.length > 0) {
          const currentWeek = parseInt(recentWaivers[0].happens)
          console.log(`[Current Week API] Detected week ${currentWeek} from calendar waivers`)

          return NextResponse.json({
            currentWeek,
            source: 'calendar',
            timestamp: now,
            lastWaiverEvent: recentWaivers[0]
          })
        }

        // If no waiver has passed yet, check upcoming waivers
        const upcomingWaivers = waiverEvents
          .filter(event => parseInt(event.start_time) > now)
          .sort((a, b) => parseInt(a.start_time) - parseInt(b.start_time))

        if (upcomingWaivers.length > 0) {
          // We're in the week before the first waiver
          const nextWeek = parseInt(upcomingWaivers[0].happens)
          const currentWeek = Math.max(1, nextWeek - 1)
          console.log(`[Current Week API] Pre-season or early season, detected week ${currentWeek}`)

          return NextResponse.json({
            currentWeek,
            source: 'calendar-preseason',
            timestamp: now,
            nextWaiverEvent: upcomingWaivers[0]
          })
        }
      }
    }

    // Method 2: Fallback to weeklyResults to find latest completed week
    console.log(`[Current Week API] Calendar method failed, checking weekly results`)

    const weeklyResultsUrl = `${MFL_API_BASE}/${year}/export?TYPE=weeklyResults&L=${LEAGUE_ID}&JSON=1`
    const weeklyResponse = await fetch(weeklyResultsUrl)

    if (weeklyResponse.ok) {
      const weeklyData: WeeklyResultsResponse = await weeklyResponse.json()

      if (weeklyData.weeklyResults?.matchup) {
        const matchups = Array.isArray(weeklyData.weeklyResults.matchup)
          ? weeklyData.weeklyResults.matchup
          : [weeklyData.weeklyResults.matchup]

        // Find the latest week with completed results
        const completedWeeks = matchups
          .map(m => (m as { week?: string }).week)
          .filter(Boolean)
          .map(w => parseInt(w as string))
          .sort((a, b) => b - a)

        if (completedWeeks.length > 0) {
          const currentWeek = completedWeeks[0]
          console.log(`[Current Week API] Detected week ${currentWeek} from weekly results`)

          return NextResponse.json({
            currentWeek,
            source: 'weeklyResults',
            completedWeeks
          })
        }
      }
    }

    // Method 3: Ultimate fallback - estimate based on current date
    const now = new Date()
    const year_num = parseInt(year)
    const seasonStart = new Date(year_num, 8, 1) // September 1st
    const seasonEnd = new Date(year_num, 11, 31) // December 31st

    if (now < seasonStart) {
      console.log(`[Current Week API] Before season start, returning week 1`)
      return NextResponse.json({
        currentWeek: 1,
        source: 'preseason',
        message: 'Season has not started yet'
      })
    }

    if (now > seasonEnd) {
      console.log(`[Current Week API] After season end, returning week 17`)
      return NextResponse.json({
        currentWeek: 17,
        source: 'postseason',
        message: 'Season has ended'
      })
    }

    // Estimate week based on date (rough calculation)
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
    const estimatedWeek = Math.max(1, Math.min(17, weeksSinceStart + 1))

    console.log(`[Current Week API] Fallback estimate: week ${estimatedWeek}`)

    return NextResponse.json({
      currentWeek: estimatedWeek,
      source: 'date-estimate',
      message: 'Using date-based estimation'
    })

  } catch (error) {
    console.error('[Current Week API] Error:', error)

    return NextResponse.json(
      {
        error: 'Failed to detect current week',
        details: error instanceof Error ? error.message : 'Unknown error',
        currentWeek: 1, // Safe default
        source: 'error-fallback'
      },
      { status: 500 }
    )
  }
}
