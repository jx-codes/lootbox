// File system abstraction layer for testability

import type { RpcFileInfo } from "./types.ts";

export interface FileSystemAdapter {
  discoverRpcFiles(directory: string): Promise<RpcFileInfo[]>;
  readFile(path: string): Promise<string>;
  watchFiles?(directory: string, callback: (files: RpcFileInfo[]) => void): void;
}

export class DenoFileSystemAdapter implements FileSystemAdapter {
  async discoverRpcFiles(directory: string): Promise<RpcFileInfo[]> {
    const files: RpcFileInfo[] = [];

    try {
      const dirInfo = await Deno.stat(directory).catch(() => null);
      if (!dirInfo?.isDirectory) {
        console.error(`RPC directory not found: ${directory}`);
        return [];
      }

      for await (const entry of Deno.readDir(directory)) {
        if (entry.isFile && entry.name.endsWith(".ts")) {
          const filePath = `${directory}/${entry.name}`;
          const absolutePath = await Deno.realPath(filePath);
          const name = entry.name.replace(".ts", "");
          const stats = await Deno.stat(absolutePath);

          files.push({
            name,
            path: absolutePath,
            lastModified: stats.mtime || new Date(),
          });
        }
      }

      console.error(`Found ${files.length} RPC files`);
      return files;
    } catch (err) {
      console.error(`Failed to discover RPC files:`, err);
      return [];
    }
  }

  async readFile(path: string): Promise<string> {
    try {
      return await Deno.readTextFile(path);
    } catch (error) {
      throw new Error(`Failed to read file ${path}: ${error}`);
    }
  }

  async watchFiles(directory: string, callback: (files: RpcFileInfo[]) => void): Promise<void> {
    try {
      const watcher = Deno.watchFs(directory);
      for await (const event of watcher) {
        if (event.kind === "modify" && event.paths.some((p) => p.endsWith(".ts"))) {
          const files = await this.discoverRpcFiles(directory);
          callback(files);
        }
      }
    } catch (error) {
      console.error(`Failed to watch directory ${directory}:`, error);
    }
  }
}

export class MockFileSystemAdapter implements FileSystemAdapter {
  private files = new Map<string, string>();
  private directories = new Set<string>();

  addFile(path: string, content: string): void {
    this.files.set(path, content);
    // Add parent directory
    const dir = path.substring(0, path.lastIndexOf("/"));
    if (dir) {
      this.directories.add(dir);
    }
  }

  addDirectory(path: string): void {
    this.directories.add(path);
  }

  discoverRpcFiles(directory: string): Promise<RpcFileInfo[]> {
    if (!this.directories.has(directory)) {
      return Promise.reject(new Error(`Directory not found: ${directory}`));
    }

    const files = Array.from(this.files.keys())
      .filter((path) => path.startsWith(directory) && path.endsWith(".ts"))
      .map((path) => ({
        name: path.split("/").pop()!.replace(".ts", ""),
        path,
        lastModified: new Date(),
      }));

    return Promise.resolve(files);
  }

  readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      return Promise.reject(new Error(`File not found: ${path}`));
    }
    return Promise.resolve(content);
  }

  // Mock implementation doesn't support watching
  watchFiles?(_directory: string, _callback: (files: RpcFileInfo[]) => void): void {
    // No-op for mock
  }

  clear(): void {
    this.files.clear();
    this.directories.clear();
  }

  listFiles(): string[] {
    return Array.from(this.files.keys());
  }
}
