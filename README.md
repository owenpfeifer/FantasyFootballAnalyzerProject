# Fantasy Football Analyzer

**Created by Owen Pfeifer, Josh Smith, and Ryan Snyder**

Fantasy Football Analyzer is a Next.js web application designed to help fantasy football managers make data-driven decisions across the entire season.

---

## Key Features

* **Weekly Lineup Optimizer:** Searches the NFL player pool, enforces injury and bye-week availability rules, calculates live projected point totals, and automatically promotes higher-scoring bench players into optimal starting and multi-FLEX slots.
* **Draft Assistance:** Evaluates undrafted players using Value Over Replacement Player (VORP), positional scarcity baselines, injury penalties, and custom league settings (including Superflex leagues).
* **Trade Analyzer:** Grades multi-player trade packages (`A+` through `F`), calculates net weekly point differentials, and checks your carried-over roster for positional voids and incoming injury risks.
* **Dynamic Scoring Formats:** Instantly scales player projections across **PPR**, **Half-PPR**, and **Standard** scoring formats without cumulative rounding drift.
* **ESPN API Integration & Offline Caching:** Fetches live player projections, bye weeks, and injury statuses via `/api/espn` with in-memory (`cacheStore`) and `localStorage` caching plus automatic offline fallback.

---

## Tech Stack

* **Framework:** Next.js (App Router) & React
* **Language:** TypeScript
* **Testing:** Vitest, React Testing Library, and `jsdom`

---

## Prerequisites

Make sure you have the following installed on your machine:

* **Node.js** (v18.18 or v20+ recommended)
* **npm** (included with Node.js)
* **Git**

---

## Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/<your-username>/FantasyFootballAnalyzerProject.git
   cd FantasyFootballAnalyzerProject
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

---

## Running the Application

### Development Mode
Start the local Next.js development server:
```bash
npm run dev
```
Once compiled, open **`http://localhost:3000`** in your browser.

### Production Build
To verify TypeScript compilation and run an optimized production build locally:
```bash
npm run build
npm start
```

---

## Running the Automated Test Suite

This project uses **Vitest** and **React Testing Library** to test both core business logic (unit tests) and interactive UI/API workflows (component tests).

### Run All Tests (Single Run)
Execute the complete test suite across all unit and component test files:
```bash
npx vitest run
```

### Run Tests in Watch Mode
Automatically re-run affected tests whenever files are saved during development:
```bash
npx vitest
```

### Run a Specific Test File
Target an individual unit or component test suite:
```bash
npx vitest run src/__tests__/optimalDraft.test.ts
npx vitest run src/__tests__/espnClient.test.tsx
```

---

## Test Suite Overview

All automated tests are located in `src/__tests__/` and configured via `vitest.config.mts`:

| Test File | Type | Focus Area |
| :--- | :--- | :--- |
| `src/__tests__/optimalDraft.test.ts` | Unit | VORP draft rankings, drafted-player filtering, empty/exhausted pools, IR penalties, and Superflex QB boosts |
| `src/__tests__/optimalLineup.test.ts` | Unit | Suboptimal starter detection, multi-FLEX assignment, empty rosters, and BYE/OUT/IR exclusions |
| `src/__tests__/tradeGrader.test.ts` | Unit | Trade point differentials, letter grades, missing team context, positional warnings, and injury alerts |
| `src/__tests__/scoringAnaAvailability.test.ts` | Unit | PPR / Half-PPR / Standard projection scaling, format toggle idempotency, and zero/negative/BYE/OUT handling |
| `src/__tests__/WeeklyLineup.test.tsx` | Component | Player search autocomplete, starter/bench assignment, `OUT` player guardrails, and **Optimize Lineup** state updates |
| `src/__tests__/TradeAnalyzer.test.tsx` | Component | Carried-over roster chips, incoming player search, trade grading output, and empty-roster navigation |
| `src/__tests__/espnClient.test.tsx` | Component | `/api/espn` HTTP 200 player loading, Sidebar status updates, HTTP 500 error fallback, and cross-tab persistence |

---

## Project Structure

```text
FantasyFootballAnalyzerProject/
├── src/
│   ├── app/
│   │   ├── api/espn/route.ts       # Next.js API route for fetching & normalizing ESPN data
│   │   └── page.tsx                # Main FFAAnalyzerApp shell & tab state management
│   ├── components/
│   │   ├── DraftAssistant.tsx      # Draft board & VORP recommendations UI
│   │   ├── WeeklyLineup.tsx        # Lineup search, roster slots, & optimizer UI
│   │   ├── TradeAnalyzer.tsx       # Multi-player trade builder & grader UI
│   │   └── Sidebar.tsx             # Navigation, API sync trigger, & status indicator
│   ├── lib/
│   │   ├── optimalDraft.ts         # Draft VORP & positional need engine
│   │   ├── optimalLineup.ts        # Start/sit evaluator & best-roster solver
│   │   ├── tradeGrader.ts          # Trade differential & roster-fit analyzer
│   │   ├── espnClient.ts           # Client API fetcher & offline fallback handler
│   │   ├── cacheStore.ts           # In-memory response cache
│   │   └── models.ts               # TypeScript interfaces, scoring scaling, & availability helpers
│   └── __tests__/                  # Vitest unit & component test suites + setup.ts
├── vitest.config.mts               # Vitest & jsdom test runner configuration
└── package.json                    # Scripts and dependencies
```