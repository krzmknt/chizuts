import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DependencyGraph } from '../../domain/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to make HTTP requests
function httpGet(
  port: number,
  urlPath: string
): Promise<{ status: number; body: string; contentType: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://localhost:${port}${urlPath}`, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          body,
          contentType: res.headers['content-type'] ?? '',
        });
      });
    });
    req.on('error', reject);
  });
}

describe('Web Server', () => {
  let server: http.Server;
  const testPort = 9999;
  const testGraph: DependencyGraph = {
    nodes: [
      {
        id: 'test-module',
        label: 'test.ts',
        type: 'module',
        filePath: '/test.ts',
        line: 1,
        column: 1,
      },
    ],
    edges: [],
    metadata: {
      rootDir: '/test',
      analyzedAt: new Date().toISOString(),
      fileCount: 1,
      version: '0.1.0',
    },
  };

  const MIME_TYPES: Record<string, string> = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
  };

  beforeAll(() => {
    return new Promise<void>((resolve, reject) => {
      const projectRoot = path.resolve(__dirname, '../../..');
      const publicDir = path.resolve(projectRoot, 'src/web/public');

      server = http.createServer((req, res) => {
        const url = req.url ?? '/';

        if (url === '/api/graph') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(testGraph));
          return;
        }

        let filePath = path.join(publicDir, url === '/' ? 'index.html' : url);

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

      server.listen(testPort, () => resolve());
      server.on('error', reject);
    });
  });

  afterAll(() => {
    return new Promise<void>((resolve) => {
      if (server) {
        server.close(() => resolve());
      } else {
        resolve();
      }
    });
  });

  describe('API endpoints', () => {
    it('should return graph data at /api/graph', async () => {
      const response = await httpGet(testPort, '/api/graph');

      expect(response.status).toBe(200);
      expect(response.contentType).toBe('application/json');

      const data = JSON.parse(response.body) as DependencyGraph;
      expect(data.nodes).toHaveLength(1);
      expect(data.nodes[0]?.id).toBe('test-module');
      expect(data.edges).toHaveLength(0);
      expect(data.metadata.fileCount).toBe(1);
    });
  });

  describe('Static file serving', () => {
    it('should serve index.html at root', async () => {
      const response = await httpGet(testPort, '/');

      expect(response.status).toBe(200);
      expect(response.contentType).toBe('text/html');
      expect(response.body.toLowerCase()).toContain('<!doctype html>');
    });

    it('should serve index.html with correct content type', async () => {
      const response = await httpGet(testPort, '/index.html');

      expect(response.status).toBe(200);
      expect(response.contentType).toBe('text/html');
    });

    it('should return 404 for non-existent files', async () => {
      const response = await httpGet(testPort, '/nonexistent.html');

      expect(response.status).toBe(404);
      expect(response.body).toBe('Not found');
    });

    it('should not serve files outside public directory', async () => {
      const response = await httpGet(testPort, '/../../../etc/passwd');

      // Path.join normalizes the path, so it either:
      // - Returns 403 if path escapes publicDir (startsWith check)
      // - Returns 404 if normalized path doesn't exist
      expect([403, 404]).toContain(response.status);
    });
  });

  describe('MIME types', () => {
    it('should serve JSON with correct content type', async () => {
      const response = await httpGet(testPort, '/api/graph');
      expect(response.contentType).toBe('application/json');
    });

    it('should serve HTML with correct content type', async () => {
      const response = await httpGet(testPort, '/');
      expect(response.contentType).toBe('text/html');
    });
  });
});
