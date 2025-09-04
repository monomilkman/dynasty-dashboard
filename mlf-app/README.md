# MyFantasyLeague Leaderboard App

A modern Next.js application for displaying MyFantasyLeague team standings with sorting, filtering, and responsive design.

## Features

- **Real-time MFL Data**: Fetches standings directly from MyFantasyLeague API
- **Interactive Leaderboard**: Sortable columns for all team statistics
- **Search & Filter**: Find teams by manager name or team name
- **Year Selection**: Switch between different seasons
- **Responsive Design**: Mobile-optimized with sticky columns
- **Dark/Light Mode**: System-aware theme switching
- **API Compliance**: Rate limiting, caching, and retry logic for MFL API

## Setup Instructions

### 1. Environment Configuration

Copy the example environment file:
```bash
cp .env.example .env.local
```

### 2. Register with MyFantasyLeague

1. Visit the [MFL API Registration Page](https://www44.myfantasyleague.com/2025/csetup?C=APISETUP)
2. Register your application to get a User-Agent string
3. Update your `.env.local` file with the registered User-Agent:

```env
MFL_USER_AGENT=YourRegisteredUserAgentHere
```

### 3. Configure League ID

Update the default league ID in `.env.local`:
```env
NEXT_PUBLIC_DEFAULT_LEAGUE_ID=your_league_id
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run Development Server

```bash
npm run dev
```

Visit `http://localhost:3000` to see the application.

## API Compliance Features

This application follows MyFantasyLeague's API best practices:

### Rate Limiting
- Minimum 1-second delay between requests
- Request queuing to prevent API hammering
- Exponential backoff for failed requests
- Maximum 3 retry attempts

### Caching
- 5-minute cache duration for standings data
- In-memory caching to reduce API calls
- Stale data serving during API outages
- Automatic cache cleanup

### Error Handling
- Graceful handling of rate limits (429 errors)
- User-friendly error messages
- Fallback to cached data when possible
- Comprehensive logging for debugging

### User-Agent Compliance
- Registered User-Agent string required
- Configurable via environment variables
- Proper HTTP headers on all requests

## Deployment

### Vercel Deployment

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `MFL_USER_AGENT`
   - `MFL_API_BASE_URL`
   - `NEXT_PUBLIC_DEFAULT_LEAGUE_ID`
4. Deploy

### Environment Variables for Production

```env
MFL_USER_AGENT=your_registered_user_agent
MFL_API_BASE_URL=https://api.myfantasyleague.com
NEXT_PUBLIC_DEFAULT_LEAGUE_ID=your_league_id
MFL_CACHE_DURATION_MINUTES=5
MFL_MIN_REQUEST_INTERVAL_MS=1000
MFL_MAX_RETRY_ATTEMPTS=3
```

## API Usage

### Endpoints

- `GET /api/mfl?year=2024&leagueId=46221` - Get standings data

### Query Parameters

- `year`: Season year (defaults to 2024)
- `leagueId`: MFL League ID (defaults to environment variable)

### Response Format

```json
[
  {
    "id": "0001",
    "manager": "John Doe",
    "teamName": "Team Name",
    "startersPoints": 1234.5,
    "benchPoints": 234.5,
    "offensePoints": 1000.0,
    "defensePoints": 234.5,
    "totalPoints": 1234.5,
    "potentialPoints": 1400.0,
    "year": 2024
  }
]
```

## Development

### Project Structure

```
mlf-app/
├── app/
│   ├── api/mfl/route.ts        # MFL API endpoint
│   ├── components/             # React components
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Main page
├── lib/
│   ├── mfl.ts                 # Data normalization
│   ├── mfl-api.ts             # API utilities
│   └── utils.ts               # Helper functions
└── components/ui/              # shadcn/ui components
```

### Key Components

- **Leaderboard**: Main data table with sorting and filtering
- **YearSelector**: Year navigation controls
- **RefreshButton**: Manual data refresh
- **ThemeToggle**: Dark/light mode toggle

### API Utilities

- **fetchWithRetry**: Rate-limited API requests with retry logic
- **Cache Management**: In-memory caching for performance
- **Request Queuing**: Prevents API hammering
- **Error Handling**: Comprehensive error management

## Troubleshooting

### Common Issues

1. **Rate Limit Errors**: Increase delay between requests or register for higher limits
2. **Cache Issues**: Clear cache using the refresh button
3. **Invalid Data**: Check MFL API response format
4. **Authentication**: Verify User-Agent registration

### Debugging

Enable console logging to see API requests and cache status:
```javascript
console.log(getQueueStatus()) // Check request queue
```

### Support

- MFL API Documentation: [https://www44.myfantasyleague.com/2025/csetup](https://www44.myfantasyleague.com/2025/csetup)
- Next.js Documentation: [https://nextjs.org/docs](https://nextjs.org/docs)

## License

MIT License - see LICENSE file for details.
