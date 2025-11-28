#!/usr/bin/env node

/**
 * graphts CLI entry point
 *
 * Wires up dependencies and executes the analyze command.
 */

import { AnalyzeProjectUseCase } from '../application/index.js';
import {
  TypeScriptParserAdapter,
  FileReaderAdapter,
} from '../infrastructure/index.js';
import { startServer } from '../web/server/index.js';

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  console.log('graphts - TypeScript Dependency Graph Analyzer');
  console.log('');

  // Parse CLI arguments
  const args = process.argv.slice(2);
  const rootDir = args[0] ?? process.cwd();
  const port = parseInt(process.env['PORT'] ?? '3000', 10);

  // Wire up dependencies
  const parser = new TypeScriptParserAdapter();
  const fileReader = new FileReaderAdapter();
  const analyzeProject = new AnalyzeProjectUseCase(parser, fileReader);

  console.log(`Analyzing: ${rootDir}`);

  // Execute use case
  const graph = analyzeProject.execute({ rootDir });

  console.log(`Found ${graph.nodes.length} nodes`);
  console.log(`Found ${graph.edges.length} edges`);
  console.log(`Analyzed ${graph.metadata.fileCount} files`);

  // Start visualization server
  await startServer({ graph, port });
}

main().catch((error: unknown) => {
  console.error('Error:', error);
  process.exit(1);
});
