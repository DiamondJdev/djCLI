import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

vi.mock('@inquirer/prompts', () => ({
  confirm: vi.fn(),
}))

import { confirm } from '@inquirer/prompts'
import { cleanAction } from '../src/commands/clean.js'

let tmpDir: string
let origCwd: string

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dj-test-'))
  origCwd = process.cwd()
  process.chdir(tmpDir)
  vi.mocked(confirm).mockReset()
})

afterEach(() => {
  process.chdir(origCwd)
  fs.rmSync(tmpDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('cleanAction', () => {
  it('reports no heavy directories when directory is clean', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await cleanAction({ dryRun: false, yes: false, depth: '0' })
    expect(spy.mock.calls.flat().join('\n')).toContain('No heavy directories found')
    spy.mockRestore()
  })

  it('dry-run: lists directories without deleting', async () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules'))
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await cleanAction({ dryRun: true, yes: false, depth: '0' })
    const output = spy.mock.calls.flat().join('\n')
    expect(output).toContain('node_modules')
    expect(output).toContain('Dry-run mode')
    expect(fs.existsSync(path.join(tmpDir, 'node_modules'))).toBe(true)
    spy.mockRestore()
  })

  it('--yes: deletes directories without prompting', async () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules'))
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await cleanAction({ dryRun: false, yes: true, depth: '0' })
    const output = spy.mock.calls.flat().join('\n')
    expect(output).toContain('Successfully deleted')
    expect(fs.existsSync(path.join(tmpDir, 'node_modules'))).toBe(false)
    expect(vi.mocked(confirm)).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('confirmation cancelled aborts deletion', async () => {
    fs.mkdirSync(path.join(tmpDir, 'dist'))
    vi.mocked(confirm).mockResolvedValue(false)
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await cleanAction({ dryRun: false, yes: false, depth: '0' })
    const output = spy.mock.calls.flat().join('\n')
    expect(output).toContain('Cleanup cancelled')
    expect(fs.existsSync(path.join(tmpDir, 'dist'))).toBe(true)
    spy.mockRestore()
  })

  it('confirmation confirmed deletes directories', async () => {
    fs.mkdirSync(path.join(tmpDir, 'dist'))
    vi.mocked(confirm).mockResolvedValue(true)
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await cleanAction({ dryRun: false, yes: false, depth: '0' })
    expect(fs.existsSync(path.join(tmpDir, 'dist'))).toBe(false)
    spy.mockRestore()
  })

  it('shows total size and freed space after deletion', async () => {
    const nodeModules = path.join(tmpDir, 'node_modules')
    fs.mkdirSync(nodeModules)
    fs.writeFileSync(path.join(nodeModules, 'pkg.js'), 'x'.repeat(2048))
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await cleanAction({ dryRun: true, yes: false, depth: '0' })
    expect(spy.mock.calls.flat().join('\n')).toContain('Total space to be freed')
    spy.mockRestore()
  })

  it('respects --depth option', async () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules'))
    fs.mkdirSync(path.join(tmpDir, 'packages', 'app', 'node_modules'), { recursive: true })
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    await cleanAction({ dryRun: true, yes: false, depth: '1' })
    const output = spy.mock.calls.flat().join('\n')
    expect(output).toContain('node_modules')
    expect(output).not.toContain('packages')
    spy.mockRestore()
  })
})
