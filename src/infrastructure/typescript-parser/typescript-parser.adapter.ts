/**
 * @fileoverview TypeScript parser adapter implementation.
 * @module infrastructure/typescript-parser
 *
 * This module provides a TypeScript Compiler API implementation
 * of the IParser port interface. It analyzes TypeScript source files
 * and extracts nodes (symbols) and edges (dependencies).
 */

import ts from 'typescript';
import * as path from 'node:path';
import type {
  IParser,
  ParsedFile,
  ParserOptions,
  Node,
  Edge,
  NodeType,
} from '../../domain/index.js';
import { createNode, createEdge } from '../../domain/index.js';

/**
 * TypeScript Compiler API implementation of IParser.
 *
 * This adapter uses the TypeScript Compiler API to parse source files
 * and extract dependency information including:
 * - Functions, classes, interfaces, types, enums, and variables
 * - Import and export relationships
 * - Class inheritance (extends) and interface implementation (implements)
 * - React components (both functional and class-based)
 *
 * @example
 * ```typescript
 * const parser = new TypeScriptParserAdapter();
 * const parsedFiles = parser.parse(filePaths, {
 *   rootDir: '/path/to/project',
 *   tsconfigPath: '/path/to/project/tsconfig.json',
 * });
 * ```
 */
export class TypeScriptParserAdapter implements IParser {
  /**
   * Parses source files and extracts dependency information.
   *
   * Performs two passes:
   * 1. Collects re-export mappings from all files
   * 2. Parses files with resolved re-exports to build nodes and edges
   *
   * @param filePaths - Array of absolute file paths to parse
   * @param options - Parser configuration including root directory and tsconfig path
   * @returns Array of parsed file information with nodes and edges
   */
  parse(filePaths: readonly string[], options: ParserOptions): ParsedFile[] {
    const tsconfigPath =
      options.tsconfigPath ?? path.join(options.rootDir, 'tsconfig.json');

    // Read tsconfig and create program
    const configFile = ts.readConfigFile(tsconfigPath, (path) =>
      ts.sys.readFile(path)
    );
    const parsedConfig = ts.parseJsonConfigFileContent(
      configFile.config,
      ts.sys,
      options.rootDir
    );

    const program = ts.createProgram(
      filePaths as string[],
      parsedConfig.options
    );

    // Get TypeChecker for symbol resolution
    const typeChecker = program.getTypeChecker();

    // First pass: Collect re-export mappings from all files
    const reexportMap = new Map<string, string>(); // maps re-export id -> original id

    for (const filePath of filePaths) {
      const sourceFile = program.getSourceFile(filePath);
      if (!sourceFile) {
        continue;
      }
      this.collectReexports(sourceFile, options.rootDir, reexportMap);
    }

    // Build fully resolved re-export map (follow chains)
    const resolvedReexportMap = this.resolveReexportChains(reexportMap);

    // Second pass: Parse files with resolved re-exports and build symbol registry
    const results: ParsedFile[] = [];
    // Maps ts.Symbol -> node ID for call edge resolution
    const symbolToNodeId = new Map<ts.Symbol, string>();
    // Maps declaration node -> node ID
    const declarationToNodeId = new Map<ts.Node, string>();

    for (const filePath of filePaths) {
      const sourceFile = program.getSourceFile(filePath);
      if (!sourceFile) {
        continue;
      }

      const parsed = this.parseSourceFile(
        sourceFile,
        options.rootDir,
        resolvedReexportMap,
        typeChecker,
        symbolToNodeId,
        declarationToNodeId
      );
      results.push(parsed);
    }

    // Third pass: Collect call edges using TypeChecker
    const resultsWithCallEdges: ParsedFile[] = [];
    for (const result of results) {
      const sourceFile = program.getSourceFile(result.filePath);
      if (!sourceFile) {
        resultsWithCallEdges.push(result);
        continue;
      }

      const callEdges = this.collectCallEdges(
        sourceFile,
        options.rootDir,
        typeChecker,
        symbolToNodeId,
        declarationToNodeId
      );

      // Create new result with combined edges
      resultsWithCallEdges.push({
        ...result,
        edges: [...result.edges, ...callEdges],
      });
    }

    return resultsWithCallEdges;
  }

