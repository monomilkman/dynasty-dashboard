/**
 * Trade Depth Calculator
 * Analyzes roster depth across all teams to identify trade opportunities
 * based on startable players beyond roster requirements
 */

import { LINEUP_REQUIREMENTS } from './mfl-api-endpoints'

export type Position = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DL' | 'LB' | 'CB' | 'S'
export type FlexPosition = 'O-Flex' | 'D-Flex'
export type DepthStatus = 'surplus' | 'adequate' | 'need'
export type QualityRating = 'high' | 'medium' | 'low' | null
export type PlayerQualityTier = 'elite' | 'startable' | 'backup' | 'filler'

export interface RosterPlayer {
  id: string
  name: string
  position: Position
  seasonPPG: number           // Season-to-date points per game
  totalPoints: number
  gamesPlayed: number
  positionRank: number        // League-wide rank at position
  isStartable: boolean        // Would start on average team
  starterOnTeamCount: number  // Would start on X teams in league
}

export interface PositionDepth {
  position: Position
  required: number
  starters: RosterPlayer[]
  backups: RosterPlayer[]
  tradeableBackups: RosterPlayer[]  // Quality backups worth trading
  nonTradeableBackups: RosterPlayer[]  // Backups that aren't tradeable
  totalRostered: number
  depthScore: number                // Positive = surplus, negative = need
  status: DepthStatus
  quality: QualityRating
  teamPositionRank: number  // Team's rank at this position (1-12)
}

export interface TeamDepthAnalysis {
  franchiseId: string
  teamName: string
  manager: string
  year: number
  roster: RosterPlayer[]
  positionDepth: Record<Position, PositionDepth>
  overallDepthRating: number  // 0-100 score
  flexDepth: {
    offense: number  // Extra RB/WR/TE beyond requirements
    defense: number  // Extra DL/LB/CB/S beyond requirements
  }
}

export interface LeagueContext {
  year: number
  totalTeams: number
  positionAverages: Record<Position, number>     // Average PPG for starters
  positionMedians: Record<Position, number>      // Median PPG for starters
  totalStartablePlayers: Record<Position, number> // Total starting spots league-wide
  positionRankings: Record<Position, RosterPlayer[]> // All rostered players by position
}

export interface TradeMatch {
  targetTeam: TeamDepthAnalysis
  theyHaveSurplus: Position[]
  yourNeeds: Position[]
  yourAssets: Position[]
  theirNeeds: Position[]
  matchScore: number  // 0-100 compatibility score
  suggestedTrades: Array<{
    yourPlayer: RosterPlayer
    theirPlayer: RosterPlayer
    upgradeValue: number  // PPG difference
  }>
}

export interface UpgradeSuggestion {
  targetTeam: TeamDepthAnalysis
  targetPlayer: RosterPlayer
  upgradeValue: number
  yourTradeAssets: string[]
}

export interface DepthAnalysisResult {
  leagueContext: LeagueContext
  allTeams: TeamDepthAnalysis[]
  yourTeamAnalysis?: TeamDepthAnalysis
  tradeMatches?: TradeMatch[]
}

/**
 * Calculate league-wide context for depth analysis
 */
export function calculateLeagueContext(
  allRosters: Array<{ franchiseId: string; roster: RosterPlayer[] }>,
  year: number
): LeagueContext {
  const totalTeams = allRosters.length
  const positionAverages: Partial<Record<Position, number>> = {}
  const positionMedians: Partial<Record<Position, number>> = {}
  const totalStartablePlayers: Partial<Record<Position, number>> = {}
  const positionRankings: Partial<Record<Position, RosterPlayer[]>> = {}

  const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S']

  positions.forEach((position) => {
    // Gather all players at this position across all teams
    const allPlayersAtPosition: RosterPlayer[] = []
    allRosters.forEach((team) => {
      const playersAtPosition = team.roster.filter((p) => p.position === position)
      allPlayersAtPosition.push(...playersAtPosition)
    })

    // Sort by PPG descending
    allPlayersAtPosition.sort((a, b) => b.seasonPPG - a.seasonPPG)
    positionRankings[position] = allPlayersAtPosition

    // Calculate total starting spots for this position
    const positionKey = position.toLowerCase() as keyof typeof LINEUP_REQUIREMENTS
    const spotsPerTeam = LINEUP_REQUIREMENTS[positionKey] || 0
    totalStartablePlayers[position] = spotsPerTeam * totalTeams

    // Get starters (top X players where X = total starting spots)
    const starters = allPlayersAtPosition.slice(0, totalStartablePlayers[position])

    // Calculate average and median for starters
    if (starters.length > 0) {
      const sum = starters.reduce((acc, p) => acc + p.seasonPPG, 0)
      positionAverages[position] = sum / starters.length

      const midpoint = Math.floor(starters.length / 2)
      positionMedians[position] =
        starters.length % 2 === 0
          ? (starters[midpoint - 1].seasonPPG + starters[midpoint].seasonPPG) / 2
          : starters[midpoint].seasonPPG
    } else {
      positionAverages[position] = 0
      positionMedians[position] = 0
    }
  })

  return {
    year,
    totalTeams,
    positionAverages: positionAverages as Record<Position, number>,
    positionMedians: positionMedians as Record<Position, number>,
    totalStartablePlayers: totalStartablePlayers as Record<Position, number>,
    positionRankings: positionRankings as Record<Position, RosterPlayer[]>,
  }
}

