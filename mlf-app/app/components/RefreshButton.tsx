'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
    <Button 
      onClick={handleRefresh} 
      disabled={isLoading}
      variant="outline"
      size="sm"
    >
      <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
      Refresh
    </Button>
  )
}