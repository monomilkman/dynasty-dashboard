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
  const powerScores = teams.map(team => {
    const efficiency = team.potentialPoints > 0 ? (team.startersPoints / team.potentialPoints) : 0
    const winPct = team.winPercentage
    const pointDiff = (team.pointsFor - team.pointsAgainst) / (team.pointsFor || 1)
    const totalPointsNormalized = team.totalPoints / Math.max(...teams.map(t => t.totalPoints))
    
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
    value: team.startersPoints || team.offensePoints // Use starter points as requested, fallback to offense points
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
    const efficiency = (team.potentialPoints > 0 && team.startersPoints > 0) 
      ? (team.startersPoints / team.potentialPoints) 
      : 0
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
      description: 'Ranked by offensive points scored',
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