import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import {
  getTemplateConfig,
  templateRegistry,
  substituteVariables,
  substituteInFilename,
} from '../src/commands/init.js'

describe('templateRegistry', () => {
  it('contains nest template', () => {
    expect(templateRegistry).toHaveProperty('nest')
  })

  it('contains react template', () => {
    expect(templateRegistry).toHaveProperty('react')
  })

  it('contains next template', () => {
    expect(templateRegistry).toHaveProperty('next')
  })

  it('all templates have required fields', () => {
    for (const [name, config] of Object.entries(templateRegistry)) {
      expect(config.name, `${name}.name`).toBeTruthy()
      expect(config.description, `${name}.description`).toBeTruthy()
      expect(config.gitUrl, `${name}.gitUrl`).toBeTruthy()
      expect(Array.isArray(config.variables), `${name}.variables`).toBe(true)
    }
  })

  it('all template variables have required fields', () => {
    for (const [name, config] of Object.entries(templateRegistry)) {
      for (const variable of config.variables) {
        expect(variable.name, `${name} variable name`).toBeTruthy()
        expect(variable.placeholder, `${name} variable placeholder`).toBeTruthy()
        expect(variable.prompt, `${name} variable prompt`).toBeTruthy()
        expect(variable.default, `${name} variable default`).toBeTruthy()
      }
    }
  })
})

describe('getTemplateConfig', () => {
  it('returns config for nest template', () => {
    const config = getTemplateConfig('nest')
    expect(config).toBeDefined()
    expect(config!.name).toBe('nest')
  })

  it('returns config for react template', () => {
    const config = getTemplateConfig('react')
    expect(config).toBeDefined()
    expect(config!.name).toBe('react')
  })

  it('returns config for next template', () => {
    const config = getTemplateConfig('next')
    expect(config).toBeDefined()
    expect(config!.name).toBe('next')
  })

  it('returns undefined for unknown template', () => {
    expect(getTemplateConfig('angular')).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(getTemplateConfig('')).toBeUndefined()
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

  it('does nothing with empty variables map', () => {
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), '{{PROJECT_NAME}}')
    substituteVariables(tmpDir, {})
    const content = fs.readFileSync(path.join(tmpDir, 'file.txt'), 'utf-8')
    expect(content).toBe('{{PROJECT_NAME}}')
  })

  it('skips node_modules directory', () => {
    fs.mkdirSync(path.join(tmpDir, 'node_modules'))
    fs.writeFileSync(path.join(tmpDir, 'node_modules', 'file.txt'), '{{PROJECT_NAME}}')
    substituteVariables(tmpDir, { '{{PROJECT_NAME}}': 'my-app' })
    const content = fs.readFileSync(path.join(tmpDir, 'node_modules', 'file.txt'), 'utf-8')
    expect(content).toBe('{{PROJECT_NAME}}')
  })

  it('does not modify files without placeholders', () => {
    fs.writeFileSync(path.join(tmpDir, 'file.txt'), 'no placeholders here')
    substituteVariables(tmpDir, { '{{PROJECT_NAME}}': 'my-app' })
    const content = fs.readFileSync(path.join(tmpDir, 'file.txt'), 'utf-8')
    expect(content).toBe('no placeholders here')
  })
})

describe('substituteInFilename', () => {
  it('replaces placeholder in filename', () => {
    const result = substituteInFilename('{{PROJECT_NAME}}-config.json', {
      '{{PROJECT_NAME}}': 'my-app',
    })
    expect(result).toBe('my-app-config.json')
  })

  it('sanitizes special characters in replacement value', () => {
    const result = substituteInFilename('{{PROJECT_NAME}}.json', {
      '{{PROJECT_NAME}}': 'my app!',
    })
    expect(result).toBe('my-app-.json')
  })

  it('returns filename unchanged when no placeholders match', () => {
    const result = substituteInFilename('no-placeholder.json', {
      '{{PROJECT_NAME}}': 'my-app',
    })
    expect(result).toBe('no-placeholder.json')
  })

  it('handles multiple placeholder replacements', () => {
    const result = substituteInFilename('{{AUTHOR}}-{{PROJECT_NAME}}.md', {
      '{{AUTHOR}}': 'dev',
      '{{PROJECT_NAME}}': 'myapp',
    })
    expect(result).toBe('dev-myapp.md')
  })
})
