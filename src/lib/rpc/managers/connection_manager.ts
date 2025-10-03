/**
 * ConnectionManager
 *
 * Manages WebSocket connections.
 * Handles:
 * - Client WebSocket lifecycle (connect, disconnect)
 * - Worker WebSocket lifecycle
 * - Broadcasting messages to all connected clients
 * - Welcome messages with available functions
 * - WebSocket handler creation for Hono routes
 */

import type { MessageRouter } from "./message_router.ts";
import type { WorkerManager } from "../worker_manager.ts";

// Type for Hono WebSocket context
interface WebSocketContext {
  send(message: string): void;
  close(): void;
}

export interface WebSocketHandler {
  onOpen: (event: Event, ws: WebSocketContext) => void;
  onMessage: (event: MessageEvent, ws: WebSocketContext) => Promise<void>;
  onClose: (event: CloseEvent, ws: WebSocketContext) => void;
  onError: (evt: Event, ws: WebSocketContext) => void;
}

export class ConnectionManager {
  private clients = new Set<WebSocketContext>();

  /**
   * Add a client WebSocket connection
   */
  addClient(ws: WebSocketContext): void {
    this.clients.add(ws);
  }

  /**
   * Remove a client WebSocket connection
   */
  removeClient(ws: WebSocketContext): void {
    this.clients.delete(ws);
  }

  /**
   * Broadcast a message to all connected clients
   */
  broadcastToClients(message: object): void {
    const messageStr = JSON.stringify(message);
    for (const client of this.clients) {
      try {
        client.send(messageStr);
      } catch (err) {
        console.error("Failed to send message to client:", err);
        this.clients.delete(client);
      }
    }
  }

  /**
   * Close all client connections
   */
  async closeAllClients(): Promise<void> {
    for (const client of this.clients) {
      try {
        client.close();
      } catch (err) {
        console.error("Error closing WebSocket connection:", err);
      }
    }
    this.clients.clear();
  }

  /**
   * Send welcome message to a newly connected client
   */
  sendWelcome(ws: WebSocketContext, functions: string[]): void {
    ws.send(
      JSON.stringify({
        type: "welcome",
        functions,
      })
    );
  }

  /**
   * Get number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Create WebSocket handler for worker connections
   */
  createWorkerWebSocketHandler(workerManager: WorkerManager): WebSocketHandler {
    let workerId: string | null = null;

    return {
      onOpen: (_event, _ws) => {
        console.error("Worker WebSocket connected");
        // We'll set the workerId when we get the identify message
      },

      onMessage: async (event, ws) => {
        const data =
          typeof event.data === "string"
            ? event.data
            : new TextDecoder().decode(
                new Uint8Array(event.data as ArrayBuffer)
              );

        // Parse to get workerId from identify message
        try {
          const msg = JSON.parse(data);
          if (msg.type === "identify" && msg.workerId) {
            const id = msg.workerId as string;
            workerId = id;
            // Register the send callback for this worker
            workerManager.registerWorkerSender(id, (message: string) => {
              ws.send(message);
            });
          }
        } catch {
          // Ignore parse errors
        }

        // Forward all messages to worker manager
        workerManager.handleMessage(data);
      },

      onClose: () => {
        console.error("Worker WebSocket disconnected");
        if (workerId) {
          workerManager.handleDisconnect(workerId);
        }
      },

      onError: (evt) => console.error("Worker WebSocket error:", evt),
    };
  }

  /**
   * Create WebSocket handler for client connections
   */
  createClientWebSocketHandler(
    messageRouter: MessageRouter,
    availableFunctions: () => string[]
  ): WebSocketHandler {
    return {
      onOpen: (_event, ws) => {
        console.error("WebSocket connected");
        this.addClient(ws);
        this.sendWelcome(ws, availableFunctions());
      },

      onMessage: async (event, ws) => {
        const data =
          typeof event.data === "string"
            ? event.data
            : new TextDecoder().decode(
                new Uint8Array(event.data as ArrayBuffer)
              );

        const parsed = JSON.parse(data);
        const response = await messageRouter.routeMessage(data, parsed.id);

        console.error("📤 Sending response back to client", {
          hasResult: !!response.result,
          hasError: !!response.error,
        });
        ws.send(JSON.stringify(response));
      },

      onClose: (_event, ws) => {
        console.error("WebSocket disconnected");
        this.removeClient(ws);
      },

      onError: (evt) => console.error("WebSocket error:", evt),
    };
  }
}
