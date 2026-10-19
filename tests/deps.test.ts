import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("fs", () => ({ existsSync: vi.fn(), readFileSync: vi.fn(), rmSync: vi.fn() }));
vi.mock("child_process", () => ({ spawnSync: vi.fn(), execFileSync: vi.fn() }));
import { existsSync, readFileSync, rmSync } from "fs";
import { spawnSync, execFileSync } from "child_process";
import { depsAction } from "../src/commands/deps.js";

const ran = () => vi.mocked(spawnSync).mock.calls.map(([cmd, args]) => [cmd, ...(args ?? [])].join(" "));
const failOn = (command: string) =>
  vi.mocked(spawnSync).mockImplementation((cmd, args) =>
    ({ status: [cmd, ...(args ?? [])].join(" ") === command ? 1 : 0 }) as never,
  );

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(existsSync).mockImplementation((p) => /(pnpm-lock\.yaml|package\.json)$/.test(String(p)));
  vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ scripts: { test: "vitest run" } }));
  vi.mocked(execFileSync)
    .mockReset()
    .mockImplementation((_cmd, args) => (args?.[0] === "ls-files" ? "package.json\npnpm-lock.yaml\n" : ""));
  vi.mocked(spawnSync).mockReset().mockReturnValue({ status: 0 } as never);
  process.exitCode = undefined;
});

describe("depsAction", () => {
  it("lists outdated, updates, then tests", () => {
    depsAction();
    expect(ran()).toEqual(["pnpm outdated", "pnpm update", "pnpm test"]);
    expect(process.exitCode).toBeUndefined();
  });

  it("refuses when the manifest or lockfile has uncommitted changes", () => {
    vi.mocked(execFileSync).mockReturnValue(" M package.json\n");
    depsAction();
    expect(ran()).toEqual([]);
    expect(process.exitCode).toBe(1);
  });

  it("rolls back and reinstalls when tests fail", () => {
    failOn("pnpm test");
    depsAction();
    expect(execFileSync).toHaveBeenCalledWith("git", ["checkout", "--", "package.json", "pnpm-lock.yaml"]);
    expect(ran().at(-1)).toBe("pnpm install");
    expect(process.exitCode).toBe(1);
  });

  it("rolls back only tracked files and removes a lockfile the update created", () => {
    vi.mocked(existsSync).mockImplementation((p) => String(p).endsWith("package.json"));
    vi.mocked(execFileSync).mockImplementation((_cmd, args) => (args?.[0] === "ls-files" ? "package.json\n" : ""));
    failOn("npm test");
    depsAction();
    expect(execFileSync).toHaveBeenCalledWith("git", ["checkout", "--", "package.json"]);
    expect(rmSync).toHaveBeenCalledWith("package-lock.json", { force: true });
    expect(ran().at(-1)).toBe("npm install");
  });

  it("says so when the reinstall after rollback fails", () => {
    vi.mocked(spawnSync).mockImplementation(
      (cmd, args) => ({ status: ["pnpm test", "pnpm install"].includes([cmd, ...(args ?? [])].join(" ")) ? 1 : 0 }) as never,
    );
    depsAction();
    expect(vi.mocked(console.error).mock.calls.flat().join(" ")).toMatch(/reinstall failed/i);
    expect(process.exitCode).toBe(1);
  });

  it("treats npm init's placeholder test script as no test script", () => {
    vi.mocked(readFileSync).mockReturnValue(
      JSON.stringify({ scripts: { test: 'echo "Error: no test specified" && exit 1' } }),
    );
    depsAction();
    expect(ran()).toEqual(["pnpm outdated", "pnpm update"]);
    expect(process.exitCode).toBeUndefined();
  });

  it("keeps updates untested when there is no test script", () => {
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ scripts: {} }));
    depsAction();
    expect(ran()).toEqual(["pnpm outdated", "pnpm update"]);
    expect(process.exitCode).toBeUndefined();
  });

  it("stops without testing when the update itself fails", () => {
    failOn("pnpm update");
    depsAction();
    expect(ran()).not.toContain("pnpm test");
    expect(process.exitCode).toBe(1);
  });
});
