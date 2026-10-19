import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

vi.mock("child_process", () => ({
  execFileSync: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
  input: vi.fn(),
  select: vi.fn(),
}));

import { execFileSync } from "child_process";
import { initAction } from "../src/commands/init.js";

let tmpDir: string;
let origCwd: string;
let logs: string[];

const flags = { yes: true, description: "A test app" };

/** Fake `git clone`: writes a template into the clone destination (the last arg). */
function fakeClone(files: Record<string, string>) {
  vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
    const list = args as string[];
    if (list[0] !== "clone") return "Me\n";
    const dest = list[list.length - 1];
    fs.mkdirSync(path.join(dest, ".git"), { recursive: true });
    for (const [file, content] of Object.entries(files)) {
      fs.writeFileSync(path.join(dest, file), content);
    }
    return Buffer.from("");
  });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dj-test-"));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  logs = [];
  vi.spyOn(console, "log").mockImplementation((...args) => {
    logs.push(args.join(" "));
  });
  vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit");
  });
  vi.mocked(execFileSync).mockReset();
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("initAction", () => {
  it("exits with error for unknown template", async () => {
    await expect(initAction("angular", "./app", {})).rejects.toThrow("process.exit");
    expect(logs.join("\n")).toContain("Unknown template 'angular'");
    expect(logs.join("\n")).toContain("nest");
  });

  it("does not treat Object.prototype keys as templates", async () => {
    await expect(initAction("constructor", "./app", {})).rejects.toThrow("process.exit");
    expect(logs.join("\n")).toContain("Unknown template 'constructor'");
  });

  it("rejects base-only flags for cloned templates", async () => {
    await expect(
      initAction("nest", "./app", { ...flags, pm: "uv" }),
    ).rejects.toThrow("process.exit");
    expect(logs.join("\n")).toContain("only work with the base template");
    expect(fs.existsSync("./app")).toBe(false);
  });

  it("rejects a target with parent directory references", async () => {
    await expect(initAction("nest", "../app", flags)).rejects.toThrow("process.exit");
    expect(logs.join("\n")).toContain("parent directory references");
  });

  it("clones, removes .git, substitutes answers and prints next steps", async () => {
    fakeClone({ "README.md": "# {{PROJECT_NAME}} by {{AUTHOR}}: {{DESCRIPTION}}" });
    await initAction("nest", "my-app", flags);
    expect(fs.readFileSync("my-app/README.md", "utf-8")).toBe(
      "# my-app by Me: A test app",
    );
    expect(fs.existsSync("my-app/.git")).toBe(false);
    const out = logs.join("\n");
    expect(out).toContain("Project initialized successfully");
    expect(out).toContain("1. cd my-app");
    expect(out).toContain("npm run dev");
  });

  it("refuses a non-empty folder without --force and changes nothing", async () => {
    fs.mkdirSync("my-app");
    fs.writeFileSync("my-app/old.txt", "old");
    await expect(initAction("nest", "my-app", flags)).rejects.toThrow("process.exit");
    expect(logs.join("\n")).toContain("is not empty: old.txt");
    expect(fs.existsSync("my-app/old.txt")).toBe(true);
    expect(vi.mocked(execFileSync)).not.toHaveBeenCalled();
  });

  it("keeps an existing README.md instead of overwriting it", async () => {
    fs.mkdirSync("my-app");
    fs.writeFileSync("my-app/README.md", "mine");
    fakeClone({ "README.md": "theirs", "index.ts": "x" });
    await initAction("react", "my-app", flags);
    expect(fs.readFileSync("my-app/README.md", "utf-8")).toBe("mine");
    expect(fs.existsSync("my-app/index.ts")).toBe(true);
  });

  it("--force . empties the current folder and clones into it", async () => {
    fs.writeFileSync("old.txt", "old");
    fakeClone({ "README.md": "# new" });
    await initAction("nest", ".", { ...flags, force: true });
    expect(fs.existsSync("old.txt")).toBe(false);
    expect(fs.existsSync("README.md")).toBe(true);
  });

  it("--force with a missing --description deletes nothing", async () => {
    fs.mkdirSync("my-app");
    fs.writeFileSync("my-app/keep.txt", "x");
    await expect(
      initAction("nest", "my-app", { yes: true, force: true }),
    ).rejects.toThrow("process.exit");
    expect(fs.existsSync("my-app/keep.txt")).toBe(true);
  });

  it("a failed clone leaves the target untouched", async () => {
    vi.mocked(execFileSync).mockImplementation((_cmd, args) => {
      if ((args as string[])[0] === "clone") throw new Error("clone failed");
      return "Me\n";
    });
    await expect(initAction("react", "my-app", flags)).rejects.toThrow("process.exit");
    expect(logs.join("\n")).toContain("Failed to clone template");
    expect(fs.readdirSync("my-app")).toEqual([]);
  });

  it("dispatches base without cloning", async () => {
    await initAction("base", "my-base", flags);
    const clone = vi
      .mocked(execFileSync)
      .mock.calls.some(([, args]) => (args as string[])[0] === "clone");
    expect(clone).toBe(false);
    expect(fs.existsSync("my-base/AGENTS.md")).toBe(true);
  });
});
