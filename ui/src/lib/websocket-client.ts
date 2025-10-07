/**
 * WebSocket Client
 * Manages WebSocket connection to RPC Runtime server
 */

export interface FunctionsUpdatedMessage {
  type: "functions_updated";
  functions: string[];
}

export interface WelcomeMessage {
  type: "welcome";
  functions: string[];
}

export type ServerMessage = FunctionsUpdatedMessage | WelcomeMessage;

export type MessageHandler = (message: ServerMessage) => void;

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private reconnectTimeout: number | null = null;
  private url: string;
  private pendingCalls = new Map<string, PendingCall>();
  private callIdCounter = 0;
  private availableFunctions: string[] = [];

  constructor(url: string = `ws://${window.location.hostname}:8080/ws`) {
    this.url = url;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Handle welcome message
        if (message.type === "welcome") {
          this.availableFunctions = message.functions || [];
          this.messageHandlers.forEach((handler) => handler(message));
          return;
        }

        // Handle functions_updated message
        if (message.type === "functions_updated") {
          this.availableFunctions = message.functions || [];
          this.messageHandlers.forEach((handler) => handler(message));
          return;
        }

        // Handle RPC/script response (has result or error and id)
        if (message.id && this.pendingCalls.has(message.id)) {
          const { resolve, reject } = this.pendingCalls.get(message.id)!;
          this.pendingCalls.delete(message.id);

          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message.result);
          }
          return;
        }

        // Unknown message
        console.warn("[WebSocket] Unknown message:", message);
      } catch (error) {
        console.error("[WebSocket] Failed to parse message:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("[WebSocket] Error:", error);
    };

    this.ws.onclose = () => {
      console.log("[WebSocket] Disconnected, attempting reconnect...");
      // Reject all pending calls
      this.pendingCalls.forEach(({ reject }) => {
        reject(new Error("WebSocket disconnected"));
      });
      this.pendingCalls.clear();

      this.reconnectTimeout = window.setTimeout(() => {
        this.connect();
      }, 3000);
    };
  }

  disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Call an RPC function
   */
  async call(method: string, args: unknown = {}): Promise<unknown> {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    const id = `call_${++this.callIdCounter}`;

    return new Promise((resolve, reject) => {
      this.pendingCalls.set(id, { resolve, reject });

      this.ws!.send(
        JSON.stringify({
          method,
          args,
          id,
        })
      );

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingCalls.has(id)) {
          this.pendingCalls.delete(id);
          reject(new Error(`RPC call timeout: ${method}`));
        }
      }, 30000);
    });
  }

  /**
   * Execute a TypeScript script
   */
  async executeScript(script: string, sessionId?: string): Promise<string> {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket not connected");
    }

    const id = `script_${++this.callIdCounter}`;

    return new Promise((resolve, reject) => {
      this.pendingCalls.set(id, {
        resolve: (result) => resolve(result as string),
        reject,
      });

      this.ws!.send(
        JSON.stringify({
          script,
          sessionId,
          id,
        })
      );

      // Timeout after 10 seconds (script execution timeout)
      setTimeout(() => {
        if (this.pendingCalls.has(id)) {
          this.pendingCalls.delete(id);
          reject(new Error("Script execution timeout"));
        }
      }, 10000);
    });
  }

  /**
   * Get list of available functions
   */
  getAvailableFunctions(): string[] {
    return [...this.availableFunctions];
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  send(data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn("[WebSocket] Cannot send, not connected");
    }
  }

  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

// Singleton instance
export const wsClient = new WebSocketClient();