/**
 * Determine if a player is "startable" based on multiple criteria
 */
export function isPlayerStartable(
  player: RosterPlayer,
  leagueContext: LeagueContext
): boolean {
  const position = player.position
  const avgStarterPPG = leagueContext.positionAverages[position] || 0
  const totalStartingSpots = leagueContext.totalStartablePlayers[position] || 0

  // Criteria 1: Positional rank within total starting spots
  const meetsRankCriteria = player.positionRank <= totalStartingSpots

  // Criteria 2: Score >= 80% of league average for starters
  const meetsScoreCriteria = player.seasonPPG >= avgStarterPPG * 0.8

  // Criteria 3: Would start on >= 50% of teams (already calculated)
  const meetsTeamCriteria = player.starterOnTeamCount >= leagueContext.totalTeams * 0.5

  // Player is startable if they meet at least 2 of 3 criteria
  const criteriasMet = [meetsRankCriteria, meetsScoreCriteria, meetsTeamCriteria].filter(
    Boolean
  ).length

  return criteriasMet >= 2
}

/**
 * Calculate how many teams a player would start on
 */
export function calculateStarterOnTeamCount(
  player: RosterPlayer,
  allTeams: Array<{ franchiseId: string; roster: RosterPlayer[] }>
): number {
  let wouldStartCount = 0

  allTeams.forEach((team) => {
    const playersAtPosition = team.roster
      .filter((p) => p.position === player.position)
      .sort((a, b) => b.seasonPPG - a.seasonPPG)

    const positionKey = player.position.toLowerCase() as keyof typeof LINEUP_REQUIREMENTS
    const requiredStarters = LINEUP_REQUIREMENTS[positionKey] || 0

    // Check if player would be in top X at position for this team
    const topPlayers = playersAtPosition.slice(0, requiredStarters)
    const wouldStart =
      topPlayers.length < requiredStarters ||
      player.seasonPPG > topPlayers[topPlayers.length - 1].seasonPPG

    if (wouldStart) {
      wouldStartCount++
    }
  })

  return wouldStartCount
}

/**
 * Assess the quality of a backup player
 */
export function assessBackupQuality(
  player: RosterPlayer,
  leagueContext: LeagueContext
): QualityRating {
  const position = player.position
  const allPlayersAtPosition = leagueContext.positionRankings[position] || []

  if (allPlayersAtPosition.length === 0) return null

  const playerPercentile = player.positionRank / allPlayersAtPosition.length

  // High quality: Top 25% of position
  if (playerPercentile <= 0.25) return 'high'

  // Medium quality: Top 50% of position
  if (playerPercentile <= 0.5) return 'medium'

  // Low quality: Top 75% of position
  if (playerPercentile <= 0.75) return 'low'

  return null // Below 75th percentile - not tradeable
}

/**
 * Get player quality tier classification
 */
export function getPlayerQualityTier(
  player: RosterPlayer,
  leagueContext: LeagueContext
): PlayerQualityTier {
  const position = player.position
  const allPlayersAtPosition = leagueContext.positionRankings[position] || []

  if (allPlayersAtPosition.length === 0) return 'filler'

  const playerPercentile = player.positionRank / allPlayersAtPosition.length

  // Elite: Top 25% of position
  if (playerPercentile <= 0.25) return 'elite'

  // Startable: Top 50% of position
  if (playerPercentile <= 0.5) return 'startable'

  // Backup: Top 75% of position
  if (playerPercentile <= 0.75) return 'backup'

  // Filler: Bottom 25%
  return 'filler'
}

/**
 * Get explanation for why a player isn't tradeable
 */
