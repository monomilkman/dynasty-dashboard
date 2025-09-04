'use client'

import { useState, useMemo } from 'react'
import { Team } from '@/lib/mfl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react'

interface LeaderboardProps {
  teams: Team[]
}

type SortField = keyof Pick<Team, 'manager' | 'teamName' | 'startersPoints' | 'benchPoints' | 'offensePoints' | 'defensePoints' | 'totalPoints' | 'potentialPoints'>
type SortDirection = 'asc' | 'desc' | null

export default function Leaderboard({ teams }: LeaderboardProps) {
  const [sortField, setSortField] = useState<SortField>('totalPoints')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredAndSortedTeams = useMemo(() => {
    const filtered = teams.filter(team => 
      team.manager.toLowerCase().includes(searchTerm.toLowerCase()) ||
      team.teamName.toLowerCase().includes(searchTerm.toLowerCase())
    )

    if (sortDirection) {
      filtered.sort((a, b) => {
        const aValue = a[sortField]
        const bValue = b[sortField]
        
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          return sortDirection === 'asc' 
            ? aValue.localeCompare(bValue)
            : bValue.localeCompare(aValue)
        }
        
        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
        }
        
        return 0
      })
    }

    return filtered
  }, [teams, sortField, sortDirection, searchTerm])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(current => {
        if (current === 'desc') return 'asc'
        if (current === 'asc') return null
        return 'desc'
      })
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const getSortIcon = (field: SortField) => {
    if (sortField !== field || !sortDirection) {
      return <ArrowUpDown className="ml-2 h-4 w-4" />
    }
    return sortDirection === 'desc' 
      ? <ArrowDown className="ml-2 h-4 w-4" />
      : <ArrowUp className="ml-2 h-4 w-4" />
  }

  const formatPoints = (points: number) => {
    return points.toFixed(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams or managers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 sticky left-0 bg-background">Rank</TableHead>
              <TableHead className="w-16 hidden md:table-cell">Year</TableHead>
              <TableHead className="min-w-[120px] sticky left-16 bg-background md:static md:bg-transparent">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('manager')}
                  className="h-auto p-0 font-semibold text-left justify-start"
                >
                  Manager
                  {getSortIcon('manager')}
                </Button>
              </TableHead>
              <TableHead className="text-right min-w-[80px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('startersPoints')}
                  className="h-auto p-0 font-semibold"
                >
                  <span className="hidden sm:inline">Starters</span>
                  <span className="sm:hidden">Start</span>
                  {getSortIcon('startersPoints')}
                </Button>
              </TableHead>
              <TableHead className="text-right min-w-[80px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('benchPoints')}
                  className="h-auto p-0 font-semibold"
                >
                  <span className="hidden sm:inline">Bench</span>
                  <span className="sm:hidden">Bch</span>
                  {getSortIcon('benchPoints')}
                </Button>
              </TableHead>
              <TableHead className="text-right min-w-[80px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('offensePoints')}
                  className="h-auto p-0 font-semibold"
                >
                  <span className="hidden sm:inline">Offense</span>
                  <span className="sm:hidden">Off</span>
                  {getSortIcon('offensePoints')}
                </Button>
              </TableHead>
              <TableHead className="text-right min-w-[80px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('defensePoints')}
                  className="h-auto p-0 font-semibold"
                >
                  <span className="hidden sm:inline">Defense</span>
                  <span className="sm:hidden">Def</span>
                  {getSortIcon('defensePoints')}
                </Button>
              </TableHead>
              <TableHead className="text-right min-w-[80px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('totalPoints')}
                  className="h-auto p-0 font-semibold"
                >
                  Total
                  {getSortIcon('totalPoints')}
                </Button>
              </TableHead>
              <TableHead className="text-right min-w-[80px]">
                <Button
                  variant="ghost"
                  onClick={() => handleSort('potentialPoints')}
                  className="h-auto p-0 font-semibold"
                >
                  <span className="hidden sm:inline">Potential</span>
                  <span className="sm:hidden">Pot</span>
                  {getSortIcon('potentialPoints')}
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedTeams.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  No teams found.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedTeams.map((team, index) => (
                <TableRow key={team.id}>
                  <TableCell className="font-medium sticky left-0 bg-background">{index + 1}</TableCell>
                  <TableCell className="hidden md:table-cell">{team.year}</TableCell>
                  <TableCell className="font-medium sticky left-16 bg-background md:static md:bg-transparent">
                    <div>
                      <div className="font-medium">{team.manager}</div>
                      <div className="text-sm text-muted-foreground">{team.teamName}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatPoints(team.startersPoints)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{team.benchPoints > 0 ? formatPoints(team.benchPoints) : '-'}</TableCell>
                  <TableCell className="text-right">{formatPoints(team.offensePoints)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{team.defensePoints > 0 ? formatPoints(team.defensePoints) : '-'}</TableCell>
                  <TableCell className="text-right font-semibold">{formatPoints(team.totalPoints)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{team.potentialPoints > 0 ? formatPoints(team.potentialPoints) : '-'}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}