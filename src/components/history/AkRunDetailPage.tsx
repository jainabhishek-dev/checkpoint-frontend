import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, CheckCircle2, XCircle, HelpCircle, Loader2,
  ChevronDown, ChevronUp, Code2, BookOpen,
} from "lucide-react";
import { getAkRun } from "../../api/history";
import type { AkQuestionResult } from "../../types";

type Filter = "all" | "issues" | "missing" | "incorrect" | "manual";

export default function AkRunDetailPage() {
  const { run_id } = useParams<{ run_id: string }>();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["ak-run", run_id],
    queryFn: () => getAkRun(run_id!),
    enabled: !!run_id,
  });

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState />;

  const { run, questions } = data;

  // Apply filter
  const filtered = questions.filter((q) => {
    if (filter === "all") return true;
    if (filter === "issues") return q.present_in_ak === "No" || q.answer_correct === "No" || q.answer_correct === "Manual Review Required";
    if (filter === "missing") return q.present_in_ak === "No";
    if (filter === "incorrect") return q.answer_correct === "No";
    if (filter === "manual") return q.answer_correct === "Manual Review Required";
    return true;
  });

  // Group by exercise
  const exerciseOrder: string[] = [];
  const byExercise: Record<string, AkQuestionResult[]> = {};
  for (const q of filtered) {
    const ex = q.exercise_no ?? "Unknown";
    if (!byExercise[ex]) { exerciseOrder.push(ex); byExercise[ex] = []; }
    byExercise[ex].push(q);
  }

  const filterCounts = {
    all: questions.length,
    issues: questions.filter((q) => q.present_in_ak === "No" || q.answer_correct === "No" || q.answer_correct === "Manual Review Required").length,
    missing: questions.filter((q) => q.present_in_ak === "No").length,
    incorrect: questions.filter((q) => q.answer_correct === "No").length,
    manual: questions.filter((q) => q.answer_correct === "Manual Review Required").length,
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Back */}
      <Link
        to="/history?tab=ak"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors"
      >
        <ArrowLeft size={15} /> History
      </Link>

      {/* Run header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={15} className="text-indigo-500" />
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Answer Key Review</h1>
            </div>
            <p className="text-sm text-slate-500 mt-0.5">{run.workflow_name} · {run.checked_by}</p>
            <p className="text-xs text-slate-400 mt-0.5">{run.created_at?.slice(0, 16)}</p>
          </div>
          <div className="text-right text-xs text-slate-400 space-y-0.5">
            <p>
              <span className="text-slate-500 font-medium">Chapter:</span>{" "}
              {run.chapter_drive_url ? (
                <a href={run.chapter_drive_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  {run.chapter_file_name ?? "—"}
                </a>
              ) : (run.chapter_file_name ?? "—")}
            </p>
            <p>
              <span className="text-slate-500 font-medium">Answer Key:</span>{" "}
              {run.ak_drive_url ? (
                <a href={run.ak_drive_url} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                  {run.ak_file_name ?? "—"}
                </a>
              ) : (run.ak_file_name ?? "—")}
            </p>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-5 gap-4 mt-5 pt-5 border-t border-slate-100">
          <Stat label="Total Qs" value={run.total_questions} />
          <Stat label="Present in AK" value={run.present_in_ak} color="green" />
          <Stat label="Missing" value={run.missing_from_ak} color={run.missing_from_ak > 0 ? "red" : undefined} />
          <Stat label="Incorrect" value={run.incorrect_answers} color={run.incorrect_answers > 0 ? "red" : undefined} />
          <Stat label="Manual Review" value={run.manual_review_cases} color={run.manual_review_cases > 0 ? "amber" : undefined} />
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["all", "issues", "missing", "incorrect", "manual"] as Filter[]).map((f) => (
          <FilterButton
            key={f}
            label={f === "all" ? "All" : f === "issues" ? "All Issues" : f === "missing" ? "Missing from AK" : f === "incorrect" ? "Incorrect" : "Manual Review"}
            count={filterCounts[f]}
            active={filter === f}
            onClick={() => setFilter(f)}
          />
        ))}
      </div>

      {/* Question groups */}
      {exerciseOrder.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center text-sm text-slate-400">
          No questions match this filter.
        </div>
      ) : (
        exerciseOrder.map((ex) => (
          <ExerciseGroup key={ex} exerciseName={ex} questions={byExercise[ex]} />
        ))
      )}

      {/* Prompt used */}
      {run.prompt && (
        <PromptSection prompt={run.prompt} />
      )}
    </div>
  );
}

