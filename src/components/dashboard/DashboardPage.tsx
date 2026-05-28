import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Link2, Loader2, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { getWorkflows, getCheckpoints } from "../../api/workflows";
import { startReviewJob, startCicJob } from "../../api/jobs";
import type { Workflow, Checkpoint } from "../../types";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [driveUrl, setDriveUrl] = useState("");
  const [commentedUrl, setCommentedUrl] = useState("");
  const [revisedUrl, setRevisedUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const { data: wfData, isLoading: wfLoading } = useQuery({
    queryKey: ["workflows"],
    queryFn: getWorkflows,
  });

  const { data: cpData } = useQuery({
    queryKey: ["checkpoints", selectedWorkflow?.id],
    queryFn: () => getCheckpoints(selectedWorkflow!.id),
    enabled: !!selectedWorkflow && selectedWorkflow.type === "review",
  });

  const isCic = selectedWorkflow?.type === "cic";

  function selectWorkflow(wf: Workflow) {
    setSelectedWorkflow(wf);
    setCheckedIds(new Set());
    setError("");
  }

  function toggleCheckpoint(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCategory(cps: Checkpoint[], selected: boolean) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      cps.forEach((cp) => (selected ? next.delete(cp.id) : next.add(cp.id)));
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!selectedWorkflow) { setError("Please select a workflow."); return; }

    setSubmitting(true);
    try {
      if (isCic) {
        const result = await startCicJob({
          workflow_id: selectedWorkflow.id,
          commented_url: commentedUrl.trim(),
          revised_url: revisedUrl.trim(),
        });
        navigate(`/cic-process/${result.job_id}`, { state: result });
      } else {
        if (checkedIds.size === 0) { setError("Please select at least one checkpoint."); setSubmitting(false); return; }
        const result = await startReviewJob({
          drive_url: driveUrl.trim(),
          workflow_id: selectedWorkflow.id,
          checkpoint_ids: Array.from(checkedIds),
        });
        navigate(`/process/${result.job_id}`, { state: result });
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Something went wrong. Please try again.";
      setError(msg);
      setSubmitting(false);
    }
  }

  const reviewWorkflows = wfData?.review_workflows ?? [];
  const cicWorkflows = wfData?.cic_workflows ?? [];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">New Check</h1>
        <p className="text-slate-500 mt-1">Select a workflow, pick your checkpoints, and paste a Drive link.</p>
      </div>

      {wfLoading ? (
        <div className="flex items-center gap-2 text-slate-500"><Loader2 size={18} className="animate-spin" /> Loading workflows…</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Workflow selector */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Select Workflow</h2>

            {reviewWorkflows.length > 0 && (
              <>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Review</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                  {reviewWorkflows.map((wf) => (
                    <WorkflowCard
                      key={wf.id}
                      wf={wf}
                      selected={selectedWorkflow?.id === wf.id}
                      onClick={() => selectWorkflow(wf)}
                    />
                  ))}
                </div>
              </>
            )}

            {cicWorkflows.length > 0 && (
              <>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">CIC</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {cicWorkflows.map((wf) => (
                    <WorkflowCard
                      key={wf.id}
                      wf={wf}
                      selected={selectedWorkflow?.id === wf.id}
                      onClick={() => selectWorkflow(wf)}
                    />
                  ))}
                </div>
              </>
            )}

            {reviewWorkflows.length === 0 && cicWorkflows.length === 0 && (
              <p className="text-sm text-slate-400">No workflows available. Ask an admin to create one.</p>
            )}
          </div>

          {/* CIC: two URL inputs */}
          {isCic && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">File URLs</h2>
              <UrlInput
                label="Commented file (original, with reviewer comments)"
                value={commentedUrl}
                onChange={setCommentedUrl}
                placeholder="https://drive.google.com/file/d/..."
              />
              <UrlInput
                label="Revised file (updated version to check)"
                value={revisedUrl}
                onChange={setRevisedUrl}
                placeholder="https://drive.google.com/file/d/..."
              />
            </div>
          )}

          {/* Review: checkpoint picker + URL */}
          {selectedWorkflow && !isCic && (
            <>
              {cpData && Object.keys(cpData.categories).length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Checkpoints</h2>
                    <div className="flex gap-3 text-xs">
                      <button
                        type="button"
                        onClick={() => setCheckedIds(new Set(cpData.checkpoints.map((c) => c.id)))}
                        className="text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setCheckedIds(new Set())}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="space-y-4">
                    {Object.entries(cpData.categories).map(([cat, cps]) => (
                      <CategoryGroup
                        key={cat}
                        category={cat}
                        checkpoints={cps}
                        checkedIds={checkedIds}
                        onToggle={toggleCheckpoint}
                        onToggleAll={toggleCategory}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-400 mt-3">
                    {checkedIds.size} of {cpData.checkpoints.length} selected
                  </p>
                </div>
              )}

              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">Document URL</h2>
                <UrlInput
                  label="Google Drive link (Doc, Slides, or PDF)"
                  value={driveUrl}
                  onChange={setDriveUrl}
                  placeholder="https://docs.google.com/document/d/..."
                />
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          {selectedWorkflow && (
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium text-sm px-6 py-2.5 rounded-xl transition-colors shadow-sm"
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
              {submitting ? "Starting…" : "Run Check"}
            </button>
          )}
        </form>
      )}
    </div>
  );
}

