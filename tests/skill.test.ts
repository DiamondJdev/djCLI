import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { installSkills, uninstallSkills } from "../src/commands/skill.js";

let home: string;
let source: string;
let central: string;

beforeEach(() => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "dj-skill-"));
  home = path.join(root, "home");
  source = path.join(root, "src", "skills");
  central = path.join(home, ".dj", "skills", "dj-init");
  fs.mkdirSync(home);
  fs.mkdirSync(path.join(source, "dj-init"), { recursive: true });
  fs.writeFileSync(path.join(source, "dj-init", "SKILL.md"), "skill");
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  fs.rmSync(path.dirname(home), { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("installSkills", () => {
  it("copies each skill to ~/.dj/skills and links it into existing agent roots", () => {
    fs.mkdirSync(path.join(home, ".claude"));
    fs.mkdirSync(path.join(home, ".codex", "skills"), { recursive: true });
    const report = installSkills(home, source);
    expect(fs.existsSync(path.join(central, "SKILL.md"))).toBe(true);
    expect(fs.readlinkSync(path.join(home, ".claude/skills/dj-init"))).toBe(central);
    expect(fs.readlinkSync(path.join(home, ".codex/skills/dj-init"))).toBe(central);
    expect(report.skipped).toEqual(
      expect.arrayContaining([
        path.join(home, ".agents"),
        path.join(home, ".cursor"),
        path.join(home, ".gemini"),
      ]),
    );
  });

  it("is idempotent: a second install relinks with no conflicts", () => {
    fs.mkdirSync(path.join(home, ".claude"));
    installSkills(home, source);
    const report = installSkills(home, source);
    expect(report.conflicts).toEqual([]);
    expect(report.linked).toContain(path.join(home, ".claude/skills/dj-init"));
    expect(fs.readFileSync(path.join(home, ".claude/skills/dj-init/SKILL.md"), "utf-8")).toBe("skill");
  });

  it("replaces an existing symlink that points elsewhere", () => {
    const skills = path.join(home, ".claude", "skills");
    fs.mkdirSync(skills, { recursive: true });
    fs.symlinkSync(os.tmpdir(), path.join(skills, "dj-init"), "dir");
    installSkills(home, source);
    expect(fs.readlinkSync(path.join(skills, "dj-init"))).toBe(central);
  });

  it("leaves a real folder with the same name alone and reports it", () => {
    const own = path.join(home, ".claude", "skills", "dj-init");
    fs.mkdirSync(own, { recursive: true });
    fs.writeFileSync(path.join(own, "mine.md"), "mine");
    const report = installSkills(home, source);
    expect(fs.readFileSync(path.join(own, "mine.md"), "utf-8")).toBe("mine");
    expect(report.conflicts).toContain(own);
  });

  it("refreshes the central copy, dropping files removed from the source", () => {
    fs.writeFileSync(path.join(source, "dj-init", "old.md"), "old");
    installSkills(home, source);
    fs.rmSync(path.join(source, "dj-init", "old.md"));
    installSkills(home, source);
    expect(fs.existsSync(path.join(central, "old.md"))).toBe(false);
  });
});

describe("uninstallSkills", () => {
  it("removes only links into ~/.dj/skills and the central copy", () => {
    const skills = path.join(home, ".claude", "skills");
    fs.mkdirSync(skills, { recursive: true });
    installSkills(home, source);
    fs.symlinkSync(os.tmpdir(), path.join(skills, "other"), "dir");
    const removed = uninstallSkills(home);
    expect(removed).toEqual([path.join(skills, "dj-init")]);
    expect(fs.existsSync(path.join(skills, "dj-init"))).toBe(false);
    expect(fs.readlinkSync(path.join(skills, "other"))).toBe(os.tmpdir());
    expect(fs.existsSync(central)).toBe(false);
  });
});
