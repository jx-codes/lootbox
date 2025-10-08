// Read version from deno.json
import denoConfig from "../deno.json" with { type: "json" };

export const VERSION = denoConfig.version;
