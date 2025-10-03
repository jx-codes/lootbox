/**
 * React Query Hooks
 * Custom hooks that wrap API client calls with React Query
 */

import { useQuery, useMutation } from "@tanstack/react-query";
import { apiClient } from "./api-client";
import { wsClient } from "./websocket-client";
import { ScriptHistory, type ScriptExecution } from "./storage";
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
 * Hook to fetch all namespaces
 */
export function useNamespaces() {
  return useQuery({
    queryKey: ["namespaces"],
    queryFn: () => apiClient.namespaces(),
  });
}

/**
 * Hook to fetch RPC namespace metadata
 */
export function useRpcMetadata() {
  return useQuery({
    queryKey: ["rpc-metadata"],
    queryFn: () => apiClient.rpcNamespaceMetadata(),
  });
}

/**
 * Hook to fetch all TypeScript types
 */
export function useTypes() {
  return useQuery({
    queryKey: ["types"],
    queryFn: () => apiClient.types(),
  });
}

/**
 * Hook to fetch types for specific namespaces
 */
export function useNamespaceTypes(namespaces: string[]) {
  return useQuery({
    queryKey: ["namespace-types", namespaces],
    queryFn: () => apiClient.namespacetypes(namespaces),
    enabled: namespaces.length > 0,
  });
}

/**
 * Hook to fetch the generated client code
 */
export function useClientCode() {
  return useQuery({
    queryKey: ["client"],
    queryFn: () => apiClient.clientCode(),
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

/**
 * Hook to execute RPC calls via WebSocket
 */
export function useRpcCall() {
  return useMutation({
    mutationFn: ({ method, args }: { method: string; args?: unknown }) =>
      wsClient.call(method, args),
  });
}

/**
 * Hook to execute TypeScript scripts via WebSocket
 */
export function useScriptExecution() {
  return useMutation({
    mutationFn: async ({
      script,
      sessionId,
    }: {
      script: string;
      sessionId?: string;
    }) => {
      const startTime = Date.now();

      try {
        const result = await wsClient.executeScript(script, sessionId);
        const duration = Date.now() - startTime;

        // Save to history
        const execution: ScriptExecution = {
          id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          script,
          timestamp: startTime,
          duration,
          success: true,
          result,
        };
        ScriptHistory.add(execution);

        return { result, execution };
      } catch (error) {
        const duration = Date.now() - startTime;

        // Save error to history
        const execution: ScriptExecution = {
          id: `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          script,
          timestamp: startTime,
          duration,
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
        ScriptHistory.add(execution);

        throw error;
      }
    },
  });
}
