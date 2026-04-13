import { getRuntimeResilienceState, evaluateRuntimeWatchdog } from "./runtime-resilience.js";
import { reconcileExecutionLeftovers } from "./reconciliation.js";
import { runAutonomousManagementPass } from "./autonomous-manager.js";
import { recordExecutionIncident } from "./execution-incidents.js";

export async function runStartupRecovery({ autoAct = true, limit = 200 } = {}) {
  const runtime = getRuntimeResilienceState();
  const watchdog = evaluateRuntimeWatchdog({ staleMs: 60 * 60 * 1000 });
  const needsRecovery = Boolean(runtime.dirtyRestartDetected || watchdog.stale);

  if (!needsRecovery) {
    return {
      recovered: false,
      reason: "runtime_clean",
      runtime,
      watchdog,
    };
  }

  const reconciliation = await reconcileExecutionLeftovers(limit).catch((error) => ({ error: error.message }));
  const management = await runAutonomousManagementPass({ autoAct }).catch((error) => ({ error: error.message }));

  recordExecutionIncident({
    kind: "startup_recovery_run",
    dirtyRestartDetected: Boolean(runtime.dirtyRestartDetected),
    watchdogStale: Boolean(watchdog.stale),
  });

  return {
    recovered: true,
    runtime,
    watchdog,
    reconciliation,
    management,
  };
}
