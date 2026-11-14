# Launch Window

A space mission design game for the 2026 NASA Space Apps Challenge (Space Mission Design Game track).
Players design, review, launch and operate a science mission, solo or as a team of up to four, and score
only for the science that actually reaches the ground.

## Run it

```bash
npm install
npm run dev        # game server on :8787 + Vite on :5173
```

Open http://localhost:5173. For team play on a LAN, teammates open the "Network" URL Vite prints and join with the room code.

```bash
npm run build && npm start   # production: one Node server serves the app and the rooms (PORT, default 8787)
npm test                     # headless team-rules check (roles, approvals, voting)
npm run balance              # flies reference designs through the sim and prints reports
```

Requires Node 23.6+ (the server runs TypeScript directly via type stripping).

## How it works

| Folder | What's there |
| --- | --- |
| `shared/catalog.ts` | Parts catalog (orbits, rockets, buses, solar, batteries, pointing, propulsion, antennas, ground networks, recorders) and tunable `RULES` |
| `shared/scenarios.ts` | Mission briefs: instruments, objectives, allowed parts, events, real missions to compare with |
| `shared/calc.ts` | Design math: live metrics, design-review checks, advisor hints, change summaries |
| `shared/sim.ts` | Day-by-day operations sim (power, battery wear, data flow, fuel) and random events |
| `shared/score.ts` | Mission report: score, tier, "why it happened", real-world match |
| `shared/game.ts` | Game state machine shared by server (team) and browser (solo) |
| `server/server.ts` | Zero-dependency room server: actions over POST, live state over SSE, rooms saved to `.data/` |
| `src/` | React UI, one screen per phase |

The same reducer runs in the browser for solo play and on the server for team rooms, and all randomness is seeded,
so a mission plays out identically for every player.

### Scoring

- **Science delivered**: each instrument's science value × share of its planned data that reached the ground × orbit quality × pointing quality, plus 35% per extra satellite.
- **Objectives**: 100 per must-have, 50 per bonus. Objectives need enough weighted science points (and revisit, where relevant).
- **Budget efficiency** (up to 100): full marks for finishing 25%+ under budget.
- **Engineering margins** (up to 100): mass, power and downlink margins, full marks at 20%+ each.
- **Teamwork & ops calls** (up to 100): quality of event decisions, first-try review, every role contributing.

Tiers: **Failure** (launch failure, lost in the first quarter, or no must-haves), **Partial**, **Success** (all must-haves), **Exceeded** (all must-haves + 2 bonus).

### Adding a scenario

Add a `Scenario` object in `shared/scenarios.ts` (instruments, objectives, allowed orbits/rockets/networks, events,
real missions, starter design) and append it to `SCENARIOS`. New orbits or parts go in `shared/catalog.ts`.
Run `npm run balance` with a few reference designs to check the numbers.
