# Dynasty Dashboard - MyFantasyLeague Analytics

A comprehensive Next.js-powered fantasy football analytics dashboard that integrates with MyFantasyLeague.com API to provide detailed team statistics, weekly analysis, matchup tracking, and advanced visualizations for our dynasty league.

## 🏆 Features

### Core Analytics
- **Multi-Year Team Statistics**: Complete historical data from 2021-2025
- **Weekly Progression Tracking**: Game-by-game scoring analysis with temporal charts
- **Head-to-Head Comparisons**: Team performance analysis with weekly context
- **Position-Specific Analysis**: QB, RB, WR, TE, K, DEF breakdowns
- **Matchup Results**: Win/loss records with opponent tracking

### Advanced Visualizations
- **Interactive Line Charts**: Scoring progression over time (Chart.js)
- **Responsive Data Tables**: Sortable statistics with mobile optimization
- **Real-time Updates**: Live data from MyFantasyLeague API
- **Export Functionality**: CSV/JSON data export for external analysis

### User Experience
- **Dark/Light Mode**: System-aware theme switching
- **Weekly Filtering**: Analyze specific weeks or date ranges
- **Team Comparisons**: Multi-team performance analysis
- **Responsive Design**: Mobile-first design with sticky columns

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/monomilkman/dynasty-dashboard.git
cd dynasty-dashboard/mlf-app
npm install
```

### 2. Environment Setup

Copy the example environment file:
```bash
cp .env.local.example .env.local
```

### 3. Configure MFL API Keys

You'll need API keys for each season you want to analyze. Get them from the [MyFantasyLeague Developer Program](https://www44.myfantasyleague.com/2025/csetup?C=APISETUP).

Update your `.env.local` file:
```env
# Required: MFL API Keys for each season
MFL_API_KEY_2025=your_2025_api_key_here
MFL_API_KEY_2024=your_2024_api_key_here
MFL_API_KEY_2023=your_2023_api_key_here
MFL_API_KEY_2022=your_2022_api_key_here
MFL_API_KEY_2021=your_2021_api_key_here

# Optional: Custom configuration
MFL_USER_AGENT=dynasty-dashboard
MFL_LEAGUE_ID=46221
```

### 4. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to access the dashboard.

## 📊 Dashboard Components

### Leaderboard
- Complete team standings with sortable columns
- Multi-year data aggregation
- Search and filter capabilities
- Export to CSV/JSON

### Weekly Progression
- Line charts showing scoring trends over time
- Week-by-week performance analysis
- Team comparison visualizations

### Matchup Analysis
- Head-to-head records and results
- Opponent tracking and analysis
- Weekly matchup breakdowns

### Position Analysis
- QB, RB, WR, TE, K, DEF specific statistics
- Position-based scoring trends
- Player utilization analysis

## 🔧 API Integration

### Rate Limiting & Compliance
- Minimum 1-second delays between requests
- Exponential backoff for failed requests
- Request queuing to prevent API hammering
- Graceful handling of 429 rate limit errors

### Data Processing
- Real-time data fetching from MyFantasyLeague
- Fallback data strategies for development
- Comprehensive error handling
- Data validation and normalization

### Endpoints
- `/api/mfl` - Main team statistics
- `/api/mfl/weekly-progression` - Week-by-week scoring
- `/api/mfl/matchups` - Win/loss records
- `/api/mfl/positions` - Position-specific data

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Push to GitHub**: Ensure your code is pushed to GitHub
2. **Connect to Vercel**: Link your GitHub repository to Vercel
3. **Configure Environment Variables**: Add all required MFL API keys in Vercel dashboard
4. **Deploy**: Automatic deployment from main branch

### Environment Variables for Production

In your Vercel dashboard, add these environment variables:

```env
MFL_API_KEY_2025=your_actual_2025_key
MFL_API_KEY_2024=your_actual_2024_key
MFL_API_KEY_2023=your_actual_2023_key
MFL_API_KEY_2022=your_actual_2022_key
MFL_API_KEY_2021=your_actual_2021_key
```

### Alternative Deployment Platforms
- **Netlify**: Upload build folder after `npm run build`
- **Railway**: Direct GitHub integration
- **DigitalOcean App Platform**: Docker or static hosting

## 🛠 Development

### Project Structure
```
mlf-app/
├── app/
│   ├── api/mfl/              # API routes for MFL integration
│   │   ├── route.ts          # Main team data
│   │   ├── matchups/         # Win/loss records
│   │   ├── weekly-progression/ # Weekly scoring data
│   │   └── positions/        # Position-specific stats
│   ├── components/           # React components
│   │   ├── Leaderboard.tsx   # Main statistics table
│   │   ├── TeamChart.tsx     # Line chart visualizations
│   │   ├── MatchupsTable.tsx # Matchup tracking
│   │   └── [other components]
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main dashboard page
├── lib/                     # Utilities and helpers
│   ├── mfl.ts              # MFL API client
│   ├── mfl-scraper.ts      # Data processing
│   ├── mfl-api-keys.ts     # API key management
│   └── [other utilities]
└── components/ui/           # shadcn/ui components
```

### Key Technologies
- **Next.js 15.5.2**: React framework with App Router
- **TypeScript**: Type-safe development
- **Chart.js**: Interactive data visualizations
- **Tailwind CSS**: Utility-first styling
- **React Hooks**: Modern state management

### Development Commands
```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # Run ESLint
```

## 🔍 API Testing

Test API endpoints locally:
```bash
# Main team data
curl "http://localhost:3000/api/mfl?year=2025"

# Weekly progression
curl "http://localhost:3000/api/mfl/weekly-progression?year=2025&weeks=1,2,3"

# Matchup data
curl "http://localhost:3000/api/mfl/matchups?year=2025"

# Position analysis
curl "http://localhost:3000/api/mfl/positions?year=2025"
```

## 🏈 League Information

This dashboard is specifically configured for our dynasty fantasy football league (ID: 46221) but can be adapted for other leagues by modifying the league configuration in the environment variables and league-specific utilities.

## 🐛 Troubleshooting

### Common Issues
1. **API Rate Limits**: The app includes fallback data for development
2. **Missing Environment Variables**: Check `.env.local` configuration
3. **Build Errors**: Ensure all dependencies are installed with `npm install`
4. **Chart Rendering**: Clear browser cache if charts don't display

### Getting Help
- Check the console for detailed error messages
- Verify API keys are correctly configured
- Ensure all required environment variables are set

## 📝 License

MIT License - see LICENSE file for details.

---

**Dynasty Dashboard** - Built for our fantasy football league with ❤️ using Next.js and TypeScript.

*Ready for deployment on Vercel!*