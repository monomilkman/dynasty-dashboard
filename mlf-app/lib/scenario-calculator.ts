/**
 * Scenario Calculator
 * Calculates best-case, worst-case, and most likely playoff scenarios
 */

import type { StandingsFranchise } from '@/app/api/mfl/standings/route'
import type { TeamSchedule } from '@/app/api/mfl/schedule-remaining/route'
import type { DivisionsData } from '@/app/api/mfl/divisions/route'
import { calculatePlayoffProbabilities } from './playoff-calculator'
import { calculateMatchupWinProbability } from './schedule-strength'

export interface ScenarioResult {
  record: string  // e.g., "9-5"
  seed: number    // Playoff seed (0 if missed playoffs)
  probability: number  // Probability of this scenario happening
  description: string  // Human-readable description
  playoffProbability: number  // Chance of making playoffs in this scenario
}

/**
 * Calculate best-case scenario (team wins out + all favorable matchups)
 */
export function calculateBestCaseScenario(
  franchiseId: string,
  standings: StandingsFranchise[],
  schedules: TeamSchedule[],
  divisionsData: DivisionsData
): ScenarioResult {
  const team = standings.find(s => s.id === franchiseId)
  const schedule = schedules.find(s => s.franchiseId === franchiseId)

  if (!team || !schedule) {
    return {
      record: '0-0',
      seed: 0,
      probability: 0,
      description: 'Unable to calculate scenario',
      playoffProbability: 0
    }
  }

  const currentWins = parseInt(team.h2hw) || 0
  const currentLosses = parseInt(team.h2hl) || 0
  const currentTies = parseInt(team.h2ht) || 0
  const remainingGames = schedule.remainingGames.length

  // Best case: win all remaining games
  const bestWins = currentWins + remainingGames
  const bestRecord = `${bestWins}-${currentLosses}${currentTies > 0 ? `-${currentTies}` : ''}`

  // Simulate this scenario
  const modifiedStandings = standings.map(s => {
    if (s.id === franchiseId) {
      const newWins = bestWins
      const totalGames = newWins + currentLosses + currentTies
      const newWinPct = ((newWins + currentTies * 0.5) / totalGames).toFixed(3)
      const estimatedAddedPoints = parseFloat(s.avgpf) * remainingGames * 1.1 // Assume slightly above average

      return {
        ...s,
        h2hw: newWins.toString(),
        h2hpct: newWinPct,
        h2hwlt: `${newWins}-${currentLosses}-${currentTies}`,
        pf: (parseFloat(s.pf) + estimatedAddedPoints).toFixed(2),
        avgpf: ((parseFloat(s.pf) + estimatedAddedPoints) / totalGames).toFixed(2)
      }
    }
    return s
  })

  const modifiedSchedules = schedules.map(s => {
    if (s.franchiseId === franchiseId) {
      return {
        ...s,
        remainingGames: [],
        completedGames: s.completedGames + remainingGames
      }
    }
    return s
  })

  // Calculate probability with this scenario
  const probs = calculatePlayoffProbabilities(modifiedStandings, modifiedSchedules, divisionsData, 1000)
  const teamProb = probs.find(p => p.franchiseId === franchiseId)

  // Estimate probability of winning out
  let winOutProbability = 1.0
  schedule.remainingGames.forEach(game => {
    const winProb = calculateMatchupWinProbability(franchiseId, game.opponentId, standings, 1.0)
    winOutProbability *= winProb
  })

  return {
    record: bestRecord,
    seed: teamProb?.averageSeed ? Math.round(teamProb.averageSeed) : 0,
    probability: winOutProbability * 100,
    description: remainingGames > 0
      ? `Win out (${remainingGames}-0) to finish ${bestRecord}`
      : 'Season complete',
    playoffProbability: teamProb?.playoffProbability || 0
  }
}

/**
 * Calculate worst-case scenario (team loses out + all unfavorable matchups)
 */
