'use client'

import {
  LayoutGrid,
  BarChart3,
  Grid3x3,
  Swords,
  TrendingUp,
  Users,
  Calendar,
  Trophy,
  ArrowLeftRight,
  X
} from 'lucide-react'

type ViewType = 'table' | 'charts' | 'positions' | 'matchups' | 'rankings' | 'comparison' | 'breakdown' | 'playoff' | 'trades'

interface SidebarProps {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
  isMobileMenuOpen: boolean
  setIsMobileMenuOpen: (open: boolean) => void
}

interface NavItem {
  id: ViewType
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const navigationItems: NavItem[] = [
  { id: 'table', label: 'Table View', icon: LayoutGrid },
  { id: 'charts', label: 'Charts View', icon: BarChart3 },
  { id: 'positions', label: 'Positions', icon: Grid3x3 },
  { id: 'matchups', label: 'Matchups & Records', icon: Swords },
  { id: 'rankings', label: 'Rankings', icon: TrendingUp },
  { id: 'comparison', label: 'Compare Teams', icon: Users },
  { id: 'breakdown', label: 'Season Breakdown', icon: Calendar },
  { id: 'playoff', label: 'Playoff Tracker', icon: Trophy },
  { id: 'trades', label: 'Trade Analyzer', icon: ArrowLeftRight },
]

export default function Sidebar({ activeView, onViewChange, isMobileMenuOpen, setIsMobileMenuOpen }: SidebarProps) {
  const handleNavClick = (viewId: ViewType) => {
    onViewChange(viewId)
    // Close mobile menu after selection
    if (isMobileMenuOpen) {
      setIsMobileMenuOpen(false)
    }
  }

  const handleBackdropClick = () => {
    setIsMobileMenuOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isMobileMenuOpen) {
      setIsMobileMenuOpen(false)
    }
  }

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden transition-opacity duration-300"
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64
          bg-gray-800 dark:bg-gray-900
          border-r border-gray-700 dark:border-gray-800
          z-50 lg:z-30
          transform transition-transform duration-300 ease-in-out
          ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        onKeyDown={handleKeyDown}
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 dark:border-gray-800">
          <h2 className="text-lg font-bold text-white">Navigation</h2>
          {/* Close button - only visible on mobile */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden text-gray-400 hover:text-white transition-colors"
            aria-label="Close menu"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation items */}
        <nav className="p-4 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.id

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  w-full flex items-center space-x-3 px-4 py-3 rounded-lg
                  text-sm font-medium transition-colors duration-200
                  ${isActive
                    ? 'bg-blue-600 text-white border-l-4 border-blue-400'
                    : 'text-gray-300 hover:bg-gray-700 hover:text-white border-l-4 border-transparent'
                  }
                `}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Sidebar footer - optional branding */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-700 dark:border-gray-800">
          <p className="text-xs text-gray-400 text-center">
            MyFantasyLeague Stats
          </p>
        </div>
      </aside>
    </>
  )
}
