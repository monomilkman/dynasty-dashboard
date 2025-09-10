'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Check } from 'lucide-react'

interface YearMultiSelectProps {
  availableYears: number[]
  selectedYears: number[]
  onSelectionChange: (selected: number[]) => void
}

export default function YearMultiSelect({ 
  availableYears, 
  selectedYears, 
  onSelectionChange 
}: YearMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggleYear = (year: number) => {
    if (selectedYears.includes(year)) {
      onSelectionChange(selectedYears.filter(y => y !== year))
    } else {
      onSelectionChange([...selectedYears, year])
    }
  }

  const handleClearAll = () => {
    onSelectionChange([])
  }

  const handleSelectAll = () => {
    onSelectionChange(availableYears)
  }

  const getDisplayText = () => {
    if (selectedYears.length === 0) {
      return 'All Years'
    }
    if (selectedYears.length === 1) {
      return selectedYears[0].toString()
    }
    if (selectedYears.length === availableYears.length) {
      return 'All Years'
    }
    return `${selectedYears.length} years selected`
  }

  // Sort years in descending order for display
  const sortedYears = [...availableYears].sort((a, b) => b - a)
  const sortedSelectedYears = [...selectedYears].sort((a, b) => b - a)

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
        <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {/* Control buttons */}
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

          {/* Year list */}
          {sortedYears.map(year => (
            <div
              key={year}
              onClick={() => handleToggleYear(year)}
              className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer"
            >
              <div className="flex items-center justify-center w-4 h-4 mr-2">
                {selectedYears.includes(year) && (
                  <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                )}
              </div>
              <span className="text-sm text-gray-900 dark:text-white">{year}</span>
            </div>
          ))}
        </div>
      )}

      {/* Selected years tags */}
      {selectedYears.length > 0 && selectedYears.length < availableYears.length && (
        <div className="mt-2 flex flex-wrap gap-1">
          {sortedSelectedYears.map(year => (
            <span
              key={year}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              {year}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleYear(year)
                }}
                className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}