import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { Command } from "commander";
import chalk from "chalk";
import { findPackageRoot } from "../utils/package-root.js";

export const AGENT_SKILL_DIRS: readonly string[] = [
  ".claude/skills",
  ".agents/skills",
  ".codex/skills",
  ".cursor/skills",
  ".gemini/skills",
];

export interface SkillReport {
  linked: string[];
  skipped: string[];
  conflicts: string[];
}

function centralSkillsDir(home: string): string {
  return path.join(home, ".dj", "skills");
}

function listSkills(sourceSkillsDir: string): string[] {
  return fs
    .readdirSync(sourceSkillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function isSymlink(p: string): boolean {
  try {
    return fs.lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

function existsAtAll(p: string): boolean {
  try {
    fs.lstatSync(p);
    return true;
  } catch {
    return false;
  }
}

export function installSkills(
  home: string,
  sourceSkillsDir: string,
): SkillReport {
  const skills = listSkills(sourceSkillsDir);
  const central = centralSkillsDir(home);

  for (const skill of skills) {
    const dest = path.join(central, skill);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(path.join(sourceSkillsDir, skill), dest, { recursive: true });
  }

  const linked: string[] = [];
  const skipped: string[] = [];
  const conflicts: string[] = [];

  for (const agentDir of AGENT_SKILL_DIRS) {
    const agentRoot = path.join(home, agentDir.split("/")[0]);
    if (!fs.existsSync(agentRoot)) {
      skipped.push(agentRoot);
      continue;
    }
    const skillsDir = path.join(home, agentDir);
    fs.mkdirSync(skillsDir, { recursive: true });

    for (const skill of skills) {
      const link = path.join(skillsDir, skill);
      if (isSymlink(link)) {
        fs.unlinkSync(link);
      } else if (existsAtAll(link)) {
        conflicts.push(link);
        continue;
      }
      fs.symlinkSync(path.join(central, skill), link, "dir");
      linked.push(link);
    }
  }

  return { linked, skipped, conflicts };
}

export function uninstallSkills(home: string): string[] {
  const central = centralSkillsDir(home);
  const removed: string[] = [];
  const removedSkills = new Set<string>();

  for (const agentDir of AGENT_SKILL_DIRS) {
    const skillsDir = path.join(home, agentDir);
    let entries: string[];
    try {
      entries = fs.readdirSync(skillsDir);
    } catch {
      continue;
    }
    for (const name of entries) {
      const link = path.join(skillsDir, name);
      if (!isSymlink(link)) continue;
      const target = path.resolve(skillsDir, fs.readlinkSync(link));
      if (!target.startsWith(central + path.sep)) continue;
      fs.unlinkSync(link);
      removed.push(link);
      removedSkills.add(path.basename(target));
    }
  }

  for (const skill of removedSkills) {
    fs.rmSync(path.join(central, skill), { recursive: true, force: true });
  }

  return removed;
}

function installAction(): void {
  const report = installSkills(
    os.homedir(),
    path.join(findPackageRoot(), "skills"),
  );
  for (const link of report.linked) console.log(chalk.green(`Linked ${link}`));
  for (const root of report.skipped)
    console.log(`Skipped ${root} (not installed)`);
  for (const link of report.conflicts)
    console.log(
      chalk.yellow(`Left ${link} alone: a real folder with that name exists`),
    );
}

function uninstallAction(): void {
  const removed = uninstallSkills(os.homedir());
  for (const link of removed) console.log(`Removed ${link}`);
  if (removed.length === 0) console.log("No dj skills were installed");
}

export const skillCommand = new Command("skill")
  .description("Install dj's agent skills for Claude Code, Codex and others")
  .addCommand(
    new Command("install")
      .description("Copy skills to ~/.dj/skills and link them into each agent")
      .action(installAction),
  )
  .addCommand(
    new Command("uninstall")
      .description("Remove dj's skill links and ~/.dj/skills copies")
      .action(uninstallAction),
  );
