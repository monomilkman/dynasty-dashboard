/**
 * Schedule Strength Calculator
 * Calculates various strength of schedule metrics
 */

import type { RemainingGame, TeamSchedule } from '@/app/api/mfl/schedule-remaining/route'
import type { StandingsFranchise } from '@/app/api/mfl/standings/route'

export interface ScheduleStrengthMetrics {
  franchiseId: string
  // Overall metrics
  strengthOfSchedule: number // Average opponent win percentage
  strengthOfVictory: number // Average win percentage of teams beaten
  strengthOfRemaining: number // Average opponent win percentage for remaining games
  // Points-based metrics
  avgOpponentPoints: number // Average points scored by opponents
  avgBeatenOpponentPoints: number // Average points by teams we beat
  avgRemainingOpponentPoints: number // Average points by remaining opponents
  // Game counts
  totalGames: number
  completedGames: number
  remainingGames: number
  // Rankings (easier/harder)
  remainingDifficulty: 'easy' | 'medium' | 'hard'
  hardestRemainingOpponent: string
  easiestRemainingOpponent: string
}

/**
 * Calculate strength of schedule (average opponent win percentage)
 */
export function calculateStrengthOfSchedule(
  teamId: string,
  allOpponents: string[],
  standings: StandingsFranchise[]
): number {
  if (allOpponents.length === 0) return 0

  const opponentWinPcts = allOpponents
    .map(oppId => {
      const opp = standings.find(s => s.id === oppId)
      if (!opp) return 0
      return parseFloat(opp.h2hpct) || 0
    })
    .filter(pct => pct > 0)

  if (opponentWinPcts.length === 0) return 0

  return opponentWinPcts.reduce((sum, pct) => sum + pct, 0) / opponentWinPcts.length
}

/**
 * Calculate strength of victory (average win % of teams we've beaten)
 */
export function calculateStrengthOfVictory(
  teamId: string,
  opponentsBeaten: string[],
  standings: StandingsFranchise[]
): number {
  if (opponentsBeaten.length === 0) return 0

  const beatenWinPcts = opponentsBeaten
    .map(oppId => {
      const opp = standings.find(s => s.id === oppId)
      if (!opp) return 0
      return parseFloat(opp.h2hpct) || 0
    })
    .filter(pct => pct >= 0)

  if (beatenWinPcts.length === 0) return 0

  return beatenWinPcts.reduce((sum, pct) => sum + pct, 0) / beatenWinPcts.length
}

/**
 * Calculate average opponent points (from completed games)
 */
export function calculateAvgOpponentPoints(
  opponentIds: string[],
  standings: StandingsFranchise[]
): number {
  if (opponentIds.length === 0) return 0

  const opponentPoints = opponentIds
    .map(oppId => {
      const opp = standings.find(s => s.id === oppId)
      if (!opp) return 0
      return parseFloat(opp.avgpf) || 0
    })
    .filter(pts => pts > 0)

  if (opponentPoints.length === 0) return 0

  return opponentPoints.reduce((sum, pts) => sum + pts, 0) / opponentPoints.length
}

/**
 * Classify difficulty of remaining schedule
 */
export function classifyScheduleDifficulty(strengthOfRemaining: number): 'easy' | 'medium' | 'hard' {
  if (strengthOfRemaining < 0.45) return 'easy'
  if (strengthOfRemaining > 0.55) return 'hard'
  return 'medium'
}

/**
 * Build complete schedule strength metrics for a team
 */
