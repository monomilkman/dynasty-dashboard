/**
 * MFL Calculation Utilities
 * Accurate bench points and potential points calculations matching MFL's methodology
 */

import { Player, LineupRequirements } from './mfl'

// League lineup requirements for accurate potential points calculation
export const MFL_LINEUP_REQUIREMENTS: LineupRequirements = {
  qb: 1,
  rb: 2,
  wr: 2,
  te: 1,
  offenseFlex: 1, // RB/WR/TE
  k: 1,
  dl: 2,
  lb: 3,
  cb: 2,
  s: 2,
  defenseFlex: 1, // DL/LB/CB/S
  total: 18
}

export interface PlayerCalculationInfo {
  id: string
  name: string
  position: string
  team: string
  score: number
  status: 'starter' | 'bench' | 'ir' | 'taxi'
  isEligible: boolean // For potential points calculation
}

export interface CalculationDebugInfo {
  franchiseId: string
  totalPlayers: number
  starters: PlayerCalculationInfo[]
  benchPlayers: PlayerCalculationInfo[]
  irPlayers: PlayerCalculationInfo[]
  taxiPlayers: PlayerCalculationInfo[]
  optimalLineup: PlayerCalculationInfo[]
  startersPoints: number
  benchPoints: number
  potentialPoints: number
  issues: string[]
}

/**
 * Calculate accurate bench points
 * Bench points = sum of all rostered players who are NOT starters, excluding IR and Taxi Squad
 */
export function calculateBenchPoints(
  allPlayers: PlayerCalculationInfo[],
  starterIds: Set<string>
): { benchPoints: number; benchPlayers: PlayerCalculationInfo[] } {
  const benchPlayers = allPlayers.filter(player => 
    player.status !== 'ir' && 
    player.status !== 'taxi' && 
    !starterIds.has(player.id)
  )
  
  const benchPoints = benchPlayers.reduce((sum, player) => sum + player.score, 0)
  
  return { benchPoints, benchPlayers }
}

/**
 * Calculate accurate potential points using optimal lineup
 * Potential points = maximum possible score using best available players per position
 */
export function calculatePotentialPoints(
  allPlayers: PlayerCalculationInfo[],
  requirements: LineupRequirements = MFL_LINEUP_REQUIREMENTS
): { potentialPoints: number; optimalLineup: PlayerCalculationInfo[] } {
  // Only use eligible players (exclude IR and Taxi Squad)
  const eligiblePlayers = allPlayers.filter(player => 
    player.status !== 'ir' && player.status !== 'taxi'
  )
  
  // Sort by score descending
  eligiblePlayers.sort((a, b) => b.score - a.score)
  
  const optimalLineup: PlayerCalculationInfo[] = []
  const remaining = [...eligiblePlayers]
  
  // Helper function to fill positions
  function fillPositions(positionFilter: (pos: string) => boolean, count: number, positionName: string) {
    const positionPlayers = remaining.filter(p => positionFilter(p.position))
    const selected = positionPlayers.slice(0, count)
    
    selected.forEach(player => {
      optimalLineup.push({ ...player, status: 'starter' })
      const index = remaining.indexOf(player)
      if (index > -1) remaining.splice(index, 1)
    })
    
    return selected.length
  }
  
  // Fill required positions in order
  fillPositions(pos => pos === 'QB', requirements.qb, 'QB')
  fillPositions(pos => pos === 'RB', requirements.rb, 'RB')  
  fillPositions(pos => pos === 'WR', requirements.wr, 'WR')
  fillPositions(pos => pos === 'TE', requirements.te, 'TE')
  fillPositions(pos => ['K', 'PK'].includes(pos), requirements.k, 'K')
  
  // Defensive positions - handle MFL position variations
  fillPositions(pos => ['DL', 'DE', 'DT'].includes(pos), requirements.dl, 'DL')
  fillPositions(pos => pos === 'LB', requirements.lb, 'LB')
  fillPositions(pos => pos === 'CB', requirements.cb, 'CB')
  fillPositions(pos => pos === 'S', requirements.s, 'S')
  
  // Flex positions (best remaining players)
  // Offense flex (RB/WR/TE)
  fillPositions(pos => ['RB', 'WR', 'TE'].includes(pos), requirements.offenseFlex, 'O-Flex')
  
  // Defense flex (DL/LB/CB/S)
  fillPositions(pos => ['DL', 'DE', 'DT', 'LB', 'CB', 'S'].includes(pos), requirements.defenseFlex, 'D-Flex')
  
  const potentialPoints = optimalLineup.reduce((sum, player) => sum + player.score, 0)
  
  return { potentialPoints, optimalLineup }
}

