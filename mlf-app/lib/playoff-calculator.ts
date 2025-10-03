/**
 * Monte Carlo Playoff Calculator
 * Simulates remaining games to calculate playoff probabilities
 */

import type { StandingsFranchise } from '@/app/api/mfl/standings/route'
import type { TeamSchedule } from '@/app/api/mfl/schedule-remaining/route'
import type { DivisionsData } from '@/app/api/mfl/divisions/route'
import {
  determinePlayoffSeeding,
  type TeamRecord,
} from './tiebreaker-utils'
import { calculateMatchupWinProbability } from './schedule-strength'

const SIMULATION_ITERATIONS = 10000 // Number of Monte Carlo simulations
const RECENT_FORM_WEEKS = 3 // Weight last 3 weeks more heavily

export interface PlayoffProbabilities {
  franchiseId: string
  playoffProbability: number // 0-100%
  divisionWinProbability: number // 0-100%
  wildcardProbability: number // 0-100%
  seedProbabilities: number[] // [seed1%, seed2%, ..., seed6%]
  averageSeed: number // Average playoff seed (1-6, 0 if miss playoffs)
  eliminationNumber: number // Games needed for elimination
  magicNumber: number // Games needed to clinch (0 if clinched)
  clinchScenarios: string[] // Human-readable clinching scenarios
}

export interface SimulationResult {
  franchiseId: string
  finalWins: number
  finalLosses: number
  finalTies: number
  finalPointsFor: number
  madePlayoffs: boolean
  seed: number // 0 if missed playoffs
  isDivisionWinner: boolean
}

/**
 * Simulate a single game outcome based on win probability
 */
function simulateGame(winProbability: number): 'W' | 'L' {
  const random = Math.random()

  // Add variance (±10%) to make simulations less deterministic
  const variance = (Math.random() - 0.5) * 0.2 // -0.1 to +0.1
  const adjustedProbability = Math.max(0.05, Math.min(0.95, winProbability + variance))

  return random < adjustedProbability ? 'W' : 'L'
}

/**
 * Calculate recent form multiplier based on last N weeks
 */
function calculateRecentFormMultiplier(
  franchiseId: string,
  standings: StandingsFranchise[],
  recentWeeks: number = RECENT_FORM_WEEKS
): number {
  // For now, use overall win percentage as proxy
  // TODO: Could be enhanced with actual weekly results data
  const team = standings.find(s => s.id === franchiseId)
  if (!team) return 1.0

  const winPct = parseFloat(team.h2hpct) || 0.5

  // Scale from 0.8 to 1.2 based on win percentage
  return 0.8 + (winPct * 0.4)
}

/**
 * Run a single Monte Carlo simulation
 */
