# djCLI Project Guide

## Project Overview

**Binary Name:** `dj`

**Language:** TypeScript (Node.js)

**Framework:** [commander](https://github.com/tj/commander.js)

**Distribution:** npm package (`dj-cli`)

**Architecture:** Command-pattern CLI wrapper

djCLI is an opinionated CLI tool that simplifies multi-step developer workflows into single, semantic commands. It prioritizes developer ergonomics and terminal efficiency.

## Installation

```bash
# Global install
npm install -g dj-cli

# Or run without installing
npx dj-cli <command>
```

## Core Philosophy

1. **Opinionated over Flexible**
   - Make smart assumptions about the development environment
   - Expect common tools: Git, npm, standard project structures
   - Provide sensible defaults that work 80% of the time

2. **No Configuration Fatigue**
   - Zero configuration files
   - Use CLI flags for customization when needed
   - Sensible defaults for everything

3. **Interactive UX**
   - Use interactive prompts (via `@inquirer/prompts`) when ambiguity exists
   - Provide clear, emoji-enhanced feedback
   - Fail fast with helpful error messages

4. **Terminal Efficiency**
   - Short binary name (`dj`) for maximum typing speed
   - Single-command workflows
   - No unnecessary output verbosity

## Project Structure

```text
djCLI/
├── src/
│   ├── index.ts                  # Entry point — registers commands, calls program.parse()
│   └── commands/
│       ├── del-branches.ts       # Git branch cleanup command
│       ├── clean.ts              # Dependency folder cleanup
│       ├── run.ts                # NPM script runner
│       └── init.ts               # Template initialization
├── tests/
│   ├── del-branches.test.ts      # Pure function tests
│   ├── clean.test.ts
│   ├── run.test.ts
│   ├── init.test.ts
│   ├── del-branches-command.test.ts  # Command action handler tests
│   ├── clean-command.test.ts
│   ├── run-command.test.ts
│   └── init-command.test.ts
├── dist/                         # Built output (gitignored)
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

### Architecture Rules

- `src/index.ts` is minimal — only registers commands and calls `program.parse()`
- All command logic lives in `src/commands/`
- Each command exports:
  - Pure logic functions (e.g., `filterBranches`, `findMatchingScripts`) — unit tested directly
  - An action handler function (e.g., `delBranchesAction`) — tested with mocked deps
  - A `Command` instance for commander registration
- Use `child_process.execSync` / `spawn` for shell execution
- Always handle errors explicitly — no silent failures

## Implemented Commands

### `dj del_branches`

**Purpose:** Delete all merged git branches except protected branches

**Features:**

- `--dry-run` — Show what would be deleted without actually deleting
- `--yes` | `-y` — Skip confirmation prompt
- Interactive confirmation prompt by default
- Proper error handling per branch with aggregated summary

**Usage:**

```bash
dj del_branches                    # Delete merged branches (with confirmation)
dj del_branches --dry-run          # Show what would be deleted
dj del_branches --yes              # Skip confirmation prompt
```

**Protected Branches:** `main`, `master`, current branch (marked with `*`)

---

### `dj run <script> [--env <environment>]`

**Purpose:** Intelligently run npm scripts with environment variable management

**Features:**

- Parses `package.json` scripts
- Exact match and prefix matching for script names
- Interactive selection menu when multiple scripts match (via `@inquirer/prompts`)
- `--env` flag to set `NODE_ENV` in `.env` file (creates if absent)
- Proper `SIGINT` propagation for interactive commands

**Usage:**

```bash
dj run dev                         # Run "dev" script
dj run dev --env development       # Run with NODE_ENV=development
dj run build                       # If multiple "build:*" scripts exist, show picker
```

**Workflow:**

1. Parse `package.json` scripts
2. Exact match → run immediately; multiple prefix matches → interactive picker
3. If `--env` passed, update/create `.env` with `NODE_ENV`
4. Execute `npm run <script>` with inherited stdio

---

### `dj clean`

**Purpose:** Recursively remove heavy dependency and build folders

**Features:**

- `--dry-run` — Show what would be deleted without deleting
- `--yes` — Skip confirmation prompt
- `--depth <n>` — Limit directory traversal depth (default: unlimited)
- Calculates and displays disk space to be freed
- Human-readable size formatting (B, KB, MB, GB)
- Always skips `.git` directories

**Usage:**

```bash
dj clean                           # Interactive cleanup with confirmation
dj clean --dry-run                 # Show what would be deleted
dj clean --yes                     # Skip confirmation
dj clean --depth 2                 # Limit to 2 levels deep
```

**Target Directories:** `node_modules`, `dist`, `build`, `.next`, `target`, `.turbo`, `out`

---

### `dj init <template> <directory>`

**Purpose:** Initialize a new project from a Git template repository

**Features:**

- Clones templates from Git repositories (shallow `--depth 1`)
- Interactive variable substitution (`{{PROJECT_NAME}}`, `{{AUTHOR}}`, etc.)
- `--force` — Overwrite existing directory without confirmation
- Auto-detects project name from target directory
- Removes `.git` from cloned template
- Runs post-init commands (`npm install`, etc.)
- Only processes text file extensions — skips binaries and `node_modules`

**Usage:**

```bash
dj init nest ./backend              # Initialize NestJS backend
dj init react ./frontend            # Initialize React frontend
dj init next ./web                  # Initialize Next.js app
dj init --force nest ./backend      # Overwrite existing directory
```

**Available Templates:**

| Template | Description | Repository |
|----------|-------------|------------|
| `nest` | NestJS backend template | github.com/DiamondJdev/NestJSTemplate |
| `react` | React frontend with Vite | github.com/DiamondJdev/react-template |
| `next` | Next.js full-stack template | github.com/DiamondJdev/next-template |

**Adding New Templates** — edit `src/commands/init.ts`:

```typescript
templateRegistry['your-template'] = {
  name: 'your-template',
  description: 'Description',
  gitUrl: 'https://github.com/you/your-template.git',
  variables: [
    { name: 'PROJECT_NAME', placeholder: '{{PROJECT_NAME}}', prompt: 'Project name', default: 'my-app' },
  ],
  postInitCommands: ['npm install'],
  nextSteps: '1. cd into directory\n2. Run npm start',
}
```

## Development

### Build

```bash
npm run build         # Compile with tsup → dist/index.js
npm run dev           # Run directly via tsx (no compile step)
```

### Test

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Run with coverage report (target: 80%)
```

**Coverage:** 92.4% statements/lines across command files

### Local install for testing

```bash
npm run build
npm install -g .
dj --help
```

## Tech Stack

| Role | Package |
|------|---------|
| CLI framework | `commander` v12 |
| Interactive prompts | `@inquirer/prompts` |
| Terminal styling | `chalk` v5 |
| `.env` read/write | `dotenv` |
| Bundler | `tsup` |
| Test framework | `vitest` + `@vitest/coverage-v8` |
| TypeScript | v5, strict mode, `moduleResolution: bundler` |

## Adding New Commands

1. Create `src/commands/your-command.ts`
2. Export pure logic functions (for unit testing)
3. Export an action handler function
4. Export a `Command` instance using commander
5. Import and register in `src/index.ts`
6. Add test files: `tests/your-command.test.ts` (pure functions) + `tests/your-command-command.test.ts` (action handler with mocked deps)

**Command template:**

```typescript
import { Command } from 'commander'
import chalk from 'chalk'

// Pure logic — unit testable
export function yourLogic(input: string): string {
  return input.trim()
}

// Action handler — testable with mocked deps
export async function yourCommandAction(options: { flag: boolean }): Promise<void> {
  console.log(chalk.green('✅ Done'))
}

// Commander registration
export const yourCommand = new Command('your-command')
  .description('Does something useful')
  .option('--flag', 'Enable flag')
  .action(yourCommandAction)
```

## Testing Strategy

**Pure function tests** (`tests/*.test.ts`):
- Test logic functions in isolation with real temp dirs
- Table-driven test cases covering edge cases

**Command action tests** (`tests/*-command.test.ts`):
- Mock `@inquirer/prompts`, `child_process`, `process.exit`
- Call exported action functions directly (bypasses commander state)
- Cover all code paths: happy path, error paths, dry-run, flags

**Required Coverage:** 80% minimum (currently 92.4%)

## User Feedback Conventions

- Searching/discovering
- Success
- Error
- Deleting
- Running/executing
- Warning
- Directory/file operations
- User input prompts

## Security Considerations

- Never pass raw user input directly to `execSync` without validation
- Sanitize branch names and script names before execution
- Sanitize placeholder values before substituting into filenames
- Validate all file paths before operations

## Planned Commands

- [ ] `dj docker` — Common Docker operations
- [ ] `dj test` — Smart test filtering across frameworks
- [ ] `dj update` — Self-update mechanism
- [ ] `dj precommit` - Precheck workflow before git commiting
- [ ] Shell completion (bash, zsh, fish)
- [ ] Plugin system for user-defined commands

## Changelog

### v1.0.0

- Built in TypeScript/npm
- Four commands built: `del_branches`, `run`, `clean`, `init`
- 88 tests, 92.4% coverage
- Distributed as `dj-cli` npm package
