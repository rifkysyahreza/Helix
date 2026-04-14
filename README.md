# Helix

**Autonomous Hyperliquid futures trading agent with journaling, self-review, and self-evolution loops.**

Helix is a sibling of Meridian, but built for **Hyperliquid futures**, not Solana DLMM LPing. It keeps the useful base architecture from Meridian, including:
- autonomous agent loops
- journaling
- lessons / self-review
- configurable runtimes
- OpenClaw / Codex bridge support
- dry-run safety rails

But its strategy brain is being rebuilt around:
- perp market structure
- setup ranking
- entry / exit planning
- risk controls
- post-trade review

---

## Current status

This repo is now a **hardened Hyperliquid-perps execution scaffold with early strategy logic**.

Already wired:
- runtime abstraction
- OpenClaw / Codex bridge support
- ReAct-style agent loop
- Hyperliquid market context fetch
- Hyperliquid account state fetch
- basic setup ranking heuristic
- journal note persistence
- dry-run / paper / approval / autonomous posture
- guarded live-execution readiness seam
- operator controls (halt, close-only, symbol suspension)
- pending intent expiry and replay-attempt marking
- canonical execution lifecycle phases
- exchange sync and reconciliation drift checks
- execution incident ledger
- execution audit surface
- operator-facing health summary
- burn-in telemetry and go-live readiness gating
- replay policy foundation with single-attempt replay discipline

What this means in practice:
- `paper` mode is usable
- `approval` mode is usable
- tiny-size autonomous execution infrastructure is in place
- execution truth, lifecycle tracking, replay hygiene, and incident visibility are materially stronger than the original scaffold

Still not finished:
- richer perp-specific technical analysis and strategy inputs
- deeper market structure / volume profile / order-flow intelligence implementation over live data
- fuller manager-driven autonomous reduce/close firing without conservative hold behavior
- longer empirical burn-in history from repeated live-like operation

Base knowledge direction now includes:
- market structure
- volatility and expansion/compression logic
- VWAP and value framework
- volume profile concepts
- perp context interpretation
- order-flow and execution-quality principles

The analyzer layer now exists for:
- market structure classification
- volatility / ATR expansion-compression detection
- multi-timeframe structure alignment
- VWAP and value area approximation
- candle-derived volume profile approximation
- perp context interpretation from funding / OI / premium
- order-book imbalance and execution-quality heuristics
- native trade-flow capture and derived delta-style pressure bias
- rolling microstructure summaries from native L2 subscriptions
- order-flow divergence / absorption / sweep heuristics
- explicit entry-style policy (breakout / pullback / fade / no-trade)
- execution-tactic shaping for entry style
- multi-factor market synthesis for long / short / no-trade biasing
- trade-plan shaping for invalidation, target framing, and execution notes

Integration note:
- Helix now uses the `@nktkas/hyperliquid` SDK as the primary real exchange access layer
- custom Helix code is focused on orchestration, risk, journaling, replay discipline, and strategy logic

---

## Intended architecture

### Core layers
- **observer**: fetch Hyperliquid market/account state
- **planner**: decide long / short / skip with thesis and invalidation
- **executor**: place, reduce, close, and monitor positions
- **journaler**: record setup, action, result, lesson
- **evolver**: review outcomes and refine heuristics over time

### Reused from Meridian
- `llm/` runtime seam
- `agent.js` iterative tool-using loop
- `lessons.js` learning layer
- `logger.js`
- `state.js`
- OpenClaw bridge runtime and smoke tests

### Legacy surfaces
- legacy Meteora/DLMM/LP tooling has been quarantined out of the active runtime path
- active Helix runtime should now be treated as Hyperliquid-perps-only

---

## First build target

Helix v0 should support:
1. read Hyperliquid market state
2. inspect current account positions/orders
3. rank candidate futures setups
4. produce structured trade plans in dry run or approval mode
5. journal trade decisions and outcomes
6. track execution truth, lifecycle state, incidents, and replay safety
7. learn from post-trade review

