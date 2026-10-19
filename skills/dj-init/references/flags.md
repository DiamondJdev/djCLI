# dj init base flags

Usage: `dj init base <directory> [flags]`

| Flag | Default | Meaning |
|---|---|---|
| `--name <name>` | folder name, lowercased | Package name. Lowercase letters, digits, `.`, `_` and `-` only. |
| `--description <text>` | none | One-line description. Required with `--yes`. |
| `--pm <pm>` | `pnpm` | Package manager: `npm`, `pnpm` or `uv`. |
| `--docker` | off | Adds a TODO to `AGENTS.md` saying the project will run in Docker. |
| `--yes` (`-y`) | off | Never prompt. Missing values use their defaults. |
| `--no-git` | off | Skip `git init` and the `.gitignore`. |
| `--force` | off | Delete the target folder and recreate it. Never pass this. |

Fixed values: npm and pnpm projects use ES modules; uv projects are libraries with code in `src/<name>/`; the license is MIT; the author comes from `git config user.name`.
