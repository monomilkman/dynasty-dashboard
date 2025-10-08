'use client'

import { useState, useEffect, useMemo } from 'react'
import type { StandingsFranchise } from '@/app/api/mfl/standings/route'
import type { DivisionsData } from '@/app/api/mfl/divisions/route'
import type { TeamSchedule } from '@/app/api/mfl/schedule-remaining/route'
import { calculatePlayoffProbabilities, getPlayoffPicture, type PlayoffProbabilities } from '@/lib/playoff-calculator'
import { batchUpdateSnapshots, getProbabilityChange } from '@/lib/playoff-history'
import TeamDetailModal from './TeamDetailModal'

interface PlayoffProjectionsProps {
  year: number
}

export default function PlayoffProjections({ year }: PlayoffProjectionsProps) {
  const [standings, setStandings] = useState<StandingsFranchise[]>([])
  const [divisions, setDivisions] = useState<DivisionsData | null>(null)
  const [schedules, setSchedules] = useState<TeamSchedule[]>([])
  const [currentWeek, setCurrentWeek] = useState<number>(1)
  const [probabilities, setProbabilities] = useState<PlayoffProbabilities[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [probabilityChanges, setProbabilityChanges] = useState<Record<string, number | null>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  /**
   * Backfill historical playoff probability data using matchups API
   * Reconstructs standings week-by-week and runs simulations for each
   */
  const backfillPlayoffHistoryFromMatchups = async (
    currentWeek: number,
    divisionsData: DivisionsData
  ) => {
    console.log(`[Playoff Backfill] Starting backfill for weeks 1-${currentWeek}`)

    try {
      // Fetch matchup data for all completed weeks in one API call
      const weeksParam = Array.from({ length: currentWeek }, (_, i) => i + 1).join(',')
      const response = await fetch(`/api/mfl/matchups?year=${year}&weeks=${weeksParam}`)

      if (!response.ok) {
        console.error(`[Playoff Backfill] Failed to fetch matchup data:`, response.status)
        throw new Error(`Failed to fetch matchup data: ${response.status}`)
      }

      interface MatchupTeamData {
        franchiseId: string
        manager: string
        teamName: string
        matchups: Array<{
          week: number
          score: number
          opponentScore: number
          result: 'W' | 'L' | 'T'
        }>
      }

      const matchupData: MatchupTeamData[] = await response.json()
      const allTeamIds = new Set(matchupData.map(team => team.franchiseId))

      // Process each week sequentially, building up cumulative standings
      for (let week = 1; week <= currentWeek; week++) {
        console.log(`[Playoff Backfill] Processing week ${week}...`)

        // Build cumulative standings through this week
        const teamStandingsMap: Record<string, {
          wins: number
          losses: number
          ties: number
          pointsFor: number
          pointsAgainst: number
          name: string
        }> = {}

        // Initialize all teams
        matchupData.forEach(team => {
          teamStandingsMap[team.franchiseId] = {
            wins: 0,
            losses: 0,
            ties: 0,
            pointsFor: 0,
            pointsAgainst: 0,
            name: team.teamName
          }
        })

        // Accumulate stats through this week
        matchupData.forEach(team => {
          // Process all matchups up to and including current week
          team.matchups
            .filter(m => m.week <= week)
            .forEach(matchup => {
              const teamData = teamStandingsMap[team.franchiseId]

              // Update record
              if (matchup.result === 'W') {
                teamData.wins++
              } else if (matchup.result === 'L') {
                teamData.losses++
              } else {
                teamData.ties++
              }

              // Update points
              teamData.pointsFor += matchup.score
              teamData.pointsAgainst += matchup.opponentScore
            })
        })

        // Convert to StandingsFranchise format
        const standingsForWeek: StandingsFranchise[] = Object.entries(teamStandingsMap).map(([id, data]) => {
          const gamesPlayed = data.wins + data.losses + data.ties
          return {
            id,
            name: data.name,
            h2hw: data.wins.toString(),
            h2hl: data.losses.toString(),
            h2ht: data.ties.toString(),
            h2hpct: ((data.wins + data.ties * 0.5) / Math.max(1, gamesPlayed)).toFixed(3),
            h2hwlt: `${data.wins}-${data.losses}-${data.ties}`,
            pf: data.pointsFor.toFixed(2),
            pa: data.pointsAgainst.toFixed(2),
            pp: data.pointsFor.toFixed(2),
            avgpf: (data.pointsFor / Math.max(1, gamesPlayed)).toFixed(2),
            avgpa: (data.pointsAgainst / Math.max(1, gamesPlayed)).toFixed(2),
            divwlt: '0-0-0',
            strk: '',
            vp: '0',
            all_play_w: '0',
            all_play_l: '0',
            all_play_t: '0'
          }
        })

        // Create empty schedules for historical simulation
        const emptySchedules: TeamSchedule[] = Array.from(allTeamIds).map(teamId => ({
          franchiseId: teamId,
          remainingGames: [],
          completedGames: week,
          totalGames: 14
        }))

        // Calculate playoff probabilities for this week's standings state
        const probsForWeek = calculatePlayoffProbabilities(
          standingsForWeek,
          emptySchedules,
          divisionsData
        )

        // Save historical snapshot for this week
        batchUpdateSnapshots(
          year,
          week,
          probsForWeek.map(p => {
            const standing = standingsForWeek.find(s => s.id === p.franchiseId)
            return {
              franchiseId: p.franchiseId,
              franchiseName: standing?.name || p.franchiseId,
              playoffProbability: p.playoffProbability,
              divisionWinProbability: p.divisionWinProbability,
              avgSeed: p.averageSeed,
              wins: parseInt(standing?.h2hw || '0'),
              losses: parseInt(standing?.h2hl || '0'),
              ties: parseInt(standing?.h2ht || '0'),
              pointsFor: parseFloat(standing?.pf || '0'),
              gamesBack: 0
            }
          })
        )

        console.log(`[Playoff Backfill] ✓ Saved snapshot for week ${week} (Record: ${standingsForWeek[0]?.h2hwlt || 'N/A'})`)
      }

      // Set flag to prevent re-backfilling
      if (typeof window !== 'undefined') {
        localStorage.setItem(`mfl_playoff_history_backfilled_${year}`, 'true')
      }

      console.log(`[Playoff Backfill] ✓ Completed backfill for ${currentWeek} weeks`)
    } catch (error) {
      console.error('[Playoff Backfill] Error:', error)
      throw error
    }
  }

  // Fetch all necessary data
  const fetchPlayoffData = async () => {
    try {
      setIsRefreshing(true)
      setError(null)

      // Fetch current week
      const weekResponse = await fetch(`/api/mfl/current-week?year=${year}`)
      if (!weekResponse.ok) throw new Error('Failed to fetch current week')
      const weekData = await weekResponse.json()
      const week = weekData.currentWeek || 1
      setCurrentWeek(week)

      // Fetch standings
      const standingsResponse = await fetch(`/api/mfl/standings?year=${year}`)
      if (!standingsResponse.ok) throw new Error('Failed to fetch standings')
      const standingsData = await standingsResponse.json()
      setStandings(standingsData.leagueStandings?.franchise || [])

      // Fetch divisions
      const divisionsResponse = await fetch(`/api/mfl/divisions?year=${year}`)
      if (!divisionsResponse.ok) throw new Error('Failed to fetch divisions')
      const divisionsData = await divisionsResponse.json()
      setDivisions(divisionsData)

      // Fetch schedules
      const schedulesResponse = await fetch(
        `/api/mfl/schedule-remaining?year=${year}&currentWeek=${week}`
      )
      if (!schedulesResponse.ok) throw new Error('Failed to fetch schedules')
      const schedulesData = await schedulesResponse.json()
      setSchedules(schedulesData.schedules || [])

      // Calculate probabilities (after all data is loaded)
      if (standingsData.leagueStandings?.franchise && divisionsData && schedulesData.schedules) {
        console.log('Calculating playoff probabilities...')

        // Check if we need to backfill historical data
        const needsBackfill = typeof window !== 'undefined' &&
          !localStorage.getItem(`mfl_playoff_history_backfilled_${year}`) &&
          week > 1 // Only backfill if we're past week 1

        if (needsBackfill) {
          console.log('[Playoff Projections] Historical data not found, running backfill...')
          try {
            await backfillPlayoffHistoryFromMatchups(week, divisionsData)
            console.log('[Playoff Projections] ✓ Backfill completed successfully')
          } catch (backfillError) {
            console.error('[Playoff Projections] Backfill failed, continuing with current week only:', backfillError)
            // Continue with normal flow even if backfill fails
          }
        }

        const probs = calculatePlayoffProbabilities(
          standingsData.leagueStandings.franchise,
          schedulesData.schedules,
          divisionsData
        )
        setProbabilities(probs)

        // Save historical snapshot for current week and calculate changes
        batchUpdateSnapshots(
          year,
          week,
          probs.map(p => {
            const standing = standingsData.leagueStandings.franchise.find(
              (f: StandingsFranchise) => f.id === p.franchiseId
            )
            return {
              franchiseId: p.franchiseId,
              franchiseName: standing?.name || p.franchiseId,
              playoffProbability: p.playoffProbability,
              divisionWinProbability: p.divisionWinProbability,
              avgSeed: p.averageSeed,
              wins: parseInt(standing?.h2hw || '0'),
              losses: parseInt(standing?.h2hl || '0'),
              ties: parseInt(standing?.h2ht || '0'),
              pointsFor: parseFloat(standing?.pf || '0'),
              gamesBack: 0
            }
          })
        )

        const changes: Record<string, number | null> = {}
        probs.forEach(p => {
          changes[p.franchiseId] = getProbabilityChange(p.franchiseId, year, week)
        })
        setProbabilityChanges(changes)
      }

      setLastUpdated(new Date())
      setIsLoading(false)
    } catch (err) {
      console.error('Error fetching playoff data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load playoff data')
      setIsLoading(false)
    } finally {
      setIsRefreshing(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchPlayoffData()
  }, [year])

  // Get playoff picture
  const playoffPicture = useMemo(() => {
    if (!standings.length || !probabilities.length || !divisions) return null
    return getPlayoffPicture(standings, probabilities, divisions)
  }, [standings, probabilities, divisions])

  // Manual refresh
  const handleRefresh = () => {
    fetchPlayoffData()
  }

  // Get status color class
  const getStatusColor = (probability: number): string => {
    if (probability >= 99) return 'text-green-600 dark:text-green-400 font-bold'
    if (probability >= 80) return 'text-green-500 dark:text-green-500'
    if (probability >= 50) return 'text-yellow-500 dark:text-yellow-400'
    if (probability >= 20) return 'text-orange-500 dark:text-orange-400'
    if (probability >= 5) return 'text-red-500 dark:text-red-400'
    return 'text-gray-500 dark:text-gray-500'
  }

  const getStatusBgColor = (probability: number): string => {
    if (probability >= 99) return 'bg-green-100 dark:bg-green-900/30'
    if (probability >= 80) return 'bg-green-50 dark:bg-green-900/20'
    if (probability >= 50) return 'bg-yellow-50 dark:bg-yellow-900/20'
    if (probability >= 20) return 'bg-orange-50 dark:bg-orange-900/20'
    if (probability >= 5) return 'bg-red-50 dark:bg-red-900/20'
    return 'bg-gray-50 dark:bg-gray-900/20'
  }

  const getStatusLabel = (probability: number): string => {
    if (probability >= 99) return 'Clinched'
    if (probability >= 80) return 'Very Likely'
    if (probability >= 50) return 'Likely'
    if (probability >= 20) return 'Possible'
    if (probability >= 5) return 'Unlikely'
    return 'Eliminated'
  }

  const getChangeIndicator = (change: number | null): string => {
    if (change === null) return ''
    if (change > 5) return '↑↑'
    if (change > 0) return '↑'
    if (change < -5) return '↓↓'
    if (change < 0) return '↓'
    return '→'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Calculating playoff probabilities...
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Running 10,000 simulations
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-red-800 dark:text-red-400 font-semibold mb-2">
          Error Loading Playoff Data
        </h3>
        <p className="text-red-600 dark:text-red-500">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!playoffPicture) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        No playoff data available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Playoff Race - Week {currentWeek} of 14
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
        >
          {isRefreshing ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Refreshing...
            </>
          ) : (
            <>
              ↻ Refresh
            </>
          )}
        </button>
      </div>

      {/* Playoff Standings Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Division
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Record
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  PF
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  GB
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Playoff %
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {playoffPicture.currentStandings.map((team, index) => {
                const prob = probabilities.find(p => p.franchiseId === team.franchiseId)
                const franchise = divisions?.franchises.find(f => f.id === team.franchiseId)
                const divisionName = divisions?.divisionNames[divisions.divisionMap[team.franchiseId]] || ''
                const isDivisionLeader = playoffPicture.divisionLeaders.includes(team.franchiseId)

                // Calculate games back (from first place)
                const firstPlace = playoffPicture.currentStandings[0]
                const gamesBack =
                  ((firstPlace.wins - team.wins) + (team.losses - firstPlace.losses)) / 2

                return (
                  <tr
                    key={team.franchiseId}
                    className={`${getStatusBgColor(team.playoffProbability)} hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors`}
                    onClick={() => setSelectedTeam(team.franchiseId)}
                  >
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {team.rank}
                      {team.rank <= 6 && (
                        <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                          P{team.rank}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {franchise?.name || team.franchiseId}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {franchise?.owner_name}
                          </div>
                        </div>
                        {isDivisionLeader && (
                          <span className="ml-2 px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded">
                            DIV
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                      {divisionName.replace(' Division', '')}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center text-sm font-medium text-gray-900 dark:text-white">
                      {team.wins}-{team.losses}{team.ties > 0 && `-${team.ties}`}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-600 dark:text-gray-400">
                      {team.pointsFor.toFixed(1)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-600 dark:text-gray-400">
                      {gamesBack === 0 ? '-' : gamesBack.toFixed(1)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1">
                          <span className={`text-lg font-bold ${getStatusColor(team.playoffProbability)}`}>
                            {team.playoffProbability.toFixed(1)}%
                          </span>
                          {probabilityChanges[team.franchiseId] !== undefined && (
                            <span className={`text-xs ${
                              (probabilityChanges[team.franchiseId] || 0) > 0
                                ? 'text-green-600 dark:text-green-400'
                                : (probabilityChanges[team.franchiseId] || 0) < 0
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-400'
                            }`}>
                              {getChangeIndicator(probabilityChanges[team.franchiseId])}
                            </span>
                          )}
                        </div>
                        {prob && prob.averageSeed > 0 && (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Avg Seed: {prob.averageSeed.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(team.playoffProbability)}`}>
                        {getStatusLabel(team.playoffProbability)}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Playoff Format
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-900 dark:text-white">6 Teams</span>
            <p className="text-gray-600 dark:text-gray-400">Make playoffs</p>
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-white">3 Division Winners</span>
            <p className="text-gray-600 dark:text-gray-400">Seeds 1-3</p>
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-white">3 Wildcards</span>
            <p className="text-gray-600 dark:text-gray-400">Seeds 4-6</p>
          </div>
          <div>
            <span className="font-medium text-gray-900 dark:text-white">Week 15-17</span>
            <p className="text-gray-600 dark:text-gray-400">Playoff weeks</p>
          </div>
        </div>
      </div>

      {/* Team Detail Modal */}
      {selectedTeam && (
        <TeamDetailModal
          isOpen={!!selectedTeam}
          onClose={() => setSelectedTeam(null)}
          franchiseId={selectedTeam}
          probability={probabilities.find(p => p.franchiseId === selectedTeam)!}
          standing={standings.find(s => s.id === selectedTeam)!}
          divisions={divisions!}
          schedule={schedules.find(s => s.franchiseId === selectedTeam)!}
          currentWeek={currentWeek}
          year={year}
        />
      )}
    </div>
  )
}
