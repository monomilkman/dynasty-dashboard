'use client'

import { useState, useMemo } from 'react'
import { Team } from '@/lib/mfl'
import { 
  Users, 
  Trophy, 
  Target, 
  TrendingUp, 
  TrendingDown, 
  Shield, 
  BarChart3,
  Minus,
  Plus,
  Download
} from 'lucide-react'
import { exportComparisonData, ExportOptions } from '@/lib/export-utils'
import { formatTeamDisplay, getUniqueYears, groupTeamsByYear } from '@/lib/team-utils'
import { formatPoints, formatPercentage, formatDecimal } from '@/lib/utils'

interface HeadToHeadComparisonProps {
  teams: Team[]
  selectedWeeks: number[]
}

interface ComparisonStat {
  label: string
  key: keyof Team
  format: (value: number) => string
  icon: React.ComponentType<{className?: string}>
  category: 'performance' | 'scoring' | 'record'
}

const comparisonStats: ComparisonStat[] = [
  // Performance Stats
  { label: 'Total Points', key: 'totalPoints', format: (v) => v.toFixed(2), icon: BarChart3, category: 'performance' },
  { label: 'Potential Points', key: 'potentialPoints', format: (v) => v.toFixed(2), icon: Target, category: 'performance' },
  { label: 'Starter Points', key: 'startersPoints', format: (v) => v.toFixed(2), icon: TrendingUp, category: 'performance' },
  { label: 'Bench Points', key: 'benchPoints', format: (v) => v.toFixed(2), icon: Minus, category: 'performance' },
  
  // Scoring Breakdown
  { label: 'Offense Points', key: 'offensePoints', format: (v) => v.toFixed(2), icon: TrendingUp, category: 'scoring' },
  { label: 'Defense Points', key: 'defensePoints', format: (v) => v.toFixed(2), icon: Shield, category: 'scoring' },
  { label: 'QB Points', key: 'qbPoints', format: (v) => v.toFixed(2), icon: BarChart3, category: 'scoring' },
  { label: 'RB Points', key: 'rbPoints', format: (v) => v.toFixed(2), icon: BarChart3, category: 'scoring' },
  { label: 'WR Points', key: 'wrPoints', format: (v) => v.toFixed(2), icon: BarChart3, category: 'scoring' },
  { label: 'TE Points', key: 'tePoints', format: (v) => v.toFixed(2), icon: BarChart3, category: 'scoring' },
  { label: 'K Points', key: 'kPoints', format: (v) => v.toFixed(2), icon: BarChart3, category: 'scoring' },
  { label: 'DL Points', key: 'dlPoints', format: (v) => v.toFixed(2), icon: Shield, category: 'scoring' },
  { label: 'LB Points', key: 'lbPoints', format: (v) => v.toFixed(2), icon: Shield, category: 'scoring' },
  { label: 'CB Points', key: 'cbPoints', format: (v) => v.toFixed(2), icon: Shield, category: 'scoring' },
  { label: 'S Points', key: 'sPoints', format: (v) => v.toFixed(2), icon: Shield, category: 'scoring' },
  { label: 'Offense Flex Points', key: 'offenseFlexPoints', format: (v) => v.toFixed(2), icon: TrendingUp, category: 'scoring' },
  { label: 'Defense Flex Points', key: 'defenseFlexPoints', format: (v) => v.toFixed(2), icon: Shield, category: 'scoring' },
  
  // Record Stats
  { label: 'Wins', key: 'wins', format: (v) => v.toString(), icon: Trophy, category: 'record' },
  { label: 'Losses', key: 'losses', format: (v) => v.toString(), icon: TrendingDown, category: 'record' },
  { label: 'Win %', key: 'winPercentage', format: (v) => formatPercentage(v * 100), icon: Trophy, category: 'record' },
  { label: 'Points For', key: 'pointsFor', format: (v) => v.toFixed(2), icon: Plus, category: 'record' },
  { label: 'Points Against', key: 'pointsAgainst', format: (v) => v.toFixed(2), icon: Minus, category: 'record' },
]