export function getNonTradeableReason(
  player: RosterPlayer,
  leagueContext: LeagueContext
): string {
  const tier = getPlayerQualityTier(player, leagueContext)

  if (!player.isStartable) {
    return `Not startable quality (Rank #${player.positionRank}, ${player.seasonPPG.toFixed(1)} ppg)`
  }

  if (tier === 'backup') {
    return `Marginal starter - only top 50% backups are tradeable (Rank #${player.positionRank})`
  }

  if (tier === 'filler') {
    return `Below replacement level (Rank #${player.positionRank})`
  }

  return 'Unknown'
}

/**
 * Calculate depth for a single position on a team
 */
export function calculatePositionDepth(
  position: Position,
  teamRoster: RosterPlayer[],
  leagueContext: LeagueContext
): PositionDepth {
  const playersAtPosition = teamRoster
    .filter((p) => p.position === position)
    .sort((a, b) => b.seasonPPG - a.seasonPPG)

  const positionKey = position.toLowerCase() as keyof typeof LINEUP_REQUIREMENTS
  const required = LINEUP_REQUIREMENTS[positionKey] || 0

  const starters = playersAtPosition.slice(0, required)
  const backups = playersAtPosition.slice(required)

  // Filter for startable backups
  const startableBackups = backups.filter((p) => p.isStartable)

  // Filter for tradeable backups (startable + good quality)
  const tradeableBackups = startableBackups.filter((p) => {
    const quality = assessBackupQuality(p, leagueContext)
    return quality === 'high' || quality === 'medium'
  })

  // Calculate depth score: startable players - required starters
  const startablePlayers = playersAtPosition.filter((p) => p.isStartable)
  const depthScore = startablePlayers.length - required

  // Determine status
  let status: DepthStatus
  if (depthScore >= 2) status = 'surplus'
  else if (depthScore >= 0) status = 'adequate'
  else status = 'need'

  // Determine overall quality of tradeable depth
  let quality: QualityRating = null
  if (tradeableBackups.length > 0) {
    const qualities = tradeableBackups.map((p) => assessBackupQuality(p, leagueContext))
    if (qualities.some((q) => q === 'high')) quality = 'high'
    else if (qualities.some((q) => q === 'medium')) quality = 'medium'
    else quality = 'low'
  }

  // Calculate non-tradeable backups
  const nonTradeableBackups = backups.filter((p) => !tradeableBackups.includes(p))

  return {
    position,
    required,
    starters,
    backups,
    tradeableBackups,
    nonTradeableBackups,
    totalRostered: playersAtPosition.length,
    depthScore,
    status,
    quality,
    teamPositionRank: 0, // Will be calculated in analyzeTeamDepth
  }
}

/**
 * Calculate flex depth (players eligible for flex beyond base requirements)
 */
export function calculateFlexDepth(
  teamRoster: RosterPlayer[],
  positionDepths: Record<Position, PositionDepth>
): { offense: number; defense: number } {
  // Offensive flex: RB/WR/TE players beyond base requirements
  const offensiveFlexEligible: Position[] = ['RB', 'WR', 'TE']
  let offensiveFlexDepth = 0

  offensiveFlexEligible.forEach((pos) => {
    const depth = positionDepths[pos]
    if (depth.depthScore > 0) {
      offensiveFlexDepth += depth.depthScore
    }
  })

  // Account for the 1 O-Flex spot
  offensiveFlexDepth = Math.max(0, offensiveFlexDepth - LINEUP_REQUIREMENTS.offenseFlex)

  // Defensive flex: DL/LB/CB/S players beyond base requirements
  const defensiveFlexEligible: Position[] = ['DL', 'LB', 'CB', 'S']
  let defensiveFlexDepth = 0

  defensiveFlexEligible.forEach((pos) => {
    const depth = positionDepths[pos]
    if (depth.depthScore > 0) {
      defensiveFlexDepth += depth.depthScore
    }
  })

  // Account for the 1 D-Flex spot
  defensiveFlexDepth = Math.max(0, defensiveFlexDepth - LINEUP_REQUIREMENTS.defenseFlex)

  return {
    offense: offensiveFlexDepth,
    defense: defensiveFlexDepth,
  }
}

/**
 * Calculate team's rank at each position across the league
 * Lower rank = better (1 = best in league)
 */
