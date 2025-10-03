/**
 * React Query Hooks
 * Custom hooks that wrap API client calls with React Query
 */

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./api-client";
import { wsClient } from "./websocket-client";
import { useState, useEffect } from "react";

/**
 * Hook to check server health
 */
export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => apiClient.health(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

/**
 * Hook to get WebSocket connection status
 */
export function useWebSocketStatus() {
  return useQuery({
    queryKey: ["websocket-status"],
    queryFn: async () => {
      const readyState = wsClient.getReadyState();
      return {
        connected: readyState === WebSocket.OPEN,
        connecting: readyState === WebSocket.CONNECTING,
        disconnected: readyState === WebSocket.CLOSED,
        readyState,
      };
    },
    refetchInterval: 1000, // Check every second
  });
}

/**
 * Hook to get available functions from WebSocket
 */
export function useAvailableFunctions() {
  const [functions, setFunctions] = useState<string[]>(
    wsClient.getAvailableFunctions()
  );

  useEffect(() => {
    const unsubscribe = wsClient.onMessage((message) => {
      if (message.type === "welcome" || message.type === "functions_updated") {
        setFunctions(message.functions);
      }
    });

    return unsubscribe;
  }, []);

  return functions;
}
