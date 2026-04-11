import fs from "fs";

const BELIEF_FILE = "./runtime-data/learned-beliefs.json";

function loadBeliefs() {
  if (!fs.existsSync(BELIEF_FILE)) return { symbols: {} };
  try {
    return JSON.parse(fs.readFileSync(BELIEF_FILE, "utf8"));
  } catch {
    return { symbols: {} };
  }
}

function saveBeliefs(data) {
  fs.mkdirSync("./runtime-data", { recursive: true });
  fs.writeFileSync(BELIEF_FILE, JSON.stringify(data, null, 2));
}

export function updateBeliefsFromClosedTrade(trade) {
  const data = loadBeliefs();
  if (!data.symbols[trade.symbol]) {
    data.symbols[trade.symbol] = {
      wins: 0,
      losses: 0,
      totalClosed: 0,
      avgPnlPct: 0,
      lastOutcome: null,
    };
  }

  const bucket = data.symbols[trade.symbol];
  const pnl = Number(trade.realizedPnlPct || 0);
  bucket.totalClosed += 1;
  if (pnl > 0) bucket.wins += 1;
  if (pnl < 0) bucket.losses += 1;
  bucket.avgPnlPct = ((bucket.avgPnlPct * (bucket.totalClosed - 1)) + pnl) / bucket.totalClosed;
  bucket.lastOutcome = {
    realizedPnlPct: pnl,
    closedAt: trade.closedAt || new Date().toISOString(),
    side: trade.side,
  };

  saveBeliefs(data);
  return data;
}

export function getLearnedBeliefs() {
  return loadBeliefs();
}
