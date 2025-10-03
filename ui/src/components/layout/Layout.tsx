import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Toaster, toast } from "sonner";
import { wsClient } from "@/lib/websocket-client";

export default function Layout() {
  useEffect(() => {
    // Subscribe to WebSocket events
    const unsubscribe = wsClient.onMessage((message) => {
      if (message.type === "functions_updated") {
        const count = message.functions.length;
        toast.success("Functions Updated", {
          description: `${count} function${count !== 1 ? "s" : ""} now available`,
        });
      } else if (message.type === "welcome") {
        const count = message.functions.length;
        toast.info("Connected to RPC Server", {
          description: `${count} function${count !== 1 ? "s" : ""} available`,
        });
      }
    });

    return unsubscribe;
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="container mx-auto p-8">
          <Outlet />
        </div>
      </main>
      <Toaster richColors />
    </div>
  );
}
