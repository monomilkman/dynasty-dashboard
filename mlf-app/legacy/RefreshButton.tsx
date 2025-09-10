'use client'

import { useState } from 'react'
import { RefreshCw } from 'lucide-react'

interface RefreshButtonProps {
  onRefresh: () => Promise<void>
}

export default function RefreshButton({ onRefresh }: RefreshButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleRefresh = async () => {
    setIsLoading(true)
    try {
      await onRefresh()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isLoading}
      className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md text-sm font-medium transition-colors duration-200 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? 'Loading...' : 'Import Data'}
    </button>
  )
}