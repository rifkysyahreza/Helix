import { buildBurnInRunbookStatus } from "./burn-in-runbook.js";

export async function buildFirstPaperBurnInPlan() {
  const runbook = await buildBurnInRunbookStatus().catch(() => null);

  return {
    stage: "paper",
    objective: "Validate that Helix behaves coherently in paper mode under live observation.",
    requiredMode: "HELIX_EXECUTION_MODE=paper",
    commands: ["/status", "/health", "/watch", "/manage", "/maintain", "/burn-in runbook"],
    watchItems: [
      "plausible setup ranking",
      "coherent management suggestions",
      "healthy stream state",
      "no unexplained incidents or drift",
      "understandable safety or regime throttles",
    ],
    passCriteria: [
      "no severe incidents",
      "no execution errors",
      "no stream failures",
      "no obviously incoherent proposals",
      "runtime remains stable",
    ],
    failCriteria: [
      "material stream degradation",
      "unexplained reconciliation drift",
      "nonsensical proposals or management actions",
      "unstable startup or recovery behavior",
      "untrustworthy safety behavior",
    ],
    runbook,
  };
}
