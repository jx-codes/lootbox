/**
 * MessageRouter
 *
 * Routes incoming WebSocket messages to appropriate handlers.
 * Handles:
 * - Message type detection (script, MCP, RPC)
 * - Routing to appropriate handler
 * - Response construction
 * - Error handling
 */

import { execute_llm_script } from "../../execute_llm_script.ts";
import type { McpIntegrationManager } from "./mcp_integration_manager.ts";
import type { WorkerManager } from "../worker_manager.ts";

interface RpcMessage {
  method: string;
  args?: unknown;
  id?: string;
}

interface ScriptMessage {
  script: string;
  sessionId?: string;
  id?: string;
}

export interface RpcResponse {
  result?: unknown;
  error?: string;
  id?: string;
}

export class MessageRouter {
  constructor(
    private workerManager: WorkerManager,
    private mcpIntegrationManager: McpIntegrationManager
  ) {}

  /**
   * Route incoming message to appropriate handler
   */
  async routeMessage(data: string, messageId?: string): Promise<RpcResponse> {
    try {
      console.error("📨 WebSocket received message");
      const parsed = JSON.parse(data);
      console.error(
        `📋 Parsed message type: ${
          "script" in parsed ? "SCRIPT" : "RPC"
        }`,
        { id: parsed.id }
      );

      const response: RpcResponse = { id: messageId || parsed.id };

      // Check if this is a script execution request
      if ("script" in parsed) {
        return await this.handleScriptMessage(parsed, response);
      } else {
        // Handle as RPC or MCP call
        return await this.handleRpcOrMcpMessage(parsed, response);
      }
    } catch (error) {
      console.error("❌ Message routing error:", error);
      return {
        error: "Invalid message format",
        id: messageId,
      };
    }
  }

  /**
   * Detect message type
   */
  private detectMessageType(parsed: unknown): "script" | "mcp" | "rpc" {
    if (typeof parsed === "object" && parsed !== null) {
      if ("script" in parsed) {
        return "script";
      }
      if ("method" in parsed && typeof (parsed as RpcMessage).method === "string") {
        const method = (parsed as RpcMessage).method;
        if (method.startsWith("mcp_")) {
          return "mcp";
        }
        return "rpc";
      }
    }
    return "rpc"; // default
  }

  /**
   * Handle script execution message
   */
  private async handleScriptMessage(
    parsed: ScriptMessage,
    response: RpcResponse
  ): Promise<RpcResponse> {
    console.error("🎬 Starting script execution...");
    console.error(`📄 Script length: ${parsed.script.length} chars`);

    const result = await execute_llm_script({
      script: parsed.script,
      sessionId: parsed.sessionId,
    });

    console.error("✅ Script execution completed", {
      success: result.success,
    });

    if (result.success) {
      response.result = result.output;
    } else {
      response.error = result.error;
    }

    return response;
  }

  /**
   * Handle RPC or MCP call message
   */
  private async handleRpcOrMcpMessage(
    parsed: RpcMessage,
    response: RpcResponse
  ): Promise<RpcResponse> {
    const msg: RpcMessage = parsed;

    // Check if this is an MCP call (starts with mcp_)
    if (msg.method.startsWith("mcp_")) {
      return await this.handleMcpMessage(msg, response);
    } else {
      return await this.handleRpcMessage(msg, response);
    }
  }

  /**
   * Handle MCP call
   */
  private async handleMcpMessage(
    msg: RpcMessage,
    response: RpcResponse
  ): Promise<RpcResponse> {
    if (!this.mcpIntegrationManager.isEnabled()) {
      response.error = "MCP is not enabled on this server";
    } else {
      const result = await this.mcpIntegrationManager.handleMcpCall(
        msg.method,
        msg.args
      );
      if (result.success) {
        response.result = result.data;
      } else {
        response.error = result.error;
      }
    }
    return response;
  }

  /**
   * Handle RPC call via worker
   */
  private async handleRpcMessage(
    msg: RpcMessage,
    response: RpcResponse
  ): Promise<RpcResponse> {
    if (!msg.method.includes(".")) {
      response.error = `Invalid method format: ${msg.method}. Expected: namespace.functionName`;
    } else {
      const [namespace, functionName] = msg.method.split(".");

      try {
        const result = await this.workerManager.callFunction(
          namespace,
          functionName,
          msg.args || {}
        );
        response.result = result;
      } catch (error) {
        response.error =
          error instanceof Error ? error.message : String(error);
      }
    }

    return response;
  }
}
