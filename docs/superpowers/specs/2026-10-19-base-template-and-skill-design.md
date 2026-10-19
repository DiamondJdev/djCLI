# Base template and agent skill for `dj init`

Date: 2026-10-19
Status: reviewed, waiting for approval

## Why

Most of my new projects start the same way: an `AGENTS.md`, plus empty `docs/`, `src/` and `tests/` folders, plus an empty npm, pnpm or uv project. I set this up by hand each time, and the `AGENTS.md` usually ends up thin, so agents working in the project have nothing to check their work against.

I also start most projects by talking to Claude Code or Codex. When an agent starts a new empty project for me, it should use `dj` to do it, filling in the answers from our conversation, so every project starts with the same layout and a real `AGENTS.md`.

`dj` must keep working on its own, without an agent.

## Goals

1. `dj init base <dir>` creates an empty, non-framework project with a generated `AGENTS.md`, `docs/`, `src/`, `tests/`, a package manager project, and a working test command.
2. Every question `dj init base` asks also has a flag, so an agent can run it without any prompt.
3. An agent skill, in the open Agent Skills format, tells agents when to use `dj init base`, what to ask the user, and how to call it.
4. `dj skill install` installs the skill in one place and links it into every agent's skills folder, so there is one copy to maintain.

## Non-goals

- Framework projects. NestJS, React and Next already have their own templates (`dj init nest|react|next`). The base template has no framework question.
- Linting, formatting, CI workflows or pre-commit hooks in the new project. These may come later.
- A separate GitHub template repository. The base template lives in the CLI (see "Decisions").
- Changing how the existing nest, react and next templates work. They reject the base-only flags (`--name`, `--description`, `--pm`, `--docker`, `--yes`, `--no-git`).
- Generating a Dockerfile, `docker-compose.yml` or `.dockerignore`.

## Anti-goals

These would make the feature a failure even if it technically works:

- `dj init base` stops at a prompt when an agent runs it with flags. An agent cannot answer an interactive prompt.
- The new project's `test` command fails or is a placeholder (`echo "Error: no test specified"`).
- `dj skill install` overwrites or deletes a skill folder the user made by hand.
- The skill's description of the flags drifts from what the CLI actually accepts.

## Constraints

- Existing stack: TypeScript, `commander`, `@inquirer/prompts`, Vitest, built with tsup, published to npm as `djmond` with the `dj` binary. Node 18 or newer.
- Follow the README's architecture rules: `src/index.ts` only registers commands; logic lives in `src/commands/`; each command exports pure functions (unit tested), an action handler (tested with mocked dependencies) and a `Command` instance.
- Template files and the skill ship inside the npm package, so `package.json` `files` must include them.
- Package managers on my machine today: npm 11.20, pnpm 10.27, uv 0.9.5.

## Decisions

### `dj init base`

The base template is a new entry in the existing template registry in `src/commands/init.ts`, so `dj init --help` lists it with the others. The command name `base` was my call.

It asks 4 questions. Each has a flag:

| Question | Flag | Default |
|---|---|---|
| Project name | `--name <name>` | the target directory's name |
| One-line description | `--description <text>` | none, required |
| Package manager | `--pm <npm\|pnpm\|uv>` | `pnpm` |
| Runs in Docker or natively | `--docker` | native |

Other flags:

- `--no-git` skips `git init` and the `.gitignore`.
- `--yes` turns off all prompts. Missing values use their defaults; a missing required value (the description) makes the command exit with an error naming the flag. It never waits for input, and it never deletes anything.
- The existing `--force` keeps its current meaning: delete the target folder and recreate it. The skill tells agents never to pass it.

### Existing target folder

Agents will often run `dj init base .` from inside a fresh folder or repository, so `base` can build in a folder that already exists, but only a safe one:

- If the folder does not exist, create it.
- If it exists and is empty, or holds nothing but `.git`, `README.md` and `.gitignore`, build inside it and keep those files.
- If it holds anything else, exit with an error that lists what is there. No prompt, with or without `--yes`.
- `--force` still deletes and recreates the folder, as it does for the other templates.
- If `.git` already exists, skip `git init`. If `.gitignore` already exists, leave it alone.

Fixed values, never asked:

- npm and pnpm projects use ES modules (`--init-type module`).
- uv projects are libraries (`uv init --lib`), which puts code in `src/<name>/`, and use uv's default Python version.
- Author comes from `git config user.name`, falling back to `DiamondJdev`. License is MIT.

### What `dj init base` creates

