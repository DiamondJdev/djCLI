import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));

vi.mock("@inquirer/prompts", () => ({
  confirm: vi.fn(),
  input: vi.fn(),
}));

import { execSync, execFileSync } from "child_process";
import { confirm, input } from "@inquirer/prompts";
import { initAction } from "../src/commands/init.js";

let tmpDir: string;
let origCwd: string;
let exitSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dj-test-"));
  origCwd = process.cwd();
  process.chdir(tmpDir);
  exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
    throw new Error("process.exit");
  });
  vi.mocked(execSync).mockReset();
  vi.mocked(execFileSync).mockReset();
  vi.mocked(confirm).mockReset();
  vi.mocked(input).mockReset();
});

afterEach(() => {
  process.chdir(origCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  exitSpy.mockRestore();
  vi.restoreAllMocks();
});

describe("initAction", () => {
  it("exits with error for unknown template", async () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(
      initAction("angular", "./app", { force: false }),
    ).rejects.toThrow("process.exit");
    const output = spy.mock.calls.flat().join("\n");
    expect(output).toContain("Unknown template 'angular'");
    expect(output).toContain("nest");
    spy.mockRestore();
  });

  it("prompts for overwrite when target dir exists and cancels", async () => {
    const targetDir = path.join(tmpDir, "my-app");
    fs.mkdirSync(targetDir);
    vi.mocked(confirm).mockResolvedValue(false);
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await initAction("nest", targetDir, { force: false });
    expect(spy.mock.calls.flat().join("\n")).toContain(
      "Initialization cancelled",
    );
    spy.mockRestore();
  });

  it("--force skips overwrite prompt", async () => {
    const targetDir = path.join(tmpDir, "my-app");
    fs.mkdirSync(targetDir);
    vi.mocked(execFileSync).mockImplementation(() => {
      fs.mkdirSync(targetDir, { recursive: true });
      return Buffer.from("");
    });
    vi.mocked(input).mockResolvedValue("my-app");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await initAction("nest", targetDir, { force: true });
    expect(vi.mocked(confirm)).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it("clones template, removes .git, substitutes variables", async () => {
    const targetDir = path.join(tmpDir, "my-app");
    vi.mocked(execFileSync)
      .mockImplementationOnce(() => {
        fs.mkdirSync(path.join(targetDir, ".git"), { recursive: true });
        fs.writeFileSync(
          path.join(targetDir, "README.md"),
          "# {{PROJECT_NAME}}",
        );
        return Buffer.from("");
      })
      .mockReturnValue(Buffer.from(""));
    vi.mocked(input)
      .mockResolvedValueOnce("my-app")
      .mockResolvedValueOnce("TestAuthor")
      .mockResolvedValueOnce("A test app");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await initAction("nest", targetDir, { force: false });
    expect(fs.readFileSync(path.join(targetDir, "README.md"), "utf-8")).toBe(
      "# my-app",
    );
    expect(fs.existsSync(path.join(targetDir, ".git"))).toBe(false);
    spy.mockRestore();
  });

  it("exits when git clone fails", async () => {
    const targetDir = path.join(tmpDir, "my-app");
    vi.mocked(execFileSync).mockImplementationOnce(() => {
      throw new Error("clone failed");
    });
    vi.mocked(input).mockResolvedValue("my-app");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await expect(
      initAction("react", targetDir, { force: false }),
    ).rejects.toThrow("process.exit");
    spy.mockRestore();
  });

  it("reports success and next steps after init", async () => {
    const targetDir = path.join(tmpDir, "my-react-app");
    vi.mocked(execFileSync).mockImplementation(() => {
      fs.mkdirSync(targetDir, { recursive: true });
      return Buffer.from("");
    });
    vi.mocked(input).mockResolvedValue("my-react-app");
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    await initAction("react", targetDir, { force: false });
    const output = spy.mock.calls.flat().join("\n");
    expect(output).toContain("Project initialized successfully");
    expect(output).toContain("Next steps");
    spy.mockRestore();
  });
});
