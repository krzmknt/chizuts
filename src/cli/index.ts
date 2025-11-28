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

/**
 * Main CLI entry point
 */
function main(): void {
  console.log('graphts - TypeScript Dependency Graph Analyzer');
  console.log('');

  // Wire up dependencies
  const parser = new TypeScriptParserAdapter();
  const fileReader = new FileReaderAdapter();
  const analyzeProject = new AnalyzeProjectUseCase(parser, fileReader);

  // TODO: Implement CLI argument parsing
  const rootDir = process.cwd();

  console.log(`Analyzing: ${rootDir}`);

  // Execute use case
  const graph = analyzeProject.execute({ rootDir });

  console.log(`Found ${graph.nodes.length} nodes`);
  console.log(`Found ${graph.edges.length} edges`);
  console.log(`Analyzed ${graph.metadata.fileCount} files`);
}

main();
