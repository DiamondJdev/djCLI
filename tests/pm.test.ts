import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("fs", () => ({ existsSync: vi.fn() }));
vi.mock("child_process", () => ({ spawnSync: vi.fn() }));
import { existsSync } from "fs";
import { spawnSync } from "child_process";
import { detectPm, pmStep, pmAction } from "../src/commands/pm.js";

const hasFiles = (...files: string[]) =>
  vi.mocked(existsSync).mockImplementation((p) => files.some((f) => String(p).endsWith(f)));

beforeEach(() => {
  vi.mocked(existsSync).mockReset();
  vi.mocked(spawnSync).mockReset().mockReturnValue({ status: 0 } as never);
  process.exitCode = undefined;
});

describe("detectPm", () => {
  it("picks pnpm from its lockfile even when package-lock.json exists", () => {
    hasFiles("pnpm-lock.yaml", "package-lock.json");
    expect(detectPm("/p")).toBe("pnpm");
  });

  it("picks uv from uv.lock or pyproject.toml", () => {
    hasFiles("uv.lock");
    expect(detectPm("/p")).toBe("uv");
    hasFiles("pyproject.toml");
    expect(detectPm("/p")).toBe("uv");
  });

  it("prefers npm markers over a stray pyproject.toml", () => {
    hasFiles("package-lock.json", "pyproject.toml");
    expect(detectPm("/p")).toBe("npm");
    hasFiles("package.json", "pyproject.toml");
    expect(detectPm("/p")).toBe("npm");
  });

  it("falls back to npm", () => {
    hasFiles();
    expect(detectPm("/p")).toBe("npm");
  });
});

describe("pmStep", () => {
  it("installs everything with no packages", () => {
    expect(pmStep("npm", "i", [])).toEqual({ cmd: "npm", args: ["install"] });
    expect(pmStep("pnpm", "i", [])).toEqual({ cmd: "pnpm", args: ["install"] });
    expect(pmStep("uv", "i", [])).toEqual({ cmd: "uv", args: ["sync"] });
  });

  it("adds packages, as dev dependencies with dev", () => {
    expect(pmStep("pnpm", "i", ["zod"])).toEqual({ cmd: "pnpm", args: ["add", "zod"] });
    expect(pmStep("npm", "i", ["vitest"], true)).toEqual({ cmd: "npm", args: ["install", "-D", "vitest"] });
    expect(pmStep("uv", "i", ["pytest"], true)).toEqual({ cmd: "uv", args: ["add", "--dev", "pytest"] });
  });

  it("removes packages", () => {
    expect(pmStep("npm", "rm", ["a"])).toEqual({ cmd: "npm", args: ["uninstall", "a"] });
    expect(pmStep("pnpm", "rm", ["a"])).toEqual({ cmd: "pnpm", args: ["remove", "a"] });
    expect(pmStep("uv", "rm", ["a"])).toEqual({ cmd: "uv", args: ["remove", "a"] });
  });

  it("runs a package binary with its arguments", () => {
    expect(pmStep("npm", "x", ["eslint", "--fix"])).toEqual({ cmd: "npx", args: ["eslint", "--fix"] });
    expect(pmStep("pnpm", "x", ["eslint"])).toEqual({ cmd: "pnpm", args: ["dlx", "eslint"] });
    expect(pmStep("uv", "x", ["ruff", "check"])).toEqual({ cmd: "uvx", args: ["ruff", "check"] });
  });
});

describe("pmAction", () => {
  it("runs the detected package manager", () => {
    hasFiles("pnpm-lock.yaml");
    pmAction("i", ["zod"]);
    expect(spawnSync).toHaveBeenCalledWith("pnpm", ["add", "zod"], { stdio: "inherit" });
    expect(process.exitCode).toBe(0);
  });

  it("passes the child's exit code through", () => {
    hasFiles();
    vi.mocked(spawnSync).mockReturnValue({ status: 2 } as never);
    pmAction("x", ["tsc"]);
    expect(process.exitCode).toBe(2);
  });

  it("exits 1 when the package manager isn't installed", () => {
    hasFiles("uv.lock");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(spawnSync).mockReturnValue({ status: null, error: new Error("spawn uv ENOENT") } as never);
    pmAction("i", []);
    expect(process.exitCode).toBe(1);
  });
});
