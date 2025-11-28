/**
 * Web server entry point
 *
 * Serves the visualization UI and provides API endpoints.
 */

import type { DependencyGraph } from '../../domain/index.js';

/**
 * Options for starting the visualization server
 */
export interface ServerOptions {
  /** Port to listen on (default: 3000) */
  readonly port?: number;
  /** Open browser automatically (default: true) */
  readonly open?: boolean;
  /** The dependency graph to visualize */
  readonly graph: DependencyGraph;
}

/**
 * Starts a local server for visualizing the dependency graph.
 */
export function startServer(options: ServerOptions): void {
  const port = options.port ?? 3000;

  // TODO: Implement HTTP server
  // TODO: Serve static files from public/
  // TODO: Provide /api/graph endpoint

  console.log(`Server starting on http://localhost:${port}`);
}
