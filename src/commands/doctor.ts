import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import { Command } from "commander";
import chalk from "chalk";
import packageJson from "../../package.json" with { type: "json" };
import { compareVersions, fetchLatestVersion } from "../utils/version.js";

export type Status = "ok" | "warn" | "fail";

export interface Check {
  name: string;
  status: Status;
  detail: string;
  fix?: string;
}

export interface DoctorDeps {
  nodeVersion: string;
  minNode: string;
  djVersion: string;
  fetchLatest: () => Promise<string>;
  /** Runs `<cmd> --version`; returns trimmed output, or null if it failed. */
  run: (cmd: string) => string | null;
  gitConfig: (key: string) => string | null;
  djOnPath: string | null;
  runningDj: string;
  skillInstalled: boolean;
}

const ok = (name: string, detail: string): Check => ({ name, status: "ok", detail });
const warn = (name: string, detail: string, fix?: string): Check => ({ name, status: "warn", detail, fix });
const fail = (name: string, detail: string, fix?: string): Check => ({ name, status: "fail", detail, fix });

function checkNode(d: DoctorDeps): Check {
  return compareVersions(d.nodeVersion, d.minNode) >= 0
    ? ok("Node", d.nodeVersion)
    : fail("Node", `${d.nodeVersion} (need >=${d.minNode})`, "Install a newer Node.js");
}

async function checkDjVersion(d: DoctorDeps): Promise<Check> {
  try {
    const latest = await d.fetchLatest();
    return compareVersions(d.djVersion, latest) >= 0
      ? ok("dj version", `${d.djVersion} (latest)`)
      : warn("dj version", `${d.djVersion}, latest is ${latest}`, "Run: dj upgrade");
  } catch {
    return warn("dj version", `${d.djVersion}, couldn't reach the npm registry`);
  }
}

function checkDjOnPath(d: DoctorDeps): Check {
  if (!d.djOnPath) {
    return warn("dj on PATH", "dj not found on PATH", "Install globally: npm i -g djmond");
  }
  return d.djOnPath === d.runningDj
    ? ok("dj on PATH", d.djOnPath)
    : warn("dj on PATH", `PATH has ${d.djOnPath}, running ${d.runningDj}`, "Remove the stale install");
}

function checkTool(d: DoctorDeps, cmd: string, required: boolean): Check {
  const version = d.run(cmd);
  if (version) return ok(cmd, version);
  return required
    ? fail(cmd, "not found", `Install ${cmd}`)
    : warn(cmd, "not found", `Install ${cmd} to use it with dj init`);
}

function checkGitIdentity(d: DoctorDeps): Check {
  const missing = ["user.name", "user.email"].filter((k) => !d.gitConfig(k));
  return missing.length === 0
    ? ok("git identity", "user.name and user.email set")
    : warn("git identity", `${missing.join(", ")} not set`, `Run: git config --global ${missing[0]} <value>`);
}

export async function runChecks(d: DoctorDeps): Promise<Check[]> {
  return [
    checkNode(d),
    await checkDjVersion(d),
    checkDjOnPath(d),
    checkTool(d, "npm", true),
    checkTool(d, "pnpm", false),
    checkTool(d, "uv", false),
    checkTool(d, "git", true),
    checkGitIdentity(d),
    d.skillInstalled
      ? ok("dj-init skill", "installed")
      : warn("dj-init skill", "not installed", "Run: dj skill install"),
  ];
}

export function exitCode(checks: Check[]): number {
  return checks.some((c) => c.status === "fail") ? 1 : 0;
}

function tryExec(cmd: string, args: string[]): string | null {
  try {
    return execFileSync(cmd, args, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

function realpathOrNull(p: string | null): string | null {
  if (!p) return null;
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
}

function realDeps(): DoctorDeps {
  return {
    nodeVersion: process.version,
    minNode: packageJson.engines.node.replace(/^[^\d]*/, ""),
    djVersion: packageJson.version,
    fetchLatest: () => fetchLatestVersion(),
    run: (cmd) => tryExec(cmd, ["--version"]),
    gitConfig: (key) => tryExec("git", ["config", "--get", key]),
    djOnPath: realpathOrNull(tryExec("which", ["dj"])),
    runningDj: realpathOrNull(process.argv[1]) ?? process.argv[1],
    skillInstalled: fs.existsSync(path.join(os.homedir(), ".dj", "skills", "dj-init")),
  };
}

const ICONS: Record<Status, string> = {
  ok: chalk.green("✔"),
  warn: chalk.yellow("⚠"),
  fail: chalk.red("✖"),
};

async function doctorAction(): Promise<void> {
  const checks = await runChecks(realDeps());
  for (const c of checks) {
    console.log(`${ICONS[c.status]} ${c.name}: ${c.detail}`);
    if (c.fix && c.status !== "ok") console.log(chalk.dim(`    ${c.fix}`));
  }
  process.exitCode = exitCode(checks);
}

export const doctorCommand = new Command("doctor")
  .description("Check that your environment is ready to use dj")
  .action(doctorAction);
