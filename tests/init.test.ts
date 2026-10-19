import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { templates } from '../src/commands/init.js'
import { substituteVariables } from '../src/commands/init/template.js'

describe('templates', () => {
  it('registers nest, react, next and base', () => {
    expect(Object.keys(templates).sort()).toEqual(['base', 'next', 'nest', 'react'].sort())
  })

  it('every template has a description and prepare()', () => {
    for (const [name, t] of Object.entries(templates)) {
      expect(t.description, `${name}.description`).toBeTruthy()
      expect(typeof t.prepare, `${name}.prepare`).toBe('function')
    }
  })
})

describe('substituteVariables', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dj-test-'))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('substitutes placeholders in text files', () => {
    fs.writeFileSync(path.join(tmpDir, 'README.md'), 'Project: {{PROJECT_NAME}}')
    substituteVariables(tmpDir, { '{{PROJECT_NAME}}': 'my-app' })
    const content = fs.readFileSync(path.join(tmpDir, 'README.md'), 'utf-8')
    expect(content).toBe('Project: my-app')
  })

  it('substitutes multiple placeholders in a single file', () => {
    fs.writeFileSync(
      path.join(tmpDir, 'package.json'),
      '{"name":"{{PROJECT_NAME}}","author":"{{AUTHOR}}"}'
    )
    substituteVariables(tmpDir, {
      '{{PROJECT_NAME}}': 'my-app',
      '{{AUTHOR}}': 'DiamondJdev',
    })
    const content = fs.readFileSync(path.join(tmpDir, 'package.json'), 'utf-8')
    expect(content).toContain('"name":"my-app"')
    expect(content).toContain('"author":"DiamondJdev"')
  })

  it('substitutes in nested files', () => {
    fs.mkdirSync(path.join(tmpDir, 'src'))
    fs.writeFileSync(path.join(tmpDir, 'src', 'index.ts'), '// {{PROJECT_NAME}}')
    substituteVariables(tmpDir, { '{{PROJECT_NAME}}': 'my-app' })
    const content = fs.readFileSync(path.join(tmpDir, 'src', 'index.ts'), 'utf-8')
    expect(content).toBe('// my-app')
  })

  it('inserts values literally, even with $ patterns', () => {
    fs.writeFileSync(path.join(tmpDir, 'a.md'), '{{DESCRIPTION}}')
    substituteVariables(tmpDir, { '{{DESCRIPTION}}': 'costs $& more' })
    expect(fs.readFileSync(path.join(tmpDir, 'a.md'), 'utf-8')).toBe('costs $& more')
  })

  it('leaves binary files alone', () => {
    const bin = Buffer.from([0, 1, 2, 0xff])
    fs.writeFileSync(path.join(tmpDir, 'img.png'), bin)
    substituteVariables(tmpDir, { '{{PROJECT_NAME}}': 'my-app' })
    expect(fs.readFileSync(path.join(tmpDir, 'img.png'))).toEqual(bin)
  })

  it('does not modify files without placeholders', () => {
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'no placeholders here')
    substituteVariables(tmpDir, { '{{PROJECT_NAME}}': 'my-app' })
    const content = fs.readFileSync(path.join(tmpDir, 'file.txt'), 'utf-8')
    expect(content).toBe('no placeholders here')
  })
})
