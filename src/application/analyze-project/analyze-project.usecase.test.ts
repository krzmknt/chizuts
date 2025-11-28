import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyzeProjectUseCase } from './analyze-project.usecase.js';
import type { IParser, IFileReader, ParsedFile } from '../../domain/index.js';
import { createNode, createEdge } from '../../domain/index.js';

describe('AnalyzeProjectUseCase', () => {
  let mockParser: IParser;
  let mockFileReader: IFileReader;
  let useCase: AnalyzeProjectUseCase;

  beforeEach(() => {
    mockParser = {
      parse: vi.fn(),
    };

    mockFileReader = {
      findFiles: vi.fn(),
      readFile: vi.fn(),
      exists: vi.fn(),
    };

    useCase = new AnalyzeProjectUseCase(mockParser, mockFileReader);
  });

  it('should analyze a project and return a dependency graph', () => {
    const filePaths = ['/project/src/a.ts', '/project/src/b.ts'];
    const parsedFiles: ParsedFile[] = [
      {
        filePath: '/project/src/a.ts',
        nodes: [
          createNode({
            id: 'a',
            label: 'a',
            type: 'module',
            filePath: '/project/src/a.ts',
            line: 1,
            column: 1,
          }),
        ],
        edges: [
          createEdge({
            source: 'a',
            target: 'b',
            type: 'import',
          }),
        ],
      },
      {
        filePath: '/project/src/b.ts',
        nodes: [
          createNode({
            id: 'b',
            label: 'b',
            type: 'module',
            filePath: '/project/src/b.ts',
            line: 1,
            column: 1,
          }),
        ],
        edges: [],
      },
    ];

    vi.mocked(mockFileReader.findFiles).mockReturnValue(filePaths);
    vi.mocked(mockParser.parse).mockReturnValue(parsedFiles);

    const result = useCase.execute({ rootDir: '/project' });

    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.metadata.rootDir).toBe('/project');
    expect(result.metadata.fileCount).toBe(2);
  });

  it('should pass include/exclude options to file reader', () => {
    vi.mocked(mockFileReader.findFiles).mockReturnValue([]);
    vi.mocked(mockParser.parse).mockReturnValue([]);

    useCase.execute({
      rootDir: '/project',
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts'],
    });

    expect(mockFileReader.findFiles).toHaveBeenCalledWith('/project', {
      include: ['src/**/*.ts'],
      exclude: ['**/*.test.ts'],
    });
  });

  it('should pass tsconfigPath to parser', () => {
    vi.mocked(mockFileReader.findFiles).mockReturnValue(['/project/src/a.ts']);
    vi.mocked(mockParser.parse).mockReturnValue([]);

    useCase.execute({
      rootDir: '/project',
      tsconfigPath: '/project/tsconfig.custom.json',
    });

    expect(mockParser.parse).toHaveBeenCalledWith(['/project/src/a.ts'], {
      rootDir: '/project',
      tsconfigPath: '/project/tsconfig.custom.json',
    });
  });

  it('should handle empty project (no files)', () => {
    vi.mocked(mockFileReader.findFiles).mockReturnValue([]);
    vi.mocked(mockParser.parse).mockReturnValue([]);

    const result = useCase.execute({ rootDir: '/empty-project' });

    expect(result.nodes).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.metadata.fileCount).toBe(0);
    expect(result.metadata.rootDir).toBe('/empty-project');
  });

  it('should call findFiles before parse', () => {
    const callOrder: string[] = [];

    vi.mocked(mockFileReader.findFiles).mockImplementation(() => {
      callOrder.push('findFiles');
      return ['/project/src/a.ts'];
    });

    vi.mocked(mockParser.parse).mockImplementation(() => {
      callOrder.push('parse');
      return [];
    });

    useCase.execute({ rootDir: '/project' });

    expect(callOrder).toEqual(['findFiles', 'parse']);
  });

  it('should pass found files to parser', () => {
    const foundFiles = [
      '/project/src/a.ts',
      '/project/src/b.ts',
      '/project/src/c.ts',
    ];
    vi.mocked(mockFileReader.findFiles).mockReturnValue(foundFiles);
    vi.mocked(mockParser.parse).mockReturnValue([]);

    useCase.execute({ rootDir: '/project' });

    expect(mockParser.parse).toHaveBeenCalledWith(foundFiles, {
      rootDir: '/project',
      tsconfigPath: undefined,
    });
  });

  it('should return immutable graph', () => {
    vi.mocked(mockFileReader.findFiles).mockReturnValue([]);
    vi.mocked(mockParser.parse).mockReturnValue([]);

    const result = useCase.execute({ rootDir: '/project' });

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.nodes)).toBe(true);
    expect(Object.isFrozen(result.edges)).toBe(true);
    expect(Object.isFrozen(result.metadata)).toBe(true);
  });

  it('should handle files with no options', () => {
    vi.mocked(mockFileReader.findFiles).mockReturnValue([]);
    vi.mocked(mockParser.parse).mockReturnValue([]);

    useCase.execute({ rootDir: '/project' });

    expect(mockFileReader.findFiles).toHaveBeenCalledWith('/project', {
      include: undefined,
      exclude: undefined,
    });
  });
});
