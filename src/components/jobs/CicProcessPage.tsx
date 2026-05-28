import { useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { CheckCircle2, XCircle, HelpCircle, Loader2, History, ChevronDown, ChevronUp } from "lucide-react";
import { useSSEJob } from "../../hooks/useSSEJob";
import { getCicStreamUrl } from "../../api/jobs";
import type { CicSSEPage, CicSSEDone } from "../../types";

const SSE_EVENTS = ["cic_start", "cic_page", "cic_global_start", "cic_global", "cic_done", "error"];

type Phase = "connecting" | "processing" | "global_check" | "done" | "error";

interface CommentVerdict {
  comment_id: string;
  content: string;
  verdict: "fixed" | "not_fixed" | "not_sure";
  reason: string;
}

interface PageResult {
  page_num: number;
  f1ImageUrl: string;
  f2ImageUrl: string;
  verdicts: CommentVerdict[];
}

export default function CicProcessPage() {
  const { job_id } = useParams<{ job_id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const locState = location.state as {
    commented_title?: string;
    revised_title?: string;
    total_comments?: number;
  } | null;

  const [phase, setPhase] = useState<Phase>("connecting");
  const [totalComments, setTotalComments] = useState(locState?.total_comments ?? 0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pages, setPages] = useState<PageResult[]>([]);
  const [globalVerdicts, setGlobalVerdicts] = useState<CommentVerdict[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [doneSummary, setDoneSummary] = useState<CicSSEDone | null>(null);

  const streamUrl = job_id ? getCicStreamUrl(job_id) : null;
  const base = import.meta.env.VITE_API_URL ?? "";

  const handleEvent = useCallback((type: string, data: unknown) => {
    if (type === "cic_start") {
      const d = data as { total_comments: number; total_pages: number };
      setTotalComments(d.total_comments);
      setTotalPages(d.total_pages);
      setPhase("processing");
    } else if (type === "cic_page") {
      const d = data as CicSSEPage;
      setCurrentPage(d.page_num);
      setPages((prev) => {
        const existing = prev.find((p) => p.page_num === d.page_num);
        if (existing) {
          return prev.map((p) =>
            p.page_num === d.page_num ? { ...p, verdicts: d.verdicts } : p
          );
        }
        return [
          ...prev,
          {
            page_num: d.page_num,
            f1ImageUrl: `${base}/cic-job/${job_id}/f1/${d.page_num}`,
            f2ImageUrl: `${base}/cic-job/${job_id}/f2/${d.page_num}`,
            verdicts: d.verdicts,
          },
        ];
      });
    } else if (type === "cic_global_start") {
      setPhase("global_check");
    } else if (type === "cic_global") {
      const d = data as { verdicts: CommentVerdict[] };
      setGlobalVerdicts(d.verdicts);
    } else if (type === "cic_done") {
      const d = data as CicSSEDone;
      setDoneSummary(d);
      setPhase("done");
    } else if (type === "error") {
      const d = data as { message: string };
      setErrorMsg(d.message);
      setPhase("error");
    }
  }, [base, job_id]);

  useSSEJob(streamUrl, SSE_EVENTS, handleEvent, ["cic_done", "error"]);

  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;
  const resolvedCount = pages.reduce((n, p) => n + p.verdicts.length, 0) + globalVerdicts.length;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Comment Incorporation Check</h1>
            <div className="flex flex-col gap-0.5 mt-1">
              {locState?.commented_title && (
                <p className="text-sm text-slate-500">
                  <span className="text-slate-400">Original:</span> {locState.commented_title}
                </p>
              )}
              {locState?.revised_title && (
                <p className="text-sm text-slate-500">
                  <span className="text-slate-400">Revised:</span> {locState.revised_title}
                </p>
              )}
            </div>
          </div>
          {phase === "done" && (
            <button
              onClick={() => navigate(`/history/cic/${job_id}`)}
              className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium whitespace-nowrap"
            >
              <History size={15} /> Full report
            </button>
          )}
        </div>

        {/* Progress bar */}
        {(phase === "processing" || phase === "global_check") && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>
                {phase === "global_check"
                  ? "Running final document pass…"
                  : `Page ${currentPage} of ${totalPages}`}
              </span>
              <span>{resolvedCount} / {totalComments} comments resolved</span>
            </div>
            <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full bg-indigo-500 rounded-full transition-all duration-300 ${
                  phase === "global_check" ? "progress-pulse" : ""
                }`}
                style={{ width: phase === "global_check" ? "100%" : `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Error */}
      {phase === "error" && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <XCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Processing failed</p>
            <p className="text-sm text-red-600 mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Done summary */}
      {phase === "done" && doneSummary && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-700 mb-3">
            {doneSummary.total_comments} comments checked
          </p>
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard label="Fixed" value={doneSummary.fixed} color="green" />
            <SummaryCard label="Not fixed" value={doneSummary.not_fixed} color="red" />
            <SummaryCard label="Not sure" value={doneSummary.not_sure} color="amber" />
          </div>
        </div>
      )}

      {/* Connecting placeholder */}
      {phase === "connecting" && (
        <div className="flex items-center justify-center h-32 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Connecting…
        </div>
      )}

      {/* Page cards */}
      <div className="space-y-4">
        {pages.map((p) => (
          <PageCard key={p.page_num} pageResult={p} isDone={phase === "done" || currentPage > p.page_num} />
        ))}

        {/* Global / unresolved comments */}
        {globalVerdicts.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-5 py-3 bg-purple-50 border-b border-slate-200 flex items-center gap-2">
              <HelpCircle size={15} className="text-purple-600" />
              <span className="text-sm font-semibold text-purple-800">Global / unanchored comments</span>
              <span className="ml-auto text-xs text-purple-600 font-medium">{globalVerdicts.length}</span>
            </div>
            <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
              {globalVerdicts.map((v) => (
                <VerdictRow key={v.comment_id} verdict={v} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Page card ─────────────────────────────────────────────────────────────────

function PageCard({ pageResult, isDone }: { pageResult: PageResult; isDone: boolean }) {
  const [open, setOpen] = useState(true);
  const { page_num, f1ImageUrl, f2ImageUrl, verdicts } = pageResult;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-sm font-semibold text-slate-700">Page {page_num}</span>
        {!isDone && verdicts.length === 0 ? (
          <Loader2 size={13} className="text-slate-400 animate-spin ml-1" />
        ) : verdicts.length > 0 ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
            {verdicts.length} comment{verdicts.length !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <CheckCircle2 size={12} className="text-slate-300" /> No comments
          </span>
        )}
        <span className="ml-auto text-slate-300">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </div>

      {open && (
        <div className="flex gap-px bg-slate-200">
          {/* Original image */}
          <div className="w-72 flex-shrink-0 bg-white">
            <div className="px-2 py-1 bg-slate-50 border-b border-slate-100">
              <span className="text-xs text-slate-400 font-medium">Original</span>
            </div>
            <img src={f1ImageUrl} alt={`Original page ${page_num}`} className="w-full h-auto" loading="lazy" />
          </div>
          {/* Revised image */}
          <div className="w-72 flex-shrink-0 bg-white">
            <div className="px-2 py-1 bg-slate-50 border-b border-slate-100">
              <span className="text-xs text-slate-400 font-medium">Revised</span>
            </div>
            <img src={f2ImageUrl} alt={`Revised page ${page_num}`} className="w-full h-auto" loading="lazy" />
          </div>
          {/* Verdicts */}
          <div className="flex-1 divide-y divide-slate-100 min-w-0 max-h-96 overflow-y-auto bg-white">
            {verdicts.length === 0 ? (
              <div className="p-5 flex items-center justify-center gap-2 text-sm text-slate-400">
                {isDone ? "No comments on this page." : <><Loader2 size={14} className="animate-spin" /> Checking…</>}
              </div>
            ) : (
              verdicts.map((v) => <VerdictRow key={v.comment_id} verdict={v} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Verdict row ───────────────────────────────────────────────────────────────

function VerdictRow({ verdict }: { verdict: CommentVerdict }) {
  const config = {
    fixed: {
      icon: <CheckCircle2 size={14} className="text-green-500" />,
      badge: "bg-green-100 text-green-700",
      label: "Fixed",
    },
    not_fixed: {
      icon: <XCircle size={14} className="text-red-500" />,
      badge: "bg-red-100 text-red-700",
      label: "Not fixed",
    },
    not_sure: {
      icon: <HelpCircle size={14} className="text-amber-400" />,
      badge: "bg-amber-100 text-amber-700",
      label: "Not sure",
    },
  }[verdict.verdict];

  return (
    <div className="px-4 py-3 flex items-start gap-3">
      {config.icon}
      <div className="flex-1 min-w-0">
        <div className="mb-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
            {config.label}
          </span>
        </div>
        <p className="text-sm text-slate-700 leading-snug">{verdict.content}</p>
        {verdict.reason && (
          <p className="text-xs text-slate-400 mt-1 italic">{verdict.reason}</p>
        )}
      </div>
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: number; color: "green" | "red" | "amber" }) {
  const colours = {
    green: "bg-green-50 border-green-200 text-green-800",
    red: "bg-red-50 border-red-200 text-red-800",
    amber: "bg-amber-50 border-amber-200 text-amber-800",
  };
  return (
    <div className={`border rounded-xl p-4 text-center ${colours[color]}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-sm font-medium mt-0.5">{label}</p>
    </div>
  );
}
