import { useQuery } from '@tanstack/react-query'

export interface MatchupRecord {
  franchiseId: string
  manager: string
  teamName: string
  year: number
  wins: number
  losses: number
  pointsFor: number
  pointsAgainst: number
  winPercentage: number
  allPlayWins: number
  allPlayLosses: number
  allPlayWinPercentage: number
  weeklyResults: {
    week: number
    opponent: string
    pointsFor: number
    pointsAgainst: number
    result: 'W' | 'L'
    margin: number
  }[]
}

interface UseMatchupsDataParams {
  years: number[]
  weeks: number[]
  enabled?: boolean
}

async function fetchMatchupsData({ years, weeks }: { years: number[], weeks: number[] }): Promise<MatchupRecord[]> {
  if (years.length === 0) return []

  // Fetch matchups for all years in parallel
  const promises = years.map(async (year) => {
    const weeksParam = weeks.length > 0 ? `&weeks=${weeks.join(',')}` : ''
    const apiUrl = `/api/mfl/matchups?year=${year}${weeksParam}`

    const response = await fetch(apiUrl)

    if (!response.ok) {
      if (response.status === 429) {
        // Wait and retry once for rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000))
        const retryResponse = await fetch(apiUrl)
        if (!retryResponse.ok) {
          throw new Error(`Rate limit exceeded for matchups ${year}`)
        }
        return retryResponse.json()
      }
      throw new Error(`Failed to fetch matchups for ${year}`)
    }

    return response.json()
  })

  const results = await Promise.allSettled(promises)
  const allMatchupsData: MatchupRecord[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allMatchupsData.push(...result.value)
    } else {
      console.warn(`Failed to fetch matchups for ${years[index]}:`, result.status === 'rejected' ? result.reason : 'Invalid data')
    }
  })

  return allMatchupsData
}

export function useMatchupsData({ years, weeks, enabled = true }: UseMatchupsDataParams) {
  return useQuery({
    queryKey: ['matchups', years.sort(), weeks.sort()],
    queryFn: () => fetchMatchupsData({ years, weeks }),
    enabled: enabled && years.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}