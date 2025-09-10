import { Team } from './mfl'

export type ExportFormat = 'csv' | 'json'

export interface ExportOptions {
  format: ExportFormat
  filename?: string
  includeHeaders?: boolean
}

// CSV utility functions
function escapeCSVValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function arrayToCSV(data: (string | number | null | undefined)[][], includeHeaders = true): string {
  return data.map(row => 
    row.map(cell => escapeCSVValue(cell)).join(',')
  ).join('\n')
}

// File download utility
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// Team data export functions
export function exportTeamsData(teams: Team[], options: ExportOptions): void {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  const defaultFilename = `mfl-teams-${timestamp}`
  const filename = options.filename || defaultFilename

  if (options.format === 'csv') {
    exportTeamsToCSV(teams, filename, options.includeHeaders !== false)
  } else if (options.format === 'json') {
    exportTeamsToJSON(teams, filename)
  }
}

function exportTeamsToCSV(teams: Team[], filename: string, includeHeaders: boolean): void {
  const headers = [
    'Team Name', 'Manager', 'Wins', 'Losses', 'Ties', 'Win %',
    'Points For', 'Points Against', 'Point Diff', 'Total Points', 'Potential Points',
    'Starters Points', 'Bench Points', 'Offense Points', 'Defense Points',
    'QB Points', 'RB Points', 'WR Points', 'TE Points', 'K Points',
    'DL Points', 'LB Points', 'CB Points', 'S Points',
    'Offense Flex Points', 'Defense Flex Points', 'Year'
  ]

  const rows = teams.map(team => [
    team.teamName,
    team.manager,
    team.wins,
    team.losses,
    team.ties,
    (team.winPercentage * 100).toFixed(1) + '%',
    team.pointsFor.toFixed(2),
    team.pointsAgainst.toFixed(2),
    (team.pointsFor - team.pointsAgainst).toFixed(1),
    team.totalPoints.toFixed(2),
    team.potentialPoints.toFixed(2),
    team.startersPoints.toFixed(2),
    team.benchPoints.toFixed(2),
    team.offensePoints.toFixed(2),
    team.defensePoints.toFixed(2),
    team.qbPoints.toFixed(2),
    team.rbPoints.toFixed(2),
    team.wrPoints.toFixed(2),
    team.tePoints.toFixed(2),
    team.kPoints.toFixed(2),
    team.dlPoints.toFixed(2),
    team.lbPoints.toFixed(2),
    team.cbPoints.toFixed(2),
    team.sPoints.toFixed(2),
    team.offenseFlexPoints.toFixed(2),
    team.defenseFlexPoints.toFixed(2),
    team.year
  ])

  const csvData = includeHeaders ? [headers, ...rows] : rows
  const csvContent = arrayToCSV(csvData)
  downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;')
}

function exportTeamsToJSON(teams: Team[], filename: string): void {
  const jsonContent = JSON.stringify({
    exportDate: new Date().toISOString(),
    totalTeams: teams.length,
    data: teams
  }, null, 2)
  downloadFile(jsonContent, `${filename}.json`, 'application/json;charset=utf-8;')
}

// Specific view export functions
export function exportMatchupsData(teams: Team[], options: ExportOptions): void {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  const filename = options.filename || `mfl-matchups-${timestamp}`

  if (options.format === 'csv') {
    const headers = [
      'Rank', 'Team Name', 'Manager', 'Wins', 'Losses', 'Record',
      'Win %', 'Points For', 'Points Against', 'Point Differential'
    ]

    const rows = teams
      .sort((a, b) => b.winPercentage - a.winPercentage)
      .map((team, index) => [
        index + 1,
        team.teamName,
        team.manager,
        team.wins,
        team.losses,
        `${team.wins}-${team.losses}${team.ties > 0 ? `-${team.ties}` : ''}`,
        (team.winPercentage * 100).toFixed(1) + '%',
        team.pointsFor.toFixed(2),
        team.pointsAgainst.toFixed(2),
        (team.pointsFor - team.pointsAgainst > 0 ? '+' : '') + (team.pointsFor - team.pointsAgainst).toFixed(1)
      ])

    const csvData = options.includeHeaders !== false ? [headers, ...rows] : rows
    const csvContent = arrayToCSV(csvData)
    downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;')
  } else {
    const matchupsData = teams
      .sort((a, b) => b.winPercentage - a.winPercentage)
      .map((team, index) => ({
        rank: index + 1,
        teamName: team.teamName,
        manager: team.manager,
        wins: team.wins,
        losses: team.losses,
        ties: team.ties,
        winPercentage: team.winPercentage,
        pointsFor: team.pointsFor,
        pointsAgainst: team.pointsAgainst,
        pointDifferential: team.pointsFor - team.pointsAgainst
      }))

    const jsonContent = JSON.stringify({
      exportDate: new Date().toISOString(),
      exportType: 'matchups',
      totalTeams: teams.length,
      data: matchupsData
    }, null, 2)
    downloadFile(jsonContent, `${filename}.json`, 'application/json;charset=utf-8;')
  }
}

