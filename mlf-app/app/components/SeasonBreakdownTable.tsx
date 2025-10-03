'use client'

import { useState, useMemo } from 'react'
import { Team } from '@/lib/mfl'
import { ArrowUpDown, ArrowUp, ArrowDown, Trophy, Calendar, Target } from 'lucide-react'
import { formatTeamDisplay, getUniqueYears } from '@/lib/team-utils'
import { formatPoints } from '@/lib/utils'
import {
  estimateSeasonBreakdown,
  formatSeasonBreakdown,
  hasPostseasonData,
  getEfficiencyRating,
  type SeasonBreakdown
} from '@/lib/season-breakdown-utils'
import { getRegularSeasonEndWeek, getTotalWeeksForYear } from '@/lib/season-config'
import PlayoffProjections from './PlayoffProjections'

interface SeasonBreakdownTableProps {
  teams: Team[]
}

interface TeamWithBreakdown extends Team {
  breakdown: SeasonBreakdown
  regularSeasonAvg: number
  postseasonAvg: number
  efficiency: number
}

type TabView = 'breakdown' | 'playoffs'
type SortField = 'manager' | 'teamName' | 'regularSeasonPoints' | 'postseasonPoints' | 'fullSeasonPoints' | 'efficiency'
type SortDirection = 'asc' | 'desc' | null

