// Type-safe RPC client for LLM scripts

export interface RpcClientConfig {
  url?: string;
  timeout?: number;
  autoReconnect?: boolean;
}

export class RpcClient {
  private ws?: WebSocket;
  private pendingCalls = new Map<
    string,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
      timeout: number;
    }
  >();
  private callId = 0;
  private config: Required<RpcClientConfig>;
  private connectionPromise?: Promise<void>;

  constructor(config: RpcClientConfig = {}) {
    this.config = {
      url: config.url || "ws://localhost:3000/ws",
      timeout: config.timeout || 30000,
      autoReconnect: config.autoReconnect ?? true,
    };
  }

  async connect(): Promise<void> {
    // Already connected with valid WebSocket
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    // Connection in progress - return existing promise
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Create new connection attempt
    this.connectionPromise = new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(this.config.url);

      this.ws.onopen = () => resolve();
      this.ws.onerror = (error) =>
        reject(new Error(`WebSocket error: ${error}`));

      this.ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);

          if (response.type === "welcome") {
            return; // Ignore welcome messages
          }

          if (response.id && this.pendingCalls.has(response.id)) {
            const call = this.pendingCalls.get(response.id)!;
            this.pendingCalls.delete(response.id);
            clearTimeout(call.timeout);

            if (response.error) {
              call.reject(new Error(response.error));
            } else {
              call.resolve(response.result);
            }
          }
        } catch (error) {
          console.error("Failed to parse RPC response:", error);
        }
      };

      this.ws.onclose = () => {
        if (this.config.autoReconnect) {
          setTimeout(() => this.connect(), 1000);
        }
      };
    }).finally(() => {
      // Clear connection promise after completion or failure
      this.connectionPromise = undefined;
    });

    return this.connectionPromise;
  }

  async call(method: string, args: unknown[] = []): Promise<unknown> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }

    const id = `call_${++this.callId}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCalls.delete(id);
        reject(new Error(`RPC call timeout: ${method}`));
      }, this.config.timeout);

      this.pendingCalls.set(id, { resolve, reject, timeout });

      this.ws!.send(
        JSON.stringify({
          method,
          args,
          id,
        })
      );
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    // Reject all pending calls
    for (const [id, call] of this.pendingCalls) {
      clearTimeout(call.timeout);
      call.reject(new Error("Client disconnected"));
    }
    this.pendingCalls.clear();
  }
}

// Type-safe proxy client generator
export function createTypedRpcClient<
  T extends Record<string, (...args: any[]) => Promise<any>>
>(config?: RpcClientConfig): T {
  const client = new RpcClient(config);

  return new Proxy({} as T, {
    get(target, prop: string) {
      return async (...args: unknown[]) => {
        return await client.call(prop, args);
      };
    },
  });
}
