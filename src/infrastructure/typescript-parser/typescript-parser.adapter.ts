import type { IParser, ParsedFile, ParserOptions } from '../../domain/index.js';

/**
 * TypeScript Compiler API implementation of IParser.
 * Parses TypeScript source files and extracts dependency information.
 */
export class TypeScriptParserAdapter implements IParser {
  /**
   * Parses source files and extracts dependency information
   */
  parse(filePaths: readonly string[], options: ParserOptions): ParsedFile[] {
    // TODO: Implement TypeScript Compiler API integration
    // - Create ts.Program from tsconfig
    // - Walk AST to extract imports, exports, function calls
    // - Build nodes and edges

    void options; // Suppress unused variable warning

    return filePaths.map((filePath) => ({
      filePath,
      nodes: [],
      edges: [],
    }));
  }
}
