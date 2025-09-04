import { getOwnerName } from './owner-mappings'

export interface Team {
  id: string
  manager: string
  teamName: string
  startersPoints: number
  benchPoints: number
  offensePoints: number
  defensePoints: number
  totalPoints: number
  potentialPoints: number
  year: number
}

export interface MFLStandingsResponse {
  standings?: {
    version?: string
    encoding?: string
    league?: {
      standings: {
        franchise: Array<{
          id: string
          name?: string
          h2hw?: string
          h2hl?: string
          pf?: string
          pp?: string
          maxpf?: string
          opppf?: string
          pct?: string
          dp?: string
          sp?: string
          op?: string
          bp?: string
        }>
      }
    }
    leagueStandings?: {
      franchise: Array<{
        id: string
        name?: string
        h2hw?: string
        h2hl?: string
        pf?: string
        pp?: string
        maxpf?: string
        opppf?: string
        pct?: string
        dp?: string
        sp?: string
        op?: string
        bp?: string
      }>
    }
  }
  league?: {
    version?: string
    encoding?: string
    league?: {
      franchises?: {
        franchise: Array<{
          id: string
          name?: string
          owner_name?: string
        }>
      }
    }
  }
  owners?: {
    version?: string
    encoding?: string
    owners?: {
      owner: Array<{
        id: string
        name?: string
        email?: string
      }>
    }
  }
}

export function normalizeTeamData(mflData: MFLStandingsResponse, year: number): Team[] {
  // Validate the response structure
  if (!mflData || typeof mflData !== 'object') {
    console.error('Invalid MFL data structure:', mflData)
    return []
  }

  console.log('MFL Data structure:', Object.keys(mflData))

  // Handle combined structure (standings + league + detailedScoring)
  if (mflData.standings && mflData.league) {
    const standingsData = mflData.standings as Record<string, unknown>
    const franchiseData = (standingsData.leagueStandings as Record<string, unknown>)?.franchise as unknown[] || ((standingsData.league as Record<string, unknown>)?.standings as Record<string, unknown>)?.franchise as unknown[] || []
    
    // Get league info for franchise names
    const leagueInfo = mflData.league as Record<string, unknown>
    const franchiseInfo = ((leagueInfo?.league as Record<string, unknown>)?.franchises as Record<string, unknown>)?.franchise as unknown[] || []
    
    // Get detailed scoring data if available
    const detailedScoring = (mflData as Record<string, unknown>).detailedScoring as unknown[] || []
    
    console.log(`Combined API: Found ${franchiseData.length} franchises in standings, ${franchiseInfo.length} in league info, ${detailedScoring.length} detailed scoring`)
    
    // Create lookup for franchise names  
    const franchiseNames: { [key: string]: string } = {}
    if (Array.isArray(franchiseInfo)) {
      franchiseInfo.forEach((franchise: unknown) => {
        const f = franchise as Record<string, unknown>
        if (f.id) {
          franchiseNames[f.id as string] = (f.name as string) || `Team ${f.id}`
        }
      })
    }
    
    // Create lookup for detailed scoring data
    const detailedScoringLookup: { [key: string]: Record<string, unknown> } = {}
    if (Array.isArray(detailedScoring)) {
      detailedScoring.forEach((team: unknown) => {
        const t = team as Record<string, unknown>
        if (t.franchiseId as string) {
          detailedScoringLookup[t.franchiseId as string] = t
        }
      })
    }
    
    // Debug logging
    if (franchiseData.length > 0) {
      console.log(`Sample standings data:`, JSON.stringify(franchiseData[0], null, 2))
    }
    if (franchiseInfo.length > 0) {
      console.log(`Sample league data:`, JSON.stringify(franchiseInfo[0], null, 2))
    }
    
    return franchiseData.map((franchise: unknown, index: number) => {
      const f = franchise as Record<string, unknown>
      const franchiseId = (f.id as string) || `unknown_${index}`
      
      // Get API data
      const totalPointsFromAPI = parseFloat((f.pf as string) || '0') || 0
      const potentialPointsFromAPI = parseFloat((f.pp as string) || (f.maxpf as string) || '0') || 0
      
      // Get detailed scoring data if available from scraping
      const detailedData = detailedScoringLookup[franchiseId]
      
      let startersPoints, benchPoints, offensePoints, defensePoints, totalPoints, potentialPoints
      
      if (detailedData) {
        // Use scraped detailed scoring data
        startersPoints = detailedData.startersPoints || 0
        benchPoints = detailedData.benchPoints || 0
        offensePoints = detailedData.offensePoints || 0
        defensePoints = detailedData.defensePoints || 0
        totalPoints = detailedData.totalPoints || startersPoints || totalPointsFromAPI
        potentialPoints = detailedData.potentialPoints || 0
        
        console.log(`Using detailed scoring for ${franchiseId}: S=${startersPoints}, B=${benchPoints}, O=${offensePoints}, D=${defensePoints}, T=${totalPoints}, P=${potentialPoints}`)
      } else {
        // Fallback to API data (old behavior)
        startersPoints = totalPointsFromAPI
        benchPoints = 0
        offensePoints = totalPointsFromAPI
        defensePoints = 0
        totalPoints = totalPointsFromAPI
        potentialPoints = potentialPointsFromAPI
      }
      
      const team = {
        id: franchiseId,
        manager: getOwnerName(franchiseId, year),
        teamName: franchiseNames[franchiseId] || `Team ${franchiseId}`,
        startersPoints,
        benchPoints,
        offensePoints,
        defensePoints,
        totalPoints,
        potentialPoints,
        year
      }
      
      if (index === 0) {
        console.log(`Sample mapped team:`, team)
      }
      
      return team
    }).filter((team): team is Team => team !== null) as Team[]
  }
  
  // Handle direct standings response (fallback)
  console.log('Using direct API response structure')
  const franchiseData = ((mflData as Record<string, unknown>).leagueStandings as Record<string, unknown>)?.franchise as unknown[] || (((mflData as Record<string, unknown>).league as Record<string, unknown>)?.standings as Record<string, unknown>)?.franchise as unknown[] || []
  
  if (!Array.isArray(franchiseData)) {
    console.error('Franchise data is not an array:', franchiseData)
    return []
  }
  
  console.log(`Direct API: Found ${franchiseData.length} franchises`)

  return franchiseData.map((franchise: unknown, index: number) => {
    const f = franchise as Record<string, unknown>
    if (index === 0) {
      console.log(`Sample direct franchise data:`, JSON.stringify(f, null, 2))
    }

    const franchiseId = (f.id as string) || `unknown_${index}`
    const totalPoints = parseFloat((f.pf as string) || '0') || 0
    const potentialPoints = parseFloat((f.pp as string) || (f.maxpf as string) || '0') || 0

    const team = {
      id: franchiseId,
      manager: getOwnerName(franchiseId, year),
      teamName: `Team ${franchiseId}`,
      startersPoints: totalPoints,
      benchPoints: 0,
      offensePoints: totalPoints,
      defensePoints: 0,
      totalPoints,
      potentialPoints,
      year
    }

    if (index === 0) {
      console.log(`Sample direct mapped team:`, team)
    }
    
    return team
  }).filter((team): team is Team => team !== null) as Team[]
}