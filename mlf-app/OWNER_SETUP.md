# Owner Name Configuration

Since the MyFantasyLeague API doesn't provide owner names for this league, you need to manually update the owner mappings in the configuration file.

## How to Update Owner Names

1. Open the file: `lib/owner-mappings.ts`

2. Replace the placeholder names with actual owner names:

```typescript
export const OWNER_MAPPINGS_2024: OwnerMapping = {
  '0001': 'John Smith',        // Brock 'Em Sock 'Em Robots
  '0002': 'Jane Doe',          // Lawrence's Tailor
  '0003': 'Mike Johnson',      // Latveria Doom  
  '0004': 'Sarah Wilson',      // Running Up that Hill
  '0005': 'Chris Brown',       // Bijan Mustard
  '0006': 'Alex Davis',        // CryBabyMahomes
  '0007': 'Emily Taylor',      // MAXXimum WATTage
  '0008': 'David Miller',      // Errant Venture
  '0009': 'Lisa Garcia',       // Monday Night Ra
  '0010': 'Tom Anderson',      // DJ Moore Touchdowns
  '0011': 'Maria Rodriguez',   // Boston Strong
  '0012': 'James Wilson',      // Jesus Christ that's Kendrick Bourne!
}
```

## Finding Franchise IDs

You can find the franchise IDs by:

1. Looking at the current leaderboard - the IDs are visible in the browser developer tools
2. Checking the MFL league page at: https://www45.myfantasyleague.com/2024/options?L=46221&O=07
3. Using the API response to see team names and match them to franchise IDs

## Adding Owner Names for Other Years

If you want accurate owner names for previous years (2023, 2022, etc.), update those mappings as well:

```typescript
export const OWNER_MAPPINGS_2023: OwnerMapping = {
  '0001': 'Previous Owner 1', // May be different from 2024
  '0002': 'Previous Owner 2',
  // ... etc
}
```

## Current Status

The app is currently showing:
- ✅ **Team Names**: Working correctly from MFL API
- ✅ **Owner Names**: Using manual mapping (needs real names)
- ✅ **Scoring Data**: Total points from MFL API
- ❓ **Detailed Scoring**: Starters/Bench/Offense/Defense not available from MFL API

## Missing Data Explanation

The detailed scoring breakdowns (Starters vs Bench, Offense vs Defense, Potential Points) are not available through the MFL API for this league. These are typically calculated client-side on the MFL website from individual player scoring data.

The current implementation shows:
- **Starters**: Same as Total (MFL doesn't separate)
- **Bench**: Shows "-" (not available)
- **Offense**: Same as Total (MFL doesn't separate)
- **Defense**: Shows "-" (not available)
- **Total**: Correct total points from MFL
- **Potential**: Shows "-" (not available)

If you need this detailed breakdown, it would require fetching individual player scores for all players and calculating the aggregates, which would be much more complex and slower.