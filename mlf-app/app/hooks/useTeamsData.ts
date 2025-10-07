import { useQuery } from '@tanstack/react-query'
import { Team } from '@/lib/mfl'

interface UseTeamsDataParams {
  years: number[]
  weeks: number[]
  enabled?: boolean
}

interface FetchTeamsParams {
  year: number
  weeks: number[]
}

async function fetchTeamsForYear({ year, weeks }: FetchTeamsParams): Promise<Team[]> {
  const weeksParam = weeks.length > 0 ? `&weeks=${weeks.join(',')}` : ''
  const apiUrl = `/api/mfl?year=${year}${weeksParam}`

  const response = await fetch(apiUrl)

  if (!response.ok) {
    if (response.status === 429) {
      // Wait and retry once for rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000))
      const retryResponse = await fetch(apiUrl)
      if (!retryResponse.ok) {
        throw new Error(`Rate limit exceeded for ${year}. Please try again later.`)
      }
      const retryData = await retryResponse.json()
      return retryData.map((team: Team) => ({ ...team, year: team.year || year }))
    } else if (response.status >= 500) {
      throw new Error(`Server error for ${year}`)
    } else {
      throw new Error(`Failed to fetch team data for ${year} (${response.status})`)
    }
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`API error for ${year}: ${data.details || data.error}`)
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error(`No data available for ${year}`)
  }

  return data.map((team: Team) => ({ ...team, year: team.year || year }))
}

async function fetchAllTeamsData({ years, weeks }: { years: number[], weeks: number[] }): Promise<Team[]> {
  if (years.length === 0) return []

  // Fetch all years in parallel for better performance
  const promises = years.map(year => fetchTeamsForYear({ year, weeks }))
  const results = await Promise.allSettled(promises)

  const allTeamsData: Team[] = []
  const errors: string[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allTeamsData.push(...result.value)
    } else {
      errors.push(`Failed to fetch data for ${years[index]}: ${result.reason.message}`)
      console.warn(`Failed to fetch data for ${years[index]}:`, result.reason)
    }
  })

  // If we have some data but also some errors, still return the data
  if (allTeamsData.length > 0 && errors.length > 0) {
    console.warn('Some years failed to load:', errors)
  } else if (allTeamsData.length === 0 && errors.length > 0) {
    throw new Error(`Failed to fetch data: ${errors.join(', ')}`)
  }

  return allTeamsData
}

export function useTeamsData({ years, weeks, enabled = true }: UseTeamsDataParams) {
  return useQuery({
    queryKey: ['teams', years.sort(), weeks.sort()],
    queryFn: () => fetchAllTeamsData({ years, weeks }),
    enabled: enabled && years.length > 0,
    staleTime: 1 * 60 * 1000, // 1 minute for real-time updates
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}

// Hook for a single year (for components that need specific year data)
export function useTeamsDataForYear(year: number, weeks: number[] = []) {
  return useQuery({
    queryKey: ['teams', year, weeks.sort()],
    queryFn: () => fetchTeamsForYear({ year, weeks }),
    staleTime: 1 * 60 * 1000, // 1 minute for real-time updates
    gcTime: 10 * 60 * 1000,
  })
}