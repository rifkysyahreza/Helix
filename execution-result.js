export function parseOrderStatuses(result) {
  const statuses = result?.response?.data?.statuses || result?.data?.statuses || [];
  return statuses.map((status) => {
    if (status.filled) {
      return {
        kind: "filled",
        oid: status.filled.oid || null,
        totalSz: status.filled.totalSz != null ? Number(status.filled.totalSz) : null,
        avgPx: status.filled.avgPx != null ? Number(status.filled.avgPx) : null,
        raw: status,
      };
    }
    if (status.resting) {
      return {
        kind: "resting",
        oid: status.resting.oid || null,
        raw: status,
      };
    }
    if (status.error) {
      return {
        kind: "error",
        error: status.error,
        raw: status,
      };
    }
    return {
      kind: "unknown",
      raw: status,
    };
  });
}

export function summarizeExecutionResult(result) {
  const statuses = parseOrderStatuses(result);
  const filled = statuses.filter((item) => item.kind === "filled");
  const resting = statuses.filter((item) => item.kind === "resting");
  const errors = statuses.filter((item) => item.kind === "error");
  const totalFilledSize = filled.reduce((sum, item) => sum + (item.totalSz || 0), 0);
  const avgFillPx = filled.length
    ? filled.reduce((sum, item) => sum + ((item.avgPx || 0) * (item.totalSz || 0)), 0) / Math.max(1, totalFilledSize)
    : null;
  const orderIds = Array.from(new Set(statuses.map((item) => item.oid).filter(Boolean)));

  let executionLabel = "unknown";
  const lowerErrors = errors.map((item) => String(item.error || "").toLowerCase());
  if (filled.length > 0 && (resting.length > 0 || errors.length > 0)) executionLabel = "partial_fill";
  else if (filled.length > 0) executionLabel = "filled";
  else if (resting.length > 0) executionLabel = "resting";
  else if (lowerErrors.some((msg) => msg.includes("could not immediately match") || msg.includes("ioccancel"))) executionLabel = "ioc_cancel";
  else if (errors.length > 0) executionLabel = "error";

  return {
    statuses,
    filledCount: filled.length,
    restingCount: resting.length,
    errorCount: errors.length,
    successLike: filled.length > 0 || resting.length > 0,
    hasErrors: errors.length > 0,
    errorMessages: errors.map((item) => item.error),
    totalFilledSize,
    avgFillPx,
    executionLabel,
    primaryOid: orderIds[0] || null,
    orderIds,
  };
}
