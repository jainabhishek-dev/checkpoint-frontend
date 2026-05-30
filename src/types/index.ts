// ── Core domain types ──────────────────────────────────────────────────────────

export interface User {
  email: string;
  name: string;
  picture: string;
}

export interface AuthState {
  user: User;
  is_admin: boolean;
  is_super_admin: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  type: "review" | "cic";
  sort_order: number;
  created_by: string;
}

export interface Checkpoint {
  id: string;
  category: string;
  instructions: string;
  type: "rule" | "judgment";
  scope: "page" | "document";
  workflows: string[];
  sort_order: number;
}

export interface Finding {
  id: number;
  page_num: number | null;
  checkpoint_id: string;
  quote: string;
  location: string;
  issue: string;
  suggestion: string;
  review_status?: "valid" | "invalid";
  review_comment?: string;
}

export interface Run {
  id: string;
  workflow_id: string;
  workflow_name: string;
  checked_by: string;
  document_name: string;
  drive_url: string;
  file_type: string;
  drive_folder_id: string | null;
  checkpoint_ids: string[];
  total_pages: number;
  total_findings: number;
  valid_findings: number;
  invalid_findings: number;
  created_at: string;
}

export interface CicRun {
  id: string;
  workflow_id: string;
  workflow_name: string;
  checked_by: string;
  commented_file_name: string;
  commented_drive_url: string;
  revised_file_name: string;
  revised_drive_url: string;
  drive_folder_id: string | null;
  total_pages: number;
  total_comments: number;
  fixed_count: number;
  not_fixed_count: number;
  not_sure_count: number;
  created_at: string;
}

export interface CicComment {
  id: string;
  run_id: string;
  comment_id: string;
  author: string;
  content: string;
  verdict: "fixed" | "not_fixed" | "not_sure";
  reason: string;
  page_resolved: number | null;
  original_page: number | null;
}

export interface Admin {
  email: string;
  added_by: string;
}

// ── SSE event payloads ─────────────────────────────────────────────────────────

export interface SSEStart {
  total_pages: number;
  title: string;
}

export interface SSEPageFindings {
  page: number;
  findings: Finding[];
}

export interface SSEPageReview {
  page: number;
  reviews: Array<{ finding_id: number; verdict: "valid" | "invalid"; reason: string }>;
}

export interface SSEDocumentFindings {
  findings: Finding[];
}

export interface SSEDocumentReview {
  reviews: Array<{ finding_id: number; verdict: "valid" | "invalid"; reason: string }>;
}

export interface SSEAllDone {
  total_findings: number;
}

export interface SSEPartialComplete {
  last_successful_page: number;
  total_pages: number;
  error_message: string;
}

export interface CicSSEPage {
  page_num: number;
  total_pages: number;
  verdicts: Array<{
    comment_id: string;
    content: string;
    verdict: "fixed" | "not_fixed" | "not_sure";
    reason: string;
  }>;
  comment_count: number;
}

export interface CicSSEDone {
  run_id: string;
  total_comments: number;
  fixed: number;
  not_fixed: number;
  not_sure: number;
}
