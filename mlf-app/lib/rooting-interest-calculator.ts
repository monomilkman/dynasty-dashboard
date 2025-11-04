/**
 * Rooting Interest Calculator
 * Determines which teams the selected team should root for/against in upcoming games
 * Uses conditional probability analysis to identify impactful matchups
 */

import type { StandingsFranchise } from '@/app/api/mfl/standings/route'
import type { TeamSchedule } from '@/app/api/mfl/schedule-remaining/route'
import type { DivisionsData } from '@/app/api/mfl/divisions/route'
import { calculatePlayoffProbabilities } from './playoff-calculator'

export interface RootingInterest {
  matchup: {
    week: number
    teamA: {
      franchiseId: string
      name: string
      currentRecord: string
    }
    teamB: {
      franchiseId: string
      name: string
      currentRecord: string
    }
  }
  rootFor: string  // franchiseId to root for
  importance: 'critical' | 'important' | 'moderate' | 'minor'
  impact: {
    ifRootForWins: number    // playoff % if preferred team wins
    ifRootForLoses: number   // playoff % if preferred team loses
    swing: number            // absolute difference
  }
  explanation: string
  context: 'division-race' | 'wildcard-race' | 'tiebreaker' | 'indirect'
}

export interface RootingInterestAnalysis {
  topMatchups: RootingInterest[]  // Top 5-10 most impactful
  allMatchups: RootingInterest[]  // All remaining matchups
  certaintyLevel: 'high' | 'medium' | 'low'  // Based on games remaining
  weeklyBreakdown: Record<number, RootingInterest[]>  // Grouped by week
}

/**
 * Quick check: Does this team's playoff hopes depend on other results?
 * If already clinched or eliminated, no rooting interests matter
 */
export function hasRelevantRootingInterests(
  playoffProbability: number,
  isEliminated: boolean
): boolean {
  return !isEliminated && playoffProbability < 99.0
}

/**
 * Calculate which teams the selected team should root for/against
 * Uses conditional probability: P(playoffs | outcome A) vs P(playoffs | outcome B)
 */
