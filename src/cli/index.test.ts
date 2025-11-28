import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { parseArgs, applyEnvOverrides, CliError, VERSION } from './index.js';
import type { CliOptions } from './index.js';

describe('parseArgs', () => {
  const defaultRootDir = '/default/path';

  it('should return default options when no arguments provided', () => {
    const result = parseArgs([], defaultRootDir);

    expect(result.rootDir).toBe(defaultRootDir);
    expect(result.port).toBe(3000);
    expect(result.include).toEqual([]);
    expect(result.exclude).toEqual([]);
    expect(result.tsconfigPath).toBeUndefined();
    expect(result.watch).toBe(false);
    expect(result.help).toBe(false);
    expect(result.version).toBe(false);
  });

  describe('--help / -h', () => {
    it('should set help to true with --help', () => {
      const result = parseArgs(['--help'], defaultRootDir);
      expect(result.help).toBe(true);
    });

    it('should set help to true with -h', () => {
      const result = parseArgs(['-h'], defaultRootDir);
      expect(result.help).toBe(true);
    });
  });

  describe('--version / -v', () => {
    it('should set version to true with --version', () => {
      const result = parseArgs(['--version'], defaultRootDir);
      expect(result.version).toBe(true);
    });

    it('should set version to true with -v', () => {
      const result = parseArgs(['-v'], defaultRootDir);
      expect(result.version).toBe(true);
    });
  });

  describe('--watch / -w', () => {
    it('should set watch to true with --watch', () => {
      const result = parseArgs(['--watch'], defaultRootDir);
      expect(result.watch).toBe(true);
    });

    it('should set watch to true with -w', () => {
      const result = parseArgs(['-w'], defaultRootDir);
      expect(result.watch).toBe(true);
    });
  });

  describe('--port / -p', () => {
    it('should set port with --port', () => {
      const result = parseArgs(['--port', '8080'], defaultRootDir);
      expect(result.port).toBe(8080);
    });

    it('should set port with -p', () => {
      const result = parseArgs(['-p', '4000'], defaultRootDir);
      expect(result.port).toBe(4000);
    });

    it('should throw CliError when --port has no value', () => {
      expect(() => parseArgs(['--port'], defaultRootDir)).toThrow(CliError);
      expect(() => parseArgs(['--port'], defaultRootDir)).toThrow(
        '--port requires a value'
      );
    });

    it('should throw CliError when port is invalid', () => {
      expect(() => parseArgs(['--port', 'abc'], defaultRootDir)).toThrow(
        CliError
      );
      expect(() => parseArgs(['--port', '0'], defaultRootDir)).toThrow(
        CliError
      );
      expect(() => parseArgs(['--port', '70000'], defaultRootDir)).toThrow(
        CliError
      );
    });

    it('should accept valid port range', () => {
      expect(parseArgs(['--port', '1'], defaultRootDir).port).toBe(1);
      expect(parseArgs(['--port', '65535'], defaultRootDir).port).toBe(65535);
    });
  });

  describe('--include', () => {
    it('should add include pattern', () => {
      const result = parseArgs(['--include', 'src/**/*.ts'], defaultRootDir);
      expect(result.include).toEqual(['src/**/*.ts']);
    });

    it('should support multiple include patterns', () => {
      const result = parseArgs(
        ['--include', 'src/**/*.ts', '--include', 'lib/**/*.ts'],
        defaultRootDir
      );
      expect(result.include).toEqual(['src/**/*.ts', 'lib/**/*.ts']);
    });

    it('should throw CliError when --include has no value', () => {
      expect(() => parseArgs(['--include'], defaultRootDir)).toThrow(CliError);
      expect(() => parseArgs(['--include'], defaultRootDir)).toThrow(
        '--include requires a value'
      );
    });
  });

  describe('--exclude', () => {
    it('should add exclude pattern', () => {
      const result = parseArgs(['--exclude', '**/*.test.ts'], defaultRootDir);
      expect(result.exclude).toEqual(['**/*.test.ts']);
    });

    it('should support multiple exclude patterns', () => {
      const result = parseArgs(
        ['--exclude', '**/*.test.ts', '--exclude', '**/node_modules/**'],
        defaultRootDir
      );
      expect(result.exclude).toEqual(['**/*.test.ts', '**/node_modules/**']);
    });

    it('should throw CliError when --exclude has no value', () => {
      expect(() => parseArgs(['--exclude'], defaultRootDir)).toThrow(CliError);
      expect(() => parseArgs(['--exclude'], defaultRootDir)).toThrow(
        '--exclude requires a value'
      );
    });
  });

  describe('--tsconfig', () => {
    it('should set tsconfig path', () => {
      const result = parseArgs(
        ['--tsconfig', './tsconfig.build.json'],
        defaultRootDir
      );
      expect(result.tsconfigPath).toBe('./tsconfig.build.json');
    });

    it('should throw CliError when --tsconfig has no value', () => {
      expect(() => parseArgs(['--tsconfig'], defaultRootDir)).toThrow(CliError);
      expect(() => parseArgs(['--tsconfig'], defaultRootDir)).toThrow(
        '--tsconfig requires a value'
      );
    });
  });

  describe('positional argument (directory)', () => {
    it('should set rootDir from positional argument', () => {
      const result = parseArgs(['./my-project'], defaultRootDir);
      expect(result.rootDir).toBe('./my-project');
    });

    it('should use last positional argument as rootDir', () => {
      const result = parseArgs(['./first', './second'], defaultRootDir);
      expect(result.rootDir).toBe('./second');
    });
  });

  describe('unknown options', () => {
    it('should throw CliError for unknown option', () => {
      expect(() => parseArgs(['--unknown'], defaultRootDir)).toThrow(CliError);
      expect(() => parseArgs(['--unknown'], defaultRootDir)).toThrow(
        'Unknown option: --unknown'
      );
    });

    it('should throw CliError for unknown short option', () => {
      expect(() => parseArgs(['-x'], defaultRootDir)).toThrow(CliError);
    });
  });

  describe('combined options', () => {
    it('should handle multiple options together', () => {
      const result = parseArgs(
        [
          '-p',
          '8080',
          '--include',
          'src/**',
          '--exclude',
          '**/*.test.ts',
          '--tsconfig',
          './tsconfig.json',
          './project',
        ],
        defaultRootDir
      );

      expect(result.port).toBe(8080);
      expect(result.include).toEqual(['src/**']);
      expect(result.exclude).toEqual(['**/*.test.ts']);
      expect(result.tsconfigPath).toBe('./tsconfig.json');
      expect(result.rootDir).toBe('./project');
    });
  });
});

