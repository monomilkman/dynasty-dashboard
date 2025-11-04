'use client'

import { useMemo, useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { LeaguePositionalData } from '@/lib/mfl-position-scraper'
import { PositionKey } from '@/lib/position-utils'
import { formatTeamDisplay, getUniqueYears } from '@/lib/team-utils'
import {
  calculateAllPositionGaps,
  AllPositionGaps,
  PositionGapData,
  getGapColorClass,
  formatGap
} from '@/lib/position-analysis-utils'
import PositionTooltip from './PositionTooltip'

interface PointsBehindViewProps {
  positionalData: LeaguePositionalData
  teamRecordsMap: Map<string, { wins: number; losses: number; ties: number; pointsFor: number }>
  statFilter: 'all' | 'offense' | 'defense'
  hasMultipleYears: boolean
}

type SortDirection = 'asc' | 'desc' | null

export default function PointsBehindView({
  positionalData,
  teamRecordsMap,
  statFilter,
  hasMultipleYears
}: PointsBehindViewProps) {
  const [sortField, setSortField] = useState<string>('teamName')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selectedTooltip, setSelectedTooltip] = useState<{ position: PositionKey; franchiseId: string; anchorElement: HTMLElement } | null>(null)

  // Calculate all gaps
  const allGaps = useMemo(() => {
    return calculateAllPositionGaps(positionalData)
  }, [positionalData])

  // Define positions to show based on filter
  const offensivePositions: PositionKey[] = ['QB', 'RB', 'WR', 'TE', 'O-Flex', 'K']
  const defensivePositions: PositionKey[] = ['DL', 'LB', 'CB', 'S', 'D-Flex']

  const positionsToShow: PositionKey[] = useMemo(() => {
    if (statFilter === 'offense') return offensivePositions
    if (statFilter === 'defense') return defensivePositions
    return [...offensivePositions, ...defensivePositions]
  }, [statFilter])

  // Sort teams
  const sortedTeams = useMemo(() => {
    const teams = [...positionalData.teams]

    if (sortDirection && sortField) {
      teams.sort((a, b) => {
        if (sortField === 'record') {
          const aRecord = teamRecordsMap.get(a.franchiseId) || { wins: 0, losses: 0, pointsFor: 0 }
          const bRecord = teamRecordsMap.get(b.franchiseId) || { wins: 0, losses: 0, pointsFor: 0 }

          if (aRecord.wins !== bRecord.wins) return bRecord.wins - aRecord.wins
          if (aRecord.losses !== bRecord.losses) return aRecord.losses - bRecord.losses
          return bRecord.pointsFor - aRecord.pointsFor
        } else if (sortField === 'teamName') {
          return sortDirection === 'asc'
            ? a.teamName.localeCompare(b.teamName)
            : b.teamName.localeCompare(a.teamName)
        } else if (sortField === 'manager') {
          return sortDirection === 'asc'
            ? a.manager.localeCompare(b.manager)
            : b.manager.localeCompare(a.manager)
        } else {
          // Sorting by position gap
          const positionKey = sortField as PositionKey
          const aGap = allGaps[a.franchiseId]?.[positionKey]?.gapFromFirst ?? -Infinity
          const bGap = allGaps[b.franchiseId]?.[positionKey]?.gapFromFirst ?? -Infinity
          return sortDirection === 'asc' ? aGap - bGap : bGap - aGap
        }
      })
    }

    return teams
  }, [positionalData.teams, sortField, sortDirection, allGaps, teamRecordsMap])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(current => {
        if (current === 'desc') return 'asc'
        if (current === 'asc') return 'desc'
        return 'desc'
      })
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3" />
    }
    return sortDirection === 'desc'
      ? <ArrowDown className="ml-1 h-3 w-3" />
      : <ArrowUp className="ml-1 h-3 w-3" />
  }

  const formatRecord = (wins: number, losses: number, ties: number) => {
    if (ties > 0) return `${wins}-${losses}-${ties}`
    return `${wins}-${losses}`
  }

  const getRecordStyle = (wins: number, losses: number) => {
    if (wins > losses) {
      return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    } else if (losses > wins) {
      return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    }
    return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  }

  const handlePositionCellClick = (
    event: React.MouseEvent<HTMLSpanElement>,
    position: PositionKey,
    franchiseId: string
  ) => {
    event.stopPropagation()
    const element = event.currentTarget as HTMLElement
    setSelectedTooltip({ position, franchiseId, anchorElement: element })
  }

  const tooltipGapData = useMemo((): PositionGapData | null => {
    if (!selectedTooltip) return null
    return allGaps[selectedTooltip.franchiseId]?.[selectedTooltip.position] || null
  }, [selectedTooltip, allGaps])

  return (
    <div className="space-y-4">
      {/* Description */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          <strong>Points Behind View:</strong> Shows how many points each team is behind the position leader.
          Negative numbers indicate points behind first place. Click any cell for detailed analysis.
        </p>
      </div>

      {/* Table */}
      <div className="overflow-x-auto w-full min-w-[1200px]">
        <table className="w-full border border-gray-200 dark:border-gray-700">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider border-r border-blue-500 min-w-24">
                <button
                  onClick={() => handleSort('record')}
                  className="flex items-center justify-center hover:text-blue-200 transition-colors"
                >
                  Record
                  {getSortIcon('record')}
                </button>
              </th>

              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider border-r border-blue-500 min-w-48">
                <button
                  onClick={() => handleSort('teamName')}
                  className="flex items-center hover:text-blue-200 transition-colors"
                >
                  Team
                  {getSortIcon('teamName')}
                </button>
              </th>

              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider border-r border-blue-500 min-w-36">
                <button
                  onClick={() => handleSort('manager')}
                  className="flex items-center hover:text-blue-200 transition-colors"
                >
                  Manager
                  {getSortIcon('manager')}
                </button>
              </th>

              {positionsToShow.map(position => (
                <th key={position} className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider border-r border-blue-500">
                  <button
                    onClick={() => handleSort(position)}
                    className="flex items-center justify-center hover:text-blue-200 transition-colors"
                  >
                    {position}
                    {getSortIcon(position)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedTeams.map((team, index) => {
              const teamRecord = teamRecordsMap.get(team.franchiseId) || { wins: 0, losses: 0, ties: 0 }

              return (
                <tr key={`${team.franchiseId}-${team.year}`} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <td className="px-3 py-2 text-center text-sm border-r border-gray-200 dark:border-gray-700 min-w-24">
                    <span className={getRecordStyle(teamRecord.wins, teamRecord.losses)}>
                      {formatRecord(teamRecord.wins, teamRecord.losses, teamRecord.ties)}
                    </span>
                  </td>

                  <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700 min-w-48">
                    {formatTeamDisplay(team as any, { includeYear: hasMultipleYears })}
                  </td>

                  <td className="px-3 py-2 text-sm text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700 min-w-36">
                    {team.manager}
                  </td>

                  {positionsToShow.map(position => {
                    const gapData = allGaps[team.franchiseId]?.[position]

                    if (!gapData) {
                      return (
                        <td key={position} className="px-3 py-2 text-center text-sm border-r border-gray-200 dark:border-gray-700">
                          <span className="text-gray-400">-</span>
                        </td>
                      )
                    }

                    const colorClass = getGapColorClass(gapData.gapFromFirst)

                    return (
                      <td key={position} className="px-3 py-2 text-center text-sm border-r border-gray-200 dark:border-gray-700">
                        <span
                          className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-medium ${colorClass} cursor-pointer hover:opacity-80 transition-opacity`}
                          onClick={(e) => handlePositionCellClick(e, position, team.franchiseId)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              handlePositionCellClick(e as any, position, team.franchiseId)
                            }
                          }}
                          aria-label={`View ${position} analysis for ${team.teamName}`}
                        >
                          {formatGap(gapData.gapFromFirst)}
                        </span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Position Tooltip */}
      {selectedTooltip && tooltipGapData && (
        <PositionTooltip
          gapData={tooltipGapData}
          onClose={() => setSelectedTooltip(null)}
          anchorElement={selectedTooltip.anchorElement}
        />
      )}
    </div>
  )
}
