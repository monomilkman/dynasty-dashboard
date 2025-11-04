import { PositionTotals, LeaguePositionalData, TeamPositionalData } from './mfl-position-scraper'

export type PositionKey = keyof PositionTotals

/**
 * Calculate position rankings with color coding information
 */
export interface PositionRankingResult {
  rank: number
  points: number
  colorClass: string
  isTopTier: boolean
  percentile: number
}

/**
 * Get color class based on position ranking
 */
export function getPositionColorClass(rank: number, totalTeams: number): string {
  // Top 3: Medal colors matching original app exactly
  if (rank === 1) {
    return 'rank-1' // Gold - #fcd34d
  }
  if (rank === 2) {
    return 'rank-2' // Silver - #cbd5e1  
  }
  if (rank === 3) {
    return 'rank-3' // Bronze - #d97706
  }
  
  // Top half vs bottom half
  const midPoint = Math.ceil(totalTeams / 2)
  
  if (rank <= midPoint) {
    return 'rank-top-half' // Top half - #dbeafe (light blue)
  } else {
    return 'rank-bottom-half' // Bottom half - #fee2e2 (light red)
  }
}

/**
 * Calculate comprehensive position ranking data
 */
export function calculatePositionRanking(
  teamPoints: number,
  allTeamPoints: number[],
  totalTeams: number
): PositionRankingResult {
  // Sort points in descending order to find rank
  const sortedPoints = [...allTeamPoints].sort((a, b) => b - a)
  const rank = sortedPoints.findIndex(points => points === teamPoints) + 1
  
  // Calculate percentile (higher is better)
  const percentile = ((totalTeams - rank + 1) / totalTeams) * 100
  
  return {
    rank,
    points: teamPoints,
    colorClass: getPositionColorClass(rank, totalTeams),
    isTopTier: rank <= 3,
    percentile: Math.round(percentile)
  }
}

/**
 * Calculate average ranking across all positions for a team
 */