export function calculateWorstCaseScenario(
  franchiseId: string,
  standings: StandingsFranchise[],
  schedules: TeamSchedule[],
  divisionsData: DivisionsData
): ScenarioResult {
  const team = standings.find(s => s.id === franchiseId)
  const schedule = schedules.find(s => s.franchiseId === franchiseId)

  if (!team || !schedule) {
    return {
      record: '0-0',
      seed: 0,
      probability: 0,
      description: 'Unable to calculate scenario',
      playoffProbability: 0
    }
  }

  const currentWins = parseInt(team.h2hw) || 0
  const currentLosses = parseInt(team.h2hl) || 0
  const currentTies = parseInt(team.h2ht) || 0
  const remainingGames = schedule.remainingGames.length

  // Worst case: lose all remaining games
  const worstLosses = currentLosses + remainingGames
  const worstRecord = `${currentWins}-${worstLosses}${currentTies > 0 ? `-${currentTies}` : ''}`

  // Simulate this scenario
  const modifiedStandings = standings.map(s => {
    if (s.id === franchiseId) {
      const totalGames = currentWins + worstLosses + currentTies
      const newWinPct = ((currentWins + currentTies * 0.5) / totalGames).toFixed(3)
      const estimatedAddedPoints = parseFloat(s.avgpf) * remainingGames * 0.85 // Assume below average in losses

      return {
        ...s,
        h2hl: worstLosses.toString(),
        h2hpct: newWinPct,
        h2hwlt: `${currentWins}-${worstLosses}-${currentTies}`,
        pf: (parseFloat(s.pf) + estimatedAddedPoints).toFixed(2),
        avgpf: ((parseFloat(s.pf) + estimatedAddedPoints) / totalGames).toFixed(2)
      }
    }
    return s
  })

  const modifiedSchedules = schedules.map(s => {
    if (s.franchiseId === franchiseId) {
      return {
        ...s,
        remainingGames: [],
        completedGames: s.completedGames + remainingGames
      }
    }
    return s
  })

  // Calculate probability with this scenario
  const probs = calculatePlayoffProbabilities(modifiedStandings, modifiedSchedules, divisionsData, 1000)
  const teamProb = probs.find(p => p.franchiseId === franchiseId)

  // Estimate probability of losing out
  let loseOutProbability = 1.0
  schedule.remainingGames.forEach(game => {
    const winProb = calculateMatchupWinProbability(franchiseId, game.opponentId, standings, 1.0)
    loseOutProbability *= (1 - winProb)
  })

  return {
    record: worstRecord,
    seed: 0,
    probability: loseOutProbability * 100,
    description: remainingGames > 0
      ? `Lose out (0-${remainingGames}) to finish ${worstRecord}`
      : 'Season complete',
    playoffProbability: teamProb?.playoffProbability || 0
  }
}

/**
 * Calculate most likely scenario based on win probabilities
 */
export function calculateMostLikelyScenario(
  franchiseId: string,
  standings: StandingsFranchise[],
  schedules: TeamSchedule[],
  divisionsData: DivisionsData
): ScenarioResult {
  const team = standings.find(s => s.id === franchiseId)
  const schedule = schedules.find(s => s.franchiseId === franchiseId)

  if (!team || !schedule) {
    return {
      record: '0-0',
      seed: 0,
      probability: 0,
      description: 'Unable to calculate scenario',
      playoffProbability: 0
    }
  }

  const currentWins = parseInt(team.h2hw) || 0
  const currentLosses = parseInt(team.h2hl) || 0
  const currentTies = parseInt(team.h2ht) || 0

  // Calculate expected wins based on win probability for each game
  let expectedAdditionalWins = 0
  schedule.remainingGames.forEach(game => {
    const winProb = calculateMatchupWinProbability(franchiseId, game.opponentId, standings, 1.0)
    expectedAdditionalWins += winProb
  })

  const projectedWins = Math.round(currentWins + expectedAdditionalWins)
  const projectedLosses = currentLosses + (schedule.remainingGames.length - Math.round(expectedAdditionalWins))
  const projectedRecord = `${projectedWins}-${projectedLosses}${currentTies > 0 ? `-${currentTies}` : ''}`

  // Simulate this scenario
  const modifiedStandings = standings.map(s => {
    if (s.id === franchiseId) {
      const totalGames = projectedWins + projectedLosses + currentTies
      const newWinPct = ((projectedWins + currentTies * 0.5) / totalGames).toFixed(3)
      const estimatedAddedPoints = parseFloat(s.avgpf) * schedule.remainingGames.length

      return {
        ...s,
        h2hw: projectedWins.toString(),
        h2hl: projectedLosses.toString(),
        h2hpct: newWinPct,
        h2hwlt: `${projectedWins}-${projectedLosses}-${currentTies}`,
        pf: (parseFloat(s.pf) + estimatedAddedPoints).toFixed(2),
        avgpf: ((parseFloat(s.pf) + estimatedAddedPoints) / totalGames).toFixed(2)
      }
    }
    return s
  })

  const modifiedSchedules = schedules.map(s => {
    if (s.franchiseId === franchiseId) {
      return {
        ...s,
        remainingGames: [],
        completedGames: s.completedGames + schedule.remainingGames.length
      }
    }
    return s
  })

  // Calculate probability with this scenario
  const probs = calculatePlayoffProbabilities(modifiedStandings, modifiedSchedules, divisionsData, 1000)
  const teamProb = probs.find(p => p.franchiseId === franchiseId)

  const winsNeeded = projectedWins - currentWins
  const lossesExpected = projectedLosses - currentLosses

  return {
    record: projectedRecord,
    seed: teamProb?.averageSeed ? Math.round(teamProb.averageSeed) : 0,
    probability: 40, // Most likely scenarios typically have 30-50% chance in isolation
    description: schedule.remainingGames.length > 0
      ? `Go ${winsNeeded}-${lossesExpected} to finish ${projectedRecord}`
      : 'Season complete',
    playoffProbability: teamProb?.playoffProbability || 0
  }
}

