import client from "./client";

export async function startReviewJob(payload: {
  drive_url: string;
  workflow_id: string;
  checkpoint_ids: string[];
  custom_page_prompt?: string;
  custom_doc_prompt?: string;
}) {
  const { data } = await client.post<{ job_id: string; title: string }>("/api/check", payload);
  return data;
}

export async function previewPrompt(workflow_id: string, checkpoint_ids: string[]) {
  const { data } = await client.post<{ page_prompt: string; doc_prompt: string }>(
    "/api/preview-prompt",
    { workflow_id, checkpoint_ids }
  );
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

export function getStreamUrl(job_id: string): string {
  // The backend replays whatever's already saved for this run (including a
  // prior partial run) before live-tailing, so no query param is needed here.
  const base = import.meta.env.VITE_API_URL ?? "";
  return `${base}/stream/${job_id}`;
}

export function getCicStreamUrl(job_id: string): string {
  const base = import.meta.env.VITE_API_URL ?? "";
  return `${base}/cic-stream/${job_id}`;
}

export async function getAkDefaultPrompt(): Promise<string> {
  const { data } = await client.get<{ prompt: string }>("/api/ak-default-prompt");
  return data.prompt;
}

export async function startAkJob(payload: {
  workflow_id: string;
  chapter_url: string;
  ak_url: string;
  custom_prompt?: string;
}) {
  const { data } = await client.post<{
    job_id: string;
    chapter_title: string;
    ak_title: string;
  }>("/api/ak-check", payload);
  return data;
}

export function getAkStreamUrl(job_id: string): string {
  const base = import.meta.env.VITE_API_URL ?? "";
  return `${base}/api/ak-stream/${job_id}`;
}
