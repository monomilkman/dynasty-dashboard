// Season Breakdown Utilities
// Provides functions to break down team stats into Regular Season, Postseason, and Full Season

import { getWeeksByCategory, getRegularSeasonEndWeek, isPlayoffWeek } from './season-config'

export interface SeasonBreakdown {
  regularSeasonPoints: number
  postseasonPoints: number
  fullSeasonPoints: number
  regularSeasonWeeks: number[]
  postseasonWeeks: number[]
  totalWeeks: number[]
}

export interface TeamSeasonStats {
  franchiseId: string
  manager: string
  teamName: string
  year: number
  breakdown: SeasonBreakdown
  
  // Additional metrics
  regularSeasonAvg: number
  postseasonAvg: number
  fullSeasonAvg: number
  efficiency: number // postseason performance vs regular season
}

/**
 * Calculate season breakdown for a team given their weekly scores
 */
export function calculateSeasonBreakdown(
  weeklyScores: { week: number; points: number }[],
  year: number
): SeasonBreakdown {
  
  const weekCategories = getWeeksByCategory(year)
  const regularSeasonEndWeek = getRegularSeasonEndWeek(year)
  
  // Separate scores by category
  const regularSeasonScores = weeklyScores.filter(w => w.week <= regularSeasonEndWeek)
  const postseasonScores = weeklyScores.filter(w => w.week > regularSeasonEndWeek)
  
  const regularSeasonPoints = regularSeasonScores.reduce((sum, w) => sum + w.points, 0)
  const postseasonPoints = postseasonScores.reduce((sum, w) => sum + w.points, 0)
  const fullSeasonPoints = regularSeasonPoints + postseasonPoints
  
  return {
    regularSeasonPoints,
    postseasonPoints,
    fullSeasonPoints,
    regularSeasonWeeks: regularSeasonScores.map(w => w.week),
    postseasonWeeks: postseasonScores.map(w => w.week),
    totalWeeks: weeklyScores.map(w => w.week)
  }
}

/**
 * Calculate comprehensive team season statistics
 */
export function calculateTeamSeasonStats(
  franchiseId: string,
  manager: string,
  teamName: string,
  weeklyScores: { week: number; points: number }[],
  year: number
): TeamSeasonStats {
  
  const breakdown = calculateSeasonBreakdown(weeklyScores, year)
  
  // Calculate averages
  const regularSeasonAvg = breakdown.regularSeasonWeeks.length > 0 
    ? breakdown.regularSeasonPoints / breakdown.regularSeasonWeeks.length 
    : 0
    
  const postseasonAvg = breakdown.postseasonWeeks.length > 0 
    ? breakdown.postseasonPoints / breakdown.postseasonWeeks.length 
    : 0
    
  const fullSeasonAvg = breakdown.totalWeeks.length > 0 
    ? breakdown.fullSeasonPoints / breakdown.totalWeeks.length 
    : 0
    
  // Calculate efficiency (postseason performance relative to regular season)
  const efficiency = regularSeasonAvg > 0 ? (postseasonAvg / regularSeasonAvg) : 0
  
  return {
    franchiseId,
    manager,
    teamName,
    year,
    breakdown,
    regularSeasonAvg,
    postseasonAvg,
    fullSeasonAvg,
    efficiency
  }
}

/**
 * Create season breakdown from existing team data (when we only have totals)
 */
export function estimateSeasonBreakdown(
  totalPoints: number,
  potentialPoints: number,
  year: number
): SeasonBreakdown {
  
  const weekCategories = getWeeksByCategory(year)
  const regularSeasonWeeks = weekCategories.regularSeason.length
  const postseasonWeeks = weekCategories.playoffs.length
  const totalWeeks = regularSeasonWeeks + postseasonWeeks
  
  // Estimate distribution based on week proportions
  // This is a fallback when we don't have weekly data
  const regularSeasonPortion = regularSeasonWeeks / totalWeeks
  const postseasonPortion = postseasonWeeks / totalWeeks
  
  const estimatedRegularSeasonPoints = totalPoints * regularSeasonPortion
  const estimatedPostseasonPoints = totalPoints * postseasonPortion
  
  return {
    regularSeasonPoints: estimatedRegularSeasonPoints,
    postseasonPoints: estimatedPostseasonPoints,
    fullSeasonPoints: totalPoints,
    regularSeasonWeeks: weekCategories.regularSeason,
    postseasonWeeks: weekCategories.playoffs,
    totalWeeks: weekCategories.allWeeks
  }
}

/**
 * Format season breakdown for display
 */
export function formatSeasonBreakdown(breakdown: SeasonBreakdown): {
  regularSeasonDisplay: string
  postseasonDisplay: string
  fullSeasonDisplay: string
  weekRangeDisplay: string
} {
  
  return {
    regularSeasonDisplay: `${breakdown.regularSeasonPoints.toFixed(1)} pts`,
    postseasonDisplay: `${breakdown.postseasonPoints.toFixed(1)} pts`,
    fullSeasonDisplay: `${breakdown.fullSeasonPoints.toFixed(1)} pts`,
    weekRangeDisplay: `Weeks 1-${Math.max(...breakdown.regularSeasonWeeks)} + ${breakdown.postseasonWeeks.length} playoff`
  }
}

/**
 * Check if a team has meaningful postseason data
 */
export function hasPostseasonData(breakdown: SeasonBreakdown): boolean {
  return breakdown.postseasonWeeks.length > 0 && breakdown.postseasonPoints > 0
}

/**
 * Get efficiency rating description
 */
export function getEfficiencyRating(efficiency: number): {
  rating: string
  color: string
  description: string
} {
  
  if (efficiency >= 1.1) {
    return {
      rating: 'Clutch',
      color: 'text-green-600',
      description: 'Performed better in playoffs'
    }
  } else if (efficiency >= 0.95) {
    return {
      rating: 'Steady',
      color: 'text-blue-600', 
      description: 'Consistent throughout season'
    }
  } else if (efficiency >= 0.8) {
    return {
      rating: 'Faded',
      color: 'text-yellow-600',
      description: 'Slight decline in playoffs'
    }
  } else {
    return {
      rating: 'Struggled',
      color: 'text-red-600',
      description: 'Significant decline in playoffs'
    }
  }
}