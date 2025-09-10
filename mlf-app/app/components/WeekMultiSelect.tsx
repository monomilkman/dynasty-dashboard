'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Check, Calendar, Trophy, Star } from 'lucide-react'
import { getWeeksByCategory, getRegularSeasonEndWeek, getTotalWeeksForYear } from '@/lib/season-config'

export interface WeekRange {
  weeks: number[]
  label: string
  description?: string
  icon?: React.ComponentType<{ className?: string }>
}

interface WeekMultiSelectProps {
  selectedWeeks: number[]
  onSelectionChange: (selected: number[]) => void
  year?: number
}

// Dynamic week presets based on year-specific configuration
function getWeekPresets(year: number): WeekRange[] {
  const weekCategories = getWeeksByCategory(year)
  const regularSeasonEndWeek = getRegularSeasonEndWeek(year)
  
  return [
    {
      weeks: [1, 2, 3, 4],
      label: 'Early Season',
      description: 'Weeks 1-4: Setting the foundation',
      icon: Star
    },
    {
      weeks: [5, 6, 7, 8, 9],
      label: 'Mid-Season',
      description: 'Weeks 5-9: The grind period',
      icon: Calendar
    },
    {
      weeks: [10, 11, 12, 13],
      label: 'Stretch Run',
      description: 'Weeks 10-13: Playoff push',
      icon: Calendar
    },
    {
      weeks: weekCategories.regularSeason,
      label: 'Regular Season',
      description: `Weeks 1-${regularSeasonEndWeek}: Complete regular season`,
      icon: Calendar
    },
    {
      weeks: weekCategories.playoffs.slice(0, 4), // First 4 playoff weeks
      label: 'Fantasy Playoffs',
      description: 'Fantasy playoff weeks',
      icon: Trophy
    },
    {
      weeks: weekCategories.playoffs.slice(-3), // Last 3 weeks (championship stretch)
      label: 'Championship Weeks',
      description: 'Championship weeks',
      icon: Trophy
    },
    {
      weeks: [weekCategories.playoffs[weekCategories.playoffs.length - 1]], // Final week
      label: 'Championship Game',
      description: 'Championship game week',
      icon: Trophy
    },
    {
      weeks: weekCategories.playoffs.slice(4), // Toilet bowl weeks (typically after main playoffs)
      label: 'Toilet Bowl',
      description: 'Consolation playoff weeks',
      icon: Calendar
    }
  ].filter(preset => preset.weeks.length > 0) // Remove empty presets
}

