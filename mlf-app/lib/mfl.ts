import { getOwnerName } from './owner-mappings'
import { getSeasonTotals, calculateEfficiency } from './mfl-data-service'

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
  efficiency: number        // (totalPoints / potentialPoints) * 100 rounded to 1 decimal
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
  // Position breakdown data (optional - from enhanced data service)
  positionTotals?: {
    QB: number
    RB: number
    WR: number
    TE: number
    'O-Flex': number
    K: number
    DL: number
    LB: number
    CB: number
    S: number
    'D-Flex': number
  }
  weeklyPositions?: Array<{
    week: number
    positionTotals: {
      QB: number
      RB: number
      WR: number
      TE: number
      'O-Flex': number
      K: number
      DL: number
      LB: number
      CB: number
      S: number
      'D-Flex': number
    }
  }>
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

export interface MFLPlayerRosterStatusResponse {
  playerRosterStatus?: {
    player: Array<{
      id: string
      name?: string
      position?: string
      team?: string
      is_fa?: string
      cant_add?: string
      locked?: string
      franchise?: Array<{
        id: string
        status: string // R (roster), S (starter), NS (non-starter), IR (injured reserve), TS (taxi squad)
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

// Simple function to fetch team data (used by smart-data-service and import scripts)
export async function fetchTeamsData(year: string, leagueId: string = '46221'): Promise<Team[]> {
  const { fetchWithRetry } = await import('./mfl-api')
  const { getYearSpecificHeaders } = await import('./mfl-api-keys')

  const baseUrl = process.env.MFL_API_BASE_URL || 'https://api.myfantasyleague.com'
  const standingsUrl = `${baseUrl}/${year}/export?TYPE=standings&L=${leagueId}&JSON=1`
  const leagueUrl = `${baseUrl}/${year}/export?TYPE=league&L=${leagueId}&JSON=1`

  const headers = getYearSpecificHeaders(parseInt(year), process.env.MFL_USER_AGENT || 'dynasty-dashboard')

  const [standingsData, leagueData] = await Promise.all([
    fetchWithRetry(standingsUrl, { headers }),
    fetchWithRetry(leagueUrl, { headers })
  ])

  const combinedData = {
    standings: standingsData,
    league: leagueData
  }

  return normalizeTeamData(combinedData as MFLStandingsResponse, parseInt(year))
}

export async function normalizeTeamData(mflData: MFLStandingsResponse, year: number): Promise<Team[]> {
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
    
    // Create lookup for detailed scoring data (fallback only)
    const detailedScoringLookup: { [key: string]: Record<string, unknown> } = {}
    if (Array.isArray(detailedScoring)) {
      console.log(`Processing detailed scoring data for ${detailedScoring.length} teams`)
      detailedScoring.forEach((team: unknown, idx: number) => {
        const t = team as Record<string, unknown>

        // Debug: Show the actual keys in the first item
        if (idx === 0 && detailedScoring.length > 0) {
          console.log(`🔍 First detailedScoring item keys:`, Object.keys(t))
          console.log(`🔍 First detailedScoring item:`, JSON.stringify(t, null, 2))
        }

        if (t.franchiseId as string) {
          detailedScoringLookup[t.franchiseId as string] = t
          if (idx === 0) {
            console.log(`✓ Successfully mapped franchise ${t.franchiseId}`)
          }
        }
      })
      console.log(`Detailed scoring lookup available for ${Object.keys(detailedScoringLookup).length} franchises`)
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
      
      // Get detailed data for starter/bench breakdown (only when not available from MFL)
      const detailedData = detailedScoringLookup[franchiseId]

      // CRITICAL FIX: When detailed data is available, it represents accurate weekly calculations
      // Use those values for ALL fields. Only fall back to MFL season totals when detailed data is missing.
      let totalPoints: number
      let startersPoints: number
      let benchPoints: number
      let offensePoints: number
      let defensePoints: number
      let potentialPoints: number

      if (detailedData) {
        // Use detailed calculated data (from weekly results) as the source of truth
        startersPoints = (detailedData.startersPoints as number) || 0
        benchPoints = (detailedData.benchPoints as number) || 0
        offensePoints = (detailedData.offensePoints as number) || 0
        defensePoints = (detailedData.defensePoints as number) || 0
        totalPoints = startersPoints + benchPoints  // Total = starters + bench (complete team scoring)
        potentialPoints = (detailedData.potentialPoints as number) || 0

        console.log(`✅ Using detailed calculated data for ${franchiseId}: Total=${totalPoints}, Starters=${startersPoints}, Bench=${benchPoints}, Potential=${potentialPoints}`)
      } else {
        // Fallback to MFL's provided season totals when detailed data is not available
        const mflTotalPoints = parseFloat((f.pf as string) || '0') || 0
        startersPoints = mflTotalPoints  // Assume starters = total when no detailed data
        benchPoints = 0
        offensePoints = mflTotalPoints * 0.7  // Estimate
        defensePoints = mflTotalPoints * 0.3  // Estimate
        totalPoints = startersPoints  // Total = starters (matches MFL API spec)
        potentialPoints = parseFloat((f.pp as string) || (f.maxpf as string) || '0') || 0

        console.log(`Using MFL season totals for ${franchiseId}: Total=${totalPoints}, Potential=${potentialPoints}`)
      }

      const pointsAgainst = parseFloat((f.pa as string) || '0') || 0

      // Validate potential points are realistic
      // Potential points should always be >= starter points (you can't score more than optimal starters)
      if (potentialPoints > 0 && potentialPoints < startersPoints) {
        console.warn(`🚨 Franchise ${franchiseId}: Potential points (${potentialPoints.toFixed(2)}) less than starter points (${startersPoints.toFixed(2)}). Using starter points as potential.`)
        potentialPoints = startersPoints
      }

      // If potential points is 0 but we have starter points, something is wrong with the calculation
      if (potentialPoints === 0 && startersPoints > 0) {
        console.warn(`⚠️ Franchise ${franchiseId}: Potential points is 0 but starters is ${startersPoints.toFixed(2)}. Setting potential = starters.`)
        potentialPoints = startersPoints
      }

      const efficiency = calculateEfficiency(startersPoints, potentialPoints)

      // 100% efficiency can happen but is rare - only warn if it seems like a data issue
      if (efficiency === 100 && potentialPoints > 0 && detailedData) {
        console.log(`✓ Franchise ${franchiseId}: 100% efficiency (Total=${totalPoints.toFixed(2)}, Potential=${potentialPoints.toFixed(2)})`)
      }

      const team = {
        id: franchiseId,
        manager: getOwnerName(franchiseId, year),
        teamName: franchiseNames[franchiseId] || getOwnerName(franchiseId, year),
        startersPoints,
        benchPoints,
        offensePoints,
        defensePoints,
        totalPoints,        // Starters + Bench (diverges from MFL)
        potentialPoints,    // MFL's pp/maxpf field (validated)
        efficiency,         // Season efficiency
        qbPoints: (detailedData?.qbPoints as number) || 0,
        rbPoints: (detailedData?.rbPoints as number) || 0,
        wrPoints: (detailedData?.wrPoints as number) || 0,
        tePoints: (detailedData?.tePoints as number) || 0,
        kPoints: (detailedData?.kPoints as number) || 0,
        dlPoints: (detailedData?.dlPoints as number) || 0,
        lbPoints: (detailedData?.lbPoints as number) || 0,
        cbPoints: (detailedData?.cbPoints as number) || 0,
        sPoints: (detailedData?.sPoints as number) || 0,
        offenseFlexPoints: (detailedData?.offenseFlexPoints as number) || 0,
        defenseFlexPoints: (detailedData?.defenseFlexPoints as number) || 0,
        year,
        // Matchup/Record data - Use MFL's provided fields directly
        wins: parseFloat((f.h2hw as string) || '0') || 0,           // MFL's h2hw
        losses: parseFloat((f.h2hl as string) || '0') || 0,         // MFL's h2hl
        ties: parseFloat((f.h2ht as string) || '0') || 0,           // MFL's h2ht
        pointsFor: startersPoints,                                  // Use starter points for H2H matchups
        pointsAgainst,                                              // MFL's pa
        winPercentage: parseFloat((f.h2hpct as string) || '0') || 0 // MFL's h2hpct
      }
      
      if (index === 0) {
        console.log(`Sample mapped team (using MFL totals):`, team)
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
    
    // Use MFL's provided totals directly (Step 2: Fix field mappings)
    const totalPoints = parseFloat((f.pf as string) || '0') || 0      // MFL's pf
    const pointsAgainst = parseFloat((f.pa as string) || '0') || 0    // MFL's pa
    let potentialPoints = parseFloat((f.pp as string) || (f.maxpf as string) || '0') || 0  // MFL's pp/maxpf

    // Validate potential points are realistic
    if (potentialPoints > 0 && potentialPoints < totalPoints) {
      console.warn(`🚨 Franchise ${franchiseId}: Potential points (${potentialPoints}) less than total points (${totalPoints}). Using total points as potential.`)
      potentialPoints = totalPoints
    }

    const efficiency = calculateEfficiency(totalPoints, potentialPoints)

    // Warn when efficiency is 100% (should be rare)
    if (efficiency === 100 && potentialPoints > 0) {
      console.warn(`⚡ Franchise ${franchiseId}: 100% efficiency detected. This may indicate optimal lineup was achieved or data issue.`)
    }

    const team = {
      id: franchiseId,
      manager: getOwnerName(franchiseId, year),
      teamName: getOwnerName(franchiseId, year),
      startersPoints: totalPoints,  // Fallback: assume starters = total
      benchPoints: 0,               // Not available in season totals
      offensePoints: totalPoints * 0.7,  // Estimate
      defensePoints: totalPoints * 0.3,  // Estimate
      totalPoints,                  // MFL's pf
      potentialPoints,              // MFL's pp/maxpf (validated)
      efficiency,                   // Season efficiency
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
      // Matchup/Record data - Use MFL's provided fields directly
      wins: parseFloat((f.h2hw as string) || '0') || 0,
      losses: parseFloat((f.h2hl as string) || '0') || 0,
      ties: parseFloat((f.h2ht as string) || '0') || 0,
      pointsFor: totalPoints,      // MFL's pf
      pointsAgainst,               // MFL's pa
      winPercentage: parseFloat((f.h2hpct as string) || '0') || 0
    }

    if (index === 0) {
      console.log(`Sample direct mapped team (using MFL totals):`, team)
    }
    
    return team
  }).filter((team): team is Team => team !== null) as Team[]
}