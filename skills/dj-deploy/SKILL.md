---
name: dj-deploy
description: Use when the user asks whether a merge is live, which commit the server runs or is testing, when the last deploy check ran, or to deploy now. Runs `dj deploy` to check or run the repo's deploy on its server over SSH.
---

# Check or run a deploy with dj deploy

`dj deploy` runs the repo's deploy command on its server over SSH. Run it from inside the repo. It finds the server from the repo's `origin` remote.

## Read before acting

- `dj deploy status` is read-only. Run it anytime.
- `dj deploy log` is read-only too.

## Deploying

`dj deploy now` changes production. Run it only when the user asks to deploy, and show them the command first. It can take several minutes, because the server installs, runs the tests and restarts. Let it finish and never interrupt it.

## Setup

Agents have no TTY, so `dj` never prompts you. If `dj` prints `No deploy target for ...`, ask the user for the SSH host, then run:

```bash
dj deploy setup --host <host> --command bt-deploy
```

Never guess a host. The user runs `dj deploy setup` with no flags to pick one interactively.

## Reading status

- `running` different from `live` means a restart failed.
- `testing` other than `idle` means a check is in progress.
- A commit under `last failed` won't be retried. It takes a new commit on `main`.

## Errors

If `dj` can't reach the host or the server has no deploy command, report the exact line `dj` printed and stop. Don't try `ssh` options or `sudo` on the server.

## Never

- Edit `~/.dj/config.json` by hand.
- Run commands on the server outside `dj deploy`.
