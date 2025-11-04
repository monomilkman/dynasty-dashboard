// Position Analysis Utilities for Gap Analysis, Percentiles, and Team Weakness Detection
import { PositionTotals, LeaguePositionalData, TeamPositionalData } from './mfl-position-scraper'
import { PositionKey } from './position-utils'

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface PositionGapData {
  franchiseId: string
  position: PositionKey
  points: number
  rank: number
  gapFromFirst: number
  gapFromAvg: number
  gapFromMedian: number
  gapFromLast: number
  percentile: number
  firstPlaceTeam: string
  firstPlacePoints: number
  lastPlaceTeam: string
  lastPlacePoints: number
  topThreeTeams: Array<{ teamName: string; points: number }>
}

export interface AllPositionGaps {
  [franchiseId: string]: {
    [position: string]: PositionGapData
  }
}

export interface PercentileData {
  franchiseId: string
  position: PositionKey
  points: number
  percentile: number
  rank: number
}

export interface TeamAnalysis {
  franchiseId: string
  teamName: string
  manager: string
  weakestPositions: PositionStrengthAnalysis[]
  strongestPositions: PositionStrengthAnalysis[]
  averageRank: number
  averagePercentile: number
  totalGapFromLeaders: number
  biggestGap: {
    position: PositionKey
    gap: number
    percentOfLeader: number
  }
  tradeRecommendations: TradeRecommendation[]
}

export interface PositionStrengthAnalysis {
  position: PositionKey
  rank: number
  points: number
  gapFromFirst: number
  gapFromAvg: number
  percentile: number
  impactScore: number
  analysis: string
}

export interface TradeRecommendation {
  priority: 1 | 2 | 3
  action: 'upgrade' | 'maintain' | 'trade-from'
  position: PositionKey
  gap: number
  percentGap: number
  targetTeam?: string
  targetPoints?: number
  reasoning: string
}

// ============================================================================
// Gap Calculation Functions
// ============================================================================

/**
 * Calculate comprehensive gap data for a specific team's position
 */
export function calculatePositionGap(
  franchiseId: string,
  position: PositionKey,
  leagueData: LeaguePositionalData
): PositionGapData | null {
  const positionRankings = leagueData.positionRankings[position]
  if (!positionRankings || positionRankings.length === 0) {
    return null
  }

  // Find this team's data
  const teamRanking = positionRankings.find(r => r.franchiseId === franchiseId)
  if (!teamRanking) {
    return null
  }

  // Get first place (rank 1)
  const firstPlace = positionRankings[0]

  // Get last place
  const lastPlace = positionRankings[positionRankings.length - 1]

  // Calculate average
  const allPoints = positionRankings.map(r => r.points)
  const avgPoints = allPoints.reduce((sum, pts) => sum + pts, 0) / allPoints.length

  // Calculate median
  const sortedPoints = [...allPoints].sort((a, b) => b - a)
  const medianPoints = sortedPoints.length % 2 === 0
    ? (sortedPoints[sortedPoints.length / 2 - 1] + sortedPoints[sortedPoints.length / 2]) / 2
    : sortedPoints[Math.floor(sortedPoints.length / 2)]

  // Calculate percentile (higher percentile = better rank)
  const percentile = ((positionRankings.length - teamRanking.rank + 1) / positionRankings.length) * 100

  // Get top 3 teams for context
  const topThreeTeams = positionRankings.slice(0, 3).map(r => ({
    teamName: r.teamName,
    points: r.points
  }))

  return {
    franchiseId,
    position,
    points: teamRanking.points,
    rank: teamRanking.rank,
    gapFromFirst: teamRanking.points - firstPlace.points,
    gapFromAvg: teamRanking.points - avgPoints,
    gapFromMedian: teamRanking.points - medianPoints,
    gapFromLast: teamRanking.points - lastPlace.points,
    percentile,
    firstPlaceTeam: firstPlace.teamName,
    firstPlacePoints: firstPlace.points,
    lastPlaceTeam: lastPlace.teamName,
    lastPlacePoints: lastPlace.points,
    topThreeTeams
  }
}

