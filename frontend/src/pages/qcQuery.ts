import api from "../api/client";

export const QC_QUEUE_KEY = ["qc", "queue"] as const;

export async function fetchQcQueue() {
  const { data } = await api.get("/qc/queue");
  return data;
}

export const qcTestsKey = (batchId: string) => ["qc", "tests", batchId] as const;

export async function fetchQcTests(batchId: string) {
  const { data } = await api.get("/qc/tests", { params: { batch_id: batchId } });
  return data ?? [];
}

export const qcMixStatsKey = (mixId: number) => ["qc", "mix-stats", mixId] as const;

export async function fetchQcMixStats(mixId: number) {
  const { data } = await api.get(`/qc/mix-stats/${mixId}`);
  return data;
}

export const qcProjectResultsKey = (projectId: number) => ["qc", "results", projectId] as const;

export async function fetchQcProjectResults(projectId: number) {
  const { data } = await api.get("/qc/results", { params: { project_id: projectId } });
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

export const qcBatchStatusKey = (batchIdsCsv: string) => ["qc", "status", batchIdsCsv] as const;

export async function fetchQcBatchStatus(batchIdsCsv: string): Promise<QcBatchStatusMap> {
  if (!batchIdsCsv) return {};
  const { data } = await api.get<QcBatchStatusMap>("/qc/status", {
    params: { batch_ids: batchIdsCsv },
  });
  return data ?? {};
}