export function calculateTeamPositionRanks(
  allTeams: Array<{ roster: RosterPlayer[]; positionDepth: Record<Position, PositionDepth> }>
): Map<string, Record<Position, number>> {
  const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S']
  const teamRanks = new Map<string, Record<Position, number>>()

  positions.forEach((position) => {
    // Score each team at this position (average PPG of starters)
    const teamScores = allTeams.map((team) => {
      const depth = team.positionDepth[position]
      const startersPPG = depth.starters.reduce((sum, p) => sum + p.seasonPPG, 0) / Math.max(1, depth.starters.length)
      return {
        teamId: team.roster[0]?.id || '', // Use first player's ID as team identifier
        score: startersPPG,
      }
    })

    // Sort by score descending (highest score = rank 1)
    teamScores.sort((a, b) => b.score - a.score)

    // Assign ranks
    teamScores.forEach((teamScore, index) => {
      const teamId = teamScore.teamId
      if (!teamRanks.has(teamId)) {
        teamRanks.set(teamId, {} as Record<Position, number>)
      }
      const ranks = teamRanks.get(teamId)!
      ranks[position] = index + 1
    })
  })

  return teamRanks
}

/**
 * Get upgrade suggestions for a position
 */
export function getUpgradeSuggestions(
  position: Position,
  yourDepth: PositionDepth,
  allTeams: TeamDepthAnalysis[],
  yourAssets: Position[]
): UpgradeSuggestion[] {
  const suggestions: UpgradeSuggestion[] = []

  // Find teams with tradeable players at this position
  allTeams.forEach((team) => {
    const theirDepth = team.positionDepth[position]

    // Check their tradeable backups
    theirDepth.tradeableBackups.forEach((player) => {
      // Calculate if this would be an upgrade (higher PPG than your worst starter)
      const yourWorstStarter = yourDepth.starters[yourDepth.starters.length - 1]
      const upgradeValue = yourWorstStarter ? player.seasonPPG - yourWorstStarter.seasonPPG : player.seasonPPG

      if (upgradeValue > 0) {
        // Find what you could offer from your assets
        const tradeAssets = yourAssets
          .map((assetPos) => {
            const assetDepth = team.positionDepth[assetPos]
            return assetDepth?.tradeableBackups[0]?.name || null
          })
          .filter((name): name is string => name !== null)

        if (tradeAssets.length > 0) {
          suggestions.push({
            targetTeam: team,
            targetPlayer: player,
            upgradeValue,
            yourTradeAssets: tradeAssets,
          })
        }
      }
    })
  })

  // Sort by upgrade value descending
  suggestions.sort((a, b) => b.upgradeValue - a.upgradeValue)

  return suggestions.slice(0, 3) // Top 3 suggestions
}

/**
 * Analyze depth for a single team
 */
export function analyzeTeamDepth(
  franchiseId: string,
  teamName: string,
  manager: string,
  roster: RosterPlayer[],
  leagueContext: LeagueContext
): TeamDepthAnalysis {
  const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S']
  const positionDepth: Partial<Record<Position, PositionDepth>> = {}

  positions.forEach((position) => {
    positionDepth[position] = calculatePositionDepth(position, roster, leagueContext)
  })

  const positionDepthRecord = positionDepth as Record<Position, PositionDepth>

  const flexDepth = calculateFlexDepth(roster, positionDepthRecord)

  // Calculate overall depth rating (0-100)
  let totalDepthScore = 0
  let maxPossibleScore = 0
  positions.forEach((pos) => {
    const depth = positionDepthRecord[pos]
    totalDepthScore += Math.max(0, depth.depthScore) // Only count positive depth
    maxPossibleScore += 3 // Assume max depth of 3 per position
  })
  const overallDepthRating = Math.min(100, (totalDepthScore / maxPossibleScore) * 100)

  return {
    franchiseId,
    teamName,
    manager,
    year: leagueContext.year,
    roster,
    positionDepth: positionDepthRecord,
    overallDepthRating: Math.round(overallDepthRating),
    flexDepth,
  }
}

/**
 * Identify trade matches for your team
 */
