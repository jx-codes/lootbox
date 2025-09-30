// Generate RPC client section for MCP servers

import type { ExtractionResult } from "../type_system/types.ts";

/**
 * Generate client section for MCP servers
 * Uses same namespace pattern as RPC but with mcp_ prefix
 */
export function generateMcpClientSection(
  mcpResults: ExtractionResult[]
): string {
  if (mcpResults.length === 0) {
    return "";
  }

  let code = "";

  // Generate namespaces for each MCP server
  for (const result of mcpResults) {
    const namespace = `mcp_${result.sourceFile}`;

    code += `  ${namespace}: {\n`;

    for (const func of result.functions) {
      const paramType = func.parameters[0]?.type || "Record<string, never>";
      const returnType = func.returnType;

      code += `    ${func.name}: createMcpCall("${result.sourceFile}", "${func.name}", "${func.name.startsWith("resource_") ? "resource" : "tool"}") as (args: ${paramType}) => ${returnType},\n`;
    }

    code += `  },\n`;
  }

  return code;
}

/**
 * Generate createMcpCall helper function
 */
export function generateMcpCallHelper(): string {
  return `
// Helper function to create MCP call
function createMcpCall(serverName: string, operationName: string, operationType: "tool" | "resource") {
  return async (args: unknown) => {
    activeCalls++;

    // Clear any pending disconnect timer
    if (disconnectTimer !== null) {
      clearTimeout(disconnectTimer);
      disconnectTimer = null;
    }

    try {
      // Format method as mcp_ServerName.operationName
      const method = \`mcp_\${serverName}.\${operationName}\`;
      return await client.call(method, args);
    } finally {
      activeCalls--;

      // If no more active calls, schedule disconnect after a short delay
      if (activeCalls === 0) {
        disconnectTimer = setTimeout(() => {
          client.disconnect();
        }, 100);
      }
    }
  };
}
`;
}