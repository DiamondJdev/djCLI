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

function parseWorktrees(porcelain: string): { path: string; branch?: string }[] {
  return porcelain
    .split("\n\n")
    .map(lines)
    .filter((ls) => ls.length > 0)
    .map((ls) => ({
      path: ls[0].slice("worktree ".length),
      branch: ls.find((l) => l.startsWith("branch refs/heads/"))?.slice("branch refs/heads/".length),
    }));
}

// git refuses to remove a worktree with uncommitted or untracked changes, or a locked one
const removeWorktree = (path: string): boolean => {
  try {
    git("worktree", "remove", path);
    return true;
  } catch {
    console.log(chalk.yellow(`Kept ${path}: it has uncommitted changes or is locked`));
    return false;
  }
};

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
    const local = ["main", "master"].find((b) => {
      try {
        git("rev-parse", "--verify", "--quiet", `refs/heads/${b}`);
        return true;
      } catch {
        return false;
      }
    });
    if (local) return local;
    throw new Error("Can't find the default branch. Run: git remote set-head origin -a");
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
    const trees = parseWorktrees(git("worktree", "list", "--porcelain"));
    const here = git("rev-parse", "--is-bare-repository").trim() === "true"
      ? undefined
      : git("rev-parse", "--show-toplevel").trim();
    // Keep the main worktree, the current one, and parents containing other worktrees.
    const pinned = trees.filter((t, i) =>
      i === 0 || t.path === here || trees.some((nested) => nested.path.startsWith(`${t.path}/`)),
    );
    const treeOf = new Map(trees.filter((t) => !pinned.includes(t) && t.branch).map((t) => [t.branch!, t.path]));
    const branches = pickBranches({
      // after.has drops the "(HEAD detached at …)" line git branch prints
      merged: lines(git("branch", "--merged", base, "--format=%(refname:short)")).filter((b) => after.has(b)),
      gone,
      checkedOut: pinned.flatMap((t) => (t.branch ? [t.branch] : [])),
      base,
    });

    if (branches.length === 0) {
      console.log("Nothing to tidy");
      return;
    }
    const notes = (b: string) =>
      [gone.includes(b) && "remote deleted", treeOf.has(b) && `worktree ${treeOf.get(b)}`].filter(Boolean).join(", ");
    for (const b of branches) console.log(`  ${b}${notes(b) ? chalk.dim(` (${notes(b)})`) : ""}`);
    const treeCount = branches.filter((b) => treeOf.has(b)).length;
    const message = `Delete ${branches.length} branch(es)${treeCount ? ` and ${treeCount} worktree(s)` : ""}?`;
    if (!opts.yes && !(await confirm({ message, default: false }))) return;

    const deletable = branches.filter((b) => !treeOf.has(b) || removeWorktree(treeOf.get(b)!));
    for (const b of deletable) git("branch", "-D", b);
    console.log(chalk.green(`Deleted ${deletable.length} branch(es)`));
  } catch (err) {
    console.error(chalk.red(`Error: ${(err as Error).message}`));
    process.exitCode = 1;
  }
}

export const tidyCommand = new Command("tidy")
  .description("Delete merged and remote-deleted branches and their worktrees")
  .option("-y, --yes", "skip the confirmation prompt")
  .action(tidyAction);