/**
 * Validate that a lineup meets league requirements
 */
export function validateLineupConstraints(
  lineup: PlayerCalculationInfo[],
  requirements: LineupRequirements = MFL_LINEUP_REQUIREMENTS
): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Count positions
  const positionCounts: Record<string, number> = {}
  lineup.forEach(player => {
    const normalizedPos = normalizePosition(player.position)
    positionCounts[normalizedPos] = (positionCounts[normalizedPos] || 0) + 1
  })
  
  // Check requirements
  if ((positionCounts.QB || 0) !== requirements.qb) {
    errors.push(`QB: Expected ${requirements.qb}, got ${positionCounts.QB || 0}`)
  }
  if ((positionCounts.RB || 0) < requirements.rb) {
    errors.push(`RB: Expected at least ${requirements.rb}, got ${positionCounts.RB || 0}`)
  }
  if ((positionCounts.WR || 0) < requirements.wr) {
    errors.push(`WR: Expected at least ${requirements.wr}, got ${positionCounts.WR || 0}`)
  }
  if ((positionCounts.TE || 0) < requirements.te) {
    errors.push(`TE: Expected at least ${requirements.te}, got ${positionCounts.TE || 0}`)
  }
  if ((positionCounts.K || 0) !== requirements.k) {
    errors.push(`K: Expected ${requirements.k}, got ${positionCounts.K || 0}`)
  }
  if ((positionCounts.DL || 0) < requirements.dl) {
    errors.push(`DL: Expected at least ${requirements.dl}, got ${positionCounts.DL || 0}`)
  }
  if ((positionCounts.LB || 0) < requirements.lb) {
    errors.push(`LB: Expected at least ${requirements.lb}, got ${positionCounts.LB || 0}`)
  }
  if ((positionCounts.CB || 0) < requirements.cb) {
    errors.push(`CB: Expected at least ${requirements.cb}, got ${positionCounts.CB || 0}`)
  }
  if ((positionCounts.S || 0) < requirements.s) {
    errors.push(`S: Expected at least ${requirements.s}, got ${positionCounts.S || 0}`)
  }
  
  return { isValid: errors.length === 0, errors }
}

/**
 * Normalize MFL position names for consistent handling
 */
function normalizePosition(position: string): string {
  const positionMap: Record<string, string> = {
    'PK': 'K',
    'DE': 'DL',
    'DT': 'DL'
  }
  return positionMap[position] || position
}

/**
 * Generate comprehensive debug report for a franchise's calculations
 */
