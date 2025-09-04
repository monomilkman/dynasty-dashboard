'use client'

import { useState, useEffect, useCallback } from 'react'
import { Team } from '@/lib/mfl'
import Leaderboard from './components/Leaderboard'
import YearSelector from './components/YearSelector'
import RefreshButton from './components/RefreshButton'
import ThemeToggle from './components/ThemeToggle'

export default function Home() {
  const [teams, setTeams] = useState<Team[]>([])
  const [selectedYear, setSelectedYear] = useState(2024)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTeams = useCallback(async () => {
    try {
      setError(null)
      const response = await fetch(`/api/mfl?year=${selectedYear}`)
      
      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please wait before trying again.')
        } else if (response.status >= 500) {
          throw new Error('MFL API is temporarily unavailable. Please try again later.')
        } else {
          throw new Error(`Failed to fetch team data (${response.status})`)
        }
      }
      
      const data = await response.json()
      
      // Check for error response
      if (data.error) {
        throw new Error(data.details || data.error)
      }
      
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error('No team data available for the selected year.')
      }
      
      setTeams(data)
    } catch (error) {
      console.error('Error fetching teams:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setError(`Failed to load team data: ${errorMessage}`)
      setTeams([])
    } finally {
      setIsLoading(false)
    }
  }, [selectedYear])

  useEffect(() => {
    setIsLoading(true)
    fetchTeams()
  }, [selectedYear, fetchTeams])

  const handleRefresh = async () => {
    await fetchTeams()
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">MyFantasyLeague Leaderboard</h1>
              <p className="text-muted-foreground">Track team performance and standings</p>
            </div>
            <ThemeToggle />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <YearSelector 
              selectedYear={selectedYear} 
              onYearChange={setSelectedYear}
            />
            <RefreshButton onRefresh={handleRefresh} />
          </div>
        </header>

        <main>
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-pulse">Loading team data...</div>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center text-destructive">
                <p>{error}</p>
              </div>
            </div>
          ) : (
            <Leaderboard teams={teams} />
          )}
        </main>
      </div>
    </div>
  )
}
