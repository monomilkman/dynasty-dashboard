// Manual mapping of MFL franchise IDs to owner names
// Update this file as needed since MFL API doesn't provide owner information
// for this league

export interface OwnerMapping {
  [franchiseId: string]: string
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

// Add mappings for other years as needed
export const OWNER_MAPPINGS_2023: OwnerMapping = {
  '0001': 'Ryan Monaco', // Brock 'Em Sock 'Em Robots
  '0002': 'Damian Kruhmin', // Lawrence's Tailor
  '0003': 'Joe Stankard', // Latveria Doom  
  '0004': 'Andre Laffitte', // Running Up that Hill
  '0005': 'Brian Tutino', // Bijan Mustard
  '0006': 'Jared Ey', // CryBabyMahomes
  '0007': 'David Schwartz ', // MAXXimum WATTage
  '0008': 'Owner 8', // Errant Venture
  '0009': 'Matt Wishart ', // Monday Night Ra
  '0010': 'Michael Foos', // DJ Moore Touchdowns
  '0011': 'Roderick Dunn', // Boston Strong
  '0012': 'Justin Herrmann', // Jesus Christ that's Kendrick Bourne!
  '0013': 'Owner 13', // Team 13
  '0014': 'Owner 14', // Team 14
  '0015': 'Owner 15', // Team 15
  '0016': 'Owner 16', // Team 16
}

export const OWNER_MAPPINGS_2022: OwnerMapping = {
  '0001': 'Ryan Monaco', // Brock 'Em Sock 'Em Robots
  '0002': 'Damian Kruhmin', // Lawrence's Tailor
  '0003': 'Joe Stankard', // Latveria Doom  
  '0004': 'Andre Laffitte', // Running Up that Hill
  '0005': 'Brian Tutino', // Bijan Mustard
  '0006': 'Jared Ey', // CryBabyMahomes
  '0007': 'David Schwartz ', // MAXXimum WATTage
  '0008': 'Owner 8', // Errant Venture
  '0009': 'Matt Wishart ', // Monday Night Ra
  '0010': 'Michael Foos', // DJ Moore Touchdowns
  '0011': 'Roderick Dunn', // Boston Strong
  '0012': 'Justin Herrmann', // Jesus Christ that's Kendrick Bourne!
  '0013': 'Owner 13', // Team 13
  '0014': 'Owner 14', // Team 14
  '0015': 'Owner 15', // Team 15
  '0016': 'Owner 16', // Team 16
}

// Master function to get owner name by franchise ID and year
export function getOwnerName(franchiseId: string, year: number): string {
  let mapping: OwnerMapping
  
  switch (year) {
    case 2024:
      mapping = OWNER_MAPPINGS_2024
      break
    case 2023:
      mapping = OWNER_MAPPINGS_2023
      break
    case 2022:
      mapping = OWNER_MAPPINGS_2022
      break
    default:
      mapping = OWNER_MAPPINGS_2024 // Default fallback
  }
  
  return mapping[franchiseId] || `Manager ${franchiseId}`
}