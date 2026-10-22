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
│       ├── run.ts                # NPM script runner
│       ├── init.ts               # Template initialization
│       ├── skill.ts              # Agent skill install/uninstall
│       ├── doctor.ts             # CLI environment health checks
│       ├── upgrade.ts            # Self-update via npm or pnpm
│       ├── pm.ts                 # dj i / rm / x, package manager from the lockfile
│       ├── deps.ts               # Update dependencies, roll back if tests fail
│       ├── tidy.ts               # Delete merged branches, prune worktrees
│       ├── deploy/               # dj deploy: per-repo SSH target, status/now/log pass-through
│       ├── init/                 # Shared by every template (answers, target folder, cloned())
│       └── base/                 # Generated `base` template
├── skills/
│   ├── dj-init/                  # Agent skill shipped with the package
│   └── dj-deploy/                # Agent skill for dj deploy
├── tests/
│   ├── run.test.ts
│   ├── init.test.ts
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
  - Pure logic functions (e.g., `findMatchingScripts`) — unit tested directly
  - An action handler function (e.g., `runAction`) — tested with mocked deps
  - A `Command` instance for commander registration
- Use `child_process.execSync` / `spawn` for shell execution
- Always handle errors explicitly — no silent failures

## Implemented Commands

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

### `dj init <template> <directory>`

**Purpose:** Initialize a new project from a template

Every template runs the same steps: check the target folder, ask the questions, fill the folder, print next steps. Nothing is written until all questions are answered.

**Flags (all templates):**

| Flag | Default | Meaning |
|---|---|---|
| `--name <name>` | folder name, lowercased | Package name, fills `{{PROJECT_NAME}}` |
| `--description <text>` | none | One-line description, fills `{{DESCRIPTION}}`; required with `--yes` |
| `-y, --yes` | off | Never prompt; missing values use their defaults |
| `--force` | off | Delete the folder's contents first |

The author (`{{AUTHOR}}`) comes from `git config user.name`.

The target folder may be missing, or hold only `.git`, `README.md`, `.gitignore` or `.DS_Store`; those files are kept. Any other file stops the command before anything changes, unless you pass `--force`.

```bash
dj init nest ./backend              # NestJS backend
dj init base . --yes --description "A tool"
```

**Available Templates:**

| Template | Description | Repository |
|----------|-------------|------------|
| `nest` | NestJS backend template | github.com/DiamondJdev/NestJSTemplate |
| `base` | Empty project with `AGENTS.md` and a test runner | generated by `dj`, no repository |

Cloned templates are cloned (`--depth 1`) into a temporary folder, lose their `.git`, get their placeholders filled in text files, and are copied into the target. They don't install dependencies; the next steps tell you to.

#### The `base` template

`dj init base <directory>` creates an empty project that isn't tied to a framework: `AGENTS.md`, a `CLAUDE.md` that imports it, empty `docs/`, `src/` and `tests/` folders, an npm, pnpm or uv project, a test runner (Vitest or pytest) with one passing test, a `.gitignore` and a git repository.

It also takes three flags that only work with `base`:

| Flag | Default | Meaning |
|---|---|---|
| `--pm <pm>` | `pnpm` | `npm`, `pnpm` or `uv` |
| `--docker` | off | Adds a Docker TODO to `AGENTS.md` |
| `--no-git` | off | Skip `git init` and the `.gitignore` |

```bash
dj init base ./my-app                                   # Ask the questions
dj init base . --yes --description "A tool" --pm uv     # No prompts, current folder
```

Installing the test runner needs the network; if it fails, `dj` names the failed command and leaves the folder so you can rerun it. The cloned templates reject the base-only flags.

**Adding New Templates** — add an entry to `templates` in `src/commands/init.ts`:

```typescript
'your-template': cloned(
  'Description',
  'https://github.com/you/your-template.git',
  ['npm install', 'npm start'], // printed after `cd <dir>`
),
```

A template that isn't a git repo implements `Template` (`prepare` asks and returns a `Plan`); see `src/commands/base/index.ts`.

---

### `dj skill install` / `dj skill uninstall`

**Purpose:** Teach Claude Code, Codex, Cursor and Gemini to use `dj init base` when they start a new project.

`dj skill install` copies the skills that ship in `skills/` to `~/.dj/skills/`, then symlinks each one into every agent's skills folder that exists: `~/.claude/skills`, `~/.agents/skills`, `~/.codex/skills`, `~/.cursor/skills` and `~/.gemini/skills`. Agents that aren't installed are skipped. A real folder with the same name is left alone, with a warning. Run it again after updating `dj` to refresh the copy; the links stay the same.

