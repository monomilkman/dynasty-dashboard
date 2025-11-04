'use client'

import { useEffect, useRef } from 'react'
import { X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import {
  PositionGapData,
  formatGap,
  formatPercentile,
  getGapDescription,
  getPercentileDescription
} from '@/lib/position-analysis-utils'
import { formatDecimal } from '@/lib/utils'

interface PositionTooltipProps {
  gapData: PositionGapData
  onClose: () => void
  anchorElement?: HTMLElement | null
}

export default function PositionTooltip({ gapData, onClose, anchorElement }: PositionTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    // Delay adding the listener to avoid closing immediately after opening
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside)
    }, 100)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [onClose])

  // Position the tooltip near the anchor element
  useEffect(() => {
    if (!tooltipRef.current || !anchorElement) return

    const tooltipRect = tooltipRef.current.getBoundingClientRect()
    const anchorRect = anchorElement.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth

    // Calculate position
    let top = anchorRect.bottom + 8 // 8px below anchor
    let left = anchorRect.left + (anchorRect.width / 2) - (tooltipRect.width / 2) // Centered

    // Adjust if tooltip goes off screen
    if (top + tooltipRect.height > viewportHeight - 20) {
      // Show above if not enough space below
      top = anchorRect.top - tooltipRect.height - 8
    }

    if (left < 20) {
      left = 20 // Keep 20px from left edge
    } else if (left + tooltipRect.width > viewportWidth - 20) {
      left = viewportWidth - tooltipRect.width - 20 // Keep 20px from right edge
    }

    tooltipRef.current.style.top = `${top}px`
    tooltipRef.current.style.left = `${left}px`
  }, [anchorElement])

  const { position, rank, points, totalTeams, gapFromFirst, gapFromAvg, gapFromMedian, gapFromLast, percentile, firstPlaceTeam, firstPlacePoints, lastPlaceTeam, lastPlacePoints, topThreeTeams } = gapData

  // Determine trend icon
  const getTrendIcon = (gap: number) => {
    if (gap > -10) return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
    if (gap < -50) return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
    return <Minus className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 dark:bg-black/40 z-40" onClick={onClose} />

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-2xl border-2 border-gray-200 dark:border-gray-600 w-96 max-w-[calc(100vw-40px)]"
        role="dialog"
        aria-label={`${position} Position Analysis`}
      >
        {/* Header */}
        <div className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-3 rounded-t-lg flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center">
            <span className="bg-white/20 px-2 py-1 rounded mr-3 text-sm font-bold">{position}</span>
            Position Analysis
          </h3>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/20 rounded p-1 transition-colors"
            aria-label="Close tooltip"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Summary */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Your Rank</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {rank} <span className="text-sm text-gray-600 dark:text-gray-400">of {totalTeams}</span>
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {formatPercentile(percentile)} {getPercentileDescription(percentile)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">Your Points</p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatDecimal(points)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {getGapDescription(gapFromFirst)}
                </p>
              </div>
            </div>
          </div>

          {/* Gaps */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center">
              {getTrendIcon(gapFromFirst)}
              <span className="ml-2">Performance Gaps</span>
            </h4>

            {/* Gap from First */}
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Gap from 1st</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{firstPlaceTeam}</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${gapFromFirst >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatGap(gapFromFirst)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  ({formatDecimal(firstPlacePoints)} pts)
                </p>
              </div>
            </div>

            {/* Gap from Average */}
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Gap from Average</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">League mean</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${gapFromAvg >= 0 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {formatGap(gapFromAvg)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  ({formatDecimal(points - gapFromAvg)} avg)
                </p>
              </div>
            </div>

            {/* Gap from Median */}
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Gap from Median</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">50th percentile</p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${gapFromMedian >= 0 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                  {formatGap(gapFromMedian)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  ({formatDecimal(points - gapFromMedian)} median)
                </p>
              </div>
            </div>

            {/* Gap from Last */}
            <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Gap from Last</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">{lastPlaceTeam}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {formatGap(gapFromLast)}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  ({formatDecimal(lastPlacePoints)} pts)
                </p>
              </div>
            </div>
          </div>

          {/* League Leaders */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">League Leaders</h4>
            <div className="space-y-1">
              {topThreeTeams.map((team, index) => (
                <div key={index} className="flex items-center justify-between py-1 px-3 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                  <div className="flex items-center">
                    <span className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mr-2
                      ${index === 0 ? 'bg-yellow-400 text-yellow-900' : ''}
                      ${index === 1 ? 'bg-gray-300 text-gray-800' : ''}
                      ${index === 2 ? 'bg-orange-400 text-orange-900' : ''}
                    `}>
                      {index + 1}
                    </span>
                    <span className="font-medium text-gray-900 dark:text-white">{team.teamName}</span>
                  </div>
                  <span className="font-bold text-gray-700 dark:text-gray-300">{formatDecimal(team.points)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 rounded-b-lg flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
          <span>Click outside or press ESC to close</span>
          <span className="font-medium">{position} Performance</span>
        </div>
      </div>
    </>
  )
}
