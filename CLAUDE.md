# MyFantasyLeague App - Claude Code Assistant Guide

## 🎯 Project Overview
A Next.js-powered fantasy football analytics dashboard that integrates with MyFantasyLeague.com API to provide comprehensive team and player statistics, weekly analysis, and advanced visualizations.

**Tech Stack**: Next.js 15.5.2 | TypeScript | Chart.js | Tailwind CSS | React Hooks
**Status**: Phase 2 Complete ✅ | Phase 3 Planning 🔄

---

## 🚀 Quick Start Commands

### Development Server
```bash
cd mlf-app
npm run dev
# App runs on http://localhost:3000 (or next available port)
```

### Key Testing URLs
- Main Dashboard: http://localhost:3009 (current dev port)
- API Health Check: `curl -s "http://localhost:3009/api/mfl?year=2025"`
- Weekly Data Test: `curl -s "http://localhost:3009/api/mfl/weekly-progression?year=2025&weeks=1,2"`
- Matchups Test: `curl -s "http://localhost:3009/api/mfl/matchups?year=2025&weeks=1"`

### Build & Production
```bash
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint checks
```

---

## 📁 Project Structure

### Core Application (`mlf-app/`)
```
app/
├── api/mfl/                    # MFL API integrations
│   ├── route.ts               # Main team data API
│   ├── matchups/route.ts      # Weekly matchup results
│   ├── weekly-progression/    # Week-by-week scoring
│   └── positions/route.ts     # Position-specific data
├── components/                 # React components
│   ├── Leaderboard.tsx        # Main statistics table
│   ├── TeamChart.tsx          # Line chart visualizations
│   ├── MatchupsTable.tsx      # Win/loss records
│   ├── HeadToHeadComparison.tsx # Team comparisons
│   ├── PositionsTable.tsx     # Position breakdowns
│   ├── WeekMultiSelect.tsx    # Week filtering
│   └── [other components]
├── lib/                       # Utilities and helpers
│   ├── mfl.ts                # MFL API client
│   ├── mfl-scraper.ts        # Data processing
│   ├── team-utils.ts         # Team data helpers
│   └── export-utils.ts       # Data export functions
└── page.tsx                   # Main application page
```

---

## 🔧 Key Development Commands

### API Testing
```bash
# Test main API with different years
curl -s "http://localhost:3009/api/mfl?year=2024"
curl -s "http://localhost:3009/api/mfl?year=2025"

# Test weekly data APIs
curl -s "http://localhost:3009/api/mfl/weekly-progression?year=2025&weeks=1,2,3"
curl -s "http://localhost:3009/api/mfl/matchups?year=2025"

# Check API response structure
curl -s "http://localhost:3009/api/mfl?year=2025" | jq '.[:2]'  # First 2 teams
```

### Development Workflow
```bash
# Start development with hot reload
npm run dev

# Kill processes on port conflicts
npx kill-port 3000
taskkill /F /IM node.exe  # Windows specific

# Package management
npm install [package]
npm uninstall [package]
npm audit fix

# Directory navigation
dir                       # List files (Windows)
cd "path with spaces"     # Navigate with quotes for spaces
```

---

## 🛠 Common Development Tasks

### Adding New Components
1. Create component in `app/components/`
2. Add TypeScript interface definitions
3. Import in `page.tsx` and add to view logic
4. Update export utilities if needed
5. Test with dev server

### Adding New API Endpoints
1. Create route file in `app/api/mfl/[endpoint]/`
2. Implement GET/POST handlers with proper error handling
3. Add rate limiting fallback strategies
4. Test with curl commands
5. Update components to consume new endpoint

### Debugging Common Issues
```bash
# Check for TypeScript errors
npx tsc --noEmit

# Clear Next.js cache
rm -rf .next
npm run dev

# Check process using ports
netstat -ano | findstr :3000

# View background process output
# Use BashOutput tool in Claude Code to monitor dev server
```

---

## 📊 Data Flow Architecture

### API Integration Pattern
```
User Input → Component State → API Call → MFL.com → 
Data Processing → Rate Limit Handling → Component Display
```

### Weekly Data Flow (Phase 2)
```
WeekMultiSelect → selectedWeeks State → Component Props →
API Calls (?weeks=1,2,3) → Weekly Data Processing → 
Chart/Table Updates with Week Context
```