`dj skill uninstall` removes the links that point into `~/.dj/skills/` and then the copies there.

```bash
dj skill install
dj skill uninstall
```

### `dj doctor`

Checks that your machine is ready to use `dj`. Prints ✔, ⚠ or ✖ per check with a one-line fix, and exits 1 only if a check fails.

- **Fails (✖):** Node older than `engines`, npm or git missing.
- **Warns (⚠):** `dj` behind the latest `djmond` on npm (or the registry is unreachable), a different `dj` on your PATH, pnpm or uv missing, git `user.name` or `user.email` unset, `dj-init` skill not installed.

```bash
dj doctor
```

### `dj upgrade [-y]`

Updates `dj` to the latest `djmond` on npm. It looks for a global install in npm first, then pnpm, and upgrades with whichever has it. If neither does (for example `npx` or `npm link`), it exits 1. `-y` skips the confirmation. `dj` never checks for updates on its own.

```bash
dj upgrade -y
```

### `dj i [packages...] [-D]` / `dj rm <packages...>` / `dj x <bin> [args...]`

Runs the project's own package manager, so you and your agents don't have to remember which one it uses. `pnpm-lock.yaml` means pnpm, `uv.lock` or `pyproject.toml` means uv, and anything else means npm. Only the current folder is checked.

| Command | npm | pnpm | uv |
|---|---|---|---|
| `dj i` | `npm install` | `pnpm install` | `uv sync` |
| `dj i zod` | `npm install zod` | `pnpm add zod` | `uv add zod` |
| `dj i -D vitest` | `npm install -D vitest` | `pnpm add -D vitest` | `uv add --dev vitest` |
| `dj rm zod` | `npm uninstall zod` | `pnpm remove zod` | `uv remove zod` |
| `dj x eslint --fix` | `npx eslint --fix` | `pnpm dlx eslint --fix` | `uvx eslint --fix` |

Everything after the binary name in `dj x` goes to the binary, flags included. The exit code is the package manager's.

### `dj deps`

Prints outdated dependencies, updates them within their version ranges, then runs the tests. If the tests fail, it restores the manifest and lockfile from git, reinstalls and exits 1. Major versions outside your ranges are listed but not installed.

Before changing anything it checks that the manifest and lockfile have no uncommitted changes, so the rollback can't throw away your work. Without a `test` script the updates stay in place untested.

```bash
dj deps
```

### `dj tidy [-y]`

Fetches with `--prune`, prunes worktrees whose folders are gone, then offers to delete local branches that are either merged into the default branch or whose remote branch was deleted. The second group catches squash-merged PRs, which `git branch --merged` misses. It never deletes `main`, `master`, the default branch, or a branch checked out in any worktree. The list marks remote-deleted branches, because those can hold commits that were never merged. `-y` skips the confirmation.

```bash
dj tidy
```

### `dj deploy <status|now|log|setup>`

Runs the repo's deploy command on its server over SSH. `dj deploy status` becomes `ssh <host> <command> status`, and `now` and `log` work the same way. `dj` has no deploy logic of its own. The server side is a command such as `bt-deploy` from bt-assistant's deploy module.

The first run in a repo asks for the SSH host (picked from `~/.ssh/config`, or typed in) and the remote command, which defaults to `bt-deploy`. It checks both over SSH and saves them in `~/.dj/config.json`, keyed by the repo's `origin` URL:

```text
$ dj deploy status
? SSH host Other…
? SSH host nixos
? Remote deploy command bt-deploy
Checking ssh nixos bt-deploy status ...
Saved. Change it later with: dj deploy setup
<the server's status block>
```

Later runs go straight to the server. Without a TTY, as when an agent runs it, `dj` never prompts. Pass the target as flags instead:

```bash
dj deploy setup --host nixos --command bt-deploy
```

`dj deploy now` gets a terminal (`ssh -t`) only when stdout is a TTY, so pipes and agents get plain output and the remote exit code.

### `dj type`

A typing speed game. It shows a random code snippet, and you type it as fast as you can. Correct characters turn green and mistakes turn red. Backspace fixes a mistake, but the error still counts against your accuracy. Press Enter for a line break; the next line's indentation fills in on its own. The clock starts on your first key. When you finish, it prints your WPM (5 correct characters = 1 word), your accuracy and the time. Esc or Ctrl+C quits.

```bash
dj type
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
