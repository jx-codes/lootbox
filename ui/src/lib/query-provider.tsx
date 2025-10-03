/**
 * React Query Provider with WebSocket Integration
 * Manages query cache invalidation based on WebSocket messages
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";
import { wsClient } from "./websocket-client";

// Create query client
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  useEffect(() => {
    // Connect WebSocket
    wsClient.connect();

    // Handle WebSocket messages and invalidate queries
    const unsubscribe = wsClient.onMessage((message) => {
      switch (message.type) {
        case "functions_updated":
          console.log("[QueryProvider] Functions updated, invalidating queries");
          // Invalidate all namespace-related queries
          queryClient.invalidateQueries({ queryKey: ["namespaces"] });
          queryClient.invalidateQueries({ queryKey: ["rpc-metadata"] });
          queryClient.invalidateQueries({ queryKey: ["types"] });
          queryClient.invalidateQueries({ queryKey: ["client"] });
          break;
      }
    });

    return () => {
      unsubscribe();
      wsClient.disconnect();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
