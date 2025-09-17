import { PrismaClient } from './generated/prisma'

// Global instance to prevent multiple connections in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Database utility functions
export class DatabaseService {

  /**
   * Get teams for a specific year from database
   */
  static async getTeams(year: number) {
    return await prisma.team.findMany({
      where: { year },
      orderBy: [
        { wins: 'desc' },
        { losses: 'asc' },
        { pointsFor: 'desc' }
      ]
    })
  }

  /**
   * Get weekly results for a specific year/week
   */
  static async getWeeklyResults(year: number, week?: number) {
    const where: any = { year }
    if (week) where.week = week

    return await prisma.weeklyResult.findMany({
      where,
      include: {
        team: true
      },
      orderBy: [
        { week: 'asc' },
        { franchiseId: 'asc' }
      ]
    })
  }

  /**
   * Get positional data for a specific year
   */
  static async getPositionalData(year: number, weeks?: number[]) {
    const where: any = { year }
    if (weeks && weeks.length > 0) {
      where.week = { in: weeks }
    }

    return await prisma.positionalData.findMany({
      where,
      include: {
        team: true
      },
      orderBy: [
        { week: 'asc' },
        { franchiseId: 'asc' }
      ]
    })
  }

  /**
   * Check if a season exists in database
   */
  static async seasonExists(year: number): Promise<boolean> {
    const season = await prisma.season.findUnique({
      where: { year }
    })
    return !!season
  }

  /**
   * Check if week data is finalized in MFL
   */
  static async isWeekFinalized(year: number, week: number): Promise<boolean> {
    const weekResult = await prisma.weeklyResult.findFirst({
      where: { year, week, mflFinalized: true }
    })
    return !!weekResult
  }

  /**
   * Create or update season
   */
  static async upsertSeason(data: {
    year: number
    leagueId: string
    leagueName?: string
    isActive?: boolean
    settings?: any
  }) {
    return await prisma.season.upsert({
      where: { year: data.year },
      update: data,
      create: data
    })
  }

  /**
   * Bulk insert teams for a season
   */
  static async bulkInsertTeams(teams: any[]) {
    return await prisma.team.createMany({
      data: teams
    })
  }

  /**
   * Bulk insert weekly results
   */
  static async bulkInsertWeeklyResults(results: any[]) {
    return await prisma.weeklyResult.createMany({
      data: results,
    })
  }

  /**
   * Bulk insert player scores
   */
  static async bulkInsertPlayerScores(scores: any[]) {
    return await prisma.playerScore.createMany({
      data: scores,
    })
  }

  /**
   * Bulk insert positional data
   */
  static async bulkInsertPositionalData(data: any[]) {
    return await prisma.positionalData.createMany({
      data,
    })
  }

  /**
   * Update team season totals from weekly results
   */
  static async updateTeamTotals(year: number) {
    const teams = await prisma.team.findMany({ where: { year } })

    for (const team of teams) {
      const weeklyResults = await prisma.weeklyResult.findMany({
        where: { year, franchiseId: team.franchiseId }
      })

      const wins = weeklyResults.filter(w => w.result === 'W').length
      const losses = weeklyResults.filter(w => w.result === 'L').length
      const ties = weeklyResults.filter(w => w.result === 'T').length
      const pointsFor = weeklyResults.reduce((sum, w) => sum + w.score, 0)
      const pointsAgainst = weeklyResults.reduce((sum, w) => sum + w.opponentScore, 0)

      await prisma.team.update({
        where: { id: team.id },
        data: {
          wins,
          losses,
          ties,
          pointsFor,
          pointsAgainst
        }
      })
    }
  }

  /**
   * Get data freshness info
   */
  static async getDataFreshness(year: number) {
    const season = await prisma.season.findUnique({
      where: { year },
      include: {
        _count: {
          select: {
            teams: true,
            weeklyResults: true,
            playerScores: true,
            positionalData: true
          }
        }
      }
    })

    if (!season) return null

    const lastWeeklyResult = await prisma.weeklyResult.findFirst({
      where: { year },
      orderBy: { updatedAt: 'desc' }
    })

    return {
      season,
      counts: season._count,
      lastUpdated: lastWeeklyResult?.updatedAt,
      isComplete: season._count.teams > 0 && season._count.weeklyResults > 0
    }
  }

  /**
   * Clean up old cache data (if needed)
   */
  static async cleanup() {
    // Can implement cleanup logic here if needed
    // For now, we'll keep all data
  }
}