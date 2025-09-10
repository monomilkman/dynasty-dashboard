// MFL Web Scraper for detailed scoring data
// This scrapes the public MFL pages to get scoring breakdowns not available via API

import * as cheerio from 'cheerio'

export interface DetailedScoring {
  franchiseId: string
  teamName: string
  startersPoints: number
  benchPoints: number
  offensePoints: number
  defensePoints: number
  totalPoints: number
  potentialPoints: number
}

export async function scrapeDetailedScoring(leagueId: string, year: number): Promise<DetailedScoring[]> {
  try {
    console.log(`Scraping detailed MFL scoring for league ${leagueId}, year ${year}`)
    
    // In serverless environments, disable scraping for now to avoid timeouts
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      console.log('Skipping web scraping in production/serverless environment')
      return []
    }
    
    const scoringData: DetailedScoring[] = []
    
    // Get franchise information from the main league page first
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
    
    // Extract franchise information from JavaScript
    const franchiseData: { [key: string]: string } = {}
    const franchiseIds: string[] = []
    const scriptContent = leagueHtml.match(/franchiseDatabase\[.*?\] = new Franchise\(.*?\);/g)
    
    if (scriptContent) {
      scriptContent.forEach(line => {
        const match = line.match(/franchiseDatabase\['fid_(\d+)'\] = new Franchise\('(\d+)', '([^']+)'/)
        if (match) {
          const [, , franchiseId, teamName] = match
          if (franchiseId !== '0000') { // Skip commissioner
            franchiseData[franchiseId] = teamName
            franchiseIds.push(franchiseId)
          }
        }
      })
    }
    
    console.log(`Found ${franchiseIds.length} franchises to scrape: ${franchiseIds.join(', ')}`)
    
    // Scrape each team's individual scoring history page
    for (const franchiseId of franchiseIds) {
      try {
        const teamUrl = `https://www45.myfantasyleague.com/${year}/options?L=${leagueId}&O=118&FRANCHISE_ID=${franchiseId}`
        console.log(`Scraping team ${franchiseId} (${franchiseData[franchiseId]}) from: ${teamUrl}`)
        
        const teamResponse = await fetch(teamUrl, {
          headers: {
            'User-Agent': process.env.MFL_USER_AGENT || 'dynasty-dashboard',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          }
        })
        
        if (!teamResponse.ok) {
          console.warn(`Failed to fetch team ${franchiseId}: ${teamResponse.status}`)
          continue
        }
        
        const teamHtml = await teamResponse.text()
        const $ = cheerio.load(teamHtml)
        
        // Look for the scoring summary rows at the bottom of the table
        // These are typically labeled as "STARTER POINTS:", "NON-STARTER POINTS:", etc.
        let startersPoints = 0
        let benchPoints = 0
        let offensePoints = 0
        let defensePoints = 0
        let totalPoints = 0
        let potentialPoints = 0
        
        // Find the summary rows by looking for specific text patterns
        $('th').each((i, cell) => {
          const $cell = $(cell)
          const cellText = $cell.text().trim()
          
          // Look for YTD column data (year-to-date totals) - use exact match for the header cell
          // NOTE: Based on user clarification, "Starter Points:" row contains Non-Starter Points
          if (cellText === 'Starter Points:') {
            const row = $cell.parent()
            const ytdCells = row.find('td.points')
            const ytdValue = ytdCells.eq(-2).text().trim() // Second to last column (YTD)
            benchPoints = parseFloat(ytdValue) || 0  // This is actually bench/non-starter points
            console.log(`Found Non-Starter Points (labeled as Starter) YTD: ${benchPoints} from ${ytdValue}`)
          } else if (cellText === 'Non-Starter Points:') {
            const row = $cell.parent()
            const ytdCells = row.find('td.points')
            const ytdValue = ytdCells.eq(-2).text().trim() // Second to last column (YTD)
            benchPoints = parseFloat(ytdValue) || 0
            console.log(`Found Non-Starter Points YTD: ${benchPoints} from ${ytdValue}`)
          } else if (cellText === 'Offensive Points:') {
            const row = $cell.parent()
            const ytdCells = row.find('td.points')
            const ytdValue = ytdCells.eq(-2).text().trim() // Second to last column (YTD)
            offensePoints = parseFloat(ytdValue) || 0
            console.log(`Found Offensive Points YTD: ${offensePoints} from ${ytdValue}`)
          } else if (cellText === 'Defensive Points:') {
            const row = $cell.parent()
            const ytdCells = row.find('td.points')
            const ytdValue = ytdCells.eq(-2).text().trim() // Second to last column (YTD)
            defensePoints = parseFloat(ytdValue) || 0
            console.log(`Found Defensive Points YTD: ${defensePoints} from ${ytdValue}`)
          } else if (cellText === 'Total Points:') {
            const row = $cell.parent()
            const ytdCells = row.find('td.points')
            const ytdValue = ytdCells.eq(-2).text().trim() // Second to last column (YTD)
            totalPoints = parseFloat(ytdValue) || 0
            console.log(`Found Total Points YTD: ${totalPoints} from ${ytdValue}`)
          } else if (cellText === 'Potential Points:') {
            const row = $cell.parent()
            const ytdCells = row.find('td.points')
            const ytdValue = ytdCells.eq(-2).text().trim() // Second to last column (YTD)
            potentialPoints = parseFloat(ytdValue) || 0
            console.log(`Found Potential Points YTD: ${potentialPoints} from ${ytdValue}`)
          }
        })
        
        // CORRECTED LOGIC: Starters should equal Total Points (both represent starter points)
        // Total Points = points from all starters (offensive + defensive)
        // Starter Points = points from all starters (same as Total)
        startersPoints = totalPoints
        console.log(`Starter Points = Total Points = ${startersPoints}`)
        
        // Bench Points are the non-starter points we found above
        
        // If we found meaningful data, add it to results
        if (startersPoints > 0 || totalPoints > 0) {
          scoringData.push({
            franchiseId,
            teamName: franchiseData[franchiseId] || `Team ${franchiseId}`,
            startersPoints,
            benchPoints,
            offensePoints,
            defensePoints,
            totalPoints,
            potentialPoints,
          })
          
          console.log(`Team ${franchiseId}: S=${startersPoints}, B=${benchPoints}, O=${offensePoints}, D=${defensePoints}, T=${totalPoints}, P=${potentialPoints}`)
        } else {
          console.warn(`No scoring data found for team ${franchiseId}`)
        }
        
        // Add a small delay to be respectful to MFL servers
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (teamError) {
        console.error(`Error scraping team ${franchiseId}:`, teamError)
        continue
      }
    }
    
    console.log(`Successfully scraped ${scoringData.length} teams from MFL pages`)
    return scoringData
    
  } catch (error) {
    console.error('Error scraping MFL pages:', error)
    throw error
  }
}

