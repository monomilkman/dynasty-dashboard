/**
 * Playoff History Tracking Utility
 *
 * Manages historical playoff probability data using localStorage to track
 * how each team's playoff odds change week-by-week throughout the season.
 */

export interface WeeklyProbabilitySnapshot {
  week: number
  date: string // ISO timestamp
  playoffProbability: number
  divisionWinProbability: number
  avgSeed: number
  record: {
    wins: number
    losses: number
    ties: number
  }
  pointsFor: number
  gamesBack: number
}

export interface TeamPlayoffHistory {
  franchiseId: string
  franchiseName: string
  year: number
  snapshots: WeeklyProbabilitySnapshot[]
  lastUpdated: string
}

export interface PlayoffHistoryData {
  [year: string]: {
    [franchiseId: string]: TeamPlayoffHistory
  }
}

const STORAGE_KEY = 'mfl_playoff_history'

/**
 * Get all playoff history data from localStorage
 */
export function getPlayoffHistory(): PlayoffHistoryData {
  if (typeof window === 'undefined') return {}

  try {
    const data = localStorage.getItem(STORAGE_KEY)
    return data ? JSON.parse(data) : {}
  } catch (error) {
    console.error('Error reading playoff history:', error)
    return {}
  }
}

/**
 * Save playoff history data to localStorage
 */
function savePlayoffHistory(data: PlayoffHistoryData): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Error saving playoff history:', error)
  }
}

/**
 * Get playoff history for a specific team and year
 */
export function getTeamHistory(
  franchiseId: string,
  year: number
): TeamPlayoffHistory | null {
  const history = getPlayoffHistory()
  return history[year]?.[franchiseId] || null
}

/**
 * Add a new weekly snapshot to a team's playoff history
 */
export function addWeeklySnapshot(
  franchiseId: string,
  franchiseName: string,
  year: number,
  week: number,
  snapshot: Omit<WeeklyProbabilitySnapshot, 'week' | 'date'>
): void {
  const history = getPlayoffHistory()

  // Initialize year and team if needed
  if (!history[year]) {
    history[year] = {}
  }

  if (!history[year][franchiseId]) {
    history[year][franchiseId] = {
      franchiseId,
      franchiseName,
      year,
      snapshots: [],
      lastUpdated: new Date().toISOString()
    }
  }

  const teamHistory = history[year][franchiseId]

  // Check if snapshot for this week already exists
  const existingIndex = teamHistory.snapshots.findIndex(s => s.week === week)

  const newSnapshot: WeeklyProbabilitySnapshot = {
    week,
    date: new Date().toISOString(),
    ...snapshot
  }

  if (existingIndex >= 0) {
    // Update existing snapshot
    teamHistory.snapshots[existingIndex] = newSnapshot
  } else {
    // Add new snapshot and sort by week
    teamHistory.snapshots.push(newSnapshot)
    teamHistory.snapshots.sort((a, b) => a.week - b.week)
  }

  teamHistory.lastUpdated = new Date().toISOString()

  savePlayoffHistory(history)
}

/**
 * Batch update snapshots for multiple teams in a single week
 */
export function batchUpdateSnapshots(
  year: number,
  week: number,
  teams: Array<{
    franchiseId: string
    franchiseName: string
    playoffProbability: number
    divisionWinProbability: number
    avgSeed: number
    wins: number
    losses: number
    ties: number
    pointsFor: number
    gamesBack: number
  }>
): void {
  const history = getPlayoffHistory()

  if (!history[year]) {
    history[year] = {}
  }

  teams.forEach(team => {
    if (!history[year][team.franchiseId]) {
      history[year][team.franchiseId] = {
        franchiseId: team.franchiseId,
        franchiseName: team.franchiseName,
        year,
        snapshots: [],
        lastUpdated: new Date().toISOString()
      }
    }

    const teamHistory = history[year][team.franchiseId]
    const existingIndex = teamHistory.snapshots.findIndex(s => s.week === week)

    const snapshot: WeeklyProbabilitySnapshot = {
      week,
      date: new Date().toISOString(),
      playoffProbability: team.playoffProbability,
      divisionWinProbability: team.divisionWinProbability,
      avgSeed: team.avgSeed,
      record: {
        wins: team.wins,
        losses: team.losses,
        ties: team.ties
      },
      pointsFor: team.pointsFor,
      gamesBack: team.gamesBack
    }

    if (existingIndex >= 0) {
      teamHistory.snapshots[existingIndex] = snapshot
    } else {
      teamHistory.snapshots.push(snapshot)
      teamHistory.snapshots.sort((a, b) => a.week - b.week)
    }

    teamHistory.lastUpdated = new Date().toISOString()
  })

  savePlayoffHistory(history)
}

/**
 * Get probability change from previous week
 */
export function getProbabilityChange(
  franchiseId: string,
  year: number,
  currentWeek: number
): number | null {
  const teamHistory = getTeamHistory(franchiseId, year)
  if (!teamHistory || teamHistory.snapshots.length < 2) return null

  const currentSnapshot = teamHistory.snapshots.find(s => s.week === currentWeek)
  const previousSnapshot = teamHistory.snapshots.find(s => s.week === currentWeek - 1)

  if (!currentSnapshot || !previousSnapshot) return null

  return currentSnapshot.playoffProbability - previousSnapshot.playoffProbability
}

/**
 * Get all history for a specific year
 */
export function getYearHistory(year: number): Record<string, TeamPlayoffHistory> {
  const history = getPlayoffHistory()
  return history[year] || {}
}

/**
 * Clear all playoff history (useful for testing or reset)
 */
export function clearPlayoffHistory(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

/**
 * Clear history for a specific year
 */
export function clearYearHistory(year: number): void {
  const history = getPlayoffHistory()
  delete history[year]
  savePlayoffHistory(history)
}

/**
 * Export history as JSON for download/backup
 */
export function exportHistoryAsJson(): string {
  return JSON.stringify(getPlayoffHistory(), null, 2)
}

/**
 * Import history from JSON backup
 */
export function importHistoryFromJson(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString)
    savePlayoffHistory(data)
    return true
  } catch (error) {
    console.error('Error importing playoff history:', error)
    return false
  }
}
