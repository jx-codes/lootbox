/**
 * REST API Client
 * Provides typed interfaces to the RPC Runtime REST endpoints
 */

// Use relative URLs so it works in both dev (proxied) and production (same origin)
const API_BASE = "";

export interface HealthResponse {
  status: "ok";
}

export const apiClient = {
  async health(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error("Health check failed");
    return res.json();
  },
};
