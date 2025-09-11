/**
 * MFL Debug Logging and Raw Data Storage
 * Provides detailed debugging information and raw API response storage
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { CalculationDebugInfo, PlayerCalculationInfo } from './mfl-calculations'

// Environment variables for debug control
export const DEBUG_CONFIG = {
  enabled: process.env.MFL_DEBUG_MODE === 'true',
  storeRawResponses: process.env.MFL_STORE_RAW_RESPONSES === 'true',
  logLevel: process.env.MFL_LOG_LEVEL || 'info', // 'debug', 'info', 'warn', 'error'
  debugDir: process.env.MFL_DEBUG_DIR || join(process.cwd(), 'debug-logs')
}

// Ensure debug directory exists
function ensureDebugDir() {
  if (!existsSync(DEBUG_CONFIG.debugDir)) {
    mkdirSync(DEBUG_CONFIG.debugDir, { recursive: true })
  }
}

/**
 * Store raw API response data for later analysis
 */
export function storeRawAPIResponse(
  endpoint: string,
  year: string,
  week: string | number,
  franchiseId: string | null,
  response: any
): void {
  if (!DEBUG_CONFIG.storeRawResponses) return
  
  try {
    ensureDebugDir()
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${endpoint}-${year}-W${week}${franchiseId ? `-${franchiseId}` : ''}-${timestamp}.json`
    const filepath = join(DEBUG_CONFIG.debugDir, filename)
    
    const debugData = {
      timestamp: new Date().toISOString(),
      endpoint,
      year,
      week,
      franchiseId,
      url: response.url || 'unknown',
      response: response.data || response
    }
    
    writeFileSync(filepath, JSON.stringify(debugData, null, 2))
    console.log(`[MFL-DEBUG] Raw response stored: ${filename}`)
  } catch (error) {
    console.error('[MFL-DEBUG] Failed to store raw response:', error)
  }
}

/**
 * Log detailed calculation debug information
 */
export function logCalculationDebug(debugInfo: CalculationDebugInfo): void {
  if (!DEBUG_CONFIG.enabled) return
  
  console.log(`\n=== MFL CALCULATION DEBUG: Franchise ${debugInfo.franchiseId} ===`)
  console.log(`Total Players: ${debugInfo.totalPlayers}`)
  console.log(`Starters: ${debugInfo.starters.length}, Bench: ${debugInfo.benchPlayers.length}, IR: ${debugInfo.irPlayers.length}, Taxi: ${debugInfo.taxiPlayers.length}`)
  console.log(`Starters Points: ${debugInfo.startersPoints.toFixed(2)}`)
  console.log(`Bench Points: ${debugInfo.benchPoints.toFixed(2)}`)
  console.log(`Potential Points: ${debugInfo.potentialPoints.toFixed(2)}`)
  
  // Log issues if any
  if (debugInfo.issues.length > 0) {
    console.log(`⚠️  ISSUES FOUND:`)
    debugInfo.issues.forEach(issue => console.log(`   - ${issue}`))
  }
  
  // Log starter details
  if (DEBUG_CONFIG.logLevel === 'debug' && debugInfo.starters.length > 0) {
    console.log('\n🟢 STARTERS:')
    debugInfo.starters.forEach(player => {
      console.log(`   ${player.position.padEnd(3)} ${player.name.padEnd(25)} ${player.score.toFixed(2).padStart(6)} pts`)
    })
  }
  
  // Log bench details  
  if (DEBUG_CONFIG.logLevel === 'debug' && debugInfo.benchPlayers.length > 0) {
    console.log('\n🔵 BENCH:')
    debugInfo.benchPlayers.forEach(player => {
      console.log(`   ${player.position.padEnd(3)} ${player.name.padEnd(25)} ${player.score.toFixed(2).padStart(6)} pts`)
    })
  }
  
  // Log IR/Taxi if any
  if (debugInfo.irPlayers.length > 0) {
    console.log(`\n🏥 INJURED RESERVE (${debugInfo.irPlayers.length}):`)
    debugInfo.irPlayers.forEach(player => {
      console.log(`   ${player.position.padEnd(3)} ${player.name}`)
    })
  }
  
  if (debugInfo.taxiPlayers.length > 0) {
    console.log(`\n🚕 TAXI SQUAD (${debugInfo.taxiPlayers.length}):`)
    debugInfo.taxiPlayers.forEach(player => {
      console.log(`   ${player.position.padEnd(3)} ${player.name}`)
    })
  }
  
  // Log optimal lineup for potential points
  if (DEBUG_CONFIG.logLevel === 'debug' && debugInfo.optimalLineup.length > 0) {
    console.log('\n⭐ OPTIMAL LINEUP:')
    debugInfo.optimalLineup.forEach(player => {
      console.log(`   ${player.position.padEnd(3)} ${player.name.padEnd(25)} ${player.score.toFixed(2).padStart(6)} pts`)
    })
  }
  
  console.log(`=== END DEBUG: Franchise ${debugInfo.franchiseId} ===\n`)
}

/**
 * Store detailed calculation debug report to file
 */
export function storeCalculationDebugReport(
  year: string,
  week: string | number,
  allFranchiseReports: CalculationDebugInfo[]
): void {
  if (!DEBUG_CONFIG.storeRawResponses) return
  
  try {
    ensureDebugDir()
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `calculation-debug-${year}-W${week}-${timestamp}.json`
    const filepath = join(DEBUG_CONFIG.debugDir, filename)
    
    const report = {
      timestamp: new Date().toISOString(),
      year,
      week,
      franchiseCount: allFranchiseReports.length,
      summary: {
        totalIssues: allFranchiseReports.reduce((sum, report) => sum + report.issues.length, 0),
        franchisesWithIssues: allFranchiseReports.filter(report => report.issues.length > 0).length
      },
      franchiseReports: allFranchiseReports
    }
    
    writeFileSync(filepath, JSON.stringify(report, null, 2))
    console.log(`[MFL-DEBUG] Calculation debug report stored: ${filename}`)
  } catch (error) {
    console.error('[MFL-DEBUG] Failed to store calculation debug report:', error)
  }
}

/**
 * Log comparison between app results and expected MFL values
 */
export function logMFLComparisonDebug(
  franchiseId: string,
  appValues: { bench: number; potential: number; starters: number },
  mflValues: { bench: number; potential: number; starters: number } | null
): void {
  if (!DEBUG_CONFIG.enabled) return
  
  console.log(`\n=== MFL COMPARISON: Franchise ${franchiseId} ===`)
  console.log(`                    App      MFL      Diff`)
  console.log(`Starters:      ${appValues.starters.toFixed(2).padStart(8)} ${(mflValues?.starters || 0).toFixed(2).padStart(8)} ${(appValues.starters - (mflValues?.starters || 0)).toFixed(2).padStart(8)}`)
  console.log(`Bench:         ${appValues.bench.toFixed(2).padStart(8)} ${(mflValues?.bench || 0).toFixed(2).padStart(8)} ${(appValues.bench - (mflValues?.bench || 0)).toFixed(2).padStart(8)}`)
  console.log(`Potential:     ${appValues.potential.toFixed(2).padStart(8)} ${(mflValues?.potential || 0).toFixed(2).padStart(8)} ${(appValues.potential - (mflValues?.potential || 0)).toFixed(2).padStart(8)}`)
  
  // Highlight significant differences
  const benchDiff = Math.abs(appValues.bench - (mflValues?.bench || 0))
  const potentialDiff = Math.abs(appValues.potential - (mflValues?.potential || 0))
  
  if (benchDiff > 1.0) {
    console.log(`⚠️  BENCH MISMATCH: ${benchDiff.toFixed(2)} point difference`)
  }
  if (potentialDiff > 1.0) {
    console.log(`⚠️  POTENTIAL MISMATCH: ${potentialDiff.toFixed(2)} point difference`)
  }
  
  console.log(`=== END COMPARISON: Franchise ${franchiseId} ===\n`)
}

/**
 * Log API endpoint timing and status information
 */
export function logAPITiming(
  endpoint: string,
  year: string,
  week: string | number,
  duration: number,
  status: 'success' | 'error' | 'rate_limited',
  error?: string
): void {
  if (!DEBUG_CONFIG.enabled) return
  
  const statusIcon = {
    success: '✅',
    error: '❌',  
    rate_limited: '⏳'
  }[status]
  
  console.log(`[MFL-API] ${statusIcon} ${endpoint} ${year}/W${week} - ${duration}ms${error ? ` - ${error}` : ''}`)
}

/**
 * Log weekly lineup data structure for debugging
 */
export function logWeeklyLineupDebug(
  franchiseId: string,
  week: number,
  starterIds: string[],
  allPlayerIds: string[]
): void {
  if (DEBUG_CONFIG.logLevel !== 'debug') return
  
  console.log(`\n--- WEEKLY LINEUP DEBUG: Franchise ${franchiseId}, Week ${week} ---`)
  console.log(`Starter IDs (${starterIds.length}): ${starterIds.join(', ')}`)
  console.log(`All Player IDs (${allPlayerIds.length}): ${allPlayerIds.join(', ')}`)
  console.log(`Non-starter count: ${allPlayerIds.length - starterIds.length}`)
  console.log('---')
}

/**
 * Create comprehensive validation report comparing app vs MFL values
 */
export function generateValidationReport(
  year: string, 
  week: string | number,
  comparisons: Array<{
    franchiseId: string
    appValues: { bench: number; potential: number; starters: number }
    mflValues: { bench: number; potential: number; starters: number } | null
  }>
): string {
  const report = []
  report.push(`MFL Data Validation Report`)
  report.push(`Year: ${year}, Week: ${week}`)
  report.push(`Generated: ${new Date().toISOString()}`)
  report.push('='.repeat(80))
  report.push('')
  
  let totalBenchErrors = 0
  let totalPotentialErrors = 0
  let franchisesWithErrors = 0
  
  comparisons.forEach(({ franchiseId, appValues, mflValues }) => {
    if (!mflValues) {
      report.push(`❌ Franchise ${franchiseId}: No MFL data available`)
      franchisesWithErrors++
      return
    }
    
    const benchDiff = Math.abs(appValues.bench - mflValues.bench)
    const potentialDiff = Math.abs(appValues.potential - mflValues.potential)
    const hasErrors = benchDiff > 0.5 || potentialDiff > 0.5
    
    if (hasErrors) franchisesWithErrors++
    
    const status = hasErrors ? '❌' : '✅'
    report.push(`${status} Franchise ${franchiseId}:`)
    report.push(`   Bench:     App=${appValues.bench.toFixed(2)}, MFL=${mflValues.bench.toFixed(2)}, Diff=${(appValues.bench - mflValues.bench).toFixed(2)}`)
    report.push(`   Potential: App=${appValues.potential.toFixed(2)}, MFL=${mflValues.potential.toFixed(2)}, Diff=${(appValues.potential - mflValues.potential).toFixed(2)}`)
    
    if (benchDiff > 0.5) totalBenchErrors++
    if (potentialDiff > 0.5) totalPotentialErrors++
    
    report.push('')
  })
  
  report.push('='.repeat(80))
  report.push('SUMMARY:')
  report.push(`Total franchises: ${comparisons.length}`)
  report.push(`Franchises with errors: ${franchisesWithErrors}`)
  report.push(`Bench calculation errors: ${totalBenchErrors}`)
  report.push(`Potential calculation errors: ${totalPotentialErrors}`)
  report.push(`Overall accuracy: ${((comparisons.length - franchisesWithErrors) / comparisons.length * 100).toFixed(1)}%`)
  
  return report.join('\n')
}

/**
 * Helper to format player list for logging
 */
export function formatPlayerList(
  players: PlayerCalculationInfo[],
  title: string,
  includeScores: boolean = true
): string[] {
  const lines = [`${title} (${players.length}):`]
  
  if (players.length === 0) {
    lines.push('   (none)')
    return lines
  }
  
  players.forEach(player => {
    const scoreStr = includeScores ? ` - ${player.score.toFixed(2)} pts` : ''
    lines.push(`   ${player.position.padEnd(3)} ${player.name}${scoreStr}`)
  })
  
  return lines
}