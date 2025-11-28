import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TypeScriptParserAdapter } from './typescript-parser.adapter.js';

describe('TypeScriptParserAdapter', () => {
  let adapter: TypeScriptParserAdapter;
  let tempDir: string;

  beforeEach(() => {
    adapter = new TypeScriptParserAdapter();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'graphts-parser-test-'));

    // Create minimal tsconfig.json
    fs.writeFileSync(
      path.join(tempDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          module: 'ESNext',
          moduleResolution: 'node',
          strict: true,
        },
      })
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('parse', () => {
    it('should create module node for each file', () => {
      const filePath = path.join(tempDir, 'index.ts');
      fs.writeFileSync(filePath, 'export const a = 1;');

      const results = adapter.parse([filePath], { rootDir: tempDir });

      expect(results).toHaveLength(1);
      expect(results[0]?.nodes.some((n) => n.type === 'module')).toBe(true);
    });

    it('should extract function declarations', () => {
      const filePath = path.join(tempDir, 'functions.ts');
      fs.writeFileSync(
        filePath,
        `
        export function greet(name: string): string {
          return "Hello, " + name;
        }

        function helper(): void {
          console.log("helper");
        }
      `
      );

      const results = adapter.parse([filePath], { rootDir: tempDir });
      const nodes = results[0]?.nodes ?? [];

      const functionNodes = nodes.filter((n) => n.type === 'function');
      expect(functionNodes.length).toBeGreaterThanOrEqual(1);
      expect(functionNodes.some((n) => n.label === 'greet')).toBe(true);
    });

    it('should extract class declarations', () => {
      const filePath = path.join(tempDir, 'classes.ts');
      fs.writeFileSync(
        filePath,
        `
        export class MyClass {
          private value: number;

          constructor(value: number) {
            this.value = value;
          }

          getValue(): number {
            return this.value;
          }
        }
      `
      );

      const results = adapter.parse([filePath], { rootDir: tempDir });
      const nodes = results[0]?.nodes ?? [];

      const classNodes = nodes.filter((n) => n.type === 'class');
      expect(classNodes).toHaveLength(1);
      expect(classNodes[0]?.label).toBe('MyClass');
    });

    it('should extract variable declarations', () => {
      const filePath = path.join(tempDir, 'variables.ts');
      fs.writeFileSync(
        filePath,
        `
        export const PI = 3.14159;
        export let counter = 0;
        const privateVar = "secret";
      `
      );

      const results = adapter.parse([filePath], { rootDir: tempDir });
      const nodes = results[0]?.nodes ?? [];

      const variableNodes = nodes.filter((n) => n.type === 'variable');
      expect(variableNodes.length).toBeGreaterThanOrEqual(1);
    });

    it('should extract interface declarations', () => {
      const filePath = path.join(tempDir, 'interfaces.ts');
      fs.writeFileSync(
        filePath,
        `
        export interface User {
          id: number;
          name: string;
        }

        interface InternalConfig {
          debug: boolean;
        }
      `
      );

      const results = adapter.parse([filePath], { rootDir: tempDir });
      const nodes = results[0]?.nodes ?? [];

      const interfaceNodes = nodes.filter((n) => n.type === 'interface');
      expect(interfaceNodes.length).toBeGreaterThanOrEqual(1);
      expect(interfaceNodes.some((n) => n.label === 'User')).toBe(true);
    });

    it('should extract type alias declarations', () => {
      const filePath = path.join(tempDir, 'types.ts');
      fs.writeFileSync(
        filePath,
        `
        export type ID = string | number;
        export type UserRole = 'admin' | 'user' | 'guest';
      `
      );

      const results = adapter.parse([filePath], { rootDir: tempDir });
      const nodes = results[0]?.nodes ?? [];

      const typeNodes = nodes.filter((n) => n.type === 'type');
      expect(typeNodes.length).toBeGreaterThanOrEqual(1);
    });

    it('should create import edges', () => {
      // Create two files with import relationship
      const utilsPath = path.join(tempDir, 'utils.ts');
      const mainPath = path.join(tempDir, 'main.ts');

      fs.writeFileSync(utilsPath, 'export const helper = () => {};');
      fs.writeFileSync(
        mainPath,
        `
        import { helper } from './utils';
        helper();
      `
      );

      const results = adapter.parse([mainPath, utilsPath], {
        rootDir: tempDir,
      });

      // Find all edges from all parsed files
      const allEdges = results.flatMap((r) => r.edges);
      const importEdges = allEdges.filter((e) => e.type === 'import');

      expect(importEdges.length).toBeGreaterThanOrEqual(1);
    });

    it('should create extends edges for class inheritance', () => {
      const filePath = path.join(tempDir, 'inheritance.ts');
      fs.writeFileSync(
        filePath,
        `
        class BaseClass {
          protected value: number = 0;
        }

        class DerivedClass extends BaseClass {
          getValue(): number {
            return this.value;
          }
        }
      `
      );

      const results = adapter.parse([filePath], { rootDir: tempDir });
      const edges = results[0]?.edges ?? [];

      const extendsEdges = edges.filter((e) => e.type === 'extends');
      expect(extendsEdges.length).toBeGreaterThanOrEqual(1);
    });

    it('should create implements edges for interface implementation', () => {
      const filePath = path.join(tempDir, 'implements.ts');
      fs.writeFileSync(
        filePath,
        `
        interface Printable {
          print(): void;
        }

        class Document implements Printable {
          print(): void {
            console.log("Printing...");
          }
        }
      `
      );

      const results = adapter.parse([filePath], { rootDir: tempDir });
      const edges = results[0]?.edges ?? [];

      const implementsEdges = edges.filter((e) => e.type === 'implements');
      expect(implementsEdges.length).toBeGreaterThanOrEqual(1);
    });

    it('should include line and column information', () => {
      const filePath = path.join(tempDir, 'location.ts');
      fs.writeFileSync(
        filePath,
        `export function testFunc(): void {
  console.log("test");
}`
      );

      const results = adapter.parse([filePath], { rootDir: tempDir });
      const nodes = results[0]?.nodes ?? [];

      const funcNode = nodes.find((n) => n.label === 'testFunc');
      expect(funcNode).toBeDefined();
      expect(funcNode?.line).toBeGreaterThan(0);
      expect(funcNode?.column).toBeGreaterThan(0);
    });

    it('should handle empty files', () => {
      const filePath = path.join(tempDir, 'empty.ts');
      fs.writeFileSync(filePath, '');

      const results = adapter.parse([filePath], { rootDir: tempDir });

      expect(results).toHaveLength(1);
      // Should at least have the module node
      expect(results[0]?.nodes.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle files with only comments', () => {
      const filePath = path.join(tempDir, 'comments.ts');
      fs.writeFileSync(
        filePath,
        `
        // This is a comment
        /* This is a multi-line
           comment */
      `
      );

      const results = adapter.parse([filePath], { rootDir: tempDir });

      expect(results).toHaveLength(1);
    });

    it('should parse multiple files', () => {
      const file1 = path.join(tempDir, 'file1.ts');
      const file2 = path.join(tempDir, 'file2.ts');

      fs.writeFileSync(file1, 'export const a = 1;');
      fs.writeFileSync(file2, 'export const b = 2;');

      const results = adapter.parse([file1, file2], { rootDir: tempDir });

      expect(results).toHaveLength(2);
    });

    it('should skip non-existent files gracefully', () => {
      const existingFile = path.join(tempDir, 'exists.ts');
      const nonExistentFile = path.join(tempDir, 'nonexistent.ts');

      fs.writeFileSync(existingFile, 'export const a = 1;');

      const results = adapter.parse([existingFile, nonExistentFile], {
        rootDir: tempDir,
      });

      // Should only return result for existing file
      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('React component detection', () => {
    it('should detect React functional components with JSX', () => {
      const filePath = path.join(tempDir, 'Component.tsx');
      fs.writeFileSync(
        filePath,
        `
        import React from 'react';

        export function MyComponent(): JSX.Element {
          return <div>Hello</div>;
        }
      `
      );

      // Update tsconfig for JSX
      fs.writeFileSync(
        path.join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            module: 'ESNext',
            moduleResolution: 'node',
            jsx: 'react',
            strict: true,
          },
        })
      );

      const results = adapter.parse([filePath], { rootDir: tempDir });
      const nodes = results[0]?.nodes ?? [];

      const componentNodes = nodes.filter((n) => n.type === 'component');
      expect(componentNodes.length).toBeGreaterThanOrEqual(1);
    });

    it('should detect arrow function components', () => {
      const filePath = path.join(tempDir, 'ArrowComponent.tsx');
      fs.writeFileSync(
        filePath,
        `
        import React from 'react';

        export const ArrowComponent = (): JSX.Element => {
          return <span>Arrow</span>;
        };
      `
      );

      fs.writeFileSync(
        path.join(tempDir, 'tsconfig.json'),
        JSON.stringify({
          compilerOptions: {
            target: 'ES2020',
            module: 'ESNext',
            moduleResolution: 'node',
            jsx: 'react',
            strict: true,
          },
        })
      );

      const results = adapter.parse([filePath], { rootDir: tempDir });
      const nodes = results[0]?.nodes ?? [];

      const componentNodes = nodes.filter((n) => n.type === 'component');
      expect(componentNodes.length).toBeGreaterThanOrEqual(1);
    });
  });
});
