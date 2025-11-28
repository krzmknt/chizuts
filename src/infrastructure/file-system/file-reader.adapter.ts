import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IFileReader, FileReaderOptions } from '../../domain/index.js';

/**
 * Node.js file system implementation of IFileReader.
 */
export class FileReaderAdapter implements IFileReader {
  /**
   * Finds all TypeScript files in the given directory
   */
  findFiles(rootDir: string, options?: FileReaderOptions): string[] {
    const files: string[] = [];
    const exclude = options?.exclude ?? ['**/node_modules/**', '**/dist/**'];

    this.walkDirectory(rootDir, files, exclude);

    return files;
  }

  /**
   * Reads the content of a file
   */
  readFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Checks if a file exists
   */
  exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   * Recursively walks a directory and collects TypeScript files
   */
  private walkDirectory(
    dir: string,
    files: string[],
    exclude: readonly string[]
  ): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip excluded directories
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

  /**
   * Checks if a path should be excluded
   */
  private isExcluded(filePath: string, exclude: readonly string[]): boolean {
    // Simple check for common exclusions
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

  /**
   * Checks if a file is a TypeScript file
   */
  private isTypeScriptFile(fileName: string): boolean {
    return (
      (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) &&
      !fileName.endsWith('.d.ts')
    );
  }
}
