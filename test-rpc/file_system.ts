// Filesystem RPC functions
// Provides secure file operations with configurable access controls

import { ensureDir } from "https://deno.land/std@0.208.0/fs/mod.ts";
import {
  dirname,
  join,
  relative,
  resolve,
} from "https://deno.land/std@0.208.0/path/mod.ts";

// Configure allowed directories (can be set via environment variables)
const ALLOWED_DIRS = (Deno.env.get("ALLOWED_DIRS") || "./storage/allowed")
  .split(",")
  .map((d) => resolve(d.trim()));

// Security: Check if a path is within allowed directories
function isPathAllowed(path: string): boolean {
  const resolvedPath = resolve(path);
  return ALLOWED_DIRS.some((allowedDir) => {
    const rel = relative(allowedDir, resolvedPath);
    return !rel.startsWith("..") && !rel.startsWith("/");
  });
}

function validatePath(path: string): void {
  if (!isPathAllowed(path)) {
    throw new Error(
      `Access denied: Path '${path}' is outside allowed directories`
    );
  }
}

// Read file
export interface ReadFileArgs {
  path: string;
  encoding?: "utf8" | "base64";
}

export interface ReadFileResult {
  content: string;
  size: number;
  path: string;
}

export async function readFile(args: ReadFileArgs): Promise<ReadFileResult> {
  validatePath(args.path);

  const resolvedPath = resolve(args.path);
  const stat = await Deno.stat(resolvedPath);

  if (!stat.isFile) {
    throw new Error(`Path '${args.path}' is not a file`);
  }

  if (args.encoding === "base64") {
    const bytes = await Deno.readFile(resolvedPath);
    const content = btoa(String.fromCharCode(...bytes));
    return { content, size: stat.size, path: resolvedPath };
  }

  const content = await Deno.readTextFile(resolvedPath);
  return { content, size: stat.size, path: resolvedPath };
}

// Write file
export interface WriteFileArgs {
  path: string;
  content: string;
  encoding?: "utf8" | "base64";
  createDirs?: boolean;
}

export interface WriteFileResult {
  success: boolean;
  path: string;
  bytesWritten: number;
}

export async function writeFile(args: WriteFileArgs): Promise<WriteFileResult> {
  validatePath(args.path);

  const resolvedPath = resolve(args.path);

  // Create parent directories if requested
  if (args.createDirs) {
    await ensureDir(dirname(resolvedPath));
  }

  let bytesWritten: number;

  if (args.encoding === "base64") {
    const bytes = Uint8Array.from(atob(args.content), (c) => c.charCodeAt(0));
    await Deno.writeFile(resolvedPath, bytes);
    bytesWritten = bytes.length;
  } else {
    await Deno.writeTextFile(resolvedPath, args.content);
    bytesWritten = new TextEncoder().encode(args.content).length;
  }

  return {
    success: true,
    path: resolvedPath,
    bytesWritten,
  };
}

// List directory
export interface ListDirectoryArgs {
  path: string;
  recursive?: boolean;
  includeHidden?: boolean;
}

export interface FileInfo {
  name: string;
  path: string;
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  modified: string;
}

export interface ListDirectoryResult {
  entries: FileInfo[];
  totalCount: number;
}

export async function listDirectory(
  args: ListDirectoryArgs
): Promise<ListDirectoryResult> {
  validatePath(args.path);

  const resolvedPath = resolve(args.path);
  const entries: FileInfo[] = [];

  async function walkDir(dir: string, baseDir: string) {
    for await (const entry of Deno.readDir(dir)) {
      // Skip hidden files unless requested
      if (!args.includeHidden && entry.name.startsWith(".")) {
        continue;
      }

      const fullPath = join(dir, entry.name);
      const relativePath = relative(baseDir, fullPath);
      const stat = await Deno.stat(fullPath);

      entries.push({
        name: entry.name,
        path: fullPath,
        isFile: entry.isFile,
        isDirectory: entry.isDirectory,
        size: stat.size,
        modified: stat.mtime?.toISOString() || "",
      });

      if (args.recursive && entry.isDirectory) {
        await walkDir(fullPath, baseDir);
      }
    }
  }

  await walkDir(resolvedPath, resolvedPath);

  return {
    entries,
    totalCount: entries.length,
  };
}

// Create directory
export interface CreateDirectoryArgs {
  path: string;
  recursive?: boolean;
}

export interface CreateDirectoryResult {
  success: boolean;
  path: string;
}

export async function createDirectory(
  args: CreateDirectoryArgs
): Promise<CreateDirectoryResult> {
  validatePath(args.path);

  const resolvedPath = resolve(args.path);
  await Deno.mkdir(resolvedPath, { recursive: args.recursive });

  return {
    success: true,
    path: resolvedPath,
  };
}

// Delete file or directory
export interface DeleteArgs {
  path: string;
  recursive?: boolean;
}

export interface DeleteResult {
  success: boolean;
  path: string;
  message: string;
}

export async function deleteFile(args: DeleteArgs): Promise<DeleteResult> {
  validatePath(args.path);

  const resolvedPath = resolve(args.path);

  try {
    const stat = await Deno.stat(resolvedPath);

    if (stat.isDirectory && !args.recursive) {
      throw new Error("Cannot delete directory without recursive flag");
    }

    await Deno.remove(resolvedPath, { recursive: args.recursive });

    return {
      success: true,
      path: resolvedPath,
      message: `Successfully deleted ${
        stat.isDirectory ? "directory" : "file"
      }`,
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return {
        success: true,
        path: resolvedPath,
        message: "Path does not exist",
      };
    }
    throw error;
  }
}

// Move/rename file or directory
export interface MoveArgs {
  source: string;
  destination: string;
}

export interface MoveResult {
  success: boolean;
  source: string;
  destination: string;
}

