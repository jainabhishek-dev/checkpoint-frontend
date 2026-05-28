import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import {
  adminGetWorkflows,
  adminAddCheckpoint,
  adminEditCheckpoint,
  adminDeleteCheckpoint,
  getCheckpoints,
} from "../../api/workflows";
import type { Checkpoint, Workflow } from "../../types";

export default function CheckpointsPage() {
  const queryClient = useQueryClient();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string>("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: wfData } = useQuery({
    queryKey: ["admin-workflows"],
    queryFn: adminGetWorkflows,
  });

  const reviewWorkflows = (wfData?.workflows ?? []).filter((w) => w.type === "review");

  // Auto-select first review workflow
  const activeId = selectedWorkflowId || reviewWorkflows[0]?.id || "";

  const { data: cpData, isLoading } = useQuery({
    queryKey: ["checkpoints", activeId],
    queryFn: () => getCheckpoints(activeId),
    enabled: !!activeId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteCheckpoint(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["checkpoints", activeId] });
      setConfirmDelete(null);
    },
  });

  const categories = cpData?.categories ?? {};
  const allCheckpoints = cpData?.checkpoints ?? [];

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Checkpoints</h1>
          <p className="text-slate-500 mt-1">Manage review criteria for each workflow.</p>
        </div>
        {activeId && (
          <button
            onClick={() => { setShowAdd(true); setEditingId(null); }}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={14} /> Add checkpoint
          </button>
        )}
      </div>

      {/* Workflow selector */}
      {reviewWorkflows.length > 1 && (
        <div className="mb-4">
          <select
            value={activeId}
            onChange={(e) => { setSelectedWorkflowId(e.target.value); setShowAdd(false); setEditingId(null); }}
            className="text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {reviewWorkflows.map((wf) => (
              <option key={wf.id} value={wf.id}>{wf.name}</option>
            ))}
          </select>
        </div>
      )}

      {reviewWorkflows.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <p className="text-slate-400 text-sm">No review workflows yet. Create one first.</p>
        </div>
      )}

      {/* Add form */}
      {showAdd && activeId && (
        <AddCheckpointForm
          workflowId={activeId}
          allWorkflows={reviewWorkflows}
          onDone={() => {
            setShowAdd(false);
            queryClient.invalidateQueries({ queryKey: ["checkpoints", activeId] });
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* Checkpoint list */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-400 mt-4">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : allCheckpoints.length === 0 && activeId ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <p className="text-slate-400 text-sm">No checkpoints yet. Add one above.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(categories).map(([cat, cps]) => (
            <CategorySection
              key={cat}
              category={cat}
              checkpoints={cps}
              editingId={editingId}
              confirmDelete={confirmDelete}
              onEdit={(id) => setEditingId(id)}
              onCancelEdit={() => setEditingId(null)}
              onEditDone={(id) => {
                setEditingId(null);
                queryClient.invalidateQueries({ queryKey: ["checkpoints", activeId] });
                void id;
              }}
              onDelete={(id) => setConfirmDelete(id)}
              onCancelDelete={() => setConfirmDelete(null)}
              onConfirmDelete={(id) => deleteMutation.mutate(id)}
              deletePending={deleteMutation.isPending}
              allWorkflows={reviewWorkflows}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Category section ──────────────────────────────────────────────────────────

function CategorySection({
  category, checkpoints, editingId, confirmDelete,
  onEdit, onCancelEdit, onEditDone, onDelete, onCancelDelete, onConfirmDelete,
  deletePending, allWorkflows,
}: {
  category: string;
  checkpoints: Checkpoint[];
  editingId: string | null;
  confirmDelete: string | null;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onEditDone: (id: string) => void;
  onDelete: (id: string) => void;
  onCancelDelete: () => void;
  onConfirmDelete: (id: string) => void;
  deletePending: boolean;
  allWorkflows: Workflow[];
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div
        className="flex items-center gap-2 px-5 py-3 bg-slate-50 border-b border-slate-100 cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="text-sm font-semibold text-slate-700 flex-1">{category}</span>
        <span className="text-xs text-slate-400">{checkpoints.length}</span>
        {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
      </div>

      {open && (
        <div className="divide-y divide-slate-100">
          {checkpoints.map((cp) => (
            <div key={cp.id}>
              {editingId === cp.id ? (
                <EditCheckpointForm
                  checkpoint={cp}
                  allWorkflows={allWorkflows}
                  onDone={() => onEditDone(cp.id)}
                  onCancel={onCancelEdit}
                />
              ) : (
                <div className="flex items-start gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="text-xs text-slate-400 font-mono">{cp.id}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        cp.scope === "document" ? "bg-purple-100 text-purple-700" : "bg-slate-100 text-slate-500"
                      }`}>
                        {cp.scope}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                        cp.type === "judgment" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                      }`}>
                        {cp.type}
                      </span>
                    </div>
                    <p className="text-sm text-slate-700 leading-snug">{cp.instructions}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => onEdit(cp.id)}
                      className="p-1.5 text-slate-300 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    {confirmDelete === cp.id ? (
                      <div className="flex items-center gap-2 ml-1">
                        <span className="text-xs text-red-600 font-medium">Delete?</span>
                        <button
                          onClick={() => onConfirmDelete(cp.id)}
                          disabled={deletePending}
                          className="text-xs bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg font-medium"
                        >
                          {deletePending ? <Loader2 size={10} className="animate-spin" /> : "Yes"}
                        </button>
                        <button
                          onClick={onCancelDelete}
                          className="text-xs text-slate-400 hover:text-slate-600 px-1"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onDelete(cp.id)}
                        className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add checkpoint form ───────────────────────────────────────────────────────

function AddCheckpointForm({
  workflowId, allWorkflows, onDone, onCancel,
}: {
  workflowId: string;
  allWorkflows: Workflow[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState("");
  const [instructions, setInstructions] = useState("");
  const [type, setType] = useState("rule");
  const [scope, setScope] = useState("page");
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>([workflowId]);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      adminAddCheckpoint({ category: category.trim(), instructions: instructions.trim(), type, scope, workflows: selectedWorkflows }),
    onSuccess: onDone,
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err?.response?.data?.detail ?? "Failed to add checkpoint.");
    },
  });

  function toggleWorkflow(id: string) {
    setSelectedWorkflows((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-4">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
        New Checkpoint
      </h2>
      <div className="space-y-4">
        <label className="block">
          <span className="text-xs text-slate-500 font-medium mb-1 block">Category</span>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="e.g. Formatting, Citations, Language"
            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        <label className="block">
          <span className="text-xs text-slate-500 font-medium mb-1 block">Instructions</span>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            placeholder="Describe what the AI should check…"
            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </label>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-xs text-slate-500 font-medium mb-2 block">Type</span>
            <div className="flex gap-2">
              {["rule", "judgment"].map((t) => (
                <button key={t} type="button" onClick={() => setType(t)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    type === t ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-slate-500 font-medium mb-2 block">Scope</span>
            <div className="flex gap-2">
              {["page", "document"].map((s) => (
                <button key={s} type="button" onClick={() => setScope(s)}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                    scope === s ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-slate-300"
                  }`}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {allWorkflows.length > 1 && (
          <div>
            <span className="text-xs text-slate-500 font-medium mb-2 block">Workflows</span>
            <div className="flex flex-wrap gap-2">
              {allWorkflows.map((wf) => (
                <label key={wf.id} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedWorkflows.includes(wf.id)}
                    onChange={() => toggleWorkflow(wf.id)}
                    className="rounded border-slate-300 text-indigo-600"
                  />
                  <span className="text-xs text-slate-600">{wf.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => {
              if (!category.trim() || !instructions.trim()) { setError("Category and instructions are required."); return; }
              if (selectedWorkflows.length === 0) { setError("Select at least one workflow."); return; }
              mutation.mutate();
            }}
            disabled={mutation.isPending}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            {mutation.isPending && <Loader2 size={13} className="animate-spin" />}
            Add checkpoint
          </button>
          <button onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-600 px-3">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit checkpoint form ──────────────────────────────────────────────────────

function EditCheckpointForm({
  checkpoint, allWorkflows, onDone, onCancel,
}: {
  checkpoint: Checkpoint;
  allWorkflows: Workflow[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [instructions, setInstructions] = useState(checkpoint.instructions);
  const [type, setType] = useState(checkpoint.type);
  const [scope, setScope] = useState(checkpoint.scope);
  const [selectedWorkflows, setSelectedWorkflows] = useState<string[]>(checkpoint.workflows ?? []);
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      adminEditCheckpoint(checkpoint.id, { instructions: instructions.trim(), type, scope, workflows: selectedWorkflows }),
    onSuccess: onDone,
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err?.response?.data?.detail ?? "Failed to save.");
    },
  });

  function toggleWorkflow(id: string) {
    setSelectedWorkflows((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  return (
    <div className="px-4 py-4 space-y-3 bg-slate-50">
      <textarea
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        rows={2}
        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
      />
      <div className="flex gap-4 flex-wrap">
        <div>
          <span className="text-xs text-slate-400 mb-1 block">Type</span>
          <div className="flex gap-2">
            {["rule", "judgment"].map((t) => (
              <button key={t} type="button" onClick={() => setType(t as "rule" | "judgment")}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                  type === t ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-xs text-slate-400 mb-1 block">Scope</span>
          <div className="flex gap-2">
            {["page", "document"].map((s) => (
              <button key={s} type="button" onClick={() => setScope(s as "page" | "document")}
                className={`text-xs px-2.5 py-1 rounded-lg border font-medium transition-colors ${
                  scope === s ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500"
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
      {allWorkflows.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {allWorkflows.map((wf) => (
            <label key={wf.id} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedWorkflows.includes(wf.id)}
                onChange={() => toggleWorkflow(wf.id)}
                className="rounded border-slate-300 text-indigo-600"
              />
              <span className="text-xs text-slate-600">{wf.name}</span>
            </label>
          ))}
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          {mutation.isPending && <Loader2 size={11} className="animate-spin" />}
          Save
        </button>
        <button onClick={onCancel} className="text-xs text-slate-400 hover:text-slate-600 px-2">
          Cancel
        </button>
      </div>
    </div>
  );
}
