'use client'

import { useState, useMemo } from 'react'
import { Team } from '@/lib/mfl'
import { Crown, TrendingUp, TrendingDown, Medal, Target, Shield, BarChart3, ToggleLeft, ToggleRight } from 'lucide-react'
import { 
  getAllRankingCategories, 
  getRankingBadgeStyle, 
  formatRankingValue 
} from '@/lib/rankings-calc'
import { formatTeamDisplay, getUniqueYears, groupTeamsByYear } from '@/lib/team-utils'

interface RankingsTableProps {
  teams: Team[]
}

const categoryIcons: { [key: string]: React.ComponentType<{className?: string}> } = {
  power: Crown,
  wins: Medal,
  total: BarChart3,
  efficiency: Target,
  offense: TrendingUp,
  defense: Shield,
  differential: TrendingUp
}

export default function RankingsTable({ teams }: RankingsTableProps) {
  const [selectedCategory, setSelectedCategory] = useState('power')
  const [isPerYearMode, setIsPerYearMode] = useState(false)

  const uniqueYears = useMemo(() => getUniqueYears(teams), [teams])
  const hasMultipleYears = uniqueYears.length > 1

  const rankingCategories = useMemo(() => {
    if (isPerYearMode && hasMultipleYears) {
      // Group teams by year and get rankings for each year
      const teamsByYear = groupTeamsByYear(teams)
      const categoriesByYear: { [year: number]: any[] } = {}
      
      Object.entries(teamsByYear).forEach(([year, yearTeams]) => {
        categoriesByYear[parseInt(year)] = getAllRankingCategories(yearTeams)
      })
      
      // Find the selected category for display
      const firstYear = uniqueYears[0]
      const firstYearCategories = categoriesByYear[firstYear] || []
      return firstYearCategories.map(category => ({
        ...category,
        yearlyRankings: categoriesByYear
      }))
    } else {
      return getAllRankingCategories(teams)
    }
  }, [teams, isPerYearMode, hasMultipleYears, uniqueYears])

  const currentCategory = rankingCategories.find(cat => cat.id === selectedCategory)

  if (!currentCategory) {
    return <div>No ranking data available</div>
  }

  return (
    <div className="space-y-6">
      {/* Category Selector */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                <Crown className="mr-2 h-5 w-5 text-yellow-500" />
                Team Rankings
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Comprehensive team rankings across multiple performance metrics
              </p>
            </div>
            {hasMultipleYears && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Combined</span>
                <button
                  onClick={() => setIsPerYearMode(!isPerYearMode)}
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title={isPerYearMode ? 'Switch to combined rankings' : 'Switch to per-year rankings'}
                >
                  {isPerYearMode ? (
                    <ToggleRight className="h-6 w-6 text-blue-500" />
                  ) : (
                    <ToggleLeft className="h-6 w-6 text-gray-400" />
                  )}
                </button>
                <span className="text-sm text-gray-600 dark:text-gray-400">Per Year</span>
              </div>
            )}
          </div>
        </div>

        <nav className="flex space-x-8 overflow-x-auto">
          {rankingCategories.map((category) => {
            const Icon = categoryIcons[category.id]
            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors flex items-center ${
                  selectedCategory === category.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {category.name}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Current Category Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
        <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-1">
          {currentCategory.name}
        </h4>
        <p className="text-sm text-blue-700 dark:text-blue-300">
          {currentCategory.description}
        </p>
      </div>

      {/* Rankings Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-blue-600 text-white">
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                Rank
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Team
              </th>
              {hasMultipleYears && (
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                  Year
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider">
                Manager
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                Value
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider">
                Tier
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isPerYearMode && hasMultipleYears && currentCategory?.yearlyRankings ? (
              // Per-year rankings mode
              uniqueYears.map(year => {
                const yearCategory = currentCategory.yearlyRankings[year]?.find((cat: any) => cat.id === selectedCategory)
                if (!yearCategory) return null
                
                return yearCategory.rankings.map((ranking: any, index: number) => {
                  const badgeStyle = getRankingBadgeStyle(ranking.rank, yearCategory.rankings.length)
                  const team = teams.find(t => t.id === ranking.teamId && t.year === year)
                  
                  return (
                    <tr 
                      key={`${ranking.teamId}-${year}`}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                          ${ranking.rank <= 3 
                            ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' 
                            : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                          }
                        `}>
                          {ranking.rank}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                        <div className="flex items-center">
                          {ranking.rank === 1 && (
                            <Crown className="h-4 w-4 text-yellow-500 mr-2" />
                          )}
                          {ranking.rank === 2 && (
                            <Medal className="h-4 w-4 text-gray-400 mr-2" />
                          )}
                          {ranking.rank === 3 && (
                            <Medal className="h-4 w-4 text-amber-600 mr-2" />
                          )}
                          {team ? formatTeamDisplay(team, { includeYear: false }) : ranking.teamName}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white font-medium">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {year}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {ranking.manager}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white font-bold">
                        {formatRankingValue(ranking.value, selectedCategory)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeStyle}`}>
                          {ranking.rank <= Math.ceil(yearCategory.rankings.length / 3) ? 'Top Tier' :
                           ranking.rank <= Math.ceil((yearCategory.rankings.length * 2) / 3) ? 'Middle Tier' : 'Bottom Tier'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              }).flat().filter(Boolean)
            ) : (
              // Combined rankings mode (default)
              currentCategory.rankings.map((ranking: any) => {
                const badgeStyle = getRankingBadgeStyle(ranking.rank, teams.length)
                const team = teams.find(t => t.id === ranking.teamId)
                
                return (
                  <tr 
                    key={`${ranking.teamId}-${team?.year || 'unknown'}`}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                        ${ranking.rank <= 3 
                          ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' 
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                        }
                      `}>
                        {ranking.rank}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                      <div className="flex items-center">
                        {ranking.rank === 1 && (
                          <Crown className="h-4 w-4 text-yellow-500 mr-2" />
                        )}
                        {ranking.rank === 2 && (
                          <Medal className="h-4 w-4 text-gray-400 mr-2" />
                        )}
                        {ranking.rank === 3 && (
                          <Medal className="h-4 w-4 text-amber-600 mr-2" />
                        )}
                        {team ? formatTeamDisplay(team, { includeYear: !hasMultipleYears }) : ranking.teamName}
                      </div>
                    </td>
                    {hasMultipleYears && (
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white font-medium">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                          {team?.year || 'N/A'}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                      {ranking.manager}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 dark:text-white font-bold">
                      {formatRankingValue(ranking.value, selectedCategory)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${badgeStyle}`}>
                        {ranking.rank <= Math.ceil(teams.length / 3) ? 'Top Tier' :
                         ranking.rank <= Math.ceil((teams.length * 2) / 3) ? 'Middle Tier' : 'Bottom Tier'}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Rankings Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <Crown className="h-8 w-8 text-green-500 mr-3" />
            <div>
              <p className="text-sm text-green-700 dark:text-green-300">Top Performer</p>
              <p className="text-lg font-bold text-green-800 dark:text-green-200">
                {currentCategory.rankings[0]?.teamName}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                {formatRankingValue(currentCategory.rankings[0]?.value || 0, selectedCategory)}
              </p>
            </div>
          </div>
        </div>
        
        <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-yellow-500 mr-3" />
            <div>
              <p className="text-sm text-yellow-700 dark:text-yellow-300">Average Value</p>
              <p className="text-lg font-bold text-yellow-800 dark:text-yellow-200">
                {formatRankingValue(
                  currentCategory.rankings.reduce((sum: number, r: any) => sum + r.value, 0) / currentCategory.rankings.length,
                  selectedCategory
                )}
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">
                League Average
              </p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <div className="flex items-center">
            <TrendingDown className="h-8 w-8 text-red-500 mr-3" />
            <div>
              <p className="text-sm text-red-700 dark:text-red-300">Needs Improvement</p>
              <p className="text-lg font-bold text-red-800 dark:text-red-200">
                {currentCategory.rankings[currentCategory.rankings.length - 1]?.teamName}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">
                {formatRankingValue(
                  currentCategory.rankings[currentCategory.rankings.length - 1]?.value || 0,
                  selectedCategory
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">
          {currentCategory.name} Distribution
        </h4>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {Math.ceil(teams.length / 3)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Top Tier Teams</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {Math.ceil((teams.length * 2) / 3) - Math.ceil(teams.length / 3)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Middle Tier Teams</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {teams.length - Math.ceil((teams.length * 2) / 3)}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Bottom Tier Teams</div>
          </div>
        </div>
      </div>
    </div>
  )
}