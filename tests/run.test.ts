import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { findMatchingScripts, parsePackageJSON, updateEnvFile } from '../src/commands/run.js'

describe('findMatchingScripts', () => {
  const scripts = {
    dev: 'vite',
    build: 'tsc && vite build',
    'build:watch': 'tsc --watch',
    'build:prod': 'NODE_ENV=production vite build',
    test: 'vitest',
    lint: 'eslint .',
  }

  it('returns exact match immediately', () => {
    expect(findMatchingScripts(scripts, 'dev')).toEqual(['dev'])
  })

  it('returns exact match even when prefix matches also exist', () => {
    expect(findMatchingScripts(scripts, 'build')).toEqual(['build'])
  })

  it('returns all prefix matches when no exact match', () => {
    const result = findMatchingScripts(scripts, 'build:')
    expect(result).toContain('build:watch')
    expect(result).toContain('build:prod')
    expect(result).not.toContain('build')
  })

  it('returns empty array for no match', () => {
    expect(findMatchingScripts(scripts, 'nonexistent')).toEqual([])
  })

  it('returns single prefix match', () => {
    expect(findMatchingScripts(scripts, 'lin')).toEqual(['lint'])
  })

  it('handles empty scripts object', () => {
    expect(findMatchingScripts({}, 'dev')).toEqual([])
  })
})

describe('parsePackageJSON', () => {
  let tmpDir: string
  let origCwd: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dj-test-'))
    origCwd = process.cwd()
    process.chdir(tmpDir)
  })

  afterEach(() => {
    process.chdir(origCwd)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('parses valid package.json with scripts', () => {
    const pkg = { scripts: { dev: 'vite', build: 'tsc' } }
    fs.writeFileSync('package.json', JSON.stringify(pkg))
    const result = parsePackageJSON()
    expect(result.scripts).toEqual({ dev: 'vite', build: 'tsc' })
  })

  it('throws when package.json does not exist', () => {
    expect(() => parsePackageJSON()).toThrow('package.json not found')
  })

  it('throws when package.json has no scripts', () => {
    fs.writeFileSync('package.json', JSON.stringify({ name: 'test' }))
    expect(() => parsePackageJSON()).toThrow('No scripts found')
  })

  it('throws when package.json has empty scripts object', () => {
    fs.writeFileSync('package.json', JSON.stringify({ scripts: {} }))
    expect(() => parsePackageJSON()).toThrow('No scripts found')
  })

  it('throws on invalid JSON', () => {
    fs.writeFileSync('package.json', 'not valid json {{{')
    expect(() => parsePackageJSON()).toThrow()
  })
})

describe('updateEnvFile', () => {
  let tmpDir: string
  let origCwd: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dj-test-'))
    origCwd = process.cwd()
    process.chdir(tmpDir)
  })

  afterEach(() => {
    process.chdir(origCwd)
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates .env file when it does not exist', () => {
    updateEnvFile('development')
    const content = fs.readFileSync('.env', 'utf-8')
    expect(content).toContain('NODE_ENV=development')
  })

  it('updates existing NODE_ENV in .env file', () => {
    fs.writeFileSync('.env', 'NODE_ENV=production\nPORT=3000\n')
    updateEnvFile('development')
    const content = fs.readFileSync('.env', 'utf-8')
    expect(content).toContain('NODE_ENV=development')
    expect(content).not.toContain('NODE_ENV=production')
  })

  it('preserves other variables when updating NODE_ENV', () => {
    fs.writeFileSync('.env', 'NODE_ENV=production\nPORT=3000\nDATABASE_URL=postgres://localhost\n')
    updateEnvFile('test')
    const content = fs.readFileSync('.env', 'utf-8')
    expect(content).toContain('NODE_ENV=test')
    expect(content).toContain('PORT=3000')
    expect(content).toContain('DATABASE_URL=postgres://localhost')
  })

  it('adds NODE_ENV when .env exists but lacks it', () => {
    fs.writeFileSync('.env', 'PORT=3000\n')
    updateEnvFile('staging')
    const content = fs.readFileSync('.env', 'utf-8')
    expect(content).toContain('NODE_ENV=staging')
    expect(content).toContain('PORT=3000')
  })
})