// ── Exercise group ─────────────────────────────────────────────────────────────

function ExerciseGroup({ exerciseName, questions }: { exerciseName: string; questions: AkQuestionResult[] }) {
  const [open, setOpen] = useState(true);
  const issueCount = questions.filter(
    (q) => q.present_in_ak === "No" || q.answer_correct === "No" || q.answer_correct === "Manual Review Required"
  ).length;

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm mb-4 overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-sm font-semibold text-slate-700">{exerciseName}</span>
        <span className="text-xs text-slate-400">{questions.length} question{questions.length !== 1 ? "s" : ""}</span>
        {issueCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
            {issueCount} issue{issueCount !== 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto text-slate-300">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </span>
      </div>

      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-medium">
                <th className="text-left px-4 py-2 w-16">Page</th>
                <th className="text-left px-4 py-2 w-20">Q. No.</th>
                <th className="text-left px-4 py-2 w-28">Present in AK?</th>
                <th className="text-left px-4 py-2 w-40">Answer Correct?</th>
                <th className="text-left px-4 py-2">Suggestions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {questions.map((q, i) => (
                <QuestionRow key={q.id ?? i} question={q} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Question row ───────────────────────────────────────────────────────────────

function QuestionRow({ question: q }: { question: AkQuestionResult }) {
  const isIssue = q.present_in_ak === "No" || q.answer_correct === "No";
  const isManual = q.answer_correct === "Manual Review Required";
  const rowClass = isIssue ? "bg-red-50/60" : isManual ? "bg-amber-50/60" : "";

  return (
    <tr className={`${rowClass} hover:bg-slate-50/80 transition-colors`}>
      <td className="px-4 py-2.5 text-slate-400">{q.page_no ?? "—"}</td>
      <td className="px-4 py-2.5 font-medium text-slate-700">{q.question_no}</td>
      <td className="px-4 py-2.5">
        {q.present_in_ak === "Yes" ? (
          <span className="flex items-center gap-1 text-green-700"><CheckCircle2 size={12} /> Yes</span>
        ) : (
          <span className="flex items-center gap-1 text-red-600"><XCircle size={12} /> No</span>
        )}
      </td>
      <td className="px-4 py-2.5">
        {q.answer_correct === "Yes" ? (
          <span className="flex items-center gap-1 text-green-700"><CheckCircle2 size={12} /> Yes</span>
        ) : q.answer_correct === "No" ? (
          <span className="flex items-center gap-1 text-red-600"><XCircle size={12} /> No</span>
        ) : q.answer_correct === "Manual Review Required" ? (
          <span className="flex items-center gap-1 text-amber-600"><HelpCircle size={12} /> Manual Review</span>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
      <td className="px-4 py-2.5 text-slate-600 max-w-xs">
        {q.suggestions ?? <span className="text-slate-300">—</span>}
      </td>
    </tr>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function FilterButton({
  label, count, active, onClick,
}: {
  label: string; count: number; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
        active
          ? "bg-indigo-600 border-indigo-600 text-white"
          : "border-slate-200 text-slate-600 hover:border-slate-300 bg-white"
      }`}
    >
      {label}
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
        {count}
      </span>
    </button>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color?: "green" | "red" | "amber" }) {
  const c = color === "green" ? "text-green-600" : color === "red" ? "text-red-600" : color === "amber" ? "text-amber-600" : "text-slate-900";
  return (
    <div>
      <p className={`text-2xl font-bold ${c}`}>{value}</p>
      <p className="text-xs text-slate-400 mt-0.5">{label}</p>
    </div>
  );
}

function PromptSection({ prompt }: { prompt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-6 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-slate-50 transition-colors border-b border-slate-100"
        onClick={() => setOpen((o) => !o)}
      >
        <Code2 size={15} className="text-slate-400" />
        <span className="text-sm font-semibold text-slate-700">Prompt used</span>
        <span className="ml-auto text-slate-300">{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</span>
      </div>
      {open && (
        <div className="p-5">
          <pre className="text-xs font-mono text-slate-600 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-lg p-4 max-h-80 overflow-y-auto">
            {prompt}
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
      <Link to="/history?tab=ak" className="text-indigo-600 text-sm mt-2 inline-block">← Back to history</Link>
    </div>
  );
}
