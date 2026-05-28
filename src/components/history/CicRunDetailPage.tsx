import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle2, XCircle, HelpCircle, Loader2, ImageOff,
} from "lucide-react";
import { getCicRun, getCicRunPages } from "../../api/history";
import type { CicComment } from "../../types";

export default function CicRunDetailPage() {
  const { run_id } = useParams<{ run_id: string }>();
  const { data, isLoading, error } = useQuery({
    queryKey: ["cic-run", run_id],
    queryFn: () => getCicRun(run_id!),
    enabled: !!run_id,
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState />;

  const { run, total_pages, f1_image_map, f2_image_map, page_comments_map, global_comments, needs_images } = data;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Back */}
      <Link
        to="/history?tab=cic"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft size={15} /> History
      </Link>

      {/* Run header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Comment Incorporation Check
            </h1>
            <p className="text-sm text-slate-500 mt-1">{run.workflow_name} · {run.checked_by}</p>
            <p className="text-xs text-slate-400 mt-0.5">{run.created_at?.slice(0, 16)}</p>
          </div>
          <div className="text-right text-xs text-slate-400 space-y-0.5">
            <p><span className="text-slate-500 font-medium">Original:</span> {run.commented_file_name ?? "—"}</p>
            <p><span className="text-slate-500 font-medium">Revised:</span> {run.revised_file_name ?? "—"}</p>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          <Stat label="Comments" value={run.total_comments} />
          <Stat label="Fixed" value={run.fixed_count} color="green" />
          <Stat label="Not fixed" value={run.not_fixed_count} color="red" />
          <Stat label="Not sure" value={run.not_sure_count} color="amber" />
        </div>
      </div>

      {/* Image upload banner + polling */}
      {needs_images && (
        <ImagePollingBanner runId={run_id!} totalPages={total_pages} />
      )}

      {/* Page sections */}
      {Array.from({ length: total_pages }, (_, i) => i + 1).map((pg) => {
        const comments = page_comments_map[String(pg)] ?? [];
        return (
          <PageSection
            key={pg}
            page={pg}
            comments={comments}
            f1ImageId={f1_image_map[String(pg)]}
            f2ImageId={f2_image_map[String(pg)]}
            runId={run_id!}
          />
        );
      })}

      {/* Global / unresolved comments */}
      {global_comments.length > 0 && (
        <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 bg-purple-50 border-b border-slate-200 flex items-center gap-2">
            <HelpCircle size={15} className="text-purple-600" />
            <span className="text-sm font-semibold text-purple-800">Global / unanchored comments</span>
            <span className="ml-auto text-xs text-purple-600 font-medium">{global_comments.length}</span>
          </div>
          <div className="divide-y divide-slate-100">
            {global_comments.map((c) => (
              <CommentRow key={c.id} comment={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Image polling banner ──────────────────────────────────────────────────────

function ImagePollingBanner({ runId, totalPages }: { runId: string; totalPages: number }) {
  const [dismissed, setDismissed] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  const pollCount = useRef(0);
  const maxPolls = 36; // 36 × 5 s = 3 min

  const { refetch } = useQuery({
    queryKey: ["cic-run-pages", runId],
    queryFn: () => getCicRunPages(runId),
    enabled: !dismissed && !imagesReady,
    refetchInterval: false, // we'll manually refetch
    staleTime: 0,
  });

  useEffect(() => {
    if (dismissed || imagesReady) return;
    const interval = setInterval(async () => {
      pollCount.current += 1;
      const result = await refetch();
      const pages = result.data?.pages ?? [];
      // Each page should have both f1 and f2 images
      const f1Pages = new Set(pages.filter((p) => p.file_version === "commented").map((p) => p.page_num));
      const f2Pages = new Set(pages.filter((p) => p.file_version === "revised").map((p) => p.page_num));
      let allPresent = true;
      for (let i = 1; i <= totalPages; i++) {
        if (!f1Pages.has(i) || !f2Pages.has(i)) { allPresent = false; break; }
      }
      if (allPresent || pollCount.current >= maxPolls) {
        setImagesReady(true);
        clearInterval(interval);
        if (allPresent) {
          // Reload to show fresh images
          window.location.reload();
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [dismissed, imagesReady, refetch, totalPages]);

  if (dismissed || imagesReady) return null;

  return (
    <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
      <Loader2 size={15} className="animate-spin text-amber-500 flex-shrink-0" />
      <p className="text-sm text-amber-800 flex-1">
        Page images are still uploading — they'll appear automatically once ready.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-xs text-amber-600 hover:text-amber-800 font-medium whitespace-nowrap"
      >
        Dismiss
      </button>
    </div>
  );
}

// ── Page section ──────────────────────────────────────────────────────────────

function PageSection({
  page, comments, f1ImageId, f2ImageId, runId: _runId,
}: {
  page: number;
  comments: CicComment[];
  f1ImageId?: string;
  f2ImageId?: string;
  runId: string;
}) {
  const hasContent = comments.length > 0 || f1ImageId || f2ImageId;
  const [open, setOpen] = useState(comments.length > 0);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-4 overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-sm font-semibold text-slate-700">Page {page}</span>
        {comments.length > 0 ? (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
            {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </span>
        ) : (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <CheckCircle2 size={12} className="text-slate-300" /> No comments
          </span>
        )}
        {hasContent && (
          <span className="ml-auto text-slate-300 text-xs">{open ? "▲" : "▼"}</span>
        )}
      </div>

      {open && (
        <div className="flex gap-px bg-slate-200">
          {/* File 1 image */}
          <PageImage imageId={f1ImageId} page={page} label="Original" />
          {/* File 2 image */}
          <PageImage imageId={f2ImageId} page={page} label="Revised" />

          {/* Comments */}
          <div className="flex-1 divide-y divide-slate-100 min-w-0 max-h-96 overflow-y-auto bg-white">
            {comments.length === 0 ? (
              <div className="p-5 text-sm text-slate-400 text-center">No comments on this page.</div>
            ) : (
              comments.map((c) => <CommentRow key={c.id} comment={c} />)
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PageImage({ imageId, page, label }: { imageId?: string; page: number; label: string }) {
  return (
    <div className="w-72 flex-shrink-0 bg-white">
      <div className="px-2 py-1 bg-slate-50 border-b border-slate-100">
        <span className="text-xs text-slate-400 font-medium">{label}</span>
      </div>
      {imageId ? (
        <img
          src={`${import.meta.env.VITE_API_URL ?? ""}/api/drive-image/${imageId}`}
          alt={`${label} page ${page}`}
          className="w-full h-auto"
          loading="lazy"
        />
      ) : (
        <div className="h-40 flex flex-col items-center justify-center gap-1 text-slate-300">
          <ImageOff size={20} />
          <span className="text-xs">Not yet uploaded</span>
        </div>
      )}
    </div>
  );
}

// ── Comment row ───────────────────────────────────────────────────────────────

function CommentRow({ comment }: { comment: CicComment }) {
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
  }[comment.verdict ?? "not_sure"];

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.badge}`}>
              {config.label}
            </span>
            {comment.author && (
              <span className="text-xs text-slate-400">{comment.author}</span>
            )}
            {comment.page_resolved && (
              <span className="text-xs text-slate-300">resolved on p.{comment.page_resolved}</span>
            )}
          </div>
          <p className="text-sm text-slate-700 leading-snug">{comment.content}</p>
          {comment.reason && (
            <p className="text-xs text-slate-400 mt-1 italic">{comment.reason}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Stat({
  label, value, color,
}: {
  label: string;
  value: number;
  color?: "green" | "red" | "amber";
}) {
  const c =
    color === "green" ? "text-green-600" :
    color === "red" ? "text-red-600" :
    color === "amber" ? "text-amber-600" :
    "text-slate-900";
  return (
    <div>
      <p className={`text-2xl font-bold ${c}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
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
      <Link to="/history?tab=cic" className="text-indigo-600 text-sm mt-2 inline-block">
        ← Back to history
      </Link>
    </div>
  );
}
