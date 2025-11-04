'use client'

import { BarChart3, TrendingDown, Percent } from 'lucide-react'

export type PositionViewType = 'rankings' | 'gaps' | 'percentile'

interface PositionViewTabsProps {
  activeView: PositionViewType
  onViewChange: (view: PositionViewType) => void
}

export default function PositionViewTabs({ activeView, onViewChange }: PositionViewTabsProps) {
  const tabs: Array<{ value: PositionViewType; label: string; icon: React.ReactNode; description: string }> = [
    {
      value: 'rankings',
      label: 'Position Rankings',
      icon: <BarChart3 className="h-4 w-4" />,
      description: 'View team rankings by position with points'
    },
    {
      value: 'gaps',
      label: 'Points Behind',
      icon: <TrendingDown className="h-4 w-4" />,
      description: 'See point gaps from 1st place leaders'
    },
    {
      value: 'percentile',
      label: 'Percentiles',
      icon: <Percent className="h-4 w-4" />,
      description: 'View percentile rankings for each position'
    }
  ]

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
      <nav className="flex space-x-1" aria-label="Position view tabs">
        {tabs.map((tab) => {
          const isActive = activeView === tab.value

          return (
            <button
              key={tab.value}
              onClick={() => onViewChange(tab.value)}
              className={`
                group relative flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg
                transition-all duration-200 ease-in-out
                ${isActive
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }
              `}
              role="tab"
              aria-selected={isActive}
              aria-controls={`${tab.value}-panel`}
              title={tab.description}
            >
              <span className={`
                transition-transform duration-200
                ${isActive ? 'scale-110' : 'group-hover:scale-105'}
              `}>
                {tab.icon}
              </span>
              <span className="whitespace-nowrap">{tab.label}</span>

              {/* Active indicator */}
              {isActive && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
              )}
            </button>
          )
        })}
      </nav>

      {/* Tab descriptions (visible on hover or for screen readers) */}
      <div className="sr-only">
        {tabs.map((tab) => (
          <div key={`${tab.value}-desc`} id={`${tab.value}-description`}>
            {tab.description}
          </div>
        ))}
      </div>
    </div>
  )
}
