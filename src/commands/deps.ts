import { existsSync, readFileSync, rmSync } from "fs";
import { execFileSync } from "child_process";
import { Command } from "commander";
import chalk from "chalk";
import type { PackageManager } from "./base/answers.js";
import { pmCommands, type Step } from "./base/package-manager.js";
import { detectPm, pmStep, runStep } from "./pm.js";

interface DepsPlan {
  files: string[];
  outdated: Step;
  update: Step[];
}

const PLANS: Record<PackageManager, DepsPlan> = {
  npm: {
    files: ["package.json", "package-lock.json"],
    outdated: { cmd: "npm", args: ["outdated"] },
    update: [{ cmd: "npm", args: ["update", "--save"] }],
  },
  pnpm: {
    files: ["package.json", "pnpm-lock.yaml"],
    outdated: { cmd: "pnpm", args: ["outdated"] },
    update: [{ cmd: "pnpm", args: ["update"] }],
  },
  uv: {
    files: ["pyproject.toml", "uv.lock"],
    outdated: { cmd: "uv", args: ["tree", "--outdated", "--depth", "1"] },
    update: [
      { cmd: "uv", args: ["lock", "--upgrade"] },
      { cmd: "uv", args: ["sync"] },
    ],
  },
};

const toStep = (command: string): Step => {
  const [cmd, ...args] = command.split(" ");
  return { cmd, args };
};

function hasTestScript(pm: PackageManager): boolean {
  if (pm === "uv") return true;
  const pkg = JSON.parse(readFileSync("package.json", "utf-8")) as { scripts?: Record<string, string> };
  return Boolean(pkg.scripts?.test);
}

export function depsAction(): void {
  try {
    const pm = detectPm();
    const plan = PLANS[pm];

    const dirty = execFileSync("git", ["status", "--porcelain", "--", ...plan.files], { encoding: "utf-8" });
    if (dirty.trim()) {
      console.error(chalk.red(`Commit or stash changes to ${plan.files.join(", ")} first, so dj can roll back`));
      process.exitCode = 1;
      return;
    }

    // Only tracked files can be checked out on rollback; files the update creates get removed
    const tracked = execFileSync("git", ["ls-files", "--", ...plan.files], { encoding: "utf-8" }).split("\n").filter(Boolean);
    const created = plan.files.filter((f) => !existsSync(f));

    runStep(plan.outdated); // exits non-zero when anything is outdated
    if (plan.update.some((step) => runStep(step) !== 0)) {
      console.error(chalk.red("Update failed; check the output above"));
      process.exitCode = 1;
      return;
    }

    if (!hasTestScript(pm)) {
      console.log(chalk.yellow("No test script, updates kept untested. Review with git diff."));
      return;
    }

    if (runStep(toStep(pmCommands(pm).test)) === 0) {
      console.log(chalk.green("Updated and tests pass. Review with git diff, then commit."));
      return;
    }

    if (tracked.length > 0) execFileSync("git", ["checkout", "--", ...tracked]);
    for (const f of created) rmSync(f, { force: true });
    runStep(pmStep(pm, "i", []));
    console.error(chalk.red("Tests failed after updating, rolled back"));
    process.exitCode = 1;
  } catch (err) {
    console.error(chalk.red(`Error: ${(err as Error).message}`));
    process.exitCode = 1;
  }
}

export const depsCommand = new Command("deps")
  .description("Show outdated dependencies, update within ranges, roll back if tests fail")
  .action(depsAction);
