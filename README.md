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

This repo is an **initial scaffold**.

The reusable Meridian foundation is already carried over for:
- runtime abstraction
- journaling and lessons plumbing
- agent loop structure
- config loading
- logging
- OpenClaw runtime support
- dry-run execution flow

The Hyperliquid-specific strategy and execution surfaces are being adapted next.

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

Not full autonomous live trading on day one.

---

## Runtime

Helix keeps Meridian's runtime support, including:
- OpenAI-compatible providers
- OpenClaw local bridge
- OpenClaw Codex login path

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
