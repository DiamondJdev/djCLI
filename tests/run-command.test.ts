import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { EventEmitter } from 'events'

vi.mock('@inquirer/prompts', () => ({
  select: vi.fn(),
}))

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

import { select } from '@inquirer/prompts'
import { spawn } from 'child_process'
import { runAction } from '../src/commands/run.js'

let tmpDir: string
let origCwd: string
let exitSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dj-test-'))
  origCwd = process.cwd()
  process.chdir(tmpDir)
  exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('process.exit')
  })
  vi.mocked(select).mockReset()
  vi.mocked(spawn).mockReset()
})

afterEach(() => {
  process.chdir(origCwd)
  fs.rmSync(tmpDir, { recursive: true, force: true })
  exitSpy.mockRestore()
  vi.restoreAllMocks()
})

function makeChild(exitCode = 0): ReturnType<typeof spawn> {
  const child = new EventEmitter() as ReturnType<typeof spawn>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(child as any).kill = vi.fn()
  setTimeout(() => child.emit('close', exitCode), 0)
  return child
}

describe('runAction', () => {
  it('exits when package.json not found', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await expect(runAction('dev', {})).rejects.toThrow('process.exit')
    spy.mockRestore()
  })

  it('exits when no script matches and lists available scripts', async () => {
    fs.writeFileSync('package.json', JSON.stringify({ scripts: { build: 'tsc' } }))
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await expect(runAction('dev', {})).rejects.toThrow('process.exit')
    const output = spy.mock.calls.flat().join('\n')
    expect(output).toContain("No script found matching 'dev'")
    expect(output).toContain('build')
    spy.mockRestore()
  })

  it('runs exact match script directly without prompt', async () => {
    fs.writeFileSync('package.json', JSON.stringify({ scripts: { dev: 'vite' } }))
    vi.mocked(spawn).mockReturnValue(makeChild(0))
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runAction('dev', {})
    expect(spy.mock.calls.flat().join('\n')).toContain('npm run dev')
    expect(vi.mocked(select)).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('shows selector when multiple scripts match prefix', async () => {
    fs.writeFileSync(
      'package.json',
      JSON.stringify({ scripts: { 'build:dev': 'vite', 'build:prod': 'tsc' } })
    )
    vi.mocked(select).mockResolvedValue('build:dev')
    vi.mocked(spawn).mockReturnValue(makeChild(0))
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runAction('build', {})
    expect(vi.mocked(select)).toHaveBeenCalled()
    spy.mockRestore()
  })

  it('--env sets NODE_ENV before running', async () => {
    fs.writeFileSync('package.json', JSON.stringify({ scripts: { dev: 'vite' } }))
    vi.mocked(spawn).mockReturnValue(makeChild(0))
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await runAction('dev', { env: 'production' })
    const output = spy.mock.calls.flat().join('\n')
    expect(output).toContain('NODE_ENV=production')
    expect(fs.existsSync('.env')).toBe(true)
    spy.mockRestore()
  })

  it('exits when script exits with non-zero code', async () => {
    fs.writeFileSync('package.json', JSON.stringify({ scripts: { test: 'vitest' } }))
    vi.mocked(spawn).mockReturnValue(makeChild(1))
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await expect(runAction('test', {})).rejects.toThrow('process.exit')
    spy.mockRestore()
  })
})
