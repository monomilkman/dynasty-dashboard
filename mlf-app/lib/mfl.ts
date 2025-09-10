import { getOwnerName } from './owner-mappings'

export interface Player {
  id: string
  name: string
  team: string
  position: string
  score: number
  status: 'starter' | 'bench' | 'ir' | 'taxi'
}

export interface WeeklyLineup {
  week: number
  starters: Player[]
  bench: Player[]
  ir: Player[]
  taxi: Player[]
  totalPoints: number
  startersPoints: number
  benchPoints: number
  potentialPoints: number
  optimalLineup: Player[]
}

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
  qbPoints: number
  rbPoints: number
  wrPoints: number
  tePoints: number
  kPoints: number
  dlPoints: number
  lbPoints: number
  cbPoints: number
  sPoints: number
  offenseFlexPoints: number
  defenseFlexPoints: number
  year: number
  // Matchup/Record data
  wins: number
  losses: number
  ties: number
  pointsFor: number
  pointsAgainst: number
  winPercentage: number
  // Weekly tracking data
  weeklyScores?: WeeklyLineup[]
  currentRoster?: Player[]
}

// MFL API Response Types
export interface MFLPlayerScoresResponse {
  playerScores?: {
    playerScore: Array<{
      id: string
      score: string
      week?: string
    }>
  }
}

export interface MFLRosterResponse {
  rosters?: {
    franchise: Array<{
      id: string
      player: Array<{
        id: string
        status?: string
        salary?: string
        contractYear?: string
        contractInfo?: string
      }>
    }>
  }
}

export interface MFLWeeklyResultsResponse {
  weeklyResults?: {
    matchup: Array<{
      franchise: Array<{
        id: string
        score: string
        result: string
        player?: Array<{
          id: string
          score: string
          shouldStart?: string
          gameSecondsRemaining?: string
          status?: string
        }>
      }>
    }>
  }
}

export interface MFLPlayersResponse {
  players?: {
    player: Array<{
      id: string
      name: string
      team: string
      position: string
    }>
  }
}

export interface MFLLiveScoreResponse {
  liveScoring?: {
    franchise: Array<{
      id: string
      score: string
      gameSecondsRemaining: string
      playersCurrentlyPlaying: string
      playersYetToPlay: string
      player?: Array<{
        id: string
        score: string
        gameSecondsRemaining: string
        status: string
      }>
    }>
  }
}

// Lineup requirements for the league
export interface LineupRequirements {
  qb: number      // 1
  rb: number      // 2  
  wr: number      // 2
  te: number      // 1
  offenseFlex: number // 1 (RB/WR/TE)
  k: number       // 1
  dl: number      // 2
  lb: number      // 3
  cb: number      // 2
  s: number       // 2
  defenseFlex: number // 1 (DL/LB/CB/S)
  total: number   // 18
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
        qbPoints: detailedData?.qbPoints || 0,
        rbPoints: detailedData?.rbPoints || 0,
        wrPoints: detailedData?.wrPoints || 0,
        tePoints: detailedData?.tePoints || 0,
        kPoints: detailedData?.kPoints || 0,
        dlPoints: detailedData?.dlPoints || 0,
        lbPoints: detailedData?.lbPoints || 0,
        cbPoints: detailedData?.cbPoints || 0,
        sPoints: detailedData?.sPoints || 0,
        offenseFlexPoints: detailedData?.offenseFlexPoints || 0,
        defenseFlexPoints: detailedData?.defenseFlexPoints || 0,
        year,
        // Matchup/Record data from API
        wins: parseFloat((f.h2hw as string) || '0') || 0,
        losses: parseFloat((f.h2hl as string) || '0') || 0,
        ties: parseFloat((f.h2ht as string) || '0') || 0,
        pointsFor: totalPointsFromAPI,
        pointsAgainst: parseFloat((f.pa as string) || '0') || 0,
        winPercentage: parseFloat((f.h2hpct as string) || '0') || 0
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
      qbPoints: 0,
      rbPoints: 0,
      wrPoints: 0,
      tePoints: 0,
      kPoints: 0,
      dlPoints: 0,
      lbPoints: 0,
      cbPoints: 0,
      sPoints: 0,
      offenseFlexPoints: 0,
      defenseFlexPoints: 0,
      year,
      // Matchup/Record data from API
      wins: parseFloat((f.h2hw as string) || '0') || 0,
      losses: parseFloat((f.h2hl as string) || '0') || 0,
      ties: parseFloat((f.h2ht as string) || '0') || 0,
      pointsFor: totalPoints,
      pointsAgainst: parseFloat((f.pa as string) || '0') || 0,
      winPercentage: parseFloat((f.h2hpct as string) || '0') || 0
    }

    if (index === 0) {
      console.log(`Sample direct mapped team:`, team)
    }
    
    return team
  }).filter((team): team is Team => team !== null) as Team[]
}