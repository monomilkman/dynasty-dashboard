// Manual mapping of MFL franchise IDs to owner names
// Update this file as needed since MFL API doesn't provide owner information
// for this league
//
// FUTURE-PROOF DESIGN: When adding new seasons, copy the most recent season
// mapping as a template and update as needed

export interface OwnerMapping {
  [franchiseId: string]: string
}

// 2025 Season Owner Mappings (most recent - use as template for current year)
// 2025 Season Owner Mappings (Current Season)
export const OWNER_MAPPINGS_2025: OwnerMapping = {
  '0001': 'Ryan Monaco', // Owner of franchise 1
  '0002': 'Damian Kruhmin', // Owner of franchise 2
  '0003': 'Joe Stankard', // Owner of franchise 3
  '0004': 'Andre Laffitte', // Owner of franchise 4
  '0005': 'Brian Tutino', // Owner of franchise 5
  '0006': 'Jared Ey', // Owner of franchise 6
  '0007': 'David Schwartz', // Owner of franchise 7
  '0008': 'Bryan Birchmeier', // Owner of franchise 8
  '0009': 'Matt Wishart', // Owner of franchise 9
  '0010': 'Michael Foos', // Owner of franchise 10
  '0011': 'Roderick Dunn', // Owner of franchise 11
  '0012': 'Justin Herrmann', // Owner of franchise 12
}

// 2024 Season Owner Mappings
export const OWNER_MAPPINGS_2024: OwnerMapping = {
  '0001': 'Ryan Monaco', // Brock 'Em Sock 'Em Robots
  '0002': 'Damian Kruhmin', // Lawrence's Tailor
  '0003': 'Joe Stankard', // Latveria Doom  
  '0004': 'Andre Laffitte', // Running Up that Hill
  '0005': 'Brian Tutino', // Bijan Mustard
  '0006': 'Jared Ey', // CryBabyMahomes
  '0007': 'David Schwartz ', // MAXXimum WATTage
  '0008': 'Bryan Birchmeier', // Errant Venture
  '0009': 'Matt Wishart ', // Monday Night Ra
  '0010': 'Michael Foos', // DJ Moore Touchdowns
  '0011': 'Roderick Dunn', // Boston Strong
  '0012': 'Justin Herrmann', // Jesus Christ that's Kendrick Bourne!
}

// 2023 Season Owner Mappings (16 teams)
export const OWNER_MAPPINGS_2023: OwnerMapping = {
  '0001': 'Ryan Monaco', // Caught on Kamara
  '0002': 'Damian Kruhmin', // Lawrence's Tailor Rank #5
  '0003': 'Joe Stankard', // Raven's Flock
  '0004': 'Sam Reza', // Turbo Techies
  '0005': 'Chris Whitman', // Best Nablus Knafeh Eaters In The World - Suck It
  '0006': 'Jared Ey', // AllenTown
  '0007': 'Howard Walters', // Chicago Pimps
  '0008': 'Bryan Birchmeier', // Errant Venture
  '0009': 'Matt Wishart', // Olave Garden
  '0010': 'Michael Foos', // DJ Moore Touchdowns
  '0011': 'David Schwartz', // May the Schwartz be with you
  '0012': 'Justin Herrmann', // My Absentmindedness Will Otton Me
  '0013': 'Brian Tutino', // Bijan Mustard
  '0014': 'Nate Marts', // Buffalo Sim
  '0015': 'Roderick Dunn', // Boston Strong
  '0016': 'Andre Laffitte', // Fields of Dreams
}

// 2022 Season Owner Mappings (16 teams)
export const OWNER_MAPPINGS_2022: OwnerMapping = {
  '0001': 'Ryan Monaco', // That's What CeeDee Said
  '0002': 'Damian Kruhmin', // Lawrence's Tailor Rank #5
  '0003': 'Joe Stankard', // Raven's Flock
  '0004': 'Sam Reza', // Turbo Techies
  '0005': 'Chris Whitman', // Best Nablus Knafeh Eaters In The World - Suck It
  '0006': 'Jared Ey', // AllenTown
  '0007': 'Howard Walters', // Chicago Pimps
  '0008': 'Bryan Birchmeier', // Errant Venture
  '0009': 'Matt Wishart', // Eeyore - Swiftly Losing Round One
  '0010': 'Michael Foos', // Free DJ Moore
  '0011': 'David Schwartz', // May the Schwartz be with you
  '0012': 'Justin Herrmann', // Clappin' Cheeks
  '0013': 'Brian Tutino', // 404 Team Not Found
  '0014': 'Nate Marts', // Buffalo Sim
  '0015': 'Roderick Dunn', // Miami Fire
  '0016': 'Andre Laffitte', // Finely Tuned AthLenny Machine
}

