/**
 * Division Utilities
 * Helper functions for working with league divisions
 */

import type { StandingsFranchise } from '@/app/api/mfl/standings/route'
import type { DivisionsData } from '@/app/api/mfl/divisions/route'

export interface DivisionStanding {
  divisionId: string
  divisionName: string
  teams: DivisionTeamStanding[]
  leader: string // franchiseId of division leader
}

export interface DivisionTeamStanding {
  franchiseId: string
  franchiseName: string
  wins: number
  losses: number
  ties: number
  winPercentage: number
  pointsFor: number
  pointsAgainst: number
  divisionWins: number
  divisionLosses: number
  divisionTies: number
  divisionWinPercentage: number
  gamesBack: number // Games behind division leader
  divisionRank: number
}

/**
 * Parse division record string (e.g., "3-1-0") into components
 */
export function parseDivisionRecord(divwlt: string): {
  wins: number
  losses: number
  ties: number
} {
  const parts = divwlt.split('-')
  return {
    wins: parseInt(parts[0]) || 0,
    losses: parseInt(parts[1]) || 0,
    ties: parseInt(parts[2]) || 0,
  }
}

/**
 * Calculate games back from leader
 * Formula: ((leader_wins - team_wins) + (team_losses - leader_losses)) / 2
 */
export function calculateGamesBack(
  teamWins: number,
  teamLosses: number,
  leaderWins: number,
  leaderLosses: number
): number {
  const winDiff = leaderWins - teamWins
  const lossDiff = teamLosses - leaderLosses
  return (winDiff + lossDiff) / 2
}

/**
 * Build division standings from API data
 */
export function buildDivisionStandings(
  standings: StandingsFranchise[],
  divisionsData: DivisionsData
): DivisionStanding[] {
  const { divisionMap, divisionNames, divisionTeams } = divisionsData

  // Group teams by division
  const divisionGroups: Record<string, StandingsFranchise[]> = {}

  standings.forEach(team => {
    const divisionId = divisionMap[team.id]
    if (!divisionId) {
      console.warn(`Team ${team.id} has no division assignment`)
      return
    }

    if (!divisionGroups[divisionId]) {
      divisionGroups[divisionId] = []
    }
    divisionGroups[divisionId].push(team)
  })

  // Build standings for each division
  const divisionStandings: DivisionStanding[] = []

  Object.entries(divisionGroups).forEach(([divisionId, teams]) => {
    // Sort teams by overall win percentage, then by points for
    const sortedTeams = [...teams].sort((a, b) => {
      const winPctA = parseFloat(a.h2hpct) || 0
      const winPctB = parseFloat(b.h2hpct) || 0

      if (Math.abs(winPctA - winPctB) > 0.001) {
        return winPctB - winPctA
      }

      const pfA = parseFloat(a.pf) || 0
      const pfB = parseFloat(b.pf) || 0
      return pfB - pfA
    })

    // Find leader (first team)
    const leader = sortedTeams[0]
    const leaderWins = parseInt(leader.h2hw) || 0
    const leaderLosses = parseInt(leader.h2hl) || 0

    // Build team standings
    const teamStandings: DivisionTeamStanding[] = sortedTeams.map((team, index) => {
      const wins = parseInt(team.h2hw) || 0
      const losses = parseInt(team.h2hl) || 0
      const ties = parseInt(team.h2ht) || 0
      const totalGames = wins + losses + ties

      const divRecord = parseDivisionRecord(team.divwlt)
      const divTotalGames = divRecord.wins + divRecord.losses + divRecord.ties

      return {
        franchiseId: team.id,
        franchiseName: divisionsData.franchises.find(f => f.id === team.id)?.name || team.id,
        wins,
        losses,
        ties,
        winPercentage: totalGames > 0 ? (wins + ties * 0.5) / totalGames : 0,
        pointsFor: parseFloat(team.pf) || 0,
        pointsAgainst: parseFloat(team.pa) || 0,
        divisionWins: divRecord.wins,
        divisionLosses: divRecord.losses,
        divisionTies: divRecord.ties,
        divisionWinPercentage:
          divTotalGames > 0 ? (divRecord.wins + divRecord.ties * 0.5) / divTotalGames : 0,
        gamesBack: calculateGamesBack(wins, losses, leaderWins, leaderLosses),
        divisionRank: index + 1,
      }
    })

    divisionStandings.push({
      divisionId,
      divisionName: divisionNames[divisionId] || `Division ${divisionId}`,
      teams: teamStandings,
      leader: leader.id,
    })
  })

  // Sort divisions by name (or could sort by leader's record)
  divisionStandings.sort((a, b) => a.divisionName.localeCompare(b.divisionName))

  return divisionStandings
}