export default function WeekMultiSelect({ 
  selectedWeeks, 
  onSelectionChange,
  year = new Date().getFullYear()
}: WeekMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Get dynamic configuration for this year
  const totalWeeks = getTotalWeeksForYear(year)
  const ALL_WEEKS = Array.from({ length: totalWeeks }, (_, i) => i + 1)
  const WEEK_PRESETS = getWeekPresets(year)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggleWeek = (week: number) => {
    if (selectedWeeks.includes(week)) {
      onSelectionChange(selectedWeeks.filter(w => w !== week))
    } else {
      onSelectionChange([...selectedWeeks, week].sort((a, b) => a - b))
    }
  }

  const handlePresetSelect = (preset: WeekRange) => {
    onSelectionChange(preset.weeks)
    setIsOpen(false)
  }

  const handleClearAll = () => {
    onSelectionChange([])
  }

  const handleSelectAll = () => {
    onSelectionChange(ALL_WEEKS)
  }

  const getDisplayText = () => {
    if (selectedWeeks.length === 0) {
      return 'All Weeks'
    }
    
    // Check if selection matches a preset
    const matchingPreset = WEEK_PRESETS.find(preset => 
      preset.weeks.length === selectedWeeks.length &&
      preset.weeks.every(week => selectedWeeks.includes(week))
    )
    
    if (matchingPreset) {
      return matchingPreset.label
    }
    
    if (selectedWeeks.length === 1) {
      return `Week ${selectedWeeks[0]}`
    }
    
    if (selectedWeeks.length === ALL_WEEKS.length) {
      return 'All Weeks'
    }
    
    // Show range if consecutive weeks
    const sortedWeeks = [...selectedWeeks].sort((a, b) => a - b)
    const isConsecutive = sortedWeeks.every((week, index) => 
      index === 0 || week === sortedWeeks[index - 1] + 1
    )
    
    if (isConsecutive && sortedWeeks.length > 1) {
      return `Weeks ${sortedWeeks[0]}-${sortedWeeks[sortedWeeks.length - 1]}`
    }
    
    return `${selectedWeeks.length} weeks selected`
  }

  const formatWeekRange = (weeks: number[]) => {
    const sorted = [...weeks].sort((a, b) => a - b)
    if (sorted.length === 1) return `Week ${sorted[0]}`
    if (sorted.length === 2) return `Weeks ${sorted[0]}, ${sorted[1]}`
    
    // Check if consecutive
    const isConsecutive = sorted.every((week, index) => 
      index === 0 || week === sorted[index - 1] + 1
    )
    
    if (isConsecutive) {
      return `Weeks ${sorted[0]}-${sorted[sorted.length - 1]}`
    }
    
    // Show first few and count
    if (sorted.length <= 4) {
      return `Weeks ${sorted.join(', ')}`
    }
    return `Weeks ${sorted[0]}-${sorted[sorted.length - 1]} (${sorted.length} weeks)`
  }

  // Group weeks by quarter for easier selection (dynamic based on total weeks)
  const quarterSize = Math.ceil(totalWeeks / 4)
  const weekQuarters = [
    { label: 'Q1', weeks: ALL_WEEKS.slice(0, quarterSize), color: 'bg-green-100 text-green-800' },
    { label: 'Q2', weeks: ALL_WEEKS.slice(quarterSize, quarterSize * 2), color: 'bg-blue-100 text-blue-800' },
    { label: 'Q3', weeks: ALL_WEEKS.slice(quarterSize * 2, quarterSize * 3), color: 'bg-orange-100 text-orange-800' },
    { label: 'Q4', weeks: ALL_WEEKS.slice(quarterSize * 3), color: 'bg-red-100 text-red-800' }
  ].filter(quarter => quarter.weeks.length > 0)

  const sortedSelectedWeeks = [...selectedWeeks].sort((a, b) => a - b)

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white flex items-center justify-between text-left"
      >
        <span className="truncate">{getDisplayText()}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-80 overflow-y-auto">
          {/* Tab headers */}
          <div className="flex border-b border-gray-200 dark:border-gray-600">
            <button
              onClick={() => setActiveTab('presets')}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === 'presets'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              Presets
            </button>
            <button
              onClick={() => setActiveTab('custom')}
              className={`flex-1 px-3 py-2 text-sm font-medium border-l border-gray-200 dark:border-gray-600 transition-colors ${
                activeTab === 'custom'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              Custom
            </button>
          </div>

          {activeTab === 'presets' && (
            <div>
              {/* Quick actions */}
              <div className="flex border-b border-gray-200 dark:border-gray-600">
                <button
                  onClick={handleSelectAll}
                  className="flex-1 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  All Weeks
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 border-l border-gray-200 dark:border-gray-600"
                >
                  Clear
                </button>
              </div>

              {/* Preset options */}
              {WEEK_PRESETS.map((preset, index) => {
                const Icon = preset.icon
                const isSelected = preset.weeks.length === selectedWeeks.length &&
                  preset.weeks.every(week => selectedWeeks.includes(week))

                return (
                  <div
                    key={index}
                    onClick={() => handlePresetSelect(preset)}
                    className={`flex items-center px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-center w-4 h-4 mr-3">
                      {isSelected && (
                        <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    {Icon && <Icon className="h-4 w-4 mr-2 text-gray-400" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {preset.label}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {preset.description}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {activeTab === 'custom' && (
            <div>
              {/* Quick actions */}
              <div className="flex border-b border-gray-200 dark:border-gray-600">
                <button
                  onClick={handleSelectAll}
                  className="flex-1 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Select All
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 border-l border-gray-200 dark:border-gray-600"
                >
                  Clear All
                </button>
              </div>

              {/* Quarter quick selectors */}
              <div className="p-3 border-b border-gray-200 dark:border-gray-600">
                <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Quick Select:</div>
                <div className="flex gap-2">
                  {weekQuarters.map(quarter => (
                    <button
                      key={quarter.label}
                      onClick={() => onSelectionChange(quarter.weeks)}
                      className={`px-2 py-1 text-xs rounded-full ${quarter.color} dark:bg-opacity-20 hover:opacity-75 transition-opacity`}
                    >
                      {quarter.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Individual week selection */}
              <div className="grid grid-cols-4 gap-1 p-3">
                {ALL_WEEKS.map(week => (
                  <div
                    key={week}
                    onClick={() => handleToggleWeek(week)}
                    className={`flex items-center justify-center p-2 rounded cursor-pointer transition-colors ${
                      selectedWeeks.includes(week)
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    <span className="text-sm font-medium">{week}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected weeks display */}
      {selectedWeeks.length > 0 && selectedWeeks.length < ALL_WEEKS.length && (
        <div className="mt-2">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {formatWeekRange(selectedWeeks)}
          </div>
          <div className="flex flex-wrap gap-1">
            {sortedSelectedWeeks.slice(0, 8).map(week => (
              <span
                key={week}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
              >
                {week}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleToggleWeek(week)
                  }}
                  className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            {sortedSelectedWeeks.length > 8 && (
              <span className="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                +{sortedSelectedWeeks.length - 8} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}