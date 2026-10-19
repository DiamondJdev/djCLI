import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("@inquirer/prompts", () => ({ confirm: vi.fn() }));
import { execFileSync } from "child_process";
import { confirm } from "@inquirer/prompts";
import { pickBranches, tidyAction } from "../src/commands/tidy.js";

const git: Record<string, string> = {
  "symbolic-ref": "origin/main\n",
  "for-each-ref": "main\t\nfeat/a\t\nfeat/squashed\t[gone]\nfeat/wip\t[ahead 2]\nfeat/other-tree\t[gone]\n",
  branch: "main\nfeat/a\n",
  worktree: "worktree /repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /repo/.wt\nHEAD def\nbranch refs/heads/feat/other-tree\n",
};
const deleted = () =>
  vi.mocked(execFileSync).mock.calls.filter(([, a]) => a?.[0] === "branch" && a[1] === "-D").map(([, a]) => a![2]);

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(execFileSync).mockReset().mockImplementation((_cmd, args) => git[args![0]] ?? "");
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

describe("tidyAction", () => {
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
    vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
      if (args![0] === "fetch") throw new Error("offline");
      return git[args![0]] ?? "";
    });
    await tidyAction({ yes: true });
    expect(deleted()).toHaveLength(2);
  });

  it("exits 1 outside a git repo", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("not a git repository");
    });
    await tidyAction({ yes: true });
    expect(process.exitCode).toBe(1);
  });
});
