'use client'

import { useState, useMemo, memo } from 'react'
import { Team } from '@/lib/mfl'
import { ArrowUpDown, ArrowUp, ArrowDown, Trophy, Target } from 'lucide-react'
import { formatTeamDisplay, getUniqueYears, formatYearsDisplay } from '@/lib/team-utils'
import { formatPoints, formatPercentage, formatDecimal } from '@/lib/utils'

interface MatchupsTableProps {
  teams: Team[]
  selectedWeeks: number[]
}

interface MatchupResult {
  week: number
  franchiseId: string
  opponent: string
  score: number
  opponentScore: number
  result: 'W' | 'L' | 'T'
  isHomeTeam: boolean
}

interface TeamMatchupSummary {
  franchiseId: string
  manager: string
  teamName: string
  wins: number
  losses: number
  ties: number
  pointsFor: number
  pointsAgainst: number
  winPercentage: number
  matchups: MatchupResult[]
  year: number
}

type SortField = keyof Pick<TeamMatchupSummary, 'manager' | 'teamName' | 'wins' | 'losses' | 'winPercentage' | 'pointsFor' | 'pointsAgainst'> | 'pointDifferential'
type SortDirection = 'asc' | 'desc' | null

function MatchupsTable({ teams, selectedWeeks }: MatchupsTableProps) {
  const [sortField, setSortField] = useState<SortField>('wins')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const uniqueYears = useMemo(() => getUniqueYears(teams), [teams])
  const hasMultipleYears = uniqueYears.length > 1

  // Convert teams data directly to matchups format
  // This uses MFL's official standings data which is the source of truth
  const matchupsData = useMemo(() => {
    return teams.map(team => ({
      franchiseId: team.id,
      manager: team.manager,
      teamName: team.teamName,
      wins: team.wins || 0,
      losses: team.losses || 0,
      ties: team.ties || 0,
      pointsFor: team.pointsFor || team.totalPoints,
      pointsAgainst: team.pointsAgainst || 0,
      winPercentage: team.winPercentage || 0,
      matchups: [], // Detailed matchup history not needed for this view
      year: team.year
    }))
  }, [teams])

  const sortedTeams = useMemo(() => {
    if (sortDirection) {
      return [...matchupsData].sort((a, b) => {
        // When sorting by wins or losses, use multi-level sort: wins -> losses -> points for
        if (sortField === 'wins' || sortField === 'losses') {
          // Sort by wins first (descending)
          const winsDiff = b.wins - a.wins
          if (winsDiff !== 0) return winsDiff
          
          // If wins are equal, sort by losses (ascending - fewer losses is better)
          const lossesDiff = a.losses - b.losses
          if (lossesDiff !== 0) return lossesDiff
          
          // If both wins and losses are equal, sort by points for (descending)
          return b.pointsFor - a.pointsFor
        }

        let aValue: string | number
        let bValue: string | number

        // Handle special case for point differential
        if (sortField === 'pointDifferential') {
          aValue = a.pointsFor - a.pointsAgainst
          bValue = b.pointsFor - b.pointsAgainst
        } else {
          aValue = a[sortField as keyof TeamMatchupSummary] as string | number
          bValue = b[sortField as keyof TeamMatchupSummary] as string | number
        }
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue)
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
        }
        
        return 0
      })
    }
    return matchupsData
  }, [matchupsData, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(current => {
        if (current === 'desc') return 'asc'
        if (current === 'asc') return null
        return 'desc'
      })
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field || !sortDirection) {
      return <ArrowUpDown className="ml-1 h-3 w-3" />
    }
    return sortDirection === 'desc' 
      ? <ArrowDown className="ml-1 h-3 w-3" />
      : <ArrowUp className="ml-1 h-3 w-3" />
  }

  const formatWinPercentageValue = (pct: number) => {
    return formatPercentage(pct * 100)
  }

  const getRecordStyle = (index: number, wins: number, losses: number) => {
    const winPct = wins / (wins + losses)
    if (index === 0 || winPct >= 0.8) return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    if (winPct >= 0.6) return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
    if (winPct >= 0.4) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
  }

  const calculatePointDifferential = (pointsFor: number, pointsAgainst: number) => {
    const diff = pointsFor - pointsAgainst
    return diff >= 0 ? `+${formatDecimal(diff)}` : formatDecimal(diff)
  }

  const getPointDifferentialStyle = (pointsFor: number, pointsAgainst: number) => {
    const diff = pointsFor - pointsAgainst
    if (diff > 0) return 'text-green-600 dark:text-green-400 font-medium'
    if (diff < 0) return 'text-red-600 dark:text-red-400 font-medium'
    return 'text-gray-600 dark:text-gray-400'
  }

  return (
    <div className="space-y-6">
      {/* Season Records Table */}
      <div className="overflow-x-auto">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
            <Trophy className="mr-2 h-5 w-5 text-yellow-500" />
            Season Records & Standings
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {selectedWeeks.length > 0 
              ? `Team records for ${selectedWeeks.length === 1 ? `Week ${selectedWeeks[0]}` : `${selectedWeeks.length} selected weeks`} in the ${hasMultipleYears ? formatYearsDisplay(uniqueYears) + ' seasons' : (uniqueYears[0] || 2025) + ' season'}`
              : `Season records, win percentages, and point differentials for the ${hasMultipleYears ? formatYearsDisplay(uniqueYears) + ' seasons' : (uniqueYears[0] || 2025) + ' season'}`
            }
          </p>
        </div>

        <table className="min-w-full">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                <button
                  onClick={() => handleSort('teamName')}
                  className="flex items-center hover:text-blue-200 transition-colors"
                >
                  Team
                  {getSortIcon('teamName')}
                </button>
              </th>
              {hasMultipleYears && (
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                  Year
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                <button
                  onClick={() => handleSort('manager')}
                  className="flex items-center hover:text-blue-200 transition-colors"
                >
                  Manager
                  {getSortIcon('manager')}
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                <button
                  onClick={() => handleSort('wins')}
                  className="flex items-center justify-center hover:text-blue-200 transition-colors"
                >
                  Wins
                  {getSortIcon('wins')}
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                <button
                  onClick={() => handleSort('losses')}
                  className="flex items-center justify-center hover:text-blue-200 transition-colors"
                >
                  Losses
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                Record
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                <button
                  onClick={() => handleSort('winPercentage')}
                  className="flex items-center justify-center hover:text-blue-200 transition-colors"
                >
                  Win %
                  {getSortIcon('winPercentage')}
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                <button
                  onClick={() => handleSort('pointsFor')}
                  className="flex items-center justify-center hover:text-blue-200 transition-colors"
                >
                  Points For
                  {getSortIcon('pointsFor')}
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                <button
                  onClick={() => handleSort('pointsAgainst')}
                  className="flex items-center justify-center hover:text-blue-200 transition-colors"
                >
                  Points Against
                  {getSortIcon('pointsAgainst')}
                </button>
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                <button
                  onClick={() => handleSort('pointDifferential')}
                  className="flex items-center justify-center hover:text-blue-200 transition-colors"
                >
                  Point Diff
                  {getSortIcon('pointDifferential')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sortedTeams.map((team, index) => {
              const totalGames = team.wins + team.losses + team.ties
              return (
                <tr 
                  key={`${team.franchiseId}-${team.year}`} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                      ${index < 3 ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}
                    `}>
                      {index + 1}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                    {team.teamName}
                  </td>
                  {hasMultipleYears && (
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white font-medium">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        {team.year}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                    {team.manager}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-green-600 dark:text-green-400 font-bold">
                    {team.wins}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-red-600 dark:text-red-400 font-bold">
                    {team.losses}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-center">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getRecordStyle(index, team.wins, team.losses)}`}>
                      {team.wins}-{team.losses}{team.ties > 0 && `-${team.ties}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white font-medium">
                    {formatWinPercentageValue(team.winPercentage)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-blue-600 dark:text-blue-400 font-medium">
                    {formatPoints(team.pointsFor)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-orange-600 dark:text-orange-400 font-medium">
                    {formatPoints(team.pointsAgainst)}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm text-center font-bold ${getPointDifferentialStyle(team.pointsFor, team.pointsAgainst)}`}>
                    {calculatePointDifferential(team.pointsFor, team.pointsAgainst)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Quick Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <Trophy className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm text-green-700 dark:text-green-300">Best Record</p>
              <p className="text-lg font-bold text-green-800 dark:text-green-200">
                {sortedTeams[0]?.teamName} ({sortedTeams[0]?.wins}-{sortedTeams[0]?.losses})
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-blue-500 mr-3" />
            <div>
              <p className="text-sm text-blue-700 dark:text-blue-300">Highest Scoring</p>
              <p className="text-lg font-bold text-blue-800 dark:text-blue-200">
                {(() => {
                  const topScorer = [...matchupsData].sort((a, b) => b.pointsFor - a.pointsFor)[0]
                  return topScorer ? `${topScorer.teamName} (${formatPoints(topScorer.pointsFor)})` : 'N/A'
                })()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-purple-500 rounded-full flex items-center justify-center mr-3">
              <span className="text-white font-bold text-sm">%</span>
            </div>
            <div>
              <p className="text-sm text-purple-700 dark:text-purple-300">Best Win Rate</p>
              <p className="text-lg font-bold text-purple-800 dark:text-purple-200">
                {[...matchupsData].sort((a, b) => b.winPercentage - a.winPercentage)[0]?.teamName} ({formatWinPercentageValue([...matchupsData].sort((a, b) => b.winPercentage - a.winPercentage)[0]?.winPercentage)})
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(MatchupsTable)