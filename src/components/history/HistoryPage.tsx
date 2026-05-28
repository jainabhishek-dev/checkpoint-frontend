// useState not needed — tab/workflow state is in URL search params
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, FileText, GitCompare } from "lucide-react";
import { getHistory } from "../../api/history";
import type { Run, CicRun } from "../../types";

export default function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") ?? "review") as "review" | "cic";
  const workflow = searchParams.get("workflow") ?? "";

  function setTab(t: "review" | "cic") {
    const p = new URLSearchParams(searchParams);
    p.set("tab", t);
    p.delete("workflow");
    setSearchParams(p);
  }

  function setWorkflow(wf: string) {
    const p = new URLSearchParams(searchParams);
    if (wf) p.set("workflow", wf);
    else p.delete("workflow");
    setSearchParams(p);
  }

  const { data, isLoading } = useQuery({
    queryKey: ["history", tab, workflow],
    queryFn: () => getHistory(tab, workflow || undefined),
  });

  const workflows = tab === "review" ? (data?.review_workflows ?? []) : (data?.cic_workflows ?? []);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">History</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6">
        <TabButton active={tab === "review"} onClick={() => setTab("review")} icon={<FileText size={14} />} label="Review runs" />
        <TabButton active={tab === "cic"} onClick={() => setTab("cic")} icon={<GitCompare size={14} />} label="CIC runs" />
      </div>

      {/* Workflow filter */}
      {workflows.length > 1 && (
        <div className="mb-4">
          <select
            value={workflow}
            onChange={(e) => setWorkflow(e.target.value)}
            className="text-sm border border-slate-300 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All workflows</option>
            {workflows.map((wf) => (
              <option key={wf.id} value={wf.id}>{wf.name}</option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-400 mt-8">
          <Loader2 size={18} className="animate-spin" /> Loading…
        </div>
      ) : tab === "review" ? (
        <ReviewTable runs={data?.runs ?? []} />
      ) : (
        <CicTable runs={data?.cic_runs ?? []} />
      )}
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
      }`}
    >
      {icon}{label}
    </button>
  );
}

function ReviewTable({ runs }: { runs: Run[] }) {
  if (runs.length === 0) {
    return <EmptyState message="No review runs yet. Run a check from the dashboard." />;
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <Th>Document</Th>
            <Th>Workflow</Th>
            <Th>Checked by</Th>
            <Th>Date</Th>
            <Th center>Pages</Th>
            <Th center>Findings</Th>
            <Th center>Valid</Th>
            <Th center>Invalid</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {runs.map((run) => (
            <tr key={run.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900 truncate max-w-xs">{run.document_name ?? "—"}</p>
              </td>
              <td className="px-4 py-3 text-slate-500">{run.workflow_name}</td>
              <td className="px-4 py-3 text-slate-500 truncate max-w-[140px]">{run.checked_by}</td>
              <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{run.created_at?.slice(0, 16)}</td>
              <Td center>{run.total_pages}</Td>
              <Td center>{run.total_findings}</Td>
              <Td center><span className="text-green-600 font-medium">{run.valid_findings}</span></Td>
              <Td center><span className="text-red-600 font-medium">{run.invalid_findings}</span></Td>
              <td className="px-4 py-3">
                <Link to={`/history/${run.id}`} className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 whitespace-nowrap">
                  View <ExternalLink size={12} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CicTable({ runs }: { runs: CicRun[] }) {
  if (runs.length === 0) {
    return <EmptyState message="No CIC runs yet. Start one from the dashboard." />;
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <Th>Commented file</Th>
            <Th>Revised file</Th>
            <Th>Workflow</Th>
            <Th>Checked by</Th>
            <Th>Date</Th>
            <Th center>Comments</Th>
            <Th center>Fixed</Th>
            <Th center>Not fixed</Th>
            <Th center>Not sure</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {runs.map((run) => (
            <tr key={run.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 truncate max-w-[160px] font-medium text-slate-900">{run.commented_file_name ?? "—"}</td>
              <td className="px-4 py-3 truncate max-w-[160px] text-slate-500">{run.revised_file_name ?? "—"}</td>
              <td className="px-4 py-3 text-slate-500">{run.workflow_name}</td>
              <td className="px-4 py-3 text-slate-500 truncate max-w-[140px]">{run.checked_by}</td>
              <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{run.created_at?.slice(0, 16)}</td>
              <Td center>{run.total_comments}</Td>
              <Td center><span className="text-green-600 font-medium">{run.fixed_count}</span></Td>
              <Td center><span className="text-red-600 font-medium">{run.not_fixed_count}</span></Td>
              <Td center><span className="text-amber-600 font-medium">{run.not_sure_count}</span></Td>
              <td className="px-4 py-3">
                <Link to={`/history/cic/${run.id}`} className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 whitespace-nowrap">
                  View <ExternalLink size={12} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, center }: { children?: React.ReactNode; center?: boolean }) {
  return (
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 ${center ? "text-center" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, center }: { children?: React.ReactNode; center?: boolean }) {
  return <td className={`px-4 py-3 ${center ? "text-center" : ""}`}>{children}</td>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
      <p className="text-slate-400 text-sm">{message}</p>
    </div>
  );
}
