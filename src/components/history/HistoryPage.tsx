// useState not needed — tab/workflow state is in URL search params
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ExternalLink, Loader2, FileText, GitCompare, BookOpen, Clock, AlertTriangle, XCircle,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { getHistory, HISTORY_PAGE_SIZE } from "../../api/history";
import { runProgressInfo, type RunProgressKind } from "../../lib/runStatus";
import type { Run, CicRun, AkRun } from "../../types";

const PROGRESS_BADGE_STYLE: Record<RunProgressKind, { className: string; icon: React.ReactNode }> = {
  completed: { className: "bg-green-100 text-green-700", icon: null },
  failed: { className: "bg-red-100 text-red-700", icon: <XCircle size={12} /> },
  stale: { className: "bg-amber-100 text-amber-700", icon: <AlertTriangle size={12} /> },
  processing: { className: "bg-indigo-100 text-indigo-700", icon: <Clock size={12} className="animate-spin" /> },
};

export default function HistoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") ?? "review") as "review" | "cic" | "ak";
  const workflow = searchParams.get("workflow") ?? "";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  function setTab(t: "review" | "cic" | "ak") {
    const p = new URLSearchParams(searchParams);
    p.set("tab", t);
    p.delete("workflow");
    p.delete("page");
    setSearchParams(p);
  }

  function setWorkflow(wf: string) {
    const p = new URLSearchParams(searchParams);
    if (wf) p.set("workflow", wf);
    else p.delete("workflow");
    p.delete("page");
    setSearchParams(p);
  }

  function setPage(n: number) {
    const p = new URLSearchParams(searchParams);
    if (n <= 1) p.delete("page");
    else p.set("page", String(n));
    setSearchParams(p);
  }

  const { data, isLoading, isPlaceholderData } = useQuery({
    queryKey: ["history", tab, workflow, page],
    queryFn: () => getHistory(tab, workflow || undefined, page),
    placeholderData: (prev) => prev,
  });

  const workflows =
    tab === "review" ? (data?.review_workflows ?? []) :
    tab === "cic" ? (data?.cic_workflows ?? []) :
    (data?.ak_workflows ?? []);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">History</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1 w-fit mb-6">
        <TabButton active={tab === "review"} onClick={() => setTab("review")} icon={<FileText size={14} />} label="Review runs" />
        <TabButton active={tab === "cic"} onClick={() => setTab("cic")} icon={<GitCompare size={14} />} label="CIC runs" />
        <TabButton active={tab === "ak"} onClick={() => setTab("ak")} icon={<BookOpen size={14} />} label="AK Reviews" />
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
      ) : (
        <div className={isPlaceholderData ? "opacity-50 transition-opacity" : "transition-opacity"}>
          {tab === "review" ? (
            <ReviewTable runs={data?.runs ?? []} />
          ) : tab === "cic" ? (
            <CicTable runs={data?.cic_runs ?? []} />
          ) : (
            <AkTable runs={data?.ak_runs ?? []} />
          )}
          {total > 0 && (
            <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />
          )}
        </div>
      )}
    </div>
  );
}

function Pagination({
  page, totalPages, total, onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  const start = (page - 1) * HISTORY_PAGE_SIZE + 1;
  const end = Math.min(page * HISTORY_PAGE_SIZE, total);

  return (
    <div className="flex items-center justify-between mt-4 text-sm">
      <p className="text-slate-400">
        Showing {start}–{end} of {total}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <span className="text-slate-400 px-1">Page {page} of {totalPages}</span>
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <Th>Document</Th>
            <Th>Workflow</Th>
            <Th>Checked by</Th>
            <Th>Date</Th>
            <Th>Status</Th>
            <Th center>Pages</Th>
            <Th center>Findings</Th>
            <Th center>Valid</Th>
            <Th center>Invalid</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {runs.map((run) => {
            const progress = runProgressInfo(run);
            const badge = PROGRESS_BADGE_STYLE[progress.kind];
            return (
              <tr key={run.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 max-w-xs" title={run.document_name ?? ""}>
                  <p className="font-medium text-slate-900 truncate">{run.document_name ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{run.workflow_name}</td>
                <td className="px-4 py-3 text-slate-500 max-w-[160px]" title={run.checked_by}>
                  <p className="truncate">{run.checked_by}</p>
                </td>
                <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{run.created_at?.slice(0, 16)}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${badge.className}`}>
                    {badge.icon}{progress.label}
                  </span>
                </td>
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
            );
          })}
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
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
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
              <td className="px-4 py-3 max-w-[180px] font-medium text-slate-900" title={run.commented_file_name ?? ""}>
                <p className="truncate">{run.commented_file_name ?? "—"}</p>
              </td>
              <td className="px-4 py-3 max-w-[180px] text-slate-500" title={run.revised_file_name ?? ""}>
                <p className="truncate">{run.revised_file_name ?? "—"}</p>
              </td>
              <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{run.workflow_name}</td>
              <td className="px-4 py-3 text-slate-500 max-w-[160px]" title={run.checked_by}>
                <p className="truncate">{run.checked_by}</p>
              </td>
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

function AkTable({ runs }: { runs: AkRun[] }) {
  if (runs.length === 0) {
    return <EmptyState message="No AK Reviews yet. Start one from the dashboard." />;
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>
            <Th>Chapter</Th>
            <Th>Answer Key</Th>
            <Th>Workflow</Th>
            <Th>Checked by</Th>
            <Th>Date</Th>
            <Th center>Total Qs</Th>
            <Th center>Missing</Th>
            <Th center>Incorrect</Th>
            <Th center>Manual</Th>
            <Th></Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {runs.map((run) => (
            <tr key={run.id} className="hover:bg-slate-50 transition-colors">
              <td className="px-4 py-3 max-w-[180px] font-medium text-slate-900" title={run.chapter_file_name ?? ""}>
                <p className="truncate">{run.chapter_file_name ?? "—"}</p>
              </td>
              <td className="px-4 py-3 max-w-[180px] text-slate-500" title={run.ak_file_name ?? ""}>
                <p className="truncate">{run.ak_file_name ?? "—"}</p>
              </td>
              <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{run.workflow_name}</td>
              <td className="px-4 py-3 text-slate-500 max-w-[160px]" title={run.checked_by}>
                <p className="truncate">{run.checked_by}</p>
              </td>
              <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{run.created_at?.slice(0, 16)}</td>
              <Td center>{run.total_questions}</Td>
              <Td center><span className={run.missing_from_ak > 0 ? "text-red-600 font-medium" : ""}>{run.missing_from_ak}</span></Td>
              <Td center><span className={run.incorrect_answers > 0 ? "text-red-600 font-medium" : ""}>{run.incorrect_answers}</span></Td>
              <Td center><span className={run.manual_review_cases > 0 ? "text-amber-600 font-medium" : ""}>{run.manual_review_cases}</span></Td>
              <td className="px-4 py-3">
                <Link to={`/history/ak/${run.id}`} className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1 whitespace-nowrap">
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
    <th className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-400 whitespace-nowrap ${center ? "text-center" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, center }: { children?: React.ReactNode; center?: boolean }) {
  return <td className={`px-4 py-3 whitespace-nowrap ${center ? "text-center" : ""}`}>{children}</td>;
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
      <p className="text-slate-400 text-sm">{message}</p>
    </div>
  );
}