export default function HeadToHeadComparison({ teams, selectedWeeks }: HeadToHeadComparisonProps) {
  const [selectedTeam1, setSelectedTeam1] = useState<string>('')
  const [selectedTeam2, setSelectedTeam2] = useState<string>('')
  const [selectedTeam3, setSelectedTeam3] = useState<string>('')
  const [activeCategory, setActiveCategory] = useState<'all' | 'performance' | 'scoring' | 'record'>('all')
  const [includeThirdTeam, setIncludeThirdTeam] = useState<boolean>(false)
  
  const uniqueYears = useMemo(() => getUniqueYears(teams), [teams])
  const hasMultipleYears = uniqueYears.length > 1
  const teamsByYear = useMemo(() => groupTeamsByYear(teams), [teams])

  // Get team data for comparison - handle team IDs that include year
  const team1 = useMemo(() => {
    if (!selectedTeam1) return null
    if (selectedTeam1.includes('-')) {
      const [teamId, year] = selectedTeam1.split('-')
      return teams.find(t => t.id === teamId && t.year === parseInt(year))
    }
    return teams.find(t => t.id === selectedTeam1)
  }, [teams, selectedTeam1])
  
  const team2 = useMemo(() => {
    if (!selectedTeam2) return null
    if (selectedTeam2.includes('-')) {
      const [teamId, year] = selectedTeam2.split('-')
      return teams.find(t => t.id === teamId && t.year === parseInt(year))
    }
    return teams.find(t => t.id === selectedTeam2)
  }, [teams, selectedTeam2])
  
  const team3 = useMemo(() => {
    if (!includeThirdTeam || !selectedTeam3) return null
    if (selectedTeam3.includes('-')) {
      const [teamId, year] = selectedTeam3.split('-')
      return teams.find(t => t.id === teamId && t.year === parseInt(year))
    }
    return teams.find(t => t.id === selectedTeam3)
  }, [teams, selectedTeam3, includeThirdTeam])

  // Filter stats based on category
  const filteredStats = useMemo(() => {
    if (activeCategory === 'all') return comparisonStats
    return comparisonStats.filter(stat => stat.category === activeCategory)
  }, [activeCategory])

  // Calculate advantage for each stat (supports 2-3 teams)
  const getBestTeam = (stat: ComparisonStat, values: { team1: number, team2: number, team3?: number }): 'team1' | 'team2' | 'team3' | 'tie' => {
    const { team1: val1, team2: val2, team3: val3 } = values
    
    // For losses and points against, lower is better
    if (stat.key === 'losses' || stat.key === 'pointsAgainst') {
      if (val3 !== undefined) {
        // 3-team comparison
        const minVal = Math.min(val1, val2, val3)
        const winners = []
        if (val1 === minVal) winners.push('team1')
        if (val2 === minVal) winners.push('team2')
        if (val3 === minVal) winners.push('team3')
        return winners.length > 1 ? 'tie' : winners[0] as 'team1' | 'team2' | 'team3'
      } else {
        // 2-team comparison
        if (val1 === val2) return 'tie'
        return val1 < val2 ? 'team1' : 'team2'
      }
    } else {
      // For all other stats, higher is better
      if (val3 !== undefined) {
        // 3-team comparison
        const maxVal = Math.max(val1, val2, val3)
        const winners = []
        if (val1 === maxVal) winners.push('team1')
        if (val2 === maxVal) winners.push('team2')
        if (val3 === maxVal) winners.push('team3')
        return winners.length > 1 ? 'tie' : winners[0] as 'team1' | 'team2' | 'team3'
      } else {
        // 2-team comparison
        if (val1 === val2) return 'tie'
        return val1 > val2 ? 'team1' : 'team2'
      }
    }
  }

  const canCompare = team1 && team2 && selectedTeam1 !== selectedTeam2 && 
                     (!includeThirdTeam || (team3 && selectedTeam3 !== selectedTeam1 && selectedTeam3 !== selectedTeam2))

  // Handle comparison export
  const handleExport = (format: 'csv' | 'json') => {
    if (!canCompare) return
    
    const options: ExportOptions = {
      format,
      includeHeaders: true
    }
    
    exportComparisonData(team1, team2, team3 || undefined, options)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex items-center justify-center mb-4">
          <Users className="h-8 w-8 text-blue-500 mr-3" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Head-to-Head Comparison
          </h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Compare two teams side-by-side across all statistical categories
          {selectedWeeks.length > 0 && (
            <span className="block mt-1 text-sm">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                {selectedWeeks.length === 1 
                  ? `Week ${selectedWeeks[0]} Data` 
                  : selectedWeeks.length === 17 
                    ? 'All Weeks Data'
                    : `${selectedWeeks.length} Selected Weeks Data`
                }
              </span>
            </span>
          )}
        </p>
      </div>

      {/* Team Selection */}
      <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Select Teams to Compare
          </h3>
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={includeThirdTeam}
              onChange={(e) => {
                setIncludeThirdTeam(e.target.checked)
                if (!e.target.checked) setSelectedTeam3('')
              }}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">Add 3rd team</span>
          </label>
        </div>
        
        <div className={`grid grid-cols-1 gap-6 ${includeThirdTeam ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          {/* Team 1 Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Team 1
            </label>
            <select 
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={selectedTeam1}
              onChange={(e) => setSelectedTeam1(e.target.value)}
            >
              <option value="">Select first team...</option>
              {hasMultipleYears ? (
                uniqueYears.map(year => (
                  <optgroup key={year} label={`${year} Season`}>
                    {teamsByYear[year]?.map(team => {
                      const teamKey = hasMultipleYears ? `${team.id}-${team.year}` : team.id
                      return (
                        <option 
                          key={`${team.id}-${team.year}`} 
                          value={teamKey} 
                          disabled={teamKey === selectedTeam2 || teamKey === selectedTeam3}
                        >
                          {formatTeamDisplay(team, { includeManager: true, includeYear: false })}
                        </option>
                      )
                    })}
                  </optgroup>
                ))
              ) : (
                teams.map(team => {
                  const teamKey = team.id
                  return (
                    <option 
                      key={`${team.id}-${team.year}`} 
                      value={teamKey} 
                      disabled={teamKey === selectedTeam2 || teamKey === selectedTeam3}
                    >
                      {formatTeamDisplay(team, { includeManager: true, includeYear: false })}
                    </option>
                  )
                })
              )}
            </select>
          </div>

          {/* Team 2 Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Team 2
            </label>
            <select 
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              value={selectedTeam2}
              onChange={(e) => setSelectedTeam2(e.target.value)}
            >
              <option value="">Select second team...</option>
              {hasMultipleYears ? (
                uniqueYears.map(year => (
                  <optgroup key={year} label={`${year} Season`}>
                    {teamsByYear[year]?.map(team => {
                      const teamKey = hasMultipleYears ? `${team.id}-${team.year}` : team.id
                      return (
                        <option 
                          key={`${team.id}-${team.year}`} 
                          value={teamKey} 
                          disabled={teamKey === selectedTeam1 || teamKey === selectedTeam3}
                        >
                          {formatTeamDisplay(team, { includeManager: true, includeYear: false })}
                        </option>
                      )
                    })}
                  </optgroup>
                ))
              ) : (
                teams.map(team => {
                  const teamKey = team.id
                  return (
                    <option 
                      key={`${team.id}-${team.year}`} 
                      value={teamKey} 
                      disabled={teamKey === selectedTeam1 || teamKey === selectedTeam3}
                    >
                      {formatTeamDisplay(team, { includeManager: true, includeYear: false })}
                    </option>
                  )
                })
              )}
            </select>
          </div>

          {/* Team 3 Selection */}
          {includeThirdTeam && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Team 3
              </label>
              <select 
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                value={selectedTeam3}
                onChange={(e) => setSelectedTeam3(e.target.value)}
              >
                <option value="">Select third team...</option>
                {hasMultipleYears ? (
                  uniqueYears.map(year => (
                    <optgroup key={year} label={`${year} Season`}>
                      {teamsByYear[year]?.map(team => {
                        const teamKey = hasMultipleYears ? `${team.id}-${team.year}` : team.id
                        return (
                          <option 
                            key={`${team.id}-${team.year}`} 
                            value={teamKey} 
                            disabled={teamKey === selectedTeam1 || teamKey === selectedTeam2}
                          >
                            {formatTeamDisplay(team, { includeManager: true, includeYear: false })}
                          </option>
                        )
                      })}
                    </optgroup>
                  ))
                ) : (
                  teams.map(team => {
                    const teamKey = team.id
                    return (
                      <option 
                        key={`${team.id}-${team.year}`} 
                        value={teamKey} 
                        disabled={teamKey === selectedTeam1 || teamKey === selectedTeam2}
                      >
                        {formatTeamDisplay(team, { includeManager: true, includeYear: false })}
                      </option>
                    )
                  })
                )}
              </select>
            </div>
          )}
        </div>
      </div>

      {canCompare && (
        <>
          {/* Category Filter */}
          <div className="flex justify-center">
            <nav className="flex space-x-4">
              {[
                { id: 'all', label: 'All Stats' },
                { id: 'performance', label: 'Performance' },
                { id: 'scoring', label: 'Scoring' },
                { id: 'record', label: 'Record' }
              ].map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id as typeof activeCategory)}
                  className={`px-4 py-2 rounded-md font-medium text-sm transition-colors ${
                    activeCategory === category.id
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {category.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Export Button Row */}
          {canCompare && (
            <div className="flex justify-center space-x-2">
              <button
                onClick={() => handleExport('csv')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                <Download className="h-4 w-4 mr-2" />
                Export JSON
              </button>
            </div>
          )}

          {/* Comparison Cards */}
          <div className={`grid gap-6 ${includeThirdTeam && team3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
            {/* Team 1 Card */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="bg-blue-600 text-white p-4 rounded-t-lg text-center">
                <h3 className="text-xl font-bold">{formatTeamDisplay(team1, { includeYear: hasMultipleYears })}</h3>
                <p className="text-blue-100">{team1.manager}</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-600">
                {filteredStats.map((stat) => {
                  const team1Value = team1[stat.key] as number
                  const team2Value = team2[stat.key] as number
                  const team3Value = team3 ? (team3[stat.key] as number) : undefined
                  
                  const bestTeam = getBestTeam(stat, { 
                    team1: team1Value, 
                    team2: team2Value, 
                    team3: team3Value 
                  })
                  
                  const Icon = stat.icon
                  const isBest = bestTeam === 'team1'
                  const isTied = bestTeam === 'tie'

                  return (
                    <div key={stat.key} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{stat.label}</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${
                        isBest ? 'text-green-600 dark:text-green-400 font-bold' : 
                        isTied ? 'text-yellow-600 dark:text-yellow-400 font-medium' : 
                        'text-gray-900 dark:text-white'
                      }`}>
                        {isBest && <Trophy className="h-4 w-4" />}
                        <span>{stat.format(team1Value)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Team 2 Card */}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
              <div className="bg-red-600 text-white p-4 rounded-t-lg text-center">
                <h3 className="text-xl font-bold">{formatTeamDisplay(team2, { includeYear: hasMultipleYears })}</h3>
                <p className="text-red-100">{team2.manager}</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-600">
                {filteredStats.map((stat) => {
                  const team1Value = team1[stat.key] as number
                  const team2Value = team2[stat.key] as number
                  const team3Value = team3 ? (team3[stat.key] as number) : undefined
                  
                  const bestTeam = getBestTeam(stat, { 
                    team1: team1Value, 
                    team2: team2Value, 
                    team3: team3Value 
                  })
                  
                  const Icon = stat.icon
                  const isBest = bestTeam === 'team2'
                  const isTied = bestTeam === 'tie'

                  return (
                    <div key={stat.key} className="px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{stat.label}</span>
                      </div>
                      <div className={`flex items-center space-x-1 ${
                        isBest ? 'text-green-600 dark:text-green-400 font-bold' : 
                        isTied ? 'text-yellow-600 dark:text-yellow-400 font-medium' : 
                        'text-gray-900 dark:text-white'
                      }`}>
                        {isBest && <Trophy className="h-4 w-4" />}
                        <span>{stat.format(team2Value)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Team 3 Card (if enabled) */}
            {includeThirdTeam && team3 && (
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="bg-green-600 text-white p-4 rounded-t-lg text-center">
                  <h3 className="text-xl font-bold">{formatTeamDisplay(team3, { includeYear: hasMultipleYears })}</h3>
                  <p className="text-green-100">{team3.manager}</p>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-600">
                  {filteredStats.map((stat) => {
                    const team1Value = team1[stat.key] as number
                    const team2Value = team2[stat.key] as number
                    const team3Value = team3[stat.key] as number
                    
                    const bestTeam = getBestTeam(stat, { 
                      team1: team1Value, 
                      team2: team2Value, 
                      team3: team3Value 
                    })
                    
                    const Icon = stat.icon
                    const isBest = bestTeam === 'team3'
                    const isTied = bestTeam === 'tie'

                    return (
                      <div key={stat.key} className="px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Icon className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">{stat.label}</span>
                        </div>
                        <div className={`flex items-center space-x-1 ${
                          isBest ? 'text-green-600 dark:text-green-400 font-bold' : 
                          isTied ? 'text-yellow-600 dark:text-yellow-400 font-medium' : 
                          'text-gray-900 dark:text-white'
                        }`}>
                          {isBest && <Trophy className="h-4 w-4" />}
                          <span>{stat.format(team3Value)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Summary Cards */}
          <div className={`grid grid-cols-1 gap-4 ${includeThirdTeam && team3 ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
            {/* Team 1 Advantages */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
                {formatTeamDisplay(team1, { includeYear: hasMultipleYears })} Leads In
              </h4>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {filteredStats.filter(stat => {
                  const team1Val = team1[stat.key] as number
                  const team2Val = team2[stat.key] as number
                  const team3Val = team3 ? (team3[stat.key] as number) : undefined
                  return getBestTeam(stat, { team1: team1Val, team2: team2Val, team3: team3Val }) === 'team1'
                }).length}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">
                of {filteredStats.length} categories
              </div>
            </div>

            {/* Team 2 Advantages */}
            <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
              <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">
                {formatTeamDisplay(team2, { includeYear: hasMultipleYears })} Leads In
              </h4>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {filteredStats.filter(stat => {
                  const team1Val = team1[stat.key] as number
                  const team2Val = team2[stat.key] as number
                  const team3Val = team3 ? (team3[stat.key] as number) : undefined
                  return getBestTeam(stat, { team1: team1Val, team2: team2Val, team3: team3Val }) === 'team2'
                }).length}
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">
                of {filteredStats.length} categories
              </div>
            </div>

            {/* Team 3 Advantages (if enabled) */}
            {includeThirdTeam && team3 && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                  {formatTeamDisplay(team3, { includeYear: hasMultipleYears })} Leads In
                </h4>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {filteredStats.filter(stat => {
                    const team1Val = team1[stat.key] as number
                    const team2Val = team2[stat.key] as number
                    const team3Val = team3[stat.key] as number
                    return getBestTeam(stat, { team1: team1Val, team2: team2Val, team3: team3Val }) === 'team3'
                  }).length}
                </div>
                <div className="text-sm text-green-600 dark:text-green-400">
                  of {filteredStats.length} categories
                </div>
              </div>
            )}

            {/* Ties */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
              <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                Tied Categories
              </h4>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {filteredStats.filter(stat => {
                  const team1Val = team1[stat.key] as number
                  const team2Val = team2[stat.key] as number
                  const team3Val = team3 ? (team3[stat.key] as number) : undefined
                  return getBestTeam(stat, { team1: team1Val, team2: team2Val, team3: team3Val }) === 'tie'
                }).length}
              </div>
              <div className="text-sm text-yellow-600 dark:text-yellow-400">
                evenly matched
              </div>
            </div>
          </div>
        </>
      )}

      {/* Empty State */}
      {!canCompare && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Select Two Teams
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Choose two different teams from the dropdowns above to see a detailed comparison
          </p>
        </div>
      )}
    </div>
  )
}