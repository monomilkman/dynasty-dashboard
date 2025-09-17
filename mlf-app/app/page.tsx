'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Team } from '@/lib/mfl'
import { getAvailableYears, getCurrentYear } from '@/lib/utils'
import Leaderboard from './components/Leaderboard'
import YearMultiSelect from './components/YearMultiSelect'
import WeekMultiSelect from './components/WeekMultiSelect'
import ThemeToggle from './components/ThemeToggle'
import TeamChart from './components/TeamChart'
import PositionsTable from './components/PositionsTable'
import ManagerMultiSelect from './components/ManagerMultiSelect'
import MatchupsTable from './components/MatchupsTable'
import RankingsTable from './components/RankingsTable'
import HeadToHeadComparison from './components/HeadToHeadComparison'
import SeasonBreakdownTable from './components/SeasonBreakdownTable'
import ExportButton from './components/ExportButton'
import { 
  exportTeamsData, 
  exportMatchupsData, 
  exportPositionalData, 
  exportChartData,
  exportComparisonData,
  ExportOptions 
} from '@/lib/export-utils'

// Available years (dynamically calculated) - moved outside component to prevent re-creation
const availableYears = getAvailableYears(2021) // League started in 2021
const currentYear = getCurrentYear()

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedYears, setSelectedYears] = useState<number[]>([currentYear])
  const [selectedWeeks, setSelectedWeeks] = useState<number[]>([]) // Empty array means all weeks
  const [isLoading, setIsLoading] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState<{ current: number; total: number; year?: number }>({ current: 0, total: 0 })
  const [error, setError] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<'table' | 'charts' | 'positions' | 'matchups' | 'rankings' | 'comparison' | 'breakdown'>('table')
  const [selectedManagers, setSelectedManagers] = useState<string[]>([])
  const [statFilter, setStatFilter] = useState<'all' | 'offense' | 'defense'>('all')

  const fetchTeams = useCallback(async () => {
    try {
      setError(null)
      
      // Determine which years to fetch
      const yearsToFetch = selectedYears.length === 0 ? availableYears : selectedYears
      
      // Initialize progress tracking
      setLoadingProgress({ current: 0, total: yearsToFetch.length })
      
      const allTeamsData: Team[] = []
      
      // Fetch data for each year sequentially with delays to prevent rate limiting
      for (let i = 0; i < yearsToFetch.length; i++) {
        const year = yearsToFetch[i]
        
        // Update progress
        setLoadingProgress({ current: i, total: yearsToFetch.length, year })
        
        try {
          // Build API URL with week filtering if applicable
          const weeksParam = selectedWeeks.length > 0 ? `&weeks=${selectedWeeks.join(',')}` : ''
          const apiUrl = `/api/mfl?year=${year}${weeksParam}`
          
          const response = await fetch(apiUrl)
          
          if (!response.ok) {
            if (response.status === 429) {
              console.warn(`Rate limit hit for ${year}, waiting before retry...`)
              // Wait longer on rate limit and retry once
              await new Promise(resolve => setTimeout(resolve, 2000))
              const retryResponse = await fetch(apiUrl)
              if (!retryResponse.ok) {
                throw new Error(`Rate limit exceeded for ${year}. Please try again later.`)
              }
              const retryData = await retryResponse.json()
              if (Array.isArray(retryData) && retryData.length > 0) {
                const teamsWithYear = retryData.map((team: Team) => ({
                  ...team,
                  year: team.year || year
                }))
                allTeamsData.push(...teamsWithYear)
              }
            } else if (response.status >= 500) {
              console.warn(`Server error for ${year}, skipping...`)
              // Skip this year but continue with others
              continue
            } else {
              throw new Error(`Failed to fetch team data for ${year} (${response.status})`)
            }
          } else {
            const data = await response.json()
            
            if (data.error) {
              console.warn(`API error for ${year}: ${data.details || data.error}`)
              continue
            }
            
            if (Array.isArray(data) && data.length > 0) {
              // Add year to each team if not already present
              const teamsWithYear = data.map((team: Team) => ({
                ...team,
                year: team.year || year
              }))
              allTeamsData.push(...teamsWithYear)
            }
          }
        } catch (yearError) {
          console.warn(`Error fetching ${year}:`, yearError)
          // Continue with other years even if one fails
        }
        
        // Add delay between requests to prevent rate limiting (except for last request)
        if (i < yearsToFetch.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500)) // 500ms delay between requests
        }
      }
      
      // Final progress update
      setLoadingProgress({ current: yearsToFetch.length, total: yearsToFetch.length })
      
      if (allTeamsData.length === 0) {
        throw new Error('No team data available for the selected years.')
      }
      
      // Sort by year (descending) then by total points (descending)
      allTeamsData.sort((a, b) => {
        if (a.year !== b.year) {
          return b.year - a.year
        }
        return b.totalPoints - a.totalPoints
      })
      
      setTeams(allTeamsData)
    } catch (error) {
      console.error('Error fetching teams:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setError(`Failed to load team data: ${errorMessage}`)
      setTeams([])
    } finally {
      setIsLoading(false)
      setLoadingProgress({ current: 0, total: 0 })
    }
  }, [selectedYears, selectedWeeks])

  useEffect(() => {
    // Debounce the API call to prevent rapid requests when user changes selections
    const timeoutId = setTimeout(() => {
      setIsLoading(true)
      fetchTeams()
    }, 300) // 300ms delay
    
    return () => clearTimeout(timeoutId)
  }, [selectedYears, fetchTeams])

  const handleRefresh = async () => {
    await fetchTeams()
  }

  const handleExport = (options: ExportOptions) => {
    switch (activeView) {
      case 'table':
        exportTeamsData(filteredTeams, options)
        break
      case 'positions':
        exportPositionalData(filteredTeams, statFilter, options)
        break
      case 'matchups':
        exportMatchupsData(filteredTeams, options)
        break
      case 'rankings':
        // For rankings, export the teams data with ranking context
        exportTeamsData(filteredTeams, options)
        break
      case 'charts':
        // For charts, we'll export the current chart data
        const chartType = statFilter === 'defense' ? 'defensePoints' : 
                         statFilter === 'offense' ? 'offensePoints' : 'totalPoints'
        exportChartData(filteredTeams, chartType, options)
        break
      case 'comparison':
        // For comparison view, export all teams data for reference
        exportTeamsData(filteredTeams, options)
        break
      default:
        exportTeamsData(filteredTeams, options)
    }
  }

  // Get unique managers from teams
  const managers = useMemo(() => {
    const uniqueManagers = [...new Set(teams.map(team => team.manager))]
    return uniqueManagers.sort()
  }, [teams])

  // Filter teams based on selected managers
  const filteredTeams = useMemo(() => {
    if (selectedManagers.length === 0) {
      return teams
    }
    return teams.filter(team => selectedManagers.includes(team.manager))
  }, [teams, selectedManagers])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-blue-600 dark:bg-blue-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">MyFantasyLeague Stats Tracker</h1>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Controls Section */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Data Controls */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Data Controls</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Select Years:</label>
                  <YearMultiSelect 
                    availableYears={availableYears}
                    selectedYears={selectedYears} 
                    onSelectionChange={setSelectedYears}
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Select Weeks:</label>
                  <WeekMultiSelect
                    selectedWeeks={selectedWeeks}
                    onSelectionChange={setSelectedWeeks}
                    year={selectedYears[0] || new Date().getFullYear()}
                  />
                </div>
              </div>
            </div>

            {/* View Options */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">View Options</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Manager Filter:</label>
                  <ManagerMultiSelect
                    managers={managers}
                    selectedManagers={selectedManagers}
                    onSelectionChange={setSelectedManagers}
                  />
                </div>
              </div>
            </div>

            {/* Additional Options */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Display Options</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Stat Type:</label>
                  <select 
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    value={statFilter}
                    onChange={(e) => setStatFilter(e.target.value as 'all' | 'offense' | 'defense')}
                  >
                    <option value="all">All Stats</option>
                    <option value="offense">Offense Only</option>
                    <option value="defense">Defense Only</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <nav className="flex space-x-8">
            <button 
              onClick={() => setActiveView('table')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeView === 'table' 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Table View
            </button>
            <button 
              onClick={() => setActiveView('charts')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeView === 'charts' 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Charts View
            </button>
            <button 
              onClick={() => setActiveView('positions')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeView === 'positions' 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Positions View
            </button>
            <button 
              onClick={() => setActiveView('matchups')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeView === 'matchups' 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Matchups & Records
            </button>
            <button 
              onClick={() => setActiveView('rankings')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeView === 'rankings' 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Rankings
            </button>
            <button 
              onClick={() => setActiveView('comparison')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeView === 'comparison' 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Compare Teams
            </button>
            <button 
              onClick={() => setActiveView('breakdown')}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeView === 'breakdown' 
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400' 
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Season Breakdown
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {activeView === 'table' ? 'All Statistics' : 
                 activeView === 'charts' ? 'Team Performance Charts' : 
                 activeView === 'positions' ? 'Positional Statistics' : 
                 activeView === 'rankings' ? 'Team Rankings' : 
                 activeView === 'comparison' ? 'Team Comparison' :
                 activeView === 'breakdown' ? 'Regular Season vs Postseason Performance' :
                 'Matchups & Records'}
              </h2>
              <div className="flex items-center space-x-4">
                <ExportButton 
                  onExport={handleExport}
                  disabled={isLoading || filteredTeams.length === 0}
                  label="Export"
                />
                <div className="text-sm text-gray-600 dark:text-gray-400">
                {selectedManagers.length > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 mr-2">
                    {selectedManagers.length === 1 
                      ? `Manager: ${selectedManagers[0]}`
                      : `${selectedManagers.length} managers selected`
                    }
                  </span>
                )}
                {selectedWeeks.length > 0 && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 mr-2">
                    {selectedWeeks.length === 1 
                      ? `Week ${selectedWeeks[0]}` 
                      : selectedWeeks.length === 17 
                        ? 'All Weeks'
                        : `${selectedWeeks.length} weeks selected`
                    }
                  </span>
                )}
                {statFilter !== 'all' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 mr-2">
                    {statFilter === 'offense' ? 'Offensive Stats Only' : 'Defensive Stats Only'}
                  </span>
                )}
                <span className="text-gray-500 dark:text-gray-400">
                  Showing {filteredTeams.length} {filteredTeams.length === 1 ? 'team' : 'teams'}
                </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="p-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-4 text-gray-600 dark:text-gray-400">Loading team data...</p>
                  
                  {loadingProgress.total > 0 && (
                    <div className="mt-4 w-80 mx-auto">
                      <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <span>Progress</span>
                        <span>{loadingProgress.current}/{loadingProgress.total} years</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max((loadingProgress.current / loadingProgress.total) * 100, 0)}%` }}
                        ></div>
                      </div>
                      {loadingProgress.year && (
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          Currently fetching {loadingProgress.year} season data...
                        </div>
                      )}
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                    {loadingProgress.total > 1 ? 'Loading multiple seasons with rate limiting...' : 'Fetching latest standings and statistics'}
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="text-red-600 dark:text-red-400 mb-2">⚠️</div>
                  <p className="text-red-700 dark:text-red-300 font-medium">Error Loading Data</p>
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">{error}</p>
                </div>
              </div>
            ) : activeView === 'table' ? (
              <Leaderboard teams={filteredTeams} selectedWeeks={selectedWeeks} />
            ) : activeView === 'positions' ? (
              <PositionsTable teams={filteredTeams} statFilter={statFilter} selectedWeeks={selectedWeeks} />
            ) : activeView === 'matchups' ? (
              <MatchupsTable teams={filteredTeams} selectedWeeks={selectedWeeks} />
            ) : activeView === 'rankings' ? (
              <RankingsTable teams={filteredTeams} />
            ) : activeView === 'comparison' ? (
              <HeadToHeadComparison teams={filteredTeams} selectedWeeks={selectedWeeks} />
            ) : activeView === 'breakdown' ? (
              <SeasonBreakdownTable teams={filteredTeams} />
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <TeamChart teams={filteredTeams} chartType="totalPoints" selectedWeeks={selectedWeeks} />
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <TeamChart teams={filteredTeams} chartType={statFilter === 'defense' ? 'defensePoints' : 'offensePoints'} selectedWeeks={selectedWeeks} />
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <TeamChart teams={filteredTeams} chartType={statFilter === 'offense' ? 'startersPoints' : statFilter === 'defense' ? 'defensePoints' : 'potentialPoints'} selectedWeeks={selectedWeeks} />
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <TeamChart teams={filteredTeams} chartType="efficiency" selectedWeeks={selectedWeeks} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Data sourced from MyFantasyLeague.com
          </p>
        </div>
      </main>
    </div>
  )
}