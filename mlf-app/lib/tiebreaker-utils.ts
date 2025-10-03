/**
 * Tiebreaker Utilities for Playoff Seeding
 *
 * Tiebreaker Rules (in order):
 * 1. Overall winning percentage
 * 2. Total points scored
 * 3. Head-to-head record
 * 4. Divisional winning percentage
 * 5. Reverse order of opponent total points scored (lower is better)
 */

export interface TeamRecord {
  franchiseId: string
  wins: number
  losses: number
  ties: number
  pointsFor: number
  pointsAgainst: number
  divisionWins: number
  divisionLosses: number
  divisionTies: number
  opponentPointsFor?: number // Total points scored by all opponents
  headToHeadWins?: Record<string, number> // wins vs specific opponents
  headToHeadLosses?: Record<string, number> // losses vs specific opponents
}

export interface TiebreakerResult {
  winner: string
  loser: string
  reason: string
  step: number
}

/**
 * Calculate overall winning percentage
 */
export function calculateWinPercentage(wins: number, losses: number, ties: number): number {
  const totalGames = wins + losses + ties
  if (totalGames === 0) return 0
  return (wins + ties * 0.5) / totalGames
}

/**
 * Calculate divisional winning percentage
 */
export function calculateDivisionWinPercentage(
  divWins: number,
  divLosses: number,
  divTies: number
): number {
  const totalGames = divWins + divLosses + divTies
  if (totalGames === 0) return 0
  return (divWins + divTies * 0.5) / totalGames
}

/**
 * Get head-to-head record between two teams
 * Returns { wins, losses, ties } for teamA vs teamB
 */
export function getHeadToHeadRecord(
  teamA: TeamRecord,
  teamB: TeamRecord
): { wins: number; losses: number; ties: number } {
  const winsVsB = teamA.headToHeadWins?.[teamB.franchiseId] || 0
  const lossesVsB = teamA.headToHeadLosses?.[teamB.franchiseId] || 0

  // Calculate ties: if B has recorded wins/losses vs A that don't match
  const bWinsVsA = teamB.headToHeadWins?.[teamA.franchiseId] || 0
  const bLossesVsA = teamB.headToHeadLosses?.[teamA.franchiseId] || 0

  const totalGamesVsB = winsVsB + lossesVsB
  const totalGamesBplaysA = bWinsVsA + bLossesVsA
  const ties = Math.max(0, totalGamesVsB - winsVsB - lossesVsB)

  return { wins: winsVsB, losses: lossesVsB, ties }
}

/**
 * Apply tiebreaker rules between two teams
 * Returns 1 if teamA wins, -1 if teamB wins, 0 if still tied
 */
export function applyTiebreaker(teamA: TeamRecord, teamB: TeamRecord): TiebreakerResult | null {
  // Step 1: Overall winning percentage
  const winPctA = calculateWinPercentage(teamA.wins, teamA.losses, teamA.ties)
  const winPctB = calculateWinPercentage(teamB.wins, teamB.losses, teamB.ties)

  if (Math.abs(winPctA - winPctB) > 0.001) { // Use small epsilon for float comparison
    if (winPctA > winPctB) {
      return {
        winner: teamA.franchiseId,
        loser: teamB.franchiseId,
        reason: `Better winning percentage (${(winPctA * 100).toFixed(1)}% vs ${(winPctB * 100).toFixed(1)}%)`,
        step: 1
      }
    } else {
      return {
        winner: teamB.franchiseId,
        loser: teamA.franchiseId,
        reason: `Better winning percentage (${(winPctB * 100).toFixed(1)}% vs ${(winPctA * 100).toFixed(1)}%)`,
        step: 1
      }
    }
  }

  // Step 2: Total points scored
  if (Math.abs(teamA.pointsFor - teamB.pointsFor) > 0.01) {
    if (teamA.pointsFor > teamB.pointsFor) {
      return {
        winner: teamA.franchiseId,
        loser: teamB.franchiseId,
        reason: `More total points (${teamA.pointsFor.toFixed(2)} vs ${teamB.pointsFor.toFixed(2)})`,
        step: 2
      }
    } else {
      return {
        winner: teamB.franchiseId,
        loser: teamA.franchiseId,
        reason: `More total points (${teamB.pointsFor.toFixed(2)} vs ${teamA.pointsFor.toFixed(2)})`,
        step: 2
      }
    }
  }

  // Step 3: Head-to-head record
  const h2h = getHeadToHeadRecord(teamA, teamB)
  if (h2h.wins !== h2h.losses) {
    if (h2h.wins > h2h.losses) {
      return {
        winner: teamA.franchiseId,
        loser: teamB.franchiseId,
        reason: `Won head-to-head (${h2h.wins}-${h2h.losses}${h2h.ties > 0 ? `-${h2h.ties}` : ''})`,
        step: 3
      }
    } else {
      return {
        winner: teamB.franchiseId,
        loser: teamA.franchiseId,
        reason: `Won head-to-head (${h2h.losses}-${h2h.wins}${h2h.ties > 0 ? `-${h2h.ties}` : ''})`,
        step: 3
      }
    }
  }

  // Step 4: Divisional winning percentage
  const divPctA = calculateDivisionWinPercentage(
    teamA.divisionWins,
    teamA.divisionLosses,
    teamA.divisionTies
  )
  const divPctB = calculateDivisionWinPercentage(
    teamB.divisionWins,
    teamB.divisionLosses,
    teamB.divisionTies
  )

  if (Math.abs(divPctA - divPctB) > 0.001) {
    if (divPctA > divPctB) {
      return {
        winner: teamA.franchiseId,
        loser: teamB.franchiseId,
        reason: `Better division record (${(divPctA * 100).toFixed(1)}% vs ${(divPctB * 100).toFixed(1)}%)`,
        step: 4
      }
    } else {
      return {
        winner: teamB.franchiseId,
        loser: teamA.franchiseId,
        reason: `Better division record (${(divPctB * 100).toFixed(1)}% vs ${(divPctA * 100).toFixed(1)}%)`,
        step: 4
      }
    }
  }

  // Step 5: Reverse order of opponent total points scored (lower is better - "strength of schedule")
  if (teamA.opponentPointsFor !== undefined && teamB.opponentPointsFor !== undefined) {
    if (Math.abs(teamA.opponentPointsFor - teamB.opponentPointsFor) > 0.01) {
      if (teamA.opponentPointsFor < teamB.opponentPointsFor) {
        return {
          winner: teamA.franchiseId,
          loser: teamB.franchiseId,
          reason: `Weaker opponents (${teamA.opponentPointsFor.toFixed(2)} vs ${teamB.opponentPointsFor.toFixed(2)} opp pts)`,
          step: 5
        }
      } else {
        return {
          winner: teamB.franchiseId,
          loser: teamA.franchiseId,
          reason: `Weaker opponents (${teamB.opponentPointsFor.toFixed(2)} vs ${teamA.opponentPointsFor.toFixed(2)} opp pts)`,
          step: 5
        }
      }
    }
  }

  // Still tied - return null (should be extremely rare)
  return null
}