function runSingleSimulation(
  standings: StandingsFranchise[],
  schedules: TeamSchedule[],
  divisionsData: DivisionsData
): SimulationResult[] {
  // Initialize simulation state for each team
  const simulatedStandings: Record<string, {
    wins: number
    losses: number
    ties: number
    pointsFor: number
    pointsAgainst: number
  }> = {}

  standings.forEach(team => {
    simulatedStandings[team.id] = {
      wins: parseInt(team.h2hw) || 0,
      losses: parseInt(team.h2hl) || 0,
      ties: parseInt(team.h2ht) || 0,
      pointsFor: parseFloat(team.pf) || 0,
      pointsAgainst: parseFloat(team.pa) || 0,
    }
  })

  // Simulate remaining games for each team
  schedules.forEach(schedule => {
    schedule.remainingGames.forEach(game => {
      const recentForm = calculateRecentFormMultiplier(schedule.franchiseId, standings)
      const winProbability = calculateMatchupWinProbability(
        schedule.franchiseId,
        game.opponentId,
        standings,
        recentForm
      )

      const result = simulateGame(winProbability)

      // Update standings for both teams
      if (result === 'W') {
        simulatedStandings[schedule.franchiseId].wins++
        simulatedStandings[game.opponentId].losses++

        // Estimate points (use average ± 10%)
        const teamAvgPts = parseFloat(standings.find(s => s.id === schedule.franchiseId)?.avgpf || '0') || 0
        const oppAvgPts = parseFloat(standings.find(s => s.id === game.opponentId)?.avgpf || '0') || 0

        const teamPoints = teamAvgPts * (0.9 + Math.random() * 0.2)
        const oppPoints = oppAvgPts * (0.9 + Math.random() * 0.2)

        simulatedStandings[schedule.franchiseId].pointsFor += teamPoints
        simulatedStandings[game.opponentId].pointsFor += oppPoints
        simulatedStandings[schedule.franchiseId].pointsAgainst += oppPoints
        simulatedStandings[game.opponentId].pointsAgainst += teamPoints
      } else {
        simulatedStandings[schedule.franchiseId].losses++
        simulatedStandings[game.opponentId].wins++

        // Estimate points
        const teamAvgPts = parseFloat(standings.find(s => s.id === schedule.franchiseId)?.avgpf || '0') || 0
        const oppAvgPts = parseFloat(standings.find(s => s.id === game.opponentId)?.avgpf || '0') || 0

        const teamPoints = teamAvgPts * (0.9 + Math.random() * 0.2)
        const oppPoints = oppAvgPts * (0.9 + Math.random() * 0.2)

        simulatedStandings[schedule.franchiseId].pointsFor += teamPoints
        simulatedStandings[game.opponentId].pointsFor += oppPoints
        simulatedStandings[schedule.franchiseId].pointsAgainst += oppPoints
        simulatedStandings[game.opponentId].pointsAgainst += teamPoints
      }
    })
  })

  // Convert simulated standings to TeamRecord format
  const teamRecords: TeamRecord[] = standings.map(team => {
    const simStanding = simulatedStandings[team.id]
    const divRecordParts = team.divwlt.split('-')
    const divWins = parseInt(divRecordParts[0]) || 0
    const divLosses = parseInt(divRecordParts[1]) || 0
    const divTies = parseInt(divRecordParts[2]) || 0

    return {
      franchiseId: team.id,
      wins: simStanding.wins,
      losses: simStanding.losses,
      ties: simStanding.ties,
      pointsFor: simStanding.pointsFor,
      pointsAgainst: simStanding.pointsAgainst,
      divisionWins: divWins,
      divisionLosses: divLosses,
      divisionTies: divTies,
      opponentPointsFor: 0, // Not needed for simulation
    }
  })

  // Determine playoff seeding
  const playoffSeeds = determinePlayoffSeeding(teamRecords, divisionsData.divisionMap)

  // Build simulation results
  const results: SimulationResult[] = standings.map(team => {
    const seed = playoffSeeds.find(s => s.franchiseId === team.id)
    const simStanding = simulatedStandings[team.id]

    return {
      franchiseId: team.id,
      finalWins: simStanding.wins,
      finalLosses: simStanding.losses,
      finalTies: simStanding.ties,
      finalPointsFor: simStanding.pointsFor,
      madePlayoffs: seed !== undefined,
      seed: seed?.seed || 0,
      isDivisionWinner: seed?.isDivisionWinner || false,
    }
  })

  return results
}

/**
 * Run Monte Carlo simulation to calculate playoff probabilities
 */
