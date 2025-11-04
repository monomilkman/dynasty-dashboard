/**
 * RootingInterestCard Component
 * Displays a single rooting interest (matchup) with importance level and impact
 */

import type { RootingInterest } from '@/lib/rooting-interest-calculator'

interface RootingInterestCardProps {
  interest: RootingInterest
  compact?: boolean  // Compact view for "all matchups" section
}

export default function RootingInterestCard({ interest, compact = false }: RootingInterestCardProps) {
  const getImportanceColor = (importance: string): string => {
    switch (importance) {
      case 'critical':
        return 'bg-red-50 dark:bg-red-900/20 border-2 border-red-400 dark:border-red-600'
      case 'important':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600'
      case 'moderate':
        return 'bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700'
      case 'minor':
        return 'bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700'
      default:
        return 'bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700'
    }
  }

  const getImportanceBadgeStyle = (importance: string): string => {
    switch (importance) {
      case 'critical':
        return 'bg-red-500 text-white px-2 py-0.5 rounded-full'
      case 'important':
        return 'bg-yellow-500 text-white px-2 py-0.5 rounded-full'
      case 'moderate':
        return 'bg-blue-500 text-white px-2 py-0.5 rounded-full'
      case 'minor':
        return 'bg-gray-500 text-white px-2 py-0.5 rounded-full'
      default:
        return 'bg-gray-500 text-white px-2 py-0.5 rounded-full'
    }
  }

  const getImportanceIcon = (importance: string): string => {
    switch (importance) {
      case 'critical':
        return '🔥'
      case 'important':
        return '⚠️'
      case 'moderate':
        return '📊'
      case 'minor':
        return '•'
      default:
        return '•'
    }
  }

  // Determine which team to root for
  const rootForTeam = interest.rootFor === interest.matchup.teamA.franchiseId
    ? interest.matchup.teamA
    : interest.matchup.teamB
  const rootAgainstTeam = interest.rootFor === interest.matchup.teamA.franchiseId
    ? interest.matchup.teamB
    : interest.matchup.teamA

  return (
    <div className={`${getImportanceColor(interest.importance)} rounded-lg p-3 transition-all hover:shadow-md`}>
      {/* Importance Badge and Week */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getImportanceIcon(interest.importance)}</span>
          <span className={`text-xs font-semibold uppercase ${getImportanceBadgeStyle(interest.importance)}`}>
            {interest.importance}
          </span>
        </div>
        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
          Week {interest.matchup.week}
        </span>
      </div>

      {/* Matchup */}
      <div className="mb-2">
        {compact ? (
          // Compact view
          <div className="text-sm">
            <span className="font-medium text-green-700 dark:text-green-400">
              {rootForTeam.name}
            </span>
            {' vs '}
            <span className="text-red-700 dark:text-red-400">
              {rootAgainstTeam.name}
            </span>
          </div>
        ) : (
          // Full view
          <div>
            <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
              Root for{' '}
              <span className="text-green-700 dark:text-green-400 font-bold">
                {rootForTeam.name}
              </span>
            </div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              to beat{' '}
              <span className="text-red-700 dark:text-red-400 font-semibold">
                {rootAgainstTeam.name}
              </span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {rootForTeam.currentRecord} vs {rootAgainstTeam.currentRecord}
            </div>
          </div>
        )}
      </div>

      {/* Impact */}
      {!compact && (
        <div className="text-sm text-gray-700 dark:text-gray-300 mb-2 bg-white dark:bg-gray-900 rounded p-2">
          <div className="flex items-center justify-between">
            <span className="font-medium">Impact:</span>
            <span className={`font-bold ${
              interest.impact.swing >= 10 ? 'text-red-600 dark:text-red-400' :
              interest.impact.swing >= 5 ? 'text-yellow-600 dark:text-yellow-400' :
              'text-blue-600 dark:text-blue-400'
            }`}>
              {interest.impact.swing.toFixed(1)}% swing
            </span>
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {interest.impact.ifRootForWins.toFixed(1)}% if they win vs {interest.impact.ifRootForLoses.toFixed(1)}% if they lose
          </div>
        </div>
      )}

      {/* Explanation */}
      <div className={`text-sm ${compact ? 'text-xs' : ''} text-gray-600 dark:text-gray-400 italic`}>
        {interest.explanation}
      </div>

      {/* Context Tag */}
      {!compact && (
        <div className="mt-2">
          <span className={`text-xs px-2 py-0.5 rounded ${
            interest.context === 'division-race' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' :
            interest.context === 'wildcard-race' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' :
            interest.context === 'tiebreaker' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
            'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
          }`}>
            {interest.context.replace('-', ' ')}
          </span>
        </div>
      )}
    </div>
  )
}
