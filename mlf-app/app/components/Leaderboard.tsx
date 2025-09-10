'use client'

import { useState, useMemo } from 'react'
import { Team } from '@/lib/mfl'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { formatTeamDisplay, getUniqueYears } from '@/lib/team-utils'
import { formatPoints, formatEfficiency } from '@/lib/utils'

interface LeaderboardProps {
  teams: Team[]
  selectedWeeks?: number[]
}

type SortField = keyof Pick<Team, 'manager' | 'teamName' | 'startersPoints' | 'benchPoints' | 'offensePoints' | 'defensePoints' | 'totalPoints' | 'potentialPoints'> | 'efficiency'
type SortDirection = 'asc' | 'desc' | null

export default function Leaderboard({ teams, selectedWeeks = [] }: LeaderboardProps) {
  const [sortField, setSortField] = useState<SortField>('totalPoints')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  
  const uniqueYears = useMemo(() => getUniqueYears(teams), [teams])
  const hasMultipleYears = uniqueYears.length > 1

  const sortedTeams = useMemo(() => {
    if (sortDirection) {
      return [...teams].sort((a, b) => {
        // Special handling for efficiency sorting
        if (sortField === 'efficiency') {
          const aEfficiency = calculateEfficiencyValue(a.startersPoints, a.potentialPoints)
          const bEfficiency = calculateEfficiencyValue(b.startersPoints, b.potentialPoints)
          return sortDirection === 'asc' ? aEfficiency - bEfficiency : bEfficiency - aEfficiency
        }
        
        const aValue = a[sortField as keyof Team]
        const bValue = b[sortField as keyof Team]
        
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
    return teams
  }, [teams, sortField, sortDirection])

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

  const calculateEfficiencyValue = (actualPoints: number, potentialPoints: number) => {
    if (potentialPoints === 0) return 0
    return (actualPoints / potentialPoints) * 100
  }

  const getRankStyle = (index: number) => {
    if (index === 0) return 'bg-yellow-100 text-yellow-800'  // Gold
    if (index === 1) return 'bg-gray-100 text-gray-800'      // Silver
    if (index === 2) return 'bg-orange-100 text-orange-800' // Bronze
    return 'bg-white text-gray-900'
  }

  return (
    <div className="overflow-x-auto">
      {selectedWeeks.length > 0 && (
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 ring-1 ring-inset ring-purple-600/10 dark:bg-purple-400/10 dark:text-purple-400 dark:ring-purple-400/30">
            {selectedWeeks.length === 1 
              ? `Week ${selectedWeeks[0]}` 
              : `${selectedWeeks.length} weeks selected`
            }
          </span>
        </div>
      )}
      <table className="min-w-full">
        <thead>
          <tr className="bg-blue-600 text-white">
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Rank
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Year
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
                onClick={() => handleSort('startersPoints')}
                className="flex items-center justify-center hover:text-blue-200 transition-colors"
              >
                Starters
                {getSortIcon('startersPoints')}
              </button>
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
              <button
                onClick={() => handleSort('benchPoints')}
                className="flex items-center justify-center hover:text-blue-200 transition-colors"
              >
                Bench
                {getSortIcon('benchPoints')}
              </button>
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
              <button
                onClick={() => handleSort('offensePoints')}
                className="flex items-center justify-center hover:text-blue-200 transition-colors"
              >
                Offense
                {getSortIcon('offensePoints')}
              </button>
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
              <button
                onClick={() => handleSort('defensePoints')}
                className="flex items-center justify-center hover:text-blue-200 transition-colors"
              >
                Defense
                {getSortIcon('defensePoints')}
              </button>
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
              <button
                onClick={() => handleSort('totalPoints')}
                className="flex items-center justify-center hover:text-blue-200 transition-colors"
              >
                Total
                {getSortIcon('totalPoints')}
              </button>
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
              <button
                onClick={() => handleSort('potentialPoints')}
                className="flex items-center justify-center hover:text-blue-200 transition-colors"
              >
                Potential
                {getSortIcon('potentialPoints')}
              </button>
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
              <button
                onClick={() => handleSort('efficiency')}
                className="flex items-center justify-center hover:text-blue-200 transition-colors"
                title="Sort by Efficiency (Total/Potential)"
              >
                Efficiency
                {getSortIcon('efficiency')}
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sortedTeams.map((team, index) => (
            <tr 
              key={`${team.id}-${team.year}`} 
              className={`${getRankStyle(index)} hover:bg-gray-50 transition-colors`}
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${index < 3 ? getRankStyle(index) : 'bg-gray-100 text-gray-600'}
                `}>
                  {index + 1}
                </div>
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                {team.year}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                {formatTeamDisplay(team, { includeYear: hasMultipleYears })}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">
                {team.manager}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 font-medium">
                {formatPoints(team.startersPoints)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-600">
                {formatPoints(team.benchPoints)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                {formatPoints(team.offensePoints)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                {formatPoints(team.defensePoints)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 font-bold">
                {formatPoints(team.totalPoints)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-600">
                {formatPoints(team.potentialPoints)}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-green-600 font-medium">
                {formatEfficiency(team.startersPoints, team.potentialPoints)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}