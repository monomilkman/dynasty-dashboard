'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { Team } from '@/lib/mfl'
import { formatTeamDisplay, getUniqueYears } from '@/lib/team-utils'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

interface WeeklyScore {
  week: number
  totalPoints: number
  startersPoints: number
  benchPoints: number
  offensePoints: number
  defensePoints: number
  potentialPoints: number
  qbPoints: number
  rbPoints: number
  wrPoints: number
  tePoints: number
  kPoints: number
  dlPoints: number
  lbPoints: number
  cbPoints: number
  sPoints: number
  cumulativeTotalPoints: number
}

interface TeamProgression {
  franchiseId: string
  manager: string
  teamName: string
  year: number
  weeklyScores: WeeklyScore[]
}

interface TeamChartProps {
  teams: Team[]
  chartType: 'totalPoints' | 'startersPoints' | 'benchPoints' | 'offensePoints' | 'defensePoints' | 'potentialPoints' | 'qbPoints' | 'rbPoints' | 'wrPoints' | 'tePoints' | 'kPoints' | 'dlPoints' | 'lbPoints' | 'cbPoints' | 'sPoints'
  selectedWeeks: number[]
}

const chartColors = [
  'rgba(54, 162, 235, 0.8)',   // Blue
  'rgba(255, 99, 132, 0.8)',    // Red
  'rgba(75, 192, 192, 0.8)',    // Green
  'rgba(255, 159, 64, 0.8)',    // Orange
  'rgba(153, 102, 255, 0.8)',   // Purple
  'rgba(255, 205, 86, 0.8)',    // Yellow
  'rgba(201, 203, 207, 0.8)',   // Grey
  'rgba(29, 58, 138, 0.8)',     // Dark blue
  'rgba(220, 38, 38, 0.8)',     // Dark red
  'rgba(5, 150, 105, 0.8)',     // Dark green
  'rgba(217, 119, 6, 0.8)',     // Dark orange
  'rgba(109, 40, 217, 0.8)'     // Dark purple
]

const chartConfigs = {
  totalPoints: { title: 'Weekly Total Points', dataKey: 'totalPoints' as keyof WeeklyScore },
  startersPoints: { title: 'Weekly Starter Points', dataKey: 'startersPoints' as keyof WeeklyScore },
  benchPoints: { title: 'Weekly Bench Points', dataKey: 'benchPoints' as keyof WeeklyScore },
  offensePoints: { title: 'Weekly Offensive Points', dataKey: 'offensePoints' as keyof WeeklyScore },
  defensePoints: { title: 'Weekly Defensive Points', dataKey: 'defensePoints' as keyof WeeklyScore },
  potentialPoints: { title: 'Weekly Potential Points', dataKey: 'potentialPoints' as keyof WeeklyScore },
  qbPoints: { title: 'Weekly QB Points', dataKey: 'qbPoints' as keyof WeeklyScore },
  rbPoints: { title: 'Weekly RB Points', dataKey: 'rbPoints' as keyof WeeklyScore },
  wrPoints: { title: 'Weekly WR Points', dataKey: 'wrPoints' as keyof WeeklyScore },
  tePoints: { title: 'Weekly TE Points', dataKey: 'tePoints' as keyof WeeklyScore },
  kPoints: { title: 'Weekly K Points', dataKey: 'kPoints' as keyof WeeklyScore },
  dlPoints: { title: 'Weekly DL Points', dataKey: 'dlPoints' as keyof WeeklyScore },
  lbPoints: { title: 'Weekly LB Points', dataKey: 'lbPoints' as keyof WeeklyScore },
  cbPoints: { title: 'Weekly CB Points', dataKey: 'cbPoints' as keyof WeeklyScore },
  sPoints: { title: 'Weekly S Points', dataKey: 'sPoints' as keyof WeeklyScore }
}

export default function TeamChart({ teams, chartType, selectedWeeks }: TeamChartProps) {
  const [progressionData, setProgressionData] = useState<TeamProgression[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const config = chartConfigs[chartType]
  const uniqueYears = getUniqueYears(teams)
  const hasMultipleYears = uniqueYears.length > 1

  const fetchProgressionData = useCallback(async () => {
    if (uniqueYears.length === 0) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const allProgressionData: TeamProgression[] = []
      
      // Fetch progression data for each year
      for (const year of uniqueYears) {
        const weeksParam = selectedWeeks.length > 0 ? selectedWeeks.join(',') : ''
        const response = await fetch(`/api/mfl/weekly-progression?year=${year}&weeks=${weeksParam}`)
        
        if (!response.ok) {
          throw new Error(`Failed to fetch progression data for ${year}: ${response.status}`)
        }
        
        const yearData = await response.json()
        if (Array.isArray(yearData)) {
          allProgressionData.push(...yearData)
        }
      }
      
      setProgressionData(allProgressionData)
    } catch (err) {
      console.error('Error fetching progression data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load progression data')
    } finally {
      setIsLoading(false)
    }
  }, [uniqueYears, selectedWeeks])

  useEffect(() => {
    fetchProgressionData()
  }, [fetchProgressionData])

  // Loading state
  if (isLoading) {
    return (
      <div className="h-96 w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading chart data...</span>
      </div>
    )
  }

  // Error state
  if (error || progressionData.length === 0) {
    return (
      <div className="h-96 w-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-2">
            {error || 'No data available'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Unable to load weekly progression data
          </p>
        </div>
      </div>
    )
  }

  // Get all unique weeks from the data to use as x-axis labels
  const allWeeks = [...new Set(
    progressionData.flatMap(team => team.weeklyScores.map(score => score.week))
  )].sort((a, b) => a - b)

  // Create datasets for each team
  const datasets = progressionData.map((team, index) => ({
    label: team.teamName,
    data: allWeeks.map(week => {
      const weekData = team.weeklyScores.find(score => score.week === week)
      return weekData ? (weekData[config.dataKey] as number) : 0
    }),
    borderColor: chartColors[index % chartColors.length].replace('0.8', '1'),
    backgroundColor: chartColors[index % chartColors.length],
    tension: 0.1,
    fill: false,
  }))

  const data = {
    labels: allWeeks.map(week => `Week ${week}`),
    datasets,
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          color: '#ffffff',
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
          },
        },
      },
      title: {
        display: true,
        text: `${config.title} ${selectedWeeks.length > 0 ? `(${selectedWeeks.length === 1 ? `Week ${selectedWeeks[0]}` : `${selectedWeeks.length} Selected Weeks`})` : hasMultipleYears ? `(${uniqueYears.length} Years)` : ''}`,
        font: {
          size: 16,
        },
        color: '#ffffff',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Points',
          color: '#ffffff',
        },
        ticks: {
          color: '#ffffff',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Week',
          color: '#ffffff',
        },
        ticks: {
          color: '#ffffff',
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  }

  return (
    <div className="h-96 w-full">
      <Line data={data} options={options} />
    </div>
  )
}