import { existsSync } from "fs";
import * as path from "path";
import { spawnSync } from "child_process";
import { Command } from "commander";
import chalk from "chalk";
import type { PackageManager } from "./base/answers.js";
import type { Step } from "./base/package-manager.js";

type Verb = "i" | "rm" | "x";

// ponytail: only looks in the current folder, walk up parents if monorepo subfolders need it
export function detectPm(dir = process.cwd()): PackageManager {
  const has = (file: string) => existsSync(path.join(dir, file));
  if (has("pnpm-lock.yaml")) return "pnpm";
  if (has("package-lock.json")) return "npm";
  if (has("uv.lock")) return "uv";
  if (has("package.json")) return "npm";
  return has("pyproject.toml") ? "uv" : "npm";
}

export function pmStep(pm: PackageManager, verb: Verb, args: string[], dev = false): Step {
  const devFlag = dev ? [pm === "uv" ? "--dev" : "-D"] : [];
  switch (verb) {
    case "i":
      if (args.length === 0) return { cmd: pm, args: [pm === "uv" ? "sync" : "install"] };
      return { cmd: pm, args: [pm === "pnpm" || pm === "uv" ? "add" : "install", ...devFlag, ...args] };
    case "rm":
      return { cmd: pm, args: [{ npm: "uninstall", pnpm: "remove", uv: "remove" }[pm], ...args] };
    case "x":
      if (pm === "pnpm") return { cmd: "pnpm", args: ["dlx", ...args] };
      return { cmd: pm === "uv" ? "uvx" : "npx", args };
  }
}

// Runs a step with inherited stdio and returns its exit code.
export function runStep(step: Step): number {
  const result = spawnSync(step.cmd, step.args, { stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}

export function pmAction(verb: Verb, args: string[], dev = false): void {
  try {
    process.exitCode = runStep(pmStep(detectPm(), verb, args, dev));
  } catch (err) {
    console.error(chalk.red(`Error: ${(err as Error).message}`));
    process.exitCode = 1;
  }
}

export const installCommand = new Command("i")
  .description("Install dependencies, or add packages, with the project's package manager")
  .argument("[packages...]", "packages to add")
  .option("-D, --dev", "add as dev dependencies")
  .action((packages: string[], opts: { dev?: boolean }) => pmAction("i", packages, opts.dev));

export const removeCommand = new Command("rm")
  .description("Remove packages with the project's package manager")
  .argument("<packages...>", "packages to remove")
  .action((packages: string[]) => pmAction("rm", packages));

export const execCommand = new Command("x")
  .description("Run a package binary (npx, pnpm dlx or uvx)")
  .argument("<bin>", "binary to run")
  .argument("[args...]", "arguments passed to the binary")
  .passThroughOptions()
  .action((bin: string, args: string[]) => pmAction("x", [bin, ...args]));
