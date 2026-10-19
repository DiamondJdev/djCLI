import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  input: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
}));

import { execFileSync } from "child_process";
import { baseInitAction } from "../src/commands/base/action.js";

let tmpDir: string;
let target: string;
let logs: string[];

const flags = { yes: true, description: "d", pm: "pnpm" };

function calls(): [string, string][] {
  return vi
    .mocked(execFileSync)
    .mock.calls.map(([cmd, args]) => [cmd as string, (args as string[])[0]]);
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dj-base-"));
  target = path.join(tmpDir, "demo");
  logs = [];
  vi.mocked(execFileSync).mockReset();
  vi.spyOn(console, "log").mockImplementation((...args) => {
    logs.push(args.join(" "));
  });
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit");
  });
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("baseInitAction", () => {
  it("runs init steps, then git init, then the network install last, in the target folder", async () => {
    await baseInitAction(target, flags);
    expect(calls()).toEqual([
      ["git", "config"],
      ["pnpm", "init"],
      ["pnpm", "pkg"],
      ["git", "init"],
      ["pnpm", "add"],
    ]);
    expect(vi.mocked(execFileSync).mock.calls[1][2]).toMatchObject({ cwd: target });
  });

  it("writes AGENTS.md, CLAUDE.md, the example test, .gitignore and keeps empty dirs", async () => {
    await baseInitAction(target, flags);
    expect(fs.readFileSync(path.join(target, "CLAUDE.md"), "utf-8")).toBe("@AGENTS.md\n");
    for (const f of ["AGENTS.md", "tests/example.test.ts", ".gitignore", "docs/.gitkeep", "src/.gitkeep"]) {
      expect(fs.existsSync(path.join(target, f)), f).toBe(true);
    }
    expect(fs.existsSync(path.join(target, "tests/.gitkeep"))).toBe(false);
  });

  it("--no-git skips git init and .gitignore", async () => {
    await baseInitAction(target, { ...flags, git: false });
    expect(calls()).not.toContainEqual(["git", "init"]);
    expect(fs.existsSync(path.join(target, ".gitignore"))).toBe(false);
  });

  it("skips git init and keeps .gitignore when the folder already has them", async () => {
    fs.mkdirSync(path.join(target, ".git"), { recursive: true });
    fs.writeFileSync(path.join(target, ".gitignore"), "keep");
    await baseInitAction(target, flags);
    expect(calls()).not.toContainEqual(["git", "init"]);
    expect(fs.readFileSync(path.join(target, ".gitignore"), "utf-8")).toBe("keep");
  });

  it("refuses a non-empty folder without deleting it", async () => {
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "package.json"), "{}");
    await expect(baseInitAction(target, flags)).rejects.toThrow("process.exit");
    expect(fs.existsSync(path.join(target, "package.json"))).toBe(true);
    expect(calls().some(([cmd]) => cmd === "pnpm")).toBe(false);
    expect(logs.join("\n")).toContain("is not empty: package.json");
  });

  it("--force deletes and recreates a non-empty folder", async () => {
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "old.txt"), "x");
    await baseInitAction(target, { ...flags, force: true });
    expect(fs.existsSync(path.join(target, "old.txt"))).toBe(false);
    expect(fs.existsSync(path.join(target, "AGENTS.md"))).toBe(true);
  });

  it("on a failed install, names the command and leaves a complete project", async () => {
    vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
      if ((args as string[])[0] === "add") throw new Error("network");
      return Buffer.from("");
    });
    await expect(baseInitAction(target, flags)).rejects.toThrow("process.exit");
    expect(logs.join("\n")).toContain("Command failed: pnpm add -D vitest");
    for (const f of ["AGENTS.md", "CLAUDE.md", "tests/example.test.ts", ".gitignore"]) {
      expect(fs.existsSync(path.join(target, f)), f).toBe(true);
    }
    expect(calls()).toContainEqual(["git", "init"]);
  });

  it("--force with a missing --description deletes nothing", async () => {
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "keep.txt"), "x");
    await expect(
      baseInitAction(target, { yes: true, force: true }),
    ).rejects.toThrow("process.exit");
    expect(fs.existsSync(path.join(target, "keep.txt"))).toBe(true);
  });

  it("--force on '.' empties the current folder and builds in it", async () => {
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "old.txt"), "x");
    const cwd = process.cwd();
    process.chdir(target);
    try {
      await baseInitAction(".", { ...flags, name: "demo", force: true });
    } finally {
      process.chdir(cwd);
    }
    expect(fs.existsSync(path.join(target, "old.txt"))).toBe(false);
    expect(fs.existsSync(path.join(target, "AGENTS.md"))).toBe(true);
  });

  it("reports a missing package manager by name", async () => {
    vi.mocked(execFileSync).mockImplementation((cmd) => {
      if (cmd === "pnpm") {
        throw Object.assign(new Error("spawnSync pnpm ENOENT"), { code: "ENOENT" });
      }
      return Buffer.from("");
    });
    await expect(baseInitAction(target, flags)).rejects.toThrow("process.exit");
    expect(logs.join("\n")).toContain("pnpm is not installed or not on PATH");
  });

  it("reports a missing --description before creating the folder", async () => {
    await expect(baseInitAction(target, { yes: true })).rejects.toThrow("process.exit");
    expect(logs.join("\n")).toContain("Missing --description");
    expect(fs.existsSync(target)).toBe(false);
  });
});