  /**
   * Collects re-export mappings from a source file
   * Maps: moduleId#symbol -> targetModuleId#originalSymbol
   */
  private collectReexports(
    sourceFile: ts.SourceFile,
    rootDir: string,
    reexportMap: Map<string, string>
  ): void {
    const filePath = sourceFile.fileName;
    const relativeFilePath = path.relative(rootDir, filePath);
    const moduleId = this.createModuleId(relativeFilePath);

    const visit = (node: ts.Node): void => {
      if (ts.isExportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (moduleSpecifier && ts.isStringLiteral(moduleSpecifier)) {
          const exportPath = moduleSpecifier.text;
          const resolvedPath = this.resolveImportPath(
            exportPath,
            filePath,
            rootDir
          );
          const targetModuleId = this.createModuleId(resolvedPath);

          // Handle named exports: export { Foo, Bar } from './module'
          if (node.exportClause && ts.isNamedExports(node.exportClause)) {
            for (const element of node.exportClause.elements) {
              const originalName =
                element.propertyName?.text || element.name.text;
              const exportedName = element.name.text;

              // Map this module's export to the target module's symbol
              reexportMap.set(
                `${moduleId}#${exportedName}`,
                `${targetModuleId}#${originalName}`
              );
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
  }

  /**
   * Resolves re-export chains to find the original source
   * e.g., A#X -> B#X -> C#X becomes A#X -> C#X
   */
  private resolveReexportChains(
    reexportMap: Map<string, string>
  ): Map<string, string> {
    const resolved = new Map<string, string>();

    for (const [source, target] of reexportMap) {
      let current = target;
      const visited = new Set<string>([source]);

      // Follow the chain until we find a non-reexport target
      while (reexportMap.has(current) && !visited.has(current)) {
        visited.add(current);
        current = reexportMap.get(current)!;
      }

      resolved.set(source, current);
    }

    return resolved;
  }

  /**
   * Parses a single source file and extracts nodes and edges.
   * Also registers symbols for call edge resolution.
   */
  private parseSourceFile(
    sourceFile: ts.SourceFile,
    rootDir: string,
    reexportMap: Map<string, string>,
    typeChecker: ts.TypeChecker,
    symbolToNodeId: Map<ts.Symbol, string>,
    declarationToNodeId: Map<ts.Node, string>
  ): ParsedFile {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const filePath = sourceFile.fileName;
    const relativeFilePath = path.relative(rootDir, filePath);

    // Create module node for the file itself
    const moduleId = this.createModuleId(relativeFilePath);
    nodes.push(
      createNode({
        id: moduleId,
        label: relativeFilePath,
        type: 'module',
        filePath,
        line: 1,
        column: 1,
      })
    );

    // Build import map: symbol name -> source module ID
    const importMap = this.buildImportMap(
      sourceFile,
      filePath,
      rootDir,
      reexportMap
    );

    // Helper to register a symbol for call edge resolution
    const registerSymbol = (node: ts.Node, nodeId: string): void => {
      const symbol = typeChecker.getSymbolAtLocation(
        ts.isVariableDeclaration(node) && node.name
          ? node.name
          : ts.isFunctionDeclaration(node) && node.name
            ? node.name
            : ts.isClassDeclaration(node) && node.name
              ? node.name
              : ts.isMethodDeclaration(node) && node.name
                ? node.name
                : ts.isPropertyDeclaration(node) && node.name
                  ? node.name
                  : node
      );
      if (symbol) {
        symbolToNodeId.set(symbol, nodeId);
      }
      declarationToNodeId.set(node, nodeId);
    };

    // Visit all nodes in the AST
    const visit = (node: ts.Node): void => {
      // Import declarations
      if (ts.isImportDeclaration(node)) {
        this.processImport(
          node,
          moduleId,
          filePath,
          rootDir,
          reexportMap,
          edges
        );
      }

      // Export declarations (re-exports) - only create module-level edge for namespace exports
      if (ts.isExportDeclaration(node)) {
        this.processExport(node, moduleId, filePath, rootDir, edges);
      }

      // Function declarations
      if (ts.isFunctionDeclaration(node) && node.name) {
        const funcNode = this.processFunctionDeclaration(
          node,
          moduleId,
          filePath,
          sourceFile
        );
        if (funcNode) {
          nodes.push(funcNode);
          edges.push(
            createEdge({
              source: moduleId,
              target: funcNode.id,
              type: 'export',
            })
          );
          // Register symbol for call edge resolution
          registerSymbol(node, funcNode.id);
        }
      }

      // Class declarations
      if (ts.isClassDeclaration(node) && node.name) {
        const classNode = this.processClassDeclaration(
          node,
          moduleId,
          filePath,
          sourceFile
        );
        if (classNode) {
          nodes.push(classNode);
          edges.push(
            createEdge({
              source: moduleId,
              target: classNode.id,
              type: 'export',
            })
          );
          // Register class symbol
          registerSymbol(node, classNode.id);

          // Process heritage clauses (extends, implements)
          this.processHeritageClause(
            node,
            classNode.id,
            moduleId,
            importMap,
            edges
          );

          // Process class members (methods and fields)
          const memberNodes = this.processClassMembers(
            node,
            classNode.id,
            filePath,
            sourceFile
          );
          for (const memberNode of memberNodes) {
            nodes.push(memberNode);
            edges.push(
              createEdge({
                source: classNode.id,
                target: memberNode.id,
                type: 'export', // class "defines" this member
              })
            );
          }

          // Register class member symbols
          for (const member of node.members) {
            if (
              (ts.isMethodDeclaration(member) ||
                ts.isPropertyDeclaration(member)) &&
              member.name
            ) {
              const memberName = member.name.getText(sourceFile);
              const memberId = `${classNode.id}.${memberName}`;
              registerSymbol(member, memberId);
            }
          }
        }
      }

      // Variable declarations (const, let, var)
      if (ts.isVariableStatement(node)) {
        const varNodes = this.processVariableStatement(
          node,
          moduleId,
          filePath,
          sourceFile
        );
        for (const varNode of varNodes) {
          nodes.push(varNode);
          edges.push(
            createEdge({
              source: moduleId,
              target: varNode.id,
              type: 'export',
            })
          );
        }
        // Register variable symbols
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            const varName = declaration.name.text;
            const varId = `${moduleId}#${varName}`;
            registerSymbol(declaration, varId);
          }
        }
      }

      // Interface declarations
      if (ts.isInterfaceDeclaration(node)) {
        const interfaceNode = this.processInterfaceDeclaration(
          node,
          moduleId,
          filePath,
          sourceFile
        );
        nodes.push(interfaceNode);
        edges.push(
          createEdge({
            source: moduleId,
            target: interfaceNode.id,
            type: 'export',
          })
        );
        // Register interface symbol
        registerSymbol(node, interfaceNode.id);
      }

      // Type alias declarations
      if (ts.isTypeAliasDeclaration(node)) {
        const typeNode = this.processTypeAliasDeclaration(
          node,
          moduleId,
          filePath,
          sourceFile
        );
        nodes.push(typeNode);
        edges.push(
          createEdge({
            source: moduleId,
            target: typeNode.id,
            type: 'export',
          })
        );
        // Register type symbol
        registerSymbol(node, typeNode.id);
      }

      // Enum declarations
      if (ts.isEnumDeclaration(node)) {
        const enumNode = this.processEnumDeclaration(
          node,
          moduleId,
          filePath,
          sourceFile
        );
        if (enumNode) {
          nodes.push(enumNode);
          edges.push(
            createEdge({
              source: moduleId,
              target: enumNode.id,
              type: 'export',
            })
          );
          // Register enum symbol
          registerSymbol(node, enumNode.id);
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return { filePath, nodes, edges };
  }

  /**
   * Process import declaration
   */
  /**
   * Build a map of imported symbol names to their source module IDs
   */
  private buildImportMap(
    sourceFile: ts.SourceFile,
    filePath: string,
    rootDir: string,
    reexportMap: Map<string, string>
  ): Map<string, string> {
    const importMap = new Map<string, string>();

    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (!ts.isStringLiteral(moduleSpecifier)) {
          return;
        }

        const importPath = moduleSpecifier.text;
        const resolvedPath = this.resolveImportPath(
          importPath,
          filePath,
          rootDir
        );
        const sourceModuleId = this.createModuleId(resolvedPath);

        // Get imported bindings
        const importClause = node.importClause;
        if (importClause) {
          // Named imports: import { Foo, Bar } from '...'
          if (
            importClause.namedBindings &&
            ts.isNamedImports(importClause.namedBindings)
          ) {
            for (const element of importClause.namedBindings.elements) {
              const localName = element.name.text;
              const originalName = element.propertyName?.text || localName;
              const tentativeId = `${sourceModuleId}#${originalName}`;
              // Resolve through re-exports to find the actual source
              const resolvedId = reexportMap.get(tentativeId) ?? tentativeId;
              importMap.set(localName, resolvedId);
            }
          }
          // Default import: import Foo from '...'
          if (importClause.name) {
            const tentativeId = `${sourceModuleId}#default`;
            const resolvedId = reexportMap.get(tentativeId) ?? tentativeId;
            importMap.set(importClause.name.text, resolvedId);
          }
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return importMap;
  }

  private processImport(
    node: ts.ImportDeclaration,
    moduleId: string,
    filePath: string,
    rootDir: string,
    reexportMap: Map<string, string>,
    edges: Edge[]
  ): void {
    const moduleSpecifier = node.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) {
      return;
    }

    const importPath = moduleSpecifier.text;
    const resolvedPath = this.resolveImportPath(importPath, filePath, rootDir);
    const targetModuleId = this.createModuleId(resolvedPath);

    // Helper to resolve symbol through re-export chain
    const resolveTarget = (symbolTarget: string): string => {
      return reexportMap.get(symbolTarget) ?? symbolTarget;
    };

    // Get imported bindings
    const importClause = node.importClause;
    const importedSymbols: string[] = [];

    if (importClause) {
      // Named imports: import { Foo, Bar } from '...'
      if (
        importClause.namedBindings &&
        ts.isNamedImports(importClause.namedBindings)
      ) {
        for (const element of importClause.namedBindings.elements) {
          const originalName = element.propertyName?.text || element.name.text;
          importedSymbols.push(originalName);

          // Create edge to the resolved target (through re-exports)
          const directTarget = `${targetModuleId}#${originalName}`;
          const resolvedTarget = resolveTarget(directTarget);

          edges.push(
            createEdge({
              source: moduleId,
              target: resolvedTarget,
              type: 'import',
              metadata: { importPath, symbol: originalName },
            })
          );
        }
      }

      // Namespace import: import * as foo from '...'
      if (
        importClause.namedBindings &&
        ts.isNamespaceImport(importClause.namedBindings)
      ) {
        // For namespace imports, just create module-level edge
        edges.push(
          createEdge({
            source: moduleId,
            target: targetModuleId,
            type: 'import',
            metadata: {
              importPath,
              namespace: importClause.namedBindings.name.text,
            },
          })
        );
        return;
      }

      // Default import: import Foo from '...'
      if (importClause.name) {
        importedSymbols.push('default');
        const directTarget = `${targetModuleId}#default`;
        const resolvedTarget = resolveTarget(directTarget);

        edges.push(
          createEdge({
            source: moduleId,
            target: resolvedTarget,
            type: 'import',
            metadata: { importPath, symbol: 'default' },
          })
        );
      }
    }

    // If no specific symbols imported (side-effect import), create module-level edge
    if (importedSymbols.length === 0) {
      edges.push(
        createEdge({
          source: moduleId,
          target: targetModuleId,
          type: 'import',
          metadata: { importPath },
        })
      );
    }
  }

  /**
   * Process export declaration
   */
  private processExport(
    node: ts.ExportDeclaration,
    moduleId: string,
    filePath: string,
    rootDir: string,
    edges: Edge[]
  ): void {
    const moduleSpecifier = node.moduleSpecifier;
    if (!moduleSpecifier || !ts.isStringLiteral(moduleSpecifier)) {
      return;
    }

    const exportPath = moduleSpecifier.text;
    const resolvedPath = this.resolveImportPath(exportPath, filePath, rootDir);
    const targetModuleId = this.createModuleId(resolvedPath);

    // Only create module-level edge for namespace re-exports (export * from)
    // Named re-exports are handled via reexportMap in processImport
    if (!node.exportClause) {
      edges.push(
        createEdge({
          source: moduleId,
          target: targetModuleId,
          type: 'export',
          metadata: { exportPath, namespaceReexport: true },
        })
      );
    }
  }

  /**
   * Process function declaration
   */
  private processFunctionDeclaration(
    node: ts.FunctionDeclaration,
    moduleId: string,
    filePath: string,
    sourceFile: ts.SourceFile
  ): Node | null {
    if (!node.name) {
      return null;
    }

    const name = node.name.text;
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile)
    );

    // Check if it's a React component (returns JSX)
    const isComponent = this.isReactComponent(node);

    // Extract TSDoc comment
    const tsdoc = this.extractTSDoc(node, sourceFile);

    return createNode({
      id: `${moduleId}#${name}`,
      label: name,
      type: isComponent ? 'component' : 'function',
      filePath,
      line: line + 1,
      column: character + 1,
      metadata: {
        exported: this.hasExportModifier(node),
        async: this.hasAsyncModifier(node),
        ...(tsdoc && { tsdoc }),
      },
    });
  }

  /**
   * Process class declaration
   */
  private processClassDeclaration(
    node: ts.ClassDeclaration,
    moduleId: string,
    filePath: string,
    sourceFile: ts.SourceFile
  ): Node | null {
    if (!node.name) {
      return null;
    }

    const name = node.name.text;
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile)
    );

    // Check if it's a React component (extends Component or has render method)
    const isComponent = this.isReactClassComponent(node, sourceFile);

    // Extract TSDoc comment
    const tsdoc = this.extractTSDoc(node, sourceFile);

    // Extract public methods
    const methods = this.extractPublicMethods(node, sourceFile);

    return createNode({
      id: `${moduleId}#${name}`,
      label: name,
      type: isComponent ? 'component' : 'class',
      filePath,
      line: line + 1,
      column: character + 1,
      metadata: {
        exported: this.hasExportModifier(node),
        ...(tsdoc && { tsdoc }),
        ...(methods.length > 0 && { methods }),
      },
    });
  }

  /**
   * Process variable statement
   */
  private processVariableStatement(
    node: ts.VariableStatement,
    moduleId: string,
    filePath: string,
    sourceFile: ts.SourceFile
  ): Node[] {
    const nodes: Node[] = [];
    const isExported = this.hasExportModifier(node);

    // Only include exported variables (top-level API)
    if (!isExported) {
      return nodes;
    }

    for (const declaration of node.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name)) {
        continue;
      }

      const name = declaration.name.text;
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(
        declaration.getStart(sourceFile)
      );

      // Check if it's an arrow function component
      let type: NodeType = 'variable';
      if (
        declaration.initializer &&
        (ts.isArrowFunction(declaration.initializer) ||
          ts.isFunctionExpression(declaration.initializer))
      ) {
        type = this.isReactComponent(declaration.initializer)
          ? 'component'
          : 'function';
      }

      // Extract TSDoc comment
      const tsdoc = this.extractTSDoc(node, sourceFile);

      nodes.push(
        createNode({
          id: `${moduleId}#${name}`,
          label: name,
          type,
          filePath,
          line: line + 1,
          column: character + 1,
          metadata: { exported: isExported, ...(tsdoc && { tsdoc }) },
        })
      );
    }

    return nodes;
  }

