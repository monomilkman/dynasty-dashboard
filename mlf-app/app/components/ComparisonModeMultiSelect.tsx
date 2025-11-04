'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown, X, Check, BarChart3, Minus, Filter } from 'lucide-react'

export type ComparisonMode = 'mean' | 'median' | 'trimmedMean'

interface ComparisonOption {
  value: ComparisonMode
  label: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const COMPARISON_OPTIONS: ComparisonOption[] = [
  {
    value: 'mean',
    label: 'Mean (Average)',
    description: 'Arithmetic average of all teams',
    icon: BarChart3
  },
  {
    value: 'median',
    label: 'Median',
    description: 'Statistical middle value (50th percentile)',
    icon: Minus
  },
  {
    value: 'trimmedMean',
    label: 'Trimmed Mean',
    description: '10% trimmed - excludes top and bottom teams',
    icon: Filter
  }
]

interface ComparisonModeMultiSelectProps {
  selectedModes: ComparisonMode[]
  onSelectionChange: (selected: ComparisonMode[]) => void
}

export default function ComparisonModeMultiSelect({
  selectedModes,
  onSelectionChange
}: ComparisonModeMultiSelectProps) {
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

  const handleToggleMode = (mode: ComparisonMode) => {
    if (selectedModes.includes(mode)) {
      onSelectionChange(selectedModes.filter(m => m !== mode))
    } else {
      // Add in consistent order: mean, median, trimmedMean
      const allModes: ComparisonMode[] = ['mean', 'median', 'trimmedMean']
      const newModes = [...selectedModes, mode]
      onSelectionChange(allModes.filter(m => newModes.includes(m)))
    }
  }

  const handleClearAll = () => {
    onSelectionChange([])
  }

  const handleSelectAll = () => {
    onSelectionChange(['mean', 'median', 'trimmedMean'])
  }

  const getDisplayText = () => {
    if (selectedModes.length === 0) {
      return 'No Comparison Baseline'
    }
    if (selectedModes.length === 1) {
      const option = COMPARISON_OPTIONS.find(opt => opt.value === selectedModes[0])
      return option?.label || 'Unknown'
    }
    if (selectedModes.length === COMPARISON_OPTIONS.length) {
      return 'All Comparison Types'
    }
    return `${selectedModes.length} comparisons selected`
  }

  const getLabelForMode = (mode: ComparisonMode): string => {
    const option = COMPARISON_OPTIONS.find(opt => opt.value === mode)
    return option?.label.split(' ')[0] || mode
  }

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
          {/* Control buttons */}
          <div className="flex border-b border-gray-200 dark:border-gray-600">
            <button
              onClick={handleSelectAll}
              className="flex-1 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              All
            </button>
            <button
              onClick={handleClearAll}
              className="flex-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 border-l border-gray-200 dark:border-gray-600"
            >
              None
            </button>
          </div>

          {/* Comparison mode options */}
          {COMPARISON_OPTIONS.map(option => {
            const Icon = option.icon
            const isSelected = selectedModes.includes(option.value)

            return (
              <div
                key={option.value}
                onClick={() => handleToggleMode(option.value)}
                className={`flex items-center px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex items-center justify-center w-4 h-4 mr-3">
                  {isSelected && (
                    <Check className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  )}
                </div>
                <Icon className="h-4 w-4 mr-2 text-gray-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {option.description}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Helper text */}
          <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Select multiple comparison baselines to display in the table simultaneously
            </p>
          </div>
        </div>
      )}

      {/* Selected modes tags */}
      {selectedModes.length > 0 && selectedModes.length < COMPARISON_OPTIONS.length && (
        <div className="mt-2 flex flex-wrap gap-1">
          {selectedModes.map(mode => (
            <span
              key={mode}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              {getLabelForMode(mode)}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleToggleMode(mode)
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
