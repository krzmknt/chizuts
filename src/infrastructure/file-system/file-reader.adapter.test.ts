import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileReaderAdapter } from './file-reader.adapter.js';

describe('FileReaderAdapter', () => {
  let adapter: FileReaderAdapter;
  let tempDir: string;

  beforeEach(() => {
    adapter = new FileReaderAdapter();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chizuts-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('findFiles', () => {
    it('should find TypeScript files in a directory', () => {
      fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export const a = 1;');
      fs.writeFileSync(path.join(tempDir, 'utils.ts'), 'export const b = 2;');

      const files = adapter.findFiles(tempDir);

      expect(files).toHaveLength(2);
      expect(files).toContain(path.join(tempDir, 'index.ts'));
      expect(files).toContain(path.join(tempDir, 'utils.ts'));
    });

    it('should find TSX files', () => {
      fs.writeFileSync(
        path.join(tempDir, 'Component.tsx'),
        'export const App = () => <div />;'
      );

      const files = adapter.findFiles(tempDir);

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('Component.tsx');
    });

    it('should exclude .d.ts files', () => {
      fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export const a = 1;');
      fs.writeFileSync(
        path.join(tempDir, 'types.d.ts'),
        'declare const x: number;'
      );

      const files = adapter.findFiles(tempDir);

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('index.ts');
    });

    it('should recursively find files in subdirectories', () => {
      const subDir = path.join(tempDir, 'src');
      fs.mkdirSync(subDir);
      fs.writeFileSync(path.join(tempDir, 'root.ts'), 'export const a = 1;');
      fs.writeFileSync(path.join(subDir, 'nested.ts'), 'export const b = 2;');

      const files = adapter.findFiles(tempDir);

      expect(files).toHaveLength(2);
    });

    it('should exclude node_modules by default', () => {
      const nodeModules = path.join(tempDir, 'node_modules');
      fs.mkdirSync(nodeModules);
      fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export const a = 1;');
      fs.writeFileSync(
        path.join(nodeModules, 'package.ts'),
        'export const b = 2;'
      );

      const files = adapter.findFiles(tempDir);

      expect(files).toHaveLength(1);
      expect(files[0]).not.toContain('node_modules');
    });

    it('should exclude dist directory by default', () => {
      const distDir = path.join(tempDir, 'dist');
      fs.mkdirSync(distDir);
      fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export const a = 1;');
      fs.writeFileSync(path.join(distDir, 'index.ts'), 'export const b = 2;');

      const files = adapter.findFiles(tempDir);

      expect(files).toHaveLength(1);
      expect(files[0]).not.toContain('dist');
    });

    it('should ignore non-TypeScript files', () => {
      fs.writeFileSync(path.join(tempDir, 'index.ts'), 'export const a = 1;');
      fs.writeFileSync(path.join(tempDir, 'readme.md'), '# README');
      fs.writeFileSync(path.join(tempDir, 'script.js'), 'const a = 1;');
      fs.writeFileSync(path.join(tempDir, 'config.json'), '{}');

      const files = adapter.findFiles(tempDir);

      expect(files).toHaveLength(1);
      expect(files[0]).toContain('index.ts');
    });

    it('should return empty array for empty directory', () => {
      const files = adapter.findFiles(tempDir);

      expect(files).toHaveLength(0);
    });
  });

  describe('readFile', () => {
    it('should read file contents', () => {
      const filePath = path.join(tempDir, 'test.ts');
      const content = 'export const hello = "world";';
      fs.writeFileSync(filePath, content);

      const result = adapter.readFile(filePath);

      expect(result).toBe(content);
    });

    it('should read UTF-8 encoded files', () => {
      const filePath = path.join(tempDir, 'unicode.ts');
      const content = 'export const greeting = "こんにちは";';
      fs.writeFileSync(filePath, content, 'utf-8');

      const result = adapter.readFile(filePath);

      expect(result).toBe(content);
    });

    it('should throw error for non-existent file', () => {
      const filePath = path.join(tempDir, 'nonexistent.ts');

      expect(() => adapter.readFile(filePath)).toThrow();
    });
  });

  describe('exists', () => {
    it('should return true for existing file', () => {
      const filePath = path.join(tempDir, 'exists.ts');
      fs.writeFileSync(filePath, 'export const a = 1;');

      expect(adapter.exists(filePath)).toBe(true);
    });

    it('should return false for non-existent file', () => {
      const filePath = path.join(tempDir, 'nonexistent.ts');

      expect(adapter.exists(filePath)).toBe(false);
    });

    it('should return true for existing directory', () => {
      expect(adapter.exists(tempDir)).toBe(true);
    });
  });
});