/**
 * Sort teams by tiebreaker rules
 * Returns teams sorted from best to worst
 */
export function sortByTiebreakers(teams: TeamRecord[]): TeamRecord[] {
  return [...teams].sort((a, b) => {
    const result = applyTiebreaker(a, b)
    if (!result) return 0 // Still tied
    return result.winner === a.franchiseId ? -1 : 1
  })
}

/**
 * Get tiebreaker explanation between two teams
 */
export function getTiebreakerExplanation(teamA: TeamRecord, teamB: TeamRecord): string {
  const result = applyTiebreaker(teamA, teamB)
  if (!result) {
    return 'Teams are completely tied (extremely rare)'
  }
  return `${result.winner} beats ${result.loser}: ${result.reason}`
}

/**
 * Determine division winners from a list of teams
 * Returns array of division winner franchise IDs
 */
export function determineDivisionWinners(
  teams: TeamRecord[],
  divisionMap: Record<string, string>
): string[] {
  // Group teams by division
  const divisionTeams: Record<string, TeamRecord[]> = {}

  teams.forEach(team => {
    const division = divisionMap[team.franchiseId]
    if (!divisionTeams[division]) {
      divisionTeams[division] = []
    }
    divisionTeams[division].push(team)
  })

  // Find winner of each division
  const winners: string[] = []
  Object.entries(divisionTeams).forEach(([division, divTeams]) => {
    const sorted = sortByTiebreakers(divTeams)
    if (sorted.length > 0) {
      winners.push(sorted[0].franchiseId)
    }
  })

  return winners
}

/**
 * Determine playoff seeding (6 teams: 3 division winners + 3 wildcards)
 * Division winners get top 3 seeds (sorted by tiebreakers)
 * Wildcards get seeds 4-6 (sorted by tiebreakers)
 */
export function determinePlayoffSeeding(
  teams: TeamRecord[],
  divisionMap: Record<string, string>
): { seed: number; franchiseId: string; isDivisionWinner: boolean }[] {
  const divisionWinners = determineDivisionWinners(teams, divisionMap)

  // Separate division winners and wildcards
  const divWinnerTeams = teams.filter(t => divisionWinners.includes(t.franchiseId))
  const wildcardTeams = teams.filter(t => !divisionWinners.includes(t.franchiseId))

  // Sort each group by tiebreakers
  const sortedDivWinners = sortByTiebreakers(divWinnerTeams)
  const sortedWildcards = sortByTiebreakers(wildcardTeams)

  // Assign seeds
  const seeding: { seed: number; franchiseId: string; isDivisionWinner: boolean }[] = []

  // Seeds 1-3: Division winners
  sortedDivWinners.forEach((team, index) => {
    seeding.push({
      seed: index + 1,
      franchiseId: team.franchiseId,
      isDivisionWinner: true
    })
  })

  // Seeds 4-6: Wildcards (top 3)
  sortedWildcards.slice(0, 3).forEach((team, index) => {
    seeding.push({
      seed: index + 4,
      franchiseId: team.franchiseId,
      isDivisionWinner: false
    })
  })

  return seeding
}