Current v0 status:
- steps 1 to 6 are materially wired
- step 7 exists in early form but still needs deeper futures-specific synthesis
- live execution infrastructure exists for open, reduce, and close flows
- execution lifecycle, incident logging, replay policy, burn-in telemetry, and go-live checks are now part of the active scaffold
- market analysis now includes native trade-flow, rolling microstructure, order-flow heuristics, explicit entry styles, and execution tactics
- the biggest missing layer is no longer basic execution plumbing, it is live-tested maturity and stronger autonomous trade management confidence

---

## Runtime

Helix keeps Meridian's runtime support, including:
- OpenAI-compatible providers
- OpenClaw local bridge
- OpenClaw Codex login path

## Hyperliquid integration strategy

Helix now prefers the `@nktkas/hyperliquid` SDK as the primary integration layer for:
- market info queries
- exchange order submission
- wallet-aware signing flow

Rule of thumb for this repo now:
- use SDK-first whenever it already covers the protocol correctly
- keep custom Helix code for agent orchestration, risk, journaling, and strategy logic
- only hand-roll protocol details when the SDK does not cover a needed capability

## Safer autonomy architecture

For a truly autonomous futures agent, I recommend using a **restricted execution wallet / agent wallet** instead of your main full-permission wallet.

Best-practice direction for Helix:
- strategist agent decides what to do
- restricted execution wallet performs allowed trade actions
- wallet should not have broad withdrawal powers
- limits should exist at both agent layer and wallet layer
- start in dry-run, then paper execution, then restricted live execution

Hyperliquid API wallet notes that matter for Helix:
- query account state using the master/subaccount address, not the agent wallet address
- use agent wallets for signing, not for querying account state
- do not casually reuse old agent-wallet addresses after deregistration/pruning
- prefer one agent wallet per trading process to avoid nonce collisions

That is the right shape for self-improving autonomy without handing the agent a totally unconstrained hot wallet.

## Meridian-style knowledge -> action -> journal -> learning loop

Helix is being shaped to follow a simple operator-assisted learning loop:

1. You add operator knowledge manually.
2. Helix uses that knowledge when forming trade theses.
3. Helix opens or proposes positions depending on execution mode.
4. Helix journals results and reviews outcomes.
5. Future decisions are influenced by both operator knowledge and learned trade history.

Operator knowledge file:

```env
HELIX_OPERATOR_KNOWLEDGE_FILE=./operator-knowledge.json
```

Example structure is provided in:
- `operator-knowledge.example.json`

Use this file for:
- market beliefs
- preferred setups
- anti-patterns
- symbol-specific warnings
- execution preferences

Helix now also has an explicit thesis-building layer that combines:
- operator knowledge
- learned symbol profile / adaptive history
- current market snapshot

That thesis object is used to shape trade proposals more explicitly, instead of relying only on scattered heuristic fields.

## Execution notes

For live reduce and close behavior, Helix now aims to follow documented Hyperliquid exchange semantics:
- reduce-only orders use `r: true`
- market-like execution uses aggressive `limit` pricing with `tif: "Ioc"`
- full closes are modeled as 100% reduce-only orders against the live position
- `vaultAddress` is used when trading on behalf of the configured account address
- autonomous manager actions are additionally gated by safety rails around capital buffer, recent pnl, and execution reliability

Configurable live execution helper:

```env
HELIX_IOC_SLIPPAGE_BPS=30
```

This is used to build aggressive IOC pricing from current mids and L2 book context.

## Tiny-size go-live path

Before moving Helix beyond approval mode, run a go-live check and confirm that:
- account state is present
- withdrawable buffer is not thin
- compounding logic is not in capital-preservation mode
- execution reliability is not materially degraded
- burn-in telemetry says promotion is ready

Helix now exposes a go-live readiness check intended to recommend either:
- `approval`
- `autonomous-tiny`

The intended cautious path is:
1. `paper`
2. `approval`
3. tiny-size autonomous testing only after the go-live check looks clean

Blunt current recommendation:
- run Helix in `paper` now if your environment variables and Hyperliquid account access are configured correctly
- run `approval` once you trust the proposals and exact intents
- do not treat `autonomous` as production-ready just because the flag exists; use it only for tiny supervised testing after burn-in and go-live checks are clean

## Burn-in operator runbook

Helix now includes a concrete staged burn-in path:
1. `paper`
2. `approval`
3. `autonomous` at tiny supervised size only

