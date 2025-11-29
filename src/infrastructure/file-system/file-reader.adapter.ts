/**
 * @fileoverview File reader adapter implementation.
 * @module infrastructure/file-system/file-reader
 *
 * This module provides a Node.js file system implementation
 * of the IFileReader port interface.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IFileReader, FileReaderOptions } from '../../domain/index.js';

/**
 * Node.js file system implementation of IFileReader.
 *
 * This adapter implements the IFileReader port using Node.js
 * built-in file system APIs to discover and read TypeScript files.
 *
 * @example
 * ```typescript
 * const fileReader = new FileReaderAdapter();
 * const files = fileReader.findFiles('/path/to/project', {
 *   exclude: ['**\/*.test.ts'],
 * });
 * ```
 */
export class FileReaderAdapter implements IFileReader {
  /**
   * Finds all TypeScript files in the given directory.
   *
   * Recursively searches the directory tree for `.ts` and `.tsx` files,
   * excluding declaration files (`.d.ts`) and specified patterns.
   *
   * @param rootDir - Root directory to search for files
   * @param options - Optional file filtering options
   * @returns Array of absolute file paths to TypeScript files
   */
  findFiles(rootDir: string, options?: FileReaderOptions): string[] {
    const files: string[] = [];
    const exclude = options?.exclude ?? ['**/node_modules/**', '**/dist/**'];

    this.walkDirectory(rootDir, files, exclude);

    return files;
  }

  /**
   * Reads the content of a file.
   *
   * @param filePath - Absolute path to the file to read
   * @returns File content as a UTF-8 encoded string
   * @throws Error if the file cannot be read
   */
  readFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Checks if a file exists at the given path.
   *
   * @param filePath - Absolute path to check
   * @returns True if the file exists, false otherwise
   */
  exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  private walkDirectory(
    dir: string,
    files: string[],
    exclude: readonly string[]
  ): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (this.isExcluded(fullPath, exclude)) {
        continue;
      }

      if (entry.isDirectory()) {
        this.walkDirectory(fullPath, files, exclude);
      } else if (this.isTypeScriptFile(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  private isExcluded(filePath: string, exclude: readonly string[]): boolean {
    for (const pattern of exclude) {
      if (
        pattern.includes('node_modules') &&
        filePath.includes('node_modules')
      ) {
        return true;
      }
      if (pattern.includes('dist') && filePath.includes('/dist/')) {
        return true;
      }
    }
    return false;
  }

  private isTypeScriptFile(fileName: string): boolean {
    return (
      (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) &&
      !fileName.endsWith('.d.ts')
    );
  }
}