// 2021 Season Owner Mappings (16 teams)
export const OWNER_MAPPINGS_2021: OwnerMapping = {
  '0001': 'Ryan Monaco', // That's What CeeDee Said
  '0002': 'Damian Kruhmin', // Lawrence's Tailor Rank #5
  '0003': 'Joe Stankard', // Raven's Flock
  '0004': 'Sam Reza', // Turbo Techies
  '0005': 'Chris Whitman', // Who the Fuck is Dillon?
  '0006': 'Jared Ey', // Corona Lickers
  '0007': 'Howard Walters', // Chicago Pimps
  '0008': 'Bobby', // The Original Sauce Bucs
  '0009': 'Matt Wishart', // Swiftly Losing Round One
  '0010': 'Michael Foos', // DJ No Moore
  '0011': 'Tyrone Green', // Chi-town Death Dealers
  '0012': 'Justin Herrmann', // DJ Jazzy Jeffersons
  '0013': 'Brian Tutino', // 404 Team Not Found
  '0014': 'Nate Marts', // Buffalo Sim
  '0015': 'Roderick Dunn', // Miami Fire
  '0016': 'Andre Laffitte', // Double EntAndres
}

// Future season template - copy this when creating mappings for new seasons
// Example: export const OWNER_MAPPINGS_2026: OwnerMapping = { ...OWNER_MAPPINGS_TEMPLATE }
export const OWNER_MAPPINGS_TEMPLATE: OwnerMapping = {
  '0001': 'Ryan Monaco',
  '0002': 'Damian Kruhmin', 
  '0003': 'Joe Stankard',
  '0004': 'Andre Laffitte',
  '0005': 'Brian Tutino',
  '0006': 'Jared Ey',
  '0007': 'David Schwartz',
  '0008': 'Bryan Birchmeier',
  '0009': 'Matt Wishart',
  '0010': 'Michael Foos',
  '0011': 'Roderick Dunn',
  '0012': 'Justin Herrmann',
}

// All available owner mappings by year
const ALL_OWNER_MAPPINGS: Record<number, OwnerMapping> = {
  2025: OWNER_MAPPINGS_2025,
  2024: OWNER_MAPPINGS_2024,
  2023: OWNER_MAPPINGS_2023,
  2022: OWNER_MAPPINGS_2022,
  2021: OWNER_MAPPINGS_2021,
}

// Master function to get owner name by franchise ID and year
export function getOwnerName(franchiseId: string, year: number): string {
  // Try to find the mapping for the specific year
  const mapping = ALL_OWNER_MAPPINGS[year]
  
  if (mapping) {
    return mapping[franchiseId] || `Manager ${franchiseId}`
  }
  
  // For future years not yet defined, use the most recent mapping as fallback
  const currentYear = new Date().getFullYear()
  let fallbackMapping = OWNER_MAPPINGS_2025 // Default to 2025
  
  // Find the most recent mapping available
  for (let checkYear = currentYear; checkYear >= 2021; checkYear--) {
    if (ALL_OWNER_MAPPINGS[checkYear]) {
      fallbackMapping = ALL_OWNER_MAPPINGS[checkYear]
      break
    }
  }
  
  console.log(`[Owner Mappings] Using ${currentYear >= year ? 'future' : 'historical'} fallback mapping for year ${year}`)
  return fallbackMapping[franchiseId] || `Manager ${franchiseId}`
}

// Helper function to add new season mappings dynamically
export function addSeasonMapping(year: number, mappings: OwnerMapping): void {
  ALL_OWNER_MAPPINGS[year] = mappings
  console.log(`[Owner Mappings] Added mappings for ${year} season`)
}