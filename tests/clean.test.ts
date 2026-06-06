import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  findTargetDirectories,
  calculateDirSize,
  formatSize,
  HEAVY_DIRS,
} from "../src/commands/clean.js";

function mkdirp(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe("formatSize", () => {
  it("formats bytes", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(1023)).toBe("1023 B");
  });

  it("formats kilobytes", () => {
    expect(formatSize(1024)).toBe("1.0 KB");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(1024 * 10)).toBe("10.0 KB");
  });

  it("formats megabytes", () => {
    expect(formatSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatSize(1024 * 1024 * 1.5)).toBe("1.5 MB");
  });

  it("formats gigabytes", () => {
    expect(formatSize(1024 * 1024 * 1024)).toBe("1.0 GB");
  });
});

describe("HEAVY_DIRS", () => {
  it("contains all expected target directories", () => {
    const expected = [
      "node_modules",
      "dist",
      "build",
      ".next",
      "target",
      ".turbo",
      "out",
    ];
    for (const dir of expected) {
      expect(HEAVY_DIRS).toContain(dir);
    }
  });
});

describe("findTargetDirectories", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dj-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds node_modules in root", () => {
    mkdirp(path.join(tmpDir, "node_modules"));
    const result = findTargetDirectories(tmpDir, 0);
    expect(result).toContain(path.join(tmpDir, "node_modules"));
  });

  it("finds multiple heavy dirs", () => {
    mkdirp(path.join(tmpDir, "node_modules"));
    mkdirp(path.join(tmpDir, "dist"));
    mkdirp(path.join(tmpDir, "build"));
    const result = findTargetDirectories(tmpDir, 0);
    expect(result).toContain(path.join(tmpDir, "node_modules"));
    expect(result).toContain(path.join(tmpDir, "dist"));
    expect(result).toContain(path.join(tmpDir, "build"));
  });

  it("finds nested heavy dirs", () => {
    const nested = path.join(tmpDir, "packages", "app");
    mkdirp(path.join(nested, "node_modules"));
    const result = findTargetDirectories(tmpDir, 0);
    expect(result).toContain(path.join(nested, "node_modules"));
  });

  it("does not traverse into heavy dirs", () => {
    const nodeModules = path.join(tmpDir, "node_modules");
    mkdirp(path.join(nodeModules, "nested-node_modules"));
    const result = findTargetDirectories(tmpDir, 0);
    expect(result).toHaveLength(1);
    expect(result).toContain(nodeModules);
  });

  it("skips .git directories", () => {
    mkdirp(path.join(tmpDir, ".git", "node_modules"));
    const result = findTargetDirectories(tmpDir, 0);
    expect(result).toHaveLength(0);
  });

  it("respects depth limit of 1", () => {
    mkdirp(path.join(tmpDir, "node_modules"));
    mkdirp(path.join(tmpDir, "packages", "app", "node_modules"));
    const result = findTargetDirectories(tmpDir, 1);
    expect(result).toContain(path.join(tmpDir, "node_modules"));
    expect(result).not.toContain(
      path.join(tmpDir, "packages", "app", "node_modules"),
    );
  });

  it("respects depth limit of 2", () => {
    // packages/node_modules is at depth 2 (found)
    mkdirp(path.join(tmpDir, "packages", "node_modules"));
    // packages/app/node_modules is at depth 3 (skipped)
    mkdirp(path.join(tmpDir, "packages", "app", "node_modules"));
    const result = findTargetDirectories(tmpDir, 2);
    expect(result).toContain(path.join(tmpDir, "packages", "node_modules"));
    expect(result).not.toContain(
      path.join(tmpDir, "packages", "app", "node_modules"),
    );
  });

  it("returns empty array when no heavy dirs found", () => {
    mkdirp(path.join(tmpDir, "src"));
    writeFile(path.join(tmpDir, "src", "index.ts"), "export {}");
    const result = findTargetDirectories(tmpDir, 0);
    expect(result).toHaveLength(0);
  });
});

describe("calculateDirSize", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "dj-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("calculates size of directory with files", () => {
    writeFile(path.join(tmpDir, "a.txt"), "hello");
    writeFile(path.join(tmpDir, "b.txt"), "world!");
    const size = calculateDirSize(tmpDir);
    expect(size).toBe(11);
  });

  it("returns 0 for empty directory", () => {
    expect(calculateDirSize(tmpDir)).toBe(0);
  });

  it("recursively calculates nested files", () => {
    writeFile(path.join(tmpDir, "sub", "a.txt"), "12345");
    writeFile(path.join(tmpDir, "b.txt"), "67890");
    const size = calculateDirSize(tmpDir);
    expect(size).toBe(10);
  });
});