1. `docs/`, `src/` and `tests/`. Folders that would otherwise be empty get a `.gitkeep`.
2. The package manager project, created with flags so the package manager never prompts:
   - pnpm: `pnpm init --init-type module`, then `pnpm pkg set` for name, description, author and license.
   - npm: `npm init -y --init-type module --init-author-name <author> --init-license MIT`, then `npm pkg set` for name and description.
   - uv: `uv init --lib --vcs none --name <name> --description <text> --author-from git`. `dj` runs `git init` itself so all three package managers behave the same.
3. A test runner: Vitest for npm and pnpm, pytest for uv (as a dev dependency). `dj` writes one passing example test in `tests/` and sets the `test` script (`vitest run` for npm and pnpm). Running the test command right after init passes. Installing the test runner needs the network, so it runs last, after every file is written and `git init` has run. If the install fails, `dj` stops with an error that names the failed command and leaves the folder in place, so the user can rerun the install by hand.
4. `AGENTS.md`, generated from the answers (see below), and a `CLAUDE.md` whose only line is `@AGENTS.md`, so Claude Code reads the same file as Codex and the others. The `CLAUDE.md` file was my call.
5. Unless `--no-git` is given, `git init` and a `.gitignore` suited to the package manager. No initial commit (my call).

### Generated `AGENTS.md`

The sections come from what the MedTech and TariffNinja `AGENTS.md` files have in common:

- Project overview: name, description, language and package manager.
- Commands: install, test, and run a single test, written for the chosen package manager.
- With `--docker`, this exact line goes right under the overview: `TODO: This project will run in Docker; add a Dockerfile before shipping`. That line is all `--docker` does. Generating Dockerfiles or compose files is out of scope.
- Boundaries, as fixed text: ask first before architecture changes, new dependencies, risky data or security work; never log secrets or push straight to `main`; always run the tests before saying a task is done.
- Execution loop, as fixed text: understand the code, plan briefly, make the smallest correct change, verify, open a PR, report what was and wasn't verified.
- Empty headed sections for Architecture, Environment variables and Learned facts, each with one line telling agents to add entries as the project grows.

### Where the template lives

The base template lives in the CLI, not in a separate GitHub repository. Almost everything it creates depends on the package manager (`package.json` or `pyproject.toml`, the `.gitignore`, the example test, the Commands section), which a static repository cannot express, so the CLI would generate most of it anyway. Keeping it in the CLI also means the CLI, the template and the skill ship in one release and cannot drift apart, init needs no clone (only the test-runner install uses the network), and tests do not have to mock `git clone`. The trade-off: changing the template needs an npm release.

Because of this, a template entry no longer always has a `gitUrl`. The registry type needs a way to express a generated template next to the cloned ones.

### The `dj-init` skill

The skill lives in this repository and ships in the npm package, in the open Agent Skills layout:

```text
skills/dj-init/
├── SKILL.md
├── scripts/
├── references/
└── assets/
```

`SKILL.md` tells an agent:

- Use it when the user wants to start a new, empty project that is not a NestJS, React or Next app. For those, use `dj init nest|react|next`.
- Collect the 4 answers from the conversation. Ask the user only for what is still missing; usually that is the description.
- Show the user the full command, then run it with every flag and `--yes`.
- Afterward, run the project's test command once to confirm the project works.

- Run it from the folder where the project should live, as `dj init base . --yes ...`, or pass a new folder name. Never pass `--force`.

`references/` holds the full flag list. A test checks that list against the flags `dj init base` actually defines, so the two cannot drift. `scripts/` and `assets/` start empty.

### `dj skill install` and `dj skill uninstall`

`dj skill install`:

1. Copies the bundled `skills/dj-init/` to `~/.dj/skills/dj-init/`, replacing any older copy there.
2. Symlinks `~/.dj/skills/dj-init` into each agent's skills folder: `~/.claude/skills/`, `~/.agents/skills/`, `~/.codex/skills/`, `~/.cursor/skills/` and `~/.gemini/skills/`. Including `~/.codex/skills/` was my call: Codex uses it on my machine, and I could not confirm that Codex also reads `~/.agents/skills/`.
3. Skips an agent whose root folder (for example `~/.cursor`) does not exist, and says so. It does not create folders for tools that are not installed.
4. Replaces an existing symlink with the same name. If a real folder with that name is already there, it warns and leaves it alone.

Running `dj skill install` again after updating `dj` refreshes the copy in `~/.dj`, and every agent sees the new version through its symlink.

`dj skill uninstall` removes the symlinks that point into `~/.dj/skills/` and then removes `~/.dj/skills/dj-init/`.

## Left to the builder

- How to change the `TemplateConfig` type so generated and cloned templates both fit.
- File names and module layout for the new code, within the README's architecture rules.
- The exact wording of `SKILL.md` and of the fixed `AGENTS.md` sections, within what is described above.
- The `.gitignore` contents for each package manager.
- The example test files.
- How the tests are split between unit and action-handler tests.
