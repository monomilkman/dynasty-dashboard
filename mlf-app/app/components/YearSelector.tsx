'use client'

import { Button } from '@/components/ui/button'

interface YearSelectorProps {
  selectedYear: number
  onYearChange: (year: number) => void
}

export default function YearSelector({ selectedYear, onYearChange }: YearSelectorProps) {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium">Year:</span>
      {years.map(year => (
        <Button
          key={year}
          variant={selectedYear === year ? "default" : "outline"}
          size="sm"
          onClick={() => onYearChange(year)}
        >
          {year}
        </Button>
      ))}
    </div>
  )
}