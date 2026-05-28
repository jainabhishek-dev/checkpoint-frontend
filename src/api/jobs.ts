import client from "./client";

export async function startReviewJob(payload: {
  drive_url: string;
  workflow_id: string;
  checkpoint_ids: string[];
}) {
  const { data } = await client.post<{ job_id: string; title: string }>("/api/check", payload);
  return data;
}

export async function startCicJob(payload: {
  workflow_id: string;
  commented_url: string;
  revised_url: string;
}) {
  const { data } = await client.post<{
    job_id: string;
    commented_title: string;
    revised_title: string;
    total_comments: number;
  }>("/api/cic-check", payload);
  return data;
}

export async function retryJob(job_id: string) {
  const { data } = await client.post<{ job_id: string; retry_from: number }>(
    `/api/retry-check/${job_id}`
  );
  return data;
}

export async function insertComments(job_id: string, finding_ids: number[]) {
  const { data } = await client.post<{ posted: number; total_selected: number }>(
    `/api/insert-comments/${job_id}`,
    { finding_ids }
  );
  return data;
}

export function getStreamUrl(job_id: string, retry_from?: number): string {
  const base = import.meta.env.VITE_API_URL ?? "";
  const q = retry_from ? `?retry_from=${retry_from}` : "";
  return `${base}/stream/${job_id}${q}`;
}

export function getCicStreamUrl(job_id: string): string {
  const base = import.meta.env.VITE_API_URL ?? "";
  return `${base}/cic-stream/${job_id}`;
}
