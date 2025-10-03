import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useHealth, useNamespaces, useWebSocketStatus } from "@/lib/hooks";
import { Activity, Database, Zap, History } from "lucide-react";

export default function Dashboard() {
  const { data: health } = useHealth();
  const { data: namespaces } = useNamespaces();
  const { data: wsStatus } = useWebSocketStatus();

  const stats = [
    {
      title: "Server Status",
      value: health?.status === "ok" ? "Healthy" : "Offline",
      icon: Activity,
      color: health?.status === "ok" ? "text-green-600" : "text-red-600",
      bgColor: health?.status === "ok" ? "bg-green-100 dark:bg-green-900/20" : "bg-red-100 dark:bg-red-900/20",
    },
    {
      title: "Total Namespaces",
      value: (namespaces?.namespaces?.length || 0).toString(),
      icon: Database,
      color: "text-blue-600",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
    },
    {
      title: "WebSocket",
      value: wsStatus?.connected ? "Connected" : "Disconnected",
      icon: Zap,
      color: wsStatus?.connected ? "text-green-600" : "text-gray-600",
      bgColor: wsStatus?.connected ? "bg-green-100 dark:bg-green-900/20" : "bg-gray-100 dark:bg-gray-900/20",
    },
    {
      title: "Recent Executions",
      value: "0",
      icon: History,
      color: "text-purple-600",
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Overview of your RPC Runtime server
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Namespaces Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Available Namespaces</CardTitle>
          <CardDescription>RPC and MCP namespaces currently loaded</CardDescription>
        </CardHeader>
        <CardContent>
          {namespaces?.namespaces && namespaces.namespaces.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {namespaces.namespaces.map((ns) => (
                <div
                  key={ns.name}
                  className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-700 rounded-lg"
                >
                  <div>
                    <h3 className="font-medium text-slate-900 dark:text-slate-100">{ns.name}</h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {ns.functions.length} function{ns.functions.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      ns.type === "rpc"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
                    }`}
                  >
                    {ns.type.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-600 dark:text-slate-400">No namespaces loaded</p>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <a
            href="/ui/playground"
            className="block p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Open Playground</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Execute TypeScript code with RPC functions
            </p>
          </a>
          <a
            href="/ui/explorer"
            className="block p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            <h3 className="font-medium text-slate-900 dark:text-slate-100">Browse Functions</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Explore available RPC functions and their signatures
            </p>
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