export function calculatePlayoffProbabilities(
  standings: StandingsFranchise[],
  schedules: TeamSchedule[],
  divisionsData: DivisionsData,
  iterations: number = SIMULATION_ITERATIONS
): PlayoffProbabilities[] {
  console.log(`Starting Monte Carlo simulation with ${iterations} iterations...`)

  // Initialize probability tracking
  const probabilityData: Record<string, {
    playoffCount: number
    divisionWinCount: number
    wildcardCount: number
    seedCounts: number[] // [seed1, seed2, ..., seed6]
    totalSeed: number
  }> = {}

  standings.forEach(team => {
    probabilityData[team.id] = {
      playoffCount: 0,
      divisionWinCount: 0,
      wildcardCount: 0,
      seedCounts: [0, 0, 0, 0, 0, 0],
      totalSeed: 0,
    }
  })

  // Run simulations
  for (let i = 0; i < iterations; i++) {
    const results = runSingleSimulation(standings, schedules, divisionsData)

    results.forEach(result => {
      if (result.madePlayoffs) {
        probabilityData[result.franchiseId].playoffCount++

        if (result.isDivisionWinner) {
          probabilityData[result.franchiseId].divisionWinCount++
        } else {
          probabilityData[result.franchiseId].wildcardCount++
        }

        if (result.seed >= 1 && result.seed <= 6) {
          probabilityData[result.franchiseId].seedCounts[result.seed - 1]++
          probabilityData[result.franchiseId].totalSeed += result.seed
        }
      }
    })

    // Log progress every 1000 iterations
    if ((i + 1) % 1000 === 0) {
      console.log(`Completed ${i + 1}/${iterations} simulations...`)
    }
  }

  console.log('Monte Carlo simulation complete!')

  // Calculate final probabilities
  const playoffProbabilities: PlayoffProbabilities[] = standings.map(team => {
    const data = probabilityData[team.id]

    const playoffProbability = (data.playoffCount / iterations) * 100
    const divisionWinProbability = (data.divisionWinCount / iterations) * 100
    const wildcardProbability = (data.wildcardCount / iterations) * 100

    const seedProbabilities = data.seedCounts.map(count => (count / iterations) * 100)
    const averageSeed = data.playoffCount > 0 ? data.totalSeed / data.playoffCount : 0

    // Calculate magic number and elimination number
    const teamSchedule = schedules.find(s => s.franchiseId === team.id)
    const remainingGames = teamSchedule?.remainingGames.length || 0

    const magicNumber = calculateMagicNumber(team.id, standings, schedules, divisionsData, playoffProbability)
    const eliminationNumber = calculateEliminationNumber(team.id, standings, schedules, playoffProbability)

    // Generate clinching scenarios
    const clinchScenarios = generateClinchScenarios(
      team.id,
      standings,
      schedules,
      { ...data, playoffProbability, divisionWinProbability, magicNumber, eliminationNumber, remainingGames }
    )

    return {
      franchiseId: team.id,
      playoffProbability,
      divisionWinProbability,
      wildcardProbability,
      seedProbabilities,
      averageSeed,
      eliminationNumber,
      magicNumber,
      clinchScenarios,
    }
  })

  // Sort by playoff probability (descending)
  playoffProbabilities.sort((a, b) => b.playoffProbability - a.playoffProbability)

  return playoffProbabilities
}

/**
 * Calculate magic number for clinching playoffs
 * Magic number = wins needed to guarantee playoff spot
 */
function calculateMagicNumber(
  franchiseId: string,
  standings: StandingsFranchise[],
  schedules: TeamSchedule[],
  divisionsData: DivisionsData,
  playoffProbability: number
): number {
  // If already clinched (99.9%+), magic number is 0
  if (playoffProbability >= 99.9) return 0

  const team = standings.find(s => s.id === franchiseId)
  if (!team) return 99

  const currentWins = parseInt(team.h2hw) || 0
  const teamSchedule = schedules.find(s => s.franchiseId === franchiseId)
  const remainingGames = teamSchedule?.remainingGames.length || 0

  // If eliminated (< 1%), magic number is impossible
  if (playoffProbability < 1.0 || remainingGames === 0) return 99

  // Get all teams and sort by wins
  const allTeams = standings.map(s => ({
    id: s.id,
    wins: parseInt(s.h2hw) || 0,
    losses: parseInt(s.h2hl) || 0,
    schedule: schedules.find(sch => sch.franchiseId === s.id)
  })).sort((a, b) => b.wins - a.wins)

  // Find the 7th place team (first team out of playoffs)
  const seventhPlace = allTeams[6] // 0-indexed, so 6 is 7th place
  if (!seventhPlace) return 1 // Not enough teams

  const seventhPlaceMaxWins = seventhPlace.wins + (seventhPlace.schedule?.remainingGames.length || 0)

  // Magic number is wins needed to guarantee finishing ahead of 7th place
  // We need to win enough games that 7th place can't catch us
  const winsNeeded = Math.max(0, seventhPlaceMaxWins + 1 - currentWins)

  // Can't need more wins than games remaining
  return Math.min(winsNeeded, remainingGames)
}

