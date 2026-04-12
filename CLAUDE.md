# Helix — CLAUDE.md

Autonomous Hyperliquid futures trading agent, currently in safety-first scaffold/hardening phase.

## Truth first

This repo is **not** a Meteora LP bot anymore.
It is a **Hyperliquid perp trading system scaffold** with:
- market/account observation
- LLM planning
- paper/approval/live execution seams
- journaling
- replay / reconciliation logic
- operator safety controls
- learning/profile summaries

It is still **mid-transition** and should be described that way.

## Current architecture

Core files:
- `index.js` — cron + REPL entrypoint
- `agent.js` — tool-using LLM loop
- `config.js` — runtime config
- `prompt.js` — system prompts by role
- `execution.js` — open/reduce/close execution seam
- `state.js` — local trade lifecycle store
- `sync.js` — exchange sync into local state
- `reconciliation.js` — drift detection and light lifecycle repair
- `operator-controls.js` — halt, close-only, symbol suspension
- `health-summary.js` — operator-facing health summary
- `go-live-check.js` — cautious autonomy readiness check
- `performance-profile.js` — closed-trade performance summary
- `daily-report.js` — yesterday learning report
- `tools/hyperliquid.js` — Hyperliquid data access
- `tools/executor.js` — tool dispatch layer
- `tools/definitions.js` — tool schema surface

## What is actually true today

Usable now:
- market context fetch
- account state fetch
- setup ranking
- trade proposal generation
- paper / approval workflow
- operator control gates
- pending intent expiry
- exchange sync
- reconciliation drift detection
- light lifecycle repair
- health summary and go-live summary

Still not mature enough to oversell:
- deep strategy logic
- full production-grade autonomous execution
- complete exchange-truth lifecycle repair in every edge case
- broad unattended live trading confidence

## Guidance

When editing this repo:
- prefer exchange truth over local assumptions
- treat safety controls as first-class
- do not describe paper scaffolding as battle-tested autonomy
- keep docs aligned with real implementation state
- add tests for every safety or lifecycle change