export function exportPositionalData(teams: Team[], statFilter: 'all' | 'offense' | 'defense', options: ExportOptions): void {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  const filename = options.filename || `mfl-positions-${statFilter}-${timestamp}`

  if (options.format === 'csv') {
    // Determine headers based on stat filter
    let headers: string[]
    if (statFilter === 'offense' || statFilter === 'all') {
      headers = [
        'Team Name', 'Manager', 'Total Points', 'Offense Points',
        'QB Points', 'RB Points', 'WR Points', 'TE Points', 'K Points', 'Offense Flex Points'
      ]
      
      if (statFilter === 'all') {
        headers.push('Defense Points', 'DL Points', 'LB Points', 'CB Points', 'S Points', 'Defense Flex Points')
      }
    } else {
      headers = [
        'Team Name', 'Manager', 'Total Points', 'Defense Points',
        'DL Points', 'LB Points', 'CB Points', 'S Points', 'Defense Flex Points'
      ]
    }

    // Generate data rows
    const dataRows = teams.map(team => {
      const baseRow = [
        team.teamName,
        team.manager,
        team.totalPoints.toFixed(2)
      ]

      if (statFilter === 'offense') {
        return [
          ...baseRow,
          team.offensePoints.toFixed(2),
          team.qbPoints.toFixed(2),
          team.rbPoints.toFixed(2),
          team.wrPoints.toFixed(2),
          team.tePoints.toFixed(2),
          team.kPoints.toFixed(2),
          team.offenseFlexPoints.toFixed(2)
        ]
      } else if (statFilter === 'defense') {
        return [
          ...baseRow,
          team.defensePoints.toFixed(2),
          team.dlPoints.toFixed(2),
          team.lbPoints.toFixed(2),
          team.cbPoints.toFixed(2),
          team.sPoints.toFixed(2),
          team.defenseFlexPoints.toFixed(2)
        ]
      } else {
        return [
          ...baseRow,
          team.offensePoints.toFixed(2),
          team.qbPoints.toFixed(2),
          team.rbPoints.toFixed(2),
          team.wrPoints.toFixed(2),
          team.tePoints.toFixed(2),
          team.kPoints.toFixed(2),
          team.offenseFlexPoints.toFixed(2),
          team.defensePoints.toFixed(2),
          team.dlPoints.toFixed(2),
          team.lbPoints.toFixed(2),
          team.cbPoints.toFixed(2),
          team.sPoints.toFixed(2),
          team.defenseFlexPoints.toFixed(2)
        ]
      }
    })

    const csvData = options.includeHeaders !== false ? [headers, ...dataRows] : dataRows
    const csvContent = arrayToCSV(csvData)
    downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;')
  } else {
    const jsonContent = JSON.stringify({
      exportDate: new Date().toISOString(),
      exportType: 'positional',
      statFilter,
      totalTeams: teams.length,
      data: teams
    }, null, 2)
    downloadFile(jsonContent, `${filename}.json`, 'application/json;charset=utf-8;')
  }
}

