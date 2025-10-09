export function generateId(): string {
  return `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function wsUrlToHttpUrl(wsUrl: string): string {
  // Convert ws://localhost:3000/ws -> http://localhost:3000
  return wsUrl
    .replace(/^ws:/, "http:")
    .replace(/^wss:/, "https:")
    .replace(/\/ws$/, "");
}

import { removeSlashes } from "npm:slashes@3.0.12";

export async function readStdin(): Promise<string> {
  const raw = await new Response(Deno.stdin.readable).text();
  // Remove bash-escaped backslashes like \!
  return removeSlashes(raw);
}
