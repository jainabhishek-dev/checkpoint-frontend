import type { Run } from "../types";

// A "processing" run whose progress hasn't moved in this long almost certainly
// died with its background task (server restart/crash) rather than actually
// still running — Resume is what recovers it, so it should be flagged instead
// of showing "Processing" forever.
export const STALE_THRESHOLD_MS = 10 * 60 * 1000;

export function isRunStale(run: Run): boolean {
  return run.status === "processing" && Date.now() - new Date(run.updated_at).getTime() > STALE_THRESHOLD_MS;
}

export type RunProgressKind = "completed" | "failed" | "stale" | "processing";

export interface RunProgressInfo {
  kind: RunProgressKind;
  label: string;
}

export function runProgressInfo(run: Run): RunProgressInfo {
  if (run.status === "completed") {
    return { kind: "completed", label: "Completed" };
  }
  if (run.status === "failed") {
    return { kind: "failed", label: `Stopped at page ${run.last_successful_page ?? 0}` };
  }
  if (isRunStale(run)) {
    return { kind: "stale", label: `Stuck at page ${run.last_successful_page ?? 0}` };
  }
  return {
    kind: "processing",
    label: `Processing — page ${run.last_successful_page ?? 0}/${run.total_pages || "?"}`,
  };
}