/**
 * Calculate elimination number
 * Elimination number = losses that would eliminate from playoffs
 */
function calculateEliminationNumber(
  franchiseId: string,
  standings: StandingsFranchise[],
  schedules: TeamSchedule[],
  playoffProbability: number
): number {
  // If already clinched, can't be eliminated
  if (playoffProbability >= 99.9) return 99

  const team = standings.find(s => s.id === franchiseId)
  if (!team) return 0

  const currentWins = parseInt(team.h2hw) || 0
  const currentLosses = parseInt(team.h2hl) || 0
  const teamSchedule = schedules.find(s => s.franchiseId === franchiseId)
  const remainingGames = teamSchedule?.remainingGames.length || 0

  // If already eliminated
  if (playoffProbability < 1.0) return 0

  // Maximum wins possible
  const maxWins = currentWins + remainingGames

  // Get 6th place team (last playoff spot)
  const allTeams = standings.map(s => ({
    id: s.id,
    wins: parseInt(s.h2hw) || 0,
  })).sort((a, b) => b.wins - a.wins)

  const sixthPlace = allTeams[5] // 0-indexed
  if (!sixthPlace || sixthPlace.id === franchiseId) {
    // We're in the top 6, calculate based on 7th place
    const seventhPlace = allTeams[6]
    if (!seventhPlace) return remainingGames // Safe for now

    // If 7th place can overtake our max wins, we need to avoid losses
    const lossesUntilElimination = Math.max(0, maxWins - seventhPlace.wins)
    return Math.min(lossesUntilElimination, remainingGames)
  }

  // We're below 6th place - calculate losses until we can't catch 6th
  const lossesUntilElimination = Math.max(0, maxWins - sixthPlace.wins)
  return Math.min(lossesUntilElimination, remainingGames)
}

/**
 * Generate human-readable clinching scenarios
 */
function generateClinchScenarios(
  franchiseId: string,
  standings: StandingsFranchise[],
  schedules: TeamSchedule[],
  data: {
    playoffProbability: number
    divisionWinProbability: number
    magicNumber: number
    eliminationNumber: number
    remainingGames: number
  }
): string[] {
  const scenarios: string[] = []
  const { playoffProbability, divisionWinProbability, magicNumber, eliminationNumber, remainingGames } = data

  // Already clinched (99.9%+)
  if (playoffProbability >= 99.9) {
    if (divisionWinProbability >= 99.9) {
      scenarios.push('✓ Clinched division title!')
    } else {
      scenarios.push('✓ Clinched playoff spot!')
    }
    if (remainingGames > 0) {
      scenarios.push(`Playing for ${divisionWinProbability < 99.9 ? 'division title and ' : ''}seeding`)
    }
    return scenarios
  }

  // Eliminated (< 1%)
  if (playoffProbability < 1.0) {
    scenarios.push('✗ Eliminated from playoff contention')
    return scenarios
  }

  // Very likely (80-99.9%)
  if (playoffProbability >= 80) {
    if (magicNumber > 0 && magicNumber < 99) {
      scenarios.push(`Magic number: ${magicNumber} (win ${magicNumber} ${magicNumber === 1 ? 'game' : 'games'} to clinch)`)
    }
    if (divisionWinProbability >= 50) {
      scenarios.push('Leading division race')
    }
    const winsNeeded = Math.ceil(remainingGames * 0.4) // Need ~40% of remaining
    if (winsNeeded > 0) {
      scenarios.push(`Win ${winsNeeded} of next ${remainingGames} games to secure spot`)
    }
    return scenarios
  }

  // Likely (50-80%)
  if (playoffProbability >= 50) {
    const winsNeeded = Math.ceil(remainingGames * 0.6) // Need ~60% of remaining
    scenarios.push(`Win ${winsNeeded} of ${remainingGames} remaining games`)
    if (divisionWinProbability >= 30) {
      scenarios.push('In division race - key games ahead')
    } else {
      scenarios.push('Competing for wildcard spot')
    }
    return scenarios
  }

  // Bubble team (20-50%)
  if (playoffProbability >= 20) {
    const winsNeeded = Math.ceil(remainingGames * 0.75) // Need ~75% of remaining
    scenarios.push(`Must win ${winsNeeded} of ${remainingGames} remaining games`)
    scenarios.push('Need help from other teams')
    if (eliminationNumber > 0 && eliminationNumber < 99) {
      scenarios.push(`⚠️ ${eliminationNumber} ${eliminationNumber === 1 ? 'loss' : 'losses'} eliminates`)
    }
    return scenarios
  }

  // Long shot (1-20%)
  if (playoffProbability >= 1) {
    if (remainingGames > 0) {
      scenarios.push(`Must win out (${remainingGames} games)`)
      scenarios.push('Requires multiple upsets by other teams')
    }
    if (eliminationNumber === 1) {
      scenarios.push('⚠️ Any loss eliminates')
    }
    return scenarios
  }

  return scenarios
}

