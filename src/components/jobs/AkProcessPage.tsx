import { useEffect, useRef, useState } from "react";
import { useParams, useLocation, Link } from "react-router-dom";
import {
  CheckCircle2, XCircle, HelpCircle, Loader2, BookOpen, ChevronDown, ChevronUp,
} from "lucide-react";
import { getAkStreamUrl } from "../../api/jobs";
import type { AkQuestionResult } from "../../types";

type ExerciseStatus = "pending" | "extracting" | "extracted" | "reviewing" | "done";

interface ExerciseState {
  name: string;
  status: ExerciseStatus;
  questionCount: number;
}

type Phase = "scanning" | "extracting" | "reviewing" | "done" | "error";

export default function AkProcessPage() {
  const { job_id } = useParams<{ job_id: string }>();
  const locState = useLocation().state as { chapter_title?: string; ak_title?: string } | null;

  const [phase, setPhase] = useState<Phase>("scanning");
  const [exercises, setExercises] = useState<ExerciseState[]>([]);
  const [currentExercise, setCurrentExercise] = useState<string | null>(null);
  const [questions, setQuestions] = useState<AkQuestionResult[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const esRef = useRef<EventSource | null>(null);

  const chapterTitle = locState?.chapter_title ?? "Chapter";
  const akTitle = locState?.ak_title ?? "Answer Key";

  useEffect(() => {
    if (!job_id) return;
    const url = getAkStreamUrl(job_id);
    const es = new EventSource(url, { withCredentials: true });
    esRef.current = es;

    // Phase 1: exercise names known — mark first as extracting immediately
    es.addEventListener("ak_exercises_found", (e) => {
      const d = JSON.parse(e.data) as { exercises: string[] };
      setPhase("extracting");
      setExercises(d.exercises.map((name, i) => ({
        name,
        status: i === 0 ? "extracting" : "pending",
        questionCount: 0,
      })));
    });

    // Phase 2: per-exercise question extraction complete
    es.addEventListener("ak_exercise_extracted", (e) => {
      const d = JSON.parse(e.data) as { exercise_no: string; question_count: number };
      setCurrentExercise(d.exercise_no);  // track which is currently being extracted
      setExercises((prev) => {
        const updated = prev.map((ex) =>
          ex.name === d.exercise_no
            ? { ...ex, status: "extracted" as ExerciseStatus, questionCount: d.question_count }
            : ex
        );
        // Mark the next pending exercise as "extracting"
        const nextPending = updated.find(ex => ex.status === "pending");
        if (nextPending) {
          return updated.map(ex => ex.name === nextPending.name ? { ...ex, status: "extracting" as ExerciseStatus } : ex);
        }
        return updated;
      });
    });

    // Phase 3: all extraction done, review begins
    es.addEventListener("ak_start", (e) => {
      setPhase("reviewing");
      setCurrentExercise(null);
      // Keep questionCount from extraction, reset status to pending for review tracking
      setExercises((prev) => prev.map((ex) => ({ ...ex, status: "pending" })));
    });

    es.addEventListener("ak_exercise_start", (e) => {
      const d = JSON.parse(e.data) as { exercise_no: string; question_count: number };
      setCurrentExercise(d.exercise_no);
      setExercises((prev) =>
        prev.map((ex) =>
          ex.name === d.exercise_no
            ? { ...ex, status: "reviewing", questionCount: d.question_count }
            : ex
        )
      );
    });

    es.addEventListener("ak_question", (e) => {
      const d = JSON.parse(e.data) as AkQuestionResult;
      setQuestions((prev) => [...prev, d]);
    });

    es.addEventListener("ak_exercise_done", (e) => {
      const d = JSON.parse(e.data) as { exercise_no: string };
      setExercises((prev) =>
        prev.map((ex) => (ex.name === d.exercise_no ? { ...ex, status: "done" } : ex))
      );
    });

    es.addEventListener("ak_done", (e) => {
      const d = JSON.parse(e.data) as { run_id: string };
      setRunId(d.run_id);
      setPhase("done");
      setCurrentExercise(null);
      es.close();
    });

    es.addEventListener("error", (e) => {
      try {
        const d = JSON.parse((e as MessageEvent).data) as { message: string };
        setErrorMsg(d.message);
      } catch {
        setErrorMsg("An error occurred during processing.");
      }
      setPhase("error");
      es.close();
    });

    return () => { es.close(); };
  }, [job_id]);

  // Computed summary
  const total = questions.length;
  const issues = questions.filter(
    (q) => q.present_in_ak === "No" || q.answer_correct === "No" || q.answer_correct === "Manual Review Required"
  ).length;
  const missing = questions.filter((q) => q.present_in_ak === "No").length;
  const incorrect = questions.filter((q) => q.answer_correct === "No").length;
  const manual = questions.filter((q) => q.answer_correct === "Manual Review Required").length;

  // Group questions by exercise for the table
  const questionsByExercise: Record<string, AkQuestionResult[]> = {};
  for (const q of questions) {
    const ex = q.exercise_no ?? "Unknown";
    if (!questionsByExercise[ex]) questionsByExercise[ex] = [];
    questionsByExercise[ex].push(q);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={16} className="text-indigo-500" />
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Answer Key Review</h1>
              {phase === "scanning" && (
                <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-0.5">
                  <Loader2 size={11} className="animate-spin" /> Scanning chapter…
                </span>
              )}
              {phase === "extracting" && (
                <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
                  <Loader2 size={11} className="animate-spin" /> Extracting questions…
                </span>
              )}
              {phase === "reviewing" && (
                <span className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-0.5">
                  <Loader2 size={11} className="animate-spin" /> Reviewing…
                </span>
              )}
              {phase === "done" && (
                <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
                  <CheckCircle2 size={11} /> Complete
                </span>
              )}
              {phase === "error" && (
                <span className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-full px-2.5 py-0.5">
                  <XCircle size={11} /> Error
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500">{chapterTitle} · {akTitle}</p>
          </div>
          {phase === "done" && runId && (
            <Link
              to={`/history/ak/${runId}`}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl px-4 py-2 transition-colors"
            >
              View full report →
            </Link>
          )}
        </div>

        {phase === "error" && errorMsg && (
          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            {errorMsg}
          </div>
        )}

        {/* Summary bar */}
        {total > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-sm">
            <SummaryStat label="Reviewed" value={total} />
            <SummaryStat label="Issues found" value={issues} color={issues > 0 ? "red" : "green"} />
            <SummaryStat label="Missing from AK" value={missing} color={missing > 0 ? "red" : undefined} />
            <SummaryStat label="Incorrect" value={incorrect} color={incorrect > 0 ? "red" : undefined} />
            <SummaryStat label="Manual review" value={manual} color={manual > 0 ? "amber" : undefined} />
          </div>
        )}
      </div>

      <div className="flex gap-5">
        {/* Left: Exercise progress panel */}
        {exercises.length > 0 && (
          <div className="w-52 flex-shrink-0">
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden sticky top-6">
              <div className="px-4 py-3 border-b border-slate-100">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Exercises</span>
              </div>
              <div className="divide-y divide-slate-100">
                {exercises.map((ex) => (
                  <div key={ex.name} className="px-4 py-2.5 flex items-center gap-2.5">
                    {ex.status === "done" && <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />}
                    {ex.status === "extracted" && <CheckCircle2 size={13} className="text-amber-400 flex-shrink-0" />}
                    {(ex.status === "reviewing" || ex.status === "extracting") && <Loader2 size={13} className="animate-spin text-indigo-500 flex-shrink-0" />}
                    {ex.status === "pending" && <div className="w-3 h-3 rounded-full border border-slate-300 flex-shrink-0" />}
                    <div className="min-w-0">
                      <p className={`text-xs font-medium truncate ${
                        ex.status === "reviewing" || ex.status === "extracting" ? "text-indigo-700" :
                        ex.status === "done" || ex.status === "extracted" ? "text-slate-700" : "text-slate-400"
                      }`}>{ex.name}</p>
                      {(ex.status === "extracted" || ex.status === "done" || ex.status === "reviewing") && (
                        <p className="text-xs text-slate-400">{ex.questionCount} questions</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Right: Results table */}
        <div className="flex-1 min-w-0">
          {phase === "scanning" && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
              <Loader2 size={24} className="animate-spin text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Scanning chapter for exercises…</p>
              <p className="text-xs text-slate-400 mt-1">Identifying all exercise sections.</p>
            </div>
          )}
          {phase === "extracting" && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm text-center">
              <Loader2 size={24} className="animate-spin text-amber-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Extracting questions exercise by exercise…</p>
              <p className="text-xs text-slate-400 mt-1">Review results will appear here once extraction is complete.</p>
            </div>
          )}

          {Object.entries(questionsByExercise).map(([exerciseName, qs]) => (
            <ExerciseGroup
              key={exerciseName}
              exerciseName={exerciseName}
              questions={qs}
              isReviewing={currentExercise === exerciseName}
            />
          ))}

          {phase === "reviewing" && currentExercise && questionsByExercise[currentExercise] === undefined && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-4">
              <div className="flex items-center gap-2 text-sm text-indigo-600">
                <Loader2 size={14} className="animate-spin" />
                Reviewing {currentExercise}…
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Exercise group ─────────────────────────────────────────────────────────────

function ExerciseGroup({
  exerciseName, questions, isReviewing,
}: {
  exerciseName: string;
  questions: AkQuestionResult[];
  isReviewing: boolean;
}) {
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
        {isReviewing && (
          <span className="flex items-center gap-1 text-xs text-indigo-600">
            <Loader2 size={11} className="animate-spin" /> reviewing…
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
  const rowClass = isIssue
    ? "bg-red-50/60"
    : isManual
    ? "bg-amber-50/60"
    : "";

  return (
    <tr className={`${rowClass} hover:bg-slate-50/80 transition-colors`}>
      <td className="px-4 py-2.5 text-slate-400">{q.page_no ?? "—"}</td>
      <td className="px-4 py-2.5 font-medium text-slate-700">{q.question_no}</td>
      <td className="px-4 py-2.5">
        {q.present_in_ak === "Yes" ? (
          <span className="flex items-center gap-1 text-green-700">
            <CheckCircle2 size={12} /> Yes
          </span>
        ) : (
          <span className="flex items-center gap-1 text-red-600">
            <XCircle size={12} /> No
          </span>
        )}
      </td>
      <td className="px-4 py-2.5">
        {q.answer_correct === "Yes" ? (
          <span className="flex items-center gap-1 text-green-700">
            <CheckCircle2 size={12} /> Yes
          </span>
        ) : q.answer_correct === "No" ? (
          <span className="flex items-center gap-1 text-red-600">
            <XCircle size={12} /> No
          </span>
        ) : q.answer_correct === "Manual Review Required" ? (
          <span className="flex items-center gap-1 text-amber-600">
            <HelpCircle size={12} /> Manual Review
          </span>
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

// ── Summary stat ───────────────────────────────────────────────────────────────

function SummaryStat({
  label, value, color,
}: {
  label: string;
  value: number;
  color?: "red" | "green" | "amber";
}) {
  const c =
    color === "red" ? "text-red-600" :
    color === "green" ? "text-green-600" :
    color === "amber" ? "text-amber-600" :
    "text-slate-700";
  return (
    <div>
      <span className={`font-bold ${c}`}>{value}</span>
      <span className="text-slate-400 ml-1">{label}</span>
    </div>
  );
}