/**
 * Get division leader for a specific division
 */
export function getDivisionLeader(
  divisionId: string,
  standings: StandingsFranchise[],
  divisionMap: Record<string, string>
): StandingsFranchise | null {
  const divisionTeams = standings.filter(team => divisionMap[team.id] === divisionId)

  if (divisionTeams.length === 0) return null

  // Sort by win percentage, then points for
  const sorted = [...divisionTeams].sort((a, b) => {
    const winPctA = parseFloat(a.h2hpct) || 0
    const winPctB = parseFloat(b.h2hpct) || 0

    if (Math.abs(winPctA - winPctB) > 0.001) {
      return winPctB - winPctA
    }

    const pfA = parseFloat(a.pf) || 0
    const pfB = parseFloat(b.pf) || 0
    return pfB - pfA
  })

  return sorted[0]
}

/**
 * Check if a team has clinched their division
 * A team clinches when they have more wins than any other team can possibly achieve
 */
export function hasClincheDivision(
  teamId: string,
  divisionId: string,
  standings: StandingsFranchise[],
  divisionMap: Record<string, string>,
  gamesRemaining: Record<string, number>
): boolean {
  const team = standings.find(t => t.id === teamId)
  if (!team) return false

  const teamWins = parseInt(team.h2hw) || 0
  const divisionTeams = standings.filter(
    t => divisionMap[t.id] === divisionId && t.id !== teamId
  )

  // Check if any other team can catch up
  for (const opponent of divisionTeams) {
    const oppWins = parseInt(opponent.h2hw) || 0
    const oppGamesRemaining = gamesRemaining[opponent.id] || 0
    const oppMaxWins = oppWins + oppGamesRemaining

    if (oppMaxWins >= teamWins) {
      return false // Opponent can still catch up
    }
  }

  return true
}

/**
 * Check if a team is eliminated from division race
 */
export function isEliminatedFromDivision(
  teamId: string,
  divisionId: string,
  standings: StandingsFranchise[],
  divisionMap: Record<string, string>,
  gamesRemaining: Record<string, number>
): boolean {
  const team = standings.find(t => t.id === teamId)
  if (!team) return false

  const teamWins = parseInt(team.h2hw) || 0
  const teamGamesRemaining = gamesRemaining[teamId] || 0
  const teamMaxWins = teamWins + teamGamesRemaining

  const divisionTeams = standings.filter(
    t => divisionMap[t.id] === divisionId && t.id !== teamId
  )

  // If any team already has more wins than we can possibly get, we're eliminated
  for (const opponent of divisionTeams) {
    const oppWins = parseInt(opponent.h2hw) || 0

    if (oppWins > teamMaxWins) {
      return true
    }
  }

  return false
}

/**
 * Calculate magic number for clinching division
 * Magic number = games team needs to win to guarantee division title
 */
export function calculateDivisionMagicNumber(
  teamId: string,
  divisionId: string,
  standings: StandingsFranchise[],
  divisionMap: Record<string, string>,
  gamesRemaining: Record<string, number>
): number | null {
  const team = standings.find(t => t.id === teamId)
  if (!team) return null

  const teamWins = parseInt(team.h2hw) || 0
  const teamGamesRemaining = gamesRemaining[teamId] || 0

  // Find second-place team (biggest threat)
  const divisionTeams = standings
    .filter(t => divisionMap[t.id] === divisionId && t.id !== teamId)
    .sort((a, b) => {
      const winsA = parseInt(a.h2hw) || 0
      const winsB = parseInt(b.h2hw) || 0
      return winsB - winsA
    })

  if (divisionTeams.length === 0) return 0 // Only team in division

  const secondPlace = divisionTeams[0]
  const secondPlaceWins = parseInt(secondPlace.h2hw) || 0
  const secondPlaceGamesRemaining = gamesRemaining[secondPlace.id] || 0
  const secondPlaceMaxWins = secondPlaceWins + secondPlaceGamesRemaining

  // Magic number = wins needed to guarantee we're ahead
  const magicNumber = secondPlaceMaxWins - teamWins + 1

  if (magicNumber <= 0) return 0 // Already clinched
  if (magicNumber > teamGamesRemaining) return null // Can't clinch

  return magicNumber
}

/**
 * Get all division leaders as an array
 */
export function getAllDivisionLeaders(
  standings: StandingsFranchise[],
  divisionsData: DivisionsData
): string[] {
  const { divisionMap } = divisionsData
  const divisions = new Set(Object.values(divisionMap))

  const leaders: string[] = []
  divisions.forEach(divisionId => {
    const leader = getDivisionLeader(divisionId, standings, divisionMap)
    if (leader) {
      leaders.push(leader.id)
    }
  })

  return leaders
}
