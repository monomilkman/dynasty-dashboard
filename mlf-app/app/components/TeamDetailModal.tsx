'use client'

import { useEffect } from 'react'
import type { PlayoffProbabilities } from '@/lib/playoff-calculator'
import type { StandingsFranchise } from '@/app/api/mfl/standings/route'
import type { DivisionsData } from '@/app/api/mfl/divisions/route'
import type { TeamSchedule } from '@/app/api/mfl/schedule-remaining/route'
import PlayoffProbabilityChart from './PlayoffProbabilityChart'

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
  year
}: TeamDetailModalProps) {
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

  // Best/worst case scenarios
  const bestCaseWins = wins + remainingGames.length
  const worstCaseWins = wins

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

          {/* Best/Worst Case Scenarios */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-green-700 dark:text-green-300 mb-2">
                Best Case
              </h3>
              <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                {bestCaseWins}-{losses}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                Win all remaining games
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-red-700 dark:text-red-300 mb-2">
                Worst Case
              </h3>
              <div className="text-2xl font-bold text-red-800 dark:text-red-200">
                {worstCaseWins}-{losses + remainingGames.length}
              </div>
              <div className="text-xs text-red-600 dark:text-red-400 mt-1">
                Lose all remaining games
              </div>
            </div>
          </div>

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
