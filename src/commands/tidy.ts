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

const trackState = (): Map<string, string> =>
  new Map(
    lines(git("for-each-ref", "--format=%(refname:short)\t%(upstream:track)", "refs/heads")).map(
      (r) => r.split("\t") as [string, string],
    ),
  );

// Gone branches safe to delete: fully pushed before this fetch pruned their upstream.
// One already gone before the fetch can't be checked, so it's kept.
export function pushedGone(before: Map<string, string>, after: Map<string, string>): string[] {
  return [...after]
    .filter(([b, track]) => track === "[gone]" && before.has(b))
    .map(([b]) => b)
    .filter((b) => before.get(b) !== "[gone]" && !before.get(b)!.includes("ahead"));
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
    const before = trackState();
    try {
      git("fetch", "--prune");
    } catch {
      console.log(chalk.yellow("Couldn't fetch, using local remote state"));
    }
    git("worktree", "prune");

    const base = defaultBase();
    const after = trackState();
    const gone = pushedGone(before, after);
    const kept = [...after].filter(([b, t]) => t === "[gone]" && !gone.includes(b)).map(([b]) => b);
    if (kept.length > 0) console.log(chalk.dim(`Kept remote-deleted branches that may hold unpushed work: ${kept.join(", ")}`));
    const branches = pickBranches({
      // after.has drops the "(HEAD detached at …)" line git branch prints
      merged: lines(git("branch", "--merged", base, "--format=%(refname:short)")).filter((b) => after.has(b)),
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
