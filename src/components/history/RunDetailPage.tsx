import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle2, XCircle, HelpCircle, FileText,
  ExternalLink, Loader2, ChevronDown, ChevronUp, Code2,
} from "lucide-react";
import { getRun, updateFindingReview } from "../../api/history";
import type { Finding } from "../../types";

export default function RunDetailPage() {
  const { run_id } = useParams<{ run_id: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["run", run_id],
    queryFn: () => getRun(run_id!),
    enabled: !!run_id,
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState />;

  const { run, page_findings, doc_findings, checkpoint_map, page_image_map, total_pages } = data;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Back */}
      <Link to="/history" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors">
        <ArrowLeft size={15} /> History
      </Link>

      {/* Run header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{run.document_name ?? "Untitled"}</h1>
            <p className="text-sm text-slate-500 mt-1">{run.workflow_name} · {run.checked_by}</p>
            <p className="text-xs text-slate-400 mt-0.5">{run.created_at?.slice(0, 16)}</p>
          </div>
          {run.drive_url && (
            <a href={run.drive_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium whitespace-nowrap">
              Open in Drive <ExternalLink size={13} />
            </a>
          )}
        </div>
        <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          <Stat label="Pages" value={run.total_pages} />
          <Stat label="Findings" value={run.total_findings} />
          <Stat label="Valid" value={run.valid_findings} color="green" />
          <Stat label="Invalid" value={run.invalid_findings} color="red" />
        </div>
      </div>

      {/* Page sections */}
      {Array.from({ length: total_pages }, (_, i) => i + 1).map((pg) => {
        const findings = page_findings[String(pg)] ?? [];
        const imageId = page_image_map[String(pg)];
        return (
          <PageSection
            key={pg}
            page={pg}
            findings={findings}
            imageId={imageId}
            checkpointMap={checkpoint_map}
            runId={run_id!}
          />
        );
      })}

      {/* Prompts used */}
      {run.page_prompt && (
        <PromptsSection pagePrompt={run.page_prompt} docPrompt={run.doc_prompt} />
      )}

      {/* Document-level findings */}
      {doc_findings.length > 0 && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-purple-50 border-b border-slate-200 flex items-center gap-2">
            <FileText size={15} className="text-purple-600" />
            <span className="text-sm font-semibold text-purple-800">Document-level findings</span>
            <span className="ml-auto text-xs text-purple-600 font-medium">{doc_findings.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {doc_findings.map((f) => (
              <FindingRow key={f.id} finding={f} checkpointMap={checkpoint_map} runId={run_id!} showLocation={true} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PageSection({
  page, findings, imageId, checkpointMap, runId,
}: {
  page: number;
  findings: Finding[];
  imageId?: string;
  checkpointMap: Record<string, string>;
  runId: string;
}) {
  const [open, setOpen] = useState(findings.length > 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-4 overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-sm font-semibold text-slate-700">Page {page}</span>
        {findings.length > 0 ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
            {findings.length} finding{findings.length !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <CheckCircle2 size={12} className="text-green-500" /> No issues
          </span>
        )}
        {findings.length > 0 && (
          <span className="ml-auto text-slate-300">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
        )}
      </div>

      {open && (
        <div className="flex gap-0">
          {/* Image */}
          {imageId && (
            <div className="w-72 flex-shrink-0 border-r border-slate-100">
              <img
                src={`https://drive.google.com/uc?export=view&id=${imageId}`}
                alt={`Page ${page}`}
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          )}
          {/* Findings */}
          <div className="flex-1 divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {findings.map((f) => (
              <FindingRow key={f.id} finding={f} checkpointMap={checkpointMap} runId={runId} />
            ))}
            {findings.length === 0 && (
              <div className="p-5 text-sm text-slate-400 text-center">No findings on this page.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FindingRow({
  finding, checkpointMap, runId, showLocation,
}: {
  finding: Finding;
  checkpointMap: Record<string, string>;
  runId: string;
  showLocation?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editStatus, setEditStatus] = useState<"valid" | "invalid">("valid");
  const [editComment, setEditComment] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => updateFindingReview(String(finding.id), editStatus, editComment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["run", runId] });
      setEditing(false);
    },
  });

  const statusConfig = {
    valid: { icon: <CheckCircle2 size={14} className="text-green-500" />, badge: "bg-green-100 text-green-700", label: "Valid" },
    invalid: { icon: <XCircle size={14} className="text-red-500" />, badge: "bg-red-100 text-red-700", label: "Invalid" },
    undefined: { icon: <HelpCircle size={14} className="text-amber-400" />, badge: "bg-amber-100 text-amber-700", label: "Pending" },
  }[finding.review_status ?? "undefined"];

  const categoryName = checkpointMap[finding.checkpoint_id] ?? finding.checkpoint_id;

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        {statusConfig.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusConfig.badge}`}>
              {statusConfig.label}
            </span>
            <span className="text-xs text-slate-400">{finding.checkpoint_id} · {categoryName}</span>
            {showLocation && finding.location && finding.location !== "" && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                {finding.location}
              </span>
            )}
          </div>
          <p className="text-xs font-mono text-slate-400 truncate mb-1">
            <span className="not-italic font-semibold text-slate-500 mr-1">Quote:</span>"{finding.quote}"
          </p>
          <p className="text-sm text-slate-700">
            <span className="text-xs font-semibold text-slate-500 mr-1">Error:</span>{finding.issue}
          </p>
          <p className="text-xs text-indigo-600 mt-0.5">
            <span className="font-semibold text-slate-500 mr-1">Suggestion:</span>{finding.suggestion}
          </p>
          {finding.review_comment && (
            <p className="text-xs text-slate-400 mt-1 italic">
              <span className="not-italic font-semibold text-slate-500 mr-1">Review:</span>{finding.review_comment}
            </p>
          )}

          {/* Review override */}
          {!editing && (
            <button
              onClick={() => {
                setEditing(true);
                setEditStatus(finding.review_status === "invalid" ? "valid" : "invalid");
                setEditComment("");
              }}
              className="text-xs text-slate-400 hover:text-indigo-600 mt-1.5 transition-colors"
            >
              Override verdict
            </button>
          )}

          {editing && (
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex gap-2">
                <button
                  onClick={() => setEditStatus("valid")}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    editStatus === "valid"
                      ? "bg-green-600 border-green-600 text-white"
                      : "border-slate-300 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  Valid
                </button>
                <button
                  onClick={() => setEditStatus("invalid")}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    editStatus === "invalid"
                      ? "bg-red-600 border-red-600 text-white"
                      : "border-slate-300 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  Invalid
                </button>
              </div>
              <input
                type="text"
                placeholder="Reason (required)"
                value={editComment}
                onChange={(e) => setEditComment(e.target.value)}
                className="text-xs border border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full max-w-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => mutation.mutate()}
                  disabled={!editComment.trim() || mutation.isPending}
                  className="text-xs bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1"
                >
                  {mutation.isPending && <Loader2 size={11} className="animate-spin" />}
                  Save
                </button>
                <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:text-slate-600 px-2">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: "green" | "red" }) {
  const c = color === "green" ? "text-green-600" : color === "red" ? "text-red-600" : "text-slate-900";
  return (
    <div>
      <p className={`text-2xl font-bold ${c}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function PromptsSection({ pagePrompt, docPrompt }: { pagePrompt: string; docPrompt: string | null }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"page" | "doc">("page");

  return (
    <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
        onClick={() => setOpen((o) => !o)}
      >
        <Code2 size={15} className="text-slate-400" />
        <span className="text-sm font-semibold text-slate-700">Prompts used</span>
        <span className="ml-auto text-slate-300">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </div>

      {open && (
        <div className="p-5">
          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200 mb-4">
            <button
              onClick={() => setTab("page")}
              className={`px-4 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                tab === "page" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              Page check
            </button>
            {docPrompt && (
              <button
                onClick={() => setTab("doc")}
                className={`px-4 py-1.5 text-xs font-medium border-b-2 transition-colors -mb-px ${
                  tab === "doc" ? "border-indigo-500 text-indigo-600" : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Document check
              </button>
            )}
          </div>
          <pre className="text-xs font-mono text-slate-600 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-lg p-4 max-h-80 overflow-y-auto">
            {tab === "page" ? pagePrompt : docPrompt}
          </pre>
        </div>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="p-8 flex items-center gap-2 text-slate-400">
      <Loader2 size={18} className="animate-spin" /> Loading run…
    </div>
  );
}

function ErrorState() {
  return (
    <div className="p-8">
      <p className="text-slate-500">Run not found.</p>
      <Link to="/history" className="text-indigo-600 text-sm mt-2 inline-block">← Back to history</Link>
    </div>
  );
}