---

## 🔍 Key Features Implemented

### Phase 1 Features
- ✅ Multi-year team statistics
- ✅ Position-specific analysis  
- ✅ Dark mode support
- ✅ Data export (CSV/JSON)
- ✅ Responsive design
- ✅ Error handling & loading states

### Phase 2 Features (Recently Completed)
- ✅ Weekly data filtering across all components
- ✅ Real-time matchup results with win/loss records
- ✅ Temporal line charts for scoring progression
- ✅ Enhanced team comparisons with week context
- ✅ Rate limiting resilience with fallback data

---

## 🐛 Known Issues & Solutions

### MFL API Rate Limiting (429 Errors)
**Issue**: Frequent rate limit hits during development
**Solution**: Implemented fallback data strategies in all API routes
```typescript
// Pattern used in API routes
if (response.status === 429) {
  // Return simulated fallback data
  return NextResponse.json(fallbackData)
}
```

### Chart.js Memory Issues
**Issue**: Occasional memory leaks with chart re-renders
**Solution**: Proper chart cleanup and instance management
```typescript
// Component cleanup pattern
useEffect(() => {
  return () => {
    // Cleanup chart instances
  }
}, [])
```

### Hot Reload Issues
**Issue**: Sometimes requires manual refresh
**Solution**: Clear .next cache and restart dev server
```bash
rm -rf .next && npm run dev
```

---

## 📋 Development Patterns

### Component Structure
```typescript
// Standard component pattern
interface ComponentProps {
  teams: Team[]
  selectedWeeks: number[]
}

export default function Component({ teams, selectedWeeks }: ComponentProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // API integration with error handling
  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/endpoint')
      // Process response
    } catch (err) {
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [dependencies])
  
  // Component JSX
}
```

### API Route Pattern
```typescript
// Standard API route structure
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const year = searchParams.get('year') || '2025'
    
    // API call with rate limiting handling
    const response = await fetch(mflUrl)
    if (response.status === 429) {
      return NextResponse.json(fallbackData)
    }
    
    return NextResponse.json(processedData)
  } catch (error) {
    return NextResponse.json({ error: 'API Error' }, { status: 500 })
  }
}
```

---

## 🎯 Next Phase Development (Phase 3)

### Immediate Tasks
1. **Player-Level Analysis**
   - Create `/api/mfl/players` endpoint
   - Build PlayerStats component
   - Add player comparison tools

2. **Advanced Filtering**
   - Implement search functionality
   - Add filter combinations
   - Create saved filter presets

### Commands for Phase 3 Setup
```bash
# Create new API endpoint
mkdir -p app/api/mfl/players
touch app/api/mfl/players/route.ts

# Create player components
touch app/components/PlayerStats.tsx
touch app/components/PlayerComparison.tsx

# Update utilities
# Edit lib/player-utils.ts (new file)
```

---

## 📚 Useful Resources

### Documentation Files
- `CONVERSATION_SUMMARY.md` - Latest development session details
- `CHANGELOG.md` - Version history and feature tracking  
- `TODO.md` - Complete project roadmap and task tracking
- `README.md` - User-facing documentation

### External APIs
- **MyFantasyLeague API**: https://api.myfantasyleague.com/
- **Next.js Documentation**: https://nextjs.org/docs
- **Chart.js Documentation**: https://www.chartjs.org/docs/

### Development Tools
- **TypeScript**: Strict typing for better development experience
- **Tailwind CSS**: Utility-first CSS framework
- **React Hooks**: Modern React patterns for state management
- **Claude Code**: AI assistant for development tasks

---

## 💡 Development Tips

1. **Always test API endpoints with curl** before integrating into components
2. **Use the BashOutput tool** to monitor background processes
3. **Implement loading states** for all async operations  
4. **Handle rate limiting gracefully** with fallback data
5. **Keep components focused** on single responsibilities
6. **Use TypeScript interfaces** for all data structures
7. **Test across different years** to ensure data compatibility

---

**Last Updated**: 2025-01-08  
**Version**: Phase 2.0.0 Complete  
**Claude Code Session**: Active and ready for Phase 3 development