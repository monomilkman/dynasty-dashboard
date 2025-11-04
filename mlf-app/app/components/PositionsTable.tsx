'use client'

import { useState, useMemo, useEffect } from 'react'
import { Team } from '@/lib/mfl'
import { ArrowUpDown, ArrowUp, ArrowDown, RefreshCw, Download } from 'lucide-react'
import { formatTeamDisplay, getUniqueYears } from '@/lib/team-utils'
import { formatDecimal } from '@/lib/utils'
import {
  LeaguePositionalData,
  TeamPositionalData,
  PositionTotals
} from '@/lib/mfl-position-scraper'
import {
  getPositionColorClass,
  calculatePositionRanking,
  calculateAverageRanking,
  formatPositionDisplay,
  sortTeamsByAverageRanking,
  preparePositionExportData,
  createAverageRowData,
  createComparisonRows,
  calculateLeagueAverages,
  PositionKey,
  ComparisonType
} from '@/lib/position-utils'
import {
  calculatePositionGap,
  PositionGapData
} from '@/lib/position-analysis-utils'
import ComparisonModeMultiSelect from './ComparisonModeMultiSelect'
import PositionTooltip from './PositionTooltip'
import PositionViewTabs, { PositionViewType } from './PositionViewTabs'
import PointsBehindView from './PointsBehindView'
import PercentileView from './PercentileView'
import TeamWeaknessAnalyzer from './TeamWeaknessAnalyzer'

// Extended type for rows that includes comparison rows
type TableRow = (TeamPositionalData & { avgRank: number, isAverageRow: boolean, comparisonType?: ComparisonType })

interface PositionsTableProps {
  teams: Team[]
  statFilter?: 'all' | 'offense' | 'defense'
  selectedWeeks?: number[]
}

type SortDirection = 'asc' | 'desc' | null

