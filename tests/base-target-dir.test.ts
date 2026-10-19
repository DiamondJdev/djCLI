import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { inspectTargetDir } from "../src/commands/base/target-dir.js";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dj-target-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("inspectTargetDir", () => {
  it("reports a missing folder", () => {
    expect(inspectTargetDir(path.join(tmp, "nope"))).toEqual({
      exists: false,
      hasGit: false,
      hasGitignore: false,
    });
  });

  it("accepts a folder with only .git, README.md and .DS_Store", () => {
    fs.mkdirSync(path.join(tmp, ".git"));
    fs.writeFileSync(path.join(tmp, "README.md"), "# hi");
    fs.writeFileSync(path.join(tmp, ".DS_Store"), "");
    expect(inspectTargetDir(tmp)).toEqual({
      exists: true,
      hasGit: true,
      hasGitignore: false,
    });
  });

  it("refuses a folder with other files and lists them sorted", () => {
    fs.writeFileSync(path.join(tmp, "package.json"), "{}");
    fs.mkdirSync(path.join(tmp, "src"));
    expect(() => inspectTargetDir(tmp)).toThrow(
      `Directory '${tmp}' is not empty: package.json, src`,
    );
  });
});
