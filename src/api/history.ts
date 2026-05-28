import client from "./client";
import type { Run, CicRun, CicComment, Finding } from "../types";

export async function getHistory(tab: "review" | "cic" = "review", workflow?: string) {
  const { data } = await client.get<{
    runs: Run[];
    cic_runs: CicRun[];
    active_tab: string;
    review_workflows: { id: string; name: string }[];
    cic_workflows: { id: string; name: string }[];
  }>("/api/history", { params: { tab, workflow } });
  return data;
}

export async function getRun(run_id: string) {
  const { data } = await client.get<{
    run: Run;
    page_findings: Record<string, Finding[]>;
    doc_findings: Finding[];
    checkpoint_map: Record<string, string>;
    page_image_map: Record<string, string>;
    total_pages: number;
  }>(`/api/history/${run_id}`);
  return data;
}

export async function getCicRun(run_id: string) {
  const { data } = await client.get<{
    run: CicRun;
    total_pages: number;
    f1_image_map: Record<string, string>;
    f2_image_map: Record<string, string>;
    page_comments_map: Record<string, CicComment[]>;
    global_comments: CicComment[];
    needs_images: boolean;
  }>(`/api/history/cic/${run_id}`);
  return data;
}

export async function getCicRunPages(run_id: string) {
  const { data } = await client.get<{
    pages: Array<{ page_num: number; file_version: string; drive_file_id: string }>;
  }>(`/api/history/cic/${run_id}/pages`);
  return data;
}

export async function updateFindingReview(
  finding_id: string,
  review_status: "valid" | "invalid",
  review_comment: string
) {
  const { data } = await client.post(`/api/findings/${finding_id}/review`, {
    review_status,
    review_comment,
  });
  return data;
}

export async function adminGetAdmins() {
  const { data } = await client.get<{ admins: { email: string; added_by: string }[] }>(
    "/api/admin/admins"
  );
  return data;
}

export async function adminAddAdmin(email: string) {
  const { data } = await client.post("/api/admin/admins/add", { email });
  return data;
}

export async function adminDeleteAdmin(email: string) {
  const { data } = await client.post(`/api/admin/admins/${email}/delete`);
  return data;
}