/**
 * Calculate gaps for all positions for all teams
 */
export function calculateAllPositionGaps(
  leagueData: LeaguePositionalData
): AllPositionGaps {
  const allGaps: AllPositionGaps = {}

  const positions: PositionKey[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S', 'O-Flex', 'D-Flex']

  leagueData.teams.forEach(team => {
    allGaps[team.franchiseId] = {}

    positions.forEach(position => {
      const gapData = calculatePositionGap(team.franchiseId, position, leagueData)
      if (gapData) {
        allGaps[team.franchiseId][position] = gapData
      }
    })
  })

  return allGaps
}

// ============================================================================
// Percentile Calculation Functions
// ============================================================================

/**
 * Calculate percentile for a team's position
 */
export function calculatePercentile(
  rank: number,
  totalTeams: number
): number {
  // Percentile: higher rank = lower percentile
  // Rank 1 of 12 = 100th percentile (top 0%)
  // Rank 12 of 12 = 8th percentile (bottom 92%)
  return ((totalTeams - rank + 1) / totalTeams) * 100
}

/**
 * Calculate percentiles for all positions for a team
 */
export function calculateTeamPercentiles(
  franchiseId: string,
  leagueData: LeaguePositionalData
): { [position: string]: PercentileData } {
  const percentiles: { [position: string]: PercentileData } = {}
  const positions: PositionKey[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S', 'O-Flex', 'D-Flex']

  positions.forEach(position => {
    const positionRankings = leagueData.positionRankings[position]
    if (!positionRankings) return

    const teamRanking = positionRankings.find(r => r.franchiseId === franchiseId)
    if (!teamRanking) return

    const percentile = calculatePercentile(teamRanking.rank, positionRankings.length)

    percentiles[position] = {
      franchiseId,
      position,
      points: teamRanking.points,
      percentile,
      rank: teamRanking.rank
    }
  })

  return percentiles
}

// ============================================================================
// Color Coding Utilities
// ============================================================================

/**
 * Get color class for gap from first place
 */
export function getGapColorClass(gap: number): string {
  // Gap is always <= 0 (unless tied for first)
  if (gap >= 0) {
    return 'bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100 font-bold' // Leader
  }
  if (gap > -20) {
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' // Minimal gap
  }
  if (gap > -50) {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100' // Moderate gap
  }
  if (gap > -100) {
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100' // Significant gap
  }
  return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100' // Critical gap
}

/**
 * Get color class for percentile ranking
 */
export function getPercentileColorClass(percentile: number): string {
  if (percentile >= 90) {
    return 'bg-green-700 text-white dark:bg-green-600' // Elite (top 10%)
  }
  if (percentile >= 75) {
    return 'bg-green-500 text-white dark:bg-green-500' // Great (top 25%)
  }
  if (percentile >= 50) {
    return 'bg-green-200 text-green-900 dark:bg-green-800 dark:text-green-100' // Above average
  }
  if (percentile >= 25) {
    return 'bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100' // Below average
  }
  if (percentile >= 10) {
    return 'bg-orange-200 text-orange-900 dark:bg-orange-800 dark:text-orange-100' // Poor
  }
  return 'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100' // Bottom tier
}

/**
 * Get description for gap severity
 */
export function getGapDescription(gap: number): string {
  if (gap >= 0) return 'League Leader'
  if (gap > -20) return 'Highly Competitive'
  if (gap > -50) return 'Moderate Gap'
  if (gap > -100) return 'Significant Weakness'
  return 'Critical Weakness'
}

/**
 * Get description for percentile performance
 */
export function getPercentileDescription(percentile: number): string {
  if (percentile >= 90) return 'Elite (Top 10%)'
  if (percentile >= 75) return 'Great (Top 25%)'
  if (percentile >= 50) return 'Above Average'
  if (percentile >= 25) return 'Below Average'
  if (percentile >= 10) return 'Poor (Bottom 25%)'
  return 'Bottom Tier (Bottom 10%)'
}

// ============================================================================
// Team Analysis Functions
// ============================================================================

/**
 * Analyze a team's positional strengths and weaknesses
 */
export function analyzeTeamPositions(
  franchiseId: string,
  leagueData: LeaguePositionalData
): TeamAnalysis | null {
  const team = leagueData.teams.find(t => t.franchiseId === franchiseId)
  if (!team) return null

  const positions: PositionKey[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S', 'O-Flex', 'D-Flex']
  const positionAnalyses: PositionStrengthAnalysis[] = []

  let totalRank = 0
  let totalPercentile = 0
  let totalGapFromLeaders = 0
  let positionCount = 0
  let biggestGap = { position: 'QB' as PositionKey, gap: 0, percentOfLeader: 0 }

  positions.forEach(position => {
    const gapData = calculatePositionGap(franchiseId, position, leagueData)
    if (!gapData) return

    totalRank += gapData.rank
    totalPercentile += gapData.percentile
    totalGapFromLeaders += Math.abs(gapData.gapFromFirst)
    positionCount++

    // Track biggest gap
    if (Math.abs(gapData.gapFromFirst) > Math.abs(biggestGap.gap)) {
      biggestGap = {
        position,
        gap: gapData.gapFromFirst,
        percentOfLeader: gapData.firstPlacePoints > 0
          ? (Math.abs(gapData.gapFromFirst) / gapData.firstPlacePoints) * 100
          : 0
      }
    }

    // Calculate impact score (equal weighting for all positions)
    // Impact = how far from average as a percentage
    const impactScore = gapData.gapFromAvg

    // Generate analysis text
    const analysis = generatePositionAnalysis(gapData)

    positionAnalyses.push({
      position,
      rank: gapData.rank,
      points: gapData.points,
      gapFromFirst: gapData.gapFromFirst,
      gapFromAvg: gapData.gapFromAvg,
      percentile: gapData.percentile,
      impactScore,
      analysis
    })
  })

  // Sort by impact score (most negative = weakest, most positive = strongest)
  positionAnalyses.sort((a, b) => a.impactScore - b.impactScore)

  // Get weakest (bottom 3) and strongest (top 3)
  const weakestPositions = positionAnalyses.slice(0, 3)
  const strongestPositions = positionAnalyses.slice(-3).reverse()

  // Generate trade recommendations
  const tradeRecommendations = generateTradeRecommendations(
    weakestPositions,
    strongestPositions,
    leagueData
  )

  return {
    franchiseId,
    teamName: team.teamName,
    manager: team.manager,
    weakestPositions,
    strongestPositions,
    averageRank: positionCount > 0 ? totalRank / positionCount : 0,
    averagePercentile: positionCount > 0 ? totalPercentile / positionCount : 0,
    totalGapFromLeaders,
    biggestGap,
    tradeRecommendations
  }
}

/**
 * Generate human-readable analysis for a position
 */
function generatePositionAnalysis(gapData: PositionGapData): string {
  if (gapData.rank === 1) {
    return `League leader at ${gapData.position} with ${gapData.points.toFixed(1)} points.`
  }

  const gapPercent = (Math.abs(gapData.gapFromFirst) / gapData.firstPlacePoints) * 100

  if (gapData.percentile >= 75) {
    return `Strong position. Only ${Math.abs(gapData.gapFromFirst).toFixed(1)} points (${gapPercent.toFixed(1)}%) behind ${gapData.firstPlaceTeam}.`
  }

  if (gapData.percentile >= 50) {
    return `Above average. ${Math.abs(gapData.gapFromFirst).toFixed(1)} points behind leader.`
  }

  if (gapData.percentile >= 25) {
    return `Below average. ${Math.abs(gapData.gapFromFirst).toFixed(1)} points (${gapPercent.toFixed(1)}%) behind ${gapData.firstPlaceTeam}.`
  }

  return `Major weakness. ${Math.abs(gapData.gapFromFirst).toFixed(1)} points (${gapPercent.toFixed(1)}%) behind leader. Priority upgrade needed.`
}

/**
 * Generate trade recommendations based on strengths and weaknesses
 */
function generateTradeRecommendations(
  weakestPositions: PositionStrengthAnalysis[],
  strongestPositions: PositionStrengthAnalysis[],
  leagueData: LeaguePositionalData
): TradeRecommendation[] {
  const recommendations: TradeRecommendation[] = []

  // Priority 1: Address biggest weakness
  if (weakestPositions.length > 0) {
    const weakest = weakestPositions[0]
    const gapPercent = (Math.abs(weakest.gapFromFirst) / (weakest.points + Math.abs(weakest.gapFromFirst))) * 100

    // Find the leader at this position
    const positionRankings = leagueData.positionRankings[weakest.position]
    const leader = positionRankings?.[0]

    recommendations.push({
      priority: 1,
      action: 'upgrade',
      position: weakest.position,
      gap: weakest.gapFromFirst,
      percentGap: gapPercent,
      targetTeam: leader?.teamName,
      targetPoints: leader?.points,
      reasoning: `${weakest.position} is your weakest position (${weakest.percentile.toFixed(0)}th percentile). You're ${Math.abs(weakest.gapFromFirst).toFixed(1)} points behind the leader${leader ? ` (${leader.teamName})` : ''}. This represents a ${gapPercent.toFixed(1)}% gap that significantly impacts your competitiveness.`
    })
  }

  // Priority 2: Leverage strongest position for trades
  if (strongestPositions.length > 0 && weakestPositions.length > 0) {
    const strongest = strongestPositions[0]
    const weakest = weakestPositions[0]

    recommendations.push({
      priority: 2,
      action: 'trade-from',
      position: strongest.position,
      gap: strongest.gapFromFirst,
      percentGap: 0,
      reasoning: `You're elite at ${strongest.position} (${strongest.percentile.toFixed(0)}th percentile). Consider trading depth or starter at ${strongest.position} to upgrade your ${weakest.position} position. A strategic trade could close the ${Math.abs(weakest.gapFromFirst).toFixed(1)} point gap at ${weakest.position} while maintaining strength at ${strongest.position}.`
    })
  }

  // Priority 3: Address secondary weakness
  if (weakestPositions.length > 1) {
    const secondWeakest = weakestPositions[1]
    const gapPercent = (Math.abs(secondWeakest.gapFromFirst) / (secondWeakest.points + Math.abs(secondWeakest.gapFromFirst))) * 100

    recommendations.push({
      priority: 3,
      action: 'upgrade',
      position: secondWeakest.position,
      gap: secondWeakest.gapFromFirst,
      percentGap: gapPercent,
      reasoning: `${secondWeakest.position} is also underperforming (${secondWeakest.percentile.toFixed(0)}th percentile, ${Math.abs(secondWeakest.gapFromFirst).toFixed(1)} points behind). After addressing ${weakestPositions[0].position}, consider improving here for sustained competitiveness.`
    })
  }

  return recommendations
}

// ============================================================================
// Export/Display Utilities
// ============================================================================

/**
 * Format gap for display (with + for positive, - for negative)
 */
export function formatGap(gap: number): string {
  if (gap >= 0) {
    return gap === 0 ? '0.0' : `+${gap.toFixed(1)}`
  }
  return gap.toFixed(1)
}

/**
 * Format percentile for display
 */
export function formatPercentile(percentile: number): string {
  return `${Math.round(percentile)}%`
}