  /**
   * Process interface declaration
   */
  private processInterfaceDeclaration(
    node: ts.InterfaceDeclaration,
    moduleId: string,
    filePath: string,
    sourceFile: ts.SourceFile
  ): Node {
    const name = node.name.text;
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile)
    );

    // Extract TSDoc comment
    const tsdoc = this.extractTSDoc(node, sourceFile);

    return createNode({
      id: `${moduleId}#${name}`,
      label: name,
      type: 'interface',
      filePath,
      line: line + 1,
      column: character + 1,
      metadata: {
        exported: this.hasExportModifier(node),
        ...(tsdoc && { tsdoc }),
      },
    });
  }

  /**
   * Process type alias declaration
   */
  private processTypeAliasDeclaration(
    node: ts.TypeAliasDeclaration,
    moduleId: string,
    filePath: string,
    sourceFile: ts.SourceFile
  ): Node {
    const name = node.name.text;
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile)
    );

    // Extract TSDoc comment
    const tsdoc = this.extractTSDoc(node, sourceFile);

    return createNode({
      id: `${moduleId}#${name}`,
      label: name,
      type: 'type',
      filePath,
      line: line + 1,
      column: character + 1,
      metadata: {
        exported: this.hasExportModifier(node),
        ...(tsdoc && { tsdoc }),
      },
    });
  }

  /**
   * Process enum declaration
   */
  private processEnumDeclaration(
    node: ts.EnumDeclaration,
    moduleId: string,
    filePath: string,
    sourceFile: ts.SourceFile
  ): Node | null {
    const isExported = this.hasExportModifier(node);

    // Only include exported enums (top-level API)
    if (!isExported) {
      return null;
    }

    const name = node.name.text;
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile)
    );

    // Extract TSDoc comment
    const tsdoc = this.extractTSDoc(node, sourceFile);

    // Extract enum members
    const members = node.members
      .map((member) => {
        if (ts.isIdentifier(member.name)) {
          return member.name.text;
        }
        if (ts.isStringLiteral(member.name)) {
          return member.name.text;
        }
        // For computed property names, get the text from source
        return member.name.getText(sourceFile);
      })
      .filter((m): m is string => typeof m === 'string');

    return createNode({
      id: `${moduleId}#${name}`,
      label: name,
      type: 'enum',
      filePath,
      line: line + 1,
      column: character + 1,
      metadata: {
        exported: isExported,
        ...(tsdoc && { tsdoc }),
        ...(members.length > 0 && { members }),
      },
    });
  }

  /**
   * Process heritage clauses (extends, implements)
   */
  private processHeritageClause(
    node: ts.ClassDeclaration,
    classId: string,
    moduleId: string,
    importMap: Map<string, string>,
    edges: Edge[]
  ): void {
    if (!node.heritageClauses) {
      return;
    }

    for (const clause of node.heritageClauses) {
      const edgeType =
        clause.token === ts.SyntaxKind.ExtendsKeyword
          ? 'extends'
          : 'implements';

      for (const type of clause.types) {
        const expression = type.expression;
        if (ts.isIdentifier(expression)) {
          const symbolName = expression.text;
          // Try to resolve the symbol from imports, otherwise assume same module
          const targetId =
            importMap.get(symbolName) || `${moduleId}#${symbolName}`;

          edges.push(
            createEdge({
              source: classId,
              target: targetId,
              type: edgeType,
            })
          );
        }
      }
    }
  }

  /**
   * Create a module ID from file path
   */
  private createModuleId(filePath: string): string {
    // Remove extension and normalize
    return filePath
      .replace(/\.(ts|tsx|js|jsx)$/, '')
      .replace(/\\/g, '/')
      .replace(/\/index$/, '');
  }

  /**
   * Resolve import path to relative file path
   */
  private resolveImportPath(
    importPath: string,
    fromFile: string,
    rootDir: string
  ): string {
    // External module (node_modules)
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return `node_modules/${importPath}`;
    }

    // Relative import
    const fromDir = path.dirname(fromFile);
    const resolved = path.resolve(fromDir, importPath);
    return path.relative(rootDir, resolved);
  }

  /**
   * Check if a node has export modifier
   */
  private hasExportModifier(
    node: ts.Node & { modifiers?: ts.NodeArray<ts.ModifierLike> }
  ): boolean {
    return (
      node.modifiers?.some(
        (mod) =>
          mod.kind === ts.SyntaxKind.ExportKeyword ||
          mod.kind === ts.SyntaxKind.DefaultKeyword
      ) ?? false
    );
  }

  /**
   * Check if a node has async modifier
   */
  private hasAsyncModifier(
    node: ts.Node & { modifiers?: ts.NodeArray<ts.ModifierLike> }
  ): boolean {
    return (
      node.modifiers?.some((mod) => mod.kind === ts.SyntaxKind.AsyncKeyword) ??
      false
    );
  }

  /**
   * Check if a function/arrow function is a React component
   * (heuristic: returns JSX or has JSX in body)
   */
  private isReactComponent(
    node: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression
  ): boolean {
    let hasJsx = false;

    const checkForJsx = (n: ts.Node): void => {
      if (
        ts.isJsxElement(n) ||
        ts.isJsxSelfClosingElement(n) ||
        ts.isJsxFragment(n)
      ) {
        hasJsx = true;
        return;
      }
      ts.forEachChild(n, checkForJsx);
    };

    if (node.body) {
      checkForJsx(node.body);
    }

    return hasJsx;
  }

  /**
   * Check if a class is a React class component
   */
  private isReactClassComponent(
    node: ts.ClassDeclaration,
    sourceFile: ts.SourceFile
  ): boolean {
    // Check if extends React.Component or Component
    if (node.heritageClauses) {
      for (const clause of node.heritageClauses) {
        if (clause.token === ts.SyntaxKind.ExtendsKeyword) {
          for (const type of clause.types) {
            const text = type.expression.getText(sourceFile);
            if (
              text === 'Component' ||
              text === 'PureComponent' ||
              text.includes('React.Component') ||
              text.includes('React.PureComponent')
            ) {
              return true;
            }
          }
        }
      }
    }

    // Check if has render method
    for (const member of node.members) {
      if (
        ts.isMethodDeclaration(member) &&
        ts.isIdentifier(member.name) &&
        member.name.text === 'render'
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract TSDoc/JSDoc comment from a node
   */
  private extractTSDoc(
    node: ts.Node,
    sourceFile: ts.SourceFile
  ): string | undefined {
    const text = sourceFile.getFullText();
    const commentRanges = ts.getLeadingCommentRanges(text, node.getFullStart());

    if (!commentRanges || commentRanges.length === 0) {
      return undefined;
    }

    // Get the last comment before the node (closest to the declaration)
    const lastComment = commentRanges[commentRanges.length - 1];
    if (!lastComment) {
      return undefined;
    }

    const commentText = text.slice(lastComment.pos, lastComment.end);

    // Check if it's a JSDoc/TSDoc comment (starts with /**)
    if (commentText.startsWith('/**')) {
      // Clean up the comment - remove /** */ and leading * from each line
      return commentText
        .replace(/^\/\*\*\s*/, '')
        .replace(/\s*\*\/$/, '')
        .split('\n')
        .map((line) => line.replace(/^\s*\*\s?/, ''))
        .join('\n')
        .trim();
    }

    return undefined;
  }

  /**
   * Extract public methods from a class declaration
   */
  private extractPublicMethods(
    node: ts.ClassDeclaration,
    sourceFile: ts.SourceFile
  ): Array<{ name: string; tsdoc?: string }> {
    const methods: Array<{ name: string; tsdoc?: string }> = [];

    for (const member of node.members) {
      // Only process method declarations
      if (!ts.isMethodDeclaration(member) || !ts.isIdentifier(member.name)) {
        continue;
      }

      // Skip private and protected methods
      const modifiers = ts.canHaveModifiers(member)
        ? ts.getModifiers(member)
        : undefined;
      const isPrivate = modifiers?.some(
        (mod: ts.Modifier) => mod.kind === ts.SyntaxKind.PrivateKeyword
      );
      const isProtected = modifiers?.some(
        (mod: ts.Modifier) => mod.kind === ts.SyntaxKind.ProtectedKeyword
      );

      if (isPrivate || isProtected) {
        continue;
      }

      const name = member.name.text;
      const tsdoc = this.extractTSDoc(member, sourceFile);
      methods.push({ name, ...(tsdoc && { tsdoc }) });
    }

    return methods;
  }

  /**
   * Process class members and create nodes for public methods and fields
   */
  private processClassMembers(
    node: ts.ClassDeclaration,
    classId: string,
    filePath: string,
    sourceFile: ts.SourceFile
  ): Node[] {
    const memberNodes: Node[] = [];

    for (const member of node.members) {
      // Check if member is public (not private or protected)
      const modifiers = ts.canHaveModifiers(member)
        ? ts.getModifiers(member)
        : undefined;
      const isPrivate = modifiers?.some(
        (mod: ts.Modifier) => mod.kind === ts.SyntaxKind.PrivateKeyword
      );
      const isProtected = modifiers?.some(
        (mod: ts.Modifier) => mod.kind === ts.SyntaxKind.ProtectedKeyword
      );

      if (isPrivate || isProtected) {
        continue;
      }

      // Process methods
      if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
        const name = member.name.text;
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          member.getStart(sourceFile)
        );
        const tsdoc = this.extractTSDoc(member, sourceFile);

        memberNodes.push(
          createNode({
            id: `${classId}.${name}`,
            label: name,
            type: 'method',
            filePath,
            line: line + 1,
            column: character + 1,
            metadata: {
              ...(tsdoc && { tsdoc }),
            },
          })
        );
      }

      // Process property declarations (fields)
      if (ts.isPropertyDeclaration(member) && ts.isIdentifier(member.name)) {
        const name = member.name.text;
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          member.getStart(sourceFile)
        );
        const tsdoc = this.extractTSDoc(member, sourceFile);

        memberNodes.push(
          createNode({
            id: `${classId}.${name}`,
            label: name,
            type: 'field',
            filePath,
            line: line + 1,
            column: character + 1,
            metadata: {
              ...(tsdoc && { tsdoc }),
            },
          })
        );
      }
    }

    return memberNodes;
  }

  /**
   * Collects call edges by traversing the AST and resolving symbols using TypeChecker.
   * Detects:
   * - Function calls: foo(), bar.baz()
   * - Method calls: obj.method()
   * - Property accesses: obj.field
   * - Constructor calls: new Foo()
   */
  private collectCallEdges(
    sourceFile: ts.SourceFile,
    rootDir: string,
    typeChecker: ts.TypeChecker,
    symbolToNodeId: Map<ts.Symbol, string>,
    declarationToNodeId: Map<ts.Node, string>
  ): Edge[] {
    const edges: Edge[] = [];
    const addedEdges = new Set<string>(); // Track added edges to avoid duplicates
    const relativeFilePath = path.relative(rootDir, sourceFile.fileName);
    const currentModuleId = this.createModuleId(relativeFilePath);

    // Find the enclosing symbol (function, method, or module) for a node
    const findEnclosingSymbolId = (node: ts.Node): string | null => {
      let current: ts.Node | undefined = node.parent;

      while (current) {
        // Check if we're inside a function declaration
        if (ts.isFunctionDeclaration(current) && current.name) {
          const funcName = current.name.text;
          return `${currentModuleId}#${funcName}`;
        }

        // Check if we're inside a function expression or arrow function
        if (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) {
          // Look for variable declaration parent
          const varParent = current.parent;
          if (
            ts.isVariableDeclaration(varParent) &&
            ts.isIdentifier(varParent.name)
          ) {
            const varName = varParent.name.text;
            return `${currentModuleId}#${varName}`;
          }
        }

        // Check if we're inside a method
        if (
          ts.isMethodDeclaration(current) &&
          current.name &&
          ts.isIdentifier(current.name)
        ) {
          const methodName = current.name.text;
          // Find the parent class
          const classNode = current.parent;
          if (ts.isClassDeclaration(classNode) && classNode.name) {
            const className = classNode.name.text;
            return `${currentModuleId}#${className}.${methodName}`;
          }
        }

        current = current.parent;
      }

      // Default to module level
      return currentModuleId;
    };

    // Resolve a symbol to its node ID
    const resolveSymbolToNodeId = (symbol: ts.Symbol): string | null => {
      // First, try direct lookup
      if (symbolToNodeId.has(symbol)) {
        return symbolToNodeId.get(symbol)!;
      }

      // Try to get the aliased symbol (for imports)
      try {
        const aliasedSymbol = typeChecker.getAliasedSymbol(symbol);
        if (aliasedSymbol && symbolToNodeId.has(aliasedSymbol)) {
          return symbolToNodeId.get(aliasedSymbol)!;
        }
      } catch {
        // getAliasedSymbol can throw if symbol is not an alias
      }

      // Try to find via declarations
      const declarations = symbol.getDeclarations();
      if (declarations && declarations.length > 0) {
        for (const decl of declarations) {
          if (declarationToNodeId.has(decl)) {
            return declarationToNodeId.get(decl)!;
          }
        }
      }

      return null;
    };

    // Add a call edge if valid
    const addCallEdge = (sourceId: string, targetId: string): void => {
      const edgeKey = `${sourceId}->${targetId}`;
      if (!addedEdges.has(edgeKey) && sourceId !== targetId) {
        addedEdges.add(edgeKey);
        edges.push(
          createEdge({
            source: sourceId,
            target: targetId,
            type: 'call',
          })
        );
      }
    };

    const visit = (node: ts.Node): void => {
      // Handle CallExpression: foo() or obj.method()
      if (ts.isCallExpression(node)) {
        const sourceId = findEnclosingSymbolId(node);
        if (!sourceId) {
          ts.forEachChild(node, visit);
          return;
        }

        const expression = node.expression;

        // Direct function call: foo()
        if (ts.isIdentifier(expression)) {
          const symbol = typeChecker.getSymbolAtLocation(expression);
          if (symbol) {
            const targetId = resolveSymbolToNodeId(symbol);
            if (targetId) {
              addCallEdge(sourceId, targetId);
            }
          }
        }

        // Property access call: obj.method() or obj.prop.method()
        if (ts.isPropertyAccessExpression(expression)) {
          const symbol = typeChecker.getSymbolAtLocation(expression.name);
          if (symbol) {
            const targetId = resolveSymbolToNodeId(symbol);
            if (targetId) {
              addCallEdge(sourceId, targetId);
            }
          }
        }
      }

      // Handle NewExpression: new Foo()
      if (ts.isNewExpression(node)) {
        const sourceId = findEnclosingSymbolId(node);
        if (!sourceId) {
          ts.forEachChild(node, visit);
          return;
        }

        const expression = node.expression;
        if (ts.isIdentifier(expression)) {
          const symbol = typeChecker.getSymbolAtLocation(expression);
          if (symbol) {
            const targetId = resolveSymbolToNodeId(symbol);
            if (targetId) {
              addCallEdge(sourceId, targetId);
            }
          }
        }
      }

      // Handle PropertyAccessExpression for field access (not calls)
      if (
        ts.isPropertyAccessExpression(node) &&
        !ts.isCallExpression(node.parent)
      ) {
        const sourceId = findEnclosingSymbolId(node);
        if (!sourceId) {
          ts.forEachChild(node, visit);
          return;
        }

        const symbol = typeChecker.getSymbolAtLocation(node.name);
        if (symbol) {
          const targetId = resolveSymbolToNodeId(symbol);
          if (targetId) {
            addCallEdge(sourceId, targetId);
          }
        }
      }

      // Handle Identifier for variable references
      // Skip: declarations, property access names, function/method names being called
      if (ts.isIdentifier(node)) {
        const parent = node.parent;

        // Skip if this is a property name in property access (e.g., obj.prop - skip 'prop')
        if (ts.isPropertyAccessExpression(parent) && parent.name === node) {
          ts.forEachChild(node, visit);
          return;
        }

        // Skip if this is the function being called (e.g., foo() - skip 'foo')
        if (ts.isCallExpression(parent) && parent.expression === node) {
          ts.forEachChild(node, visit);
          return;
        }

        // Skip if this is the class being instantiated (e.g., new Foo() - skip 'Foo')
        if (ts.isNewExpression(parent) && parent.expression === node) {
          ts.forEachChild(node, visit);
          return;
        }

        // Skip declarations
        if (
          ts.isVariableDeclaration(parent) ||
          ts.isFunctionDeclaration(parent) ||
          ts.isParameter(parent) ||
          ts.isImportSpecifier(parent) ||
          ts.isExportSpecifier(parent) ||
          ts.isClassDeclaration(parent) ||
          ts.isInterfaceDeclaration(parent) ||
          ts.isTypeAliasDeclaration(parent) ||
          ts.isEnumDeclaration(parent) ||
          ts.isMethodDeclaration(parent) ||
          ts.isPropertyDeclaration(parent) ||
          ts.isImportClause(parent) ||
          ts.isNamespaceImport(parent)
        ) {
          ts.forEachChild(node, visit);
          return;
        }

        const sourceId = findEnclosingSymbolId(node);
        if (!sourceId) {
          ts.forEachChild(node, visit);
          return;
        }

        const symbol = typeChecker.getSymbolAtLocation(node);
        if (symbol) {
          const targetId = resolveSymbolToNodeId(symbol);
          if (targetId) {
            addCallEdge(sourceId, targetId);
          }
        }
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return edges;
  }
}
