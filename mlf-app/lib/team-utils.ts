import { Team } from './mfl'

/**
 * Formats a team display name consistently across the application
 * @param team - The team object
 * @param includeManager - Whether to include manager name
 * @param includeYear - Whether to include year
 * @returns Formatted team display string
 */
export function formatTeamDisplay(
  team: Team, 
  options: {
    includeManager?: boolean
    includeYear?: boolean
    yearFormat?: 'parentheses' | 'prefix' | 'suffix'
  } = {}
): string {
  const { includeManager = false, includeYear = true, yearFormat = 'parentheses' } = options
  
  let display = team.teamName
  
  if (includeYear) {
    switch (yearFormat) {
      case 'parentheses':
        display = `${team.teamName} (${team.year})`
        break
      case 'prefix':
        display = `${team.year} ${team.teamName}`
        break
      case 'suffix':
        display = `${team.teamName} - ${team.year}`
        break
    }
  }
  
  if (includeManager) {
    display = `${display} - ${team.manager}`
  }
  
  return display
}

/**
 * Gets unique years from a list of teams
 * @param teams - Array of teams
 * @returns Sorted array of unique years (descending)
 */
export function getUniqueYears(teams: Team[]): number[] {
  const years = [...new Set(teams.map(team => team.year))]
  return years.sort((a, b) => b - a)
}

/**
 * Groups teams by year
 * @param teams - Array of teams
 * @returns Object with years as keys and teams as values
 */
export function groupTeamsByYear(teams: Team[]): { [year: number]: Team[] } {
  return teams.reduce((acc, team) => {
    if (!acc[team.year]) {
      acc[team.year] = []
    }
    acc[team.year].push(team)
    return acc
  }, {} as { [year: number]: Team[] })
}

/**
 * Formats a list of years for display
 * @param years - Array of years
 * @returns Formatted string of years
 */
export function formatYearsDisplay(years: number[]): string {
  if (years.length === 0) return ''
  if (years.length === 1) return years[0].toString()
  
  const sortedYears = [...years].sort((a, b) => b - a)
  
  if (years.length === 2) {
    return `${sortedYears[0]} & ${sortedYears[1]}`
  }
  
  return `${sortedYears.slice(0, -1).join(', ')} & ${sortedYears[sortedYears.length - 1]}`
}