/**
 * UI Server - Serves the web UI for the RPC runtime
 *
 * In development: Proxies requests to Vite dev server (port 5173)
 * In production: Serves static files from ui/dist
 */

import { serveStatic } from "@hono/hono/deno";
import type { Hono } from "@hono/hono";
import type { OpenAPIHono } from "@hono/zod-openapi";

export function setupUIRoutes(app: OpenAPIHono) {
  const isDev = Deno.env.get("MODE") === "development";
  const vitePort = Deno.env.get("VITE_PORT") || "5173";

  if (isDev) {
    // Root UI route (must come before /ui/*)
    app.get("/ui", async (c) => {
      try {
        // Vite is configured with base: '/ui/', so request /ui/ from Vite
        const response = await fetch(`http://localhost:${vitePort}/ui/`);
        const body = await response.text();
        return c.html(body);
      } catch (error) {
        console.error("[UI] Proxy error:", error);
        return c.text("UI dev server not running. Start it with: deno task ui:dev", 503);
      }
    });

    // Proxy all UI requests to Vite dev server
    app.get("/ui/*", async (c) => {
      // Keep the full path since Vite is configured with base: '/ui/'
      const url = `http://localhost:${vitePort}${c.req.path}`;

      try {
        const response = await fetch(url);

        // Determine content type and use appropriate method
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("text/") || contentType.includes("application/javascript") || contentType.includes("application/json")) {
          const text = await response.text();
          return new Response(text, {
            status: response.status,
            headers: response.headers,
          });
        } else {
          const arrayBuffer = await response.arrayBuffer();
          return new Response(arrayBuffer, {
            status: response.status,
            headers: response.headers,
          });
        }
      } catch (error) {
        console.error("[UI] Proxy error:", error);
        return c.text("UI dev server not running. Start it with: deno task ui:dev", 503);
      }
    });
  } else {
    // Cast to Hono for static file serving (OpenAPIHono has strict typing)
    const honoApp = app as unknown as Hono;

    // Serve index.html for /ui root
    honoApp.get("/ui", serveStatic({ path: "./ui/dist/index.html" }));

    // Serve static files from ui/dist with SPA fallback for client-side routing
    honoApp.get("/ui/*", async (c, next) => {
      const requestPath = c.req.path.replace(/^\/ui/, "");
      const filePath = `./ui/dist${requestPath}`;

      // Check if the requested file exists
      try {
        const stat = await Deno.stat(filePath);
        if (stat.isFile) {
          // File exists, serve it
          const staticHandler = serveStatic({
            root: "./ui/dist",
            rewriteRequestPath: (p) => p.replace(/^\/ui/, "")
          });
          return await staticHandler(c, next);
        }
      } catch {
        // File doesn't exist, fall through to serve index.html
      }

      // Serve index.html for SPA routing (handles /ui/playground, /ui/explorer, etc.)
      const indexHandler = serveStatic({ path: "./ui/dist/index.html" });
      return await indexHandler(c, next);
    });
  }
}
