import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useHealth, useWebSocketStatus, useAvailableFunctions } from "@/lib/hooks";
import { Activity, Zap, Database, CheckCircle, XCircle } from "lucide-react";

export default function Dashboard() {
  const { data: health, isError: healthError } = useHealth();
  const { data: wsStatus } = useWebSocketStatus();
  const availableFunctions = useAvailableFunctions();

  // Group functions by namespace
  const namespaceMap = new Map<string, { name: string; count: number; type: string }>();
  availableFunctions.forEach((fullName) => {
    const [namespace] = fullName.split(".");
    if (namespace) {
      const existing = namespaceMap.get(namespace);
      if (existing) {
        existing.count++;
      } else {
        namespaceMap.set(namespace, {
          name: namespace,
          count: 1,
          type: fullName.startsWith("mcp_") ? "mcp" : "rpc",
        });
      }
    }
  });

  const namespaces = Array.from(namespaceMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  const isHealthy = health?.status === "ok";
  const isConnected = wsStatus?.connected ?? false;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <div className="container mx-auto p-8 max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Activity className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100">
              RPC Runtime
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">
            Real-time status dashboard
          </p>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Server Health */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Server Health</CardTitle>
                {isHealthy ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-red-600" />
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div
                  className={`h-3 w-3 rounded-full ${
                    isHealthy
                      ? "bg-green-600 animate-pulse"
                      : "bg-red-600"
                  }`}
                />
                <span
                  className={`text-xl font-semibold ${
                    isHealthy ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {isHealthy ? "Healthy" : healthError ? "Offline" : "Unknown"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* WebSocket Connection */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">WebSocket</CardTitle>
                <Zap className={`h-6 w-6 ${isConnected ? "text-green-600" : "text-slate-400"}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <div
                  className={`h-3 w-3 rounded-full ${
                    isConnected
                      ? "bg-green-600 animate-pulse"
                      : "bg-slate-400"
                  }`}
                />
                <span
                  className={`text-xl font-semibold ${
                    isConnected ? "text-green-600" : "text-slate-600"
                  }`}
                >
                  {isConnected ? "Connected" : "Disconnected"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Namespaces */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              <CardTitle>Available Namespaces</CardTitle>
            </div>
            <CardDescription>
              {namespaces.length} namespace{namespaces.length !== 1 ? "s" : ""} with{" "}
              {availableFunctions.length} function{availableFunctions.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {namespaces.length === 0 ? (
              <div className="text-center py-8 text-slate-600 dark:text-slate-400">
                {isConnected ? "No namespaces loaded" : "Waiting for connection..."}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {namespaces.map((ns) => (
                  <div
                    key={ns.name}
                    className="flex items-center justify-between p-4 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
                  >
                    <div>
                      <h3 className="font-medium text-slate-900 dark:text-slate-100">
                        {ns.name}
                      </h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {ns.count} function{ns.count !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        ns.type === "rpc"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                          : "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
                      }
                    >
                      {ns.type.toUpperCase()}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-slate-600 dark:text-slate-400">
          <p>
            For script execution and advanced features, use the{" "}
            <code className="bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded">
              lootbox
            </code>{" "}
            package
          </p>
        </div>
      </div>
    </div>
  );
}
