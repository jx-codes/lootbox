export interface ExecResponse {
  result?: string;
  error?: string;
  id?: string;
}

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface Config {
  // Client settings
  serverUrl?: string;

  // Server settings
  port?: number;
  toolsDir?: string;
  lootboxDataDir?: string;
  mcpServers?: Record<string, McpServerConfig>;
}

export interface FlowState {
  file: string;
  section: number;
  loopIteration?: number; // Current iteration count for current step (if looping)
}