describe('applyEnvOverrides', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should override port from PORT env when port is default', () => {
    process.env['PORT'] = '4000';
    const options: CliOptions = {
      rootDir: '/project',
      port: 3000,
      include: [],
      exclude: [],
      watch: false,
      help: false,
      version: false,
    };

    const result = applyEnvOverrides(options);
    expect(result.port).toBe(4000);
  });

  it('should not override port when explicitly set', () => {
    process.env['PORT'] = '4000';
    const options: CliOptions = {
      rootDir: '/project',
      port: 8080,
      include: [],
      exclude: [],
      watch: false,
      help: false,
      version: false,
    };

    const result = applyEnvOverrides(options);
    expect(result.port).toBe(8080);
  });

  it('should not override port when PORT env is invalid', () => {
    process.env['PORT'] = 'invalid';
    const options: CliOptions = {
      rootDir: '/project',
      port: 3000,
      include: [],
      exclude: [],
      watch: false,
      help: false,
      version: false,
    };

    const result = applyEnvOverrides(options);
    expect(result.port).toBe(3000);
  });

  it('should not modify other options', () => {
    process.env['PORT'] = '4000';
    const options: CliOptions = {
      rootDir: '/project',
      port: 3000,
      include: ['src/**'],
      exclude: ['**/*.test.ts'],
      tsconfigPath: './tsconfig.json',
      watch: false,
      help: false,
      version: false,
    };

    const result = applyEnvOverrides(options);
    expect(result.rootDir).toBe('/project');
    expect(result.include).toEqual(['src/**']);
    expect(result.exclude).toEqual(['**/*.test.ts']);
    expect(result.tsconfigPath).toBe('./tsconfig.json');
  });
});

describe('CliError', () => {
  it('should be an instance of Error', () => {
    const error = new CliError('test message');
    expect(error).toBeInstanceOf(Error);
  });

  it('should have correct name', () => {
    const error = new CliError('test message');
    expect(error.name).toBe('CliError');
  });

  it('should have correct message', () => {
    const error = new CliError('test message');
    expect(error.message).toBe('test message');
  });
});

describe('VERSION', () => {
  it('should be a valid semver string', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
