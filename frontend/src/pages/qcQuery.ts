// File overview: Page component and UI logic for pages/qcQuery.ts.
import api from "../api/client";

export const QC_QUEUE_KEY = ["qc", "queue"] as const;

// Fetches data for qc queue from the API.
export async function fetchQcQueue() {
  const { data } = await api.get("/qc/queue");
  return data;
}

// Inputs: caller state/arguments related to qc tests key.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export const qcTestsKey = (batchId: string) => ["qc", "tests", batchId] as const;

// Fetches data for qc tests from the API.
export async function fetchQcTests(batchId: string) {
  const { data } = await api.get("/qc/tests", { params: { batch_id: batchId } });
  return data ?? [];
}

// Inputs: caller state/arguments related to qc mix stats key.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export const qcMixStatsKey = (mixId: number) => ["qc", "mix-stats", mixId] as const;

// Fetches data for qc mix stats from the API.
export async function fetchQcMixStats(mixId: number) {
  const { data } = await api.get(`/qc/mix-stats/${mixId}`);
  return data;
}

// Inputs: caller state/arguments related to qc project results key.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export const qcProjectResultsKey = (projectId: number) => ["qc", "results", projectId] as const;

// Fetches data for qc project results from the API.
export async function fetchQcProjectResults(projectId?: number) {
  const { data } = await api.get("/qc/results", { params: projectId != null ? { project_id: projectId } : undefined });
  return data ?? [];
}

export type QcBatchStatusMap = Record<
  string,
  {
    passed: boolean | null;
    age_days?: number | null;
    ages?: Record<string, boolean | null>;
    cut_allowed?: boolean;
  }
>;

// Inputs: caller state/arguments related to qc batch status key.
// Process: applies business rules and transformations for this step.
// Output: deterministic value/state used by the next workflow stage.
export const qcBatchStatusKey = (batchIdsCsv: string) => ["qc", "status", batchIdsCsv] as const;

// Fetches data for qc batch status from the API.
export async function fetchQcBatchStatus(batchIdsCsv: string): Promise<QcBatchStatusMap> {
  if (!batchIdsCsv) return {};
  const { data } = await api.get<QcBatchStatusMap>("/qc/status", {
    params: { batch_ids: batchIdsCsv },
  });
  return data ?? {};
}
