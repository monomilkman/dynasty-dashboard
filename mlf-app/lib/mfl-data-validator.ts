// MFL Data Validation System
// Ensures data accuracy and completeness before displaying to users

interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  teamData?: any
}

interface ValidationRules {
  requireAllPositions: boolean
  maxPointsDifference: number
  minSeasonPoints: number
  maxSeasonPoints: number
}

// Validation rules for different seasons
const DEFAULT_RULES: ValidationRules = {
  requireAllPositions: true,
  maxPointsDifference: 10, // Max difference between offense+defense and starter points
  minSeasonPoints: 1000,   // Minimum reasonable season points
  maxSeasonPoints: 8000    // Maximum reasonable season points
}

/**
 * Validate a single team's data for completeness and accuracy
 * @param teamData Team data to validate
 * @param year Season year
 * @param weeksCount Number of weeks included in the data (optional, used for partial season validation)
 */
export function validateTeamData(teamData: any, year: number, weeksCount?: number): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    teamData
  }
  
  // Check required fields exist
  const requiredFields = [
    'startersPoints', 'benchPoints', 'potentialPoints',
    'offensePoints', 'defensePoints', 'totalPoints'
  ]
  
  for (const field of requiredFields) {
    if (typeof teamData[field] !== 'number') {
      result.errors.push(`Missing or invalid ${field}`)
      result.isValid = false
    }
  }
  
  // Check position points
  const positionFields = ['qbPoints', 'rbPoints', 'wrPoints', 'tePoints', 'kPoints', 
                         'dlPoints', 'lbPoints', 'cbPoints', 'sPoints']
  
  const missingPositions = positionFields.filter(field => 
    typeof teamData[field] !== 'number' || teamData[field] === 0
  )
  
  if (missingPositions.length > 0 && DEFAULT_RULES.requireAllPositions) {
    result.warnings.push(`Missing position data: ${missingPositions.join(', ')}`)
  }
  
  // Check data consistency
  if (result.errors.length === 0) {
    // Total points should equal starter points
    if (Math.abs(teamData.totalPoints - teamData.startersPoints) > 0.01) {
      result.errors.push(`Total points (${teamData.totalPoints}) doesn't match starter points (${teamData.startersPoints})`)
      result.isValid = false
    }
    
    // Offense + Defense should roughly equal starter points
    const combinedPositionPoints = teamData.offensePoints + teamData.defensePoints
    const pointsDifference = Math.abs(combinedPositionPoints - teamData.startersPoints)
    
    if (pointsDifference > DEFAULT_RULES.maxPointsDifference) {
      result.warnings.push(`Position points (${combinedPositionPoints.toFixed(2)}) differ significantly from starter points (${teamData.startersPoints})`)
    }
    
    // Potential points should be >= starter points
    if (teamData.potentialPoints < teamData.startersPoints) {
      result.errors.push(`Potential points (${teamData.potentialPoints}) is less than starter points (${teamData.startersPoints})`)
      result.isValid = false
    }
    
    // Season points should be reasonable - adjust for partial seasons
    const expectedWeeksInSeason = 17 // NFL regular season
    const actualWeeks = weeksCount || expectedWeeksInSeason
    const isPartialSeason = actualWeeks < expectedWeeksInSeason

    // Calculate adjusted thresholds based on weeks played
    const adjustedMinPoints = DEFAULT_RULES.minSeasonPoints * (actualWeeks / expectedWeeksInSeason)
    const adjustedMaxPoints = DEFAULT_RULES.maxSeasonPoints * (actualWeeks / expectedWeeksInSeason)

    if (teamData.startersPoints < adjustedMinPoints) {
      const weeksText = isPartialSeason ? `${actualWeeks} week(s)` : 'a full season'
      result.warnings.push(`Starter points (${teamData.startersPoints.toFixed(2)}) seems unusually low for ${weeksText}`)
    }

    if (teamData.startersPoints > adjustedMaxPoints) {
      const weeksText = isPartialSeason ? `${actualWeeks} week(s)` : 'a full season'
      result.warnings.push(`Starter points (${teamData.startersPoints.toFixed(2)}) seems unusually high for ${weeksText}`)
    }
  }
  
  return result
}

/**
 * Validate all teams data for a season
 * @param teamsData Array of team data to validate
 * @param year Season year
 * @param weeksCount Number of weeks included in the data (optional, used for partial season validation)
 */
export function validateSeasonData(teamsData: any[], year: number, weeksCount?: number): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  }
  
  console.log(`*** VALIDATING DATA FOR ${teamsData.length} TEAMS IN ${year} ***`)
  
  if (teamsData.length === 0) {
    result.errors.push('No team data provided')
    result.isValid = false
    return result
  }
  
  // Validate each team
  let validTeams = 0
  for (const team of teamsData) {
    const teamValidation = validateTeamData(team, year, weeksCount)
    
    if (teamValidation.isValid) {
      validTeams++
    } else {
      result.isValid = false
      result.errors.push(`Team ${team.id}: ${teamValidation.errors.join(', ')}`)
    }
    
    // Add warnings
    if (teamValidation.warnings.length > 0) {
      result.warnings.push(`Team ${team.id}: ${teamValidation.warnings.join(', ')}`)
    }
  }
  
  // Season-level validations
  if (teamsData.length < 8 || teamsData.length > 16) {
    result.warnings.push(`Unusual number of teams: ${teamsData.length}`)
  }
  
  // Check for duplicate team IDs
  const teamIds = teamsData.map(team => team.id)
  const uniqueIds = new Set(teamIds)
  if (teamIds.length !== uniqueIds.size) {
    result.errors.push('Duplicate team IDs found')
    result.isValid = false
  }
  
  console.log(`Validation complete: ${validTeams}/${teamsData.length} teams valid, ${result.errors.length} errors, ${result.warnings.length} warnings`)
  
  // Log warnings
  if (result.warnings.length > 0) {
    console.warn('Data validation warnings:')
    result.warnings.forEach(warning => console.warn(`- ${warning}`))
  }
  
  // Log errors
  if (result.errors.length > 0) {
    console.error('Data validation errors:')
    result.errors.forEach(error => console.error(`- ${error}`))
  }
  
  return result
}