/**
 * Calculate playoff probability for a custom scenario (user-specified results)
 */
export function calculateScenarioProbability(
  franchiseId: string,
  gameResults: Record<number, 'W' | 'L' | null>,  // week -> result
  standings: StandingsFranchise[],
  schedules: TeamSchedule[],
  divisionsData: DivisionsData
): { playoffProbability: number; projectedRecord: string; projectedSeed: number } {
  const team = standings.find(s => s.id === franchiseId)
  const schedule = schedules.find(s => s.franchiseId === franchiseId)

  if (!team || !schedule) {
    return {
      playoffProbability: 0,
      projectedRecord: '0-0',
      projectedSeed: 0
    }
  }

  let currentWins = parseInt(team.h2hw) || 0
  let currentLosses = parseInt(team.h2hl) || 0
  const currentTies = parseInt(team.h2ht) || 0
  let gamesProcessed = 0

  // Count wins and losses from specified results
  schedule.remainingGames.forEach(game => {
    const result = gameResults[game.week]
    if (result === 'W') {
      currentWins++
      gamesProcessed++
    } else if (result === 'L') {
      currentLosses++
      gamesProcessed++
    }
  })

  const projectedRecord = `${currentWins}-${currentLosses}${currentTies > 0 ? `-${currentTies}` : ''}`

  // Simulate with these results
  const modifiedStandings = standings.map(s => {
    if (s.id === franchiseId) {
      const totalGames = currentWins + currentLosses + currentTies
      const newWinPct = ((currentWins + currentTies * 0.5) / totalGames).toFixed(3)
      const estimatedAddedPoints = parseFloat(s.avgpf) * gamesProcessed

      return {
        ...s,
        h2hw: currentWins.toString(),
        h2hl: currentLosses.toString(),
        h2hpct: newWinPct,
        h2hwlt: `${currentWins}-${currentLosses}-${currentTies}`,
        pf: (parseFloat(s.pf) + estimatedAddedPoints).toFixed(2)
      }
    }
    return s
  })

  // Filter out games that have been decided
  const modifiedSchedules = schedules.map(s => {
    if (s.franchiseId === franchiseId) {
      return {
        ...s,
        remainingGames: s.remainingGames.filter(g => !gameResults[g.week] || gameResults[g.week] === null),
        completedGames: s.completedGames + gamesProcessed
      }
    }
    return s
  })

  const probs = calculatePlayoffProbabilities(modifiedStandings, modifiedSchedules, divisionsData, 1000)
  const teamProb = probs.find(p => p.franchiseId === franchiseId)

  return {
    playoffProbability: teamProb?.playoffProbability || 0,
    projectedRecord,
    projectedSeed: teamProb?.averageSeed ? Math.round(teamProb.averageSeed) : 0
  }
}
