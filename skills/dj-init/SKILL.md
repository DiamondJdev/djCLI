---
name: dj-init
description: Use when the user wants to start a new, empty project that is not a NestJS, React or Next.js app. Runs `dj init base` to create AGENTS.md, CLAUDE.md, docs/, src/, tests/ and an npm, pnpm or uv project with a working test command.
---

# Start a new project with dj init base

`dj init base` creates the user's standard starting layout: `AGENTS.md` and `CLAUDE.md`, empty `docs/`, `src/` and `tests/` folders, a package manager project, a test runner with one passing test, and a git repository.

## When to use it

Use it when the user asks to start, create or scaffold a new project and it is not a framework app.

For a framework, use the matching template instead:

- NestJS backend: `dj init nest <dir>`
- React frontend: `dj init react <dir>`
- Next.js app: `dj init next <dir>`

Don't use it inside an existing project. It refuses a folder that holds anything besides `.git`, `README.md`, `.gitignore` and `.DS_Store`.

## Before you run it

1. Check that `dj` is installed with `dj --version`. If that fails, tell the user to run `npm i -g djmond` and stop.
2. Work out these four answers from the conversation:
   - project name: a lowercase package name; defaults to the folder name
   - one-line description: required
   - package manager: `npm`, `pnpm` or `uv`; defaults to `pnpm`; use `uv` for Python
   - whether the project will run in Docker; defaults to no
3. Ask the user only for answers the conversation doesn't give you. Usually that is the description. Ask in one message.

## Running it

Show the user the full command, then run it with every flag and `--yes`, so `dj` never stops at a prompt:

```bash
dj init base . --yes --name my-app --description "One line about the project" --pm pnpm
```

- Run it from the folder where the project should live and pass `.`, or pass the name of a new folder.
- Add `--docker` if the project will run in Docker.
- Add `--no-git` only if the user asks you not to create a git repository.
- Never pass `--force`. It deletes the target folder.

See `references/flags.md` for every flag and its default.

## After it runs

Run the test command `dj` prints at the end (`pnpm test`, `npm test` or `uv run pytest`) and confirm that one test passes. If `dj` stops with `Command failed:`, show the user that line. The folder is left in place, so the user can rerun the failed command inside it.
