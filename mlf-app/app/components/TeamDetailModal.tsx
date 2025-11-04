'use client'

import { useEffect, useState } from 'react'
import type { PlayoffProbabilities } from '@/lib/playoff-calculator'
import type { StandingsFranchise } from '@/app/api/mfl/standings/route'
import type { DivisionsData } from '@/app/api/mfl/divisions/route'
import type { TeamSchedule } from '@/app/api/mfl/schedule-remaining/route'
import PlayoffProbabilityChart from './PlayoffProbabilityChart'
import RootingInterestCard from './RootingInterestCard'
import ScenarioExplorer from './ScenarioExplorer'
import { calculateRootingInterests, hasRelevantRootingInterests, type RootingInterestAnalysis } from '@/lib/rooting-interest-calculator'

interface TeamDetailModalProps {
  isOpen: boolean
  onClose: () => void
  franchiseId: string
  probability: PlayoffProbabilities
  standing: StandingsFranchise
  divisions: DivisionsData
  schedule: TeamSchedule
  currentWeek: number
  year: number
  allStandings: StandingsFranchise[]  // All team standings (for rooting interests)
  allSchedules: TeamSchedule[]  // All team schedules (for rooting interests)
}

export default function TeamDetailModal({
  isOpen,
  onClose,
  franchiseId,
  probability,
  standing,
  divisions,
  schedule,
  currentWeek,
  year,
  allStandings,
  allSchedules
}: TeamDetailModalProps) {
  // State for rooting interests
  const [rootingInterests, setRootingInterests] = useState<RootingInterestAnalysis | null>(null)
  const [loadingRootingInterests, setLoadingRootingInterests] = useState(false)

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  // Calculate rooting interests on-demand when modal opens
  useEffect(() => {
    if (isOpen && franchiseId && hasRelevantRootingInterests(probability.playoffProbability, probability.isEliminated)) {
      setLoadingRootingInterests(true)
      setRootingInterests(null)

      // Run calculation asynchronously
      setTimeout(() => {
        try {
          const analysis = calculateRootingInterests(
            franchiseId,
            allStandings,
            allSchedules,
            divisions,
            currentWeek
          )
          setRootingInterests(analysis)
        } catch (error) {
          console.error('[Team Detail Modal] Error calculating rooting interests:', error)
        } finally {
          setLoadingRootingInterests(false)
        }
      }, 100) // Small delay to let modal render first
    } else {
      setRootingInterests(null)
      setLoadingRootingInterests(false)
    }
  }, [isOpen, franchiseId, currentWeek, probability.playoffProbability, probability.isEliminated, allStandings, allSchedules, divisions])

  if (!isOpen) return null

  const franchise = divisions.franchises.find(f => f.id === franchiseId)
  const divisionName = divisions.divisionNames[divisions.divisionMap[franchiseId]]

  // Calculate record
  const wins = parseInt(standing.h2hw || '0')
  const losses = parseInt(standing.h2hl || '0')
  const ties = parseInt(standing.h2ht || '0')
  const totalGames = wins + losses + ties
  const winPct = totalGames > 0 ? (wins + ties * 0.5) / totalGames : 0

  // Remaining schedule analysis
  const remainingGames = schedule.remainingGames || []
  const remainingStrength = remainingGames.length > 0
    ? remainingGames.reduce((sum, game) => sum + (game.opponentAvgPoints || 0), 0) / remainingGames.length
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {franchise?.name || franchiseId}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {franchise?.owner_name} • {divisionName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Status Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Record</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {wins}-{losses}{ties > 0 && `-${ties}`}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {(winPct * 100).toFixed(1)}% Win Rate
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Points For</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {parseFloat(standing.pf || '0').toFixed(1)}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {totalGames > 0 ? (parseFloat(standing.pf || '0') / totalGames).toFixed(1) : '0.0'} per game
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">Playoff Odds</div>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {probability.playoffProbability.toFixed(1)}%
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                Avg Seed: {probability.averageSeed.toFixed(1)}
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <div className="text-xs text-purple-600 dark:text-purple-400 mb-1">Division Win</div>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                {probability.divisionWinProbability.toFixed(1)}%
              </div>
              <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                vs Division
              </div>
            </div>
          </div>

          {/* Seed Probability Distribution */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Playoff Seed Distribution
            </h3>
            <div className="space-y-2">
              {probability.seedProbabilities.map((prob, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-gray-700 dark:text-gray-300">Seed {index + 1}</span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {prob.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${prob}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Remaining Schedule */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Remaining Schedule ({remainingGames.length} games)
            </h3>
            {remainingGames.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  Avg Opponent Strength: {remainingStrength.toFixed(1)} PPG
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {remainingGames.map((game, index) => {
                    const opponent = divisions.franchises.find(f => f.id === game.opponentId)
                    const oppStrength = game.opponentAvgPoints || 0
                    const difficulty = oppStrength > remainingStrength + 20 ? 'Hard' :
                                      oppStrength > remainingStrength ? 'Medium' : 'Easy'
                    const difficultyColor = difficulty === 'Hard' ? 'text-red-600 dark:text-red-400' :
                                           difficulty === 'Medium' ? 'text-yellow-600 dark:text-yellow-400' :
                                           'text-green-600 dark:text-green-400'

                    return (
                      <div
                        key={index}
                        className="flex items-center justify-between bg-white dark:bg-gray-800 rounded p-2 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 dark:text-gray-400">Week {game.week}:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {game.isHome ? 'vs' : '@'} {opponent?.name || game.opponentId}
                          </span>
                        </div>
                        <span className={`text-xs font-semibold ${difficultyColor}`}>
                          {difficulty}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">Season complete</p>
            )}
          </div>

          {/* Path to Playoffs */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center">
              <span className="mr-2">🎯</span> Path to Playoffs
            </h3>
            {probability.clinchScenarios && probability.clinchScenarios.length > 0 ? (
              <div className="space-y-2">
                {probability.clinchScenarios.map((scenario, index) => (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 rounded p-3 text-sm"
                  >
                    <p className="text-gray-900 dark:text-white font-medium">
                      {scenario}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded p-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Playoff scenario calculations in progress...
                </p>
              </div>
            )}

            {/* Magic and Elimination Numbers */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              {probability.magicNumber > 0 && probability.magicNumber < 99 && (
                <div className="bg-green-100 dark:bg-green-900/30 rounded p-2">
                  <div className="text-xs text-green-600 dark:text-green-400 font-medium">
                    Magic Number
                  </div>
                  <div className="text-xl font-bold text-green-700 dark:text-green-300">
                    {probability.magicNumber}
                  </div>
                </div>
              )}
              {probability.eliminationNumber > 0 && probability.eliminationNumber < 99 && probability.playoffProbability < 80 && (
                <div className="bg-red-100 dark:bg-red-900/30 rounded p-2">
                  <div className="text-xs text-red-600 dark:text-red-400 font-medium">
                    Elimination Number
                  </div>
                  <div className="text-xl font-bold text-red-700 dark:text-red-300">
                    {probability.eliminationNumber}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Rooting Interest Section */}
          {hasRelevantRootingInterests(probability.playoffProbability, probability.isEliminated) && (
            <div className="bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center">
                <span className="mr-2">🎯</span> Who to Root For
              </h3>

              {loadingRootingInterests ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Analyzing rooting interests...
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Running matchup simulations
                    </p>
                  </div>
                </div>
              ) : rootingInterests ? (
                <>
                  {/* Certainty Badge */}
                  <div className="mb-4 text-sm">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full ${
                      rootingInterests.certaintyLevel === 'high' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' :
                      rootingInterests.certaintyLevel === 'medium' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                      'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'
                    }`}>
                      <span className="mr-1">
                        {rootingInterests.certaintyLevel === 'high' ? '✓' :
                         rootingInterests.certaintyLevel === 'medium' ? '~' : '⚠'}
                      </span>
                      Confidence: {rootingInterests.certaintyLevel}
                    </span>
                    {rootingInterests.certaintyLevel === 'low' && (
                      <span className="ml-2 text-gray-600 dark:text-gray-400 text-xs">
                        (Many games remaining - predictions less certain)
                      </span>
                    )}
                  </div>

                  {/* Top Critical Matchups */}
                  {rootingInterests.topMatchups.length > 0 ? (
                    <div className="mb-6">
                      <h4 className="text-md font-medium mb-3 text-gray-800 dark:text-gray-200">
                        🔥 Most Important Games
                      </h4>
                      <div className="space-y-3">
                        {rootingInterests.topMatchups.map((interest, idx) => (
                          <RootingInterestCard key={idx} interest={interest} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white dark:bg-gray-800 rounded p-4 mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        No critical matchups identified - your playoff fate is mostly in your own hands!
                      </p>
                    </div>
                  )}

                  {/* Show All Matchups (Expandable) */}
                  {rootingInterests.allMatchups.length > rootingInterests.topMatchups.length && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium">
                        View All Remaining Matchups ({rootingInterests.allMatchups.length})
                      </summary>
                      <div className="mt-4 space-y-4">
                        {Object.entries(rootingInterests.weeklyBreakdown)
                          .sort(([weekA], [weekB]) => parseInt(weekA) - parseInt(weekB))
                          .map(([week, matchups]) => (
                            <div key={week}>
                              <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2 text-sm">
                                Week {week}
                              </h5>
                              <div className="space-y-2 pl-4">
                                {matchups.map((interest, idx) => (
                                  <RootingInterestCard key={idx} interest={interest} compact />
                                ))}
                              </div>
                            </div>
                          ))}
                      </div>
                    </details>
                  )}
                </>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded p-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Unable to calculate rooting interests at this time.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Scenario Explorer Section */}
          <details className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <summary className="cursor-pointer p-4 text-lg font-semibold text-purple-700 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors flex items-center">
              <span className="mr-2">🎮</span> Explore Scenarios
              <span className="ml-2 text-sm font-normal text-gray-600 dark:text-gray-400">
                (Click to expand)
              </span>
            </summary>
            <div className="p-4 pt-0">
              <ScenarioExplorer
                franchiseId={franchiseId}
                standings={allStandings}
                schedules={allSchedules}
                divisions={divisions}
                currentWeek={currentWeek}
              />
            </div>
          </details>

          {/* Historical Probability Chart */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Playoff Probability Trend
            </h3>
            <PlayoffProbabilityChart
              franchiseId={franchiseId}
              franchiseName={franchise?.name || franchiseId}
              year={year}
              currentWeek={currentWeek}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
