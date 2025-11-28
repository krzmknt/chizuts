/**
 * Options for reading files
 */
export interface FileReaderOptions {
  /** Glob patterns to include */
  readonly include?: readonly string[] | undefined;
  /** Glob patterns to exclude */
  readonly exclude?: readonly string[] | undefined;
}

/**
 * Port interface for file system operations.
 * Implementations provide actual file reading (e.g., Node.js fs).
 */
export interface IFileReader {
  /**
   * Finds all TypeScript files in the given directory
   * @param rootDir - Root directory to search
   * @param options - File filtering options
   * @returns Array of absolute file paths
   */
  findFiles(rootDir: string, options?: FileReaderOptions): string[];

  /**
   * Reads the content of a file
   * @param filePath - Absolute path to the file
   * @returns File content as string
   */
  readFile(filePath: string): string;

  /**
   * Checks if a file exists
   * @param filePath - Absolute path to the file
   * @returns True if file exists
   */
  exists(filePath: string): boolean;
}
