/**
 * Unit tests for MFL calculation utilities
 * Tests bench points and potential points calculation accuracy
 */

import {
  calculateBenchPoints,
  calculatePotentialPoints,
  convertToCalculationFormat,
  validateLineupConstraints,
  MFL_LINEUP_REQUIREMENTS,
  type PlayerCalculationInfo
} from '../mfl-calculations'

describe('MFL Calculations', () => {
  // Sample test data based on real Week 1 2025 franchise 0001 data
  const samplePlayers = [
    { id: '13227', name: 'Lewis, Jourdan', position: 'CB', team: '0001', score: 25.25, status: 'bench' as const },
    { id: '16211', name: 'Nacua, Puka', position: 'WR', team: '0001', score: 23.1, status: 'bench' as const },
    { id: '15753', name: 'Wilson, Garrett', position: 'WR', team: '0001', score: 22.5, status: 'bench' as const },
    { id: '14163', name: 'Simmons, Jeffery', position: 'DT', team: '0001', score: 19.25, status: 'bench' as const },
    { id: '16641', name: 'Bowers, Brock', position: 'TE', team: '0001', score: 17.05, status: 'starter' as const },
    { id: '13132', name: 'Kamara, Alvin', position: 'RB', team: '0001', score: 15.6, status: 'starter' as const },
    { id: '14085', name: 'Pollard, Tony', position: 'RB', team: '0001', score: 9.5, status: 'starter' as const },
    { id: '13590', name: 'Mahomes, Patrick', position: 'QB', team: '0001', score: 8.82, status: 'starter' as const },
    { id: '12345', name: 'IR Player', position: 'WR', team: '0001', score: 0, status: 'ir' as const },
    { id: '12346', name: 'Taxi Player', position: 'RB', team: '0001', score: 0, status: 'taxi' as const }
  ]

  const starterIds = new Set(['16641', '13132', '14085', '13590'])

  describe('calculateBenchPoints', () => {
    it('should calculate bench points correctly excluding starters, IR, and taxi', () => {
      const players: PlayerCalculationInfo[] = samplePlayers.map(p => ({
        ...p,
        isEligible: p.status !== 'ir' && p.status !== 'taxi'
      }))

      const { benchPoints, benchPlayers } = calculateBenchPoints(players, starterIds)

      // Expected: 25.25 + 23.1 + 22.5 + 19.25 = 90.1 (excluding IR/taxi and starters)
      expect(benchPoints).toBeCloseTo(90.1, 2)
      expect(benchPlayers).toHaveLength(4)
      expect(benchPlayers.every(p => p.status === 'bench')).toBe(true)
    })

    it('should exclude IR and taxi squad players from bench calculation', () => {
      const players: PlayerCalculationInfo[] = samplePlayers.map(p => ({
        ...p,
        isEligible: p.status !== 'ir' && p.status !== 'taxi'
      }))

      const { benchPlayers } = calculateBenchPoints(players, starterIds)

      expect(benchPlayers.find(p => p.status === 'ir')).toBeUndefined()
      expect(benchPlayers.find(p => p.status === 'taxi')).toBeUndefined()
    })
  })

  describe('calculatePotentialPoints', () => {
    it('should calculate optimal potential points', () => {
      const players: PlayerCalculationInfo[] = samplePlayers.map(p => ({
        ...p,
        isEligible: p.status !== 'ir' && p.status !== 'taxi'
      }))

      const { potentialPoints, optimalLineup } = calculatePotentialPoints(players)

      expect(potentialPoints).toBeGreaterThan(0)
      expect(optimalLineup.length).toBeGreaterThan(0)
      expect(optimalLineup.every(p => p.status !== 'ir' && p.status !== 'taxi')).toBe(true)
    })

    it('should exclude IR and taxi squad players from optimal lineup', () => {
      const players: PlayerCalculationInfo[] = samplePlayers.map(p => ({
        ...p,
        isEligible: p.status !== 'ir' && p.status !== 'taxi'
      }))

      const { optimalLineup } = calculatePotentialPoints(players)

      expect(optimalLineup.find(p => p.id === '12345')).toBeUndefined() // IR player
      expect(optimalLineup.find(p => p.id === '12346')).toBeUndefined() // Taxi player
    })
  })

  describe('validateLineupConstraints', () => {
    it('should validate a proper lineup meets requirements', () => {
      const validLineup: PlayerCalculationInfo[] = [
        { id: '1', name: 'QB1', position: 'QB', team: '0001', score: 20, status: 'starter', isEligible: true },
        { id: '2', name: 'RB1', position: 'RB', team: '0001', score: 15, status: 'starter', isEligible: true },
        { id: '3', name: 'RB2', position: 'RB', team: '0001', score: 12, status: 'starter', isEligible: true },
        { id: '4', name: 'WR1', position: 'WR', team: '0001', score: 18, status: 'starter', isEligible: true },
        { id: '5', name: 'WR2', position: 'WR', team: '0001', score: 16, status: 'starter', isEligible: true },
        { id: '6', name: 'TE1', position: 'TE', team: '0001', score: 10, status: 'starter', isEligible: true },
        { id: '7', name: 'K1', position: 'K', team: '0001', score: 8, status: 'starter', isEligible: true },
        { id: '8', name: 'DL1', position: 'DE', team: '0001', score: 12, status: 'starter', isEligible: true },
        { id: '9', name: 'DL2', position: 'DT', team: '0001', score: 11, status: 'starter', isEligible: true },
        { id: '10', name: 'LB1', position: 'LB', team: '0001', score: 14, status: 'starter', isEligible: true },
        { id: '11', name: 'LB2', position: 'LB', team: '0001', score: 13, status: 'starter', isEligible: true },
        { id: '12', name: 'LB3', position: 'LB', team: '0001', score: 12, status: 'starter', isEligible: true },
        { id: '13', name: 'CB1', position: 'CB', team: '0001', score: 9, status: 'starter', isEligible: true },
        { id: '14', name: 'CB2', position: 'CB', team: '0001', score: 8, status: 'starter', isEligible: true },
        { id: '15', name: 'S1', position: 'S', team: '0001', score: 11, status: 'starter', isEligible: true },
        { id: '16', name: 'S2', position: 'S', team: '0001', score: 10, status: 'starter', isEligible: true },
        { id: '17', name: 'Flex-O', position: 'WR', team: '0001', score: 7, status: 'starter', isEligible: true },
        { id: '18', name: 'Flex-D', position: 'LB', team: '0001', score: 6, status: 'starter', isEligible: true }
      ]

      const { isValid, errors } = validateLineupConstraints(validLineup, MFL_LINEUP_REQUIREMENTS)

      expect(isValid).toBe(true)
      expect(errors).toHaveLength(0)
    })

    it('should identify lineup constraint violations', () => {
      const invalidLineup: PlayerCalculationInfo[] = [
        { id: '1', name: 'QB1', position: 'QB', team: '0001', score: 20, status: 'starter', isEligible: true },
        // Missing required positions
      ]

      const { isValid, errors } = validateLineupConstraints(invalidLineup, MFL_LINEUP_REQUIREMENTS)

      expect(isValid).toBe(false)
      expect(errors.length).toBeGreaterThan(0)
    })
  })

  describe('convertToCalculationFormat', () => {
    it('should convert MFL API data to calculation format', () => {
      const apiPlayers = [
        { id: '1', name: 'Player 1', position: 'QB', team: '0001', score: '20.5', status: 'active' },
        { id: '2', name: 'Player 2', position: 'RB', team: '0001', score: 15, status: 'INJURED_RESERVE' }
      ]

      const starterIds = new Set(['1'])
      const result = convertToCalculationFormat(apiPlayers, starterIds)

      expect(result).toHaveLength(2)
      expect(result[0].status).toBe('starter')
      expect(result[1].status).toBe('ir')
      expect(result[0].score).toBe(20.5)
      expect(result[1].isEligible).toBe(false)
    })
  })

  describe('Real-world accuracy test', () => {
    it('should match expected bench calculation for franchise 0001', () => {
      // This test uses real data structure to validate accuracy
      const players: PlayerCalculationInfo[] = [
        // Sample of real players from franchise 0001
        { id: '13227', name: 'Lewis, Jourdan', position: 'CB', team: '0001', score: 25.25, status: 'bench', isEligible: true },
        { id: '16211', name: 'Nacua, Puka', position: 'WR', team: '0001', score: 23.1, status: 'bench', isEligible: true },
        { id: '16641', name: 'Bowers, Brock', position: 'TE', team: '0001', score: 17.05, status: 'starter', isEligible: true }
      ]

      const starterIds = new Set(['16641'])
      const { benchPoints } = calculateBenchPoints(players, starterIds)

      // Should calculate bench correctly: 25.25 + 23.1 = 48.35
      expect(benchPoints).toBeCloseTo(48.35, 2)
    })
  })
})