import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Formatting utilities for consistent decimal display
export const formatDecimal = (value: number, decimals: number = 2): string => {
  return value.toFixed(decimals)
}

export const formatPoints = (points: number): string => {
  return formatDecimal(points, 2)
}

export const formatPercentage = (value: number): string => {
  return formatDecimal(value, 2) + '%'
}

export const formatEfficiency = (actualPoints: number, potentialPoints: number): string => {
  if (potentialPoints === 0) return formatDecimal(0, 2) + '%'
  return formatDecimal((actualPoints / potentialPoints) * 100, 2) + '%'
}

// Year utilities for dynamic year handling
export const getCurrentYear = (): number => {
  return new Date().getFullYear()
}

export const getAvailableYears = (startYear: number = 2021): number[] => {
  const currentYear = getCurrentYear()
  return Array.from(
    { length: currentYear - startYear + 1 },
    (_, i) => currentYear - i
  )
}

export const getCurrentYearString = (): string => {
  return getCurrentYear().toString()
}