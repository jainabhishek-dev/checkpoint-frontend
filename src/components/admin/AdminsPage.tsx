import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus, Loader2, ShieldCheck } from "lucide-react";
import { adminGetAdmins, adminAddAdmin, adminDeleteAdmin } from "../../api/history";
import { useAuth } from "../../hooks/useAuth";

export default function AdminsPage() {
  const { isSuperAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admins"],
    queryFn: adminGetAdmins,
  });

  const addMutation = useMutation({
    mutationFn: () => adminAddAdmin(email.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admins"] });
      setEmail("");
      setError("");
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      setError(err?.response?.data?.detail ?? "Failed to add admin.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (e: string) => adminDeleteAdmin(e),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admins"] }),
  });

  const admins = data?.admins ?? [];

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Admins</h1>
        <p className="text-slate-500 mt-1">Manage who can access admin features.</p>
      </div>

      {/* Add admin */}
      {isSuperAdmin && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-6">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-4">
            Add Admin
          </h2>
          <div className="flex gap-3">
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="user@example.com"
              className="flex-1 text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() => {
                if (!email.trim()) { setError("Enter an email address."); return; }
                addMutation.mutate();
              }}
              disabled={addMutation.isPending}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              {addMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              Add
            </button>
          </div>
          {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        </div>
      )}

      {/* Admin list */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <ShieldCheck size={15} className="text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">Current admins</span>
          <span className="ml-auto text-xs text-slate-400">{admins.length}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-slate-400 p-6">
            <Loader2 size={16} className="animate-spin" /> Loading…
          </div>
        ) : admins.length === 0 ? (
          <div className="p-6 text-sm text-slate-400 text-center">No admins yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {admins.map((admin) => (
              <div key={admin.email} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{admin.email}</p>
                  {admin.added_by && (
                    <p className="text-xs text-slate-400 mt-0.5">Added by {admin.added_by}</p>
                  )}
                </div>
                {isSuperAdmin && (
                  <button
                    onClick={() => deleteMutation.mutate(admin.email)}
                    disabled={deleteMutation.isPending}
                    className="p-1.5 text-slate-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                    title="Remove admin"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