export function calculateRootingInterests(
  targetFranchiseId: string,
  standings: StandingsFranchise[],
  schedules: TeamSchedule[],
  divisionsData: DivisionsData,
  currentWeek: number
): RootingInterestAnalysis {
  console.log(`[Rooting Interest] Calculating for franchise ${targetFranchiseId}...`)

  const allMatchups: RootingInterest[] = []
  const weeklyBreakdown: Record<number, RootingInterest[]> = {}

  // Get target team's current playoff probability
  const baselineProbs = calculatePlayoffProbabilities(standings, schedules, divisionsData, 1000) // Reduced iterations for speed
  const targetBaselineProb = baselineProbs.find(p => p.franchiseId === targetFranchiseId)?.playoffProbability || 0

  console.log(`[Rooting Interest] Baseline playoff probability: ${targetBaselineProb.toFixed(1)}%`)

  // Build list of all remaining matchups across the league
  const remainingMatchups: Array<{
    week: number
    teamA: string
    teamB: string
  }> = []

  // Track matchups we've already added (to avoid duplicates)
  const matchupKeys = new Set<string>()

  schedules.forEach(schedule => {
    schedule.remainingGames.forEach(game => {
      const key = [schedule.franchiseId, game.opponentId].sort().join('-') + `-${game.week}`
      if (!matchupKeys.has(key)) {
        matchupKeys.add(key)
        remainingMatchups.push({
          week: game.week,
          teamA: schedule.franchiseId,
          teamB: game.opponentId
        })
      }
    })
  })

  console.log(`[Rooting Interest] Found ${remainingMatchups.length} remaining matchups to analyze`)

  // Analyze each matchup
  remainingMatchups.forEach((matchup, index) => {
    // Skip target team's own games
    if (matchup.teamA === targetFranchiseId || matchup.teamB === targetFranchiseId) {
      return
    }

    // Get team data
    const teamAData = standings.find(s => s.id === matchup.teamA)
    const teamBData = standings.find(s => s.id === matchup.teamB)
    const teamAFranchise = divisionsData.franchises.find(f => f.id === matchup.teamA)
    const teamBFranchise = divisionsData.franchises.find(f => f.id === matchup.teamB)

    if (!teamAData || !teamBData) return

    // Calculate impact of Team A winning vs Team B winning
    const probIfAWins = simulateOutcomeImpact(
      targetFranchiseId,
      matchup.teamA, // winner
      matchup.teamB, // loser
      matchup.week,
      standings,
      schedules,
      divisionsData
    )

    const probIfBWins = simulateOutcomeImpact(
      targetFranchiseId,
      matchup.teamB, // winner
      matchup.teamA, // loser
      matchup.week,
      standings,
      schedules,
      divisionsData
    )

    const swing = Math.abs(probIfAWins - probIfBWins)

    // Determine who to root for
    const rootFor = probIfAWins > probIfBWins ? matchup.teamA : matchup.teamB
    const rootAgainst = rootFor === matchup.teamA ? matchup.teamB : matchup.teamA

    // Classify importance
    let importance: 'critical' | 'important' | 'moderate' | 'minor'
    if (swing >= 10) importance = 'critical'
    else if (swing >= 5) importance = 'important'
    else if (swing >= 2) importance = 'moderate'
    else importance = 'minor'

    // Generate explanation
    const explanation = generateExplanation(
      targetFranchiseId,
      rootFor,
      rootAgainst,
      standings,
      divisionsData,
      swing
    )

    // Determine context
    const targetDivision = divisionsData.divisionMap[targetFranchiseId]
    const rootForDivision = divisionsData.divisionMap[rootFor]
    const rootAgainstDivision = divisionsData.divisionMap[rootAgainst]

    let context: 'division-race' | 'wildcard-race' | 'tiebreaker' | 'indirect'
    if (rootForDivision === targetDivision || rootAgainstDivision === targetDivision) {
      context = 'division-race'
    } else if (swing >= 3) {
      context = 'wildcard-race'
    } else if (swing >= 1) {
      context = 'tiebreaker'
    } else {
      context = 'indirect'
    }

    const rootingInterest: RootingInterest = {
      matchup: {
        week: matchup.week,
        teamA: {
          franchiseId: matchup.teamA,
          name: teamAFranchise?.name || matchup.teamA,
          currentRecord: `${teamAData.h2hw}-${teamAData.h2hl}${parseInt(teamAData.h2ht) > 0 ? `-${teamAData.h2ht}` : ''}`
        },
        teamB: {
          franchiseId: matchup.teamB,
          name: teamBFranchise?.name || matchup.teamB,
          currentRecord: `${teamBData.h2hw}-${teamBData.h2hl}${parseInt(teamBData.h2ht) > 0 ? `-${teamBData.h2ht}` : ''}`
        }
      },
      rootFor,
      importance,
      impact: {
        ifRootForWins: rootFor === matchup.teamA ? probIfAWins : probIfBWins,
        ifRootForLoses: rootFor === matchup.teamA ? probIfBWins : probIfAWins,
        swing
      },
      explanation,
      context
    }

    allMatchups.push(rootingInterest)

    // Add to weekly breakdown
    if (!weeklyBreakdown[matchup.week]) {
      weeklyBreakdown[matchup.week] = []
    }
    weeklyBreakdown[matchup.week].push(rootingInterest)

    // Log progress every 20 matchups
    if ((index + 1) % 20 === 0) {
      console.log(`[Rooting Interest] Analyzed ${index + 1}/${remainingMatchups.length} matchups...`)
    }
  })

  // Sort all matchups by swing (descending)
  allMatchups.sort((a, b) => b.impact.swing - a.impact.swing)

  // Get top 5-10 matchups (or fewer if not many matter)
  const topMatchups = allMatchups.filter(m => m.importance === 'critical' || m.importance === 'important').slice(0, 10)

  // Sort weekly breakdown by swing within each week
  Object.keys(weeklyBreakdown).forEach(week => {
    weeklyBreakdown[parseInt(week)].sort((a, b) => b.impact.swing - a.impact.swing)
  })

  // Determine certainty level based on remaining games
  const targetSchedule = schedules.find(s => s.franchiseId === targetFranchiseId)
  const remainingGames = targetSchedule?.remainingGames.length || 0
  let certaintyLevel: 'high' | 'medium' | 'low'
  if (remainingGames <= 3) certaintyLevel = 'high'
  else if (remainingGames <= 5) certaintyLevel = 'medium'
  else certaintyLevel = 'low'

  console.log(`[Rooting Interest] Analysis complete. Found ${topMatchups.length} critical/important matchups out of ${allMatchups.length} total`)

  return {
    topMatchups,
    allMatchups,
    certaintyLevel,
    weeklyBreakdown
  }
}

/**
 * Simulate the impact of a specific matchup outcome on target team's playoff probability
 * Returns the target team's playoff probability if the specified winner wins
 */
