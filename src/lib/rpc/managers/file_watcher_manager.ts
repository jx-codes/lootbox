/**
 * FileWatcherManager
 *
 * Manages filesystem monitoring for RPC files.
 * Handles:
 * - Watching RPC directory for file changes
 * - Debouncing rapid changes
 * - Triggering callbacks on TypeScript file modifications
 * - Lifecycle control (start/stop watching)
 */

export class FileWatcherManager {
  private watcher: Deno.FsWatcher | null = null;
  private watching = false;

  /**
   * Start watching a directory for changes
   * Calls onChange callback when TypeScript files are modified (with debouncing)
   */
  startWatching(
    directory: string,
    onChange: () => Promise<void>
  ): void {
    if (this.watching) {
      console.error("File watcher already running");
      return;
    }

    try {
      this.watcher = Deno.watchFs(directory);
      this.watching = true;
      console.error(`Watching RPC directory: ${directory}`);

      // Start watching in background
      (async () => {
        try {
          for await (const event of this.watcher!) {
            // Only react to TypeScript file changes
            if (event.paths.some((path) => path.endsWith(".ts"))) {
              console.error(
                `File system event: ${event.kind} - ${event.paths.join(", ")}`
              );

              // Debounce rapid file changes
              await new Promise((resolve) => setTimeout(resolve, 100));
              await onChange();
            }
          }
        } catch (err) {
          if (this.watching) {
            // Only log if we didn't intentionally stop watching
            console.error("File watcher error:", err);
          }
        }
      })();
    } catch (err) {
      console.error("Failed to start file watcher:", err);
      this.watching = false;
    }
  }

  /**
   * Stop watching filesystem
   */
  stopWatching(): void {
    if (!this.watching) {
      return;
    }

    this.watching = false;

    // Note: Deno.FsWatcher doesn't have a direct close method,
    // but setting watcher to null will allow garbage collection
    this.watcher = null;

    console.error("File watcher stopped");
  }

  /**
   * Check if currently watching
   */
  isWatching(): boolean {
    return this.watching;
  }
}