// Test function to examine the HTML structure
export async function analyzeMLFPage(leagueId: string, year: number): Promise<void> {
  try {
    const url = `https://www45.myfantasyleague.com/${year}/options?L=${leagueId}&O=118`
    console.log(`Analyzing MFL page structure: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': process.env.MFL_USER_AGENT || 'dynasty-dashboard',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    console.log('Page title:', $('title').text())
    console.log('Page length:', html.length, 'characters')
    
    // Look for JavaScript content that might contain the scoring data
    console.log('\nAnalyzing JavaScript content:')
    $('script').each((i, script) => {
      const scriptContent = $(script).html()
      if (scriptContent && (scriptContent.includes('franchiseDatabase') || scriptContent.includes('scoring') || scriptContent.includes('189.66'))) {
        console.log(`Script ${i} contains potential data:`)
        console.log(scriptContent.substring(0, 500))
      }
    })
    
    // Look for divs that might be populated by JavaScript
    console.log('\nLooking for main content containers:')
    $('div[id], div[class*="content"], div[class*="main"], div[class*="body"]').each((i, element) => {
      const $el = $(element)
      const text = $el.text().trim()
      
      if (text.length > 100) {
        console.log(`Content div ${i}:`)
        console.log('ID:', $el.attr('id'))
        console.log('Class:', $el.attr('class'))
        console.log('Text preview:', text.substring(0, 300))
        
        // Check if it has any tables
        const tables = $el.find('table')
        if (tables.length > 0) {
          console.log(`  Contains ${tables.length} table(s)`)
          
          tables.each((tableIndex, table) => {
            const $table = $(table)
            const tableText = $table.text()
            
            // Look for scoring-related keywords
            if (tableText.includes('STARTER') || tableText.includes('TOTAL') || tableText.includes('POINTS') || 
                tableText.includes('189') || tableText.includes('205') || tableText.includes('216')) {
              console.log(`    Table ${tableIndex} contains scoring data:`)
              
              const headers = $table.find('tr').first().find('td, th').map((j, el) => $(el).text().trim()).get()
              console.log('    Headers:', headers)
              
              // Show first few data rows
              $table.find('tr').slice(1, 4).each((rowIndex, row) => {
                const cells = $(row).find('td').map((j, el) => $(el).text().trim()).get()
                if (cells.length > 2) {
                  console.log(`    Row ${rowIndex + 1}:`, cells.slice(0, 10))
                }
              })
            }
          })
        }
      }
    })
    
    // Search for specific scoring numbers that user provided in screenshots
    console.log('\nSearching for specific scoring values (189.66, 205.7, 216.56):')
    const scoringValues = ['189.66', '205.7', '216.56', '150.82', '158.47', '152.08', '82.16', '53.2', '78.56', '107.5', '152.5', '138']
    
    scoringValues.forEach(value => {
      if (html.includes(value)) {
        console.log(`Found value ${value} in HTML`)
        
        // Find the context around this value
        const index = html.indexOf(value)
        const contextStart = Math.max(0, index - 200)
        const contextEnd = Math.min(html.length, index + 200)
        const context = html.substring(contextStart, contextEnd)
        
        console.log(`Context around ${value}:`)
        console.log(context)
        console.log('---')
      }
    })
    
    // Look for all tables more systematically
    console.log(`\nFound ${$('table').length} tables total:`)
    $('table').each((i, table) => {
      const $table = $(table)
      const tableText = $table.text()
      
      console.log(`Table ${i}:`)
      if (tableText.length > 50) {
        const headers = $table.find('tr').first().find('td, th').map((j, el) => $(el).text().trim()).get()
        console.log('  Headers:', headers)
        
        const firstRowCells = $table.find('tr').eq(1).find('td').map((j, el) => $(el).text().trim()).get()
        console.log('  First data row:', firstRowCells.slice(0, 8))
      } else {
        console.log('  Small table, text:', tableText.substring(0, 100))
      }
    })
    
  } catch (error) {
    console.error('Error analyzing MFL page:', error)
  }
}