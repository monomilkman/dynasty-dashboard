/**
 * Scenario Explorer Component
 * Interactive tool for exploring best/worst/likely playoff scenarios
 * Includes what-if tool for custom game results
 */

'use client'

import { useState, useMemo } from 'react'
import type { StandingsFranchise } from '@/app/api/mfl/standings/route'
import type { TeamSchedule } from '@/app/api/mfl/schedule-remaining/route'
import type { DivisionsData } from '@/app/api/mfl/divisions/route'
import {
  calculateBestCaseScenario,
  calculateWorstCaseScenario,
  calculateMostLikelyScenario,
  calculateScenarioProbability,
  type ScenarioResult
} from '@/lib/scenario-calculator'

interface ScenarioExplorerProps {
  franchiseId: string
  standings: StandingsFranchise[]
  schedules: TeamSchedule[]
  divisions: DivisionsData
  currentWeek: number
}

export default function ScenarioExplorer({
  franchiseId,
  standings,
  schedules,
  divisions,
  currentWeek
}: ScenarioExplorerProps) {
  const [customResults, setCustomResults] = useState<Record<number, 'W' | 'L' | null>>({})
  const [calculatingCustom, setCalculatingCustom] = useState(false)

  const teamSchedule = schedules.find(s => s.franchiseId === franchiseId)
  const franchise = divisions.franchises.find(f => f.id === franchiseId)

  // Calculate preset scenarios
  const scenarios = useMemo(() => {
    console.log('[Scenario Explorer] Calculating preset scenarios...')
    return {
      bestCase: calculateBestCaseScenario(franchiseId, standings, schedules, divisions),
      worstCase: calculateWorstCaseScenario(franchiseId, standings, schedules, divisions),
      mostLikely: calculateMostLikelyScenario(franchiseId, standings, schedules, divisions)
    }
  }, [franchiseId, standings, schedules, divisions])

  // Calculate custom scenario
  const customScenario = useMemo(() => {
    const hasCustomResults = Object.values(customResults).some(result => result !== null)
    if (!hasCustomResults) return null

    setCalculatingCustom(true)
    const result = calculateScenarioProbability(franchiseId, customResults, standings, schedules, divisions)
    setCalculatingCustom(false)
    return result
  }, [customResults, franchiseId, standings, schedules, divisions])

  const handleGameToggle = (week: number, result: 'W' | 'L' | null) => {
    setCustomResults(prev => ({
      ...prev,
      [week]: result
    }))
  }

  const handleClearAll = () => {
    setCustomResults({})
  }

  const getTeamName = (franchiseId: string): string => {
    return divisions.franchises.find(f => f.id === franchiseId)?.name || franchiseId
  }

  if (!teamSchedule) {
    return (
      <div className="text-center py-4 text-gray-500 dark:text-gray-400">
        No schedule data available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Preset Scenarios */}
      <div>
        <h4 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
          Scenario Projections
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Best Case */}
          <ScenarioCard
            title="🌟 Best Case"
            scenario={scenarios.bestCase}
            color="green"
          />

          {/* Most Likely */}
          <ScenarioCard
            title="📊 Most Likely"
            scenario={scenarios.mostLikely}
            color="blue"
          />

          {/* Worst Case */}
          <ScenarioCard
            title="😬 Worst Case"
            scenario={scenarios.worstCase}
            color="red"
          />
        </div>
      </div>

      {/* Interactive What-If Tool */}
      {teamSchedule.remainingGames.length > 0 && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              🎮 Build Your Own Scenario
            </h4>
            <button
              onClick={handleClearAll}
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear All
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Select win/loss for each remaining game to see how it affects playoff odds
          </p>

          {/* Game Selectors */}
          <div className="space-y-2 mb-4">
            {teamSchedule.remainingGames.map(game => (
              <div
                key={game.week}
                className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded p-3 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
              >
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-white">Week {game.week}</span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2 text-sm">
                    {game.isHome ? 'vs' : '@'} {getTeamName(game.opponentId)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleGameToggle(game.week, customResults[game.week] === 'W' ? null : 'W')}
                    className={`px-3 py-1 rounded transition-colors ${
                      customResults[game.week] === 'W'
                        ? 'bg-green-500 text-white hover:bg-green-600'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    Win
                  </button>
                  <button
                    onClick={() => handleGameToggle(game.week, customResults[game.week] === 'L' ? null : 'L')}
                    className={`px-3 py-1 rounded transition-colors ${
                      customResults[game.week] === 'L'
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    Loss
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Live Probability Update */}
          {customScenario && !calculatingCustom && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Your Scenario
                  </div>
                  <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                    {customScenario.playoffProbability.toFixed(1)}%
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    Projected Record
                  </div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">
                    {customScenario.projectedRecord}
                  </div>
                </div>
              </div>
              {customScenario.projectedSeed > 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Projected Seed: <span className="font-semibold">#{customScenario.projectedSeed}</span>
                </div>
              )}
            </div>
          )}

          {calculatingCustom && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                Calculating...
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Scenario Card Component
 */
interface ScenarioCardProps {
  title: string
  scenario: ScenarioResult
  color: 'green' | 'blue' | 'red'
}

function ScenarioCard({ title, scenario, color }: ScenarioCardProps) {
  const colorClasses = {
    green: {
      bg: 'bg-green-50 dark:bg-green-900/20',
      border: 'border-green-200 dark:border-green-800',
      text: 'text-green-700 dark:text-green-400',
      badge: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
    },
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      border: 'border-blue-200 dark:border-blue-800',
      text: 'text-blue-700 dark:text-blue-400',
      badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-900/20',
      border: 'border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-400',
      badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
    }
  }

  const classes = colorClasses[color]

  return (
    <div className={`${classes.bg} border ${classes.border} rounded-lg p-4 transition-all hover:shadow-md`}>
      <h5 className="font-semibold mb-3 text-gray-800 dark:text-gray-200">
        {title}
      </h5>

      <div className="space-y-3">
        {/* Record */}
        <div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            Final Record
          </div>
          <div className={`text-2xl font-bold ${classes.text}`}>
            {scenario.record}
          </div>
        </div>

        {/* Playoff Odds */}
        <div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
            Playoff Odds
          </div>
          <div className="flex items-baseline gap-2">
            <span className={`text-xl font-bold ${classes.text}`}>
              {scenario.playoffProbability.toFixed(1)}%
            </span>
            {scenario.seed > 0 && (
              <span className={`text-xs px-2 py-0.5 rounded ${classes.badge}`}>
                Seed #{scenario.seed}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {scenario.description}
          </p>
          {scenario.probability > 0 && scenario.probability < 100 && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              {scenario.probability.toFixed(1)}% chance of this outcome
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
