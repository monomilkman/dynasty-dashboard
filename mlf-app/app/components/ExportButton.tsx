'use client'

import { useState, useRef, useEffect } from 'react'
import { Download, FileText, Code } from 'lucide-react'
import { ExportFormat, ExportOptions } from '@/lib/export-utils'

interface ExportButtonProps {
  onExport: (options: ExportOptions) => void
  disabled?: boolean
  label?: string
  className?: string
}

export default function ExportButton({ 
  onExport, 
  disabled = false, 
  label = 'Export Data',
  className = ''
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true)
    setIsOpen(false)
    
    try {
      await new Promise(resolve => setTimeout(resolve, 100)) // Small delay for UX
      onExport({ format, includeHeaders: true })
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <div className={`relative inline-block ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        className="inline-flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-md text-sm font-medium transition-colors duration-200 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:cursor-not-allowed"
      >
        <Download className={`h-4 w-4 mr-2 ${isExporting ? 'animate-spin' : ''}`} />
        {isExporting ? 'Exporting...' : label}
      </button>

      {isOpen && !disabled && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="py-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
              Export Format
            </div>
            
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <FileText className="h-4 w-4 mr-3 text-green-500" />
              <div className="text-left">
                <div className="font-medium">CSV File</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Excel/Sheets compatible</div>
              </div>
            </button>
            
            <button
              onClick={() => handleExport('json')}
              className="flex items-center w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Code className="h-4 w-4 mr-3 text-blue-500" />
              <div className="text-left">
                <div className="font-medium">JSON File</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">Structured data format</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}