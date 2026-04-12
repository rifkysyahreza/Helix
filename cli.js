#!/usr/bin/env node
import "dotenv/config";
import { parseArgs } from "util";
import os from "os";
import fs from "fs";
import path from "path";

if (process.argv.includes("--dry-run")) process.env.DRY_RUN = "true";

const helixDir = path.join(os.homedir(), ".helix");
const helixEnv = path.join(helixDir, ".env");
if (fs.existsSync(helixEnv)) {
  const { config: loadDotenv } = await import("dotenv");
  loadDotenv({ path: helixEnv, override: false });
}

function out(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

function die(msg, extra = {}) {
  process.stderr.write(JSON.stringify({ error: msg, ...extra }) + "\n");
  process.exit(1);
}

const SKILL_MD = `# helix — Hyperliquid futures trading agent CLI

Data dir: ~/.helix/

## Commands

### helix account
Returns normalized Hyperliquid account state.

### helix market [--symbols BTC,ETH,SOL]
Returns current market context for one or more symbols.

### helix rank [--symbols BTC,ETH,SOL]
Ranks current futures setups.

### helix propose --symbol BTC --side long|short
Builds a structured trade proposal.

### helix place --symbol BTC --side long|short [--size-usd 25]
Places or records a trade through the current execution mode.

### helix reduce --trade-id <id> --reduce-pct 50 [--reason text]
Reduces an open tracked trade.

### helix close --trade-id <id> [--reason text] [--exit-price 100000] [--realized-pnl-pct 2.5]
Closes an open tracked trade.

### helix manage
Runs open-position management logic.

### helix sync [--limit 50]
Syncs tracked trades with exchange state.

### helix pending
Lists pending intents.

### helix resolve --id <intent-id> --decision approved|rejected
Resolves a pending intent.

### helix controls
Returns operator controls.

### helix halt [--reason text]
Activates global halt.

### helix resume
Clears global halt.

### helix close-only --enabled true|false [--reason text]
Toggles close-only mode.

### helix suspend --symbol BTC [--reason text]
Suspends a symbol from new opening actions.

### helix unsuspend --symbol BTC
Removes symbol suspension.

### helix health [--limit 100]
Builds operator-facing health summary.

### helix go-live
Builds go-live readiness summary.

### helix report
Builds yesterday learning report.

### helix journal --title <text> --body <text> [--tags a,b,c]
Writes a journal note.

### helix review [--limit 10]
Reviews recent journal + trade activity.

### helix operator-knowledge
Returns operator knowledge.

## Flags
--dry-run     Skip live actions when supported
`;

fs.mkdirSync(helixDir, { recursive: true });
fs.writeFileSync(path.join(helixDir, "SKILL.md"), SKILL_MD);

const argv = process.argv.slice(2);
const subcommand = argv.find((a) => !a.startsWith("-"));
if (!subcommand || subcommand === "help" || argv.includes("--help")) {
  process.stdout.write(SKILL_MD);
  process.exit(0);
}

const { values: flags } = parseArgs({
  args: argv,
  options: {
    symbol: { type: "string" },
    symbols: { type: "string" },
    side: { type: "string" },
    "size-usd": { type: "string" },
    "trade-id": { type: "string" },
    "reduce-pct": { type: "string" },
    reason: { type: "string" },
    id: { type: "string" },
    decision: { type: "string" },
    enabled: { type: "string" },
    title: { type: "string" },
    body: { type: "string" },
    tags: { type: "string" },
    limit: { type: "string" },
    "exit-price": { type: "string" },
    "realized-pnl-pct": { type: "string" },
    "stop-loss-pct": { type: "string" },
    "take-profit-pct": { type: "string" },
    leverage: { type: "string" },
    "dry-run": { type: "boolean" },
  },
  allowPositionals: true,
  strict: false,
});

const { executeTool } = await import("./tools/executor.js");

function parseSymbols(raw) {
  return raw ? raw.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean) : undefined;
}

