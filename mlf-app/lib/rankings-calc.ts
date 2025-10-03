import { Team } from './mfl'

export interface TeamRanking {
  teamId: string
  teamName: string
  manager: string
  rank: number
  value: number
  previousRank?: number
}

export interface RankingCategory {
  id: string
  name: string
  description: string
  rankings: TeamRanking[]
}

export function calculatePowerRankings(teams: Team[]): TeamRanking[] {
  // Power ranking is a composite score based on multiple factors
  const maxTotalPoints = Math.max(...teams.map(t => t.totalPoints || 0))
  
  const powerScores = teams.map(team => {
    // Handle edge cases for each component
    const startersPoints = team.startersPoints || 0
    const potentialPoints = team.potentialPoints || 0
    const efficiency = potentialPoints > 0 ? Math.min(startersPoints / potentialPoints, 1.0) : 0
    
    const winPct = team.winPercentage || 0
    const pointsFor = team.pointsFor || 0
    const pointsAgainst = team.pointsAgainst || 0
    const pointDiff = pointsFor > 0 ? (pointsFor - pointsAgainst) / pointsFor : 0
    const totalPointsNormalized = maxTotalPoints > 0 ? (team.totalPoints || 0) / maxTotalPoints : 0
    
    // Weighted composite score
    const powerScore = (
      winPct * 0.35 +           // Win percentage (35%)
      efficiency * 0.25 +       // Efficiency (25%)
      totalPointsNormalized * 0.25 + // Total points normalized (25%)
      (pointDiff + 1) / 2 * 0.15    // Point differential normalized (15%)
    ) * 100
    
    return {
      teamId: team.id,
      teamName: team.teamName,
      manager: team.manager,
      rank: 0, // Will be set after sorting
      value: powerScore
    }
  })

  // Sort and assign ranks
  powerScores.sort((a, b) => b.value - a.value)
  return powerScores.map((score, index) => ({
    ...score,
    rank: index + 1
  }))
}

export function calculateOffensiveRankings(teams: Team[]): TeamRanking[] {
  const rankings = teams.map(team => ({
    teamId: team.id,
    teamName: team.teamName,
    manager: team.manager,
    rank: 0,
    value: team.offensePoints
  }))

  rankings.sort((a, b) => b.value - a.value)
  return rankings.map((ranking, index) => ({
    ...ranking,
    rank: index + 1
  }))
}

export function calculateDefensiveRankings(teams: Team[]): TeamRanking[] {
  const rankings = teams.map(team => ({
    teamId: team.id,
    teamName: team.teamName,
    manager: team.manager,
    rank: 0,
    value: team.defensePoints
  }))

  rankings.sort((a, b) => b.value - a.value)
  return rankings.map((ranking, index) => ({
    ...ranking,
    rank: index + 1
  }))
}

export function calculateEfficiencyRankings(teams: Team[]): TeamRanking[] {
  const rankings = teams.map(team => {
    // Handle edge cases for efficiency calculation
    const startersPoints = team.startersPoints || 0
    const potentialPoints = team.potentialPoints || 0
    
    let efficiency = 0
    if (potentialPoints > 0 && startersPoints >= 0) {
      efficiency = startersPoints / potentialPoints
      // Cap efficiency at 100% to handle any data anomalies
      efficiency = Math.min(efficiency, 1.0)
    }
    
    return {
      teamId: team.id,
      teamName: team.teamName,
      manager: team.manager,
      rank: 0,
      value: efficiency * 100 // Convert to percentage
    }
  })

  rankings.sort((a, b) => b.value - a.value)
  return rankings.map((ranking, index) => ({
    ...ranking,
    rank: index + 1
  }))
}

export function calculatePointDifferentialRankings(teams: Team[]): TeamRanking[] {
  const rankings = teams.map(team => ({
    teamId: team.id,
    teamName: team.teamName,
    manager: team.manager,
    rank: 0,
    value: team.pointsFor - team.pointsAgainst
  }))

  rankings.sort((a, b) => b.value - a.value)
  return rankings.map((ranking, index) => ({
    ...ranking,
    rank: index + 1
  }))
}

export function calculateWinPercentageRankings(teams: Team[]): TeamRanking[] {
  const rankings = teams.map(team => ({
    teamId: team.id,
    teamName: team.teamName,
    manager: team.manager,
    rank: 0,
    value: team.winPercentage * 100 // Convert to percentage
  }))

  rankings.sort((a, b) => b.value - a.value)
  return rankings.map((ranking, index) => ({
    ...ranking,
    rank: index + 1
  }))
}

export function calculateTotalPointsRankings(teams: Team[]): TeamRanking[] {
  const rankings = teams.map(team => ({
    teamId: team.id,
    teamName: team.teamName,
    manager: team.manager,
    rank: 0,
    value: team.totalPoints
  }))

  rankings.sort((a, b) => b.value - a.value)
  return rankings.map((ranking, index) => ({
    ...ranking,
    rank: index + 1
  }))
}

export function getAllRankingCategories(teams: Team[]): RankingCategory[] {
  return [
    {
      id: 'power',
      name: 'Power Rankings',
      description: 'Composite ranking based on wins, efficiency, total points, and point differential',
      rankings: calculatePowerRankings(teams)
    },
    {
      id: 'wins',
      name: 'Win Percentage',
      description: 'Ranked by win percentage and overall record',
      rankings: calculateWinPercentageRankings(teams)
    },
    {
      id: 'total',
      name: 'Total Points',
      description: 'Ranked by total points scored this season',
      rankings: calculateTotalPointsRankings(teams)
    },
    {
      id: 'efficiency',
      name: 'Efficiency',
      description: 'Points scored vs potential points (lineup optimization)',
      rankings: calculateEfficiencyRankings(teams)
    },
    {
      id: 'offense',
      name: 'Offensive Power',
      description: 'Ranked by total points from offensive starting players',
      rankings: calculateOffensiveRankings(teams)
    },
    {
      id: 'defense',
      name: 'Defensive Power',
      description: 'Ranked by defensive points scored',
      rankings: calculateDefensiveRankings(teams)
    },
    {
      id: 'differential',
      name: 'Point Differential',
      description: 'Points for minus points against',
      rankings: calculatePointDifferentialRankings(teams)
    }
  ]
}

export function getRankingBadgeStyle(rank: number, total: number): string {
  const topThird = Math.ceil(total / 3)
  const middleThird = Math.ceil((total * 2) / 3)
  
  if (rank <= topThird) {
    return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  } else if (rank <= middleThird) {
    return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  } else {
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  }
}

export function formatRankingValue(value: number, categoryId: string): string {
  switch (categoryId) {
    case 'power':
      return value.toFixed(1)
    case 'wins':
    case 'efficiency':
      return value.toFixed(1) + '%'
    case 'total':
    case 'offense':
    case 'defense':
      return value.toFixed(2)
    case 'differential':
      return (value >= 0 ? '+' : '') + value.toFixed(2)
    default:
      return value.toFixed(2)
  }
}