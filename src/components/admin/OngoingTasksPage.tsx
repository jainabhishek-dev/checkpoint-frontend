import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, Loader2, XCircle } from "lucide-react";
import { adminGetOngoingTasks, adminCancelTask } from "../../api/history";
import type { OngoingTask } from "../../types";

export default function OngoingTasksPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["ongoing-tasks"],
    queryFn: adminGetOngoingTasks,
    refetchInterval: 5000,
  });

  const cancelMutation = useMutation({
    mutationFn: (job_id: string) => adminCancelTask(job_id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ongoing-tasks"] }),
  });

  const tasks = data?.tasks ?? [];

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ongoing Tasks</h1>
        <p className="text-slate-500 mt-1">
          Review runs currently processing on the backend right now. Only review runs are tracked
          here — CIC and AK Review runs aren't yet. List refreshes every few seconds.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Activity size={15} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Running now</span>
          <span className="ml-auto text-xs text-slate-400">{tasks.length}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-400 p-6">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-8 text-sm text-slate-400 text-center">Nothing is running right now.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {tasks.map((task) => (
              <TaskRow
                key={task.job_id}
                task={task}
                onCancel={() => cancelMutation.mutate(task.job_id)}
                cancelling={cancelMutation.isPending && cancelMutation.variables === task.job_id}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({
  task, onCancel, cancelling,
}: {
  task: OngoingTask;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const page = task.last_successful_page ?? 0;
  const total = task.total_pages ?? 0;
  const progress = total > 0 ? Math.round((page / total) * 100) : 0;

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 truncate">{task.document_name ?? "Untitled"}</p>
        <p className="text-xs text-slate-400 mt-0.5">
          {task.workflow_name} · started by {task.checked_by} · {task.started_at}
        </p>
        <div className="flex items-center gap-2 mt-2">
          <div className="h-1.5 w-40 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs text-slate-400 whitespace-nowrap">
            page {page} of {total || "?"}
          </span>
        </div>
      </div>
      <button
        onClick={onCancel}
        disabled={cancelling}
        className="flex items-center gap-1.5 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-50 whitespace-nowrap"
        title="Stops processing after the page currently in flight finishes — not instant."
      >
        {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
        Cancel
      </button>
    </div>
  );
}
