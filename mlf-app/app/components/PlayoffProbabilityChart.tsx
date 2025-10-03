'use client'

import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import { getTeamHistory, type TeamPlayoffHistory } from '@/lib/playoff-history'

Chart.register(...registerables)

interface PlayoffProbabilityChartProps {
  franchiseId: string
  franchiseName: string
  year: number
  currentWeek: number
}

export default function PlayoffProbabilityChart({
  franchiseId,
  franchiseName,
  year,
  currentWeek
}: PlayoffProbabilityChartProps) {
  const chartRef = useRef<HTMLCanvasElement>(null)
  const chartInstance = useRef<Chart | null>(null)
  const [history, setHistory] = useState<TeamPlayoffHistory | null>(null)
  const [showDivisionLine, setShowDivisionLine] = useState(true)

  // Load historical data
  useEffect(() => {
    const teamHistory = getTeamHistory(franchiseId, year)
    setHistory(teamHistory)
  }, [franchiseId, year])

  // Create/update chart
  useEffect(() => {
    if (!chartRef.current || !history || history.snapshots.length === 0) return

    const ctx = chartRef.current.getContext('2d')
    if (!ctx) return

    // Destroy existing chart
    if (chartInstance.current) {
      chartInstance.current.destroy()
    }

    // Prepare data
    const weeks = history.snapshots.map(s => s.week)
    const playoffProbs = history.snapshots.map(s => s.playoffProbability)
    const divisionProbs = history.snapshots.map(s => s.divisionWinProbability)

    // Create datasets
    const datasets: any[] = [
      {
        label: 'Playoff Probability',
        data: playoffProbs,
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 3,
        tension: 0.3,
        fill: true,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }
    ]

    if (showDivisionLine) {
      datasets.push({
        label: 'Division Win Probability',
        data: divisionProbs,
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderWidth: 2,
        borderDash: [5, 5],
        tension: 0.3,
        fill: false,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: 'rgb(168, 85, 247)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      })
    }

    // Create chart
    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        labels: weeks.map(w => `Week ${w}`),
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 15,
              font: {
                size: 12
              }
            }
          },
          title: {
            display: true,
            text: `${franchiseName} - Playoff Probability Trends`,
            font: {
              size: 16,
              weight: 'bold'
            },
            padding: {
              top: 10,
              bottom: 20
            }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.dataset.label || ''
                const value = context.parsed.y.toFixed(1)
                const snapshot = history.snapshots[context.dataIndex]

                if (context.datasetIndex === 0) {
                  // Playoff probability tooltip
                  return [
                    `${label}: ${value}%`,
                    `Record: ${snapshot.record.wins}-${snapshot.record.losses}`,
                    `Points: ${snapshot.pointsFor.toFixed(1)}`,
                    `Avg Seed: ${snapshot.avgSeed.toFixed(1)}`
                  ]
                } else {
                  // Division win probability tooltip
                  return `${label}: ${value}%`
                }
              }
            }
          }
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Week',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            grid: {
              display: false
            }
          },
          y: {
            title: {
              display: true,
              text: 'Probability (%)',
              font: {
                size: 14,
                weight: 'bold'
              }
            },
            min: 0,
            max: 100,
            ticks: {
              callback: function(value) {
                return value + '%'
              }
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            }
          }
        }
      }
    })

    // Cleanup
    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy()
      }
    }
  }, [history, franchiseName, showDivisionLine])

  if (!history || history.snapshots.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <p className="text-center text-gray-500 dark:text-gray-400">
          No historical data available yet. Data will appear after Week 2.
        </p>
      </div>
    )
  }

  // Calculate statistics
  const currentSnapshot = history.snapshots[history.snapshots.length - 1]
  const previousSnapshot = history.snapshots.length > 1
    ? history.snapshots[history.snapshots.length - 2]
    : null
  const change = previousSnapshot
    ? currentSnapshot.playoffProbability - previousSnapshot.playoffProbability
    : 0

  const maxProb = Math.max(...history.snapshots.map(s => s.playoffProbability))
  const minProb = Math.min(...history.snapshots.map(s => s.playoffProbability))
  const avgProb = history.snapshots.reduce((sum, s) => sum + s.playoffProbability, 0) / history.snapshots.length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
      {/* Chart Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showDivisionLine}
              onChange={(e) => setShowDivisionLine(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Show Division Win %
            </span>
          </label>
        </div>

        {/* Quick Stats */}
        <div className="flex gap-4 text-sm">
          <div className="text-center">
            <div className="text-gray-500 dark:text-gray-400">Current</div>
            <div className="font-bold text-gray-900 dark:text-white">
              {currentSnapshot.playoffProbability.toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-500 dark:text-gray-400">Change</div>
            <div className={`font-bold ${change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {change >= 0 ? '+' : ''}{change.toFixed(1)}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-500 dark:text-gray-400">Peak</div>
            <div className="font-bold text-gray-900 dark:text-white">
              {maxProb.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="relative" style={{ height: '400px' }}>
        <canvas ref={chartRef}></canvas>
      </div>

      {/* Additional Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Average</div>
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            {avgProb.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Low Point</div>
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            {minProb.toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Volatility</div>
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            ±{((maxProb - minProb) / 2).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">Weeks Tracked</div>
          <div className="text-sm font-semibold text-gray-900 dark:text-white">
            {history.snapshots.length}
          </div>
        </div>
      </div>
    </div>
  )
}
