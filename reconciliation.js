import { getNormalizedAccountState } from "./account-state.js";
import { listRecentTrades, updateTradeExecutionState } from "./state.js";

export async function reconcileExecutionLeftovers(limit = 200) {
  const trades = listRecentTrades(limit);
  const account = await getNormalizedAccountState().catch(() => null);
  const positionsByCoin = new Map((account?.positions || []).map((position) => [position.coin, position]));
  const updates = [];

  for (const trade of trades) {
    const position = positionsByCoin.get(trade.symbol) || null;
    const remainingReduceSize = trade.executionState?.remainingReduceSize;
    const remainingCloseSize = trade.executionState?.remainingCloseSize;

    const patch = {};

    if (remainingReduceSize != null) {
      patch.reconciledRemainingReduceSize = position ? Math.min(Math.abs(Number(position.szi || 0)), remainingReduceSize) : 0;
    }

    if (remainingCloseSize != null) {
      patch.reconciledRemainingCloseSize = position ? Math.abs(Number(position.szi || 0)) : 0;
    }

    if (Object.keys(patch).length) {
      updateTradeExecutionState(trade.tradeId, patch);
      updates.push({ tradeId: trade.tradeId, symbol: trade.symbol, patch });
    }
  }

  return {
    account,
    updates,
  };
}
