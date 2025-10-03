# MyFantasyLeague Stats Tracker

A comprehensive fantasy football analytics dashboard for MyFantasyLeague.com leagues, built with Next.js, TypeScript, and advanced data visualization.

![Version](https://img.shields.io/badge/version-2.3.1-blue)
![Next.js](https://img.shields.io/badge/Next.js-15.5.2-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)

## 🎯 Overview

Transform your MyFantasyLeague experience with powerful analytics, interactive visualizations, and advanced statistical analysis. Track team performance, analyze positional strengths, compare head-to-head matchups, and predict playoff probabilities with Monte Carlo simulation.

## ✨ Features

### 📊 Eight Comprehensive Views

1. **Table View** - Complete team statistics leaderboard with sortable columns
2. **Charts View** - 4-panel line chart visualizations for temporal analysis
3. **Positions View** - Detailed position-by-position performance breakdowns
4. **Matchups & Records** - Win/loss records with weekly context and head-to-head results
5. **Rankings** - 7 ranking categories including Power Rankings, Efficiency, and Point Differential
6. **Compare Teams** - Side-by-side team comparison with advanced metrics
7. **Season Breakdown** - Regular season vs postseason performance analysis
8. **Playoff Tracker** ⭐ - Monte Carlo simulation-based playoff probabilities

### 🎲 Advanced Playoff Probability Tracker

- **10,000 Monte Carlo Simulations** for statistical accuracy
- **ELO-based Win Probability Model** for realistic game predictions
- **Automatic Clinching Detection** - Shows when teams have secured playoff spots
- **Path to Playoffs Scenarios** - Clear visualization of what each team needs
- **Real-time Updates** - Recalculates as season progresses
- **Tiebreaker Logic** - Implements head-to-head and point differential rules

### 📈 Data & Analytics

- **Multi-Year Support** (2021-2025+) with year-specific API authentication
- **Dynamic Week Filtering** - Analyze specific weeks or full season
- **Manager Filtering** - Focus on specific teams or managers
- **Offense/Defense Splits** - Detailed performance breakdowns
- **Efficiency Tracking** - Measures lineup optimization (starters vs potential points)
- **Position Analysis** - QB, RB, WR, TE, K, DL, LB, CB, S, Flex performance
- **Historical Accuracy** - 100% data accuracy for all seasons

### 🎨 User Experience

- **Dark Mode** - Seamless light/dark theme switching
- **Responsive Design** - Optimized for desktop and mobile
- **Export Functionality** - CSV/JSON export for all data views
- **Loading States** - Smooth animations and feedback
- **Error Handling** - Graceful degradation with meaningful messages

## 🚀 Getting Started

### Prerequisites

- Node.js 18.0 or higher
- npm or yarn package manager
- MyFantasyLeague.com API key (for your league)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/mlf-app.git
cd mlf-app
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env.local
```

4. Add your MFL API credentials to `.env.local`:
```env
MFL_API_KEY=your_api_key_here
MFL_LEAGUE_ID=your_league_id
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

### Production Build

```bash
npm run build
npm run start
```

## 📁 Project Structure

```
mlf-app/
├── app/
│   ├── api/mfl/              # MFL API integrations
│   │   ├── route.ts         # Main team data endpoint
│   │   ├── matchups/        # Weekly matchup results
│   │   ├── positions/       # Position-specific data
│   │   └── weekly-progression/ # Week-by-week scoring
│   ├── components/          # React components
│   │   ├── Leaderboard.tsx
│   │   ├── TeamChart.tsx
│   │   ├── PlayoffProjections.tsx
│   │   └── [other components]
│   └── page.tsx            # Main application page
├── lib/                    # Utilities and helpers
│   ├── mfl.ts             # MFL API client
│   ├── rankings-calc.ts   # Ranking algorithms
│   └── [other utilities]
└── public/                # Static assets
```

## 🛠️ Tech Stack

- **Framework**: [Next.js 15.5.2](https://nextjs.org/) with App Router
- **Language**: [TypeScript 5.0](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Charts**: [Chart.js](https://www.chartjs.org/) + react-chartjs-2
- **Data Fetching**: [TanStack Query](https://tanstack.com/query) (React Query)
- **Database**: [Prisma](https://www.prisma.io/) (configured, optional)
- **Testing**: [Playwright](https://playwright.dev/) for E2E tests

## 📊 API Endpoints

### Main Endpoints

- `GET /api/mfl` - Team statistics with year/week/manager filtering
- `GET /api/mfl/matchups` - Weekly matchup results
- `GET /api/mfl/positions` - Position-specific breakdowns
- `GET /api/mfl/weekly-progression` - Week-by-week scoring data

### Query Parameters

- `year` - Season year (2021-2025)
- `weeks` - Comma-separated weeks (e.g., `1,2,3` or `1-14`)
- `managers` - Filter by manager names
- `franchiseIds` - Filter by franchise IDs

Example:
```bash
curl "http://localhost:3000/api/mfl?year=2025&weeks=1,2,3"
```

## 🎯 Key Features Explained

### Playoff Probability Tracker

The playoff tracker uses a sophisticated Monte Carlo simulation to calculate playoff probabilities:

1. **ELO Rating Calculation** - Teams rated based on performance (base 1500)
2. **Win Probability Model** - Logistic function: `P(win) = 1 / (1 + 10^((oppELO - teamELO) / 400))`
3. **Game Simulation** - 10,000 iterations of remaining games
4. **Tiebreaker Application** - Head-to-head, point differential, total points
5. **Probability Aggregation** - Playoff appearance % across all simulations

### Efficiency Calculation

Efficiency measures how well you set your starting lineup:

```
Efficiency = (Starter Points / Potential Points) × 100
```

- **Starter Points**: Points from your actual starting lineup
- **Potential Points**: Points from optimal lineup (best possible starters)
- **Typical Range**: 75-85% (higher is better lineup management)

### Total Points Enhancement

Total Points now shows complete roster production:

```
Total Points = Starter Points + Bench Points
```

This differs from MFL's definition (which only counts starters) but provides better insight into roster depth.

## 🧪 Testing

### Run E2E Tests
```bash
npm run test
```

### Run Tests in UI Mode
```bash
npm run test:ui
```

### Run Tests in Debug Mode
```bash
npm run test:debug
```

## 📝 Development Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint checks
npm run test         # Playwright E2E tests
```

## 🗄️ Database (Optional)

The app includes Prisma for optional data persistence:

```bash
npm run db:migrate   # Run database migrations
npm run db:generate  # Generate Prisma client
npm run db:studio    # Open Prisma Studio
npm run db:import    # Import historical data
```

## 📈 Roadmap

### Phase 3 (Planned)
- [ ] Player-level analysis and tracking
- [ ] Advanced search and filtering
- [ ] Performance optimizations with React Query
- [ ] Enhanced visualizations (scatter plots, heat maps)

### Phase 4 (Future)
- [ ] Strength of schedule analysis
- [ ] Waiver wire recommendations
- [ ] Lineup optimization suggestions
- [ ] Trade analysis tools

See [TODO.md](./TODO.md) for complete roadmap.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [MyFantasyLeague.com](https://www.myfantasyleague.com/) for the API
- [Next.js](https://nextjs.org/) team for the amazing framework
- [Chart.js](https://www.chartjs.org/) for visualization capabilities
- [Anthropic](https://www.anthropic.com/) for Claude Code assistance

## 📞 Support

For questions or support:
- Open an issue in the GitHub repository
- Check the [CLAUDE.md](./CLAUDE.md) for development guide
- Review [CHANGELOG.md](./CHANGELOG.md) for recent updates

---

**Last Updated**: January 10, 2025
**Version**: 2.3.1
**Status**: Production Ready ✅
