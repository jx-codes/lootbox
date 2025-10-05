export interface ExecResponse {
  result?: string;
  error?: string;
  id?: string;
}

export interface Config {
  serverUrl?: string;
}

export interface FlowState {
  file: string;
  section: number;
  loopIteration?: number; // Current iteration count for current step (if looping)
}