/**
 * Get current playoff picture (standings with probabilities)
 */
export interface PlayoffPicture {
  currentStandings: Array<{
    rank: number
    franchiseId: string
    wins: number
    losses: number
    ties: number
    winPercentage: number
    pointsFor: number
    playoffProbability: number
    status: 'clinched' | 'likely' | 'bubble' | 'eliminated'
  }>
  divisionLeaders: string[]
  wildcardRace: string[]
  cutoffProbability: number // Probability of 6th seed
}

export function getPlayoffPicture(
  standings: StandingsFranchise[],
  probabilities: PlayoffProbabilities[],
  divisionsData: DivisionsData
): PlayoffPicture {
  // Build current standings with probabilities
  const currentStandings = standings.map((team, index) => {
    const prob = probabilities.find(p => p.franchiseId === team.id)

    let status: 'clinched' | 'likely' | 'bubble' | 'eliminated' = 'bubble'
    if (prob) {
      if (prob.playoffProbability >= 99) status = 'clinched'
      else if (prob.playoffProbability >= 70) status = 'likely'
      else if (prob.playoffProbability < 5) status = 'eliminated'
    }

    return {
      rank: index + 1,
      franchiseId: team.id,
      wins: parseInt(team.h2hw) || 0,
      losses: parseInt(team.h2hl) || 0,
      ties: parseInt(team.h2ht) || 0,
      winPercentage: parseFloat(team.h2hpct) || 0,
      pointsFor: parseFloat(team.pf) || 0,
      playoffProbability: prob?.playoffProbability || 0,
      status,
    }
  })

  // Sort by win percentage, then points for
  currentStandings.sort((a, b) => {
    if (Math.abs(a.winPercentage - b.winPercentage) > 0.001) {
      return b.winPercentage - a.winPercentage
    }
    return b.pointsFor - a.pointsFor
  })

  // Determine division leaders (top team from each division)
  const divisionLeaders = Object.keys(divisionsData.divisionNames).map(divId => {
    const divTeams = currentStandings.filter(
      t => divisionsData.divisionMap[t.franchiseId] === divId
    )
    return divTeams[0]?.franchiseId || ''
  }).filter(Boolean)

  // Wildcard race (top 6 non-division-leaders by win percentage)
  const wildcardRace = currentStandings
    .filter(t => !divisionLeaders.includes(t.franchiseId))
    .slice(0, 6)
    .map(t => t.franchiseId)

  // 6th seed cutoff probability
  const sixthSeedProb = currentStandings[5]?.playoffProbability || 0

  return {
    currentStandings,
    divisionLeaders,
    wildcardRace,
    cutoffProbability: sixthSeedProb,
  }
}