switch (subcommand) {
  case "account":
    out(await executeTool("list_account_state", {}));
    break;
  case "market":
    out(await executeTool("get_market_context", { symbols: parseSymbols(flags.symbols) }));
    break;
  case "rank":
    out(await executeTool("rank_trade_setups", { symbols: parseSymbols(flags.symbols) }));
    break;
  case "propose":
    if (!flags.symbol || !flags.side) die("Usage: helix propose --symbol BTC --side long|short");
    out(await executeTool("propose_trade", { symbol: flags.symbol.toUpperCase(), side: flags.side }));
    break;
  case "place":
    if (!flags.symbol || !flags.side) die("Usage: helix place --symbol BTC --side long|short [--size-usd 25]");
    out(await executeTool("place_order", {
      symbol: flags.symbol.toUpperCase(),
      side: flags.side,
      sizeUsd: flags["size-usd"] ? parseFloat(flags["size-usd"]) : undefined,
      stopLossPct: flags["stop-loss-pct"] ? parseFloat(flags["stop-loss-pct"]) : undefined,
      takeProfitPct: flags["take-profit-pct"] ? parseFloat(flags["take-profit-pct"]) : undefined,
      leverage: flags.leverage ? parseFloat(flags.leverage) : undefined,
    }));
    break;
  case "reduce":
    if (!flags["trade-id"] || !flags["reduce-pct"]) die("Usage: helix reduce --trade-id <id> --reduce-pct 50 [--reason text]");
    out(await executeTool("reduce_position", {
      tradeId: flags["trade-id"],
      reducePct: parseFloat(flags["reduce-pct"]),
      reason: flags.reason,
    }));
    break;
  case "close":
    if (!flags["trade-id"]) die("Usage: helix close --trade-id <id> [--reason text]");
    out(await executeTool("close_position", {
      tradeId: flags["trade-id"],
      reason: flags.reason,
      exitPrice: flags["exit-price"] ? parseFloat(flags["exit-price"]) : undefined,
      realizedPnlPct: flags["realized-pnl-pct"] ? parseFloat(flags["realized-pnl-pct"]) : undefined,
    }));
    break;
  case "manage":
    out(await executeTool("manage_open_positions", {}));
    break;
  case "sync":
    out(await executeTool("sync_exchange_state", { limit: flags.limit ? parseInt(flags.limit, 10) : undefined }));
    break;
  case "pending":
    out(await executeTool("list_pending_intents", {}));
    break;
  case "resolve":
    if (!flags.id || !flags.decision) die("Usage: helix resolve --id <intent-id> --decision approved|rejected");
    out(await executeTool("resolve_pending_intent", { id: flags.id, decision: flags.decision }));
    break;
  case "controls":
    out(await executeTool("get_operator_controls", {}));
    break;
  case "halt":
    out(await executeTool("halt_trading", { reason: flags.reason }));
    break;
  case "resume":
    out(await executeTool("resume_trading", {}));
    break;
  case "close-only":
    out(await executeTool("set_close_only_mode", {
      enabled: flags.enabled == null ? true : flags.enabled === "true",
      reason: flags.reason,
    }));
    break;
  case "suspend":
    if (!flags.symbol) die("Usage: helix suspend --symbol BTC [--reason text]");
    out(await executeTool("suspend_symbol", { symbol: flags.symbol.toUpperCase(), reason: flags.reason }));
    break;
  case "unsuspend":
    if (!flags.symbol) die("Usage: helix unsuspend --symbol BTC");
    out(await executeTool("unsuspend_symbol", { symbol: flags.symbol.toUpperCase() }));
    break;
  case "health":
    out(await executeTool("build_health_summary", { limit: flags.limit ? parseInt(flags.limit, 10) : undefined }));
    break;
  case "go-live":
    out(await executeTool("build_go_live_check", {}));
    break;
  case "report":
    out(await executeTool("build_yesterday_report", {}));
    break;
  case "journal":
    if (!flags.title || !flags.body) die("Usage: helix journal --title <text> --body <text> [--tags a,b,c]");
    out(await executeTool("journal_trade_note", {
      title: flags.title,
      body: flags.body,
      tags: flags.tags ? flags.tags.split(",").map((tag) => tag.trim()).filter(Boolean) : [],
    }));
    break;
  case "review":
    out(await executeTool("review_recent_journal", { limit: flags.limit ? parseInt(flags.limit, 10) : undefined }));
    break;
  case "operator-knowledge":
    out(await executeTool("get_operator_knowledge", {}));
    break;
  default:
    die(`Unknown command: ${subcommand}. Run 'helix help' for usage.`);
}
