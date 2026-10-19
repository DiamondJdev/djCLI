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
  worktree: "worktree /repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /repo/.wt\nHEAD def\nbranch refs/heads/feat/other-tree\n",
};
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
    expect(deleted()).toEqual(["feat/a", "feat/squashed"]);
    expect(execFileSync).toHaveBeenCalledWith("git", ["worktree", "prune"], expect.anything());
  });

  it("-y skips the prompt", async () => {
    await tidyAction({ yes: true });
    expect(confirm).not.toHaveBeenCalled();
    expect(deleted()).toHaveLength(2);
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

  it("exits 1 outside a git repo", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("not a git repository");
    });
    await tidyAction({ yes: true });
    expect(process.exitCode).toBe(1);
  });
});