export default function PositionsTable({ teams, statFilter = 'all', selectedWeeks = [] }: PositionsTableProps) {
  const [sortField, setSortField] = useState<string>('avgRank')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [positionalData, setPositionalData] = useState<LeaguePositionalData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [comparisonModes, setComparisonModes] = useState<ComparisonType[]>(['mean'])
  const [selectedTooltip, setSelectedTooltip] = useState<{ position: PositionKey; franchiseId: string; anchorElement: HTMLElement } | null>(null)
  const [activeView, setActiveView] = useState<PositionViewType>('rankings')
  
  const uniqueYears = useMemo(() => getUniqueYears(teams), [teams])
  const hasMultipleYears = uniqueYears.length > 1

  // Fetch positional data when component mounts or teams/weeks change
  useEffect(() => {
    if (teams.length === 0) return
    fetchPositionalData()
  }, [teams, selectedWeeks])
  
  const fetchPositionalData = async (forceRefresh = false) => {
    setIsLoading(true)
    setError(null)
    
    try {
      // Get the first team's year and league info
      const year = teams[0]?.year || new Date().getFullYear()
      const leagueId = '46221' // Default league ID
      
      // Build weeks parameter if selected  
      const weeksParam = selectedWeeks.length > 0 ? `&weeks=${selectedWeeks.join(',')}` : ''
      
      // Build manager/franchise parameters based on filtered teams prop
      // The teams prop uses the main Team interface (id property)
      // while the positions API uses TeamPositionalData interface (franchiseId property)
      const uniqueManagers = [...new Set(teams.map(team => team.manager))].filter(Boolean)
      const uniqueFranchiseIds = [...new Set(teams.map(team => team.id))].filter(Boolean) // team.id maps to franchiseId
      
      // Only add manager filter if we have a subset of teams (indicating filtering is active)
      // We expect around 12-14 teams in a full league, so if we have significantly fewer, it's likely filtered
      const isFiltered = teams.length > 0 && teams.length < 10 // Conservative threshold
      
      let managerParam = ''
      let franchiseParam = ''
      
      if (isFiltered && uniqueManagers.length > 0) {
        managerParam = `&managers=${encodeURIComponent(uniqueManagers.join(','))}`
        console.log(`PositionsTable: Applying manager filter for ${uniqueManagers.length} managers:`, uniqueManagers)
      } else if (isFiltered && uniqueFranchiseIds.length > 0) {
        franchiseParam = `&franchiseIds=${uniqueFranchiseIds.join(',')}`
        console.log(`PositionsTable: Applying franchise filter for ${uniqueFranchiseIds.length} franchise IDs:`, uniqueFranchiseIds)
      }
      
      const response = await fetch(`/api/mfl/positions?year=${year}&leagueId=${leagueId}${forceRefresh ? '&refresh=true' : ''}${weeksParam}${managerParam}${franchiseParam}`)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch positional data: ${response.status}`)
      }
      
      const data: LeaguePositionalData = await response.json()
      setPositionalData(data)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Error fetching positional data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load positional data')
    } finally {
      setIsLoading(false)
    }
  }
  
  // Create mapping from franchiseId to team record data
  const teamRecordsMap = useMemo(() => {
    const recordsMap = new Map()
    teams.forEach(team => {
      recordsMap.set(team.id, {
        wins: team.wins || 0,
        losses: team.losses || 0,
        ties: team.ties || 0,
        pointsFor: team.pointsFor || team.totalPoints || 0
      })
    })
    return recordsMap
  }, [teams])

  // Sort teams based on selected field, including comparison rows
  const sortedTeams = useMemo((): TableRow[] => {
    if (!positionalData) return []

    // Add avgRank to all teams
    const teamsWithAvgRank: TableRow[] = positionalData.teams.map(team => ({
      ...team,
      avgRank: calculateAverageRanking(team, positionalData).avgRank,
      isAverageRow: false
    }))

    // Create comparison rows based on selected modes
    const comparisonRows: TableRow[] = createComparisonRows(positionalData, comparisonModes)
    console.log('🔍 [PositionsTable] Created comparison rows:', comparisonRows.length, comparisonModes)
    const allRows: TableRow[] = [...teamsWithAvgRank, ...comparisonRows]
    console.log(`🔍 [PositionsTable] Total rows: ${allRows.length}`,
      `Teams: ${teamsWithAvgRank.length}, Comparison rows: ${comparisonRows.length}`)

    if (sortDirection && sortField) {
      allRows.sort((a, b) => {
        let aValue: number
        let bValue: number

        if (sortField === 'record') {
          // Average row should always be in middle for record sort
          if (a.isAverageRow) return 1
          if (b.isAverageRow) return -1

          // Multi-level sort: wins (desc) -> losses (asc) -> points for (desc)
          const aRecord = teamRecordsMap.get(a.franchiseId) || { wins: 0, losses: 0, pointsFor: 0 }
          const bRecord = teamRecordsMap.get(b.franchiseId) || { wins: 0, losses: 0, pointsFor: 0 }

          // Primary: wins (descending)
          if (aRecord.wins !== bRecord.wins) {
            return bRecord.wins - aRecord.wins
          }

          // Secondary: losses (ascending - fewer losses is better)
          if (aRecord.losses !== bRecord.losses) {
            return aRecord.losses - bRecord.losses
          }

          // Tertiary: points for (descending)
          return bRecord.pointsFor - aRecord.pointsFor
        } else if (sortField === 'avgRank') {
          aValue = a.avgRank
          bValue = b.avgRank
        } else if (sortField === 'teamName') {
          // Keep average row separate from alphabetical sort
          if (a.isAverageRow) return sortDirection === 'asc' ? 1 : -1
          if (b.isAverageRow) return sortDirection === 'asc' ? -1 : 1

          return sortDirection === 'asc'
            ? a.teamName.localeCompare(b.teamName)
            : b.teamName.localeCompare(a.teamName)
        } else if (sortField === 'manager') {
          // Keep average row separate from alphabetical sort
          if (a.isAverageRow) return sortDirection === 'asc' ? 1 : -1
          if (b.isAverageRow) return sortDirection === 'asc' ? -1 : 1

          return sortDirection === 'asc'
            ? a.manager.localeCompare(b.manager)
            : b.manager.localeCompare(a.manager)
        } else {
          // Position field - average row participates in numeric sorting
          const positionKey = sortField as PositionKey
          aValue = a.positionTotals[positionKey] || 0
          bValue = b.positionTotals[positionKey] || 0
        }

        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
      })
    }

    return allRows
  }, [positionalData, sortField, sortDirection, teamRecordsMap, comparisonModes])

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(current => {
        if (current === 'desc') return 'asc'
        if (current === 'asc') return 'desc'
        return 'desc'
      })
    } else {
      setSortField(field)
      // For average rank, ascending is better (lower rank = better)
      setSortDirection(field === 'avgRank' ? 'asc' : 'desc')
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
    if (ties > 0) {
      return `${wins}-${losses}-${ties}`
    }
    return `${wins}-${losses}`
  }

  const getRecordStyle = (wins: number, losses: number) => {
    if (wins > losses) {
      return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
    } else if (losses > wins) {
      return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    } else {
      return 'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    }
  }
  
  const handleExport = () => {
    if (!positionalData) return

    const exportData = preparePositionExportData(positionalData, comparisonModes)
    const csv = convertToCSV(exportData)
    downloadCSV(csv, `positional-data-${positionalData.leagueSettings.year}.csv`)
  }
  
  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return ''
    
    const headers = Object.keys(data[0])
    const csvHeaders = headers.join(',')
    const csvRows = data.map(row => 
      headers.map(header => `"${row[header]}"`).join(',')
    )
    
    return [csvHeaders, ...csvRows].join('\n')
  }
  
  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    window.URL.revokeObjectURL(url)
  }

  // Handle clicking on a position cell to show tooltip
  const handlePositionCellClick = (
    event: React.MouseEvent<HTMLSpanElement>,
    position: PositionKey,
    franchiseId: string
  ) => {
    event.stopPropagation()
    const element = event.currentTarget as HTMLElement
    setSelectedTooltip({ position, franchiseId, anchorElement: element })
  }

  // Calculate gap data for tooltip
  const tooltipGapData = useMemo((): PositionGapData | null => {
    if (!selectedTooltip || !positionalData) return null
    return calculatePositionGap(
      selectedTooltip.franchiseId,
      selectedTooltip.position,
      positionalData
    )
  }, [selectedTooltip, positionalData])


  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Loading positional data...</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              This may take a moment as we scrape detailed player data
            </p>
          </div>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-red-800 dark:text-red-200">Error Loading Positional Data</h3>
              <p className="text-red-600 dark:text-red-400 mt-1">{error}</p>
            </div>
            <button
              onClick={() => fetchPositionalData(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  if (!positionalData || positionalData.teams.length === 0) {
    // Show team records even when positional data is unavailable
    if (teams.length > 0) {
      return (
        <div className="space-y-6">
          {/* Header with message */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Team Records
            </h3>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                {positionalData?.error || 'Positional data is temporarily unavailable due to API rate limits.'}
              </p>
              <p className="text-yellow-600 dark:text-yellow-300 text-xs mt-1">
                Team records are still available below. Try refreshing in a few moments for position data.
              </p>
            </div>
          </div>

          {/* Records-only table */}
          <div className="overflow-x-auto w-full min-w-[800px]">
            <table className="w-full border border-gray-200 dark:border-gray-700">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider border-r border-blue-500">
                    <button
                      onClick={() => handleSort('record')}
                      className="flex items-center justify-center hover:text-blue-200 transition-colors"
                    >
                      Record
                      {getSortIcon('record')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider border-r border-blue-500">
                    <button
                      onClick={() => handleSort('teamName')}
                      className="flex items-center hover:text-blue-200 transition-colors"
                    >
                      Team
                      {getSortIcon('teamName')}
                    </button>
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider">
                    <button
                      onClick={() => handleSort('manager')}
                      className="flex items-center hover:text-blue-200 transition-colors"
                    >
                      Manager
                      {getSortIcon('manager')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {teams.map((team, index) => {
                  const teamRecord = teamRecordsMap.get(team.id) || { wins: 0, losses: 0, ties: 0 }
                  return (
                    <tr key={`${team.id}-${team.year}`} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-3 py-2 text-center text-sm border-r border-gray-200 dark:border-gray-700">
                        <span className={getRecordStyle(teamRecord.wins, teamRecord.losses)}>
                          {formatRecord(teamRecord.wins, teamRecord.losses, teamRecord.ties)}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-white border-r border-gray-200 dark:border-gray-700">
                        {formatTeamDisplay(team as any, { includeYear: hasMultipleYears })}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-900 dark:text-white">
                        {team.manager}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Retry button */}
          <div className="text-center">
            <button
              onClick={() => fetchPositionalData(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors inline-flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Positional Data
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <p className="text-gray-600 dark:text-gray-400">No positional data available</p>
          <button
            onClick={() => fetchPositionalData()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Load Data
          </button>
        </div>
      </div>
    )
  }
  
  // Define positions to show based on filter with correct ordering
  const offensivePositions: PositionKey[] = ['QB', 'RB', 'WR', 'TE', 'O-Flex', 'K']
  const defensivePositions: PositionKey[] = ['DL', 'LB', 'CB', 'S', 'D-Flex']
  
  let positionsToShow: PositionKey[]
  if (statFilter === 'offense') {
    positionsToShow = offensivePositions
  } else if (statFilter === 'defense') {
    positionsToShow = defensivePositions
  } else {
    positionsToShow = [...offensivePositions, ...defensivePositions]
  }
  
  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {selectedWeeks.length === 0 ? 'All Position Rankings' :
             selectedWeeks.length === 1 ? `Week ${selectedWeeks[0]} Position Rankings` :
             `Position Rankings (${selectedWeeks.length} weeks)`}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {positionalData.teams.length} teams • {positionalData.leagueSettings.year} season
            {selectedWeeks.length > 0 && (
              <span className="ml-2">• {selectedWeeks.length === 1
                ? `Week ${selectedWeeks[0]}`
                : selectedWeeks.length === 17
                  ? 'All weeks'
                  : `Weeks: ${selectedWeeks.sort((a,b) => a-b).slice(0,3).join(', ')}${selectedWeeks.length > 3 ? ` (+${selectedWeeks.length-3} more)` : ''}`
              }</span>
            )}
            {lastUpdated && (
              <span className="ml-2">• Updated {lastUpdated.toLocaleTimeString()}</span>
            )}
          </p>
        </div>

        {/* Comparison Mode Selector */}
        <div className="mx-4" style={{ minWidth: '200px', maxWidth: '250px' }}>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
            Comparison Baseline:
          </label>
          <ComparisonModeMultiSelect
            selectedModes={comparisonModes}
            onSelectionChange={setComparisonModes}
          />
        </div>

        <div className="flex space-x-2">
          <button
            onClick={handleExport}
            className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>

          <button
            onClick={() => fetchPositionalData(true)}
            className="inline-flex items-center px-3 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Team Weakness Analyzer */}
      <TeamWeaknessAnalyzer
        positionalData={positionalData}
        statFilter={statFilter}
      />

      {/* View Tabs */}
      <PositionViewTabs
        activeView={activeView}
        onViewChange={setActiveView}
      />

      {/* Conditional View Rendering */}
      {activeView === 'rankings' && (
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
              
              <th className="px-3 py-2 text-center text-xs font-medium uppercase tracking-wider">
                <button
                  onClick={() => handleSort('avgRank')}
                  className="flex items-center justify-center hover:text-blue-200 transition-colors"
                >
                  Avg Rank
                  {getSortIcon('avgRank')}
                </button>
              </th>
            </tr>
          </thead>
          
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedTeams.map((team: TableRow, index) => {
              const isComparison = team.isAverageRow
              const avgRankData = isComparison ? { avgRank: team.avgRank } : calculateAverageRanking(team, positionalData)
              const teamRecord = teamRecordsMap.get(team.franchiseId) || { wins: 0, losses: 0, ties: 0 }

              // Debug logging for comparison rows
              if (isComparison) {
                console.log('🟡 [PositionsTable] Rendering comparison row at index:', index, team.comparisonType, team)
              }

              // Special styling for comparison rows based on type
              let rowClass = 'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
              if (isComparison && team.comparisonType) {
                rowClass = `comparison-row-${team.comparisonType} hover:opacity-90 transition-all`
              }

              return (
                <tr
                  key={`${team.franchiseId}-${team.year}`}
                  className={rowClass}
                >
                  <td className="px-3 py-2 text-center text-sm border-r border-gray-200 dark:border-gray-700 min-w-24">
                    {isComparison ? (
                      <span className="inline-flex items-center justify-center font-medium">
                        ---
                      </span>
                    ) : (
                      <span className={getRecordStyle(teamRecord.wins, teamRecord.losses)}>
                        {formatRecord(teamRecord.wins, teamRecord.losses, teamRecord.ties)}
                      </span>
                    )}
                  </td>

                  <td className={`px-3 py-2 text-sm border-r border-gray-200 dark:border-gray-700 min-w-48 ${isComparison ? 'font-bold' : 'font-medium text-gray-900 dark:text-white'}`}>
                    {isComparison ? (
                      <span className="inline-flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        {team.teamName}
                      </span>
                    ) : (
                      formatTeamDisplay(team as any, { includeYear: hasMultipleYears })
                    )}
                  </td>

                  <td className={`px-3 py-2 text-sm border-r border-gray-200 dark:border-gray-700 min-w-36 ${isComparison ? 'font-medium' : 'text-gray-900 dark:text-white'}`}>
                    {team.manager}
                  </td>

                  {positionsToShow.map(position => {
                    if (isComparison) {
                      // For comparison rows, show the comparison points with special styling
                      const comparisonPoints = team.positionTotals[position]
                      const comparisonRank = (positionalData.teams.length + 1) / 2

                      // Dynamic colors based on comparison type
                      let badgeClass = 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                      if (team.comparisonType === 'median') {
                        badgeClass = 'bg-purple-200 text-purple-900 dark:bg-purple-800 dark:text-purple-100'
                      } else if (team.comparisonType === 'trimmedMean') {
                        badgeClass = 'bg-teal-200 text-teal-900 dark:bg-teal-800 dark:text-teal-100'
                      }

                      return (
                        <td key={position} className="px-3 py-2 text-center text-sm border-r border-gray-200 dark:border-gray-700">
                          <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-bold ${badgeClass}`}>
                            {formatPositionDisplay(comparisonRank, comparisonPoints)}
                          </span>
                        </td>
                      )
                    }

                    const positionRanking = positionalData.positionRankings[position]
                    const teamRanking = positionRanking?.find(r => r.franchiseId === team.franchiseId)

                    if (!teamRanking) {
                      return (
                        <td key={position} className="px-3 py-2 text-center text-sm border-r border-gray-200 dark:border-gray-700">
                          <span className="text-gray-400">-</span>
                        </td>
                      )
                    }

                    const colorClass = getPositionColorClass(teamRanking.rank, positionalData.teams.length)

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
                          {formatPositionDisplay(teamRanking.rank, teamRanking.points)}
                        </span>
                      </td>
                    )
                  })}

                  <td className="px-3 py-2 text-center text-sm">
                    {isComparison ? (
                      (() => {
                        // Dynamic colors for avg rank cell based on comparison type
                        let badgeClass = 'bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100'
                        if (team.comparisonType === 'median') {
                          badgeClass = 'bg-purple-200 text-purple-900 dark:bg-purple-800 dark:text-purple-100'
                        } else if (team.comparisonType === 'trimmedMean') {
                          badgeClass = 'bg-teal-200 text-teal-900 dark:bg-teal-800 dark:text-teal-100'
                        }
                        return (
                          <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-medium ${badgeClass} font-bold`}>
                            {formatDecimal(avgRankData.avgRank)}
                          </span>
                        )
                      })()
                    ) : (
                      <span className="inline-flex items-center justify-center px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                        {formatDecimal(avgRankData.avgRank)}
                      </span>
                    )}
                  </td>
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
      )}

      {/* Points Behind View */}
      {activeView === 'gaps' && (
        <PointsBehindView
          positionalData={positionalData}
          teamRecordsMap={teamRecordsMap}
          statFilter={statFilter}
          hasMultipleYears={hasMultipleYears}
        />
      )}

      {/* Percentile View */}
      {activeView === 'percentile' && (
        <PercentileView
          positionalData={positionalData}
          teamRecordsMap={teamRecordsMap}
          statFilter={statFilter}
          hasMultipleYears={hasMultipleYears}
        />
      )}
    </div>
  )
}