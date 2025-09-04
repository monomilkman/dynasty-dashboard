import { NextRequest, NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const franchiseId = searchParams.get('franchiseId') || '0001'
  
  try {
    const url = `https://www45.myfantasyleague.com/2024/options?L=46221&O=118&FRANCHISE_ID=${franchiseId}`
    console.log(`Debugging scrape for: ${url}`)
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'dynasty-dashboard',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`)
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    const results: any = {}
    
    // Find all rows that contain scoring summary
    $('td, th').each((i, cell) => {
      const $cell = $(cell)
      const cellText = $cell.text().trim()
      
      if (cellText.includes('Starter Points:')) {
        const row = $cell.parent()
        const allCells = row.find('td').map((i, el) => $(el).text().trim()).get()
        const pointsCells = row.find('td.points').map((i, el) => $(el).text().trim()).get()
        
        results.starterPoints = {
          allCells: allCells,
          pointsCells: pointsCells,
          lastTwoPointsCells: pointsCells.slice(-2)
        }
      } else if (cellText.includes('Non-Starter Points:')) {
        const row = $cell.parent()
        const allCells = row.find('td').map((i, el) => $(el).text().trim()).get()
        const pointsCells = row.find('td.points').map((i, el) => $(el).text().trim()).get()
        
        results.nonStarterPoints = {
          allCells: allCells,
          pointsCells: pointsCells,
          lastTwoPointsCells: pointsCells.slice(-2)
        }
      } else if (cellText.includes('Total Points:')) {
        const row = $cell.parent()
        const allCells = row.find('td').map((i, el) => $(el).text().trim()).get()
        const pointsCells = row.find('td.points').map((i, el) => $(el).text().trim()).get()
        
        results.totalPoints = {
          allCells: allCells,
          pointsCells: pointsCells,
          lastTwoPointsCells: pointsCells.slice(-2)
        }
      } else if (cellText.includes('Potential Points:')) {
        const row = $cell.parent()
        const allCells = row.find('td').map((i, el) => $(el).text().trim()).get()
        const pointsCells = row.find('td.points').map((i, el) => $(el).text().trim()).get()
        
        results.potentialPoints = {
          allCells: allCells,
          pointsCells: pointsCells,
          lastTwoPointsCells: pointsCells.slice(-2)
        }
      } else if (cellText.includes('Offensive Points:')) {
        const row = $cell.parent()
        const allCells = row.find('td').map((i, el) => $(el).text().trim()).get()
        const pointsCells = row.find('td.points').map((i, el) => $(el).text().trim()).get()
        
        results.offensivePoints = {
          allCells: allCells,
          pointsCells: pointsCells,
          lastTwoPointsCells: pointsCells.slice(-2)
        }
      } else if (cellText.includes('Defensive Points:')) {
        const row = $cell.parent()
        const allCells = row.find('td').map((i, el) => $(el).text().trim()).get()
        const pointsCells = row.find('td.points').map((i, el) => $(el).text().trim()).get()
        
        results.defensivePoints = {
          allCells: allCells,
          pointsCells: pointsCells,
          lastTwoPointsCells: pointsCells.slice(-2)
        }
      }
    })
    
    return NextResponse.json(results)
    
  } catch (error) {
    console.error('Error debugging scrape:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to debug scrape',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}