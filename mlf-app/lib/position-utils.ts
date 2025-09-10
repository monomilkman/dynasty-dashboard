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
 * Export utility functions for CSV/JSON export
 */
export function preparePositionExportData(leagueData: LeaguePositionalData) {
  const positions: PositionKey[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S', 'O-Flex', 'D-Flex']
  
  return leagueData.teams.map(team => {
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
}