import { getNormalizedAccountState } from "./account-state.js";
import { openPerpPosition, closePerpPosition, reducePerpPosition } from "./execution.js";
import { listRecentTrades } from "./state.js";

function findOpenTradeBySymbol(symbol) {
  return listRecentTrades(500).find((trade) => trade.symbol === symbol && trade.status === "open") || null;
}

export async function replayApprovedIntent(intent) {
  if (!intent?.intent?.type) {
    return { success: false, error: "Missing executable intent payload." };
  }

  const account = await getNormalizedAccountState().catch(() => null);
  const livePosition = account?.positions?.find((position) => position.coin === intent.intent.symbol) || null;

  if (intent.intent.type === "reduce_position") {
    return await reducePerpPosition({
      symbol: intent.intent.symbol,
      side: intent.intent.side,
      reducePct: intent.intent.reducePct,
      size: intent.intent.size,
      livePosition,
    });
  }

  if (intent.intent.type === "close_position") {
    const trade = findOpenTradeBySymbol(intent.intent.symbol);
    if (!trade) {
      return { success: false, error: `No open tracked trade found for ${intent.intent.symbol}.` };
    }
    return await closePerpPosition({ trade, livePosition });
  }

  if (intent.intent.type === "open_position") {
    return await openPerpPosition(intent.intent);
  }

  return { success: false, error: `Unsupported intent type: ${intent.intent.type}` };
}