export function buildScheduleStrengthMetrics(
  teamSchedule: TeamSchedule,
  standings: StandingsFranchise[],
  completedResults: Array<{ week: number; opponentId: string; result: 'W' | 'L' | 'T' }>
): ScheduleStrengthMetrics {
  const franchiseId = teamSchedule.franchiseId

  // Get all opponents from completed games
  const completedOpponents = completedResults.map(r => r.opponentId)

  // Get opponents we've beaten
  const beatenOpponents = completedResults
    .filter(r => r.result === 'W')
    .map(r => r.opponentId)

  // Get remaining opponents
  const remainingOpponents = teamSchedule.remainingGames.map(g => g.opponentId)

  // Calculate metrics
  const strengthOfSchedule = calculateStrengthOfSchedule(
    franchiseId,
    completedOpponents,
    standings
  )

  const strengthOfVictory = calculateStrengthOfVictory(franchiseId, beatenOpponents, standings)

  const strengthOfRemaining = calculateStrengthOfSchedule(
    franchiseId,
    remainingOpponents,
    standings
  )

  const avgOpponentPoints = calculateAvgOpponentPoints(completedOpponents, standings)

  const avgBeatenOpponentPoints = calculateAvgOpponentPoints(beatenOpponents, standings)

  const avgRemainingOpponentPoints = calculateAvgOpponentPoints(remainingOpponents, standings)

  // Find hardest and easiest remaining opponents
  const remainingOppsWithStrength = teamSchedule.remainingGames.map(game => {
    const opp = standings.find(s => s.id === game.opponentId)
    return {
      opponentId: game.opponentId,
      winPct: parseFloat(opp?.h2hpct || '0') || 0,
      avgPoints: parseFloat(opp?.avgpf || '0') || 0,
    }
  })

  remainingOppsWithStrength.sort((a, b) => b.winPct - a.winPct)

  const hardestRemainingOpponent = remainingOppsWithStrength[0]?.opponentId || ''
  const easiestRemainingOpponent =
    remainingOppsWithStrength[remainingOppsWithStrength.length - 1]?.opponentId || ''

  return {
    franchiseId,
    strengthOfSchedule,
    strengthOfVictory,
    strengthOfRemaining,
    avgOpponentPoints,
    avgBeatenOpponentPoints,
    avgRemainingOpponentPoints,
    totalGames: teamSchedule.totalGames,
    completedGames: teamSchedule.completedGames,
    remainingGames: teamSchedule.remainingGames.length,
    remainingDifficulty: classifyScheduleDifficulty(strengthOfRemaining),
    hardestRemainingOpponent,
    easiestRemainingOpponent,
  }
}

/**
 * Calculate win probability for a single matchup based on team strength
 */
export function calculateMatchupWinProbability(
  teamId: string,
  opponentId: string,
  standings: StandingsFranchise[],
  recentFormMultiplier: number = 1.0
): number {
  const team = standings.find(s => s.id === teamId)
  const opponent = standings.find(s => s.id === opponentId)

  if (!team || !opponent) return 0.5 // Equal chance if no data

  // Base probability on average points scored
  const teamAvgPoints = parseFloat(team.avgpf) || 0
  const oppAvgPoints = parseFloat(opponent.avgpf) || 0

  if (teamAvgPoints === 0 && oppAvgPoints === 0) return 0.5

  // Simple formula: team's share of combined avg points
  let baseProbability = teamAvgPoints / (teamAvgPoints + oppAvgPoints)

  // Adjust for recent form if provided
  baseProbability *= recentFormMultiplier

  // Clamp between 10% and 90% (no game is 100% certain)
  return Math.max(0.1, Math.min(0.9, baseProbability))
}

/**
 * Calculate expected wins for remaining schedule
 */
export function calculateExpectedWins(
  teamSchedule: TeamSchedule,
  standings: StandingsFranchise[]
): number {
  if (teamSchedule.remainingGames.length === 0) return 0

  const winProbabilities = teamSchedule.remainingGames.map(game => {
    return calculateMatchupWinProbability(teamSchedule.franchiseId, game.opponentId, standings)
  })

  return winProbabilities.reduce((sum, prob) => sum + prob, 0)
}

/**
 * Get all schedule strength metrics for all teams
 */
export function getAllScheduleStrengthMetrics(
  schedules: TeamSchedule[],
  standings: StandingsFranchise[],
  completedResults: Record<string, Array<{ week: number; opponentId: string; result: 'W' | 'L' | 'T' }>>
): ScheduleStrengthMetrics[] {
  return schedules.map(schedule => {
    const teamResults = completedResults[schedule.franchiseId] || []
    return buildScheduleStrengthMetrics(schedule, standings, teamResults)
  })
}

/**
 * Rank teams by remaining schedule difficulty (1 = hardest, 12 = easiest)
 */
export function rankByScheduleDifficulty(
  metrics: ScheduleStrengthMetrics[]
): Array<{ franchiseId: string; difficulty: number; rank: number }> {
  const sorted = [...metrics].sort((a, b) => b.strengthOfRemaining - a.strengthOfRemaining)

  return sorted.map((metric, index) => ({
    franchiseId: metric.franchiseId,
    difficulty: metric.strengthOfRemaining,
    rank: index + 1,
  }))
}

/**
 * Calculate home field advantage adjustment (typically 3-5% boost)
 */
export function applyHomeFieldAdvantage(
  baseProbability: number,
  isHome: boolean,
  homeAdvantage: number = 0.03
): number {
  if (isHome) {
    return Math.min(0.95, baseProbability + homeAdvantage)
  } else {
    return Math.max(0.05, baseProbability - homeAdvantage)
  }
}
