/**
 * @fileoverview File reader port interface.
 * @module domain/ports/file-reader
 *
 * This module defines the port interface for file system operations.
 * Implementations provide the actual file reading logic using the
 * platform's file system API.
 */

/**
 * Configuration options for file discovery and filtering.
 *
 * @example
 * ```typescript
 * const options: FileReaderOptions = {
 *   include: ['src/**\/*.ts'],
 *   exclude: ['**\/*.test.ts', '**\/*.spec.ts'],
 * };
 * ```
 */
export interface FileReaderOptions {
  /**
   * Glob patterns for files to include.
   * If not specified, all TypeScript files are included.
   */
  readonly include?: readonly string[] | undefined;

  /**
   * Glob patterns for files to exclude.
   * These patterns take precedence over include patterns.
   */
  readonly exclude?: readonly string[] | undefined;
}

/**
 * Port interface for file system operations.
 *
 * This is a hexagonal architecture port that defines the contract
 * for file system access. Implementations (adapters) provide the
 * actual file reading logic using the platform's file system API.
 *
 * @example
 * ```typescript
 * class NodeFileReader implements IFileReader {
 *   findFiles(rootDir: string, options?: FileReaderOptions): string[] {
 *     // Implementation using Node.js fs and glob
 *   }
 *   readFile(filePath: string): string {
 *     // Implementation using fs.readFileSync
 *   }
 *   exists(filePath: string): boolean {
 *     // Implementation using fs.existsSync
 *   }
 * }
 * ```
 */
export interface IFileReader {
  /**
   * Finds all TypeScript files in the given directory.
   *
   * @param rootDir - Root directory to search for files
   * @param options - Optional file filtering options
   * @returns Array of absolute file paths matching the criteria
   */
  findFiles(rootDir: string, options?: FileReaderOptions): string[];

  /**
   * Reads the content of a file.
   *
   * @param filePath - Absolute path to the file to read
   * @returns File content as a UTF-8 encoded string
   * @throws Error if the file cannot be read
   */
  readFile(filePath: string): string;

  /**
   * Checks if a file exists at the given path.
   *
   * @param filePath - Absolute path to check
   * @returns True if the file exists, false otherwise
   */
  exists(filePath: string): boolean;
}
