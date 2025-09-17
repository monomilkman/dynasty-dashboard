-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "leagueId" TEXT NOT NULL,
    "leagueName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "franchiseId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "manager" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "divisionId" TEXT,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "ties" INTEGER NOT NULL DEFAULT 0,
    "pointsFor" REAL NOT NULL DEFAULT 0,
    "pointsAgainst" REAL NOT NULL DEFAULT 0,
    "totalPoints" REAL NOT NULL DEFAULT 0,
    "startersPoints" REAL NOT NULL DEFAULT 0,
    "benchPoints" REAL NOT NULL DEFAULT 0,
    "potentialPoints" REAL NOT NULL DEFAULT 0,
    "efficiency" REAL NOT NULL DEFAULT 0,
    "qbPoints" REAL NOT NULL DEFAULT 0,
    "rbPoints" REAL NOT NULL DEFAULT 0,
    "wrPoints" REAL NOT NULL DEFAULT 0,
    "tePoints" REAL NOT NULL DEFAULT 0,
    "kPoints" REAL NOT NULL DEFAULT 0,
    "dlPoints" REAL NOT NULL DEFAULT 0,
    "lbPoints" REAL NOT NULL DEFAULT 0,
    "cbPoints" REAL NOT NULL DEFAULT 0,
    "sPoints" REAL NOT NULL DEFAULT 0,
    "offenseFlexPoints" REAL NOT NULL DEFAULT 0,
    "defenseFlexPoints" REAL NOT NULL DEFAULT 0,
    "offensePoints" REAL NOT NULL DEFAULT 0,
    "defensePoints" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "teams_year_fkey" FOREIGN KEY ("year") REFERENCES "seasons" ("year") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "weekly_results" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "franchiseId" TEXT NOT NULL,
    "opponentId" TEXT,
    "score" REAL NOT NULL,
    "opponentScore" REAL NOT NULL DEFAULT 0,
    "result" TEXT NOT NULL,
    "isHomeTeam" BOOLEAN NOT NULL DEFAULT false,
    "mflFinalized" BOOLEAN NOT NULL DEFAULT false,
    "lastVerified" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dataChecksum" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "weekly_results_year_fkey" FOREIGN KEY ("year") REFERENCES "seasons" ("year") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "weekly_results_franchiseId_year_fkey" FOREIGN KEY ("franchiseId", "year") REFERENCES "teams" ("franchiseId", "year") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "player_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "week" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT,
    "position" TEXT,
    "franchiseId" TEXT NOT NULL,
    "score" REAL NOT NULL,
    "isStarter" BOOLEAN NOT NULL DEFAULT false,
    "team" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "player_scores_year_fkey" FOREIGN KEY ("year") REFERENCES "seasons" ("year") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "player_scores_franchiseId_year_fkey" FOREIGN KEY ("franchiseId", "year") REFERENCES "teams" ("franchiseId", "year") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "positional_data" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "year" INTEGER NOT NULL,
    "week" INTEGER,
    "franchiseId" TEXT NOT NULL,
    "qbTotal" REAL NOT NULL DEFAULT 0,
    "rbTotal" REAL NOT NULL DEFAULT 0,
    "wrTotal" REAL NOT NULL DEFAULT 0,
    "teTotal" REAL NOT NULL DEFAULT 0,
    "kTotal" REAL NOT NULL DEFAULT 0,
    "dlTotal" REAL NOT NULL DEFAULT 0,
    "lbTotal" REAL NOT NULL DEFAULT 0,
    "cbTotal" REAL NOT NULL DEFAULT 0,
    "sTotal" REAL NOT NULL DEFAULT 0,
    "oFlexTotal" REAL NOT NULL DEFAULT 0,
    "dFlexTotal" REAL NOT NULL DEFAULT 0,
    "offenseTotal" REAL NOT NULL DEFAULT 0,
    "defenseTotal" REAL NOT NULL DEFAULT 0,
    "totalScore" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "positional_data_year_fkey" FOREIGN KEY ("year") REFERENCES "seasons" ("year") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "positional_data_franchiseId_year_fkey" FOREIGN KEY ("franchiseId", "year") REFERENCES "teams" ("franchiseId", "year") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "seasons_year_key" ON "seasons"("year");

-- CreateIndex
CREATE INDEX "teams_year_idx" ON "teams"("year");

-- CreateIndex
CREATE INDEX "teams_franchiseId_idx" ON "teams"("franchiseId");

-- CreateIndex
CREATE UNIQUE INDEX "teams_franchiseId_year_key" ON "teams"("franchiseId", "year");

-- CreateIndex
CREATE INDEX "weekly_results_year_week_idx" ON "weekly_results"("year", "week");

-- CreateIndex
CREATE INDEX "weekly_results_franchiseId_year_idx" ON "weekly_results"("franchiseId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_results_year_week_franchiseId_key" ON "weekly_results"("year", "week", "franchiseId");

-- CreateIndex
CREATE INDEX "player_scores_year_week_idx" ON "player_scores"("year", "week");

-- CreateIndex
CREATE INDEX "player_scores_franchiseId_year_idx" ON "player_scores"("franchiseId", "year");

-- CreateIndex
CREATE INDEX "player_scores_playerId_idx" ON "player_scores"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "player_scores_year_week_playerId_franchiseId_key" ON "player_scores"("year", "week", "playerId", "franchiseId");

-- CreateIndex
CREATE INDEX "positional_data_year_week_idx" ON "positional_data"("year", "week");

-- CreateIndex
CREATE INDEX "positional_data_franchiseId_year_idx" ON "positional_data"("franchiseId", "year");

-- CreateIndex
CREATE UNIQUE INDEX "positional_data_year_week_franchiseId_key" ON "positional_data"("year", "week", "franchiseId");
