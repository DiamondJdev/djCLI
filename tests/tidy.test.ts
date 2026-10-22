import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("@inquirer/prompts", () => ({ confirm: vi.fn() }));
import { execFileSync } from "child_process";
import { confirm } from "@inquirer/prompts";
import { pickBranches, pushedGone, tidyAction } from "../src/commands/tidy.js";

const git: Record<string, string> = {
  "symbolic-ref": "origin/main\n",
  "for-each-ref": "main\t\nfeat/a\t\nfeat/squashed\t[gone]\nfeat/wip\t[gone]\nfeat/other-tree\t[gone]\n",
  branch: "main\nfeat/a\n",
  "rev-parse": "/repo\n",
  worktree: "worktree /repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /repo/.wt\nHEAD def\nbranch refs/heads/feat/other-tree\n",
};
const removedTrees = () =>
  vi.mocked(execFileSync).mock.calls.filter(([, a]) => a?.[0] === "worktree" && a[1] === "remove").map(([, a]) => a![2]);
const deleted = () =>
  vi.mocked(execFileSync).mock.calls.filter(([, a]) => a?.[0] === "branch" && a[1] === "-D").map(([, a]) => a![2]);

// Tracking state before fetch --prune: feat/wip had unpushed commits
const beforeFetch = "main\t\nfeat/a\t\nfeat/squashed\t\nfeat/wip\t[ahead 2]\nfeat/other-tree\t\n";
const mockGit = (fetchFails = false) => {
  let fetched = false;
  vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
    if (args![0] === "fetch") {
      if (fetchFails) throw new Error("offline");
      fetched = true;
    }
    if (args![0] === "for-each-ref" && !fetched) return beforeFetch;
    return git[args![0]] ?? "";
  });
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(execFileSync).mockReset();
  mockGit();
  vi.mocked(confirm).mockReset().mockResolvedValue(true);
  process.exitCode = undefined;
});

describe("pickBranches", () => {
  it("keeps the base, main/master and checked-out branches", () => {
    expect(
      pickBranches({
        merged: ["main", "master", "dev", "feat/a"],
        gone: ["feat/b", "feat/tree"],
        checkedOut: ["dev", "feat/tree"],
        base: "origin/develop",
      }),
    ).toEqual(["feat/a", "feat/b"]);
  });

  it("protects the base branch by its short name", () => {
    expect(pickBranches({ merged: ["develop"], gone: [], checkedOut: [], base: "origin/develop" })).toEqual([]);
  });
});

describe("pushedGone", () => {
  it("keeps gone branches that were ahead, or already gone, before the fetch", () => {
    const before = new Map([["feat/done", ""], ["feat/wip", "[ahead 2]"], ["feat/old", "[gone]"]]);
    const after = new Map([["feat/done", "[gone]"], ["feat/wip", "[gone]"], ["feat/old", "[gone]"]]);
    expect(pushedGone(before, after)).toEqual(["feat/done"]);
  });
});