function simulateOutcomeImpact(
  targetFranchiseId: string,
  winner: string,
  loser: string,
  week: number,
  standings: StandingsFranchise[],
  schedules: TeamSchedule[],
  divisionsData: DivisionsData
): number {
  // Create modified standings where the winner has one more win
  const modifiedStandings: StandingsFranchise[] = standings.map(team => {
    if (team.id === winner) {
      // Add a win
      const newWins = parseInt(team.h2hw) + 1
      const losses = parseInt(team.h2hl)
      const ties = parseInt(team.h2ht)
      const totalGames = newWins + losses + ties
      const newWinPct = ((newWins + ties * 0.5) / totalGames).toFixed(3)
      const estimatedPoints = parseFloat(team.avgpf) * 1.1 // Assume slightly above average scoring in win

      return {
        ...team,
        h2hw: newWins.toString(),
        h2hpct: newWinPct,
        h2hwlt: `${newWins}-${losses}-${ties}`,
        pf: (parseFloat(team.pf) + estimatedPoints).toFixed(2),
        avgpf: ((parseFloat(team.pf) + estimatedPoints) / totalGames).toFixed(2)
      }
    } else if (team.id === loser) {
      // Add a loss
      const wins = parseInt(team.h2hw)
      const newLosses = parseInt(team.h2hl) + 1
      const ties = parseInt(team.h2ht)
      const totalGames = wins + newLosses + ties
      const newWinPct = ((wins + ties * 0.5) / totalGames).toFixed(3)
      const estimatedPoints = parseFloat(team.avgpf) * 0.9 // Assume slightly below average scoring in loss

      return {
        ...team,
        h2hl: newLosses.toString(),
        h2hpct: newWinPct,
        h2hwlt: `${wins}-${newLosses}-${ties}`,
        pf: (parseFloat(team.pf) + estimatedPoints).toFixed(2),
        avgpf: ((parseFloat(team.pf) + estimatedPoints) / totalGames).toFixed(2)
      }
    }
    return team
  })

  // Create modified schedules with this game removed
  const modifiedSchedules: TeamSchedule[] = schedules.map(schedule => {
    if (schedule.franchiseId === winner || schedule.franchiseId === loser) {
      return {
        ...schedule,
        remainingGames: schedule.remainingGames.filter(g => g.week !== week),
        completedGames: schedule.completedGames + 1
      }
    }
    return schedule
  })

  // Calculate playoff probabilities with modified standings
  const probs = calculatePlayoffProbabilities(modifiedStandings, modifiedSchedules, divisionsData, 500) // Reduced iterations for speed
  const targetProb = probs.find(p => p.franchiseId === targetFranchiseId)

  return targetProb?.playoffProbability || 0
}

/**
 * Generate human-readable explanation for why to root for/against specific teams
 */
function generateExplanation(
  targetFranchiseId: string,
  rootFor: string,
  rootAgainst: string,
  standings: StandingsFranchise[],
  divisionsData: DivisionsData,
  swing: number
): string {
  const targetTeam = standings.find(s => s.id === targetFranchiseId)
  const rootForTeam = standings.find(s => s.id === rootFor)
  const rootAgainstTeam = standings.find(s => s.id === rootAgainst)
  const rootAgainstFranchise = divisionsData.franchises.find(f => f.id === rootAgainst)

  if (!targetTeam || !rootForTeam || !rootAgainstTeam) return 'Affects playoff standings'

  const targetDivision = divisionsData.divisionMap[targetFranchiseId]
  const rootAgainstDivision = divisionsData.divisionMap[rootAgainst]

  const targetWins = parseInt(targetTeam.h2hw)
  const rootAgainstWins = parseInt(rootAgainstTeam.h2hw)

  // Same division
  if (targetDivision === rootAgainstDivision) {
    return `${rootAgainstFranchise?.name || rootAgainst} is your division rival - need them to lose`
  }

  // Team ahead of you
  if (rootAgainstWins > targetWins) {
    const gamesDiff = rootAgainstWins - targetWins
    if (gamesDiff === 1) {
      return `${rootAgainstFranchise?.name || rootAgainst} is 1 game ahead - loss helps you catch them`
    }
    return `${rootAgainstFranchise?.name || rootAgainst} is ${gamesDiff} games ahead - need them to drop games`
  }

  // Team tied with you
  if (rootAgainstWins === targetWins) {
    return `${rootAgainstFranchise?.name || rootAgainst} is tied with you in standings - loss benefits tiebreaker`
  }

  // Generic explanation
  if (swing >= 5) {
    return `Significantly impacts wildcard race`
  }
  return `Indirectly affects playoff positioning`
}