Operator artifacts now include:
- `BURN_IN_RUNBOOK.md`
- staged protocol summary via `get_burn_in_protocol`
- operator runbook status via `get_burn_in_runbook`
- REPL command: `/burn-in runbook`

Promotion rule:
- promote only when checklist is green and operator review agrees

Rollback rule:
- roll back immediately on severe incidents, unexplained drift, stream instability, or untrusted live behavior

## Execution modes

Helix now supports a mode switch via:

```env
HELIX_EXECUTION_MODE=paper
```

### `dry-run`
- safest mode
- no live execution
- useful for architecture and loop testing
- actions are simulated

### `paper`
- paper-trading style mode
- Helix records intended trades and lifecycle state
- useful for evaluating decision quality without live execution

### `approval`
- Helix generates exact action intent for open/close operations
- does not execute automatically
- useful when you want Helix to think and prepare actions, but keep final approval yourself

### `autonomous`
- Helix is allowed to execute supported live actions automatically
- intended target mode for a truly autonomous futures agent
- should only be used after the exchange/account/risk path is battle-tested

Important note:
- open, reduce, and close execution infrastructure now exists
- lifecycle, replay, sync, reconciliation, and incident tracking are materially hardened
- the remaining conservative gap is manager-side autonomous reduce/close action firing, which still prefers safety over aggression

Recommended OpenClaw config for now:

```env
LLM_RUNTIME=openclaw-codex
OPENCLAW_AGENT_COMMAND=openclaw
OPENCLAW_AGENT_TIMEOUT_MS=300000
OPENCLAW_AGENT_SESSION_PREFIX=helix-openclaw-bridge
OPENCLAW_AGENT_EXTRA_ARGS=--thinking low
OPENCLAW_MODEL=openai-codex/gpt-5.4
LLM_MODEL=openai-codex/gpt-5.4
DRY_RUN=true
```

---

## Setup

```bash
git clone <your-helix-repo-url>
cd helix
npm install
npm run setup
npm run test:openclaw-smoke
npm run dev
```

## Step-by-step: how to run Helix

### 1. Install prerequisites on a fresh machine
Minimum practical prerequisites:
- Node.js 18+
- git
- OpenClaw installed and working
- Hyperliquid account address
- Hyperliquid agent wallet address
- Hyperliquid agent wallet private key

### 2. Install OpenClaw
Install OpenClaw first, because Helix currently expects the OpenClaw bridge runtime.

If OpenClaw is not installed yet, follow your normal OpenClaw install path first, then verify the CLI exists:

```bash
openclaw --help
```

Then verify your OpenClaw/Codex login path is working before touching Helix.

### 3. Clone the Helix repo

```bash
git clone https://github.com/rifkysyahreza/Helix.git
cd Helix
```

### 4. Install dependencies

```bash
npm install
```

### 5. Create your env file
Copy `.env.example` to `.env` and start with a conservative configuration.

Example:

```env
LLM_RUNTIME=openclaw-codex
OPENCLAW_AGENT_COMMAND=openclaw
OPENCLAW_AGENT_TIMEOUT_MS=300000
OPENCLAW_AGENT_SESSION_PREFIX=helix-openclaw-bridge
OPENCLAW_AGENT_EXTRA_ARGS=--thinking low
OPENCLAW_MODEL=openai-codex/gpt-5.4
LLM_MODEL=openai-codex/gpt-5.4

DRY_RUN=true
HELIX_ENABLE_LIVE_EXECUTION=false
HELIX_EXECUTION_MODE=paper

HYPERLIQUID_ACCOUNT_ADDRESS=your_account_address
HYPERLIQUID_AGENT_WALLET_ADDRESS=your_agent_wallet_address
HYPERLIQUID_AGENT_WALLET_PRIVATE_KEY=your_agent_wallet_private_key

HELIX_OPERATOR_KNOWLEDGE_FILE=./operator-knowledge.json
HELIX_ACTION_COOLDOWN_MS=900000
HELIX_IOC_SLIPPAGE_BPS=30
```

### 6. Create `user-config.json`
Start conservative.

Example:

