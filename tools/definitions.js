export const tools = [
  {
    type: "function",
    function: {
      name: "get_market_context",
      description: "Fetch current Hyperliquid market context for one or more symbols, including price, funding, open interest, volume, and recent directional structure. Use when screening or validating a futures setup.",
      parameters: {
        type: "object",
        properties: {
          symbols: {
            type: "array",
            items: { type: "string" },
            description: "List of market symbols like BTC, ETH, SOL."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_account_state",
      description: "Return current Helix account state, including dry-run status, open positions, open orders, and key risk limits.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "rank_trade_setups",
      description: "Rank candidate Hyperliquid futures setups using current config and market context. Returns long, short, or skip candidates with rationale fields.",
      parameters: {
        type: "object",
        properties: {
          symbols: {
            type: "array",
            items: { type: "string" },
            description: "Optional symbols to evaluate. If omitted, use configured/default watchlist."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "propose_trade",
      description: "Create a structured trade plan for a single symbol, including side, thesis, invalidation, take profit, stop loss, and size suggestion. Does not place an order.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string" },
          side: { type: "string", enum: ["long", "short"] }
        },
        required: ["symbol", "side"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "place_order",
      description: "Create a dry-run or live-ready order record for a futures trade plan. In current Helix phase this persists the execution intent and updates trade lifecycle state.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string" },
          side: { type: "string", enum: ["long", "short"] },
          sizeUsd: { type: "number" },
          thesis: { type: "string" },
          stopLossPct: { type: "number" },
          takeProfitPct: { type: "number" }
        },
        required: ["symbol", "side"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "reduce_position",
      description: "Reduce an existing tracked Helix trade by percentage in dry run and persist that lifecycle change.",
      parameters: {
        type: "object",
        properties: {
          tradeId: { type: "string" },
          reducePct: { type: "number" },
          reason: { type: "string" }
        },
        required: ["tradeId", "reducePct"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "close_position",
      description: "Close an existing tracked Helix trade in dry run and persist the lifecycle result.",
      parameters: {
        type: "object",
        properties: {
          tradeId: { type: "string" },
          reason: { type: "string" },
          exitPrice: { type: "number" },
          realizedPnlPct: { type: "number" }
        },
        required: ["tradeId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_open_positions",
      description: "Evaluate current normalized live positions and suggest or execute hold/reduce/close actions depending on execution mode and current account state.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "sync_exchange_state",
      description: "Sync Helix trade records against real Hyperliquid exchange/account state using SDK info methods like openOrders and userFills.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "How many recent trades to sync. Default 50."
          }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_pending_intents",
      description: "List manager-generated pending action intents waiting for approval or rejection.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "resolve_pending_intent",
      description: "Approve or reject a pending manager-generated action intent by id.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string" },
          decision: { type: "string", enum: ["approved", "rejected"] }
        },
        required: ["id", "decision"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "build_yesterday_report",
      description: "Build a learning report from positions closed yesterday, including pnl outcomes and adaptive summary lines.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "journal_trade_note",
      description: "Write a structured trade or review note into Helix memory for journaling and later self-review.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          tags: {
            type: "array",
            items: { type: "string" }
          }
        },
        required: ["title", "body"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "review_recent_journal",
      description: "Review recent Helix journal notes and tracked trade lifecycle records, then summarize recurring lessons, mistakes, strengths, or rule adjustments.",
      parameters: {
        type: "object",
        properties: {
          limit: {
            type: "number",
            description: "How many recent notes to review. Default 10."
          }
        }
      }
    }
  }
];