export function identifyTradeMatches(
  yourTeam: TeamDepthAnalysis,
  allTeams: TeamDepthAnalysis[]
): TradeMatch[] {
  const matches: TradeMatch[] = []

  // Identify your needs and assets
  const yourNeeds: Position[] = []
  const yourAssets: Position[] = []

  Object.entries(yourTeam.positionDepth).forEach(([pos, depth]) => {
    if (depth.status === 'need') {
      yourNeeds.push(pos as Position)
    } else if (depth.status === 'surplus' && depth.tradeableBackups.length > 0) {
      yourAssets.push(pos as Position)
    }
  })

  // Find teams with complementary needs/assets
  allTeams.forEach((team) => {
    if (team.franchiseId === yourTeam.franchiseId) return // Skip your own team

    const theyHaveSurplus: Position[] = []
    const theirNeeds: Position[] = []

    Object.entries(team.positionDepth).forEach(([pos, depth]) => {
      if (depth.status === 'need') {
        theirNeeds.push(pos as Position)
      } else if (depth.status === 'surplus' && depth.tradeableBackups.length > 0) {
        theyHaveSurplus.push(pos as Position)
      }
    })

    // Calculate match score based on overlap
    const yourNeedsTheyHave = yourNeeds.filter((pos) => theyHaveSurplus.includes(pos))
    const yourAssetsTheyNeed = yourAssets.filter((pos) => theirNeeds.includes(pos))

    const matchScore =
      (yourNeedsTheyHave.length * 50 + yourAssetsTheyNeed.length * 50) /
      Math.max(yourNeeds.length + yourAssets.length, 1)

    // Only include matches with meaningful overlap
    if (yourNeedsTheyHave.length > 0 || yourAssetsTheyNeed.length > 0) {
      // Generate suggested trades
      const suggestedTrades: TradeMatch['suggestedTrades'] = []

      yourNeedsTheyHave.forEach((pos) => {
        const theirTradeableBackups = team.positionDepth[pos].tradeableBackups
        const yourCurrentStarters = yourTeam.positionDepth[pos].starters

        if (theirTradeableBackups.length > 0 && yourCurrentStarters.length > 0) {
          const bestBackup = theirTradeableBackups[0]
          const yourStarter = yourCurrentStarters[0]

          yourAssetsTheyNeed.forEach((assetPos) => {
            const yourTradeableBackups = yourTeam.positionDepth[assetPos].tradeableBackups
            if (yourTradeableBackups.length > 0) {
              suggestedTrades.push({
                yourPlayer: yourTradeableBackups[0],
                theirPlayer: bestBackup,
                upgradeValue: bestBackup.seasonPPG - yourStarter.seasonPPG,
              })
            }
          })
        }
      })

      matches.push({
        targetTeam: team,
        theyHaveSurplus,
        yourNeeds: yourNeedsTheyHave,
        yourAssets: yourAssetsTheyNeed,
        theirNeeds,
        matchScore: Math.round(matchScore),
        suggestedTrades,
      })
    }
  })

  // Sort by match score descending
  matches.sort((a, b) => b.matchScore - a.matchScore)

  return matches
}

/**
 * Main function to analyze trade depth across the league
 */
export function analyzeLeagueTradeDepth(
  allRosters: Array<{
    franchiseId: string
    teamName: string
    manager: string
    roster: RosterPlayer[]
  }>,
  year: number,
  yourFranchiseId?: string
): DepthAnalysisResult {
  // Step 1: Calculate league context
  const leagueContext = calculateLeagueContext(allRosters, year)

  // Step 2: Enrich roster players with league context data
  const enrichedRosters = allRosters.map((team) => {
    const enrichedRoster = team.roster.map((player) => {
      const positionRankings = leagueContext.positionRankings[player.position] || []
      const positionRank = positionRankings.findIndex((p) => p.id === player.id) + 1

      const starterOnTeamCount = calculateStarterOnTeamCount(player, allRosters)

      const enrichedPlayer: RosterPlayer = {
        ...player,
        positionRank,
        starterOnTeamCount,
        isStartable: false, // Will be set next
      }

      // Determine if player is startable
      enrichedPlayer.isStartable = isPlayerStartable(enrichedPlayer, leagueContext)

      return enrichedPlayer
    })

    return {
      ...team,
      roster: enrichedRoster,
    }
  })

  // Step 3: Analyze depth for each team
  const allTeams = enrichedRosters.map((team) =>
    analyzeTeamDepth(
      team.franchiseId,
      team.teamName,
      team.manager,
      team.roster,
      leagueContext
    )
  )

  // Step 3.5: Calculate team position ranks and update each team's depth analysis
  const teamRanks = calculateTeamPositionRanks(allTeams)

  allTeams.forEach((team) => {
    const teamId = team.roster[0]?.id || ''
    const ranks = teamRanks.get(teamId)

    if (ranks) {
      const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S']
      positions.forEach((position) => {
        if (team.positionDepth[position]) {
          team.positionDepth[position].teamPositionRank = ranks[position] || 0
        }
      })
    }
  })

  // Step 4: If franchise ID provided, identify trade matches
  let yourTeamAnalysis: TeamDepthAnalysis | undefined
  let tradeMatches: TradeMatch[] | undefined

  if (yourFranchiseId) {
    yourTeamAnalysis = allTeams.find((t) => t.franchiseId === yourFranchiseId)
    if (yourTeamAnalysis) {
      tradeMatches = identifyTradeMatches(yourTeamAnalysis, allTeams)
    }
  }

  return {
    leagueContext,
    allTeams,
    yourTeamAnalysis,
    tradeMatches,
  }
}
