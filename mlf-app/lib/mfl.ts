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
  league: {
    standings: {
      franchise: Array<{
        id: string
        name: string
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
}

export function normalizeTeamData(mflData: MFLStandingsResponse, year: number): Team[] {
  if (!mflData?.league?.standings?.franchise) {
    return []
  }

  return mflData.league.standings.franchise.map((franchise) => {
    const startersPoints = parseFloat(franchise.sp || '0')
    const benchPoints = parseFloat(franchise.bp || '0') 
    const offensePoints = parseFloat(franchise.op || '0')
    const defensePoints = parseFloat(franchise.dp || '0')
    const totalPoints = parseFloat(franchise.pf || '0')
    const potentialPoints = parseFloat(franchise.pp || '0')

    return {
      id: franchise.id,
      manager: franchise.name || `Manager ${franchise.id}`,
      teamName: franchise.name || `Team ${franchise.id}`,
      startersPoints,
      benchPoints,
      offensePoints,
      defensePoints,
      totalPoints,
      potentialPoints,
      year
    }
  })
}