```json
{
  "allowedSymbols": ["BTC", "ETH", "SOL"],
  "maxConcurrentPositions": 2,
  "maxPositionNotionalUsd": 100,
  "maxTotalExposureUsd": 200,
  "maxLeverage": 2,
  "dailyLossLimitUsd": 30,
  "defaultPositionSizeUsd": 25,
  "stopLossPct": 1.2,
  "takeProfitPct": 2.5,
  "trailingStopPct": 0.8,
  "observerIntervalMin": 5,
  "plannerIntervalMin": 15,
  "reviewIntervalMin": 60,
  "regime": "trend-following",
  "timeframe": "15m"
}
```

### 7. Create `operator-knowledge.json`
Copy from `operator-knowledge.example.json` and add your actual beliefs, anti-patterns, and preferences.

Use it for things like:
- preferred market conditions
- symbols to avoid
- execution preferences
- setups Helix should trust more or less

### 8. Run smoke checks

```bash
npm run test:openclaw-smoke
```

If the smoke test fails, fix OpenClaw/runtime setup first before trying to trade.

### 9. Start in paper mode

```bash
npm run start
```

Recommended first mode:

```env
DRY_RUN=true
HELIX_ENABLE_LIVE_EXECUTION=false
HELIX_EXECUTION_MODE=paper
```

### 10. Use Helix interactively
Useful commands:
- `/status`
- `/health`
- `/audit`
- `/drill`
- `/burn-in start [paper|approval]`
- `/burn-in stop`
- `/burn-in status`
- `/watch`
- `/manage`
- `/review`
- `/sync`
- `/pending`
- `/halt`
- `/resume`
- `/close-only on|off`
- `/suspend <symbol>`
- `/unsuspend <symbol>`

What to check first:
- thesis quality
- size suggestions
- execution mode behavior
- learned beliefs making sense
- compounding/risk budget not behaving wildly

### 11. Move to approval mode
After paper looks sane, switch to:

```env
DRY_RUN=false
HELIX_ENABLE_LIVE_EXECUTION=true
HELIX_EXECUTION_MODE=approval
```

In approval mode, Helix can:
- think normally
- generate exact actions
- queue pending intents
- replay approved intents through execution plumbing

### 12. Run the go-live check before tiny autonomous
Helix now includes a go-live readiness check.

Use the tool flow to confirm whether Helix recommends:
- `approval`
- `autonomous-tiny`

Do not move into autonomous until the go-live check looks clean.

### 13. Only then test tiny autonomous
For first autonomous testing, keep size extremely small and limits tight.

Suggested first tiny-autonomous profile:

```json
{
  "maxConcurrentPositions": 1,
  "maxPositionNotionalUsd": 50,
  "maxTotalExposureUsd": 50,
  "maxLeverage": 1,
  "dailyLossLimitUsd": 15,
  "defaultPositionSizeUsd": 10
}
```

And switch env to:

```env
DRY_RUN=false
HELIX_ENABLE_LIVE_EXECUTION=true
HELIX_EXECUTION_MODE=autonomous
```

### 14. Recommended operating ladder
Use this order:
1. `paper`
2. `approval`
3. `autonomous-tiny`

Do not skip straight to broad autonomous live trading.

---

## Important note

Helix is no longer just a passive scaffold.

It now has meaningful Hyperliquid perp execution architecture, including:
- live open execution seam
- live reduce execution seam
- live reduce-only close seam
- approval replay into execution
- execution verification and reconciliation
- safety rails, safety holds, and go-live checks

That said, Helix should still be treated as a **cautious live-readiness system with a battle-hardened execution scaffold**, not a fully proven autonomous production trader.

Current practical status:
- `paper` mode is usable
- `approval` mode is usable
- tiny-size autonomous testing is possible when the go-live check is clean and burn-in readiness is healthy
- operator safety controls now exist for halt / close-only / symbol suspension
- replay policy, incident logging, lifecycle tracking, execution audit, and burn-in telemetry are in place
- broad unattended live autonomy still deserves caution and empirical proof from longer burn-in history

Right now the goal is:
- preserve Meridian's strong ReAct/runtime base
- keep Helix as its own sibling repo
- maintain the right architecture for Hyperliquid perps
- keep legacy LP/Meteora code quarantined from the active runtime path
- iterate safely from supervised modes into cautious tiny-size autonomous live use
