/**
 * Historical Data Import Script
 *
 * This script imports complete seasons (2023, 2024) into the database
 * Run with: npx tsx scripts/import-historical-data.ts
 */

import { DatabaseService, prisma } from '../lib/database'
import { fetchTeamsData } from '../lib/mfl'
import { fetchWeeklyResults } from '../lib/mfl-weekly-results'
import { getTotalWeeksForYear } from '../lib/season-config'
import { getOwnerName } from '../lib/owner-mappings'

// Import delay to avoid rate limiting
const IMPORT_DELAY = 4000 // 4 seconds between requests

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function importSeason(year: number) {
  console.log(`\n🔄 Starting import for ${year} season...`)

  try {
    // Check if season already exists
    const exists = await DatabaseService.seasonExists(year)
    if (exists) {
      console.log(`⏭️  Season ${year} already exists, skipping...`)
      return
    }

    // Create season record
    await DatabaseService.upsertSeason({
      year,
      leagueId: '46221',
      leagueName: 'Dynasty League',
      isActive: false,
      settings: { imported: true, importedAt: new Date().toISOString() }
    })

    console.log(`✅ Created season ${year} record`)

    // Fetch team data for the year
    console.log(`📊 Fetching team data for ${year}...`)
    const teamsData = await fetchTeamsData(year.toString())

    if (!teamsData || teamsData.length === 0) {
      throw new Error(`No team data found for ${year}`)
    }

    console.log(`📊 Found ${teamsData.length} teams for ${year}`)

    // Transform and insert teams
    const teams = teamsData.map(team => ({
      franchiseId: team.id,
      year,
      manager: team.manager,
      teamName: team.teamName,
      wins: team.wins || 0,
      losses: team.losses || 0,
      ties: team.ties || 0,
      pointsFor: team.pointsFor || team.totalPoints || 0,
      pointsAgainst: team.pointsAgainst || 0,
      totalPoints: team.totalPoints || 0,
      startersPoints: team.startersPoints || 0,
      benchPoints: team.benchPoints || 0,
      potentialPoints: team.potentialPoints || 0,
      efficiency: team.efficiency || 0,
      qbPoints: team.qbPoints || 0,
      rbPoints: team.rbPoints || 0,
      wrPoints: team.wrPoints || 0,
      tePoints: team.tePoints || 0,
      kPoints: team.kPoints || 0,
      dlPoints: team.dlPoints || 0,
      lbPoints: team.lbPoints || 0,
      cbPoints: team.cbPoints || 0,
      sPoints: team.sPoints || 0,
      offenseFlexPoints: team.offenseFlexPoints || 0,
      defenseFlexPoints: team.defenseFlexPoints || 0,
      offensePoints: team.offensePoints || 0,
      defensePoints: team.defensePoints || 0
    }))

    await DatabaseService.bulkInsertTeams(teams)
    console.log(`✅ Inserted ${teams.length} teams`)

    // Import weekly results
    const totalWeeks = getTotalWeeksForYear(year)
    console.log(`📅 Importing ${totalWeeks} weeks of data...`)

    const allWeeklyResults: any[] = []
    const allPositionalData: any[] = []

    for (let week = 1; week <= totalWeeks; week++) {
      try {
        console.log(`  📅 Week ${week}/${totalWeeks}...`)

        const weeklyResults = await fetchWeeklyResults(year, '46221', week)

        if (weeklyResults?.weeklyResults?.matchup) {
          const matchups = Array.isArray(weeklyResults.weeklyResults.matchup)
            ? weeklyResults.weeklyResults.matchup
            : [weeklyResults.weeklyResults.matchup]

          // Process each matchup
          matchups.forEach((matchup) => {
            if (matchup.franchise && Array.isArray(matchup.franchise) && matchup.franchise.length === 2) {
              const [team1, team2] = matchup.franchise

              const team1Score = parseFloat(team1.score || '0')
              const team2Score = parseFloat(team2.score || '0')

              // Skip if no scores (game not played)
              if (team1Score === 0 && team2Score === 0) return

              // Determine results
              let team1Result: 'W' | 'L' | 'T'
              let team2Result: 'W' | 'L' | 'T'

              if (team1Score > team2Score) {
                team1Result = 'W'
                team2Result = 'L'
              } else if (team2Score > team1Score) {
                team1Result = 'L'
                team2Result = 'W'
              } else {
                team1Result = 'T'
                team2Result = 'T'
              }

              // Add weekly results
              allWeeklyResults.push({
                year,
                week,
                franchiseId: team1.id,
                opponentId: team2.id,
                score: team1Score,
                opponentScore: team2Score,
                result: team1Result,
                isHomeTeam: true,
                mflFinalized: true, // Historical data is always finalized
                lastVerified: new Date()
              })

              allWeeklyResults.push({
                year,
                week,
                franchiseId: team2.id,
                opponentId: team1.id,
                score: team2Score,
                opponentScore: team1Score,
                result: team2Result,
                isHomeTeam: false,
                mflFinalized: true,
                lastVerified: new Date()
              })
            }
          })
        }

        // Add delay to avoid rate limiting
        await delay(IMPORT_DELAY)

      } catch (error) {
        console.warn(`    ⚠️  Error importing week ${week}: ${error}`)
        // Continue with next week
      }
    }

    // Bulk insert weekly results
    if (allWeeklyResults.length > 0) {
      await DatabaseService.bulkInsertWeeklyResults(allWeeklyResults)
      console.log(`✅ Inserted ${allWeeklyResults.length} weekly results`)
    }

    // Update team totals from weekly results
    await DatabaseService.updateTeamTotals(year)
    console.log(`✅ Updated team season totals`)

    console.log(`🎉 Successfully imported ${year} season!`)

  } catch (error) {
    console.error(`❌ Error importing ${year} season:`, error)
    throw error
  }
}

async function main() {
  console.log('🚀 Starting historical data import...')

  try {
    // Import historical seasons
    const historicalYears = [2023, 2024]

    for (const year of historicalYears) {
      await importSeason(year)
    }

    console.log('\n🎉 Historical data import completed successfully!')
    console.log('\n📊 Database summary:')

    for (const year of historicalYears) {
      const freshness = await DatabaseService.getDataFreshness(year)
      if (freshness) {
        console.log(`  ${year}: ${freshness.counts.teams} teams, ${freshness.counts.weeklyResults} weekly results`)
      }
    }

  } catch (error) {
    console.error('❌ Import failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the import
if (require.main === module) {
  main()
}