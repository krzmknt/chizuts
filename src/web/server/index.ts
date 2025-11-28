/**
 * Web server entry point
 *
 * Serves the visualization UI and provides API endpoints.
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DependencyGraph } from '../../domain/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
 * MIME types for static files
 */
const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/**
 * Starts a local server for visualizing the dependency graph.
 */
export function startServer(options: ServerOptions): Promise<void> {
  const port = options.port ?? 3000;
  // Resolve public dir relative to project root (works in both src and dist)
  const projectRoot = path.resolve(__dirname, '../../..');
  const publicDir = path.resolve(projectRoot, 'src/web/public');

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = req.url ?? '/';

      // API endpoint for graph data
      if (url === '/api/graph') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(options.graph));
        return;
      }

      // Serve static files
      let filePath = path.join(publicDir, url === '/' ? 'index.html' : url);

      // Security: prevent directory traversal
      if (!filePath.startsWith(publicDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      const ext = path.extname(filePath);
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

      fs.readFile(filePath, (err, content) => {
        if (err) {
          if (err.code === 'ENOENT') {
            res.writeHead(404);
            res.end('Not found');
          } else {
            res.writeHead(500);
            res.end('Server error');
          }
          return;
        }

        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });

    server.on('error', (err) => {
      reject(err);
    });

    server.listen(port, () => {
      console.log(`\nVisualization server running at http://localhost:${port}`);
      console.log('Press Ctrl+C to stop\n');

      // Open browser if requested
      if (options.open !== false) {
        openBrowser(`http://localhost:${port}`);
      }

      resolve();
    });
  });
}

/**
 * Opens the default browser
 */
function openBrowser(url: string): void {
  const platform = process.platform;
  let command: string;

  switch (platform) {
    case 'darwin':
      command = `open "${url}"`;
      break;
    case 'win32':
      command = `start "${url}"`;
      break;
    default:
      command = `xdg-open "${url}"`;
  }

  void import('node:child_process').then(({ exec }) => {
    exec(command, (err) => {
      if (err) {
        console.log(
          `Could not open browser automatically. Please visit: ${url}`
        );
      }
    });
  });
}
