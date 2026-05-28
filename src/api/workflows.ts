import client from "./client";
import type { Workflow, Checkpoint } from "../types";

export async function getWorkflows() {
  const { data } = await client.get<{
    workflows: Workflow[];
    review_workflows: Workflow[];
    cic_workflows: Workflow[];
  }>("/api/workflows");
  return data;
}

export async function getCheckpoints(workflow_id: string) {
  const { data } = await client.get<{
    checkpoints: Checkpoint[];
    categories: Record<string, Checkpoint[]>;
  }>("/api/checkpoints", { params: { workflow_id } });
  return data;
}

// ── Admin CRUD ─────────────────────────────────────────────────────────────────

export async function adminGetWorkflows() {
  const { data } = await client.get<{
    workflows: Workflow[];
    checkpoint_counts: Record<string, number>;
  }>("/api/admin/workflows");
  return data;
}

export async function adminAddWorkflow(payload: {
  name: string;
  description: string;
  type: string;
  action: string;
  ai_notes: string;
}) {
  const { data } = await client.post("/api/admin/workflows/add", payload);
  return data;
}

export async function adminEditWorkflow(wf_id: string, payload: { name: string; description: string }) {
  const { data } = await client.post(`/api/admin/workflows/${wf_id}/edit`, payload);
  return data;
}

export async function adminDeleteWorkflow(wf_id: string) {
  const { data } = await client.post(`/api/admin/workflows/${wf_id}/delete`);
  return data;
}

// ── Admin checkpoints ──────────────────────────────────────────────────────────

export async function adminAddCheckpoint(payload: {
  category: string;
  instructions: string;
  type: string;
  scope: string;
  workflows: string[];
}) {
  const { data } = await client.post("/api/admin/checkpoints/add", payload);
  return data;
}

export async function adminEditCheckpoint(
  cp_id: string,
  payload: { instructions: string; type: string; scope: string; workflows: string[] }
) {
  const { data } = await client.post(`/api/admin/checkpoints/${cp_id}/edit`, payload);
  return data;
}

export async function adminDeleteCheckpoint(cp_id: string) {
  const { data } = await client.post(`/api/admin/checkpoints/${cp_id}/delete`);
  return data;
}