/**
 * Compare data from different sources for accuracy
 */
export function compareDataSources(
  apiData: any[],
  scrapedData: Map<string, any>,
  year: number
): ValidationResult {
  const result: ValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  }
  
  console.log(`*** COMPARING DATA SOURCES FOR ${year} ***`)
  
  for (const team of apiData) {
    const scrapedTeam = scrapedData.get(team.id)
    
    if (scrapedTeam) {
      // Compare key metrics
      const apiStarters = team.startersPoints || 0
      const scrapedStarters = scrapedTeam.startersPoints || 0
      const startersDiff = Math.abs(apiStarters - scrapedStarters)
      
      if (startersDiff > 50) { // More than 50 points difference
        result.warnings.push(`Team ${team.id}: Significant difference in starter points - API: ${apiStarters}, Scraped: ${scrapedStarters}`)
      }
      
      // Compare potential points
      const apiPotential = team.potentialPoints || 0
      const scrapedPotential = scrapedTeam.potentialPoints || 0
      const potentialDiff = Math.abs(apiPotential - scrapedPotential)
      
      if (potentialDiff > 100) {
        result.warnings.push(`Team ${team.id}: Significant difference in potential points - API: ${apiPotential}, Scraped: ${scrapedPotential}`)
      }
    }
  }
  
  console.log(`Data source comparison complete: ${result.warnings.length} discrepancies found`)
  return result
}

/**
 * Sanitize team data to prevent display of invalid values
 */
export function sanitizeTeamData(teamData: any): any {
  const sanitized = { ...teamData }
  
  // Ensure all numeric fields are valid numbers
  const numericFields = [
    'startersPoints', 'benchPoints', 'potentialPoints', 'efficiency',
    'offensePoints', 'defensePoints', 'totalPoints',
    'qbPoints', 'rbPoints', 'wrPoints', 'tePoints', 'kPoints',
    'dlPoints', 'lbPoints', 'cbPoints', 'sPoints',
    'offenseFlexPoints', 'defenseFlexPoints',
    'wins', 'losses', 'ties', 'pointsFor', 'pointsAgainst', 'winPercentage'
  ]
  
  numericFields.forEach(field => {
    if (typeof sanitized[field] !== 'number' || isNaN(sanitized[field])) {
      sanitized[field] = 0
    }
    // Round to 2 decimal places
    sanitized[field] = Math.round(sanitized[field] * 100) / 100
  })
  
  // Ensure string fields are strings
  sanitized.id = String(sanitized.id || '')
  sanitized.manager = String(sanitized.manager || 'Unknown')
  sanitized.teamName = String(sanitized.teamName || 'Unknown Team')
  
  return sanitized
}

/**
 * Generate data quality report
 */
export function generateDataQualityReport(teamsData: any[], year: number): string {
  const validation = validateSeasonData(teamsData, year)
  
  let report = `\n=== DATA QUALITY REPORT FOR ${year} ===\n`
  report += `Teams: ${teamsData.length}\n`
  report += `Valid: ${validation.isValid ? 'YES' : 'NO'}\n`
  report += `Errors: ${validation.errors.length}\n`
  report += `Warnings: ${validation.warnings.length}\n`
  
  if (validation.errors.length > 0) {
    report += `\nERRORS:\n`
    validation.errors.forEach(error => {
      report += `- ${error}\n`
    })
  }
  
  if (validation.warnings.length > 0) {
    report += `\nWARNINGS:\n`
    validation.warnings.forEach(warning => {
      report += `- ${warning}\n`
    })
  }
  
  // Calculate completeness metrics
  let completePositionData = 0
  let completeTeams = 0
  
  teamsData.forEach(team => {
    const teamValidation = validateTeamData(team, year)
    if (teamValidation.isValid) completeTeams++
    
    const positionFields = ['qbPoints', 'rbPoints', 'wrPoints', 'tePoints', 'kPoints', 
                           'dlPoints', 'lbPoints', 'cbPoints', 'sPoints']
    const hasAllPositions = positionFields.every(field => 
      typeof team[field] === 'number' && team[field] > 0
    )
    if (hasAllPositions) completePositionData++
  })
  
  report += `\nCOMPLETENESS:\n`
  report += `- Complete teams: ${completeTeams}/${teamsData.length} (${Math.round(completeTeams/teamsData.length*100)}%)\n`
  report += `- Position data: ${completePositionData}/${teamsData.length} (${Math.round(completePositionData/teamsData.length*100)}%)\n`
  
  return report
}