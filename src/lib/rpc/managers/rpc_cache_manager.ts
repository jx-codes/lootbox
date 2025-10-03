/**
 * RpcCacheManager
 *
 * Manages RPC file discovery, caching, and change notifications.
 * Handles:
 * - Discovering RPC files from configured directory
 * - Extracting function signatures from files
 * - Caching namespace → file mappings
 * - Invalidating cache on changes
 * - Notifying subscribers of function updates
 */

import type { RpcFile } from "../load_rpc_files.ts";
import { discover_rpc_files } from "../load_rpc_files.ts";

export class RpcCacheManager {
  private rpcFiles = new Map<string, RpcFile>();
  private refreshCallbacks: Array<(functions: string[]) => void> = [];

  /**
   * Discover RPC files and refresh the cache with their function signatures
   * Returns array of namespaced function names (e.g., ["filedb.get", "filedb.set"])
   */
  async refreshCache(): Promise<string[]> {
    try {
      const { TypeExtractor } = await import(
        "../../type_system/type_extractor.ts"
      );

      const files = await discover_rpc_files();
      const extractor = new TypeExtractor();

      // Clear existing cache
      this.rpcFiles.clear();

      // Rebuild function cache with namespaced method names
      for (const file of files) {
        try {
          const result = extractor.extractFromFile(file.path);
          for (const func of result.functions) {
            const namespacedMethod = `${file.name}.${func.name}`;
            this.rpcFiles.set(namespacedMethod, file);
          }
        } catch (err) {
          console.error(`Error discovering functions in ${file.name}:`, err);
        }
      }

      const functionNames = Array.from(this.rpcFiles.keys());
      console.error(`RPC functions updated: ${functionNames.join(", ")}`);

      // Notify all subscribers
      for (const callback of this.refreshCallbacks) {
        try {
          callback(functionNames);
        } catch (err) {
          console.error("Error in cache refresh callback:", err);
        }
      }

      return functionNames;
    } catch (err) {
      console.error("Failed to refresh RPC cache:", err);
      return [];
    }
  }

  /**
   * Get unique RPC files (one per file path)
   * Returns Map keyed by file path
   */
  getUniqueFiles(): Map<string, RpcFile> {
    const uniqueFiles = new Map<string, RpcFile>();
    for (const file of this.rpcFiles.values()) {
      uniqueFiles.set(file.path, file);
    }
    return uniqueFiles;
  }

  /**
   * Get array of all namespaced function names
   */
  getFunctionNames(): string[] {
    return Array.from(this.rpcFiles.keys());
  }

  /**
   * Get RPC file for a specific namespaced method
   */
  getRpcFile(namespacedMethod: string): RpcFile | undefined {
    return this.rpcFiles.get(namespacedMethod);
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.rpcFiles.clear();
  }

  /**
   * Register a callback to be invoked when cache is refreshed
   * Callback receives array of function names
   */
  onCacheRefreshed(callback: (functions: string[]) => void): void {
    this.refreshCallbacks.push(callback);
  }
}