export async function moveFile(args: MoveArgs): Promise<MoveResult> {
  validatePath(args.source);
  validatePath(args.destination);

  const sourcePath = resolve(args.source);
  const destPath = resolve(args.destination);

  await Deno.rename(sourcePath, destPath);

  return {
    success: true,
    source: sourcePath,
    destination: destPath,
  };
}

// Copy file or directory
export interface CopyArgs {
  source: string;
  destination: string;
  overwrite?: boolean;
}

export interface CopyResult {
  success: boolean;
  source: string;
  destination: string;
}

export async function copyFile(args: CopyArgs): Promise<CopyResult> {
  validatePath(args.source);
  validatePath(args.destination);

  const sourcePath = resolve(args.source);
  const destPath = resolve(args.destination);

  // Check if destination exists and overwrite is not allowed
  if (!args.overwrite) {
    try {
      await Deno.stat(destPath);
      throw new Error(`Destination '${destPath}' already exists`);
    } catch (error) {
      if (!(error instanceof Deno.errors.NotFound)) {
        throw error;
      }
    }
  }

  await Deno.copyFile(sourcePath, destPath);

  return {
    success: true,
    source: sourcePath,
    destination: destPath,
  };
}

// Get file information
export interface FileInfoArgs {
  path: string;
  followSymlinks?: boolean;
}

export interface FileInfoResult {
  path: string;
  exists: boolean;
  isFile: boolean;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  created: string;
  modified: string;
  accessed: string;
  permissions: {
    readable: boolean;
    writable: boolean;
    executable: boolean;
  };
}

export async function getFileInfo(args: FileInfoArgs): Promise<FileInfoResult> {
  validatePath(args.path);

  const resolvedPath = resolve(args.path);

  try {
    const stat = args.followSymlinks
      ? await Deno.stat(resolvedPath)
      : await Deno.lstat(resolvedPath);

    return {
      path: resolvedPath,
      exists: true,
      isFile: stat.isFile,
      isDirectory: stat.isDirectory,
      isSymlink: stat.isSymlink || false,
      size: stat.size,
      created: stat.birthtime?.toISOString() || "",
      modified: stat.mtime?.toISOString() || "",
      accessed: stat.atime?.toISOString() || "",
      permissions: {
        readable: stat.mode !== null ? (stat.mode & 0o400) !== 0 : false,
        writable: stat.mode !== null ? (stat.mode & 0o200) !== 0 : false,
        executable: stat.mode !== null ? (stat.mode & 0o100) !== 0 : false,
      },
    };
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return {
        path: resolvedPath,
        exists: false,
        isFile: false,
        isDirectory: false,
        isSymlink: false,
        size: 0,
        created: "",
        modified: "",
        accessed: "",
        permissions: {
          readable: false,
          writable: false,
          executable: false,
        },
      };
    }
    throw error;
  }
}

// Search and replace in file
export interface SearchReplaceArgs {
  path: string;
  find: string;
  replace: string;
  regex?: boolean;
  allOccurrences?: boolean;
  caseSensitive?: boolean;
}

export interface SearchReplaceResult {
  success: boolean;
  path: string;
  replacementCount: number;
  preview?: string;
}

export async function searchReplace(
  args: SearchReplaceArgs
): Promise<SearchReplaceResult> {
  validatePath(args.path);

  const resolvedPath = resolve(args.path);
  let content = await Deno.readTextFile(resolvedPath);

  let replacementCount = 0;

  if (args.regex) {
    const flags = args.caseSensitive ? "g" : "gi";
    const regex = new RegExp(args.find, flags);
    const matches = content.match(regex);
    replacementCount = matches ? matches.length : 0;
    content = content.replace(regex, args.replace);
  } else {
    const searchStr = args.caseSensitive ? args.find : args.find.toLowerCase();
    const contentToSearch = args.caseSensitive
      ? content
      : content.toLowerCase();

    if (args.allOccurrences !== false) {
      // Count occurrences
      let index = contentToSearch.indexOf(searchStr);
      while (index !== -1) {
        replacementCount++;
        index = contentToSearch.indexOf(searchStr, index + 1);
      }

      // Replace all
      const regex = new RegExp(
        args.find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        args.caseSensitive ? "g" : "gi"
      );
      content = content.replace(regex, args.replace);
    } else {
      // Replace first occurrence only
      const index = contentToSearch.indexOf(searchStr);
      if (index !== -1) {
        replacementCount = 1;
        content =
          content.substring(0, index) +
          args.replace +
          content.substring(index + args.find.length);
      }
    }
  }

  await Deno.writeTextFile(resolvedPath, content);

  return {
    success: true,
    path: resolvedPath,
    replacementCount,
    preview: content.length > 200 ? content.substring(0, 200) + "..." : content,
  };
}

// Append to file
export interface AppendFileArgs {
  path: string;
  content: string;
  newline?: boolean;
}

export interface AppendFileResult {
  success: boolean;
  path: string;
  bytesWritten: number;
}

export async function appendFile(
  args: AppendFileArgs
): Promise<AppendFileResult> {
  validatePath(args.path);

  const resolvedPath = resolve(args.path);
  const contentToAppend = args.newline ? `\n${args.content}` : args.content;

  const encoder = new TextEncoder();
  const data = encoder.encode(contentToAppend);

  await Deno.writeFile(resolvedPath, data, { append: true });

  return {
    success: true,
    path: resolvedPath,
    bytesWritten: data.length,
  };
}

// Get allowed directories (utility function)
export interface GetAllowedDirsResult {
  directories: string[];
}

export async function getAllowedDirectories(
  args: Record<string, never>
): Promise<GetAllowedDirsResult> {
  return {
    directories: ALLOWED_DIRS,
  };
}