describe("tidyAction", () => {
  it("never deletes the detached HEAD entry", async () => {
    git.branch = "(HEAD detached at abc)\nmain\nfeat/a\n";
    await tidyAction({ yes: true });
    git.branch = "main\nfeat/a\n";
    expect(deleted()).not.toContain("(HEAD detached at abc)");
  });


  it("deletes merged and gone branches after confirming", async () => {
    await tidyAction({});
    expect(confirm).toHaveBeenCalled();
    expect(deleted()).toEqual(["feat/a", "feat/squashed", "feat/other-tree"]);
    expect(execFileSync).toHaveBeenCalledWith("git", ["worktree", "prune"], expect.anything());
  });

  it("-y skips the prompt", async () => {
    await tidyAction({ yes: true });
    expect(confirm).not.toHaveBeenCalled();
    expect(deleted()).toHaveLength(3);
  });

  it("deletes nothing when declined", async () => {
    vi.mocked(confirm).mockResolvedValue(false);
    await tidyAction({});
    expect(deleted()).toEqual([]);
  });

  it("still works offline", async () => {
    mockGit(true);
    await tidyAction({ yes: true });
    expect(deleted()).toEqual(["feat/a"]);
  });

  it("falls back to a local master when origin/HEAD isn't set", async () => {
    vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
      if (args![0] === "symbolic-ref") throw new Error("not a symbolic ref");
      if (args![1] === "--verify" && args!.at(-1) !== "refs/heads/master") throw new Error("unknown ref");
      if (args![0] === "for-each-ref") return beforeFetch;
      return git[args![0]] ?? "";
    });
    await tidyAction({ yes: true });
    expect(execFileSync).toHaveBeenCalledWith("git", ["branch", "--merged", "master", "--format=%(refname:short)"], expect.anything());
    expect(process.exitCode).toBeUndefined();
  });

  it("removes the worktree of a merged or gone branch before deleting it", async () => {
    await tidyAction({ yes: true });
    expect(removedTrees()).toEqual(["/repo/.wt"]);
    expect(deleted()).toContain("feat/other-tree");
  });

  it("keeps the branch when its worktree can't be removed", async () => {
    vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
      if (args![0] === "worktree" && args![1] === "remove") throw new Error("contains modified files");
      if (args![0] === "for-each-ref" && !vi.mocked(execFileSync).mock.calls.some(([, a]) => a?.[0] === "fetch")) return beforeFetch;
      return git[args![0]] ?? "";
    });
    await tidyAction({ yes: true });
    expect(deleted()).toEqual(["feat/a", "feat/squashed"]);
    expect(process.exitCode).toBeUndefined();
  });

  it("never removes the main worktree or the one you're in", async () => {
    git["rev-parse"] = "/repo/.wt\n";
    await tidyAction({ yes: true });
    git["rev-parse"] = "/repo\n";
    expect(removedTrees()).toEqual([]);
    expect(deleted()).not.toContain("feat/other-tree");
  });

  it.each(["current", "unmerged", "locked"])("keeps ancestors of a %s nested worktree", async (state) => {
    const worktrees = git.worktree;
    const here = git["rev-parse"];
    const refs = git["for-each-ref"];
    git["for-each-ref"] += "feat/nested\t\n";
    git.worktree += `\nworktree /repo/.wt/.nested\nHEAD abc\nbranch refs/heads/feat/nested\n${state === "locked" ? "locked\n" : ""}`;
    if (state === "current") git["rev-parse"] = "/repo/.wt/.nested\n";
    try {
      await tidyAction({ yes: true });
      expect(removedTrees()).toEqual([]);
      expect(deleted()).not.toContain("feat/other-tree");
      expect(deleted()).toEqual(["feat/a", "feat/squashed"]);
    } finally {
      git.worktree = worktrees;
      git["rev-parse"] = here;
      git["for-each-ref"] = refs;
    }
  });

  it("cleans linked worktrees when invoked from a bare repository", async () => {
    const worktrees = git.worktree;
    git.worktree = worktrees.replace("HEAD abc\nbranch refs/heads/main", "bare");
    vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
      if (args![1] === "--is-bare-repository") return "true\n";
      if (args![1] === "--show-toplevel") throw new Error("must be run in a work tree");
      if (args![0] === "for-each-ref" && !vi.mocked(execFileSync).mock.calls.some(([, callArgs]) => callArgs?.[0] === "fetch")) return beforeFetch;
      return git[args![0]] ?? "";
    });
    try {
      await tidyAction({ yes: true });
      expect(process.exitCode).toBeUndefined();
      expect(removedTrees()).toEqual(["/repo/.wt"]);
      expect(deleted()).toContain("feat/other-tree");
    } finally {
      git.worktree = worktrees;
    }
  });

  it("exits 1 outside a git repo", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("not a git repository");
    });
    await tidyAction({ yes: true });
    expect(process.exitCode).toBe(1);
  });
});
