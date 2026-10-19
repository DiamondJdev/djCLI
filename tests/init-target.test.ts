import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { assertTargetUsable } from "../src/commands/init/target.js";

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dj-target-"));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe("assertTargetUsable", () => {
  it("accepts a missing folder", () => {
    expect(() => assertTargetUsable(path.join(tmp, "nope"))).not.toThrow();
  });

  it("accepts a folder with only .git, README.md and .DS_Store", () => {
    fs.mkdirSync(path.join(tmp, ".git"));
    fs.writeFileSync(path.join(tmp, "README.md"), "# hi");
    fs.writeFileSync(path.join(tmp, ".DS_Store"), "");
    expect(() => assertTargetUsable(tmp)).not.toThrow();
  });

  it("refuses a folder with other files and lists them sorted", () => {
    fs.writeFileSync(path.join(tmp, "package.json"), "{}");
    fs.mkdirSync(path.join(tmp, "src"));
    expect(() => assertTargetUsable(tmp)).toThrow(
      `Directory '${tmp}' is not empty: package.json, src`,
    );
  });
});
