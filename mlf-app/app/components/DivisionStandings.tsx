'use client'

import { useMemo } from 'react'
import type { StandingsFranchise } from '@/app/api/mfl/standings/route'
import type { DivisionsData } from '@/app/api/mfl/divisions/route'
import { buildDivisionStandings } from '@/lib/division-utils'

interface DivisionStandingsProps {
  standings: StandingsFranchise[]
  divisionsData: DivisionsData
}

export default function DivisionStandings({ standings, divisionsData }: DivisionStandingsProps) {
  const divisionStandings = useMemo(() => {
    return buildDivisionStandings(standings, divisionsData)
  }, [standings, divisionsData])

  if (divisionStandings.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        No division data available
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
        Division Standings
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {divisionStandings.map(division => (
          <div
            key={division.divisionId}
            className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden"
          >
            {/* Division Header */}
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-3">
              <h4 className="text-lg font-bold text-white">
                {division.divisionName}
              </h4>
            </div>

            {/* Division Teams */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {division.teams.map((team, index) => {
                const isLeader = index === 0

                return (
                  <div
                    key={team.franchiseId}
                    className={`px-4 py-3 ${
                      isLeader
                        ? 'bg-blue-50 dark:bg-blue-900/20'
                        : 'bg-white dark:bg-gray-800'
                    } hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                            {team.divisionRank}.
                          </span>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {team.franchiseName}
                            </div>
                            {isLeader && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                Division Leader
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-bold text-gray-900 dark:text-white">
                          {team.wins}-{team.losses}{team.ties > 0 && `-${team.ties}`}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {team.gamesBack === 0 ? (
                            <span className="text-blue-600 dark:text-blue-400">—</span>
                          ) : (
                            `${team.gamesBack.toFixed(1)} GB`
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Additional Stats */}
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
                      <div>
                        <span className="font-medium">PF:</span> {team.pointsFor.toFixed(1)}
                      </div>
                      <div>
                        <span className="font-medium">Div:</span>{' '}
                        {team.divisionWins}-{team.divisionLosses}
                        {team.divisionTies > 0 && `-${team.divisionTies}`}
                      </div>
                      <div>
                        <span className="font-medium">Win%:</span>{' '}
                        {(team.winPercentage * 100).toFixed(1)}%
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Division Leaders Summary */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
        <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
          📌 Division Leaders (Automatic Playoff Berths)
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {divisionStandings.map(division => {
            const leader = division.teams[0]
            return (
              <div
                key={division.divisionId}
                className="bg-white dark:bg-gray-800 rounded p-3"
              >
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {division.divisionName}
                </div>
                <div className="text-sm font-bold text-gray-900 dark:text-white">
                  {leader.franchiseName}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {leader.wins}-{leader.losses} ({(leader.winPercentage * 100).toFixed(1)}%)
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