function WorkflowCard({ wf, selected, onClick }: { wf: Workflow; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
        selected
          ? "border-indigo-500 bg-indigo-50 text-indigo-700"
          : "border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <span className="block font-semibold leading-tight">{wf.name}</span>
      {wf.description && (
        <span className="block text-xs mt-0.5 text-slate-400 line-clamp-1">{wf.description}</span>
      )}
    </button>
  );
}

function UrlInput({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-600 mb-1.5 block">{label}</span>
      <div className="relative">
        <Link2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required
          className="w-full pl-8 pr-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
        />
      </div>
    </label>
  );
}

function CategoryGroup({
  category, checkpoints, checkedIds, onToggle, onToggleAll,
}: {
  category: string;
  checkpoints: Checkpoint[];
  checkedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (cps: Checkpoint[], selected: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const allChecked = checkpoints.every((cp) => checkedIds.has(cp.id));
  const someChecked = checkpoints.some((cp) => checkedIds.has(cp.id));

  return (
    <div className="border border-slate-100 rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 bg-slate-50 cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <input
          type="checkbox"
          checked={allChecked}
          ref={(el) => { if (el) el.indeterminate = someChecked && !allChecked; }}
          onChange={(e) => { e.stopPropagation(); onToggleAll(checkpoints, allChecked); }}
          onClick={(e) => e.stopPropagation()}
          className="rounded border-slate-300 text-indigo-600 cursor-pointer"
        />
        <span className="text-sm font-medium text-slate-700 flex-1">{category}</span>
        <span className="text-xs text-slate-400">{checkpoints.filter((c) => checkedIds.has(c.id)).length}/{checkpoints.length}</span>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </div>
      {open && (
        <div className="divide-y divide-slate-100">
          {checkpoints.map((cp) => (
            <label key={cp.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={checkedIds.has(cp.id)}
                onChange={() => onToggle(cp.id)}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 cursor-pointer flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm text-slate-700 leading-snug">{cp.instructions}</p>
                <div className="flex gap-2 mt-1">
                  <span className="text-xs text-slate-400">{cp.id}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    cp.scope === "document"
                      ? "bg-purple-100 text-purple-700"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {cp.scope}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    cp.type === "judgment"
                      ? "bg-amber-100 text-amber-700"
                      : "bg-blue-100 text-blue-700"
                  }`}>
                    {cp.type}
                  </span>
                </div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
