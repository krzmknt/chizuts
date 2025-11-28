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
 * Parses TypeScript source files and extracts dependency information.
 */
export class TypeScriptParserAdapter implements IParser {
  /**
   * Parses source files and extracts dependency information
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

    const results: ParsedFile[] = [];

    for (const filePath of filePaths) {
      const sourceFile = program.getSourceFile(filePath);
      if (!sourceFile) {
        continue;
      }

      const parsed = this.parseSourceFile(sourceFile, options.rootDir);
      results.push(parsed);
    }

    return results;
  }

  /**
   * Parses a single source file and extracts nodes and edges
   */
  private parseSourceFile(
    sourceFile: ts.SourceFile,
    rootDir: string
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

    // Visit all nodes in the AST
    const visit = (node: ts.Node): void => {
      // Import declarations
      if (ts.isImportDeclaration(node)) {
        this.processImport(node, moduleId, filePath, rootDir, edges);
      }

      // Export declarations
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

          // Process heritage clauses (extends, implements)
          this.processHeritageClause(node, classNode.id, edges);
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
      }

      ts.forEachChild(node, visit);
    };

    visit(sourceFile);

    return { filePath, nodes, edges };
  }

  /**
   * Process import declaration
   */
  private processImport(
    node: ts.ImportDeclaration,
    moduleId: string,
    filePath: string,
    rootDir: string,
    edges: Edge[]
  ): void {
    const moduleSpecifier = node.moduleSpecifier;
    if (!ts.isStringLiteral(moduleSpecifier)) {
      return;
    }

    const importPath = moduleSpecifier.text;
    const resolvedPath = this.resolveImportPath(importPath, filePath, rootDir);
    const targetModuleId = this.createModuleId(resolvedPath);

    edges.push(
      createEdge({
        source: moduleId,
        target: targetModuleId,
        type: 'import',
        metadata: { importPath },
      })
    );
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

    edges.push(
      createEdge({
        source: moduleId,
        target: targetModuleId,
        type: 'export',
        metadata: { exportPath },
      })
    );
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

    return createNode({
      id: `${moduleId}#${name}`,
      label: name,
      type: isComponent ? 'component' : 'class',
      filePath,
      line: line + 1,
      column: character + 1,
      metadata: {
        exported: this.hasExportModifier(node),
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

      nodes.push(
        createNode({
          id: `${moduleId}#${name}`,
          label: name,
          type,
          filePath,
          line: line + 1,
          column: character + 1,
          metadata: { exported: isExported },
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

    return createNode({
      id: `${moduleId}#${name}`,
      label: name,
      type: 'interface',
      filePath,
      line: line + 1,
      column: character + 1,
      metadata: {
        exported: this.hasExportModifier(node),
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

    return createNode({
      id: `${moduleId}#${name}`,
      label: name,
      type: 'type',
      filePath,
      line: line + 1,
      column: character + 1,
      metadata: {
        exported: this.hasExportModifier(node),
      },
    });
  }

  /**
   * Process heritage clauses (extends, implements)
   */
  private processHeritageClause(
    node: ts.ClassDeclaration,
    classId: string,
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
          edges.push(
            createEdge({
              source: classId,
              target: expression.text,
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
}
