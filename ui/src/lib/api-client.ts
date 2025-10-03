/**
 * REST API Client
 * Provides typed interfaces to the RPC Runtime REST endpoints
 */

// Use relative URLs so it works in both dev (proxied) and production (same origin)
const API_BASE = "";

export interface HealthResponse {
  status: "ok";
}

export interface Namespace {
  name: string;
  functions: string[];
  type: "rpc" | "mcp";
}

export interface NamespacesApiResponse {
  rpc: string[];
  mcp: string[];
}

export interface NamespacesResponse {
  namespaces: Namespace[];
}

export const apiClient = {
  async health(): Promise<HealthResponse> {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error("Health check failed");
    return res.json();
  },

  async namespaces(): Promise<NamespacesResponse> {
    const res = await fetch(`${API_BASE}/namespaces`);
    if (!res.ok) throw new Error("Failed to fetch namespaces");
    const data: NamespacesApiResponse = await res.json();

    // Transform the API response into our expected format
    // Note: We don't have function lists per namespace from this endpoint,
    // so we'll need to fetch that separately if needed
    const namespaces: Namespace[] = [
      ...data.rpc.map(name => ({ name, functions: [], type: "rpc" as const })),
      ...data.mcp.map(name => ({ name, functions: [], type: "mcp" as const }))
    ];

    return { namespaces };
  },

  async rpcNamespaceMetadata(): Promise<string> {
    const res = await fetch(`${API_BASE}/rpc-namespaces`);
    if (!res.ok) throw new Error("Failed to fetch RPC metadata");
    return res.text();
  },

  async types(): Promise<string> {
    const res = await fetch(`${API_BASE}/types`);
    if (!res.ok) throw new Error("Failed to fetch types");
    return res.text();
  },

  async namespacetypes(namespaces: string[]): Promise<string> {
    const res = await fetch(`${API_BASE}/types/${namespaces.join(",")}`);
    if (!res.ok) throw new Error("Failed to fetch namespace types");
    return res.text();
  },

  async clientCode(): Promise<string> {
    const res = await fetch(`${API_BASE}/client.ts`);
    if (!res.ok) throw new Error("Failed to fetch client code");
    return res.text();
  },
};
