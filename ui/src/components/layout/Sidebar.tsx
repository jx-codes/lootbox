import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Search,
  Play,
  History,
  FileCode,
  Settings,
  Activity,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/ui", icon: LayoutDashboard },
  { name: "Explorer", href: "/ui/explorer", icon: Search },
  { name: "Playground", href: "/ui/playground", icon: Play },
  { name: "History", href: "/ui/history", icon: History },
  { name: "Types", href: "/ui/types", icon: FileCode },
  { name: "Settings", href: "/ui/settings", icon: Settings },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <div className="flex h-screen w-64 flex-col bg-slate-900 border-r border-slate-800">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-6 border-b border-slate-800">
        <Activity className="h-8 w-8 text-blue-500" />
        <div>
          <h1 className="text-lg font-bold text-white">RPC Runtime</h1>
          <p className="text-xs text-slate-400">Management Console</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.href;

          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-800 p-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>v1.0.0</span>
          <a
            href="/doc"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            API Docs
          </a>
        </div>
      </div>
    </div>
  );
}
