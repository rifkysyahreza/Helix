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

This repo is now an **early working scaffold**.

Already wired:
- runtime abstraction
- OpenClaw / Codex bridge support
- ReAct-style agent loop
- Hyperliquid market context fetch
- Hyperliquid account state fetch
- basic setup ranking heuristic
- journal note persistence
- dry-run execution posture

Still to build next:
- real order placement and close flows
- richer market structure logic
- post-trade analytics and evolution logic specific to futures
- deeper cleanup of inherited Meridian surfaces

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

### To be replaced/adapted for Hyperliquid
- Solana / DLMM tools
- pool-specific prompts
- LP management heuristics
- wallet token swap flows

---

## First build target

Helix v0 should support:
1. read Hyperliquid market state
2. inspect current account positions/orders
3. rank candidate futures setups
4. produce structured trade plans in dry run
5. journal trade decisions and outcomes
6. learn from post-trade review

Current v0 status:
- steps 1 to 5 are now partially wired
- step 6 still needs deeper futures-specific synthesis
- live execution is intentionally not finished yet

---

## Runtime

Helix keeps Meridian's runtime support, including:
- OpenAI-compatible providers
- OpenClaw local bridge
- OpenClaw Codex login path

## Safer autonomy architecture

For a truly autonomous futures agent, I recommend using a **restricted execution wallet / agent wallet** instead of your main full-permission wallet.

Best-practice direction for Helix:
- strategist agent decides what to do
- restricted execution wallet performs allowed trade actions
- wallet should not have broad withdrawal powers
- limits should exist at both agent layer and wallet layer
- start in dry-run, then paper execution, then restricted live execution

That is the right shape for self-improving autonomy without handing the agent a totally unconstrained hot wallet.

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

---

## Important note

This scaffold is intentionally not pretending the Hyperliquid execution layer is finished yet.

Right now the goal is:
- preserve Meridian's strong base
- separate Helix as its own sibling repo
- create the right architecture for futures
- iterate safely from dry-run to real execution
