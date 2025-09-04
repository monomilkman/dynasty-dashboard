// MFL API utilities with rate limiting, caching, and retry logic

interface CacheEntry {
  data: unknown
  timestamp: number
}

interface RequestQueue {
  url: string
  options: RequestInit
  resolve: (value: unknown) => void
  reject: (error: unknown) => void
  retryCount: number
}

// In-memory cache for API responses
const cache = new Map<string, CacheEntry>()

// Request queue to prevent hammering the API
const requestQueue: RequestQueue[] = []
let isProcessingQueue = false
let lastRequestTime = 0

// Minimum time between requests (1 second as recommended by MFL)
const MIN_REQUEST_INTERVAL = 1000

// Maximum retry attempts
const MAX_RETRY_ATTEMPTS = 3

// Exponential backoff base delay (in milliseconds)
const BASE_RETRY_DELAY = 1000

/**
 * Generate cache key for API requests
 */
export function getCacheKey(type: string, params: Record<string, string>): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${key}=${params[key]}`)
    .join('&')
  return `mfl_${type}_${sortedParams}`
}

/**
 * Get data from cache
 */
export function getFromCache(key: string): CacheEntry | null {
  return cache.get(key) || null
}

/**
 * Set data in cache
 */
export function setCache(key: string, data: unknown): void {
  cache.set(key, {
    data,
    timestamp: Date.now()
  })
  
  // Clean up old cache entries (older than 1 hour)
  const oneHourAgo = Date.now() - (60 * 60 * 1000)
  for (const [cacheKey, entry] of cache.entries()) {
    if (entry.timestamp < oneHourAgo) {
      cache.delete(cacheKey)
    }
  }
}

/**
 * Clear cache for a specific key or all cache
 */
export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key)
    console.log(`Cache cleared for key: ${key}`)
  } else {
    cache.clear()
    console.log('All cache cleared')
  }
}

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Calculate exponential backoff delay
 */
function getRetryDelay(retryCount: number): number {
  return BASE_RETRY_DELAY * Math.pow(2, retryCount) + Math.random() * 1000
}

/**
 * Process the request queue with rate limiting
 */
async function processRequestQueue(): Promise<void> {
  if (isProcessingQueue || requestQueue.length === 0) {
    return
  }

  isProcessingQueue = true

  while (requestQueue.length > 0) {
    const request = requestQueue.shift()!
    
    try {
      // Ensure minimum interval between requests
      const timeSinceLastRequest = Date.now() - lastRequestTime
      if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
        await sleep(MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      }

      console.log(`Processing MFL API request: ${request.url}`)
      
      const response = await fetch(request.url, request.options)
      lastRequestTime = Date.now()

      // Handle rate limiting (429 status)
      if (response.status === 429) {
        if (request.retryCount < MAX_RETRY_ATTEMPTS) {
          const retryDelay = getRetryDelay(request.retryCount)
          console.log(`Rate limited. Retrying in ${retryDelay}ms (attempt ${request.retryCount + 1}/${MAX_RETRY_ATTEMPTS})`)
          
          await sleep(retryDelay)
          requestQueue.unshift({
            ...request,
            retryCount: request.retryCount + 1
          })
          continue
        } else {
          throw new Error('Rate limit exceeded. Maximum retry attempts reached.')
        }
      }

      if (!response.ok) {
        throw new Error(`MFL API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      request.resolve(data)

    } catch (error) {
      console.error('MFL API request failed:', error)
      
      // Retry on network errors
      if (request.retryCount < MAX_RETRY_ATTEMPTS && 
          error instanceof Error && 
          (error.message.includes('fetch') || error.message.includes('network'))) {
        
        const retryDelay = getRetryDelay(request.retryCount)
        console.log(`Network error. Retrying in ${retryDelay}ms (attempt ${request.retryCount + 1}/${MAX_RETRY_ATTEMPTS})`)
        
        await sleep(retryDelay)
        requestQueue.unshift({
          ...request,
          retryCount: request.retryCount + 1
        })
        continue
      }
      
      request.reject(error)
    }
  }

  isProcessingQueue = false
}

/**
 * Fetch data from MFL API with retry logic and rate limiting
 */
export function fetchWithRetry(url: string, options: RequestInit = {}): Promise<unknown> {
  return new Promise((resolve, reject) => {
    requestQueue.push({
      url,
      options: {
        ...options,
        headers: {
          ...options.headers,
        }
      },
      resolve,
      reject,
      retryCount: 0
    })

    // Start processing queue
    processRequestQueue().catch(console.error)
  })
}

/**
 * Get current queue status for debugging
 */
export function getQueueStatus() {
  return {
    queueLength: requestQueue.length,
    isProcessing: isProcessingQueue,
    lastRequestTime,
    cacheSize: cache.size
  }
}

/**
 * Validate MFL API response
 */
export function validateMFLResponse(data: unknown): boolean {
  if (!data || typeof data !== 'object' || data === null) {
    return false
  }

  const typedData = data as Record<string, unknown>

  // Check for common MFL error patterns
  if (typedData.error || (typeof typedData.message === 'string' && typedData.message.includes('error'))) {
    return false
  }

  // Check for standings data structure (both possible formats)
  const league = typedData.league as Record<string, unknown> | undefined
  const standings = league?.standings as Record<string, unknown> | undefined
  const legacyFranchise = standings?.franchise
  
  // Check for leagueStandings structure (newer format)
  const leagueStandings = typedData.leagueStandings as Record<string, unknown> | undefined  
  const newFranchise = leagueStandings?.franchise
  
  if ((legacyFranchise && Array.isArray(legacyFranchise)) || (newFranchise && Array.isArray(newFranchise))) {
    return true
  }

  return false
}