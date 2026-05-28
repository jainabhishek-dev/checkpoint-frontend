import { useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2, XCircle, AlertCircle, RotateCcw, MessageSquarePlus,
  Loader2, ChevronDown, ChevronUp, FileText, History,
} from "lucide-react";
import { useSSEJob } from "../../hooks/useSSEJob";
import { getStreamUrl, retryJob, insertComments } from "../../api/jobs";
import { getCheckpoints } from "../../api/workflows";
import type { Finding, SSEPageFindings, SSEPageReview, SSEDocumentFindings, SSEDocumentReview, SSEAllDone, SSEPartialComplete } from "../../types";

const SSE_EVENTS = [
  "start", "page_ready", "page_findings", "page_review",
  "done", "document_start", "document_findings", "document_review",
  "all_done", "partial_complete", "retry_start", "error",
];

type Phase =
  | "connecting"
  | "processing"
  | "document_check"
  | "done"
  | "error"
  | "partial";

interface PageResult {
  page: number;
  findings: Finding[];
  imageUrl?: string;
}

interface InsertState {
  loading: boolean;
  posted?: number;
  error?: string;
}

export default function ProcessPage() {
  const { job_id } = useParams<{ job_id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const retryFrom: number | undefined = (location.state as { retry_from?: number })?.retry_from;
  const workflowId: string = (location.state as { workflow_id?: string })?.workflow_id ?? "";

  const { data: cpData } = useQuery({
    queryKey: ["checkpoints", workflowId],
    queryFn: () => getCheckpoints(workflowId),
    enabled: !!workflowId,
    staleTime: 5 * 60 * 1000,
  });
  const checkpointMap: Record<string, string> = Object.fromEntries(
    (cpData?.checkpoints ?? []).map((cp) => [cp.id, cp.category])
  );

  const [phase, setPhase] = useState<Phase>("connecting");
  const [title, setTitle] = useState((location.state as { title?: string })?.title ?? "");
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<PageResult[]>([]);
  const [docFindings, setDocFindings] = useState<Finding[]>([]);
  const [totalFindings, setTotalFindings] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [lastSuccessPage, setLastSuccessPage] = useState(0);

  // Which finding IDs are selected for Drive comment insertion
  const [selectedFindings, setSelectedFindings] = useState<Set<number>>(new Set());
  const [insertState, setInsertState] = useState<InsertState>({ loading: false });

  const streamUrl = job_id
    ? getStreamUrl(job_id, retryFrom)
    : null;

  const handleEvent = useCallback((type: string, data: unknown) => {
    if (type === "start") {
      const d = data as { total_pages: number; title: string };
      setTotalPages(d.total_pages);
      setTitle(d.title);
      setPhase("processing");
    } else if (type === "retry_start") {
      const d = data as { starting_page: number; total_pages: number };
      setTotalPages(d.total_pages);
      setCurrentPage(d.starting_page - 1);
      setPhase("processing");
    } else if (type === "page_ready") {
      const d = data as { page: number };
      setCurrentPage(d.page);
      const base = import.meta.env.VITE_API_URL ?? "";
      const imageUrl = `${base}/job/${job_id}/page/${d.page}`;
      setPages((prev) => {
        const existing = prev.find((p) => p.page === d.page);
        if (existing) return prev.map((p) => p.page === d.page ? { ...p, imageUrl } : p);
        return [...prev, { page: d.page, findings: [], imageUrl }];
      });
    } else if (type === "page_findings") {
      const d = data as SSEPageFindings;
      setPages((prev) => {
        const existing = prev.find((p) => p.page === d.page);
        if (existing) {
          return prev.map((p) => p.page === d.page ? { ...p, findings: d.findings } : p);
        }
        return [...prev, { page: d.page, findings: d.findings }];
      });
    } else if (type === "page_review") {
      const d = data as SSEPageReview;
      const reviewMap = new Map(d.reviews.map((r) => [r.finding_id, r]));
      setPages((prev) =>
        prev.map((p) =>
          p.page === d.page
            ? {
                ...p,
                findings: p.findings.map((f) => {
                  const rev = reviewMap.get(f.id);
                  return rev ? { ...f, review_status: rev.verdict, review_comment: rev.reason } : f;
                }),
              }
            : p
        )
      );
    } else if (type === "done") {
      // page processing done, may start document check next
    } else if (type === "document_start") {
      setPhase("document_check");
    } else if (type === "document_findings") {
      const d = data as SSEDocumentFindings;
      setDocFindings(d.findings);
    } else if (type === "document_review") {
      const d = data as SSEDocumentReview;
      const reviewMap = new Map(d.reviews.map((r) => [r.finding_id, r]));
      setDocFindings((prev) =>
        prev.map((f) => {
          const rev = reviewMap.get(f.id);
          return rev ? { ...f, review_status: rev.verdict, review_comment: rev.reason } : f;
        })
      );
    } else if (type === "all_done") {
      const d = data as SSEAllDone;
      setTotalFindings(d.total_findings);
      setPhase("done");
    } else if (type === "partial_complete") {
      const d = data as SSEPartialComplete;
      setLastSuccessPage(d.last_successful_page);
      setErrorMsg(d.error_message);
      setPhase("partial");
    } else if (type === "error") {
      const d = data as { message: string };
      setErrorMsg(d.message);
      setPhase("error");
    }
  }, []);

  useSSEJob(streamUrl, SSE_EVENTS, handleEvent);

  const allFindings: Finding[] = [
    ...pages.flatMap((p) => p.findings),
    ...docFindings,
  ];

  function toggleFinding(id: number) {
    setSelectedFindings((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleInsertComments() {
    if (!job_id || selectedFindings.size === 0) return;
    setInsertState({ loading: true });
    try {
      const result = await insertComments(job_id, Array.from(selectedFindings));
      setInsertState({ loading: false, posted: result.posted });
    } catch {
      setInsertState({ loading: false, error: "Failed to post comments." });
    }
  }

  async function handleRetry() {
    if (!job_id) return;
    const result = await retryJob(job_id);
    navigate(`/process/${job_id}`, { state: { retry_from: result.retry_from }, replace: true });
    window.location.reload();
  }

  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  const validCount = allFindings.filter((f) => f.review_status === "valid").length;
  const invalidCount = allFindings.filter((f) => f.review_status === "invalid").length;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight truncate max-w-xl">
              {title || "Processing document…"}
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {phase === "connecting" && "Connecting…"}
              {phase === "processing" && `Page ${currentPage} of ${totalPages}`}
              {phase === "document_check" && "Running document-level checks…"}
              {phase === "done" && `Complete — ${totalFindings} finding${totalFindings !== 1 ? "s" : ""}`}
              {phase === "error" && "An error occurred"}
              {phase === "partial" && `Stopped at page ${lastSuccessPage}`}
            </p>
          </div>
          {phase === "done" && (
            <button
              onClick={() => navigate("/history")}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <History size={15} /> View in history
            </button>
          )}
        </div>

        {/* Progress bar */}
        {(phase === "processing" || phase === "document_check") && (
          <div className="mt-4">
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full bg-indigo-500 rounded-full transition-all duration-300 ${
                  phase === "document_check" ? "progress-pulse" : ""
                }`}
                style={{ width: phase === "document_check" ? "100%" : `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error states */}
      {phase === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Processing failed</p>
            <p className="text-sm text-red-600 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {phase === "partial" && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Processing stopped at page {lastSuccessPage}</p>
              <p className="text-sm text-amber-600 mt-0.5">{errorMsg}</p>
            </div>
          </div>
          <button
            onClick={handleRetry}
            className="flex items-center gap-1.5 text-sm font-medium text-amber-700 hover:text-amber-800 whitespace-nowrap"
          >
            <RotateCcw size={14} /> Retry from page {lastSuccessPage + 1}
          </button>
        </div>
      )}

      {/* Summary bar when done */}
      {phase === "done" && allFindings.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 mb-6 flex items-center gap-6 shadow-sm">
          <Stat label="Findings" value={totalFindings} color="slate" />
          <Stat label="Valid" value={validCount} color="green" />
          <Stat label="Invalid" value={invalidCount} color="red" />
          <Stat label="Unreviewed" value={totalFindings - validCount - invalidCount} color="amber" />

          {allFindings.some((f) => f.review_status === "valid") && (
            <div className="ml-auto flex items-center gap-3">
              {insertState.posted !== undefined ? (
                <span className="text-sm text-green-700 font-medium">
                  ✓ {insertState.posted} comment{insertState.posted !== 1 ? "s" : ""} posted
                </span>
              ) : (
                <button
                  onClick={handleInsertComments}
                  disabled={insertState.loading || selectedFindings.size === 0}
                  className="flex items-center gap-1.5 text-sm font-medium bg-slate-900 hover:bg-slate-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
                >
                  {insertState.loading ? <Loader2 size={14} className="animate-spin" /> : <MessageSquarePlus size={14} />}
                  Post {selectedFindings.size > 0 ? `${selectedFindings.size} ` : ""}to Drive
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Page cards */}
      <div className="space-y-4">
        {pages.map((p) => (
          <PageCard
            key={p.page}
            page={p.page}
            findings={p.findings}
            imageUrl={p.imageUrl}
            selectedFindings={selectedFindings}
            onToggle={toggleFinding}
            isDone={phase === "done" || currentPage > p.page}
            checkpointMap={checkpointMap}
          />
        ))}

        {/* Document-level findings */}
        {docFindings.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-purple-50 border-b border-slate-200 flex items-center gap-2">
              <FileText size={15} className="text-purple-600" />
              <span className="text-sm font-semibold text-purple-800">Document-level findings</span>
              <span className="ml-auto text-xs text-purple-600 font-medium">{docFindings.length} finding{docFindings.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="divide-y divide-slate-100">
              {docFindings.map((f) => (
                <FindingRow
                  key={f.id}
                  finding={f}
                  selected={selectedFindings.has(f.id)}
                  onToggle={toggleFinding}
                  showCheckbox={phase === "done"}
                  checkpointMap={checkpointMap}
                />
              ))}
            </div>
          </div>
        )}

        {/* Connecting placeholder */}
        {phase === "connecting" && (
          <div className="flex items-center justify-center h-32 text-slate-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Connecting to stream…
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: "slate" | "green" | "red" | "amber" }) {
  const colours = {
    slate: "text-slate-600",
    green: "text-green-600",
    red: "text-red-600",
    amber: "text-amber-600",
  };
  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${colours[color]}`}>{value}</p>
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}

function PageCard({
  page, findings, imageUrl, selectedFindings, onToggle, isDone, checkpointMap,
}: {
  page: number;
  findings: Finding[];
  imageUrl?: string;
  selectedFindings: Set<number>;
  onToggle: (id: number) => void;
  isDone: boolean;
  checkpointMap: Record<string, string>;
}) {
  const [open, setOpen] = useState(true); // open as soon as page card appears
  const validCount = findings.filter((f) => f.review_status === "valid").length;
  const invalidCount = findings.filter((f) => f.review_status === "invalid").length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => (imageUrl || findings.length > 0) && setOpen((o) => !o)}
      >
        <span className="text-sm font-semibold text-slate-700">Page {page}</span>
        {!isDone && findings.length === 0 && <Loader2 size={13} className="text-slate-400 animate-spin ml-1" />}
        {findings.length > 0 && (
          <div className="flex items-center gap-2 ml-1">
            {validCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                {validCount} Valid
              </span>
            )}
            {invalidCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                {invalidCount} Invalid
              </span>
            )}
            {findings.some((f) => !f.review_status) && (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                reviewing…
              </span>
            )}
          </div>
        )}
        {isDone && findings.length === 0 && (
          <span className="text-xs text-slate-400 flex items-center gap-1"><CheckCircle2 size={13} className="text-green-500" /> No issues</span>
        )}
        {(imageUrl || findings.length > 0) && (
          <span className="ml-auto text-slate-300">{open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</span>
        )}
      </div>

      {open && (imageUrl || findings.length > 0) && (
        <div className="flex gap-0">
          {imageUrl && (
            <div className="w-72 flex-shrink-0 border-r border-slate-100">
              <img
                src={imageUrl}
                alt={`Page ${page}`}
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          )}
          <div className="flex-1 divide-y divide-slate-100 max-h-96 overflow-y-auto">
            {findings.length === 0 ? (
              <div className="p-5 text-sm text-slate-400 text-center flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Checking page…
              </div>
            ) : (
              findings.map((f) => (
                <FindingRow
                  key={f.id}
                  finding={f}
                  selected={selectedFindings.has(f.id)}
                  onToggle={onToggle}
                  showCheckbox={isDone && f.review_status === "valid"}
                  checkpointMap={checkpointMap}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FindingRow({
  finding, selected, onToggle, showCheckbox, checkpointMap,
}: {
  finding: Finding;
  selected: boolean;
  onToggle: (id: number) => void;
  showCheckbox: boolean;
  checkpointMap: Record<string, string>;
}) {
  const statusIcon = {
    valid: <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />,
    invalid: <XCircle size={14} className="text-red-500 flex-shrink-0" />,
  };

  return (
    <div className={`flex items-start gap-3 px-4 py-3 ${selected ? "bg-indigo-50" : ""}`}>
      {showCheckbox && (
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(finding.id)}
          className="mt-1 rounded border-slate-300 text-indigo-600 cursor-pointer flex-shrink-0"
        />
      )}
      {finding.review_status ? (
        statusIcon[finding.review_status]
      ) : (
        <Loader2 size={14} className="text-amber-400 animate-spin flex-shrink-0 mt-0.5" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="text-xs text-slate-400">
            {finding.checkpoint_id}
            {checkpointMap[finding.checkpoint_id] && (
              <> · <span className="font-medium text-slate-500">{checkpointMap[finding.checkpoint_id]}</span></>
            )}
          </span>
        </div>
        <p className="text-xs font-mono text-slate-500 truncate mb-0.5">
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
      </div>
    </div>
  );
}
