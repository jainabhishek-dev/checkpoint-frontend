import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  History,
  CheckSquare,
  GitBranch,
  Users,
  LogOut,
} from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { getLogoutUrl } from "../../api/auth";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Run a check", icon: <LayoutDashboard size={18} /> },
  { to: "/history", label: "History", icon: <History size={18} /> },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/admin/workflows", label: "Edit/Add Workflows", icon: <GitBranch size={18} />, adminOnly: true },
  { to: "/admin/checkpoints", label: "Edit/Add Checkpoints", icon: <CheckSquare size={18} />, adminOnly: true },
  { to: "/admin/admins", label: "Edit/Add Admins", icon: <Users size={18} />, adminOnly: true },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
    isActive
      ? "bg-slate-700 text-white"
      : "text-slate-400 hover:text-white hover:bg-slate-800"
  }`;

export default function Sidebar() {
  const { user, isAdmin } = useAuth();

  return (
    <aside className="flex flex-col w-60 min-h-screen bg-slate-900 border-r border-slate-800 px-4 py-6 fixed left-0 top-0 bottom-0 z-30">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-1 mb-8">
        <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 flex-shrink-0">
          <circle cx="100" cy="100" r="70" fill="none" stroke="#F97316" strokeWidth="8"/>
          <g transform="translate(100, 100)">
            <path d="M -20 0 L -5 14 L 20 -14" fill="none" stroke="#10B981" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
          </g>
        </svg>
        <span className="text-white font-semibold text-base tracking-tight">CheckPoint</span>
      </div>

      {/* Primary nav */}
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === "/"} className={linkClass}>
            {item.icon}
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Admin nav */}
      {isAdmin && (
        <>
          <div className="mt-6 mb-2 px-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Admin
            </span>
          </div>
          <nav className="flex flex-col gap-1">
            {ADMIN_NAV.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass}>
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
        </>
      )}

      {/* User + logout at bottom */}
      <div className="mt-auto pt-6 border-t border-slate-800">
        {user && (
          <div className="flex items-center gap-3 px-1 mb-4">
            {user.picture ? (
              <img src={user.picture} alt="" className="w-8 h-8 rounded-full flex-shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-slate-300 text-sm font-semibold flex-shrink-0">
                {user.name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm text-white font-medium truncate">{user.name}</p>
              <p className="text-xs text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
        )}
        <a
          href={getLogoutUrl()}
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <LogOut size={18} />
          Sign out
        </a>
      </div>
    </aside>
  );
}
