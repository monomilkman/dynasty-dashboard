import { useQuery } from '@tanstack/react-query'

export interface WeeklyProgressionData {
  franchiseId: string
  manager: string
  teamName: string
  year: number
  weeklyScores: {
    week: number
    totalPoints: number
    startersPoints: number
    benchPoints: number
    offensePoints: number
    defensePoints: number
    potentialPoints: number
    efficiency: number
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
  }[]
}

interface UseWeeklyProgressionParams {
  years: number[]
  weeks: number[]
  enabled?: boolean
}

async function fetchWeeklyProgressionData({ years, weeks }: { years: number[], weeks: number[] }): Promise<WeeklyProgressionData[]> {
  if (years.length === 0) return []

  // Fetch weekly progression for all years in parallel
  const promises = years.map(async (year) => {
    const weeksParam = weeks.length > 0 ? `&weeks=${weeks.join(',')}` : ''
    const apiUrl = `/api/mfl/weekly-progression?year=${year}${weeksParam}`

    const response = await fetch(apiUrl)

    if (!response.ok) {
      if (response.status === 429) {
        // Wait and retry once for rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000))
        const retryResponse = await fetch(apiUrl)
        if (!retryResponse.ok) {
          throw new Error(`Rate limit exceeded for weekly progression ${year}`)
        }
        return retryResponse.json()
      }
      throw new Error(`Failed to fetch weekly progression for ${year}`)
    }

    return response.json()
  })

  const results = await Promise.allSettled(promises)
  const allProgressionData: WeeklyProgressionData[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      allProgressionData.push(...result.value)
    } else {
      console.warn(`Failed to fetch weekly progression for ${years[index]}:`, result.status === 'rejected' ? result.reason : 'Invalid data')
    }
  })

  return allProgressionData
}

export function useWeeklyProgressionData({ years, weeks, enabled = true }: UseWeeklyProgressionParams) {
  return useQuery({
    queryKey: ['weekly-progression', years.sort(), weeks.sort()],
    queryFn: () => fetchWeeklyProgressionData({ years, weeks }),
    enabled: enabled && years.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
}