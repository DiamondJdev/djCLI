import { execFileSync } from "child_process";
import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";

const PROTECTED = ["main", "master"];

const git = (...args: string[]): string =>
  execFileSync("git", args, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });

const lines = (out: string): string[] => out.split("\n").filter(Boolean);

export function pickBranches(input: {
  merged: string[];
  gone: string[];
  checkedOut: string[];
  base: string;
}): string[] {
  const keep = new Set([...PROTECTED, input.base.replace(/^origin\//, ""), ...input.checkedOut]);
  return [...new Set([...input.merged, ...input.gone])].filter((b) => !keep.has(b));
}

function defaultBase(): string {
  try {
    return git("symbolic-ref", "--short", "refs/remotes/origin/HEAD").trim();
  } catch {
    return "main";
  }
}

export async function tidyAction(opts: { yes?: boolean }): Promise<void> {
  try {
    try {
      git("fetch", "--prune");
    } catch {
      console.log(chalk.yellow("Couldn't fetch, using local remote state"));
    }
    git("worktree", "prune");

    const base = defaultBase();
    const refs = lines(git("for-each-ref", "--format=%(refname:short)\t%(upstream:track)", "refs/heads"));
    const gone = refs.filter((r) => r.endsWith("[gone]")).map((r) => r.split("\t")[0]);
    const branches = pickBranches({
      merged: lines(git("branch", "--merged", base, "--format=%(refname:short)")),
      gone,
      checkedOut: lines(git("worktree", "list", "--porcelain"))
        .filter((l) => l.startsWith("branch refs/heads/"))
        .map((l) => l.slice("branch refs/heads/".length)),
      base,
    });

    if (branches.length === 0) {
      console.log("Nothing to tidy");
      return;
    }
    for (const b of branches) console.log(`  ${b}${gone.includes(b) ? chalk.dim(" (remote deleted)") : ""}`);
    if (!opts.yes && !(await confirm({ message: `Delete ${branches.length} branch(es)?`, default: false }))) return;

    for (const b of branches) git("branch", "-D", b);
    console.log(chalk.green(`Deleted ${branches.length} branch(es)`));
  } catch (err) {
    console.error(chalk.red(`Error: ${(err as Error).message}`));
    process.exitCode = 1;
  }
}

export const tidyCommand = new Command("tidy")
  .description("Delete merged and remote-deleted branches, prune stale worktrees")
  .option("-y, --yes", "skip the confirmation prompt")
  .action(tidyAction);
