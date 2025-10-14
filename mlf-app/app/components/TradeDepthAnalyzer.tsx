'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  DepthAnalysisResult,
  TeamDepthAnalysis,
  Position,
  DepthStatus,
  getPlayerQualityTier,
  getNonTradeableReason,
  getUpgradeSuggestions,
  type PlayerQualityTier
} from '@/lib/trade-depth-calculator'

interface TradeDepthAnalyzerProps {
  year: number
}

export default function TradeDepthAnalyzer({ year }: TradeDepthAnalyzerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<DepthAnalysisResult | null>(null)
  const [selectedFranchiseId, setSelectedFranchiseId] = useState<string>('')
  const [showOnlySurplus, setShowOnlySurplus] = useState(false)
  const [showOnlyMatches, setShowOnlyMatches] = useState(false)
  const [selectedCell, setSelectedCell] = useState<{
    team: TeamDepthAnalysis
    position: Position
  } | null>(null)

  useEffect(() => {
    fetchTradeDepth()
  }, [year])

  useEffect(() => {
    // Refetch when franchise selection changes to get personalized data
    if (selectedFranchiseId && data) {
      fetchTradeDepth(selectedFranchiseId)
    }
  }, [selectedFranchiseId])

  const fetchTradeDepth = async (franchiseId?: string) => {
    setLoading(true)
    setError(null)

    try {
      const url = franchiseId
        ? `/api/mfl/trade-depth?year=${year}&franchiseId=${franchiseId}`
        : `/api/mfl/trade-depth?year=${year}`

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch trade depth: ${response.status}`)
      }

      const result = await response.json()

      // Check if response has error
      if (result.error) {
        throw new Error(result.details || result.error)
      }

      // Handle both direct response and wrapped response (from cache)
      const data = result.data || result

      // Validate the response structure
      if (!data.allTeams || !Array.isArray(data.allTeams)) {
        throw new Error('Invalid response structure from API')
      }

      setData(data as DepthAnalysisResult)

      // Auto-select first team if none selected
      if (!selectedFranchiseId && data.allTeams.length > 0) {
        setSelectedFranchiseId(data.allTeams[0].franchiseId)
      }
    } catch (err) {
      console.error('Error fetching trade depth:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getDepthIndicator = (depthScore: number, status: DepthStatus) => {
    if (depthScore >= 2) return { emoji: '🟢', label: `+${depthScore}` }
    if (depthScore === 1) return { emoji: '🟡', label: `+${depthScore}` }
    if (depthScore === 0) return { emoji: '🟡', label: '0' }
    return { emoji: '🔴', label: `${depthScore}` }
  }

  const getQualityStars = (quality: 'high' | 'medium' | 'low' | null) => {
    if (quality === 'high') return '⭐⭐⭐'
    if (quality === 'medium') return '⭐⭐'
    if (quality === 'low') return '⭐'
    return ''
  }

  const filteredTeams = useMemo(() => {
    if (!data) return []

    let teams = data.allTeams

    // Filter to show only teams with surpluses
    if (showOnlySurplus) {
      teams = teams.filter((team) =>
        Object.values(team.positionDepth).some((depth) => depth.status === 'surplus')
      )
    }

    // Filter to show only trade matches
    if (showOnlyMatches && data.tradeMatches) {
      const matchTeamIds = new Set(data.tradeMatches.map((m) => m.targetTeam.franchiseId))
      teams = teams.filter((team) => matchTeamIds.has(team.franchiseId))
    }

    return teams
  }, [data, showOnlySurplus, showOnlyMatches])

  const positions: Position[] = ['QB', 'RB', 'WR', 'TE', 'K', 'DL', 'LB', 'CB', 'S']

  const yourTeamAnalysis = data?.yourTeamAnalysis

  const yourTeamNeeds = useMemo(() => {
    if (!data?.yourTeamAnalysis) return []
    return Object.entries(data.yourTeamAnalysis.positionDepth)
      .filter(([_, depth]) => depth.status === 'need')
      .map(([pos, _]) => pos as Position)
  }, [data])

  const yourTeamAssets = useMemo(() => {
    if (!data?.yourTeamAnalysis) return []
    return Object.entries(data.yourTeamAnalysis.positionDepth)
      .filter(([_, depth]) => depth.status === 'surplus' && depth.tradeableBackups.length > 0)
      .map(([pos, _]) => pos as Position)
  }, [data])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Analyzing trade depth...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <h3 className="text-red-800 dark:text-red-300 font-semibold mb-2">Error Loading Trade Depth</h3>
        <p className="text-red-700 dark:text-red-400">{error}</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-gray-600 dark:text-gray-400 p-8 text-center">No trade depth data available</div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="font-medium text-gray-700 dark:text-gray-300">Your Team:</label>
          <select
            value={selectedFranchiseId}
            onChange={(e) => setSelectedFranchiseId(e.target.value)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {data.allTeams.map((team) => (
              <option key={team.franchiseId} value={team.franchiseId}>
                {team.teamName} ({team.manager})
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showOnlySurplus}
              onChange={(e) => setShowOnlySurplus(e.target.checked)}
              className="rounded"
            />
            Show only teams with surplus
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showOnlyMatches}
              onChange={(e) => setShowOnlyMatches(e.target.checked)}
              className="rounded"
            />
            Show only trade matches
          </label>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <span className="flex items-center gap-1">
            <span>🟢</span> <span className="text-gray-700 dark:text-gray-300">Surplus (+2+)</span>
          </span>
          <span className="flex items-center gap-1">
            <span>🟡</span> <span className="text-gray-700 dark:text-gray-300">Adequate (0-1)</span>
          </span>
          <span className="flex items-center gap-1">
            <span>🔴</span> <span className="text-gray-700 dark:text-gray-300">Need (Negative)</span>
          </span>
          <span className="text-gray-500 dark:text-gray-400">|</span>
          <span className="text-gray-700 dark:text-gray-300">⭐⭐⭐ High Quality</span>
          <span className="text-gray-700 dark:text-gray-300">⭐⭐ Medium</span>
          <span className="text-gray-700 dark:text-gray-300">⭐ Low</span>
        </div>
      </div>

      {/* Your Team Analysis */}
      {data.yourTeamAnalysis && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-3">
            YOUR TEAM ANALYSIS: {data.yourTeamAnalysis.teamName}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-blue-800 dark:text-blue-400">Needs:</span>{' '}
              <span className="text-red-600 dark:text-red-400">
                {yourTeamNeeds.length > 0 ? yourTeamNeeds.join(', ') : 'None'}
              </span>
            </div>
            <div>
              <span className="font-medium text-blue-800 dark:text-blue-400">Assets:</span>{' '}
              <span className="text-green-600 dark:text-green-400">
                {yourTeamAssets.length > 0 ? yourTeamAssets.join(', ') : 'None'}
              </span>
            </div>
            <div>
              <span className="font-medium text-blue-800 dark:text-blue-400">Overall Depth Rating:</span>{' '}
              <span className="text-blue-900 dark:text-blue-200">{data.yourTeamAnalysis.overallDepthRating}/100</span>
            </div>
            <div>
              <span className="font-medium text-blue-800 dark:text-blue-400">Flex Depth:</span>{' '}
              <span className="text-blue-900 dark:text-blue-200">
                O: {data.yourTeamAnalysis.flexDepth.offense}, D: {data.yourTeamAnalysis.flexDepth.defense}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Trade Matches */}
      {data.tradeMatches && data.tradeMatches.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 dark:text-green-300 mb-3">
            RECOMMENDED TRADE TARGETS ({data.tradeMatches.length})
          </h3>
          <div className="space-y-2">
            {data.tradeMatches.slice(0, 5).map((match, idx) => (
              <div
                key={match.targetTeam.franchiseId}
                className="flex items-center justify-between text-sm bg-white dark:bg-gray-800 rounded p-2"
              >
                <div className="flex-1">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {idx + 1}. {match.targetTeam.teamName}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400 ml-2">
                    They have: <span className="text-green-600 dark:text-green-400">{match.theyHaveSurplus.join(', ')}</span>
                  </span>
                  {match.yourAssets.length > 0 && (
                    <span className="text-gray-600 dark:text-gray-400 ml-2">
                      • You have: <span className="text-blue-600 dark:text-blue-400">{match.yourAssets.join(', ')}</span>
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="font-semibold text-green-600 dark:text-green-400">
                    Match: {match.matchScore}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heat Map Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider sticky left-0 bg-gray-50 dark:bg-gray-800 z-10">
                Team
              </th>
              {positions.map((pos) => (
                <th
                  key={pos}
                  className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  {pos}
                </th>
              ))}
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Overall
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
            {filteredTeams.map((team) => (
              <tr key={team.franchiseId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100 sticky left-0 bg-white dark:bg-gray-900">
                  <div>
                    <div>{team.teamName}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{team.manager}</div>
                  </div>
                </td>
                {positions.map((pos) => {
                  const depth = team.positionDepth[pos]
                  const indicator = getDepthIndicator(depth.depthScore, depth.status)
                  const quality = getQualityStars(depth.quality)

                  return (
                    <td
                      key={pos}
                      className="px-3 py-3 text-center text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                      onClick={() => setSelectedCell({ team, position: pos })}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-xl">{indicator.emoji}</span>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{indicator.label}</span>
                        {quality && <span className="text-xs">{quality}</span>}
                      </div>
                    </td>
                  )
                })}
                <td className="px-4 py-3 text-center text-sm font-medium text-gray-900 dark:text-gray-100">
                  {team.overallDepthRating}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Drill-down Modal */}
      {selectedCell && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedCell(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {selectedCell.team.teamName} - {selectedCell.position} Depth
                </h2>
                <button
                  onClick={() => setSelectedCell(null)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  ✕
                </button>
              </div>

              {/* Enhanced Position Depth Details */}
              <div className="space-y-4">
                {(() => {
                  const depth = selectedCell.team.positionDepth[selectedCell.position]
                  const getQualityColor = (tier: PlayerQualityTier) => {
                    switch (tier) {
                      case 'elite': return 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700'
                      case 'startable': return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700'
                      case 'backup': return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700'
                      case 'filler': return 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                    }
                  }

                  const getTierBadge = (tier: PlayerQualityTier) => {
                    switch (tier) {
                      case 'elite': return <span className="px-2 py-1 text-xs font-semibold bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100 rounded">ELITE</span>
                      case 'startable': return <span className="px-2 py-1 text-xs font-semibold bg-green-200 dark:bg-green-800 text-green-900 dark:text-green-100 rounded">STARTABLE</span>
                      case 'backup': return <span className="px-2 py-1 text-xs font-semibold bg-yellow-200 dark:bg-yellow-800 text-yellow-900 dark:text-yellow-100 rounded">BACKUP</span>
                      case 'filler': return <span className="px-2 py-1 text-xs font-semibold bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded">FILLER</span>
                    }
                  }

                  return (
                    <>
                      {/* Summary Stats */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-gray-600 dark:text-gray-400">Team Rank at {selectedCell.position}</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                              #{depth.teamPositionRank} / 12
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 dark:text-gray-400">Total Rostered</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                              {depth.totalRostered}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 dark:text-gray-400">Depth Score</div>
                            <div className={`text-2xl font-bold ${depth.depthScore > 0 ? 'text-green-600' : depth.depthScore < 0 ? 'text-red-600' : 'text-gray-600'}`}>
                              {depth.depthScore > 0 ? '+' : ''}{depth.depthScore}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 dark:text-gray-400">Status</div>
                            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100 capitalize">
                              {depth.status}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Starters */}
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
                          STARTERS (Required: {depth.required})
                        </h3>
                        <div className="space-y-2">
                          {depth.starters.map((player, idx) => {
                            const tier = data ? getPlayerQualityTier(player, data.leagueContext) : 'filler'
                            return (
                              <div
                                key={player.id}
                                className={`flex items-center justify-between rounded p-3 border-2 ${getQualityColor(tier)}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-900 dark:text-gray-100 font-medium">
                                    {idx + 1}. {player.name}
                                  </span>
                                  {getTierBadge(tier)}
                                </div>
                                <div className="text-right text-sm">
                                  <div className="font-medium text-gray-900 dark:text-gray-100">
                                    {player.seasonPPG.toFixed(1)} ppg
                                  </div>
                                  <div className="text-gray-600 dark:text-gray-400">Rank: #{player.positionRank}</div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Tradeable Backups */}
                      {depth.tradeableBackups.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-green-900 dark:text-green-300 mb-2">
                            TRADEABLE DEPTH ({depth.tradeableBackups.length})
                          </h3>
                          <div className="space-y-2">
                            {depth.tradeableBackups.map((player) => {
                              const tier = data ? getPlayerQualityTier(player, data.leagueContext) : 'filler'
                              return (
                                <div
                                  key={player.id}
                                  className={`flex items-center justify-between rounded p-3 border-2 ${getQualityColor(tier)}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-gray-900 dark:text-gray-100">{player.name}</span>
                                    {getTierBadge(tier)}
                                  </div>
                                  <div className="text-right text-sm">
                                    <div className="font-medium text-gray-900 dark:text-gray-100">
                                      {player.seasonPPG.toFixed(1)} ppg
                                    </div>
                                    <div className="text-gray-600 dark:text-gray-400">
                                      Rank: #{player.positionRank} • Starts on {player.starterOnTeamCount}/{data?.leagueContext.totalTeams} teams
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Non-Tradeable Backups */}
                      {depth.nonTradeableBackups.length > 0 && (
                        <div>
                          <h3 className="font-semibold text-orange-900 dark:text-orange-300 mb-2">
                            NON-TRADEABLE BACKUPS ({depth.nonTradeableBackups.length})
                          </h3>
                          <div className="space-y-2">
                            {depth.nonTradeableBackups.map((player) => {
                              const tier = data ? getPlayerQualityTier(player, data.leagueContext) : 'filler'
                              const reason = data ? getNonTradeableReason(player, data.leagueContext) : 'Unknown'
                              return (
                                <div
                                  key={player.id}
                                  className={`rounded p-3 border-2 ${getQualityColor(tier)}`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-gray-900 dark:text-gray-100">{player.name}</span>
                                      {getTierBadge(tier)}
                                    </div>
                                    <div className="text-right text-sm">
                                      <div className="font-medium text-gray-900 dark:text-gray-100">
                                        {player.seasonPPG.toFixed(1)} ppg
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-600 dark:text-gray-400 italic">
                                    🚫 {reason}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Upgrade Suggestions */}
                      {data && yourTeamAnalysis && selectedCell.team.franchiseId === yourTeamAnalysis.franchiseId && depth.status === 'need' && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                          <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">
                            💡 UPGRADE SUGGESTIONS
                          </h3>
                          {(() => {
                            const yourAssetPositions = Object.entries(yourTeamAnalysis.positionDepth)
                              .filter(([_, d]) => d.status === 'surplus')
                              .map(([pos, _]) => pos as Position)

                            const suggestions = getUpgradeSuggestions(
                              selectedCell.position,
                              depth,
                              data.allTeams,
                              yourAssetPositions
                            )

                            if (suggestions.length === 0) {
                              return <div className="text-sm text-gray-600 dark:text-gray-400">No upgrade targets available</div>
                            }

                            return (
                              <div className="space-y-2">
                                {suggestions.map((sug, idx) => (
                                  <div key={idx} className="bg-blue-50 dark:bg-blue-900/20 rounded p-3 text-sm">
                                    <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                                      Target: {sug.targetPlayer.name} from {sug.targetTeam.teamName}
                                    </div>
                                    <div className="text-gray-600 dark:text-gray-400">
                                      • Upgrade: +{sug.upgradeValue.toFixed(1)} ppg
                                    </div>
                                    <div className="text-gray-600 dark:text-gray-400">
                                      • Offer: {sug.yourTradeAssets.join(', ')}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )
                          })()}
                        </div>
                      )}

                      {/* League Context */}
                      {data && (
                        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">LEAGUE CONTEXT</h3>
                          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                            <div>Average {selectedCell.position} Score: {data.leagueContext.positionAverages[selectedCell.position].toFixed(1)} ppg</div>
                            <div>Median {selectedCell.position} Score: {data.leagueContext.positionMedians[selectedCell.position].toFixed(1)} ppg</div>
                            <div>Total Startable {selectedCell.position}s: {data.leagueContext.totalStartablePlayers[selectedCell.position]}</div>
                          </div>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedCell(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
