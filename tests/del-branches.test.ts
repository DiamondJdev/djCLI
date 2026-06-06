import { describe, it, expect } from 'vitest'
import { filterBranches } from '../src/commands/del-branches.js'

describe('filterBranches', () => {
  it('returns empty array for empty input', () => {
    expect(filterBranches('')).toEqual([])
  })

  it('returns empty array for whitespace-only input', () => {
    expect(filterBranches('   \n  \n  ')).toEqual([])
  })

  it('filters out current branch marked with *', () => {
    const output = '  feature-branch\n* main\n  other-branch'
    expect(filterBranches(output)).toEqual(['feature-branch', 'other-branch'])
  })

  it('filters out main branch', () => {
    const output = '  main\n  feature\n  fix/bug'
    expect(filterBranches(output)).toEqual(['feature', 'fix/bug'])
  })

  it('filters out master branch', () => {
    const output = '  master\n  feature\n  fix/bug'
    expect(filterBranches(output)).toEqual(['feature', 'fix/bug'])
  })

  it('returns all non-protected branches', () => {
    const output = '  feature/login\n  fix/auth\n  chore/deps'
    expect(filterBranches(output)).toEqual(['feature/login', 'fix/auth', 'chore/deps'])
  })

  it('trims whitespace from branch names', () => {
    const output = '  feature-a  \n   feature-b   '
    expect(filterBranches(output)).toEqual(['feature-a', 'feature-b'])
  })

  it('handles branches with similar names to protected branches', () => {
    const output = '  main-feature\n  master-fix\n  main\n  master'
    expect(filterBranches(output)).toEqual(['main-feature', 'master-fix'])
  })

  it('handles branches with slashes and underscores', () => {
    const output = '  feature/my_feature\n  fix/bug-123\n  release/v1.0.0'
    expect(filterBranches(output)).toEqual(['feature/my_feature', 'fix/bug-123', 'release/v1.0.0'])
  })

  it('handles no branches to delete', () => {
    const output = '* main\n  master'
    expect(filterBranches(output)).toEqual([])
  })
})
