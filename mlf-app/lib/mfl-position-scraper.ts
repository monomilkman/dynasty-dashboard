// MFL Position Scraper for detailed player-by-player scoring data
// This scrapes the team roster pages to get positional breakdowns

import * as cheerio from 'cheerio'
import { getOwnerName } from './owner-mappings'
import { fetchAllWeeklyResults, calculateAccuratePositionTotals, WeeklyLineup } from './mfl-weekly-results'

export interface PlayerWeeklyData {
  playerName: string
  position: string
  nflTeam: string
  weeklyScores: {
    week: number
    points: number
    started: boolean
    status: 'active' | 'bye' | 'injured' | 'not-rostered'
  }[]
  ytdPoints: number
  avgPoints: number
  gamesStarted: number
}

export interface PositionTotals {
  QB: number
  RB: number
  WR: number
  TE: number
  K: number
  DL: number
  LB: number
  CB: number
  S: number
  'O-Flex': number  // Offensive flex (RB/WR/TE)
  'D-Flex': number  // Defensive flex (DL/LB/CB/S)
}

export interface TeamPositionalData {
  franchiseId: string
  teamName: string
  manager: string
  year: number
  players: PlayerWeeklyData[]
  positionTotals: PositionTotals
  weeklyLineups: {
    week: number
    starters: { position: string, player: string, points: number }[]
  }[]
}

export interface LeaguePositionalData {
  teams: TeamPositionalData[]
  leagueSettings: {
    year: number
    leagueId?: string
    rosterRequirements: {
      QB: number
      RB: number
      WR: number
      TE: number
      'O-Flex': number
      K: number
      DL: number
      LB: number
      CB: number
      S: number
      'D-Flex': number
    }
  }
  positionRankings: {
    [position: string]: {
      franchiseId: string
      teamName: string
      points: number
      rank: number
    }[]
  }
  error?: string
  message?: string
}

// League roster requirements by year
const ROSTER_REQUIREMENTS = {
  2024: { QB: 1, RB: 2, WR: 2, TE: 1, 'O-Flex': 1, K: 1, DL: 2, LB: 3, CB: 2, S: 2, 'D-Flex': 1 },
  2025: { QB: 1, RB: 2, WR: 2, TE: 1, 'O-Flex': 1, K: 1, DL: 2, LB: 3, CB: 2, S: 2, 'D-Flex': 1 },
  // Previous years may have different requirements - add as needed
  2023: { QB: 1, RB: 2, WR: 2, TE: 1, 'O-Flex': 1, K: 1, DL: 2, LB: 3, CB: 2, S: 2, 'D-Flex': 1 },
  2022: { QB: 1, RB: 2, WR: 2, TE: 1, 'O-Flex': 1, K: 1, DL: 2, LB: 3, CB: 2, S: 2, 'D-Flex': 1 },
  2021: { QB: 1, RB: 2, WR: 2, TE: 1, 'O-Flex': 1, K: 1, DL: 2, LB: 3, CB: 2, S: 2, 'D-Flex': 1 }
}

/**
 * Parse player name string from MFL format: "LastName, FirstName Team POS"
 */
function parsePlayerName(nameStr: string): { name: string, nflTeam: string, position: string } {
  // Example: "Smith, John DAL RB" or "Brown, A.J. PHI WR"
  const match = nameStr.match(/^(.+?)\s+([A-Z]{2,4})\s+([A-Z]{1,3})$/)
  
  if (match) {
    const [, name, nflTeam, position] = match
    return { name: name.trim(), nflTeam, position }
  }
  
  // Fallback parsing if format doesn't match
  const parts = nameStr.trim().split(/\s+/)
  if (parts.length >= 3) {
    const position = parts[parts.length - 1]
    const nflTeam = parts[parts.length - 2]
    const name = parts.slice(0, -2).join(' ')
    return { name, nflTeam, position }
  }
  
  return { name: nameStr, nflTeam: '', position: '' }
}

/**
 * Parse weekly score cell to extract points, started status, and player status
 */