// Head-to-head comparison export
export function exportComparisonData(team1: Team, team2: Team, team3?: Team, options?: ExportOptions): void {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  const teamNames = [team1.teamName, team2.teamName, ...(team3 ? [team3.teamName] : [])]
    .map(name => name.replace(/\s+/g, '-'))
    .join('-vs-')
  const filename = options?.filename || `mfl-comparison-${teamNames}-${timestamp}`

  const teams = [team1, team2, ...(team3 ? [team3] : [])]

  if (options?.format === 'csv') {
    const headers = [
      'Statistic',
      `${team1.teamName} (${team1.manager})`,
      `${team2.teamName} (${team2.manager})`,
      ...(team3 ? [`${team3.teamName} (${team3.manager})`] : []),
      'Best Team'
    ]
    
    const comparisonStats = [
      { label: 'Total Points', values: teams.map(t => t.totalPoints) },
      { label: 'Potential Points', values: teams.map(t => t.potentialPoints) },
      { label: 'Starter Points', values: teams.map(t => t.startersPoints) },
      { label: 'Bench Points', values: teams.map(t => t.benchPoints) },
      { label: 'Offense Points', values: teams.map(t => t.offensePoints) },
      { label: 'Defense Points', values: teams.map(t => t.defensePoints) },
      { label: 'QB Points', values: teams.map(t => t.qbPoints) },
      { label: 'RB Points', values: teams.map(t => t.rbPoints) },
      { label: 'WR Points', values: teams.map(t => t.wrPoints) },
      { label: 'TE Points', values: teams.map(t => t.tePoints) },
      { label: 'K Points', values: teams.map(t => t.kPoints) },
      { label: 'DL Points', values: teams.map(t => t.dlPoints) },
      { label: 'LB Points', values: teams.map(t => t.lbPoints) },
      { label: 'CB Points', values: teams.map(t => t.cbPoints) },
      { label: 'S Points', values: teams.map(t => t.sPoints) },
      { label: 'Wins', values: teams.map(t => t.wins) },
      { label: 'Losses', values: teams.map(t => t.losses) },
      { label: 'Win %', values: teams.map(t => t.winPercentage * 100) },
      { label: 'Points For', values: teams.map(t => t.pointsFor) },
      { label: 'Points Against', values: teams.map(t => t.pointsAgainst) }
    ]

    const rowsData = comparisonStats.map(stat => {
      let bestTeamName = 'Tie'
      if (stat.label === 'Losses' || stat.label === 'Points Against') {
        // Lower is better for these stats
        const minValue = Math.min(...stat.values)
        const bestIndex = stat.values.indexOf(minValue)
        const tiedTeams = stat.values.filter(v => v === minValue).length
        bestTeamName = tiedTeams === 1 ? teams[bestIndex].teamName : 'Tie'
      } else {
        // Higher is better for all other stats
        const maxValue = Math.max(...stat.values)
        const bestIndex = stat.values.indexOf(maxValue)
        const tiedTeams = stat.values.filter(v => v === maxValue).length
        bestTeamName = tiedTeams === 1 ? teams[bestIndex].teamName : 'Tie'
      }

      return [
        stat.label,
        ...stat.values.map(v => v.toFixed(2)),
        bestTeamName
      ]
    })

    const csvData = options.includeHeaders !== false ? [headers, ...rowsData] : rowsData
    const csvContent = arrayToCSV(csvData)
    downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;')
  } else {
    const comparisonData = {
      exportDate: new Date().toISOString(),
      exportType: 'head-to-head-comparison',
      teamCount: teams.length,
      teams: teams.map(team => ({
        id: team.id,
        teamName: team.teamName,
        manager: team.manager,
        stats: team
      }))
    }

    const jsonContent = JSON.stringify(comparisonData, null, 2)
    downloadFile(jsonContent, `${filename}.json`, 'application/json;charset=utf-8;')
  }
}

// Chart data export
export function exportChartData(teams: Team[], chartType: string, options: ExportOptions): void {
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  const filename = options.filename || `mfl-chart-${chartType}-${timestamp}`

  const chartData = teams.map(team => ({
    teamName: team.teamName,
    manager: team.manager,
    value: getChartValue(team, chartType)
  })).sort((a, b) => b.value - a.value)

  if (options.format === 'csv') {
    const headers = ['Team Name', 'Manager', chartType.charAt(0).toUpperCase() + chartType.slice(1)]
    const rows = chartData.map(item => [item.teamName, item.manager, item.value.toFixed(2)])
    
    const csvData = options.includeHeaders !== false ? [headers, ...rows] : rows
    const csvContent = arrayToCSV(csvData)
    downloadFile(csvContent, `${filename}.csv`, 'text/csv;charset=utf-8;')
  } else {
    const jsonContent = JSON.stringify({
      exportDate: new Date().toISOString(),
      exportType: 'chart',
      chartType,
      totalTeams: teams.length,
      data: chartData
    }, null, 2)
    downloadFile(jsonContent, `${filename}.json`, 'application/json;charset=utf-8;')
  }
}

function getChartValue(team: Team, chartType: string): number {
  switch (chartType) {
    case 'totalPoints': return team.totalPoints
    case 'offensePoints': return team.offensePoints
    case 'defensePoints': return team.defensePoints
    case 'potentialPoints': return team.potentialPoints
    case 'starterPoints': return team.startersPoints
    case 'benchPoints': return team.benchPoints
    case 'qbPoints': return team.qbPoints
    case 'rbPoints': return team.rbPoints
    case 'wrPoints': return team.wrPoints
    case 'tePoints': return team.tePoints
    case 'kPoints': return team.kPoints
    case 'dlPoints': return team.dlPoints
    case 'lbPoints': return team.lbPoints
    case 'cbPoints': return team.cbPoints
    case 'sPoints': return team.sPoints
    default: return team.totalPoints
  }
}