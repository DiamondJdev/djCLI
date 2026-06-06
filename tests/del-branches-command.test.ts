import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
}));

import { execSync } from "child_process";
import { confirm } from "@inquirer/prompts";
import { delBranchesAction } from "../src/commands/del-branches.js";

beforeEach(() => {
  vi.mocked(execSync).mockReset();
  vi.mocked(confirm).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("delBranchesAction", () => {
  it("reports no branches when all are protected", async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from("* main\n  master\n"));
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await delBranchesAction({ dryRun: false, yes: false });
    expect(spy.mock.calls.flat().join("\n")).toContain("No branches to delete");
    spy.mockRestore();
  });

  it("dry-run: lists branches without deleting", async () => {
    vi.mocked(execSync).mockReturnValue(
      Buffer.from("  feature-a\n  fix/bug\n* main\n"),
    );
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await delBranchesAction({ dryRun: true, yes: false });
    const output = spy.mock.calls.flat().join("\n");
    expect(output).toContain("feature-a");
    expect(output).toContain("fix/bug");
    expect(output).toContain("Dry-run mode");
    spy.mockRestore();
  });

  it("--yes: deletes branches without prompting", async () => {
    vi.mocked(execSync)
      .mockReturnValueOnce(Buffer.from("  feature-a\n* main\n"))
      .mockReturnValue(Buffer.from(""));
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await delBranchesAction({ dryRun: false, yes: true });
    const output = spy.mock.calls.flat().join("\n");
    expect(output).toContain("Deleted: feature-a");
    expect(output).toContain("Successfully deleted 1");
    expect(vi.mocked(confirm)).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("confirmation cancelled aborts deletion", async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from("  feature-a\n* main\n"));
    vi.mocked(confirm).mockResolvedValue(false);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await delBranchesAction({ dryRun: false, yes: false });
    expect(spy.mock.calls.flat().join("\n")).toContain("Deletion cancelled");
    spy.mockRestore();
  });

  it("confirmation confirmed deletes branches", async () => {
    vi.mocked(execSync)
      .mockReturnValueOnce(Buffer.from("  feature-a\n* main\n"))
      .mockReturnValue(Buffer.from(""));
    vi.mocked(confirm).mockResolvedValue(true);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await delBranchesAction({ dryRun: false, yes: false });
    expect(spy.mock.calls.flat().join("\n")).toContain("Successfully deleted");
    spy.mockRestore();
  });

  it("reports failed deletions", async () => {
    vi.mocked(execSync)
      .mockReturnValueOnce(Buffer.from("  feature-a\n* main\n"))
      .mockImplementationOnce(() => {
        throw new Error("deletion failed");
      });
    vi.mocked(confirm).mockResolvedValue(true);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await delBranchesAction({ dryRun: false, yes: false });
    expect(spy.mock.calls.flat().join("\n")).toContain("Failed to delete");
    spy.mockRestore();
  });

  it("exits on git error", async () => {
    vi.mocked(execSync).mockImplementationOnce(() => {
      throw new Error("not a git repo");
    });
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit");
    });
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(
      delBranchesAction({ dryRun: false, yes: false }),
    ).rejects.toThrow("process.exit");
    spy.mockRestore();
    exitSpy.mockRestore();
  });
});
