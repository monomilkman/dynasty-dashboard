'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleClick = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
  }

  if (!mounted) {
    return null
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center justify-center p-2 rounded-md border border-white/20 hover:bg-white/10 transition-colors"
    >
      {theme === 'light' ? (
        <Moon className="h-4 w-4 text-white" />
      ) : (
        <Sun className="h-4 w-4 text-white" />
      )}
      <span className="sr-only">Toggle theme</span>
    </button>
  )
}