'use client'

import { useState, useMemo } from 'react'
import { ChevronDown, ChevronUp, Download, TrendingDown, TrendingUp, AlertTriangle, Trophy } from 'lucide-react'
import { LeaguePositionalData } from '@/lib/mfl-position-scraper'
import { analyzeTeamPositions, TeamAnalysis } from '@/lib/position-analysis-utils'
import { formatDecimal } from '@/lib/utils'

interface TeamWeaknessAnalyzerProps {
  positionalData: LeaguePositionalData
  statFilter: 'all' | 'offense' | 'defense'
}

export default function TeamWeaknessAnalyzer({ positionalData, statFilter }: TeamWeaknessAnalyzerProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [isExpanded, setIsExpanded] = useState(true)

  // Get team analysis when a team is selected
  const teamAnalysis = useMemo((): TeamAnalysis | null => {
    if (!selectedTeamId) return null
    return analyzeTeamPositions(selectedTeamId, positionalData)
  }, [selectedTeamId, positionalData])

  // Filter analysis based on stat filter
  const filteredAnalysis = useMemo(() => {
    if (!teamAnalysis) return null

    const offensivePositions = ['QB', 'RB', 'WR', 'TE', 'O-Flex', 'K']
    const defensivePositions = ['DL', 'LB', 'CB', 'S', 'D-Flex']

    if (statFilter === 'offense') {
      return {
        ...teamAnalysis,
        weaknesses: teamAnalysis.weaknesses.filter(w => offensivePositions.includes(w.position)),
        strengths: teamAnalysis.strengths.filter(s => offensivePositions.includes(s.position))
      }
    } else if (statFilter === 'defense') {
      return {
        ...teamAnalysis,
        weaknesses: teamAnalysis.weaknesses.filter(w => defensivePositions.includes(w.position)),
        strengths: teamAnalysis.strengths.filter(s => defensivePositions.includes(s.position))
      }
    }

    return teamAnalysis
  }, [teamAnalysis, statFilter])

  // Export analysis as text
  const exportAsText = () => {
    if (!filteredAnalysis) return

    const lines = [
      `TEAM WEAKNESS ANALYSIS REPORT`,
      `Generated: ${new Date().toLocaleString()}`,
      ``,
      `Team: ${filteredAnalysis.teamName}`,
      `Manager: ${filteredAnalysis.manager}`,
      ``,
      `OVERALL PERFORMANCE`,
      `Average Rank: ${filteredAnalysis.avgRank.toFixed(1)}`,
      `Average Percentile: ${filteredAnalysis.avgPercentile.toFixed(1)}%`,
      `Total Points Behind Leaders: ${formatDecimal(filteredAnalysis.totalGapFromFirst)}`,
      ``,
      `TOP 3 WEAKNESSES`,
      `${'='.repeat(50)}`,
    ]

    filteredAnalysis.weaknesses.forEach((weakness, index) => {
      lines.push(
        ``,
        `${index + 1}. ${weakness.position} (Rank ${weakness.rank}, ${weakness.percentile.toFixed(1)}th percentile)`,
        `   Points: ${formatDecimal(weakness.points)}`,
        `   Gap from 1st: ${formatDecimal(weakness.gapFromFirst)} points`,
        `   Gap from Average: ${formatDecimal(weakness.gapFromAvg)} points`,
        `   Impact Score: ${weakness.impactScore.toFixed(2)}`,
        `   Recommendation: ${weakness.recommendation}`
      )
    })

    lines.push(
      ``,
      `TOP 3 STRENGTHS`,
      `${'='.repeat(50)}`,
    )

    filteredAnalysis.strengths.forEach((strength, index) => {
      lines.push(
        ``,
        `${index + 1}. ${strength.position} (Rank ${strength.rank}, ${strength.percentile.toFixed(1)}th percentile)`,
        `   Points: ${formatDecimal(strength.points)}`,
        `   Gap from 1st: ${formatDecimal(strength.gapFromFirst)} points`,
        `   Potential Trade Asset: ${strength.recommendation}`
      )
    })

    lines.push(
      ``,
      `RECOMMENDATIONS`,
      `${'='.repeat(50)}`,
      filteredAnalysis.overallRecommendation
    )

    const text = lines.join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `team-analysis-${filteredAnalysis.teamName.replace(/\s+/g, '-')}-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export analysis as CSV
  const exportAsCSV = () => {
    if (!filteredAnalysis) return

    const rows = [
      ['Team Analysis Report'],
      ['Team', filteredAnalysis.teamName],
      ['Manager', filteredAnalysis.manager],
      ['Generated', new Date().toLocaleString()],
      [],
      ['OVERALL METRICS'],
      ['Average Rank', filteredAnalysis.avgRank.toFixed(1)],
      ['Average Percentile', filteredAnalysis.avgPercentile.toFixed(1) + '%'],
      ['Total Gap from Leaders', formatDecimal(filteredAnalysis.totalGapFromFirst)],
      [],
      ['WEAKNESSES'],
      ['Position', 'Rank', 'Percentile', 'Points', 'Gap from 1st', 'Gap from Avg', 'Impact Score', 'Recommendation']
    ]

    filteredAnalysis.weaknesses.forEach(w => {
      rows.push([
        w.position,
        w.rank.toString(),
        w.percentile.toFixed(1) + '%',
        formatDecimal(w.points),
        formatDecimal(w.gapFromFirst),
        formatDecimal(w.gapFromAvg),
        w.impactScore.toFixed(2),
        w.recommendation
      ])
    })

    rows.push([])
    rows.push(['STRENGTHS'])
    rows.push(['Position', 'Rank', 'Percentile', 'Points', 'Gap from 1st', 'Recommendation'])

    filteredAnalysis.strengths.forEach(s => {
      rows.push([
        s.position,
        s.rank.toString(),
        s.percentile.toFixed(1) + '%',
        formatDecimal(s.points),
        formatDecimal(s.gapFromFirst),
        s.recommendation
      ])
    })

    const csv = rows.map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `team-analysis-${filteredAnalysis.teamName.replace(/\s+/g, '-')}-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const getImpactColorClass = (impactScore: number) => {
    if (impactScore > 0.8) return 'text-red-600 dark:text-red-400'
    if (impactScore > 0.6) return 'text-orange-600 dark:text-orange-400'
    if (impactScore > 0.4) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-green-600 dark:text-green-400'
  }

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-700 dark:to-purple-700 rounded-t-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-white" />
            <h3 className="text-lg font-semibold text-white">Team Weakness Analyzer</h3>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-white/80 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
            aria-label={isExpanded ? 'Collapse analyzer' : 'Expand analyzer'}
          >
            {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>
        </div>

        {/* Team Selector */}
        {isExpanded && (
          <div className="mt-4">
            <label htmlFor="team-selector" className="block text-sm font-medium text-white/90 mb-2">
              Select Team to Analyze
            </label>
            <select
              id="team-selector"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-white/20 focus:border-white/40 focus:outline-none transition-colors"
            >
              <option value="">-- Select a team --</option>
              {positionalData.teams.map(team => (
                <option key={team.franchiseId} value={team.franchiseId}>
                  {team.teamName} ({team.manager})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Analysis Content */}
      {isExpanded && filteredAnalysis && (
        <div className="bg-white dark:bg-gray-800 border-x-2 border-b-2 border-indigo-200 dark:border-indigo-800 rounded-b-lg p-6 space-y-6">
          {/* Export Buttons */}
          <div className="flex gap-2 justify-end">
            <button
              onClick={exportAsText}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-indigo-100 text-indigo-700 hover:bg-indigo-200 dark:bg-indigo-900 dark:text-indigo-200 dark:hover:bg-indigo-800 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export as Text
            </button>
            <button
              onClick={exportAsCSV}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:hover:bg-purple-800 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export as CSV
            </button>
          </div>

          {/* Overall Performance */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-750 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Trophy className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Overall Performance
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Avg Rank</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {filteredAnalysis.avgRank.toFixed(1)}
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Avg Percentile</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {filteredAnalysis.avgPercentile.toFixed(1)}%
                </p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">Total Gap</p>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatDecimal(filteredAnalysis.totalGapFromFirst)}
                </p>
              </div>
            </div>
          </div>

          {/* Weaknesses */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
              Top 3 Weaknesses
            </h4>
            <div className="space-y-3">
              {filteredAnalysis.weaknesses.map((weakness, index) => (
                <div
                  key={weakness.position}
                  className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-red-600 text-white font-bold text-sm">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{weakness.position}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Rank {weakness.rank} • {weakness.percentile.toFixed(1)}th percentile
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">Impact Score</p>
                      <p className={`text-2xl font-bold ${getImpactColorClass(weakness.impactScore)}`}>
                        {weakness.impactScore.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3 text-sm">
                    <div className="bg-white dark:bg-gray-800 rounded p-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Your Points</p>
                      <p className="font-bold text-gray-900 dark:text-white">{formatDecimal(weakness.points)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded p-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Gap from 1st</p>
                      <p className="font-bold text-red-600 dark:text-red-400">{formatDecimal(weakness.gapFromFirst)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded p-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Gap from Avg</p>
                      <p className="font-bold text-orange-600 dark:text-orange-400">{formatDecimal(weakness.gapFromAvg)}</p>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">RECOMMENDATION</p>
                    <p className="text-sm text-gray-900 dark:text-white">{weakness.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Strengths */}
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              Top 3 Strengths
            </h4>
            <div className="space-y-3">
              {filteredAnalysis.strengths.map((strength, index) => (
                <div
                  key={strength.position}
                  className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white font-bold text-sm">
                        {index + 1}
                      </span>
                      <div>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">{strength.position}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Rank {strength.rank} • {strength.percentile.toFixed(1)}th percentile
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Your Points</p>
                      <p className="text-xl font-bold text-green-600 dark:text-green-400">
                        {formatDecimal(strength.points)}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                    <div className="bg-white dark:bg-gray-800 rounded p-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Gap from 1st</p>
                      <p className="font-bold text-gray-900 dark:text-white">{formatDecimal(strength.gapFromFirst)}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded p-2">
                      <p className="text-xs text-gray-600 dark:text-gray-400">Status</p>
                      <p className="font-bold text-green-600 dark:text-green-400">
                        {strength.gapFromFirst >= 0 ? 'League Leader' : 'Top Performer'}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">TRADE POTENTIAL</p>
                    <p className="text-sm text-gray-900 dark:text-white">{strength.recommendation}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Overall Recommendation */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border-2 border-indigo-300 dark:border-indigo-700 rounded-lg p-4">
            <h4 className="text-lg font-semibold text-indigo-900 dark:text-indigo-200 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Overall Strategy Recommendation
            </h4>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed">
              {filteredAnalysis.overallRecommendation}
            </p>
          </div>
        </div>
      )}

      {/* No Team Selected State */}
      {isExpanded && !selectedTeamId && (
        <div className="bg-gray-50 dark:bg-gray-800 border-x-2 border-b-2 border-gray-200 dark:border-gray-700 rounded-b-lg p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            Select a team above to view detailed weakness analysis and trade recommendations
          </p>
        </div>
      )}
    </div>
  )
}
