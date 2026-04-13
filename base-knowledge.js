export function buildPerpBaseKnowledge() {
  return {
    marketStructure: {
      purpose: "Classify whether price is trending, balancing, breaking, or reversing.",
      concepts: [
        "trend continuation: higher highs and higher lows for longs, lower highs and lower lows for shorts",
        "range/balance: repeated rejection around value extremes with acceptance near fair value",
        "break of structure: meaningful loss of prior swing control, not just a tiny wick through a level",
        "sweep and reclaim: liquidity taken beyond a prior high/low and then reclaimed back inside the prior structure",
        "acceptance vs rejection: acceptance means time and volume holding beyond a level, rejection means fast failure back through it",
      ],
    },
    volatility: {
      purpose: "Judge whether conditions support expansion trades, mean reversion, or caution.",
      concepts: [
        "ATR expansion supports momentum continuation only when structure and volume agree",
        "volatility compression often precedes expansion but does not tell direction by itself",
        "large wicks with poor closes often signal failed auction behavior and lower conviction",
        "range expansion after compression matters more when accompanied by volume and order-book follow-through",
      ],
    },
    vwapAndValue: {
      purpose: "Anchor price relative to fair value and identify where trade location is good or bad.",
      concepts: [
        "VWAP above price can act as dynamic overhead in weak conditions, below price can support trend continuation",
        "session VWAP helps frame intraday control and fair value",
        "anchored VWAP is useful after major events, session starts, or structural pivots",
        "value area high/value area low frame acceptance and rejection around fair value",
        "point of control identifies the price where trade concentrated most heavily",
      ],
    },
    volumeProfile: {
      purpose: "Map where the market considers price fair or unfair.",
      concepts: [
        "HVN means high-volume acceptance, often sticky and mean-reverting unless broken with conviction",
        "LVN means low-volume rejection zone, often traversed quickly once entered",
        "trades initiated far from value need strong trend/momentum confirmation or they become poor location",
        "a breakout through value is better when price accepts outside value rather than immediately rotating back in",
      ],
    },
    perpContext: {
      purpose: "Interpret derivatives positioning pressure and crowdedness.",
      concepts: [
        "rising OI with price up can support trend continuation, but if funding gets too stretched it may indicate crowding",
        "price up with falling OI often means short covering rather than clean new participation",
        "price down with rising OI can confirm aggressive short pressure, but also raises squeeze risk if extension gets crowded",
        "extreme positive funding can make fresh longs worse location unless structure is very strong",
        "premium/discount to oracle or fair price can hint at excess enthusiasm or stress",
      ],
    },
    orderFlowAndLiquidity: {
      purpose: "Judge execution quality and whether moves are being accepted or absorbed.",
      concepts: [
        "bid/ask imbalance helps judge immediate book pressure, but should not be trusted alone",
        "thin books and wide spreads reduce IOC quality and increase slippage risk",
        "absorption means aggressive market orders fail to move price meaningfully despite repeated attempts",
        "sweeps through liquidity that instantly fail back are often traps, not real continuation",
        "resting liquidity cliffs can act as magnets or barriers depending on whether they hold or get consumed",
      ],
    },
    executionPrinciples: {
      purpose: "Keep trade ideas tied to realistic execution behavior.",
      concepts: [
        "good idea plus bad liquidity can still be a bad trade",
        "IOC execution is worse in chop, thin books, and fake breakouts",
        "if execution reliability is degrading, Helix should demand cleaner location or do nothing",
        "invalidation should come from structure and context, not arbitrary hope distance",
        "no-trade is a valid outcome when location, structure, and derivatives context disagree",
      ],
    },
    synthesisRules: [
      "Prefer trades where structure, volatility, value location, perp context, and execution conditions align.",
      "Fade setups need clear exhaustion, rejection, or failed auction evidence, not just overextension feelings.",
      "Breakout setups need acceptance, not just first touch beyond a level.",
      "If perp context is crowded and execution conditions are poor, reduce confidence or skip.",
      "If price is in the middle of value with weak momentum and mixed perp context, default to patience.",
    ],
  };
}

export function summarizePerpBaseKnowledge() {
  const knowledge = buildPerpBaseKnowledge();
  return [
    "Perp analysis framework:",
    ...Object.entries(knowledge)
      .filter(([, value]) => value?.concepts)
      .map(([key, value]) => `- ${key}: ${value.purpose}`),
    "Synthesis:",
    ...knowledge.synthesisRules.map((rule) => `- ${rule}`),
  ].join("\n");
}
