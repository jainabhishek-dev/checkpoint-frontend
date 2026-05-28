import { useState, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { CheckCircle2, XCircle, HelpCircle, Loader2, History } from "lucide-react";
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
  page?: number;
}

export default function CicProcessPage() {
  const { job_id } = useParams<{ job_id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as {
    commented_title?: string;
    revised_title?: string;
    total_comments?: number;
  } | null;

  const [phase, setPhase] = useState<Phase>("connecting");
  const [totalComments, setTotalComments] = useState(state?.total_comments ?? 0);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [verdicts, setVerdicts] = useState<CommentVerdict[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [doneSummary, setDoneSummary] = useState<CicSSEDone | null>(null);

  const streamUrl = job_id ? getCicStreamUrl(job_id) : null;

  const handleEvent = useCallback((type: string, data: unknown) => {
    if (type === "cic_start") {
      const d = data as { total_comments: number; total_pages: number };
      setTotalComments(d.total_comments);
      setTotalPages(d.total_pages);
      setPhase("processing");
    } else if (type === "cic_page") {
      const d = data as CicSSEPage;
      setCurrentPage(d.page_num);
      if (d.verdicts.length > 0) {
        setVerdicts((prev) => {
          const updated = new Map(prev.map((v) => [v.comment_id, v]));
          d.verdicts.forEach((v) => updated.set(v.comment_id, { ...v, page: d.page_num }));
          return Array.from(updated.values());
        });
      }
    } else if (type === "cic_global_start") {
      setPhase("global_check");
    } else if (type === "cic_global") {
      const d = data as { verdicts: CommentVerdict[] };
      setVerdicts((prev) => {
        const updated = new Map(prev.map((v) => [v.comment_id, v]));
        d.verdicts.forEach((v) => updated.set(v.comment_id, v));
        return Array.from(updated.values());
      });
    } else if (type === "cic_done") {
      const d = data as CicSSEDone;
      setDoneSummary(d);
      setPhase("done");
    } else if (type === "error") {
      const d = data as { message: string };
      setErrorMsg(d.message);
      setPhase("error");
    }
  }, []);

  useSSEJob(streamUrl, SSE_EVENTS, handleEvent);

  const progress = totalPages > 0 ? Math.round((currentPage / totalPages) * 100) : 0;

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Comment Incorporation Check</h1>
            <div className="flex flex-col gap-0.5 mt-1">
              {state?.commented_title && (
                <p className="text-sm text-slate-500">
                  <span className="text-slate-400">Original:</span> {state.commented_title}
                </p>
              )}
              {state?.revised_title && (
                <p className="text-sm text-slate-500">
                  <span className="text-slate-400">Revised:</span> {state.revised_title}
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

        {/* Progress */}
        {(phase === "processing" || phase === "global_check") && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>
                {phase === "global_check"
                  ? "Running final document pass…"
                  : `Page ${currentPage} of ${totalPages}`}
              </span>
              <span>{verdicts.length} / {totalComments} comments resolved</span>
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

      {/* Live comment list */}
      {verdicts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
            {phase === "done" ? "All comments" : "Resolved so far"}
          </p>
          {verdicts.map((v) => (
            <VerdictCard key={v.comment_id} verdict={v} />
          ))}
        </div>
      )}

      {/* Connecting placeholder */}
      {phase === "connecting" && (
        <div className="flex items-center justify-center h-32 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Connecting…
        </div>
      )}

      {/* Processing but no verdicts yet */}
      {phase === "processing" && verdicts.length === 0 && (
        <div className="flex items-center justify-center h-32 text-slate-400">
          <Loader2 size={20} className="animate-spin mr-2" /> Checking pages…
        </div>
      )}
    </div>
  );
}

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

function VerdictCard({ verdict }: { verdict: CommentVerdict }) {
  const config = {
    fixed: {
      icon: <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />,
      badge: "bg-green-100 text-green-700",
      label: "Fixed",
    },
    not_fixed: {
      icon: <XCircle size={16} className="text-red-500 flex-shrink-0" />,
      badge: "bg-red-100 text-red-700",
      label: "Not fixed",
    },
    not_sure: {
      icon: <HelpCircle size={16} className="text-amber-500 flex-shrink-0" />,
      badge: "bg-amber-100 text-amber-700",
      label: "Not sure",
    },
  }[verdict.verdict];

  return (
    <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex items-start gap-3 shadow-sm">
      {config.icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-700 leading-snug">{verdict.content}</p>
        {verdict.reason && (
          <p className="text-xs text-slate-400 mt-1 italic">{verdict.reason}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {verdict.page && (
          <span className="text-xs text-slate-300">p.{verdict.page}</span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
          {config.label}
        </span>
      </div>
    </div>
  );
}
