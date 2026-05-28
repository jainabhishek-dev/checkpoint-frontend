import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronUp, Wand2 } from "lucide-react";
import {
  adminGetWorkflows,
  adminAddWorkflow,
  adminEditWorkflow,
  adminDeleteWorkflow,
} from "../../api/workflows";
import type { Workflow } from "../../types";

export default function WorkflowsPage() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-workflows"],
    queryFn: adminGetWorkflows,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminDeleteWorkflow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setConfirmDelete(null);
    },
  });

  const workflows = data?.workflows ?? [];
  const checkpointCounts = data?.checkpoint_counts ?? {};

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Workflows</h1>
          <p className="text-slate-500 mt-1">Create and manage review and CIC workflows.</p>
        </div>
        <button
          onClick={() => { setShowAdd(true); setEditingId(null); }}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors shadow-sm whitespace-nowrap"
        >
          <Plus size={14} /> New workflow
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <AddWorkflowForm
          onDone={() => {
            setShowAdd(false);
            queryClient.invalidateQueries({ queryKey: ["admin-workflows"] });
            queryClient.invalidateQueries({ queryKey: ["workflows"] });
          }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* List */}
      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-400 mt-8">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : workflows.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <p className="text-slate-400 text-sm">No workflows yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workflows.map((wf) => (
            <div key={wf.id} className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              {editingId === wf.id ? (
                <EditWorkflowForm
                  workflow={wf}
                  onDone={() => {
                    setEditingId(null);
                    queryClient.invalidateQueries({ queryKey: ["admin-workflows"] });
                    queryClient.invalidateQueries({ queryKey: ["workflows"] });
                  }}
                  onCancel={() => setEditingId(null)}
                />
              ) : (
                <div className="px-5 py-4 flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900">{wf.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        wf.type === "cic"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {wf.type === "cic" ? "CIC" : "Review"}
                      </span>
                      {wf.type === "review" && (
                        <span className="text-xs text-slate-400">
                          {checkpointCounts[wf.id] ?? 0} checkpoint{(checkpointCounts[wf.id] ?? 0) !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                    {wf.description && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{wf.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setEditingId(wf.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                      title="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    {confirmDelete === wf.id ? (
                      <div className="flex items-center gap-2 ml-1">
                        <span className="text-xs text-red-600 font-medium">Delete?</span>
                        <button
                          onClick={() => deleteMutation.mutate(wf.id)}
                          disabled={deleteMutation.isPending}
                          className="text-xs bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg font-medium transition-colors"
                        >
                          {deleteMutation.isPending ? <Loader2 size={10} className="animate-spin" /> : "Yes"}
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs text-slate-400 hover:text-slate-600 px-1"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(wf.id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={14} />
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

// ── Add workflow form ─────────────────────────────────────────────────────────

function AddWorkflowForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("review");
  const [action, setAction] = useState("manual");
  const [aiNotes, setAiNotes] = useState("");
  const [error, setError] = useState("");
  const [showAi, setShowAi] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      adminAddWorkflow({ name: name.trim(), description: description.trim(), type, action, ai_notes: aiNotes.trim() }),
    onSuccess: () => { onDone(); },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err?.response?.data?.detail ?? "Failed to create workflow.");
    },
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-4">
      <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
        New Workflow
      </h2>
      <div className="space-y-4">
        {/* Type */}
        <div className="flex gap-3">
          {["review", "cic"].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`text-sm px-4 py-2 rounded-xl border font-medium transition-colors ${
                type === t
                  ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              }`}
            >
              {t === "cic" ? "CIC" : "Review"}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="text-xs text-slate-500 font-medium mb-1 block">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Academic Paper Review"
            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        <label className="block">
          <span className="text-xs text-slate-500 font-medium mb-1 block">Description (optional)</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description shown to users"
            className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </label>

        {/* AI generation (review only) */}
        {type === "review" && (
          <div>
            <button
              type="button"
              onClick={() => setShowAi((o) => !o)}
              className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <Wand2 size={12} />
              {showAi ? "Hide" : "Generate checkpoints with AI"}
              {showAi ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
            {showAi && (
              <div className="mt-3 space-y-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAction("generate")}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                      action === "generate"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    Generate checkpoints
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction("manual")}
                    className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                      action === "manual"
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    Start empty
                  </button>
                </div>
                {action === "generate" && (
                  <label className="block">
                    <span className="text-xs text-slate-500 font-medium mb-1 block">
                      Notes for AI (describe the document type and what to check)
                    </span>
                    <textarea
                      value={aiNotes}
                      onChange={(e) => setAiNotes(e.target.value)}
                      rows={3}
                      placeholder="e.g. This workflow is for reviewing academic research papers. Check for citation format, abstract completeness, and figure caption quality."
                      className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => {
              if (!name.trim()) { setError("Workflow name is required."); return; }
              mutation.mutate();
            }}
            disabled={mutation.isPending}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            {mutation.isPending && <Loader2 size={13} className="animate-spin" />}
            Create
          </button>
          <button onClick={onCancel} className="text-sm text-slate-400 hover:text-slate-600 px-3">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit workflow form ────────────────────────────────────────────────────────

function EditWorkflowForm({
  workflow, onDone, onCancel,
}: {
  workflow: Workflow;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description ?? "");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: () => adminEditWorkflow(workflow.id, { name: name.trim(), description: description.trim() }),
    onSuccess: onDone,
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err?.response?.data?.detail ?? "Failed to save.");
    },
  });

  return (
    <div className="px-5 py-4 space-y-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="Workflow name"
      />
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        placeholder="Description (optional)"
      />
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