function parseWeeklyScore(cellHtml: string): { points: number, started: boolean, status: 'active' | 'bye' | 'injured' | 'not-rostered' } {
  const $ = cheerio.load(cellHtml)
  const cellText = $.text().trim()
  
  // Handle special cases
  if (cellText === 'X') return { points: 0, started: false, status: 'not-rostered' }
  if (cellText === 'B') return { points: 0, started: false, status: 'bye' }
  if (cellText.includes('IR')) return { points: 0, started: false, status: 'injured' }
  
  // Extract points (could be "12.5" or "12.5S" for starter)
  const pointsMatch = cellText.match(/([\d.-]+)/)
  const points = pointsMatch ? parseFloat(pointsMatch[1]) : 0
  
  // Check for starter designation (superscript S)
  const started = cellText.includes('S') || $(cellHtml).find('sup').text().includes('S')
  
  return { points, started, status: 'active' }
}

/**
 * Scrape positional data for a single team
 */
export async function scrapeTeamPositionalData(
  leagueId: string, 
  year: number, 
  franchiseId: string, 
  teamName: string, 
  manager: string
): Promise<TeamPositionalData> {
  const teamUrl = `https://www45.myfantasyleague.com/${year}/options?L=${leagueId}&O=118&FRANCHISE_ID=${franchiseId}`
  
  console.log(`Scraping positional data for team ${franchiseId} (${teamName})`)
  
  const response = await fetch(teamUrl, {
    headers: {
      'User-Agent': process.env.MFL_USER_AGENT || 'dynasty-dashboard',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  })
  
  if (!response.ok) {
    throw new Error(`Failed to fetch team ${franchiseId}: ${response.status}`)
  }
  
  const html = await response.text()
  const $ = cheerio.load(html)
  
  const players: PlayerWeeklyData[] = []
  const weeklyLineups: TeamPositionalData['weeklyLineups'] = []
  
  // Find the main data table - look for multiple possible indicators
  let mainTable = $('table').filter((i, table) => {
    const tableText = $(table).text()
    // Look for key indicators of the player data table
    return (tableText.includes('YTD') && tableText.includes('AVG')) || 
           (tableText.includes('Week') && tableText.includes('Points')) ||
           tableText.length > 1000
  }).first()
  
  // If we didn't find it, try to find the largest table
  if (mainTable.length === 0) {
    console.log(`Trying to find largest table for team ${franchiseId}`)
    let largestTable = null
    let maxLength = 0
    
    $('table').each((i, table) => {
      const tableText = $(table).text()
      if (tableText.length > maxLength) {
        maxLength = tableText.length
        largestTable = table
      }
    })
    
    if (largestTable) {
      mainTable = $(largestTable)
      console.log(`Using largest table with ${maxLength} characters for team ${franchiseId}`)
    }
  }
  
  if (mainTable.length === 0) {
    console.warn(`No player data table found for team ${franchiseId} - no tables matched criteria`)
    
    return {
      franchiseId,
      teamName,
      manager,
      year,
      players: [],
      positionTotals: {
        QB: 0, RB: 0, WR: 0, TE: 0, K: 0,
        DL: 0, LB: 0, CB: 0, S: 0,
        'O-Flex': 0, 'D-Flex': 0
      },
      weeklyLineups: []
    }
  }
  
  // Get header row to identify week columns
  const headerRow = mainTable.find('tr').first()
  const headers = headerRow.find('td, th').map((i, cell) => $(cell).text().trim()).get()
  
  // Identify week columns (should be numbers between headers)
  const weekColumns: number[] = []
  headers.forEach((header, index) => {
    const weekNum = parseInt(header)
    if (!isNaN(weekNum) && weekNum >= 1 && weekNum <= 18) {
      weekColumns.push(index)
    }
  })
  
  // Find YTD and AVG column indices - they are actual header columns
  const ytdColumnIndex = headers.findIndex(h => h === 'YTD')
  const avgColumnIndex = headers.findIndex(h => h === 'Avg')
  
  console.log(`Found ${weekColumns.length} week columns, YTD at index ${ytdColumnIndex}, AVG at index ${avgColumnIndex}`)
  
  // Process each player row
  let playerCount = 0
  mainTable.find('tr').slice(1).each((rowIndex, row) => {
    const cells = $(row).find('td')
    if (cells.length < 3) return // Skip rows without enough data
    
    // First column should be player name
    const nameCell = cells.eq(0).text().trim()
    if (!nameCell || nameCell.includes('TOTAL') || nameCell.includes('STARTER') || nameCell.includes('Points:')) return
    
    // Debug first few rows
    // Only log first row for basic validation
    if (playerCount === 0) {
      console.log(`Team ${franchiseId} first player: "${nameCell}"`)
    }
    
    const { name, nflTeam, position } = parsePlayerName(nameCell)
    if (!name || !position) return
    
    // Parse weekly scores
    const weeklyScores: PlayerWeeklyData['weeklyScores'] = []
    let gamesStarted = 0
    
    weekColumns.forEach((columnIndex, weekNumber) => {
      if (columnIndex < cells.length) {
        const cellHtml = cells.eq(columnIndex).html() || ''
        const weekData = parseWeeklyScore(cellHtml)
        
        weeklyScores.push({
          week: weekNumber + 1,
          ...weekData
        })
        
        if (weekData.started) gamesStarted++
      }
    })
    
    // Parse YTD and AVG
    const ytdPoints = ytdColumnIndex >= 0 && ytdColumnIndex < cells.length 
      ? parseFloat(cells.eq(ytdColumnIndex).text().trim()) || 0 
      : 0
      
    const avgPoints = avgColumnIndex >= 0 && avgColumnIndex < cells.length 
      ? parseFloat(cells.eq(avgColumnIndex).text().trim()) || 0 
      : 0
    
    players.push({
      playerName: name,
      position,
      nflTeam,
      weeklyScores,
      ytdPoints,
      avgPoints,
      gamesStarted
    })
    
    playerCount++
  })
  
  console.log(`Team ${franchiseId}: Parsed ${players.length} players`)
  
  // Calculate position totals and weekly lineups
  const positionTotals = calculatePositionTotals(players)
  const weeklyLineupsData = calculateWeeklyLineups(players, weekColumns.length)
  
  return {
    franchiseId,
    teamName,
    manager,
    year,
    players,
    positionTotals,
    weeklyLineups: weeklyLineupsData
  }
}

/**
 * Calculate total points by position for starters, properly handling flex spots
 * Roster: 1 QB, 2 RB, 2 WR, 1 TE, 1 O-Flex(RB/WR/TE), 1 K, 2 DL, 3 LB, 2 CB, 2 S, 1 D-Flex(DL/LB/CB/S)
 */
function calculatePositionTotals(players: PlayerWeeklyData[]): PositionTotals {
  const totals: PositionTotals = {
    QB: 0, RB: 0, WR: 0, TE: 0, 'O-Flex': 0, K: 0,
    DL: 0, LB: 0, CB: 0, S: 0, 'D-Flex': 0
  }
  
  // Get all weeks that have starters
  const allWeeks = [...new Set(players.flatMap(p => 
    p.weeklyScores.filter(w => w.started).map(w => w.week)
  ))].sort((a, b) => a - b)
  
  allWeeks.forEach(week => {
    // Get all starters for this week
    const weekStarters = players.map(player => ({
      player,
      weekData: player.weeklyScores.find(w => w.week === week && w.started)
    })).filter(item => item.weekData)
    
    // Group by position
    const startersByPos = {
      QB: weekStarters.filter(s => s.player.position === 'QB'),
      RB: weekStarters.filter(s => s.player.position === 'RB'),
      WR: weekStarters.filter(s => s.player.position === 'WR'),
      TE: weekStarters.filter(s => s.player.position === 'TE'),
      K: weekStarters.filter(s => s.player.position === 'PK'), // PK is the actual position for Kickers
      DL: weekStarters.filter(s => ['DT', 'DE', 'DL'].includes(s.player.position)),
      LB: weekStarters.filter(s => s.player.position === 'LB'),
      CB: weekStarters.filter(s => s.player.position === 'CB'),
      S: weekStarters.filter(s => s.player.position === 'S')
    }
    
    // Required positions (sort by points to get best performers)
    const sortByPoints = (a: any, b: any) => (b.weekData?.points || 0) - (a.weekData?.points || 0)
    
    // Add base position points
    totals.QB += startersByPos.QB.slice(0, 1).reduce((sum, s) => sum + (s.weekData?.points || 0), 0)
    totals.RB += startersByPos.RB.slice(0, 2).reduce((sum, s) => sum + (s.weekData?.points || 0), 0)
    totals.WR += startersByPos.WR.slice(0, 2).reduce((sum, s) => sum + (s.weekData?.points || 0), 0)
    totals.TE += startersByPos.TE.slice(0, 1).reduce((sum, s) => sum + (s.weekData?.points || 0), 0)
    totals.K += startersByPos.K.slice(0, 1).reduce((sum, s) => sum + (s.weekData?.points || 0), 0)
    totals.DL += startersByPos.DL.slice(0, 2).reduce((sum, s) => sum + (s.weekData?.points || 0), 0)
    totals.LB += startersByPos.LB.slice(0, 3).reduce((sum, s) => sum + (s.weekData?.points || 0), 0)
    totals.CB += startersByPos.CB.slice(0, 2).reduce((sum, s) => sum + (s.weekData?.points || 0), 0)
    totals.S += startersByPos.S.slice(0, 2).reduce((sum, s) => sum + (s.weekData?.points || 0), 0)
    
    // Calculate flex positions (extra starters beyond required spots)
    const oFlexCandidates = [
      ...startersByPos.RB.slice(2), // Extra RBs beyond required 2
      ...startersByPos.WR.slice(2), // Extra WRs beyond required 2  
      ...startersByPos.TE.slice(1)  // Extra TEs beyond required 1
    ].sort(sortByPoints)
    
    const dFlexCandidates = [
      ...startersByPos.DL.slice(2), // Extra DLs beyond required 2
      ...startersByPos.LB.slice(3), // Extra LBs beyond required 3
      ...startersByPos.CB.slice(2), // Extra CBs beyond required 2
      ...startersByPos.S.slice(2)   // Extra Ss beyond required 2
    ].sort(sortByPoints)
    
    // Add flex points (best flex starter for each position)
    totals['O-Flex'] += oFlexCandidates.slice(0, 1).reduce((sum, s) => sum + (s.weekData?.points || 0), 0)
    totals['D-Flex'] += dFlexCandidates.slice(0, 1).reduce((sum, s) => sum + (s.weekData?.points || 0), 0)
  })
  
  return totals
}

/**
 * Calculate weekly lineups (which players started each week)
 */
function calculateWeeklyLineups(players: PlayerWeeklyData[], totalWeeks: number): TeamPositionalData['weeklyLineups'] {
  const weeklyLineups: TeamPositionalData['weeklyLineups'] = []
  
  for (let week = 1; week <= totalWeeks; week++) {
    const starters: { position: string, player: string, points: number }[] = []
    
    players.forEach(player => {
      const weekData = player.weeklyScores.find(w => w.week === week)
      if (weekData && weekData.started) {
        starters.push({
          position: player.position,
          player: player.playerName,
          points: weekData.points
        })
      }
    })
    
    if (starters.length > 0) {
      weeklyLineups.push({ week, starters })
    }
  }
  
  return weeklyLineups
}

/**
 * Main function to scrape positional data for entire league
 */
export async function scrapeLeaguePositionalData(
  leagueId: string, 
  year: number,
  weekFilter?: number[]
): Promise<LeaguePositionalData> {
  console.log(`Starting league positional data scrape for ${year}`)
  
  // First, get all team information
  const leagueUrl = `https://www45.myfantasyleague.com/${year}/options?L=${leagueId}&O=118`
  const leagueResponse = await fetch(leagueUrl, {
    headers: {
      'User-Agent': process.env.MFL_USER_AGENT || 'dynasty-dashboard',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  })
  
  if (!leagueResponse.ok) {
    throw new Error(`Failed to fetch league page: ${leagueResponse.status}`)
  }
  
  const leagueHtml = await leagueResponse.text()
  
  // Extract franchise information
  const franchiseData: { [key: string]: { name: string, manager: string } } = {}
  const franchiseIds: string[] = []
  
  const scriptContent = leagueHtml.match(/franchiseDatabase\[.*?\] = new Franchise\(.*?\);/g)
  if (scriptContent) {
    scriptContent.forEach(line => {
      const match = line.match(/franchiseDatabase\['fid_(\d+)'\] = new Franchise\('(\d+)', '([^']+)'/)
      if (match) {
        const [, , franchiseId, teamName] = match
        if (franchiseId !== '0000') { // Skip commissioner
          franchiseData[franchiseId] = { name: teamName, manager: getOwnerName(franchiseId, year) }
          franchiseIds.push(franchiseId)
        }
      }
    })
  }
  
  console.log(`Found ${franchiseIds.length} teams to scrape: ${franchiseIds.join(', ')}`)
  
  // Scrape each team's data with controlled concurrency
  const teams: TeamPositionalData[] = []
  const concurrencyLimit = 3
  
  for (let i = 0; i < franchiseIds.length; i += concurrencyLimit) {
    const batch = franchiseIds.slice(i, i + concurrencyLimit)
    
    const batchPromises = batch.map(async (franchiseId) => {
      try {
        const franchise = franchiseData[franchiseId]
        return await scrapeTeamPositionalData(
          leagueId, 
          year, 
          franchiseId, 
          franchise.name, 
          franchise.manager
        )
      } catch (error) {
        console.error(`Failed to scrape team ${franchiseId}:`, error)
        // Return empty data structure for failed teams
        return {
          franchiseId,
          teamName: franchiseData[franchiseId]?.name || `Team ${franchiseId}`,
          manager: franchiseData[franchiseId]?.manager || getOwnerName(franchiseId, year),
          year,
          players: [],
          positionTotals: {
            QB: 0, RB: 0, WR: 0, TE: 0, K: 0,
            DL: 0, LB: 0, CB: 0, S: 0,
            'O-Flex': 0, 'D-Flex': 0
          },
          weeklyLineups: []
        }
      }
    })
    
    const batchResults = await Promise.all(batchPromises)
    teams.push(...batchResults)
    
    // Add delay between batches to be respectful to MFL servers
    if (i + concurrencyLimit < franchiseIds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  // Fetch official weekly lineup data and recalculate accurate position totals
  console.log('Fetching official weekly lineup data for accurate position calculations...')
  const weeklyLineups = await fetchAllWeeklyResults(year, leagueId)
  
  // Update each team's position totals with accurate calculations
  teams.forEach(team => {
    const accuratePositionTotals = calculateAccuratePositionTotals(weeklyLineups, team.franchiseId, weekFilter)
    team.positionTotals = accuratePositionTotals
    console.log(`Team ${team.franchiseId} updated position totals:`, accuratePositionTotals)
  })
  
  // Calculate position rankings
  const positionRankings = calculatePositionRankings(teams)
  
  console.log(`Successfully scraped positional data for ${teams.length} teams`)
  
  return {
    teams,
    leagueSettings: {
      year,
      rosterRequirements: (ROSTER_REQUIREMENTS as any)[year] || ROSTER_REQUIREMENTS[2024]
    },
    positionRankings
  }
}

/**
 * Calculate rankings for each position
 */
function calculatePositionRankings(teams: TeamPositionalData[]): LeaguePositionalData['positionRankings'] {
  const positions: (keyof PositionTotals)[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S', 'O-Flex', 'D-Flex']
  const rankings: LeaguePositionalData['positionRankings'] = {}
  
  positions.forEach(position => {
    const positionData = teams.map(team => ({
      franchiseId: team.franchiseId,
      teamName: team.teamName,
      points: team.positionTotals[position]
    })).sort((a, b) => b.points - a.points)
    
    rankings[position] = positionData.map((team, index) => ({
      ...team,
      rank: index + 1
    }))
  })
  
  return rankings
}