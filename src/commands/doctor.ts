import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import { Command } from "commander";
import chalk from "chalk";
import packageJson from "../../package.json" with { type: "json" };
import { compareVersions, fetchLatestVersion } from "../utils/version.js";

type Status = "ok" | "warn" | "fail";
interface Check {
  status: Status;
  name: string;
  detail: string;
  fix?: string;
}

const c = (status: Status, name: string, detail: string, fix?: string): Check => ({ status, name, detail, fix });

function tryExec(cmd: string, args: string[]): string | null {
  try {
    return execFileSync(cmd, args, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim() || null;
  } catch {
    return null;
  }
}

function tool(cmd: string, missing: "warn" | "fail"): Check {
  const version = tryExec(cmd, ["--version"]);
  return version ? c("ok", cmd, version) : c(missing, cmd, "not found", `Install ${cmd}`);
}

async function djVersion(): Promise<Check> {
  const current = packageJson.version;
  try {
    const latest = await fetchLatestVersion();
    return compareVersions(current, latest) >= 0
      ? c("ok", "dj version", `${current} (latest)`)
      : c("warn", "dj version", `${current}, latest is ${latest}`, "Run: dj upgrade");
  } catch {
    return c("warn", "dj version", `${current}, couldn't reach the npm registry`);
  }
}

const real = (p: string) => {
  try {
    return fs.realpathSync(p);
  } catch {
    return p;
  }
};

function djOnPath(): Check {
  const found = tryExec("which", ["dj"]);
  if (!found) return c("warn", "dj on PATH", "dj not found on PATH", "Install globally: npm i -g djmond");
  const onPath = real(found);
  const running = real(process.argv[1]);
  return onPath === running
    ? c("ok", "dj on PATH", onPath)
    : c("warn", "dj on PATH", `PATH has ${onPath}, running ${running}`, "Remove the stale install");
}

export async function runChecks(): Promise<Check[]> {
  const need = parseInt(packageJson.engines.node.replace(/^\D+/, ""), 10);
  const major = parseInt(process.versions.node, 10);
  const unset = ["user.name", "user.email"].filter((k) => !tryExec("git", ["config", "--get", k]));
  const skill = fs.existsSync(path.join(os.homedir(), ".dj", "skills", "dj-init"));

  return [
    major >= need
      ? c("ok", "Node", process.version)
      : c("fail", "Node", `${process.version} (need >=${need})`, "Install a newer Node.js"),
    await djVersion(),
    djOnPath(),
    tool("npm", "fail"),
    tool("pnpm", "warn"),
    tool("uv", "warn"),
    tool("git", "fail"),
    unset.length === 0
      ? c("ok", "git identity", "user.name and user.email set")
      : c("warn", "git identity", `${unset.join(", ")} not set`, `Run: git config --global ${unset[0]} <value>`),
    skill
      ? c("ok", "dj-init skill", "installed")
      : c("warn", "dj-init skill", "not installed", "Run: dj skill install"),
  ];
}

const ICONS: Record<Status, string> = {
  ok: chalk.green("✔"),
  warn: chalk.yellow("⚠"),
  fail: chalk.red("✖"),
};

async function doctorAction(): Promise<void> {
  const checks = await runChecks();
  for (const k of checks) {
    console.log(`${ICONS[k.status]} ${k.name}: ${k.detail}`);
    if (k.fix && k.status !== "ok") console.log(chalk.dim(`    ${k.fix}`));
  }
  if (checks.some((k) => k.status === "fail")) process.exitCode = 1;
}

export const doctorCommand = new Command("doctor")
  .description("Check that your environment is ready to use dj")
  .action(doctorAction);