export default function SeasonBreakdownTable({ teams }: SeasonBreakdownTableProps) {
  const [activeTab, setActiveTab] = useState<TabView>('breakdown')
  const [sortField, setSortField] = useState<SortField>('fullSeasonPoints')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  
  const uniqueYears = useMemo(() => getUniqueYears(teams), [teams])
  const hasMultipleYears = uniqueYears.length > 1
  const primaryYear = teams[0]?.year || new Date().getFullYear()

  // Calculate breakdown for each team
  const teamsWithBreakdown = useMemo((): TeamWithBreakdown[] => {
    return teams.map(team => {
      // Estimate breakdown since we don't have weekly data in this context
      const breakdown = estimateSeasonBreakdown(team.startersPoints, team.potentialPoints, team.year)
      
      const regularSeasonAvg = breakdown.regularSeasonWeeks.length > 0 
        ? breakdown.regularSeasonPoints / breakdown.regularSeasonWeeks.length 
        : 0
        
      const postseasonAvg = breakdown.postseasonWeeks.length > 0 
        ? breakdown.postseasonPoints / breakdown.postseasonWeeks.length 
        : 0
        
      const efficiency = regularSeasonAvg > 0 ? (postseasonAvg / regularSeasonAvg) : 0
      
      return {
        ...team,
        breakdown,
        regularSeasonAvg,
        postseasonAvg,
        efficiency
      }
    })
  }, [teams])

  const sortedTeams = useMemo(() => {
    if (sortDirection) {
      return [...teamsWithBreakdown].sort((a, b) => {
        let aValue: any, bValue: any
        
        switch (sortField) {
          case 'regularSeasonPoints':
            aValue = a.breakdown.regularSeasonPoints
            bValue = b.breakdown.regularSeasonPoints
            break
          case 'postseasonPoints':
            aValue = a.breakdown.postseasonPoints
            bValue = b.breakdown.postseasonPoints
            break
          case 'fullSeasonPoints':
            aValue = a.breakdown.fullSeasonPoints
            bValue = b.breakdown.fullSeasonPoints
            break
          case 'efficiency':
            aValue = a.efficiency
            bValue = b.efficiency
            break
          default:
            aValue = a[sortField as keyof Team]
            bValue = b[sortField as keyof Team]
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
    return teamsWithBreakdown
  }, [teamsWithBreakdown, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'desc' ? 'asc' : sortDirection === 'asc' ? null : 'desc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3" />
    if (sortDirection === 'desc') return <ArrowDown className="ml-1 h-3 w-3" />
    if (sortDirection === 'asc') return <ArrowUp className="ml-1 h-3 w-3" />
    return <ArrowUpDown className="ml-1 h-3 w-3" />
  }

  const regularSeasonEndWeek = getRegularSeasonEndWeek(primaryYear)
  const totalWeeks = getTotalWeeksForYear(primaryYear)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
      <div className="px-4 py-5 sm:p-6">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('breakdown')}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${
                  activeTab === 'breakdown'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                Season Breakdown
              </div>
            </button>
            <button
              onClick={() => setActiveTab('playoffs')}
              className={`
                whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm
                ${
                  activeTab === 'playoffs'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }
              `}
            >
              <div className="flex items-center">
                <Trophy className="h-4 w-4 mr-2" />
                Playoff Projections
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'playoffs' ? (
          <PlayoffProjections year={primaryYear} />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Season Breakdown
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
                  Regular season (weeks 1-{regularSeasonEndWeek}) vs postseason (weeks {regularSeasonEndWeek + 1}-{totalWeeks}) performance
                </p>
              </div>
              <div className="flex space-x-2">
                <div className="flex items-center text-xs text-gray-500">
                  <Calendar className="h-4 w-4 mr-1" />
                  Regular Season
                </div>
                <div className="flex items-center text-xs text-gray-500">
                  <Trophy className="h-4 w-4 mr-1" />
                  Postseason
                </div>
                <div className="flex items-center text-xs text-gray-500">
                  <Target className="h-4 w-4 mr-1" />
                  Full Season
                </div>
              </div>
            </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-blue-600 dark:bg-blue-900">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-blue-100 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('teamName')}
                    className="flex items-center hover:text-blue-200 transition-colors"
                  >
                    Team
                    {getSortIcon('teamName')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-blue-100 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('manager')}
                    className="flex items-center hover:text-blue-200 transition-colors"
                  >
                    Manager
                    {getSortIcon('manager')}
                  </button>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-blue-100 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('regularSeasonPoints')}
                    className="flex items-center justify-center hover:text-blue-200 transition-colors"
                  >
                    <Calendar className="h-3 w-3 mr-1" />
                    Regular Season
                    {getSortIcon('regularSeasonPoints')}
                  </button>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-blue-100 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('postseasonPoints')}
                    className="flex items-center justify-center hover:text-blue-200 transition-colors"
                  >
                    <Trophy className="h-3 w-3 mr-1" />
                    Postseason
                    {getSortIcon('postseasonPoints')}
                  </button>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-blue-100 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('fullSeasonPoints')}
                    className="flex items-center justify-center hover:text-blue-200 transition-colors"
                  >
                    <Target className="h-3 w-3 mr-1" />
                    Full Season
                    {getSortIcon('fullSeasonPoints')}
                  </button>
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-blue-100 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('efficiency')}
                    className="flex items-center justify-center hover:text-blue-200 transition-colors"
                  >
                    Efficiency
                    {getSortIcon('efficiency')}
                  </button>
                </th>
                {hasMultipleYears && (
                  <th className="px-4 py-3 text-center text-xs font-medium text-blue-100 uppercase tracking-wider">
                    Year
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedTeams.map((team, index) => {
                const displayInfo = formatTeamDisplay(team as any)
                const breakdownDisplay = formatSeasonBreakdown(team.breakdown)
                const efficiencyRating = getEfficiencyRating(team.efficiency)
                const hasPostseason = hasPostseasonData(team.breakdown)
                
                return (
                  <tr
                    key={`${team.id}-${team.year}`}
                    className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}
                  >
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {team.teamName}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-300">
                        {team.manager}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatPoints(team.breakdown.regularSeasonPoints)}
                      </div>
                      <div className="text-xs text-gray-500">
                        {team.regularSeasonAvg.toFixed(1)} avg
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatPoints(team.breakdown.postseasonPoints)}
                      </div>
                      {hasPostseason && (
                        <div className="text-xs text-gray-500">
                          {team.postseasonAvg.toFixed(1)} avg
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="text-sm font-bold text-gray-900 dark:text-white">
                        {formatPoints(team.breakdown.fullSeasonPoints)}
                      </div>
                      <div className="text-xs text-gray-500">
                        Total all weeks
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      {hasPostseason ? (
                        <div>
                          <div className={`text-sm font-medium ${efficiencyRating.color}`}>
                            {efficiencyRating.rating}
                          </div>
                          <div className="text-xs text-gray-500">
                            {(team.efficiency * 100).toFixed(0)}%
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">
                          No playoffs
                        </div>
                      )}
                    </td>
                    {hasMultipleYears && (
                      <td className="px-4 py-4 whitespace-nowrap text-center text-sm text-gray-500">
                        {team.year}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex flex-wrap gap-4">
            <div><strong>Efficiency:</strong> Postseason average ÷ Regular season average</div>
            <div><strong>Clutch:</strong> 110%+ efficiency</div>
            <div><strong>Steady:</strong> 95-109% efficiency</div>
            <div><strong>Faded:</strong> 80-94% efficiency</div>
            <div><strong>Struggled:</strong> &lt;80% efficiency</div>
          </div>
        </div>
          </>
        )}
      </div>
    </div>
  )
}