export function calculateAverageRanking(
  teamData: TeamPositionalData,
  leagueData: LeaguePositionalData
): { avgRank: number, avgPoints: number } {
  const positions: PositionKey[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S']
  
  let totalRank = 0
  let totalPoints = 0
  let positionCount = 0
  
  positions.forEach(position => {
    const positionRanking = leagueData.positionRankings[position]
    const teamRanking = positionRanking?.find(r => r.franchiseId === teamData.franchiseId)
    
    if (teamRanking) {
      totalRank += teamRanking.rank
      totalPoints += teamRanking.points
      positionCount++
    }
  })
  
  return {
    avgRank: positionCount > 0 ? totalRank / positionCount : 0,
    avgPoints: positionCount > 0 ? totalPoints / positionCount : 0
  }
}

/**
 * Format position ranking for display (rank with points in parentheses)
 */
export function formatPositionDisplay(rank: number, points: number): string {
  return `${rank} (${points.toFixed(1)})`
}

/**
 * Get position abbreviation for display
 */
export function getPositionAbbreviation(position: PositionKey): string {
  const abbreviations: Record<PositionKey, string> = {
    QB: 'QB',
    RB: 'RB', 
    WR: 'WR',
    TE: 'TE',
    K: 'K',
    DL: 'DL',
    LB: 'LB',
    CB: 'CB',
    S: 'S',
    'O-Flex': 'O-Flex',
    'D-Flex': 'D-Flex'
  }
  return abbreviations[position] || position
}

/**
 * Sort teams by average ranking for the table
 */
export function sortTeamsByAverageRanking(
  teams: TeamPositionalData[],
  leagueData: LeaguePositionalData
): (TeamPositionalData & { avgRank: number })[] {
  return teams
    .map(team => ({
      ...team,
      avgRank: calculateAverageRanking(team, leagueData).avgRank
    }))
    .sort((a, b) => a.avgRank - b.avgRank) // Lower average rank is better
}

/**
 * Identify team strengths and weaknesses
 */
export interface TeamAnalysis {
  strengths: { position: PositionKey, rank: number, points: number }[]
  weaknesses: { position: PositionKey, rank: number, points: number }[]
  summary: string
}

export function analyzeTeamPositions(
  teamData: TeamPositionalData,
  leagueData: LeaguePositionalData
): TeamAnalysis {
  const positions: PositionKey[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S']
  const totalTeams = leagueData.teams.length
  
  const strengths: TeamAnalysis['strengths'] = []
  const weaknesses: TeamAnalysis['weaknesses'] = []
  
  positions.forEach(position => {
    const positionRanking = leagueData.positionRankings[position]
    const teamRanking = positionRanking?.find(r => r.franchiseId === teamData.franchiseId)
    
    if (teamRanking) {
      if (teamRanking.rank <= 3) {
        strengths.push({
          position,
          rank: teamRanking.rank,
          points: teamRanking.points
        })
      } else if (teamRanking.rank > Math.ceil((totalTeams * 2) / 3)) {
        weaknesses.push({
          position,
          rank: teamRanking.rank,
          points: teamRanking.points
        })
      }
    }
  })
  
  // Generate summary
  let summary = ''
  if (strengths.length > 0) {
    const strengthPositions = strengths.map(s => getPositionAbbreviation(s.position)).join(', ')
    summary += `Strong at: ${strengthPositions}. `
  }
  if (weaknesses.length > 0) {
    const weaknessPositions = weaknesses.map(w => getPositionAbbreviation(w.position)).join(', ')
    summary += `Needs improvement: ${weaknessPositions}.`
  }
  if (strengths.length === 0 && weaknesses.length === 0) {
    summary = 'Balanced across all positions.'
  }
  
  return { strengths, weaknesses, summary: summary.trim() }
}

/**
 * Calculate league-wide average points for each position (arithmetic mean)
 */
export function calculateLeagueAverages(leagueData: LeaguePositionalData): PositionTotals {
  const positions: PositionKey[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S', 'O-Flex', 'D-Flex']
  const averages: PositionTotals = {
    QB: 0, RB: 0, WR: 0, TE: 0, K: 0,
    DL: 0, LB: 0, CB: 0, S: 0,
    'O-Flex': 0, 'D-Flex': 0
  }

  const teamCount = leagueData.teams.length
  if (teamCount === 0) return averages

  positions.forEach(position => {
    const totalPoints = leagueData.teams.reduce((sum, team) => {
      return sum + (team.positionTotals[position] || 0)
    }, 0)
    averages[position] = totalPoints / teamCount
  })

  return averages
}

/**
 * Calculate league-wide median points for each position
 * The median is the middle value when all teams are sorted by position points
 */
export function calculateMedian(leagueData: LeaguePositionalData): PositionTotals {
  const positions: PositionKey[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S', 'O-Flex', 'D-Flex']
  const medians: PositionTotals = {
    QB: 0, RB: 0, WR: 0, TE: 0, K: 0,
    DL: 0, LB: 0, CB: 0, S: 0,
    'O-Flex': 0, 'D-Flex': 0
  }

  const teamCount = leagueData.teams.length
  if (teamCount === 0) return medians

  positions.forEach(position => {
    // Collect all team points for this position
    const allPoints = leagueData.teams
      .map(team => team.positionTotals[position] || 0)
      .sort((a, b) => a - b) // Sort ascending

    // Calculate median
    const midIndex = Math.floor(allPoints.length / 2)
    if (allPoints.length % 2 === 0) {
      // Even number of teams: average of two middle values
      medians[position] = (allPoints[midIndex - 1] + allPoints[midIndex]) / 2
    } else {
      // Odd number of teams: exact middle value
      medians[position] = allPoints[midIndex]
    }
  })

  return medians
}

/**
 * Calculate trimmed mean for each position
 * Excludes top and bottom X% of teams before calculating average
 * @param leagueData - League positional data
 * @param trimPercent - Percentage to trim from each end (default 0.10 = 10%)
 */
export function calculateTrimmedMean(
  leagueData: LeaguePositionalData,
  trimPercent: number = 0.10
): PositionTotals {
  const positions: PositionKey[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S', 'O-Flex', 'D-Flex']
  const trimmedMeans: PositionTotals = {
    QB: 0, RB: 0, WR: 0, TE: 0, K: 0,
    DL: 0, LB: 0, CB: 0, S: 0,
    'O-Flex': 0, 'D-Flex': 0
  }

  const teamCount = leagueData.teams.length
  if (teamCount === 0) return trimmedMeans

  // Calculate how many teams to trim from each end
  const trimCount = Math.floor(teamCount * trimPercent)

  // If we'd trim everything or more than half, just return regular mean
  if (trimCount * 2 >= teamCount) {
    return calculateLeagueAverages(leagueData)
  }

  positions.forEach(position => {
    // Collect and sort all team points for this position
    const allPoints = leagueData.teams
      .map(team => team.positionTotals[position] || 0)
      .sort((a, b) => a - b) // Sort ascending

    // Remove top and bottom teams
    const trimmedPoints = allPoints.slice(trimCount, allPoints.length - trimCount)

    // Calculate mean of trimmed data
    const sum = trimmedPoints.reduce((acc, pts) => acc + pts, 0)
    trimmedMeans[position] = trimmedPoints.length > 0 ? sum / trimmedPoints.length : 0
  })

  return trimmedMeans
}

export type ComparisonType = 'mean' | 'median' | 'trimmedMean'

/**
 * Create a special TeamPositionalData object representing league averages
 * @deprecated Use createComparisonRowData instead for more flexibility
 */
export function createAverageRowData(leagueData: LeaguePositionalData): TeamPositionalData & { avgRank: number, isAverageRow: boolean, comparisonType?: ComparisonType } {
  return createComparisonRowData(leagueData, 'mean')
}

/**
 * Create a comparison row for a specific statistical measure
 * @param leagueData - League positional data
 * @param type - Type of comparison (mean, median, trimmedMean)
 */
export function createComparisonRowData(
  leagueData: LeaguePositionalData,
  type: ComparisonType
): TeamPositionalData & { avgRank: number, isAverageRow: boolean, comparisonType: ComparisonType } {
  const teamCount = leagueData.teams.length
  const averageRank = (teamCount + 1) / 2

  let values: PositionTotals
  let label: string
  let franchiseId: string

  switch (type) {
    case 'median':
      values = calculateMedian(leagueData)
      label = 'League Median'
      franchiseId = 'LEAGUE_MEDIAN'
      break
    case 'trimmedMean':
      values = calculateTrimmedMean(leagueData, 0.10)
      label = 'League Trimmed Mean (10%)'
      franchiseId = 'LEAGUE_TRIMMED'
      break
    case 'mean':
    default:
      values = calculateLeagueAverages(leagueData)
      label = 'League Average (Mean)'
      franchiseId = 'LEAGUE_AVG'
      break
  }

  return {
    franchiseId,
    teamName: label,
    manager: '---',
    year: leagueData.leagueSettings.year,
    players: [],
    positionTotals: values,
    weeklyLineups: [],
    avgRank: averageRank,
    isAverageRow: true,
    comparisonType: type
  }
}

/**
 * Create multiple comparison rows based on selected comparison types
 * @param leagueData - League positional data
 * @param types - Array of comparison types to create
 */
export function createComparisonRows(
  leagueData: LeaguePositionalData,
  types: ComparisonType[]
): (TeamPositionalData & { avgRank: number, isAverageRow: boolean, comparisonType: ComparisonType })[] {
  return types.map(type => createComparisonRowData(leagueData, type))
}

/**
 * Export utility functions for CSV/JSON export
 * @param leagueData - League positional data
 * @param comparisonTypes - Array of comparison types to include (defaults to ['mean'] for backward compatibility)
 */
export function preparePositionExportData(
  leagueData: LeaguePositionalData,
  comparisonTypes: ComparisonType[] = ['mean']
) {
  const positions: PositionKey[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S', 'O-Flex', 'D-Flex']

  const exportData = leagueData.teams.map(team => {
    const teamData: any = {
      Team: team.teamName,
      Manager: team.manager,
      Year: team.year
    }

    // Add position data
    positions.forEach(position => {
      const positionRanking = leagueData.positionRankings[position]
      const teamRanking = positionRanking?.find(r => r.franchiseId === team.franchiseId)

      if (teamRanking) {
        teamData[`${getPositionAbbreviation(position)} Rank`] = teamRanking.rank
        teamData[`${getPositionAbbreviation(position)} Points`] = teamRanking.points.toFixed(2)
      }
    })

    // Add average ranking
    const avgRank = calculateAverageRanking(team, leagueData).avgRank
    teamData['Average Rank'] = avgRank.toFixed(1)

    return teamData
  })

  // Add comparison rows based on selected types
  if (comparisonTypes.length > 0) {
    const comparisonRows = createComparisonRows(leagueData, comparisonTypes)

    comparisonRows.forEach(comparisonRow => {
      const rowData: any = {
        Team: comparisonRow.teamName,
        Manager: '---',
        Year: leagueData.leagueSettings.year
      }

      positions.forEach(position => {
        const points = comparisonRow.positionTotals[position]
        rowData[`${getPositionAbbreviation(position)} Rank`] = ((leagueData.teams.length + 1) / 2).toFixed(1)
        rowData[`${getPositionAbbreviation(position)} Points`] = points.toFixed(2)
      })

      rowData['Average Rank'] = comparisonRow.avgRank.toFixed(1)

      exportData.push(rowData)
    })
  }

  return exportData
}