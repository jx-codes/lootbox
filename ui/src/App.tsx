import { useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import { Toaster, toast } from "sonner";
import { wsClient } from "./lib/websocket-client";

function App() {
  useEffect(() => {
    // Subscribe to WebSocket events for toast notifications
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
    <>
      <Dashboard />
      <Toaster richColors />
    </>
  );
}

export default App;