export function generateCalculationDebugReport(
  franchiseId: string,
  allPlayers: PlayerCalculationInfo[],
  starterIds: Set<string>
): CalculationDebugInfo {
  const issues: string[] = []
  
  // Categorize players
  const starters = allPlayers.filter(p => starterIds.has(p.id))
  const { benchPoints, benchPlayers } = calculateBenchPoints(allPlayers, starterIds)
  const irPlayers = allPlayers.filter(p => p.status === 'ir')
  const taxiPlayers = allPlayers.filter(p => p.status === 'taxi')
  
  // Calculate potential points
  const { potentialPoints, optimalLineup } = calculatePotentialPoints(allPlayers)
  
  // Calculate starter points
  const startersPoints = starters.reduce((sum, player) => sum + player.score, 0)
  
  // Validate calculations
  if (potentialPoints < startersPoints) {
    issues.push(`Potential points (${potentialPoints}) is less than starters points (${startersPoints})`)
  }
  
  if (starters.length === 0) {
    issues.push('No starters found - check starter identification logic')
  }
  
  if (benchPoints === 0 && benchPlayers.length > 0) {
    issues.push('Bench players found but bench points is 0 - check scoring data')
  }
  
  // Validate optimal lineup
  const lineupValidation = validateLineupConstraints(optimalLineup)
  if (!lineupValidation.isValid) {
    issues.push(`Optimal lineup constraint violations: ${lineupValidation.errors.join(', ')}`)
  }
  
  return {
    franchiseId,
    totalPlayers: allPlayers.length,
    starters,
    benchPlayers,
    irPlayers,
    taxiPlayers,
    optimalLineup,
    startersPoints,
    benchPoints,
    potentialPoints,
    issues
  }
}

/**
 * Convert MFL API player data to PlayerCalculationInfo format
 */
export function convertToCalculationFormat(
  players: any[],
  starterIds: Set<string>
): PlayerCalculationInfo[] {
  return players.map(player => ({
    id: player.id,
    name: player.name || `Player ${player.id}`,
    position: player.position || 'UNK',
    team: player.team || 'UNK',
    score: typeof player.score === 'number' ? player.score : parseFloat(player.score || '0'),
    status: determinePlayerStatus(player, starterIds),
    isEligible: player.status !== 'ir' && player.status !== 'taxi'
  }))
}

/**
 * Determine player status based on MFL data and starter identification
 */
function determinePlayerStatus(
  player: any, 
  starterIds: Set<string>
): 'starter' | 'bench' | 'ir' | 'taxi' {
  // Check MFL status flags first
  if (player.status === 'INJURED_RESERVE') return 'ir'
  if (player.status === 'TAXI_SQUAD') return 'taxi'
  
  // Check if player is in starter list
  if (starterIds.has(player.id)) return 'starter'
  
  return 'bench'
}

/**
 * Calculate position breakdown from players
 */
export function calculatePositionBreakdown(players: PlayerCalculationInfo[]): {
  qbPoints: number
  rbPoints: number
  wrPoints: number
  tePoints: number
  kPoints: number
  dlPoints: number
  lbPoints: number
  cbPoints: number
  sPoints: number
  offensePoints: number
  defensePoints: number
} {
  const breakdown = {
    qbPoints: 0,
    rbPoints: 0,
    wrPoints: 0,
    tePoints: 0,
    kPoints: 0,
    dlPoints: 0,
    lbPoints: 0,
    cbPoints: 0,
    sPoints: 0,
    offensePoints: 0,
    defensePoints: 0
  }
  
  players.forEach(player => {
    const points = player.score
    const position = normalizePosition(player.position)
    
    switch (position) {
      case 'QB':
        breakdown.qbPoints += points
        breakdown.offensePoints += points
        break
      case 'RB':
        breakdown.rbPoints += points
        breakdown.offensePoints += points
        break
      case 'WR':
        breakdown.wrPoints += points
        breakdown.offensePoints += points
        break
      case 'TE':
        breakdown.tePoints += points
        breakdown.offensePoints += points
        break
      case 'K':
        breakdown.kPoints += points
        breakdown.offensePoints += points
        break
      case 'DL':
        breakdown.dlPoints += points
        breakdown.defensePoints += points
        break
      case 'LB':
        breakdown.lbPoints += points
        breakdown.defensePoints += points
        break
      case 'CB':
        breakdown.cbPoints += points
        breakdown.defensePoints += points
        break
      case 'S':
        breakdown.sPoints += points
        breakdown.defensePoints += points
        break
    }
  })
  
  return breakdown
}